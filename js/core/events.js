/* Event prediction. Positions are pure functions of simDays, so future
   events are root-finding problems: scan for a sign change of the wrapped
   longitude difference (coarse steps of the pair's synodic period), then
   bisect to sub-hour precision. Comet perihelion falls out analytically. */

const TAU = Math.PI * 2;

function wrapPi(a){
  a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a;
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

/* next perihelion of a Kepler comet: mean anomaly M = phase + 2πt/T ≡ 0 */
function nextPerihelion(comet, tStart){
  const cycles = (comet.phase / TAU) + (tStart / comet.period);
  return (Math.ceil(cycles) - comet.phase / TAU) * comet.period;
}

/* bodies: [{ name, period, lon(t) → heliocentric longitude in radians }]
   Returns the next events sorted by time, adjacent-pair conjunctions plus
   comet perihelion, within `horizon` days of tStart. */
export function predictEvents(bodies, comet, tStart, maxEvents = 6){
  const events = [];
  for (let i = 0; i + 1 < bodies.length; i++){
    const a = bodies[i], b = bodies[i + 1];
    const horizon = Math.min(60000, 4 / Math.abs(1 / a.period - 1 / b.period));
    const t = nextConjunction(a.lon, b.lon, a.period, b.period, tStart, horizon);
    if (t !== null)
      events.push({ t, label: a.name + ' ∠ ' + b.name, type: 'CONJUNCTION' });
  }
  if (comet){
    const t = nextPerihelion(comet, tStart);
    events.push({ t, label: 'COMET PERIHELION', type: 'PERIHELION' });
  }
  events.sort((x, y) => x.t - y.t);
  return events.slice(0, maxEvents);
}
