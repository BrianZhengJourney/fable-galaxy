/* Low orbit — the third scale.
   Real Sol bodies reuse the SAME cached 8K PBR textures as the orbital view
   (zero extra download): a high-detail textured globe with relief, ocean
   glint, clouds, night-side city lights and an atmosphere limb. Procedural
   exoplanets — which have no real imagery — keep a displaced fBm terrain
   sphere. Zoom is capped to orbital altitude so the 8K maps stay crisp;
   true ground-level detail would require tiled streaming (out of scope). */

import * as THREE from 'three';
import { makeNoise3D } from '../utils/noise.js';
import { hashStr, mulberry } from '../utils/rng.js';
import { buildStarSphere } from '../objects/starfield.js';
import { canvasTex, makePlanetTexture } from '../utils/textures.js';
import { loadTexture } from '../utils/assets.js';
import { PLANET_TEXTURES, MOON_SURFACE } from '../data/textureManifest.js';
import {
  applyRealTextures,
  buildAtmosphere,
  installPlanetAppearance,
  setPlanetAppearance,
  updatePlanetAppearance,
} from '../objects/planetMaterial.js';

const R = 20;

/* height-color ramps per surface type (procedural worlds) */
const RAMPS = {
  rocky:    [[-1, '#4a443c'], [0, '#7a736a'], [0.5, '#9a938a'], [1, '#d8d2c8']],
  cratered: [[-1, '#403c36'], [0, '#6e6a62'], [0.5, '#8f8a84'], [1, '#c8c2b8']],
  mars:     [[-1, '#6e3018'], [0, '#a04a24'], [0.5, '#c46a3a'], [1, '#f0d8c8']],
  desert:   [[-1, '#7a5228'], [0, '#b08048'], [0.5, '#d0a868'], [1, '#f0e0b8']],
  lava:     [[-1, '#ff6a1a'], [-0.4, '#802a10'], [0.1, '#241210'], [1, '#4a3a34']],
  ocean:    [[-1, '#0c2c50'], [0, '#1a5a40'], [0.4, '#4a8a50'], [1, '#e8f0f4']],
  earth:    [[-1, '#0c2c50'], [0, '#2a6a3a'], [0.5, '#8a7a4c'], [1, '#f0f4f8']],
  ice:      [[-1, '#6898b8'], [0, '#a8ccd8'], [0.5, '#d8ecf2'], [1, '#ffffff']],
  toxic:    [[-1, '#405018'], [0, '#708028'], [0.5, '#a0a848'], [1, '#d8d890']],
  venus:    [[-1, '#805828'], [0, '#a87c3c'], [0.5, '#d0a860'], [1, '#f0d8a0']]
};
const ATMO = {
  earth: '#6ab8ff', ocean: '#6ab8ff', mars: '#e8a070', venus: '#e8d08a',
  toxic: '#b8d860', ice: '#a8d8e8', lava: '#ff7040', desert: '#e0b880',
  rocky: null, cratered: null
};
const HAS_WATER = { earth: 1, ocean: 1 };
const HAS_CLOUDS = { earth: 0.9, ocean: 0.95, toxic: 1, venus: 1 };
const AMP = { rocky: 1.7, cratered: 1.9, mars: 1.5, desert: 1.3, lava: 1.2,
              ocean: 1.1, earth: 1.3, ice: 0.9, toxic: 0.7, venus: 0.8 };

function rampColor(stops, t, out){
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
  const u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0 || 1)));
  out.set(c0).lerp(new THREE.Color(c1), u);
  return out;
}

export class SurfaceView {
  constructor(planet, starCfg){
    this.planet = planet;
    this.scene = new THREE.Scene();
    this.scene.add(buildStarSphere('orbit:' + planet.name));

    this.spin = new THREE.Group();
    this.spin.rotation.z = (planet.cfg.tilt || 0) * Math.PI / 180;
    this.scene.add(this.spin);
    this.realMat = null;
    this.atmoMat = null;
    this._sunViewDir = new THREE.Vector3(0, 0, 1);
    this._sunWorld = new THREE.Vector3(80, 30, 50).normalize();   // matches key light

    // real Sol bodies (planets in the manifest, or Luna) → real cached maps
    const real = planet.cfg.name === 'LUNA' ? MOON_SURFACE : PLANET_TEXTURES[planet.cfg.name];
    if (real) this._buildReal(planet, real);
    else this._buildProcedural(planet);

    /* ---- key light (the star) + low fill for a crisp terminator ---- */
    const key = new THREE.DirectionalLight(starCfg ? starCfg.color : 0xfff0d5, 2.6);
    key.position.set(80, 30, 50);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x243448, real ? 0.4 : 0.7));

    this.pickTargets = [];
  }

  /* ---------- real body: the same globe as orbit, up close ---------- */
  _buildReal(planet, real){
    // A synchronous fallback map guarantees vMapUv exists when the epoch shader
    // first compiles; the cached observed map replaces it as soon as it arrives.
    const mat = new THREE.MeshStandardMaterial({
      map: makePlanetTexture(planet.cfg.tex, planet.name + ':low-orbit'),
      roughness: 0.92, metalness: 0,
    });
    mat.userData.keepMaps = true;                 // cached/shared — don't dispose
    const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 160), mat);
    this.spin.add(globe);
    this.terrain = globe;
    this.realMat = mat;
    this.appearanceTarget = {
      name: planet.name, cfg: planet.cfg, mat, baseEmissive: 0,
      fallbackMap: mat.map, spin: this.spin,
    };

    // load the identical maps the orbital planet used (already in cache → instant)
    applyRealTextures(this.appearanceTarget, real);

    if (real.clouds){
      const cmat = new THREE.MeshStandardMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9,
        depthWrite: false, roughness: 1 });
      cmat.userData.keepMaps = true;
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.015, 128, 80), cmat);
      this.spin.add(this.clouds);
      this.appearanceTarget.clouds = this.clouds;
      loadTexture(real.clouds, tex => {
        cmat.map = tex; cmat.alphaMap = tex; cmat.needsUpdate = true;
      });
    }
    if (real.atmosphere){
      // a touch stronger at this scale so the limb reads
      this.atmoMesh = buildAtmosphere(R * 1.03, real.atmosphere,
        (real.atmoStrength || 1) * 1.15);
      this.atmoMat = this.atmoMesh.userData.atmoMat;
      this.scene.add(this.atmoMesh);
      this.appearanceTarget.atmosphere = this.atmoMesh;
    }
    installPlanetAppearance(this.appearanceTarget);
  }

  /* ---------- procedural world: displaced fBm terrain ---------- */
  _buildProcedural(planet){
    const type = RAMPS[planet.cfg.tex.type] ? planet.cfg.tex.type : 'rocky';
    const fbm = makeNoise3D(hashStr('terrain:' + planet.name));
    const geo = new THREE.SphereGeometry(R, 220, 140);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3(), c = new THREE.Color();
    const amp = AMP[type];
    const water = HAS_WATER[type];
    for (let i = 0; i < pos.count; i++){
      v.fromBufferAttribute(pos, i).normalize();
      let h = (fbm(v.x * 2.6, v.y * 2.6, v.z * 2.6) - 0.5) * 2;
      h += (fbm(v.x * 9, v.y * 9, v.z * 9, 3) - 0.5) * 0.6;
      h += (fbm(v.x * 22, v.y * 22, v.z * 22, 2) - 0.5) * 0.22;      // fine detail
      const polar = Math.pow(Math.abs(v.y), 6);
      const land = water ? Math.max(h, -0.12) : h;
      pos.setXYZ(i, v.x * (R + land * amp), v.y * (R + land * amp), v.z * (R + land * amp));
      rampColor(RAMPS[type], h, c);
      if ((type === 'earth' || type === 'ice' || type === 'mars') && polar > 0.4)
        c.lerp(new THREE.Color('#f4f8fb'), Math.min(1, polar));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0,
      emissive: type === 'lava' ? new THREE.Color('#ff3a08') : new THREE.Color('#000000'),
      emissiveIntensity: type === 'lava' ? 0.28 : 0
    }));
    this.spin.add(this.terrain);

    if (water)
      this.spin.add(new THREE.Mesh(new THREE.SphereGeometry(R - 0.02, 96, 64),
        new THREE.MeshStandardMaterial({ color: 0x14406e, roughness: 0.35, metalness: 0,
          transparent: true, opacity: 0.92 })));

    if (HAS_CLOUDS[type]){
      const rnd = mulberry(hashStr('clouds:' + planet.name));
      const cloudTex = canvasTex(512, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 130; i++){
          g.globalAlpha = 0.06 + rnd() * 0.15;
          g.beginPath();
          g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 46, 4 + rnd() * 10, 0, 0, Math.PI * 2);
          g.fill();
        }
      });
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 96, 64),
        new THREE.MeshLambertMaterial({ map: cloudTex, transparent: true,
          opacity: HAS_CLOUDS[type], depthWrite: false }));
      this.scene.add(this.clouds);
    }

    const atmo = ATMO[type];
    if (atmo){
      this.atmoMesh = buildAtmosphere(R * 1.06, atmo, 0.85);
      this.atmoMat = this.atmoMesh.userData.atmoMat;
      this.scene.add(this.atmoMesh);
    }
  }

  // orbital altitudes: min kept high so the 8K maps stay sharp (no tile streaming)
  overviewDist(){ return R * 2.4; }
  minDist(){ return R * 1.5; }
  maxDist(){ return R * 5.2; }

  update(dt, simDays, camera){
    this.spin.rotation.y = 2 * Math.PI * simDays / this.planet.cfg.rotP;
    if (this.clouds) this.clouds.rotation.y += dt * 0.01;
    // point the night-lights + atmosphere shaders at the fixed key light
    if (camera && (this.atmoMat || (this.realMat && this.realMat.userData.shader))){
      this._sunViewDir.copy(this._sunWorld).transformDirection(camera.matrixWorldInverse);
      if (this.atmoMat) this.atmoMat.uniforms.uSunViewDir.value.copy(this._sunViewDir);
      if (this.realMat && this.realMat.userData.shader)
        this.realMat.userData.shader.uniforms.uSunViewDir.value.copy(this._sunViewDir);
    }
    if (this.appearanceTarget) updatePlanetAppearance(this.appearanceTarget, dt, simDays * 0.01);
  }

  setEpoch(epoch){
    if (!this.appearanceTarget || !epoch || !epoch.bodies) return;
    setPlanetAppearance(this.appearanceTarget, epoch.bodies[this.planet.name]);
    this.epoch = epoch;
  }

  dispose(){
    if (this.appearanceTarget && this.appearanceTarget.fallbackMap){
      this.appearanceTarget.fallbackMap.dispose();
      this.appearanceTarget.fallbackMap = null;
    }
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats){
        // shared cached textures belong to the asset cache — never dispose them
        const sharedMap = m.map && m.map.userData && m.map.userData.shared;
        if (m.map && !sharedMap && !(m.userData && m.userData.keepMaps)) m.map.dispose();
        m.dispose();
      }
    });
    this.scene.clear();
  }
}

/* gas and ice giants have no surface to descend to */
export function canDescend(planet){
  const t = planet.cfg.tex.type;
  return t !== 'gas' && !(t === 'ice' && planet.r > 1.2);
}
