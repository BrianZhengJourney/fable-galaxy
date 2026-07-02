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

    if (starCfg.blackhole){ this._buildBlackHole(starCfg); return; }
    if (starCfg.pulsar) this._buildPulsarBeams(starCfg);

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

  /* ---- Sagittarius A*: horizon, tilted accretion disk, photon ring ---- */
  _buildBlackHole(cfg){
    const R = cfg.coreRadius;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 }));
    this.group.add(this.mesh);

    // radial-gradient disk texture: white-hot inner edge → deep orange
    const diskTex = canvasRadial(256, [
      [0.00, 'rgba(0,0,0,0)'], [0.30, 'rgba(0,0,0,0)'],
      [0.34, 'rgba(255,248,235,0.95)'], [0.45, 'rgba(255,190,110,0.55)'],
      [0.72, 'rgba(255,120,50,0.18)'], [1.00, 'rgba(120,40,20,0)']
    ]);
    this.disk = new THREE.Mesh(
      new THREE.PlaneGeometry(R * 9, R * 9),
      new THREE.MeshBasicMaterial({ map: diskTex, transparent: true, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    this.disk.rotation.x = -Math.PI / 2 + 0.28;   // slight tilt toward the camera
    this.group.add(this.disk);

    // photon ring hugging the shadow, plus the "vertical" lensed arc
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff0d8, transparent: true,
      opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const photon = new THREE.Mesh(new THREE.TorusGeometry(R * 1.12, R * 0.035, 8, 96), ringMat);
    photon.rotation.x = -Math.PI / 2 + 0.28;
    this.group.add(photon);
    const lensed = new THREE.Mesh(new THREE.TorusGeometry(R * 1.35, R * 0.02, 8, 96),
      ringMat.clone());
    lensed.material.opacity = 0.35;
    this.group.add(lensed);                        // vertical: the Interstellar arc

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,200,140,.4)', 'rgba(255,140,60,.12)'),
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    halo.scale.set(R * 9, R * 9, 1);
    halo.userData.base = R * 9;
    this.coronaSprites.push(halo);
    this.group.add(halo);

    this.pick = new THREE.Mesh(new THREE.SphereGeometry(R * 1.6, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.pick.userData.body = this;
    this.isStar = true;
    this.name = cfg.name;
    this.group.add(this.pick);

    this.light = new THREE.PointLight(0xffd0a0, 1.6, 0);
    this.light.decay = 0;
    this.group.add(this.light);
  }

  /* ---- millisecond pulsar: sweeping polar beam cones ---- */
  _buildPulsarBeams(cfg){
    this.beams = new THREE.Group();
    this.beams.rotation.z = 0.45;                  // magnetic axis ≠ spin axis
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true,
      opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide });
    for (const sign of [1, -1]){
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 26, 20, 1, true), beamMat);
      cone.position.y = sign * 13;
      cone.rotation.z = sign > 0 ? Math.PI : 0;
      this.beams.add(cone);
    }
    this.group.add(this.beams);
  }

  update(simDays, now){
    if (this.cfg.blackhole){
      this.disk.rotation.z = now * 0.22;           // disk shear, real-time
      this.coronaSprites.forEach(sp => {
        const s = sp.userData.base * (1 + 0.05 * Math.sin(now * 1.3));
        sp.scale.set(s, s, 1);
      });
      return;
    }
    this.mesh.rotation.y = 2 * Math.PI * simDays / this.cfg.rotP;
    if (this.beams) this.beams.rotation.y = now * 5;   // lighthouse sweep (visual rate)
    this.coronaSprites.forEach((sp, i) => {
      const s = sp.userData.base * (1 + 0.04 * Math.sin(now * (0.7 + i * 0.35) + i * 2));
      sp.scale.set(s, s, 1);
    });
  }
  setHover(){ /* stars brighten via hover tag only */ }
}

function canvasRadial(size, stops){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  for (const [p, col] of stops) grd.addColorStop(p, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
