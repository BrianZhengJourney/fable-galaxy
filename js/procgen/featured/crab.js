/* Crab Nebula: an observation-led 3D exhibit.
   The 1999/2024 Hubble products share one registered presentation plane; Webb
   is a separate infrared wavelength view, never a time-morph target. NASA's
   X-ray-informed GLB is shown as a centered scientific representation rather
   than coordinate-aligned tomography. */

import * as THREE from 'three';
import { mulberry, hashStr, gaussian } from '../../utils/rng.js';
import { detectTier } from '../../core/quality.js';

const HUBBLE_1999 = 'images/crab/hubble-1999.jpg';
const HUBBLE_2024 = 'images/crab/hubble-2024.jpg';
const WEBB_2023 = 'images/crab/webb-2023.jpg';
const XRAY_MODEL = 'models/crab/crab-nebula.glb';
const DRACO_DECODER =
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/';

const HUBBLE_SIZE = 3864;
const WEBB_ASPECT = 4000 / 3483;
const PHOTO_HEIGHT = 80;
const HUBBLE_WIDTH = PHOTO_HEIGHT;
const WEBB_WIDTH = PHOTO_HEIGHT * WEBB_ASPECT;
const MODEL_CREDIT = '3D model: NASA/Francis J. Summers; NASA/Robert L. Hurt';
const IMAGE_CREDIT = 'Hubble 1999/2024: NASA, ESA, STScI, W. Blair; processing J. DePasquale · Webb: NASA, ESA, CSA, STScI, T. Temim · 3D: NASA/F. Summers, R. Hurt';

const STATES = Object.freeze({
  SUPERNOVA: 'crab.supernova-flash',
  DISCOVERY: 'crab.optical-discovery',
  BACKTRACE: 'crab.expansion-backtrace',
  PULSAR: 'crab.pulsar-engine',
  WEBB: 'crab.webb-infrared',
  EXPANSION: 'crab.hubble-expansion-1999-2024',
});

const PRESETS = Object.freeze({
  [STATES.SUPERNOVA]: {
    hubble: .05, webb: 0, epoch: 0, compare: 0, saturation: 1.04,
    exposure: .58, gasPatches: .28, stars: .10, webbStars: 0, backtrace: .72,
    filaments: .18, flash: 1, engine: 0, model: 0,
  },
  [STATES.DISCOVERY]: {
    hubble: .92, webb: 0, epoch: 0, compare: 0, saturation: .76,
    exposure: .52, gasPatches: .24, stars: .46, webbStars: 0, backtrace: 0,
    filaments: .30, flash: 0, engine: 0, model: 0,
  },
  [STATES.BACKTRACE]: {
    hubble: .96, webb: 0, epoch: 0, compare: 0, saturation: 1.02,
    exposure: .86, gasPatches: .88, stars: .66, webbStars: 0, backtrace: .78,
    filaments: .72, flash: 0, engine: 0, model: 0,
  },
  [STATES.PULSAR]: {
    hubble: .24, webb: 0, epoch: .58, compare: 0, saturation: 1.08,
    exposure: .70, gasPatches: .42, stars: .28, webbStars: 0, backtrace: 0,
    filaments: .44, flash: 0, engine: 1, model: 1,
  },
  [STATES.WEBB]: {
    hubble: 0, webb: 1, epoch: 1, compare: 0, saturation: 1.10,
    exposure: 1.02, gasPatches: .70, stars: 0, webbStars: .82, backtrace: 0,
    filaments: .86, flash: 0, engine: .18, model: 0,
  },
  [STATES.EXPANSION]: {
    hubble: 1, webb: 0, epoch: .5, compare: 1, saturation: 1.08,
    exposure: .98, gasPatches: .80, stars: .82, webbStars: 0, backtrace: 0,
    filaments: .74, flash: 0, engine: 0, model: 0,
  },
});

function damp(value, target, speed, dt){
  return THREE.MathUtils.lerp(value, target, 1 - Math.exp(-speed * dt));
}

function stateFromVisual(visual){
  const raw = typeof visual === 'string'
    ? visual
    : visual && (visual.state || visual.moment || visual.id);
  if (raw && Object.values(STATES).includes(raw)) return raw;
  const value = String(raw || '').toLowerCase();
  if (/1054|supernova|flash/.test(value)) return STATES.SUPERNOVA;
  if (/1731|found|discover|optical/.test(value)) return STATES.DISCOVERY;
  if (/1928|linked|backtrace|inference/.test(value)) return STATES.BACKTRACE;
  if (/1968|pulsar|engine/.test(value)) return STATES.PULSAR;
  if (/2023|webb|infrared/.test(value)) return STATES.WEBB;
  if (/2026|hubble|expansion|1999-2024/.test(value)) return STATES.EXPANSION;
  if (visual && visual.wavelength === 'infrared') return STATES.WEBB;
  return STATES.EXPANSION;
}

function solidTexture(color){
  const c = new THREE.Color(color);
  const data = new Uint8Array([
    Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255,
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function softTexture(){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.96)');
  gradient.addColorStop(.18, 'rgba(255,255,255,.64)');
  gradient.addColorStop(.52, 'rgba(255,255,255,.16)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function makeHubbleMaterial(texture1999, texture2024){
  return new THREE.ShaderMaterial({
    uniforms: {
      u1999: { value: texture1999 },
      u2024: { value: texture2024 },
      uReady1999: { value: 0 },
      uReady2024: { value: 0 },
      uEpoch: { value: .5 },
      uCompare: { value: 1 },
      uCurtain: { value: .5 },
      uSaturation: { value: 1 },
      uExposure: { value: 1 },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D u1999;
      uniform sampler2D u2024;
      uniform float uReady1999;
      uniform float uReady2024;
      uniform float uEpoch;
      uniform float uCompare;
      uniform float uCurtain;
      uniform float uSaturation;
      uniform float uExposure;
      uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec3 earlier = texture2D(u1999, vUv).rgb;
        vec3 later = texture2D(u2024, vUv).rgb;
        if (uReady1999 < .5) earlier = later;
        if (uReady2024 < .5) later = earlier;
        float side = smoothstep(uCurtain-.006, uCurtain+.006, vUv.x);
        vec3 dissolved = mix(earlier, later, uEpoch);
        vec3 registered = mix(earlier, later, side);
        vec3 color = mix(dissolved, registered, uCompare);
        float light = dot(color, vec3(.2126, .7152, .0722));
        color = mix(vec3(light), color, uSaturation) * uExposure;
        float edgeX = smoothstep(0.0, .055, vUv.x) *
          smoothstep(0.0, .055, 1.0-vUv.x);
        float edgeY = smoothstep(0.0, .055, vUv.y) *
          smoothstep(0.0, .055, 1.0-vUv.y);
        gl_FragColor = vec4(color, uOpacity*edgeX*edgeY);
      }`,
  });
}

function makeWebbMaterial(texture){
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uReady: { value: 0 },
      uSaturation: { value: 1 },
      uExposure: { value: 1 },
      uOpacity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uReady;
      uniform float uSaturation;
      uniform float uExposure;
      uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec3 color = texture2D(uMap, vUv).rgb;
        float light = dot(color, vec3(.2126, .7152, .0722));
        color = mix(vec3(light), color, uSaturation) * uExposure;
        float edgeX = smoothstep(0.0, .055, vUv.x) *
          smoothstep(0.0, .055, 1.0-vUv.x);
        float edgeY = smoothstep(0.0, .055, vUv.y) *
          smoothstep(0.0, .055, 1.0-vUv.y);
        gl_FragColor = vec4(color,
          uOpacity * mix(.24, 1.0, uReady) * edgeX * edgeY);
      }`,
  });
}

function imagePixels(image, width, height, blur = 0){
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

function textureSource(image, maxLongSide){
  const longest = Math.max(image.naturalWidth || image.width,
    image.naturalHeight || image.height);
  if (longest <= maxLongSide) return image;
  const scale = maxLongSide/longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth*scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight*scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function luminancePixels(pixels){
  const result = new Float32Array(pixels.length / 4);
  for (let i = 0; i < result.length; i++){
    const q = i * 4;
    result[i] = (.2126*pixels[q] + .7152*pixels[q+1] + .0722*pixels[q+2]) / 255;
  }
  return result;
}

function sampledColor(pixels, offset, saturationBoost = 1.18){
  let red = pixels[offset] / 255;
  let green = pixels[offset+1] / 255;
  let blue = pixels[offset+2] / 255;
  const light = .2126*red + .7152*green + .0722*blue;
  red = THREE.MathUtils.clamp(light + (red-light)*saturationBoost, 0, 1);
  green = THREE.MathUtils.clamp(light + (green-light)*saturationBoost, 0, 1);
  blue = THREE.MathUtils.clamp(light + (blue-light)*saturationBoost, 0, 1);
  return new THREE.Color(red, green, blue).convertSRGBToLinear();
}

function starCandidates(imageA, imageB, width, height){
  const sharpA = imagePixels(imageA, width, height);
  const sharpB = imagePixels(imageB || imageA, width, height);
  const softA = imagePixels(imageA, width, height, 3.2);
  const softB = imagePixels(imageB || imageA, width, height, 3.2);
  const lumA = luminancePixels(sharpA);
  const lumB = luminancePixels(sharpB);
  const blurA = luminancePixels(softA);
  const blurB = luminancePixels(softB);
  const candidates = [];

  for (let y = 2; y < height-2; y++){
    for (let x = 2; x < width-2; x++){
      const q = y*width+x;
      const lightA = lumA[q], lightB = lumB[q];
      const contrastA = lightA-blurA[q], contrastB = lightB-blurB[q];
      // Requiring a compact peak in both registered Hubble frames rejects
      // moving filament knots while keeping stable background stars.
      if (imageB && (Math.min(contrastA, contrastB) < .045 ||
          Math.min(lightA, lightB) < .26)) continue;
      if (!imageB && (contrastA < .075 || lightA < .34)) continue;
      const score = imageB
        ? Math.min(contrastA, contrastB) + Math.min(lightA, lightB)*.16
        : contrastA + lightA*.16;
      let localMax = true;
      const peak = imageB ? Math.min(lightA, lightB) : lightA;
      for (let dy = -2; dy <= 2 && localMax; dy++){
        for (let dx = -2; dx <= 2; dx++){
          if (!dx && !dy) continue;
          const n = (y+dy)*width+x+dx;
          const other = imageB ? Math.min(lumA[n], lumB[n]) : lumA[n];
          if (other > peak){ localMax = false; break; }
        }
      }
      if (localMax) candidates.push({ x, y, score });
    }
  }
  candidates.sort((a, b) => b.score-a.score);
  return { candidates, pixelsA: sharpA, pixelsB: sharpB };
}

function selectSeparated(candidates, limit, radiusSq){
  const selected = [];
  const cellSize = Math.max(1,Math.sqrt(radiusSq));
  const buckets = new Map();
  for (const candidate of candidates){
    const cellX = Math.floor(candidate.x/cellSize);
    const cellY = Math.floor(candidate.y/cellSize);
    let overlaps = false;
    for (let dy = -1; dy <= 1 && !overlaps; dy++){
      for (let dx = -1; dx <= 1 && !overlaps; dx++){
        const nearby = buckets.get(`${cellX+dx}:${cellY+dy}`) || [];
        overlaps = nearby.some(other => {
          const x = candidate.x-other.x, y = candidate.y-other.y;
          return x*x+y*y < radiusSq;
        });
      }
    }
    if (overlaps) continue;
    selected.push(candidate);
    const key = `${cellX}:${cellY}`;
    if (!buckets.has(key)) buckets.set(key,[]);
    buckets.get(key).push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}

function buildRegisteredStars(root, image1999, image2024, budget, uniforms, seed){
  const width = budget.sample;
  const height = width;
  const sampled = starCandidates(image1999, image2024, width, height);
  const selected = selectSeparated(sampled.candidates, budget.stars, 13);
  if (!selected.length) return null;

  const rnd = mulberry(hashStr(seed));
  const positions = new Float32Array(selected.length*3);
  const colors1999 = new Float32Array(selected.length*3);
  const colors2024 = new Float32Array(selected.length*3);
  const sizes = new Float32Array(selected.length);
  const uvx = new Float32Array(selected.length);
  for (let i = 0; i < selected.length; i++){
    const star = selected[i];
    const u = star.x/(width-1), v = star.y/(height-1);
    positions[i*3] = (u-.5)*HUBBLE_WIDTH;
    positions[i*3+1] = (.5-v)*PHOTO_HEIGHT;
    positions[i*3+2] = -8-rnd()*50;
    const offset = (star.y*width+star.x)*4;
    const a = sampledColor(sampled.pixelsA, offset, 1.28);
    const b = sampledColor(sampled.pixelsB, offset, 1.28);
    colors1999.set([a.r, a.g, a.b], i*3);
    colors2024.set([b.r, b.g, b.b], i*3);
    sizes[i] = 2.3+Math.min(7.2, star.score*19);
    uvx[i] = u;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor1999', new THREE.BufferAttribute(colors1999, 3));
  geometry.setAttribute('aColor2024', new THREE.BufferAttribute(colors2024, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aUvX', new THREE.BufferAttribute(uvx, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOrbit: uniforms.uOrbit,
      uOpacity: uniforms.uStarOpacity,
      uEpoch: uniforms.uEpoch,
      uCompare: uniforms.uCompare,
      uCurtain: uniforms.uCurtain,
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aColor1999;
      attribute vec3 aColor2024;
      attribute float aSize;
      attribute float aUvX;
      uniform float uOrbit;
      uniform float uOpacity;
      uniform float uEpoch;
      uniform float uCompare;
      uniform float uCurtain;
      varying vec3 vColor;
      varying float vOpacity;
      void main(){
        float side = smoothstep(uCurtain-.006, uCurtain+.006, aUvX);
        float epoch = mix(uEpoch, side, uCompare);
        vColor = mix(aColor1999, aColor2024, epoch);
        vOpacity = uOpacity*uOrbit;
        vec3 p = position;
        p.z *= uOrbit;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * clamp(94.0/max(38.0, -mv.z), .72, 2.2);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      void main(){
        vec2 p = abs(gl_PointCoord*2.0-1.0);
        float r = length(p);
        if (r > 1.0) discard;
        float halo = pow(max(0.0, 1.0-r), 1.45);
        float core = pow(max(0.0, 1.0-r), 5.5);
        float rays = (exp(-p.x*22.0)*pow(1.0-p.y, 4.0) +
                      exp(-p.y*22.0)*pow(1.0-p.x, 4.0))*.17;
        vec3 color = vColor*(halo*.82+core*.72) + vec3(core*.10);
        gl_FragColor = vec4(color, vOpacity*(halo+rays));
      }`,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = 'registered-colored-hubble-stars';
  stars.userData.allowedPointRole = 'registered-stellar-sources';
  stars.renderOrder = 8;
  stars.visible = false;
  root.add(stars);
  return { stars, count: selected.length };
}

function buildWebbStars(root, image, budget, uniforms, seed){
  const width = budget.sample;
  const height = Math.max(2, Math.round(width/WEBB_ASPECT));
  const sampled = starCandidates(image, null, width, height);
  const selected = selectSeparated(sampled.candidates, budget.webbStars, 12);
  if (!selected.length) return null;

  const rnd = mulberry(hashStr(seed));
  const positions = new Float32Array(selected.length*3);
  const colors = new Float32Array(selected.length*3);
  const sizes = new Float32Array(selected.length);
  for (let i = 0; i < selected.length; i++){
    const star = selected[i];
    const u = star.x/(width-1), v = star.y/(height-1);
    positions[i*3] = (u-.5)*WEBB_WIDTH;
    positions[i*3+1] = (.5-v)*PHOTO_HEIGHT;
    positions[i*3+2] = -7-rnd()*48;
    const offset = (star.y*width+star.x)*4;
    const color = sampledColor(sampled.pixelsA, offset, 1.32);
    colors.set([color.r, color.g, color.b], i*3);
    sizes[i] = 2.2+Math.min(7.5, star.score*18);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uOrbit: uniforms.uOrbit, uOpacity: uniforms.uWebbStarOpacity },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      uniform float uOrbit;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      void main(){
        vColor = color;
        vOpacity = uOpacity*uOrbit;
        vec3 p = position;
        p.z *= uOrbit;
        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = aSize*clamp(94.0/max(38.0, -mv.z), .72, 2.2);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      void main(){
        vec2 p = abs(gl_PointCoord*2.0-1.0);
        float r = length(p);
        if (r > 1.0) discard;
        float halo = pow(max(0.0, 1.0-r), 1.4);
        float core = pow(max(0.0, 1.0-r), 5.0);
        float rays = (exp(-p.x*20.0)*pow(1.0-p.y, 4.0) +
                      exp(-p.y*20.0)*pow(1.0-p.x, 4.0))*.16;
        gl_FragColor = vec4(vColor*(halo+core*.58), vOpacity*(halo+rays));
      }`,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = 'aligned-colored-webb-stars';
  stars.userData.allowedPointRole = 'registered-stellar-sources';
  stars.renderOrder = 9;
  stars.visible = false;
  root.add(stars);
  return { stars, count: selected.length };
}

/* Webb resolves a red-orange cage of dust/gas around a bluer synchrotron
   interior. Sample those exact pixels, then give the two components different
   ellipsoidal depths. The shader flattens both layers at the canonical camera,
   so the Webb plate remains the sole head-on observation. */
function buildWebbStructure(root, image, budget, uniforms, seed){
  const width = budget.structureSample;
  const height = Math.max(2, Math.round(width/WEBB_ASPECT));
  const pixels = imagePixels(image, width, height);
  const soft = imagePixels(image, width, height, 2.6);
  const lum = luminancePixels(pixels);
  const blur = luminancePixels(soft);
  const rnd = mulberry(hashStr(seed));
  const cageCandidates = [], synchrotronCandidates = [];

  for (let y = 1; y < height-1; y++){
    for (let x = 1; x < width-1; x++){
      const q = y*width+x, offset = q*4;
      const u = x/(width-1), v = y/(height-1);
      const nx = (u-.5)*2/.96, ny = (.5-v)*2/.84;
      const ellipse = nx*nx+ny*ny;
      if (ellipse > 1.18 || lum[q] < .025) continue;
      const red = pixels[offset]/255, green = pixels[offset+1]/255, blue = pixels[offset+2]/255;
      const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
      const saturation = max > .001 ? (max-min)/max : 0;
      const contrast = lum[q]-blur[q];
      const edge = Math.abs(lum[q-1]-lum[q+1])+Math.abs(lum[q-width]-lum[q+width]);
      if (lum[q] > .58 && contrast > .10 && saturation < .18) continue;

      const warm = Math.max(0, red-blue*.68)+Math.max(0, green-blue*.92)*.42;
      const cageScore = edge*1.55+saturation*.34+warm*.24+Math.sqrt(lum[q])*.12;
      if (cageScore > .14)
        cageCandidates.push({ x, y, u, v, ellipse, score: cageScore*(.86+rnd()*.28) });

      const blueInterior = Math.max(0, blue-(red+green)*.38);
      const synchScore = blueInterior*.78+lum[q]*.19+edge*.26;
      if (ellipse < .88 && synchScore > .085)
        synchrotronCandidates.push({ x, y, u, v, ellipse, score: synchScore*(.86+rnd()*.28) });
    }
  }
  cageCandidates.sort((a, b) => b.score-a.score);
  synchrotronCandidates.sort((a, b) => b.score-a.score);
  // A separated selection produces readable broken surface patches instead of
  // the circular particle carpet used by the earlier volume treatment.
  const cageSelected = selectSeparated(
    cageCandidates, budget.webbCagePatches, budget.patchSeparationSq);
  const synchSelected = selectSeparated(
    synchrotronCandidates, budget.webbSynchrotronPatches,
    budget.patchSeparationSq*1.45);

  function buildLayer(selected, shell, name){
    const positions = [], colors = [], uvs = [], opacities = [], seeds = [];
    const indices = [];
    const cell = WEBB_WIDTH/width;
    for (let i = 0; i < selected.length; i++){
      const point = selected[i];
      const depth = Math.sqrt(Math.max(0, 1-Math.min(1, point.ellipse)));
      const centerX = (point.u-.5)*WEBB_WIDTH;
      const centerY = (.5-point.v)*PHOTO_HEIGHT;
      const hemisphere = rnd() < .5 ? -1 : 1;
      const centerZ = shell
        ? hemisphere*(3.2+depth*18)+Math.sin(centerX*.31+centerY*.19)*1.1
        : Math.sin(centerX*.17-centerY*.23)*depth*5.5;
      const patchWidth = cell*(shell
        ? 1.75+Math.min(1.15, point.score*1.15)
        : 2.55+Math.min(1.55, point.score*1.45));
      const patchHeight = patchWidth*(.42+rnd()*.34);
      const angle = shell
        ? Math.atan2(centerY/PHOTO_HEIGHT, centerX/WEBB_WIDTH)+Math.PI*.5+
          gaussian(rnd)*.23
        : rnd()*Math.PI;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const offset = (point.y*width+point.x)*4;
      const sampled = sampledColor(pixels, offset, shell ? 1.34 : 1.18);
      if (!shell) sampled.lerp(new THREE.Color(0x557fff).convertSRGBToLinear(), .20);
      const grain = .72+rnd()*.34;
      const color = [sampled.r*grain, sampled.g*grain, sampled.b*grain];
      const opacity = shell ? .18+rnd()*.16 : .12+rnd()*.12;
      const patchSeed = rnd()*73;
      const base = positions.length/3;
      const corners = [
        [-.58, -.40], [.52, -.49], [.60, .38], [-.46, .52],
      ];
      for (let j = 0; j < corners.length; j++){
        const localX = corners[j][0]*patchWidth*(.88+rnd()*.22);
        const localY = corners[j][1]*patchHeight*(.86+rnd()*.25);
        const px = centerX+localX*cos-localY*sin;
        const py = centerY+localX*sin+localY*cos;
        const zFold = (localX/Math.max(.001, patchWidth))*
          (shell ? hemisphere*1.1 : .65);
        positions.push(px, py, centerZ+zFold);
        colors.push(...color);
        uvs.push(j === 0 || j === 3 ? 0 : 1, j < 2 ? 0 : 1);
        opacities.push(opacity);
        seeds.push(patchSeed);
      }
      indices.push(base, base+1, base+2);
      if (rnd() > .22) indices.push(base, base+2, base+3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(opacities, 1));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOrbit: uniforms.uOrbit,
        uOpacity: uniforms.uWebbStructureOpacity,
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      vertexColors: true,
      vertexShader: `
        attribute float aOpacity;
        attribute float aSeed;
        uniform float uOrbit;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vOpacity;
        varying float vSeed;
        void main(){
          vUv = uv;
          vColor = color;
          vOpacity = uOpacity*uOrbit*aOpacity;
          vSeed = aSeed;
          vec3 p = position;
          p.z *= uOrbit;
          vec4 mv = modelViewMatrix*vec4(p, 1.0);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vOpacity;
        varying float vSeed;
        float hash12(vec2 p){
          vec3 p3 = fract(vec3(p.xyx)*.1031);
          p3 += dot(p3, p3.yzx+33.33);
          return fract((p3.x+p3.y)*p3.z);
        }
        void main(){
          float edge = min(min(vUv.x, 1.0-vUv.x),
                           min(vUv.y, 1.0-vUv.y));
          float edgeMask = smoothstep(.015, .14, edge);
          float grain = hash12(floor(vUv*vec2(7.0, 5.0))+vSeed);
          if (grain < .12 || edgeMask < .01) discard;
          float alpha = vOpacity*edgeMask*(.78+grain*.22);
          gl_FragColor = vec4(vColor*(.72+grain*.24), alpha);
        }`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.renderOrder = shell ? 5 : 3;
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  }

  const cageMesh = buildLayer(
    cageSelected, true, 'webb-aligned-dust-sulfur-patch-mesh');
  const synchrotronMesh = buildLayer(
    synchSelected, false, 'webb-aligned-synchrotron-patch-mesh');
  return {
    cageMesh,
    synchrotronMesh,
    cagePatchCount: cageSelected.length,
    synchrotronPatchCount: synchSelected.length,
  };
}

function buildHubblePatches(root, image1999, image2024, budget, uniforms, seed){
  const width = budget.structureSample;
  const height = width;
  const pixels1999 = imagePixels(image1999, width, height);
  const pixels2024 = imagePixels(image2024, width, height);
  const lum = luminancePixels(pixels2024);
  const rnd = mulberry(hashStr(seed));
  const candidates = [];

  for (let y = 1; y < height-1; y++){
    for (let x = 1; x < width-1; x++){
      const q = y*width+x;
      const light = lum[q];
      if (light < .035) continue;
      const offset = q*4;
      const max = Math.max(pixels2024[offset], pixels2024[offset+1], pixels2024[offset+2]);
      const min = Math.min(pixels2024[offset], pixels2024[offset+1], pixels2024[offset+2]);
      const saturation = max ? (max-min)/max : 0;
      const edge = Math.abs(lum[q-1]-lum[q+1])+
        Math.abs(lum[q-width]-lum[q+width]);
      // Very bright neutral compact sources belong to the aligned star layer.
      if (light > .76 && saturation < .13 && edge > .16) continue;
      const score = edge*1.7+saturation*.38+Math.sqrt(light)*.24;
      if (score < .12) continue;
      candidates.push({ x, y, score: score*(.82+rnd()*.36) });
    }
  }
  candidates.sort((a, b) => b.score-a.score);
  const selected = selectSeparated(
    candidates, budget.hubbleGasPatches, budget.patchSeparationSq);
  if (!selected.length) return null;

  const positions = [], colors1999 = [], colors2024 = [];
  const uvx = [], uvs = [], opacities = [], seeds = [], indices = [];
  const cell = HUBBLE_WIDTH/width;
  for (let i = 0; i < selected.length; i++){
    const point = selected[i];
    const u = point.x/(width-1), v = point.y/(height-1);
    const nx = u*2-1, ny = (1-v)*2-1;
    const ellipticalRadius = Math.min(1, Math.sqrt((nx/.94)**2 + (ny/.82)**2));
    const shellDepth = Math.sqrt(Math.max(0, 1-ellipticalRadius*ellipticalRadius));
    const centerX = (u-.5)*HUBBLE_WIDTH;
    const centerY = (.5-v)*PHOTO_HEIGHT;
    // Each sampled image feature becomes a torn tangent patch on the shell.
    // uOrbit flattens that surface back into exact registered image coordinates.
    const hemisphere = rnd() < .5 ? -1 : 1;
    const centerZ = hemisphere*(3.5+shellDepth*17)+
      Math.sin(centerX*.29-centerY*.21)*1.2;
    const patchWidth = cell*(1.8+Math.min(1.45, point.score*1.25));
    const patchHeight = patchWidth*(.40+rnd()*.34);
    const angle = Math.atan2(centerY/PHOTO_HEIGHT, centerX/HUBBLE_WIDTH)+
      Math.PI*.5+gaussian(rnd)*.22;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const offset = (point.y*width+point.x)*4;
    const a = sampledColor(pixels1999, offset, 1.22);
    const b = sampledColor(pixels2024, offset, 1.22);
    const opacity = .17+rnd()*.17;
    const patchSeed = rnd()*79;
    const base = positions.length/3;
    const corners = [
      [-.57, -.41], [.54, -.49], [.60, .38], [-.48, .53],
    ];
    for (let j = 0; j < corners.length; j++){
      const localX = corners[j][0]*patchWidth*(.87+rnd()*.24);
      const localY = corners[j][1]*patchHeight*(.85+rnd()*.27);
      positions.push(
        centerX+localX*cos-localY*sin,
        centerY+localX*sin+localY*cos,
        centerZ+hemisphere*localX/Math.max(.001, patchWidth)*1.15,
      );
      colors1999.push(a.r, a.g, a.b);
      colors2024.push(b.r, b.g, b.b);
      uvx.push(u);
      uvs.push(j === 0 || j === 3 ? 0 : 1, j < 2 ? 0 : 1);
      opacities.push(opacity);
      seeds.push(patchSeed);
    }
    indices.push(base, base+1, base+2);
    if (rnd() > .20) indices.push(base, base+2, base+3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aColor1999', new THREE.Float32BufferAttribute(colors1999, 3));
  geometry.setAttribute('aColor2024', new THREE.Float32BufferAttribute(colors2024, 3));
  geometry.setAttribute('aUvX', new THREE.Float32BufferAttribute(uvx, 1));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(opacities, 1));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOrbit: uniforms.uOrbit,
      uOpacity: uniforms.uHubblePatchOpacity,
      uEpoch: uniforms.uEpoch,
      uCompare: uniforms.uCompare,
      uCurtain: uniforms.uCurtain,
      uBacktrace: uniforms.uBacktrace,
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aColor1999;
      attribute vec3 aColor2024;
      attribute float aUvX;
      attribute float aOpacity;
      attribute float aSeed;
      uniform float uOrbit;
      uniform float uOpacity;
      uniform float uEpoch;
      uniform float uCompare;
      uniform float uCurtain;
      uniform float uBacktrace;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vSeed;
      void main(){
        float side = smoothstep(uCurtain-.006, uCurtain+.006, aUvX);
        float epoch = mix(uEpoch, side, uCompare);
        vUv = uv;
        vColor = mix(aColor1999, aColor2024, epoch);
        vOpacity = uOpacity*uOrbit*aOpacity;
        vSeed = aSeed;
        vec3 p = position;
        p.xy *= mix(1.0, .70, uBacktrace);
        p.z *= mix(uOrbit, uOrbit*.35, uBacktrace);
        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vSeed;
      float hash12(vec2 p){
        vec3 p3 = fract(vec3(p.xyx)*.1031);
        p3 += dot(p3, p3.yzx+33.33);
        return fract((p3.x+p3.y)*p3.z);
      }
      void main(){
        float edge = min(min(vUv.x, 1.0-vUv.x),
                         min(vUv.y, 1.0-vUv.y));
        float edgeMask = smoothstep(.015, .14, edge);
        float grain = hash12(floor(vUv*vec2(8.0, 6.0))+vSeed);
        if (grain < .13 || edgeMask < .01) discard;
        float alpha = vOpacity*edgeMask*(.78+grain*.22);
        gl_FragColor = vec4(vColor*(.74+grain*.22), alpha);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'registered-hubble-filament-patch-mesh';
  mesh.renderOrder = 5;
  mesh.visible = false;
  root.add(mesh);
  return { mesh, patchCount: selected.length };
}

function buildFilamentSheets(root, rnd, count, uniforms){
  const positions = [], colorsHubble = [], colorsWebb = [];
  const phases = [], opacities = [], uvs = [], indices = [];
  const hubblePalette = [0x6caeb0, 0xa95f68, 0xbb8259, 0x705985];
  const webbPalette = [0x5266a6, 0x914e70, 0xa9533d, 0xb27948];

  function appendStrip(points, width, colorHubble, colorWebb, phase, opacity){
    const base = positions.length/3;
    for (let j = 0; j < points.length; j++){
      const t = j/(points.length-1);
      const taper = .10+.90*Math.pow(Math.sin(Math.PI*t), .52);
      const point = points[j];
      const before = points[Math.max(0, j-1)];
      const after = points[Math.min(points.length-1, j+1)];
      const tangent = after.clone().sub(before).normalize();
      const radial = new THREE.Vector3(
        point.x/40, point.y/34, point.z/24).normalize();
      const across = radial.cross(tangent).normalize();
      const tornWidth = width*taper*(.78+.22*Math.sin(t*31+phase));
      for (let side = -1; side <= 1; side += 2){
        positions.push(
          point.x+across.x*side*tornWidth,
          point.y+across.y*side*tornWidth,
          point.z+across.z*side*tornWidth,
        );
        uvs.push(side < 0 ? 0 : 1, t);
        colorsHubble.push(colorHubble.r, colorHubble.g, colorHubble.b);
        colorsWebb.push(colorWebb.r, colorWebb.g, colorWebb.b);
        phases.push(phase);
        opacities.push(opacity);
      }
    }
    for (let j = 0; j < points.length-1; j++){
      const a = base+j*2, b = a+1, c = a+2, d = a+3;
      indices.push(a, b, c, b, d, c);
    }
  }

  for (let i = 0; i < count; i++){
    const angle = rnd()*Math.PI*2;
    const latitude = (rnd()-.5)*1.35;
    const phase = rnd()*Math.PI*2;
    const points = [];
    const steps = 14;
    const span = .30+rnd()*.50;
    const verticalSpan = 8+rnd()*12;
    for (let j = 0; j < steps; j++){
      const t = j/(steps-1)-.5;
      const a = angle+t*span+Math.sin(t*8+phase)*.035;
      const swell = 1+Math.sin(t*Math.PI+phase)*.08;
      const y = latitude*34+t*verticalSpan+Math.sin(t*9+phase)*1.4;
      // Webb shows the outer cage bending inward at the equatorial waist.
      // Apply that pinch to the filament paths while retaining corrugation.
      const waist = .72+.28*Math.pow(Math.min(1, Math.abs(y)/38), .62);
      points.push(new THREE.Vector3(
        Math.cos(a)*40*swell*waist,
        y,
        Math.sin(a)*24*swell*waist+Math.cos(t*7+phase)*1.55,
      ));
    }
    const hubble = new THREE.Color(hubblePalette[i%hubblePalette.length]);
    const webb = new THREE.Color(webbPalette[(i+1)%webbPalette.length]);
    const width = 1.15+rnd()*1.55;
    // One broad sheet per physical path. The previous paired strips read as
    // two neon rails and exaggerated the cage into spaghetti.
    appendStrip(points, width, hubble, webb, phase, .055+rnd()*.065);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aColorHubble', new THREE.Float32BufferAttribute(colorsHubble, 3));
  geometry.setAttribute('aColorWebb', new THREE.Float32BufferAttribute(colorsWebb, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(opacities, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: uniforms.uFilamentOpacity,
      uWebb: uniforms.uWebbMix,
      uTime: uniforms.uTime,
      uOrbit: uniforms.uOrbit,
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      attribute vec3 aColorHubble;
      attribute vec3 aColorWebb;
      attribute float aPhase;
      attribute float aOpacity;
      varying vec2 vUv;
      varying vec3 vColorHubble;
      varying vec3 vColorWebb;
      varying float vPhase;
      varying float vOpacity;
      void main(){
        vUv = uv;
        vColorHubble = aColorHubble;
        vColorWebb = aColorWebb;
        vPhase = aPhase;
        vOpacity = aOpacity;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uWebb;
      uniform float uTime;
      uniform float uOrbit;
      varying vec2 vUv;
      varying vec3 vColorHubble;
      varying vec3 vColorWebb;
      varying float vPhase;
      varying float vOpacity;
      float hash12(vec2 p){
        vec3 p3 = fract(vec3(p.xyx)*.1031);
        p3 += dot(p3, p3.yzx+33.33);
        return fract((p3.x+p3.y)*p3.z);
      }
      void main(){
        float edge = smoothstep(.015, .16, min(vUv.x, 1.0-vUv.x));
        float ends = smoothstep(0.0, .10, vUv.y)*
                     smoothstep(0.0, .10, 1.0-vUv.y);
        float flow = .52+.48*sin(vUv.y*27.0-uTime*.10+vPhase);
        float grain = hash12(floor(vUv*vec2(11.0, 38.0))+vPhase);
        if (grain+flow*.16 < .28) discard;
        float torn = smoothstep(.24, .74, grain+flow*.15);
        vec3 color = mix(vColorHubble, vColorWebb, uWebb)*(.72+flow*.18);
        gl_FragColor = vec4(
          color, uOpacity*uOrbit*vOpacity*edge*ends*(.42+torn*.58));
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'broad-torn-filament-sheets';
  mesh.renderOrder = 4;
  mesh.visible = false;
  root.add(mesh);
  return { mesh, material };
}

function buildSupernova(root, rnd, count, glowTexture){
  const positions = new Float32Array(count*3);
  const colors = new Float32Array(count*3);
  const warm = new THREE.Color(0xffb45e);
  const cool = new THREE.Color(0x69bfff);
  for (let i = 0; i < count; i++){
    const u = rnd()*2-1, angle = rnd()*Math.PI*2;
    const s = Math.sqrt(1-u*u);
    const radius = .82+Math.pow(rnd(), 4)*.22;
    positions[i*3] = s*Math.cos(angle)*radius;
    positions[i*3+1] = u*radius;
    positions[i*3+2] = s*Math.sin(angle)*radius;
    const color = warm.clone().lerp(cool, rnd()*.52);
    colors.set([color.r, color.g, color.b], i*3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: .72,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    map: glowTexture,
    alphaTest: .015,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shell = new THREE.Points(geometry, material);
  shell.name = 'illustrative-supernova-ejecta';
  shell.userData.allowedPointRole = 'transient-supernova-ejecta';
  root.add(shell);

  const shockMaterial = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0x5baee9) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix*vec4(position, 1.0);
        vNormal = normalize(normalMatrix*normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        float rim = pow(1.0-abs(dot(normalize(vNormal), normalize(vView))), 3.0);
        gl_FragColor = vec4(uColor*(.45+rim), uOpacity*rim);
      }`,
  });
  const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), shockMaterial);
  shock.name = 'illustrative-shock-front';
  root.add(shock);

  const flashMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffd9a2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flash = new THREE.Sprite(flashMaterial);
  flash.name = 'illustrative-supernova-flash';
  root.add(flash);
  return { shell, material, shock, shockMaterial, flash, flashMaterial };
}

function buildPulsarEngine(root, glowTexture, low){
  const group = new THREE.Group();
  group.name = 'pulsar-engine-context';
  group.rotation.set(.42, -.28, .12);
  root.add(group);
  const materials = [];

  function surfaceMaterial(color, opacity){
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    material.userData.baseOpacity = opacity;
    materials.push(material);
    return material;
  }

  const torusMaterial = surfaceMaterial(0x5c8fff, .085);
  const torus = new THREE.Mesh(new THREE.RingGeometry(5.8, 10.2,
    low ? 48 : 88,3), torusMaterial);
  torus.name = 'broad-equatorial-pulsar-flow-surface';
  group.add(torus);
  const outerMaterial = surfaceMaterial(0x9a62eb, .045);
  const outer = new THREE.Mesh(new THREE.RingGeometry(10.8, 15.3,
    low ? 48 : 88,2,Math.PI*.12,Math.PI*1.72), outerMaterial);
  outer.name = 'broken-outer-pulsar-flow-surface';
  outer.scale.y = .72;
  group.add(outer);

  // Hubble/Webb show nested ripple-like wisps moving away from the pulsar.
  // Broad annular sectors carry them as surfaces, never tube outlines.
  const wisps = [];
  for (let i = 0; i < (low ? 3 : 6); i++){
    const wispMaterial = surfaceMaterial(i%2 ? 0x78b7ff : 0x8b72e8,
      .030+i*.004);
    const arc = Math.PI*(1.02+(i%3)*.18);
    const wisp = new THREE.Mesh(
      new THREE.RingGeometry(4.1+i*1.34,5.0+i*1.34,
        low ? 36 : 64,2,.18+i*.19,arc),
      wispMaterial,
    );
    wisp.rotation.z = -.72+i*.52;
    wisp.position.set((i%2 ? 1 : -1)*.42, (i-2.5)*.24, (i%3-1)*.30);
    wisp.scale.y = .62+i*.025;
    group.add(wisp);
    wisps.push(wisp);
  }

  const jetMaterial = surfaceMaterial(0x54b9ff, .055);
  for (const direction of [-1, 1]){
    const jet = new THREE.Mesh(new THREE.ConeGeometry(2.35, 23,
      low ? 12 : 18,1,true), jetMaterial);
    jet.name = 'broad-pulsar-jet-outflow-surface';
    jet.rotation.x = Math.PI/2;
    jet.position.z = direction*11.5;
    if (direction < 0) jet.rotation.y = Math.PI;
    group.add(jet);
  }

  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xe9f3ff });
  coreMaterial.userData.baseOpacity = 1;
  coreMaterial.transparent = true;
  coreMaterial.opacity = 0;
  materials.push(coreMaterial);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.75, 24, 16), coreMaterial);
  group.add(core);

  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x7eb9ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  glowMaterial.userData.baseOpacity = .28;
  materials.push(glowMaterial);
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.set(9, 9, 1);
  group.add(glow);
  return { group, materials, core, torus, outer, wisps, glow };
}

function disposeMaterial(material){
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  for (const value of materials){
    for (const key of Object.keys(value)){
      const candidate = value[key];
      if (candidate && candidate.isTexture) candidate.dispose();
    }
    value.dispose();
  }
}

function disposeDetachedObject(root){
  if (!root) return;
  const geometries = new Set(), materials = new Set();
  root.traverse(object => {
    if (object.geometry && !geometries.has(object.geometry)){
      geometries.add(object.geometry);
      object.geometry.dispose();
    }
    const list = Array.isArray(object.material) ? object.material :
      (object.material ? [object.material] : []);
    for (const material of list){
      if (materials.has(material)) continue;
      materials.add(material);
      disposeMaterial(material);
    }
  });
}

export function buildCrabFeatured({ entry }){
  const group = new THREE.Group();
  group.name = 'crab-nebula-dedicated-exhibit';
  const tier = detectTier().tier;
  const low = tier === 'low';
  const budget = low
    ? { sample: 190, structureSample: 150, stars: 70, webbStars: 85,
        hubbleGasPatches: 720, filamentSheets: 8, webbCagePatches: 620,
        webbSynchrotronPatches: 260, patchSeparationSq: 3.2, ejecta: 900,
        textureLongSide: 2048 }
    : { sample: 310, structureSample: 248, stars: 170, webbStars: 210,
        hubbleGasPatches: 1700, filamentSheets: 16, webbCagePatches: 1450,
        webbSynchrotronPatches: 620, patchSeparationSq: 3.6, ejecta: 2400,
        textureLongSide: 4096 };
  const rnd = mulberry(hashStr('crab-dedicated:' + entry.id));
  let disposed = false;
  let modelGeneration = 0;
  let modelStarted = false;
  let modelRoot = null;
  let modelMaterial = null;
  let dracoLoader = null;
  let time = 0;
  let flashAge = 0;
  let activeState = STATES.EXPANSION;
  let previousNonWebbState = STATES.EXPANSION;

  const ownedTextures = new Set();
  const pendingImages = new Set();
  const hubble1999Fallback = solidTexture(0x39172a);
  const hubble2024Fallback = solidTexture(0x18324d);
  const webbFallback = solidTexture(0x341c4d);
  const glowTexture = softTexture();
  ownedTextures.add(hubble1999Fallback);
  ownedTextures.add(hubble2024Fallback);
  ownedTextures.add(webbFallback);

  const hubbleMaterial = makeHubbleMaterial(hubble1999Fallback, hubble2024Fallback);
  const webbMaterial = makeWebbMaterial(webbFallback);
  const hubblePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(HUBBLE_WIDTH, PHOTO_HEIGHT), hubbleMaterial);
  hubblePlane.name = 'registered-hubble-1999-2024-observation';
  hubblePlane.renderOrder = 1;
  group.add(hubblePlane);
  const webbPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(WEBB_WIDTH, PHOTO_HEIGHT), webbMaterial);
  webbPlane.name = 'webb-2023-infrared-observation';
  webbPlane.position.z = .025;
  webbPlane.renderOrder = 2;
  group.add(webbPlane);

  const sharedUniforms = {
    uOrbit: { value: 0 },
    uEpoch: hubbleMaterial.uniforms.uEpoch,
    uCompare: hubbleMaterial.uniforms.uCompare,
    uCurtain: hubbleMaterial.uniforms.uCurtain,
    uStarOpacity: { value: .82 },
    uWebbStarOpacity: { value: 0 },
    uWebbStructureOpacity: { value: 0 },
    uHubblePatchOpacity: { value: .80 },
    uBacktrace: { value: 0 },
    uFilamentOpacity: { value: .74 },
    uWebbMix: { value: 0 },
    uTime: { value: 0 },
  };

  const filaments = buildFilamentSheets(
    group, rnd, budget.filamentSheets, sharedUniforms);
  const supernova = buildSupernova(group, rnd, budget.ejecta, glowTexture);
  const engine = buildPulsarEngine(group, glowTexture, low);
  const modelAnchor = new THREE.Group();
  modelAnchor.name = 'official-xray-informed-model-anchor';
  group.add(modelAnchor);

  let hubble1999Image = null;
  let hubble2024Image = null;
  let hubbleLayersBuilt = false;
  let webbStarsBuilt = false;
  let hubbleRegistered = null;
  let hubblePatchMesh = null;
  let webbStarLayer = null;
  let webbStructure = null;

  const current = { ...PRESETS[activeState] };
  let target = { ...current };

  group.userData.renderer = 'crab-observation-sculpt-v2';
  group.userData.activeState = activeState;
  group.userData.qualityTier = tier;
  group.userData.qualityBudget = { ...budget };
  group.userData.filamentSheets = budget.filamentSheets;
  group.userData.modelStatus = 'idle';
  group.userData.assets = {
    hubble1999: HUBBLE_1999,
    hubble2024: HUBBLE_2024,
    webb2023: WEBB_2023,
    xrayModel: XRAY_MODEL,
  };
  group.userData.scientificSemantics = {
    [STATES.SUPERNOVA]: 'Illustrative reconstruction; no telescope image of the 1054 event.',
    [STATES.DISCOVERY]: 'Later Hubble data used as an illustrative optical view, not a 1731 image.',
    [STATES.BACKTRACE]: 'Radial back-trace is an inference display, not recovered 1928 imagery.',
    [STATES.PULSAR]: 'NASA X-ray-informed 3D representation; not tomography or astrometric geometry.',
    [STATES.WEBB]: 'Infrared wavelength comparison; never interpolated as a time epoch.',
    [STATES.EXPANSION]: 'Registered matched-color 1999/2024 comparison; WFPC2 and WFC3 differ.',
  };
  group.userData.registration = {
    hubble: {
      temporal: true,
      dimensions: [HUBBLE_SIZE, HUBBLE_SIZE],
      method: 'Official matched presentation coordinates; stable stars share normalized pixels.',
      caveat: 'Different instruments: 1999 WFPC2 and 2024 WFC3.',
    },
    webb: {
      temporal: false,
      dimensions: [4000, 3483],
      method: 'Independent native-aspect observation plane with independently aligned stars.',
      caveat: 'Different wavelength bands and crop; not morphed into Hubble epochs.',
    },
    model: 'Centered and scaled for explanation only; not coordinate-aligned to either image.',
  };
  group.userData.pulsarAnimation =
    'Visual motion is deliberately slow; the physical ~30 Hz pulse is not flashed onscreen.';
  group.userData.morphology = {
    optical: 'Registered Hubble features unfold as separated torn patches on a corrugated ellipsoidal shell.',
    infrared: 'Webb-derived dust/sulfur and synchrotron patches retain exact photo coordinates head-on.',
    waist: 'Eight or sixteen broad filament sheets bend through the equatorial pinch without forming a wire cage.',
    pulsar: 'Nested partial wisps, ringed equatorial flow and opposed jets follow the NASA X-ray context model.',
    atmosphere: 'No generic soft cloud sprites; all persistent structure is image-derived or morphology-bound.',
  };

  function noteAssetError(asset, error){
    const errors = group.userData.assetErrors || (group.userData.assetErrors = {});
    errors[asset] = error && error.message ? error.message : 'load failed';
  }

  function loadImageTexture(url, onLoad){
    const image = new Image();
    let settled = false;
    const cancel = () => {
      if (settled) return;
      settled = true;
      pendingImages.delete(cancel);
      image.onload = null;
      image.onerror = null;
      image.src = '';
    };
    pendingImages.add(cancel);
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (settled) return;
      settled = true;
      pendingImages.delete(cancel);
      image.onload = null;
      image.onerror = null;
      if (disposed) return;
      const texture = new THREE.Texture(textureSource(image, budget.textureLongSide));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = low ? 4 : 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.needsUpdate = true;
      ownedTextures.add(texture);
      try{ onLoad(texture, image); }
      catch (error){ noteAssetError(url, error); }
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      pendingImages.delete(cancel);
      image.onload = null;
      image.onerror = null;
      if (!disposed) noteAssetError(url, new Error('image load failed'));
    };
    image.src = url;
    return cancel;
  }

  function buildHubbleLayers(){
    if (disposed || hubbleLayersBuilt || !hubble1999Image || !hubble2024Image) return;
    hubbleLayersBuilt = true;
    const image1999 = hubble1999Image;
    const image2024 = hubble2024Image;
    group.userData.hubblePairDimensionsVerified =
      image1999.naturalWidth === HUBBLE_SIZE && image1999.naturalHeight === HUBBLE_SIZE &&
      image2024.naturalWidth === HUBBLE_SIZE && image2024.naturalHeight === HUBBLE_SIZE;
    try{
      const registered = buildRegisteredStars(group, image1999, image2024,
        budget, sharedUniforms, 'crab-registered-stars:' + entry.id);
      const patches = buildHubblePatches(group, image1999, image2024,
        budget, sharedUniforms, 'crab-hubble-patches:' + entry.id);
      hubbleRegistered = registered && registered.stars;
      hubblePatchMesh = patches && patches.mesh;
      group.userData.registeredHubbleStars = registered ? registered.count : 0;
      group.userData.hubbleGasPatches = patches ? patches.patchCount : 0;
      group.userData.hubbleRegistrationReady = true;
    }catch (error){
      group.userData.hubbleRegistrationReady = false;
      noteAssetError('hubble-derived-layers', error);
    }
    // Low-tier GPU textures use 2K canvas derivatives, so release the decoded
    // 4K HTML images after color sampling and registration data are built.
    hubble1999Image = null;
    hubble2024Image = null;
  }

  loadImageTexture(HUBBLE_1999, (texture, image) => {
    hubbleMaterial.uniforms.u1999.value = texture;
    hubbleMaterial.uniforms.uReady1999.value = 1;
    hubble1999Image = image;
    buildHubbleLayers();
  });
  loadImageTexture(HUBBLE_2024, (texture, image) => {
    hubbleMaterial.uniforms.u2024.value = texture;
    hubbleMaterial.uniforms.uReady2024.value = 1;
    hubble2024Image = image;
    buildHubbleLayers();
  });
  loadImageTexture(WEBB_2023, (texture, image) => {
    webbMaterial.uniforms.uMap.value = texture;
    webbMaterial.uniforms.uReady.value = 1;
    group.userData.webbDimensionsVerified =
      image.naturalWidth === 4000 && image.naturalHeight === 3483;
    if (!webbStarsBuilt){
      webbStarsBuilt = true;
      try{
        const stars = buildWebbStars(group, image, budget, sharedUniforms,
          'crab-webb-stars:' + entry.id);
        webbStarLayer = stars && stars.stars;
        webbStructure = buildWebbStructure(group, image, budget, sharedUniforms,
          'crab-webb-structure:' + entry.id);
        group.userData.alignedWebbStars = stars ? stars.count : 0;
        group.userData.webbCagePatches = webbStructure.cagePatchCount;
        group.userData.webbSynchrotronPatches =
          webbStructure.synchrotronPatchCount;
        group.userData.webbAlignmentReady = true;
      }catch (error){
        group.userData.webbAlignmentReady = false;
        noteAssetError('webb-derived-stars', error);
      }
    }
  });

  function ensureModel(){
    if (disposed || modelStarted) return;
    modelStarted = true;
    const generation = ++modelGeneration;
    group.userData.modelStatus = 'loading';
    Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/loaders/DRACOLoader.js'),
    ]).then(([{ GLTFLoader }, { DRACOLoader }]) => {
      if (disposed || generation !== modelGeneration) return;
      dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(DRACO_DECODER);
      dracoLoader.preload();
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);
      loader.load(XRAY_MODEL, gltf => {
        if (disposed || generation !== modelGeneration){
          disposeDetachedObject(gltf.scene);
          return;
        }
        modelRoot = gltf.scene;
        const originalMaterials = new Set();
        modelRoot.traverse(object => {
          if (!object.isMesh) return;
          const list = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of list) if (material) originalMaterials.add(material);
        });
        for (const material of originalMaterials) disposeMaterial(material);
        modelMaterial = new THREE.MeshStandardMaterial({
          color: 0x405dd8,
          emissive: 0x162d9a,
          emissiveIntensity: 1.45,
          roughness: .68,
          metalness: .08,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        modelRoot.traverse(object => {
          if (!object.isMesh) return;
          object.material = modelMaterial;
          object.renderOrder = 6;
        });
        let box = new THREE.Box3().setFromObject(modelRoot);
        const size = box.getSize(new THREE.Vector3());
        const scale = 56/Math.max(size.x, size.y, size.z, .001);
        modelRoot.scale.setScalar(scale);
        box = new THREE.Box3().setFromObject(modelRoot);
        const center = box.getCenter(new THREE.Vector3());
        modelRoot.position.set(-center.x, -center.y, -center.z);
        modelRoot.userData.scientificRole =
          'NASA X-ray-informed representation; centered/scaled, not tomography or image registration.';
        modelAnchor.add(modelRoot);
        group.userData.modelStatus = 'ready';
        if (dracoLoader){ dracoLoader.dispose(); dracoLoader = null; }
      }, undefined, error => {
        if (disposed || generation !== modelGeneration) return;
        group.userData.modelStatus = 'error';
        noteAssetError(XRAY_MODEL, error);
        if (dracoLoader){ dracoLoader.dispose(); dracoLoader = null; }
      });
    }).catch(error => {
      if (disposed || generation !== modelGeneration) return;
      group.userData.modelStatus = 'error';
      noteAssetError(XRAY_MODEL, error);
    });
  }

  function applyState(nextState){
    if (!PRESETS[nextState]) nextState = STATES.EXPANSION;
    if (nextState !== STATES.WEBB) previousNonWebbState = nextState;
    if (nextState === STATES.PULSAR) ensureModel();
    if (nextState === STATES.SUPERNOVA && activeState !== STATES.SUPERNOVA)
      flashAge = 0;
    activeState = nextState;
    target = { ...PRESETS[nextState] };
    group.userData.activeState = nextState;
    group.userData.activeComparison = nextState === STATES.WEBB
      ? 'wavelength'
      : nextState === STATES.EXPANSION ? 'registered-time-pair' : 'illustrative-context';
  }

  return {
    group,
    focusDist: 105,
    startTheta: 0,
    startPhi: Math.PI/2,
    autoRotate: false,
    hasIR: true,
    isImage: true,
    imageCredit: IMAGE_CREDIT,
    modelCredit: MODEL_CREDIT,
    setMoment(visual){
      if (!disposed) applyState(stateFromVisual(visual));
    },
    setIR(on){
      if (disposed) return;
      applyState(on ? STATES.WEBB : previousNonWebbState);
    },
    update(dt, camera){
      if (disposed) return;
      dt = Math.min(Math.max(dt || 0, 0), .05);
      time += dt;
      if (activeState === STATES.SUPERNOVA) flashAge += dt;
      for (const key of Object.keys(current))
        current[key] = damp(current[key], target[key], 3.6, dt);

      let front = 1;
      if (camera){
        const length = Math.max(camera.position.length(), .001);
        front = camera.position.z/length;
      }
      const headOn = THREE.MathUtils.smoothstep(front, .9511, .9990);
      const orbitTarget = 1-headOn;
      sharedUniforms.uOrbit.value = damp(sharedUniforms.uOrbit.value, orbitTarget, 4.5, dt);
      const frontHemisphere = THREE.MathUtils.smoothstep(front, -.15, .32);
      const observationVisibility = headOn*.97+frontHemisphere*.03;
      const curtain = .5+Math.sin(time*.20)*.24;

      sharedUniforms.uEpoch.value = current.epoch;
      sharedUniforms.uCompare.value = current.compare;
      sharedUniforms.uCurtain.value = curtain;
      sharedUniforms.uStarOpacity.value = current.stars;
      sharedUniforms.uWebbStarOpacity.value = current.webbStars;
      sharedUniforms.uWebbStructureOpacity.value = current.webb;
      sharedUniforms.uHubblePatchOpacity.value = current.gasPatches;
      sharedUniforms.uBacktrace.value = current.backtrace;
      sharedUniforms.uFilamentOpacity.value = current.filaments;
      sharedUniforms.uWebbMix.value = current.webb;
      sharedUniforms.uTime.value = time;

      hubbleMaterial.uniforms.uOpacity.value = current.hubble*observationVisibility;
      hubbleMaterial.uniforms.uSaturation.value = current.saturation;
      hubbleMaterial.uniforms.uExposure.value = current.exposure;
      webbMaterial.uniforms.uOpacity.value = current.webb*observationVisibility;
      webbMaterial.uniforms.uSaturation.value = current.saturation;
      webbMaterial.uniforms.uExposure.value = current.exposure;

      const flashPhase = (flashAge%7)/7;
      const flashRadius = 8+flashPhase*33;
      supernova.shell.scale.setScalar(flashRadius);
      supernova.shock.scale.setScalar(flashRadius*1.08);
      supernova.material.opacity = current.flash*(1-flashPhase)*.86;
      supernova.shockMaterial.uniforms.uOpacity.value = current.flash*(1-flashPhase)*.52;
      const slowPulse = .92+Math.sin(time*1.05)*.08;
      supernova.flash.scale.setScalar((13+flashPhase*12)*slowPulse);
      supernova.flashMaterial.opacity = current.flash*(.74-flashPhase*.34);

      engine.group.visible = current.engine > .004;
      for (const material of engine.materials)
        material.opacity = material.userData.baseOpacity*current.engine;
      engine.torus.rotation.z = time*.10;
      engine.outer.rotation.z = -time*.055;
      for (let i = 0; i < engine.wisps.length; i++)
        engine.wisps[i].rotation.z += dt*(i%2 ? -.018 : .022);
      engine.core.scale.setScalar(1+Math.sin(time*1.12)*.07);
      engine.glow.scale.setScalar(9*(1+Math.sin(time*.78)*.055));

      if (modelMaterial) modelMaterial.opacity = current.model*.62;
      modelAnchor.visible = current.model > .004;
      modelAnchor.rotation.y = Math.sin(time*.075)*.08;
      group.userData.hubbleCurtain = curtain;
      group.userData.headOnAlignment = sharedUniforms.uOrbit.value < .025;
      group.userData.modelVisible = !!modelRoot && modelAnchor.visible;
      // A small set of broad torn surfaces replaces paired neon line rails.
      filaments.mesh.visible = current.filaments*sharedUniforms.uOrbit.value > .003;
      if (hubbleRegistered)
        hubbleRegistered.visible = current.stars*sharedUniforms.uOrbit.value > .003;
      if (hubblePatchMesh)
        hubblePatchMesh.visible =
          current.gasPatches*sharedUniforms.uOrbit.value > .003;
      if (webbStarLayer)
        webbStarLayer.visible = current.webbStars*sharedUniforms.uOrbit.value > .003;
      if (webbStructure){
        const visible = current.webb*sharedUniforms.uOrbit.value > .004;
        webbStructure.cageMesh.visible = visible;
        webbStructure.synchrotronMesh.visible = visible;
      }
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      modelGeneration += 1;
      group.userData.modelStatus = modelRoot ? 'disposed' : 'cancelled';
      for (const cancel of [...pendingImages]) cancel();
      pendingImages.clear();
      if (dracoLoader){ dracoLoader.dispose(); dracoLoader = null; }
      if (modelRoot){
        modelAnchor.remove(modelRoot);
        disposeDetachedObject(modelRoot);
        modelRoot = null;
        modelMaterial = null;
      }
      // Shader-uniform textures are invisible to LandmarkView's material.map
      // traversal, so the exhibit owns and releases them explicitly.
      for (const texture of ownedTextures) texture.dispose();
      ownedTextures.clear();
    },
  };
}
