/* Visual epochs for the Solar System exhibit.
   These states change appearance only; the live orbital clock remains separate.
   Ancient surfaces and ring systems are reconstructions, not observations. */

export const DEFAULT_SOL_EPOCH = 'present';

export const SOL_BODY_NAMES = Object.freeze([
  'MERCURY',
  'VENUS',
  'EARTH',
  'MARS',
  'JUPITER',
  'SATURN',
  'URANUS',
  'NEPTUNE',
]);

const PRESENT_BODY_APPEARANCE = {
  MERCURY: {
    surface: 'present', nightStrength: 0, cloudOpacity: 0,
    atmosphereStrength: 0, atmosphereColor: '#000000',
    ringVisible: false, ringOpacity: 0, ringUncertain: false,
  },
  VENUS: {
    surface: 'present', nightStrength: 0, cloudOpacity: 1,
    atmosphereStrength: 1, atmosphereColor: '#f4cf83',
    ringVisible: false, ringOpacity: 0, ringUncertain: false,
  },
  EARTH: {
    surface: 'present', nightStrength: 1, cloudOpacity: .72,
    atmosphereStrength: 1, atmosphereColor: '#6ca9ff',
    ringVisible: false, ringOpacity: 0, ringUncertain: false,
  },
  MARS: {
    surface: 'present', nightStrength: 0, cloudOpacity: .05,
    atmosphereStrength: .16, atmosphereColor: '#d88557',
    ringVisible: false, ringOpacity: 0, ringUncertain: false,
  },
  JUPITER: {
    surface: 'present', nightStrength: 0, cloudOpacity: 1,
    atmosphereStrength: .42, atmosphereColor: '#d8b98e',
    ringVisible: true, ringOpacity: .10, ringUncertain: false,
  },
  SATURN: {
    surface: 'present', nightStrength: 0, cloudOpacity: 1,
    atmosphereStrength: .38, atmosphereColor: '#ead49f',
    ringVisible: true, ringOpacity: .90, ringUncertain: false,
  },
  URANUS: {
    surface: 'present', nightStrength: 0, cloudOpacity: .90,
    atmosphereStrength: .42, atmosphereColor: '#a9e1e5',
    ringVisible: true, ringOpacity: .34, ringUncertain: false,
  },
  NEPTUNE: {
    surface: 'present', nightStrength: 0, cloudOpacity: .92,
    atmosphereStrength: .46, atmosphereColor: '#5878e0',
    ringVisible: true, ringOpacity: .23, ringUncertain: false,
  },
};

const COMMON_APPEARANCE = {
  retainRelief: false,
  axialTiltDeg: null,
};

function completeBodies(overrides = {}) {
  return Object.fromEntries(SOL_BODY_NAMES.map((name) => [
    name,
    { ...COMMON_APPEARANCE, ...PRESENT_BODY_APPEARANCE[name], ...(overrides[name] || {}) },
  ]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const SOL_EPOCHS = deepFreeze([
  {
    id: '1000ma',
    label: '1.0 GA',
    ageMa: 1000,
    date: 'ABOUT 1 BILLION YEARS AGO',
    kind: 'SCHEMATIC RECONSTRUCTION',
    phase: 'MODEL · PHASE UNKNOWN',
    title: 'AN OLDER, CHANGING SOLAR SYSTEM',
    text: 'Rodinia turns under a dimmer Sun while modeled clouds, ice and giant-planet weather replace modern transient features.',
    legend: 'MODELED WEATHER ≠ RECOVERED CLOUDS · AMBER = UNKNOWN',
    evidence: 'Earth uses a hand-built plate schematic; every other ancient atmosphere is a representative scenario grounded in known variability, not a recovered weather map.',
    caveat: 'Exact orbital, seasonal and weather phases are unknowable at 1 Ga. Mars uses a representative high-obliquity state; Venus climate, Saturn tilt and ancient rings remain especially uncertain.',
    source: 'https://doi.org/10.1016/j.earscirev.2020.103477',
    sourceLabel: 'EARTH MAP SOURCE',
    star: { luminosityScale: .92 },
    belt: { visible: true, opacity: .75 },
    bodies: completeBodies({
      VENUS: {
        surface: 'modeled-clouds-1000ma', atmosphereStrength: 1.08,
        atmosphereColor: '#dfb96f',
      },
      EARTH: {
        surface: 'rodinia', nightStrength: 0, cloudOpacity: .58,
        atmosphereStrength: .74, atmosphereColor: '#75a9d8',
      },
      MARS: {
        surface: 'modeled-ice-1000ma', retainRelief: true,
        axialTiltDeg: 42, atmosphereStrength: .22, atmosphereColor: '#cf8054',
      },
      JUPITER: {
        surface: 'modeled-weather-1000ma', ringVisible: true,
        ringOpacity: .06, ringUncertain: true,
      },
      SATURN: {
        surface: 'modeled-weather-1000ma', axialTiltDeg: 4,
        ringVisible: true, ringOpacity: .18, ringUncertain: true,
      },
      URANUS: {
        surface: 'modeled-weather-1000ma', ringVisible: true,
        ringOpacity: .16, ringUncertain: true,
      },
      NEPTUNE: {
        surface: 'modeled-weather-1000ma', ringVisible: true,
        ringOpacity: .11, ringUncertain: true,
      },
    }),
    bodyEvidence: {
      MERCURY: {
        title: 'MERCURY · SURFACE RETAINED',
        text: 'Its ancient cratered terrain already dominated; no defensible globe-scale 1 Ga repaint is available.',
        legend: 'NO GLOBE-SCALE CHANGE CLAIMED',
        evidence: 'Young hollows and faults exist locally, but the difference is too small to reconstruct honestly at this scale.',
        source: 'https://science.nasa.gov/mercury/facts/', sourceLabel: 'MERCURY SOURCE',
      },
      VENUS: {
        title: 'VENUS · CLOUD-DECK SCENARIO',
        text: 'A new opaque UV-cloud pattern replaces the modern snapshot; it does not claim oceans or a known surface climate.',
        legend: 'CLOUD PATTERN MODELED · CLIMATE UNKNOWN',
        evidence: 'Venus cloud markings evolve rapidly, while the timing of its greenhouse transition and resurfacing remains disputed.',
        source: 'https://www.esa.int/Science_Exploration/Space_Science/Chasing_clouds_on_Venus', sourceLabel: 'VENUS CLOUD SOURCE',
      },
      EARTH: {
        title: 'EARTH · RODINIA SCHEMATIC',
        text: 'Continental crust gathers into one hand-authored supercontinent view; city lights disappear.',
        legend: 'SCHEMATIC MAP · NO ARTIFICIAL LIGHT',
        evidence: 'The texture is inspired by published full-plate models rather than derived from their GIS data.',
        source: 'https://doi.org/10.1016/j.earscirev.2020.103477', sourceLabel: 'EARTH MAP SOURCE',
      },
      MARS: {
        title: 'MARS · HIGH-TILT SCENARIO',
        text: 'A 42° representative obliquity shrinks bright polar caps and shifts pale ice-dust mantles toward lower latitudes.',
        legend: 'REPRESENTATIVE SCENARIO · NOT A DATED MAP',
        evidence: 'Mars obliquity becomes chaotic this far back; the ice redistribution is physically grounded but its exact 1 Ga pattern is unrecoverable.',
        source: 'https://doi.org/10.1016/j.icarus.2004.04.005', sourceLabel: 'MARS MODEL SOURCE',
      },
      JUPITER: {
        title: 'JUPITER · WEATHER RE-SEEDED',
        text: 'Persistent jets keep a banded world, but a new cloud map removes today’s Great Red Spot and named storms.',
        legend: 'ANCIENT BANDS · NO MODERN RED SPOT',
        evidence: 'The current Great Red Spot is likely only centuries old; exact ancient belts and storms cannot be recovered.',
        source: 'https://doi.org/10.1029/2024GL108993', sourceLabel: 'JUPITER WEATHER SOURCE',
      },
      SATURN: {
        title: 'SATURN · LOW-TILT HYPOTHESIS',
        text: 'One Titan-migration model gives Saturn a near-upright axis; separate weather and ghost rings encode the uncertainty.',
        legend: '4° TILT HYPOTHESIS · RING HISTORY UNKNOWN',
        evidence: 'The low ancient tilt is one dynamical hypothesis, not settled history; competing studies also allow young or old rings.',
        source: 'https://doi.org/10.1038/s41550-020-01284-x', sourceLabel: 'TILT HYPOTHESIS',
      },
      URANUS: {
        title: 'URANUS · SEASON RE-SEEDED',
        text: 'A low-contrast cyan weather map omits the present polar hood; its narrow rings become an uncertain amber ghost.',
        legend: 'SEASON UNKNOWN · MODERN POLAR HOOD REMOVED',
        evidence: 'Uranus changes color and polar brightness through its 84-year seasons, whose phase is unknowable here.',
        source: 'https://doi.org/10.1093/mnras/stad3761', sourceLabel: 'URANUS SEASON SOURCE',
      },
      NEPTUNE: {
        title: 'NEPTUNE · TRANSIENT STORMS REPLACED',
        text: 'A paler azure map uses fresh cloud bands without copying Voyager’s Great Dark Spot or any modern vortex.',
        legend: 'DARK VORTICES LAST YEARS, NOT EONS',
        evidence: 'Observed dark vortices typically survive only years; ring arcs and cloud cover also change on short timescales.',
        source: 'https://doi.org/10.3847/1538-3881/ab0747', sourceLabel: 'NEPTUNE STORM SOURCE',
      },
    },
  },
  {
    id: '5ma',
    label: '5 MA',
    ageMa: 5,
    date: 'ABOUT 5 MILLION YEARS AGO',
    kind: 'SCHEMATIC RECONSTRUCTION',
    phase: 'MODEL · PHASE NOT SHOWN',
    title: 'PLIOCENE EARTH, DIFFERENT SKIES',
    text: 'Earth is nearly familiar but unlit; Mars redistributes ice while six cloudy planets receive independent weather states.',
    legend: 'MODELED WEATHER ≠ RECOVERED CLOUDS · AMBER = UNKNOWN',
    evidence: 'Earth’s hand-built palaeogeography and Mars high-obliquity climate are model scenarios; cloud fields are re-seeded because real weather is transient.',
    caveat: 'The asteroid belt remains. The live orbit clock is not a 5 Ma integration, so exact seasons, cloud patterns and ring detail are not shown.',
    source: 'https://doi.org/10.5281/zenodo.5460860',
    sourceLabel: 'EARTH MAP SOURCE',
    star: { luminosityScale: .9996 },
    belt: { visible: true, opacity: .75 },
    bodies: completeBodies({
      VENUS: {
        surface: 'modeled-clouds-5ma', atmosphereStrength: 1.02,
        atmosphereColor: '#edca8b',
      },
      EARTH: {
        surface: 'pliocene', nightStrength: 0, cloudOpacity: .68,
        atmosphereStrength: .96, atmosphereColor: '#70adff',
      },
      MARS: {
        surface: 'modeled-ice-5ma', retainRelief: true,
        axialTiltDeg: 42, atmosphereStrength: .20, atmosphereColor: '#dc9061',
      },
      JUPITER: {
        surface: 'modeled-weather-5ma', ringVisible: true,
        ringOpacity: .08, ringUncertain: true,
      },
      SATURN: {
        surface: 'modeled-weather-5ma', ringVisible: true,
        ringOpacity: .90, ringUncertain: false,
      },
      URANUS: {
        surface: 'modeled-weather-5ma', ringVisible: true,
        ringOpacity: .28, ringUncertain: true,
      },
      NEPTUNE: {
        surface: 'modeled-weather-5ma', ringVisible: true,
        ringOpacity: .18, ringUncertain: true,
      },
    }),
    bodyEvidence: {
      MERCURY: {
        title: 'MERCURY · EFFECTIVELY THE SAME',
        text: 'Five million years is too short for a defensible globe-scale visual change on this ancient surface.',
        legend: 'NO GLOBE-SCALE CHANGE CLAIMED',
        evidence: 'Local impacts and active hollows do not justify repainting the whole planet.',
        source: 'https://science.nasa.gov/mercury/facts/', sourceLabel: 'MERCURY SOURCE',
      },
      VENUS: {
        title: 'VENUS · CLOUDS RE-SEEDED',
        text: 'The opaque deck remains, but UV lanes and polar-vortex-like curls no longer copy a modern observation.',
        legend: 'DYNAMIC CLOUDS · NOT A 5 MA PHOTOGRAPH',
        evidence: 'Observed UV markings and polar hazes vary rapidly inside Venus’s super-rotating atmosphere.',
        source: 'https://www.esa.int/Science_Exploration/Space_Science/Chasing_clouds_on_Venus', sourceLabel: 'VENUS CLOUD SOURCE',
      },
      EARTH: {
        title: 'EARTH · PLIOCENE SCHEMATIC',
        text: 'Broadly familiar continents carry altered coastlines and no artificial night-light layer.',
        legend: 'SCHEMATIC MAP · NO ARTIFICIAL LIGHT',
        evidence: 'The texture is inspired by PaleoDEM research rather than derived from its raster data.',
        source: 'https://doi.org/10.5281/zenodo.5460860', sourceLabel: 'EARTH MAP SOURCE',
      },
      MARS: {
        title: 'MARS · ICE LEAVES THE POLES',
        text: 'A high-obliquity state reduces compact polar caps and adds pale ice-dust mantles near Tharsis and lower latitudes.',
        legend: '≈42° TILT · ICE MIGRATES EQUATORWARD',
        evidence: 'Orbital solutions robustly place Mars in high-obliquity regimes near 5 Ma, though exact deposit boundaries remain modeled.',
        source: 'https://doi.org/10.1038/nature03055', sourceLabel: 'MARS ICE SOURCE',
      },
      JUPITER: {
        title: 'JUPITER · ANOTHER WEATHER WORLD',
        text: 'A second independent band-and-eddy field again excludes the centuries-old modern Great Red Spot.',
        legend: '5 MA WEATHER SEED · NO MODERN RED SPOT',
        evidence: 'Jets can persist while individual storms and their exact colors, sizes and longitudes do not.',
        source: 'https://doi.org/10.1029/2024GL108993', sourceLabel: 'JUPITER WEATHER SOURCE',
      },
      SATURN: {
        title: 'SATURN · BRIGHT RINGS, NEW WEATHER',
        text: 'The bright ring system remains plausible while seasonal bands and storms use a separate modeled state.',
        legend: 'RINGS RETAINED · CLOUD PHASE RE-SEEDED',
        evidence: 'Saturn’s color bands, cloud height and storms vary on seasonal and shorter timescales.',
        source: 'https://science.nasa.gov/missions/hubble/hubble-sees-changing-seasons-on-saturn/', sourceLabel: 'SATURN WEATHER SOURCE',
      },
      URANUS: {
        title: 'URANUS · UNKNOWN SEASON',
        text: 'A second pale cyan field removes the present seasonal hood and re-seeds narrow atmospheric bands.',
        legend: 'SEASONAL APPEARANCE · PHASE NOT RECOVERED',
        evidence: 'Uranus’s polar cap and color change strongly over its long seasons.',
        source: 'https://doi.org/10.1093/mnras/stad3761', sourceLabel: 'URANUS SEASON SOURCE',
      },
      NEPTUNE: {
        title: 'NEPTUNE · CLOUDS RE-SEEDED',
        text: 'A distinct pale-blue map replaces short-lived vortices and does not preserve the 1989 Great Dark Spot.',
        legend: 'TRANSIENT VORTICES REMOVED',
        evidence: 'Neptune repeatedly forms and loses dark storms over only a few years.',
        source: 'https://doi.org/10.3847/1538-3881/ab0747', sourceLabel: 'NEPTUNE STORM SOURCE',
      },
    },
  },
  {
    id: 'present',
    label: 'NOW',
    ageMa: 0,
    date: 'PRESENT DAY',
    kind: 'OBSERVATION',
    phase: 'OBSERVED · JPL ORBITS',
    title: 'THE SOLAR SYSTEM NOW',
    text: 'Modern surface maps, Earth city lights and the observed ring systems return together.',
    legend: 'RINGS = PRESENT-DAY OBSERVATIONS',
    evidence: 'Spacecraft and telescopes directly constrain the present surfaces, atmosphere, rings and asteroid-belt population represented here.',
    caveat: 'Sizes and distances remain compressed for navigation; this state changes appearance, not the live orbital clock.',
    source: 'https://science.nasa.gov/solar-system/',
    sourceLabel: 'SOLAR SYSTEM SOURCE',
    star: { luminosityScale: 1 },
    belt: { visible: true, opacity: .75 },
    bodies: completeBodies(),
  },
]);

const SOL_EPOCH_BY_ID = new Map(SOL_EPOCHS.map((epoch) => [epoch.id, epoch]));

export function resolveSolEpoch(id = DEFAULT_SOL_EPOCH) {
  const key = typeof id === 'string' ? id.toLowerCase() : DEFAULT_SOL_EPOCH;
  return SOL_EPOCH_BY_ID.get(key) || SOL_EPOCH_BY_ID.get(DEFAULT_SOL_EPOCH);
}
