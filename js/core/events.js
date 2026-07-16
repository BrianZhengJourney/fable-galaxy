/* Event prediction. Positions are pure functions of simDays, so future
   events are search problems. Small systems use exact pair-conjunction root
   finding. Rich systems search a long window for the rare moments when five,
   six or seven worlds occupy their tightest common heliocentric arc. */

const TAU = Math.PI * 2;
const ALIGNMENT_HORIZON = 365.25 * 180;
const ALIGNMENT_WORDS = {
  5: 'FIVE',
  6: 'SIX',
  7: 'SEVEN',
};
const ALIGNMENT_ARC_LIMIT = {
  5: 12,
  6: 30,
  7: 45,
};

function wrapPi(a){
  a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a;
}

function wrapTau(a){
  return ((a % TAU) + TAU) % TAU;
}

/* next time g(t) := wrap(lonA - lonB) crosses 0 (conjunction: shared
   heliocentric longitude). Crossings through ±π (opposition) are skipped. */
function nextConjunction(lonA, lonB, pA, pB, tStart, horizon){
  const synodic = 1 / Math.abs(1 / pA - 1 / pB);
  const step = Math.max(0.25, synodic / 36);
  let t0 = tStart, g0 = wrapPi(lonA(t0) - lonB(t0));
  for (let t = tStart + step; t < tStart + horizon; t += step){
    const g1 = wrapPi(lonA(t) - lonB(t));
    if (g0 === 0) g0 = 1e-9;
    if (Math.sign(g1) !== Math.sign(g0) && Math.abs(g0) + Math.abs(g1) < Math.PI){
      let lo = t0, hi = t, glo = g0;               // bisect to ~1 minute
      for (let k = 0; k < 40; k++){
        const mid = (lo + hi) / 2;
        const gm = wrapPi(lonA(mid) - lonB(mid));
        if (Math.sign(gm) === Math.sign(glo)){ lo = mid; glo = gm; } else hi = mid;
      }
      return (lo + hi) / 2;
    }
    t0 = t; g0 = g1;
  }
  return null;
}

/* Find the narrowest circular arc containing `count` bodies. Once the
   longitudes are sorted, the winning subset must be one contiguous window
   around that circle, so this remains cheap enough for a centuries-long scan. */
function groupingAt(bodies, t, count){
  const ordered = bodies.map(body => ({ body, lon: wrapTau(body.lon(t)) }))
    .sort((a, b) => a.lon - b.lon);
  let bestSpan = Infinity, bestStart = 0;
  for (let start = 0; start < ordered.length; start++){
    const end = start + count - 1;
    const endLon = ordered[end % ordered.length].lon + (end >= ordered.length ? TAU : 0);
    const span = endLon - ordered[start].lon;
    if (span < bestSpan){ bestSpan = span; bestStart = start; }
  }
  const members = [];
  for (let i = 0; i < count; i++)
    members.push(ordered[(bestStart + i) % ordered.length].body.name);
  return { t, span: bestSpan, members };
}

/* Public diagnostic used by tests and future UI explanations. */
export function measureAlignment(bodies, t, count){
  if (count < 2 || count > bodies.length)
    throw new RangeError('alignment count must fit the body set');
  const grouping = groupingAt(bodies, t, count);
  return {
    t: grouping.t,
    arcDeg: grouping.span * 180 / Math.PI,
    members: grouping.members,
  };
}

/* The winning subset can change near a minimum, so a small grid refinement is
   more robust than assuming a differentiable score for Newton/golden search. */
function refineGrouping(bodies, count, coarse, initialRadius){
  let best = coarse, radius = initialRadius;
  for (let round = 0; round < 5; round++){
    for (let i = -5; i <= 5; i++){
      const candidate = groupingAt(bodies, best.t + radius * i / 5, count);
      if (candidate.span < best.span) best = candidate;
    }
    radius /= 5;
  }
  return best;
}

function alignmentCandidates(bodies, count, tStart){
  const shortestPeriod = Math.min(...bodies.map(body => body.period));
  // Broad multi-world minima evolve over weeks even though Mercury moves
  // quickly. A ~9 day Sol scan step finds the basin, then refinement recovers
  // the exact minimum without blocking the first interactive frame for long.
  const step = Math.max(1, Math.min(10, shortestPeriod / 10));
  const end = tStart + ALIGNMENT_HORIZON;
  let before = groupingAt(bodies, tStart + 1, count);
  let middle = groupingAt(bodies, before.t + step, count);
  const coarse = [];

  for (let t = middle.t + step; t <= end; t += step){
    const after = groupingAt(bodies, t, count);
    if (middle.span <= before.span && middle.span < after.span)
      coarse.push(middle);
    before = middle;
    middle = after;
  }

  // Keep well-separated minima before refinement so one long alignment does
  // not fill the Event Horizon with several dates from the same encounter.
  coarse.sort((a, b) => a.span - b.span || a.t - b.t);
  const separated = [];
  for (const candidate of coarse){
    if (separated.every(other => Math.abs(other.t - candidate.t) > 180))
      separated.push(candidate);
    if (separated.length >= 14) break;
  }

  return separated.map(candidate => refineGrouping(bodies, count, candidate, step))
    .filter(candidate => candidate.span * 180 / Math.PI <= ALIGNMENT_ARC_LIMIT[count])
    .sort((a, b) => a.span - b.span || a.t - b.t);
}

function alignmentEvent(candidate, count){
  return {
    t: candidate.t,
    label: (ALIGNMENT_WORDS[count] || String(count)) + '-PLANET MODEL ALIGNMENT',
    type: 'ILLUSTRATIVE ORBIT MODEL',
    groupSize: count,
    arcDeg: candidate.span * 180 / Math.PI,
    members: candidate.members,
    datePrecision: 'YEAR',
    caveat: 'LONG-RANGE MODEL PROJECTION · NOT AN OBSERVING FORECAST',
  };
}

function multiPlanetAlignments(bodies, tStart, maxEvents, reserveForComet){
  const sizes = [];
  for (let count = Math.min(7, bodies.length); count >= 5; count--) sizes.push(count);
  const slots = Math.max(0, maxEvents - reserveForComet);
  const selected = [];
  let remaining = slots;

  for (let index = 0; index < sizes.length && remaining > 0; index++){
    const count = sizes[index];
    const groupsLeft = sizes.length - index;
    const quota = Math.ceil(remaining / groupsLeft); // ambition wins spare slots
    const candidates = alignmentCandidates(bodies, count, tStart);
    let used = 0;
    for (const candidate of candidates){
      if (selected.some(event => Math.abs(event.t - candidate.t) < 45)) continue;
      selected.push(alignmentEvent(candidate, count));
      used += 1;
      if (used >= quota) break;
    }
    remaining -= used;
  }
  return selected;
}

/* next perihelion of a Kepler comet: mean anomaly M = phase + 2πt/T ≡ 0 */
function nextPerihelion(comet, tStart){
  const cycles = (comet.phase / TAU) + (tStart / comet.period);
  return (Math.ceil(cycles) - comet.phase / TAU) * comet.period;
}

/* bodies: [{ name, period, lon(t) → heliocentric longitude in radians }]
   Rich systems return deliberately rare 5–7 planet groupings across the next
   180 years. Sparse systems retain exact pair conjunctions. A comet
   perihelion is included when available. */
export function predictEvents(bodies, comet, tStart, maxEvents = 6){
  const events = [];
  if (bodies.length >= 5){
    events.push(...multiPlanetAlignments(bodies, tStart, maxEvents, comet ? 1 : 0));
  } else {
    for (let i = 0; i + 1 < bodies.length; i++){
      const a = bodies[i], b = bodies[i + 1];
      const horizon = Math.min(60000, 4 / Math.abs(1 / a.period - 1 / b.period));
      const t = nextConjunction(a.lon, b.lon, a.period, b.period, tStart, horizon);
      if (t !== null)
        events.push({ t, label: a.name + ' ∠ ' + b.name, type: 'CONJUNCTION' });
    }
  }
  if (comet){
    const t = nextPerihelion(comet, tStart);
    events.push({ t, label: 'COMET PERIHELION', type: 'PERIHELION' });
  }
  events.sort((x, y) => x.t - y.t);
  return events.slice(0, maxEvents);
}
