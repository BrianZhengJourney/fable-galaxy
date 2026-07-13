/* Shared high-fidelity renderer for the curated nebula collection.
   Each object keeps its observation exact at the canonical camera, then
   reveals an explicitly interpretive depth volume and family-specific
   structure as the visitor orbits.  Source photographs are owned by the
   global texture cache; this module disposes only resources it creates. */

import * as THREE from 'three';
import { buildImageVolume } from '../exhibits.js';
import { nebulaProfile } from '../../data/nebulaProfiles.js';
import { loadTexture } from '../../utils/assets.js';
import { mulberry, hashStr, gaussian } from '../../utils/rng.js';
import { detectTier } from '../../core/quality.js';

const TAU = Math.PI * 2;
const DISPLAY_HEIGHT = 62;

const QUALITY = Object.freeze({
  low: Object.freeze({
    veilLayers: 2,
    starSample: 220,
    stars: 34,
    familyPoints: 1800,
    familyFilaments: 5,
    curveSegments: 28,
  }),
  high: Object.freeze({
    veilLayers: 3,
    starSample: 340,
    stars: 88,
    familyPoints: 5200,
    familyFilaments: 12,
    curveSegments: 52,
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

function vectorFrom(value, fallback = [0, 0, 0]){
  if (Array.isArray(value) && value.length >= 3)
    return new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0,
      Number(value[2]) || 0);
  if (value && typeof value === 'object')
    return new THREE.Vector3(Number(value.x) || 0, Number(value.y) || 0,
      Number(value.z) || 0);
  return new THREE.Vector3(...fallback);
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

function paletteFrom(profile){
  const raw = profile.palette;
  const values = [];
  const push = value => {
    if (value == null) return;
    // A numeric RGB triple is one color, while an array of strings/hex values
    // is a list of colors.
    if (Array.isArray(value) && value.length === 3 &&
        value.every(channel => typeof channel === 'number' && channel >= 0 && channel <= 255))
      values.push(value);
    else if (Array.isArray(value)) value.forEach(push);
    else values.push(value);
  };
  if (Array.isArray(raw)) push(raw);
  else if (raw && typeof raw === 'object'){
    for (const key of [
      'inner', 'outer', 'accent', 'gas', 'emission', 'reflection', 'rim',
      'shell', 'filament', 'highlight', 'warm', 'cool', 'dust',
    ]) push(raw[key]);
  } else push(raw);
  if (!values.length) values.push(0x66b7c8, 0xd06f52, 0x6d4b91, 0xf2b36f);
  return values.map((value, index) => colorFrom(value,
    [0x66b7c8, 0xd06f52, 0x6d4b91, 0xf2b36f][index % 4]));
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

function softDiscTexture(){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.96)');
  gradient.addColorStop(.16, 'rgba(255,255,255,.70)');
  gradient.addColorStop(.48, 'rgba(255,255,255,.17)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
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
        float edgeX = smoothstep(0.0, .012, vUv.x) *
                      smoothstep(0.0, .012, 1.0-vUv.x);
        float edgeY = smoothstep(0.0, .012, vUv.y) *
                      smoothstep(0.0, .012, 1.0-vUv.y);
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

function buildVeils(parent, fallback, tracker, count){
  const reveal = { value: 0 };
  const ready = { value: 0 };
  const source = { value: fallback };
  const all = [];
  const presets = [
    { x: 0, y: 0, z: -15, ry: 0, scale: 1.07, alpha: .145, curve: 1.1,
      shift: [0, 0] },
    { x: -3.5, y: 1.5, z: -29, ry: .12, scale: 1.24, alpha: .085, curve: 1.9,
      shift: [.012, -.009] },
    { x: 5, y: -1, z: -45, ry: -.17, scale: 1.46, alpha: .052, curve: 2.8,
      shift: [-.017, .014] },
  ];
  for (const layer of presets.slice(0, count)){
    const material = tracker.material(new THREE.ShaderMaterial({
      uniforms: {
        uSource: source,
        uReady: ready,
        uReveal: reveal,
        uAlpha: { value: layer.alpha },
        uCurve: { value: layer.curve },
        uShift: { value: new THREE.Vector2(...layer.shift) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uCurve;
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 p = position;
          p.z += cos((uv.x-.5) * 3.14159265) * uCurve;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uSource;
        uniform float uReady;
        uniform float uReveal;
        uniform float uAlpha;
        uniform vec2 uShift;
        varying vec2 vUv;
        void main(){
          vec2 uv = vUv + uShift;
          vec3 source = texture2D(uSource, uv, 4.25).rgb;
          float high = max(source.r, max(source.g, source.b));
          float low = min(source.r, min(source.g, source.b));
          float luma = dot(source, vec3(.299,.587,.114));
          float gas = smoothstep(.018, .21, luma + (high-low)*.42);
          float edgeX = smoothstep(0.0, .10, vUv.x) *
                        smoothstep(0.0, .10, 1.0-vUv.x);
          float edgeY = smoothstep(0.0, .10, vUv.y) *
                        smoothstep(0.0, .10, 1.0-vUv.y);
          float alpha = uReady * uReveal * uAlpha * gas * edgeX * edgeY;
          gl_FragColor = vec4(source, alpha);
        }`,
    }));
    const geometry = tracker.geometry(
      new THREE.PlaneGeometry(DISPLAY_HEIGHT, DISPLAY_HEIGHT, 18, 18));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'photo-color-veil';
    mesh.position.set(layer.x, layer.y, layer.z);
    mesh.rotation.y = layer.ry;
    mesh.scale.setScalar(layer.scale);
    mesh.renderOrder = -2;
    parent.add(mesh);
    all.push(mesh);
  }
  return { meshes: all, source, ready, reveal };
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

function buildAlignedStars(parent, image, aspect, profile, budget, tracker, reveal, seed){
  const width = budget.starSample;
  const height = Math.max(24, Math.round(width / Math.max(aspect, .01)));
  const sharp = imagePixels(image, width, height, 0);
  const soft = imagePixels(image, width, height, 3.1);
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
    positions[n*3+2] = -(2 + rnd() * depth * .86);
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
  stars.renderOrder = 24;
  parent.add(stars);
  parent.userData.alignedColoredStars = selected.length;
  return stars;
}

function pointCloud(parent, count, generator, palette, softMap, tracker,
  opacity = .23, size = .72, blending = THREE.AdditiveBlending){
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++){
    const sample = generator(i) || {};
    positions[i*3] = sample.x || 0;
    positions[i*3+1] = sample.y || 0;
    positions[i*3+2] = sample.z || 0;
    const color = sample.color && sample.color.isColor
      ? sample.color
      : palette[(sample.colorIndex == null ? i : sample.colorIndex) % palette.length];
    const brightness = sample.brightness == null ? 1 : sample.brightness;
    colors[i*3] = color.r * brightness;
    colors[i*3+1] = color.g * brightness;
    colors[i*3+2] = color.b * brightness;
  }
  const geometry = tracker.geometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const material = tracker.material(new THREE.PointsMaterial({
    size,
    map: softMap,
    vertexColors: true,
    transparent: true,
    opacity,
    alphaTest: .008,
    blending,
    // Normal-blended molecular material must cover emission behind it; bright
    // gas stays additive and never writes a synthetic opaque surface.
    depthWrite: blending === THREE.NormalBlending,
    sizeAttenuation: true,
  }));
  material.userData.baseOpacity = opacity;
  const points = new THREE.Points(geometry, material);
  parent.add(points);
  return { points, material };
}

function tube(parent, points, radius, color, opacity, segments, tracker,
  blending = THREE.AdditiveBlending){
  if (!points || points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geometry = tracker.geometry(new THREE.TubeGeometry(
    curve, Math.max(8, segments), radius, 5, false));
  const material = tracker.material(new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  material.userData.baseOpacity = opacity;
  const mesh = new THREE.Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}

function torus(parent, radius, thickness, color, opacity, rotation, tracker,
  radialSegments = 9, tubularSegments = 96){
  const geometry = tracker.geometry(new THREE.TorusGeometry(
    radius, thickness, radialSegments, tubularSegments));
  const material = tracker.material(new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  material.userData.baseOpacity = opacity;
  const mesh = new THREE.Mesh(geometry, material);
  if (rotation) mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
  parent.add(mesh);
  return mesh;
}

function centralGlow(parent, position, color, scale, softMap, tracker, opacity = .8){
  const material = tracker.material(new THREE.SpriteMaterial({
    map: softMap,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  material.userData.baseOpacity = opacity;
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(scale, scale, 1);
  parent.add(sprite);
  return sprite;
}

function randomSphere(rnd){
  const y = rnd() * 2 - 1;
  const angle = rnd() * TAU;
  const radial = Math.sqrt(Math.max(0, 1 - y*y));
  return new THREE.Vector3(radial*Math.cos(angle), y, radial*Math.sin(angle));
}

function buildOpenBowl(root, profile, budget, rnd, palette, softMap, tracker){
  const structure = profile.structure || {};
  const width = numberFrom(structure, ['width', 'radius'], 30);
  const height = numberFrom(structure, ['height'], 25);
  const depth = numberFrom(structure, ['depth'], 19);
  pointCloud(root, budget.familyPoints, () => {
    const x = gaussian(rnd) * width * .48;
    const y = gaussian(rnd) * height * .50;
    const normalized = x*x/(width*width) + y*y/(height*height);
    const z = -depth * normalized + gaussian(rnd) * 2.8;
    return { x, y, z, colorIndex: Math.floor(rnd()*palette.length),
      brightness: .38 + rnd()*.72 };
  }, palette, softMap, tracker, .20, .72);
  for (let f = 0; f < budget.familyFilaments; f++){
    const points = [];
    const phase = rnd() * TAU;
    for (let i = 0; i < 26; i++){
      const t = i / 25, x = (t-.5)*width*1.65;
      points.push(new THREE.Vector3(x,
        Math.sin(t*Math.PI*1.35+phase)*height*.18 + (f-budget.familyFilaments/2)*.7,
        -depth*(x*x/(width*width)) + Math.cos(t*7+phase)*2.2));
    }
    tube(root, points, .12+rnd()*.16, palette[f%palette.length], .055,
      budget.curveSegments, tracker);
  }
  if (Number.isFinite(structure.brightBarLength)){
    const points = [];
    for (let i = 0; i < 30; i++){
      const t = i/29;
      points.push(new THREE.Vector3(
        (t-.5)*structure.brightBarLength,
        -height*.20+Math.sin(t*Math.PI*1.4)*1.4,
        1.5+Math.sin(t*8)*.7));
    }
    tube(root, points,
      numberFrom(structure, ['brightBarWidth'], 4)*.09,
      palette[2%palette.length], .12, budget.curveSegments, tracker);
  }
  const proplyds = Math.min(24, Math.round(numberFrom(structure, ['proplyds'], 0)));
  if (proplyds > 0){
    pointCloud(root, proplyds, () => ({
      x: gaussian(rnd)*width*.20,
      y: gaussian(rnd)*height*.16-2,
      z: gaussian(rnd)*4+1,
      colorIndex: 2%palette.length,
      brightness: .55+rnd()*.45,
    }), palette, softMap, tracker, .34, .48);
  }
}

function buildEdgeRidge(root, profile, budget, rnd, palette, softMap, tracker){
  const structure = profile.structure || {};
  const height = numberFrom(structure, ['height'], 58);
  const ridgeX = numberFrom(structure, ['ridgeX', 'x'], -8);
  pointCloud(root, budget.familyPoints, () => {
    const t = rnd();
    const y = (t-.5)*height;
    const edge = ridgeX + Math.sin(t*7.2)*3.4 + Math.sin(t*17.3)*1.1;
    const x = edge + Math.abs(gaussian(rnd))*6.2;
    return { x, y: y+gaussian(rnd)*1.8, z: gaussian(rnd)*7.5,
      colorIndex: rnd()>.72 ? 1 : 0, brightness: .24+rnd()*.56 };
  }, palette, softMap, tracker, .18, .70);
  for (let f = 0; f < budget.familyFilaments; f++){
    const points = [];
    const phase = f*.61 + rnd()*.35;
    for (let i = 0; i < 34; i++){
      const t = i/33;
      points.push(new THREE.Vector3(
        ridgeX + Math.sin(t*7.2+phase)*3.2 + f*.28,
        (t-.5)*height,
        Math.sin(t*10+phase)*2.6 + (f-budget.familyFilaments/2)*.38));
    }
    tube(root, points, .12+rnd()*.18, palette[(f+1)%palette.length], .075,
      budget.curveSegments, tracker, THREE.NormalBlending);
  }
  const darkPalette = [palette[3%palette.length]];
  const neckWidth = numberFrom(structure, ['neckWidth'], 12);
  const neckHeight = numberFrom(structure, ['neckHeight'], height*.54);
  const headWidth = numberFrom(structure, ['headWidth'], 24);
  const headHeight = numberFrom(structure, ['headHeight'], 18);
  pointCloud(root, Math.floor(budget.familyPoints*.22), () => {
    const head = rnd()>.58;
    return head ? {
      x: ridgeX-headWidth*.22+gaussian(rnd)*headWidth*.30,
      y: height*.25+gaussian(rnd)*headHeight*.28,
      z: 7+gaussian(rnd)*4.2,
      brightness: .85+rnd()*.15,
    } : {
      x: ridgeX+gaussian(rnd)*neckWidth*.23,
      y: -height*.10+rnd()*neckHeight,
      z: 6+gaussian(rnd)*3.2,
      brightness: .85+rnd()*.15,
    };
  }, darkPalette, softMap, tracker, .54, 1.15, THREE.NormalBlending);
  if (Number.isFinite(structure.cloudBedWidth)){
    pointCloud(root, Math.floor(budget.familyPoints*.15), () => ({
      x: (rnd()-.5)*structure.cloudBedWidth,
      y: -height*.48+gaussian(rnd)*3.2,
      z: 5+gaussian(rnd)*numberFrom(structure, ['cloudBedDepth'], 20)*.18,
      brightness: .75+rnd()*.25,
    }), darkPalette, softMap, tracker, .48, 1.25, THREE.NormalBlending);
  }
}

function buildPlanetaryRing(root, profile, budget, rnd, palette, softMap, tracker,
  double = false){
  const structure = profile.structure || {};
  const major = numberFrom(structure, ['ringRadius', 'radius'], 22);
  const minor = numberFrom(structure, ['ringThickness', 'thickness'], 5.4);
  const tilt = THREE.MathUtils.degToRad(numberFrom(structure, ['tiltDeg', 'tilt'], 24));
  const outerTilt = THREE.MathUtils.degToRad(numberFrom(structure,
    ['outerRingTiltDeg'], -THREE.MathUtils.radToDeg(tilt)*.68));
  pointCloud(root, budget.familyPoints, () => {
    const a = rnd()*TAU, b = rnd()*TAU;
    const second = double && rnd()>.52;
    const ringR = second
      ? numberFrom(structure, ['outerRingRadius'], major*.78) : major;
    const tubeR = minor * (second ? .72 : 1) * (.72+rnd()*.5);
    const p = new THREE.Vector3(
      (ringR+tubeR*Math.cos(b))*Math.cos(a),
      (ringR+tubeR*Math.cos(b))*Math.sin(a),
      tubeR*Math.sin(b));
    p.applyAxisAngle(new THREE.Vector3(1,0,0), second ? outerTilt : tilt);
    if (second) p.applyAxisAngle(new THREE.Vector3(0,1,0), .45);
    return { ...p, colorIndex: Math.floor(rnd()*palette.length),
      brightness: .34+rnd()*.76 };
  }, palette, softMap, tracker, .27, .68);
  torus(root, major, .34, palette[0], .12, { x: tilt }, tracker);
  torus(root, major*.92, .20, palette[1%palette.length], .095,
    { x: tilt+.08, z: -.05 }, tracker);
  if (double){
    torus(root, numberFrom(structure, ['outerRingRadius'], major*.78), .28,
      palette[2%palette.length], .105,
      { x: outerTilt, y: .45 }, tracker);
  }
  if (!double && Number.isFinite(structure.footballLobeLength)){
    const lobeLength = structure.footballLobeLength;
    const lobeRadius = numberFrom(structure, ['footballLobeRadius'], major*.62);
    pointCloud(root, Math.floor(budget.familyPoints*.22), () => {
      const direction = randomSphere(rnd);
      const shell = .76+Math.pow(rnd(),2)*.28;
      return {
        x: direction.x*lobeRadius*shell,
        y: direction.y*lobeRadius*shell,
        z: direction.z*lobeLength*.5*shell,
        colorIndex: 2%palette.length,
        brightness: .18+rnd()*.42,
      };
    }, palette, softMap, tracker, .12, .55);
  }
  if (double && structure.knotTailDirection === 'radial-away-from-center'){
    for (let f = 0; f < budget.familyFilaments; f++){
      const angle = rnd()*TAU;
      const start = major*(.80+rnd()*.36);
      const length = 2.5+rnd()*5.2;
      const points = [
        new THREE.Vector3(Math.cos(angle)*start, Math.sin(angle)*start, gaussian(rnd)*2),
        new THREE.Vector3(Math.cos(angle)*(start+length*.45),
          Math.sin(angle)*(start+length*.45), gaussian(rnd)*2.5),
        new THREE.Vector3(Math.cos(angle)*(start+length),
          Math.sin(angle)*(start+length), gaussian(rnd)*3),
      ];
      tube(root, points, .08+rnd()*.08, palette[2%palette.length], .075,
        budget.curveSegments, tracker);
    }
  }
  if (!Array.isArray(profile.sources) || !profile.sources.length)
    centralGlow(root, vectorFrom(structure.center), palette[palette.length-1],
      numberFrom(structure, ['centralStarScale'], 4.2), softMap, tracker, .86);
}

function buildStarCavity(root, profile, budget, rnd, palette, softMap, tracker,
  bubble = false){
  const structure = profile.structure || {};
  const radius = numberFrom(structure, ['cavityRadius', 'radius'], bubble ? 25 : 20);
  const asymmetry = numberFrom(structure, ['cloudAsymmetry'], bubble ? .18 : .10);
  const stretch = vectorFrom(structure.stretch,
    bubble ? [1+asymmetry, 1-asymmetry*.55, .72] : [1.3,.78,.68]);
  const sheetTilt = THREE.MathUtils.degToRad(
    numberFrom(structure, ['molecularRingTiltDeg'], 24));
  const sheetThickness = numberFrom(structure, ['molecularSheetThickness'], 5);
  pointCloud(root, budget.familyPoints, () => {
    let p;
    if (bubble && Number.isFinite(structure.centralHoleRadius)){
      // Rosette is a wind-cleared hole in a clumpy molecular sheet, not a
      // complete sphere. Keep the central cavity empty in the off-axis model.
      const inner = structure.centralHoleRadius;
      const outer = Math.max(inner+1, radius*(1+asymmetry*.22));
      const radial = Math.sqrt(inner*inner+rnd()*(outer*outer-inner*inner));
      const angle = rnd()*TAU;
      p = new THREE.Vector3(Math.cos(angle)*radial, Math.sin(angle)*radial,
        gaussian(rnd)*sheetThickness*.34);
      p.applyAxisAngle(new THREE.Vector3(1,0,0), sheetTilt);
    } else {
      const direction = randomSphere(rnd);
      const shell = radius * (.86 + Math.pow(rnd(), 2)*.34);
      p = direction.multiplyScalar(shell);
      p.set(p.x*stretch.x, p.y*stretch.y, p.z*stretch.z);
    }
    return { ...p, colorIndex: Math.floor(rnd()*palette.length),
      brightness: .28+rnd()*.72 };
  }, palette, softMap, tracker, bubble ? .21 : .18, .70);
  const cluster = Math.round(numberFrom(structure, ['centralStars', 'clusterStars'],
    bubble ? 9 : 5));
  for (let i = 0; i < cluster; i++){
    centralGlow(root,
      new THREE.Vector3(gaussian(rnd)*4.2, gaussian(rnd)*3.2, gaussian(rnd)*3),
      palette[(i+1)%palette.length], 1.8+rnd()*2.4, softMap, tracker, .52+rnd()*.25);
  }
  for (let f = 0; f < Math.max(3, Math.floor(budget.familyFilaments*.65)); f++){
    const points = [];
    const phase = rnd()*TAU;
    for (let i = 0; i < 30; i++){
      const t = i/29, a = phase + t*1.1;
      if (bubble && Number.isFinite(structure.centralHoleRadius)){
        const radial = radius*(.90+t*.14);
        const point = new THREE.Vector3(
          Math.cos(a)*radial,
          Math.sin(a)*radial,
          Math.sin(t*TAU+phase)*sheetThickness*.18);
        point.applyAxisAngle(new THREE.Vector3(1,0,0), sheetTilt);
        points.push(point);
      } else {
        points.push(new THREE.Vector3(
          Math.cos(a)*radius*(.9+t*.17)*stretch.x,
          (t-.5)*radius*1.4*stretch.y,
          Math.sin(a)*radius*(.9+t*.17)*stretch.z));
      }
    }
    tube(root, points, .11+rnd()*.16, palette[f%palette.length], .058,
      budget.curveSegments, tracker);
  }
  if (bubble && Number.isFinite(structure.molecularRingRadius)){
    torus(root, structure.molecularRingRadius,
      numberFrom(structure, ['molecularRingThickness'], 4)*.16,
      palette[1%palette.length], .095, { x: sheetTilt, z: -.08 }, tracker, 8, 112);
    const trunks = Math.min(budget.familyFilaments,
      Math.round(numberFrom(structure, ['elephantTrunks'], 0)));
    for (let f = 0; f < trunks; f++){
      const angle = rnd()*TAU;
      const outer = structure.molecularRingRadius*(.88+rnd()*.16);
      const inner = outer-(2.5+rnd()*5.5);
      const points = [
        new THREE.Vector3(Math.cos(angle)*outer, Math.sin(angle)*outer, 0),
        new THREE.Vector3(Math.cos(angle)*(outer+inner)*.5,
          Math.sin(angle)*(outer+inner)*.5, gaussian(rnd)*.9),
        new THREE.Vector3(Math.cos(angle)*inner, Math.sin(angle)*inner,
          gaussian(rnd)*1.2),
      ];
      for (const point of points)
        point.applyAxisAngle(new THREE.Vector3(1,0,0), sheetTilt);
      tube(root, points, .14+rnd()*.12, palette[3%palette.length], .14,
        budget.curveSegments, tracker, THREE.NormalBlending);
    }
  }
  if (!bubble && Number.isFinite(structure.dustLaneLength)){
    const darkPalette = [palette[3%palette.length]];
    const laneLength = Math.min(structure.dustLaneLength, DISPLAY_HEIGHT*1.55);
    const laneWidth = numberFrom(structure, ['dustLaneWidth'], 12);
    pointCloud(root, Math.floor(budget.familyPoints*.20), () => ({
      x: (rnd()-.5)*laneLength,
      y: -4+gaussian(rnd)*laneWidth*.25,
      z: 7+gaussian(rnd)*2.4,
      brightness: .78+rnd()*.22,
    }), darkPalette, softMap, tracker,
    numberFrom(structure, ['dustLaneOpacity'], .75)*.60, 1.15,
    THREE.NormalBlending);
  }
  if (!bubble && Number.isFinite(structure.hourglassLobeHeight)){
    const center = Array.isArray(profile.sources) && profile.sources.length
      ? vectorFrom(profile.sources[0].position) : new THREE.Vector3(7,-5,1);
    const lobeHeight = structure.hourglassLobeHeight;
    const lobeWidth = numberFrom(structure, ['hourglassLobeWidth'], 10);
    for (const side of [-1, 1]){
      const points = [];
      for (let i = 0; i < 24; i++){
        const t = i/23;
        points.push(new THREE.Vector3(
          center.x+side*Math.sin(t*Math.PI)*lobeWidth*.34,
          center.y+side*t*lobeHeight,
          center.z+Math.sin(t*TAU)*1.5));
      }
      tube(root, points, .18, palette[2%palette.length], .095,
        budget.curveSegments, tracker);
    }
  }
}

function buildNestedShell(root, profile, budget, rnd, palette, softMap, tracker){
  const structure = profile.structure || {};
  const radius = numberFrom(structure, ['radius', 'shellRadius'], 21);
  const shellCount = Math.max(3, Math.round(numberFrom(structure, ['shellCount', 'shells'], 5)));
  const axialRatio = numberFrom(structure, ['axialRatio'], 1.0);
  const stretch = vectorFrom(structure.stretch, [1.0, axialRatio, .68]);
  pointCloud(root, budget.familyPoints, i => {
    const shellIndex = i % shellCount;
    const direction = randomSphere(rnd);
    const shell = radius * (.48 + shellIndex/(shellCount-1)*.62) * (.95+rnd()*.10);
    const p = direction.multiplyScalar(shell);
    p.set(p.x*stretch.x, p.y*stretch.y, p.z*stretch.z);
    return { ...p, colorIndex: shellIndex%palette.length,
      brightness: .25+rnd()*.70 };
  }, palette, softMap, tracker, .25, .62);
  // The pulse history is carried by nested 3D point shells above, never a
  // stack of flat circles that would misstate the Cat's Eye geometry.
  const equatorialRadius = numberFrom(structure, ['equatorialRadius'], radius*.62);
  torus(root, equatorialRadius,
    numberFrom(structure, ['equatorialThickness'], .7)*.22,
    palette[2%palette.length], .085, { x: .30 }, tracker, 7, 92);
  if (Number.isFinite(structure.partialRingRadius)){
    const arc = THREE.MathUtils.degToRad(
      numberFrom(structure, ['partialRingArcDeg'], 280));
    const tilt = THREE.MathUtils.degToRad(
      numberFrom(structure, ['partialRingTiltDeg'], 15));
    for (const side of [-1, 1]){
      const points = [];
      for (let i = 0; i < 42; i++){
        const t = i/41;
        const angle = -arc/2+t*arc+(side < 0 ? Math.PI : 0);
        const p = new THREE.Vector3(
          Math.cos(angle)*structure.partialRingRadius,
          Math.sin(angle)*structure.partialRingRadius, 0);
        p.applyAxisAngle(new THREE.Vector3(1,0,0), tilt*side);
        points.push(p);
      }
      tube(root, points,
        numberFrom(structure, ['partialRingThickness'], .42)*.34,
        palette[1%palette.length], .10, budget.curveSegments, tracker);
    }
  }
  if (!Array.isArray(profile.sources) || !profile.sources.length)
    centralGlow(root, vectorFrom(structure.center), palette[palette.length-1],
      numberFrom(structure, ['centralStarScale'], 3.8), softMap, tracker, .82);
  const axis = numberFrom(structure, ['jetLength', 'axisLength'], radius*1.65);
  const jetAngle = THREE.MathUtils.degToRad(numberFrom(structure, ['jetOffsetDeg'], 0));
  const jetDirection = new THREE.Vector3(Math.sin(jetAngle), Math.cos(jetAngle), 0);
  tube(root, [jetDirection.clone().multiplyScalar(-axis), new THREE.Vector3(),
    jetDirection.clone().multiplyScalar(axis)], .14, palette[1%palette.length], .09,
  budget.curveSegments, tracker);
}

function buildShockSheet(root, profile, budget, rnd, palette, softMap, tracker){
  const structure = profile.structure || {};
  const sheetDepth = numberFrom(structure, ['sheetDepth'], 12);
  const width = DISPLAY_HEIGHT*1.48;
  const height = DISPLAY_HEIGHT*.78;
  const shellThickness = numberFrom(structure, ['shellThickness'], .75);
  const corrugation = numberFrom(structure, ['corrugationAmplitude'], 3.2);
  const corrugationFrequency = numberFrom(structure, ['corrugationFrequency'], 8);
  const patchCoverage = numberFrom(structure, ['patchCoverage'], .60);
  pointCloud(root, budget.familyPoints, () => {
    // The Hubble Veil plate is a local, nearly edge-on shock sheet—not the
    // entire Cygnus Loop. Three close layers separate leading and trailing gas.
    const x = (rnd()-.5)*width;
    const y = (rnd()-.5)*height;
    const wave = Math.sin(x*.12*corrugationFrequency+y*.07)*.62+
      Math.sin(y*.18+x*.035)*.38;
    const patch = rnd() < patchCoverage ? .60+.40*Math.abs(wave) : .025;
    const layer = Math.floor(rnd()*3);
    const z = wave*corrugation*.44+(layer-1)*sheetDepth*.10+
      gaussian(rnd)*shellThickness*.30;
    return { x, y, z, colorIndex: layer%Math.min(3,palette.length),
      brightness: (.12+rnd()*.68)*patch };
  }, palette, softMap, tracker, .24, .58);
  for (let f = 0; f < budget.familyFilaments; f++){
    const points = [];
    const y0 = THREE.MathUtils.lerp(-height*.44,height*.44,rnd());
    const phase = rnd()*TAU;
    const layer = f%3;
    for (let i = 0; i < 42; i++){
      const t = i/41;
      const x = (t-.5)*width;
      const y = y0+Math.sin(t*TAU*1.25+phase)*2.5+Math.sin(t*17+f)*.7;
      const wave = Math.sin(x*.12*corrugationFrequency+y*.07)*.62+
        Math.sin(y*.18+x*.035)*.38;
      points.push(new THREE.Vector3(
        x, y, wave*corrugation*.44+(layer-1)*sheetDepth*.10));
    }
    tube(root, points, .08+rnd()*.11, palette[layer%palette.length], .10,
      budget.curveSegments, tracker);
  }
}

function buildTrilobe(root, profile, budget, rnd, palette, softMap, tracker){
  const structure = profile.structure || {};
  const radius = numberFrom(structure, ['radius', 'lobeRadius'], 17);
  const emissionCenter = vectorFrom(structure.emissionCenter);
  pointCloud(root, budget.familyPoints, i => {
    const lobe = i%3;
    const angle = lobe*TAU/3 + numberFrom(structure, ['rotation'], -.12);
    const centerRadius = radius*.72;
    const center = new THREE.Vector3(
      Math.cos(angle)*centerRadius, Math.sin(angle)*centerRadius, 0);
    const p = new THREE.Vector3(
      gaussian(rnd)*radius*.62,
      gaussian(rnd)*radius*.48,
      gaussian(rnd)*radius*.34);
    p.applyAxisAngle(new THREE.Vector3(0,0,1), angle);
    p.add(center).add(emissionCenter);
    return { ...p, colorIndex: lobe%palette.length, brightness: .30+rnd()*.68 };
  }, palette, softMap, tracker, .22, .70);
  const laneCount = Math.max(3, Math.round(numberFrom(structure, ['laneCount'], 3)));
  for (let lane = 0; lane < laneCount; lane++){
    const angle = lane*TAU/laneCount + numberFrom(structure, ['rotation'], -.12) + Math.PI/3;
    const points = [];
    for (let i = 0; i < 22; i++){
      const t = i/21;
      points.push(new THREE.Vector3(
        Math.cos(angle)*radius*1.55*t,
        Math.sin(angle)*radius*1.55*t,
        Math.sin(t*Math.PI)*2.4));
    }
    const laneWidth = THREE.MathUtils.lerp(
      numberFrom(structure, ['laneWidthMin'], 2.4),
      numberFrom(structure, ['laneWidthMax'], 4.8), rnd());
    for (const point of points) point.add(emissionCenter);
    tube(root, points, laneWidth*.075, palette[3%palette.length], .11,
      budget.curveSegments, tracker, THREE.NormalBlending);
    const laneDepth = numberFrom(structure, ['laneDepth'], 7);
    const darkPalette = [palette[3%palette.length]];
    pointCloud(root, Math.floor(budget.familyPoints*.06), () => {
      const t = rnd();
      const lateral = gaussian(rnd)*laneWidth*.28;
      return {
        x: emissionCenter.x+Math.cos(angle)*radius*1.55*t-Math.sin(angle)*lateral,
        y: emissionCenter.y+Math.sin(angle)*radius*1.55*t+Math.cos(angle)*lateral,
        z: emissionCenter.z+4+rnd()*laneDepth,
        brightness: .76+rnd()*.24,
      };
    }, darkPalette, softMap, tracker, .46, 1.05, THREE.NormalBlending);
  }
  if (Number.isFinite(structure.reflectionRadius)){
    const reflectionCenter = new THREE.Vector3(
      numberFrom(structure, ['reflectionOffsetX'], -8),
      numberFrom(structure, ['reflectionOffsetY'], 15), -3);
    pointCloud(root, Math.floor(budget.familyPoints*.18), () => ({
      x: reflectionCenter.x+gaussian(rnd)*structure.reflectionRadius*.42,
      y: reflectionCenter.y+gaussian(rnd)*structure.reflectionRadius*.34,
      z: reflectionCenter.z+gaussian(rnd)*structure.reflectionRadius*.22,
      colorIndex: 1%palette.length,
      brightness: .24+rnd()*.55,
    }), palette, softMap, tracker, .12, .68);
  }
  if (!Array.isArray(profile.sources) || !profile.sources.length)
    centralGlow(root, vectorFrom(structure.center), palette[palette.length-1],
      numberFrom(structure, ['centralStarScale'], 3.4), softMap, tracker, .78);
}

function buildFamilyLayer(parent, profile, budget, tracker, softMap, seed){
  const root = new THREE.Group();
  root.name = `scientific-morphology:${profile.family}`;
  parent.add(root);
  const rnd = mulberry(hashStr(seed));
  const palette = paletteFrom(profile);
  switch (profile.family){
    case 'open-bowl':
      buildOpenBowl(root, profile, budget, rnd, palette, softMap, tracker); break;
    case 'edge-ridge':
      buildEdgeRidge(root, profile, budget, rnd, palette, softMap, tracker); break;
    case 'planetary-ring':
      buildPlanetaryRing(root, profile, budget, rnd, palette, softMap, tracker, false); break;
    case 'double-ring':
      buildPlanetaryRing(root, profile, budget, rnd, palette, softMap, tracker, true); break;
    case 'star-cavity':
      buildStarCavity(root, profile, budget, rnd, palette, softMap, tracker, false); break;
    case 'nested-shell':
      buildNestedShell(root, profile, budget, rnd, palette, softMap, tracker); break;
    case 'shock-sheet':
      buildShockSheet(root, profile, budget, rnd, palette, softMap, tracker); break;
    case 'wind-bubble':
      buildStarCavity(root, profile, budget, rnd, palette, softMap, tracker, true); break;
    case 'trilobe':
      buildTrilobe(root, profile, budget, rnd, palette, softMap, tracker); break;
    default:
      buildOpenBowl(root, profile, budget, rnd, palette, softMap, tracker); break;
  }
  for (const [index, source] of (Array.isArray(profile.sources) ? profile.sources : []).entries()){
    if (!source) continue;
    const marker = centralGlow(root, vectorFrom(source.position),
      colorFrom(source.color, palette[(index+1)%palette.length]),
      numberFrom(source, ['size', 'scale'], 3.8), softMap, tracker,
      numberFrom(source, ['opacity'], .84));
    marker.name = 'authored-ionizing-source';
    marker.userData.sourceLabel = source.label || null;
    marker.userData.scientificSource = true;
  }
  root.userData.family = profile.family;
  root.userData.interpretive = true;
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

/* Compose one catalog photograph, the generic depth volume and a recipe-driven
   scientific morphology layer. The returned object already matches the
   featured-exhibit delegate contract consumed by registry.js. */
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

  const volumeOptions = { ...(profile.volume || {}) };
  if (volumeOptions.depth == null && Number.isFinite(volumeOptions.depthWorld))
    volumeOptions.depth = volumeOptions.depthWorld;
  const authoredTune = volumeOptions.tune || {};
  volumeOptions.tune = {
    ...authoredTune,
    ...(Array.isArray(volumeOptions.light) ? { light: volumeOptions.light } : {}),
    ...(Number.isFinite(volumeOptions.shade) ? { shade: volumeOptions.shade } : {}),
    ...(Number.isFinite(volumeOptions.depthScale)
      ? { depthScale: volumeOptions.depthScale } : {}),
    ...(Number.isFinite(volumeOptions.density) ? { density: volumeOptions.density } : {}),
  };
  volumeOptions.qualityTier = tier;
  volumeOptions.profile = profile;
  // The shared wrapper owns the single photo-aligned colored-star layer. The
  // base volume keeps the stars out of its color plate but does not re-add a
  // duplicate point set.
  volumeOptions.stars = false;
  const base = buildImageVolume(entry, image.file, volumeOptions);
  group.add(base.group);
  const spatialContent = base.content || base.group;

  const fallback = tracker.texture(solidTexture(0x11111b));
  const softMap = tracker.texture(softDiscTexture());
  const projector = buildProjector(group, fallback, tracker);
  const veils = buildVeils(group, fallback, tracker, budget.veilLayers);
  for (const mesh of veils.meshes) mesh.visible = false;
  const starReveal = { value: 0 };
  const family = buildFamilyLayer(group, profile, budget, tracker, softMap,
    `nebula-family:${entry.id}`);
  setFamilyReveal(family, 0);
  family.visible = false;

  function setBaseReveal(value){
    if (typeof base.setSpatialReveal === 'function') base.setSpatialReveal(value);
    // Keep the shader contract explicit as well as calling the base hook. This
    // lets the wrapper work throughout the small base-engine refactor and makes
    // the exact head-on state independent of point-layer bookkeeping there.
    if (base.uniforms && base.uniforms.uPresentation)
      base.uniforms.uPresentation.value = value;
    spatialContent.visible = value > .002;
  }
  setBaseReveal(0);

  loadTexture(image.file, texture => {
    if (disposed) return;
    projector.uniforms.uSource.value = texture;
    projector.uniforms.uReady.value = 1;
    veils.source.value = texture;
    veils.ready.value = 1;
    const source = texture.image;
    const width = source && source.width ? source.width : 1;
    const height = source && source.height ? source.height : 1;
    const aspect = width / Math.max(height, 1);
    projector.mesh.scale.x = aspect;
    for (const mesh of veils.meshes) mesh.scale.x *= aspect;
    if (source){
      alignedStars = buildAlignedStars(group, source, aspect, profile, budget, tracker,
        starReveal, `nebula-stars:${entry.id}`);
      if (alignedStars) alignedStars.visible = reveal > .002;
    }
    group.userData.observationReady = true;
    group.userData.observationAspect = aspect;
  });

  group.userData.renderer = 'nebula-photo-hybrid-v1';
  group.userData.family = profile.family;
  group.userData.qualityTier = tier;
  group.userData.qualityBudget = { ...budget };
  group.userData.source = profile.source || null;
  group.userData.sources = profile.sources || null;
  group.userData.scientificCaveat = profile.caveat ||
    'Depth and off-axis structure are an interpretive visualization, not tomography.';
  group.userData.observationPolicy =
    'Exact source RGB projector head-on; inferred spatial reconstruction appears only off-axis.';

  const cameraConfig = profile.camera || {};
  const localCamera = new THREE.Vector3();
  return {
    group,
    content: spatialContent,
    uniforms: base.uniforms,
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
        const observationTarget = smoothstep(.43, .965, front);
        const revealTarget = 1 - observationTarget;
        reveal = damp(reveal, revealTarget, 4.2, dt);
        projectorOpacity = damp(projectorOpacity, observationTarget, 5.6, dt);
        projector.uniforms.uOpacity.value = projectorOpacity;
        projector.mesh.visible = projectorOpacity > .002;
        // Curtains exist only across the useful front/oblique hemisphere; the
        // far side remains a spatial reconstruction rather than a mirrored photo.
        const veilReveal = reveal * smoothstep(-.12, .74, front);
        veils.reveal.value = veilReveal;
        for (const mesh of veils.meshes) mesh.visible = veilReveal > .002;
        starReveal.value = reveal;
        if (alignedStars) alignedStars.visible = reveal > .002;
        setBaseReveal(reveal);
        family.visible = reveal > .002;
        setFamilyReveal(family, reveal * (.62 + reveal*.38));
      }
      family.rotation.y = Math.sin(time*.045) * .022;
      family.rotation.x = Math.sin(time*.031+.8) * .009;
      if (typeof base.update === 'function') base.update(dt, camera);
      group.userData.spatialReveal = reveal;
      group.userData.projectorOpacity = projectorOpacity;
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      if (typeof base.dispose === 'function') base.dispose();
      tracker.dispose();
      group.userData.disposed = true;
    },
  };
}
