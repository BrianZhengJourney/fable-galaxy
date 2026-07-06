/* Procedural "exhibits" for the Cosmic Landmarks catalog. Each builder returns
   { group, update(dt), focusDist } and renders a famous object from scratch —
   no assets. The vizStyle on a catalog entry picks the builder, so different
   categories genuinely look and behave differently. */

import * as THREE from 'three';
import { mulberry, hashStr, gaussian } from '../utils/rng.js';
import { makeGlowTexture } from '../utils/textures.js';
import { dotTexture } from '../objects/starfield.js';

function glowSprite(inner, mid, size, scale){
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(inner, mid, size || 128),
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  sp.scale.set(scale, scale, 1);
  return sp;
}

/* soft round cloud texture that fades fully to zero at the edge (no square
   sprite bounds), cached per rgb string */
const _cloudCache = new Map();
function cloudTex(rgb){
  if (_cloudCache.has(rgb)) return _cloudCache.get(rgb);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(' + rgb + ',0.9)');
  grd.addColorStop(0.4, 'rgba(' + rgb + ',0.35)');
  grd.addColorStop(1, 'rgba(' + rgb + ',0)');
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI*2); g.fill();
  const t = new THREE.CanvasTexture(c);
  _cloudCache.set(rgb, t);
  return t;
}

/* embedded / background star field — round sprite points, not GL squares */
function starDust(seed, n, spread, color){
  const rnd = mulberry(hashStr(seed));
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const base = new THREE.Color(color || 0xffffff);
  for (let i = 0; i < n; i++){
    pos[i*3] = (rnd()-0.5)*spread; pos[i*3+1] = (rnd()-0.5)*spread; pos[i*3+2] = (rnd()-0.5)*spread;
    const b = 0.4 + rnd()*rnd()*0.6;
    col[i*3] = base.r*b; col[i*3+1] = base.g*b; col[i*3+2] = base.b*b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.9, vertexColors: true, transparent: true, opacity: 0.9,
    map: dotTexture(), alphaTest: 0.02,
    blending: THREE.AdditiveBlending, depthWrite: false }));
}

/* ---- NEBULA: volumetric HII glow + dark dust pillars + embedded stars ---- */
export function buildNebula(entry){
  const group = new THREE.Group();
  const rnd = mulberry(hashStr('neb:' + entry.id));
  const tint = entry.tint || [ '210,90,120', '120,150,230', '90,200,190', '200,120,90' ];
  const pillars = /pillar|eagle|carina|horsehead|lagoon|orion/i.test(entry.id + entry.name);

  // volumetric HII glow — many soft, edge-faded additive clouds, spread out so
  // the centre doesn't saturate to white
  for (let i = 0; i < 90; i++){
    const rgb = tint[(rnd()*tint.length)|0];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex(rgb), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.10 + rnd()*0.14 }));
    const s = 16 + rnd()*40;
    sp.scale.set(s, s*(0.6+rnd()*0.7), 1);
    sp.position.set(gaussian(rnd)*50, gaussian(rnd)*34, gaussian(rnd)*34);
    sp.material.rotation = rnd()*Math.PI;
    group.add(sp);
  }
  // dark dust pillars — soft-edged normal-blended clumps that occlude the glow
  if (pillars){
    for (let p = 0; p < 3; p++){
      const col = new THREE.Group();
      const baseX = (p-1)*15 + gaussian(rnd)*3;
      const h = 40 + rnd()*18;
      for (let k = 0; k < 18; k++){
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: cloudTex('14,8,18'), transparent: true, depthWrite: false,
          blending: THREE.NormalBlending, opacity: 0.5 }));
        const w = (13 - k*0.5) * (0.85 + rnd()*0.4);
        sp.scale.set(w, 9, 1);
        sp.position.set(gaussian(rnd)*2.5, -20 + k*(h/18), gaussian(rnd)*2.5);
        col.add(sp);
      }
      col.position.x = baseX;
      col.rotation.z = gaussian(rnd)*0.12;
      col.renderOrder = 2;
      group.add(col);
    }
  }
  // newborn stars sprinkled in the cloud + a few bright ones
  group.add(starDust('nebstars:' + entry.id, 420, 96, 0xfff0e0));
  for (let i = 0; i < 5; i++){
    const sp = glowSprite('rgba(255,255,255,1)', 'rgba(180,210,255,.45)', 128, 2.5 + rnd()*2.5);
    sp.position.set(gaussian(rnd)*42, gaussian(rnd)*24, gaussian(rnd)*22);
    group.add(sp);
  }
  return { group, update(){}, focusDist: 95 };
}

/* ---- SUPERNOVA REMNANT: expanding filament shell + bright knots ---- */
export function buildRemnant(entry){
  const group = new THREE.Group();
  const rnd = mulberry(hashStr('rem:' + entry.id));
  const crab = /crab|1054/i.test(entry.id + entry.name);
  const N = 4200;
  const pos = new Float32Array(N*3), col = new Float32Array(N*3);
  const seeds = [];
  const c1 = new THREE.Color(crab ? 0x8a7bff : 0xff9a5a);
  const c2 = new THREE.Color(crab ? 0xff6a8a : 0x9ad8ff);
  for (let i = 0; i < N; i++){
    // shell with filamentary clumping
    const u = rnd()*2-1, a = rnd()*Math.PI*2, s = Math.sqrt(1-u*u);
    const rr = 24 * (0.82 + Math.pow(rnd(),3)*0.4);
    const fil = 1 + gaussian(rnd)*0.25;
    const dir = new THREE.Vector3(s*Math.cos(a), u*0.7, s*Math.sin(a));
    seeds.push({ dir, r: rr*fil, spin: (rnd()-0.5)*0.4 });
    const cc = c1.clone().lerp(c2, rnd());
    col[i*3]=cc.r; col[i*3+1]=cc.g; col[i*3+2]=cc.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.5, vertexColors: true, transparent: true, opacity: 0.8,
    map: makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.4)', 64),
    blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(points);
  // central pulsar / core glow
  group.add(glowSprite('rgba(220,235,255,1)', 'rgba(120,180,255,.5)', 128, crab ? 3 : 2));
  group.add(starDust('remstars:' + entry.id, 300, 120, 0xdfeaff));

  let t = 0;
  return { group, focusDist: 78, update(dt){
    t += dt; const arr = geo.attributes.position.array;
    // gentle continuing expansion + drift so it feels alive
    const breath = 1 + Math.sin(t*0.15)*0.015;
    for (let i = 0; i < seeds.length; i++){
      const sd = seeds[i], r = sd.r*breath;
      arr[i*3]=sd.dir.x*r; arr[i*3+1]=sd.dir.y*r; arr[i*3+2]=sd.dir.z*r;
    }
    geo.attributes.position.needsUpdate = true;
    group.rotation.y += dt*0.02;
  }};
}

/* ---- BLACK HOLE: horizon + accretion disk + photon ring (+ lensing arc) ---- */
export function buildBlackHole(entry, strongLensing){
  const group = new THREE.Group();
  const R = 8;
  group.add(new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 })));

  const diskTex = radialTex([
    [0.0,'rgba(0,0,0,0)'],[0.30,'rgba(0,0,0,0)'],[0.34,'rgba(255,248,235,.95)'],
    [0.46,'rgba(255,190,110,.6)'],[0.74,'rgba(255,120,50,.2)'],[1.0,'rgba(120,40,20,0)']]);
  const disk = new THREE.Mesh(new THREE.PlaneGeometry(R*9, R*9),
    new THREE.MeshBasicMaterial({ map: diskTex, transparent: true, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  disk.rotation.x = -Math.PI/2 + 0.32;
  group.add(disk);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff0d8, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const photon = new THREE.Mesh(new THREE.TorusGeometry(R*1.12, R*0.03, 8, 96), ringMat);
  photon.rotation.x = -Math.PI/2 + 0.32; group.add(photon);
  // the vertical lensed arc (the "Interstellar" halo) — stronger for M87*/lensing
  const lensed = new THREE.Mesh(new THREE.TorusGeometry(R*1.4, R*0.022, 8, 96), ringMat.clone());
  lensed.material.opacity = strongLensing ? 0.75 : 0.32; group.add(lensed);

  const halo = glowSprite('rgba(255,200,140,.4)', 'rgba(255,140,60,.12)', 256, R*9);
  group.add(halo);
  group.add(starDust('bhstars:' + entry.id, 260, 150, 0xdfe6ff));

  let t = 0;
  return { group, focusDist: 46, update(dt){ t += dt; disk.rotation.z = t*0.25; } };
}

/* ---- GRAVITATIONAL WAVE: two black holes inspiral + expanding ripples ---- */
export function buildGravWave(entry){
  const group = new THREE.Group();
  const bhs = [0,1].map(() => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000 })));
    g.add(glowSprite('rgba(180,150,255,.6)','rgba(120,90,220,.15)',128, 9));
    group.add(g); return g;
  });
  // expanding ripple rings on the orbital plane
  const rings = [];
  for (let i = 0; i < 5; i++){
    const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.15, 96),
      new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.4,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI/2; group.add(m); rings.push(m);
  }
  const flash = glowSprite('rgba(230,240,255,1)','rgba(150,190,255,.5)',128, 1);
  flash.material.opacity = 0; group.add(flash);
  group.add(starDust('gwstars:' + entry.id, 300, 150, 0xdfeaff));

  let t = 0, cycle = 6;
  return { group, focusDist: 60, update(dt){
    t += dt; const ph = (t % cycle) / cycle;           // 0→1 inspiral, then merge flash
    const sep = 20 * (1 - ph) + 3;
    const om = 0.6 + (1-ph)* -0 + ph*5;                 // faster as they close
    const ang = t * (1 + ph*4);
    bhs[0].position.set(Math.cos(ang)*sep, 0, Math.sin(ang)*sep);
    bhs[1].position.set(-Math.cos(ang)*sep, 0, -Math.sin(ang)*sep);
    rings.forEach((r, i) => {
      const rp = ((t*0.5 + i/rings.length) % 1);
      const rr = 4 + rp*70; r.scale.set(rr, rr, 1);
      r.material.opacity = 0.4 * (1-rp);
    });
    flash.material.opacity = ph > 0.94 ? (ph-0.94)/0.06 * 0.9 : Math.max(0, flash.material.opacity - dt*3);
    const fs = 6 + (ph>0.94? (ph-0.94)*400 : 0); flash.scale.set(fs, fs, 1);
  }};
}

/* ---- distant GALAXY exhibit: a small procedural spiral ---- */
export function buildGalaxyExhibit(entry){
  const group = new THREE.Group();
  const rnd = mulberry(hashStr('gx:' + entry.id));
  const N = 9000, arms = 2 + ((rnd()*3)|0), twist = 0.35 + rnd()*0.25;
  const pos = new Float32Array(N*3), col = new Float32Array(N*3);
  const warm = new THREE.Color(0xffe6c0), cool = new THREE.Color(0x9fc0ff);
  for (let i = 0; i < N; i++){
    let x,y,z;
    if (rnd() < 0.78){
      const r = 4 + Math.pow(rnd(),0.7)*40;
      const arm = (rnd()*arms)|0;
      const th = arm*(2*Math.PI/arms) + r*twist + gaussian(rnd)*(0.35 - r*0.005);
      x = Math.cos(th)*r; z = Math.sin(th)*r; y = gaussian(rnd)*(3 - r*0.05);
    } else {
      const r = Math.pow(rnd(),2)*10, u=rnd()*2-1, a=rnd()*Math.PI*2, s=Math.sqrt(1-u*u);
      x = s*Math.cos(a)*r; z = s*Math.sin(a)*r; y = u*r*0.5;
    }
    pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
    const cc = warm.clone().lerp(cool, Math.min(1, Math.hypot(x,z)/40));
    const b = 0.4 + rnd()*0.6; col[i*3]=cc.r*b; col[i*3+1]=cc.g*b; col[i*3+2]=cc.b*b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  group.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 0.9,
    map: makeGlowTexture('rgba(255,255,255,1)','rgba(255,255,255,.4)',64),
    blending: THREE.AdditiveBlending, depthWrite: false })));
  group.add(glowSprite('rgba(255,244,220,1)','rgba(255,200,140,.4)',256, 22));
  group.rotation.x = 0.5;
  return { group, focusDist: 90, update(dt){ group.rotation.y += dt*0.03; } };
}

/* ---- HUBBLE DEEP FIELD: a void scattered with tiny distant galaxies ---- */
export function buildDeepField(entry){
  const group = new THREE.Group();
  const rnd = mulberry(hashStr('df:' + (entry ? entry.id : 'hudf')));
  const tints = ['rgba(255,220,180,', 'rgba(200,220,255,', 'rgba(255,200,210,', 'rgba(210,255,230,'];
  for (let i = 0; i < 220; i++){
    const t = tints[(rnd()*tints.length)|0];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,255,255,.9)', t + (0.4+rnd()*0.4).toFixed(2) + ')', 64),
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    const s = 0.6 + rnd()*rnd()*3.4;
    sp.scale.set(s, s*(0.5+rnd()*0.6), 1);
    sp.position.set((rnd()-0.5)*120, (rnd()-0.5)*120, (rnd()-0.5)*90 - 20);
    group.add(sp);
  }
  return { group, focusDist: 70, update(){} };
}

/* ---- PALE BLUE DOT / probe: a dark field, one tiny blue mote in a sunbeam ---- */
export function buildProbe(entry){
  const group = new THREE.Group();
  group.add(starDust('probe:' + entry.id, 260, 150, 0xcfe0ff));
  // scattered-light beam
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(120, 10),
    new THREE.MeshBasicMaterial({ map: makeGlowTexture('rgba(255,240,210,.25)','rgba(255,220,170,.06)',128),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.z = 0.4; group.add(beam);
  const dot = glowSprite('rgba(150,190,255,1)', 'rgba(90,140,255,.5)', 64, 1.1);
  dot.position.set(8, 3, 0); group.add(dot);
  return { group, focusDist: 60, update(){} };
}

/* ---- fallback ambient exhibit for 'card' / unrenderable styles ---- */
export function buildAmbient(entry){
  const group = new THREE.Group();
  group.add(starDust('amb:' + (entry ? entry.id : 'x'), 500, 160, 0xbfd4ff));
  group.add(glowSprite('rgba(120,200,255,.25)', 'rgba(80,140,220,.05)', 256, 60));
  return { group, focusDist: 80, update(){} };
}

function radialTex(stops){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128,128,0,128,128,128);
  for (const [p, col] of stops) grd.addColorStop(p, col);
  g.fillStyle = grd; g.fillRect(0,0,256,256);
  return new THREE.CanvasTexture(c);
}

/* pick a builder by vizStyle */
export function buildExhibit(entry){
  switch (entry.vizStyle){
    case 'nebula':    return buildNebula(entry);
    case 'remnant':
    case 'supernova': return buildRemnant(entry);
    case 'blackhole': return buildBlackHole(entry, false);
    case 'lensing':   return buildBlackHole(entry, true);
    case 'gwave':     return buildGravWave(entry);
    case 'galaxy':    return buildGalaxyExhibit(entry);
    case 'deepfield': return buildDeepField(entry);
    case 'probe':     return buildProbe(entry);
    case 'pulsar':    return buildRemnant(entry);
    default:          return buildAmbient(entry);
  }
}
