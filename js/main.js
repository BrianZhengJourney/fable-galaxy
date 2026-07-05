/* Fable Galaxy — app orchestrator.
   Two scales: 'system' (a star system, Sol or procedural) and 'galaxy'
   (80k-star spiral). Zoom out of a system far enough and you ascend to the
   galactic frame; click a catalog star to hyperjump back down. */

import * as THREE from 'three';
import { TimeSystem } from './core/time.js';
import { predictEvents } from './core/events.js';
import { CameraRig } from './core/cameraRig.js';
import { Input } from './core/input.js';
import { SystemView } from './scenes/systemView.js';
import { GalaxyView } from './scenes/galaxyView.js';
import { SurfaceView, canDescend } from './scenes/surfaceView.js';
import { SkyView, OBSERVER } from './scenes/skyView.js';
import { planMission, probePosition, missionState, buildMissionVisuals } from './core/mission.js';
import { LabelManager } from './ui/labels.js';
import { Hud } from './ui/hud.js';
import { SOL_SYSTEM } from './data/solData.js';
import { STAR_CATALOG } from './data/starCatalog.js';
import { generateSystem } from './procgen/system.js';
import { Journal } from './core/journal.js';
import { TourEngine } from './core/tour.js';
import { TOURS } from './data/tours.js';
import { Photometer } from './ui/photometer.js';

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
    this.surfaceView = null;
    this.skyView = null;
    this.skyYaw = 0; this.skyPitch = 0.35;
    this.focus = null;          // system mode: null | CentralStar | Planet
    this.galaxyFocus = null;    // galaxy mode: catalog entry awaiting jump
    this.hovered = null;

    this.mission = null;
    this.transferOrigin = null;
    this.journal = new Journal();
    this.hud.buildCatalog(STAR_CATALOG, rec => this.enterSystem(rec, true), this.journal);
    this.tours = new TourEngine(this);
    this._wireTourMenu();
    this.photometer = new Photometer();
    this.hud.syncTimeButtons(this.time.rate);

    this.input = new Input(this.renderer.domElement, {
      drag: (dx, dy) => {
        if (this.mode === 'sky'){
          this.skyYaw -= dx * 0.0032 * (this.camera.fov / 52);
          this.skyPitch = Math.max(-0.12, Math.min(Math.PI / 2 - 0.02,
            this.skyPitch + dy * 0.0032 * (this.camera.fov / 52)));
          return;
        }
        this.rig.drag(dx, dy); this.rig.interact(this.now);
      },
      wheel: dy => {
        if (this.mode === 'sky'){
          this.camera.fov = Math.max(16, Math.min(75, this.camera.fov * Math.exp(dy * 0.001)));
          this.camera.updateProjectionMatrix();
          return;
        }
        this.rig.zoom(dy); this.rig.interact(this.now); this._checkAscend();
      },
      click: (x, y) => this._onClick(x, y),
      hover: (x, y) => this._onHover(x, y),
      key: e => this._onKey(e)
    });
    window.addEventListener('resize', () => this._onResize());

    this.composer = null;
    this._initBloom();                           // async; falls back to sprite glow

    this._settingHash = false;
    const initialHash = location.hash;           // _buildSystem rewrites the URL — save it
    this._buildSystem(STAR_CATALOG[0]);          // start at home: SOL
    this.rig.snap({ getTarget: () => ORIGIN, dist: this.systemView.overviewDist(), phi: 1.05 });
    this._applyRoute(initialHash);               // deep link: #/star/body?t=simDays
    window.addEventListener('hashchange', () => {
      if (!this._settingHash) this._applyRoute();
    });

    this.clock = new THREE.Clock();
    this.now = 0;
    window.__APP = this;                          // debug/testing hook
    this._frame = this._frame.bind(this);
    this._frame();
  }

  /* ================= deep links ================= */

  _slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  _bodySlug(p){
    // "TRAPPIST-1 f" → "f" inside its own system; "EARTH" → "earth"
    const star = this.systemRec ? this.systemRec.name : '';
    const short = p.name.startsWith(star) ? p.name.slice(star.length).trim() : p.name;
    return this._slug(short || p.name);
  }

  _setHash(){
    let h = '#/galaxy';
    if (this.mode === 'system' || this.mode === 'surface' || this.mode === 'sky'){
      h = '#/' + this._slug(this.systemRec.name);
      if (this.focus && !this.focus.isStar) h += '/' + this._bodySlug(this.focus);
      if (this.mode === 'surface') h += '/orbit';
      if (this.mode === 'sky') h += '/sky';
      h += '?t=' + this.time.simDays.toFixed(1);
    }
    this._settingHash = true;
    history.replaceState(null, '', h);
    this._settingHash = false;
  }

  _applyRoute(hash = location.hash){
    const m = hash.match(/^#\/([^/?]+)(?:\/([^/?]+))?(?:\/(orbit|sky))?(?:\?t=(-?[\d.]+))?/);
    if (!m) return;
    const [, starSlug, bodySlug, orbit, t] = m;
    if (t !== undefined) this.time.simDays = parseFloat(t) || 0;
    if (starSlug === 'galaxy'){ this.exitToGalaxy(); return; }
    const rec = STAR_CATALOG.find(r => this._slug(r.name) === starSlug);
    if (!rec) return;
    if (!this.systemRec || this.systemRec.name !== rec.name || this.mode !== 'system')
      this.enterSystem(rec, true);
    if (bodySlug && this.systemView){
      const body = this.systemView.planets.find(p => this._bodySlug(p) === bodySlug);
      if (body){
        this.focusPlanet(body);
        if (orbit === 'sky' && body.name === 'EARTH') this.enterSky();
        else if (orbit === 'orbit' && canDescend(body)) this.enterSurface(body);
      }
    }
  }

  /* ---- optional post-processing bloom; sprite glow is the fallback ---- */
  async _initBloom(){
    try{
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] =
        await Promise.all([
          import('three/addons/postprocessing/EffectComposer.js'),
          import('three/addons/postprocessing/RenderPass.js'),
          import('three/addons/postprocessing/UnrealBloomPass.js'),
          import('three/addons/postprocessing/OutputPass.js')
        ]);
      const composer = new EffectComposer(this.renderer);
      this._renderPass = new RenderPass(this.systemView.scene, this.camera);
      composer.addPass(this._renderPass);
      composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(this.W, this.H), 0.45, 0.55, 0.62));
      composer.addPass(new OutputPass());
      this.composer = composer;
    }catch(e){
      console.warn('bloom unavailable, using sprite glow only:', e && e.message);
      this.composer = null;
    }
  }

  _renderMain(scene){
    if (this.composer){
      this.renderer.setViewport(0, 0, this.W, this.H);
      this.renderer.setScissorTest(false);
      this._renderPass.scene = scene;
      this.composer.render();
    } else {
      this.renderer.setViewport(0, 0, this.W, this.H);
      this.renderer.setScissorTest(false);
      this.renderer.render(scene, this.camera);
    }
  }

  /* ================= tours ================= */

  _wireTourMenu(){
    const menu = document.getElementById('tourMenu');
    for (const tour of TOURS){
      const item = document.createElement('div');
      item.className = 'tour-item';
      item.innerHTML = '<div class="tn">' + tour.name + '</div>' +
                       '<div class="td">' + tour.desc + '</div>';
      item.addEventListener('click', () => {
        menu.classList.remove('show');
        this.tours.start(tour);
      });
      menu.appendChild(item);
    }
    document.getElementById('tourBtn').addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });
    window.addEventListener('click', () => menu.classList.remove('show'));
  }

  /* navigation helpers used by tour steps */
  goHome(){
    const sol = STAR_CATALOG[0];
    if (!this.systemRec || this.systemRec.name !== 'SOL' || this.mode === 'galaxy')
      this.enterSystem(sol, true);
    else if (this.mode === 'surface') this.exitSurface();
    else this.systemOverview();
  }
  tourJump(starName){
    const entry = this.galaxyView.findStar(starName);
    if (entry) this.enterSystem(entry.rec, true);
  }
  tourFocus(bodyName){
    if (this.mode === 'surface') this.exitSurface();
    if (this.mode !== 'system') return;
    const body = this.systemView.findBody(bodyName);
    if (body) this.focusPlanet(body);
  }
  tourDescend(bodyName){
    this.tourFocus(bodyName);
    const body = this.systemView && this.systemView.findBody(bodyName);
    if (body) this.enterSurface(body);
  }

  /* ================= scale transitions ================= */

  _buildSystem(rec){
    this.cancelMission();
    if (this.skyView){ this.skyView.dispose(); this.skyView = null; }
    if (this.surfaceView){ this.surfaceView.dispose(); this.surfaceView = null; }
    if (this.systemView) this.systemView.dispose();
    this.labels.clear();
    const def = rec.sol ? SOL_SYSTEM : generateSystem(rec);
    this.systemView = new SystemView(def, this.labels);
    this.systemRec = rec;
    this.journal.markVisited(rec.name, this.time.fmtDate());
    if (this.photometer) this.photometer.reset();
    this.hud.buildCatalog(STAR_CATALOG, r => this.enterSystem(r, true), this.journal);
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
    this._events = [];
    this.hud.setEventsVisible(true);
    setTimeout(() => this._computeEvents(), 60);   // off the build frame
  }

  /* ---- event horizon: predicted conjunctions + comet perihelion ---- */
  _computeEvents(){
    if (this.mode !== 'system' || !this.systemView) return;
    const star = this.systemRec.name;
    const bodies = this.systemView.planets.map(p => ({
      name: p.name.startsWith(star) ? p.name.slice(star.length).trim() : p.name,
      period: p.cfg.period,
      lon: t => p.lonAt(t)
    }));
    this._events = predictEvents(bodies, this.systemView.def.comet || null,
                                 this.time.simDays);
    this.hud.renderEvents(this._events, d => this.time.fmtDateAt(d),
      ev => {
        this.time.simDays = ev.t - 2;      // arrive two days early, slowed down
        this.time.setRate(2);
        this.hud.syncTimeButtons(this.time.rate);
        setTimeout(() => this._computeEvents(), 200);
      });
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
    this.cancelMission();
    if (this.skyView){ this.skyView.dispose(); this.skyView = null; }
    if (this.surfaceView){ this.surfaceView.dispose(); this.surfaceView = null; }
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
    this.hud.setEventsVisible(false);
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
    if (this.rig.flying) return;
    if (this.mode === 'surface' && this.rig.dist >= this.rig.maxDist * 0.985)
      return this.exitSurface();
    if (this.mode === 'system' && this.rig.dist >= this.rig.maxDist * 0.985)
      return this.exitToGalaxy();
    // zoom INTO a focused solid planet → drop to low orbit
    if (this.mode === 'system' && this.focus && !this.focus.isStar &&
        canDescend(this.focus) && this.rig.dist <= this.rig.minDist * 1.02)
      this.enterSurface(this.focus);
  }

  /* ================= focus + navigation ================= */

  focusPlanet(p){
    this.focus = p;
    this.rig.minDist = p.r * 2.2;
    this.rig.flyTo({ getTarget: () => p.group.position, dist: p.cfg.view, dur: 1.25 });
    const actions = [];
    if (p.name === 'EARTH' && this.systemRec.name === 'SOL')
      actions.push({ label: '▸ NIGHT SKY · SURFACE VIEW', cb: () => this.enterSky() });
    if (canDescend(p))
      actions.push({ label: '▸ ENTER LOW ORBIT', cb: () => this.enterSurface(p) });
    if (!this.mission && this.systemView.planets.length > 1)
      actions.push({ label: '▸ PLOT TRANSFER FROM HERE', cb: () => this._armTransfer(p) });
    this.hud.showPanel('TARGET LOCK', p.name, p.cfg.cls, p.cfg.info, actions);
    this._crumbs();
  }

  /* ---- mission planning: probe on a Hohmann-style transfer ---- */
  _armTransfer(origin){
    this.transferOrigin = origin;
    this.hud.setMissionVisible(true);
    this.hud.setMissionBody(
      '<span class="hint">SELECT DESTINATION —<br>CLICK ANOTHER PLANET</span>');
  }

  _launchMission(origin, dest){
    const m = planMission(origin, dest, this.time.simDays);
    this.transferOrigin = null;
    if (!m){
      this.hud.setMissionBody('<span class="hint">NO LAUNCH WINDOW FOUND</span>');
      setTimeout(() => { if (!this.mission) this.hud.setMissionVisible(false); }, 2500);
      return;
    }
    this.mission = m;
    this.mission.visuals = buildMissionVisuals(m);
    this.systemView.scene.add(m.visuals.arc, m.visuals.probe);
    this._updateMissionPanel(true);
  }

  cancelMission(){
    if (this.mission && this.systemView && this.mission.visuals){
      this.systemView.scene.remove(this.mission.visuals.arc, this.mission.visuals.probe);
      this.mission.visuals.arc.geometry.dispose();
    }
    this.mission = null;
    this.transferOrigin = null;
    this.hud.setMissionVisible(false);
  }

  _updateMissionPanel(rebuild){
    const m = this.mission;
    if (!m) return;
    const st = missionState(m, this.time.simDays);
    if (rebuild || st !== m._lastState){
      m._lastState = st;
      const short = n => n.startsWith(this.systemRec.name)
        ? n.slice(this.systemRec.name.length).trim() : n;
      this.hud.setMissionBody(
        short(m.origin.name) + ' ▸ <b>' + short(m.dest.name) + '</b><br>' +
        'LAUNCH <b>' + this.time.fmtDateAt(m.tl) + '</b><br>' +
        'TRANSIT <b>' + (m.Tt >= 365 ? (m.Tt / 365.25).toFixed(1) + ' yr' : m.Tt.toFixed(0) + ' d') + '</b><br>' +
        'ARRIVAL <b>' + this.time.fmtDateAt(m.arrival) + '</b><br>' +
        'STATUS <span class="st">' + st + '</span>' +
        '<div class="cancel">ABORT MISSION</div>');
      this.hud.setMissionVisible(true);
      const btn = document.querySelector('#msBody .cancel');
      if (btn) btn.addEventListener('click', () => this.cancelMission());
    }
  }

  /* ---- third scale: low orbit around a solid world ---- */
  enterSurface(p){
    if (this.mode !== 'system' || !p || p.isStar || !canDescend(p)) return;
    this.focus = p;
    this.hud.flash();
    this.labels.clear();
    this.surfaceView = new SurfaceView(p, this.systemView.def.star);
    this.mode = 'surface';
    this.rig.minDist = this.surfaceView.minDist();
    this.rig.maxDist = this.surfaceView.maxDist();
    this.rig.snap({ getTarget: () => ORIGIN, dist: this.surfaceView.maxDist() * 0.92, phi: 1.2 });
    this.rig.flyTo({ dist: this.surfaceView.overviewDist(), dur: 1.5 });
    this.hud.setMinimapVisible(false);
    this.hud.setEventsVisible(false);
    this._crumbs();
  }

  /* ---- night sky: stand on Earth, real sky for the sim date ---- */
  enterSky(){
    if (this.mode !== 'system' || !this.systemRec || this.systemRec.name !== 'SOL') return;
    this.focus = this.systemView.findBody('EARTH');   // you are standing on it
    this.hud.flash();
    this.labels.clear();
    // ground pace: drop to ~30 sim-minutes/sec on entry, restore on exit
    this._preSkyRate = this.time.rate;
    if (Math.abs(this.time.rate) > 0.3){
      this.time.setRate(0.02);
      this.hud.syncTimeButtons(this.time.rate);
    }
    this.skyView = new SkyView(this.labels);
    this.mode = 'sky';
    this.skyYaw = Math.PI;            // face south, where the ecliptic rides
    this.skyPitch = 0.35;
    this.camera.position.set(0, 2, 0);
    this.camera.rotation.order = 'YXZ';
    this.hud.setMinimapVisible(false);
    this.hud.setEventsVisible(false);
    this._skyPanel();
    this._crumbs();
  }

  _skyPanel(){
    const st = this.skyView.status(this.time.simDays);
    this.hud.showPanel('GROUND STATION', 'NIGHT SKY', OBSERVER.name, {
      'LATITUDE': OBSERVER.lat.toFixed(2) + '° N',
      'LONGITUDE': Math.abs(OBSERVER.lon).toFixed(2) + '° W',
      'LOCAL SIDEREAL': (st.lstDeg / 15).toFixed(2) + ' h',
      'SUN ALTITUDE': st.sunAlt.toFixed(1) + '°',
      'TIME MODE': 'CONTINUOUS',
      'CATALOG': 'HYG v4.1 · ' + '5,998 STARS'
    }, [
      { label: '▸ TOGGLE CONSTELLATIONS', cb: () => this.skyView.toggleConstellations() },
      { label: '▸ RETURN TO ORBIT', cb: () => this.exitSky() }
    ]);
  }

  exitSky(){
    if (this.mode !== 'sky') return;
    this.hud.flash();
    if (this._preSkyRate !== undefined && this.time.rate === 0.02){
      this.time.setRate(this._preSkyRate);        // give back the orrery pace
      this.hud.syncTimeButtons(this.time.rate);
    }
    this.skyView.dispose();
    this.skyView = null;
    this.labels.clear();
    this.systemView.registerLabels();
    this.mode = 'system';
    this.camera.fov = 52;
    this.camera.rotation.set(0, 0, 0);
    this.camera.updateProjectionMatrix();
    const earth = this.systemView.findBody('EARTH');
    this.focusPlanet(earth);
    this.hud.setMinimapVisible(true);
    this.hud.setEventsVisible(true);
  }

  exitSurface(){
    if (this.mode !== 'surface') return;
    const p = this.focus || this.systemView.planets[0];
    this.hud.flash();
    this.surfaceView.dispose();
    this.surfaceView = null;
    this.labels.clear();
    this.systemView.registerLabels();
    this.mode = 'system';
    this.rig.minDist = p.r * 2.2;
    this.rig.maxDist = this.systemView.maxDist();
    this.rig.snap({ getTarget: () => p.group.position, dist: p.cfg.view * 2.2 });
    this.rig.flyTo({ dist: p.cfg.view, dur: 1.2 });
    this.hud.setMinimapVisible(true);
    this.hud.setEventsVisible(true);
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
    if (this.mode === 'system' || this.mode === 'surface' || this.mode === 'sky'){
      crumbs.push({ label: this.systemRec.name, action: () => this.systemOverview() });
      if (this.focus && !this.focus.isStar)
        crumbs.push({ label: this.focus.name,
                      action: this.mode === 'surface' ? () => this.exitSurface()
                            : this.mode === 'sky' ? () => this.exitSky() : null });
      else if (this.focus && this.focus.isStar) crumbs.push({ label: 'PHOTOSPHERE' });
      if (this.mode === 'surface') crumbs.push({ label: 'LOW ORBIT' });
      if (this.mode === 'sky') crumbs.push({ label: 'NIGHT SKY' });
    }
    this.hud.setCrumbs(crumbs);
    this._setHash();   // every navigation change is a shareable URL
  }

  /* ================= picking ================= */

  _raycast(x, y){
    if (this.mode === 'surface') return null;
    this.ndc.set((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets = this.mode === 'system'
      ? this.systemView.pickTargets : this.galaxyView.pickTargets;
    const hits = this.raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0].object.userData.body : null;
  }

  _onClick(x, y){
    if (this.mode === 'surface' || this.mode === 'sky') return;
    const hit = this._raycast(x, y);
    if (this.mode === 'system'){
      // armed transfer: the next planet clicked becomes the destination
      if (this.transferOrigin && hit && !hit.isStar && hit !== this.transferOrigin)
        return this._launchMission(this.transferOrigin, hit);
      if (this.transferOrigin && !hit){
        this.transferOrigin = null;
        if (!this.mission) this.hud.setMissionVisible(false);
      }
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
    // fog of war: survey data only exists for systems you've entered
    const surveyed = this.journal.isVisited(hit.name);
    const info = surveyed
      ? Object.assign({}, hit.rec.sol ? { 'STATUS': 'HOME SYSTEM' } : {},
          this._starInfo(hit.rec),
          { 'SURVEYS': String(this.journal.visitCount(hit.name)),
            '▸ ACTION': 'CLICK AGAIN TO JUMP' })
      : { 'STATUS': 'UNSURVEYED', 'TELEMETRY': 'NO DATA',
          '▸ ACTION': 'CLICK AGAIN TO SCAN' };
    this.hud.showPanel('STELLAR CONTACT', hit.name,
      surveyed ? hit.rec.cls : 'UNKNOWN CLASS', info);
  }

  _starInfo(rec){
    const fmt = v => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toPrecision(2));
    const info = {
      'SURFACE TEMP': rec.temp.toLocaleString('en-US') + ' K',
      'MASS': fmt(rec.mass) + ' M☉',
      'RADIUS': fmt(rec.radius) + ' R☉',
      'LUMINOSITY': fmt(rec.lum) + ' L☉'
    };
    if (rec.realDistPc)
      info['DISTANCE'] = fmt(rec.realDistPc * 3.2616) + ' ly (HYG)';
    return info;
  }

  _onHover(x, y){
    if (this.mode === 'sky' || this.mode === 'surface') return;
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
      if (this.mode === 'sky'){
        this.exitSky();
      } else if (this.mode === 'surface'){
        this.exitSurface();
      } else if (this.mode === 'system'){
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
    if (this.mode !== 'sky') this.rig.update(dt, this.now);

    const R = this.renderer;
    if (this.mode === 'sky'){
      this.skyView.update(this.time.simDays, this.time.rate);
      this.camera.position.set(0, 2, 0);
      this.camera.rotation.set(this.skyPitch, this.skyYaw, 0);
      this.labels.update(this.camera, this.W, this.H);
      this._skyTick = (this._skyTick || 0) + 1;
      if (this._skyTick % 20 === 0){
        // update the live readouts in place (no re-scramble)
        const st = this.skyView.status(this.time.simDays);
        const vs = document.querySelectorAll('#p-rows .v');
        if (vs.length >= 5){
          vs[2].textContent = (st.lstDeg / 15).toFixed(2) + ' h';
          vs[3].textContent = st.sunAlt.toFixed(1) + '°';
          vs[4].textContent = this.skyView.strobe ? 'DAY-STEP · SUN LOCKED' : 'CONTINUOUS';
        }
      }
      this._renderMain(this.skyView.scene);
    } else if (this.mode === 'surface'){
      this.surfaceView.update(dt, this.time.simDays);
      this._renderMain(this.surfaceView.scene);
    } else if (this.mode === 'system'){
      this.systemView.update(dt, this.time.simDays, this.now);
      this.labels.update(this.camera, this.W, this.H);

      // refresh the event list once time overtakes it (throttled)
      this._evTick = (this._evTick || 0) + 1;
      if (this._evTick % 90 === 0 && this._events && this._events.length &&
          this.time.simDays > this._events[0].t + 0.5)
        this._computeEvents();

      // transit light curve along the current line of sight
      this.photometer.sample(this.camera, this.systemView.star, this.systemView.planets);

      // active mission: move the probe, keep the panel status live
      if (this.mission){
        probePosition(this.mission, this.time.simDays, this.mission.visuals.probe.position);
        if (this._evTick % 15 === 0) this._updateMissionPanel(false);
      }

      this._renderMain(this.systemView.scene);

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
      this._renderMain(this.galaxyView.scene);
    }

    this.hud.updateReadouts(this.time);
  }

  _onResize(){
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.camera.aspect = this.W / this.H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.W, this.H);
    if (this.composer) this.composer.setSize(this.W, this.H);
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
