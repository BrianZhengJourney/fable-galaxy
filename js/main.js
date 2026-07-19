/* GALAXY 42 — app orchestrator.
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
import { evictTextures } from './utils/assets.js';
import { QualityManager, detectTier } from './core/quality.js';
import { TourEngine } from './core/tour.js';
import { TOURS } from './data/tours.js';
import { Photometer } from './ui/photometer.js';
import { AudioEngine } from './ui/audio.js';
import { DeepSkyPresentation } from './ui/deepSkyPresentation.js';
import { LandmarkView } from './scenes/landmarkView.js';
import { LANDMARKS, LANDMARK_CATEGORIES } from './data/landmarks.js';
import { landmarkImage } from './data/landmarkImages.js';
import { landmarkExperience, bodyExperience } from './data/fieldStories.js';
import {
  EXPLORE_LANDMARK_IDS,
  EXPLORE_SECTIONS,
} from './data/exploreSections.js';
import { DEFAULT_SOL_EPOCH, SOL_EPOCHS, resolveSolEpoch } from './data/solEpochs.js';
import { evictEarthEpochTextures } from './utils/earthEpochTextures.js';
import { evictPlanetEpochTextures } from './utils/planetEpochTextures.js';
import { parseAtlasHash } from './core/route.js';

const ORIGIN = new THREE.Vector3();

function evictEpochTextures(){
  evictEarthEpochTextures();
  evictPlanetEpochTextures();
}

class App {
  constructor(){
    this.W = window.innerWidth; this.H = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.W, this.H);
    this.renderer.setClearColor(0x000000);   // true-black deep space
    document.getElementById('stage').appendChild(this.renderer.domElement);
    // device tier + adaptive DPR/bloom (sets the initial pixel ratio)
    this.quality = new QualityManager(this);
    console.info('[GALAXY 42] render tier:', detectTier());

    this.camera = new THREE.PerspectiveCamera(52, this.W / this.H, 0.1, 4000);
    this.time = new TimeSystem();
    this.rig = new CameraRig(this.camera);
    this.labels = new LabelManager(document.getElementById('labels'));
    this.audio = new AudioEngine();
    this.journal = new Journal();
    this.hud = new Hud(this);
    this.deepSkyPresentation = new DeepSkyPresentation();

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
    this.solEpochId = DEFAULT_SOL_EPOCH;

    this.mission = null;
    this.transferOrigin = null;
    this.tours = new TourEngine(this);
    this._wireTourMenu();
    this.photometer = new Photometer();
    this.landmarkView = null;
    this.landmarkIndex = -1;
    this._landmarkIntro = null;
    this._landmarkIntroGeneration = 0;
    this._wireLandmarks();
    this.hud.syncTimeButtons(this.time.rate);

    this.input = new Input(this.renderer.domElement, {
      drag: (dx, dy) => {
        if (this.mode === 'sky'){
          this.skyYaw -= dx * 0.0032 * (this.camera.fov / 52);
          this.skyPitch = Math.max(-0.12, Math.min(Math.PI / 2 - 0.02,
            this.skyPitch + dy * 0.0032 * (this.camera.fov / 52)));
          return;
        }
        if (this.mode === 'landmark') this._takeOverLandmarkIntro();
        this.rig.drag(dx, dy); this.rig.interact(this.now);
      },
      wheel: dy => {
        if (this.mode === 'sky'){
          this.camera.fov = Math.max(16, Math.min(75, this.camera.fov * Math.exp(dy * 0.001)));
          this.camera.updateProjectionMatrix();
          return;
        }
        if (this.mode === 'landmark') this._takeOverLandmarkIntro();
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
    this._wireExperienceShell(initialHash);
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
    if (this.mode === 'landmark' && this.landmarkView){
      h = '#/landmark/' + this.landmarkView.entry.id;
    } else if (this.mode === 'system' || this.mode === 'surface' || this.mode === 'sky'){
      h = '#/' + this._slug(this.systemRec.name);
      if (this.focus && !this.focus.isStar) h += '/' + this._bodySlug(this.focus);
      if (this.mode === 'surface') h += '/orbit';
      if (this.mode === 'sky') h += '/sky';
      h += '?t=' + this.time.simDays.toFixed(1);
      if (this.systemRec && this.systemRec.sol && this.solEpochId !== DEFAULT_SOL_EPOCH)
        h += '&epoch=' + encodeURIComponent(this.solEpochId);
    }
    this._settingHash = true;
    history.replaceState(null, '', h);
    this._settingHash = false;
  }

  _applyRoute(hash = location.hash){
    if (!hash || hash === '#') return;              // bare URL opens at Sol
    const route = parseAtlasHash(hash);
    if (route.type === 'landmark'){
      const landmark = LANDMARKS.find(e => e.id === route.landmarkId);
      if (landmark) this.enterLandmark(landmark);
      return;
    }
    if (route.type === 'galaxy'){ this.exitToGalaxy(); return; }
    if (route.simDays !== undefined) this.time.simDays = route.simDays;
    const rec = STAR_CATALOG.find(r => this._slug(r.name) === route.starSlug);
    if (!rec) return;
    if (!this.systemRec || this.systemRec.name !== rec.name || this.mode !== 'system')
      this.enterSystem(rec, true);
    if (!route.bodySlug && this.focus) this.systemOverview();
    if (rec.sol) this.setSolEpoch(route.epoch || DEFAULT_SOL_EPOCH, { updateHash: false });
    if (route.bodySlug && this.systemView){
      const body = [
        ...this.systemView.planets,
        ...this.systemView.satellites.map(s => s.body),
        ...this.systemView.features,
      ].find(candidate => this._bodySlug(candidate) === route.bodySlug);
      if (body){
        if (body.isSystemFeature) this.focusSystemFeature(body);
        else this.focusPlanet(body);
        if (route.view === 'sky' && body.name === 'EARTH') this.enterSky();
        else if (route.view === 'orbit' && !body.isSystemFeature && canDescend(body))
          this.enterSurface(body);
      }
    }
    this._setHash();
  }

  /* ================= experience shell ================= */

  _wireExperienceShell(initialHash){
    const share = () => this._shareCurrentView();
    const openLog = () => this._openJournal();
    document.getElementById('shareBtn').addEventListener('click', share);
    document.getElementById('drawerShare').addEventListener('click', share);
    document.getElementById('logBtn').addEventListener('click', openLog);
    document.getElementById('drawerLog').addEventListener('click', openLog);
    document.getElementById('journalClose').addEventListener('click',
      () => this.hud.setJournalVisible(false));

    for (const button of document.querySelectorAll('[data-journey]')){
      button.addEventListener('click', () => {
        this.hud.completeOnboarding();
        if (button.dataset.journey === 'sol') this.goHome();
        else if (button.dataset.journey === 'observation'){
          const entry = LANDMARKS.find(candidate => candidate.id === 'pillars-of-creation');
          if (entry) this.enterLandmark(entry);
        } else if (button.dataset.journey === 'black-hole'){
          const entry = LANDMARKS.find(candidate => candidate.id === 'm87-star');
          if (entry) this.enterLandmark(entry);
        }
        this._showContextHint();
      });
    }
    document.getElementById('welcomeSkip').addEventListener('click', () => {
      this.hud.completeOnboarding();
      this._showContextHint();
    });

    this._experienceReady = true;
    this._refreshJournal();
    const bareEntry = !initialHash || initialHash === '#';
    if (bareEntry && !this.hud.onboardingSeen()) this.hud.setWelcomeVisible(true);
    else this._showContextHint();
  }

  _showContextHint(){
    const hints = {
      system: 'DRAG TO ORBIT · SCROLL OR PINCH TO ZOOM · TAP A WORLD TO INSPECT',
      galaxy: 'DRAG TO ROTATE · TAP A STAR ONCE TO INSPECT, AGAIN TO JUMP',
      landmark: 'DRAG TO INSPECT DEPTH · USE THE VIEW MODES AND TIMELINE TO COMPARE EVIDENCE',
      surface: 'DRAG TO ORBIT THE WORLD · SCROLL OR PINCH TO CHANGE ALTITUDE',
      sky: 'DRAG TO LOOK AROUND · SCROLL OR PINCH TO CHANGE FIELD OF VIEW',
    };
    this.hud.showContextHint(this.mode, hints[this.mode]);
  }

  _refreshJournal(){
    if (!this.exploreSections) return;
    const total = this.exploreSections.reduce((sum, section) => sum + section.items.length, 0);
    this.hud.renderJournal(this.journal.entries(), total, entry => {
      this.hud.setJournalVisible(false);
      if (entry.kind === 'landmark'){
        const landmark = LANDMARKS.find(candidate => candidate.id === entry.target);
        if (landmark) this.enterLandmark(landmark);
        else this.hud.toast('FIELD RECORD IS NO LONGER IN THE CURATED ATLAS');
        return;
      }
      const system = STAR_CATALOG.find(candidate =>
        candidate.name === (entry.target || entry.name || entry.key));
      if (system) this.enterSystem(system, true);
      else this.hud.toast('SYSTEM RECORD IS NOT AVAILABLE IN THIS BUILD');
    });
  }

  _openJournal(){
    this._refreshJournal();
    this.hud.setJournalVisible(true);
  }

  _currentViewTitle(){
    if (this.mode === 'landmark' && this.landmarkView) return this.landmarkView.entry.name;
    if (this.focus) return this.focus.name || (this.focus.cfg && this.focus.cfg.name) || this.systemRec.name;
    if (this.mode === 'galaxy') return 'THE GALAXY MAP';
    return this.systemRec ? this.systemRec.name : 'GALAXY 42';
  }

  async _shareCurrentView(){
    this._setHash();
    const title = this._currentViewTitle() + ' · GALAXY 42';
    const data = { title, text: 'Explore ' + this._currentViewTitle() + ' in GALAXY 42.', url: location.href };
    if (navigator.share){
      try{
        await navigator.share(data);
        this.hud.toast('VIEW SHARED');
        return;
      }catch(error){
        if (error && error.name === 'AbortError') return;
      }
    }
    try{
      await navigator.clipboard.writeText(data.url);
      this.hud.toast('VIEW LINK COPIED');
    }catch(error){
      const field = document.createElement('textarea');
      field.value = data.url; field.setAttribute('readonly', '');
      field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.appendChild(field); field.select();
      const copied = document.execCommand('copy');
      field.remove();
      this.hud.toast(copied ? 'VIEW LINK COPIED' : 'COPY THE URL FROM YOUR ADDRESS BAR');
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
      const initialScene = this.mode === 'landmark' ? this.landmarkView && this.landmarkView.scene
        : this.mode === 'sky' ? this.skyView && this.skyView.scene
        : this.mode === 'surface' ? this.surfaceView && this.surfaceView.scene
        : this.mode === 'galaxy' ? this.galaxyView.scene
        : this.systemView && this.systemView.scene;
      if (!initialScene) throw new Error('active render scene is unavailable');
      this._renderPass = new RenderPass(initialScene, this.camera);
      composer.addPass(this._renderPass);
      composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(this.W, this.H), 0.45, 0.55, 0.62));
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.quality.apply();          // give the composer the current pixel ratio
    }catch(e){
      console.warn('bloom unavailable, using sprite glow only:', e && e.message);
      this.composer = null;
    }
  }

  _renderMain(scene){
    if (this.composer && this.quality.bloom){
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
    if (!this.systemRec || this.systemRec.name !== 'SOL' ||
        this.mode === 'galaxy' || this.mode === 'landmark')
      this.enterSystem(sol, true);
    else if (this.mode === 'surface') this.exitSurface();
    else this.systemOverview();
    this.setSolEpoch(DEFAULT_SOL_EPOCH);
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

  /* ================= cosmic landmarks ================= */

  _wireLandmarks(){
    const catalog = new Map(LANDMARKS.map(entry => [entry.id, entry]));
    this.exploreSections = EXPLORE_SECTIONS.map(section => ({
      ...section,
      items: section.items.map(item => {
        if (item.kind === 'system'){
          const rec = STAR_CATALOG.find(candidate => candidate.name === item.target);
          if (!rec) throw new Error('Explore system missing from star catalog: ' + item.target);
          return {
            ...item,
            entry: {
              id: item.id,
              name: item.name,
              designation: item.designation,
              kind: 'system',
              rec,
            },
          };
        }
        const entry = catalog.get(item.id);
        if (!entry) throw new Error('Explore landmark missing from catalog: ' + item.id);
        return { ...item, entry };
      }),
    }));
    this.exploreLandmarks = this.exploreSections
      .flatMap(section => section.items.map(item => item.entry))
      .filter(entry => entry.kind !== 'system');
    this.hud.buildLandmarks(this.exploreSections, record => {
      if (record.kind === 'system'){
        this.hud.setLandmarksVisible(false);
        this.enterSystem(record.entry.rec, true);
      } else this.enterLandmark(record.entry);
    });
    const btn = document.getElementById('landmarkBtn');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      this.hud.setLandmarksVisible(!this.hud.landmarksVisible());
    });
    document.getElementById('lmClose').addEventListener('click',
      () => this.hud.setLandmarksVisible(false));
  }

  enterLandmark(entry){
    this._clearHover();
    this._cancelLandmarkIntro({ clearPresentation: true });
    if (this.mode !== 'landmark'){
      this._hideBodyStory();
      this._preLandmarkRate = this.time.rate;
    }
    this.time.setRate(0);
    this.hud.syncTimeButtons(this.time.rate);
    this.hud.hideStoryline();
    this.hud.hideSolEpochs();
    this.landmarkIndex = LANDMARKS.indexOf(entry);
    this.hud.setLandmarksVisible(false);
    this.hud.flash();
    this.audio.jump();
    if (this.landmarkView) this.landmarkView.dispose();
    if (this.systemView){ this.systemView.dispose(); this.systemView = null; }
    if (this.surfaceView){ this.surfaceView.dispose(); this.surfaceView = null; }
    if (this.skyView){ this.skyView.dispose(); this.skyView = null; }
    evictTextures();
    evictEpochTextures();
    this.labels.clear();
    this.landmarkView = new LandmarkView(entry);
    this.mode = 'landmark';
    this.hud.setMode('landmark');
    this.journal.markVisited(entry.name, this.time.fmtDate(), {
      key: 'LANDMARK::' + entry.id,
      kind: 'landmark',
      target: entry.id,
    });
    this._refreshJournal();
    this.focus = null;
    // hide system-scale instruments, show the story
    this.hud.hidePanel();
    this.hud.setMinimapVisible(false);
    this.hud.setEventsVisible(false);
    this.hud.setSector('LANDMARK');
    const cat = LANDMARK_CATEGORIES.find(c => c.key === entry.category);
    const experience = landmarkExperience(entry);
    this.hud.showLandmarkCard(entry, cat, {
      onPrev: () => this._landmarkStep(-1),
      onNext: () => this._landmarkStep(1),
      onExit: () => this.exitLandmark(),
      action: this._landmarkAction(entry),
      credit: this.landmarkView.currentCredit(),
      experience,
      wavelength: this.landmarkView.hasIR ? on => this._setLandmarkWavelength(on) : null
    });
    this._crumbs();
    // orbit the exhibit
    this.rig.autoRotate = this.landmarkView.autoRotate();
    this.rig.minDist = this.landmarkView.minDist();
    this.rig.maxDist = this.landmarkView.maxDist();
    const sequence = experience && experience.entrySequence;
    const observationMoment = sequence && experience.moments.find(moment =>
      moment.id === sequence.observationMomentId);
    if (sequence && observationMoment){
      const image = landmarkImage(entry.id);
      const visual = observationMoment.visual || {};
      const factor = visual.distance == null ? 1 : visual.distance;
      const generation = ++this._landmarkIntroGeneration;
      const observationLoad = this.deepSkyPresentation.prepare({
        entry,
        image,
        durationMs: sequence.durationSeconds * 1000,
      });
      this._landmarkIntro = {
        generation,
        experience,
        sequence,
        phase: 'await-observation',
        elapsed: 0,
        observationSettled: false,
        observationAvailable: false,
      };
      observationLoad.then(available => {
        const intro = this._landmarkIntro;
        if (!intro || intro.generation !== generation) return;
        intro.observationSettled = true;
        intro.observationAvailable = available;
      });
      this.rig.snap({
        getTarget: () => ORIGIN,
        dist: this.landmarkView.focusDist() * factor,
        theta: visual.theta == null ? 0 : visual.theta,
        phi: visual.phi == null ? Math.PI / 2 : visual.phi,
      });
    } else {
      this.deepSkyPresentation.clear();
      const startTheta = this.landmarkView.startTheta();
      const startPhi = this.landmarkView.startPhi();
      const startPose = {
        getTarget: () => ORIGIN,
        dist: this.landmarkView.maxDist() * 0.85,
        phi: startPhi == null ? 1.05 : startPhi,
      };
      if (startTheta != null) startPose.theta = startTheta;
      this.rig.snap(startPose);
      this.rig.flyTo({ dist: this.landmarkView.focusDist(), dur: 1.3 });
    }
    this.hud.showStoryline(
      experience,
      (moment, meta) => this._applyLandmarkMoment(moment, meta),
      { initialMomentId: observationMoment && observationMoment.id },
    );
    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this._landmarkIntro && reducedMotion)
      this._settleLandmarkIntro({ snapToModel: true });
  }

  _landmarkStep(dir){
    const current = this.landmarkView && this.landmarkView.entry;
    const sequence = current && EXPLORE_LANDMARK_IDS.includes(current.id)
      ? this.exploreLandmarks : LANDMARKS;
    const at = Math.max(0, sequence.indexOf(current));
    const i = ((at + dir) % sequence.length + sequence.length) % sequence.length;
    this.enterLandmark(sequence[i]);
  }

  _setLandmarkWavelength(on){
    if (!this.landmarkView) return;
    this._takeOverLandmarkIntro();
    this.deepSkyPresentation.showModel();
    this.landmarkView.setIR(on);
    this.hud.setLandmarkWavelength(on);
    const experience = landmarkExperience(this.landmarkView.entry);
    const matched = on
      ? experience.moments.find(moment => {
        const visual = moment.visual || {};
        return visual.wavelength === 'infrared' ||
          /infrared/i.test(String(visual.state || ''));
      })
      : experience.moments.find(moment => moment.id === experience.defaultMoment);
    if (matched){
      this.landmarkView.setMoment(matched);
      this.hud.selectStoryMoment(matched.id, false);
    }
    this.hud.setLandmarkCredit(this.landmarkView.currentCredit());
  }

  _applyLandmarkMoment(moment, meta = {}){
    if (!this.landmarkView || !moment) return;
    if (meta.user) this._cancelLandmarkIntro({ clearPresentation: false });
    const visual = moment.visual || {};
    const presentation = visual.presentation;
    if (presentation === 'observation') this.deepSkyPresentation.showObservation();
    else if (presentation === 'split') this.deepSkyPresentation.showSplit();
    else if (presentation === 'model') this.deepSkyPresentation.showModel();
    else if (meta.user) this.deepSkyPresentation.showModel();
    this.landmarkView.setMoment(moment, visual.delegate);
    this.hud.setLandmarkCredit(this.landmarkView.currentCredit());
    if (visual.wavelength) this.hud.setLandmarkWavelength(visual.wavelength === 'infrared');
    if (meta.intro) return;
    const factor = visual.distance == null ? 1 : visual.distance;
    this.rig.flyTo({
      getTarget: () => ORIGIN,
      dist: this.landmarkView.focusDist() * factor,
      theta: visual.theta,
      phi: visual.phi,
      dur: meta.duration == null ? .95 : meta.duration,
    });
  }

  _modelMomentForIntro(intro){
    return intro && intro.experience.moments.find(moment =>
      moment.id === intro.sequence.modelMomentId);
  }

  _splitMomentForIntro(intro){
    return intro && intro.experience.moments.find(moment =>
      moment.id === intro.sequence.splitMomentId);
  }

  _cancelLandmarkIntro({ clearPresentation = false } = {}){
    this._landmarkIntroGeneration++;
    this._landmarkIntro = null;
    this.rig.cancelFlight();
    if (clearPresentation) this.deepSkyPresentation.clear();
  }

  _takeOverLandmarkIntro(){
    const intro = this._landmarkIntro;
    if (!intro || !this.landmarkView) return;
    const model = this._modelMomentForIntro(intro);
    this._cancelLandmarkIntro({ clearPresentation: false });
    if (model){
      const visual = model.visual || {};
      this.landmarkView.setMoment(model, visual.delegate);
      this.hud.selectStoryMoment(model.id, false);
      this.hud.setLandmarkCredit(this.landmarkView.currentCredit());
    }
    this.deepSkyPresentation.showModel();
  }

  _settleLandmarkIntro({ snapToModel = false, settleToSplit = false } = {}){
    const intro = this._landmarkIntro;
    if (!intro || !this.landmarkView) return;
    const model = this._modelMomentForIntro(intro);
    const split = settleToSplit && this.deepSkyPresentation.ready
      ? this._splitMomentForIntro(intro) : null;
    this._landmarkIntro = null;
    if (!model){
      this.deepSkyPresentation.showModel();
      return;
    }
    // The reveal still turns onto the full 3D model. Once that turn completes,
    // settle into the comparison view so the source and reconstruction remain
    // visible together by default. Explicit 3D/observation controls still take
    // over immediately, and an unavailable source falls back to model-only.
    const settledMoment = split || model;
    const visual = settledMoment.visual || model.visual || {};
    this.landmarkView.setMoment(settledMoment, visual.delegate);
    this.hud.selectStoryMoment(settledMoment.id, false);
    this.hud.setLandmarkCredit(this.landmarkView.currentCredit());
    if (split) this.deepSkyPresentation.showSplit();
    else this.deepSkyPresentation.showModel();
    if (snapToModel){
      const factor = visual.distance == null ? 1 : visual.distance;
      this.rig.snap({
        getTarget: () => ORIGIN,
        dist: this.landmarkView.focusDist() * factor,
        theta: visual.theta,
        phi: visual.phi,
      });
    }
  }

  _updateLandmarkIntro(dt){
    const intro = this._landmarkIntro;
    if (!intro || !this.landmarkView) return;
    if (document.hidden){
      this._takeOverLandmarkIntro();
      return;
    }
    intro.elapsed += dt;
    if (intro.phase === 'await-observation'){
      if (!this.deepSkyPresentation.ready){
        if (intro.elapsed < intro.sequence.readinessTimeoutSeconds &&
            (!intro.observationSettled || intro.observationAvailable)) return;
        this._settleLandmarkIntro({ snapToModel: true });
        return;
      }
      intro.phase = 'hold';
      intro.elapsed = 0;
      return;
    }
    if (intro.phase === 'hold'){
      if (intro.elapsed < intro.sequence.holdSeconds) return;
      const model = this._modelMomentForIntro(intro);
      if (!model){
        this._settleLandmarkIntro();
        return;
      }
      const visual = model.visual || {};
      const factor = visual.distance == null ? 1 : visual.distance;
      intro.phase = 'reveal';
      intro.elapsed = 0;
      this.deepSkyPresentation.beginReveal();
      this.landmarkView.setMoment(model, visual.delegate);
      this.audio.select();
      this.rig.flyTo({
        getTarget: () => ORIGIN,
        dist: this.landmarkView.focusDist() * factor,
        theta: visual.theta,
        phi: visual.phi,
        dur: intro.sequence.durationSeconds,
      });
      return;
    }
    if (intro.phase === 'reveal' &&
        intro.elapsed >= intro.sequence.durationSeconds)
      this._settleLandmarkIntro({ settleToSplit: true });
  }

  _restoreLandmarkClock(){
    if (this._preLandmarkRate === undefined) return;
    this.time.setRate(this._preLandmarkRate);
    this._preLandmarkRate = undefined;
    this.hud.syncTimeButtons(this.time.rate);
  }

  _leaveLandmark(){
    if (!this.landmarkView && this._preLandmarkRate === undefined) return false;
    this._cancelLandmarkIntro({ clearPresentation: true });
    this.hud.hideStoryline();
    this._restoreLandmarkClock();
    this.hud.hideLandmarkCard();
    const view = this.landmarkView;
    this.landmarkView = null;       // make repeated transition paths harmless
    if (view) view.dispose();
    this.rig.autoRotate = true;     // exhibits may have paused the idle drift
    return true;
  }

  exitLandmark(){
    if (this.mode !== 'landmark') return;
    this._leaveLandmark();
    this.exitToGalaxy();   // plays the ascend cue + rebuilds the galaxy view
  }

  /* some landmarks can be experienced in-scene (jump the Sol clock to the date) */
  _landmarkAction(entry){
    if (entry.id === 'm87-star'){
      const archive = LANDMARKS.find(candidate => candidate.id === 'm87-black-hole-image');
      return archive ? {
        label: '▸ OPEN DISCOVERY ARCHIVE',
        cb: () => this.enterLandmark(archive),
      } : null;
    }
    if (entry.category !== 'SOLAR_EVENT') return null;
    const simDays = this._parseLandmarkDate(entry.date);
    if (simDays == null) return null;
    return { label: '▸ WITNESS IN SOL SYSTEM', cb: () => {
      const sol = STAR_CATALOG[0];
      this.enterSystem(sol, true);
      this.setSolEpoch(DEFAULT_SOL_EPOCH, { updateHash: false });
      this.time.simDays = simDays;
      this.time.setRate(0);
      this.hud.syncTimeButtons(this.time.rate);
      // Shoemaker-Levy 9 → look at Jupiter
      if (/shoemaker|levy/i.test(entry.id + entry.name))
        setTimeout(() => this.focusPlanet(this.systemView.findBody('JUPITER')), 60);
    } };
  }

  _parseLandmarkDate(str){
    const m = /(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(str || '');
    if (!m) return null;
    const y = +m[1];
    if (y < 1800 || y > 2050) return null;         // ephemeris validity window
    const ms = Date.UTC(y, (m[2] ? +m[2] - 1 : 0), (m[3] ? +m[3] : 1));
    return (ms - this.time.EPOCH) / 86400000;
  }

  /* ================= scale transitions ================= */

  _buildSystem(rec){
    this._clearHover();
    this._leaveLandmark();
    this._hideBodyStory();
    this.cancelMission();
    if (this.skyView){ this.skyView.dispose(); this.skyView = null; }
    if (this.surfaceView){ this.surfaceView.dispose(); this.surfaceView = null; }
    if (this.systemView) this.systemView.dispose();
    evictTextures();          // free the previous system's real-imagery VRAM
    evictEpochTextures();
    this.labels.clear();
    const def = rec.sol ? SOL_SYSTEM : generateSystem(rec);
    this.systemView = new SystemView(def, this.labels);
    this.systemRec = rec;
    this.journal.markVisited(rec.name, this.time.fmtDate(), {
      kind: 'system',
      target: rec.name,
    });
    this._refreshJournal();
    if (this.photometer) this.photometer.reset();
    this.mode = 'system';
    this.hud.setMode('system');
    this.focus = null;
    this.galaxyFocus = null;
    this.rig.minDist = 6;
    this.rig.maxDist = this.systemView.maxDist();
    this.hud.setSector(rec.name);
    this.hud.setMinimapVisible(true);
    this.hud.hidePanel();
    if (rec.sol){
      this.hud.showSolEpochs(SOL_EPOCHS, id => this.setSolEpoch(id));
      this.setSolEpoch(this.solEpochId, { updateHash: false });
    } else {
      this.hud.hideSolEpochs();
    }
    this._crumbs();
    this._events = [];
    this.hud.setEventsVisible(true);
    setTimeout(() => this._computeEvents(), 60);   // off the build frame
  }

  setSolEpoch(id, { updateHash = true, syncStory = true } = {}){
    const epoch = resolveSolEpoch(id);
    this.solEpochId = epoch.id;
    if (this.systemRec && this.systemRec.sol && this.systemView)
      this.systemView.setEpoch(epoch);
    if (this.surfaceView) this.surfaceView.setEpoch(epoch);
    const bodyName = this.focus && !this.focus.isStar ? this.focus.name : null;
    this.hud.setSolEpoch(epoch, bodyName);
    if (syncStory && this.mode === 'system' && this.systemRec && this.systemRec.sol &&
        this.focus && this.focus.name === 'EARTH'){
      const storyMoment = epoch.id === '1000ma' ? 'earth-rodinia'
        : epoch.id === '5ma' ? 'earth-pliocene' : 'earth-today';
      this.hud.selectStoryMoment(storyMoment, false);
    }
    if (this.mode === 'system' && this.systemRec && this.systemRec.sol &&
        this.focus && !this.focus.isStar && this.focus.name !== 'EARTH'){
      if (epoch.id !== DEFAULT_SOL_EPOCH) this._hideBodyStory();
      else if (this._bodyStoryRate === undefined) this._showBodyStory(this.focus);
    }
    if (updateHash && this.systemRec && this.systemRec.sol) this._setHash();
    return epoch;
  }

  /* ---- event horizon: rare model alignments + comet perihelion ---- */
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
    this._heldEvent = null;
    this.hud.renderEvents(this._events, d => this.time.fmtDateAt(d),
      ev => {
        this.time.simDays = ev.t;          // inspect the exact model state, held still
        this.time.setRate(0);
        this._heldEvent = ev;
        this.hud.syncTimeButtons(this.time.rate);
        this._setHash();
      });
  }

  enterSystem(rec, viaCatalog = false){
    this.hud.flash();
    this.audio.jump();
    this._buildSystem(rec);
    // arrive on a glide: start far out, fly down to overview
    this.rig.snap({ getTarget: () => ORIGIN, dist: this.systemView.maxDist() * 0.9, phi: 1.0 });
    this.rig.flyTo({ dist: this.systemView.overviewDist(), dur: viaCatalog ? 1.6 : 1.3 });
  }

  exitToGalaxy(){
    if (this.mode === 'galaxy') return;
    this._clearHover();
    const wasLandmark = this.mode === 'landmark';
    const leftLandmark = this._leaveLandmark();
    if (!wasLandmark && !leftLandmark) this._hideBodyStory();
    this.hud.flash();
    this.audio.ascend();
    const rec = this.systemRec;
    this.cancelMission();
    if (this.skyView){ this.skyView.dispose(); this.skyView = null; }
    if (this.surfaceView){ this.surfaceView.dispose(); this.surfaceView = null; }
    if (this.systemView){ this.systemView.dispose(); this.systemView = null; }
    evictTextures();
    evictEpochTextures();
    this.labels.clear();
    this.galaxyView.registerLabels();
    this.mode = 'galaxy';
    this.hud.setMode('galaxy');
    this.focus = null;
    this.galaxyFocus = null;
    this.rig.minDist = 14;
    this.rig.maxDist = 1600;
    this.hud.setSector('GALACTIC FRAME');
    this.hud.setMinimapVisible(false);
    this.hud.hideSolEpochs();
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
        !this.focus.isSystemFeature &&
        canDescend(this.focus) && this.rig.dist <= this.rig.minDist * 1.02)
      this.enterSurface(this.focus);
  }

  /* ================= focus + navigation ================= */

  focusPlanet(p){
    this._hideBodyStory();
    this.focus = p;
    this.audio.select();
    this.rig.minDist = p.r * 2.2;
    this.rig.flyTo({ getTarget: () => p.group.position, dist: p.cfg.view, dur: 1.25 });
    const actions = [];
    if (p.name === 'EARTH' && this.systemRec.name === 'SOL'){
      actions.push({
        label: '▸ PRESENT EARTH · NIGHT SKY',
        cb: () => {
          this.setSolEpoch(DEFAULT_SOL_EPOCH);
          this.enterSky();
        }
      });
    }
    if (canDescend(p))
      actions.push({ label: '▸ ENTER LOW ORBIT', cb: () => this.enterSurface(p) });
    if (!p.isMoon && !this.mission && this.systemView.planets.length > 1)
      actions.push({ label: '▸ PLOT TRANSFER FROM HERE', cb: () => this._armTransfer(p) });
    this.hud.showPanel(p.isMoon ? 'SATELLITE LOCK' : 'TARGET LOCK',
      p.name, p.cfg.cls, p.cfg.info, actions);
    if (this.systemRec && this.systemRec.sol)
      this.hud.setSolEpoch(resolveSolEpoch(this.solEpochId), p.name);
    this._showBodyStory(p);
    this._crumbs();
  }

  focusSystemFeature(feature){
    this._hideBodyStory();
    this.focus = feature;
    this.audio.select();
    const belt = feature.featureType === 'belt';
    this.rig.minDist = belt ? 7 : 2.2;
    this.rig.flyTo({
      getTarget: () => feature.group.position,
      dist: feature.cfg.view,
      phi: belt ? 0.5 : undefined,
      dur: 1.25,
    });
    this.hud.showPanel(
      belt ? 'REGION LOCK' : 'SMALL-BODY LOCK',
      feature.name,
      feature.cfg.cls,
      feature.cfg.info,
    );
    if (this.systemRec && this.systemRec.sol)
      this.hud.setSolEpoch(resolveSolEpoch(this.solEpochId));
    this._crumbs();
  }

  _showBodyStory(body){
    let experience = bodyExperience(this.systemRec && this.systemRec.name, body && body.name);
    if (!experience) return;
    if (body.name === 'EARTH' && this.systemRec && this.systemRec.sol){
      const defaultMoment = this.solEpochId === '1000ma' ? 'earth-rodinia'
        : this.solEpochId === '5ma' ? 'earth-pliocene' : experience.defaultMoment;
      experience = { ...experience, defaultMoment };
    } else if (this.systemRec && this.systemRec.sol){
      // The legacy planet milestones are camera-led stories, not historical
      // shape models. Keep them out of deep-time epochs; at NOW, label and
      // pin their appearance explicitly so dated copy cannot inherit a ghost
      // ring or other selected ancient state.
      if (this.solEpochId !== DEFAULT_SOL_EPOCH) return;
      experience = {
        ...experience,
        moments: experience.moments.map(moment => ({
          ...moment,
          kind: moment.kind + ' · PRESENT APPEARANCE',
          visual: { ...moment.visual, epoch: DEFAULT_SOL_EPOCH },
        })),
      };
    }
    if (this._bodyStoryRate === undefined){
      this._bodyStoryRate = this.time.rate;
      this.time.setRate(0);
      this.hud.syncTimeButtons(this.time.rate);
    }
    this.hud.showStoryline(experience, moment => this._applyBodyMoment(body, moment));
  }

  _applyBodyMoment(body, moment){
    if (!body || !moment || this.mode !== 'system') return;
    const visual = moment.visual || {};
    if (visual.epoch && this.systemRec && this.systemRec.sol)
      this.setSolEpoch(visual.epoch, { syncStory: false });
    this.rig.flyTo({
      getTarget: () => body.group.position,
      dist: body.cfg.view * (visual.distance == null ? 1 : visual.distance),
      theta: visual.theta,
      phi: visual.phi,
      dur: .9,
    });
  }

  _hideBodyStory(){
    if (this._bodyStoryRate !== undefined){
      this.time.setRate(this._bodyStoryRate);
      this._bodyStoryRate = undefined;
      this.hud.syncTimeButtons(this.time.rate);
    }
    this.hud.hideStoryline();
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
    this._clearHover();
    this._hideBodyStory();
    this.focus = p;
    this.hud.flash();
    this.audio.jump();
    this.labels.clear();
    this.surfaceView = new SurfaceView(p, this.systemView.def.star);
    if (this.systemRec && this.systemRec.sol)
      this.surfaceView.setEpoch(resolveSolEpoch(this.solEpochId));
    this.mode = 'surface';
    this.hud.setMode('surface');
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
    this._clearHover();
    this._hideBodyStory();
    if (this.solEpochId !== DEFAULT_SOL_EPOCH)
      this.setSolEpoch(DEFAULT_SOL_EPOCH, { updateHash: false });
    this.hud.hideSolEpochs();
    this.focus = this.systemView.findBody('EARTH');   // you are standing on it
    this.hud.flash();
    this.audio.jump();
    this.labels.clear();
    // ground pace: drop to ~30 sim-minutes/sec on entry, restore on exit
    this._preSkyRate = this.time.rate;
    if (Math.abs(this.time.rate) > 0.3){
      this.time.setRate(0.02);
      this.hud.syncTimeButtons(this.time.rate);
    }
    this.skyView = new SkyView(this.labels);
    this.mode = 'sky';
    this.hud.setMode('sky');
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
    this.hud.setMode('system');
    this.camera.fov = 52;
    this.camera.rotation.set(0, 0, 0);
    this.camera.updateProjectionMatrix();
    const earth = this.systemView.findBody('EARTH');
    this.focusPlanet(earth);
    this.hud.setMinimapVisible(true);
    this.hud.setEventsVisible(true);
    this.hud.showSolEpochs(SOL_EPOCHS, id => this.setSolEpoch(id));
    this.hud.setSolEpoch(resolveSolEpoch(this.solEpochId), 'EARTH');
  }

  exitSurface(){
    if (this.mode !== 'surface') return;
    const p = this.focus || this.systemView.planets[0];
    this.hud.flash();
    this.audio.back();
    this.surfaceView.dispose();
    this.surfaceView = null;
    this.labels.clear();
    this.systemView.registerLabels();
    this.mode = 'system';
    this.hud.setMode('system');
    this.rig.minDist = p.r * 2.2;
    this.rig.maxDist = this.systemView.maxDist();
    this.rig.snap({ getTarget: () => p.group.position, dist: p.cfg.view * 2.2 });
    this.rig.flyTo({ dist: p.cfg.view, dur: 1.2 });
    this.hud.setMinimapVisible(true);
    this.hud.setEventsVisible(true);
    if (this.systemRec && this.systemRec.sol){
      this.hud.showSolEpochs(SOL_EPOCHS, id => this.setSolEpoch(id));
      this.hud.setSolEpoch(resolveSolEpoch(this.solEpochId), p.name);
    }
    this._showBodyStory(p);
    this._crumbs();
  }
  focusStar(){
    this._hideBodyStory();
    const s = this.systemView.star;
    this.focus = s;
    this.audio.select();
    const detailScale = s.cfg.blackhole ? 8 : 2;
    const viewScale = s.cfg.blackhole ? 13 : 4.5;
    this.rig.minDist = s.cfg.coreRadius * detailScale;
    this.rig.flyTo({ getTarget: () => ORIGIN, dist: s.cfg.coreRadius * viewScale, dur: 1.25 });
    const archive = s.cfg.name === 'SAGITTARIUS A*'
      ? LANDMARKS.find(entry => entry.id === 'sagittarius-a-star')
      : null;
    const action = archive ? {
      label: '▸ OPEN DISCOVERY ARCHIVE',
      cb: () => this.enterLandmark(archive),
    } : null;
    this.hud.showPanel('STELLAR LOCK', s.cfg.name, s.cfg.cls, s.cfg.info, action);
    if (this.systemRec && this.systemRec.sol)
      this.hud.setSolEpoch(resolveSolEpoch(this.solEpochId));
    this._crumbs();
  }
  systemOverview(){
    this._hideBodyStory();
    this.focus = null;
    this.audio.back();
    this.rig.minDist = 6;
    this.rig.flyTo({ getTarget: () => ORIGIN, dist: this.systemView.overviewDist(), dur: 1.25 });
    this.hud.hidePanel();
    if (this.systemRec && this.systemRec.sol)
      this.hud.setSolEpoch(resolveSolEpoch(this.solEpochId));
    this._crumbs();
  }

  _crumbs(){
    const crumbs = [{ label: 'GALAXY', action: () => this.exitToGalaxy() }];
    if (this.mode === 'landmark'){
      crumbs.push({ label: 'LANDMARKS', action: () => { this.exitLandmark(); } });
      if (this.landmarkView) crumbs.push({ label: this.landmarkView.entry.name });
    } else if (this.mode === 'system' || this.mode === 'surface' || this.mode === 'sky'){
      crumbs.push({ label: this.systemRec.name, action: () => this.systemOverview() });
      if (this.focus && !this.focus.isStar)
        crumbs.push({ label: this.focus.name,
                      action: this.mode === 'surface' ? () => this.exitSurface()
                            : this.mode === 'sky' ? () => this.exitSky() : null });
      else if (this.focus && this.focus.isStar) crumbs.push({
        label: this.focus.cfg.blackhole ? 'EVENT HORIZON' : 'PHOTOSPHERE',
      });
      if (this.mode === 'surface') crumbs.push({ label: 'LOW ORBIT' });
      if (this.mode === 'sky') crumbs.push({ label: 'NIGHT SKY' });
    }
    this.hud.setCrumbs(crumbs);
    this._setHash();   // every navigation change is a shareable URL
    if (this._experienceReady) this._showContextHint();
  }

  /* ================= picking ================= */

  _raycast(x, y){
    if (this.mode === 'surface' || this.mode === 'landmark') return null;
    this.ndc.set((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets = this.mode === 'system'
      ? this.systemView.pickTargets : this.galaxyView.pickTargets;
    const hits = this.raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0].object.userData.body : null;
  }

  _onClick(x, y){
    if (this.mode === 'surface' || this.mode === 'sky' || this.mode === 'landmark') return;
    const hit = this._raycast(x, y);
    if (this.mode === 'system'){
      // armed transfer: the next planet clicked becomes the destination
      if (this.transferOrigin && hit && hit.isPlanet && hit !== this.transferOrigin)
        return this._launchMission(this.transferOrigin, hit);
      if (this.transferOrigin && !hit){
        this.transferOrigin = null;
        if (!this.mission) this.hud.setMissionVisible(false);
      }
      if (!hit) return this.systemOverview();
      if (hit.isStar) return this.focusStar();
      if (hit.isSystemFeature) return this.focusSystemFeature(hit);
      return this.focusPlanet(hit);
    }
    // galaxy mode
    if (hit && hit.isLandmark) return this.enterLandmark(hit.landmark);
    if (!hit){
      this.galaxyFocus = null;
      this.galaxyView.setFocus(null);
      this.hud.hidePanel();
      this.rig.flyTo({ getTarget: () => ORIGIN, dist: 780, phi: 0.9, dur: 1.4 });
      return;
    }
    if (this.galaxyFocus === hit){                 // second click: engage jump
      return this.enterSystem(hit.rec);
    }
    this.galaxyFocus = hit;
    this.galaxyView.setFocus(hit);
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

  /* project the hovered planet and wrap it in corner brackets */
  _updateReticle(){
    const r = document.getElementById('reticle');
    const h = this.hovered;
    if (!h || h.isStar || h.isCatalogStar || !h.group){ r.classList.remove('show'); return; }
    const c = h.group.position;
    const dist = this.camera.position.distanceTo(c);
    const ang = Math.atan2(h.r * 1.15, dist);
    const halfFov = (this.camera.fov * Math.PI / 180) / 2;
    const px = (ang / halfFov) * (this.H / 2);
    this._tmp.copy(c).project(this.camera);
    if (this._tmp.z > 1){ r.classList.remove('show'); return; }
    const box = Math.max(26, px * 2 + 14);
    r.style.left = ((this._tmp.x * 0.5 + 0.5) * this.W) + 'px';
    r.style.top = ((-this._tmp.y * 0.5 + 0.5) * this.H) + 'px';
    r.style.width = box + 'px'; r.style.height = box + 'px';
    if (!r.classList.contains('show')) r.classList.add('show');
  }

  _onHover(x, y){
    if (this.mode === 'sky' || this.mode === 'surface' || this.mode === 'landmark') return;
    const hit = this._raycast(x, y);
    const el = this.renderer.domElement;
    if (this.hovered && this.hovered !== hit){
      if (this.hovered.setHover) this.hovered.setHover(false);
      if (this.hovered.labelEntry) this.hovered.labelEntry.hovered = false;
    }
    const isNew = hit && hit !== this.hovered;
    this.hovered = hit;
    if (hit){
      if (isNew) this.audio.hover();
      if (hit.setHover) hit.setHover(true);
      if (hit.labelEntry) hit.labelEntry.hovered = true;
      this.hud.hover(x, y, hit.name);
      el.style.cursor = 'pointer';
    } else {
      this.hud.hover(0, 0, null);
      el.style.cursor = 'default';
    }
  }

  _clearHover(){
    if (this.hovered){
      if (this.hovered.setHover) this.hovered.setHover(false);
      if (this.hovered.labelEntry) this.hovered.labelEntry.hovered = false;
    }
    this.hovered = null;
    this.hud.hover(0, 0, null);
    this.renderer.domElement.style.cursor = 'default';
    document.getElementById('reticle').classList.remove('show');
  }

  _onKey(e){
    if (this.hud.landmarksVisible()){
      if (e.key === 'Escape'){
        e.preventDefault();
        this.hud.setLandmarksVisible(false);
      }
      return;
    }
    if (e.code === 'Space'){
      e.preventDefault();
      if (document.body.classList.contains('story-mode')) return;
      this.time.setRate(this.time.rate === 0 ? 10 : 0);
      this.hud.syncTimeButtons(this.time.rate);
    }
    if (e.key === 'Escape'){
      if (this.mode === 'landmark'){
        this.exitLandmark();
      } else if (this.mode === 'sky'){
        this.exitSky();
      } else if (this.mode === 'surface'){
        this.exitSurface();
      } else if (this.mode === 'system'){
        if (this.focus) this.systemOverview();
        else this.exitToGalaxy();
      } else {
        this.galaxyFocus = null;
        this.galaxyView.setFocus(null);
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

    // adaptive quality: only sample real, foreground frames
    if (!document.hidden && dt > 0.004 && dt < 0.1) this.quality.sample(dt * 1000);

    this.time.advance(dt);
    if (this.mode === 'landmark') this._updateLandmarkIntro(dt);
    if (this.mode !== 'sky') this.rig.update(dt, this.now);

    // reticle only lives in system mode; the system branch re-shows it
    if (this.mode !== 'system') document.getElementById('reticle').classList.remove('show');

    const R = this.renderer;
    if (this.mode === 'landmark'){
      this.landmarkView.update(dt, this.camera);
      this._renderMain(this.landmarkView.scene);
    } else if (this.mode === 'sky'){
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
      this.camera.updateMatrixWorld();
      this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
      this.surfaceView.update(dt, this.time.simDays, this.camera);
      this._renderMain(this.surfaceView.scene);
    } else if (this.mode === 'system'){
      this.camera.updateMatrixWorld();
      this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
      this.systemView.update(dt, this.time.simDays, this.now, this.camera);
      this.labels.update(this.camera, this.W, this.H);
      this._updateReticle();

      // refresh the event list once time overtakes it (throttled)
      this._evTick = (this._evTick || 0) + 1;
      if (this.time.rate !== 0 && this._evTick % 90 === 0 &&
          this._events && this._events.length &&
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

      // Minimap follows its responsive DOM frame; a closed mobile drawer has
      // a zero-sized frame and therefore costs no second render.
      const mapFrame = document.getElementById('mapFrame');
      const mapRect = mapFrame.getBoundingClientRect();
      if (!mapFrame.classList.contains('hidden') && mapRect.width > 2 && mapRect.height > 2){
        const mx = Math.round(mapRect.left);
        const my = Math.round(this.H - mapRect.bottom);
        const mw = Math.round(mapRect.width);
        const mh = Math.round(mapRect.height);
        R.setScissorTest(true);
        R.setViewport(mx, my, mw, mh);
        R.setScissor(mx, my, mw, mh);
        R.clear(true, true, false);
        R.render(this.systemView.scene, this.systemView.mapCam);
        R.setScissorTest(false);
      }
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
    this.quality.onResize();   // re-applies size at the current adaptive DPR
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
