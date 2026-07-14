/* Model-led histories for the two retained modern remnant reconstructions.
   Every chapter maps to a renderer state and an authoritative observation or
   mission source; the real source image is reserved for `observation`. */

const EXPERIENCES = Object.freeze({
  'sn-1987a': {
    summary: 'A nearby stellar death whose rings, shock impacts and compact core are still evolving within a human lifetime.',
    defaultMoment: 'sn1987a-model',
    note: 'The triple rings, ejecta and hourglass are a scale-compressed scientific 3D interpretation. Thickness, hotspot timing and line-of-sight depth are explanatory; the Hubble image appears separately as observed evidence.',
    moments: [
      {
        id: 'sn1987a-model', date: 'MODEL · PRESENT REMNANT', kind: 'SCIENTIFIC 3D MODEL',
        title: 'THREE RINGS FRAME AN EVOLVING BLAST',
        text: 'True tubular ring surfaces surround asymmetric ejecta and a forward shock, keeping the circumstellar structure legible from every orbit angle.',
        source: 'https://science.nasa.gov/3d-resources/sn-1987a/',
        visual: { state: 'model', theta: .20, phi: 1.22, distance: 1 },
      },
      {
        id: 'sn1987a-neutrinos', date: 'FEBRUARY 23 · 1987', kind: 'SUPERNOVA + NEUTRINOS',
        title: 'THE CORE COLLAPSE ARRIVES FIRST AS NEUTRINOS',
        text: 'A seconds-long neutrino burst reaches detectors roughly two hours before the first visible report, directly linking a core-collapse supernova to compact-object formation.',
        source: 'https://science.nasa.gov/missions/webb/webb-finds-evidence-for-neutron-star-at-heart-of-young-supernova-remnant/',
        visual: { state: '1987-flash', theta: -.28, phi: 1.16, distance: .92 },
      },
      {
        id: 'sn1987a-three-rings', date: '1994', kind: 'HUBBLE MORPHOLOGY',
        title: 'HUBBLE RESOLVES THE FULL THREE-RING SYSTEM',
        text: 'One dense equatorial ring and two fainter outer rings expose material shed by the progenitor before it exploded and motivate a bipolar/hourglass geometry.',
        source: 'https://science.nasa.gov/asset/hubble/mysterious-ring-structure-around-supernova-1987a',
        visual: { state: 'ejecta-hourglass', theta: .88, phi: 1.02, distance: .88 },
      },
      {
        id: 'sn1987a-hotspots', date: 'MID-1990s → 2010s', kind: 'SHOCK INTERACTION',
        title: 'THE BLAST WAVE LIGHTS PEARLS AROUND THE RING',
        text: 'As the shock strikes denser equatorial gas, discrete hotspots brighten and spread around the ring instead of forming one uniform flash.',
        source: 'https://science.nasa.gov/missions/hubble/new-hubble-observations-of-supernova-1987a-trace-shock-wave',
        visual: { state: 'ring-hotspots', theta: -.74, phi: 1.18, distance: .82 },
      },
      {
        id: 'sn1987a-neutron-star', date: '2024', kind: 'WEBB SPECTROSCOPY',
        title: 'IONIZED ARGON REVEALS A PROBABLE NEUTRON STAR',
        text: 'Webb detects high-energy ionization at the remnant center, providing the strongest evidence yet for emission powered by the newborn neutron star.',
        source: 'https://science.nasa.gov/missions/webb/webb-finds-evidence-for-neutron-star-at-heart-of-young-supernova-remnant/',
        visual: { state: 'ejecta-hourglass', theta: .34, phi: .96, distance: .78 },
      },
      {
        id: 'sn1987a-observation', date: 'HUBBLE OBSERVATION', kind: 'OBSERVATION',
        title: 'COMPARE THE MODEL WITH THE REAL SOURCE FRAME',
        text: 'The authentic Hubble image opens beside the still-visible 3D remnant. Its colors and projected ring overlap are evidence, not a recovered spatial volume.',
        source: 'https://science.nasa.gov/missions/hubble/new-hubble-observations-of-supernova-1987a-trace-shock-wave',
        visual: { state: 'observation', observation: true, theta: 0, phi: Math.PI / 2, distance: 1.10 },
      },
    ],
  },

  'cassiopeia-a': {
    summary: 'A young shattered remnant whose shocks, element-rich knots, broad jets and interior circumstellar sheet preserve an asymmetric explosion.',
    defaultMoment: 'casa-model',
    note: 'Model colors label explanatory element and shock families rather than natural visible color; the MIRI observation likewise maps infrared filters to assigned visible colors. Relative depth, knot placement and the compact object’s display size are model-led; the JWST image remains a separate observation.',
    moments: [
      {
        id: 'casa-model', date: 'MODEL · PRESENT REMNANT', kind: 'SCIENTIFIC 3D MODEL',
        title: 'A BROKEN SHELL, NOT A PERFECT SPHERE',
        text: 'Separate forward and reverse shocks surround an asymmetric debris field made from hundreds of hard, faceted knots rather than a generic luminous cloud.',
        source: 'https://science.nasa.gov/3d-resources/cassiopeia-a-supernova/',
        visual: { state: 'model', theta: .30, phi: 1.18, distance: 1 },
      },
      {
        id: 'casa-explosion', date: 'ABOUT 340 YEARS AGO', kind: 'CORE-COLLAPSE SUPERNOVA',
        title: 'A MASSIVE STAR SHATTERS OUT OF SIGHT',
        text: 'The explosion likely appeared in Earth’s sky around the late seventeenth century, but intervening dust may explain why no secure bright historical record survives.',
        source: 'https://science.nasa.gov/missions/hubble/cassiopeia-a-the-colorful-aftermath-of-a-violent-stellar-death/',
        visual: { state: '1680', theta: -.34, phi: 1.15, distance: .92 },
      },
      {
        id: 'casa-elements', date: 'MULTI-WAVELENGTH MAP', kind: 'NUCLEOSYNTHESIS',
        title: 'ELEMENTS OCCUPY DIFFERENT SHARDS',
        text: 'X-ray spectra separate oxygen-, sulfur- and iron-rich ejecta, revealing how the star manufactured and dispersed heavy elements in an uneven blast.',
        source: 'https://science.nasa.gov/image-detail/where-do-most-of-the-elements-essential-for-life-on-earth-come-from-the-answer-inside-the-furnaces-of-stars-and-the-explosions-that-mark-the-end-of-some-stars-lives-3/',
        visual: { state: 'ejecta-elements', theta: .92, phi: 1.06, distance: .84 },
      },
      {
        id: 'casa-jets', date: '3D VELOCITY RECONSTRUCTION', kind: 'EXPLOSION ASYMMETRY',
        title: 'BROAD JETS PIERCE THE MAIN SHELL',
        text: 'A silicon- and sulfur-rich northeast jet and fainter counterjet extend beyond the remnant while an exaggerated marker locates the central compact object.',
        source: 'https://science.nasa.gov/photojournal/supernova-remnant-in-3-d/',
        visual: { state: 'jets-compact-object', theta: -.86, phi: .96, distance: .78 },
      },
      {
        id: 'casa-green-monster', date: 'WEBB + CHANDRA · 2023–2024', kind: 'CIRCUMSTELLAR SHOCK',
        title: 'THE GREEN MONSTER TRACES PRE-SUPERNOVA GAS',
        text: 'Webb and Chandra show that the porous interior structure is circumstellar material shaped when the blast wave slammed into gas shed before the explosion.',
        source: 'https://www.nasa.gov/image-article/nasa-telescopes-chase-down-green-monster-in-stars-debris/',
        visual: { state: 'green-monster', theta: .42, phi: .90, distance: .76 },
      },
      {
        id: 'casa-observation', date: 'AUGUST 4 · 2022 · JWST MIRI', kind: 'OBSERVATION',
        title: 'COMPARE THE SCULPT WITH THE REAL INFRARED FRAME',
        text: 'The authentic JWST MIRI image opens beside the still-visible model. Its mid-infrared filters are mapped to assigned visible colors; the model’s element families and line-of-sight structure remain interpretive.',
        source: 'https://science.nasa.gov/asset/webb/cassiopeia-a-miri-image/',
        visual: { state: 'observation', observation: true, theta: 0, phi: Math.PI / 2, distance: 1.10 },
      },
    ],
  },
});

export function supernovaExperience(entry){
  return entry ? EXPERIENCES[entry.id] || null : null;
}

export const SUPERNOVA_EXPERIENCE_IDS = Object.freeze(Object.keys(EXPERIENCES));
