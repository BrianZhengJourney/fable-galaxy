/* Infrared counterparts for landmark photos, registered (pixel-aligned) with
   the visible image so the volumetric exhibit can crossfade wavelengths the
   way the STScI "Pillars of Creation 3D" visualization does. Only add pairs
   that are genuinely aligned — e.g. ESA/Webb comparison-slider crops. */

const I = 'images/';

export const LANDMARK_IMAGES_IR = {
  'pillars-of-creation': {
    file: I + 'pillars-of-creation-ir.jpg',
    credit: "JWST NIRCam · NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer & A. Pagan (STScI) · CC BY 4.0",
  },
};

export function landmarkImageIR(id){ return LANDMARK_IMAGES_IR[id] || null; }
