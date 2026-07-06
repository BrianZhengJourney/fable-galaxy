/* The galactic scene: built once, kept alive for the whole session.
   Catalog stars are the clickable gateways down into system views. */

import * as THREE from 'three';
import { buildGalaxy } from '../objects/galaxy.js';
import { raDecToOffset, SOL_GALAXY_POS } from '../data/starCatalog.js';
import { LANDMARKS, LANDMARK_CATEGORIES } from '../data/landmarks.js';
import { makeGlowTexture } from '../utils/textures.js';

const LY_PER_PC = 3.26156;

/* parse "6,500 ly" / "27,000 ly" / "163 kly" → light-years, else null (Mly etc.) */
function parseLy(str){
  if (!str) return null;
  const s = str.replace(/,/g, '');
  if (/Mly|Gly|Mpc/i.test(s)) return null;                 // extragalactic
  const m = /([\d.]+)\s*(kly|ly|pc|kpc)/i.exec(s);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  return u === 'kly' ? v * 1000 : u === 'kpc' ? v * 1000 * LY_PER_PC
       : u === 'pc' ? v * LY_PER_PC : v;
}

export class GalaxyView {
  constructor(labelManager){
    this.labels = labelManager;
    this.scene = new THREE.Scene();
    this.galaxy = buildGalaxy();
    this.scene.add(this.galaxy.group);
    this.landmarkMarks = [];
    this._buildLandmarkMarkers();
    this.pickTargets = this.galaxy.catalog.map(c => c.pick)
      .concat(this.landmarkMarks.map(m => m.pick));
    this._tmp = new THREE.Vector3();
  }

  /* place Milky-Way landmarks (real sky direction, log-compressed distance) as
     clickable category-coloured markers riding the galaxy's rotation */
  _buildLandmarkMarkers(){
    const glow = makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.4)', 128);
    const pickGeo = new THREE.SphereGeometry(4.5, 8, 6);
    for (const e of LANDMARKS){
      if (e.raDeg == null || e.decDeg == null) continue;
      const ly = parseLy(e.distance);
      if (ly == null || ly > 120000) continue;               // in-galaxy only
      const off = raDecToOffset(e.raDeg, e.decDeg, ly / LY_PER_PC);
      const pos = new THREE.Vector3(
        SOL_GALAXY_POS[0] + off[0], SOL_GALAXY_POS[1] + off[1], SOL_GALAXY_POS[2] + off[2]);
      const cat = LANDMARK_CATEGORIES.find(c => c.key === e.category);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow, color: new THREE.Color(cat ? cat.color : '#ffcf80'),
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      sp.scale.set(7, 7, 1); sp.position.copy(pos);
      this.galaxy.group.add(sp);
      const pick = new THREE.Mesh(pickGeo,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      pick.position.copy(pos);
      const marker = { isLandmark: true, landmark: e, name: e.name, sprite: sp };
      pick.userData.body = marker;
      this.galaxy.group.add(pick);
      this.landmarkMarks.push({ marker, pick, sprite: sp });
    }
  }

  /* labels are re-registered whenever we enter the view (manager is shared) */
  registerLabels(){
    for (const c of this.galaxy.catalog){
      const sprite = c.sprite;
      const entry = this.labels.add(c.name,
        out => sprite.getWorldPosition(out),
        { fadeDist: 900, cls: 'star' });
      c.labelEntry = entry;
    }
    for (const m of this.landmarkMarks){
      m.marker.labelEntry = this.labels.add(m.marker.name,
        out => m.sprite.getWorldPosition(out), { fadeDist: 620, cls: 'landmark' });
    }
  }

  /* world position of a catalog star (galaxy group slowly rotates) */
  starWorldPos(entry, out){
    return entry.sprite.getWorldPosition(out);
  }

  findStar(name){
    return this.galaxy.catalog.find(c => c.name === name) || null;
  }

  update(dt){
    this.galaxy.update(dt);
  }
}
