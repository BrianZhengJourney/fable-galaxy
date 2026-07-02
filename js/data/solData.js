/* The home system — real bodies, real relative periods.
   Distances/visual radii are hand-compressed for legibility;
   periods (days) are real, so relative orbital speeds are real. */

export const SOL_STAR = {
  name: 'SOL', cls: 'G2V MAIN SEQUENCE', color: 0xffc65e,
  bright: '#ffdf9e', deep: '#ffc65e',
  coreRadius: 4.6, rotP: 25.4,
  info: {
    'RADIUS': '696,340 km', 'MASS': '1.989 ×10³⁰ kg', 'SURFACE TEMP': '5,505 °C',
    'SPECTRAL CLASS': 'G2V', 'ROTATION': '25.4 d', 'PLANETS': '8'
  }
};

export const SOL_BODIES = [
  { name:'MERCURY', cls:'ROCKY · INNER', r:0.42, dist:11,  period:87.97,  rotP:58.65,  tilt:0.03,
    phase:0.8,  view:5,  tex:{type:'cratered', base:'#8f8a84', dark:'#5c5751', light:'#b6b0a6'},
    info:{ 'RADIUS':'2,439.7 km', 'MASS':'3.301 ×10²³ kg', 'SURFACE TEMP':'167 °C',
           'ORBITAL PERIOD':'87.97 d', 'ROTATION':'58.65 d', 'MOONS':'0' } },
  { name:'VENUS', cls:'ROCKY · GREENHOUSE', r:0.85, dist:15, period:224.70, rotP:-243.02, tilt:177.4,
    phase:2.3,  view:7,  tex:{type:'venus', base:'#d8b06a', dark:'#a97f42', light:'#f0d9a8'},
    info:{ 'RADIUS':'6,051.8 km', 'MASS':'4.867 ×10²⁴ kg', 'SURFACE TEMP':'464 °C',
           'ORBITAL PERIOD':'224.7 d', 'ROTATION':'243 d RETRO', 'MOONS':'0' } },
  { name:'EARTH', cls:'ROCKY · TEMPERATE', r:0.9, dist:19.5, period:365.25, rotP:0.997, tilt:23.4,
    phase:4.1,  view:7,  tex:{type:'earth', base:'#1b4f8a', dark:'#0d2c55', light:'#3f8f5f'},
    moons:[{ r:0.24, dist:2.0, period:27.32 }],
    info:{ 'RADIUS':'6,371.0 km', 'MASS':'5.972 ×10²⁴ kg', 'SURFACE TEMP':'15 °C',
           'ORBITAL PERIOD':'365.25 d', 'ROTATION':'23.93 h', 'MOONS':'1' } },
  { name:'MARS', cls:'ROCKY · ARID', r:0.55, dist:24, period:686.98, rotP:1.026, tilt:25.2,
    phase:5.6,  view:6,  tex:{type:'mars', base:'#b4562e', dark:'#7c351c', light:'#dd8a58'},
    info:{ 'RADIUS':'3,389.5 km', 'MASS':'6.417 ×10²³ kg', 'SURFACE TEMP':'-63 °C',
           'ORBITAL PERIOD':'686.98 d', 'ROTATION':'24.62 h', 'MOONS':'2' } },
  { name:'JUPITER', cls:'GAS GIANT', r:2.6, dist:34, period:4332.6, rotP:0.414, tilt:3.1,
    phase:1.5,  view:12, tex:{type:'gas', base:'#c9a878', dark:'#8f6a44', light:'#e8d6b4', bands:9, spot:true},
    moons:[{ r:0.16, dist:3.6, period:1.77 },{ r:0.14, dist:4.3, period:3.55 },
           { r:0.22, dist:5.2, period:7.15 },{ r:0.20, dist:6.3, period:16.69 }],
    info:{ 'RADIUS':'69,911 km', 'MASS':'1.898 ×10²⁷ kg', 'SURFACE TEMP':'-110 °C',
           'ORBITAL PERIOD':'11.86 yr', 'ROTATION':'9.93 h', 'MOONS':'95' } },
  { name:'SATURN', cls:'GAS GIANT · RINGED', r:2.2, dist:43, period:10759, rotP:0.444, tilt:26.7,
    phase:3.9,  view:13, tex:{type:'gas', base:'#d9c28f', dark:'#a98d5c', light:'#f2e3bd', bands:7},
    rings:true,
    moons:[{ r:0.20, dist:5.8, period:15.95 },{ r:0.10, dist:4.6, period:4.52 }],
    info:{ 'RADIUS':'58,232 km', 'MASS':'5.683 ×10²⁶ kg', 'SURFACE TEMP':'-140 °C',
           'ORBITAL PERIOD':'29.46 yr', 'ROTATION':'10.66 h', 'MOONS':'146' } },
  { name:'URANUS', cls:'ICE GIANT', r:1.5, dist:52, period:30687, rotP:-0.718, tilt:97.8,
    phase:0.3,  view:9,  tex:{type:'ice', base:'#9fd8de', dark:'#6faeb8', light:'#cdeff2'},
    info:{ 'RADIUS':'25,362 km', 'MASS':'8.681 ×10²⁵ kg', 'SURFACE TEMP':'-195 °C',
           'ORBITAL PERIOD':'84.0 yr', 'ROTATION':'17.24 h RETRO', 'MOONS':'28' } },
  { name:'NEPTUNE', cls:'ICE GIANT', r:1.45, dist:60, period:60190, rotP:0.671, tilt:28.3,
    phase:2.9,  view:9,  tex:{type:'ice', base:'#3457c8', dark:'#20347f', light:'#6f8fe8', bands:4},
    info:{ 'RADIUS':'24,622 km', 'MASS':'1.024 ×10²⁶ kg', 'SURFACE TEMP':'-200 °C',
           'ORBITAL PERIOD':'164.8 yr', 'ROTATION':'16.11 h', 'MOONS':'16' } }
];

export const SOL_SYSTEM = {
  star: SOL_STAR,
  bodies: SOL_BODIES,
  belt: { inner: 27, outer: 31.5, count: 4200, seed: 'sol-belt' },   // between Mars & Jupiter
  comet: { a: 44, e: 0.72, period: 1900, incl: 0.30, node: 1.1, phase: 2.6 },
  extent: 72
};
