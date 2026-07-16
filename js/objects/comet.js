/* Long-period comet on a true Kepler ellipse. Mean anomaly → eccentric
   anomaly via Newton iteration, so it visibly accelerates at perihelion.
   The particle tail is rebuilt every frame along the sun→comet direction,
   so it always points away from the star. */

import * as THREE from 'three';
import { mulberry } from '../utils/rng.js';
import { makeGlowTexture } from '../utils/textures.js';

export class Comet {
  constructor(params){
    this.p = params;   // { a, e, period, incl, node, phase }
    this.name = params.name || 'LONG-PERIOD COMET';
    this.isSystemFeature = true;
    this.featureType = 'comet';
    this.r = 0.5;
    this.cfg = {
      cls: 'ICY SMALL BODY',
      view: 7,
      info: {
        'ORBITAL PERIOD': params.period >= 365
          ? (params.period / 365.25).toFixed(1) + ' yr' : params.period.toFixed(1) + ' d',
        'ECCENTRICITY': params.e.toFixed(3),
        'INCLINATION': (params.incl * 180 / Math.PI).toFixed(1) + '°',
        'PERIHELION': (params.a * (1 - params.e)).toFixed(1) + ' MODEL UNITS',
        'APHELION': (params.a * (1 + params.e)).toFixed(1) + ' MODEL UNITS',
      },
    };
    this.group = new THREE.Group();

    this.head = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(220,250,255,1)', 'rgba(120,220,255,.4)', 128),
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.head.scale.set(3.2, 3.2, 1);
    this.group.add(this.head);
    this.nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xdff6ff }));
    this.group.add(this.nucleus);
    this.pick = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.pick.userData.body = this;
    this.group.add(this.pick);

    const N = 150;
    this.seeds = [];
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const rnd = mulberry(9001);
    for (let i = 0; i < N; i++){
      this.seeds.push({ t: i / N, j1: rnd() - 0.5, j2: rnd() - 0.5, j3: rnd() - 0.5 });
      const f = 1 - i / N;
      col[i*3] = 0.55*f + 0.15; col[i*3+1] = 0.85*f + 0.1; col[i*3+2] = f + 0.1;
    }
    this.tailGeo = new THREE.BufferGeometry();
    this.tailGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.tailGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.tail = new THREE.Points(this.tailGeo, new THREE.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.85,
      map: makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.35)', 64),
      blending: THREE.AdditiveBlending, depthWrite: false }));

    this._cp = new THREE.Vector3(); this._cd = new THREE.Vector3();
    this._cu = new THREE.Vector3(); this._cv = new THREE.Vector3();
    this._hovered = false;
  }

  addTo(scene){ scene.add(this.group); scene.add(this.tail); }

  position(days, out){
    const P = this.p;
    const M = (P.phase + 2 * Math.PI * days / P.period) % (2 * Math.PI);
    let E = M;
    for (let k = 0; k < 6; k++)
      E = E - (E - P.e * Math.sin(E) - M) / (1 - P.e * Math.cos(E));
    const x = P.a * (Math.cos(E) - P.e);
    const z = P.a * Math.sqrt(1 - P.e * P.e) * Math.sin(E);
    const cn = Math.cos(P.node), sn = Math.sin(P.node);
    const xr = x * cn - z * sn, zr = x * sn + z * cn;
    const ci = Math.cos(P.incl), si = Math.sin(P.incl);
    out.set(xr, -zr * si, zr * ci);
    return out;
  }

  update(simDays){
    const cp = this._cp, cd = this._cd, cu = this._cu, cv = this._cv;
    this.position(simDays, cp);
    this.group.position.copy(cp);
    const rSun = cp.length();
    cd.copy(cp).normalize();                       // ALWAYS away from the star
    cu.set(0, 1, 0); if (Math.abs(cd.y) > 0.9) cu.set(1, 0, 0);
    cv.crossVectors(cd, cu).normalize();
    cu.crossVectors(cv, cd).normalize();
    const tailLen = Math.min(22, Math.max(5, 480 / rSun));
    const glow = Math.min(1, 30 / rSun);
    const hoverScale = this._hovered ? 1.22 : 1;
    this.head.scale.set((2 + glow * 2.4) * hoverScale, (2 + glow * 2.4) * hoverScale, 1);
    const pos = this.tailGeo.attributes.position.array;
    for (let i = 0; i < this.seeds.length; i++){
      const s = this.seeds[i], d = s.t * tailLen, spread = s.t * tailLen * 0.16;
      pos[i*3]   = cp.x + cd.x*d + cv.x*s.j1*spread + cu.x*s.j2*spread;
      pos[i*3+1] = cp.y + cd.y*d + cv.y*s.j1*spread + cu.y*s.j2*spread + s.j3*spread*0.5;
      pos[i*3+2] = cp.z + cd.z*d + cv.z*s.j1*spread + cu.z*s.j2*spread;
    }
    this.tailGeo.attributes.position.needsUpdate = true;
  }

  setHover(on){
    this._hovered = on;
    this.nucleus.material.color.set(on ? 0xffffff : 0xdff6ff);
    this.head.material.opacity = on ? 1 : 0.82;
  }
}
