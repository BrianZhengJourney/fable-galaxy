/* Cosmic Landmark exhibit scene. Builds a procedural rendering of a famous
   object/event (by vizStyle) on a star backdrop; the camera orbits it while a
   story card narrates. One scene per landmark, disposed on exit. */

import * as THREE from 'three';
import { buildStarSphere } from '../objects/starfield.js';
import { buildExhibit, buildImagePlate, buildImageVolume } from '../procgen/exhibits.js';
import { buildFeaturedExhibit } from '../procgen/featured/registry.js';
import { landmarkImage } from '../data/landmarkImages.js';
import { landmarkImageIR } from '../data/landmarkImagesIR.js';

function buildArchiveOnly(entry){
  const group = new THREE.Group();
  group.name = `ArchiveOnly.${entry.id}`;
  group.userData.archiveOnly = true;
  group.userData.noGenericReconstruction = true;
  group.userData.reason = 'No curated 3D reconstruction or verified observation asset';
  return {
    group,
    focusDist: 80,
    startTheta: 0,
    startPhi: Math.PI / 2,
    autoRotate: false,
    isImage: false,
  };
}

export class LandmarkView {
  constructor(entry){
    this.entry = entry;
    this.scene = new THREE.Scene();
    this.scene.add(buildStarSphere('lm:' + entry.id));

    // Curated objects own explicit, science-led 3D renderers. Uncurated nebula
    // and remnant URLs keep their authentic observation as a flat archive plate
    // instead of reviving the old generic fuzzy volume. Galaxies retain the
    // existing volume fallback until their own curation pass.
    const img = landmarkImage(entry.id);
    const ir = landmarkImageIR(entry.id);
    const galaxyVolume = !!img && entry.category === 'GALAXY';
    const featured = buildFeaturedExhibit({ entry, image: img, infrared: ir });
    const deepSkyArchiveOnly = !img &&
      (entry.category === 'NEBULA' || entry.category === 'SUPERNOVA');
    this.exhibit = featured
                 || (galaxyVolume ? buildImageVolume(entry, img.file)
                 : img ? buildImagePlate(entry, img.file)
                 : deepSkyArchiveOnly ? buildArchiveOnly(entry)
                 : buildExhibit(entry));
    this.hasImage = !!img;
    const fallbackImageCredit = img
      ? img.credit + (ir ? ' · IR: ' + ir.credit : '')
      : null;
    this.imageCredit = this.exhibit.imageCredit || fallbackImageCredit;
    this.modelCredit = this.exhibit.modelCredit || null;
    this._activeMoment = null;
    this.scene.add(this.exhibit.group);

    // soft lighting for any lit (non-additive) exhibit geometry
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(40, 30, 50);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x33425a, 0.6));

    this.pickTargets = [];
    this._disposed = false;
  }

  get hasIR(){ return this.exhibit.hasIR === true; }
  setIR(on){ if (this.exhibit.setIR) this.exhibit.setIR(on); }
  setMoment(moment){
    const visual = moment && (moment.visual || moment);
    if (!visual) return;
    this._activeMoment = moment;
    if (this.exhibit.setMoment) this.exhibit.setMoment(visual);
    else if (visual.wavelength) this.setIR(visual.wavelength === 'infrared');
  }

  currentCredit(){
    const moment = this._activeMoment;
    const visual = moment && (moment.visual || moment) || {};
    const presentationCredit = this.exhibit.creditForPresentation &&
      this.exhibit.creditForPresentation({ moment, visual });
    if (presentationCredit) return presentationCredit;
    const persistentModel = this.exhibit.group.userData.modelAlwaysVisible === true ||
      this.exhibit.group.userData.persistentThreeDimensionalModel === true;
    const explicitObservation = visual.observation === true ||
      visual.state === 'observation' ||
      this.exhibit.group.userData.observationVisible === true ||
      this.exhibit.group.userData.observationRequested === true ||
      this.exhibit.group.userData.activePresentation === 'model-plus-source-observation';
    // Legacy observation-led exhibits do not all carry explicit visual flags.
    // Persistent model-led exhibits do, so their history chapter names must not
    // falsely claim that a hidden source image is currently on screen.
    const inferredObservation = !persistentModel &&
      /OBSERVATION|IMAGE|REGISTERED COMPARISON/.test(moment && moment.kind || '');
    const observation = explicitObservation || inferredObservation;
    if (observation && this.imageCredit){
      if (persistentModel && this.modelCredit)
        return { label: 'OBSERVATION + MODEL', text: this.imageCredit + ' · ' + this.modelCredit };
      return { label: 'IMAGE', text: this.imageCredit };
    }
    if (this.modelCredit) return { label: 'MODEL', text: this.modelCredit };
    if (this.imageCredit) return { label: 'SOURCE', text: this.imageCredit };
    return null;
  }

  focusDist(){ return this.exhibit.focusDist || 80; }
  minDist(){ return this.focusDist() * 0.35; }
  maxDist(){ return this.focusDist() * 2.6; }
  startTheta(){ return this.exhibit.startTheta; }
  startPhi(){ return this.exhibit.startPhi; }
  autoRotate(){ return this.exhibit.autoRotate !== false; }

  update(dt, camera){ if (this.exhibit.update) this.exhibit.update(dt, camera); }

  dispose(){
    if (this._disposed) return;
    this._disposed = true;
    if (this.exhibit.dispose) this.exhibit.dispose();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.scene.traverse(obj => {
      if (obj.geometry && !geometries.has(obj.geometry)){
        geometries.add(obj.geometry); obj.geometry.dispose();
      }
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats){
        if (materials.has(m)) continue;
        materials.add(m);
        const sharedMap = m.map && m.map.userData && m.map.userData.shared;
        if (m.map && !textures.has(m.map) && !sharedMap && !(m.userData && m.userData.keepMaps)){
          textures.add(m.map); m.map.dispose();
        }
        m.dispose();
      }
    });
    this.scene.clear();
  }
}
