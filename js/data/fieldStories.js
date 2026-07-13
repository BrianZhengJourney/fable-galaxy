/* Visual-first field stories. This hand-curated layer sits beside the generated
   landmark catalog: a small featured set, compact summaries and semantic
   milestones that may mix observations, evidence and model forecasts. */

export const FEATURED_LANDMARK_IDS = [
  'pillars-of-creation',
  'carina-nebula',
  'crab-nebula',
  'm87-black-hole-image',
  'pale-blue-dot',
];

export const LANDMARK_EXPERIENCES = {
  'pillars-of-creation': {
    summary: 'A stellar nursery seen across deep time and new wavelengths.',
    defaultMoment: 'hubble-1995',
    note: 'Observation dates, light-travel context and forecasts share this rail. The fly-around depth is a scientific visualization, not a captured 3D image.',
    moments: [
      {
        id: 'carved', date: 'MILLIONS OF YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'STARLIGHT CARVES THE CLOUD',
        text: 'Young stars erode thinner gas, leaving dense columns behind.',
        source: 'https://www.eso.org/public/news/eso1518/',
        visual: { wavelength: 'visible', theta: .72, phi: 1.22, distance: .90 },
      },
      {
        id: 'light-left', date: 'ABOUT 6,500 YEARS AGO', kind: 'LIGHT TRAVEL',
        title: 'THIS LIGHT LEAVES M16',
        text: 'The view reaching us now began its journey thousands of years ago.',
        source: 'https://science.nasa.gov/missions/hubble/hubble-goes-high-definition-to-revisit-iconic-pillars-of-creation/',
        visual: { wavelength: 'visible', theta: .32, phi: 1.28, distance: .94 },
      },
      {
        id: 'hubble-1995', date: '1995', kind: 'OBSERVATION',
        title: 'HUBBLE MAKES AN ICON',
        text: 'Visible light reveals three immense columns where stars are forming.',
        source: 'https://science.nasa.gov/mission/hubble/overview/hubble-timeline/hubble-science-timeline-full-text/',
        visual: { wavelength: 'visible', theta: 0, phi: 1.30, distance: 1 },
      },
      {
        id: 'hubble-2015', date: '2015', kind: 'OBSERVATION',
        title: 'HUBBLE RETURNS',
        text: 'A wider, sharper portrait tracks change across two decades.',
        source: 'https://science.nasa.gov/missions/hubble/hubble-goes-high-definition-to-revisit-iconic-pillars-of-creation/',
        visual: { wavelength: 'visible', theta: .12, phi: 1.27, distance: .96 },
      },
      {
        id: 'webb-2022', date: '2022', kind: 'INFRARED OBSERVATION',
        title: 'WEBB LOOKS THROUGH DUST',
        text: 'Near-infrared light brings newborn stars into view.',
        source: 'https://science.nasa.gov/missions/webb/nasas-webb-takes-star-filled-portrait-of-pillars-of-creation/',
        visual: { wavelength: 'infrared', theta: 0, phi: 1.30, distance: 1 },
      },
      {
        id: 'eroded', date: 'ABOUT 3 MILLION YEARS AHEAD', kind: 'MODEL FORECAST',
        title: 'THE PILLARS FADE',
        text: 'At today’s erosion rate, the columns may slowly evaporate away.',
        source: 'https://www.eso.org/public/news/eso1518/',
        visual: { wavelength: 'visible', theta: 1.05, phi: 1.18, distance: .86 },
      },
    ],
  },
  'carina-nebula': {
    summary: 'A vast stellar nursery shaped by its brightest, most violent stars.',
    defaultMoment: 'carina-webb',
    note: 'Early and future scenes are context, not recorded time-lapse. The displayed field is Webb infrared imagery; camera motion adds illustrative depth.',
    moments: [
      {
        id: 'carina-ignites', date: 'ABOUT 3 MILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'FIRST STARS IGNITE',
        text: 'Carina’s first stellar generation carves an expanding bubble of hot gas.',
        source: 'https://science.nasa.gov/asset/hubble/carina-nebula-2/',
        visual: { theta: .72, phi: 1.17, distance: .92 },
      },
      {
        id: 'carina-found', date: '1752', kind: 'OBSERVATION',
        title: 'LACAILLE FINDS CARINA',
        text: 'Nicolas-Louis de Lacaille records the nebula from the Cape of Good Hope.',
        source: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-92/',
        visual: { theta: 0, phi: 1.20, distance: 1 },
      },
      {
        id: 'carina-erupts', date: '1843', kind: 'OBSERVATION',
        title: 'ETA CARINAE ERUPTS',
        text: 'The Great Eruption peaks and ejects the material that forms the Homunculus.',
        source: 'https://www.nasa.gov/science-research/astrophysics/chandra-rewinds-story-of-great-eruption-of-the-1840s/',
        visual: { theta: .12, phi: 1.25, distance: .95 },
      },
      {
        id: 'carina-hubble', date: '2007', kind: 'OBSERVATION',
        title: 'HUBBLE MAPS THE MAELSTROM',
        text: 'A 50-light-year panorama exposes star birth and intense stellar feedback.',
        source: 'https://science.nasa.gov/missions/hubble/the-carina-nebula-star-birth-in-the-extreme/',
        visual: { theta: -.10, phi: 1.20, distance: .98 },
      },
      {
        id: 'carina-webb', date: '2022', kind: 'INFRARED OBSERVATION',
        title: 'WEBB REVEALS HIDDEN BIRTH',
        text: 'Infrared light uncovers young stars along the Cosmic Cliffs.',
        source: 'https://science.nasa.gov/missions/webb/nasas-webb-reveals-cosmic-cliffs-glittering-landscape-of-star-birth/',
        visual: { theta: 0, phi: 1.20, distance: 1 },
      },
      {
        id: 'carina-clears', date: 'FUTURE · NO FIXED DATE', kind: 'CONCEPT',
        title: 'THE NURSERY SLOWLY CLEARS',
        text: 'Radiation keeps eroding gas; this view is illustrative, not predictive.',
        source: 'https://science.nasa.gov/missions/webb/nasas-webb-reveals-cosmic-cliffs-glittering-landscape-of-star-birth/',
        visual: { theta: .88, phi: 1.12, distance: .88 },
      },
    ],
  },
  'crab-nebula': {
    summary: 'A supernova remnant still expanding around a clock-like neutron star.',
    defaultMoment: 'crab-hubble-expansion',
    note: 'The 1054 date is when the supernova light reached Earth. Webb and Hubble milestones describe different datasets; this exhibit keeps one credited reference image.',
    moments: [
      {
        id: 'crab-1054', date: '1054 CE', kind: 'HISTORICAL OBSERVATION',
        title: 'A GUEST STAR BLAZES',
        text: 'Astronomers record the supernova whose remnant becomes the Crab Nebula.',
        source: 'https://www.nasa.gov/news-release/nasa-satellites-find-high-energy-surprises-in-constant-crab-nebula/',
        visual: { theta: .28, phi: 1.18, distance: .96 },
      },
      {
        id: 'crab-found', date: '1731', kind: 'OBSERVATION',
        title: 'THE NEBULA IS FOUND',
        text: 'John Bevis discovers the faint remnant through a telescope.',
        source: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/',
        visual: { theta: 0, phi: 1.20, distance: 1 },
      },
      {
        id: 'crab-linked', date: '1928', kind: 'SCIENTIFIC INFERENCE',
        title: 'HUBBLE CONNECTS THE RECORDS',
        text: 'Edwin Hubble links the nebula to the guest star seen in 1054.',
        source: 'https://science.nasa.gov/asset/hubble/crab-nebula/',
        visual: { theta: -.18, phi: 1.22, distance: .95 },
      },
      {
        id: 'crab-pulsar', date: '1968', kind: 'RADIO OBSERVATION',
        title: 'THE PULSAR STARTS TICKING',
        text: 'Radio pulses reveal the neutron star powering the nebula.',
        source: 'https://science.nasa.gov/missions/hubble/hubble-captures-the-beating-heart-of-the-crab-nebula/',
        visual: { theta: .08, phi: 1.18, distance: .86 },
      },
      {
        id: 'crab-webb', date: '2023', kind: 'INFRARED OBSERVATION',
        title: 'WEBB SEES SYNCHROTRON SMOKE',
        text: 'Infrared imaging maps dust and synchrotron structure inside the remnant.',
        source: 'https://science.nasa.gov/missions/webb/the-crab-nebula-seen-in-new-light-by-nasas-webb/',
        visual: { theta: -.10, phi: 1.18, distance: .90 },
      },
      {
        id: 'crab-hubble-expansion', date: '2026', kind: 'OBSERVATION',
        title: 'HUBBLE MEASURES EXPANSION',
        text: 'A 25-year baseline shows the remnant still racing outward.',
        source: 'https://science.nasa.gov/missions/hubble/nasas-hubble-revisits-crab-nebula-to-track-25-years-of-expansion/',
        visual: { theta: 0, phi: 1.20, distance: 1 },
      },
    ],
  },
  'm87-black-hole-image': {
    summary: 'The observation that turned a black hole’s shadow into an image.',
    defaultMoment: 'm87-shadow',
    note: 'This is a false-color reconstruction from millimeter-wave radio interferometry, not a visible-light photograph of the event horizon.',
    moments: [
      {
        id: 'm87-jet', date: '1918', kind: 'OBSERVATION',
        title: 'A JET APPEARS',
        text: 'Heber Curtis notices M87’s curious straight ray.',
        source: 'https://www.nasa.gov/missions/spitzer/the-giant-galaxy-around-the-giant-black-hole/',
        visual: { theta: .16, phi: 1.20, distance: .98 },
      },
      {
        id: 'm87-dark-engine', date: '1978', kind: 'DYNAMICAL EVIDENCE',
        title: 'GRAVITY REVEALS A DARK ENGINE',
        text: 'Stellar motion points to a massive compact object in M87.',
        source: 'https://science.nasa.gov/missions/hubble/nasas-hubble-space-telescope-probes-the-compact-nucleus-of-galaxy-m87/',
        visual: { theta: -.12, phi: 1.22, distance: .92 },
      },
      {
        id: 'm87-array', date: 'APRIL 2017', kind: 'RADIO OBSERVATION',
        title: 'EARTH BECOMES ONE TELESCOPE',
        text: 'Eight synchronized observatories collect millimeter-wave data from M87*.',
        source: 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole',
        visual: { theta: .25, phi: 1.18, distance: 1 },
      },
      {
        id: 'm87-shadow', date: 'APRIL 10 · 2019', kind: 'RADIO RECONSTRUCTION',
        title: 'THE FIRST SHADOW IMAGE',
        text: 'EHT releases the first direct visual evidence of a black hole shadow.',
        source: 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole',
        visual: { theta: 0, phi: 1.20, distance: 1 },
      },
      {
        id: 'm87-fields', date: '2021', kind: 'POLARIZED RADIO',
        title: 'MAGNETIC FIELDS COME INTO VIEW',
        text: 'Polarized light maps magnetic structure beside the shadow.',
        source: 'https://eventhorizontelescope.org/blog/astronomers-image-magnetic-fields-edge-m87s-black-hole',
        visual: { theta: -.20, phi: 1.15, distance: .90 },
      },
      {
        id: 'm87-persists', date: '2024', kind: 'RADIO RECONSTRUCTION',
        title: 'THE RING PERSISTS',
        text: 'Independent 2018 data retain the ring while its brightest region shifts.',
        source: 'https://eventhorizontelescope.org/M87-one-year-later-proof-of-a-persistent-black-hole-shadow',
        visual: { theta: .12, phi: 1.22, distance: .96 },
      },
    ],
  },
  'pale-blue-dot': {
    summary: 'Earth reduced to a fraction of a pixel across six billion kilometers.',
    defaultMoment: 'pale-earth',
    note: 'The 2020 milestone is a reprocessing of Voyager’s original 1990 data, not a new photograph from the spacecraft.',
    moments: [
      {
        id: 'voyager-launch', date: 'SEPTEMBER 5 · 1977', kind: 'MISSION',
        title: 'VOYAGER LEAVES EARTH',
        text: 'Voyager 1 begins the journey behind the famous image.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-1/',
        visual: { theta: .18, phi: 1.20, distance: .96 },
      },
      {
        id: 'earth-moon-frame', date: 'SEPTEMBER 18 · 1977', kind: 'OBSERVATION',
        title: 'EARTH AND MOON SHARE A FRAME',
        text: 'Voyager photographs both worlds together from a spacecraft for the first time.',
        source: 'https://www.nasa.gov/image-article/voyager-1-takes-first-image-of-earth-moon-system-single-frame/',
        visual: { theta: -.12, phi: 1.20, distance: .94 },
      },
      {
        id: 'pale-earth', date: 'FEBRUARY 14 · 1990', kind: 'OBSERVATION',
        title: 'EARTH BECOMES ONE PIXEL',
        text: 'From six billion kilometers away, home is a point inside scattered sunlight.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-1s-pale-blue-dot/',
        visual: { theta: 0, phi: 1.20, distance: 1 },
      },
      {
        id: 'cameras-off', date: '34 MINUTES LATER', kind: 'MISSION',
        title: 'THE CAMERAS GO DARK',
        text: 'Voyager permanently powers down its imaging system.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-1s-pale-blue-dot/',
        visual: { theta: .10, phi: 1.18, distance: .92 },
      },
      {
        id: 'interstellar', date: 'AUGUST 25 · 2012', kind: 'MISSION',
        title: 'VOYAGER GOES INTERSTELLAR',
        text: 'The spacecraft crosses the heliopause into interstellar space.',
        source: 'https://science.nasa.gov/mission/voyager/interstellar-mission/',
        visual: { theta: .28, phi: 1.14, distance: .88 },
      },
      {
        id: 'pale-reprocessed', date: 'FEBRUARY 14 · 2020', kind: 'REPROCESSING',
        title: 'THE DOT IS REVISITED',
        text: 'Modern processing returns to the original Voyager data.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-1s-pale-blue-dot/',
        visual: { theta: 0, phi: 1.20, distance: 1 },
      },
    ],
  },
};

export const BODY_EXPERIENCES = {
  'SOL:EARTH': {
    summary: 'One world, six turning points.',
    defaultMoment: 'earth-today',
    note: 'Deep-time moments are evidence-based reconstructions or forecasts, not recorded imagery. Only the present-day globe uses current observational maps.',
    moments: [
      {
        id: 'earth-forms', date: 'ABOUT 4.54 BILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'DUST BECOMES A WORLD',
        text: 'Gravity gathers material left from the young Sun’s formation.',
        source: 'https://science.nasa.gov/earth/facts/',
        visual: { theta: .10, phi: 1.18, distance: 1.05 },
      },
      {
        id: 'earth-oxygen', date: 'ABOUT 2.33 BILLION YEARS AGO', kind: 'GEOCHEMICAL EVIDENCE',
        title: 'OXYGEN STAYS',
        text: 'Atmospheric oxygen rises and begins reshaping the planet.',
        source: 'https://astrobiology.nasa.gov/news/honing-in-on-the-great-oxygenation-event/',
        visual: { theta: .85, phi: 1.20, distance: 1 },
      },
      {
        id: 'earth-cambrian', date: 'ABOUT 539 MILLION YEARS AGO', kind: 'FOSSIL EVIDENCE',
        title: 'COMPLEX LIFE DIVERSIFIES',
        text: 'Animal body plans expand across a long Cambrian transition.',
        source: 'https://stratigraphy.org/ICSchart/ChronostratChart2024-12.pdf',
        visual: { theta: 1.55, phi: 1.27, distance: .96 },
      },
      {
        id: 'earth-impact', date: '66 MILLION YEARS AGO', kind: 'GEOLOGICAL EVIDENCE',
        title: 'AN IMPACT RESETS LIFE',
        text: 'The Chicxulub event ends the age of non-avian dinosaurs.',
        source: 'https://science.nasa.gov/earth/earth-observatory/sediment-swirls-off-the-yucatan-149114/',
        visual: { theta: 2.20, phi: 1.12, distance: .92 },
      },
      {
        id: 'earth-today', date: 'TODAY', kind: 'OBSERVATION',
        title: 'THE OCEAN WORLD',
        text: 'Water covers about 71 percent of the surface we call home.',
        source: 'https://science.nasa.gov/earth/facts/',
        visual: { theta: 2.78, phi: 1.30, distance: .88 },
      },
      {
        id: 'earth-red-giant', date: 'ABOUT 5 BILLION YEARS AHEAD', kind: 'MODEL FORECAST',
        title: 'THE SUN BECOMES A GIANT',
        text: 'The expanding Sun may engulf Earth before becoming a white dwarf.',
        source: 'https://science.nasa.gov/sun/facts/',
        visual: { theta: 3.45, phi: 1.15, distance: 1.08 },
      },
    ],
  },
};

export function landmarkExperience(entry){
  const curated = entry && LANDMARK_EXPERIENCES[entry.id];
  if (curated) return curated;
  return {
    summary: entry.subtitle || entry.famousFor || 'A field note from the cosmic archive.',
    defaultMoment: 'archive-observation',
    note: 'This archive entry has one verified observation marker; deeper visual chapters are added only after source and asset review.',
    moments: [{
      id: 'archive-observation',
      date: entry.date || 'ARCHIVE',
      kind: 'OBSERVATION',
      title: entry.famousFor || entry.subtitle || entry.name,
      text: entry.wow || 'Open More for the full field note.',
      visual: { wavelength: 'visible', theta: 0, phi: 1.22, distance: 1 },
    }],
  };
}

export function bodyExperience(systemName, bodyName){
  return BODY_EXPERIENCES[(systemName || '') + ':' + (bodyName || '')] || null;
}
