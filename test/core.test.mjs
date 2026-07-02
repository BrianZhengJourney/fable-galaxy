/* Core math + procgen tests — no dependencies, no DOM, no three.js.
   Run:  node --test test/  */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { heliocentric, julianDate } from '../js/data/ephemeris.js';
import { generateSystem } from '../js/procgen/system.js';
import { predictEvents } from '../js/core/events.js';
import { mulberry, hashStr, weighted } from '../js/utils/rng.js';
import { STAR_CATALOG } from '../js/data/starCatalog.js';

const rec = name => STAR_CATALOG.find(r => r.name === name);

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
