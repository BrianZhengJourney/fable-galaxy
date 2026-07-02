/* Procedural exoplanet systems.
   generateSystem(starRec) is fully deterministic — seeded by the star's name —
   so every visit to KEPLER-186 produces the same worlds. Output matches the
   shape of SOL_SYSTEM so SystemView renders both identically. */

import { mulberry, hashStr, weighted, gaussian } from '../utils/rng.js';
import { starColorHex, starColor, starInfo, cssColor } from '../data/starCatalog.js';
import { EXOPLANETS } from '../data/exoplanets.js';

const LETTERS = 'bcdefghijk';

const PALETTES = {
  rocky:   [['#8f8a84','#5c5751','#b6b0a6'], ['#9a8574','#63523f','#c4b09a'], ['#7f8a95','#4d5560','#aab8c4']],
  desert:  [['#c8a061','#8f6a38','#e8cc96'], ['#bd8355','#7f4f2c','#e0b184']],
  lava:    [['#3a1f18','#180a08','#6e3020'], ['#45201a','#1c0c08','#7d3a24']],
  ocean:   [['#1b4f8a','#0d2c55','#3f8f5f'], ['#155e7d','#0a3448','#3aa7a0'], ['#274a9e','#122456','#5b8fd4']],
  ice:     [['#9fd8de','#6faeb8','#cdeff2'], ['#aebfe8','#7787b8','#dbe6ff'], ['#8ec4d8','#5e94a8','#c2ecf8']],
  gas:     [['#c9a878','#8f6a44','#e8d6b4'], ['#b98a68','#7f5a38','#e0bc94'], ['#8aa0be','#5a708e','#bcd2ea'],
            ['#caa0a8','#9a7078','#ead0d4']],
  toxic:   [['#a8b860','#707c30','#d4e090'], ['#b0a848','#786e20','#dcd484']]
};
const CLASS_NAMES = {
  rocky:'ROCKY · BARREN', desert:'ROCKY · DESERT', lava:'ROCKY · MOLTEN',
  ocean:'OCEAN WORLD', ice:'ICE GIANT', gas:'GAS GIANT', toxic:'TOXIC · DENSE ATMOSPHERE'
};

function pick(rnd, arr){ return arr[(rnd() * arr.length) | 0]; }

export function generateSystem(rec){
  if (EXOPLANETS[rec.name]) return confirmedSystem(rec, EXOPLANETS[rec.name]);
  return proceduralSystem(rec);
}

/* ---- confirmed systems: real radii, periods and temperatures ---- */
function confirmedSystem(rec, list){
  const rnd = mulberry(hashStr('exo:' + rec.name));
  const starVisualR = Math.max(2.4, Math.min(9, 4.6 * Math.pow(rec.radius, 0.45)));
  let dist = starVisualR + 4;
  const bodies = list.map((p, i) => {
    dist += 4.5 + Math.min(9, Math.log10(p.periodDays + 1) * 3.2);
    const teq = p.teqK || 250;
    let type;
    if (p.giant || p.rEarth > 5) type = teq > 800 ? 'gas' : (teq < 200 ? 'ice' : 'gas');
    else if (teq > 700) type = 'lava';
    else if (teq > 330) type = weighted(rnd, [['rocky', 2], ['desert', 2], ['toxic', 1]]);
    else if (teq > 200) type = weighted(rnd, [['ocean', 2], ['rocky', 1], ['desert', 1]]);
    else type = weighted(rnd, [['ice', 2], ['rocky', 1]]);
    const r = p.giant || p.rEarth > 5
      ? Math.min(2.8, 1.4 + p.rEarth * 0.09)
      : Math.max(0.4, 0.9 * Math.pow(p.rEarth, 0.7));
    const pal = pick(rnd, PALETTES[type]);
    const tidal = p.periodDays < 25;      // close-in worlds are likely locked
    const mass = p.massJ ? p.massJ.toFixed(2) + ' M♃'
               : p.massE ? p.massE.toFixed(2) + ' M⊕' : '—';
    return {
      name: (rec.name + ' ' + p.letter).toUpperCase(),
      cls: 'CONFIRMED · ' + CLASS_NAMES[type],
      r, dist, period: p.periodDays,
      rotP: tidal ? p.periodDays : 0.8 + rnd() * 30,
      tilt: Math.abs(gaussian(rnd)) * 20,
      phase: rnd() * Math.PI * 2,
      view: Math.max(4.5, r * 4.6),
      tex: { type, base: pal[0], dark: pal[1], light: pal[2], bands: 4 + ((rnd() * 6) | 0) },
      glow: type === 'lava',
      info: {
        'RADIUS': Math.round(p.rEarth * 6371).toLocaleString('en-US') + ' km',
        'MASS': mass,
        'EQUILIBRIUM TEMP': Math.round(teq - 273) + ' °C',
        'ORBITAL PERIOD': p.periodDays > 900
          ? (p.periodDays / 365.25).toFixed(1) + ' yr' : p.periodDays.toFixed(2) + ' d',
        'ROTATION': tidal ? 'TIDALLY LOCKED' : '—',
        'SOURCE': 'NASA ARCHIVE'
      }
    };
  });
  const rgb = starColor(rec.temp);
  return {
    star: {
      name: rec.name, cls: rec.cls + ' — CONFIRMED SYSTEM',
      color: starColorHex(rec.temp),
      bright: cssColor(rgb.map(v => Math.min(1, v * 1.15 + 0.1)), 1),
      deep: cssColor(rgb, 1),
      coreRadius: starVisualR, rotP: 18 + rnd() * 30,
      info: Object.assign(starInfo(rec),
        { 'CONFIRMED PLANETS': String(list.length) })
    },
    bodies, extent: bodies[bodies.length - 1].dist + 12
  };
}

/* ---- everything else: seeded procedural worlds ---- */
function proceduralSystem(rec){
  const rnd = mulberry(hashStr('system:' + rec.name));
  const nPlanets = 2 + ((rnd() * 8) | 0);
  const starVisualR = Math.max(2.4, Math.min(9, 4.6 * Math.pow(rec.radius, 0.45)));
  const bodies = [];
  let dist = starVisualR + 4 + rnd() * 4;

  for (let i = 0; i < nPlanets; i++){
    dist += 4.5 + rnd() * 6.5 + (i > 3 ? 4 : 0);
    // zone temperature scales with star luminosity, falls off with distance
    const zoneT = 1600 * Math.sqrt(Math.max(0.0005, rec.lum)) / Math.pow(dist / 12, 0.9);
    let type;
    if (i >= 3 && rnd() < 0.55) type = rnd() < 0.55 ? 'gas' : 'ice';
    else if (zoneT > 700) type = weighted(rnd, [['lava', 3], ['rocky', 2], ['toxic', 1]]);
    else if (zoneT > 180) type = weighted(rnd, [['rocky', 2], ['desert', 2], ['ocean', 3], ['toxic', 1]]);
    else type = weighted(rnd, [['rocky', 2], ['ice', 2], ['gas', 1]]);

    const giant = type === 'gas' || (type === 'ice' && rnd() < 0.5);
    const r = giant ? 1.6 + rnd() * 1.3 : 0.45 + rnd() * 0.75;
    // Kepler-ish: T ∝ sqrt(d³ / M★), anchored to Mercury's 88 d at dist 11
    const period = 88 * Math.sqrt(Math.pow(dist / 11, 3) / Math.max(0.08, rec.mass));
    const retro = rnd() < 0.12;
    const rotP = (giant ? 0.3 + rnd() * 0.5 : 0.6 + rnd() * 40) * (retro ? -1 : 1);
    const tilt = Math.abs(gaussian(rnd)) * 30 + (rnd() < 0.06 ? 80 : 0);
    const rings = giant && rnd() < 0.4;
    const nMoons = giant ? 1 + ((rnd() * 4) | 0) : (rnd() < 0.25 ? 1 : 0);
    const moons = [];
    for (let m = 0; m < nMoons; m++)
      moons.push({ r: 0.09 + rnd() * 0.14, dist: r + 1.1 + m * 0.9 + rnd() * 0.5,
                   period: 2 + rnd() * 18 });

    const name = rec.name + ' ' + LETTERS[i];
    const pal = pick(rnd, PALETTES[type]);
    const tempC = Math.round(zoneT - 273 + gaussian(rnd) * 30);
    const kmR = Math.round(r / 0.9 * 6371);
    const massKg = (type === 'gas' || type === 'ice')
      ? Math.pow(r / 2.6, 3) * 1.9  : Math.pow(r / 0.9, 3) * 0.006;
    const massExp = 27 + Math.floor(Math.log10(massKg));
    const massMant = (massKg / Math.pow(10, massExp - 27)).toFixed(2);

    bodies.push({
      name: name.toUpperCase(), cls: CLASS_NAMES[type],
      r, dist, period, rotP, tilt: tilt % 180,
      phase: rnd() * Math.PI * 2,
      view: Math.max(4.5, r * 4.6),
      tex: { type, base: pal[0], dark: pal[1], light: pal[2],
             bands: 4 + ((rnd() * 6) | 0) },
      rings, moons: moons.length ? moons : undefined,
      glow: type === 'lava',
      info: {
        'RADIUS': kmR.toLocaleString('en-US') + ' km',
        'MASS': massMant + ' ×10' + sup(massExp) + ' kg',
        'SURFACE TEMP': tempC + ' °C',
        'ORBITAL PERIOD': period > 900 ? (period / 365.25).toFixed(1) + ' yr' : period.toFixed(1) + ' d',
        'ROTATION': Math.abs(rotP) < 3 ? (Math.abs(rotP) * 24).toFixed(1) + ' h' + (retro ? ' RETRO' : '')
                                       : Math.abs(rotP).toFixed(1) + ' d' + (retro ? ' RETRO' : ''),
        'MOONS': String(nMoons)
      }
    });
  }

  // optional asteroid belt in a gap after the 2nd/3rd planet
  let belt;
  if (nPlanets >= 3 && rnd() < 0.45){
    const k = 1 + ((rnd() * Math.min(2, nPlanets - 2)) | 0);
    const inner = bodies[k].dist + 2.5, outer = bodies[k + 1] ? bodies[k + 1].dist - 2.5 : inner + 4;
    if (outer - inner > 2.5)
      belt = { inner, outer, count: 2600 + ((rnd() * 2000) | 0), seed: 'belt:' + rec.name };
  }
  // occasional long-period comet
  let comet;
  if (rnd() < 0.4){
    const extent = bodies[bodies.length - 1].dist;
    comet = { a: extent * 0.65, e: 0.55 + rnd() * 0.3, period: 900 + rnd() * 2600,
              incl: (rnd() - 0.5) * 0.9, node: rnd() * Math.PI * 2, phase: rnd() * Math.PI * 2 };
  }

  const rgb = starColor(rec.temp);
  return {
    star: {
      name: rec.name, cls: rec.cls + ' — PROCEDURAL SURVEY',
      color: starColorHex(rec.temp),
      bright: cssColor(rgb.map(v => Math.min(1, v * 1.15 + 0.1)), 1),
      deep: cssColor(rgb, 1),
      coreRadius: starVisualR, rotP: 18 + rnd() * 30,
      info: Object.assign(starInfo(rec), { 'PLANETS': String(nPlanets) })
    },
    bodies, belt, comet,
    extent: bodies[bodies.length - 1].dist + 12
  };
}

function sup(n){
  const S = { 0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹' };
  return String(n).split('').map(c => S[c] || c).join('');
}
