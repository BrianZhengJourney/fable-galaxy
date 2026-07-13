/* Core math + procgen tests — no dependencies, no DOM, no three.js.
   Run:  node --test test/  */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { heliocentric, julianDate } from '../js/data/ephemeris.js';
import { generateSystem } from '../js/procgen/system.js';
import { predictEvents } from '../js/core/events.js';
import { Journal } from '../js/core/journal.js';
import { ResourceScope } from '../js/procgen/featured/resourceScope.js';
import { mulberry, hashStr, weighted } from '../js/utils/rng.js';
import { STAR_CATALOG } from '../js/data/starCatalog.js';
import { SOL_BODIES } from '../js/data/solData.js';
import {
  DEFAULT_SOL_EPOCH,
  SOL_BODY_NAMES,
  SOL_EPOCHS,
  resolveSolEpoch,
} from '../js/data/solEpochs.js';
import { SUPPORTED_PLANET_EPOCH_SURFACES } from '../js/data/planetEpochRecipes.js';
import { parseAtlasHash } from '../js/core/route.js';
import {
  NEBULA_PROFILES,
  NEBULA_PROFILE_IDS,
  nebulaProfile,
} from '../js/data/nebulaProfiles.js';
import { LANDMARK_IMAGES } from '../js/data/landmarkImages.js';
import { LANDMARK_DEPTH } from '../js/data/landmarkDepth.js';

const rec = name => STAR_CATALOG.find(r => r.name === name);

test('journal migrates the legacy brand key without losing visits', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map([
    ['fable-galaxy-journal-v1', JSON.stringify({ MARS: { visits: 2 } })],
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  });

  try{
    const journal = new Journal();
    assert.equal(journal.visitCount('MARS'), 2);
    assert.deepEqual(
      JSON.parse(storage.get('47-journal-v1')),
      { MARS: { visits: 2 } },
    );
  }finally{
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('featured resource scopes dispose once and stop late callbacks', () => {
  const scope = new ResourceScope('test-featured');
  let disposed = 0, calls = 0;
  const resource = { dispose(){ disposed += 1; } };
  scope.own(resource);
  scope.own(resource);
  const guarded = scope.guard(() => { calls += 1; });

  guarded();
  scope.dispose();
  scope.dispose();
  guarded();

  assert.equal(disposed, 1);
  assert.equal(calls, 1);
  let lateCleanup = 0;
  scope.defer(() => { lateCleanup += 1; });
  assert.equal(lateCleanup, 1);
});

/* ---------------- ephemeris ---------------- */

test('Earth sits at its real heliocentric position on 2026-07-02', () => {
  const jd = julianDate(Date.UTC(2026, 6, 2), 0);
  const e = heliocentric('EARTH', jd);
  // Sun's geocentric longitude ≈ 100.3° on July 2 → Earth helio lon ≈ 280.3°
  assert.ok(Math.abs(e.lon - 280) < 1.5, 'helio lon ' + e.lon);
  // Earth aphelion (1.0167 AU) falls in the first days of July
  assert.ok(Math.abs(e.r - 1.0167) < 0.002, 'r = ' + e.r);
});

test('Mercury r stays within its eccentricity bounds over a full orbit', () => {
  const jd0 = julianDate(Date.UTC(2026, 6, 2), 0);
  for (let d = 0; d < 88; d += 4){
    const m = heliocentric('MERCURY', jd0 + d);
    const ratio = m.r / m.a;
    assert.ok(ratio > 1 - 0.2057 && ratio < 1 + 0.2057, 'r/a = ' + ratio);
  }
});

test('planet longitudes advance prograde', () => {
  const jd = julianDate(Date.UTC(2026, 6, 2), 0);
  for (const name of ['MERCURY', 'EARTH', 'NEPTUNE']){
    const a = heliocentric(name, jd), b = heliocentric(name, jd + 1);
    let d = b.lon - a.lon;
    if (d < -180) d += 360;
    assert.ok(d > 0, name + ' moved ' + d + '°/day');
  }
});

/* ---------------- procgen ---------------- */

test('procedural systems are deterministic', () => {
  const a = generateSystem(rec('VEGA'));
  const b = generateSystem(rec('VEGA'));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('confirmed systems carry their real planets', () => {
  const t = generateSystem(rec('TRAPPIST-1'));
  assert.equal(t.bodies.length, 7);
  assert.equal(t.bodies[0].period.toFixed(4), '1.5109');
  assert.ok(t.bodies.every(p => p.cls.startsWith('CONFIRMED')));
});

test('every generated body is well-formed and orbits outward in order', () => {
  for (const name of ['VEGA', 'POLLUX', 'WOLF 359', 'KEPLER-186']){
    const sys = generateSystem(rec(name));
    assert.ok(sys.bodies.length >= 1 && sys.bodies.length <= 12, name);
    let prev = 0;
    for (const p of sys.bodies){
      assert.ok(p.dist > prev, name + ': distances increase');
      assert.ok(p.period > 0 && p.r > 0 && p.tex && p.info, name + ': fields');
      prev = p.dist;
    }
  }
});

test('binary companions are appended to their systems', () => {
  const ac = generateSystem(rec('ALPHA CENTAURI'));
  const last = ac.bodies[ac.bodies.length - 1];
  assert.equal(last.name, 'ALPHA CEN B');
  assert.ok(last.dist > ac.bodies[0].dist);
});

test('Sagittarius A* generates the S-cluster on eccentric orbits', () => {
  const bh = generateSystem(rec('SAGITTARIUS A*'));
  assert.equal(bh.star.blackhole, true);
  assert.deepEqual(bh.bodies.map(b => b.name), ['S2', 'S38', 'S55']);
  assert.ok(bh.bodies.every(b => b.kepler && b.kepler.e > 0.7));
});

/* ---------------- event engine ---------------- */

test('conjunction solver finds the analytic answer for circular orbits', () => {
  // both start at lon 0: next shared longitude after t=0 is one synodic period
  const bodies = [
    { name: 'A', period: 10, lon: t => (2 * Math.PI * t / 10) % (2 * Math.PI) },
    { name: 'B', period: 20, lon: t => (2 * Math.PI * t / 20) % (2 * Math.PI) }
  ];
  const evs = predictEvents(bodies, null, 0.001);
  assert.equal(evs.length, 1);
  const synodic = 1 / (1 / 10 - 1 / 20);   // 20
  assert.ok(Math.abs(evs[0].t - synodic) < 0.01, 'found t=' + evs[0].t);
});

test('comet perihelion lands on the analytic epoch', () => {
  const comet = { phase: Math.PI, period: 100 };   // M=π at t=0 → perihelion at t=50
  const evs = predictEvents([], comet, 0);
  assert.equal(evs.length, 1);
  assert.ok(Math.abs(evs[0].t - 50) < 1e-9, 'found t=' + evs[0].t);
});

/* ---------------- rng ---------------- */

test('seeded rng reproduces and stays in [0,1)', () => {
  const a = mulberry(hashStr('x')), b = mulberry(hashStr('x'));
  for (let i = 0; i < 1000; i++){
    const va = a(), vb = b();
    assert.equal(va, vb);
    assert.ok(va >= 0 && va < 1);
  }
});

test('weighted picks respect the candidate set', () => {
  const rnd = mulberry(1);
  for (let i = 0; i < 200; i++){
    const v = weighted(rnd, [['a', 1], ['b', 2], ['c', 3]]);
    assert.ok(['a', 'b', 'c'].includes(v));
  }
});

/* ---------------- observational astronomy ---------------- */

import { gmst, lst, altAz, sunGeo, moonGeo, planetGeo, OBSERVER } from '../js/core/astro.js';

test('GMST at the J2000 epoch matches the textbook value', () => {
  assert.ok(Math.abs(gmst(2451545.0) - 280.4606) < 0.001, gmst(2451545.0));
});

test('Polaris stands at the observer latitude, due north', () => {
  const p = altAz(37.95, 89.264, 217.3, OBSERVER.lat);   // any LST
  assert.ok(Math.abs(p.alt - OBSERVER.lat) < 0.8, 'alt ' + p.alt);
  assert.ok(p.az < 2 || p.az > 358, 'az ' + p.az);
});

test('the Sun crosses RA 0 at the March 2026 equinox', () => {
  const jd = Date.UTC(2026, 2, 20, 14) / 86400000 + 2440587.5;
  const s = sunGeo(jd);
  assert.ok(s.ra > 358 || s.ra < 2, 'RA ' + s.ra);
  assert.ok(Math.abs(s.dec) < 0.5, 'dec ' + s.dec);
});

test('the Moon stays within its real distance envelope', () => {
  for (let d = 0; d < 30; d += 2){
    const m = moonGeo(2461223.5 + d);
    assert.ok(m.distKm > 350000 && m.distKm < 410000, m.distKm);
  }
});

test('geocentric Mars stays within its geocentric distance range', () => {
  for (let d = 0; d < 800; d += 40){
    const m = planetGeo('MARS', 2461223.5 + d);
    assert.ok(m.r > 0.37 && m.r < 2.7, 'r = ' + m.r + ' AU');   // real bounds
  }
});

/* ---------------- generated real-data catalogs ---------------- */

import { STARS, STAR_NAMES, REAL_STARS } from '../js/data/gen/brightStars.js';
import { CONSTELLATION_LINES } from '../js/data/gen/constellations.js';
import { LANDMARKS } from '../js/data/landmarks.js';
import {
  FEATURED_LANDMARK_IDS,
  LANDMARK_EXPERIENCES,
  BODY_EXPERIENCES,
  landmarkExperience,
} from '../js/data/fieldStories.js';

test('the generated star catalog is well-formed', () => {
  const n = STARS.mag.length;
  assert.ok(n > 5000 && n < 8000, 'count ' + n);
  assert.equal(STARS.ra.length, n);
  assert.equal(STAR_NAMES[0], 'Sirius');            // brightest first
  assert.ok(STARS.mag[0] < -1.4);
  for (const k of ['SIRIUS', 'VEGA', 'PROXIMA CENTAURI', 'TRAPPIST-1'])
    assert.ok(REAL_STARS[k] && REAL_STARS[k].dist > 0, k);
  assert.ok(Math.abs(REAL_STARS['PROXIMA CENTAURI'].dist - 1.3) < 0.05);
});

test('constellation lines cover the sky in valid coordinates', () => {
  assert.ok(CONSTELLATION_LINES.length > 80);
  for (const line of CONSTELLATION_LINES)
    for (const [ra, dec] of line){
      assert.ok(ra >= 0 && ra < 360);
      assert.ok(dec >= -90 && dec <= 90);
    }
});

test('outer planet data exposes current moon and ring facts', () => {
  const bodies = new Map(SOL_BODIES.map(body => [body.name, body]));
  assert.equal(Number(bodies.get('SATURN').info.MOONS), 274);
  for (const name of ['SATURN', 'URANUS', 'NEPTUNE']){
    const rings = bodies.get(name).rings;
    assert.ok(rings && typeof rings === 'object', name + ': missing structured ring config');
    assert.ok(rings.inner > 1 && rings.outer > rings.inner, name + ': invalid ring radii');
    assert.ok(rings.opacity > 0 && rings.opacity <= 1, name + ': invalid ring opacity');
  }
  const jupiterRings = bodies.get('JUPITER').rings;
  assert.ok(jupiterRings && jupiterRings.opacity > 0 && jupiterRings.opacity < 0.15);
});

/* ---------------- Solar System model epochs ---------------- */

test('Sol epochs are complete appearance snapshots, never orbital ephemerides', () => {
  assert.deepEqual(SOL_EPOCHS.map(epoch => epoch.id), ['1000ma', '5ma', 'present']);
  assert.equal(DEFAULT_SOL_EPOCH, 'present');
  const appearanceKeys = [
    'surface', 'nightStrength', 'cloudOpacity', 'atmosphereStrength',
    'atmosphereColor', 'ringVisible', 'ringOpacity', 'ringUncertain',
    'retainRelief', 'axialTiltDeg',
  ];
  const forbidden = new Set(['eph', 'dist', 'period', 'phase', 'simDays', 'position']);
  for (const epoch of SOL_EPOCHS){
    assert.ok(epoch.label && epoch.title && epoch.text && epoch.legend);
    assert.ok(epoch.evidence && epoch.caveat && epoch.sourceLabel);
    assert.match(epoch.source, /^https:\/\//);
    assert.ok(epoch.star.luminosityScale > 0 && epoch.star.luminosityScale <= 1);
    assert.equal(epoch.belt.visible, true);
    assert.deepEqual(Object.keys(epoch.bodies), SOL_BODY_NAMES);
    for (const body of Object.values(epoch.bodies)){
      for (const key of appearanceKeys) assert.ok(key in body, epoch.id + ': missing ' + key);
      for (const key of Object.keys(body)) assert.equal(forbidden.has(key), false, epoch.id + ': ' + key);
    }
  }
});

test('ancient Earth loses artificial lights while mature belts persist', () => {
  assert.equal(resolveSolEpoch('1000ma').bodies.EARTH.surface, 'rodinia');
  assert.equal(resolveSolEpoch('1000ma').bodies.EARTH.nightStrength, 0);
  assert.equal(resolveSolEpoch('5ma').bodies.EARTH.surface, 'pliocene');
  assert.equal(resolveSolEpoch('5ma').bodies.EARTH.nightStrength, 0);
  assert.equal(resolveSolEpoch('present').bodies.EARTH.nightStrength, 1);
  assert.equal(resolveSolEpoch('1000ma').belt.visible, true);
  assert.equal(resolveSolEpoch('5ma').belt.visible, true);
  assert.equal(resolveSolEpoch('1000ma').bodies.SATURN.ringUncertain, true);
  assert.equal(resolveSolEpoch('1000ma').bodies.JUPITER.surface, 'modeled-weather-1000ma');
  assert.equal(resolveSolEpoch('5ma').bodies.JUPITER.surface, 'modeled-weather-5ma');
  assert.equal(resolveSolEpoch('present').bodies.JUPITER.ringVisible, true);
});

test('other planets receive distinct, sourced visual states only where defensible', () => {
  const old = resolveSolEpoch('1000ma');
  const recent = resolveSolEpoch('5ma');
  const supported = new Set(SUPPORTED_PLANET_EPOCH_SURFACES);

  // Mercury is intentionally stable at globe scale.
  assert.equal(old.bodies.MERCURY.surface, 'present');
  assert.equal(recent.bodies.MERCURY.surface, 'present');

  // Venus, Mars and every giant planet get independent epoch visuals.
  for (const name of ['VENUS', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE']){
    const oldSurface = old.bodies[name].surface;
    const recentSurface = recent.bodies[name].surface;
    assert.notEqual(oldSurface, 'present', name + ': missing 1 Ga model');
    assert.notEqual(recentSurface, 'present', name + ': missing 5 Ma model');
    assert.notEqual(oldSurface, recentSurface, name + ': epochs share one texture');
    assert.ok(supported.has(name + ':' + oldSurface), name + ': unsupported 1 Ga surface');
    assert.ok(supported.has(name + ':' + recentSurface), name + ': unsupported 5 Ma surface');
  }

  assert.equal(old.bodies.MARS.retainRelief, true);
  assert.equal(recent.bodies.MARS.retainRelief, true);
  assert.equal(old.bodies.MARS.axialTiltDeg, 42);
  assert.equal(recent.bodies.MARS.axialTiltDeg, 42);
  assert.equal(old.bodies.SATURN.axialTiltDeg, 4);
  assert.equal(recent.bodies.SATURN.axialTiltDeg, null);
});

test('every ancient planet model explains its evidence and uncertainty', () => {
  for (const epoch of [resolveSolEpoch('1000ma'), resolveSolEpoch('5ma')]){
    assert.deepEqual(Object.keys(epoch.bodyEvidence), SOL_BODY_NAMES);
    for (const name of SOL_BODY_NAMES){
      const note = epoch.bodyEvidence[name];
      assert.ok(note.title && note.text && note.legend && note.evidence, epoch.id + ':' + name);
      assert.ok(note.sourceLabel, epoch.id + ':' + name + ': source label');
      assert.match(note.source, /^https:\/\//, epoch.id + ':' + name + ': source');
    }
  }
});

test('Sol epoch resolution is frozen and falls back to present', () => {
  assert.equal(resolveSolEpoch('nonsense').id, 'present');
  assert.equal(resolveSolEpoch().id, 'present');
  assert.ok(Object.isFrozen(SOL_EPOCHS));
  assert.ok(Object.isFrozen(resolveSolEpoch('1000ma').bodies.EARTH));
});

test('hash routes preserve old orbital links and parse independent model epochs', () => {
  assert.deepEqual(
    { ...parseAtlasHash('#/sol?t=170.2'), params: undefined },
    {
      type: 'system', starSlug: 'sol', bodySlug: null, view: null,
      simDays: 170.2, epoch: null, params: undefined,
    },
  );
  const ancient = parseAtlasHash('#/sol/earth/orbit?t=-12.5&epoch=1000ma');
  assert.equal(ancient.starSlug, 'sol');
  assert.equal(ancient.bodySlug, 'earth');
  assert.equal(ancient.view, 'orbit');
  assert.equal(ancient.simDays, -12.5);
  assert.equal(ancient.epoch, '1000ma');
});

/* ---------------- visual field stories ---------------- */

test('every featured landmark resolves to a curated catalog entry', () => {
  const catalogIds = new Set(LANDMARKS.map(entry => entry.id));
  assert.equal(new Set(FEATURED_LANDMARK_IDS).size, FEATURED_LANDMARK_IDS.length);
  for (const id of FEATURED_LANDMARK_IDS){
    assert.ok(catalogIds.has(id), id + ': missing catalog entry');
    assert.ok(LANDMARK_EXPERIENCES[id], id + ': missing experience');
  }
});

test('the upgraded nebula collection has complete science-led 3D profiles', () => {
  const catalogIds = new Set(LANDMARKS.map(entry => entry.id));
  const expected = [
    'orion-nebula', 'horsehead-nebula', 'ring-nebula', 'helix-nebula',
    'lagoon-nebula', 'cats-eye-nebula', 'veil-nebula', 'rosette-nebula',
    'trifid-nebula',
  ];
  assert.deepEqual([...NEBULA_PROFILE_IDS].sort(), expected.sort());
  assert.equal(new Set(NEBULA_PROFILE_IDS).size, 9);

  for (const id of NEBULA_PROFILE_IDS){
    const profile = nebulaProfile(id);
    assert.equal(profile, NEBULA_PROFILES[id]);
    assert.ok(catalogIds.has(id), id + ': missing catalog entry');
    assert.ok(LANDMARK_IMAGES[id]?.file, id + ': missing observation');
    assert.ok(LANDMARK_DEPTH[id], id + ': missing aligned depth map');
    assert.ok(profile.family && profile.camera && profile.volume, id + ': incomplete shape');
    assert.ok(Math.abs(profile.camera.startPhi-Math.PI/2) < 0.001,
      id + ': observation must start head-on');
    assert.ok(profile.palette && profile.structure, id + ': incomplete visual recipe');
    assert.ok(Array.isArray(profile.sources), id + ': sources must be an array');
    assert.match(profile.source, /^https:\/\//, id + ': invalid morphology source');
    assert.ok(profile.caveat.length > 40, id + ': missing uncertainty caveat');
  }
  assert.equal(nebulaProfile('pillars-of-creation'), null);
});

test('the SN 1054 Crab alias opens the dedicated historical state', () => {
  const entry = LANDMARKS.find(landmark => landmark.id === 'crab-nebula-sn-1054');
  const story = landmarkExperience(entry);
  assert.equal(story.defaultMoment, 'crab-1054');
  const moment = story.moments.find(candidate => candidate.id === story.defaultMoment);
  assert.equal(moment.visual.state, 'crab.supernova-flash');
});

test('curated field stories have complete, selectable milestones', () => {
  const stories = [...Object.values(LANDMARK_EXPERIENCES), ...Object.values(BODY_EXPERIENCES)];
  for (const story of stories){
    assert.ok(story.summary && story.note);
    assert.ok(story.moments.length >= 5);
    const ids = new Set(story.moments.map(moment => moment.id));
    assert.equal(ids.size, story.moments.length, story.summary + ': duplicate moment id');
    assert.ok(ids.has(story.defaultMoment), story.summary + ': invalid default moment');
    for (const moment of story.moments){
      assert.ok(moment.date && moment.kind && moment.title && moment.text, moment.id);
      assert.match(moment.source, /^https:\/\//, moment.id + ': invalid source');
      assert.ok(moment.visual && typeof moment.visual === 'object', moment.id + ': missing visual');
    }
  }
});

test('dedicated multi-state exhibits route every milestone to a unique state', () => {
  const expectedStates = {
    'm87-black-hole-image': [
      'm87-jet-observed', 'm87-core-multiscale', 'eht-array-2017',
      'eht-total-intensity-2017', 'eht-polarization-2017', 'eht-compare-2017-2018',
    ],
    'pale-blue-dot': [
      'voyager-spacecraft', 'earth-moon-1977', 'pbd-original-1990',
      'voyager-camera-shutdown', 'voyager-heliopause-2012', 'pbd-compare-1990-2020',
    ],
  };
  for (const id of ['carina-nebula', 'crab-nebula', 'm87-black-hole-image', 'pale-blue-dot']){
    const moments = LANDMARK_EXPERIENCES[id].moments;
    assert.equal(moments.length, 6, id);
    const states = moments.map(moment => moment.visual.state);
    assert.ok(states.every(Boolean), id + ': missing state');
    assert.equal(new Set(states).size, moments.length, id + ': duplicate state');
    if (expectedStates[id]) assert.deepEqual(states, expectedStates[id], id + ': unexpected state order');
  }
});

test('every Sol planet has six complete, unique timeline moments', () => {
  const keys = [
    'SOL:MERCURY', 'SOL:VENUS', 'SOL:EARTH', 'SOL:MARS',
    'SOL:JUPITER', 'SOL:SATURN', 'SOL:URANUS', 'SOL:NEPTUNE',
  ];
  for (const key of keys){
    const story = BODY_EXPERIENCES[key];
    assert.ok(story, key + ': missing experience');
    assert.equal(story.moments.length, 6, key + ': expected six moments');
    const ids = new Set(story.moments.map(moment => moment.id));
    assert.equal(ids.size, 6, key + ': duplicate moment id');
    assert.ok(ids.has(story.defaultMoment), key + ': invalid default moment');
    for (const moment of story.moments){
      assert.ok(moment.id && moment.date && moment.kind, key + ': incomplete identity');
      assert.ok(moment.title && moment.text, moment.id + ': incomplete copy');
      assert.match(moment.source, /^https:\/\//, moment.id + ': invalid source');
      assert.ok(moment.visual && typeof moment.visual === 'object', moment.id + ': missing visual');
    }
  }
});
