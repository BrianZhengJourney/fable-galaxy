/* Visual-first field stories. This hand-curated layer sits beside the generated
   landmark catalog: a small featured set, compact summaries and semantic
   milestones that may mix observations, evidence and model forecasts. */

import { NEBULA_PROFILE_IDS } from './nebulaProfiles.js';
import { nebulaModelExperience } from './nebulaExperiences.js';
import { supernovaExperience } from './supernovaExperiences.js';
import { landmarkImage } from './landmarkImages.js';
import { withObservationModelPresentation } from './observationModelPresentations.js';

const MODELED_BLACK_HOLE_IDS = new Set([
  'cygnus-x-1',
  'm87-star',
  'sagittarius-a-star',
  'gw150914',
  'gw150914-first-gravitational-wave',
]);

const LANDMARK_EXPERIENCE_ALIASES = Object.freeze({
  'crab-nebula-sn-1054': 'crab-nebula',
  'gw150914-first-gravitational-wave': 'gw150914',
});

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
    defaultMoment: 'carved',
    note: 'Observation dates, light-travel context and forecasts share this rail. The fly-around depth is a scientific visualization, not a captured 3D image.',
    moments: [
      {
        id: 'carved', date: 'MILLIONS OF YEARS AGO', kind: 'SCIENTIFIC 3D RECONSTRUCTION',
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
    summary: 'A stellar nursery explored through separate fields, epochs and an observation-derived 3D model.',
    defaultMoment: 'carina-ignites',
    note: 'Hubble’s wide Carina mosaic, Webb’s Cosmic Cliffs and the Eta Carinae close-up are separate fields, never an aligned crossfade. Webb’s orbit view uses inferred depth; the Homunculus is a spectroscopy-derived shape model. Reconstructions and the future concept are not observations.',
    moments: [
      {
        id: 'carina-ignites', date: 'ABOUT 3 MILLION YEARS AGO', kind: 'SCIENTIFIC 3D RECONSTRUCTION',
        title: 'MASSIVE STARS IGNITE',
        text: 'A massive young stellar generation carves an expanding bubble of hot gas.',
        source: 'https://science.nasa.gov/asset/hubble/carina-nebula-2/',
        visual: { state: 'formation', theta: .72, phi: 1.17, distance: .92 },
      },
      {
        id: 'carina-found', date: '1752', kind: 'HISTORICAL RECORD',
        title: 'LACAILLE FINDS CARINA',
        text: 'Lacaille records the nebula from the Cape; this modern schematic locates it rather than recreating his view.',
        source: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-92/',
        visual: { state: 'locator', theta: 0, phi: Math.PI / 2, distance: 1 },
      },
      {
        id: 'carina-erupts', date: '1843', kind: 'SCIENTIFIC MODEL',
        title: 'ETA CARINAE ERUPTS',
        text: 'The Great Eruption forms the Homunculus; its 3D shape comes from later spectroscopy, beside a separate 2018 UV image.',
        source: 'https://science.nasa.gov/3d-resources/eta-carinae-homunculus-nebula/',
        visual: { state: 'eta-eruption', theta: 0, phi: Math.PI / 2, distance: 1.02 },
      },
      {
        id: 'carina-hubble', date: '2007', kind: 'OBSERVATION',
        title: 'HUBBLE MAPS THE MAELSTROM',
        text: 'A 50-light-year panorama exposes star birth and intense stellar feedback.',
        source: 'https://science.nasa.gov/missions/hubble/the-carina-nebula-star-birth-in-the-extreme/',
        visual: { state: 'hubble-panorama', theta: 0, phi: Math.PI / 2, distance: 1 },
      },
      {
        id: 'carina-webb', date: '2022', kind: 'INFRARED OBSERVATION',
        title: 'WEBB REVEALS HIDDEN BIRTH',
        text: 'NIRCam and MIRI uncover young stars along the Cosmic Cliffs; orbiting reveals a depth-assisted visualization.',
        source: 'https://science.nasa.gov/missions/webb/nasas-webb-reveals-cosmic-cliffs-glittering-landscape-of-star-birth/',
        visual: { state: 'webb-cliffs', theta: 0, phi: Math.PI / 2, distance: 1 },
      },
      {
        id: 'carina-clears', date: 'FUTURE · NO FIXED DATE', kind: 'CONCEPT / MODEL',
        title: 'THE NURSERY SLOWLY CLEARS',
        text: 'Radiation keeps eroding gas; this sparse future state is illustrative, not a dated prediction.',
        source: 'https://science.nasa.gov/missions/webb/nasas-webb-reveals-cosmic-cliffs-glittering-landscape-of-star-birth/',
        visual: { state: 'future-erosion', theta: .88, phi: 1.12, distance: .92 },
      },
    ],
  },
  'crab-nebula': {
    summary: 'A supernova remnant still expanding around a clock-like neutron star.',
    defaultMoment: 'crab-pulsar',
    note: 'The 1054 flash is a reconstruction and the 1928 back-trace is an inference; the 1731 view uses later Hubble data for context. Webb is a separate infrared wavelength view. NASA’s X-ray-informed model is explanatory, not tomography. The finale registers matched-presentation Hubble observations from different instruments; 2026 is their release year.',
    moments: [
      {
        id: 'crab-1054', date: '1054 CE', kind: 'SCIENTIFIC 3D RECONSTRUCTION',
        title: 'A GUEST STAR BLAZES',
        text: 'Astronomers record the guest star whose remnant becomes the Crab Nebula. The flash shown here reconstructs the supernova light that reached Earth in 1054.',
        source: 'https://www.nasa.gov/news-release/nasa-satellites-find-high-energy-surprises-in-constant-crab-nebula/',
        visual: { state: 'crab.supernova-flash', theta: .28, phi: 1.18, distance: .96 },
      },
      {
        id: 'crab-found', date: '1731', kind: 'OBSERVATION',
        title: 'THE NEBULA IS FOUND',
        text: 'John Bevis discovers the faint remnant through a telescope. Later Hubble imagery supplies spatial context here; it is not a picture from 1731.',
        source: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/',
        visual: { state: 'crab.optical-discovery', theta: 0, phi: 1.20, distance: 1 },
      },
      {
        id: 'crab-linked', date: '1928', kind: 'SCIENTIFIC INFERENCE',
        title: 'HUBBLE CONNECTS THE RECORDS',
        text: 'Edwin Hubble links the nebula to the guest star seen in 1054. The inward filament ghosts visualize an expansion back-trace, not recovered 1928 imagery.',
        source: 'https://science.nasa.gov/asset/hubble/crab-nebula/',
        visual: { state: 'crab.expansion-backtrace', theta: -.18, phi: 1.22, distance: .95 },
      },
      {
        id: 'crab-pulsar', date: '1968', kind: 'SCIENTIFIC 3D MODEL',
        title: 'THE PULSAR STARTS TICKING',
        text: 'Radio pulses reveal the neutron star powering the nebula. NASA’s X-ray-informed model explains its torus and jets; it is a scientific representation, not 3D tomography.',
        source: 'https://science.nasa.gov/missions/hubble/hubble-captures-the-beating-heart-of-the-crab-nebula/',
        visual: { state: 'crab.pulsar-engine', theta: .08, phi: 1.18, distance: .86 },
      },
      {
        id: 'crab-webb', date: '2023', kind: 'INFRARED OBSERVATION',
        title: 'WEBB SEES SYNCHROTRON SMOKE',
        text: 'Webb maps dust and synchrotron structure in infrared. This is a wavelength view, not an expansion epoch or natural-visible color.',
        source: 'https://science.nasa.gov/missions/webb/the-crab-nebula-seen-in-new-light-by-nasas-webb/',
        visual: { state: 'crab.webb-infrared', theta: -.10, phi: 1.18, distance: .90 },
      },
      {
        id: 'crab-hubble-expansion', date: '1999/2000 → 2024 · RELEASED 2026', kind: 'REGISTERED COMPARISON',
        title: 'HUBBLE MEASURES EXPANSION',
        text: 'Matched-presentation frames are registered to compare real outward filament motion. WFPC2 and WFC3 are different instruments, so not every appearance change is physical.',
        source: 'https://science.nasa.gov/missions/hubble/nasas-hubble-revisits-crab-nebula-to-track-25-years-of-expansion/',
        visual: { state: 'crab.hubble-expansion-1999-2024', theta: 0, phi: 1.20, distance: 1 },
      },
    ],
  },
  'cygnus-x-1': {
    summary: 'The X-ray source that became the first widely accepted stellar black hole.',
    defaultMoment: 'cygnus-model',
    note: 'The 3D binary is a scale-compressed, physically informed visualization. The archive panel is a later Chandra X-ray observation, not an image from the 1964 discovery flight; the black hole itself remains unseen.',
    moments: [
      {
        id: 'cygnus-model', date: 'MODEL · PRESENT SYSTEM', kind: 'SCIENTIFIC VISUALIZATION',
        title: 'A BLUE SUPERGIANT FEEDS THE DARK OBJECT',
        text: 'The persistent 3D view explains the companion, focused stellar wind, accretion flow and compact black-hole shadow at deliberately compressed scales.',
        source: 'https://chandra.harvard.edu/photo/2011/cygx1/',
        visual: { state: 'model', theta: 0, phi: Math.PI / 2, distance: 1 },
      },
      {
        id: 'cygnus-discovered', date: '1964', kind: 'X-RAY DISCOVERY',
        title: 'A ROCKET FINDS CYGNUS X-1',
        text: 'A sounding-rocket survey discovers an unusually bright source of cosmic X-rays. No black hole image exists from this flight.',
        source: 'https://www.chandra.harvard.edu/photo/2009/cygx1/',
        visual: { state: 'history', theta: -.22, phi: 1.34, distance: .98 },
      },
      {
        id: 'cygnus-identified', date: 'EARLY 1970s', kind: 'MULTI-WAVELENGTH EVIDENCE',
        title: 'THE INVISIBLE COMPANION IS TOO MASSIVE',
        text: 'X-ray, optical and radio work ties the source to HDE 226868 and an unseen companion whose inferred mass makes a black hole the compelling explanation.',
        source: 'https://www.chandra.harvard.edu/photo/2009/cygx1/',
        visual: { state: 'history', theta: .22, phi: 1.27, distance: .94 },
      },
      {
        id: 'cygnus-bet', date: '1974 → 1990', kind: 'SCIENCE HISTORY',
        title: 'HAWKING CONCEDES THE BET',
        text: 'Stephen Hawking bets against the black-hole interpretation, then concedes as the observational case becomes overwhelming.',
        source: 'https://chandra.harvard.edu/photo/2011/cygx1/',
        visual: { state: 'history', theta: -.08, phi: 1.22, distance: 1.02 },
      },
      {
        id: 'cygnus-chandra', date: '2001–2003 DATA · RELEASED 2009', kind: 'X-RAY OBSERVATION',
        title: 'CHANDRA MAPS THE ACTIVE SOURCE',
        text: 'The real archive frame shows X-ray emission from hot gas in the binary. It is scientific intensity color, not a photograph of the event horizon.',
        source: 'https://www.chandra.harvard.edu/photo/2009/cygx1/',
        visual: { state: 'observation', observation: true, theta: 0, phi: Math.PI / 2, distance: 1.10 },
      },
    ],
  },
  'm87-star': {
    summary: 'A galaxy-scale jet, a dark dynamical engine and the first reconstructed black-hole shadow.',
    defaultMoment: 'm87-model',
    note: 'The 3D core and jet remain a physically informed visualization at compressed scale. The archive panel shows EHT radio intensity in scientific color; the separate FIRST BLACK HOLE IMAGE milestone contains the full observation sequence.',
    moments: [
      {
        id: 'm87-model', date: 'MODEL · PRESENT SYSTEM', kind: 'SCIENTIFIC VISUALIZATION',
        title: 'RELATIVISTIC LIGHT SURROUNDS A JET ENGINE',
        text: 'The persistent 3D view connects a lensed black-hole shadow to the polar outflow, without treating the EHT reconstruction as captured 3D shape.',
        source: 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole',
        visual: { state: 'model', theta: 0, phi: Math.PI / 2, distance: 1 },
      },
      {
        id: 'm87-jet-history', date: '1918', kind: 'HISTORICAL OBSERVATION',
        title: 'A CURIOUS STRAIGHT RAY',
        text: 'Heber Curtis describes M87’s jet decades before astronomers understand the compact engine driving it.',
        source: 'https://www.nasa.gov/missions/spitzer/the-giant-galaxy-around-the-giant-black-hole/',
        visual: { state: 'history', theta: -.20, phi: 1.25, distance: 1.04 },
      },
      {
        id: 'm87-dark-engine-history', date: '1978', kind: 'DYNAMICAL EVIDENCE',
        title: 'AN EARLY DARK-ENGINE CLAIM',
        text: 'An early ground-based dynamical claim points to an enormous central mass; later studies challenge it before Hubble-era evidence restores the case.',
        source: 'https://science.nasa.gov/missions/hubble/nasas-hubble-space-telescope-probes-the-compact-nucleus-of-galaxy-m87/',
        visual: { state: 'history', theta: .18, phi: 1.20, distance: .98 },
      },
      {
        id: 'm87-earth-array', date: 'APRIL 2017', kind: 'RADIO OBSERVATION',
        title: 'EARTH BECOMES ONE TELESCOPE',
        text: 'Synchronized observatories record 1.3-millimeter signals so interferometry can synthesize an Earth-sized aperture.',
        source: 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole',
        visual: { state: 'history', theta: -.12, phi: 1.16, distance: 1.06 },
      },
      {
        id: 'm87-eht-image', date: '2017 DATA · RELEASED APRIL 10 · 2019', kind: 'RADIO RECONSTRUCTION',
        title: 'THE FIRST BLACK-HOLE SHADOW IMAGE',
        text: 'The real EHT product appears beside the still-visible model. Orange encodes reconstructed radio intensity, not the source’s visible color.',
        source: 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole',
        visual: { state: 'observation', observation: true, theta: 0, phi: Math.PI / 2, distance: 1.12 },
      },
    ],
  },
  'sagittarius-a-star': {
    summary: 'From a compact radio source to stellar-orbit proof and the first image of our own black hole.',
    defaultMoment: 'sgr-model',
    note: 'The 3D lensing, accretion flow and S-star scene is a physically informed visualization. The EHT panel is an average reconstructed from variable 2017 radio data, not a visible-light photograph or recovered image of earlier discoveries.',
    moments: [
      {
        id: 'sgr-model', date: 'MODEL · PRESENT SYSTEM', kind: 'SCIENTIFIC VISUALIZATION',
        title: 'S-STARS ORBIT A FOUR-MILLION-SUN SHADOW',
        text: 'The persistent 3D view links the quiescent relativistic flow to the eccentric stellar orbits that reveal the central mass.',
        source: 'https://eventhorizontelescope.org/blog/astronomers-reveal-first-image-black-hole-heart-our-galaxy',
        visual: { state: 'model', theta: 0, phi: Math.PI / 2, distance: 1 },
      },
      {
        id: 'sgr-radio-source', date: '1974', kind: 'RADIO DISCOVERY',
        title: 'A COMPACT SOURCE MARKS THE GALACTIC CENTER',
        text: 'Radio observations isolate Sagittarius A* as a remarkably compact source near the true center of the Milky Way.',
        source: 'https://heasarc.gsfc.nasa.gov/docs/objects/galaxies/sag-a_star.html',
        visual: { state: 'history', theta: -.15, phi: 1.25, distance: 1.04 },
      },
      {
        id: 'sgr-s2-orbit', date: '1992 → 2002', kind: 'ORBITAL EVIDENCE',
        title: 'S2 TRACES THE INVISIBLE MASS',
        text: 'A decade of infrared positions reveals S2 on a tight ellipse around Sgr A*, excluding extended clusters and exposing a Solar-System-scale dark mass.',
        source: 'https://www.eso.org/public/news/eso0226/',
        visual: { state: 'history', theta: .18, phi: 1.18, distance: .94 },
      },
      {
        id: 'sgr-nobel', date: '2020', kind: 'NOBEL-RECOGNIZED DISCOVERY',
        title: 'STELLAR ORBITS ESTABLISH THE BLACK HOLE',
        text: 'The Nobel Prize recognizes the discovery of a supermassive compact object at the center of our galaxy through precision stellar dynamics.',
        source: 'https://www.nobelprize.org/prizes/physics/2020/popular-information/',
        visual: { state: 'history', theta: -.08, phi: 1.20, distance: 1.02 },
      },
      {
        id: 'sgr-eht-image', date: '2017 DATA · RELEASED MAY 12 · 2022', kind: 'RADIO RECONSTRUCTION',
        title: 'EHT IMAGES OUR GALACTIC BLACK HOLE',
        text: 'The real EHT reconstruction appears beside the still-visible model. Thousands of data-fitting images were combined to reveal the persistent ring and shadow.',
        source: 'https://eventhorizontelescope.org/blog/astronomers-reveal-first-image-black-hole-heart-our-galaxy',
        visual: { state: 'observation', observation: true, theta: 0, phi: Math.PI / 2, distance: 1.14 },
      },
    ],
  },
  'gw150914': {
    summary: 'A century-old prediction becomes a measured chirp from two merging black holes.',
    defaultMoment: 'gw150914-model',
    note: 'The orbiting black holes and blue strain surface are a physically informed visualization; GW150914 had no detected light counterpart. The opening sidecar is official LIGO discovery artwork, while the detection chapter uses the real detector-strain figure.',
    moments: [
      {
        id: 'gw150914-model', date: 'MODEL · 1.3 BILLION YEARS AGO', kind: 'SCIENTIFIC VISUALIZATION',
        title: 'TWO VACUUM BLACK HOLES INSPIRAL',
        text: 'The persistent 3D model shows a single-pass inspiral, merger and remnant beside LIGO’s official discovery artwork. Neither depicts detected visible light.',
        source: 'https://ligo.org/detections/gw150914/',
        visual: { state: 'model', evidence: 'illustration', theta: .38, phi: 1.05, distance: 1 },
      },
      {
        id: 'gw150914-predicted', date: '1916', kind: 'THEORY',
        title: 'GENERAL RELATIVITY PREDICTS THE WAVES',
        text: 'Einstein’s theory allows disturbances in spacetime to propagate outward as gravitational waves, though their direct measurement remains decades away.',
        source: 'https://ligo.org/detections/gw150914/',
        visual: { state: 'history', evidence: 'illustration', theta: -.22, phi: 1.12, distance: 1.02 },
      },
      {
        id: 'gw150914-detection', date: 'SEPTEMBER 14 · 2015', kind: 'GRAVITATIONAL-WAVE OBSERVATION',
        title: 'BOTH LIGO DETECTORS HEAR THE CHIRP',
        text: 'The real strain comparison appears beside the model: Livingston records the signal about seven milliseconds before Hanford.',
        source: 'https://ligo.org/detections/gw150914/',
        visual: { state: 'observation', observation: true, evidence: 'signal', theta: .28, phi: 1.08, distance: 1.16 },
      },
      {
        id: 'gw150914-announced', date: 'FEBRUARY 11 · 2016', kind: 'DISCOVERY ANNOUNCEMENT',
        title: 'THE FIRST DIRECT DETECTION IS ANNOUNCED',
        text: 'LIGO and Virgo announce gravitational waves from colliding black holes; the official discovery artwork returns beside the model.',
        source: 'https://ligo.org/detections/gw150914/',
        visual: { state: 'observation', observation: true, evidence: 'illustration', theta: .16, phi: 1.04, distance: 1.16 },
      },
      {
        id: 'gw150914-nobel', date: '2017', kind: 'NOBEL PRIZE',
        title: 'A NEW WAY TO OBSERVE THE UNIVERSE',
        text: 'The Nobel Prize recognizes decisive contributions to LIGO and the observation that opened gravitational-wave astronomy.',
        source: 'https://www.nobelprize.org/prizes/physics/2017/press-release/',
        visual: { state: 'history', evidence: 'illustration', theta: -.12, phi: 1.10, distance: 1.04 },
      },
    ],
  },
  'm87-black-hole-image': {
    summary: 'A relativistic black-hole model beside the observations that revealed its shadow.',
    defaultMoment: 'm87-model',
    note: 'The shared 3D core and jet are a scientific visualization and remain the hero. The six evidence chapters are flat sourced observations or explanatory instrument views. EHT rings reconstruct 1.3-millimeter radio measurements; they are not visible-light photographs.',
    moments: [
      {
        id: 'm87-model', date: 'MODEL · PRESENT SYSTEM', kind: 'SCIENTIFIC VISUALIZATION',
        title: 'A RELATIVISTIC CORE POWERS THE JET',
        text: 'The persistent 3D view combines an opaque horizon, Doppler-brightened accretion flow, analytic lensing and a qualitative bipolar jet. Scales, colors and flow speed are explanatory.',
        source: 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole',
        visual: { state: 'model', theta: -.12, phi: 1.24, distance: .96 },
      },
      {
        id: 'm87-jet', date: '1918 · SHOWN WITH 2024 HUBBLE CONTEXT', kind: 'HISTORICAL OBSERVATION',
        title: 'A JET IS DESCRIBED',
        text: 'Heber Curtis describes M87’s curious straight ray. A later Hubble image locates that observed jet; it is context, not a 1918 exposure.',
        source: 'https://www.nasa.gov/missions/spitzer/the-giant-galaxy-around-the-giant-black-hole/',
        visual: { state: 'm87-jet-observed', theta: .16, phi: 1.20, distance: .98 },
      },
      {
        id: 'm87-dark-engine', date: '1978 · SHOWN WITH 2021 MULTISCALE CONTEXT', kind: 'DYNAMICAL EVIDENCE',
        title: 'AN EARLY DARK-ENGINE CLAIM',
        text: 'A 1978 ground-based dynamical claim points to a massive compact object, though later studies initially fail to confirm it. The Hubble, ALMA, VLBA, and EHT stack is later cross-scale context, not 1978 imagery.',
        source: 'https://science.nasa.gov/missions/hubble/nasas-hubble-space-telescope-probes-the-compact-nucleus-of-galaxy-m87/',
        visual: { state: 'm87-core-multiscale', theta: -.12, phi: 1.22, distance: .92 },
      },
      {
        id: 'm87-array', date: 'APRIL 2017', kind: 'RADIO OBSERVATION',
        title: 'EARTH BECOMES ONE TELESCOPE',
        text: 'Eight synchronized observatories record 1.3-millimeter radio signals from M87*. The array view explains interferometry; no single camera made the image.',
        source: 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole',
        visual: { state: 'eht-array-2017', theta: .25, phi: 1.18, distance: 1 },
      },
      {
        id: 'm87-shadow', date: 'APRIL 2017 DATA · RELEASED APRIL 10 · 2019', kind: 'RADIO RECONSTRUCTION',
        title: 'THE FIRST RING RECONSTRUCTION',
        text: 'EHT reconstructs total radio intensity around the black hole shadow. Orange is a scientific radio color map, not the source’s visible color.',
        source: 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole',
        visual: { state: 'eht-total-intensity-2017', theta: 0, phi: 1.20, distance: 1 },
      },
      {
        id: 'm87-fields', date: 'APRIL 2017 DATA · RELEASED MARCH 24 · 2021', kind: 'POLARIZED RADIO',
        title: 'POLARIZATION REVEALS STRUCTURE',
        text: 'Polarized 2017 radio data add segments encoding polarization orientation related to magnetic structure. They are not traced magnetic-field lines.',
        source: 'https://eventhorizontelescope.org/blog/astronomers-image-magnetic-fields-edge-m87s-black-hole',
        visual: { state: 'eht-polarization-2017', theta: -.20, phi: 1.15, distance: .90 },
      },
      {
        id: 'm87-persists', date: 'APRIL 2018 DATA · RELEASED JANUARY 18 · 2024', kind: 'RADIO RECONSTRUCTION',
        title: 'THE RING PERSISTS',
        text: 'Official EHT 2018 FITS data reconstruct a similar-diameter ring while its brightest region shifts. The comparison is not an animation or visible-light sequence.',
        source: 'https://eventhorizontelescope.org/M87-one-year-later-proof-of-a-persistent-black-hole-shadow',
        visual: { state: 'eht-compare-2017-2018', theta: .12, phi: 1.22, distance: .96 },
      },
    ],
  },
  'pale-blue-dot': {
    summary: 'Earth reduced to a fraction of a pixel across six billion kilometers.',
    defaultMoment: 'pale-earth',
    note: 'Earth spans about 0.12 camera pixel. The 2020 view is a false-color reprocessing of the same 1990 frames with no added resolved detail; rays and background specks are camera scatter and magnification artifacts, not stars.',
    moments: [
      {
        id: 'voyager-launch', date: 'SEPTEMBER 5 · 1977', kind: 'MISSION',
        title: 'VOYAGER LEAVES EARTH',
        text: 'Voyager 1 begins the journey behind the famous image. NASA’s spacecraft model is an explanatory visualization, not engineering CAD.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-1/',
        visual: { state: 'voyager-spacecraft', theta: .18, phi: 1.20, distance: .96 },
      },
      {
        id: 'earth-moon-frame', date: 'SEPTEMBER 18 · 1977', kind: 'OBSERVATION',
        title: 'EARTH AND MOON SHARE A FRAME',
        text: 'Voyager makes the first spacecraft view of both worlds in one frame. Three filtered images form the composite, and the Moon was brightened relative to Earth.',
        source: 'https://www.nasa.gov/image-article/voyager-1-takes-first-image-of-earth-moon-system-single-frame/',
        visual: { state: 'earth-moon-1977', theta: -.12, phi: 1.20, distance: .94 },
      },
      {
        id: 'pale-earth', date: 'FEBRUARY 14 · 1990', kind: 'OBSERVATION',
        title: 'EARTH SHRINKS TO 0.12 OF A PIXEL',
        text: 'From six billion kilometers away, Earth spans about 0.12 Voyager camera pixel. The sunbeam is internal scatter; enlarged streaks and specks are artifacts, not a star field.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-1s-pale-blue-dot/',
        visual: { state: 'pbd-original-1990', theta: 0, phi: 1.20, distance: 1 },
      },
      {
        id: 'cameras-off', date: 'FEBRUARY 14 · 1990 · 34 MINUTES LATER', kind: 'MISSION',
        title: 'THE CAMERAS GO DARK',
        text: 'Voyager permanently powers down its imaging system to conserve power. The darkening display marks a mission event, not another exposure.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-1s-pale-blue-dot/',
        visual: { state: 'voyager-camera-shutdown', theta: .10, phi: 1.18, distance: .92 },
      },
      {
        id: 'interstellar', date: 'AUGUST 25 · 2012', kind: 'MISSION',
        title: 'VOYAGER CROSSES THE HELIOPAUSE',
        text: 'Voyager 1 crosses the heliopause at about 122 AU along its path. That boundary is dynamic and direction-dependent, not a universal sphere at one fixed radius.',
        source: 'https://science.nasa.gov/mission/voyager/interstellar-mission/',
        visual: { state: 'voyager-heliopause-2012', theta: .28, phi: 1.14, distance: .88 },
      },
      {
        id: 'pale-reprocessed', date: '1990 DATA · PUBLISHED FEBRUARY 12 · 2020', kind: 'REPROCESSING',
        title: 'THE DOT IS REVISITED',
        text: 'A false-color revisit remaps the same 1990 green, blue, and violet frames with modern processing. It adds no new observation or resolved spatial detail.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-1s-pale-blue-dot/',
        visual: {
          state: 'pbd-compare-1990-2020', observation: true,
          theta: 0, phi: 1.20, distance: 1,
        },
      },
    ],
  },
};

export const BODY_EXPERIENCES = {
  'SOL:MERCURY': {
    summary: 'From an iron-rich beginning to the first two-orbiter survey.',
    defaultMoment: 'mercury-today',
    note: 'Formation is a reconstruction. Polar ice is inferred from multiple datasets; BepiColombo dates remain scheduled mission dates.',
    moments: [
      {
        id: 'mercury-forms', date: 'ABOUT 4.5 BILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'THE INNERMOST WORLD FORMS',
        text: 'Gravity gathers rock and metal into a small planet with an unusually large core.',
        source: 'https://science.nasa.gov/mercury/facts/',
        visual: { theta: .18, phi: 1.16, distance: 1.06 },
      },
      {
        id: 'mercury-ancient', date: 'KNOWN SINCE ANTIQUITY', kind: 'HISTORICAL OBSERVATION',
        title: 'A PLANET HIDES IN TWILIGHT',
        text: 'Sky watchers recognize the fast-moving world without a telescope.',
        source: 'https://science.nasa.gov/mercury/facts/',
        visual: { theta: .78, phi: 1.24, distance: .98 },
      },
      {
        id: 'mercury-mariner', date: 'MARCH 29 · 1974', kind: 'SPACECRAFT FLYBY',
        title: 'MARINER 10 SEES THE CRATERS',
        text: 'Humanity’s first Mercury flyby reveals a scarred surface and a magnetic field.',
        source: 'https://science.nasa.gov/mission/mariner-10/',
        visual: { theta: 1.42, phi: 1.18, distance: .92 },
      },
      {
        id: 'mercury-messenger', date: '2011–2015', kind: 'ORBITAL MISSION',
        title: 'MESSENGER MAPS A WHOLE WORLD',
        text: 'The first Mercury orbiter maps its chemistry, geology, gravity, and magnetism.',
        source: 'https://science.nasa.gov/mission/messenger/',
        visual: { theta: 2.04, phi: 1.12, distance: .88 },
      },
      {
        id: 'mercury-today', date: 'TODAY', kind: 'PRESENT-DAY EVIDENCE',
        title: 'ICE SURVIVES BESIDE THE SUN',
        text: 'Water ice persists inside permanently shadowed polar craters.',
        source: 'https://science.nasa.gov/mission/messenger/',
        visual: { theta: 2.62, phi: .72, distance: .84 },
      },
      {
        id: 'mercury-bepi', date: 'NOVEMBER 21 · 2026', kind: 'PLANNED ORBIT INSERTION',
        title: 'TWO ORBITERS ARRIVE TOGETHER',
        text: 'BepiColombo is scheduled to place ESA and JAXA spacecraft around Mercury.',
        source: 'https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/BepiColombo_factsheet',
        visual: { theta: 3.22, phi: 1.20, distance: 1.04 },
      },
    ],
  },

  'SOL:VENUS': {
    summary: 'A near-Earth twin transformed into a cloud-wrapped furnace.',
    defaultMoment: 'venus-today',
    note: 'Ancient surface conditions remain under investigation. DAVINCI has a tentative launch date, not a guaranteed event.',
    moments: [
      {
        id: 'venus-forms', date: 'ABOUT 4.5 BILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'EARTH GAINS A NEAR-TWIN',
        text: 'Rock and metal gather into a planet almost the same size as Earth.',
        source: 'https://science.nasa.gov/venus/venus-facts/',
        visual: { theta: .12, phi: 1.16, distance: 1.06 },
      },
      {
        id: 'venus-phases', date: '1610', kind: 'TELESCOPIC OBSERVATION',
        title: 'VENUS CHANGES PHASE',
        text: 'Galileo’s observations show Venus circling the Sun, not Earth.',
        source: 'https://science.nasa.gov/resource/galileos-phases-of-venus-and-other-planets/',
        visual: { theta: .72, phi: 1.25, distance: 1 },
      },
      {
        id: 'venus-venera', date: 'DECEMBER 15 · 1970', kind: 'SURFACE MISSION',
        title: 'VENERA 7 SPEAKS FROM THE SURFACE',
        text: 'The Soviet lander makes the first transmission from another planet’s surface.',
        source: 'https://science.nasa.gov/deep-space-exploration/',
        visual: { theta: 1.34, phi: 1.31, distance: .90 },
      },
      {
        id: 'venus-magellan', date: '1990–1994', kind: 'RADAR MAPPING',
        title: 'MAGELLAN LIFTS THE CLOUDS',
        text: 'Radar maps 98 percent of the hidden volcanic surface.',
        source: 'https://science.nasa.gov/mission/magellan/',
        visual: { theta: 1.92, phi: 1.18, distance: .88 },
      },
      {
        id: 'venus-today', date: 'TODAY', kind: 'PRESENT-DAY OBSERVATION',
        title: 'THE RUNAWAY GREENHOUSE',
        text: 'Dense carbon dioxide and sulfuric-acid clouds hold the surface near 465°C.',
        source: 'https://science.nasa.gov/venus/venus-facts/',
        visual: { theta: 2.62, phi: 1.26, distance: .86 },
      },
      {
        id: 'venus-davinci', date: 'TENTATIVE · 2030', kind: 'PLANNED MISSION',
        title: 'DAVINCI DESCENDS',
        text: 'A probe is planned to sample the atmosphere and image Alpha Regio below the clouds.',
        source: 'https://science.nasa.gov/mission/davinci/',
        visual: { theta: 3.24, phi: 1.12, distance: 1.04 },
      },
    ],
  },

  'SOL:EARTH': {
    summary: 'A changing ocean world whose continents and night side transform through time.',
    defaultMoment: 'earth-today',
    note: 'Deep-time chapters change the globe itself while the live orbital date remains separate. Rodinia and Pliocene coastlines are scientific reconstructions, not exact photographs.',
    moments: [
      {
        id: 'earth-rodinia', date: 'ABOUT 1 BILLION YEARS AGO', kind: 'SCHEMATIC RECONSTRUCTION',
        title: 'RODINIA GATHERS THE LAND',
        text: 'Published full-plate models bring much of Earth’s crust together. This hand-built schematic is inspired by them—not derived from their data—and has no artificial night lights.',
        source: 'https://doi.org/10.1016/j.earscirev.2020.103477',
        visual: { epoch: '1000ma', theta: .10, phi: 1.18, distance: 1.02 },
      },
      {
        id: 'earth-pliocene', date: 'ABOUT 5 MILLION YEARS AGO', kind: 'SCHEMATIC RECONSTRUCTION',
        title: 'A NEARLY MODERN, UNLIT WORLD',
        text: 'This hand-built PaleoDEM-inspired schematic keeps continents broadly familiar while showing changed coastlines—and no human city lights anywhere.',
        source: 'https://doi.org/10.5281/zenodo.5460860',
        visual: { epoch: '5ma', theta: .72, phi: 1.22, distance: .98 },
      },
      {
        id: 'earth-earthrise', date: 'DECEMBER 24 · 1968', kind: 'SPACECRAFT OBSERVATION',
        title: 'EARTH RISES ABOVE THE MOON',
        text: 'Apollo 8 returns the first color view of Earth rising over another world.',
        source: 'https://www.nasa.gov/mission/apollo-8/',
        visual: { epoch: 'present', theta: 1.42, phi: 1.12, distance: .94 },
      },
      {
        id: 'earth-blue-marble', date: 'DECEMBER 7 · 1972', kind: 'SPACECRAFT OBSERVATION',
        title: 'A WHOLE EARTH FILLS THE FRAME',
        text: 'Apollo 17 records the fully illuminated globe on its way to the Moon.',
        source: 'https://www.nasa.gov/image-article/blue-marble-image-of-earth-from-apollo-17/',
        visual: { epoch: 'present', theta: 2.04, phi: 1.18, distance: .90 },
      },
      {
        id: 'earth-night-lights', date: '2012 → TODAY', kind: 'SATELLITE COMPOSITE',
        title: 'HUMAN LIGHT TRACES THE LAND',
        text: 'Night-light satellites map the modern human footprint. This emissive layer disappears in both ancient model states.',
        source: 'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/',
        visual: { epoch: 'present', theta: 2.62, phi: 1.30, distance: .86 },
      },
      {
        id: 'earth-today', date: 'TODAY', kind: 'PRESENT-DAY OBSERVATION',
        title: 'THE OCEAN WORLD',
        text: 'Water covers about 71 percent of the surface we call home.',
        source: 'https://science.nasa.gov/earth/facts/',
        visual: { epoch: 'present', theta: 3.22, phi: 1.26, distance: .88 },
      },
    ],
  },

  'SOL:MARS': {
    summary: 'A once-wet world explored first from above, then wheel-track by wheel-track.',
    defaultMoment: 'mars-perseverance',
    note: 'Ancient-water scenes are reconstructions. Rosalind Franklin’s launch and landing dates remain planned.',
    moments: [
      {
        id: 'mars-forms', date: 'ABOUT 4.5 BILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'THE RED PLANET FORMS',
        text: 'Rock and metal assemble into a smaller neighbor of Earth.',
        source: 'https://science.nasa.gov/mars/facts/',
        visual: { theta: .10, phi: 1.14, distance: 1.06 },
      },
      {
        id: 'mars-water', date: 'MORE THAN 3.5 BILLION YEARS AGO', kind: 'GEOLOGICAL EVIDENCE',
        title: 'RIVERS FEED JEZERO',
        text: 'Channels carry water and sediment into a long-vanished crater lake.',
        source: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
        visual: { theta: .78, phi: 1.28, distance: .94 },
      },
      {
        id: 'mars-mariner', date: 'JULY 14 · 1965', kind: 'SPACECRAFT FLYBY',
        title: 'MARINER 4 SENDS THE FIRST CLOSE-UP',
        text: 'Twenty-one images replace imagined canals with a cratered landscape.',
        source: 'https://science.nasa.gov/mission/mariner-4/',
        visual: { theta: 1.45, phi: 1.20, distance: 1 },
      },
      {
        id: 'mars-viking', date: 'JULY 20 · 1976', kind: 'SURFACE MISSION',
        title: 'VIKING 1 LANDS',
        text: 'A long-lived laboratory begins sustained science from the Martian surface.',
        source: 'https://science.nasa.gov/mission/viking-1/',
        visual: { theta: 2.10, phi: 1.28, distance: .88 },
      },
      {
        id: 'mars-perseverance', date: '2021 → TODAY', kind: 'ACTIVE ROVER',
        title: 'PERSEVERANCE READS THE ROCKS',
        text: 'The rover explores Jezero and caches samples while seeking signs of ancient life.',
        source: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
        visual: { theta: 2.82, phi: 1.16, distance: .84 },
      },
      {
        id: 'mars-rosalind', date: 'LATE 2028 → 2030', kind: 'PLANNED MISSION',
        title: 'ROSALIND FRANKLIN DRILLS DEEPER',
        text: 'ESA’s rover is planned to reach protected subsurface material in its search for biosignatures.',
        source: 'https://science.nasa.gov/blogs/mars-rosa/2026/04/16/nasa-begins-implementation-for-esas-rosalind-franklin-mission-to-mars/',
        visual: { theta: 3.48, phi: 1.10, distance: 1.05 },
      },
    ],
  },

  'SOL:JUPITER': {
    summary: 'The oldest planet, explored from Galileo’s telescope to a polar orbiter.',
    defaultMoment: 'jupiter-juno',
    note: 'Europa Clipper explores the wider Jovian system. Its April 2030 arrival is scheduled, not guaranteed.',
    moments: [
      {
        id: 'jupiter-forms', date: 'ABOUT 4.6 BILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'THE FIRST PLANET TAKES SHAPE',
        text: 'Jupiter forms early and captures most of the material left after the Sun.',
        source: 'https://science.nasa.gov/jupiter/jupiter-facts/',
        visual: { theta: .15, phi: 1.16, distance: 1.08 },
      },
      {
        id: 'jupiter-moons', date: 'JANUARY 1610', kind: 'TELESCOPIC OBSERVATION',
        title: 'FOUR MOONS BREAK THE OLD COSMOS',
        text: 'Galileo watches worlds orbit Jupiter—the first moons known beyond Earth.',
        source: 'https://science.nasa.gov/mission/juno/',
        visual: { theta: .72, phi: 1.26, distance: 1.04 },
      },
      {
        id: 'jupiter-pioneer', date: 'DECEMBER 3 · 1973', kind: 'SPACECRAFT FLYBY',
        title: 'PIONEER 10 CROSSES THE RADIATION',
        text: 'The first Jupiter encounter returns close views and measures its intense environment.',
        source: 'https://science.nasa.gov/mission/pioneer-10/',
        visual: { theta: 1.18, phi: 1.18, distance: .96 },
      },
      {
        id: 'jupiter-galileo', date: 'DECEMBER 7 · 1995', kind: 'ATMOSPHERIC PROBE',
        title: 'A PROBE ENTERS THE CLOUDS',
        text: 'Galileo makes the first direct measurements inside a giant planet.',
        source: 'https://science.nasa.gov/solar-system/resources/faq/what-was-the-galileo-probe-and-what-did-it-do-at-jupiter/',
        visual: { theta: 1.72, phi: 1.24, distance: .88 },
      },
      {
        id: 'jupiter-juno', date: '2016 → TODAY', kind: 'ACTIVE ORBITER',
        title: 'JUNO LOOKS BELOW THE CLOUDS',
        text: 'Polar orbits reveal deep weather, cyclones, gravity, and a complex magnetic field.',
        source: 'https://science.nasa.gov/mission/juno/',
        visual: { theta: 2.26, phi: .62, distance: .84 },
      },
      {
        id: 'jupiter-clipper', date: 'APRIL · 2030', kind: 'PLANNED ARRIVAL',
        title: 'EUROPA CLIPPER REACHES JUPITER',
        text: 'The Jupiter-orbiting spacecraft is scheduled to begin a campaign of Europa flybys.',
        source: 'https://science.nasa.gov/mission/europa-clipper/',
        visual: { theta: 3.02, phi: 1.12, distance: 1.08 },
      },
    ],
  },

  'SOL:SATURN': {
    summary: 'A ringed system transformed by flybys, an orbiter, and a future flying lander.',
    defaultMoment: 'saturn-today',
    note: 'Dragonfly targets Titan, so its node represents the Saturn system rather than Saturn’s atmosphere.',
    moments: [
      {
        id: 'saturn-forms', date: 'ABOUT 4.5 BILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'A SECOND GAS GIANT FORMS',
        text: 'Hydrogen and helium gather into Saturn in the young outer solar system.',
        source: 'https://science.nasa.gov/saturn/facts/',
        visual: { theta: .16, phi: 1.08, distance: 1.08 },
      },
      {
        id: 'saturn-galileo', date: '1610', kind: 'TELESCOPIC OBSERVATION',
        title: 'GALILEO SEES “HANDLES”',
        text: 'A small telescope cannot resolve the rings, but reveals Saturn’s strange outline.',
        source: 'https://science.nasa.gov/saturn/facts/',
        visual: { theta: .76, phi: 1.02, distance: 1 },
      },
      {
        id: 'saturn-pioneer', date: 'SEPTEMBER 1 · 1979', kind: 'SPACECRAFT FLYBY',
        title: 'PIONEER 11 GOES FIRST',
        text: 'The first Saturn flyby discovers the F ring and measures its magnetic environment.',
        source: 'https://science.nasa.gov/mission/pioneer-11/',
        visual: { theta: 1.38, phi: .98, distance: .94 },
      },
      {
        id: 'saturn-cassini', date: '2004–2017', kind: 'ORBITAL MISSION',
        title: 'CASSINI LIVES AT SATURN',
        text: 'Thirteen years in orbit reveal dynamic rings, Titan’s seas, and Enceladus’ ocean plume.',
        source: 'https://science.nasa.gov/mission/cassini/grand-finale/overview/',
        visual: { theta: 1.96, phi: .94, distance: .86 },
      },
      {
        id: 'saturn-today', date: 'TODAY', kind: 'PRESENT-DAY SYSTEM',
        title: 'BILLIONS OF PIECES MAKE THE RINGS',
        text: 'Ice and rock spread hundreds of thousands of kilometers, yet the main rings remain extremely thin.',
        source: 'https://science.nasa.gov/saturn/facts/',
        visual: { theta: 2.62, phi: .88, distance: .82 },
      },
      {
        id: 'saturn-dragonfly', date: 'NET JULY 2028 → LATE 2034', kind: 'PLANNED MISSION',
        title: 'DRAGONFLY FLIES ON TITAN',
        text: 'A nuclear-powered rotorcraft is planned to explore multiple sites on Saturn’s largest moon.',
        source: 'https://science.nasa.gov/mission/dragonfly/',
        visual: { theta: 3.26, phi: 1.08, distance: 1.10 },
      },
    ],
  },

  'SOL:URANUS': {
    summary: 'A sideways ice giant known closely from only six hours of one flyby.',
    defaultMoment: 'uranus-webb',
    note: 'Uranus Orbiter and Probe is a decadal-survey recommendation, not an approved mission and has no firm launch date.',
    moments: [
      {
        id: 'uranus-forms', date: 'ABOUT 4.5 BILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'AN ICE GIANT TAKES SHAPE',
        text: 'Uranus likely forms closer to the Sun before migrating outward.',
        source: 'https://science.nasa.gov/uranus/facts/',
        visual: { theta: .14, phi: 1.16, distance: 1.08 },
      },
      {
        id: 'uranus-discovered', date: 'MARCH 13 · 1781', kind: 'DISCOVERY',
        title: 'THE SOLAR SYSTEM GETS LARGER',
        text: 'William Herschel finds the first planet discovered with a telescope.',
        source: 'https://science.nasa.gov/uranus/exploration/',
        visual: { theta: .78, phi: 1.22, distance: 1 },
      },
      {
        id: 'uranus-rings', date: 'MARCH 10 · 1977', kind: 'STELLAR OCCULTATION',
        title: 'A STAR REVEALS DARK RINGS',
        text: 'Repeated dips in starlight expose a narrow ring system.',
        source: 'https://science.nasa.gov/uranus/exploration/',
        visual: { theta: 1.42, phi: 1.02, distance: .92 },
      },
      {
        id: 'uranus-voyager', date: 'JANUARY 24 · 1986', kind: 'SPACECRAFT FLYBY',
        title: 'VOYAGER GETS SIX HOURS',
        text: 'The only close encounter finds new moons, rings, and a twisted magnetic field.',
        source: 'https://science.nasa.gov/uranus/exploration/',
        visual: { theta: 2.02, phi: 1.18, distance: .88 },
      },
      {
        id: 'uranus-webb', date: '2023 → TODAY', kind: 'INFRARED OBSERVATION',
        title: 'WEBB SEES THE SEASONS',
        text: 'Infrared imaging resolves faint rings, storms, and a bright north polar cap.',
        source: 'https://science.nasa.gov/asset/webb/uranus-nircam-image/',
        visual: { theta: 2.68, phi: .76, distance: .84 },
      },
      {
        id: 'uranus-uop', date: 'FUTURE · NOT YET APPROVED', kind: 'MISSION CONCEPT',
        title: 'AN ORBITER AND PROBE WAIT',
        text: 'The decadal survey names a multi-year Uranus orbiter and atmospheric probe its top new flagship priority.',
        source: 'https://nap.nationalacademies.org/resource/26522/interactive/',
        visual: { theta: 3.32, phi: 1.10, distance: 1.08 },
      },
    ],
  },

  'SOL:NEPTUNE': {
    summary: 'A mathematically discovered planet visited once and watched across one immense year.',
    defaultMoment: 'neptune-webb',
    note: 'No approved Neptune mission supplies a defensible future date. The 2176 node is inferred from its measured 165-year orbit.',
    moments: [
      {
        id: 'neptune-forms', date: 'ABOUT 4.5 BILLION YEARS AGO', kind: 'RECONSTRUCTION',
        title: 'THE OUTER ICE GIANT FORMS',
        text: 'Neptune likely forms closer to the Sun before migrating outward.',
        source: 'https://science.nasa.gov/neptune/neptune-facts/',
        visual: { theta: .12, phi: 1.16, distance: 1.08 },
      },
      {
        id: 'neptune-discovered', date: '1846', kind: 'PREDICTION AND DISCOVERY',
        title: 'MATHEMATICS FINDS A PLANET',
        text: 'Orbital calculations lead Johann Galle to Neptune on his first night of searching.',
        source: 'https://science.nasa.gov/neptune/neptune-facts/',
        visual: { theta: .76, phi: 1.22, distance: 1 },
      },
      {
        id: 'neptune-voyager', date: 'AUGUST 25 · 1989', kind: 'SPACECRAFT FLYBY',
        title: 'VOYAGER 2 MEETS THE WINDS',
        text: 'The only close encounter discovers rings, moons, storms, and supersonic weather.',
        source: 'https://science.nasa.gov/mission/voyager/voyager-2/',
        visual: { theta: 1.42, phi: 1.18, distance: .88 },
      },
      {
        id: 'neptune-first-orbit', date: 'JULY · 2011', kind: 'ORBITAL MILESTONE',
        title: 'ONE NEPTUNE YEAR PASSES',
        text: 'Neptune completes its first 165-year orbit since its discovery.',
        source: 'https://science.nasa.gov/missions/hubble/neptune-completes-its-first-circuit-around-the-sun-since-its-discovery/',
        visual: { theta: 2.04, phi: 1.14, distance: .94 },
      },
      {
        id: 'neptune-webb', date: '2022 → TODAY', kind: 'INFRARED OBSERVATION',
        title: 'WEBB RECOVERS THE RINGS',
        text: 'Infrared imaging gives the clearest view of Neptune’s rings in more than three decades.',
        source: 'https://science.nasa.gov/missions/webb/new-webb-image-captures-clearest-view-of-neptunes-rings-in-decades/',
        visual: { theta: 2.68, phi: 1.18, distance: .84 },
      },
      {
        id: 'neptune-next-orbit', date: 'AROUND 2176', kind: 'ORBITAL FORECAST',
        title: 'ANOTHER NEPTUNE YEAR',
        text: 'At its measured orbital period, Neptune should again complete a post-discovery circuit.',
        source: 'https://science.nasa.gov/neptune/neptune-facts/',
        visual: { theta: 3.34, phi: 1.10, distance: 1.08 },
      },
    ],
  },
};

export function landmarkExperience(entry){
  const alias = entry && LANDMARK_EXPERIENCE_ALIASES[entry.id];
  const curated = entry && LANDMARK_EXPERIENCES[alias || entry.id];
  if (curated){
    if (entry.id === 'crab-nebula-sn-1054')
      return withObservationModelPresentation(entry,
        { ...curated, defaultMoment: 'crab-pulsar' });
    if (entry.id === 'gw150914-first-gravitational-wave')
      return withObservationModelPresentation(entry,
        { ...curated, defaultMoment: 'gw150914-model' });
    return withObservationModelPresentation(entry, curated);
  }
  const supernova = supernovaExperience(entry);
  if (supernova) return withObservationModelPresentation(entry, supernova);
  const nebula = nebulaModelExperience(entry);
  if (nebula) return withObservationModelPresentation(entry, nebula);
  const modeledBlackHole = !!entry && MODELED_BLACK_HOLE_IDS.has(entry.id);
  const deepSkyArchiveOnly = !!entry && !landmarkImage(entry.id) &&
    (entry.category === 'NEBULA' || entry.category === 'SUPERNOVA');
  const archiveText = entry.wow || 'This catalog record is preserved for reference.';
  return {
    summary: entry.subtitle || entry.famousFor || 'A field note from the cosmic archive.',
    defaultMoment: deepSkyArchiveOnly ? 'archive-record' : 'archive-observation',
    note: modeledBlackHole
      ? 'This is a scale-compressed, physically informed visualization. The shadow, lensing, disk, companion or merger context is explanatory—not a visible-light photograph or full general-relativistic ray trace.'
      : deepSkyArchiveOnly
      ? 'No verified visual asset is available for this archive record; its catalog facts remain accessible while a curated reconstruction is pending.'
      : 'This archive entry has one verified observation marker; deeper visual chapters are added only after source and asset review.',
    moments: [{
      id: deepSkyArchiveOnly ? 'archive-record' : 'archive-observation',
      date: entry.date || 'ARCHIVE',
      kind: modeledBlackHole ? 'SCIENTIFIC VISUALIZATION'
        : deepSkyArchiveOnly ? 'ARCHIVE RECORD' : 'OBSERVATION',
      title: entry.famousFor || entry.subtitle || entry.name,
      text: deepSkyArchiveOnly
        ? archiveText + ' No verified visual asset is displayed for this record.'
        : entry.wow || 'Open More for the full field note.',
      visual: deepSkyArchiveOnly ? {
        state: 'archive-record', observation: false, theta: 0, phi: 1.22, distance: 1,
      } : {
        wavelength: 'visible', theta: 0,
        phi: entry && NEBULA_PROFILE_IDS.includes(entry.id) ? Math.PI/2 : 1.22,
        distance: 1,
      },
    }],
  };
}

export function bodyExperience(systemName, bodyName){
  return BODY_EXPERIENCES[(systemName || '') + ':' + (bodyName || '')] || null;
}
