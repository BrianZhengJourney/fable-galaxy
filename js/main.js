/* Fable Galaxy — app orchestrator.
   Two scales: 'system' (a star system, Sol or procedural) and 'galaxy'
   (80k-star spiral). Zoom out of a system far enough and you ascend to the
   galactic frame; click a catalog star to hyperjump back down. */

import * as THREE from 'three';
import { TimeSystem } from './core/time.js';
import { CameraRig } from './core/cameraRig.js';
import { Input } from './core/input.js';
import { SystemView } from './scenes/systemView.js';
import { GalaxyView } from './scenes/galaxyView.js';
import { LabelManager } from './ui/labels.js';
import { Hud } from './ui/hud.js';
import { SOL_SYSTEM } from './data/solData.js';
import { STAR_CATALOG } from './data/starCatalog.js';
import { generateSystem } from './procgen/system.js';

const ORIGIN = new THREE.Vector3();

class App {
  constructor(){
    this.W = window.innerWidth; this.H = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.W, this.H);
    this.renderer.setClearColor(0x000206);
    document.getElementById('stage').appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(52, this.W / this.H, 0.1, 4000);
    this.time = new TimeSystem();
    this.rig = new CameraRig(this.camera);
    this.labels = new LabelManager(document.getElementById('labels'));
    this.hud = new Hud(this);

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this._tmp = new THREE.Vector3();

    this.galaxyView = new GalaxyView(this.labels);
    this.mode = 'system';
    this.systemView = null;
    this.focus = null;          // system mode: null | CentralStar | Planet
    this.galaxyFocus = null;    // galaxy mode: catalog entry awaiting jump
    this.hovered = null;

    this.hud.buildCatalog(STAR_CATALOG, rec => this.enterSystem(rec, true));
    this.hud.syncTimeButtons(this.time.rate);

    this.input = new Input(this.renderer.domElement, {
      drag: (dx, dy) => { this.rig.drag(dx, dy); this.rig.interact(this.now); },
      wheel: dy => { this.rig.zoom(dy); this.rig.interact(this.now); this._checkAscend(); },
      click: (x, y) => this._onClick(x, y),
      hover: (x, y) => this._onHover(x, y),
      key: e => this._onKey(e)
    });
    window.addEventListener('resize', () => this._onResize());

    this._buildSystem(STAR_CATALOG[0]);          // start at home: SOL
    this.rig.snap({ getTarget: () => ORIGIN, dist: this.systemView.overviewDist(), phi: 1.05 });

    this.clock = new THREE.Clock();
    this.now = 0;
    window.__APP = this;                          // debug/testing hook
    this._frame = this._frame.bind(this);
    this._frame();
  }

  /* ================= scale transitions ================= */

  _buildSystem(rec){
    if (this.systemView) this.systemView.dispose();
    this.labels.clear();
    const def = rec.sol ? SOL_SYSTEM : generateSystem(rec);
    this.systemView = new SystemView(def, this.labels);
    this.systemRec = rec;
    this.mode = 'system';
    this.focus = null;
    this.galaxyFocus = null;
    this.rig.minDist = 6;
    this.rig.maxDist = this.systemView.maxDist();
    this.hud.setSector(rec.name);
    this.hud.setMinimapVisible(true);
    this.hud.setCatalogVisible(false);
    this.hud.hidePanel();
    this._crumbs();
  }

  enterSystem(rec, viaCatalog = false){
    this.hud.flash();
    this._buildSystem(rec);
    // arrive on a glide: start far out, fly down to overview
    this.rig.snap({ getTarget: () => ORIGIN, dist: this.systemView.maxDist() * 0.9, phi: 1.0 });
    this.rig.flyTo({ dist: this.systemView.overviewDist(), dur: viaCatalog ? 1.6 : 1.3 });
  }

  exitToGalaxy(){
    if (this.mode === 'galaxy') return;
    this.hud.flash();
    const rec = this.systemRec;
    if (this.systemView){ this.systemView.dispose(); this.systemView = null; }
    this.labels.clear();
    this.galaxyView.registerLabels();
    this.mode = 'galaxy';
    this.focus = null;
    this.galaxyFocus = null;
    this.rig.minDist = 14;
    this.rig.maxDist = 1600;
    this.hud.setSector('GALACTIC FRAME');
    this.hud.setMinimapVisible(false);
    this.hud.setCatalogVisible(true);
    this.hud.hidePanel();
    this._crumbs();
    // emerge beside the star we left, then drift out for context
    const entry = this.galaxyView.findStar(rec ? rec.name : 'SOL');
    const liveTarget = entry
      ? (() => { const v = new THREE.Vector3();
                 return () => this.galaxyView.starWorldPos(entry, v); })()
      : () => ORIGIN;
    this.rig.snap({ getTarget: liveTarget, dist: 26, phi: 1.15 });
    this.rig.flyTo({ dist: 120, dur: 1.6 });
  }

  _checkAscend(){
    if (this.mode === 'system' && !this.rig.flying &&
        this.rig.dist >= this.rig.maxDist * 0.985)
      this.exitToGalaxy();
  }

  /* ================= focus + navigation ================= */

  focusPlanet(p){
    this.focus = p;
    this.rig.minDist = p.r * 2.2;
    this.rig.flyTo({ getTarget: () => p.group.position, dist: p.cfg.view, dur: 1.25 });
    this.hud.showPanel('TARGET LOCK', p.name, p.cfg.cls, p.cfg.info);
    this._crumbs();
  }
  focusStar(){
    const s = this.systemView.star;
    this.focus = s;
    this.rig.minDist = s.cfg.coreRadius * 2;
    this.rig.flyTo({ getTarget: () => ORIGIN, dist: s.cfg.coreRadius * 4.5, dur: 1.25 });
    this.hud.showPanel('STELLAR LOCK', s.cfg.name, s.cfg.cls, s.cfg.info);
    this._crumbs();
  }
  systemOverview(){
    this.focus = null;
    this.rig.minDist = 6;
    this.rig.flyTo({ getTarget: () => ORIGIN, dist: this.systemView.overviewDist(), dur: 1.25 });
    this.hud.hidePanel();
    this._crumbs();
  }

  _crumbs(){
    const crumbs = [{ label: 'GALAXY', action: () => this.exitToGalaxy() }];
    if (this.mode === 'system'){
      crumbs.push({ label: this.systemRec.name, action: () => this.systemOverview() });
      if (this.focus && !this.focus.isStar) crumbs.push({ label: this.focus.name });
      else if (this.focus && this.focus.isStar) crumbs.push({ label: 'PHOTOSPHERE' });
    }
    this.hud.setCrumbs(crumbs);
  }

  /* ================= picking ================= */

  _raycast(x, y){
    this.ndc.set((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets = this.mode === 'system'
      ? this.systemView.pickTargets : this.galaxyView.pickTargets;
    const hits = this.raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0].object.userData.body : null;
  }

  _onClick(x, y){
    const hit = this._raycast(x, y);
    if (this.mode === 'system'){
      if (!hit) return this.systemOverview();
      if (hit.isStar) return this.focusStar();
      return this.focusPlanet(hit);
    }
    // galaxy mode
    if (!hit){
      this.galaxyFocus = null;
      this.hud.hidePanel();
      this.rig.flyTo({ getTarget: () => ORIGIN, dist: 780, phi: 0.9, dur: 1.4 });
      return;
    }
    if (this.galaxyFocus === hit){                 // second click: engage jump
      return this.enterSystem(hit.rec);
    }
    this.galaxyFocus = hit;
    const v = new THREE.Vector3();
    this.rig.flyTo({
      getTarget: () => this.galaxyView.starWorldPos(hit, v),
      dist: 30, dur: 1.1
    });
    const info = Object.assign({}, hit.rec.sol
      ? { 'SPECTRAL CLASS': 'G2V', 'STATUS': 'HOME SYSTEM' }
      : {}, this._starInfo(hit.rec), { '▸ ACTION': 'CLICK AGAIN TO JUMP' });
    this.hud.showPanel('STELLAR CONTACT', hit.name, hit.rec.cls, info);
  }

  _starInfo(rec){
    const fmt = v => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toPrecision(2));
    return {
      'SURFACE TEMP': rec.temp.toLocaleString('en-US') + ' K',
      'MASS': fmt(rec.mass) + ' M☉',
      'RADIUS': fmt(rec.radius) + ' R☉',
      'LUMINOSITY': fmt(rec.lum) + ' L☉'
    };
  }

  _onHover(x, y){
    const hit = this._raycast(x, y);
    const el = this.renderer.domElement;
    if (this.hovered && this.hovered !== hit){
      if (this.hovered.setHover) this.hovered.setHover(false);
      if (this.hovered.labelEntry) this.hovered.labelEntry.hovered = false;
    }
    this.hovered = hit;
    if (hit){
      if (hit.setHover) hit.setHover(true);
      if (hit.labelEntry) hit.labelEntry.hovered = true;
      this.hud.hover(x, y, hit.name);
      el.style.cursor = 'pointer';
    } else {
      this.hud.hover(0, 0, null);
      el.style.cursor = 'default';
    }
  }

  _onKey(e){
    if (e.code === 'Space'){
      e.preventDefault();
      this.time.setRate(this.time.rate === 0 ? 10 : 0);
      this.hud.syncTimeButtons(this.time.rate);
    }
    if (e.key === 'Escape'){
      if (this.mode === 'system'){
        if (this.focus) this.systemOverview();
        else this.exitToGalaxy();
      } else {
        this.galaxyFocus = null;
        this.hud.hidePanel();
        this.rig.flyTo({ getTarget: () => ORIGIN, dist: 780, phi: 0.9, dur: 1.4 });
      }
    }
  }

  /* ================= main loop ================= */

  _frame(){
    requestAnimationFrame(this._frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.now = this.clock.elapsedTime;

    this.time.advance(dt);
    this.rig.update(dt, this.now);

    const R = this.renderer;
    if (this.mode === 'system'){
      this.systemView.update(dt, this.time.simDays, this.now);
      this.labels.update(this.camera, this.W, this.H);

      R.setViewport(0, 0, this.W, this.H);
      R.setScissorTest(false);
      R.render(this.systemView.scene, this.camera);

      // minimap via scissor (matches #mapFrame CSS)
      const ms = 170, mx = 21, my = 119;
      R.setScissorTest(true);
      R.setViewport(mx, my, ms, ms);
      R.setScissor(mx, my, ms, ms);
      R.clear(true, true, false);
      R.render(this.systemView.scene, this.systemView.mapCam);
      R.setScissorTest(false);
    } else {
      this.galaxyView.update(dt);
      this.labels.update(this.camera, this.W, this.H);
      R.setViewport(0, 0, this.W, this.H);
      R.setScissorTest(false);
      R.render(this.galaxyView.scene, this.camera);
    }

    this.hud.updateReadouts(this.time);
  }

  _onResize(){
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.camera.aspect = this.W / this.H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.W, this.H);
  }
}

export function start(){
  try{
    const test = document.createElement('canvas');
    const gl = test.getContext('webgl2') || test.getContext('webgl');
    if (!gl){
      window.__FATAL('WebGL is not available in this browser/GPU configuration. The deep-field display requires hardware 3D rendering.');
      return;
    }
  }catch(e){
    window.__FATAL('WebGL check failed: ' + e.message);
    return;
  }
  try{
    new App();
    window.__APP_STARTED = true;
  }catch(e){
    console.error(e);
    window.__FATAL('Initialization failed: ' + (e && e.message ? e.message : e));
  }
}
