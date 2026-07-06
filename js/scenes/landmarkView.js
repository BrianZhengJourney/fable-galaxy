/* Cosmic Landmark exhibit scene. Builds a procedural rendering of a famous
   object/event (by vizStyle) on a star backdrop; the camera orbits it while a
   story card narrates. One scene per landmark, disposed on exit. */

import * as THREE from 'three';
import { buildStarSphere } from '../objects/starfield.js';
import { buildExhibit } from '../procgen/exhibits.js';

export class LandmarkView {
  constructor(entry){
    this.entry = entry;
    this.scene = new THREE.Scene();
    this.scene.add(buildStarSphere('lm:' + entry.id));

    this.exhibit = buildExhibit(entry);
    this.scene.add(this.exhibit.group);

    // soft lighting for any lit (non-additive) exhibit geometry
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(40, 30, 50);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x33425a, 0.6));

    this.pickTargets = [];
  }

  focusDist(){ return this.exhibit.focusDist || 80; }
  minDist(){ return this.focusDist() * 0.35; }
  maxDist(){ return this.focusDist() * 2.6; }

  update(dt){ if (this.exhibit.update) this.exhibit.update(dt); }

  dispose(){
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats){ if (m.map) m.map.dispose(); m.dispose(); }
    });
    this.scene.clear();
  }
}
