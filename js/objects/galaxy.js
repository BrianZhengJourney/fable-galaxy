/* The Milky Way, procedurally: ~80k stars distributed along logarithmic
   spiral arms plus a bulge and halo, rendered with a custom point shader
   (per-star size + color, soft falloff, additive). Dust lanes and nebulae
   are cheap smoke sprites. Catalog stars get glow sprites + pick spheres. */

import * as THREE from 'three';
import { mulberry, gaussian, weighted } from '../utils/rng.js';
import { makeGlowTexture, makeSmokeTexture } from '../utils/textures.js';
import { STAR_CATALOG, starColor } from '../data/starCatalog.js';

const GALAXY_R = 520;
const ARMS = 4;
const TWIST = 0.0105;            // radians of spiral wind-up per unit radius

// stellar population: [ [r,g,b, sizeMul], weight ]  (M dwarfs common, O rare)
const POPULATION = [
  [[1.00, 0.62, 0.44, 0.7], 32],   // M
  [[1.00, 0.78, 0.54, 0.8], 22],   // K
  [[1.00, 0.94, 0.82, 0.9], 18],   // G
  [[1.00, 0.99, 0.94, 1.0], 12],   // F
  [[0.88, 0.92, 1.00, 1.2], 9],    // A
  [[0.72, 0.82, 1.00, 1.5], 5],    // B
  [[0.62, 0.74, 1.00, 2.0], 2]     // O
];

const VERT = `
  attribute float size;
  varying vec3 vColor;
  void main(){
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(size * (320.0 / -mv.z), 1.1, 11.0);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  varying vec3 vColor;
  void main(){
    float d = length(gl_PointCoord - vec2(0.5));
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vColor, a);
  }`;

export function buildGalaxy(){
  const group = new THREE.Group();
  const rnd = mulberry(777001);

  /* ---- star points ---- */
  const N = 80000;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  for (let i = 0; i < N; i++){
    let x, y, z, roll = rnd();
    if (roll < 0.72){
      // spiral arm star: pick radius, wind angle along a log-ish spiral
      const r = 40 + Math.pow(rnd(), 0.72) * (GALAXY_R - 40);
      const arm = (rnd() * ARMS) | 0;
      const armBase = arm * (2 * Math.PI / ARMS);
      // scatter tightens toward the arm ridge with distance from core
      const scatter = gaussian(rnd) * (0.28 - 0.14 * (r / GALAXY_R)) * Math.PI;
      const th = armBase + r * TWIST + scatter;
      x = Math.cos(th) * r; z = Math.sin(th) * r;
      y = gaussian(rnd) * (9 - 5 * (r / GALAXY_R));
    } else if (roll < 0.92){
      // central bulge
      const r = Math.pow(rnd(), 2.2) * 90;
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      x = s * Math.cos(a) * r; z = s * Math.sin(a) * r;
      y = u * r * 0.55;
    } else {
      // thin disc / halo scatter
      const r = Math.pow(rnd(), 0.5) * GALAXY_R;
      const a = rnd() * Math.PI * 2;
      x = Math.cos(a) * r; z = Math.sin(a) * r;
      y = gaussian(rnd) * 16;
    }
    pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
    const [cr, cg, cb, sm] = weighted(rnd, POPULATION);
    const dim = 0.5 + rnd() * 0.5;
    col[i*3] = cr * dim; col[i*3+1] = cg * dim; col[i*3+2] = cb * dim;
    size[i] = sm * (0.8 + rnd() * 1.4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const starPoints = new THREE.Points(geo, new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(starPoints);

  /* ---- galactic core glow ---- */
  const coreSpecs = [
    { tex: makeGlowTexture('rgba(255,244,220,1)', 'rgba(255,205,140,.5)'), s: 110 },
    { tex: makeGlowTexture('rgba(255,225,180,.7)', 'rgba(255,175,110,.18)'), s: 240 }
  ];
  for (const cs of coreSpecs){
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cs.tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    sp.scale.set(cs.s, cs.s, 1);
    group.add(sp);
  }

  /* ---- dust lanes (dark) and nebulae (tinted) along the arms ---- */
  const dustTex = makeSmokeTexture('dust', '4,6,12');
  const nebTexes = [
    makeSmokeTexture('neb-red', '210,90,120'),
    makeSmokeTexture('neb-blue', '90,150,230'),
    makeSmokeTexture('neb-teal', '90,210,220')
  ];
  for (let i = 0; i < 140; i++){
    const r = 60 + Math.pow(rnd(), 0.8) * (GALAXY_R - 80);
    const arm = (rnd() * ARMS) | 0;
    const th = arm * (2 * Math.PI / ARMS) + r * TWIST + gaussian(rnd) * 0.16 * Math.PI;
    const isDust = rnd() < 0.62;
    const mat = new THREE.SpriteMaterial({
      map: isDust ? dustTex : nebTexes[(rnd() * nebTexes.length) | 0],
      transparent: true, depthWrite: false,
      blending: isDust ? THREE.NormalBlending : THREE.AdditiveBlending,
      opacity: isDust ? 0.42 : 0.5
    });
    const sp = new THREE.Sprite(mat);
    const s = isDust ? 32 + rnd() * 50 : 20 + rnd() * 36;   // sized to bound sprite overdraw
    sp.scale.set(s, s * (0.5 + rnd() * 0.5), 1);
    sp.position.set(Math.cos(th) * r, gaussian(rnd) * 4, Math.sin(th) * r);
    group.add(sp);
  }

  /* ---- catalog stars: glow sprite + pick sphere ---- */
  const catalog = [];
  const pickGeo = new THREE.SphereGeometry(6, 8, 6);
  for (const rec of STAR_CATALOG){
    const rgb = starColor(rec.temp);
    const css = Math.round(rgb[0]*255) + ',' + Math.round(rgb[1]*255) + ',' + Math.round(rgb[2]*255);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,255,255,1)', 'rgba(' + css + ',.6)', 128),
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    const glowSize = rec.sol ? 8 : Math.min(11, 5 + Math.log10(rec.lum + 1.001) * 1.8);
    sp.scale.set(glowSize, glowSize, 1);
    sp.position.set(rec.pos[0], rec.pos[1], rec.pos[2]);
    group.add(sp);

    const pick = new THREE.Mesh(pickGeo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    pick.position.copy(sp.position);
    const entry = { rec, sprite: sp, pick, name: rec.name,
                    position: sp.position, isCatalogStar: true };
    pick.userData.body = entry;
    group.add(pick);
    catalog.push(entry);
  }

  return {
    group, starPoints, catalog,
    radius: GALAXY_R,
    update(dt){ group.rotation.y += dt * 0.0035; }   // stately galactic spin
  };
}
