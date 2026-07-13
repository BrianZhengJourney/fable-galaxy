/* Deterministic, code-native appearance maps for non-Earth Solar epochs.
   These encode representative weather/climate states, not recovered images.
   Gas/cloud maps are opaque replacements; Mars uses a translucent ice/dust
   overlay so its observed topography remains visible underneath. */

import * as THREE from 'three';
import { canvasTex } from './textures.js';
import { hashStr, mulberry } from './rng.js';
import {
  getPlanetEpochRecipe,
  planetEpochSurfaceKey,
} from '../data/planetEpochRecipes.js';

const WIDTH = 1024;
const HEIGHT = 512;
const cache = new Map();

function sharedColorTexture(texture){
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.userData.shared = true;
  texture.needsUpdate = true;
  return texture;
}

function paintAtmosphere(profile, seed){
  const rnd = mulberry(hashStr(seed));
  return sharedColorTexture(canvasTex(WIDTH, HEIGHT, (g, w, h) => {
    const vertical = g.createLinearGradient(0, 0, 0, h);
    vertical.addColorStop(0, profile.light);
    vertical.addColorStop(.18, profile.base);
    vertical.addColorStop(.5, profile.light);
    vertical.addColorStop(.82, profile.base);
    vertical.addColorStop(1, profile.light);
    g.fillStyle = vertical;
    g.fillRect(0, 0, w, h);

    for (let i = 0; i < profile.bands; i++){
      const center = (i + .5) / profile.bands * h + (rnd() - .5) * h * .025;
      const thickness = h / profile.bands * (.42 + rnd() * .65);
      const phase = rnd() * Math.PI * 2;
      const wave = 2 + rnd() * (profile.kind === 'venus' ? 13 : 5);
      g.globalAlpha = profile.contrast * (.55 + rnd() * .7);
      g.fillStyle = i % 3 === 0 ? profile.dark
        : i % 2 === 0 ? (profile.accent || profile.base) : profile.light;
      g.beginPath();
      g.moveTo(0, center);
      for (let x = 0; x <= w; x += 12){
        const y = center + Math.sin(x / w * Math.PI * 2 * wave + phase) * (2 + rnd() * 2);
        g.lineTo(x, y);
      }
      for (let x = w; x >= 0; x -= 12){
        const y = center + thickness + Math.sin(x / w * Math.PI * 2 * wave + phase + 1.4) * 4;
        g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
    }

    // Small, anonymous eddies make the state visibly dynamic without copying
    // the Great Red Spot, Great Dark Spot, or any other named present storm.
    for (let i = 0; i < profile.storms; i++){
      const x = rnd() * w;
      const y = h * (.12 + rnd() * .76);
      const rx = 5 + rnd() * (profile.kind === 'gas' ? 18 : 11);
      const ry = 2 + rnd() * 6;
      g.globalAlpha = .10 + rnd() * .17;
      g.fillStyle = rnd() > .48 ? profile.light : (profile.accent || profile.dark);
      g.beginPath();
      g.ellipse(x, y, rx, ry, (rnd() - .5) * .25, 0, Math.PI * 2);
      g.fill();
    }

    if (profile.kind === 'venus'){
      // Broad UV-absorber lanes and polar-vortex-like curls. Their phase is
      // deliberately seed-specific because actual cloud markings change fast.
      g.lineCap = 'round';
      for (let i = 0; i < 22; i++){
        const y = rnd() * h;
        g.strokeStyle = rnd() > .5 ? profile.dark : profile.light;
        g.globalAlpha = .05 + rnd() * .10;
        g.lineWidth = 5 + rnd() * 18;
        g.beginPath();
        g.moveTo(-40, y);
        g.bezierCurveTo(w * .28, y + (rnd() - .5) * 100,
          w * .72, y + (rnd() - .5) * 120, w + 40, y + (rnd() - .5) * 60);
        g.stroke();
      }
    }

    if (profile.polar > 0){
      const north = g.createLinearGradient(0, 0, 0, h * .24);
      north.addColorStop(0, `rgba(240,249,246,${profile.polar})`);
      north.addColorStop(1, 'rgba(240,249,246,0)');
      g.globalAlpha = 1; g.fillStyle = north; g.fillRect(0, 0, w, h * .24);
      const south = g.createLinearGradient(0, h, 0, h * .76);
      south.addColorStop(0, `rgba(225,238,238,${profile.polar * .72})`);
      south.addColorStop(1, 'rgba(225,238,238,0)');
      g.fillStyle = south; g.fillRect(0, h * .76, w, h * .24);
    }

    g.globalAlpha = 1;
  }));
}

function wrappedEllipse(g, x, y, rx, ry, color, alpha){
  g.fillStyle = color;
  g.globalAlpha = alpha;
  for (const dx of [-WIDTH, 0, WIDTH]){
    g.beginPath();
    g.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function paintMarsIceScenario(surface){
  const old = surface === 'modeled-ice-1000ma';
  const rnd = mulberry(hashStr('MARS:' + surface));
  return sharedColorTexture(canvasTex(WIDTH, HEIGHT, (g, w, h) => {
    g.clearRect(0, 0, w, h);

    // A translucent dust wash and ochre polar masks reduce today's compact
    // bright caps without replacing the observed volcanic/cratered base map.
    g.fillStyle = old ? 'rgba(151,70,35,.14)' : 'rgba(177,91,49,.10)';
    g.fillRect(0, 0, w, h);
    const north = g.createLinearGradient(0, 0, 0, h * .17);
    north.addColorStop(0, 'rgba(175,91,49,.88)');
    north.addColorStop(1, 'rgba(175,91,49,0)');
    g.fillStyle = north; g.fillRect(0, 0, w, h * .17);
    const south = g.createLinearGradient(0, h, 0, h * .83);
    south.addColorStop(0, 'rgba(159,75,42,.84)');
    south.addColorStop(1, 'rgba(159,75,42,0)');
    g.fillStyle = south; g.fillRect(0, h * .83, w, h * .17);

    // Representative high-obliquity ice/dust mantles: low/mid-latitude
    // deposits plus a stronger cluster around the Tharsis/Olympus longitudes.
    const count = old ? 52 : 64;
    for (let i = 0; i < count; i++){
      const tharsis = i < count * .38;
      const lonX = tharsis ? w * (.15 + rnd() * .18) : rnd() * w;
      const northBand = rnd() > .5;
      const y = h * (northBand ? .30 + rnd() * .18 : .53 + rnd() * .18);
      const rx = 9 + rnd() * (tharsis ? 30 : 21);
      const ry = 3 + rnd() * 11;
      wrappedEllipse(g, lonX, y, rx, ry,
        rnd() > .35 ? '#e6ece5' : '#c9d8d5', .16 + rnd() * .34);
    }

    // Fine airborne dust softens the exact model boundary.
    for (let i = 0; i < 110; i++){
      wrappedEllipse(g, rnd() * w, rnd() * h, 5 + rnd() * 28, 2 + rnd() * 8,
        '#c77c4c', .015 + rnd() * .04);
    }
    g.globalAlpha = 1;
  }));
}

export function getPlanetEpochTexture(bodyName, surface){
  const key = planetEpochSurfaceKey(bodyName, surface);
  if (cache.has(key)) return cache.get(key);
  let texture = null;
  const profile = getPlanetEpochRecipe(bodyName, surface);
  if (profile && profile.kind === 'mars') texture = paintMarsIceScenario(surface);
  else if (profile) texture = paintAtmosphere(profile, key);
  if (texture) cache.set(key, texture);
  return texture;
}

export function evictPlanetEpochTextures(){
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}
