/* One orbiting body: tilted spin group, textured sphere, optional rings,
   moons, and a generous invisible pick sphere. update() places it on its
   orbit from simDays — angle = phase + 2π·t/T, real relative periods. */

import * as THREE from 'three';
import { makePlanetTexture, makeRingTexture } from '../utils/textures.js';

export class Planet {
  constructor(cfg){
    this.cfg = cfg;
    this.name = cfg.name;
    this.r = cfg.r;
    this.baseEmissive = cfg.glow ? 0.55 : 0.06;

    this.group = new THREE.Group();
    this.spin = new THREE.Group();
    this.spin.rotation.z = cfg.tilt * Math.PI / 180;
    this.group.add(this.spin);

    this.mat = new THREE.MeshStandardMaterial({
      map: makePlanetTexture(cfg.tex, cfg.name),
      roughness: 0.95, metalness: 0.0,
      emissive: new THREE.Color(cfg.glow ? '#ff5a22' : cfg.tex.base),
      emissiveIntensity: this.baseEmissive
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.r, 40, 26), this.mat);
    this.spin.add(this.mesh);

    if (cfg.rings){
      const inner = cfg.r * 1.35, outer = cfg.r * 2.35;
      const rg = new THREE.RingGeometry(inner, outer, 96, 1);
      // remap UVs radially so the 1D band texture wraps correctly
      const p = rg.attributes.position, uv = rg.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++){
        v.fromBufferAttribute(p, i);
        uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
      }
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
        map: makeRingTexture(cfg.name), side: THREE.DoubleSide,
        transparent: true, opacity: 0.9, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      this.spin.add(ring);
    }

    this.moons = [];
    (cfg.moons || []).forEach((m, mi) => {
      const mm = new THREE.Mesh(new THREE.SphereGeometry(m.r, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0x9a948c, roughness: 1 }));
      this.group.add(mm);
      this.moons.push({ mesh: mm, dist: m.dist, period: m.period, phase: mi * 2.1 });
    });

    // invisible pick target so small planets are easy to click
    this.pick = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(cfg.r * 2.2, 1.6), 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.pick.userData.body = this;
    this.group.add(this.pick);
  }

  update(simDays){
    const b = this.cfg;
    const ang = b.phase + 2 * Math.PI * simDays / b.period;
    this.group.position.set(Math.cos(ang) * b.dist, 0, Math.sin(ang) * b.dist);
    this.mesh.rotation.y = 2 * Math.PI * simDays / b.rotP;   // sign ⇒ retrograde
    for (const m of this.moons){
      const ma = m.phase + 2 * Math.PI * simDays / m.period;
      m.mesh.position.set(Math.cos(ma) * m.dist, 0, Math.sin(ma) * m.dist);
    }
  }

  setHover(on){
    this.mat.emissiveIntensity = on ? Math.max(0.45, this.baseEmissive) : this.baseEmissive;
  }
}

export function buildOrbitRing(radius, color = 0x3fa8c8, opacity = 0.33){
  const seg = 200, pos = new Float32Array(seg * 3);
  for (let i = 0; i < seg; i++){
    const a = i / seg * Math.PI * 2;
    pos[i*3] = Math.cos(a) * radius; pos[i*3+1] = 0; pos[i*3+2] = Math.sin(a) * radius;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.LineLoop(g, new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false }));
}
