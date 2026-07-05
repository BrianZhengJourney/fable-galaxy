/* Night-sky mode: stand on Earth and see the real sky for the simulation
   date. 6,000 HYG stars and the IAU constellation figures ride a single
   equatorial group whose matrix is the horizontal transform for the
   observer's latitude and the current sidereal time; the Sun, Moon and
   planets are placed geocentrically from the same ephemerides that drive
   the orrery. Fast-forward and the sky wheels. */

import * as THREE from 'three';
import { STARS, STAR_NAMES } from '../data/gen/brightStars.js';
import { CONSTELLATION_LINES } from '../data/gen/constellations.js';
import { ciToTemp } from '../objects/galaxy.js';
import { starColor } from '../data/starCatalog.js';
import { julianDate } from '../data/ephemeris.js';
import { makeGlowTexture } from '../utils/textures.js';
import {
  OBSERVER, lst, horizontalBasis, raDecToVec, planetGeo, sunGeo, moonGeo, altAz
} from '../core/astro.js';

const R_STARS = 800, R_LINES = 795, R_BODIES = 760;
const EPOCH_MS = Date.UTC(2026, 6, 2);   // matches TimeSystem.EPOCH

const STAR_VERT = `
  attribute float size;
  varying vec3 vColor;
  uniform float fade;
  void main(){
    vColor = color * fade;
    gl_PointSize = size;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const STAR_FRAG = `
  varying vec3 vColor;
  void main(){
    float d = length(gl_PointCoord - vec2(0.5));
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.08, d));
  }`;

const PLANET_TINTS = {
  MERCURY: 0xcfc4b8, VENUS: 0xfff2dc, MARS: 0xffb08a,
  JUPITER: 0xffe8c8, SATURN: 0xf0dcae
};

export class SkyView {
  constructor(labelManager){
    this.labels = labelManager;
    this.scene = new THREE.Scene();
    this.skyGroup = new THREE.Group();
    this.skyGroup.matrixAutoUpdate = false;
    this.scene.add(this.skyGroup);

    /* ---- star dome (equatorial frame) ---- */
    const idx = [];
    for (let i = 0; i < STARS.mag.length; i++) if (STARS.mag[i] <= 6.2) idx.push(i);
    const n = idx.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3),
          size = new Float32Array(n);
    idx.forEach((si, i) => {
      const v = raDecToVec(STARS.ra[si], STARS.dec[si], R_STARS);
      pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;
      const [cr, cg, cb] = starColor(ciToTemp(STARS.ci[si]));
      const bright = Math.max(0.38, Math.min(1, 1.2 - STARS.mag[si] * 0.13));
      col[i*3] = cr * bright; col[i*3+1] = cg * bright; col[i*3+2] = cb * bright;
      size[i] = Math.max(2.0, Math.min(10, 6.4 - STARS.mag[si] * 1.1));
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      uniforms: { fade: { value: 1 } },
      vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.skyGroup.add(new THREE.Points(geo, this.starMat));

    /* named-star labels (a curated handful, else the sky is a word cloud) */
    const WANT_LABELS = new Set(['Sirius', 'Vega', 'Arcturus', 'Betelgeuse', 'Rigel',
      'Polaris', 'Capella', 'Altair', 'Deneb', 'Antares', 'Aldebaran', 'Spica',
      'Procyon', 'Fomalhaut', 'Regulus', 'Pollux']);
    for (const [i, name] of Object.entries(STAR_NAMES)){
      if (!WANT_LABELS.has(name)) continue;
      const v = raDecToVec(STARS.ra[i], STARS.dec[i], R_STARS);
      const local = new THREE.Vector3(v.x, v.y, v.z);
      const entry = this.labels.add(name.toUpperCase(),
        out => out.copy(local).applyMatrix4(this.skyGroup.matrix),
        { fadeDist: 1e6, cls: 'star' });
      entry.el.style.opacity = 0.4;
    }

    /* ---- constellation figures ---- */
    const segs = [];
    for (const line of CONSTELLATION_LINES)
      for (let i = 0; i + 1 < line.length; i++){
        const a = raDecToVec(line[i][0], line[i][1], R_LINES);
        const b = raDecToVec(line[i + 1][0], line[i + 1][1], R_LINES);
        segs.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
    this.conLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      color: 0x2a7a94, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    this.skyGroup.add(this.conLines);

    /* ---- Sun, Moon, planets (repositioned every update) ---- */
    this.bodies = [];
    const mkBody = (name, colorHex, scale) => {
      const c = new THREE.Color(colorHex);
      const rgb = [c.r, c.g, c.b].map(v => Math.round(v * 255)).join(',');
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture('rgba(255,255,255,1)', 'rgba(' + rgb + ',.55)', 128),
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      sp.scale.set(scale, scale, 1);
      this.skyGroup.add(sp);
      const entry = this.labels.add(name,
        out => sp.getWorldPosition(out), { fadeDist: 1e6, cls: 'star' });
      this.bodies.push({ name, sprite: sp, labelEntry: entry });
      return sp;
    };
    this.sun = mkBody('SOL', 0xfff0c8, 90);
    this.moon = mkBody('LUNA', 0xdde8f0, 60);
    for (const p of ['MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN'])
      mkBody(p, PLANET_TINTS[p], p === 'VENUS' || p === 'JUPITER' ? 26 : 18);

    /* ---- ground plane + horizon ---- */
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2000, 64),
      new THREE.MeshBasicMaterial({ color: 0x03070b }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    this.scene.add(ground);

    /* sky gradient dome: night ↔ day blended by sun altitude */
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: {
        day: { value: 0 },
        nightZen: { value: new THREE.Color(0x000208) },
        nightHor: { value: new THREE.Color(0x0a1622) },
        dayZen: { value: new THREE.Color(0x3f7fc0) },
        dayHor: { value: new THREE.Color(0xa8cce8) }
      },
      vertexShader: `
        varying float vY;
        void main(){ vY = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float day;
        uniform vec3 nightZen, nightHor, dayZen, dayHor;
        varying float vY;
        void main(){
          float t = smoothstep(0.0, 0.55, max(vY, 0.0));
          vec3 night = mix(nightHor, nightZen, t);
          vec3 dayc = mix(dayHor, dayZen, t);
          gl_FragColor = vec4(mix(night, dayc, day), 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 20), this.domeMat);
    dome.renderOrder = -1;
    this.scene.add(dome);

    /* cardinal markers on the horizon */
    for (const [txt, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]){
      const a = az * Math.PI / 180;
      const p = new THREE.Vector3(Math.sin(a) * 700, 8, -Math.cos(a) * 700);
      const entry = this.labels.add(txt, out => out.copy(p), { fadeDist: 1e6 });
      entry.el.style.opacity = 0.7;
      entry.hovered = true;      // always full visibility
    }

    this.pickTargets = [];
    this._basisM = new THREE.Matrix4();
    this._strobeAnchor = null;
    this.strobe = false;
  }

  toggleConstellations(){
    this.conLines.visible = !this.conLines.visible;
    return this.conLines.visible;
  }

  /* live readouts for the HUD panel (match the displayed, possibly
     day-stepped time so the panel never disagrees with the sky) */
  status(simDays){
    if (this.strobe && this._strobeAnchor !== null)
      simDays = Math.round(simDays - this._strobeAnchor) + this._strobeAnchor;
    const jd = julianDate(EPOCH_MS, simDays);
    const th = lst(jd, OBSERVER.lon);
    const s = sunGeo(jd);
    const sunPos = altAz(s.ra, s.dec, th, OBSERVER.lat);
    return { lstDeg: th, sunAlt: sunPos.alt };
  }

  update(simDays, rate = 0){
    /* Day-step time: above ~0.3 d/s a continuous sky strobes through
       day/night several times a second. Instead, quantize to whole solar
       days anchored to the time-of-day when fast-forward began — the Sun
       holds still and the seasons sweep by (stars drift ~1°/night). */
    this.strobe = Math.abs(rate) > 0.3;
    if (this.strobe){
      if (this._strobeAnchor === null)
        this._strobeAnchor = ((simDays % 1) + 1) % 1;
      simDays = Math.round(simDays - this._strobeAnchor) + this._strobeAnchor;
    } else {
      this._strobeAnchor = null;
    }
    const jd = julianDate(EPOCH_MS, simDays);
    const th = lst(jd, OBSERVER.lon);

    // equatorial → horizontal: rows are east / up / −north
    const b = horizontalBasis(th, OBSERVER.lat);
    this._basisM.set(
      b.east[0], b.east[1], b.east[2], 0,
      b.up[0], b.up[1], b.up[2], 0,
      -b.north[0], -b.north[1], -b.north[2], 0,
      0, 0, 0, 1);
    this.skyGroup.matrix.copy(this._basisM);

    // solar-system bodies (geocentric, same ephemerides as the orrery)
    const place = (sprite, rd) => {
      const v = raDecToVec(rd.ra, rd.dec, R_BODIES);
      sprite.position.set(v.x, v.y, v.z);
    };
    const sun = sunGeo(jd);
    place(this.sun, sun);
    place(this.moon, moonGeo(jd));
    for (let i = 2; i < this.bodies.length; i++)
      place(this.bodies[i].sprite, planetGeo(this.bodies[i].name, jd));

    // day/night: fade stars out through twilight
    const sunAlt = altAz(sun.ra, sun.dec, th, OBSERVER.lat).alt;
    const day = Math.max(0, Math.min(1, (sunAlt + 10) / 14));   // -10° → +4°
    this.domeMat.uniforms.day.value = day;
    this.starMat.uniforms.fade.value = 1 - day * 0.96;
    this.conLines.material.opacity = 0.16 * (1 - day);
  }

  dispose(){
    this.labels.clear();
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats){ if (m.map) m.map.dispose(); m.dispose(); }
    });
    this.scene.clear();
  }
}

export { OBSERVER };
