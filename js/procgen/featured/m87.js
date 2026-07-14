/* M87*: an observation-led exhibit.
   Hubble, ALMA/VLBA/EHT, total-intensity and polarimetric products remain
   unlit source-colour planes.  Three-dimensional geometry is reserved for the
   2017 Earth-sized array, where it explains how the observation was made.
   The 2018 scientific FITS map is decoded locally so its WCS orientation and
   angular scale survive the browser presentation. */

import * as THREE from 'three';
import { mulberry, hashStr } from '../../utils/rng.js';
import { TEX_TIER } from '../../core/quality.js';
import { ResourceScope } from './resourceScope.js';

const ASSETS = Object.freeze({
  hubbleJet: 'images/m87/hubble-jet-2024.jpg',
  multiscale: 'images/m87/multiscale-2021.jpg',
  eht2017: 'images/m87/eht-2017.jpg',
  polarized: 'images/m87/eht-polarized-2021.jpg',
  eht2018Fits: 'images/m87/eht-2018.fits',
  // The array globe is at most a few hundred screen pixels across; the 2K
  // map is visually complete here and avoids an unnecessary 8K VRAM spike.
  earth: 'textures/2k_earth_daymap.jpg',
});

export const M87_STATES = Object.freeze({
  JET: 'm87-jet-observed',
  DARK_ENGINE: 'm87-core-multiscale',
  ARRAY: 'eht-array-2017',
  SHADOW: 'eht-total-intensity-2017',
  FIELDS: 'eht-polarization-2017',
  PERSISTS: 'eht-compare-2017-2018',
});

const BUDGET = Object.freeze(TEX_TIER === 'low' ? {
  decorativeStars: 850,
  alignedStars: 220,
  starSampleLongSide: 210,
  earthSegments: 32,
  baselineSegments: 32,
  baselineRadialSegments: 4,
} : {
  decorativeStars: 2600,
  alignedStars: 620,
  starSampleLongSide: 360,
  earthSegments: 64,
  baselineSegments: 64,
  baselineRadialSegments: 7,
});

const PHOTO = Object.freeze({
  hubbleAspect: 2355 / 1885,
  multiscaleAspect: 3000 / 4096,
  eht2017Aspect: 4096 / 2386,
  polarizedAspect: 3414 / 3447,
});

const WORLD_PER_MICROARCSECOND = .5;
const EHT_RING_DIAMETER_UAS = 42;
const EHT_2017_RING_DIAMETER_PIXELS = 440;
const EHT_COMPARE_WIDTH_UAS = 150;
const EHT_COMPARE_HEIGHT_UAS = 93;

/* Coordinates are from Table 2 of EHT Collaboration 2019, ApJL 875 L2.
   Co-located instruments retain their independent coordinates and are drawn
   as a dot + concentric ring rather than being displaced for legibility. */
export const EHT_2017_STATIONS = Object.freeze([
  Object.freeze({ id: 'ALMA', cluster: 'ATACAMA', lat: -23.0291944, lon: -67.7547500, altitudeM: 5074.1 }),
  Object.freeze({ id: 'APEX', cluster: 'ATACAMA', lat: -23.0057778, lon: -67.7591389, altitudeM: 5104.5 }),
  Object.freeze({ id: 'JCMT', cluster: 'HAWAII', lat: 19.8228333, lon: -155.4770278, altitudeM: 4120.1 }),
  Object.freeze({ id: 'SMA', cluster: 'HAWAII', lat: 19.8242222, lon: -155.4775278, altitudeM: 4115.1 }),
  Object.freeze({ id: 'LMT', cluster: 'MEXICO', lat: 18.9857778, lon: -97.3147778, altitudeM: 4593.3 }),
  Object.freeze({ id: 'PV', cluster: 'SPAIN', lat: 37.0661389, lon: -3.3926111, altitudeM: 2919.5 }),
  Object.freeze({ id: 'SMT', cluster: 'ARIZONA', lat: 32.7016111, lon: -109.8912500, altitudeM: 3158.7 }),
  Object.freeze({ id: 'SPT', cluster: 'SOUTH POLE', lat: -89.9896944, lon: -45.2500833, altitudeM: 2816.5 }),
]);

const CLUSTER_ORDER = Object.freeze([
  'ATACAMA', 'HAWAII', 'MEXICO', 'SPAIN', 'ARIZONA', 'SOUTH POLE',
]);

const CLUSTER_LABELS = Object.freeze({
  ATACAMA: 'ALMA + APEX',
  HAWAII: 'JCMT + SMA',
  MEXICO: 'LMT',
  SPAIN: 'IRAM 30 m',
  ARIZONA: 'SMT',
  'SOUTH POLE': 'SPT',
});

const CLUSTER_COLORS = Object.freeze({
  ATACAMA: 0x66e4ff,
  HAWAII: 0xffc06b,
  MEXICO: 0xff7f66,
  SPAIN: 0xa6e889,
  ARIZONA: 0xbda0ff,
  'SOUTH POLE': 0x8ebdff,
});

const EVIDENCE_CREDIT = [
  'M87 jet: NASA, ESA, A. Lessing, E. Baltz, M. Shara, J. DePasquale',
  'multiscale/polarization: EHT Collaboration et al.',
  '2018 representative map: EHT Collaboration, A&A 681 A79 · CC BY 4.0',
].join(' · ');

function clamp01(value){ return Math.max(0, Math.min(1, value)); }

function stateFromVisual(visual){
  const raw = typeof visual === 'string'
    ? visual
    : visual && (visual.state || visual.moment || visual.id);
  if (raw && Object.values(M87_STATES).includes(raw)) return raw;
  const value = String(raw || '').toLowerCase();
  if (/dark|engine|core|multiscale|1978/.test(value)) return M87_STATES.DARK_ENGINE;
  if (/jet|1918/.test(value)) return M87_STATES.JET;
  if (/array|vlbi|earth.*telescope/.test(value)) return M87_STATES.ARRAY;
  if (/field|polariz|magnetic/.test(value)) return M87_STATES.FIELDS;
  if (/persist|compare|2017-2018|2018/.test(value)) return M87_STATES.PERSISTS;
  if (/shadow|total-intensity|2019/.test(value)) return M87_STATES.SHADOW;
  return M87_STATES.SHADOW;
}

function solidTexture(color){
  const value = Number(color) >>> 0;
  const data = new Uint8Array([
    (value >>> 16) & 255, (value >>> 8) & 255, value & 255, 255,
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function softDiscTexture(){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,.98)');
  gradient.addColorStop(.18, 'rgba(255,255,255,.78)');
  gradient.addColorStop(.55, 'rgba(255,255,255,.14)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCaption(scope, title, subtitle, width = 72, accent = '#ff9c4a'){
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 184;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(5,8,15,.90)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 12, canvas.height);
  ctx.fillStyle = '#f7f3ee';
  ctx.font = '600 38px system-ui, sans-serif';
  ctx.fillText(title, 42, 70);
  ctx.fillStyle = '#aab6c8';
  ctx.font = '25px system-ui, sans-serif';
  ctx.fillText(subtitle, 42, 126);
  const texture = scope.own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * canvas.height / canvas.width),
    material,
  );
  mesh.renderOrder = 40;
  return mesh;
}

function makeStationLabel(scope, text, color){
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(3,8,15,.86)';
  ctx.beginPath();
  ctx.roundRect(2, 2, 636, 140, 34);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#f6fbff';
  ctx.font = '600 49px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 320, 73);
  const texture = scope.own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(12.6, 2.84, 1);
  return sprite;
}

/* These plates never approach 2K screen pixels in this exhibit.  Capping both
   tiers avoids retaining several 4K decoded sources and their mip chains while
   preserving more sampling detail than the display can resolve. */
function imageTextureSource(image){
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const longest = Math.max(naturalWidth, naturalHeight);
  if (longest <= 2048) return image;
  const scale = 2048 / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/* One cancellable image decode per URL.  Textures are local to this exhibit,
   so late callbacks cannot mutate a scene that has already been detached. */
function createImageBank(scope, onError){
  const entries = new Map();
  scope.defer(() => {
    for (const entry of entries.values()){
      entry.callbacks.clear();
      entry.image.onload = null;
      entry.image.onerror = null;
      if (!entry.texture) entry.image.removeAttribute('src');
    }
    entries.clear();
  });

  return {
    request(url, callback){
      let entry = entries.get(url);
      if (!entry){
        const image = new Image();
        entry = { image, source: null, texture: null, callbacks: new Set(), failed: false };
        entries.set(url, entry);
        image.decoding = 'async';
        image.onload = () => {
          if (scope.disposed) return;
          const source = imageTextureSource(image);
          const texture = new THREE.Texture(source);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = TEX_TIER === 'low' ? 4 : 8;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          texture.userData.m87Source = url;
          texture.userData.downsampledForDisplay = source !== image;
          entry.source = source;
          entry.texture = scope.own(texture);
          for (const ready of [...entry.callbacks]) ready(texture, source);
          entry.callbacks.clear();
          if (source !== image){
            image.onload = null;
            image.onerror = null;
            image.removeAttribute('src');
          }
        };
        image.onerror = error => {
          if (scope.disposed) return;
          entry.failed = true;
          entry.callbacks.clear();
          onError(url, error);
        };
        image.src = url;
      }
      if (entry.texture) callback(entry.texture, entry.source);
      else if (!entry.failed) entry.callbacks.add(callback);
    },
  };
}

function makeSourceAmbience(scope, parent, image, width, height, opacity = .24){
  const canvas = document.createElement('canvas');
  const aspect = width / height;
  canvas.width = 128;
  canvas.height = Math.max(48, Math.round(128 / aspect));
  const ctx = canvas.getContext('2d');
  ctx.filter = 'blur(10px) saturate(1.12)';
  ctx.drawImage(image, -12, -12, canvas.width + 24, canvas.height + 24);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'destination-in';
  const radius = Math.max(canvas.width, canvas.height) * .64;
  const fade = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, radius * .34,
    canvas.width / 2, canvas.height / 2, radius,
  );
  fade.addColorStop(0, 'rgba(255,255,255,.92)');
  fade.addColorStop(.72, 'rgba(255,255,255,.46)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = scope.own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const ambience = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.36, height * 1.36),
    material,
  );
  ambience.position.z = -3;
  ambience.renderOrder = -4;
  ambience.name = 'source-derived-low-frequency-ambience';
  ambience.userData.scientificRole =
    'Blurred source palette only; no observational detail is extended beyond the plate.';
  parent.add(ambience);
  return ambience;
}

function pixelLuma(pixels, offset){
  return (.2126 * pixels[offset] + .7152 * pixels[offset + 1]
    + .0722 * pixels[offset + 2]) / 255;
}

function sampledFluxColor(sharp, soft, x, y, width, height){
  let red = 0, green = 0, blue = 0, weightSum = 0;
  for (let oy = -1; oy <= 1; oy++){
    const py = Math.max(0, Math.min(height - 1, y + oy));
    for (let ox = -1; ox <= 1; ox++){
      const px = Math.max(0, Math.min(width - 1, x + ox));
      const offset = (py * width + px) * 4;
      const weight = Math.max(0, pixelLuma(sharp, offset) - pixelLuma(soft, offset));
      if (weight <= 0) continue;
      red += Math.max(0, sharp[offset] - soft[offset]) * weight;
      green += Math.max(0, sharp[offset + 1] - soft[offset + 1]) * weight;
      blue += Math.max(0, sharp[offset + 2] - soft[offset + 2]) * weight;
      weightSum += weight;
    }
  }
  const center = (y * width + x) * 4;
  if (weightSum < .0001){
    red = sharp[center]; green = sharp[center + 1]; blue = sharp[center + 2];
  } else {
    red /= weightSum; green /= weightSum; blue /= weightSum;
  }
  const maximum = Math.max(red, green, blue, 1);
  const exposure = .78 + pixelLuma(sharp, center) * .22;
  const color = new THREE.Color(
    clamp01(red / maximum * exposure),
    clamp01(green / maximum * exposure),
    clamp01(blue / maximum * exposure),
  );
  return color.convertSRGBToLinear();
}

/* Extracted point features never leave the source plate.  Pixel-centre UVs
   and the photograph use the same parent transform, crop and aspect ratio. */
function addPhotoAlignedStars(parent, image, plateWidth, plateHeight, softMap){
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = BUDGET.starSampleLongSide / Math.max(naturalWidth, naturalHeight);
  const width = Math.max(32, Math.round(naturalWidth * scale));
  const height = Math.max(32, Math.round(naturalHeight * scale));
  const sharpCanvas = document.createElement('canvas');
  const softCanvas = document.createElement('canvas');
  sharpCanvas.width = softCanvas.width = width;
  sharpCanvas.height = softCanvas.height = height;
  const sharpCtx = sharpCanvas.getContext('2d', { willReadFrequently: true });
  const softCtx = softCanvas.getContext('2d', { willReadFrequently: true });
  sharpCtx.drawImage(image, 0, 0, width, height);
  softCtx.filter = 'blur(3px)';
  softCtx.drawImage(image, 0, 0, width, height);
  const sharp = sharpCtx.getImageData(0, 0, width, height).data;
  const soft = softCtx.getImageData(0, 0, width, height).data;
  const detail = new Float32Array(width * height);
  for (let i = 0; i < detail.length; i++){
    const offset = i * 4;
    detail[i] = pixelLuma(sharp, offset) - pixelLuma(soft, offset);
  }

  const candidates = [];
  for (let y = 2; y < height - 2; y++){
    for (let x = 2; x < width - 2; x++){
      const index = y * width + x;
      const offset = index * 4;
      const local = detail[index];
      const luma = pixelLuma(sharp, offset);
      if (local < .045 || luma < .16) continue;
      let peak = true;
      for (let oy = -1; oy <= 1 && peak; oy++)
        for (let ox = -1; ox <= 1; ox++)
          if ((ox || oy) && detail[(y + oy) * width + x + ox] > local){
            peak = false; break;
          }
      if (peak) candidates.push({ x, y, score: local * (.35 + luma) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const blocked = new Uint8Array(width * height);
  const selected = [];
  for (const candidate of candidates){
    const index = candidate.y * width + candidate.x;
    if (blocked[index]) continue;
    selected.push(candidate);
    if (selected.length >= BUDGET.alignedStars) break;
    for (let oy = -3; oy <= 3; oy++){
      const py = candidate.y + oy;
      if (py < 0 || py >= height) continue;
      for (let ox = -3; ox <= 3; ox++){
        const px = candidate.x + ox;
        if (px >= 0 && px < width && ox * ox + oy * oy <= 9)
          blocked[py * width + px] = 1;
      }
    }
  }

  const positions = new Float32Array(selected.length * 3);
  const colors = new Float32Array(selected.length * 3);
  for (let i = 0; i < selected.length; i++){
    const star = selected[i];
    // Pixel-centre convention. v is inverted once because image rows begin at
    // the top while PlaneGeometry v=0 begins at the bottom.
    const u = (star.x + .5) / width;
    const v = 1 - (star.y + .5) / height;
    positions[i * 3] = (u - .5) * plateWidth;
    positions[i * 3 + 1] = (v - .5) * plateHeight;
    positions[i * 3 + 2] = .24;
    const color = sampledFluxColor(sharp, soft, star.x, star.y, width, height);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: softMap,
    size: TEX_TIER === 'low' ? 1.16 : .92,
    vertexColors: true,
    transparent: true,
    opacity: .54,
    alphaTest: .016,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = 'hubble-source-aligned-colored-point-features';
  stars.renderOrder = 24;
  stars.userData.registration =
    'pixel-centre source UV; zero parallax; UV/V composite colour, not stellar true colour';
  parent.add(stars);
  return stars;
}

function makeDecorativeStars(softMap){
  const rnd = mulberry(hashStr('m87:stable-decorative-stars'));
  const count = BUDGET.decorativeStars;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [0x8fc4ff, 0xc8dcff, 0xfff1d2, 0xffc78f, 0xd8c1ff]
    .map(value => new THREE.Color(value));
  for (let i = 0; i < count; i++){
    const z = rnd() * 2 - 1;
    const angle = rnd() * Math.PI * 2;
    const radius = 150 + rnd() * 85;
    const planar = Math.sqrt(1 - z * z);
    positions[i * 3] = Math.cos(angle) * planar * radius;
    positions[i * 3 + 1] = z * radius;
    positions[i * 3 + 2] = Math.sin(angle) * planar * radius;
    const color = palette[(rnd() * palette.length) | 0];
    const brightness = .34 + Math.pow(rnd(), 2) * .66;
    colors[i * 3] = color.r * brightness;
    colors[i * 3 + 1] = color.g * brightness;
    colors[i * 3 + 2] = color.b * brightness;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: softMap,
    size: TEX_TIER === 'low' ? 1.02 : .80,
    vertexColors: true,
    transparent: true,
    opacity: .38,
    alphaTest: .012,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = 'stable-colored-stylistic-stars';
  stars.renderOrder = -30;
  stars.userData.scientificRole =
    'Decorative context only; stable IDs/positions, separate from observational plates.';
  return stars;
}

function makePhotoPlate(scope, bank, parent, {
  url, aspect, width, title, subtitle, captionWidth = 76,
  ambience = true, alignedStars = false, softMap, x = 0, y = 0,
  textureCrop = null, lazy = false,
}){
  const height = width / aspect;
  const fallback = scope.own(solidTexture(0x080608));
  const material = new THREE.MeshBasicMaterial({
    map: fallback,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  plane.position.set(x, y, 0);
  plane.renderOrder = 20;
  plane.name = url.split('/').pop() + ':unlit-observation-plane';
  plane.userData.observationPolicy = 'flat, source RGB, sRGB decoded once, no relighting';
  parent.add(plane);

  let ambienceMesh = null;
  let sourceStars = null;
  let requested = false;
  function load(){
    if (requested || scope.disposed) return;
    requested = true;
    bank.request(url, (texture, image) => {
      if (scope.disposed) return;
      let displayTexture = texture;
      if (textureCrop){
        displayTexture = scope.own(texture.clone());
        displayTexture.repeat.set(textureCrop.repeatX, textureCrop.repeatY);
        displayTexture.offset.set(textureCrop.offsetX, textureCrop.offsetY);
        displayTexture.updateMatrix();
        displayTexture.needsUpdate = true;
        displayTexture.userData = {
          ...texture.userData,
          crop: { ...textureCrop },
        };
        plane.userData.textureCrop = { ...textureCrop };
      }
      material.map = displayTexture;
      material.needsUpdate = true;
      plane.userData.ready = true;
      if (ambience && !ambienceMesh){
        ambienceMesh = makeSourceAmbience(scope, parent, image, width, height);
        ambienceMesh.position.x = x;
        ambienceMesh.position.y = y;
      }
      if (alignedStars && !sourceStars)
        sourceStars = addPhotoAlignedStars(parent, image, width, height, softMap);
    });
  }
  if (!lazy) load();

  let caption = null;
  if (title){
    caption = makeCaption(scope, title, subtitle, captionWidth);
    caption.position.set(x, y - height / 2 - 6.6, 1);
    parent.add(caption);
  }
  return { plane, material, width, height, caption, load };
}

function latLonPosition(latDegrees, lonDegrees, radius){
  const lat = THREE.MathUtils.degToRad(latDegrees);
  const lon = THREE.MathUtils.degToRad(lonDegrees);
  const cosLat = Math.cos(lat);
  // Matches SphereGeometry's equirectangular UV convention: lon=0 is +X,
  // west longitudes rotate toward +Z.
  return new THREE.Vector3(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * cosLat * Math.sin(lon),
  );
}

function greatCircleCurve(a, b, radius){
  const start = a.clone().normalize();
  const end = b.clone().normalize();
  const angle = Math.max(.0001, start.angleTo(end));
  const sinAngle = Math.sin(angle);
  const points = [];
  for (let i = 0; i <= BUDGET.baselineSegments; i++){
    const t = i / BUDGET.baselineSegments;
    let direction;
    if (Math.abs(sinAngle) < .0001){
      direction = start.clone().lerp(end, t).normalize();
    } else {
      direction = start.clone().multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
        .add(end.clone().multiplyScalar(Math.sin(t * angle) / sinAngle))
        .normalize();
    }
    const lift = 1.1 + Math.sin(Math.PI * t) * (2.4 + angle * 2.2);
    points.push(direction.multiplyScalar(radius + lift));
  }
  return new THREE.CatmullRomCurve3(points);
}

function buildArrayState(scope, bank, parent, softMap){
  const earthRoot = new THREE.Group();
  earthRoot.name = 'eht-2017-earth-array';
  parent.add(earthRoot);
  const radius = 30;
  const fallback = scope.own(solidTexture(0x173553));
  const earthMaterial = new THREE.MeshBasicMaterial({
    map: fallback,
    color: 0xffffff,
    toneMapped: false,
  });
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius, BUDGET.earthSegments, Math.round(BUDGET.earthSegments * .60),
    ),
    earthMaterial,
  );
  earth.name = 'real-earth-texture';
  earthRoot.add(earth);
  let earthRequested = false;
  function loadEarth(){
    if (earthRequested || scope.disposed) return;
    earthRequested = true;
    bank.request(ASSETS.earth, texture => {
      if (scope.disposed) return;
      earthMaterial.map = texture;
      earthMaterial.needsUpdate = true;
      earth.userData.ready = true;
    });
  }

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius * 1.035, BUDGET.earthSegments, Math.round(BUDGET.earthSegments * .60),
    ),
    new THREE.MeshBasicMaterial({
      color: 0x4aa9df,
      transparent: true,
      opacity: .12,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  earthRoot.add(atmosphere);

  const clusterMembers = new Map(CLUSTER_ORDER.map(name => [name, []]));
  const clusterMaterials = new Map();
  for (const cluster of CLUSTER_ORDER){
    clusterMaterials.set(cluster, new THREE.MeshBasicMaterial({
      color: CLUSTER_COLORS[cluster],
      transparent: true,
      opacity: .98,
      toneMapped: false,
    }));
  }
  const markerGeometry = new THREE.SphereGeometry(.55, 14, 10);
  const pairGeometry = new THREE.TorusGeometry(.72, .12, 8, 28);
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (const station of EHT_2017_STATIONS){
    const position = latLonPosition(station.lat, station.lon, radius + .55);
    const siblings = clusterMembers.get(station.cluster);
    const material = clusterMaterials.get(station.cluster);
    const marker = siblings.length === 0
      ? new THREE.Mesh(markerGeometry, material)
      : new THREE.Mesh(pairGeometry, material);
    marker.position.copy(position);
    if (siblings.length) marker.quaternion.setFromUnitVectors(zAxis, position.clone().normalize());
    marker.renderOrder = 7;
    marker.userData.station = station;
    earthRoot.add(marker);
    siblings.push({ station, position, marker });
  }

  const clusterPositions = new Map();
  for (const cluster of CLUSTER_ORDER){
    const members = clusterMembers.get(cluster);
    const normal = new THREE.Vector3();
    for (const member of members) normal.add(member.position.clone().normalize());
    normal.normalize();
    const position = normal.clone().multiplyScalar(radius + .62);
    clusterPositions.set(cluster, position);
    const label = makeStationLabel(
      scope,
      CLUSTER_LABELS[cluster],
      '#' + CLUSTER_COLORS[cluster].toString(16).padStart(6, '0'),
    );
    label.position.copy(normal.multiplyScalar(radius + 3.2));
    label.userData.cluster = cluster;
    earthRoot.add(label);
  }

  const siteLinkMaterial = new THREE.MeshBasicMaterial({
    color: 0x72dff3,
    transparent: true,
    opacity: .24,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  let siteLinkCount = 0;
  for (let i = 0; i < CLUSTER_ORDER.length; i++){
    for (let j = i + 1; j < CLUSTER_ORDER.length; j++){
      const curve = greatCircleCurve(
        clusterPositions.get(CLUSTER_ORDER[i]),
        clusterPositions.get(CLUSTER_ORDER[j]),
        radius,
      );
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(
          curve, BUDGET.baselineSegments, .075,
          BUDGET.baselineRadialSegments, false,
        ),
        siteLinkMaterial,
      );
      tube.name = 'geographical-site-link-tube';
      tube.userData.sitePair = [CLUSTER_ORDER[i], CLUSTER_ORDER[j]];
      tube.userData.scientificRole =
        'Geographical site relationship, not an instrument-pair uv track or signal beam.';
      earthRoot.add(tube);
      siteLinkCount += 1;
    }
  }

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softMap,
    color: 0x5bbbe8,
    transparent: true,
    opacity: .18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  }));
  glow.scale.set(76, 76, 1);
  glow.renderOrder = -5;
  parent.add(glow);

  const caption = makeCaption(
    scope,
    'EHT · APRIL 2017',
    '8 instruments at 6 sites · dot + ring = co-location · tubes = site links; no uv tracks',
    98,
    '#68dff3',
  );
  caption.position.set(0, -42, 8);
  parent.add(caption);

  earthRoot.userData.stationCoordinates = EHT_2017_STATIONS;
  earthRoot.userData.stationCount = 8;
  earthRoot.userData.geographicalClusterCount = 6;
  earthRoot.userData.siteLinkTubeCount = siteLinkCount;
  earthRoot.userData.siteLinkPolicy =
    '15 unique geographical site pairs; not 28 instrument pairs or projected uv coverage.';
  return { earthRoot, caption, load: loadEarth };
}

function parseFitsValue(field){
  const value = field.split('/')[0].trim();
  if (value.startsWith("'")) return value.slice(1, value.lastIndexOf("'")).trim();
  if (value === 'T') return true;
  if (value === 'F') return false;
  const number = Number(value.replace(/D/g, 'E'));
  return Number.isFinite(number) ? number : value;
}

function parseFits(buffer){
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('ascii');
  const header = {};
  let endOffset = -1;
  for (let offset = 0; offset + 80 <= bytes.length; offset += 80){
    const card = decoder.decode(bytes.subarray(offset, offset + 80));
    const key = card.slice(0, 8).trim();
    if (key === 'END'){
      endOffset = offset + 80;
      break;
    }
    if (card[8] === '=') header[key] = parseFitsValue(card.slice(10));
  }
  if (endOffset < 0) throw new Error('FITS header has no END card');
  if (header.BITPIX !== -64) throw new Error('Expected a 64-bit floating-point FITS image');
  if (header.NAXIS < 2 || !header.NAXIS1 || !header.NAXIS2)
    throw new Error('FITS image dimensions are missing');
  const width = header.NAXIS1;
  const height = header.NAXIS2;
  const dataOffset = Math.ceil(endOffset / 2880) * 2880;
  const expectedBytes = dataOffset + width * height * 8;
  if (buffer.byteLength < expectedBytes) throw new Error('FITS image data is truncated');
  const view = new DataView(buffer);
  const values = new Float64Array(width * height);
  const scale = Number(header.BSCALE ?? 1);
  const zero = Number(header.BZERO ?? 0);
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let i = 0; i < values.length; i++){
    const value = view.getFloat64(dataOffset + i * 8, false) * scale + zero;
    values[i] = value;
    if (Number.isFinite(value)){
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return { header, width, height, values, minimum, maximum };
}

const EHT_COLOR_STOPS = Object.freeze([
  Object.freeze([0.00, [4, 0, 1]]),
  Object.freeze([0.10, [38, 0, 1]]),
  Object.freeze([0.25, [105, 4, 0]]),
  Object.freeze([0.43, [202, 30, 0]]),
  Object.freeze([0.62, [255, 102, 0]]),
  Object.freeze([0.80, [255, 187, 34]]),
  Object.freeze([1.00, [255, 246, 193]]),
]);

function ehtColor(value){
  const t = clamp01(value);
  for (let i = 1; i < EHT_COLOR_STOPS.length; i++){
    const [position, color] = EHT_COLOR_STOPS[i];
    if (t > position) continue;
    const [previousPosition, previous] = EHT_COLOR_STOPS[i - 1];
    const mix = (t - previousPosition) / Math.max(.0001, position - previousPosition);
    return [
      Math.round(THREE.MathUtils.lerp(previous[0], color[0], mix)),
      Math.round(THREE.MathUtils.lerp(previous[1], color[1], mix)),
      Math.round(THREE.MathUtils.lerp(previous[2], color[2], mix)),
    ];
  }
  return EHT_COLOR_STOPS[EHT_COLOR_STOPS.length - 1][1];
}

function fitsTexture(parsed){
  const { header, width, height, values } = parsed;
  const pixels = new Uint8Array(width * height * 4);
  const displayMaximum = Math.max(.0001, Number(header.DATAMAX) || parsed.maximum);
  const stretch = 4;
  const normalizer = Math.asinh(stretch);
  const xForward = Number(header.CDELT1) <= 0; // east left
  const yForward = Number(header.CDELT2) >= 0; // north up
  for (let y = 0; y < height; y++){
    const sourceY = yForward ? y : height - 1 - y;
    for (let x = 0; x < width; x++){
      const sourceX = xForward ? x : width - 1 - x;
      const value = Math.max(0, values[sourceY * width + sourceX]);
      const mapped = Math.asinh(stretch * clamp01(value / displayMaximum)) / normalizer;
      const color = ehtColor(mapped);
      const target = (y * width + x) * 4;
      pixels[target] = color[0];
      pixels[target + 1] = color[1];
      pixels[target + 2] = color[2];
      pixels[target + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(
    pixels, width, height, THREE.RGBAFormat, THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  // FITS row one is the lower (southern) edge when CDELT2 is positive.
  // DataTexture v=0 is also the lower edge, so no extra flip is permitted.
  texture.flipY = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const microarcsecondsPerDegree = 3.6e9;
  texture.userData.wcs = {
    ctype1: header.CTYPE1,
    ctype2: header.CTYPE2,
    cdelt1Degrees: header.CDELT1,
    cdelt2Degrees: header.CDELT2,
    crpix1: header.CRPIX1,
    crpix2: header.CRPIX2,
    fieldWidthMicroarcseconds: width * Math.abs(header.CDELT1) * microarcsecondsPerDegree,
    fieldHeightMicroarcseconds: height * Math.abs(header.CDELT2) * microarcsecondsPerDegree,
    orientation: 'north up, east left',
  };
  texture.userData.displayStretch = 'asinh(4 × max(I,0) / DATAMAX)';
  texture.userData.units = header.BUNIT;
  return texture;
}

function loadFitsTexture(scope, url, onReady, onError){
  const controller = new AbortController();
  scope.defer(() => controller.abort());
  fetch(url, { signal: controller.signal })
    .then(response => {
      if (!response.ok) throw new Error(`FITS request failed (${response.status})`);
      return response.arrayBuffer();
    })
    .then(buffer => {
      if (scope.disposed) return;
      const parsed = parseFits(buffer);
      const texture = scope.own(fitsTexture(parsed));
      if (!scope.disposed) onReady(texture, parsed);
    })
    .catch(error => {
      if (!scope.disposed && error.name !== 'AbortError') onError(url, error);
    });
}

function buildComparisonState(scope, bank, parent, onError){
  const pixelScale2017 = EHT_RING_DIAMETER_UAS / EHT_2017_RING_DIAMETER_PIXELS;
  const cropWidthPixels = EHT_COMPARE_WIDTH_UAS / pixelScale2017;
  const cropHeightPixels = EHT_COMPARE_HEIGHT_UAS / pixelScale2017;
  const repeatX2017 = cropWidthPixels / 4096;
  const repeatY2017 = cropHeightPixels / 2386;
  const panelWidth = EHT_COMPARE_WIDTH_UAS * WORLD_PER_MICROARCSECOND;
  const panelHeight = EHT_COMPARE_HEIGHT_UAS * WORLD_PER_MICROARCSECOND;
  const panelAspect = EHT_COMPARE_WIDTH_UAS / EHT_COMPARE_HEIGHT_UAS;
  const leftX = -40;
  const rightX = 40;
  const leftPlate = makePhotoPlate(scope, bank, parent, {
    url: ASSETS.eht2017,
    aspect: panelAspect,
    width: panelWidth,
    ambience: false,
    x: leftX,
    lazy: true,
    textureCrop: {
      repeatX: repeatX2017,
      repeatY: repeatY2017,
      offsetX: (1 - repeatX2017) / 2,
      offsetY: (1 - repeatY2017) / 2,
      calibration: '42 μas radial ridge diameter / 440 source pixels',
      angularFieldMicroarcseconds: [EHT_COMPARE_WIDTH_UAS, EHT_COMPARE_HEIGHT_UAS],
    },
  });
  leftPlate.plane.userData.angularCalibration = {
    ringDiameterMicroarcseconds: EHT_RING_DIAMETER_UAS,
    measuredRidgeDiameterPixels: EHT_2017_RING_DIAMETER_PIXELS,
    pixelScaleMicroarcseconds: pixelScale2017,
    embeddedWcs: false,
  };

  const fallback = scope.own(solidTexture(0x120201));
  const material = new THREE.MeshBasicMaterial({
    map: fallback,
    transparent: true,
    opacity: .92,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const fitsPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(panelWidth, panelHeight),
    material,
  );
  fitsPlane.position.x = rightX;
  fitsPlane.renderOrder = 20;
  fitsPlane.name = 'eht-2018-wcs-preserved-fits-crop';
  parent.add(fitsPlane);

  let fitsRequested = false;
  function load(){
    leftPlate.load();
    if (fitsRequested || scope.disposed) return;
    fitsRequested = true;
    loadFitsTexture(scope, ASSETS.eht2018Fits, (texture, parsed) => {
      const fovY = texture.userData.wcs.fieldHeightMicroarcseconds;
      const cropFraction = Math.min(1, EHT_COMPARE_HEIGHT_UAS / fovY);
      texture.repeat.set(1, cropFraction);
      texture.offset.set(0, (1 - cropFraction) / 2);
      texture.updateMatrix();
      material.map = texture;
      material.opacity = 1;
      material.needsUpdate = true;
      fitsPlane.userData.ready = true;
      fitsPlane.userData.header = parsed.header;
      fitsPlane.userData.angularCropMicroarcseconds = {
        width: texture.userData.wcs.fieldWidthMicroarcseconds,
        height: EHT_COMPARE_HEIGHT_UAS,
      };
    }, onError);
  }

  const leftLabel = makeCaption(
    scope,
    'EHT · 2017 RELEASE',
    '42 μas ridge-calibrated crop · press raster has no embedded WCS',
    59,
  );
  leftLabel.position.set(leftX, panelHeight / 2 + 6.2, 1);
  parent.add(leftLabel);
  const rightLabel = makeCaption(
    scope,
    'EHT · 2018 BAND 3',
    'Exact FITS WCS · asinh display stretch · 20 μas matched blur',
    59,
  );
  rightLabel.position.set(rightX, panelHeight / 2 + 6.2, 1);
  parent.add(rightLabel);
  const caption = makeCaption(
    scope,
    'THE SHADOW PERSISTS',
    'Same angular scale · independent stretches · N ↑  E ← · stable diameter · peak shifts ≈30°',
    112,
  );
  caption.position.set(0, panelHeight / 2 + 16.5, 1);
  parent.add(caption);

  parent.userData.comparisonPolicy = {
    worldUnitsPerMicroarcsecond: WORLD_PER_MICROARCSECOND,
    restoringBeamMicroarcseconds: 20,
    orientation: 'north up, east left',
    animation: 'none; independent snapshots, not rigid ring rotation',
    displayStretch: 'independent; morphology is comparable, brightness/color is not photometrically matched',
    caveat: 'The 2018 panel has exact FITS WCS. The 2017 press raster has no embedded WCS and is center-cropped using its measured 440 px ridge as 42 μas.',
  };
  return { fitsPlane, material, load };
}

function createStateRoot(group, state, billboard = true){
  const root = new THREE.Group();
  root.name = 'm87:' + state;
  root.visible = false;
  root.userData.m87State = state;
  let visual = root;
  if (billboard){
    visual = new THREE.Group();
    visual.name = state + ':camera-facing-observation-frame';
    root.add(visual);
  }
  group.add(root);
  return { root, visual, billboard };
}

function disposeGraph(root){
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse(object => {
    if (object.geometry && !geometries.has(object.geometry)){
      geometries.add(object.geometry);
      object.geometry.dispose();
    }
    const list = Array.isArray(object.material)
      ? object.material
      : object.material ? [object.material] : [];
    for (const material of list){
      if (!material || materials.has(material)) continue;
      materials.add(material);
      for (const key of Object.keys(material)){
        const candidate = material[key];
        if (candidate && candidate.isTexture && !textures.has(candidate)){
          textures.add(candidate);
          candidate.dispose();
        }
      }
      material.dispose();
    }
  });
}

export function buildM87Featured(){
  const scope = new ResourceScope('m87-featured');
  const group = new THREE.Group();
  const assetErrors = [];
  const onAssetError = (url, error) => {
    assetErrors.push({ url, message: error && error.message ? error.message : String(error) });
    group.userData.assetErrors = assetErrors;
  };
  const bank = createImageBank(scope, onAssetError);
  const softMap = scope.own(softDiscTexture());
  group.add(makeDecorativeStars(softMap));

  const states = new Map();
  for (const state of Object.values(M87_STATES))
    states.set(state, createStateRoot(group, state, state !== M87_STATES.ARRAY));

  const jet = states.get(M87_STATES.JET);
  const jetPlate = makePhotoPlate(scope, bank, jet.visual, {
    url: ASSETS.hubbleJet,
    aspect: PHOTO.hubbleAspect,
    width: 102,
    title: 'HUBBLE · M87 + OPTICAL JET',
    subtitle: 'UV + V mapped observation · plate-local point colours are filter composites',
    captionWidth: 86,
    ambience: true,
    alignedStars: true,
    softMap,
    lazy: true,
  });
  jet.activate = jetPlate.load;

  const darkEngine = states.get(M87_STATES.DARK_ENGINE);
  const darkEnginePlate = makePhotoPlate(scope, bank, darkEngine.visual, {
    url: ASSETS.multiscale,
    aspect: PHOTO.multiscaleAspect,
    width: 70,
    title: 'OBSERVED SCALE LADDER',
    subtitle: 'HST → ALMA → VLBA → EHT · distinct instruments and physical scales',
    captionWidth: 78,
    ambience: true,
    softMap,
    lazy: true,
  });
  darkEngine.activate = darkEnginePlate.load;

  const array = states.get(M87_STATES.ARRAY);
  const arrayVisual = buildArrayState(scope, bank, array.visual, softMap);
  array.activate = arrayVisual.load;

  const shadow = states.get(M87_STATES.SHADOW);
  const shadowPlate = makePhotoPlate(scope, bank, shadow.visual, {
    url: ASSETS.eht2017,
    aspect: PHOTO.eht2017Aspect,
    width: 110,
    title: 'EHT · 2017 TOTAL INTENSITY',
    subtitle: '1.3 mm radio reconstruction · orange encodes brightness, not visible colour',
    captionWidth: 91,
    ambience: true,
    softMap,
    lazy: true,
  });
  shadow.activate = shadowPlate.load;

  const fields = states.get(M87_STATES.FIELDS);
  const fieldsPlate = makePhotoPlate(scope, bank, fields.visual, {
    url: ASSETS.polarized,
    aspect: PHOTO.polarizedAspect,
    width: 82,
    title: 'EHT · 2017 POLARIZED EMISSION',
    subtitle: 'Published 2021 · segments encode polarization orientation, not field wires',
    captionWidth: 90,
    ambience: true,
    softMap,
    lazy: true,
  });
  fields.activate = fieldsPlate.load;

  const persists = states.get(M87_STATES.PERSISTS);
  const comparison = buildComparisonState(scope, bank, persists.visual, onAssetError);
  persists.activate = comparison.load;

  let activeState = M87_STATES.SHADOW;
  let disposed = false;
  function selectState(requested){
    const state = stateFromVisual(requested);
    activeState = states.has(state) ? state : M87_STATES.SHADOW;
    for (const [name, record] of states) record.root.visible = name === activeState;
    const record = states.get(activeState);
    if (record.activate) record.activate();
    group.userData.activeState = activeState;
  }
  selectState(activeState);

  group.userData.qualityBudget = BUDGET;
  group.userData.textureLongSideCap = 2048;
  group.userData.observationPolicy =
    'All observation products are unlit flat planes with source RGB; no image-derived black-hole depth.';
  group.userData.pointRegistration =
    'pixel-centre source UV → shared plate transform; extracted points have zero parallax';
  group.userData.decorativeStars =
    'stable coloured stylistic layer, explicitly separate from observations';
  group.userData.eht2018Fits = {
    expectedShape: [128, 128],
    expectedFieldMicroarcseconds: 150,
    expectedPixelScaleMicroarcseconds: 1.171875,
    license: 'CC BY 4.0 · EHT Collaboration · A&A 681 A79',
  };

  return {
    group,
    focusDist: 135,
    startTheta: 0,
    startPhi: Math.PI / 2,
    autoRotate: false,
    hasIR: false,
    isImage: true,
    imageCredit: EVIDENCE_CREDIT,
    setMoment(visual){
      if (!disposed && visual) selectState(visual);
    },
    update(dt, camera){
      if (disposed) return;
      dt = Math.min(Math.max(dt || 0, 0), .05);
      const record = states.get(activeState);
      if (camera && record.billboard) record.visual.quaternion.copy(camera.quaternion);
      if (activeState === M87_STATES.ARRAY){
        arrayVisual.earthRoot.rotation.y += dt * .055;
        if (camera) arrayVisual.caption.quaternion.copy(camera.quaternion);
      }
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      scope.dispose();
      disposeGraph(group);
      group.clear();
    },
  };
}
