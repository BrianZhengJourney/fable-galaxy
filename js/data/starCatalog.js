/* Named stars of the local neighbourhood, pinned into the procedural galaxy.
   Positions are galaxy-space units (hand-placed near Sol's arm, not to scale —
   real parsec spacing would put everything inside one pixel of a 100k-star disc).
   temp (K) drives color; lum in solar luminosities drives glow size. */

export const SOL_GALAXY_POS = [255, 2, 148];

export const STAR_CATALOG = [
  { name:'SOL',            cls:'G2V',  temp:5772,  mass:1.0,   radius:1.0,   lum:1.0,    pos:SOL_GALAXY_POS, sol:true },
  { name:'PROXIMA CENTAURI', cls:'M5.5Ve', temp:3042, mass:0.12, radius:0.15, lum:0.0017, pos:[261, 1, 141] },
  { name:'ALPHA CENTAURI', cls:'G2V',  temp:5790,  mass:1.1,   radius:1.22,  lum:1.5,    pos:[263, 3, 139] },
  { name:'BARNARD\'S STAR', cls:'M4V', temp:3134,  mass:0.14,  radius:0.20,  lum:0.0035, pos:[249, -2, 141] },
  { name:'WOLF 359',       cls:'M6.5V', temp:2800, mass:0.09,  radius:0.16,  lum:0.0014, pos:[247, 2, 152] },
  { name:'SIRIUS',         cls:'A1V',  temp:9940,  mass:2.06,  radius:1.71,  lum:25.4,   pos:[266, -4, 155] },
  { name:'EPSILON ERIDANI', cls:'K2V', temp:5084,  mass:0.82,  radius:0.74,  lum:0.34,   pos:[243, 4, 160] },
  { name:'TAU CETI',       cls:'G8.5V', temp:5344, mass:0.78,  radius:0.79,  lum:0.52,   pos:[240, -3, 148] },
  { name:'PROCYON',        cls:'F5IV', temp:6530,  mass:1.5,   radius:2.05,  lum:6.9,    pos:[270, 5, 148] },
  { name:'ALTAIR',         cls:'A7V',  temp:7550,  mass:1.79,  radius:1.63,  lum:10.6,   pos:[236, 6, 133] },
  { name:'VEGA',           cls:'A0V',  temp:9602,  mass:2.14,  radius:2.36,  lum:40,     pos:[230, 8, 168] },
  { name:'FOMALHAUT',      cls:'A3V',  temp:8590,  mass:1.92,  radius:1.84,  lum:16.6,   pos:[273, -7, 133] },
  { name:'POLLUX',         cls:'K0III', temp:4666, mass:1.9,   radius:8.8,   lum:33,     pos:[282, 3, 160] },
  { name:'ARCTURUS',       cls:'K1.5III', temp:4286, mass:1.1, radius:25.4,  lum:170,    pos:[228, -6, 122] },
  { name:'CAPELLA',        cls:'G8III', temp:4970, mass:2.57,  radius:11.98, lum:78.7,   pos:[289, 7, 141] },
  { name:'ALDEBARAN',      cls:'K5III', temp:3910, mass:1.16,  radius:44.1,  lum:439,    pos:[300, -4, 170] },
  { name:'CASTOR',         cls:'A1V',  temp:10286, mass:2.76,  radius:2.4,   lum:37,     pos:[286, 6, 166] },
  { name:'SPICA',          cls:'B1V',  temp:22400, mass:11.4,  radius:7.47,  lum:20500,  pos:[212, 4, 106] },
  { name:'REGULUS',        cls:'B8IVn', temp:12460, mass:3.8,  radius:4.35,  lum:316.2,  pos:[220, -8, 140] },
  { name:'ANTARES',        cls:'M1.5Iab', temp:3660, mass:12,  radius:680,   lum:75900,  pos:[192, -10, 176] },
  { name:'BETELGEUSE',     cls:'M1-2Ia', temp:3600, mass:16.5, radius:764,   lum:126000, pos:[312, 12, 128] },
  { name:'RIGEL',          cls:'B8Ia', temp:12100, mass:21,    radius:78.9,  lum:120000, pos:[322, -8, 148] },
  { name:'DENEB',          cls:'A2Ia', temp:8525,  mass:19,    radius:203,   lum:196000, pos:[178, 14, 200] },
  { name:'TRAPPIST-1',     cls:'M8V',  temp:2566,  mass:0.09,  radius:0.12,  lum:0.00055, pos:[252, -5, 165] },
  { name:'KEPLER-186',     cls:'M1V',  temp:3755,  mass:0.54,  radius:0.52,  lum:0.055,  pos:[205, 9, 190] },
  { name:'GLIESE 581',     cls:'M3V',  temp:3480,  mass:0.31,  radius:0.30,  lum:0.013,  pos:[244, -8, 172] },
  { name:'51 PEGASI',      cls:'G2IV', temp:5768,  mass:1.11,  radius:1.27,  lum:1.36,   pos:[268, 9, 172] },
  { name:'HD 209458',      cls:'G0V',  temp:6091,  mass:1.15,  radius:1.16,  lum:1.77,   pos:[288, -10, 184] },
  { name:'ZETA RETICULI',  cls:'G2V',  temp:5720,  mass:0.97,  radius:0.92,  lum:0.79,   pos:[233, -12, 186] },
  { name:'EPSILON INDI',   cls:'K5V',  temp:4630,  mass:0.75,  radius:0.71,  lum:0.22,   pos:[258, -9, 130] },
  { name:'PSR B1257+12',   cls:'PSR',  temp:28000, mass:1.4,   radius:0.00002, lum:0.005, pos:[196, -14, 158], pulsar:true },
  { name:'SAGITTARIUS A*', cls:'SMBH', temp:30000, mass:4150000, radius:17.6, lum:100000, pos:[0, 1, 0], blackhole:true }
];

/* binary companions rendered inside the system view */
export const COMPANIONS = {
  'ALPHA CENTAURI': { name:'ALPHA CEN B', cls:'K1V', temp:5260, radiusVis:2.9,
                      dist:1.35, period:29200 },
  'SIRIUS':         { name:'SIRIUS B', cls:'DA2 WHITE DWARF', temp:25000, radiusVis:0.9,
                      dist:1.5, period:18296 }
};

/* rough blackbody tint by temperature (K) → [r,g,b] 0..1 */
export function starColor(temp){
  if (temp >= 20000) return [0.62, 0.72, 1.0];
  if (temp >= 10000) return [0.72, 0.80, 1.0];
  if (temp >= 7500)  return [0.85, 0.90, 1.0];
  if (temp >= 6000)  return [1.0, 0.96, 0.90];
  if (temp >= 5200)  return [1.0, 0.90, 0.72];
  if (temp >= 3700)  return [1.0, 0.78, 0.52];
  return [1.0, 0.60, 0.42];
}
export function starColorHex(temp){
  const [r, g, b] = starColor(temp);
  return (Math.round(r*255) << 16) | (Math.round(g*255) << 8) | Math.round(b*255);
}
export function cssColor(rgb, a){
  return 'rgba(' + Math.round(rgb[0]*255) + ',' + Math.round(rgb[1]*255) + ',' +
         Math.round(rgb[2]*255) + ',' + a + ')';
}

/* star panel data */
export function starInfo(rec){
  const fmt = (v, u) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toPrecision(2)) + u;
  return {
    'SPECTRAL CLASS': rec.cls,
    'SURFACE TEMP': rec.temp.toLocaleString('en-US') + ' K',
    'MASS': fmt(rec.mass, ' M☉'),
    'RADIUS': fmt(rec.radius, ' R☉'),
    'LUMINOSITY': fmt(rec.lum, ' L☉')
  };
}
