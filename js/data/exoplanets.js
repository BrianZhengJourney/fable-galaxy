/* Confirmed exoplanets — values from the NASA Exoplanet Archive (2025),
   inlined so the app stays fully offline. periodDays are real, so relative
   orbital speeds are real; rEarth in Earth radii, massE in Earth masses
   (massJ in Jupiter masses where that's what's measured), teqK equilibrium
   temperature. Semi-major axes are display-compressed like everything else. */

export const EXOPLANETS = {
  'TRAPPIST-1': [
    { letter:'b', rEarth:1.116, massE:1.374, periodDays:1.5109,  teqK:400 },
    { letter:'c', rEarth:1.097, massE:1.308, periodDays:2.4218,  teqK:342 },
    { letter:'d', rEarth:0.788, massE:0.388, periodDays:4.0496,  teqK:288 },
    { letter:'e', rEarth:0.920, massE:0.692, periodDays:6.0996,  teqK:251 },
    { letter:'f', rEarth:1.045, massE:1.039, periodDays:9.2067,  teqK:219 },
    { letter:'g', rEarth:1.129, massE:1.321, periodDays:12.3529, teqK:199 },
    { letter:'h', rEarth:0.755, massE:0.326, periodDays:18.7729, teqK:167 }
  ],
  'PROXIMA CENTAURI': [
    { letter:'d', rEarth:0.81,  massE:0.26,  periodDays:5.122,   teqK:360 },
    { letter:'b', rEarth:1.03,  massE:1.07,  periodDays:11.184,  teqK:234 }
  ],
  'KEPLER-186': [
    { letter:'b', rEarth:1.07, periodDays:3.887,   teqK:580 },
    { letter:'c', rEarth:1.25, periodDays:7.267,   teqK:466 },
    { letter:'d', rEarth:1.40, periodDays:13.343,  teqK:378 },
    { letter:'e', rEarth:1.27, periodDays:22.408,  teqK:317 },
    { letter:'f', rEarth:1.17, periodDays:129.944, teqK:188 }
  ],
  '51 PEGASI': [
    { letter:'b', rEarth:13.5, massJ:0.46, periodDays:4.2308, teqK:1260, giant:true }
  ],
  'HD 209458': [
    { letter:'b', rEarth:15.5, massJ:0.73, periodDays:3.5247, teqK:1450, giant:true }
  ],
  'GLIESE 581': [
    { letter:'e', rEarth:1.17, massE:1.7,  periodDays:3.149,  teqK:530 },
    { letter:'b', rEarth:3.9,  massE:15.8, periodDays:5.369,  teqK:430, giant:true },
    { letter:'c', rEarth:1.9,  massE:5.5,  periodDays:12.919, teqK:320 }
  ],
  'TAU CETI': [
    { letter:'g', rEarth:1.36, massE:1.75, periodDays:20.0,   teqK:450 },
    { letter:'h', rEarth:1.30, massE:1.83, periodDays:49.41,  teqK:330 },
    { letter:'e', rEarth:1.45, massE:3.93, periodDays:162.87, teqK:284 },
    { letter:'f', rEarth:1.47, massE:3.93, periodDays:636.13, teqK:185 }
  ],
  'EPSILON ERIDANI': [
    { letter:'b', rEarth:12.7, massJ:0.66, periodDays:2502,   teqK:150, giant:true }
  ]
};
