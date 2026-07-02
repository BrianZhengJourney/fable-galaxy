/* Central star of a system: textured photosphere plus layered additive
   corona sprites tinted by the star's blackbody color. The sprite stack is
   the bloom substitute — it degrades to nothing worse than itself. */

import * as THREE from 'three';
import { makeStarTexture, makeGlowTexture } from '../utils/textures.js';

export class CentralStar {
  constructor(starCfg){
    this.cfg = starCfg;
    this.group = new THREE.Group();
    this.coronaSprites = [];

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(starCfg.coreRadius, 48, 32),
      new THREE.MeshBasicMaterial({ map: makeStarTexture(starCfg.bright, starCfg.deep, starCfg.name) }));
    this.group.add(this.mesh);

    const c = new THREE.Color(starCfg.color);
    const rgb = [Math.round(c.r*255), Math.round(c.g*255), Math.round(c.b*255)].join(',');
    const R = starCfg.coreRadius;
    const halos = [
      { tex: makeGlowTexture('rgba(255,250,235,1)', 'rgba(' + rgb + ',.55)'), s: R * 3.4 },
      { tex: makeGlowTexture('rgba(' + rgb + ',.8)', 'rgba(' + rgb + ',.22)'), s: R * 7.2 },
      { tex: makeGlowTexture('rgba(' + rgb + ',.35)', 'rgba(' + rgb + ',.08)'), s: R * 13 }
    ];
    for (const hd of halos){
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: hd.tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      sp.scale.set(hd.s, hd.s, 1);
      sp.userData.base = hd.s;
      this.coronaSprites.push(sp);
      this.group.add(sp);
    }

    this.pick = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.3, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.pick.userData.body = this;
    this.isStar = true;
    this.name = starCfg.name;
    this.group.add(this.pick);

    this.light = new THREE.PointLight(starCfg.color, 2.0, 0);
    this.light.decay = 0;   // r155+ defaults to physical 1/d² falloff — planets would go black
    this.light.color.lerp(new THREE.Color(0xffffff), 0.55);   // keep planets readable
    this.group.add(this.light);
  }

  update(simDays, now){
    this.mesh.rotation.y = 2 * Math.PI * simDays / this.cfg.rotP;
    this.coronaSprites.forEach((sp, i) => {
      const s = sp.userData.base * (1 + 0.04 * Math.sin(now * (0.7 + i * 0.35) + i * 2));
      sp.scale.set(s, s, 1);
    });
  }
  setHover(){ /* stars brighten via hover tag only */ }
}
