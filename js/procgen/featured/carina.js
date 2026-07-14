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
  formationShellPoints: 3600,
  sphereSegments: 24,
  reliefTriangles: 6200,
  dustTriangles: 1700,
  futureTriangles: 4100,
  futureDustTriangles: 1100,
} : {
  photoLongSide: 320,
  alignedStars: 720,
  formationShellPoints: 9200,
  sphereSegments: 40,
  reliefTriangles: 19000,
  dustTriangles: 4800,
  futureTriangles: 12200,
  futureDustTriangles: 3200,
});

const PHOTO_WIDTH = 108;
const WEBB_ASPECT = 11264 / 3904;
const HUBBLE_ASPECT = 4000 / 1937;
const HALF_PI = Math.PI / 2;
const MODEL_CREDIT = 'Hubble panorama: NASA, ESA, N. Smith and the Hubble Heritage Team · CC BY 4.0 · Eta UV: NASA, ESA, N. Smith and J. Morse · 3D Homunculus model: Steffen, Teodoro, Madura et al. (2014)';

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

function makeCorrugatedFeedbackShell(seed, count, { spread, palette, thickness, opacity }){
  const latitudeSegments = Math.max(18, Math.round(Math.sqrt(count)*.48));
  const longitudeSegments = Math.max(32, Math.round(latitudeSegments*1.85));
  const positions = [];
  const colors = [];
  const indices = [];
  const tones = palette.map(value => new THREE.Color(value));
  const phase = (hashStr(seed)%997)*.001;
  for (let latitude = 0; latitude <= latitudeSegments; latitude++){
    const vertical = latitude/latitudeSegments*2-1;
    const radial = Math.sqrt(Math.max(0, 1-vertical*vertical));
    for (let longitude = 0; longitude <= longitudeSegments; longitude++){
      const angle = longitude/longitudeSegments*Math.PI*2;
      const ripple = Math.sin(angle*5+vertical*7.2+phase)*.055
        + Math.sin(angle*13-vertical*11.0)*.026
        + Math.sin(angle*23+vertical*17.0)*thickness*.16;
      const corrugation = 1+ripple;
      positions.push(
        Math.cos(angle)*radial*spread[0]*corrugation,
        vertical*spread[1]*corrugation,
        Math.sin(angle)*radial*spread[2]*corrugation,
      );
      const band = Math.floor((angle/(Math.PI*2))*tones.length+(vertical+.5)*1.7);
      const tone = tones[((band%tones.length)+tones.length)%tones.length];
      const brightness = .58+.28*(.5+.5*Math.sin(angle*7+vertical*9));
      colors.push(tone.r*brightness,tone.g*brightness,tone.b*brightness);
    }
  }
  const row = longitudeSegments+1;
  for (let latitude = 0; latitude < latitudeSegments; latitude++){
    const vertical = (latitude+.5)/latitudeSegments*2-1;
    for (let longitude = 0; longitude < longitudeSegments; longitude++){
      const angle = (longitude+.5)/longitudeSegments*Math.PI*2;
      // An H II cavity is an opened, torn wall rather than a sealed bubble.
      // Remove a broad observer-facing mouth and deterministic smaller gaps.
      const frontMouth = Math.sin(angle)>.48 && Math.abs(vertical)<.72;
      const torn = Math.sin(angle*11+vertical*19)+Math.cos(angle*5-vertical*13)<-1.22;
      if (frontMouth || torn) continue;
      const a = latitude*row+longitude;
      const b = a+1, c = a+row, d = c+1;
      indices.push(a,c,b,b,c,d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: opacity*.72,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const shell = new THREE.Mesh(geometry,material);
  shell.name = 'broken-corrugated-feedback-cavity-wall';
  return shell;
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

function buildFormation(parent, softMap){
  const cloud = new THREE.Group();
  cloud.name = 'structured-feedback-bubble';
  cloud.add(makeCorrugatedFeedbackShell('carina:formation', BUDGET.formationShellPoints, {
    spread: [43, 29, 32],
    palette: [0x2ac4c9, 0x2472ae, 0xc24e45, 0xf1a05e, 0x723d89],
    thickness: .14,
    opacity: .78,
  }));
  cloud.userData.ionizationRidges = 'corrugated-cavity-wall-colour';
  parent.add(cloud);
  const inner = makeCorrugatedFeedbackShell(
    'carina:formation:inner-shell',
    Math.round(BUDGET.formationShellPoints*.34),
    {
      spread: [28, 18, 19],
      palette: [0x24a6b6, 0xe05d50, 0xf3bd79],
      thickness: .10,
      opacity: .54,
    });
  parent.add(inner);
  const rnd = mulberry(hashStr('carina:first-stars'));
  const stars = [];
  for (let i = 0; i < 7; i++){
    const star = makeGlow(softMap, i % 3 === 0 ? 0x9edcff : 0xffd5a1, 3 + rnd() * 4);
    star.position.set(gaussian(rnd) * 25, gaussian(rnd) * 14, gaussian(rnd) * 13);
    parent.add(star); stars.push(star);
  }
  const caption = addCaption(parent,
    makeCaption('RECONSTRUCTION', 'Corrugated wind / UV cavity model — not an observation', 60),
    0, -38, 9);
  return { cloud, inner, stars, caption };
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

function addHomunculusFallback(holder, softMap){
  const root = new THREE.Group();
  const geometry = new THREE.SphereGeometry(1, BUDGET.sphereSegments, Math.round(BUDGET.sphereSegments * .66));
  const materials = [
    new THREE.MeshStandardMaterial({
      color: 0xe59b63, emissive: 0x34130b, roughness: .72,
      transparent: true, opacity: .72, side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x77b9c5, emissive: 0x102939, roughness: .72,
      transparent: true, opacity: .66, side: THREE.DoubleSide,
    }),
  ];
  for (let i = 0; i < 2; i++){
    const lobe = new THREE.Mesh(geometry, materials[i]);
    lobe.scale.set(10.5, 17.5, 9.5);
    lobe.position.y = i ? 13 : -13;
    lobe.rotation.z = i ? -.11 : .11;
    root.add(lobe);
  }
  const equator = new THREE.Mesh(
    new THREE.RingGeometry(7.8, 12.2, 64, 4),
    new THREE.MeshStandardMaterial({
      color: 0x8d4f58, emissive: 0x261016, roughness: .82,
      transparent: true, opacity: .24, side: THREE.DoubleSide,
    }),
  );
  equator.name = 'broad-homunculus-equatorial-skirt';
  equator.rotation.x = HALF_PI;
  root.add(equator);
  const star = makeGlow(softMap, 0xffe4b2, 7.5);
  root.add(star);
  holder.add(root);
  return { root, star };
}

function colorizeHomunculus(geometry, majorAxis){
  const positions = geometry.attributes.position;
  const box = geometry.boundingBox;
  const min = box.min.getComponent(majorAxis);
  const span = Math.max(.0001, box.max.getComponent(majorAxis) - min);
  const colors = new Float32Array(positions.count * 3);
  const cool = new THREE.Color(0x62afbd);
  const waist = new THREE.Color(0xa95055);
  const warm = new THREE.Color(0xf0ac69);
  for (let i = 0; i < positions.count; i++){
    const component = majorAxis === 0 ? positions.getX(i)
      : majorAxis === 1 ? positions.getY(i)
      : positions.getZ(i);
    const t = (component - min) / span;
    const color = t < .5
      ? cool.clone().lerp(waist, t * 2)
      : waist.clone().lerp(warm, (t - .5) * 2);
    const brightness = .74 + Math.abs(t - .5) * .42;
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

      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: 0x170b0d,
        roughness: .7,
        metalness: 0,
        transparent: true,
        opacity: .74,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      if (majorAxis === 0) mesh.rotation.z = HALF_PI;
      else if (majorAxis === 2) mesh.rotation.x = -HALF_PI;
      const scale = 52 / Math.max(...values);
      mesh.scale.setScalar(scale);

      holder.add(mesh);
      fallback.root.visible = false;
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
  parent.add(modelHolder);
  const fallback = addHomunculusFallback(modelHolder, softMap);
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

  const formation = buildFormation(states.get(CARINA_STATES.FORMATION), softMap);
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
    modelCredit: MODEL_CREDIT,
    setMoment(visual){
      if (!scope.disposed && visual && visual.state) selectState(visual.state);
    },
    update(dt, camera){
      if (scope.disposed) return;
      elapsed += dt;
      if (activeState === CARINA_STATES.FORMATION){
        setCaptionOpacity(formation.caption,canonicalHeadOn(camera));
        formation.cloud.rotation.y += dt * .022;
        formation.inner.rotation.y -= dt * .014;
        for (let i = 0; i < formation.stars.length; i++){
          const pulse = 1 + Math.sin(elapsed * (1.1 + i * .09) + i) * .08;
          formation.stars[i].scale.setScalar((3.2 + (i % 3)) * pulse);
        }
      } else if (activeState === CARINA_STATES.ETA_ERUPTION){
        const pulse = 1 + Math.sin(elapsed * 1.6) * .08;
        eta.fallback.star.scale.setScalar(7.5 * pulse);
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
