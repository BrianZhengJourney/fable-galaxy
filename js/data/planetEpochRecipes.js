/* Pure, deterministic recipe registry for modeled non-Earth Solar surfaces.
   Keeping this DOM/Three-free lets tests validate every epoch surface against
   the renderer's actual source of truth. */

export const PLANET_EPOCH_RECIPES = Object.freeze({
  'VENUS:modeled-clouds-1000ma': Object.freeze({
    kind: 'venus', base: '#c58d45', light: '#f0cf8a', dark: '#8b5a31',
    bands: 14, contrast: .24, storms: 18, polar: .20,
  }),
  'VENUS:modeled-clouds-5ma': Object.freeze({
    kind: 'venus', base: '#d3a55d', light: '#f5dcaa', dark: '#a16f39',
    bands: 16, contrast: .20, storms: 22, polar: .28,
  }),
  'MARS:modeled-ice-1000ma': Object.freeze({ kind: 'mars' }),
  'MARS:modeled-ice-5ma': Object.freeze({ kind: 'mars' }),
  'JUPITER:modeled-weather-1000ma': Object.freeze({
    kind: 'gas', base: '#b99b75', light: '#ead9ba', dark: '#78553c',
    accent: '#a77450', bands: 14, contrast: .31, storms: 24, polar: .08,
  }),
  'JUPITER:modeled-weather-5ma': Object.freeze({
    kind: 'gas', base: '#c8aa82', light: '#f0dfc2', dark: '#876044',
    accent: '#bd8760', bands: 12, contrast: .28, storms: 28, polar: .10,
  }),
  'SATURN:modeled-weather-1000ma': Object.freeze({
    kind: 'gas', base: '#c8b58c', light: '#eee2c2', dark: '#907a59',
    accent: '#b89b6f', bands: 10, contrast: .16, storms: 10, polar: .10,
  }),
  'SATURN:modeled-weather-5ma': Object.freeze({
    kind: 'gas', base: '#d5bf91', light: '#f4e7c5', dark: '#a0855e',
    accent: '#c4a474', bands: 11, contrast: .18, storms: 13, polar: .14,
  }),
  'URANUS:modeled-weather-1000ma': Object.freeze({
    kind: 'ice', base: '#94c8c7', light: '#c8e8e3', dark: '#669b9c',
    accent: '#7fb7b4', bands: 8, contrast: .10, storms: 6, polar: 0,
  }),
  'URANUS:modeled-weather-5ma': Object.freeze({
    kind: 'ice', base: '#9bcfd1', light: '#d2eeed', dark: '#6da4aa',
    accent: '#83bbc0', bands: 9, contrast: .11, storms: 8, polar: .05,
  }),
  'NEPTUNE:modeled-weather-1000ma': Object.freeze({
    kind: 'ice', base: '#7697bd', light: '#adc9df', dark: '#506f96',
    accent: '#91b3d1', bands: 9, contrast: .13, storms: 10, polar: .05,
  }),
  'NEPTUNE:modeled-weather-5ma': Object.freeze({
    kind: 'ice', base: '#7da0c5', light: '#b8d0e2', dark: '#55779d',
    accent: '#96b8d3', bands: 10, contrast: .14, storms: 12, polar: .07,
  }),
});

export const SUPPORTED_PLANET_EPOCH_SURFACES = Object.freeze(
  Object.keys(PLANET_EPOCH_RECIPES));

export function planetEpochSurfaceKey(bodyName, surface){
  return String(bodyName || '').toUpperCase() + ':' + String(surface || '');
}

export function getPlanetEpochRecipe(bodyName, surface){
  return PLANET_EPOCH_RECIPES[planetEpochSurfaceKey(bodyName, surface)] || null;
}
