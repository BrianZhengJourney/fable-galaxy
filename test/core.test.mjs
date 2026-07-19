/* Core math + procgen tests — no dependencies, no DOM, no three.js.
   Run:  node --test test/  */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { heliocentric, julianDate } from '../js/data/ephemeris.js';
import { generateSystem } from '../js/procgen/system.js';
import { predictEvents } from '../js/core/events.js';
import { Journal } from '../js/core/journal.js';
import { ResourceScope } from '../js/procgen/featured/resourceScope.js';
import { mulberry, hashStr, weighted } from '../js/utils/rng.js';
import { STAR_CATALOG } from '../js/data/starCatalog.js';
import { TOURS } from '../js/data/tours.js';
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
  FEATURED_NEBULA_PROFILE_IDS,
  NEBULA_PROFILES,
  NEBULA_PROFILE_IDS,
  nebulaProfile,
} from '../js/data/nebulaProfiles.js';
import { LANDMARK_IMAGES } from '../js/data/landmarkImages.js';
import { LANDMARK_DEPTH } from '../js/data/landmarkDepth.js';
import {
  EXPLORE_LANDMARK_IDS,
  EXPLORE_SECTIONS,
  EXPLORE_SYSTEM_TARGETS,
} from '../js/data/exploreSections.js';
import {
  SUPERNOVA_EXPERIENCE_IDS,
  supernovaExperience,
} from '../js/data/supernovaExperiences.js';
import {
  HIGH_FIDELITY_PRESENTATION_IDS,
  OBSERVATION_MODEL_PRESENTATION_CONFIGS,
  observationModelPresentationConfig,
  withObservationModelPresentation,
} from '../js/data/observationModelPresentations.js';
import {
  keplerPositionAtEccentricAnomaly,
  S_STAR_ORBITS,
  solveKeplerEccentricAnomaly,
  sStarPositionAtDays,
} from '../js/data/sStars.js';

const rec = name => STAR_CATALOG.find(r => r.name === name);

test('Tours retains only the Solar System Grand Tour', () => {
  assert.deepEqual(TOURS.map(tour => tour.name), ['THE GRAND TOUR']);
  assert.ok(TOURS[0].steps.length > 1);
});

test('journal migrates the legacy brand key without losing visits', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map([
    ['47-journal-v1', JSON.stringify({ MARS: { visits: 2 } })],
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
      JSON.parse(storage.get('galaxy-42-journal-v1')),
      { MARS: { visits: 2 } },
    );
  }finally{
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('journal exposes systems and field stories as recent, navigable records', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  });

  try{
    const journal = new Journal();
    journal.markVisited('SOL', '2026-07-19 12:00', { kind: 'system', target: 'SOL' });
    journal.markVisited('PILLARS OF CREATION', '2026-07-20 12:00', {
      key: 'LANDMARK::pillars-of-creation',
      kind: 'landmark',
      target: 'pillars-of-creation',
    });
    journal.markVisited('SOL', '2026-07-21 12:00', { kind: 'system', target: 'SOL' });

    assert.equal(journal.visitCount('SOL'), 2);
    assert.equal(journal.entries()[0].name, 'SOL');
    assert.deepEqual(journal.entries().map(entry => entry.kind), ['system', 'landmark']);
    assert.equal(journal.entries()[1].target, 'pillars-of-creation');
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
  assert.deepEqual(
    bh.bodies.map(body => body.kepler),
    S_STAR_ORBITS.map(star => ({
      a: star.a,
      e: star.e,
      period: star.period,
      incl: star.incl,
      node: star.node,
      phase: star.phase,
    })),
  );
  bh.bodies.forEach((body, index) => assert.deepEqual(body.info, S_STAR_ORBITS[index].info));
});

test('shared S-star helper solves Kepler motion and closes every orbit', () => {
  for (const star of S_STAR_ORBITS){
    for (const days of [0, 117.25, star.period * 0.63]){
      const M = (star.phase + Math.PI * 2 * days / star.period) % (Math.PI * 2);
      const E = solveKeplerEccentricAnomaly(M, star.e);
      assert.ok(Math.abs(E - star.e * Math.sin(E) - M) < 1e-12, star.id);

      const solved = sStarPositionAtDays(star, days);
      const direct = keplerPositionAtEccentricAnomaly(star, E);
      assert.ok(Math.abs(solved.x - direct.x) < 1e-12, star.id + ' x');
      assert.ok(Math.abs(solved.y - direct.y) < 1e-12, star.id + ' y');
      assert.ok(Math.abs(solved.z - direct.z) < 1e-12, star.id + ' z');
    }

    const start = sStarPositionAtDays(star, 0);
    const closed = sStarPositionAtDays(star, star.period);
    assert.ok(Math.hypot(
      start.x - closed.x,
      start.y - closed.y,
      start.z - closed.z,
    ) < 1e-10, star.id + ' orbit closes');
  }
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

test('black-hole catalog identity and featured dispatch stay physically distinct', async () => {
  assert.deepEqual(
    LANDMARKS.filter(entry => entry.category === 'BLACK_HOLE').map(entry => entry.id),
    ['cygnus-x-1', 'm87-star', 'sagittarius-a-star', 'gw150914'],
  );
  for (const id of ['gw170817', 'psr-b1919-21'])
    assert.equal(LANDMARKS.find(entry => entry.id === id)?.category, 'MILESTONE', id);

  const registry = await readFile(
    new URL('../js/procgen/featured/registry.js', import.meta.url), 'utf8');
  const rendererFor = id => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = registry.match(new RegExp(
      `\\['${escaped}',\\s*\\{[\\s\\S]{0,180}?renderer:\\s*'([^']+)'`,
    ));
    assert.ok(match, id + ': missing featured renderer');
    return match[1];
  };
  for (const id of ['cygnus-x-1', 'm87-star', 'sagittarius-a-star'])
    assert.equal(rendererFor(id), 'black-hole-lensing-v1', id);
  assert.equal(rendererFor('gw150914'), 'black-hole-merger-v1');
  assert.equal(rendererFor('m87-black-hole-image'), 'm87-model-plus-six-state-evidence');
});

test('the shared black-hole core preserves the relativistic rendering contract', async () => {
  const [core, star] = await Promise.all([
    readFile(new URL('../js/objects/blackHoleVisual.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/objects/star.js', import.meta.url), 'utf8'),
  ]);

  for (const name of [
    'SAGITTARIUS_A_PROFILE', 'M87_PROFILE', 'CYGNUS_X1_PROFILE',
    'BINARY_VACUUM_PROFILE',
  ]) assert.match(core, new RegExp(`export const ${name}\\s*=`), name);
  for (const [id, name] of [
    ['sagittarius-a', 'SAGITTARIUS_A_PROFILE'], ['m87', 'M87_PROFILE'],
    ['cygnus-x1', 'CYGNUS_X1_PROFILE'], ['binary-vacuum', 'BINARY_VACUUM_PROFILE'],
  ]) assert.match(core, new RegExp(`['"]?${id}['"]?:\\s*${name}`), id);

  assert.match(core, /import \{ TEX_TIER \} from ['"]\.\.\/core\/quality\.js['"]/);
  assert.match(core, /const HIGH_TIER\s*=\s*TEX_TIER\s*===\s*['"]high['"]/);
  assert.match(core, /const FRAGMENT_PRECISION\s*=\s*HIGH_TIER\s*\?\s*['"]highp['"]\s*:\s*['"]mediump['"]/);
  for (const field of ['horizonWidth', 'horizonHeight', 'radialSegments', 'angularSegments']){
    const budget = core.match(new RegExp(
      `const ${field}\\s*=\\s*HIGH_TIER\\s*\\?\\s*(\\d+)\\s*:\\s*(\\d+)`,
    ));
    assert.ok(budget && Number(budget[1]) > Number(budget[2]), field + ': invalid tier budget');
  }
  assert.match(core, /function indexedAnnulus\([\s\S]*?geometry\.setIndex\(indices\)/);
  assert.match(core, /uDoppler[\s\S]*?dopplerAsymmetry:\s*true/);
  assert.match(core, /BlackHole\.AnalyticLensingMaterial/);
  assert.match(core, /float upper[\s\S]*?float lower[\s\S]*?upper-warped-disk[\s\S]*?lower-warped-disk/);
  assert.match(core, /camera\.getWorldQuaternion[\s\S]*?lensing\.quaternion\.copy/);
  assert.match(core, /BlackHole\.EventHorizonMaterial[\s\S]*?color:\s*0x000000[\s\S]*?transparent:\s*false[\s\S]*?depthWrite:\s*true/);
  assert.match(core, /trueBlack:\s*true,\s*depthWriting:\s*true/);
  assert.match(core, /MathUtils\.clamp\(finite\(dt,\s*0\),\s*0,\s*0\.1\)/);
  const dispose = core.match(/function dispose\(\)\{([\s\S]*?)\n\s*\}\n\n\s*const api/);
  assert.ok(dispose, 'shared core is missing disposal');
  assert.match(dispose[1], /if \(disposed\) return;[\s\S]*?disposed\s*=\s*true/);
  assert.doesNotMatch(core,
    /new THREE\.(?:TorusGeometry|Sprite|Points)\s*\(|canvasRadial|createRadialGradient|CanvasTexture/);

  assert.match(star, /import \{ createBlackHoleVisual \} from ['"]\.\/blackHoleVisual\.js['"]/);
  assert.match(star, /update\(simDays,\s*now,\s*camera,\s*dt\)/);
  assert.match(star, /blackHoleVisual\.update\(dt,\s*camera\)/);
  assert.doesNotMatch(star, /canvasRadial|createRadialGradient|CanvasTexture|TorusGeometry/);
});

test('dedicated black holes retain object-specific 3D contexts without blob layers', async () => {
  const source = await readFile(
    new URL('../js/procgen/featured/blackHoles.js', import.meta.url), 'utf8');
  const contexts = {
    'cygnus-x-1': 'blue-supergiant-companion-and-mass-transfer-stream',
    'm87-star': 'relativistic-core-and-bipolar-jet',
    'sagittarius-a-star': 'quiescent-core-and-s-star-orbits',
  };
  for (const [id, role] of Object.entries(contexts)){
    assert.match(source, new RegExp(`['"]${id}['"]:[\\s\\S]{0,260}?context:\\s*['"]${role}['"]`), id);
  }
  for (const builder of ['createCygnusContext', 'createM87Context', 'createSagittariusContext'])
    assert.match(source, new RegExp(`function ${builder}\\(`), builder);
  assert.match(source, /createBlackHoleVisual\([\s\S]*?core\.update\(step,\s*camera\)/);
  assert.match(source, /const FRAGMENT_PRECISION\s*=\s*TEX_TIER\s*===\s*['"]high['"]\s*\?\s*['"]highp['"]\s*:\s*['"]mediump['"]/);
  assert.equal([...source.matchAll(/precision \$\{FRAGMENT_PRECISION\} float/g)].length, 2);
  assert.match(source, /flatSourceImage\s*=\s*false/);
  assert.doesNotMatch(source,
    /new THREE\.(?:TorusGeometry|Points|Sprite|PlaneGeometry)\s*\(|CanvasTexture|createElement\(['"]canvas|gl_PointCoord|\bblob(?:s|Layer)?\b/i);
});

test('compact-object mergers run once and preserve the GW170817 neutron-star branch', async () => {
  const source = await readFile(
    new URL('../js/procgen/exhibits.js', import.meta.url), 'utf8');
  const blackHoleStart = source.indexOf('function buildBlackHoleMerger(');
  const neutronStarStart = source.indexOf('function buildNeutronStarMerger(');
  const mergerEnd = source.indexOf('export function buildGravWave(', neutronStarStart);
  assert.ok(blackHoleStart >= 0 && neutronStarStart > blackHoleStart && mergerEnd > neutronStarStart);
  const blackHoleMerger = source.slice(blackHoleStart, neutronStarStart);
  const neutronStarMerger = source.slice(neutronStarStart, mergerEnd);
  const mergers = blackHoleMerger + neutronStarMerger;

  assert.match(source, /import \{ createBlackHoleVisual \} from ['"]\.\.\/objects\/blackHoleVisual\.js['"]/);
  assert.equal([...blackHoleMerger.matchAll(/createBlackHoleVisual\s*\(/g)].length, 3);
  assert.match(blackHoleMerger, /single-pass-binary-black-hole-inspiral/);
  assert.match(blackHoleMerger, /gravitational-wave-strain-not-visible-light/);
  assert.doesNotMatch(blackHoleMerger, /ElectromagneticMergerFlash|updateElectromagneticFlash/);
  assert.match(blackHoleMerger, /elapsed\s*=\s*Math\.min\(elapsed\s*\+\s*step/);
  assert.match(neutronStarMerger, /single-pass-binary-neutron-star-kilonova/);
  assert.match(neutronStarMerger, /preContactCompactObjects\s*=\s*['"]neutron-stars-only['"]/);
  assert.match(neutronStarMerger, /finalRemnantStatus\s*=\s*['"]uncertain-neutron-star-or-black-hole['"]/);
  assert.doesNotMatch(neutronStarMerger, /createBlackHoleVisual\s*\(/);
  assert.doesNotMatch(mergers, /\bcycle\b|(?:elapsed|progress|phase)\s*%|%\s*duration|TorusGeometry/);
  assert.match(source, /gw\\s\*170817[\s\S]{0,120}?buildNeutronStarMerger[\s\S]{0,80}?buildBlackHoleMerger/);
});

test('modeled black-hole field stories disclose scientific visualization', () => {
  for (const id of [
    'cygnus-x-1', 'm87-star', 'sagittarius-a-star', 'gw150914',
    'gw150914-first-gravitational-wave',
  ]){
    const entry = LANDMARKS.find(candidate => candidate.id === id);
    assert.ok(entry, id + ': missing catalog entry');
    const story = landmarkExperience(entry);
    assert.equal(story.moments[0].kind, 'SCIENTIFIC VISUALIZATION', id);
    assert.match(story.note, /physically informed visualization/i, id);
  }
});

test('the upgraded nebula collection keeps model semantic defaults and exact observations', async () => {
  const catalogIds = new Set(LANDMARKS.map(entry => entry.id));
  const expected = [
    'orion-nebula', 'horsehead-nebula', 'ring-nebula', 'helix-nebula',
    'lagoon-nebula', 'cats-eye-nebula', 'veil-nebula', 'rosette-nebula',
    'trifid-nebula',
  ];
  assert.deepEqual([...NEBULA_PROFILE_IDS].sort(), expected.sort());
  assert.equal(new Set(NEBULA_PROFILE_IDS).size, 9);
  assert.deepEqual([...FEATURED_NEBULA_PROFILE_IDS].sort(),
    expected.filter(id => id !== 'rosette-nebula').sort());

  for (const id of NEBULA_PROFILE_IDS){
    const profile = nebulaProfile(id);
    assert.equal(profile, NEBULA_PROFILES[id]);
    assert.ok(catalogIds.has(id), id + ': missing catalog entry');
    assert.ok(LANDMARK_IMAGES[id]?.file, id + ': missing observation');
    assert.ok(LANDMARK_DEPTH[id], id + ': missing aligned depth map');
    assert.ok(profile.family && profile.camera && profile.volume, id + ': incomplete shape');
    assert.ok(Math.abs(profile.camera.startTheta) >= .4,
      id + ': model must start visibly off-axis');
    assert.ok(profile.camera.startPhi > .9 && profile.camera.startPhi < 1.55,
      id + ': model start pitch must preserve readable depth');
    assert.ok(profile.palette && profile.structure, id + ': incomplete visual recipe');
    assert.ok(Array.isArray(profile.sources), id + ': sources must be an array');
    assert.match(profile.source, /^https:\/\//, id + ': invalid morphology source');
    assert.match(profile.observationSource, /^https:\/\//,
      id + ': invalid observation source');
    assert.ok(profile.observationDate, id + ': missing observation date');
    assert.ok(profile.caveat.length > 40, id + ': missing uncertainty caveat');
  }

  for (const id of FEATURED_NEBULA_PROFILE_IDS){
    const profile = nebulaProfile(id);
    const experience = landmarkExperience(LANDMARKS.find(entry => entry.id === id));
    const model = experience.moments.find(moment =>
      moment.id === experience.defaultMoment);
    assert.equal(model.kind, 'SCIENTIFIC 3D MODEL', id + ': default must be model-first');
    assert.equal(model.visual.state, 'model', id + ': default must explicitly suppress observations');
    assert.equal(model.visual.theta, profile.camera.startTheta, id + ': model theta');
    assert.equal(model.visual.phi, profile.camera.startPhi, id + ': model phi');
    const observation = experience.moments.find(moment =>
      moment.id === id + '-observation');
    assert.ok(observation, id + ': missing exact source observation');
    assert.equal(observation.date, profile.observationDate,
      id + ': observation must use its actual image date');
    assert.equal(observation.source, profile.observationSource,
      id + ': observation must link its exact image source');
    assert.equal(observation.visual.state, 'observation', id + ': observation state');
    assert.equal(observation.visual.observation, true, id + ': observation flag');
    assert.equal(observation.visual.theta, 0, id + ': observation theta');
    assert.ok(Math.abs(observation.visual.phi-Math.PI/2) < 0.001,
      id + ': source observation must preserve the exact head-on plate');
  }

  const rosette=landmarkExperience(
    LANDMARKS.find(entry=>entry.id === 'rosette-nebula'));
  assert.equal(rosette.moments[0].kind,'OBSERVATION',
    'archived Rosette must not claim a high-fidelity model');
  assert.equal(FEATURED_NEBULA_PROFILE_IDS.includes('rosette-nebula'),false,
    'Rosette must remain absent from FEATURED_EXHIBIT_IDS');
  const registry=await readFile(
    new URL('../js/procgen/featured/registry.js',import.meta.url),'utf8');
  assert.match(registry,/FEATURED_NEBULA_PROFILE_IDS\.map\(id => \[id,/,
    'featured registry must consume the curated subset rather than all archive profiles');
  assert.equal(nebulaProfile('pillars-of-creation'), null);
});

test('all curated nebulae and remnants share one observation-to-model presentation contract', () => {
  const deepSkyExploreIds = EXPLORE_SECTIONS
    .filter(section => section.id === 'nebulae' || section.id === 'remnants')
    .flatMap(section => section.items.map(item => item.id));
  assert.deepEqual([...HIGH_FIDELITY_PRESENTATION_IDS], deepSkyExploreIds,
    'the opt-in presentation list must exactly match Explore nebulae and remnants');
  assert.equal(HIGH_FIDELITY_PRESENTATION_IDS.length, 13);
  assert.equal(new Set(HIGH_FIDELITY_PRESENTATION_IDS).size, 13);
  assert.deepEqual(Object.keys(OBSERVATION_MODEL_PRESENTATION_CONFIGS).sort(),
    [...HIGH_FIDELITY_PRESENTATION_IDS, 'crab-nebula', 'pale-blue-dot'].sort(),
    'the direct Crab alias and mission presentation are the only non-list additions');

  const catalog = new Map(LANDMARKS.map(entry => [entry.id, entry]));
  for (const id of HIGH_FIDELITY_PRESENTATION_IDS){
    const config = observationModelPresentationConfig(id);
    assert.ok(config, id + ': missing presentation config');
    assert.equal(config, OBSERVATION_MODEL_PRESENTATION_CONFIGS[id],
      id + ': config lookup must expose the registered record');

    const experience = landmarkExperience(catalog.get(id));
    assert.deepEqual(experience.viewModes, [
      { id: 'split', label: 'SPLIT', momentId: config.splitMomentId },
      { id: 'observation', label: 'OBSERVATION', momentId: config.observationMomentId },
      { id: 'model', label: '3D MODEL', momentId: config.modelMomentId },
    ], id + ': view controls must use the shared split/observation/model order');

    const modeMomentIds = experience.viewModes.map(mode => mode.momentId);
    assert.equal(new Set(modeMomentIds).size, 3, id + ': view moments must be distinct');
    const [split, observation, model] = modeMomentIds.map(momentId =>
      experience.moments.find(moment => moment.id === momentId));
    assert.ok(split && observation && model, id + ': every view must resolve to a moment');

    assert.equal(observation.visual.presentation, 'observation',
      id + ': observation presentation flag');
    assert.equal(model.visual.presentation, 'model', id + ': model presentation flag');
    assert.notEqual(observation.presentationOnly, true, id + ': observation belongs on the rail');
    assert.notEqual(model.presentationOnly, true, id + ': model belongs on the rail');

    assert.equal(split.presentationOnly, true, id + ': split is a control-only presentation');
    assert.equal(split.kind, 'FLAT OBSERVATION + SCIENTIFIC 3D MODEL', id);
    assert.equal(split.source, observation.source, id + ': split must cite the flat source');
    assert.match(split.text, /\bflat\b/i, id + ': split copy must identify the image as flat');
    assert.match(split.text, /does not|not a|no recovered|interpretive/i,
      id + ': split copy must not imply recovered image depth');
    assert.equal(split.visual.state, 'split', id + ': split renderer state');
    assert.equal(split.visual.observation, true, id + ': split retains the source observation');
    assert.equal(split.visual.presentation, 'split', id + ': split presentation flag');
    assert.deepEqual(split.visual.delegate, model.visual,
      id + ': split must delegate the unchanged 3D model visual');
    for (const key of ['theta', 'phi', 'distance'])
      assert.equal(split.visual[key], model.visual[key], id + ': split model camera ' + key);

    const sequence = experience.entrySequence;
    assert.ok(sequence, id + ': missing entry sequence');
    assert.equal(sequence.observationMomentId, observation.id, id + ': observation sequence target');
    assert.equal(sequence.modelMomentId, model.id, id + ': model sequence target');
    assert.equal(sequence.splitMomentId, split.id, id + ': split sequence target');
    assert.equal(sequence.holdSeconds, 1.2,
      id + ': observation hold should be brief');
    assert.equal(sequence.durationSeconds, 1.2,
      id + ': model reveal should be brief');
    assert.equal(sequence.readinessTimeoutSeconds, 0.8,
      id + ': a slow source image must not delay the model for long');
    assert.ok(Number.isFinite(sequence.readinessTimeoutSeconds) &&
      sequence.readinessTimeoutSeconds >= .25 && sequence.readinessTimeoutSeconds <= 3,
    id + ': image readiness wait must be bounded');
    assert.ok(sequence.readinessTimeoutSeconds <= sequence.durationSeconds,
      id + ': readiness timeout must not exceed the reveal');
    assert.equal(experience.defaultMoment, model.id,
      id + ': story semantics must remain model-first after adding the intro');
  }

  const directCrab = landmarkExperience(catalog.get('crab-nebula'));
  assert.equal(directCrab.entrySequence.modelMomentId, 'crab-pulsar');
  assert.deepEqual(directCrab.viewModes.map(mode => mode.id),
    ['split', 'observation', 'model']);

  const paleBlueDot = landmarkExperience(catalog.get('pale-blue-dot'));
  assert.equal(paleBlueDot.defaultMoment, 'voyager-launch');
  assert.deepEqual(paleBlueDot.viewModes.map(mode => mode.id),
    ['split', 'observation', 'model']);
  assert.equal(paleBlueDot.entrySequence.observationMomentId, 'pale-reprocessed');
  assert.equal(paleBlueDot.entrySequence.modelMomentId, 'voyager-launch');
});

test('Explore exposes only curated, unique, model-led identities', async () => {
  assert.deepEqual(EXPLORE_SECTIONS.map(section => section.id), [
    'world-systems', 'nebulae', 'black-holes', 'remnants', 'missions',
  ]);
  assert.deepEqual([...EXPLORE_SYSTEM_TARGETS], [
    'SOL', 'TRAPPIST-1', 'PROXIMA CENTAURI', 'KEPLER-186',
    'PSR B1257+12', '51 PEGASI',
  ]);
  assert.equal(new Set(EXPLORE_SYSTEM_TARGETS).size, EXPLORE_SYSTEM_TARGETS.length);
  for (const target of EXPLORE_SYSTEM_TARGETS)
    assert.ok(STAR_CATALOG.some(entry => entry.name === target), target + ': missing system target');
  const systems = EXPLORE_SECTIONS.find(section => section.id === 'world-systems').items;
  assert.equal(new Set(systems.map(item => item.coverFile)).size, systems.length,
    'every system needs its own static cover');
  for (const item of systems){
    assert.match(item.coverFile, /^images\/systems\/[a-z0-9-]+\.png$/,
      item.target + ': invalid system cover path');
    const cover = await readFile(new URL('../' + item.coverFile, import.meta.url));
    assert.ok(cover.byteLength > 10000, item.target + ': missing or empty system cover');
  }
  assert.equal(EXPLORE_LANDMARK_IDS.length, 18);
  assert.equal(new Set(EXPLORE_LANDMARK_IDS).size, EXPLORE_LANDMARK_IDS.length);
  const expected = [
    'pillars-of-creation', 'orion-nebula', 'carina-nebula',
    'horsehead-nebula', 'ring-nebula', 'helix-nebula', 'lagoon-nebula',
    'cats-eye-nebula', 'trifid-nebula',
    'cygnus-x-1', 'sagittarius-a-star', 'm87-star', 'gw150914',
    'crab-nebula-sn-1054', 'sn-1987a', 'cassiopeia-a', 'veil-nebula',
    'pale-blue-dot',
  ];
  assert.deepEqual([...EXPLORE_LANDMARK_IDS], expected);
  const catalog = new Map(LANDMARKS.map(entry => [entry.id, entry]));
  for (const id of EXPLORE_LANDMARK_IDS){
    assert.ok(catalog.has(id), id + ': missing catalog entry');
    assert.ok(LANDMARK_IMAGES[id], id + ': missing Explore image');
  }
  for (const omitted of [
    'crab-nebula', 'm87-black-hole-image', 'rosette-nebula',
    'tycho-sn-1572', 'kepler-sn-1604', 'vela-remnant', 'betelgeuse',
  ]) assert.equal(EXPLORE_LANDMARK_IDS.includes(omitted), false, omitted + ': duplicate or low-fidelity');
  assert.equal(catalog.get('veil-nebula').category, 'SUPERNOVA');

  const registry = await readFile(
    new URL('../js/procgen/featured/registry.js', import.meta.url), 'utf8');
  for (const id of EXPLORE_LANDMARK_IDS){
    if (NEBULA_PROFILE_IDS.includes(id)){
      assert.ok(nebulaProfile(id), id + ': missing shared object-specific profile');
      assert.match(registry, /NEBULA_PROFILE_IDS\.map\(id => \[id,/);
    } else {
      assert.match(registry, new RegExp(`\\['${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}',`),
        id + ': Explore entry lacks a dedicated renderer');
    }
  }
});

test('black holes stay model-first while curated deep-sky routes declare observation intros', () => {
  const catalog = new Map(LANDMARKS.map(entry => [entry.id, entry]));
  for (const id of HIGH_FIDELITY_PRESENTATION_IDS){
    const experience = landmarkExperience(catalog.get(id));
    assert.ok(experience.entrySequence, id + ': missing observation intro metadata');
    assert.equal(experience.entrySequence.modelMomentId, experience.defaultMoment, id);
    assert.notEqual(experience.entrySequence.observationMomentId, experience.defaultMoment, id);
  }

  const blackHoleIds = EXPLORE_SECTIONS
    .find(section => section.id === 'black-holes').items.map(item => item.id);
  for (const id of blackHoleIds){
    const experience = landmarkExperience(catalog.get(id));
    const initial = experience.moments.find(moment => moment.id === experience.defaultMoment);
    assert.equal(initial.kind, 'SCIENTIFIC VISUALIZATION', id + ': default must remain the model');
    assert.equal(initial.visual.state, 'model', id + ': default visual state');
    assert.equal(experience.entrySequence, undefined, id + ': black holes do not use the deep-sky intro');
    assert.equal(experience.viewModes, undefined, id + ': black holes keep their evidence chapters');
  }
});

test('deep-sky presentation runtime is frame-driven, cancellable and keeps observations flat', async () => {
  const [main, presenter, hud, markup, css] = await Promise.all([
    readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui/deepSkyPresentation.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui/hud.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../css/main.css', import.meta.url), 'utf8'),
  ]);

  assert.match(main,
    /this\._landmarkIntro\s*=\s*\{[\s\S]{0,240}?phase:\s*'await-observation'/,
    'entry must begin in an explicit image-readiness phase');
  for (const phase of ['await-observation', 'hold', 'reveal'])
    assert.match(main, new RegExp(`intro\\.phase === '${phase}'`), 'missing intro phase ' + phase);
  assert.match(main,
    /intro\.phase\s*=\s*'reveal'[\s\S]{0,220}?deepSkyPresentation\.beginReveal\(\)[\s\S]{0,420}?dur:\s*intro\.sequence\.durationSeconds/,
    'the observation turn and camera flight must share declarative timing');
  assert.match(main,
    /_cancelLandmarkIntro\([^)]*\)\{[\s\S]{0,260}?_landmarkIntroGeneration\+\+[\s\S]{0,120}?_landmarkIntro\s*=\s*null[\s\S]{0,120}?rig\.cancelFlight\(\)/,
    'route and user takeover must invalidate intro state and camera motion');
  assert.match(main,
    /if\s*\(meta\.user\)\s*this\._cancelLandmarkIntro\(\{ clearPresentation: false \}\)/,
    'manual view selection must cancel the automatic intro');
  assert.match(main,
    /if\s*\(document\.hidden\)\{[\s\S]{0,100}?_takeOverLandmarkIntro\(\)/,
    'backgrounded tabs must settle instead of replaying stale animation');
  assert.match(main,
    /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches[\s\S]{0,100}?_settleLandmarkIntro\(\{ snapToModel: true \}\)/,
    'reduced-motion users must skip the animated switch and retain the model-safe fallback');
  assert.match(main,
    /settleToSplit && this\.deepSkyPresentation\.ready[\s\S]{0,900}?const settledMoment = split \|\| model;[\s\S]{0,500}?if \(split\) this\.deepSkyPresentation\.showSplit\(\)/,
    'a successful observation-to-model reveal must apply the Split moment, selection and presentation together');
  assert.match(main,
    /intro\.phase === 'reveal'[\s\S]{0,180}?_settleLandmarkIntro\(\{ settleToSplit: true \}\)/,
    'only the completed animated model switch should request Split as the default');

  const overlayStart = markup.indexOf('<section id="deepSkyPresentation"');
  const overlayEnd = markup.indexOf('</section>', overlayStart);
  assert.ok(overlayStart >= 0 && overlayEnd > overlayStart, 'missing presentation overlay markup');
  const overlayMarkup = markup.slice(overlayStart, overlayEnd);
  const overlayImageIds = [...overlayMarkup.matchAll(/<img\b[^>]*\bid="([^"]+)"[^>]*>/g)]
    .map(match => match[1]);
  assert.deepEqual(overlayImageIds, ['dspObservationImage', 'dspSplitImage'],
    'observation and split modes must use plain image elements');
  assert.doesNotMatch(overlayMarkup, /<canvas\b|<video\b/i,
    'the observation overlay must remain a flat image, not generated media');
  assert.match(presenter,
    /this\.observationImage\.src\s*=\s*record\.file;[\s\S]{0,80}?this\.splitImage\.src\s*=\s*record\.file;/,
    'full and split views must receive the exact same source asset');
  assert.doesNotMatch(presenter, /\bsetTimeout\s*\(/,
    'presentation timing must come from the app frame loop');
  assert.match(css,
    /\.dsp-observation-face img,[\s\S]{0,220}?object-fit:contain;[\s\S]{0,100}?filter:none;\s*transform:none;/,
    'source pixels must remain uncropped and unfiltered');
  assert.match(markup, /id="dspObjectName" class="dsp-object-name"/,
    'the cinematic intro must retain a dedicated object title');
  assert.match(presenter,
    /this\.objectName\.textContent\s*=\s*name;/,
    'the persistent title must use the selected Explore object name');
  assert.match(css,
    /data-mode="observation"\] \.dsp-object-name,[\s\S]{0,100}?data-mode="revealing"\] \.dsp-object-name[\s\S]{0,100}?opacity:1;/,
    'the selected object name must remain visible through observation and reveal');

  assert.match(hud,
    /const viewModes\s*=\s*Array\.isArray\(experience\.viewModes\)/,
    'HUD view controls must be driven by experience metadata');
  assert.match(hud,
    /experience\.moments\.filter\(moment\s*=>\s*!moment\.presentationOnly\)/,
    'control-only split moments must stay off the semantic story rail');
  assert.match(hud,
    /selectStoryMoment\(mode\.momentId,\s*true,\s*\{ user: true \}\)/,
    'view buttons must signal manual takeover');
  assert.match(hud,
    /selectStoryMoment\(initial,\s*true,\s*initialMomentId\s*\?\s*\{ intro: true \}\s*:\s*\{\}\)/,
    'the observation entry moment must carry intro metadata');
  assert.match(hud, /this\._storySelect\(moment, meta\)/,
    'selection metadata must reach the app state machine');
});

test('landmark HUD removes repeated copy without hiding detail or provenance', async () => {
  const [markup, css, hud] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../css/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui/hud.js', import.meta.url), 'utf8'),
  ]);

  assert.match(css,
    /body\[data-mode="landmark"\] #crumbs,[\s\S]{0,140}?#mapBtn,[\s\S]{0,100}?#tourBtn\{ display:none; \}/,
    'landmark close-ups should not repeat map and breadcrumb navigation');
  assert.match(css, /#lmCardCat, #lmCardWow\{ display:none; \}/,
    'object category and summary should not duplicate the active story');
  assert.match(css, /\.dsp-caption span:first-child\{ display:none; \}/,
    'the observation plate should show its credit without repeating its mode label');
  assert.match(css,
    /body\.deep-sky-presentation:not\(\.deep-sky-split\) #storyCopy,[\s\S]{0,120}?#storyTrack\{ display:none; \}/,
    'cinematic observation mode should leave only the explicit view switch visible');
  assert.match(css,
    /\.story-node\.active span,[\s\S]{0,100}?\.story-node:focus-visible span\{ opacity:1; \}/,
    'only the active or intentionally inspected milestone label should appear');

  assert.match(markup, /id="lmMore"[^>]+aria-label="Show object details"/,
    'the compact info control must retain an accessible label');
  assert.match(hud,
    /more\.setAttribute\('aria-label', expanded \? 'Hide object details' : 'Show object details'\)/,
    'expanded detail state must stay explicit to assistive technology');
  assert.match(markup, /id="storyText"/,
    'scientific context must remain present in the settled model view');
  assert.match(markup, /id="storySource"[^>]+aria-label="Open source"/,
    'source provenance must remain keyboard and screen-reader accessible');
  assert.match(hud, /source\.setAttribute\('aria-label', 'Source for ' \+ moment\.title\)/,
    'source links must describe the active chapter');
});

test('Explore presents image-led cards while retaining accessible catalog detail', async () => {
  const [markup, css, hud, main] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../css/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui/hud.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
  ]);

  assert.match(markup, /id="lmIntro" class="dsp-sr-only"/,
    'Explore context should remain available without occupying the visual header');
  assert.match(markup, /id="lmCount" aria-hidden="true"/,
    'the duplicate total count should stay out of the visual and accessible title');
  assert.match(css, /body\.explore-open #hdr, body\.explore-open #hints\{ opacity:0;/,
    'the underlying page chrome should leave while the catalog dialog is active');
  assert.match(css, /\.lm-kicker, #lmCount\{ display:none; \}/,
    'the Explore title should not be surrounded by redundant header copy');
  assert.match(css, /\.lm-section-index, \.lm-section-count\{ display:none; \}/,
    'category headings should not repeat ordinal and count labels');
  assert.match(css, /\.lm-badges\{ display:none; \}/,
    'image cards should not carry persistent mode badges');
  assert.match(css, /\.lm-item \.s\{ display:none; \}/,
    'image cards should show one object name instead of a second designation line');

  assert.match(hud, /intro\.className = 'dsp-sr-only'/,
    'section descriptions must remain available to assistive technology');
  assert.match(hud,
    /const accessibleDetails = \[e\.designation, \.\.\.record\.badges\][\s\S]{0,220}?item\.setAttribute\('aria-label', 'Explore ' \+ e\.name/,
    'hidden card metadata must be folded into the accessible card name');
  assert.match(hud, /document\.body\.classList\.toggle\('explore-open', visible\)/,
    'dialog visibility must own the page-chrome suppression state');
  assert.match(hud,
    /record\.kind === 'landmark'[\s\S]{0,120}?record\.coverFile \? \{ file: record\.coverFile \}/,
    'World Systems cards should use their own static cover images');
  assert.doesNotMatch(css, /lm-system-spin|lm-system-orbit/,
    'World Systems covers should remain static');
  assert.match(hud, /item\.dataset\.system = record\.target/,
    'system cards need a stable destination identity');
  assert.match(main,
    /record\.kind === 'system'[\s\S]{0,140}?setLandmarksVisible\(false\)[\s\S]{0,100}?enterSystem\(record\.entry\.rec, true\)/,
    'choosing a system must close Explore before entering the live system');
});

test('experience shell keeps onboarding, mobile instruments, sharing and the log discoverable', async () => {
  const [markup, css, hud, main] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../css/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui/hud.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
  ]);

  assert.match(markup, /id="welcome"[^>]+role="dialog"[^>]+aria-modal="true"/,
    'the first-run journey chooser must be a modal dialog');
  assert.match(markup, /data-journey="sol"[\s\S]+data-journey="observation"[\s\S]+data-journey="black-hole"/,
    'the entry experience must expose three distinct journeys');
  assert.match(markup, /id="instrumentDrawer"[^>]+role="dialog"/,
    'mobile instruments need one explicit drawer surface');
  assert.match(css, /#events\.show, #photometer\.show, #mapFrame:not\(\.hidden\)\{ display:none; \}/,
    'system instruments must stay closed by default on phones');
  assert.match(hud, /renderJournal\(entries, total, onPick\)/,
    'the persistent journal must have a visible renderer');
  assert.match(main, /navigator\.share[\s\S]+navigator\.clipboard\.writeText/,
    'sharing must retain a clipboard fallback');
});

test('black-hole observation chapters preserve a persistent 3D hero', async () => {
  for (const id of ['cygnus-x-1', 'm87-star', 'sagittarius-a-star', 'gw150914']){
    const experience = landmarkExperience(LANDMARKS.find(entry => entry.id === id));
    assert.equal(experience.moments.length, 5, id + ': expected five sourced chapters');
    const initial = experience.moments.find(moment => moment.id === experience.defaultMoment);
    assert.equal(initial.kind, 'SCIENTIFIC VISUALIZATION', id + ': default must be the model');
    assert.ok(experience.moments.some(moment => moment.visual.state === 'observation'),
      id + ': missing authentic observation chapter');
    assert.ok(experience.moments.every(moment => /^https:\/\//.test(moment.source)),
      id + ': every chapter needs a source');
  }

  const [dock, blackHoles] = await Promise.all([
    readFile(new URL('../js/procgen/featured/observationDock.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/blackHoles.js', import.meta.url), 'utf8'),
  ]);
  assert.match(dock, /sourceIsFlatObservation\s*=\s*true/);
  assert.match(dock, /modelReplacement\s*=\s*false/);
  assert.match(dock, /camera\.getWorldQuaternion/);
  assert.match(blackHoles, /persistentThreeDimensionalModel\s*=\s*true/);
  assert.match(blackHoles, /modelRoot\.visible\s*=\s*true/);
  assert.match(blackHoles,
    /const observation = isObservationMoment\(visual\);[\s\S]{0,160}?observationDock\.setVisible\(observation\)/);
});

test('black-hole milestones open model-led and retain their evidence sequences', async () => {
  const gwAlias = LANDMARKS.find(entry => entry.id === 'gw150914-first-gravitational-wave');
  const gwStory = landmarkExperience(gwAlias);
  assert.equal(gwStory.defaultMoment, 'gw150914-model');
  assert.ok(gwStory.moments.some(moment => moment.id === 'gw150914-detection'));
  const m87Story = LANDMARK_EXPERIENCES['m87-black-hole-image'];
  assert.equal(m87Story.defaultMoment, 'm87-model');
  assert.equal(m87Story.moments.length, 7);
  assert.equal(m87Story.moments[0].visual.state, 'model');

  const [registry, m87, main] = await Promise.all([
    readFile(new URL('../js/procgen/featured/registry.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/m87.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
  ]);
  assert.match(registry, /function buildM87MilestoneExperience\(/);
  assert.match(registry,
    /buildM87StarFeatured\([\s\S]{0,300}?PersistentRelativisticModel/);
  assert.match(registry, /modelAlwaysVisible:\s*true/);
  assert.match(registry, /SixStateEvidenceSidecar/);
  assert.match(registry, /evidenceRoot\.userData\.mixedPresentationSidecar\s*=\s*true/);
  assert.doesNotMatch(registry, /evidenceRoot\.userData\.observationSidecar\s*=\s*true/);
  assert.match(registry, /persistent-hero-with-top-evidence-gutter/);
  assert.match(registry, /evidenceVisible\s*=\s*visual\.state\s*!==\s*'model'/);
  assert.match(registry, /evidenceRoot\.visible\s*=\s*evidenceVisible/);
  assert.match(registry, /evidence\.setMoment\(visual\)/);
  assert.match(registry,
    /group\.userData\.activeState === M87_STATES\.ARRAY[\s\S]{0,180}?label: 'MODEL \/ EXPLANATORY VIEW'/);
  assert.match(registry, /Earth albedo: Solar System Scope · CC BY 4\.0/);
  assert.match(registry,
    /observationVisible = evidenceVisible && !explanatoryViewVisible/);
  assert.match(registry,
    /explanatoryViewVisible[\s\S]{0,300}?'model-plus-explanatory-view'/);
  assert.match(registry,
    /group\.userData\.observationVisible[\s\S]{0,220}?label: 'OBSERVATION \+ MODEL'/);
  assert.match(m87, /imageCredit:\s*EVIDENCE_CREDIT/);
  assert.match(main,
    /entry\.id === 'm87-star'[\s\S]{0,260}?candidate\.id === 'm87-black-hole-image'[\s\S]{0,180}?this\.enterLandmark\(archive\)/,
    'the primary M87* model needs a normal UI path to its six-state archive');
  for (const state of [
    'm87-jet-observed', 'm87-core-multiscale', 'eht-array-2017',
    'eht-total-intensity-2017', 'eht-polarization-2017',
    'eht-compare-2017-2018',
  ]) assert.match(m87, new RegExp(`['"]${state}['"]`), state);
});

test('reprocessed observations and image-less archives expose truthful story states', () => {
  const paleBlueDot = LANDMARK_EXPERIENCES['pale-blue-dot'];
  const comparison = paleBlueDot.moments.find(moment =>
    moment.visual.state === 'pbd-compare-1990-2020');
  assert.equal(comparison.visual.observation, true,
    'the real 1990/2020 image comparison must receive observation attribution');

  for (const id of ['kepler-sn-1604', 'vela-remnant', 'betelgeuse']){
    const entry = LANDMARKS.find(candidate => candidate.id === id);
    const story = landmarkExperience(entry);
    const moment = story.moments.find(candidate => candidate.id === story.defaultMoment);
    assert.equal(story.defaultMoment, 'archive-record', id);
    assert.match(story.note, /No verified visual asset/, id);
    assert.equal(moment.kind, 'ARCHIVE RECORD', id);
    assert.equal(moment.visual.observation, false, id);
    assert.equal(moment.visual.state, 'archive-record', id);
    assert.match(moment.text, /No verified visual asset is displayed/, id);
    assert.equal(story.entrySequence, undefined, id + ': archive must not gain an intro');
    assert.equal(story.viewModes, undefined, id + ': archive must not claim presentation views');
  }

  const incomplete = { defaultMoment: 'archive-record', moments: [{ id: 'archive-record' }] };
  assert.equal(withObservationModelPresentation({ id: 'orion-nebula' }, incomplete), incomplete,
    'the wrapper must leave incomplete experiences unchanged');
});

test('retained modern supernovae use dedicated indexed 3D sculpts plus observations', async () => {
  assert.deepEqual([...SUPERNOVA_EXPERIENCE_IDS], ['sn-1987a', 'cassiopeia-a']);
  for (const id of SUPERNOVA_EXPERIENCE_IDS){
    const entry = LANDMARKS.find(candidate => candidate.id === id);
    const experience = supernovaExperience(entry);
    assert.equal(experience.moments.length, 6, id + ': expected six chapters');
    assert.equal(experience.moments.find(moment => moment.id === experience.defaultMoment).kind,
      'SCIENTIFIC 3D MODEL', id + ': default must be the 3D model');
    assert.ok(experience.moments.some(moment => moment.visual.state === 'observation'),
      id + ': missing real observation chapter');
    assert.ok(experience.moments.every(moment => /^https:\/\//.test(moment.source)),
      id + ': missing authoritative source');
  }

  const sn1987a = supernovaExperience(LANDMARKS.find(entry => entry.id === 'sn-1987a'));
  assert.equal(sn1987a.moments.find(moment => moment.id === 'sn1987a-hotspots').date,
    'MID-1990s → 2010s');
  const casA = supernovaExperience(LANDMARKS.find(entry => entry.id === 'cassiopeia-a'));
  const casAObservation = casA.moments.find(moment => moment.id === 'casa-observation');
  assert.equal(casAObservation.date, 'AUGUST 4 · 2022 · JWST MIRI');
  assert.equal(casAObservation.source,
    'https://science.nasa.gov/asset/webb/cassiopeia-a-miri-image/');

  const [source, registry] = await Promise.all([
    readFile(new URL('../js/procgen/featured/supernovae.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/registry.js', import.meta.url), 'utf8'),
  ]);
  for (const name of ['buildSN1987AFeatured', 'buildCassiopeiaAFeatured'])
    assert.match(source, new RegExp(`export function ${name}\\(`), name);
  assert.match(source, /makeEllipticalTubeGeometry[\s\S]*?geometry\.setIndex\(indices\)/);
  assert.match(source, /makeAsymmetricShellGeometry[\s\S]*?geometry\.setIndex\(indices\)/);
  assert.match(source, /new THREE\.InstancedMesh\(/);
  assert.equal([...source.matchAll(/scope\.own\(new THREE\.InstancedMesh\(/g)].length, 2,
    'every instanced-mesh factory must register its GPU instance buffer for disposal');
  assert.match(source, /ring-hotspots[\s\S]*?ejecta-hourglass[\s\S]*?observation/);
  assert.match(source, /ejecta-elements[\s\S]*?jets-compact-object[\s\S]*?green-monster[\s\S]*?observation/);
  assert.doesNotMatch(source,
    /new THREE\.(?:Points|Sprite|Line|LineLoop|LineSegments|PlaneGeometry|TorusGeometry|TubeGeometry)\s*\(/);
  assert.match(registry, /renderer:\s*'sn1987a-triple-ring-sculpt-v1'/);
  assert.match(registry, /renderer:\s*'cassiopeia-a-element-sculpt-v1'/);
  assert.match(registry, /buildRemnantWithObservation[\s\S]*?createObservationDock/);
});

test('landmark attribution switches between model and authentic observation', async () => {
  const [view, hud, main, collection, carina] = await Promise.all([
    readFile(new URL('../js/scenes/landmarkView.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui/hud.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaCollection.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/carina.js', import.meta.url), 'utf8'),
  ]);
  assert.match(view, /currentCredit\(\)/);
  assert.match(view,
    /creditForPresentation &&\s*this\.exhibit\.creditForPresentation\(\{ moment, visual \}\)/);
  assert.match(view, /label:\s*'OBSERVATION \+ MODEL'/);
  assert.match(view, /if \(this\.modelCredit\) return \{ label:\s*'MODEL'/);
  assert.match(view, /const explicitObservation\s*=/);
  assert.match(view, /const inferredObservation\s*=\s*!persistentModel/);
  assert.match(view, /activePresentation === 'model-plus-source-observation'/);
  assert.doesNotMatch(view, /fallbackCredit[\s\S]{0,180}?modelCredit/);
  assert.match(hud, /setLandmarkCredit\(credit\)/);
  assert.match(main,
    /this\.landmarkView\.setMoment\(moment, visual\.delegate\);\s*this\.hud\.setLandmarkCredit\(this\.landmarkView\.currentCredit\(\)\)/,
    'split presentations must delegate the model visual before resolving attribution');
  assert.match(main,
    /visual\.wavelength === 'infrared' \|\|\s*\/infrared\/i\.test\(String\(visual\.state \|\| ''\)\)/,
    'the wavelength control must resolve Crab’s state-named infrared moment');
  assert.match(main,
    /if \(matched\)\{\s*this\.landmarkView\.setMoment\(matched\);\s*this\.hud\.selectStoryMoment\(matched\.id, false\);\s*\}\s*this\.hud\.setLandmarkCredit\(this\.landmarkView\.currentCredit\(\)\)/,
    'wavelength changes must update both the active semantic moment and its credit');
  assert.match(collection, /modelCredit:\s*SHARED_NEBULA_MODEL_CREDIT/,
    'shared nebula model states need an explicit model attribution');
  assert.match(carina,
    /creditForPresentation\(\)\{\s*return CARINA_PRESENTATION_CREDITS\[activeState\] \|\| null/);
  assert.match(carina, /Hubble 2007 Carina mosaic: NASA, ESA, N\. Smith/);
  assert.match(carina, /Webb Cosmic Cliffs NIRCam \+ MIRI: NASA, ESA, CSA, STScI/);
  assert.match(carina, /Hubble UV \(March\/July 2018\): NASA, ESA, N\. Smith and J\. Morse/);
  assert.doesNotMatch(carina, /const MODEL_CREDIT\s*=|modelCredit:\s*MODEL_CREDIT/,
    'Carina must not use one bundled observation credit for every presentation');
});

test('mode transitions clear hover text before entering non-interactive scenes', async () => {
  const main = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /enterLandmark\(entry\)\{\s*this\._clearHover\(\)/);
  assert.match(main,
    /_clearHover\(\)\{[\s\S]{0,420}?this\.hovered = null;[\s\S]{0,180}?this\.hud\.hover\(0, 0, null\)/);
});

test('observation docks reserve a camera-space gutter around the 3D hero', async () => {
  const dock = await readFile(
    new URL('../js/procgen/featured/observationDock.js', import.meta.url), 'utf8');
  assert.match(dock, /heroRadius\s*=\s*22/);
  assert.match(dock, /halfHeight\s*=\s*distance\s*\*\s*Math\.tan/);
  assert.match(dock, /const topGutter\s*=\s*aspect\s*<\s*1\.05/);
  assert.match(dock, /layoutMode\s*=\s*'portrait-top-gutter'/);
  assert.match(dock, /layoutMode\s*=\s*'landscape-side-gutter'/);
  assert.match(dock, /reservedHeroRadius\s*=\s*heroRadius/);
  assert.doesNotMatch(dock, /offsetX \* horizontalScale/);
});

test('uncurated nebula and remnant routes never revive generic fuzzy 3D', async () => {
  const view = await readFile(
    new URL('../js/scenes/landmarkView.js', import.meta.url), 'utf8');
  assert.match(view, /group\.userData\.noGenericReconstruction\s*=\s*true/);
  assert.match(view,
    /const featured = buildFeaturedExhibit[\s\S]{0,500}?deepSkyArchiveOnly[\s\S]{0,500}?buildArchiveOnly\(entry\)/);
  assert.match(view, /const galaxyVolume = !!img && entry\.category === 'GALAXY'/);
  assert.doesNotMatch(view,
    /\['NEBULA',\s*'SUPERNOVA',\s*'GALAXY'\]\.includes\(entry\.category\)/);
});

test('shared nebula runtime contains no generic soft-cloud renderer', async () => {
  const [collection, matter] = await Promise.all([
    readFile(new URL('../js/procgen/featured/nebulaCollection.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaMatter.js', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(collection, /buildVeils|photo-color-veil/);
  assert.equal([...collection.matchAll(/new THREE\.Points\s*\(/g)].length, 1,
    'shared nebula Points are limited to registered stellar sources');
  assert.match(collection, /allowedPointRole = 'registered-stellar-sources'/);
  assert.doesNotMatch(matter, /new THREE\.Points\s*\(|gl_PointCoord|makePointLayer/);
  assert.doesNotMatch(matter, /photo-aligned-chromatic-gas|photo-aligned-foreground-dust/);
  assert.match(matter, /new THREE\.(?:Mesh|InstancedMesh)\s*\(/,
    'photo/depth reconstruction should use crisp surfaces');
});

test('retained shared nebula heroes keep continuous sculpts and explicit source-context exceptions', async () => {
  const [collection, sculptA, sculptB, primitives] = await Promise.all([
    readFile(new URL('../js/procgen/featured/nebulaCollection.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaSculptA.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaSculptB.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaSculptPrimitives.js', import.meta.url), 'utf8'),
  ]);
  for (const family of [
    'open-bowl', 'edge-ridge', 'planetary-ring', 'double-ring',
    'star-cavity', 'nested-shell', 'trilobe',
  ]) assert.match(collection, new RegExp(`['"]${family}['"]`), family);
  assert.match(collection, /if\s*\(!continuousHero\s*&&\s*!photoRelief\)/,
    'continuous heroes must not instantiate source-depth relief fragments');
  assert.match(collection,
    /SOURCE_CONTEXT_HERO_IDS\s*=\s*new Set\(\['horsehead-nebula', 'veil-nebula'\]\)/,
    'only the requested ridge and shock-sheet heroes may retain low-frequency source context');
  assert.match(collection, /low-frequency-source-context-only; no depth claim/);
  assert.match(collection, /projector appears only in the explicit observation state/);
  assert.match(collection, /presentationState === 'observation'/);
  assert.match(collection, /createObservationDock\(\{[\s\S]{0,180}?Horsehead\.SourceComparison/,
    'Horsehead split mode must use an independent flat source plate');
  assert.match(collection, /presentationState === 'split'/);
  assert.match(collection, /comparisonDock\.setVisible\(split\)/);
  assert.match(collection, /persistentThreeDimensionalModel=split/,
    'split attribution must disclose that the 3D model remains visible');
  assert.match(collection, /activePresentation=split[\s\S]{0,100}?'model-plus-source-observation'/);
  assert.match(sculptA, /orion-continuous-ionization-bowl/);
  assert.match(sculptA, /horsehead-barnard33-authored-silhouette/);
  assert.match(sculptA, /ring-main-thick-torus/);
  assert.match(sculptA, /helix-second-inclined-ejection-ring/);
  assert.match(sculptA, /lagoon-main-foreground-dust-river/);
  assert.match(sculptB, /cat-eye-continuous-bubble/);
  assert.match(sculptB, /trifid-occluding-dust-lane/);
  assert.match(sculptB, /veil-cooling-sheet/);
  assert.match(sculptB, /veil-braided-shock-strand/);
  assert.match(sculptB, /layered-volumetric-shock-sheet/);
  assert.match(primitives, /new THREE\.BufferGeometry\s*\(/);
  assert.match(primitives, /continuousNebulaSurface\s*=\s*true/);
  assert.match(primitives, /opacityUniform\s*=\s*uniforms\.uOpacity/);
  for (const source of [sculptA, sculptB, primitives]){
    assert.doesNotMatch(source,
      /new THREE\.(?:Points|TubeGeometry|TorusGeometry)\s*\(|gl_PointCoord/);
  }
});

test('dedicated and shared nebula sculpts contain no active wire or blob layers', async () => {
  const [sculptA, sculptB, carina, crab, main] = await Promise.all([
    readFile(new URL('../js/procgen/featured/nebulaSculptA.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaSculptB.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/carina.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/crab.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
  ]);
  for (const source of [sculptA, sculptB]){
    assert.doesNotMatch(source,
      /new THREE\.(?:Points|TubeGeometry|TorusGeometry)\s*\(|gl_PointCoord/);
  }
  assert.equal([...carina.matchAll(/new THREE\.Points\s*\(/g)].length, 1,
    'Carina may retain only its registered colored stellar sources');
  assert.match(carina, /allowedPointRole = 'registered-stellar-sources'/);
  assert.doesNotMatch(carina,
    /thin-ionization-ridges|holder\.add\(mesh,\s*surfels|new THREE\.(?:TubeGeometry|TorusGeometry)/);
  assert.match(carina, /hubble-source-derived-relief-root/);
  assert.match(carina, /continuous-source-depth-cosmic-cliffs-volume/);
  assert.match(carina, /continuousHeroSurface/);
  assert.match(carina, /backbone\.material\.opacity\s*=\s*\.92\s*\*\s*reveal/);
  assert.match(carina, /alphaMap:\s*edgeMask/,
    'Carina archive plates must feather their rectangular edges');
  assert.match(carina, /eta\.uv\.material\.opacity\s*=\s*headOn/);
  assert.match(carina, /hubble\.plate\.material\.opacity\s*=\s*headOn/);
  assert.match(carina, /webb\.plate\.material\.opacity\s*=\s*headOn/);

  assert.equal([...crab.matchAll(/new THREE\.Points\s*\(/g)].length, 0,
    'Crab uses no particle cloud for its persistent remnant or 1054 state');
  assert.doesNotMatch(crab,
    /gl_PointCoord|new THREE\.(?:Sprite|Line|LineLoop|LineSegments|RingGeometry|TorusGeometry|SphereGeometry)\s*\(/);
  assert.match(crab, /Crab\.FilamentCageIndexedSurface/);
  assert.match(crab, /Crab\.IndexedTerminationShock/);
  assert.match(crab, /Crab\.IndexedNorthwestJet/);
  assert.match(crab, /new THREE\.InstancedMesh\s*\(/);
  assert.ok([...crab.matchAll(/geometry\.setIndex\s*\(/g)].length >= 5,
    'Crab must be built from indexed shell, filament, wind and jet surfaces');
  assert.match(crab, /modelAlwaysVisible:true/);
  assert.match(crab, /genericImageVolume:false/);
  for (const asset of [
    'images/crab/hubble-1999.jpg',
    'images/crab/hubble-2024.jpg',
    'images/crab/webb-2023.jpg',
  ]) assert.match(crab, new RegExp(asset.replaceAll('/', '\\/')));
  assert.match(crab, /flatScientificSource=true/,
    'authentic Crab observations stay flat evidence instead of model texture');
  assert.match(main, /exitToGalaxy\(\)\{[\s\S]{0,1200}evictTextures\(\)/,
    'leaving a landmark must evict its cached observation textures');
});

test('instanced nebula GPU buffers have one explicit lifecycle owner', async () => {
  const [collection, primitives, sculptA, sculptB, carina] = await Promise.all([
    readFile(new URL('../js/procgen/featured/nebulaCollection.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaSculptPrimitives.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaSculptA.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/nebulaSculptB.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/carina.js', import.meta.url), 'utf8'),
  ]);
  const compact = source => source.replace(/\s+/g, ' ');
  const shared = [primitives, sculptA, sculptB];
  const constructors = shared.reduce((count, source) =>
    count + [...source.matchAll(/new THREE\.InstancedMesh\s*\(/g)].length, 0);
  const registrations = shared.reduce((count, source) =>
    count + [...compact(source).matchAll(/tracker\.instanced\(\s*new THREE\.InstancedMesh\s*\(/g)].length,
  0);
  assert.equal(constructors, 4, 'expected all four shared-nebula instanced factories');
  assert.equal(registrations, constructors,
    'every shared-nebula instance buffer must belong to its local tracker');
  assert.match(collection, /const instancedMeshes = new Set\(\)/);
  assert.match(collection,
    /if \(disposed\) return;[\s\S]*?for \(const mesh of instancedMeshes\) mesh\.dispose\(\);[\s\S]*?for \(const geometry of geometries\) geometry\.dispose\(\);/,
    'instance buffers must be released once before shared geometry/material resources');

  const compactCarina = compact(carina);
  const carinaConstructors = [...carina.matchAll(/new THREE\.InstancedMesh\s*\(/g)].length;
  const carinaRegistrations = [
    ...compactCarina.matchAll(/scope\.own\(\s*new THREE\.InstancedMesh\s*\(/g),
  ].length;
  assert.equal(carinaConstructors, 2, 'expected both Carina instanced detail systems');
  assert.equal(carinaRegistrations, carinaConstructors,
    'Carina instance buffers must use its idempotent ResourceScope');
});

test('Pillars respects automatically detected low quality', async () => {
  const source = await readFile(
    new URL('../js/procgen/pillars.js', import.meta.url), 'utf8');
  assert.match(source, /const LOW_TIER = TEX_TIER === 'low'/);
  assert.doesNotMatch(source, /EXPLICIT_LOW|detectTier\(\)\.forced/);
});

test('every shared nebula disables generic blobs and defines crisp unique structure', () => {
  const required = {
    'orion-nebula': [['reconstruction', 'depthLayers'], ['reconstruction', 'features']],
    'horsehead-nebula': [['reconstruction', 'depthLayers'], ['reconstruction', 'features']],
    'ring-nebula': [['reconstruction', 'depthLayers'], ['reconstruction', 'features']],
    'helix-nebula': [['reconstruction', 'depthLayers'], ['reconstruction', 'features']],
    'lagoon-nebula': [['reconstruction', 'depthLayers'], ['reconstruction', 'features']],
    'cats-eye-nebula': [['structure', 'innerBubbles'], ['structure', 'pointSymmetricArcs']],
    'veil-nebula': [['structure', 'filamentBundles'], ['structure', 'speciesLayers']],
    'rosette-nebula': [['structure', 'rimSectors'], ['structure', 'pillarAnchors']],
    'trifid-nebula': [['structure', 'emissionLobes'], ['structure', 'dustLanes']],
  };
  for (const [id, paths] of Object.entries(required)){
    const profile = nebulaProfile(id);
    const recipe = profile.reconstruction;
    assert.ok(recipe, id + ': missing reconstruction contract');
    const blobsDisabled = recipe.genericSoftClouds === false ||
      recipe.genericCloudOpacity === 0;
    assert.ok(blobsDisabled, id + ': generic soft clouds must stay disabled');
    for (const [parent, key] of paths){
      const value = profile[parent]?.[key];
      assert.ok(Array.isArray(value) && value.length >= 2,
        `${id}: ${parent}.${key} needs object-specific geometry`);
    }
  }
});

test('the SN 1054 Crab alias opens on the current high-fidelity remnant model', () => {
  const entry = LANDMARKS.find(landmark => landmark.id === 'crab-nebula-sn-1054');
  const story = landmarkExperience(entry);
  assert.equal(story.defaultMoment, 'crab-pulsar');
  const moment = story.moments.find(candidate => candidate.id === story.defaultMoment);
  assert.equal(moment.visual.state, 'crab.pulsar-engine');
  assert.equal(moment.kind, 'SCIENTIFIC 3D MODEL');
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
      'model', 'm87-jet-observed', 'm87-core-multiscale', 'eht-array-2017',
      'eht-total-intensity-2017', 'eht-polarization-2017', 'eht-compare-2017-2018',
    ],
    'pale-blue-dot': [
      'voyager-spacecraft', 'earth-moon-1977', 'pbd-original-1990',
      'voyager-camera-shutdown', 'voyager-heliopause-2012', 'pbd-compare-1990-2020',
    ],
  };
  for (const id of ['carina-nebula', 'crab-nebula', 'm87-black-hole-image', 'pale-blue-dot']){
    const moments = LANDMARK_EXPERIENCES[id].moments;
    assert.equal(moments.length,
      id === 'm87-black-hole-image' || id === 'carina-nebula' ? 7 : 6, id);
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
