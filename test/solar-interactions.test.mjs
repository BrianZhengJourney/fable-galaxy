import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { measureAlignment, predictEvents } from '../js/core/events.js';
import { SOL_BODIES } from '../js/data/solData.js';

const TAU = Math.PI * 2;

test('circular alignment measurement crosses the 360-degree seam correctly', () => {
  const degrees = [359, 0, 1, 170];
  const bodies = degrees.map((degree, index) => ({
    name: 'P' + index,
    period: 1,
    lon: () => degree * Math.PI / 180,
  }));
  const alignment = measureAlignment(bodies, 0, 3);
  assert.ok(Math.abs(alignment.arcDeg - 2) < 1e-10, alignment.arcDeg);
  assert.equal(new Set(alignment.members).size, 3);
});

test('Event Horizon favors tight, ambitious multi-planet model alignments', () => {
  const periods = [11, 13, 17, 19, 23, 29, 31, 37];
  const bodies = periods.map((period, index) => ({
    name: 'P' + index,
    period,
    lon: t => (index * 0.37 + TAU * t / period) % TAU,
  }));
  const events = predictEvents(bodies, null, 0, 6);
  const limits = { 5: 12, 6: 30, 7: 45 };

  assert.equal(events.length, 6);
  assert.ok(events.some(event => event.groupSize === 7));
  assert.deepEqual(events, [...events].sort((a, b) => a.t - b.t));
  for (const event of events){
    assert.equal(event.type, 'ILLUSTRATIVE ORBIT MODEL');
    assert.match(event.label, /MODEL ALIGNMENT$/);
    assert.ok(event.arcDeg <= limits[event.groupSize], event.label + ': ' + event.arcDeg);
    assert.equal(event.members.length, event.groupSize);
    assert.equal(new Set(event.members).size, event.groupSize);
    assert.equal(event.datePrecision, 'YEAR');
    assert.match(event.caveat, /NOT AN OBSERVING FORECAST/);
  }
});

test('every rendered Sol moon has a stable clickable identity', () => {
  const moons = SOL_BODIES.flatMap(body =>
    (body.moons || []).map(moon => ({ ...moon, parent: body.name })));
  assert.equal(moons.length, 7);
  assert.equal(new Set(moons.map(moon => moon.name)).size, moons.length);
  for (const moon of moons){
    assert.ok(moon.name && moon.info, moon.parent + ': unnamed moon');
    assert.equal(moon.info.PARENT, moon.parent);
  }
  assert.equal(1 + SOL_BODIES.length + moons.length + 2, 18,
    'Sun + planets + rendered moons + belt + comet should expose 18 semantic targets');
});

test('system picking covers the star, planets, every moon, belt and comet', async () => {
  const [planet, system, belt, comet, main] = await Promise.all([
    readFile(new URL('../js/objects/planet.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/scenes/systemView.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/objects/asteroidBelt.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/objects/comet.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
  ]);

  assert.match(system, /this\.pickTargets = \[this\.star\.pick\]/);
  assert.match(system, /this\.pickTargets\.push\(\.\.\.p\.pickTargets\)/);
  assert.match(planet, /this\.ring\.userData\.body = this/);
  assert.match(planet, /this\.ring \? \[this\.pick, this\.ring\] : \[this\.pick\]/);
  assert.match(planet, /every rendered moon is focusable \+ clickable/);
  assert.match(planet, /this\.satellites\.push\(\{ body: moonBody, pick: mpick, mesh: mm \}\)/);
  assert.match(system, /this\.pickTargets\.push\(this\.belt\.pick\)/);
  assert.match(system, /this\.pickTargets\.push\(this\.comet\.pick\)/);
  assert.match(belt, /this\.pick\.userData\.body = this/);
  assert.match(comet, /this\.pick\.userData\.body = this/);
  assert.match(main, /if \(hit\.isSystemFeature\) return this\.focusSystemFeature\(hit\)/);
  assert.match(planet, /descendable: m\.descendable === true \|\| realMoon/,
    'clickable moons must not imply unsupported low-orbit surfaces');
});

test('clicking an Event Horizon entry lands exactly on it and holds time', async () => {
  const [main, hud] = await Promise.all([
    readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui/hud.js', import.meta.url), 'utf8'),
  ]);
  assert.match(main,
    /this\.time\.simDays = ev\.t;[\s\S]{0,160}?this\.time\.setRate\(0\)/);
  assert.match(main,
    /if \(this\.time\.rate !== 0 && this\._evTick % 90 === 0/);
  assert.doesNotMatch(main, /this\.time\.simDays = ev\.t - 2/);
  assert.match(hud, /item\.classList\.add\('active'\)/);
  assert.match(hud, /item\.setAttribute\('aria-pressed', 'true'\)/);
  assert.match(hud, /≈ ['"] \+ fmtDateAt\(ev\.t\)\.slice\(0, 4\) \+ ['"] · MODEL PROJECTION/);
  assert.match(hud, /if \(time\.rate !== 0\) clearHeldEvent\(\)/,
    'resuming time should remove the stale HOLD selection');
});
