/* Cosmic Landmark exhibit scene. Builds a procedural rendering of a famous
   object/event (by vizStyle) on a star backdrop; the camera orbits it while a
   story card narrates. One scene per landmark, disposed on exit. */

import * as THREE from 'three';
import { buildStarSphere } from '../objects/starfield.js';
import { buildExhibit, buildImagePlate, buildImageVolume } from '../procgen/exhibits.js';
import { buildPillarsOfCreation } from '../procgen/pillars.js';
import { landmarkImage } from '../data/landmarkImages.js';
import { landmarkImageIR } from '../data/landmarkImagesIR.js';

export class LandmarkView {
  constructor(entry){
    this.entry = entry;
    this.scene = new THREE.Scene();
    this.scene.add(buildStarSphere('lm:' + entry.id));

    // real photograph if we have one, else the procedural exhibit. Structured
    // deep-sky photos (nebulae, remnants, galaxies) are reconstructed as real 3D
    // particle-cloud volumes you can orbit; diagram-like plates stay flat.
    const img = landmarkImage(entry.id);
    const volumetric = !!img && ['NEBULA', 'SUPERNOVA', 'GALAXY'].includes(entry.category);
    this.exhibit = entry.id === 'pillars-of-creation' && img
                 ? buildPillarsOfCreation(entry, img.file)
                 : volumetric ? buildImageVolume(entry, img.file)
                 : img ? buildImagePlate(entry, img.file)
                 : buildExhibit(entry);
    this.hasImage = !!img;
    const ir = landmarkImageIR(entry.id);
    this.imageCredit = img ? (img.credit + (ir ? ' · IR: ' + ir.credit : '') +
      (this.exhibit.modelCredit ? ' · ' + this.exhibit.modelCredit : '')) : null;
    this.scene.add(this.exhibit.group);

    // soft lighting for any lit (non-additive) exhibit geometry
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(40, 30, 50);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x33425a, 0.6));

    this.pickTargets = [];
  }

  get hasIR(){ return this.exhibit.hasIR === true; }
  setIR(on){ if (this.exhibit.setIR) this.exhibit.setIR(on); }
  setMoment(moment){
    const visual = moment && (moment.visual || moment);
    if (!visual) return;
    if (this.exhibit.setMoment) this.exhibit.setMoment(visual);
    else if (visual.wavelength) this.setIR(visual.wavelength === 'infrared');
  }

  focusDist(){ return this.exhibit.focusDist || 80; }
  minDist(){ return this.focusDist() * 0.35; }
  maxDist(){ return this.focusDist() * 2.6; }
  startTheta(){ return this.exhibit.startTheta; }
  startPhi(){ return this.exhibit.startPhi; }
  autoRotate(){ return this.exhibit.autoRotate !== false; }

  update(dt, camera){ if (this.exhibit.update) this.exhibit.update(dt, camera); }

  dispose(){
    if (this.exhibit.dispose) this.exhibit.dispose();
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats){ if (m.map) m.map.dispose(); m.dispose(); }
    });
    this.scene.clear();
  }
}
