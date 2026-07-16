/* One orbiting body: tilted spin group, textured sphere, optional rings,
   moons, and a generous invisible pick sphere. update() places it on its
   orbit from simDays — angle = phase + 2π·t/T, real relative periods. */

import * as THREE from 'three';
import {
  keplerPositionAtEccentricAnomaly,
  sStarPositionAtDays,
} from '../data/sStars.js';
import { makePlanetTexture, makeRingTexture } from '../utils/textures.js';
import { displayPosition, heliocentric, julianDate } from '../data/ephemeris.js';
import { loadTexture } from '../utils/assets.js';
import { PLANET_TEXTURES, MOON_TEXTURE, MOON_BUMP } from '../data/textureManifest.js';
import {
  applyRealTextures,
  buildAtmosphere,
  installPlanetAppearance,
  setPlanetAppearance,
  updatePlanetAppearance,
  updatePlanetSun,
} from './planetMaterial.js';

const J2000_EPOCH_MS = Date.UTC(2026, 6, 2);   // must match TimeSystem.EPOCH

export class Planet {
  constructor(cfg){
    this.cfg = cfg;
    this.name = cfg.name;
    this.isPlanet = true;
    this.r = cfg.r;
    this.baseEmissive = cfg.glow ? 0.55 : 0.06;

    this.group = new THREE.Group();
    this.spin = new THREE.Group();
    this.spin.rotation.z = cfg.tilt * Math.PI / 180;
    this.group.add(this.spin);

    this.mat = new THREE.MeshStandardMaterial({
      map: makePlanetTexture(cfg.tex, cfg.name),
      roughness: 0.95, metalness: 0.0,
      emissive: new THREE.Color(cfg.glow ? (cfg.emissiveColor || '#ff5a22') : cfg.tex.base),
      emissiveIntensity: this.baseEmissive
    });
    this.fallbackMap = this.mat.map;
    // real bodies get denser geometry so normal-mapped relief reads at the limb
    const real = PLANET_TEXTURES[cfg.name];
    const seg = real ? 128 : 48, segH = real ? 64 : 32;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.r, seg, segH), this.mat);
    this.spin.add(this.mesh);

    // real imagery for the Sol system: PBR maps swap in as they arrive
    // (procedural texture shows instantly; a failed fetch just keeps it)
    if (real){
      applyRealTextures(this, real);
      if (real.clouds){
        const cmat = new THREE.MeshStandardMaterial({
          color: 0xffffff, transparent: true, opacity: 0.92,
          depthWrite: false, roughness: 1, metalness: 0 });
        this.clouds = new THREE.Mesh(new THREE.SphereGeometry(cfg.r * 1.015, 96, 64), cmat);
        this.spin.add(this.clouds);
        loadTexture(real.clouds, tex => {
          cmat.map = tex; cmat.alphaMap = tex; cmat.needsUpdate = true;
        });
      }
      if (real.atmosphere){
        this.atmosphere = buildAtmosphere(cfg.r * (real.atmoScale || 1.06),
          real.atmosphere, real.atmoStrength || 1.0);
        this.spin.add(this.atmosphere);
      }
    }

    if (cfg.rings){
      const ringCfg = typeof cfg.rings === 'object' ? cfg.rings : {};
      const inner = cfg.r * (ringCfg.inner || 1.35);
      const outer = cfg.r * (ringCfg.outer || 2.35);
      const rg = new THREE.RingGeometry(inner, outer, 96, 1);
      // remap UVs radially so the 1D band texture wraps correctly
      const p = rg.attributes.position, uv = rg.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++){
        v.fromBufferAttribute(p, i);
        uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
      }
      const rmat = new THREE.MeshBasicMaterial({
        map: makeRingTexture(cfg.name), side: THREE.DoubleSide,
        color: ringCfg.color || 0xffffff,
        transparent: true, opacity: ringCfg.opacity ?? 0.9, depthWrite: false });
      this.ringMat = rmat;
      this.ring = new THREE.Mesh(rg, rmat);
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.userData.body = this;        // visible ring surface selects its parent world
      this.spin.add(this.ring);
      if (real && real.ring)
        loadTexture(real.ring, tex => { rmat.map = tex; rmat.needsUpdate = true; }, { srgb: true });
    }

    this.moons = [];
    this.satellites = [];        // every rendered moon is focusable + clickable
    (cfg.moons || []).forEach((m, mi) => {
      const moonName = m.name || (cfg.name + ' MOON ' + (mi + 1));
      const realMoon = moonName === 'LUNA' || (cfg.name === 'EARTH' && mi === 0);
      const mmat = new THREE.MeshStandardMaterial({ color: m.color || 0x9a948c, roughness: 1 });
      const mm = new THREE.Mesh(new THREE.SphereGeometry(m.r, realMoon ? 96 : 24, realMoon ? 64 : 16), mmat);
      this.group.add(mm);
      this.moons.push({ mesh: mm, dist: m.dist, period: m.period, phase: mi * 2.1 });
      // Earth's Moon receives real maps; every visible moon still receives a
      // named body handle, hover feedback and a generous pick target.
      if (realMoon){
        loadTexture(MOON_TEXTURE, tex => {
          mmat.map = tex; mmat.color.set(0xffffff); mmat.needsUpdate = true;
        });
        loadTexture(MOON_BUMP, tex => {
          mmat.bumpMap = tex; mmat.bumpScale = 0.006; mmat.needsUpdate = true;
        }, { srgb: false });
      }

      const moonBody = {
        name: moonName, isMoon: true, r: m.r, mesh: mm, mat: mmat,
        group: new THREE.Group(),              // world-position handle, synced by SystemView
        baseEmissive: 0, _hoverAmt: 0, _hoverTarget: 0,
        cfg: {
          name: moonName,
          tex: m.tex || { type: 'cratered', base: m.color || '#9a948c' },
          rotP: m.rotP || m.period,
          tilt: m.tilt || 0,
          descendable: m.descendable === true || realMoon,
          cls: m.cls || 'NATURAL SATELLITE',
          view: m.view || Math.max(2.4, m.r * 8),
          info: m.info || {
            'PARENT': cfg.name,
            'ORBITAL PERIOD': m.period.toFixed(2) + ' d',
            'ROTATION': 'TIDALLY LOCKED',
            'MODEL SCALE': 'COMPRESSED FOR VISIBILITY',
          },
        },
        setHover(on){
          this._hoverTarget = on ? 1 : 0;
          mmat.emissive.set(on ? 0x8a94a8 : 0x000000);
          mmat.emissiveIntensity = on ? 0.4 : 0;
          mmat.needsUpdate = true;
        },
        syncSun(){},
      };
      const mpick = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(m.r * 2.4, 0.8), 12, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      mpick.userData.body = moonBody;
      mm.add(mpick);                            // pick rides with the moon
      this.satellites.push({ body: moonBody, pick: mpick, mesh: mm });
    });

    // invisible pick target so small planets are easy to click
    this.pick = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(cfg.r * 1.28, 1.15), 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.pick.userData.body = this;
    this.group.add(this.pick);
    // Keep giant-planet pick spheres clear of their moons; the full visible
    // annulus remains directly selectable through the ring mesh itself.
    this.pickTargets = this.ring ? [this.pick, this.ring] : [this.pick];

    this._hoverAmt = 0;
    this._hoverTarget = 0;
    if (real) installPlanetAppearance(this);
  }

  /* pure orbital position — mission planning samples this at arbitrary times */
  positionAt(simDays, out){
    const b = this.cfg;
    if (b.eph){
      // real JPL elements: true heliocentric direction for the current date
      return displayPosition(b.eph, julianDate(J2000_EPOCH_MS, simDays), b.dist, out);
    }
    if (b.kepler){
      // eccentric Kepler orbit (S-cluster stars around Sgr A*)
      return sStarPositionAtDays(b.kepler, simDays, out);
    }
    const ang = b.phase + 2 * Math.PI * simDays / b.period;
    return out.set(Math.cos(ang) * b.dist, 0, Math.sin(ang) * b.dist);
  }

  update(simDays, dt = 0, now = 0){
    const b = this.cfg;
    this.positionAt(simDays, this.group.position);
    this.mesh.rotation.y = 2 * Math.PI * simDays / b.rotP;   // sign ⇒ retrograde
    if (this.clouds) this.clouds.rotation.y = 2 * Math.PI * simDays / b.rotP * 1.15;
    for (const m of this.moons){
      const ma = m.phase + 2 * Math.PI * simDays / m.period;
      m.mesh.position.set(Math.cos(ma) * m.dist, 0, Math.sin(ma) * m.dist);
    }
    // eased hover: emissive glow + a gentle scale swell (spaceship feel)
    if (this._hoverAmt !== this._hoverTarget){
      const k = Math.min(1, dt * 8);
      this._hoverAmt += (this._hoverTarget - this._hoverAmt) * k;
      if (Math.abs(this._hoverTarget - this._hoverAmt) < 0.01) this._hoverAmt = this._hoverTarget;
      this.mat.emissiveIntensity = this.baseEmissive + this._hoverAmt * 0.4;
      const s = 1 + this._hoverAmt * 0.05;
      this.spin.scale.setScalar(s);
    }
    updatePlanetAppearance(this, dt, now);
  }

  /* heliocentric longitude in radians — the event engine's view of this body */
  lonAt(simDays){
    const b = this.cfg;
    if (b.eph)
      return heliocentric(b.eph, julianDate(J2000_EPOCH_MS, simDays)).lon * Math.PI / 180;
    return (b.phase + 2 * Math.PI * simDays / b.period) % (2 * Math.PI);
  }

  setHover(on){ this._hoverTarget = on ? 1 : 0; }

  setAppearance(spec){ setPlanetAppearance(this, spec); }

  /* keep the day/night + atmosphere shaders pointed at the sun (view space) */
  syncSun(camera){
    if (this.atmosphere || (this.mat.userData && this.mat.userData.shader))
      updatePlanetSun(this, camera);
  }
}

/* orbit path for a Kepler body (S-stars): sample its eccentric ellipse */
export function buildKeplerOrbit(cfg, color = 0x3fa8c8, opacity = 0.33){
  const K = cfg.kepler, seg = 240, pos = new Float32Array(seg * 3);
  const point = new THREE.Vector3();
  for (let i = 0; i < seg; i++){
    const E = (i / seg) * Math.PI * 2;
    keplerPositionAtEccentricAnomaly(K, E, point);
    pos[i*3] = point.x; pos[i*3+1] = point.y; pos[i*3+2] = point.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.LineLoop(g, new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false }));
}

/* orbit path for an ephemeris body: sample the real ellipse over one period */
export function buildEphemerisOrbit(cfg, color = 0x3fa8c8, opacity = 0.33){
  const seg = 240, pos = new Float32Array(seg * 3);
  const v = new THREE.Vector3();
  const jd0 = julianDate(J2000_EPOCH_MS, 0);
  for (let i = 0; i < seg; i++){
    displayPosition(cfg.eph, jd0 + (i / seg) * cfg.period, cfg.dist, v);
    pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = v.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.LineLoop(g, new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false }));
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
