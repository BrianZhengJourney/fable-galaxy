import { createFeaturedExhibit } from './contract.js';
import { buildPillarsFeatured } from './pillars.js';
import { buildCarinaFeatured } from './carina.js';
import { buildCrabFeatured } from './crab.js';
import { buildM87Featured } from './m87.js';
import { buildPaleBlueDotFeatured } from './paleBlueDot.js';
import { buildNebulaCollectionFeatured } from './nebulaCollection.js';
import { NEBULA_PROFILE_IDS } from '../../data/nebulaProfiles.js';

function buildCrabAlias(context){
  return buildCrabFeatured({
    ...context,
    entry: { ...context.entry, id: 'crab-nebula' },
  });
}

/* One stable dispatch point for the curated field stories. Keeping each entry
   in its own module lets the dedicated visuals evolve independently. */
const FEATURED_BUILDERS = new Map([
  ['pillars-of-creation', {
    renderer: 'pillars-hybrid', build: buildPillarsFeatured,
  }],
  ['carina-nebula', {
    renderer: 'carina-multi-state', build: buildCarinaFeatured,
  }],
  ['crab-nebula', {
    renderer: 'crab-observation-volume', build: buildCrabFeatured,
  }],
  ['crab-nebula-sn-1054', {
    renderer: 'crab-observation-volume', build: buildCrabAlias,
  }],
  ['m87-black-hole-image', {
    renderer: 'm87-multi-state', build: buildM87Featured,
  }],
  ['pale-blue-dot', {
    renderer: 'pale-blue-dot-multi-state', build: buildPaleBlueDotFeatured,
  }],
  ...NEBULA_PROFILE_IDS.map(id => [id, {
    renderer: 'nebula-photo-hybrid-v1', build: buildNebulaCollectionFeatured,
  }]),
]);

export const FEATURED_EXHIBIT_IDS = Object.freeze([...FEATURED_BUILDERS.keys()]);

export function hasFeaturedExhibit(id){
  return FEATURED_BUILDERS.has(id);
}
/* Returns null for archive landmarks so callers can preserve the existing
   category/vizStyle fallback without another ID switch. */
export function buildFeaturedExhibit(context){
  const id = context && context.entry && context.entry.id;
  const record = FEATURED_BUILDERS.get(id);
  if (!record) return null;
  return createFeaturedExhibit(id, record.renderer, record.build(context));
}
