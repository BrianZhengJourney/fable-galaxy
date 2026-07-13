/* Captain's log: which systems this pilot has actually visited.
   Persisted in localStorage, so discovery survives reloads — the fog of
   war lifts once per star, permanently. */

const KEY = 'epocharium-journal-v1';
const LEGACY_KEYS = ['fable-galaxy-journal-v1'];

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

  markVisited(name, simDate){
    const rec = this.data[name] || { visits: 0, first: simDate };
    rec.visits += 1;
    rec.last = simDate;
    this.data[name] = rec;
    try{ localStorage.setItem(KEY, JSON.stringify(this.data)); }catch(e){ /* private mode */ }
  }

  isVisited(name){ return !!this.data[name]; }
  visitCount(name){ return this.data[name] ? this.data[name].visits : 0; }
  surveyed(){ return Object.keys(this.data).length; }
}
