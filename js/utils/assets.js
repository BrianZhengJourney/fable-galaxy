/* Async texture loader with cache + graceful failure. Planets build with a
   procedural canvas texture (instant, never a black screen), then swap in a
   real image once it arrives; if the fetch fails the procedural stays. */

import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();
const pending = new Map();
let generation = 0;

/* Free every cached real-imagery texture (the heavy 8K/PBR maps). Called when
   leaving a system so ~1 GB of Sol VRAM doesn't stay resident for the whole
   session; returning re-decodes from the browser's HTTP cache (no re-download).
   Procedural exoplanet worlds use canvas textures that never enter this cache. */
export function evictTextures(){
  generation += 1;
  pending.clear();
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

export function loadTexture(path, onLoad, { srgb = true } = {}){
  const cached = cache.get(path);
  if (cached){ onLoad(cached); return; }
  const inFlight = pending.get(path);
  if (inFlight){
    inFlight.callbacks.push({ onLoad, srgb });
    return;
  }
  const request = {
    generation,
    callbacks: [{ onLoad, srgb }],
  };
  pending.set(path, request);
  loader.load(
    path,
    tex => {
      if (pending.get(path) !== request || request.generation !== generation){
        tex.dispose();
        return;
      }
      pending.delete(path);
      if (request.callbacks.some(callback => callback.srgb) && 'colorSpace' in tex)
        tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;                     // sharper at oblique/low-orbit angles
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      cache.set(path, tex);
      for (const callback of request.callbacks) callback.onLoad(tex);
    },
    undefined,
    () => {
      if (pending.get(path) === request) pending.delete(path);
      /* keep the procedural texture — never a black planet */
    }
  );
}
