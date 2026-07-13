/* Deterministic RNG utilities — everything procedural in 47 is
   seeded, so the same star always generates the same system. */

export function mulberry(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s){
  let h = 2166136261;
  for (let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* pick a weighted entry: items = [[value, weight], ...] */
export function weighted(rnd, items){
  let total = 0;
  for (const [, w] of items) total += w;
  let roll = rnd() * total;
  for (const [v, w] of items){
    roll -= w;
    if (roll <= 0) return v;
  }
  return items[items.length - 1][0];
}

/* approximate gaussian via sum of uniforms */
export function gaussian(rnd){
  return (rnd() + rnd() + rnd() + rnd() - 2) / 2;
}
