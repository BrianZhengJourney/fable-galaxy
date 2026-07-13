/* Procedural "exhibits" for the Cosmic Landmarks catalog. Each builder returns
   { group, update(dt), focusDist } and renders a famous object from scratch —
   no assets. The vizStyle on a catalog entry picks the builder, so different
   categories genuinely look and behave differently. */

import * as THREE from 'three';
import { mulberry, hashStr, gaussian } from '../utils/rng.js';
import { makeGlowTexture } from '../utils/textures.js';
import { dotTexture } from '../objects/starfield.js';
import { loadTexture } from '../utils/assets.js';
import { makeNoise3D } from '../utils/noise.js';
import { landmarkDepth } from '../data/landmarkDepth.js';
import { landmarkImageIR } from '../data/landmarkImagesIR.js';

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

/* ---- REAL IMAGE PLATE: a famous photograph as a flat, camera-facing billboard
   with a thin glowing frame. Used for diagram-like plates (waveforms, sky maps,
   the EHT rings) where a 3D reconstruction would misrepresent the data. ---- */
export function buildImagePlate(entry, url){
  const group = new THREE.Group();
  group.add(starDust('imgbg:' + entry.id, 520, 220, 0xaab8d8));

  const plate = new THREE.Group();
  group.add(plate);
  const H = 58;

  const mat = new THREE.MeshBasicMaterial({
    color: 0x0a1016, transparent: true, opacity: 0.001, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(H, H), mat);
  plate.add(plane);

  const frameMat = new THREE.LineBasicMaterial({ color: 0x62e6ff, transparent: true, opacity: 0.5 });
  let frame = new THREE.LineLoop(rectGeo(H, H), frameMat);
  plate.add(frame);
  const halo = glowSprite('rgba(120,180,255,.16)', 'rgba(80,130,220,.04)', 256, H * 1.7);
  halo.position.z = -6; plate.add(halo);

  let disposed = false;
  loadTexture(url, tex => {
    if (disposed) return;
    const iw = tex.image.width || 16, ih = tex.image.height || 9;
    const asp = iw / ih;
    const w = asp >= 1 ? H * asp : H, h = asp >= 1 ? H : H / asp;
    plane.geometry.dispose(); plane.geometry = new THREE.PlaneGeometry(w, h);
    mat.map = tex; mat.color.set(0xffffff); mat.opacity = 1; mat.needsUpdate = true;
    plate.remove(frame); frame.geometry.dispose();
    frame = new THREE.LineLoop(rectGeo(w, h), frameMat); plate.add(frame);
    halo.scale.set(Math.max(w, h) * 1.5, Math.max(w, h) * 1.5, 1);
  });

  let t = 0;
  return {
    group, focusDist: 74, isImage: true,
    dispose(){ disposed = true; },
    update(dt, camera){
      if (disposed) return;
      t += dt;
      if (camera) plate.quaternion.copy(camera.quaternion);   // billboard toward viewer
      plate.scale.setScalar(1 + Math.sin(t * 0.28) * 0.008);  // slow breathing
    },
  };
}

/* ---- VOLUMETRIC PHOTO: reconstruct a deep-sky photograph as a raymarched
   emission volume. A low-res 3D density field is grown from the image
   (silhouette × brightness-driven thickness × coherent 3D noise) and marched
   in a fragment shader — but each step samples the ORIGINAL full-resolution
   photo for color. Head-on, the integral reproduces the photograph almost
   exactly (nothing is lost to point sampling); orbit and it is a true glowing
   gas volume whose dust genuinely occludes the stars behind it.
   opts.depth = box thickness in world units. Falls back to a particle cloud
   when WebGL2 (sampler3D) is unavailable. */
/* per-landmark rendering tune: light = direction of the ionizing source in
   image space (x right, y up, z toward viewer), shade = shading strength,
   depthScale = how far the inferred depth spreads columns in z */
const VOLUME_TUNE = {
  // NGC 6611 sits above the pillars — their sunlit rims face up; deep column
  // separation is the point of the exhibit
  'pillars-of-creation': { light: [0.22, 0.9, 0.37], shade: 0.75, depthScale: 1.35, density: 1.05 },
};

export function buildImageVolume(entry, url, opts = {}){
  let gl2 = false;
  try{ gl2 = !!document.createElement('canvas').getContext('webgl2'); }catch(e){ /* ignore */ }
  if (!gl2) return buildParticlePhoto(entry, url, opts);
  const tune = VOLUME_TUNE[entry.id] || {};

  const group = new THREE.Group();
  group.add(starDust('volbg:' + entry.id, 440, 240, 0x9fb0d0));

  const fbm = makeNoise3D(hashStr('voln:' + entry.id));
  const H = 62;
  const depthWorld = opts.depth != null ? opts.depth : 26;

  const uniforms = {
    uVol:    { value: null },
    uImg:    { value: null },      // visible-light plate
    uImg2:   { value: null },      // aligned infrared plate (= uImg until it loads)
    uMix:    { value: 0 },         // 0 = visible, 1 = infrared
    uCamObj: { value: new THREE.Vector3(0, 0, 120) },
    uHalf:   { value: new THREE.Vector3(H/2, H/2, depthWorld/2) },
    uDensity:{ value: tune.density || 0.85 },
    uShade:  { value: tune.shade != null ? tune.shade : 0.5 },
    uLightUvw:{ value: new THREE.Vector3(0, 0.05, 0.02) },  // set properly in build()
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, glslVersion: THREE.GLSL3,
    transparent: true, depthWrite: false, side: THREE.BackSide,
    premultipliedAlpha: true,
    vertexShader: `
      out vec3 vPos;
      void main(){
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      precision highp float;
      precision highp sampler3D;
      uniform sampler3D uVol;
      uniform sampler2D uImg;
      uniform sampler2D uImg2;
      uniform float uMix;
      uniform vec3 uCamObj;
      uniform vec3 uHalf;
      uniform float uDensity;
      uniform float uShade;
      uniform vec3 uLightUvw;
      in vec3 vPos;
      out vec4 outColor;
      float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      float vnoise(vec3 p){
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash13(i),                 b = hash13(i + vec3(1,0,0));
        float c = hash13(i + vec3(0,1,0)),   d = hash13(i + vec3(1,1,0));
        float e = hash13(i + vec3(0,0,1)),   g = hash13(i + vec3(1,0,1));
        float h = hash13(i + vec3(0,1,1)),   k = hash13(i + vec3(1,1,1));
        return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
                   mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
      }
      void main(){
        vec3 rd = normalize(vPos - uCamObj);
        vec3 inv = 1.0 / rd;
        vec3 ta = (-uHalf - uCamObj) * inv, tb = (uHalf - uCamObj) * inv;
        vec3 tmin = min(ta, tb), tmax = max(ta, tb);
        float tEnter = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
        float tExit  = min(min(tmax.x, tmax.y), tmax.z);
        if (tExit <= tEnter){ outColor = vec4(0.0); return; }

        const int STEPS = 96;
        float dt = (tExit - tEnter) / float(STEPS);
        // per-pixel ray-start jitter: converts z-slice "wood-grain" banding
        // (visible edge-on) into imperceptible grain
        float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 p = uCamObj + rd * (tEnter + dt * jit);
        vec3 stepv = rd * dt;
        vec3 acc = vec3(0.0); float aAcc = 0.0;
        for (int i = 0; i < STEPS; i++){
          vec3 uvw = p / (2.0 * uHalf) + 0.5;
          // R = glowing gas, G = foreground dust; infrared sees through dust
          // (Webb's semi-transparent pillars), so its opacity fades with uMix
          vec2 gd = texture(uVol, uvw).rg;
          float d = gd.r + gd.g * (1.0 - uMix * 0.72);
          if (d > 0.01){
            // per-sample micro-structure, finer than the density texture — from
            // oblique angles the integral resolves into filaments, not mush
            float fil = vnoise(p * 0.22) * 0.65 + vnoise(p * 0.7) * 0.35;
            d *= 0.35 + 1.3 * fil * fil;
            // force mip 0: auto-LOD picks blurry mips at oblique angles because
            // uv changes fast along the ray — the classic "smeared from the side"
            vec3 cV = textureLod(uImg,  uvw.xy, 0.0).rgb;
            vec3 cI = textureLod(uImg2, uvw.xy, 0.0).rgb;
            // outside the IR frame's footprint (NIRCam's cut corners) there is
            // no IR data — fade those voxels out instead of drawing black fog
            float irOk = smoothstep(0.02, 0.09, max(cI.r, max(cI.g, cI.b)));
            d *= mix(1.0, irOk, uMix);
            vec3 c = mix(cV, cI, uMix);
            float l = dot(c, vec3(0.299, 0.587, 0.114));
            c = clamp(mix(vec3(l), c, 1.5), 0.0, 1.0);      // keep the photo's color, punched

            // single-tap shadowing toward the ionizing source: dense gas on the
            // far side of a clump falls into shadow, lit faces keep the photo's
            // brightness and pick up a warm photoevaporation rim
            vec2 gl2t = texture(uVol, uvw + uLightUvw).rg;
            float dl = gl2t.r + gl2t.g * (1.0 - uMix * 0.72);
            float lit = exp(-dl * 2.4);
            float shade = mix(1.0, 0.32 + 0.78 * lit, uShade);
            float rim = uShade * lit * smoothstep(0.10, 0.45, d);

            float a = 1.0 - exp(-d * uDensity * dt);         // Beer–Lambert step opacity
            vec3 emit = c * (0.6 + 1.6 * l) * shade
                      + c * vec3(1.12, 1.0, 0.82) * rim * 0.45;
            acc  += (1.0 - aAcc) * a * emit;
            aAcc += (1.0 - aAcc) * a;
            if (aAcc > 0.985) break;
          }
          p += stepv;
        }
        acc = acc * (1.0 + acc * 0.28) / (1.0 + acc * 0.62); // gentle filmic shoulder
        acc = pow(clamp(acc, 0.0, 1.0), vec3(0.4545));       // manual linear → sRGB
        outColor = vec4(acc, aAcc);                          // acc is already premultiplied
      }`,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(H, H, depthWorld), mat);
  box.visible = false;                                      // nothing to march until loaded
  group.add(box);

  const rnd = mulberry(hashStr('volstars:' + entry.id));
  let visStars = null, irStars = null, irTex = null, irTarget = 0;
  let volumeTex = null, visiblePlateTex = null;
  let depthImage = null, infraredImage = null;
  let disposed = false, built = false, materialDisposed = false;
  const baseMaterialDispose = mat.dispose.bind(mat);

  // The volume textures live in shader uniforms rather than material.map, so
  // the scene owner's generic traversal cannot discover them. Keep material
  // disposal idempotent: the exhibit hook releases these resources first and
  // LandmarkView may then encounter the same material during its traversal.
  mat.dispose = () => {
    if (materialDisposed) return;
    materialDisposed = true;
    if (volumeTex) volumeTex.dispose();
    if (visiblePlateTex) visiblePlateTex.dispose();
    if (irTex) irTex.dispose();
    volumeTex = null; visiblePlateTex = null; irTex = null;
    uniforms.uVol.value = null;
    uniforms.uImg.value = null;
    uniforms.uImg2.value = null;
    baseMaterialDispose();
  };

  function cancelImage(image){
    if (!image) return;
    image.onload = null;
    image.onerror = null;
    image.removeAttribute('src');
  }

  loadTexture(url, tex => {
    if (disposed) return;
    // inferred per-pixel depth (Depth-Anything, generated offline) if we have it
    const depthUrl = landmarkDepth(entry.id);
    if (depthUrl){
      const di = new Image();
      depthImage = di;
      const finishDepth = image => {
        di.onload = null; di.onerror = null;
        if (depthImage === di) depthImage = null;
        if (!disposed) build(tex, image);
      };
      di.onload = () => finishDepth(di);
      di.onerror = () => finishDepth(null);       // missing map → heuristic depth
      di.src = depthUrl;
    } else build(tex, null);
  });

  function build(tex, dimg){
    if (disposed || built) return;
    built = true;
    const img = tex.image;
    const iw = img.width || 16, ih = img.height || 9;
    const asp = iw / ih;
    const pw = asp >= 1 ? H * asp : H, ph = asp >= 1 ? H : H / asp;
    // real depth spreads structure across z, so give it a deeper box
    const DW = opts.depth != null ? opts.depth : (dimg ? 36 : depthWorld);
    box.geometry.dispose();
    box.geometry = new THREE.BoxGeometry(pw, ph, DW);
    uniforms.uHalf.value.set(pw/2, ph/2, DW/2);
    // shadow-tap direction: ~5.5 world units toward the ionizing source
    const L = tune.light || [0.25, 0.85, 0.45];
    const ln = Math.hypot(L[0], L[1], L[2]) || 1;
    uniforms.uLightUvw.value.set(
      L[0] / ln * 5.5 / pw, L[1] / ln * 5.5 / ph, L[2] / ln * 5.5 / DW);

    /* -- star-free color plate: any ray crossing a star's (x,y) would smear its
       color into a streak, so point sources are clamped against a blurred copy
       (gas is spatially extended and survives; stars don't) and re-added below
       as genuine 3D points -- */
    const imgTex = makeCleanPlate(img, iw, ih);
    visiblePlateTex = imgTex;

    // --- grow the density field from the photo (finer under a real depth map:
    // that's where silhouettes carry the exhibit) ---
    const BASE = dimg ? 160 : 128;
    const SW = asp >= 1 ? BASE : Math.max(16, Math.round(BASE * asp));
    const SH = asp >= 1 ? Math.max(16, Math.round(BASE / asp)) : BASE;
    const SD = dimg ? 56 : 48;
    const sharp = imagePixels(img, SW, SH, 0);
    const soft  = imagePixels(img, SW, SH, 3);              // blurred → smooth thickness
    const dpt   = dimg ? imagePixels(dimg, SW, SH, 2) : null;  // inferred depth, brighter = closer
    const data = new Uint8Array(SW * SH * SD * 2);          // R = gas, G = dust

    const { lumA, blurA } = lumArrays(sharp, soft, SW, SH);
    const starZ = (i) => dpt
      ? ((dpt[i] / 255) - 0.5) * DW * 0.85 + gaussian(rnd) * DW * 0.06
      : gaussian(rnd) * DW * 0.28;
    const stars = extractStars(sharp, lumA, blurA, SW, SH, pw, ph, starZ);

    for (let py = 0; py < SH; py++){
      const row = (SH - 1 - py) * SW;                       // canvas y-down → volume y-up
      for (let px = 0; px < SW; px++){
        const q = py * SW + px;
        const blur = blurA[q];

        // silhouette from the BLURRED image (extended gas only — lone stars in
        // empty sky contribute no gas), faded toward the border so the volume
        // never presents a hard box edge
        const ex = sstep(0, 0.1, px / (SW - 1)) * sstep(0, 0.1, 1 - px / (SW - 1));
        const ey = sstep(0, 0.1, py / (SH - 1)) * sstep(0, 0.1, 1 - py / (SH - 1));
        const d01 = dpt ? dpt[q * 4] / 255 : null;
        // glowing gas, plus (with a depth map) dark-but-CLOSE pixels: opaque
        // foreground dust — near-black voxels absorb, so silhouettes like the
        // pillar towers genuinely occlude the glow behind them
        const gas  = sstep(0.05, 0.26, blur * 1.1) * ex * ey;
        const dust = (dpt ? sstep(0.55, 0.85, d01) * (1 - sstep(0.06, 0.22, blur)) * 0.85 : 0) * ex * ey;
        if (gas <= 0.001 && dust <= 0.001) continue;
        // column centre: inferred depth when we have it, else noise drift;
        // thickness stays brightness-driven but slim under real depth — the
        // depth map carries the shape, and short columns shear less obliquely
        const half = dpt ? 0.06 + 0.18 * blur : 0.16 + 0.6 * blur;
        const cz = dpt
          ? (d01 - 0.5) * (tune.depthScale || 1.15) + (fbm(px * 0.02, py * 0.02, 7.7, 2) - 0.5) * 0.12
          : (fbm(px * 0.02, py * 0.02, 7.7, 2) - 0.5) * 0.5;
        for (let z = 0; z < SD; z++){
          const zn = ((z + 0.5) / SD) * 2 - 1;
          const prof = Math.exp(-Math.pow((zn - cz) / half, 2) * 1.4);
          if (prof < 0.02) continue;
          // carve the extruded column into distinct clumps with real gaps —
          // smooth density integrates to mush from oblique angles
          const n1 = fbm(px * 0.075, py * 0.075, z * 0.2, 2);    // clump placement
          const n2 = fbm(px * 0.14, py * 0.14, z * 0.3, 2);      // internal texture
          const carve = sstep(0.36, 0.52, n1) * (0.3 + 1.4 * sstep(0.34, 0.66, n2));
          const w = prof * carve, o = (z * SW * SH + row + px) * 2;
          data[o]     = Math.min(255, 255 * gas  * w) | 0;
          data[o + 1] = Math.min(255, 255 * dust * w) | 0;
        }
      }
    }
    const vol = new THREE.Data3DTexture(data, SW, SH, SD);
    volumeTex = vol;
    vol.format = THREE.RGFormat; vol.type = THREE.UnsignedByteType;
    vol.minFilter = vol.magFilter = THREE.LinearFilter;
    vol.unpackAlignment = 1; vol.needsUpdate = true;
    uniforms.uVol.value = vol;
    uniforms.uImg.value = imgTex;
    uniforms.uImg2.value = imgTex;                          // placeholder until the IR plate lands

    // the photo's stars, reborn as points inside the cloud — they parallax
    visStars = makeStarPoints(stars);
    if (visStars) box.add(visStars);

    box.visible = true;

    /* -- aligned infrared counterpart (à la the STScI Pillars 3D film): same
       geometry, second color plate; dust goes semi-transparent and the stars
       Webb reveals fade in with the wavelength mix -- */
    const ir = landmarkImageIR(entry.id);
    if (ir){
      const ii = new Image();
      infraredImage = ii;
      ii.onload = () => {
        ii.onload = null; ii.onerror = null;
        if (infraredImage === ii) infraredImage = null;
        if (disposed) return;
        irTex = makeCleanPlate(ii, ii.width, ii.height);
        uniforms.uImg2.value = irTex;
        const irSharp = imagePixels(ii, SW, SH, 0);
        const irSoft  = imagePixels(ii, SW, SH, 3);
        const a = lumArrays(irSharp, irSoft, SW, SH);
        irStars = makeStarPoints(extractStars(irSharp, a.lumA, a.blurA, SW, SH, pw, ph, starZ));
        if (irStars){ irStars.material.opacity = 0; box.add(irStars); }
      };
      ii.onerror = () => {
        ii.onload = null; ii.onerror = null;
        if (infraredImage === ii) infraredImage = null;
      };
      ii.src = ir.file;
    }
  }

  let t = 0, yaw0 = null;
  const _v = new THREE.Vector3();
  return {
    group, focusDist: 84, isImage: true,
    hasIR: !!landmarkImageIR(entry.id),
    dispose(){
      if (disposed) return;
      disposed = true;
      cancelImage(depthImage); depthImage = null;
      cancelImage(infraredImage); infraredImage = null;
      mat.dispose();
      visStars = null; irStars = null;
    },
    setIR(on){ if (!disposed) irTarget = on ? 1 : 0; },
    update(dt, camera){
      if (disposed) return;
      t += dt;
      // ease the wavelength mix toward its target; stars crossfade with it
      const mx = uniforms.uMix.value;
      if (mx !== irTarget){
        const step = Math.min(Math.abs(irTarget - mx), dt * 0.8);
        uniforms.uMix.value = mx + Math.sign(irTarget - mx) * step;
        if (visStars) visStars.material.opacity = 0.95 * (1 - uniforms.uMix.value * 0.75);
        if (irStars)  irStars.material.opacity  = 0.95 * uniforms.uMix.value;
      }
      if (camera){
        if (yaw0 === null)                                   // face the viewer once, head-on photo first
          yaw0 = Math.atan2(camera.position.x, camera.position.z);
        box.rotation.y = yaw0 + Math.sin(t * 0.05) * 0.12;   // subtle sway; orbit for the full 3D
        box.updateWorldMatrix(true, false);
        uniforms.uCamObj.value.copy(box.worldToLocal(_v.copy(camera.position)));
      }
    },
  };
}

/* star-free color plate: clamp point sources against a blurred copy (extended
   gas survives, stars don't) — the stars return as real 3D points instead */
function makeCleanPlate(img, iw, ih){
  const FW = Math.min(2048, iw), FH = Math.max(2, Math.round(FW * ih / iw));
  const fSharp = imagePixels(img, FW, FH, 0);
  const fSoft  = imagePixels(img, FW, FH, 6);
  const clean = new ImageData(FW, FH);
  for (let i = 0; i < fSharp.length; i += 4){
    clean.data[i]   = Math.min(fSharp[i],   fSoft[i]   * 1.5 + 14);
    clean.data[i+1] = Math.min(fSharp[i+1], fSoft[i+1] * 1.5 + 14);
    clean.data[i+2] = Math.min(fSharp[i+2], fSoft[i+2] * 1.5 + 14);
    clean.data[i+3] = 255;
  }
  const cc = document.createElement('canvas'); cc.width = FW; cc.height = FH;
  cc.getContext('2d').putImageData(clean, 0, 0);
  const tex = new THREE.CanvasTexture(cc);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

function lumArrays(sharp, soft, SW, SH){
  const lumA = new Float32Array(SW * SH), blurA = new Float32Array(SW * SH);
  for (let q = 0; q < SW * SH; q++){
    const i = q * 4;
    lumA[q]  = (0.299*sharp[i] + 0.587*sharp[i+1] + 0.114*sharp[i+2]) / 255;
    blurA[q] = (0.299*soft[i]  + 0.587*soft[i+1]  + 0.114*soft[i+2])  / 255;
  }
  return { lumA, blurA };
}

/* a star is an isolated local max on a dark background — bright pillar RIMS
   also have contrast vs. blur, but their blurred surroundings are bright, so
   require blur < 0.5; cap by contrast so rims never bead with dots */
function extractStars(sharp, lumA, blurA, SW, SH, pw, ph, starZ){
  const cand = [];
  for (let py = 1; py < SH - 1; py++)
    for (let px = 1; px < SW - 1; px++){
      const q = py * SW + px, L = lumA[q], B = blurA[q];
      if (L - B < 0.12 || L < 0.35 || B > 0.5) continue;
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++)
        for (let dx = -1; dx <= 1; dx++){
          if (!dx && !dy) continue;
          if (lumA[(py+dy) * SW + px+dx] > L){ isMax = false; break; }
        }
      if (isMax) cand.push({ px, py, c: L - B });
    }
  cand.sort((a, b) => b.c - a.c);
  const pos = [], col = [];
  for (const s of cand.slice(0, 300)){
    const i = (s.py * SW + s.px) * 4;
    pos.push((s.px / (SW - 1) - 0.5) * pw, -(s.py / (SH - 1) - 0.5) * ph, starZ(i));
    const bb = 0.8 + 0.5 * lumA[s.py * SW + s.px];
    col.push(
      Math.min(1, sharp[i]/255 * bb + 0.12),
      Math.min(1, sharp[i+1]/255 * bb + 0.12),
      Math.min(1, sharp[i+2]/255 * bb + 0.12));
  }
  return { pos, col };
}

function makeStarPoints(stars){
  if (!stars.pos.length) return null;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(stars.pos), 3));
  sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(stars.col), 3));
  return new THREE.Points(sg, new THREE.PointsMaterial({
    size: 1.4, vertexColors: true, transparent: true, opacity: 0.95,
    map: dotTexture(), alphaTest: 0.02,
    blending: THREE.AdditiveBlending, depthWrite: false }));
}

/* draw an image into an offscreen canvas (optionally blurred) and grab pixels */
function imagePixels(img, w, h, blurPx){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (blurPx) g.filter = 'blur(' + blurPx + 'px)';
  g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

function sstep(a, b, x){
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/* WebGL1 fallback: the photo as a 3D cloud of colored particles */
function buildParticlePhoto(entry, url, opts = {}){
  const group = new THREE.Group();
  group.add(starDust('volbg:' + entry.id, 440, 240, 0x9fb0d0));
  const cloud = new THREE.Group();
  group.add(cloud);

  // soft backlight so the cloud reads as lit while it streams in
  const back = glowSprite('rgba(120,170,255,.10)', 'rgba(70,120,210,.03)', 256, 120);
  back.position.z = -46; cloud.add(back);

  const rnd = mulberry(hashStr('vol:' + entry.id));
  const fbm = makeNoise3D(hashStr('voln:' + entry.id));
  const H = 62;
  const depth = opts.depth != null ? opts.depth : 30;
  const invert = opts.invert ? 1 : 0;
  let disposed = false;

  loadTexture(url, tex => {
    if (disposed) return;
    const img = tex.image;
    const iw = img.width || 16, ih = img.height || 9;
    const s = Math.min(1, 300 / Math.max(iw, ih));         // cap sampling resolution
    const cw = Math.max(2, Math.round(iw * s)), ch = Math.max(2, Math.round(ih * s));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, cw, ch);
    const data = g.getImageData(0, 0, cw, ch).data;

    const asp = iw / ih;
    const pw = asp >= 1 ? H * asp : H, ph = asp >= 1 ? H : H / asp;
    const cellX = pw / cw, cellY = ph / ch;

    const pos = [], col = [];
    for (let py = 0; py < ch; py++){
      for (let px = 0; px < cw; px++){
        const i = (py * cw + px) * 4;
        const r = data[i] / 255, gg = data[i+1] / 255, b = data[i+2] / 255;
        const lum = 0.299*r + 0.587*gg + 0.114*b;
        if (lum < 0.07) continue;                           // drop empty space → real silhouette
        const x = (px / (cw - 1) - 0.5) * pw;
        const y = -(py / (ch - 1) - 0.5) * ph;
        const d = invert ? 1 - lum : lum;
        // coherent depth: brightness bulge + low-frequency undulation, so an
        // orbit past the side reads as a rolling cloud rather than a flat slab
        const wob = (fbm(px * 0.035, py * 0.035, 0, 3) - 0.5) * depth * 0.6;
        const zc = (d - 0.5) * depth + wob;
        // punch saturation so the cloud keeps the photo's vivid gold/teal instead
        // of washing to white where many additive points overlap
        const sat = 1.7, cr = clamp01(lum + (r - lum) * sat),
              cg = clamp01(lum + (gg - lum) * sat), cb = clamp01(lum + (b - lum) * sat);
        const k = lum > 0.5 ? 2 : 1;                        // brighter gas = denser
        for (let j = 0; j < k; j++){
          const thick = (0.2 + lum) * depth * 0.3;
          pos.push(
            x + gaussian(rnd) * cellX * 0.7,
            y + gaussian(rnd) * cellY * 0.7,
            zc + gaussian(rnd) * thick);
          const br = 0.6 + rnd() * 0.5;
          col.push(cr * br, cg * br, cb * br);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    cloud.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.5, vertexColors: true, transparent: true, opacity: 0.72,
      map: dotTexture(), alphaTest: 0.02, sizeAttenuation: true,
      blending: THREE.AdditiveBlending, depthWrite: false })));
  });

  let t = 0;
  return {
    group, focusDist: 84, isImage: true,
    dispose(){ disposed = true; },
    update(dt){
      if (disposed) return;
      t += dt;
      cloud.rotation.y = Math.sin(t * 0.09) * 0.4;          // gentle sway reveals the depth
    },
  };
}

function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }

function rectGeo(w, h){
  const x = w/2, y = h/2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -x,-y,0,  x,-y,0,  x,y,0,  -x,y,0 ]), 3));
  return g;
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
