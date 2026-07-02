/* Background dressing for system views: a distant star sphere and a slowly
   drifting dust disc for parallax depth. */

import * as THREE from 'three';
import { mulberry, hashStr } from '../utils/rng.js';

export function buildStarSphere(seed = 'stars'){
  const N = 3200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const rnd = mulberry(hashStr(seed));
  for (let i = 0; i < N; i++){
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u), rad = 420 + rnd() * 380;
    pos[i*3]   = s * Math.cos(a) * rad;
    pos[i*3+1] = u * rad;
    pos[i*3+2] = s * Math.sin(a) * rad;
    const b = 0.25 + rnd() * rnd() * 0.75, warm = rnd();
    col[i*3]   = b * (warm > 0.8 ? 1.0 : 0.85);
    col[i*3+1] = b * 0.92;
    col[i*3+2] = b * (warm > 0.8 ? 0.8 : 1.0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.95, depthWrite: false }));
}

export function buildDust(extent, seed = 'dust'){
  const N = 650, pos = new Float32Array(N * 3);
  const rnd = mulberry(hashStr(seed));
  for (let i = 0; i < N; i++){
    const r = 9 + Math.pow(rnd(), 0.7) * extent, a = rnd() * Math.PI * 2;
    pos[i*3]   = Math.cos(a) * r;
    pos[i*3+1] = (rnd() - 0.5) * 7;
    pos[i*3+2] = Math.sin(a) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    color: 0x7fd8ee, size: 0.35, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false }));
}
