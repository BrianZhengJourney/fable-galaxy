/* The galactic scene: built once, kept alive for the whole session.
   Catalog stars are the clickable gateways down into system views. */

import * as THREE from 'three';
import { buildGalaxy } from '../objects/galaxy.js';

export class GalaxyView {
  constructor(labelManager){
    this.labels = labelManager;
    this.scene = new THREE.Scene();
    this.galaxy = buildGalaxy();
    this.scene.add(this.galaxy.group);
    this.pickTargets = this.galaxy.catalog.map(c => c.pick);
    this._tmp = new THREE.Vector3();
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
