/* Asteroid belt: a few thousand points with individual Kepler-ish angular
   speeds (inner rocks orbit faster), positions rewritten each frame from
   simDays so time reversal Just Works. */

import * as THREE from 'three';
import { mulberry, hashStr } from '../utils/rng.js';
import { dotTexture } from './starfield.js';

export class AsteroidBelt {
  constructor({ inner, outer, count, seed }){
    this.name = 'ASTEROID BELT';
    this.isSystemFeature = true;
    this.featureType = 'belt';
    this.r = outer;
    this.cfg = {
      cls: 'SMALL-BODY RESERVOIR',
      view: outer * 1.45,
      info: {
        'REGION': inner.toFixed(1) + '–' + outer.toFixed(1) + ' MODEL UNITS',
        'DISPLAYED OBJECTS': count.toLocaleString('en-US'),
        'COMPOSITION': 'ROCK · METAL · CARBON-RICH BODIES',
        'LOCATION': 'BETWEEN INNER AND OUTER PLANETS',
        'NOTE': 'PARTICLES ARE A REPRESENTATIVE SAMPLE',
      },
    };
    const rnd = mulberry(hashStr(seed || 'belt'));
    this.rocks = [];
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++){
      const r = inner + Math.pow(rnd(), 0.8) * (outer - inner);
      // T ∝ r^1.5 anchored to ~88 d at r=11 (matches planet scaling)
      const period = 88 * Math.pow(r / 11, 1.5) * (0.92 + rnd() * 0.16);
      this.rocks.push({
        r, phase: rnd() * Math.PI * 2, period,
        y: (rnd() - 0.5) * 1.6 * (rnd() < 0.85 ? 1 : 2.5)
      });
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({
      color: 0x9c9284, size: 0.22, transparent: true, opacity: 0.75,
      map: dotTexture(), alphaTest: 0.05,
      sizeAttenuation: true, depthWrite: false }));
    // A transparent torus covers the rendered annulus. Picking individual
    // Points would make this dense feature strangely hard to select.
    this.pick = new THREE.Mesh(
      new THREE.TorusGeometry((inner + outer) / 2, (outer - inner) / 2, 8, 128),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.pick.rotation.x = Math.PI / 2;
    this.pick.userData.body = this;
    this.group = this.pick;
    this.update(0);
  }

  update(simDays){
    const pos = this.geo.attributes.position.array;
    const rocks = this.rocks;
    for (let i = 0; i < rocks.length; i++){
      const k = rocks[i];
      const a = k.phase + 2 * Math.PI * simDays / k.period;
      pos[i*3]   = Math.cos(a) * k.r;
      pos[i*3+1] = k.y;
      pos[i*3+2] = Math.sin(a) * k.r;
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  setAppearance(spec){
    if (!spec) return;
    this.points.visible = spec.visible !== false;
    this.pick.visible = spec.visible !== false;
    if (spec.opacity != null) this.points.material.opacity = spec.opacity;
  }

  setHover(on){
    this.points.material.color.set(on ? 0xffc27a : 0x9c9284);
    this.points.material.size = on ? 0.28 : 0.22;
  }
}
