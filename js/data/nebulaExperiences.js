import {
  FEATURED_NEBULA_PROFILE_IDS,
  nebulaProfile,
} from './nebulaProfiles.js';

/* Story copy for the shared photo-sculpt nebulae. The renderer owns the
   geometry; this module owns the science-led camera sequence. Each source is
   selected from the corresponding profile so the rail cannot silently drift
   away from the reconstruction's evidence base. */
const NEBULA_STORIES = Object.freeze({
  'orion-nebula': {
    summary: 'An ionized blister opened into the face of Orion’s molecular cloud.',
    model: {
      title: 'A BLISTER, NOT A BALL',
      text: 'The Trapezium sits inside a bowl-like cavity whose bright wall is the exposed face of the Orion Molecular Cloud.',
      sourceIndex: 0,
    },
    morphology: {
      title: 'THE BRIGHT BAR TURNS EDGE-ON',
      text: 'This angle separates the Orion Bar’s sharp ionization front from the colder molecular wall behind it.',
      theta: -0.72, phi: 1.27, distance: 0.90, sourceIndex: 1,
    },
    detail: {
      title: 'THE TRAPEZIUM SCULPTS THE CAVITY',
      text: 'Theta 1 Orionis C dominates the ionizing radiation while proplyds and bow shocks register stellar feedback around the cluster.',
      theta: 0.94, phi: 1.16, distance: 0.83, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE HUBBLE MOSAIC',
      text: 'Head-on, the reconstruction yields to the exact Hubble/ESO mosaic assembled from 2001 and 2004–2005 observations.',
    },
  },

  'horsehead-nebula': {
    summary: 'Barnard 33 is a dense ridge projecting from a larger cloud in front of glowing IC 434.',
    model: {
      title: 'A RIDGE, NOT A FREE-FLOATING HEAD',
      text: 'The famous silhouette remains attached to the L1630 molecular cloud and stands in front of IC 434’s ionized emission.',
      sourceIndex: 0,
    },
    morphology: {
      title: 'STARLIGHT ETCHES THE RIM',
      text: 'Oblique light exposes the thin photodissociation skin and fine striations driven from the direction of Sigma Orionis.',
      theta: -0.78, phi: 1.43, distance: 0.89, sourceIndex: 1,
    },
    detail: {
      title: 'DUST CONNECTS HEAD TO CLOUD',
      text: 'The neck, cloud-bed ionization front, and nearby NGC 2023 reflection cavity become separate structures instead of one silhouette.',
      theta: 1.02, phi: 1.14, distance: 0.84, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE SOURCE COMPOSITE',
      text: 'The exact observed silhouette reappears head-on in Ken Crawford’s long-exposure, representative-color ground-based composite.',
    },
  },

  'ring-nebula': {
    summary: 'M57 is a thick equatorial torus wrapped around elongated polar lobes.',
    model: {
      title: 'THE RING HAS A POLAR BODY',
      text: 'A dense, knotty torus surrounds lower-density football-shaped lobes viewed almost along their long axis.',
      sourceIndex: 0,
    },
    morphology: {
      title: 'LOOK ACROSS THE TORUS',
      text: 'The side view separates the near and far rims and reveals why a three-dimensional shell projects as a bright oval ring.',
      theta: 1.10, phi: 0.96, distance: 0.87, sourceIndex: 1,
    },
    detail: {
      title: 'KNOTS CAST RADIAL SHADOWS',
      text: 'Dense knots along the inner rim, their shadow spokes, and the faint scalloped halo trace more than one episode of mass loss.',
      theta: -0.86, phi: 1.18, distance: 0.81, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE HUBBLE OBSERVATION',
      text: 'Head-on, the inferred volume gives way to the exact Hubble observation obtained on October 16, 1998.',
    },
  },

  'helix-nebula': {
    summary: 'The Helix combines differently oriented structures with a forest of cometary knots.',
    model: {
      title: 'TWO STRUCTURES MAKE ONE EYE',
      text: 'The bright inner disk and a differently inclined outer torus overlap in projection, producing the familiar eye-like outline.',
      sourceIndex: 0,
    },
    morphology: {
      title: 'COMETARY KNOTS POINT OUTWARD',
      text: 'Dense knot heads face the central star while ionized tails stream radially away through the main ring.',
      theta: -0.92, phi: 1.12, distance: 0.84, sourceIndex: 1,
    },
    detail: {
      title: 'THE FAINT OUTER ARC MEETS SPACE',
      text: 'A wider angle distinguishes the low-density polar plumes and the outermost arc where expanding material encounters its surroundings.',
      theta: 1.06, phi: 1.02, distance: 0.91, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE SOURCE IMAGE',
      text: 'The real Hubble/CTIO composite is restored exactly head-on; the observations span November 2002 and September 2003.',
    },
  },

  'lagoon-nebula': {
    summary: 'Massive stars excavate a broad cavity behind the Lagoon’s foreground dust lanes.',
    model: {
      title: 'A WIND CAVITY BEHIND THE LAGOON',
      text: 'Herschel 36 and other massive stars illuminate and erode a cavity whose bright wall lies behind foreground curtains of dust.',
      sourceIndex: 0,
    },
    morphology: {
      title: 'THE HOURGLASS IS A LOCAL BLISTER',
      text: 'This angle separates the compact Hourglass region near Herschel 36 from the much larger wind-cleared cavity around it.',
      theta: -0.74, phi: 1.20, distance: 0.86, sourceIndex: 1,
    },
    detail: {
      title: 'RADIATION SHAPES TWISTERS AND GLOBULES',
      text: 'Ionization rims, elongated pillars, and compact Bok globules mark dense gas resisting the surrounding stellar feedback.',
      theta: 0.98, phi: 1.08, distance: 0.82, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE OPTICAL COMPOSITE',
      text: 'The head-on view is the exact ESO optical B/V/R composite, released in 2010; the modeled depth remains interpretive.',
    },
  },

  'cats-eye-nebula': {
    summary: 'Nested bubbles and point-symmetric arcs preserve a complex, still-debated dying-star outflow history.',
    model: {
      title: 'NESTED SHELLS MAY RECORD PULSED OUTFLOWS',
      text: 'Eleven limb-brightened shells surround the compact core. Episodic mass loss may have formed them, but waves in a smoother outflow remain viable.',
      sourceIndex: 1,
    },
    morphology: {
      title: 'PARTIAL RINGS TRACE A PRECESSING JET',
      text: 'An oblique view turns overlapping arcs into paired, point-symmetric features consistent with a precessing-jet interpretation.',
      theta: 1.12, phi: 1.02, distance: 0.84, sourceIndex: 0,
    },
    detail: {
      title: 'THE CORE HOLDS BUBBLES, KNOTS, AND JETS',
      text: 'The close angle separates the bright inner ellipses, compact knots, and narrow bipolar structures around the central star.',
      theta: -0.88, phi: 1.16, distance: 0.78, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE HUBBLE IMAGE',
      text: 'Head-on, the exact Hubble observation from September 18, 1994 replaces the interpretive shell depths.',
    },
  },

  'veil-nebula': {
    summary: 'A thin, rippled shock sheet carries the Cygnus Loop’s supernova blast through interstellar gas.',
    model: {
      title: 'A SHOCK SHEET, NOT A CLOUD',
      text: 'This field represents a nearly edge-on segment of the Cygnus Loop’s expanding blast wave, not the entire remnant in miniature.',
      sourceIndex: 0,
    },
    morphology: {
      title: 'COOLING ZONES TRAIL THE SHOCK',
      text: 'The oblique view separates the leading shock from downstream emission zones produced as swept-up gas cools and recombines.',
      theta: -1.02, phi: 1.26, distance: 0.86, sourceIndex: 1,
    },
    detail: {
      title: 'CORRUGATION BECOMES FILAMENTS',
      text: 'Ripples in a thin emitting sheet stack along the line of sight, turning a surface into the Veil’s braided filaments.',
      theta: 0.94, phi: 1.08, distance: 0.80, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE HUBBLE FIELD',
      text: 'The exact Hubble field returns head-on as an overlay of 1997 and 2015 data; assigned colors distinguish emitting species.',
    },
  },

  'rosette-nebula': {
    summary: 'A porous molecular sheet surrounds a wind-cleared opening made by NGC 2244.',
    model: {
      title: 'A HOLE THROUGH A MOLECULAR SHEET',
      text: 'The Rosette is represented as an inclined, clumpy sheet with a central opening, not as a sealed spherical bubble.',
      sourceIndex: 0,
    },
    morphology: {
      title: 'NGC 2244 CLEARS THE CENTER',
      text: 'Radiation and winds from the young central cluster erode the cavity rim while dense pillars and clumps survive along its edge.',
      theta: 1.00, phi: 1.06, distance: 0.88, sourceIndex: 1,
    },
    detail: {
      title: 'POROSITY LETS THE BUBBLE LEAK',
      text: 'Gaps in the molecular wall reveal an irregular, open boundary rather than a uniform ring of material.',
      theta: -0.84, phi: 1.18, distance: 0.82, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE SOURCE MOSAIC',
      text: 'The observed flower-like projection is exact head-on in this DSS-II optical survey image released in 2001.',
    },
  },

  'trifid-nebula': {
    summary: 'Foreground molecular lanes divide one H II region beside a separate blue reflection cloud.',
    model: {
      title: 'DUST LIES IN FRONT OF ONE GLOWING REGION',
      text: 'The three dark lanes are foreground molecular material crossing a connected H II region, not empty fissures between three clouds.',
      sourceIndex: 0,
    },
    morphology: {
      title: 'EMISSION AND REFLECTION SEPARATE',
      text: 'The red ionized volume and blue starlight-reflecting cloud occupy distinct structures that overlap in the familiar two-tone view.',
      theta: -0.90, phi: 1.20, distance: 0.86, sourceIndex: 1,
    },
    detail: {
      title: 'HD 164492 DRIVES THE ACTIVE RIM',
      text: 'The central ionizing source, photoevaporating pillars, and the HH 399 outflow mark ongoing feedback along the nebula’s dense edges.',
      theta: 1.02, phi: 1.06, distance: 0.80, sourceIndex: 2,
    },
    observation: {
      title: 'RETURN TO THE SOURCE IMAGE',
      text: 'Head-on, the exact ESO Wide Field Imager composite released in 2009 replaces the inferred depth.',
    },
  },
});

function profileSources(profile){
  return [...new Set([profile.source, ...(profile.references || [])].filter(Boolean))];
}

function sourceAt(sources, index){
  return sources[index] || sources[0];
}

function modelMoment(id, copy, camera, source){
  return {
    id: `${id}-model`,
    date: 'CURRENT 3D INTERPRETATION',
    kind: 'SCIENTIFIC 3D MODEL',
    title: copy.title,
    text: copy.text,
    source,
    visual: {
      state: 'model',
      observation: false,
      theta: camera.startTheta,
      phi: camera.startPhi,
      distance: 0.92,
    },
  };
}

function angleMoment(id, suffix, date, kind, copy, source){
  return {
    id: `${id}-${suffix}`,
    date,
    kind,
    title: copy.title,
    text: copy.text,
    source,
    visual: {
      state: 'model',
      observation: false,
      theta: copy.theta,
      phi: copy.phi,
      distance: copy.distance,
    },
  };
}

/**
 * Build the model-first semantic rail for a shared nebula photo-sculpt.
 * Returns null for catalog entries that do not have a reconstruction profile.
 */
export function nebulaModelExperience(entry){
  if (!entry || !FEATURED_NEBULA_PROFILE_IDS.includes(entry.id)) return null;
  const profile = entry && nebulaProfile(entry.id);
  if (!profile) return null;
  const story = NEBULA_STORIES[entry.id];
  if (!story) return null;

  const sources = profileSources(profile);
  const defaultMoment = `${entry.id}-model`;
  return {
    summary: story.summary,
    defaultMoment,
    note: `The exact source observation appears only head-on. Orbiting reveals an observation-registered scientific reconstruction. ${profile.caveat}`,
    moments: [
      modelMoment(entry.id, story.model, profile.camera,
        sourceAt(sources, story.model.sourceIndex)),
      angleMoment(entry.id, 'morphology', 'MORPHOLOGY VIEW', 'SCIENTIFIC 3D MODEL',
        story.morphology, sourceAt(sources, story.morphology.sourceIndex)),
      angleMoment(entry.id, 'structure', 'STRUCTURE VIEW', 'SCIENTIFIC 3D MODEL',
        story.detail, sourceAt(sources, story.detail.sourceIndex)),
      {
        id: `${entry.id}-observation`,
        date: profile.observationDate,
        kind: 'OBSERVATION',
        title: story.observation.title,
        text: story.observation.text,
        source: profile.observationSource,
        visual: {
          state: 'observation', observation: true,
          theta: 0, phi: Math.PI / 2, distance: 1,
        },
      },
    ],
  };
}
