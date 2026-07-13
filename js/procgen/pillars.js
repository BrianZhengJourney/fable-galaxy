/* Pillars of Creation: a dedicated hybrid exhibit built around the four-cloud
   NASA/STScI positioning sculpt. The mesh is an invisible spatial scaffold;
   projected Hubble/Webb colour, a dust-surfel shell, ionized filaments, and a
   broad photo-to-volume morph preserve the character of the observations. */

import * as THREE from 'three';
import { mulberry, hashStr, gaussian } from '../utils/rng.js';
import { dotTexture } from '../objects/starfield.js';
import { loadTexture } from '../utils/assets.js';
import { landmarkImageIR } from '../data/landmarkImagesIR.js';
import { TEX_TIER, detectTier } from '../core/quality.js';

const MODEL = 'models/pillars-of-creation.glb';
const MODEL_LOW = 'models/pillars-of-creation-low.glb';
const MODEL_CREDIT = '3D model: Leah Hustak & Ralf Crawford (STScI)';
const PHOTO_ASPECT = 6780 / 7071;
const PHOTO_HEIGHT = 84;
const PHOTO_WIDTH = PHOTO_HEIGHT * PHOTO_ASPECT;
// Fidelity is the default even on automatically detected lower tiers. The
// compact asset remains available through the explicit ?tier=low override.
const EXPLICIT_LOW = TEX_TIER === 'low' && detectTier().forced === true;

function softCloudTexture(){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.88)');
  gradient.addColorStop(0.32, 'rgba(255,255,255,.30)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function placeholderTexture(color){
  const c = new THREE.Color(color);
  const data = new Uint8Array([
    Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function buildMaterial(){
  const visibleFallback = placeholderTexture(0x7d4226);
  const infraredFallback = placeholderTexture(0xc15c2e);
  const uniforms = {
    uVisible: { value: visibleFallback },
    uInfrared: { value: infraredFallback },
    uMix: { value: 0 },
    uPhotoReady: { value: 0 },
    // 0 = canonical photograph, 1 = free-orbit dust reconstruction.
    uOrbit: { value: 0 },
    // Photo-derived colour curtains appear only through the useful oblique arc.
    uVeil: { value: 0 },
    uBoundsMin: { value: new THREE.Vector3(-20, -60, -27) },
    uBoundsMax: { value: new THREE.Vector3(20, 25, 45) },
  };
  // Only the points are rendered.  Keeping a real material on the source mesh
  // lets normal scene disposal remain simple without ever drawing triangles.
  const material = new THREE.MeshBasicMaterial({ visible: false });
  const dispose = material.dispose.bind(material);
  material.dispose = () => {
    visibleFallback.dispose();
    infraredFallback.dispose();
    dispose();
  };
  return { material, uniforms };
}

/* The positioning mesh is most convincing as hundreds of thousands of soft
   surfels, not as a sealed rock.  The photograph supplies their colour while
   a view-dependent cyan/gold rim makes the cloud readable from any angle. */
function buildSurfelMaterial(uniforms){
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uVisible: uniforms.uVisible,
      uInfrared: uniforms.uInfrared,
      uMix: uniforms.uMix,
      uOrbit: uniforms.uOrbit,
      uBoundsMin: uniforms.uBoundsMin,
      uBoundsMax: uniforms.uBoundsMax,
      uPointSize: { value: EXPLICIT_LOW ? 2.9 : 2.55 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader: `
      uniform float uPointSize;
      varying vec3 vObjectPos;
      varying vec3 vObjectNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying float vGrain;
      float hash31(vec3 p){
        p = fract(p * vec3(.1031, .1030, .0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      void main(){
        vObjectPos = position;
        vObjectNormal = normalize(normal);
        vGrain = hash31(position * 2.73);
        // A tiny normal offset makes the point shell breathe beyond the hard
        // STL surface without changing the authoritative silhouette.
        vec3 displaced = position + normal * (vGrain - .5) * .34;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - world.xyz);
        vec4 mv = viewMatrix * world;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPointSize * clamp(92.0 / max(34.0, -mv.z), .72, 2.1);
      }`,
    fragmentShader: `
      uniform sampler2D uVisible;
      uniform sampler2D uInfrared;
      uniform float uMix;
      uniform float uOrbit;
      uniform vec3 uBoundsMin;
      uniform vec3 uBoundsMax;
      varying vec3 vObjectPos;
      varying vec3 vObjectNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying float vGrain;

      vec3 boostColor(vec3 c, float sat, float exposure){
        float l = dot(c, vec3(.299,.587,.114));
        return max(vec3(0.0), mix(vec3(l), c, sat) * exposure);
      }
      void main(){
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p,p);
        if (r2 > 1.0) discard;
        float soft = pow(1.0 - r2, 1.45);

        vec3 span = max(uBoundsMax - uBoundsMin, vec3(.001));
        vec3 q = (vObjectPos - uBoundsMin) / span;
        vec2 uv = vec2(q.x * .72 + .14, q.z * .78 + .05);
        vec3 photoV = boostColor(texture2D(uVisible, uv).rgb, 1.24, 1.06);
        vec3 photoI = boostColor(texture2D(uInfrared, uv).rgb, 1.18, 1.03);
        vec3 photo = mix(photoV, photoI, uMix);
        float signal = smoothstep(.018, .23, max(photo.r, max(photo.g, photo.b)));

        vec3 N = normalize(vWorldNormal), V = normalize(vViewDir);
        float rim = pow(1.0 - abs(dot(N,V)), 1.7);
        // Only the canonical face receives literal photographic colour.  The
        // sides become dusty umber/plum instead of the former flat orange clay.
        float photoFace = .14 + .74 * smoothstep(.0, .72, max(-vObjectNormal.y, 0.0));
        vec3 sideV = mix(vec3(.018,.006,.011), vec3(.28,.075,.030), vGrain);
        vec3 sideI = mix(vec3(.024,.008,.035), vec3(.32,.052,.030), vGrain);
        vec3 side = mix(sideV, sideI, uMix);
        vec3 color = mix(side, photo, photoFace * signal * .88);
        vec3 rimV = mix(vec3(.08,.72,.76), vec3(1.0,.53,.16), signal);
        vec3 rimI = mix(vec3(.27,.26,.90), vec3(1.0,.31,.09), signal);
        color += mix(rimV, rimI, uMix) * rim * (.22 + signal * .33);

        float grainAlpha = .24 + vGrain * .42;
        float alpha = uOrbit * soft * grainAlpha * (.44 + signal * .28 + rim * .22);
        gl_FragColor = vec4(color, alpha);
      }`,
  });
  return material;
}

function makeSurfelGeometry(source){
  const pos = source.attributes.position;
  const normal = source.attributes.normal;
  const cap = EXPLICIT_LOW ? 24000 : 120000;
  const count = Math.min(pos.count, cap);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const stride = pos.count / count;
  for (let i = 0; i < count; i++){
    const sourceIndex = Math.min(pos.count - 1, Math.floor((i + .37) * stride));
    positions[i*3] = pos.getX(sourceIndex);
    positions[i*3+1] = pos.getY(sourceIndex);
    positions[i*3+2] = pos.getZ(sourceIndex);
    if (normal){
      normals[i*3] = normal.getX(sourceIndex);
      normals[i*3+1] = normal.getY(sourceIndex);
      normals[i*3+2] = normal.getZ(sourceIndex);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/* A sharp, fixed projector plate is strongest only near the canonical Hubble
   camera. It reproduces the observation pixel-for-pixel head-on, then fades
   rapidly as orbit reveals the native four-cloud mesh underneath. */
function buildPhotoProjector(group, uniforms){
  const projectorUniforms = {
    uVisible: uniforms.uVisible,
    uInfrared: uniforms.uInfrared,
    uMix: uniforms.uMix,
    uReady: uniforms.uPhotoReady,
    uOpacity: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: projectorUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uVisible;
      uniform sampler2D uInfrared;
      uniform float uMix;
      uniform float uReady;
      uniform float uOpacity;
      varying vec2 vUv;
      vec3 boostColor(vec3 c, float saturation, float exposure){
        float luma = dot(c, vec3(.299,.587,.114));
        return max(vec3(0.0), mix(vec3(luma), c, saturation) * exposure);
      }
      void main(){
        vec3 visible = boostColor(texture2D(uVisible, vUv).rgb, 1.12, 1.04);
        vec3 infrared = boostColor(texture2D(uInfrared, vUv).rgb, 1.08, 1.02);
        float ex = smoothstep(0.0, .055, vUv.x) * smoothstep(0.0, .055, 1.0-vUv.x);
        float ey = smoothstep(0.0, .055, vUv.y) * smoothstep(0.0, .055, 1.0-vUv.y);
        float alpha = uOpacity * uReady * ex * ey;
        gl_FragColor = vec4(mix(visible, infrared, uMix), alpha);
      }`,
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_WIDTH, PHOTO_HEIGHT), material);
  plate.position.set(0, 7, 0);
  plate.renderOrder = 8;
  group.add(plate);
  return { plate, material, opacity: projectorUniforms.uOpacity };
}

/* Re-project the photograph's low-frequency colour as several shallow curved
   curtains.  Biased mip sampling removes point stars and fine pillar detail,
   leaving only the blue/teal/gold nebular field to carry into orbit. */
function buildNebulaVeils(group, uniforms){
  const layers = [
    { x: 0,  y: 7, z: -15, ry:  0.00, scale: 1.08, alpha: .17, shift: [ 0.000,  0.000], curve: 1.0 },
    { x: -4, y: 8, z: -30, ry:  0.13, scale: 1.28, alpha: .10, shift: [ 0.012, -0.008], curve: 1.8 },
    { x: 6,  y: 5, z: -47, ry: -0.18, scale: 1.52, alpha: .06, shift: [-0.018,  0.014], curve: 2.8 },
  ];
  const materials = [];
  for (const layer of layers){
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uVisible: uniforms.uVisible,
        uInfrared: uniforms.uInfrared,
        uMix: uniforms.uMix,
        uVeil: uniforms.uVeil,
        uReady: uniforms.uPhotoReady,
        uAlpha: { value: layer.alpha },
        uShift: { value: new THREE.Vector2(...layer.shift) },
        uCurve: { value: layer.curve },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uCurve;
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 p = position;
          p.z += cos((uv.x - .5) * 3.14159265) * uCurve;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uVisible;
        uniform sampler2D uInfrared;
        uniform float uMix;
        uniform float uVeil;
        uniform float uReady;
        uniform float uAlpha;
        uniform vec2 uShift;
        varying vec2 vUv;
        vec3 boostColor(vec3 c, float sat, float exposure){
          float l = dot(c, vec3(.299,.587,.114));
          return max(vec3(0.0), mix(vec3(l), c, sat) * exposure);
        }
        void main(){
          vec2 uv = vUv + uShift;
          vec3 cv = boostColor(texture2D(uVisible, uv, 4.5).rgb, 1.30, 1.05);
          vec3 ci = boostColor(texture2D(uInfrared, uv, 4.5).rgb, 1.22, 1.05);
          vec3 c = mix(cv, ci, uMix);
          float hi = max(c.r, max(c.g, c.b));
          float lo = min(c.r, min(c.g, c.b));
          float luma = dot(c, vec3(.299,.587,.114));
          float chroma = hi - lo;
          float cool = max(c.b - c.r * .58, 0.0) + max(c.g - c.r * .72, 0.0);
          float gas = smoothstep(.018, .24, luma + chroma * .42 + cool * .35);
          float ex = smoothstep(0.0, .11, vUv.x) * smoothstep(0.0, .11, 1.0-vUv.x);
          float ey = smoothstep(0.0, .11, vUv.y) * smoothstep(0.0, .11, 1.0-vUv.y);
          float alpha = uReady * uVeil * uAlpha * gas * ex * ey;
          gl_FragColor = vec4(c, alpha);
        }`,
    });
    const geometry = new THREE.PlaneGeometry(PHOTO_WIDTH, PHOTO_HEIGHT, 20, 20);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(layer.x, layer.y, layer.z);
    mesh.rotation.y = layer.ry;
    mesh.scale.setScalar(layer.scale);
    mesh.renderOrder = -2;
    group.add(mesh);
    materials.push(material);
  }
  return materials;
}

function buildAtmosphere(group, rnd, cloudMap){
  const clouds = [];
  const count = EXPLICIT_LOW ? 18 : 38;
  const visiblePalette = [0x174f60, 0x267985, 0x75402f, 0xa85b3f];
  const infraredPalette = [0x183862, 0x37336d, 0x6f2b2f, 0xa5442e];
  for (let i = 0; i < count; i++){
    const visible = new THREE.Color(visiblePalette[i % visiblePalette.length]);
    const infrared = new THREE.Color(infraredPalette[i % infraredPalette.length]);
    const material = new THREE.SpriteMaterial({
      map: cloudMap,
      color: visible,
      transparent: true,
      opacity: 0.018 + rnd() * 0.046,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const scale = 18 + rnd() * 30;
    // A coherent, receding curtain unifies the four structures.  Random round
    // foreground puffs were the main source of the floating-clump reading.
    sprite.scale.set(scale, scale * (0.28 + rnd() * 0.34), 1);
    sprite.position.set(gaussian(rnd) * 22, gaussian(rnd) * 24 + 2, -18 - rnd() * 34);
    group.add(sprite);
    clouds.push({ material, visible, infrared, opacity: material.opacity });
  }
  return clouds;
}

function buildWisps(group, rnd){
  const anchors = [
    { x: -14, z:  4, height: 72, bend: -3.8 },
    { x:  -5, z: -5, height: 55, bend:  3.0 },
    { x:   7, z:  5, height: 49, bend: -2.2 },
    { x:  15, z: -7, height: 38, bend:  3.8 },
  ];
  const count = EXPLICIT_LOW ? 900 : 4800;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const origins = [];
  const cyan = new THREE.Color(0x74e2df);
  const amber = new THREE.Color(0xf2a070);
  for (let i = 0; i < count; i++){
    const branch = i % 4;
    const a = anchors[branch];
    const t = rnd();
    const phase = rnd() * Math.PI * 2;
    const radial = .4 + Math.pow(rnd(), 1.8) * 5.2;
    const taper = .38 + (1 - t) * .84;
    positions[i*3] = a.x + a.bend * t + Math.sin(t * 8 + phase) * radial * taper;
    positions[i*3+1] = -37 + t * a.height;
    positions[i*3+2] = a.z + Math.cos(t * 7 + phase) * radial * taper;
    const c = cyan.clone().lerp(amber, .18 + rnd() * .42);
    const b = 0.28 + rnd() * 0.62;
    colors[i*3] = c.r * b; colors[i*3+1] = c.g * b; colors[i*3+2] = c.b * b;
    origins.push({ branch, t, phase, radial, speed: .018 + rnd() * .042 });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: .34,
    vertexColors: true,
    map: dotTexture(),
    alphaTest: .02,
    transparent: true,
    opacity: .50,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);
  return { points, origins, anchors };
}

function buildFilaments(group, rnd, uniforms){
  const anchors = [
    { x: -14, z:  4, height: 72, bend: -3.8 },
    { x:  -5, z: -5, height: 55, bend:  3.0 },
    { x:   7, z:  5, height: 49, bend: -2.2 },
    { x:  15, z: -7, height: 38, bend:  3.8 },
  ];
  const visiblePalette = [0x3b9ca2, 0x8f503b, 0xd88455];
  const infraredPalette = [0x3157a6, 0x74428f, 0xd9472a];
  const positions = [], uvs = [], colorsVisible = [], colorsInfrared = [];
  const phases = [], opacities = [], indices = [];

  function appendRibbon(points, width, visible, infrared, phase, opacity){
    // Two crossed strips make each tendril volumetric without a tube's plastic
    // outline. The fragment shader erodes both strips into smoky fragments.
    for (let axis = 0; axis < 2; axis++){
      const base = positions.length / 3;
      for (let j = 0; j < points.length; j++){
        const t = j / (points.length - 1);
        const body = .18 + .82 * Math.pow(Math.sin(Math.PI * t), .42);
        const w = width * body;
        const p = points[j];
        for (let side = -1; side <= 1; side += 2){
          positions.push(
            p.x + (axis === 0 ? side * w : 0),
            p.y,
            p.z + (axis === 1 ? side * w : 0)
          );
          uvs.push(side < 0 ? 0 : 1, t);
          colorsVisible.push(visible.r, visible.g, visible.b);
          colorsInfrared.push(infrared.r, infrared.g, infrared.b);
          phases.push(phase);
          opacities.push(opacity);
        }
      }
      for (let j = 0; j < points.length - 1; j++){
        const a = base + j * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const count = EXPLICIT_LOW ? 10 : 28;
  for (let f = 0; f < count; f++){
    const a = anchors[f % anchors.length];
    const phase = rnd() * Math.PI * 2;
    const radial = 1.3 + rnd() * 4.8;
    const points = [];
    for (let j = 0; j < 30; j++){
      const t = j / 29;
      const taper = .38 + (1 - t) * .88;
      points.push(new THREE.Vector3(
        a.x + a.bend * t + Math.sin(t * 7.3 + phase) * radial * taper,
        -38 + t * a.height,
        a.z + Math.cos(t * 6.5 + phase) * radial * taper
      ));
    }
    const visible = new THREE.Color(visiblePalette[f % visiblePalette.length]);
    const infrared = new THREE.Color(infraredPalette[f % infraredPalette.length]);
    appendRibbon(points, .75 + rnd() * 1.45, visible, infrared, phase, .035 + rnd() * .045);
  }

  // Horizontal root wisps turn the four printer components into one eroding
  // molecular wall, which is how the telescope image reads compositionally.
  for (let f = 0; f < (EXPLICIT_LOW ? 3 : 10); f++){
    const points = [];
    const phase = rnd() * Math.PI * 2;
    const amplitude = 1.2 + rnd() * .35;
    const zAmp = 3.8 + rnd() * 2.4;
    for (let j = 0; j < 36; j++){
      const t = j / 35;
      points.push(new THREE.Vector3(
        -25 + t * 50,
        -35 + Math.sin(t * 4.5 + phase) * amplitude,
        -5 + Math.sin(t * 8 + phase) * zAmp
      ));
    }
    const visible = new THREE.Color(f % 3 === 0 ? 0x4d9fa5 : 0x86503f);
    const infrared = new THREE.Color(f % 3 === 0 ? 0x3f4f9f : 0x843d68);
    appendRibbon(points, .55 + rnd() * .85, visible, infrared, phase, .025 + rnd() * .035);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('colorVisible', new THREE.Float32BufferAttribute(colorsVisible, 3));
  geometry.setAttribute('colorInfrared', new THREE.Float32BufferAttribute(colorsInfrared, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(opacities, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMix: uniforms.uMix,
      uOrbit: uniforms.uOrbit,
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 colorVisible;
      attribute vec3 colorInfrared;
      attribute float aPhase;
      attribute float aOpacity;
      varying vec2 vUv;
      varying vec3 vColorVisible;
      varying vec3 vColorInfrared;
      varying float vPhase;
      varying float vOpacity;
      void main(){
        vUv = uv;
        vColorVisible = colorVisible;
        vColorInfrared = colorInfrared;
        vPhase = aPhase;
        vOpacity = aOpacity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uMix;
      uniform float uOrbit;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vColorVisible;
      varying vec3 vColorInfrared;
      varying float vPhase;
      varying float vOpacity;
      float hash12(vec2 p){
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      void main(){
        float edge = pow(max(0.0, sin(vUv.x * 3.14159265)), .85);
        float ends = smoothstep(0.0, .075, vUv.y) * smoothstep(0.0, .075, 1.0-vUv.y);
        float flow = .54 + .46 * sin(vUv.y * 54.0 - uTime * .58 + vPhase);
        float grain = hash12(floor(vUv * vec2(17.0, 76.0)) + vPhase);
        float torn = .10 + .90 * smoothstep(.30, .82, grain + flow * .22);
        vec3 color = mix(vColorVisible, vColorInfrared, uMix) * (.62 + flow * .55);
        float alpha = uOrbit * vOpacity * edge * ends * torn;
        gl_FragColor = vec4(color, alpha);
      }`,
  });
  const ribbons = new THREE.Mesh(geometry, material);
  ribbons.name = 'ionized-gas-ribbons';
  ribbons.renderOrder = 3;
  group.add(ribbons);
  return { ribbons, material };
}

function imagePixels(img, width, height, blurPx = 0){
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (blurPx) ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

function stellarColor(red, green, blue, infrared, tone){
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);
  const saturation = maxChannel > .001 ? (maxChannel - minChannel) / maxChannel : 0;
  const light = .299*red + .587*green + .114*blue;
  const source = [red, green, blue].map(channel =>
    THREE.MathUtils.clamp(light + (channel - light) * 1.85, 0, 1));
  let temperature;
  if (infrared){
    temperature = tone < .34 ? [.28, .48, 1.00]
                : tone < .62 ? [1.00, .55, .16]
                : tone < .82 ? [.83, .30, 1.00]
                              : [1.00, .27, .10];
  } else {
    temperature = tone < .40 ? [.38, .70, 1.00]
                : tone < .72 ? [1.00, .66, .25]
                : tone < .90 ? [.38, 1.00, .91]
                              : [1.00, .43, .62];
  }
  // Preserve strongly coloured source stars; give neutral/white detections a
  // plausible stable temperature instead of washing every halo to white.
  const temperatureMix = THREE.MathUtils.lerp(.70, .16,
    THREE.MathUtils.smoothstep(saturation, .05, .42));
  const color = new THREE.Color(
    THREE.MathUtils.lerp(source[0], temperature[0], temperatureMix),
    THREE.MathUtils.lerp(source[1], temperature[1], temperatureMix),
    THREE.MathUtils.lerp(source[2], temperature[2], temperatureMix)
  );
  const peak = Math.max(color.r, color.g, color.b, .001);
  color.multiplyScalar(Math.min(1.16 / peak, 1.28));
  return color;
}

/* Detect isolated point sources in the exact telescope frame. At zero orbit
   their shader-flattened z is the photograph plane; as the plate fades they
   peel into real depth without ever jumping to unrelated screen positions. */
function buildAlignedStars(group, image, infrared, uniforms, seed){
  const width = 320;
  const height = Math.max(2, Math.round(width * image.height / image.width));
  const sharp = imagePixels(image, width, height);
  const soft = imagePixels(image, width, height, 3.2);
  const luminance = new Float32Array(width * height);
  const blurred = new Float32Array(width * height);
  for (let q = 0; q < luminance.length; q++){
    const i = q * 4;
    luminance[q] = (.299*sharp[i] + .587*sharp[i+1] + .114*sharp[i+2]) / 255;
    blurred[q] = (.299*soft[i] + .587*soft[i+1] + .114*soft[i+2]) / 255;
  }

  const candidates = [];
  const maxBlur = infrared ? .43 : .36;
  for (let py = 2; py < height - 2; py++){
    for (let px = 2; px < width - 2; px++){
      const q = py * width + px;
      const light = luminance[q], base = blurred[q], contrast = light - base;
      if (light < .38 || contrast < .105 || base > maxBlur) continue;
      let localMax = true;
      for (let dy = -2; dy <= 2 && localMax; dy++){
        for (let dx = -2; dx <= 2; dx++){
          if (!dx && !dy) continue;
          if (luminance[(py+dy)*width + px+dx] > light){ localMax = false; break; }
        }
      }
      if (localMax) candidates.push({ px, py, light, contrast });
    }
  }
  candidates.sort((a, b) => (b.contrast + b.light*.18) - (a.contrast + a.light*.18));
  const selected = [];
  const limit = EXPLICIT_LOW ? (infrared ? 90 : 55) : (infrared ? 240 : 145);
  for (const star of candidates){
    if (selected.some(other => {
      const dx = other.px - star.px, dy = other.py - star.py;
      return dx*dx + dy*dy < 12;
    })) continue;
    selected.push(star);
    if (selected.length >= limit) break;
  }
  if (!selected.length) return null;

  const rnd = mulberry(hashStr(seed));
  const positions = new Float32Array(selected.length * 3);
  const colors = new Float32Array(selected.length * 3);
  const sizes = new Float32Array(selected.length);
  for (let n = 0; n < selected.length; n++){
    const star = selected[n];
    const i = (star.py * width + star.px) * 4;
    positions[n*3] = (star.px / (width - 1) - .5) * PHOTO_WIDTH;
    positions[n*3+1] = (.5 - star.py / (height - 1)) * PHOTO_HEIGHT + 7;
    positions[n*3+2] = -7 - rnd() * 40;
    const color = stellarColor(sharp[i]/255, sharp[i+1]/255, sharp[i+2]/255,
      infrared, rnd());
    colors[n*3] = color.r; colors[n*3+1] = color.g; colors[n*3+2] = color.b;
    sizes[n] = 2.1 + Math.min(7.2, star.contrast * 18) + star.light * 1.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.computeBoundingSphere();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOrbit: uniforms.uOrbit,
      uMix: uniforms.uMix,
      uInfrared: { value: infrared ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      uniform float uOrbit;
      varying vec3 vColor;
      void main(){
        vColor = color;
        vec3 p = position;
        p.z *= uOrbit;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * clamp(94.0 / max(38.0, -mv.z), .72, 2.15);
      }`,
    fragmentShader: `
      uniform float uOrbit;
      uniform float uMix;
      uniform float uInfrared;
      varying vec3 vColor;
      void main(){
        vec2 p = abs(gl_PointCoord * 2.0 - 1.0);
        float radius = length(p);
        if (radius > 1.0) discard;
        float core = pow(max(0.0, 1.0-radius), 2.8);
        float rayX = exp(-p.x * 18.0) * pow(max(0.0, 1.0-p.y), 4.0);
        float rayY = exp(-p.y * 18.0) * pow(max(0.0, 1.0-p.x), 4.0);
        float mode = mix(1.0-uMix, uMix, uInfrared);
        float alpha = uOrbit * mode * (core + (rayX + rayY) * .20);
        float halo = pow(max(0.0, 1.0-radius), 1.15);
        vec3 color = vColor * (.62 + halo * .62) + vec3(1.0) * core * .20;
        gl_FragColor = vec4(color, alpha);
      }`,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = infrared ? 'aligned-stars-infrared' : 'aligned-stars-visible';
  stars.renderOrder = 7;
  group.add(stars);
  group.userData[infrared ? 'alignedStarsInfrared' : 'alignedStarsVisible'] = selected.length;
  return stars;
}

function addFallbackPillars(group){
  const material = new THREE.MeshStandardMaterial({
    color: 0x5e2818, roughness: .96, emissive: 0x170707, emissiveIntensity: .5
  });
  const fallback = new THREE.Group();
  const columns = [[-13, 38, 8], [-3, 52, 10], [9, 41, 7], [16, 28, 5]];
  for (const [x, height, radius] of columns){
    const geometry = new THREE.CapsuleGeometry(radius, height, 10, 18);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, -18 + height * .25, gaussian(mulberry(hashStr(String(x)))) * 7);
    mesh.rotation.z = x * -.008;
    fallback.add(mesh);
  }
  group.add(fallback);
}

export function buildPillarsOfCreation(entry, visibleUrl){
  const group = new THREE.Group();
  const rnd = mulberry(hashStr('pillars-hybrid:' + entry.id));
  const { material, uniforms } = buildMaterial();
  const surfelMaterial = buildSurfelMaterial(uniforms);
  const atmosphere = buildAtmosphere(group, rnd, softCloudTexture());
  const projector = buildPhotoProjector(group, uniforms);
  buildNebulaVeils(group, uniforms);
  const wisps = buildWisps(group, rnd);
  const filaments = buildFilaments(group, rnd, uniforms);
  let modelRoot = null;
  let visibleStars = null;
  let infraredStars = null;
  let mix = 0;
  let targetMix = 0;
  let fallbackAdded = false;
  let disposed = false;
  let detachedMaterialsDisposed = false;
  const disposeDetachedMaterials = () => {
    if (detachedMaterialsDisposed) return;
    detachedMaterialsDisposed = true;
    material.dispose();
    surfelMaterial.dispose();
  };

  loadTexture(visibleUrl, texture => {
    uniforms.uVisible.value = texture;
    uniforms.uPhotoReady.value = 1;
    if (!disposed && !visibleStars)
      visibleStars = buildAlignedStars(group, texture.image, false, uniforms,
        'pillars-stars-visible:' + entry.id);
  });
  const infrared = landmarkImageIR(entry.id);
  if (infrared) loadTexture(infrared.file, texture => {
    uniforms.uInfrared.value = texture;
    if (!disposed && !infraredStars)
      infraredStars = buildAlignedStars(group, texture.image, true, uniforms,
        'pillars-stars-infrared:' + entry.id);
  });

  import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
    const loader = new GLTFLoader();
    loader.load(EXPLICIT_LOW ? MODEL_LOW : MODEL, gltf => {
      modelRoot = gltf.scene;
      modelRoot.traverse(object => {
        if (!object.isMesh) return;
        if (object.material){
          const old = Array.isArray(object.material) ? object.material : [object.material];
          for (const m of old) m.dispose();
        }
        object.material = material;
        // The NASA mesh remains an authoritative spatial scaffold, never a
        // visible plastic shell.  Its triangles are intentionally not drawn.
        object.material.visible = false;
        object.renderOrder = 1;
        object.geometry.computeBoundingBox();
        uniforms.uBoundsMin.value.copy(object.geometry.boundingBox.min);
        uniforms.uBoundsMax.value.copy(object.geometry.boundingBox.max);
        const surfels = new THREE.Points(makeSurfelGeometry(object.geometry), surfelMaterial);
        surfels.name = 'dust-surfels';
        surfels.renderOrder = 2;
        object.add(surfels);
      });
      if (disposed){
        modelRoot.traverse(object => { if (object.geometry) object.geometry.dispose(); });
        disposeDetachedMaterials();
        return;
      }
      // The printable STL uses Z-up. Rotate it into Three's Y-up frame; the
      // canonical telescope view then looks down the model's original -Y axis.
      modelRoot.rotation.x = -Math.PI / 2;
      let box = new THREE.Box3().setFromObject(modelRoot);
      const size = box.getSize(new THREE.Vector3());
      const scale = 74 / Math.max(size.y, .001);
      // The four-print positioning reference is deliberately spread far apart
      // in depth.  A restrained bas-relief compression keeps the orbit legible
      // as one cloud wall while retaining clear parallax and self-reveal.
      modelRoot.scale.set(scale, scale * .48, scale);
      box = new THREE.Box3().setFromObject(modelRoot);
      const center = box.getCenter(new THREE.Vector3());
      modelRoot.position.set(-center.x, -center.y + 1, -center.z);
      group.add(modelRoot);
      group.userData.presentation = 'dust-surfels';
    }, undefined, () => {
      if (disposed) return;
      fallbackAdded = true;
      addFallbackPillars(group);
    });
  }).catch(() => {
    if (disposed) return;
    fallbackAdded = true;
    addFallbackPillars(group);
  });

  let time = 0;
  return {
    group,
    focusDist: 96,
    startTheta: 0,
    startPhi: 1.30,
    autoRotate: false,
    hasIR: !!infrared,
    isImage: true,
    modelCredit: MODEL_CREDIT,
    dispose(){
      disposed = true;
      if (!modelRoot) disposeDetachedMaterials();
    },
    setIR(on){ targetMix = on ? 1 : 0; },
    update(dt, camera){
      time += dt;
      if (mix !== targetMix){
        const step = Math.min(Math.abs(targetMix - mix), dt * .72);
        mix += Math.sign(targetMix - mix) * step;
        uniforms.uMix.value = mix;
      }
      for (const cloud of atmosphere){
        cloud.material.color.copy(cloud.visible).lerp(cloud.infrared, mix);
        cloud.material.opacity = cloud.opacity * (1 + mix * .34);
      }
      filaments.material.uniforms.uTime.value = time;
      if (camera){
        const length = Math.max(camera.position.length(), .001);
        const front = camera.position.z / length;
        // Morph over a broad arc.  A normal drag should reveal parallax inside
        // the photograph, not abruptly hard-cut to an archaeological scan.
        const angleBlend = THREE.MathUtils.smoothstep(front, .45, .97);
        const frontHemisphere = THREE.MathUtils.smoothstep(front, -.08, .38);
        // A trace of the observation remains as a receding ionized-gas veil;
        // it disappears edge-on and never appears from behind.
        const targetOpacity = angleBlend * .94 + frontHemisphere * .04;
        projector.opacity.value += (targetOpacity - projector.opacity.value) *
          Math.min(1, dt * 5.5);
        const orbitTarget = 1 - angleBlend;
        uniforms.uOrbit.value += (orbitTarget - uniforms.uOrbit.value) *
          Math.min(1, dt * 4.2);
        const veilTarget = orbitTarget * THREE.MathUtils.smoothstep(front, .12, .78);
        uniforms.uVeil.value += (veilTarget - uniforms.uVeil.value) *
          Math.min(1, dt * 3.8);
      }

      const position = wisps.points.geometry.attributes.position;
      const array = position.array;
      for (let i = 0; i < wisps.origins.length; i++){
        const origin = wisps.origins[i];
        const a = wisps.anchors[origin.branch];
        const t = (origin.t + time * origin.speed) % 1;
        const taper = .38 + (1 - t) * .84;
        array[i*3] = a.x + a.bend * t +
          Math.sin(t * 8 + origin.phase + time * .08) * origin.radial * taper;
        array[i*3+1] = -37 + t * a.height;
        array[i*3+2] = a.z +
          Math.cos(t * 7 + origin.phase + time * .06) * origin.radial * taper;
      }
      position.needsUpdate = true;
      if (modelRoot) modelRoot.rotation.y = Math.sin(time * .055) * .025;
      // Keep the flag observable in devtools; it also prevents an unused-state
      // optimization from obscuring whether the model fallback was exercised.
      group.userData.modelFallback = fallbackAdded;
    },
  };
}
