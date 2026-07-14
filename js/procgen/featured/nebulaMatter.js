/* Source-registered depth relief for the shared nebula exhibits.
   The canonical camera still sees the exact observation projector. Off axis,
   selected emission ridges and foreground silhouettes become indexed triangle
   patches whose vertices follow the aligned depth map. The geometry is
   intentionally broken at weak structure, so it reads as a sculpted surface
   rather than a translucent photograph or a cloud of circular particles. */

import * as THREE from 'three';
import { hashStr, mulberry } from '../../utils/rng.js';

const DISPLAY_HEIGHT = 62;

function clamp01(value){ return Math.max(0, Math.min(1, value)); }

function smoothstep(a, b, value){
  const x = clamp01((value-a) / Math.max(1e-6, b-a));
  return x*x*(3-2*x);
}

function numberFrom(source, keys, fallback){
  for (const key of keys){
    const value = source && source[key];
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function pixels(image, width, height){
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function luminance(data, offset){
  return (data[offset]*.299 + data[offset+1]*.587 + data[offset+2]*.114) / 255;
}

function dustColor(profile){
  try{ return new THREE.Color(profile.palette && profile.palette.dust || 0x100b12); }
  catch(_error){ return new THREE.Color(0x100b12); }
}

function buildFields(source, depthSource, width, height, authored){
  const length = width*height;
  const light = new Float32Array(length);
  const chroma = new Float32Array(length);
  const depth = new Float32Array(length);
  const edge = new Float32Array(length);
  const emission = new Float32Array(length);
  const silhouette = new Float32Array(length);
  const edgeGain = numberFrom(authored, ['edgeGain'], 2.7);
  const edgeExponent = numberFrom(authored, ['edgeExponent'], 1.3);
  const gasThreshold = numberFrom(authored, ['gasThreshold'], .045);
  const dustThreshold = numberFrom(authored, ['dustThreshold'], .52);

  for (let q = 0; q < length; q++){
    const offset = q*4;
    light[q] = luminance(source, offset);
    const highest = Math.max(source[offset], source[offset+1], source[offset+2]);
    const lowest = Math.min(source[offset], source[offset+1], source[offset+2]);
    chroma[q] = (highest-lowest)/255;
    depth[q] = depthSource ? depthSource[offset]/255 : .5;
  }

  for (let py = 1; py < height-1; py++){
    for (let px = 1; px < width-1; px++){
      const q = py*width+px;
      const left = light[q-1], right = light[q+1];
      const up = light[q-width], down = light[q+width];
      const neighbour = (left+right+up+down)*.25;
      const gradient = Math.hypot(right-left, down-up);
      edge[q] = Math.pow(clamp01(gradient*edgeGain), edgeExponent);
      const extended = smoothstep(gasThreshold, .42,
        light[q]*.72+chroma[q]*.54+Math.max(0,light[q]-neighbour)*.35);
      const isolatedStar = light[q]-neighbour > .22 && neighbour < .34;
      emission[q] = extended*(isolatedStar ? .055 : 1);
      const dark = 1-smoothstep(.025,.24,light[q]);
      const near = smoothstep(dustThreshold,.88,depth[q]);
      const context = smoothstep(.025,.18,neighbour+edge[q]*.42);
      silhouette[q] = dark*near*context;
    }
  }
  return { light, chroma, depth, edge, emission, silhouette };
}

function borderMask(px, py, width, height){
  const x = px/(width-1), y = py/(height-1);
  return smoothstep(0,.035,x)*smoothstep(0,.035,1-x)*
    smoothstep(0,.035,y)*smoothstep(0,.035,1-y);
}

function selectCells(fields, width, height, authored, triangleLimit, kind, rnd){
  const cloudSuppression = clamp01(numberFrom(authored, ['cloudSuppression'], .9));
  const filamentBias = numberFrom(authored, ['filamentBias'], .78);
  const silhouetteBias = numberFrom(authored, ['silhouetteBias'], .74);
  const candidates = [];
  for (let py = 1; py < height-2; py++){
    for (let px = 1; px < width-2; px++){
      const corners = [py*width+px, py*width+px+1,
        (py+1)*width+px, (py+1)*width+px+1];
      const average = key => corners.reduce((sum,q) => sum+fields[key][q],0)*.25;
      const edge = average('edge');
      let strength;
      if (kind === 'emission'){
        const glow = average('emission');
        const color = average('chroma');
        const structured = edge*(.55+filamentBias*.52)+color*.2;
        const broad = glow*(1-cloudSuppression)*.48;
        strength = structured+broad;
        if (strength < .042 || glow+edge < .055) continue;
      } else {
        const dark = average('silhouette');
        strength = dark*(.38+edge*(.66+silhouetteBias*.35));
        if (strength < .055) continue;
      }
      const mask = borderMask(px+.5,py+.5,width,height);
      strength *= mask;
      if (strength <= .012) continue;
      // A small deterministic perturbation prevents a rigid score cutoff while
      // keeping adjacent high-gradient cells together as readable surfaces.
      candidates.push({ px, py, strength,
        score: strength*(.94+rnd()*.12) });
    }
  }
  candidates.sort((a,b) => b.score-a.score);
  const cellLimit = Math.max(1,Math.floor(triangleLimit/2));
  if (candidates.length > cellLimit) candidates.length = cellLimit;
  return candidates;
}

function makeSourceTexture(image, tracker){
  const texture = tracker.texture(new THREE.Texture(image));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeReliefMaterial(tracker, sourceTexture, reveal, depthMorph, options){
  const uniforms = {
    uSource: { value: sourceTexture },
    uReveal: reveal,
    uDepthMorph: depthMorph,
    uOpacity: { value: options.opacity },
    uAlphaCutoff: { value: options.alphaCutoff },
    uSaturation: { value: options.saturation },
    uGain: { value: options.gain },
    uDustMix: { value: options.dustMix },
    uDustTint: { value: options.dustTint },
  };
  const material = tracker.material(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: true,
    depthWrite: options.depthWrite,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      attribute float aStrength;
      uniform float uDepthMorph;
      varying vec2 vUv;
      varying float vStrength;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main(){
        vUv = uv;
        vStrength = aStrength;
        vec3 p = position;
        p.z *= uDepthMorph;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        vNormal = normalize(normalMatrix*normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform sampler2D uSource;
      uniform float uReveal;
      uniform float uOpacity;
      uniform float uAlphaCutoff;
      uniform float uSaturation;
      uniform float uGain;
      uniform float uDustMix;
      uniform vec3 uDustTint;
      varying vec2 vUv;
      varying float vStrength;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main(){
        vec3 source = texture2D(uSource,vUv).rgb;
        float light = dot(source,vec3(.299,.587,.114));
        source = mix(vec3(light),source,uSaturation)*uGain;
        source = mix(source,uDustTint,uDustMix);
        float facing = abs(dot(normalize(vNormal),normalize(vViewDir)));
        float rim = pow(max(0.0,1.0-facing),1.45);
        float alpha = uReveal*uOpacity*(.34+vStrength*.66);
        if (alpha < uAlphaCutoff) discard;
        vec3 rimTint = mix(vec3(.12,.62,.72),vec3(1.0,.38,.13),source.r);
        gl_FragColor = vec4(source*(.82+facing*.24)+rimTint*rim*.12,alpha);
      }`,
  }));
  material.userData.baseOpacity = options.opacity;
  return material;
}

function buildReliefMesh({
  parent, cells, fields, width, height, aspect, depthWorld, depthScale,
  sourceTexture, tracker, reveal, depthMorph, authored, profile, kind,
}){
  if (!cells.length) return null;
  const used = new Map();
  const sourceIndices = [];
  const indices = [];
  const vertexIndex = sourceIndex => {
    if (used.has(sourceIndex)) return used.get(sourceIndex);
    const target = sourceIndices.length;
    used.set(sourceIndex,target);
    sourceIndices.push(sourceIndex);
    return target;
  };
  for (const cell of cells){
    const a = cell.py*width+cell.px;
    const b = a+1;
    const c = a+width;
    const d = c+1;
    const ai = vertexIndex(a), bi = vertexIndex(b);
    const ci = vertexIndex(c), di = vertexIndex(d);
    if (Math.abs(fields.depth[a]-fields.depth[d]) <=
        Math.abs(fields.depth[b]-fields.depth[c])){
      indices.push(ai,bi,di,ai,di,ci);
    } else indices.push(ai,bi,ci,bi,di,ci);
  }

  const plateWidth = DISPLAY_HEIGHT*aspect;
  const positions = new Float32Array(sourceIndices.length*3);
  const uvs = new Float32Array(sourceIndices.length*2);
  const strengths = new Float32Array(sourceIndices.length);
  const depthJitter = numberFrom(authored, ['depthJitter'], .035);
  for (let n = 0; n < sourceIndices.length; n++){
    const q = sourceIndices[n], px = q%width, py = Math.floor(q/width);
    const u = px/(width-1), v = py/(height-1);
    const coherent = Math.sin(px*.143+py*.071)+Math.cos(px*.047-py*.119);
    let z = (fields.depth[q]-.5)*depthWorld*.9*depthScale+
      coherent*depthWorld*depthJitter*.18;
    if (kind === 'silhouette') z += depthWorld*.034;
    positions[n*3] = (u-.5)*plateWidth;
    positions[n*3+1] = (.5-v)*DISPLAY_HEIGHT;
    positions[n*3+2] = z;
    uvs[n*2] = u;
    uvs[n*2+1] = 1-v;
    strengths[n] = clamp01(kind === 'emission'
      ? fields.edge[q]*.72+fields.emission[q]*.44+fields.chroma[q]*.16
      : fields.silhouette[q]*.78+fields.edge[q]*.34);
  }

  const geometry = tracker.geometry(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setAttribute('aStrength',new THREE.BufferAttribute(strengths,1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const tint = dustColor(profile);
  const alphaCutoff = numberFrom(authored,['alphaCutoff'],.035);
  const material = makeReliefMaterial(tracker,sourceTexture,reveal,depthMorph,{
    opacity: kind === 'emission'
      ? numberFrom(authored,['gasOpacity'],.74)
      : numberFrom(authored,['dustOpacity'],.86),
    alphaCutoff: kind === 'emission' ? alphaCutoff : alphaCutoff*.78,
    saturation: kind === 'emission'
      ? numberFrom(authored,['saturation'],1.28) : .84,
    gain: kind === 'emission' ? 1.04 : .54,
    dustMix: kind === 'silhouette' ? .58 : 0,
    dustTint: tint,
    depthWrite: kind === 'silhouette',
  });
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = kind === 'emission'
    ? 'source-depth-emission-relief' : 'source-depth-silhouette-relief';
  mesh.renderOrder = kind === 'emission' ? 7 : 11;
  parent.add(mesh);
  return { mesh, triangles: indices.length/3, vertices: sourceIndices.length };
}

export function buildPhotoRelief({
  parent, image, depthImage, aspect, profile, budget, tracker, reveal, seed,
}){
  const reconstruction = profile.reconstruction || {};
  const authored = { ...reconstruction, ...(profile.matter || {}) };
  const sampleWidth = Math.max(64,Math.min(budget.reliefSample || 160,
    Math.round(numberFrom(authored,['sampleWidth'],budget.reliefSample || 160))));
  const sampleHeight = Math.max(32,Math.round(sampleWidth/Math.max(aspect,.01)));
  const source = pixels(image,sampleWidth,sampleHeight);
  const depthSource = depthImage ? pixels(depthImage,sampleWidth,sampleHeight) : null;
  const fields = buildFields(source,depthSource,sampleWidth,sampleHeight,authored);
  const rnd = mulberry(hashStr(seed));
  const depthWorld = numberFrom(profile.volume,['depth','depthWorld'],30);
  const depthScale = numberFrom(profile.volume,['depthScale'],1)*
    numberFrom(authored,['depthScale','depthRelief'],1);
  const emissionLimit = Math.max(400,Math.min(budget.reliefTriangles || 9000,
    Math.round(numberFrom(authored,['gasTriangles'],
      budget.reliefTriangles || 9000))));
  const silhouetteLimit = Math.max(120,Math.min(budget.dustTriangles || 1500,
    Math.round(numberFrom(authored,['dustTriangles'],
      budget.dustTriangles || 1500))));
  const emissionCells = selectCells(fields,sampleWidth,sampleHeight,authored,
    emissionLimit,'emission',rnd);
  const silhouetteCells = selectCells(fields,sampleWidth,sampleHeight,authored,
    silhouetteLimit,'silhouette',rnd);
  const sourceTexture = makeSourceTexture(image,tracker);
  const depthMorph = { value: .12 };
  const root = new THREE.Group();
  root.name = 'registered-triangulated-relief';
  root.visible = false;
  root.userData.genericSoftClouds = false;
  root.userData.reconstruction = reconstruction;
  parent.add(root);
  const shared = {
    parent: root, fields, width: sampleWidth, height: sampleHeight, aspect,
    depthWorld, depthScale, sourceTexture, tracker, reveal, depthMorph,
    authored, profile,
  };
  const emission = buildReliefMesh({ ...shared,cells: emissionCells,kind: 'emission' });
  const silhouette = buildReliefMesh({
    ...shared,cells: silhouetteCells,kind: 'silhouette',
  });
  root.userData.emissionTriangles = emission ? emission.triangles : 0;
  root.userData.silhouetteTriangles = silhouette ? silhouette.triangles : 0;

  const counts = {
    emissionTriangles: emission ? emission.triangles : 0,
    silhouetteTriangles: silhouette ? silhouette.triangles : 0,
    emissionVertices: emission ? emission.vertices : 0,
    silhouetteVertices: silhouette ? silhouette.vertices : 0,
  };
  return {
    root,
    emission: emission && emission.mesh,
    silhouette: silhouette && silhouette.mesh,
    counts,
    update(revealValue){
      const amount = clamp01(revealValue);
      depthMorph.value = .12+amount*.88;
      const visible = amount > .002;
      root.visible = visible;
      if (emission) emission.mesh.visible = visible;
      if (silhouette) silhouette.mesh.visible = visible;
    },
  };
}
