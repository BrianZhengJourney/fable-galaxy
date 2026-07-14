/* Carina is a sequence of scientifically distinct views, not one photograph
   pushed through six filters.  The Hubble mosaic, Webb's Cosmic Cliffs and the
   Eta Carinae close-up are separate fields; switching moments is therefore a
   hard state change.  The Webb and concept-future states turn its registered
   photograph into source/depth-registered triangulated reliefs. */

import * as THREE from 'three';
import { mulberry, hashStr, gaussian } from '../../utils/rng.js';
import { loadTexture } from '../../utils/assets.js';
import { TEX_TIER } from '../../core/quality.js';
import { ResourceScope } from './resourceScope.js';
import { buildPhotoRelief } from './nebulaMatter.js';

const ASSETS = Object.freeze({
  webb: TEX_TIER === 'low'
    ? 'images/carina-nebula.jpg'
    : 'images/carina/cosmic-cliffs-webb-nircam-miri.jpg',
  webbDepth: 'images/depth/carina-nebula.png',
  hubble: 'images/carina/carina-hubble-2007.jpg',
  etaUv: 'images/carina/eta-carinae-uv-2019.png',
  etaModel: 'models/carina/eta-carinae-homunculus.stl',
});

export const CARINA_STATES = Object.freeze({
  FORMATION: 'formation',
  LOCATOR: 'locator',
  ETA_ERUPTION: 'eta-eruption',
  HUBBLE: 'hubble-panorama',
  WEBB: 'webb-cliffs',
  FUTURE: 'future-erosion',
});

const BUDGET = Object.freeze(TEX_TIER === 'low' ? {
  photoLongSide: 176,
  alignedStars: 260,
  formationCliffColumns: 84,
  formationCliffRows: 38,
  formationPillarRadial: 30,
  formationPillarRings: 28,
  formationDustKnots: 220,
  formationFilaments: 11,
  homunculusRadial: 34,
  homunculusRings: 28,
  homunculusDustKnots: 150,
  reliefTriangles: 6200,
  dustTriangles: 1700,
  futureTriangles: 4100,
  futureDustTriangles: 1100,
} : {
  photoLongSide: 320,
  alignedStars: 720,
  formationCliffColumns: 168,
  formationCliffRows: 72,
  formationPillarRadial: 52,
  formationPillarRings: 48,
  formationDustKnots: 620,
  formationFilaments: 24,
  homunculusRadial: 58,
  homunculusRings: 46,
  homunculusDustKnots: 340,
  reliefTriangles: 19000,
  dustTriangles: 4800,
  futureTriangles: 12200,
  futureDustTriangles: 3200,
});

const PHOTO_WIDTH = 108;
const WEBB_ASPECT = 11264 / 3904;
const HUBBLE_ASPECT = 4000 / 1937;
const HALF_PI = Math.PI / 2;
const CARINA_PRESENTATION_CREDITS = Object.freeze({
  [CARINA_STATES.FORMATION]: Object.freeze({
    label: 'MODEL',
    text: 'Procedural scientific 3D reconstruction · molecular-cliff depth, cavity layout, star placement and fine structure are interpretive',
  }),
  [CARINA_STATES.LOCATOR]: Object.freeze({
    label: 'SCHEMATIC',
    text: 'Modern schematic locator · not Lacaille’s original 1752 view',
  }),
  [CARINA_STATES.ETA_ERUPTION]: Object.freeze({
    label: 'OBSERVATION + MODEL',
    text: '3D Homunculus shape model: Steffen, Teodoro, Madura et al. (2014) · Hubble UV (March/July 2018): NASA, ESA, N. Smith and J. Morse',
  }),
  [CARINA_STATES.HUBBLE]: Object.freeze({
    label: 'OBSERVATION + MODEL',
    text: 'Hubble 2007 Carina mosaic: NASA, ESA, N. Smith and the Hubble Heritage Team (STScI/AURA) · CC BY 4.0 · off-axis depth is interpretive',
  }),
  [CARINA_STATES.WEBB]: Object.freeze({
    label: 'OBSERVATION + MODEL',
    text: 'Webb Cosmic Cliffs NIRCam + MIRI: NASA, ESA, CSA, STScI · CC BY 4.0 · off-axis depth is interpretive',
  }),
  [CARINA_STATES.FUTURE]: Object.freeze({
    label: 'MODEL',
    text: 'Illustrative future-erosion model derived from the Webb Cosmic Cliffs source/depth structure · no fixed prediction date',
  }),
});
const CARINA_OBSERVATION_STATES = new Set([
  CARINA_STATES.ETA_ERUPTION,
  CARINA_STATES.HUBBLE,
  CARINA_STATES.WEBB,
]);

const WEBB_RELIEF_PROFILE = Object.freeze({
  volume: Object.freeze({ depth: 34, depthScale: 1 }),
  palette: Object.freeze({ dust: 0x160b18 }),
  matter: Object.freeze({
    cloudSuppression: .97,
    filamentBias: .96,
    silhouetteBias: .94,
    edgeGain: 3.25,
    edgeExponent: 1.16,
    gasThreshold: .048,
    dustThreshold: .47,
    gasOpacity: .88,
    dustOpacity: .96,
    alphaCutoff: .018,
    saturation: 1.38,
    depthJitter: .014,
  }),
  reconstruction: Object.freeze({
    mode: 'source-depth-triangulated-relief',
    foreground: 'molecular-cliff-silhouette',
    emission: 'irradiated-cavity-lip-and-photoevaporation-front',
    genericSoftClouds: false,
    genericPointClouds: false,
  }),
});

const FUTURE_RELIEF_PROFILE = Object.freeze({
  volume: Object.freeze({ depth: 40, depthScale: 1.12 }),
  palette: Object.freeze({ dust: 0x170a16 }),
  matter: Object.freeze({
    cloudSuppression: .985,
    filamentBias: 1,
    silhouetteBias: .98,
    edgeGain: 3.5,
    edgeExponent: 1.12,
    gasThreshold: .062,
    dustThreshold: .50,
    gasOpacity: .78,
    dustOpacity: .90,
    alphaCutoff: .024,
    saturation: 1.48,
    depthJitter: .012,
  }),
  reconstruction: Object.freeze({
    mode: 'conceptual-eroded-triangulated-relief',
    basis: 'registered-webb-source-and-depth',
    genericSoftClouds: false,
    genericPointClouds: false,
  }),
});

const HUBBLE_RELIEF_PROFILE = Object.freeze({
  volume: Object.freeze({ depth: 27, depthScale: .92 }),
  palette: Object.freeze({ dust: 0x120a16 }),
  matter: Object.freeze({
    cloudSuppression: .975,
    filamentBias: .98,
    silhouetteBias: .96,
    edgeGain: 3.2,
    edgeExponent: 1.22,
    gasThreshold: .052,
    dustThreshold: .46,
    gasOpacity: .82,
    dustOpacity: .94,
    alphaCutoff: .022,
    saturation: 1.30,
    depthJitter: .016,
  }),
  reconstruction: Object.freeze({
    mode: 'source-derived-triangulated-relief',
    basis: 'Hubble RGB structure; off-axis depth is interpretive',
    genericSoftClouds: false,
    genericPointClouds: false,
  }),
});

function clamp01(value){ return Math.max(0, Math.min(1, value)); }
function smoothstep(a, b, value){
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function makeSoftDisc(){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.22, 'rgba(255,255,255,.82)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  return new THREE.CanvasTexture(canvas);
}

function makeFallbackTexture(color){
  const c = new THREE.Color(color);
  const data = new Uint8Array([
    Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255,
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeEdgeMask(){
  const size = 96;
  const data = new Uint8Array(size*size*4);
  for (let y = 0; y < size; y++){
    for (let x = 0; x < size; x++){
      const edge = Math.min(x,y,size-1-x,size-1-y)/(size*.055);
      const value = Math.round(smoothstep(0,1,edge)*255);
      const offset = (y*size+x)*4;
      data[offset] = data[offset+1] = data[offset+2] = value;
      data[offset+3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function makeSourceDerivedDepth(image){
  const width = Math.min(720,Math.max(64,image.width || 720));
  const height = Math.max(32,Math.round(width/
    Math.max(.01,(image.width || width)/Math.max(1,image.height || width))));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,0,0,width,height);
  const frame = context.getImageData(0,0,width,height);
  for (let offset = 0; offset < frame.data.length; offset += 4){
    const light = (.299*frame.data[offset]+.587*frame.data[offset+1]+
      .114*frame.data[offset+2])/255;
    const depth = Math.round(clamp01(.28+(1-light)*.54)*255);
    frame.data[offset] = frame.data[offset+1] = frame.data[offset+2] = depth;
    frame.data[offset+3] = 255;
  }
  context.putImageData(frame,0,0);
  return canvas;
}

function makeCaption(text, subtext, width = 54){
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 152;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(3,8,18,.88)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(91,225,255,.58)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.fillStyle = '#ddf8ff';
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText(text, 34, 61);
  ctx.fillStyle = '#8db8c9';
  ctx.font = '23px system-ui, sans-serif';
  ctx.fillText(subtext, 34, 111);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width * 152 / 1024), material);
}

function makePhotoPlate(scope, parent, {
  url, aspect, width, x = 0, y = 0, z = 0, onTexture = null,
}){
  const fallback = scope.own(makeFallbackTexture(0x08101b));
  const edgeMask = scope.own(makeEdgeMask());
  const material = new THREE.MeshBasicMaterial({
    map: fallback,
    alphaMap: edgeMask,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  // Loaded photographs belong to the global texture cache and are evicted by
  // the application, rather than by this scene traversal.
  material.userData.keepMaps = true;
  const height = width / aspect;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, z);
  mesh.renderOrder = 20;
  parent.add(mesh);
  loadTexture(url, scope.guard(texture => {
    material.map = texture;
    material.needsUpdate = true;
    mesh.userData.photoReady = true;
    if (onTexture) onTexture(texture);
  }));
  return { mesh, material, width, height };
}

function addCaption(parent, caption, x, y, z = 2){
  caption.position.set(x, y, z);
  caption.renderOrder = 24;
  parent.add(caption);
  return caption;
}

function setCaptionOpacity(caption, opacity){
  if (!caption || !caption.material) return;
  caption.material.opacity = opacity;
  caption.visible = opacity > .01;
}

const DUST_SHADOW = new THREE.Color(0x160c14);
const DUST_TEAL = new THREE.Color(0x174857);
const DUST_MID = new THREE.Color(0x54253c);
const DUST_MAGENTA = new THREE.Color(0x8b3164);
const DUST_WARM = new THREE.Color(0xb95d48);
const IONIZED_BLUE = new THREE.Color(0x239eb7);
const IONIZED_GOLD = new THREE.Color(0xd8783d);
const IONIZED_MAGENTA = new THREE.Color(0xb83979);
const FORMATION_CAVITIES = Object.freeze([
  Object.freeze({ x: -43, v: .54, rx: 5.3, ry: .11 }),
  Object.freeze({ x: -27, v: .36, rx: 4.8, ry: .10 }),
  Object.freeze({ x: -3, v: .61, rx: 6.4, ry: .15 }),
  Object.freeze({ x: 21, v: .43, rx: 5.5, ry: .12 }),
  Object.freeze({ x: 40, v: .69, rx: 4.1, ry: .12 }),
]);

function fract(value){ return value-Math.floor(value); }

function noiseCell(x, y, phase){
  return fract(Math.sin(x*127.1+y*311.7+phase*73.13)*43758.5453123);
}

function valueNoise(x, y, phase = 0){
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x-ix, fy = y-iy;
  const sx = fx*fx*(3-2*fx), sy = fy*fy*(3-2*fy);
  const a = noiseCell(ix,iy,phase), b = noiseCell(ix+1,iy,phase);
  const c = noiseCell(ix,iy+1,phase), d = noiseCell(ix+1,iy+1,phase);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,sx),
    THREE.MathUtils.lerp(c,d,sx),sy);
}

function cliffFbm(x, y, phase = 0){
  return valueNoise(x,y,phase)*.52
    +valueNoise(x*2.03,y*2.07,phase+1.7)*.29
    +valueNoise(x*4.11,y*4.03,phase+4.1)*.19;
}

function formationCliffHeight(x){
  let height = -12
    + Math.sin(x*.092+1.4)*3.4
    + Math.sin(x*.225-2.1)*1.9
    + Math.sin(x*.47+.7)*.72
    +(cliffFbm(x*.11,2.7,3.2)-.5)*5.2;
  const peaks = [
    [-34,15,7.2],[-12,24,8.5],[10,12,6.4],[31,19,7.1],[45,9,5.2],
  ];
  for (const [center,lift,width] of peaks){
    const distance = (x-center)/width;
    height += lift*Math.exp(-distance*distance);
  }
  return height;
}

function cliffSurfaceZ(x, vertical, back = false){
  const broad = (cliffFbm(x*.052,vertical*3.4,8.1)-.5)*8.6;
  const crags = (cliffFbm(x*.19,vertical*11.8,12.4)-.5)*3.2;
  const strata = Math.sin(x*.23+vertical*31.0)*.74
    +Math.sin(x*.69-vertical*52.0)*.28;
  const ridge = Math.pow(1-Math.abs(valueNoise(x*.14,vertical*9.3,17.2)*2-1),4)*2.2;
  const overhang = smoothstep(.72,1,vertical)*(2.4+2.2*valueNoise(x*.1,4.2,6.9));
  const undercut = Math.pow(1-vertical,1.45)*3.6;
  return back ? -15.8+broad*.13+crags*.08
    : .4+broad+crags+strata+ridge+overhang-undercut;
}

function dustColor(vertical, x, z, back = false){
  const ridge = cliffFbm(x*.15,vertical*10.4,5.7);
  const strata = .5+.5*Math.sin(x*.28+z*.54+vertical*43.0);
  const lit = clamp01(.08+smoothstep(.06,.96,vertical)*(.48+.34*ridge)+strata*.16);
  const color = DUST_SHADOW.clone().lerp(DUST_TEAL,.18+.24*(1-ridge));
  color.lerp(DUST_MID,.16+lit*.42);
  color.lerp(DUST_MAGENTA,.22+.30*(.5+.5*Math.sin(x*.08+vertical*8.0)));
  color.lerp(DUST_WARM,Math.pow(lit,2.2)*.46);
  color.multiplyScalar(.62+.46*strata);
  const exposedCrest = smoothstep(.84,1,vertical);
  color.lerp(DUST_MAGENTA,exposedCrest*.34);
  color.lerp(DUST_WARM,exposedCrest*.12);
  color.multiplyScalar(1-exposedCrest*.30);
  if (back) color.multiplyScalar(.42);
  return color;
}

function insideFormationCavity(x, vertical, inset = 1){
  return FORMATION_CAVITIES.some(cavity => {
    const dx = (x-cavity.x)/(cavity.rx*inset);
    const dy = (vertical-cavity.v)/(cavity.ry*inset);
    return dx*dx+dy*dy < 1;
  });
}

function makeSculptedDustCliff(){
  const columns = BUDGET.formationCliffColumns;
  const rows = BUDGET.formationCliffRows;
  const positions = [], colors = [], indices = [];
  const stride = rows+1;
  const bottom = -39;
  for (let side = 0; side < 2; side++){
    for (let column = 0; column <= columns; column++){
      const x = -52+column/columns*104;
      const top = formationCliffHeight(x);
      for (let row = 0; row <= rows; row++){
        const vertical = row/rows;
        const edgeFade = Math.sin(Math.PI*vertical);
        const px = x+(cliffFbm(x*.16,vertical*8.2,21.1)-.5)*2.15*edgeFade;
        const y = THREE.MathUtils.lerp(bottom,top,vertical)
          +(cliffFbm(x*.23,vertical*13.4,25.2)-.5)*1.15*edgeFade;
        const z = cliffSurfaceZ(x,vertical,side === 1);
        positions.push(px,y,z);
        const color = dustColor(vertical,px,z,side === 1);
        colors.push(color.r,color.g,color.b);
      }
    }
  }
  const sideOffset = (columns+1)*stride;
  for (let column = 0; column < columns; column++){
    for (let row = 0; row < rows; row++){
      const a = column*stride+row;
      const b = a+stride, c = a+1, d = b+1;
      const centerX = -52+(column+.5)/columns*104;
      const centerV = (row+.5)/rows;
      if (!insideFormationCavity(centerX,centerV,.96))
        indices.push(a,b,c,c,b,d);
      const ba = sideOffset+a, bb = sideOffset+b, bc = sideOffset+c, bd = sideOffset+d;
      indices.push(ba,bc,bb,bc,bd,bb);
    }
    const frontTop = column*stride+rows;
    const nextFrontTop = frontTop+stride;
    const backTop = sideOffset+frontTop;
    const nextBackTop = backTop+stride;
    indices.push(frontTop,nextBackTop,backTop,frontTop,nextFrontTop,nextBackTop);
    const frontBottom = column*stride;
    const nextFrontBottom = frontBottom+stride;
    const backBottom = sideOffset+frontBottom;
    const nextBackBottom = backBottom+stride;
    indices.push(frontBottom,backBottom,nextBackBottom,frontBottom,nextBackBottom,nextFrontBottom);
  }
  for (const column of [0,columns]){
    for (let row = 0; row < rows; row++){
      const front = column*stride+row;
      const next = front+1;
      const back = sideOffset+front;
      const backNext = back+1;
      if (column === 0) indices.push(front,next,back,back,next,backNext);
      else indices.push(front,back,next,back,next,backNext);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.scientificRole = 'sculpted-molecular-cloud-cliff';
  const material = new THREE.MeshStandardMaterial({
    name: 'Carina.FormationDustCliffMaterial',
    vertexColors: true,
    roughness: .91,
    metalness: 0,
    emissive: 0x13080a,
    emissiveIntensity: .48,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = 'sculpted-molecular-dust-cliff';
  mesh.renderOrder = 2;
  return mesh;
}

function makeIonizedCliffCrest(){
  const columns = BUDGET.formationCliffColumns;
  const positions = [], colors = [], indices = [];
  for (let column = 0; column < columns; column++){
    const x0 = -52+column/columns*104;
    const x1 = -52+(column+1)/columns*104;
    const energy = cliffFbm(column*.19,3.8,31.2);
    const broken = energy < .43 || Math.sin(column*.74)+Math.sin(column*.19+2.2) < -.82;
    if (broken) continue;
    const thickness = .0035+.009*energy;
    const base = positions.length/3;
    for (const x of [x0,x1]){
      const top = formationCliffHeight(x);
      for (const vertical of [1,1-thickness]){
        const edgeFade = Math.sin(Math.PI*vertical);
        const px = x+(cliffFbm(x*.16,vertical*8.2,21.1)-.5)*2.15*edgeFade;
        const y = THREE.MathUtils.lerp(-39,top,vertical)+.16;
        const z = cliffSurfaceZ(x,vertical,false)+.38;
        positions.push(px,y,z);
        let color;
        const palette = fract(column*.173+energy*.61);
        if (palette < .34) color = IONIZED_BLUE.clone().lerp(IONIZED_MAGENTA,palette/.34*.46);
        else if (palette < .69) color = IONIZED_MAGENTA.clone().lerp(IONIZED_GOLD,(palette-.34)/.35);
        else color = IONIZED_GOLD.clone().lerp(IONIZED_BLUE,(palette-.69)/.31*.55);
        color.multiplyScalar(.38+.24*energy);
        colors.push(color.r,color.g,color.b);
      }
    }
    indices.push(base,base+2,base+1,base+1,base+2,base+3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    name: 'Carina.PhotoevaporationFrontMaterial',
    vertexColors: true,
    transparent: true,
    opacity: .34,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = 'filled-photoevaporation-front';
  mesh.renderOrder = 5;
  return mesh;
}

function makeFormationCavityRims(){
  const angular = TEX_TIER === 'low' ? 28 : 48;
  const positions = [], colors = [], indices = [];
  for (let cavityIndex = 0; cavityIndex < FORMATION_CAVITIES.length; cavityIndex++){
    const cavity = FORMATION_CAVITIES[cavityIndex];
    const base = positions.length/3;
    for (let segment = 0; segment <= angular; segment++){
      const angle = segment/angular*Math.PI*2;
      for (let edge = 0; edge < 2; edge++){
        const expand = edge ? .91 : 1.18;
        const x = cavity.x+Math.cos(angle)*cavity.rx*expand;
        const vertical = cavity.v+Math.sin(angle)*cavity.ry*expand;
        const top = formationCliffHeight(x);
        const y = THREE.MathUtils.lerp(-39,top,vertical);
        const z = cliffSurfaceZ(x,vertical,false)+(edge ? -1.15 : .18);
        positions.push(x,y,z);
        const lightSide = smoothstep(-.6,.9,Math.sin(angle+.72));
        const color = DUST_SHADOW.clone().lerp(
          cavityIndex%3 === 0 ? IONIZED_BLUE
            : cavityIndex%3 === 1 ? IONIZED_MAGENTA : IONIZED_GOLD,
          (edge ? .12 : .28)*lightSide);
        color.lerp(DUST_WARM,.12*(1-lightSide));
        colors.push(color.r,color.g,color.b);
      }
    }
    for (let segment = 0; segment < angular; segment++){
      const a = base+segment*2, b = a+2;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.scientificRole = 'eroded-overhang-and-cavity-linings';
  const material = new THREE.MeshStandardMaterial({
    name: 'Carina.FormationCavityRimMaterial',
    vertexColors: true,
    emissive: 0x16080d,
    emissiveIntensity: .62,
    roughness: .93,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const rims = new THREE.Mesh(geometry,material);
  rims.name = 'recessed-eroded-cavity-overhangs';
  rims.renderOrder = 4;
  return rims;
}

function makeFormationDustKnots(scope){
  const geometry = new THREE.IcosahedronGeometry(1,0);
  geometry.userData.scientificRole = 'dense-molecular-knot-prototype';
  const material = new THREE.MeshStandardMaterial({
    name: 'Carina.FormationDustKnotMaterial',
    color: 0xffffff,
    emissive: 0x18080b,
    emissiveIntensity: .54,
    roughness: .97,
    metalness: 0,
  });
  const knots = scope.own(
    new THREE.InstancedMesh(geometry,material,BUDGET.formationDustKnots));
  knots.name = 'dense-molecular-cliff-knots';
  knots.userData.instanceRole = 'mesh-based-molecular-knot-detail';
  const rnd = mulberry(hashStr('carina:formation:cliff-knots'));
  const dummy = new THREE.Object3D();
  let written = 0;
  for (let attempts = 0; written < BUDGET.formationDustKnots && attempts < BUDGET.formationDustKnots*4; attempts++){
    const x = -50+rnd()*100;
    const vertical = .08+Math.pow(rnd(),.72)*.91;
    if (insideFormationCavity(x,vertical,1.12)) continue;
    const top = formationCliffHeight(x);
    const y = THREE.MathUtils.lerp(-39,top,vertical)
      +(cliffFbm(x*.23,vertical*13.4,25.2)-.5)*1.15*Math.sin(Math.PI*vertical);
    const z = cliffSurfaceZ(x,vertical,false)+.2+rnd()*.52;
    dummy.position.set(x,y,z);
    dummy.rotation.set(rnd()*Math.PI,rnd()*Math.PI,rnd()*Math.PI);
    const scale = .12+Math.pow(rnd(),2.35)*.78;
    dummy.scale.set(scale*(.55+rnd()*.95),scale*(.28+rnd()*.72),scale*(.30+rnd()*.64));
    dummy.updateMatrix();
    knots.setMatrixAt(written,dummy.matrix);
    const palette = rnd();
    const color = palette < .18 ? DUST_TEAL.clone()
      : palette < .34 ? DUST_MAGENTA.clone()
      : palette < .88 ? DUST_MID.clone() : DUST_WARM.clone();
    knots.setColorAt(written,color.multiplyScalar(.72+rnd()*.44));
    written++;
  }
  knots.count = written;
  knots.instanceMatrix.needsUpdate = true;
  if (knots.instanceColor) knots.instanceColor.needsUpdate = true;
  knots.renderOrder = 5;
  return knots;
}

function makeFormationFilaments(){
  const rnd = mulberry(hashStr('carina:formation:surface-filaments'));
  const positions = [], colors = [], indices = [];
  const segments = TEX_TIER === 'low' ? 10 : 18;
  for (let filament = 0; filament < BUDGET.formationFilaments; filament++){
    const startX = -48+rnd()*96;
    const startV = .13+rnd()*.54;
    const extent = .14+rnd()*.30;
    const drift = gaussian(rnd)*9.5;
    const width = .09+rnd()*.24;
    const base = positions.length/3;
    const tone = filament%3 === 0 ? IONIZED_BLUE
      : filament%3 === 1 ? IONIZED_MAGENTA : IONIZED_GOLD;
    for (let segment = 0; segment <= segments; segment++){
      const t = segment/segments;
      const vertical = clamp01(startV+t*extent);
      const x = startX+drift*t+Math.sin(t*Math.PI*3+filament)*1.2*(1-t);
      const top = formationCliffHeight(x);
      const y = THREE.MathUtils.lerp(-39,top,vertical);
      const z = cliffSurfaceZ(x,vertical,false)+.52;
      const tangentX = width*(.35+.65*Math.sin(Math.PI*t));
      for (const side of [-1,1]){
        positions.push(x+side*tangentX,y,z+side*.035);
        const color = tone.clone().multiplyScalar((.34+.38*Math.sin(Math.PI*t))*(.78+rnd()*.22));
        colors.push(color.r,color.g,color.b);
      }
    }
    for (let segment = 0; segment < segments; segment++){
      const a = base+segment*2, b = a+2;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.scientificRole = 'irradiated-surface-filament-ribbons';
  const material = new THREE.MeshBasicMaterial({
    name: 'Carina.FormationFilamentMaterial',
    vertexColors: true,
    transparent: true,
    opacity: .62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const filaments = new THREE.Mesh(geometry,material);
  filaments.name = 'filled-irradiated-filament-ribbons';
  filaments.renderOrder = 6;
  return filaments;
}

function pillarRadius(t, baseRadius, phase, angle){
  const taper = THREE.MathUtils.lerp(baseRadius,baseRadius*.22,Math.pow(t,.82));
  const crown = baseRadius*.30*Math.exp(-Math.pow((t-.83)/.15,2));
  const scallop = 1+.075*Math.sin(angle*5+t*12+phase)
    +.035*Math.sin(angle*11-t*21-phase*.6);
  return (taper+crown)*scallop;
}

function makeErodedDustPillar(seed, { x, y, z, height, radius, lean = 1 }){
  const radial = BUDGET.formationPillarRadial;
  const rings = BUDGET.formationPillarRings;
  const phase = (hashStr(seed)%1009)/1009*Math.PI*2;
  const positions = [], colors = [], indices = [];
  for (let ring = 0; ring <= rings; ring++){
    const t = ring/rings;
    const centerX = x+Math.sin(t*Math.PI*.82+phase)*lean*t;
    const centerZ = z+Math.cos(t*Math.PI*.73+phase)*lean*.46*t;
    for (let segment = 0; segment <= radial; segment++){
      const angle = segment/radial*Math.PI*2;
      const r = pillarRadius(t,radius,phase,angle);
      const verticalRipple = Math.sin(t*28+angle*3+phase)*.16;
      const px = centerX+Math.cos(angle)*r;
      const py = y+t*height+verticalRipple;
      const pz = centerZ+Math.sin(angle)*r*.82;
      positions.push(px,py,pz);
      const lit = clamp01(.18+t*.72+.13*Math.cos(angle-.65));
      const color = DUST_SHADOW.clone().lerp(DUST_MID,.30+lit*.48)
        .lerp(DUST_WARM,Math.pow(lit,2)*.55);
      if (t > .82){
        color.lerp(DUST_MAGENTA,smoothstep(.82,1,t)*.38);
        color.multiplyScalar(.74);
      }
      colors.push(color.r,color.g,color.b);
    }
  }
  const stride = radial+1;
  for (let ring = 0; ring < rings; ring++){
    for (let segment = 0; segment < radial; segment++){
      const a = ring*stride+segment, b = a+stride;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.scientificRole = 'eroded-molecular-dust-pillar';
  const material = new THREE.MeshStandardMaterial({
    name: 'Carina.ErodedPillarMaterial',
    vertexColors: true,
    roughness: .94,
    metalness: 0,
    emissive: 0x110609,
    emissiveIntensity: .42,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = 'sculpted-eroded-dust-pillar';
  mesh.renderOrder = 3;

  const capCenter = geometry.attributes.position.count;
  const finalRing = rings*stride;
  const capPositions = Array.from(geometry.attributes.position.array);
  const capColors = Array.from(geometry.attributes.color.array);
  let capX = 0, capY = 0, capZ = 0;
  for (let segment = 0; segment < radial; segment++){
    capX += capPositions[(finalRing+segment)*3];
    capY += capPositions[(finalRing+segment)*3+1];
    capZ += capPositions[(finalRing+segment)*3+2];
  }
  capPositions.push(capX/radial,capY/radial+.08,capZ/radial);
  const capColor = DUST_MAGENTA.clone().lerp(DUST_WARM,.34).multiplyScalar(.56);
  capColors.push(capColor.r,capColor.g,capColor.b);
  const cappedIndices = Array.from(geometry.index.array);
  for (let segment = 0; segment < radial; segment++)
    cappedIndices.push(finalRing+segment,capCenter,finalRing+segment+1);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(capPositions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(capColors,3));
  geometry.setIndex(cappedIndices);
  geometry.computeVertexNormals();

  const rimPositions = [], rimColors = [], rimIndices = [];
  const rimRings = 8;
  for (let ring = 0; ring <= rimRings; ring++){
    const t = .72+ring/rimRings*.28;
    const centerX = x+Math.sin(t*Math.PI*.82+phase)*lean*t;
    const centerZ = z+Math.cos(t*Math.PI*.73+phase)*lean*.46*t;
    for (let segment = 0; segment <= radial; segment++){
      const angle = segment/radial*Math.PI*2;
      const r = pillarRadius(t,radius,phase,angle)+.26;
      rimPositions.push(
        centerX+Math.cos(angle)*r,
        y+t*height+.25,
        centerZ+Math.sin(angle)*r*.84+.25);
      const windward = smoothstep(-.3,.88,Math.cos(angle-.62));
      const color = IONIZED_BLUE.clone().lerp(IONIZED_GOLD,.28+.46*windward);
      rimColors.push(color.r,color.g,color.b);
    }
  }
  for (let ring = 0; ring < rimRings; ring++){
    for (let segment = 0; segment < radial; segment++){
      const a = ring*stride+segment, b = a+stride;
      rimIndices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const rimGeometry = new THREE.BufferGeometry();
  rimGeometry.setAttribute('position',new THREE.Float32BufferAttribute(rimPositions,3));
  rimGeometry.setAttribute('color',new THREE.Float32BufferAttribute(rimColors,3));
  rimGeometry.setIndex(rimIndices);
  rimGeometry.computeVertexNormals();
  const rimMaterial = new THREE.MeshBasicMaterial({
    name: 'Carina.PillarIonizedSkinMaterial',
    vertexColors: true,
    transparent: true,
    opacity: .17,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const rim = new THREE.Mesh(rimGeometry,rimMaterial);
  rim.name = 'ionized-pillar-crown-skin';
  rim.renderOrder = 4;
  return { mesh, rim };
}

function makeGlow(softMap, color, scale){
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softMap,
    color,
    transparent: true,
    opacity: .9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

function makeNebulaGlow(softMap, { color, width, height, opacity, x, y, z, rotation = 0 }){
  const glow = makeGlow(softMap,color,1);
  glow.scale.set(width,height,1);
  glow.position.set(x,y,z);
  glow.material.opacity = opacity;
  glow.material.rotation = rotation;
  glow.renderOrder = 0;
  glow.userData.nebularIllumination = true;
  return glow;
}

function buildFormation(scope, parent, softMap){
  const sculpture = new THREE.Group();
  sculpture.name = 'carina-sculpted-feedback-front';
  sculpture.add(
    makeSculptedDustCliff(),
    makeFormationCavityRims(),
    makeIonizedCliffCrest(),
    makeFormationDustKnots(scope),
    makeFormationFilaments(),
  );
  const pillarSpecs = [
    ['carina:pillar:west',-34,-25,-1,30,5.8,2.4],
    ['carina:pillar:central',-13,-26,-2,43,7.2,3.4],
    ['carina:pillar:east',15,-27,1,32,5.5,2.0],
    ['carina:pillar:far-east',36,-28,-3,39,6.4,2.8],
  ];
  const pillars = [];
  for (const [seed,x,y,z,height,radius,lean] of pillarSpecs){
    const pillar = makeErodedDustPillar(seed,{x,y,z,height,radius,lean});
    sculpture.add(pillar.mesh,pillar.rim);
    pillars.push(pillar);
  }
  sculpture.userData.morphology = 'indexed-cliff-pillars-and-filled-ionization-fronts';
  sculpture.userData.genericSoftClouds = false;
  parent.add(sculpture);

  const nebulaGlows = [
    makeNebulaGlow(softMap,{color:0x1a7b88,width:72,height:45,opacity:.085,x:-24,y:7,z:-22,rotation:.18}),
    makeNebulaGlow(softMap,{color:0x8a285d,width:68,height:39,opacity:.075,x:24,y:-1,z:-19,rotation:-.28}),
    makeNebulaGlow(softMap,{color:0xb95b44,width:50,height:31,opacity:.052,x:2,y:18,z:-24,rotation:.45}),
    makeNebulaGlow(softMap,{color:0x164f68,width:48,height:58,opacity:.065,x:42,y:13,z:-28,rotation:-.14}),
  ];
  for (let i = 0; i < FORMATION_CAVITIES.length; i++){
    const cavity = FORMATION_CAVITIES[i];
    const y = THREE.MathUtils.lerp(-39,formationCliffHeight(cavity.x),cavity.v);
    nebulaGlows.push(makeNebulaGlow(softMap,{
      color: i%2 ? 0xa22d67 : 0x218da2,
      width: cavity.rx*3.0,
      height: Math.max(5,cavity.ry*42),
      opacity: .12,
      x: cavity.x,
      y,
      z: -6,
      rotation: i*.47,
    }));
  }
  parent.add(...nebulaGlows);

  const cavityLight = new THREE.PointLight(0x58dbe8,3.8,105,1.55);
  cavityLight.position.set(-8,16,-18);
  parent.add(cavityLight);
  const warmLight = new THREE.PointLight(0xff884f,4.2,92,1.7);
  warmLight.position.set(28,-1,16);
  parent.add(warmLight);
  const rnd = mulberry(hashStr('carina:first-stars'));
  const stars = [];
  const embeddedStars = [
    [-42,-2,-4,0x86eaff,6.8],[-3,7,-5,0xffbf7d,9.2],[21,-6,-3,0xf18dc7,6.4],[40,5,-4,0x78d9f2,5.9],
  ];
  for (let i = 0; i < embeddedStars.length; i++){
    const [x,y,z,color,scale] = embeddedStars[i];
    const halo = makeNebulaGlow(softMap,{
      color,width:scale*1.55,height:scale,opacity:.065,x,y,z:z-.6,rotation:i*.61,
    });
    const star = makeGlow(softMap,color,.34+(i%2)*.12);
    star.position.set(x,y,z);
    star.userData.baseScale = star.scale.x;
    star.userData.embeddedSource = true;
    parent.add(halo,star); stars.push(star);
    const light = new THREE.PointLight(color,1.7+(i%2)*.8,34,1.9);
    light.position.copy(star.position);
    parent.add(light);
  }
  for (let i = 0; i < 10; i++){
    const star = makeGlow(softMap,i%3 === 0 ? 0x8be8ff : 0xffc184,.16+rnd()*.42);
    star.position.set(gaussian(rnd) * 29, 2+gaussian(rnd) * 14, -13+gaussian(rnd) * 8);
    star.userData.baseScale = star.scale.x;
    parent.add(star); stars.push(star);
  }
  const caption = addCaption(parent,
    makeCaption('RECONSTRUCTION', 'Sculpted molecular cliffs shaped by winds and UV — not an observation', 68),
    0, -38, 9);
  return { sculpture, pillars, stars, cavityLight, warmLight, caption };
}

function buildLocator(parent){
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, '#03101c'); bg.addColorStop(.48, '#0a152c'); bg.addColorStop(1, '#12091f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const nebula = ctx.createRadialGradient(742, 420, 12, 742, 420, 260);
  nebula.addColorStop(0, 'rgba(255,125,84,.32)');
  nebula.addColorStop(.35, 'rgba(72,202,211,.20)');
  nebula.addColorStop(1, 'rgba(20,60,108,0)');
  ctx.fillStyle = nebula; ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rnd = mulberry(hashStr('carina:locator'));
  const starPalette = ['#b7ddff', '#fff1d5', '#ffd0ae', '#d4c5ff'];
  for (let i = 0; i < 360; i++){
    const x = rnd() * canvas.width, y = rnd() * canvas.height;
    const r = .5 + Math.pow(rnd(), 4) * 3.2;
    ctx.fillStyle = starPalette[(rnd() * starPalette.length) | 0];
    ctx.globalAlpha = .35 + rnd() * .65;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const anchors = [
    [210, 610], [350, 510], [510, 565], [650, 430], [800, 465], [1005, 310],
  ];
  ctx.strokeStyle = 'rgba(103,221,242,.42)'; ctx.lineWidth = 3;
  ctx.beginPath();
  anchors.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
  for (const [x, y] of anchors){
    ctx.fillStyle = '#c6efff'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
  const cx = 742, cy = 420;
  ctx.strokeStyle = '#ffb36f'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 58, cy); ctx.lineTo(cx + 58, cy);
  ctx.moveTo(cx, cy - 58); ctx.lineTo(cx, cy + 58); ctx.stroke();
  ctx.fillStyle = '#f5fbff'; ctx.font = '600 44px system-ui, sans-serif';
  ctx.fillText('CARINA · NGC 3372', 784, 402);
  ctx.fillStyle = '#8eb8cb'; ctx.font = '27px system-ui, sans-serif';
  ctx.fillText('Modern schematic locator', 784, 444);
  ctx.fillStyle = '#67ddeb'; ctx.font = '600 30px system-ui, sans-serif';
  ctx.fillText('SOUTHERN SKY', 46, 66);
  ctx.fillStyle = '#7192a8'; ctx.font = '23px system-ui, sans-serif';
  ctx.fillText('Orientation guide — not Lacaille’s original drawing', 46, 108);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(100, 62.5), material);
  parent.add(plate);
  return { plate };
}

function homunculusRadius(t, angle, phase){
  const bulb = Math.pow(Math.max(0,Math.sin(Math.PI*t)),.60);
  const waist = .78*(1-t)+.08;
  const corrugation = 1
    +.105*Math.sin(angle*7+t*18+phase)
    +.052*Math.sin(angle*17-t*29-phase*.7)
    +.030*Math.sin(angle*31+t*43)
    +(valueNoise(angle*1.9,t*16.0,41.3)-.5)*.12;
  return (waist+7.65*bulb)*corrugation;
}

function homunculusPoint(sign, t, angle, phase, radialScale = 1){
  const radius = homunculusRadius(t,angle,phase)*radialScale;
  const drift = Math.sin(Math.PI*t);
  return new THREE.Vector3(
    sign*drift*1.95+Math.cos(angle)*radius,
    sign*(.58+t*28.8),
    sign*drift*.58+Math.sin(angle)*radius*.82,
  );
}

function homunculusSurfaceColor(sign, t, angle){
  const waist = new THREE.Color(0x8c235a);
  const amber = new THREE.Color(0xf09142);
  const polar = new THREE.Color(sign > 0 ? 0xd85a73 : 0x56aec3);
  const color = waist.lerp(amber,smoothstep(.02,.62,t));
  color.lerp(polar,smoothstep(.72,1,t)*.68);
  const striation = .66+.34*(.5+.5*Math.sin(t*37+angle*9+sign*.8));
  return color.multiplyScalar(striation);
}

function makeHomunculusLobeGeometry(sign){
  const radial = BUDGET.homunculusRadial;
  const rings = BUDGET.homunculusRings;
  const phase = sign > 0 ? .64 : 2.17;
  const positions = [], colors = [], uvs = [], indices = [];
  for (let ring = 0; ring <= rings; ring++){
    const t = ring/(rings+1);
    for (let segment = 0; segment <= radial; segment++){
      const angle = segment/radial*Math.PI*2;
      const point = homunculusPoint(sign,t,angle,phase);
      positions.push(point.x,point.y,point.z);
      const color = homunculusSurfaceColor(sign,t,angle);
      colors.push(color.r,color.g,color.b);
      uvs.push(segment/radial,t);
    }
  }
  const stride = radial+1;
  for (let ring = 0; ring < rings; ring++){
    for (let segment = 0; segment < radial; segment++){
      const a = ring*stride+segment, b = a+stride;
      if (sign > 0) indices.push(a,b,a+1,a+1,b,b+1);
      else indices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const tip = positions.length/3;
  const tipPoint = homunculusPoint(sign,1,0,phase,0);
  positions.push(tipPoint.x,tipPoint.y,tipPoint.z);
  const tipColor = homunculusSurfaceColor(sign,1,0);
  colors.push(tipColor.r,tipColor.g,tipColor.b);
  uvs.push(.5,1);
  const finalRing = rings*stride;
  for (let segment = 0; segment < radial; segment++){
    if (sign > 0) indices.push(finalRing+segment,tip,finalRing+segment+1);
    else indices.push(finalRing+segment,finalRing+segment+1,tip);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.scientificRole = 'procedural-bipolar-homunculus-fallback';
  return geometry;
}

function makeHomunculusLobe(sign){
  const geometry = makeHomunculusLobeGeometry(sign);
  const material = new THREE.MeshPhysicalMaterial({
    name: 'Carina.HomunculusDustShellMaterial',
    vertexColors: true,
    emissive: 0x56152d,
    emissiveIntensity: 1.18,
    roughness: .68,
    metalness: 0,
    clearcoat: .20,
    clearcoatRoughness: .76,
    transparent: true,
    opacity: .62,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec2 vHomunculusUv;')
      .replace('#include <uv_vertex>','#include <uv_vertex>\nvHomunculusUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec2 vHomunculusUv;')
      .replace('#include <alphatest_fragment>',`float shellBands = .5
        + .27*sin(vHomunculusUv.y*104.0+sin(vHomunculusUv.x*31.0)*2.4)
        + .17*sin(vHomunculusUv.x*97.0-vHomunculusUv.y*43.0);
        diffuseColor.a *= smoothstep(.11,.82,shellBands)*.62+.28;
        if (diffuseColor.a < .09) discard;`);
  };
  material.customProgramCacheKey = () => 'carina-homunculus-ragged-shell-v2';
  const shell = new THREE.Mesh(geometry,material);
  shell.name = sign > 0 ? 'north-corrugated-homunculus-lobe' : 'south-corrugated-homunculus-lobe';
  shell.renderOrder = 3;
  const inner = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
    name: 'Carina.HomunculusInnerGlowMaterial',
    color: sign > 0 ? 0xff814b : 0x58bbd3,
    transparent: true,
    opacity: .40,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false,
  }));
  inner.name = 'homunculus-heated-inner-shell';
  inner.scale.setScalar(.968);
  inner.renderOrder = 2;
  const silhouette = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
    name: 'Carina.HomunculusSilhouetteGlowMaterial',
    color: sign > 0 ? 0xffa15f : 0x68b8ce,
    transparent: true,
    opacity: .29,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false,
  }));
  silhouette.name = 'homunculus-polar-scattering-rim';
  silhouette.scale.setScalar(1.026);
  silhouette.renderOrder = 1;
  const group = new THREE.Group();
  group.add(silhouette,inner,shell);
  return group;
}

function makeHomunculusPolarCap(sign){
  const radial = BUDGET.homunculusRadial;
  const rings = TEX_TIER === 'low' ? 7 : 11;
  const phase = sign > 0 ? .64 : 2.17;
  const positions = [], colors = [], indices = [];
  for (let ring = 0; ring <= rings; ring++){
    const t = .74+ring/rings*.245;
    for (let segment = 0; segment <= radial; segment++){
      const angle = segment/radial*Math.PI*2;
      const point = homunculusPoint(sign,t,angle,phase,1.035);
      positions.push(point.x,point.y,point.z);
      const color = (sign > 0 ? IONIZED_GOLD : IONIZED_BLUE).clone()
        .lerp(sign > 0 ? IONIZED_BLUE : IONIZED_MAGENTA,
          smoothstep(.78,1,t)*.62)
        .multiplyScalar(.46+.26*(.5+.5*Math.sin(angle*6+t*29)));
      colors.push(color.r,color.g,color.b);
    }
  }
  const stride = radial+1;
  for (let ring = 0; ring < rings; ring++){
    for (let segment = 0; segment < radial; segment++){
      const a = ring*stride+segment, b = a+stride;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.scientificRole = 'polar-dust-cap-scattering-layer';
  const material = new THREE.MeshBasicMaterial({
    name: 'Carina.HomunculusPolarCapMaterial',
    vertexColors: true,
    transparent: true,
    opacity: .36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const cap = new THREE.Mesh(geometry,material);
  cap.name = sign > 0 ? 'north-ragged-polar-cap' : 'south-ragged-polar-cap';
  cap.renderOrder = 6;
  return cap;
}

function makeHomunculusSkirt(){
  const angular = TEX_TIER === 'low' ? 54 : 96;
  const radial = TEX_TIER === 'low' ? 7 : 12;
  const positions = [], colors = [], indices = [];
  for (let ring = 0; ring <= radial; ring++){
    const t = ring/radial;
    for (let segment = 0; segment <= angular; segment++){
      const angle = segment/angular*Math.PI*2;
      const ragged = 1+.08*Math.sin(angle*7)+.035*Math.sin(angle*19+1.2);
      const radius = THREE.MathUtils.lerp(1.15,18.5,t)*ragged;
      const y = Math.sin(angle)*t*3.8
        +Math.sin(angle*3+.4)*t*1.65
        +Math.sin(angle*9-t*4)*.34;
      positions.push(Math.cos(angle)*radius,y,Math.sin(angle)*radius*.76);
      const color = new THREE.Color(0x65183e).lerp(new THREE.Color(0xe37343),
        .22+.58*t*(.5+.5*Math.sin(angle*4.0)));
      colors.push(color.r,color.g,color.b);
    }
  }
  const stride = angular+1;
  for (let ring = 0; ring < radial; ring++){
    for (let segment = 0; segment < angular; segment++){
      const a = ring*stride+segment, b = a+stride;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.scientificRole = 'equatorial-ejecta-skirt';
  const material = new THREE.MeshPhysicalMaterial({
    name: 'Carina.HomunculusEquatorialSkirtMaterial',
    vertexColors: true,
    emissive: 0x57142f,
    emissiveIntensity: 1.04,
    roughness: .86,
    metalness: 0,
    transparent: true,
    opacity: .58,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const skirt = new THREE.Mesh(geometry,material);
  skirt.name = 'ragged-homunculus-equatorial-skirt';
  skirt.renderOrder = 4;
  return skirt;
}

function makeHomunculusDustKnots(scope){
  const count = BUDGET.homunculusDustKnots;
  const geometry = new THREE.IcosahedronGeometry(.22,0);
  geometry.userData.scientificRole = 'faceted-dust-knot-prototype';
  const material = new THREE.MeshStandardMaterial({
    name: 'Carina.HomunculusDustKnotMaterial',
    color: 0xffffff,
    emissive: 0x2b0c09,
    emissiveIntensity: .48,
    roughness: .96,
    metalness: 0,
  });
  const knots = scope.own(new THREE.InstancedMesh(geometry,material,count));
  knots.name = 'homunculus-surface-dust-knots';
  knots.userData.instanceRole = 'interpretive-dust-striation-detail';
  knots.userData.scientificShapeBasis = 'spectroscopy-derived-bipolar-envelope';
  const rnd = mulberry(hashStr('carina:homunculus:dust-knots'));
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++){
    const equatorial = i%5 === 0;
    const angle = rnd()*Math.PI*2;
    if (equatorial){
      const radius = 4+Math.pow(rnd(),.68)*13.5;
      dummy.position.set(
        Math.cos(angle)*radius,
        gaussian(rnd)*.72+Math.sin(angle*3)*.55,
        Math.sin(angle)*radius*.76);
    } else {
      const sign = i%2 ? 1 : -1;
      const t = .08+Math.pow(rnd(),.86)*.86;
      const phase = sign > 0 ? .64 : 2.17;
      dummy.position.copy(homunculusPoint(sign,t,angle,phase,1.024));
    }
    dummy.rotation.set(rnd()*Math.PI,rnd()*Math.PI,rnd()*Math.PI);
    const scale = .32+Math.pow(rnd(),2.2)*1.45;
    dummy.scale.set(
      scale*(equatorial ? 1.2+rnd()*1.5 : .55+rnd()*.75),
      scale*(equatorial ? .18+rnd()*.18 : .25+rnd()*.42),
      scale*(equatorial ? .32+rnd()*.50 : .28+rnd()*.55));
    dummy.updateMatrix();
    knots.setMatrixAt(i,dummy.matrix);
    knots.setColorAt(i,new THREE.Color(i%5 === 0 ? 0x79a8ad : 0xb75d3f)
      .multiplyScalar(.68+rnd()*.38));
  }
  knots.instanceMatrix.needsUpdate = true;
  if (knots.instanceColor) knots.instanceColor.needsUpdate = true;
  knots.renderOrder = 5;
  return knots;
}

function addHomunculusFallback(scope, holder, softMap){
  const root = new THREE.Group();
  root.name = 'detailed-bipolar-homunculus-system';
  const surfaceRoot = new THREE.Group();
  surfaceRoot.name = 'procedural-homunculus-loading-fallback';
  surfaceRoot.add(
    makeHomunculusLobe(1),
    makeHomunculusLobe(-1),
    makeHomunculusPolarCap(1),
    makeHomunculusPolarCap(-1),
  );
  const skirt = makeHomunculusSkirt();
  skirt.rotation.set(.34,.10,-.12);
  const dustKnots = makeHomunculusDustKnots(scope);
  root.add(surfaceRoot,skirt,dustKnots);
  const star = makeGlow(softMap,0xe9fbff,3.8);
  star.renderOrder = 8;
  const warmHalo = makeGlow(softMap,0xff6e54,8.2);
  warmHalo.material.opacity = .24;
  warmHalo.renderOrder = 7;
  root.add(warmHalo,star);
  const centralLight = new THREE.PointLight(0xc9efff,7.6,78,1.72);
  root.add(centralLight);
  const polarLight = new THREE.PointLight(0x62bfd2,3.4,64,1.8);
  polarLight.position.set(0,20,-2);
  root.add(polarLight);
  holder.add(root);
  return { root, surfaceRoot, skirt, dustKnots, star, warmHalo };
}

function colorizeHomunculus(geometry, majorAxis){
  const positions = geometry.attributes.position;
  const box = geometry.boundingBox;
  const min = box.min.getComponent(majorAxis);
  const span = Math.max(.0001, box.max.getComponent(majorAxis) - min);
  const colors = new Float32Array(positions.count * 3);
  const otherAxes = [0,1,2].filter(axis => axis !== majorAxis);
  const cool = new THREE.Color(0x52aec2);
  const waist = new THREE.Color(0x8a2158);
  const warm = new THREE.Color(0xef8d42);
  for (let i = 0; i < positions.count; i++){
    const component = majorAxis === 0 ? positions.getX(i)
      : majorAxis === 1 ? positions.getY(i)
      : positions.getZ(i);
    const t = (component - min) / span;
    const latitude = Math.abs(t-.5)*2;
    const sideA = otherAxes[0] === 0 ? positions.getX(i)
      : otherAxes[0] === 1 ? positions.getY(i)
      : positions.getZ(i);
    const sideB = otherAxes[1] === 0 ? positions.getX(i)
      : otherAxes[1] === 1 ? positions.getY(i)
      : positions.getZ(i);
    const azimuth = Math.atan2(sideB,sideA);
    const color = waist.clone().lerp(warm,smoothstep(.04,.72,latitude));
    color.lerp(cool,smoothstep(.76,1,latitude)*.68);
    const brightness = .68+.28*(.5+.5*Math.sin(latitude*35+azimuth*8));
    colors[i*3] = color.r * brightness;
    colors[i*3+1] = color.g * brightness;
    colors[i*3+2] = color.b * brightness;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function loadHomunculus(scope, holder, fallback){
  import('three/addons/loaders/STLLoader.js').then(scope.guard(({ STLLoader }) => {
    const loader = new STLLoader();
    loader.load(ASSETS.etaModel, geometry => {
      if (scope.disposed){ geometry.dispose(); return; }
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.center();
      geometry.computeBoundingBox();
      const size = geometry.boundingBox.getSize(new THREE.Vector3());
      const values = [size.x, size.y, size.z];
      const majorAxis = values.indexOf(Math.max(...values));
      colorizeHomunculus(geometry, majorAxis);

      const material = new THREE.MeshPhysicalMaterial({
        name: 'Carina.SpectroscopyHomunculusMaterial',
        vertexColors: true,
        emissive: 0x59152d,
        emissiveIntensity: 1.08,
        roughness: .64,
        metalness: 0,
        clearcoat: .18,
        clearcoatRoughness: .76,
        transparent: true,
        opacity: .66,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>','#include <common>\nvarying vec3 vEtaLocal;')
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvEtaLocal = position;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>','#include <common>\nvarying vec3 vEtaLocal;')
          .replace('#include <alphatest_fragment>',`float etaStrata = .5
            +.25*sin(dot(vEtaLocal,vec3(8.2,5.7,11.4))*5.0)
            +.18*sin(dot(vEtaLocal,vec3(-3.1,13.0,6.4))*7.0);
            diffuseColor.a *= .56+.42*smoothstep(.08,.91,etaStrata);`);
      };
      material.customProgramCacheKey = () => 'carina-loaded-homunculus-dust-v2';
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'spectroscopy-derived-homunculus-surface';
      if (majorAxis === 0) mesh.rotation.z = HALF_PI;
      else if (majorAxis === 2) mesh.rotation.x = -HALF_PI;
      const scale = 57 / Math.max(...values);
      mesh.scale.setScalar(scale);
      mesh.renderOrder = 4;

      const glow = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
        name: 'Carina.SpectroscopyHomunculusRimMaterial',
        color: 0xff8c55,
        transparent: true,
        opacity: .24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
        toneMapped: false,
      }));
      glow.name = 'spectroscopy-homunculus-scattering-rim';
      glow.rotation.copy(mesh.rotation);
      glow.scale.setScalar(scale*1.025);
      glow.renderOrder = 2;
      const innerGlow = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
        name: 'Carina.SpectroscopyHomunculusInnerLightMaterial',
        color: 0x8bd7e8,
        transparent: true,
        opacity: .30,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
        toneMapped: false,
      }));
      innerGlow.name = 'spectroscopy-homunculus-inner-blue-white-light';
      innerGlow.rotation.copy(mesh.rotation);
      innerGlow.scale.setScalar(scale*.965);
      innerGlow.renderOrder = 1;
      const scientificRoot = new THREE.Group();
      scientificRoot.name = 'loaded-scientific-homunculus-model';
      scientificRoot.add(innerGlow,glow,mesh);
      scientificRoot.scale.set(.70,1,.70);
      holder.add(scientificRoot);
      fallback.surfaceRoot.visible = false;
      fallback.dustKnots.scale.set(1.34,.98,1.34);
      holder.userData.scientificModelLoaded = true;
    }, undefined, () => {
      if (!scope.disposed) holder.userData.scientificModelLoaded = false;
    });
  })).catch(() => {
    if (!scope.disposed) holder.userData.scientificModelLoaded = false;
  });
}

function buildEta(scope, parent, softMap){
  const modelHolder = new THREE.Group();
  modelHolder.position.x = -27;
  modelHolder.rotation.set(.17,.20,-.46);
  modelHolder.scale.setScalar(.82);
  parent.add(modelHolder);
  const fallback = addHomunculusFallback(scope, modelHolder, softMap);
  loadHomunculus(scope, modelHolder, fallback);

  const uv = makePhotoPlate(scope, parent, {
    url: ASSETS.etaUv, aspect: 1, width: 43, x: 30, y: 0, z: 0,
  });
  const modelCaption = addCaption(parent,
    makeCaption('3D SHAPE MODEL', 'Spectroscopy-derived Homunculus geometry', 47),
    -27, -32, 4);
  const uvCaption = addCaption(parent,
    makeCaption('2018 UV DATA', 'Separate Hubble observation — not texture registration', 47),
    30, -27, 4);
  return { modelHolder, fallback, uv, captions: [modelCaption,uvCaption] };
}

function imagePixels(image, width, height){
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

function pixelLuma(data, index){
  return (.299 * data[index] + .587 * data[index+1] + .114 * data[index+2]) / 255;
}

function makeReliefTracker(scope){
  return {
    texture: resource => scope.own(resource),
    material: resource => scope.own(resource),
    geometry: resource => scope.own(resource),
  };
}

/* NASA's Cosmic Cliffs visualization calls out a prominent protostellar jet.
   Its source pixels already survive in the registered relief; adding a tube
   or bead chain on top turned the observation into a diagram. */
function makeCosmicCliffsJet(){
  const group = new THREE.Group();
  group.name = 'prominent-protostellar-jet-source-relief';
  group.userData.materials = [];
  group.userData.presentation = 'source-depth-relief';
  group.userData.genericPointClouds = false;
  return group;
}

function makeAlignedWebbStars(scope, photo, depth, softMap, parent){
  const iw = photo.width || 16, ih = photo.height || 9;
  const width = BUDGET.photoLongSide;
  const height = Math.max(2, Math.round(width*ih/iw));
  const pixels = imagePixels(photo,width,height);
  const depths = imagePixels(depth,width,height);
  const cellX = PHOTO_WIDTH/width;
  const candidates = [];

  for (let py = 1; py < height-1; py++){
    for (let px = 1; px < width-1; px++){
      const q = py*width+px, offset = q*4;
      const luma = pixelLuma(pixels,offset);
      if (luma <= .42) continue;
      let neighbourhood = 0;
      for (let oy = -1; oy <= 1; oy++){
        for (let ox = -1; ox <= 1; ox++){
          if (ox || oy)
            neighbourhood += pixelLuma(pixels,((py+oy)*width+px+ox)*4);
        }
      }
      neighbourhood /= 8;
      const contrast = luma-neighbourhood;
      if (contrast <= .14) continue;
      candidates.push({
        x: ((px+.5)/width-.5)*PHOTO_WIDTH,
        y: -((py+.5)/height-.5)*(PHOTO_WIDTH/WEBB_ASPECT),
        z: (depths[offset]/255-.5)*34+.8,
        r: pixels[offset]/255,
        g: pixels[offset+1]/255,
        b: pixels[offset+2]/255,
        score: contrast*luma,
      });
    }
  }

  candidates.sort((a,b) => b.score-a.score);
  const stars = [];
  for (const candidate of candidates){
    if (stars.some(other => {
      const dx = other.x-candidate.x, dy = other.y-candidate.y;
      return dx*dx+dy*dy < cellX*cellX*10;
    })) continue;
    stars.push(candidate);
    if (stars.length >= BUDGET.alignedStars) break;
  }

  const positions = new Float32Array(stars.length*3);
  const colors = new Float32Array(stars.length*3);
  for (let i = 0; i < stars.length; i++){
    const star = stars[i];
    positions.set([star.x,star.y,star.z],i*3);
    const mean = (star.r+star.g+star.b)/3;
    const red = clamp01(mean+(star.r-mean)*2.25);
    const green = clamp01(mean+(star.g-mean)*2.25);
    const blue = clamp01(mean+(star.b-mean)*2.25);
    const exposure = 1/Math.max(red,green,blue,.001);
    colors.set([red*exposure,green*exposure,blue*exposure],i*3);
  }

  const geometry = scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const material = scope.own(new THREE.PointsMaterial({
    map: softMap,
    size: TEX_TIER === 'low' ? 2 : 1.55,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    alphaTest: .018,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  const points = new THREE.Points(geometry,material);
  points.name = 'source-and-depth-aligned-colored-stars';
  points.userData.allowedPointRole = 'registered-stellar-sources';
  parent.add(points);
  return { points, count: stars.length };
}

function makePhotoDerivedGeometry(scope, photo, depth, softMap, webbHolder, futureHolder){
  const tracker = makeReliefTracker(scope);
  const reliefScale = PHOTO_WIDTH/(62*WEBB_ASPECT);
  const webbReliefRoot = new THREE.Group();
  webbReliefRoot.name = 'webb-source-depth-relief-root';
  webbReliefRoot.scale.set(reliefScale,reliefScale,1);
  webbHolder.add(webbReliefRoot);
  const webbReveal = { value: 0 };
  const webbRelief = buildPhotoRelief({
    parent: webbReliefRoot,
    image: photo,
    depthImage: depth,
    aspect: WEBB_ASPECT,
    profile: WEBB_RELIEF_PROFILE,
    budget: {
      reliefSample: BUDGET.photoLongSide,
      reliefTriangles: BUDGET.reliefTriangles,
      dustTriangles: BUDGET.dustTriangles,
    },
    tracker,
    reveal: webbReveal,
    seed: 'carina:webb:triangulated-relief',
  });
  if (webbRelief.emission)
    webbRelief.emission.name = 'webb-source-depth-ionized-front-relief';
  if (webbRelief.silhouette)
    webbRelief.silhouette.name = 'webb-depth-aligned-molecular-cliff-relief';
  webbRelief.update(0);

  const futureReliefRoot = new THREE.Group();
  futureReliefRoot.name = 'future-eroded-source-depth-relief-root';
  futureReliefRoot.scale.set(reliefScale*1.055,reliefScale*1.09,1.12);
  futureReliefRoot.position.set(0,1.8,-4);
  futureHolder.add(futureReliefRoot);
  const futureReveal = { value: 1 };
  const futureRelief = buildPhotoRelief({
    parent: futureReliefRoot,
    image: photo,
    depthImage: depth,
    aspect: WEBB_ASPECT,
    profile: FUTURE_RELIEF_PROFILE,
    budget: {
      reliefSample: BUDGET.photoLongSide,
      reliefTriangles: BUDGET.futureTriangles,
      dustTriangles: BUDGET.futureDustTriangles,
    },
    tracker,
    reveal: futureReveal,
    seed: 'carina:future:triangulated-relief',
  });
  if (futureRelief.emission)
    futureRelief.emission.name = 'future-concept-eroded-emission-relief';
  if (futureRelief.silhouette)
    futureRelief.silhouette.name = 'future-concept-eroded-dust-relief';
  futureRelief.update(1);

  const alignedStars = makeAlignedWebbStars(scope,photo,depth,softMap,webbHolder);
  const jet = makeCosmicCliffsJet();
  webbHolder.add(jet);
  webbHolder.userData.genericPointClouds = false;
  futureHolder.userData.genericPointClouds = false;
  webbHolder.userData.morphologyCounts = {
    ...webbRelief.counts,
    alignedStars: alignedStars.count,
    jetPresentation: 'source-depth-relief',
  };
  return {
    webbRelief,
    webbReveal,
    futureRelief,
    futureReveal,
    jet,
    alignedStars: alignedStars.points,
  };
}

function buildHubble(scope, parent){
  const reliefReveal = { value: 0 };
  const reliefRoot = new THREE.Group();
  reliefRoot.name = 'hubble-source-derived-relief-root';
  const reliefScale = (PHOTO_WIDTH/HUBBLE_ASPECT)/62;
  reliefRoot.scale.set(reliefScale,reliefScale,1);
  parent.add(reliefRoot);
  let relief = null;
  const plate = makePhotoPlate(scope, parent, {
    url: ASSETS.hubble, aspect: HUBBLE_ASPECT, width: PHOTO_WIDTH,
    onTexture: texture => {
      if (relief || !texture.image) return;
      relief = buildPhotoRelief({
        parent: reliefRoot,
        image: texture.image,
        depthImage: makeSourceDerivedDepth(texture.image),
        aspect: HUBBLE_ASPECT,
        profile: HUBBLE_RELIEF_PROFILE,
        budget: {
          reliefSample: BUDGET.photoLongSide,
          reliefTriangles: BUDGET.reliefTriangles,
          dustTriangles: BUDGET.dustTriangles,
        },
        tracker: makeReliefTracker(scope),
        reveal: reliefReveal,
        seed: 'carina:hubble:source-derived-relief',
      });
      relief.update(0);
      reliefRoot.userData.interpretiveDepth = true;
      reliefRoot.userData.genericPointClouds = false;
    },
  });
  const caption = addCaption(parent,
    makeCaption('HUBBLE · 2007 RELEASE', 'Wide Carina mosaic — its own observed field', 64),
    0, -plate.height / 2 - 6, 3);
  return { plate, caption, reliefReveal, reliefRoot, get relief(){ return relief; } };
}

function buildWebb(scope, parent, futureParent, softMap){
  const volume = new THREE.Group();
  parent.add(volume);
  const futureVolume = new THREE.Group();
  futureParent.add(futureVolume);
  let photo = null, depth = null, photoDerived = null;
  const finish = () => {
    if (!photoDerived && photo && depth)
      photoDerived = makePhotoDerivedGeometry(
        scope,
        photo.image,
        depth.image,
        softMap,
        volume,
        futureVolume,
      );
  };
  const plate = makePhotoPlate(scope, parent, {
    url: ASSETS.webb,
    aspect: WEBB_ASPECT,
    width: PHOTO_WIDTH,
    onTexture: texture => { photo = texture; finish(); },
  });
  const caption = addCaption(parent,
    makeCaption('WEBB · NIRCAM + MIRI', 'Exact head-on plate · orbit reveals inferred depth', 68),
    0, -plate.height / 2 - 6, 3);
  loadTexture(ASSETS.webbDepth, scope.guard(texture => { depth = texture; finish(); }), { srgb: false });

  return {
    plate,
    caption,
    volume,
    futureVolume,
    get photoDerived(){ return photoDerived; },
  };
}

function createStateRoot(group, state){
  const root = new THREE.Group();
  root.name = 'carina:' + state;
  root.userData.carinaState = state;
  root.visible = false;
  group.add(root);
  return root;
}

function canonicalHeadOn(camera){
  if (!camera) return 1;
  const length = camera.position.length();
  if (length < .001) return 1;
  return smoothstep(.94, .997, camera.position.z / length);
}

export function buildCarinaFeatured(){
  const scope = new ResourceScope('carina-featured');
  const group = new THREE.Group();
  const softMap = scope.own(makeSoftDisc());
  const states = new Map();
  for (const state of Object.values(CARINA_STATES))
    states.set(state, createStateRoot(group, state));

  const formation = buildFormation(scope, states.get(CARINA_STATES.FORMATION), softMap);
  buildLocator(states.get(CARINA_STATES.LOCATOR));
  const eta = buildEta(scope, states.get(CARINA_STATES.ETA_ERUPTION), softMap);
  const hubble = buildHubble(scope, states.get(CARINA_STATES.HUBBLE));
  const webb = buildWebb(
    scope,
    states.get(CARINA_STATES.WEBB),
    states.get(CARINA_STATES.FUTURE),
    softMap,
  );

  let activeState = CARINA_STATES.WEBB;
  let elapsed = 0;
  const aliases = new Map([
    ['formation', CARINA_STATES.FORMATION],
    ['locator', CARINA_STATES.LOCATOR],
    ['eta', CARINA_STATES.ETA_ERUPTION],
    ['eta-eruption', CARINA_STATES.ETA_ERUPTION],
    ['hubble', CARINA_STATES.HUBBLE],
    ['hubble-panorama', CARINA_STATES.HUBBLE],
    ['webb', CARINA_STATES.WEBB],
    ['webb-cliffs', CARINA_STATES.WEBB],
    ['future', CARINA_STATES.FUTURE],
    ['future-erosion', CARINA_STATES.FUTURE],
  ]);

  function selectState(requested){
    const state = aliases.get(requested) || requested;
    if (!states.has(state)) return;
    activeState = state;
    for (const [name, root] of states) root.visible = name === state;
    group.userData.carinaState = state;
    group.userData.activePresentation = state;
    group.userData.observationRequested = CARINA_OBSERVATION_STATES.has(state);
  }
  selectState(activeState);
  group.userData.qualityBudget = BUDGET;
  group.userData.observationFields = 'separate-no-crossfade';
  group.userData.genericSoftClouds = false;
  group.userData.genericPointClouds = false;
  group.userData.webbMorphology = {
    source: 'Exact Webb plate head-on; indexed source/depth triangle relief and registered stellar sources off-axis.',
    cavity: 'The ridge represents the near wall of the Gum 31 cavity carved by NGC 3324.',
    streamers: 'Broken relief facets trace the irradiated lip and photoevaporating structure; no generic gas or dust point clouds.',
    jet: 'The prominent upper-right outflow is retained by its source/depth relief pixels; no diagrammatic tube is overlaid.',
  };

  return {
    group,
    focusDist: 108,
    startTheta: 0,
    startPhi: HALF_PI,
    autoRotate: false,
    hasIR: false,
    isImage: true,
    creditForPresentation(){
      return CARINA_PRESENTATION_CREDITS[activeState] || null;
    },
    setMoment(visual){
      if (!scope.disposed && visual && visual.state) selectState(visual.state);
    },
    update(dt, camera){
      if (scope.disposed) return;
      elapsed += dt;
      if (activeState === CARINA_STATES.FORMATION){
        setCaptionOpacity(formation.caption,canonicalHeadOn(camera));
        formation.sculpture.rotation.y = Math.sin(elapsed*.075)*.035;
        formation.cavityLight.intensity = 3.6+Math.sin(elapsed*.74)*.34;
        formation.warmLight.intensity = 4.0+Math.sin(elapsed*.58+1.1)*.42;
        for (let i = 0; i < formation.pillars.length; i++)
          formation.pillars[i].rim.material.opacity = .14
            +.025*Math.sin(elapsed*.64+i*.91);
        for (let i = 0; i < formation.stars.length; i++){
          const pulse = 1 + Math.sin(elapsed * (1.1 + i * .09) + i) * .08;
          formation.stars[i].scale.setScalar(formation.stars[i].userData.baseScale*pulse);
        }
      } else if (activeState === CARINA_STATES.ETA_ERUPTION){
        const pulse = 1 + Math.sin(elapsed * 1.6) * .08;
        eta.fallback.star.scale.setScalar(3.8*pulse);
        eta.fallback.warmHalo.scale.setScalar(8.2*(1+(pulse-1)*.54));
        const headOn = canonicalHeadOn(camera);
        eta.uv.material.opacity = headOn;
        for (const caption of eta.captions) setCaptionOpacity(caption,headOn);
      } else if (activeState === CARINA_STATES.HUBBLE){
        const headOn = canonicalHeadOn(camera);
        const reveal = 1-headOn;
        hubble.plate.material.opacity = headOn;
        setCaptionOpacity(hubble.caption,headOn);
        hubble.reliefReveal.value = reveal;
        if (hubble.relief) hubble.relief.update(reveal);
      } else if (activeState === CARINA_STATES.WEBB){
        const headOn = canonicalHeadOn(camera);
        webb.plate.material.opacity = headOn;
        setCaptionOpacity(webb.caption,headOn);
        const derived = webb.photoDerived;
        if (derived){
          const reveal = 1 - headOn;
          derived.webbReveal.value = reveal;
          derived.webbRelief.update(reveal);
          for (const material of derived.jet.userData.materials)
            material.opacity = .88*reveal;
          derived.alignedStars.material.opacity = .98 * reveal;
          derived.jet.visible = reveal > .018;
          derived.alignedStars.visible = reveal > .004;
        }
      } else if (activeState === CARINA_STATES.FUTURE){
        const derived = webb.photoDerived;
        if (derived){
          derived.futureReveal.value = 1;
          derived.futureRelief.update(1);
        }
        webb.futureVolume.rotation.y = Math.sin(elapsed * .08) * .16;
      }
    },
    dispose(){ scope.dispose(); },
  };
}
