import { NEBULA_PROFILES_A } from './nebulaProfilesA.js';
import { NEBULA_PROFILES_B } from './nebulaProfilesB.js';

export const NEBULA_PROFILES = Object.freeze({
  ...NEBULA_PROFILES_A,
  ...NEBULA_PROFILES_B,
});

export const NEBULA_PROFILE_IDS = Object.freeze(Object.keys(NEBULA_PROFILES));

export function nebulaProfile(id){
  return NEBULA_PROFILES[id] || null;
}
