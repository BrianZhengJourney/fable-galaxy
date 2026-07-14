/* Editorial navigation for the public Explore collection. The generated
   landmark catalog remains the complete research archive; this file defines
   the smaller set whose interactive renderers meet the current fidelity bar. */

function card(id, badges, imagePosition = 'center'){
  return Object.freeze({ id, badges: Object.freeze([...badges]), imagePosition });
}

function section(id, label, kicker, intro, color, items){
  return Object.freeze({
    id, label, kicker, intro, color,
    items: Object.freeze(items),
  });
}

export const EXPLORE_SECTIONS = Object.freeze([
  section(
    'nebulae',
    'NEBULAE',
    'STAR BIRTH & STELLAR REMAINS',
    'Enter sculpted clouds, shells, dust lanes and ionization fronts reconstructed from landmark observations.',
    '#d47bf0',
    [
      card('pillars-of-creation', ['3D MODEL', 'TIMELINE']),
      card('orion-nebula', ['3D MODEL', 'OBSERVATION']),
      card('carina-nebula', ['3D MODEL', 'TIMELINE']),
      card('horsehead-nebula', ['3D MODEL', 'OBSERVATION']),
      card('ring-nebula', ['3D MODEL', 'OBSERVATION']),
      card('helix-nebula', ['3D MODEL', 'OBSERVATION']),
      card('lagoon-nebula', ['3D MODEL', 'OBSERVATION']),
      card('cats-eye-nebula', ['3D MODEL', 'OBSERVATION']),
      card('trifid-nebula', ['3D MODEL', 'OBSERVATION']),
    ],
  ),
  section(
    'black-holes',
    'BLACK HOLES',
    'RELATIVISTIC ENGINES',
    'Compare four physically distinct systems through lensing, accretion, stellar orbits, jets and spacetime waves.',
    '#ffd27a',
    [
      card('cygnus-x-1', ['3D MODEL', 'BINARY SYSTEM']),
      card('sagittarius-a-star', ['3D MODEL', 'STELLAR ORBITS']),
      card('m87-star', ['3D MODEL', 'RELATIVISTIC JET']),
      card('gw150914', ['3D MODEL', 'MERGER']),
    ],
  ),
  section(
    'remnants',
    'SUPERNOVAE & REMNANTS',
    'AFTER THE EXPLOSION',
    'Trace expanding shock fronts and the compact stellar engines left behind after massive stars die.',
    '#ff8a68',
    [
      card('crab-nebula-sn-1054', ['3D MODEL', 'TIMELINE']),
      card('sn-1987a', ['3D MODEL', 'OBSERVATION']),
      card('cassiopeia-a', ['3D MODEL', 'OBSERVATION']),
      card('veil-nebula', ['3D MODEL', 'OBSERVATION']),
    ],
  ),
  section(
    'missions',
    'DISCOVERIES & MISSIONS',
    'HOW WE CAME TO KNOW',
    'Follow an observation whose scale changed humanity’s view of its place in the cosmos.',
    '#71ddff',
    [
      card('pale-blue-dot', ['MISSION', 'TIMELINE'], '62% center'),
    ],
  ),
]);

export const EXPLORE_LANDMARK_IDS = Object.freeze(
  EXPLORE_SECTIONS.flatMap(sectionRecord => sectionRecord.items.map(item => item.id)),
);
