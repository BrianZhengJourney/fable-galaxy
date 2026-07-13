/* NASA-Eyes-grade planet materials.
   Upgrades a MeshStandardMaterial with real relief (normal/bump), an ocean
   roughness mask, and — via onBeforeCompile — Earth's night-side city lights
   gated by the sun direction. Plus a Fresnel atmosphere limb shell. All
   optional per body; anything missing simply isn't applied. */

import * as THREE from 'three';
import { loadTexture } from '../utils/assets.js';
import { deriveNormalMap, invertToRoughness } from '../utils/normalmap.js';
import { getEarthEpochTexture } from '../utils/earthEpochTextures.js';
import { getPlanetEpochTexture } from '../utils/planetEpochTextures.js';

/* ---- atmospheric limb: a back-side sphere with a rim-fresnel glow ---- */
export function buildAtmosphere(radius, colorHex, strength = 1.0){
  const c = new THREE.Color(colorHex);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
      uStrength: { value: strength },
      uSunViewDir: { value: new THREE.Vector3(0, 0, 1) }
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vView;
      void main(){
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uStrength; uniform vec3 uSunViewDir;
      varying vec3 vN; varying vec3 vView;
      void main(){
        float rim = pow(1.0 - abs(dot(vN, vView)), 2.8);
        float lit = clamp(dot(normalize(vN), uSunViewDir) * 0.5 + 0.6, 0.15, 1.0);
        gl_FragColor = vec4(uColor, rim * uStrength * lit);
      }`,
    transparent: true, blending: THREE.AdditiveBlending,
    side: THREE.BackSide, depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), mat);
  mesh.userData.atmoMat = mat;
  return mesh;
}

/* Every Sol planet keeps its observed texture as a stable shader base. An
   optional epoch texture blends above it: opaque for modeled cloud/weather
   maps, alpha-masked for Mars ice/dust. Earth also uses the same shader for
   its independent artificial-night-light layer. */
function installEpochShader(target){
  const mat = target.mat;
  if (mat.userData.epochUniforms) return mat.userData.epochUniforms;
  const earth = targetName(target) === 'EARTH';
  const uniforms = {
    epochMap: { value: null },
    epochBlend: { value: 0 },
    nightMap: { value: null },
    nightStrength: { value: earth ? 1 : 0 },
    sunViewDir: { value: new THREE.Vector3(0, 0, 1) },
  };
  mat.userData.epochUniforms = uniforms;
  mat.userData.sunViewDir = uniforms.sunViewDir.value;
  mat.onBeforeCompile = shader => {
    shader.uniforms.uEpochMap = uniforms.epochMap;
    shader.uniforms.uEpochBlend = uniforms.epochBlend;
    shader.uniforms.uNightTex = uniforms.nightMap;
    shader.uniforms.uNightStrength = uniforms.nightStrength;
    shader.uniforms.uSunViewDir = uniforms.sunViewDir;
    mat.userData.shader = shader;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uEpochMap;
        uniform float uEpochBlend;
        uniform sampler2D uNightTex;
        uniform float uNightStrength;
        uniform vec3 uSunViewDir;`)
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        if (uEpochBlend > 0.001) {
          vec4 fgEpochColor = texture2D(uEpochMap, vMapUv);
          diffuseColor.rgb = mix(diffuseColor.rgb, fgEpochColor.rgb,
            clamp(uEpochBlend * fgEpochColor.a, 0.0, 1.0));
        }
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        if (uNightStrength > 0.001) {
          float fgNdl = dot(normalize(vNormal), uSunViewDir);
          float fgNight = smoothstep(0.08, -0.18, fgNdl);
          totalEmissiveRadiance += texture2D(uNightTex, vMapUv).rgb
            * fgNight * 2.6 * uNightStrength;
        }
      `);
  };
  mat.customProgramCacheKey = () => 'fg-planet-epoch-v2';
  mat.needsUpdate = true;
  return uniforms;
}

function targetName(target){
  return target.name || (target.cfg && target.cfg.name) || '';
}

/* Capture mutable presentation values once. Re-running is intentional: real
   maps and cloud/ring meshes arrive at different times. */
export function installPlanetAppearance(target){
  if (!target || !target.mat) return null;
  const earth = targetName(target) === 'EARTH';
  const a = target._appearance || (target._appearance = {
    surface: 'present', activeSurface: 'present',
    pendingSurface: null, pendingEpochMap: null,
    epochBlend: 0, epochBlendTarget: 0,
    nightStrength: earth ? 1 : 0, nightStrengthTarget: earth ? 1 : 0,
    retainRelief: false,
  });
  installEpochShader(target);
  if (target.spin && a.baseTilt == null){
    a.baseTilt = target.spin.rotation.z;
    a.tilt = a.baseTilt;
    a.tiltTarget = a.baseTilt;
  }
  if (target.clouds && a.cloudOpacity == null){
    a.cloudOpacity = target.clouds.material.opacity;
    a.cloudOpacityTarget = a.cloudOpacity;
    a.baseCloudOpacity = a.cloudOpacity;
  }
  if (target.atmosphere && a.atmosphereStrength == null){
    const u = target.atmosphere.userData.atmoMat.uniforms;
    a.atmosphereStrength = u.uStrength.value;
    a.atmosphereStrengthTarget = a.atmosphereStrength;
    a.baseAtmosphereStrength = a.atmosphereStrength;
    a.baseAtmosphereColor = new THREE.Vector3().copy(u.uColor.value);
  }
  if (target.ringMat && a.ringOpacity == null){
    a.ringOpacity = target.ringMat.opacity;
    a.ringOpacityTarget = a.ringOpacity;
    a.baseRingOpacity = a.ringOpacity;
    a.baseRingColor = target.ringMat.color.clone();
    a.ringUncertain = false;
  }
  return a;
}

/* Apply a complete, resolved body appearance. Orbital phase and position never
   enter this function; a few explicitly modeled axial-tilt scenarios may. */
export function setPlanetAppearance(target, spec){
  const a = installPlanetAppearance(target);
  if (!a || !spec) return;
  const mat = target.mat;
  const earth = targetName(target) === 'EARTH';
  const nextSurface = spec.surface || 'present';
  let surfaceResolved = true;
  const uniforms = installEpochShader(target);

  // The observed image is always the base. This makes async texture arrival
  // safe even while a fully opaque modeled atmosphere is selected.
  if (target.presentMap) mat.map = target.presentMap;
  else if (target.fallbackMap) mat.map = target.fallbackMap;
  if (nextSurface === 'present'){
    a.pendingSurface = null;
    a.pendingEpochMap = null;
    a.epochBlendTarget = 0;
  } else {
    const epochMap = earth
      ? getEarthEpochTexture(nextSurface)
      : getPlanetEpochTexture(targetName(target), nextSurface);
    if (epochMap){
      if (a.activeSurface === nextSurface){
        // Cancel a pending switch and return to the already-bound map.
        a.pendingSurface = null;
        a.pendingEpochMap = null;
        a.epochBlendTarget = 1;
      } else if (a.epochBlend > .02 && uniforms.epochMap.value){
        // Past A → past B is a two-stage transition: fade A to the observed
        // base, swap the sampler only at zero, then fade B in. New requests
        // simply replace the pending destination, so interrupted clicks stay
        // deterministic and never expose a half-blended wrong map.
        a.pendingSurface = nextSurface;
        a.pendingEpochMap = epochMap;
        a.epochBlendTarget = 0;
      } else {
        uniforms.epochMap.value = epochMap;
        a.activeSurface = nextSurface;
        a.pendingSurface = null;
        a.pendingEpochMap = null;
        a.epochBlendTarget = 1;
      }
    } else {
      surfaceResolved = false;
      a.pendingSurface = null;
      a.pendingEpochMap = null;
      a.epochBlendTarget = 0;
    }
  }
  if (earth){
    a.nightStrengthTarget = spec.nightStrength == null ? 1 : spec.nightStrength;
    uniforms.nightStrength.value = a.nightStrength;
  }
  uniforms.epochBlend.value = a.epochBlend;
  a.surface = surfaceResolved ? nextSurface : 'present';
  a.retainRelief = surfaceResolved && !!spec.retainRelief;

  // Modern relief/specular masks do not align with reconstructed continents.
  if (a.surface === 'present' || a.retainRelief){
    if (target.presentNormalMap) mat.normalMap = target.presentNormalMap;
    if (target.presentBumpMap) mat.bumpMap = target.presentBumpMap;
    if (target.presentRoughnessMap) mat.roughnessMap = target.presentRoughnessMap;
    mat.roughness = target.presentRoughness == null ? 0.92 : target.presentRoughness;
    mat.metalness = target.presentMetalness == null ? 0 : target.presentMetalness;
  } else {
    mat.normalMap = null; mat.bumpMap = null; mat.roughnessMap = null;
    mat.roughness = 0.94; mat.metalness = 0;
  }
  mat.needsUpdate = true;

  if (target.spin && a.baseTilt != null){
    a.tiltTarget = spec.axialTiltDeg == null
      ? a.baseTilt : THREE.MathUtils.degToRad(spec.axialTiltDeg);
  }

  if (target.clouds){
    a.cloudOpacityTarget = spec.cloudOpacity == null ? a.baseCloudOpacity : spec.cloudOpacity;
    if (a.cloudOpacityTarget > 0.001) target.clouds.visible = true;
  }
  if (target.atmosphere){
    const u = target.atmosphere.userData.atmoMat.uniforms;
    a.atmosphereStrengthTarget = spec.atmosphereStrength == null
      ? a.baseAtmosphereStrength : spec.atmosphereStrength;
    if (spec.atmosphereColor){
      const c = new THREE.Color(spec.atmosphereColor);
      u.uColor.value.set(c.r, c.g, c.b);
    } else if (a.baseAtmosphereColor) u.uColor.value.copy(a.baseAtmosphereColor);
  }
  if (target.ring && target.ringMat){
    a.ringOpacityTarget = spec.ringVisible === false ? 0 : (spec.ringOpacity || 0);
    a.ringUncertain = !!spec.ringUncertain;
    target.ring.visible = a.ringOpacity > 0.002 || a.ringOpacityTarget > 0.002;
    target.ringMat.color.copy(a.baseRingColor);
    if (a.ringUncertain) target.ringMat.color.lerp(new THREE.Color(0xffbd72), 0.34);
  }
}

export function updatePlanetAppearance(target, dt, now = 0){
  const a = target && target._appearance;
  if (!a) return;
  const k = 1 - Math.exp(-Math.max(0, dt) * 5.2);
  const approach = (value, goal) => value + (goal - value) * k;
  a.epochBlend = approach(a.epochBlend, a.epochBlendTarget);
  const u = target.mat.userData.epochUniforms;
  u.epochBlend.value = a.epochBlend;
  if (a.pendingEpochMap && a.epochBlend < .02){
    u.epochMap.value = a.pendingEpochMap;
    a.activeSurface = a.pendingSurface;
    a.pendingSurface = null;
    a.pendingEpochMap = null;
    a.epochBlend = 0;
    a.epochBlendTarget = 1;
    u.epochBlend.value = 0;
  }
  if (targetName(target) === 'EARTH'){
    a.nightStrength = approach(a.nightStrength, a.nightStrengthTarget);
    u.nightStrength.value = a.nightStrength;
  }
  if (target.spin && a.tiltTarget != null){
    a.tilt = approach(a.tilt, a.tiltTarget);
    target.spin.rotation.z = a.tilt;
  }
  if (target.clouds && a.cloudOpacityTarget != null){
    a.cloudOpacity = approach(a.cloudOpacity, a.cloudOpacityTarget);
    target.clouds.material.opacity = a.cloudOpacity;
    target.clouds.visible = a.cloudOpacity > 0.001 || a.cloudOpacityTarget > 0.001;
  }
  if (target.atmosphere && a.atmosphereStrengthTarget != null){
    a.atmosphereStrength = approach(a.atmosphereStrength, a.atmosphereStrengthTarget);
    target.atmosphere.userData.atmoMat.uniforms.uStrength.value = a.atmosphereStrength;
  }
  if (target.ring && target.ringMat && a.ringOpacityTarget != null){
    a.ringOpacity = approach(a.ringOpacity, a.ringOpacityTarget);
    const pulse = a.ringUncertain ? 0.88 + 0.12 * Math.sin(now * 1.7) : 1;
    target.ringMat.opacity = a.ringOpacity * pulse;
    target.ring.visible = a.ringOpacity > 0.002 || a.ringOpacityTarget > 0.002;
  }
}

/* Attach a city-light map without resetting the selected geological epoch. */
function addNightLights(target, nightTex){
  const uniforms = installEpochShader(target);
  uniforms.nightMap.value = nightTex;
}

function usesPresentRelief(target){
  return !target._appearance || target._appearance.surface === 'present'
    || target._appearance.retainRelief;
}

/* apply a real-imagery texture set to a planet's material + subobjects.
   set: { map, night, normal, bump, specular, deriveBump }  */
export function applyRealTextures(planet, set){
  const mat = planet.mat;

  loadTexture(set.map, tex => {
    if (planet.fallbackMap && planet.fallbackMap !== tex &&
        !(planet.fallbackMap.userData && planet.fallbackMap.userData.shared))
      planet.fallbackMap.dispose();
    planet.fallbackMap = null;
    planet.presentMap = tex;
    mat.map = tex;
    mat.emissive.set(0x000000);
    planet.baseEmissive = 0;
    mat.emissiveIntensity = 0;
    planet.presentRoughness = 0.92; planet.presentMetalness = 0;
    if (usesPresentRelief(planet)){
      mat.roughness = planet.presentRoughness; mat.metalness = planet.presentMetalness;
    }
    mat.needsUpdate = true;
    // derive relief from the albedo when no dedicated map is supplied
    if (set.deriveBump && !set.normal && !set.bump){
      try{
        planet.presentNormalMap = deriveNormalMap(tex.image, set.deriveBump);
        if (usesPresentRelief(planet))
          mat.normalMap = planet.presentNormalMap;
        mat.normalScale = new THREE.Vector2(0.85, 0.85);
        mat.needsUpdate = true;
      }catch(e){ /* keep flat */ }
    }
  });

  if (set.normal)
    loadTexture(set.normal, tex => {
      planet.presentNormalMap = tex;
      if (usesPresentRelief(planet)) mat.normalMap = tex;
      mat.normalScale = new THREE.Vector2(set.normalScale || 1, set.normalScale || 1);
      mat.needsUpdate = true;
    }, { srgb: false });

  if (set.bump)
    loadTexture(set.bump, tex => {
      planet.presentBumpMap = tex;
      if (usesPresentRelief(planet)) mat.bumpMap = tex;
      mat.bumpScale = set.bumpScale || 0.04; mat.needsUpdate = true;
    }, { srgb: false });

  if (set.specular)
    loadTexture(set.specular, tex => {
      try{
        planet.presentRoughnessMap = invertToRoughness(tex.image);
        if (usesPresentRelief(planet))
          mat.roughnessMap = planet.presentRoughnessMap;
        planet.presentRoughness = 1.0; planet.presentMetalness = 0.08;
        if (usesPresentRelief(planet)){
          mat.roughness = planet.presentRoughness; mat.metalness = planet.presentMetalness;
        }
        mat.needsUpdate = true;
      }catch(e){ /* keep uniform roughness */ }
    }, { srgb: false });

  if (set.night)
    loadTexture(set.night, tex => addNightLights(planet, tex));
}

/* refresh sun-direction uniforms each frame (view space). sun is at origin. */
const _v = new THREE.Vector3();
export function updatePlanetSun(planet, camera){
  const mat = planet.mat;
  if (mat.userData && mat.userData.shader){
    _v.copy(planet.group.position).multiplyScalar(-1).normalize()   // planet→sun (world)
      .transformDirection(camera.matrixWorldInverse);                // → view space
    mat.userData.sunViewDir.copy(_v);
    mat.userData.shader.uniforms.uSunViewDir.value.copy(_v);
  }
  if (planet.atmosphere){
    _v.copy(planet.group.position).multiplyScalar(-1).normalize()
      .transformDirection(camera.matrixWorldInverse);
    planet.atmosphere.userData.atmoMat.uniforms.uSunViewDir.value.copy(_v);
  }
}
