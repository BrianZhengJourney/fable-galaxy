/* Shared high-fidelity renderer for the curated nebula collection.
   Each object keeps its observation exact at the canonical camera, then
   reveals an explicitly interpretive depth volume and family-specific
   structure as the visitor orbits.  Source photographs are owned by the
   global texture cache; this module disposes only resources it creates. */

import * as THREE from 'three';
import { nebulaProfile } from '../../data/nebulaProfiles.js';
import { landmarkDepth } from '../../data/landmarkDepth.js';
import { loadTexture } from '../../utils/assets.js';
import { mulberry, hashStr, gaussian } from '../../utils/rng.js';
import { detectTier } from '../../core/quality.js';
import { buildPhotoRelief } from './nebulaMatter.js';
import { buildNebulaSculptA } from './nebulaSculptA.js';
import { buildNebulaSculptB } from './nebulaSculptB.js';

const DISPLAY_HEIGHT = 62;

const QUALITY = Object.freeze({
  low: Object.freeze({
    starSample: 220,
    stars: 34,
    familyPoints: 1800,
    reliefSample: 132,
    reliefTriangles: 4200,
    dustTriangles: 1100,
  }),
  high: Object.freeze({
    starSample: 340,
    stars: 88,
    familyPoints: 5200,
    reliefSample: 288,
    reliefTriangles: 16000,
    dustTriangles: 5000,
  }),
});

function clamp01(value){ return Math.max(0, Math.min(1, value)); }

function smoothstep(a, b, value){
  const x = clamp01((value - a) / Math.max(1e-6, b - a));
  return x * x * (3 - 2 * x);
}

function damp(value, target, speed, dt){
  return THREE.MathUtils.lerp(value, target, 1 - Math.exp(-speed * dt));
}

function numberFrom(source, keys, fallback){
  for (const key of keys){
    const value = source && source[key];
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function colorFrom(value, fallback){
  if (value && value.isColor) return value.clone();
  if (Array.isArray(value) && value.length >= 3){
    const scale = Math.max(value[0], value[1], value[2]) > 1 ? 1 / 255 : 1;
    return new THREE.Color(
      clamp01((Number(value[0]) || 0) * scale),
      clamp01((Number(value[1]) || 0) * scale),
      clamp01((Number(value[2]) || 0) * scale));
  }
  if (value && typeof value === 'object' &&
      Number.isFinite(value.r) && Number.isFinite(value.g) && Number.isFinite(value.b)){
    const scale = Math.max(value.r, value.g, value.b) > 1 ? 1 / 255 : 1;
    return new THREE.Color(value.r * scale, value.g * scale, value.b * scale);
  }
  if (typeof value === 'string' && /^\s*\d+\s*,/.test(value)){
    const channels = value.split(',').slice(0, 3).map(Number);
    if (channels.length === 3 && channels.every(Number.isFinite))
      return colorFrom(channels, fallback);
  }
  try{ return new THREE.Color(value == null ? fallback : value); }
  catch(_error){ return new THREE.Color(fallback); }
}

function solidTexture(color){
  const c = colorFrom(color, 0x12121c);
  const data = new Uint8Array([
    Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255,
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeTracker(){
  const textures = new Set(), materials = new Set(), geometries = new Set();
  let disposed = false;
  return {
    texture(value){ if (value) textures.add(value); return value; },
    material(value){ if (value) materials.add(value); return value; },
    geometry(value){ if (value) geometries.add(value); return value; },
    get disposed(){ return disposed; },
    dispose(){
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      geometries.clear(); materials.clear(); textures.clear();
    },
  };
}

function buildProjector(parent, fallback, tracker){
  const uniforms = {
    uSource: { value: fallback },
    uReady: { value: 0 },
    uOpacity: { value: 1 },
  };
  const material = tracker.material(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uSource;
      uniform float uReady;
      uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec3 source = texture2D(uSource, vUv).rgb;
        float edgeX = smoothstep(0.0, .055, vUv.x) *
                      smoothstep(0.0, .055, 1.0-vUv.x);
        float edgeY = smoothstep(0.0, .055, vUv.y) *
                      smoothstep(0.0, .055, 1.0-vUv.y);
        gl_FragColor = vec4(source, uReady * uOpacity * edgeX * edgeY);
      }`,
  }));
  const geometry = tracker.geometry(new THREE.PlaneGeometry(DISPLAY_HEIGHT, DISPLAY_HEIGHT));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'exact-observation-projector';
  mesh.renderOrder = 30;
  parent.add(mesh);
  return { mesh, uniforms };
}

function imagePixels(image, width, height, blur = 0){
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (blur) context.filter = `blur(${blur}px)`;
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function sourceStarColor(pixels, offset){
  const source = [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
    .map(channel => channel / 255);
  const luma = source[0] * .299 + source[1] * .587 + source[2] * .114;
  const boosted = source.map(channel => clamp01(luma + (channel - luma) * 1.28));
  const color = new THREE.Color(...boosted);
  const peak = Math.max(color.r, color.g, color.b, .001);
  color.multiplyScalar(Math.min(1.12 / peak, 1.24));
  return color;
}

function buildAlignedStars(parent, image, depthImage, aspect, profile, budget, tracker,
  reveal, seed){
  const width = budget.starSample;
  const height = Math.max(24, Math.round(width / Math.max(aspect, .01)));
  const sharp = imagePixels(image, width, height, 0);
  const soft = imagePixels(image, width, height, 3.1);
  const depthPixels = depthImage ? imagePixels(depthImage, width, height, 1.2) : null;
  const luminance = new Float32Array(width * height);
  const blurred = new Float32Array(width * height);
  for (let q = 0; q < luminance.length; q++){
    const i = q * 4;
    luminance[q] = (.299*sharp[i] + .587*sharp[i+1] + .114*sharp[i+2]) / 255;
    blurred[q] = (.299*soft[i] + .587*soft[i+1] + .114*soft[i+2]) / 255;
  }

  const centralFamily = new Set([
    'planetary-ring', 'double-ring', 'star-cavity', 'nested-shell', 'wind-bubble',
  ]).has(profile.family);
  const candidates = [];
  for (let py = 2; py < height - 2; py++){
    for (let px = 2; px < width - 2; px++){
      const q = py * width + px;
      const light = luminance[q], background = blurred[q];
      const contrast = light - background;
      if (light < .36 || contrast < .095 || background > .52) continue;
      let maximum = true;
      for (let dy = -2; dy <= 2 && maximum; dy++){
        for (let dx = -2; dx <= 2; dx++){
          if (!dx && !dy) continue;
          if (luminance[(py+dy)*width + px+dx] > light){ maximum = false; break; }
        }
      }
      if (!maximum) continue;
      const nx = px / (width - 1) - .5;
      const ny = py / (height - 1) - .5;
      const center = 1 - clamp01(Math.hypot(nx, ny) * 1.7);
      candidates.push({ px, py, light, contrast,
        score: contrast + light*.16 + (centralFamily ? center*.08 : 0) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const selected = [];
  const separation = numberFrom(profile.structure, ['starSeparationPx'], 11);
  const separationSq = separation*separation;
  for (const candidate of candidates){
    if (selected.some(other => {
      const dx = other.px - candidate.px, dy = other.py - candidate.py;
      return dx*dx + dy*dy < separationSq;
    })) continue;
    selected.push(candidate);
    if (selected.length >= budget.stars) break;
  }
  if (!selected.length) return null;

  const rnd = mulberry(hashStr(seed));
  const depth = numberFrom(profile.volume, ['depth', 'depthWorld'], 34);
  const positions = new Float32Array(selected.length * 3);
  const colors = new Float32Array(selected.length * 3);
  const sizes = new Float32Array(selected.length);
  const plateWidth = DISPLAY_HEIGHT * aspect;
  for (let n = 0; n < selected.length; n++){
    const star = selected[n];
    const offset = (star.py * width + star.px) * 4;
    positions[n*3] = (star.px / (width - 1) - .5) * plateWidth;
    positions[n*3+1] = (.5 - star.py / (height - 1)) * DISPLAY_HEIGHT;
    const depthOffset = (star.py*width+star.px)*4;
    positions[n*3+2] = depthPixels
      ? (depthPixels[depthOffset]/255-.5)*depth*.88+gaussian(rnd)*depth*.035
      : -(2+rnd()*depth*.86);
    const color = sourceStarColor(sharp, offset);
    colors[n*3] = color.r; colors[n*3+1] = color.g; colors[n*3+2] = color.b;
    sizes[n] = 2 + Math.min(6.4, star.contrast * 19) + star.light * 1.1;
  }

  const geometry = tracker.geometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.computeBoundingSphere();
  const material = tracker.material(new THREE.ShaderMaterial({
    uniforms: { uReveal: reveal },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      uniform float uReveal;
      varying vec3 vColor;
      void main(){
        vColor = color;
        vec3 p = position;
        p.z *= uReveal;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * clamp(92.0/max(38.0,-mv.z), .72, 2.1);
      }`,
    fragmentShader: `
      uniform float uReveal;
      varying vec3 vColor;
      void main(){
        vec2 p = abs(gl_PointCoord * 2.0 - 1.0);
        float radius = length(p);
        if (radius > 1.0) discard;
        float core = pow(max(0.0, 1.0-radius), 2.7);
        float rayX = exp(-p.x*18.0) * pow(max(0.0,1.0-p.y), 4.0);
        float rayY = exp(-p.y*18.0) * pow(max(0.0,1.0-p.x), 4.0);
        float alpha = uReveal * (core + (rayX+rayY)*.18);
        gl_FragColor = vec4(vColor * (.72+core*.46), alpha);
      }`,
  }));
  const stars = new THREE.Points(geometry, material);
  stars.name = 'photo-aligned-colored-stars';
  stars.userData.allowedPointRole = 'registered-stellar-sources';
  stars.renderOrder = 24;
  parent.add(stars);
  parent.userData.alignedColoredStars = selected.length;
  return stars;
}

function buildFamilyLayer(parent, profile, budget, tracker, seed){
  const root = new THREE.Group();
  root.name = `scientific-morphology:${profile.family}`;
  parent.add(root);
  const handled = buildNebulaSculptA({ root, profile, budget, tracker, seed }) ||
    buildNebulaSculptB({ root, profile, budget, tracker, seed });
  if (!handled) throw new Error(`Unsupported crisp nebula family: ${profile.family}`);
  root.userData.family = profile.family;
  root.userData.interpretive = true;
  root.userData.crispReconstruction = true;
  return root;
}

function setFamilyReveal(root, reveal){
  root.traverse(object => {
    const materials = Array.isArray(object.material)
      ? object.material : object.material ? [object.material] : [];
    for (const material of materials){
      const base = material.userData && material.userData.baseOpacity;
      if (Number.isFinite(base)) material.opacity = base * reveal;
    }
  });
}

/* Compose one exact catalog photograph, a source/depth-aligned triangulated
   relief, and a recipe-driven morphology layer. Off-axis structure stays
   legible because weak pixels become literal holes between hard mesh patches,
   not translucent layers or an extruded photograph. */
export function buildNebulaCollectionFeatured({ entry, image }){
  if (!entry || !entry.id) throw new TypeError('Nebula collection requires an entry');
  if (!image || !image.file)
    throw new Error(entry.id + ': visible observation image is required');
  const profile = nebulaProfile(entry.id);
  if (!profile) throw new Error(entry.id + ': missing nebula profile');

  const tier = detectTier().tier === 'low' ? 'low' : 'high';
  const budget = QUALITY[tier];
  const tracker = makeTracker();
  const group = new THREE.Group();
  group.name = `nebula-collection:${entry.id}`;
  let disposed = false;
  let time = 0;
  let reveal = 0;
  let projectorOpacity = 1;
  let alignedStars = null;
  let photoRelief = null;
  let pendingDepth = null;

  const fallback = tracker.texture(solidTexture(0x11111b));
  const projector = buildProjector(group, fallback, tracker);
  const starReveal = { value: 0 };
  const family = buildFamilyLayer(group, profile, budget, tracker,
    `nebula-family:${entry.id}`);
  setFamilyReveal(family, 0);
  family.visible = false;

  function attachPhotoRelief(source, depthImage, aspect){
    if (disposed || !source) return;
    if (!alignedStars){
      alignedStars = buildAlignedStars(group, source, depthImage, aspect, profile,
        budget, tracker, starReveal, `nebula-stars:${entry.id}`);
      if (alignedStars) alignedStars.visible = reveal > .002;
    }
    if (!photoRelief){
      photoRelief = buildPhotoRelief({
        parent: group,
        image: source,
        depthImage,
        aspect,
        profile,
        budget,
        tracker,
        reveal: starReveal,
        seed: `nebula-photo-relief:${entry.id}`,
      });
      photoRelief.update(reveal);
      group.userData.photoRelief = { ...photoRelief.counts };
    }
  }

  loadTexture(image.file, texture => {
    if (disposed) return;
    projector.uniforms.uSource.value = texture;
    projector.uniforms.uReady.value = 1;
    const source = texture.image;
    const width = source && source.width ? source.width : 1;
    const height = source && source.height ? source.height : 1;
    const aspect = width / Math.max(height, 1);
    projector.mesh.scale.x = aspect;
    if (source){
      const depthUrl = landmarkDepth(entry.id);
      if (depthUrl){
        const depthImage = new Image();
        pendingDepth = depthImage;
        const finish = resolved => {
          depthImage.onload = null;
          depthImage.onerror = null;
          if (pendingDepth === depthImage) pendingDepth = null;
          attachPhotoRelief(source, resolved, aspect);
        };
        depthImage.onload = () => finish(depthImage);
        depthImage.onerror = () => finish(null);
        depthImage.src = depthUrl;
      } else attachPhotoRelief(source, null, aspect);
    }
    group.userData.observationReady = true;
    group.userData.observationAspect = aspect;
  });

  group.userData.renderer = 'nebula-photo-sculpt-v2';
  group.userData.family = profile.family;
  group.userData.qualityTier = tier;
  group.userData.qualityBudget = { ...budget };
  group.userData.source = profile.source || null;
  group.userData.sources = profile.sources || null;
  group.userData.genericSoftClouds = false;
  group.userData.reconstruction = profile.reconstruction || null;
  group.userData.scientificCaveat = profile.caveat ||
    'Depth and off-axis structure are an interpretive visualization, not tomography.';
  group.userData.observationPolicy =
    'Exact source RGB projector head-on; inferred spatial reconstruction appears only off-axis.';

  const cameraConfig = profile.camera || {};
  const revealAngles = profile.reconstruction &&
    profile.reconstruction.revealAngleDeg;
  const exactAngleDeg = Array.isArray(revealAngles)
    ? numberFrom({ value: revealAngles[0] }, ['value'], 2.5) : 2.5;
  const volumeAngleDeg = Array.isArray(revealAngles)
    ? numberFrom({ value: revealAngles[1] }, ['value'], 18) : 18;
  const observationStart = Math.cos(THREE.MathUtils.degToRad(
    Math.max(exactAngleDeg + .5, volumeAngleDeg)));
  const observationFull = Math.cos(THREE.MathUtils.degToRad(
    Math.max(.1, exactAngleDeg)));
  const localCamera = new THREE.Vector3();
  return {
    group,
    content: family,
    uniforms: { uPresentation: starReveal },
    focusDist: numberFrom(cameraConfig, ['focusDist', 'distance'], 88),
    startTheta: numberFrom(cameraConfig, ['startTheta', 'theta'], 0),
    startPhi: numberFrom(cameraConfig, ['startPhi', 'phi'], Math.PI/2),
    autoRotate: false,
    hasIR: false,
    isImage: true,
    update(dt, camera){
      if (disposed) return;
      dt = Math.min(Math.max(Number(dt) || 0, 0), .05);
      time += dt;
      if (camera){
        group.updateWorldMatrix(true, false);
        localCamera.copy(camera.position);
        group.worldToLocal(localCamera);
        const length = Math.max(localCamera.length(), .001);
        const front = localCamera.z / length;
        // Respect each reconstruction's authored reveal arc: the source photo
        // is exact only close to its camera, then fully yields to geometry.
        // This prevents a rectangular photograph from surviving at oblique
        // angles while preserving pixel-for-pixel registration head-on.
        const observationTarget = smoothstep(observationStart, observationFull, front);
        const revealTarget = 1 - observationTarget;
        reveal = damp(reveal, revealTarget, 4.2, dt);
        projectorOpacity = damp(projectorOpacity, observationTarget, 5.6, dt);
        projector.uniforms.uOpacity.value = projectorOpacity;
        projector.mesh.visible = projectorOpacity > .002;
        starReveal.value = reveal;
        if (alignedStars) alignedStars.visible = reveal > .002;
        family.visible = reveal > .002;
        family.scale.z = .14 + reveal*.86;
        setFamilyReveal(family, reveal * (.62 + reveal*.38));
      }
      if (photoRelief) photoRelief.update(reveal);
      family.rotation.y = Math.sin(time*.045) * .022;
      family.rotation.x = Math.sin(time*.031+.8) * .009;
      group.userData.spatialReveal = reveal;
      group.userData.projectorOpacity = projectorOpacity;
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      if (pendingDepth){
        pendingDepth.onload = null;
        pendingDepth.onerror = null;
        pendingDepth.removeAttribute('src');
        pendingDepth = null;
      }
      tracker.dispose();
      group.userData.disposed = true;
    },
  };
}
