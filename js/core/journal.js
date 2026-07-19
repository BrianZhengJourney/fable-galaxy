/* Captain's log: which systems this pilot has actually visited.
   Persisted in localStorage, so discovery survives reloads — the fog of
   war lifts once per star, permanently. */

const KEY = 'galaxy-42-journal-v1';
const LEGACY_KEYS = [
  '47-journal-v1',
  'epocharium-journal-v1',
  'fable-galaxy-journal-v1',
];

function loadJournal(){
  const current = localStorage.getItem(KEY);
  if (current) return JSON.parse(current);

  for (const legacyKey of LEGACY_KEYS){
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) continue;
    const data = JSON.parse(legacy);
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }
  return {};
}

export class Journal {
  constructor(){
    this.data = {};
    try{
      this.data = loadJournal();
    }catch(e){ this.data = {}; }
  }

  markVisited(name, simDate, meta = {}){
    const key = meta.key || name;
    const rec = this.data[key] || { visits: 0, first: simDate };
    rec.visits += 1;
    rec.last = simDate;
    rec.name = meta.name || rec.name || name;
    if (meta.kind) rec.kind = meta.kind;
    if (meta.target) rec.target = meta.target;
    this.data[key] = rec;
    try{ localStorage.setItem(KEY, JSON.stringify(this.data)); }catch(e){ /* private mode */ }
  }

  isVisited(name){ return !!this.data[name]; }
  visitCount(name){ return this.data[name] ? this.data[name].visits : 0; }
  surveyed(){ return Object.keys(this.data).length; }
  entries(){
    return Object.entries(this.data)
      .map(([key, rec]) => ({ key, ...rec, name: rec.name || key }))
      .sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')));
  }
}
