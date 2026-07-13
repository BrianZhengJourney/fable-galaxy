/* Schematic, deterministic palaeo-Earth albedos used by the Sol epoch view.
   These are deliberately visual reconstructions, not GIS datasets: Rodinia's
   exact coastline is uncertain and the 5 Ma map only emphasizes broad changes.
   Night-side illumination is controlled separately by the planet material. */

import * as THREE from 'three';
import { hashStr, mulberry } from './rng.js';

const WIDTH = 1536;
const HEIGHT = 768;
const cache = new Map();

const RODINIA = [
  [-119, 2], [-108, 21], [-88, 39], [-62, 46], [-43, 34],
  [-20, 47], [7, 50], [27, 35], [51, 38], [73, 24],
  [68, 8], [91, -10], [82, -27], [57, -35], [38, -49],
  [8, -45], [-13, -28], [-38, -38], [-64, -29], [-79, -14],
  [-105, -11]
];

const PLIOCENE_LAND = [
  // North America; the open southern end keeps the 5 Ma Panama region subtle.
  [[-168, 70], [-146, 73], [-126, 66], [-118, 52], [-130, 44],
   [-123, 32], [-108, 24], [-96, 18], [-87, 19], [-82, 27],
   [-76, 38], [-64, 48], [-58, 58], [-77, 68], [-104, 75], [-137, 74]],
  // South America.
  [[-81, 12], [-70, 10], [-62, 3], [-48, 1], [-35, -8],
   [-41, -20], [-52, -33], [-55, -52], [-69, -55], [-75, -38],
   [-80, -17], [-77, -3]],
  // Eurasia.
  [[-11, 36], [-10, 52], [-22, 64], [-4, 72], [31, 72],
   [62, 77], [102, 73], [139, 69], [178, 61], [168, 50],
   [147, 43], [135, 33], [119, 20], [106, 6], [94, 9],
   [80, 22], [63, 25], [50, 31], [38, 37], [28, 40],
   [20, 34], [11, 43], [1, 44]],
  // Africa.
  [[-17, 34], [1, 37], [16, 33], [31, 31], [43, 14], [50, 10],
   [42, -5], [34, -21], [20, -35], [8, -35], [-2, -25],
   [-11, -5], [-15, 15]],
  // Australia.
  [[112, -11], [130, -10], [146, -17], [154, -28], [145, -40],
   [126, -38], [113, -25]],
  // Greenland, reduced from the modern ice-dominated silhouette.
  [[-54, 59], [-38, 63], [-25, 72], [-31, 82], [-50, 83], [-62, 73]],
  // Madagascar.
  [[48, -13], [51, -20], [49, -28], [44, -24], [44, -16]]
];

const PLIOCENE_ISLANDS = [
  [142, 38, 7, 15], [121, 13, 8, 13], [119, -3, 8, 5],
  [132, -4, 10, 5], [168, -43, 7, 4], [-155, 20, 7, 3],
  [-89, 15, 5, 3], [-81, 9, 3, 2]
];

function xy([lon, lat]){
  return [(lon + 180) / 360 * WIDTH, (90 - lat) / 180 * HEIGHT];
}

function tracePolygon(ctx, points){
  const first = xy(points[0]);
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i++){
    const p = xy(points[i]);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
}

function boundsOf(points){
  const projected = points.map(xy);
  const xs = projected.map(p => p[0]);
  const ys = projected.map(p => p[1]);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys)
  };
}

function paintOcean(ctx, id){
  // A low-resolution field creates broad, photographic bathymetric variation
  // without a large startup cost. Scaling smooths it into soft ocean texture.
  const field = document.createElement('canvas');
  field.width = WIDTH / 4;
  field.height = HEIGHT / 4;
  const fg = field.getContext('2d');
  const image = fg.createImageData(field.width, field.height);
  const phase = id === 'rodinia' ? 1.7 : 4.3;

  for (let y = 0; y < field.height; y++){
    const latitude = Math.abs(y / (field.height - 1) * 2 - 1);
    for (let x = 0; x < field.width; x++){
      const wave = Math.sin(x * 0.075 + Math.sin(y * 0.09) * 2.2 + phase)
        + Math.sin(y * 0.12 - x * 0.021 + phase * 1.8) * 0.55
        + Math.sin((x + y) * 0.031 - phase) * 0.35;
      const polar = latitude * latitude;
      const i = (y * field.width + x) * 4;
      image.data[i] = 5 + wave * 2 + polar * 5;
      image.data[i + 1] = 28 + wave * 5 + polar * 13;
      image.data[i + 2] = 56 + wave * 8 + polar * 17;
      image.data[i + 3] = 255;
    }
  }
  fg.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(field, 0, 0, WIDTH, HEIGHT);

  const rnd = mulberry(hashStr('earth-epoch-ocean-' + id));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 72; i++){
    const y = rnd() * HEIGHT;
    const alpha = 0.012 + rnd() * 0.022;
    ctx.strokeStyle = `rgba(73, 168, 177, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 2 + rnd() * 8;
    ctx.beginPath();
    ctx.moveTo(-60, y);
    ctx.bezierCurveTo(
      WIDTH * 0.25, y + (rnd() - 0.5) * 80,
      WIDTH * 0.72, y + (rnd() - 0.5) * 100,
      WIDTH + 60, y + (rnd() - 0.5) * 40
    );
    ctx.stroke();
  }
  ctx.restore();
}

function paintLand(ctx, points, palette, seed, detail = 1){
  const rnd = mulberry(hashStr(seed));
  const b = boundsOf(points);

  // Shallow-water shelf. It makes coastlines feel embedded in the ocean rather
  // than pasted on top and remains soft enough not to read as a wireframe.
  tracePolygon(ctx, points);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.shelf;
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.restore();

  const gradient = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  gradient.addColorStop(0, palette.light);
  gradient.addColorStop(0.48, palette.mid);
  gradient.addColorStop(1, palette.dark);
  tracePolygon(ctx, points);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.save();
  tracePolygon(ctx, points);
  ctx.clip();

  const patchCount = Math.max(18, Math.round((b.w * b.h) / 2500 * detail));
  for (let i = 0; i < patchCount; i++){
    const x = b.x + rnd() * b.w;
    const y = b.y + rnd() * b.h;
    const radius = 8 + rnd() * 34;
    ctx.fillStyle = palette.patches[i % palette.patches.length];
    ctx.globalAlpha = 0.06 + rnd() * 0.16;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * (0.8 + rnd()), radius * (0.35 + rnd() * 0.55),
      rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mineral ridges / mountain chains: short irregular strokes, never a grid.
  ctx.lineCap = 'round';
  for (let i = 0; i < Math.max(6, Math.round(patchCount / 7)); i++){
    let x = b.x + rnd() * b.w;
    let y = b.y + rnd() * b.h;
    ctx.strokeStyle = rnd() > 0.5 ? palette.ridgeLight : palette.ridgeDark;
    ctx.globalAlpha = 0.10 + rnd() * 0.16;
    ctx.lineWidth = 1 + rnd() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let p = 0; p < 5; p++){
      x += (rnd() - 0.28) * 30;
      y += (rnd() - 0.5) * 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let i = 0; i < patchCount * 6; i++){
    ctx.fillStyle = rnd() > 0.5 ? '#fff4cf' : '#28190f';
    ctx.globalAlpha = 0.018 + rnd() * 0.035;
    ctx.fillRect(b.x + rnd() * b.w, b.y + rnd() * b.h, 1.2, 1.2);
  }
  ctx.restore();

  tracePolygon(ctx, points);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.coast;
  ctx.globalAlpha = 0.62;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawRodinia(ctx){
  paintOcean(ctx, 'rodinia');
  const palette = {
    shelf: 'rgba(77, 178, 169, 0.18)',
    light: '#b89255', mid: '#8b653e', dark: '#5a392b',
    patches: ['#d2a968', '#70462f', '#9a7450', '#bf8550', '#4c3430'],
    ridgeLight: '#e0b66f', ridgeDark: '#412b28',
    coast: '#d6b775'
  };
  paintLand(ctx, RODINIA, palette, 'rodinia-main', 1.25);

  // Accreting terranes around the supercontinent retain the assembled,
  // connected silhouette while avoiding a perfectly modern-style coastline.
  const terranes = [
    [[-126, 11], [-119, 22], [-111, 17], [-113, 6]],
    [[72, 30], [88, 34], [96, 25], [84, 19]],
    [[57, -39], [73, -42], [68, -52], [50, -49]],
    [[-40, -42], [-28, -50], [-40, -56], [-53, -48]]
  ];
  terranes.forEach((shape, i) => paintLand(ctx, shape, palette, `rodinia-terrane-${i}`, 0.5));
}

function drawPliocene(ctx){
  paintOcean(ctx, 'pliocene');
  const palette = {
    shelf: 'rgba(75, 184, 185, 0.16)',
    light: '#8e9a58', mid: '#627745', dark: '#674f35',
    patches: ['#315c3e', '#486f43', '#b09256', '#7f7044', '#86603a'],
    ridgeLight: '#c7b27b', ridgeDark: '#314630',
    coast: '#b9bd7c'
  };
  PLIOCENE_LAND.forEach((shape, i) =>
    paintLand(ctx, shape, palette, `pliocene-land-${i}`, i === 2 ? 0.75 : 1));

  // Island arcs were already broadly modern, but the Central American chain
  // is left discontinuous to suggest the still-evolving seaway around 5 Ma.
  const rnd = mulberry(hashStr('pliocene-islands'));
  ctx.fillStyle = '#73814c';
  for (const [lon, lat, rx, ry] of PLIOCENE_ISLANDS){
    const p = xy([lon, lat]);
    ctx.globalAlpha = 0.78 + rnd() * 0.18;
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], rx, ry, rnd() * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Antarctica had substantial ice, while Greenland was warmer and less
  // ice-dominated than today. Keep the southern cap muted, not modern bright.
  const antarctica = [
    [-180, -70], [-150, -67], [-120, -72], [-90, -68], [-60, -73],
    [-30, -67], [0, -70], [35, -66], [70, -71], [105, -67],
    [140, -72], [180, -69], [180, -90], [-180, -90]
  ];
  paintLand(ctx, antarctica, {
    shelf: 'rgba(93, 170, 180, 0.12)',
    light: '#d4d2bd', mid: '#aeb5a8', dark: '#778982',
    patches: ['#edf0df', '#98a9a5', '#c4c1a7'],
    ridgeLight: '#f4f0dc', ridgeDark: '#65736f', coast: '#e2dfca'
  }, 'pliocene-antarctica', 0.32);
}

const drawers = { rodinia: drawRodinia, pliocene: drawPliocene };

/**
 * Return a shared equirectangular CanvasTexture for a supported Earth epoch.
 * Unknown ids return null so a caller can retain the present-day imagery.
 */
export function getEarthEpochTexture(id){
  const key = String(id || '').toLowerCase();
  if (!drawers[key]) return null;
  if (cache.has(key)) return cache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  drawers[key](ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `earth-epoch-${key}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.userData.shared = true;
  texture.userData.epoch = key;
  cache.set(key, texture);
  return texture;
}

export function evictEarthEpochTextures(){
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}
