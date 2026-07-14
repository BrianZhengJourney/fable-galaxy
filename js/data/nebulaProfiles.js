import { NEBULA_PROFILES_A } from './nebulaProfilesA.js';
import { NEBULA_PROFILES_B } from './nebulaProfilesB.js';

export const NEBULA_PROFILES = Object.freeze({
  ...NEBULA_PROFILES_A,
  ...NEBULA_PROFILES_B,
});

export const NEBULA_PROFILE_IDS = Object.freeze(Object.keys(NEBULA_PROFILES));

/* Rosette remains in the sourced research archive, but it is intentionally
   excluded from the public model collection until its own reconstruction
   reaches the same fidelity bar as the curated exhibits. */
export const FEATURED_NEBULA_PROFILE_IDS = Object.freeze(
  NEBULA_PROFILE_IDS.filter(id => id !== 'rosette-nebula'),
);

export function nebulaProfile(id){
  return NEBULA_PROFILES[id] || null;
}
