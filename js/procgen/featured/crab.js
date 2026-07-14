/* Crab Nebula: model-first remnant sculpt with sourced observation sidecars.
   The spatial reconstruction stays visible in every chapter. Hubble and Webb
   products remain flat archive evidence and are never extruded into a cloud,
   painted onto the model, or treated as recovered line-of-sight depth. */

import * as THREE from 'three';
import { TEX_TIER } from '../../core/quality.js';
import { mulberry, hashStr, gaussian } from '../../utils/rng.js';
import { loadTexture } from '../../utils/assets.js';
import { ResourceScope } from './resourceScope.js';

const HUBBLE_1999 = 'images/crab/hubble-1999.jpg';
const HUBBLE_2024 = 'images/crab/hubble-2024.jpg';
const WEBB_2023 = 'images/crab/webb-2023.jpg';
const WEBB_ASPECT = 4000 / 3483;

const IMAGE_CREDIT =
  'Hubble 1999/2024: NASA, ESA, STScI, W. Blair; processing J. DePasquale · Webb 2023: NASA, ESA, CSA, STScI, T. Temim';
const MODEL_CREDIT =
  'Scientific 3D model · filament depth, ejecta placement, color and pulsar-wind scale are interpretive';

const HIGH_TIER = TEX_TIER === 'high';
const PRECISION = HIGH_TIER ? 'highp' : 'mediump';
const QUALITY = Object.freeze(HIGH_TIER ? Object.freeze({
  shellWidth: 112,
  shellHeight: 64,
  filamentPaths: 28,
  filamentSteps: 34,
  filamentKnots: 420,
  tubeSegments: 144,
  tubeCrossSegments: 12,
  wispSegments: 112,
  jetLengthSegments: 38,
  jetRadialSegments: 24,
  blastShards: 108,
}) : Object.freeze({
  shellWidth: 60,
  shellHeight: 34,
  filamentPaths: 17,
  filamentSteps: 22,
  filamentKnots: 170,
  tubeSegments: 76,
  tubeCrossSegments: 8,
  wispSegments: 60,
  jetLengthSegments: 22,
  jetRadialSegments: 14,
  blastShards: 46,
}));

const STATES = Object.freeze({
  SUPERNOVA: 'crab.supernova-flash',
  DISCOVERY: 'crab.optical-discovery',
  BACKTRACE: 'crab.expansion-backtrace',
  PULSAR: 'crab.pulsar-engine',
  WEBB: 'crab.webb-infrared',
  EXPANSION: 'crab.hubble-expansion-1999-2024',
});

const PRESETS = Object.freeze({
  [STATES.SUPERNOVA]: {
    filaments: .16, cocoon: .08, ejecta: .10, knots: .08,
    engine: .10, blast: 1, warm: .55, archive: 0, archiveMode: 'none',
  },
  [STATES.DISCOVERY]: {
    filaments: .92, cocoon: .52, ejecta: .66, knots: .62,
    engine: .30, blast: 0, warm: .24, archive: 1, archiveMode: 'hubble',
  },
  [STATES.BACKTRACE]: {
    filaments: 1.16, cocoon: .38, ejecta: .54, knots: .96,
    engine: .24, blast: 0, warm: .30, archive: .92, archiveMode: 'hubble',
  },
  [STATES.PULSAR]: {
    filaments: .94, cocoon: 1.06, ejecta: .86, knots: .62,
    engine: 1.18, blast: 0, warm: .14, archive: 0, archiveMode: 'none',
  },
  [STATES.WEBB]: {
    filaments: 1.08, cocoon: .92, ejecta: .78, knots: .64,
    engine: .62, blast: 0, warm: .86, archive: 1, archiveMode: 'webb',
  },
  [STATES.EXPANSION]: {
    filaments: 1.18, cocoon: .48, ejecta: .70, knots: 1,
    engine: .40, blast: 0, warm: .34, archive: 1, archiveMode: 'comparison',
  },
});

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function clampStep(dt){
  return THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
}

function damp(value, target, speed, dt){
  return THREE.MathUtils.lerp(value, target, 1-Math.exp(-speed*dt));
}

function stateFromVisual(visual){
  const raw = typeof visual === 'string'
    ? visual
    : visual && (visual.state || visual.moment || visual.id);
  if (raw && Object.values(STATES).includes(raw)) return raw;
  const value = String(raw || '').toLowerCase();
  if (/1054|supernova|flash/.test(value)) return STATES.SUPERNOVA;
  if (/1731|found|discover|optical/.test(value)) return STATES.DISCOVERY;
  if (/1928|linked|backtrace|inference/.test(value)) return STATES.BACKTRACE;
  if (/2023|webb|infrared/.test(value)) return STATES.WEBB;
  if (/2026|hubble|expansion|1999-2024/.test(value)) return STATES.EXPANSION;
  return STATES.PULSAR;
}

function makeIrregularShellGeometry(scope, {
  radius,
  axes,
  phase,
  role,
  widthSegments = QUALITY.shellWidth,
  heightSegments = QUALITY.shellHeight,
}){
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let y = 0; y <= heightSegments; y++){
    const v = y/heightSegments;
    const phi = v*Math.PI;
    const sinPhi = Math.sin(phi);
    for (let x = 0; x <= widthSegments; x++){
      const u = x/widthSegments;
      const theta = u*Math.PI*2;
      const cellular =
        .10*Math.sin(theta*3+phi*2.2+phase)+
        .065*Math.sin(theta*7-phi*5.3+phase*.7)+
        .035*Math.cos(theta*17+phi*11-phase*1.6);
      const polarPinch = 1-.10*Math.pow(Math.abs(Math.cos(phi)), 1.7);
      const r = radius*(1+cellular)*polarPinch;
      positions.push(
        Math.cos(theta)*sinPhi*r*axes.x,
        Math.cos(phi)*r*axes.y,
        Math.sin(theta)*sinPhi*r*axes.z,
      );
      uvs.push(u, v);
    }
  }
  const stride = widthSegments+1;
  for (let y = 0; y < heightSegments; y++){
    for (let x = 0; x < widthSegments; x++){
      const a = y*stride+x;
      const b = a+stride;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  const geometry = scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface = true;
  geometry.userData.scientificRole = role;
  return geometry;
}

function makeSurfaceMaterial(scope, {
  name,
  inner,
  outer,
  opacity,
  cutout,
  scale,
  fresnel = 1.5,
  blending = THREE.NormalBlending,
}){
  const material = scope.own(new THREE.ShaderMaterial({
    name,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uInner: { value: new THREE.Color(inner) },
      uOuter: { value: new THREE.Color(outer) },
      uCutout: { value: cutout },
      uScale: { value: scale },
      uFresnel: { value: fresnel },
      uWarm: { value: 0 },
    },
    vertexShader: `
      precision ${PRECISION} float;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec2 vUv;
      void main(){
        vLocal=position;
        vUv=uv;
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        vNormalView=normalize(normalMatrix*normal);
        vView=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      precision ${PRECISION} float;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uInner;
      uniform vec3 uOuter;
      uniform float uCutout;
      uniform float uScale;
      uniform float uFresnel;
      uniform float uWarm;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec2 vUv;
      void main(){
        float a=sin(dot(vLocal,vec3(.71,1.13,.47))*uScale+uTime*.045);
        float b=sin(dot(vLocal,vec3(-1.07,.31,.89))*uScale*1.67-uTime*.035);
        float c=sin(vUv.x*47.0+vUv.y*29.0+sin(vUv.y*13.0)*2.2);
        float cells=.50+a*.20+b*.18+c*.12;
        // A broad transition keeps the gas volume porous without reducing it
        // to isolated hard patches between the optical filaments.
        float occupied=smoothstep(max(0.0,uCutout-.08),
          min(.98,uCutout+.20),cells);
        float facing=abs(dot(normalize(vNormalView),normalize(vView)));
        float rim=pow(max(0.0,1.0-facing),uFresnel);
        float ridge=smoothstep(.34,.78,cells);
        float alpha=uOpacity*occupied*(.40+.60*rim)*(.72+.28*ridge);
        if(alpha<.018) discard;
        vec3 warm=vec3(1.0,.31,.10);
        vec3 color=mix(uInner,uOuter,clamp(.18+rim*.58+cells*.20,0.0,1.0));
        color=mix(color,mix(color,warm,.36),uWarm);
        gl_FragColor=vec4(color*(.78+rim*.62+ridge*.14),alpha);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending,
    toneMapped: false,
  }));
  material.userData.baseOpacity = opacity;
  material.userData.scientificRole = name;
  return material;
}

function ellipsoidPoint(latitude, longitude, axes, radial = 1){
  const cosLat = Math.cos(latitude);
  return new THREE.Vector3(
    Math.cos(longitude)*cosLat*axes.x*radial,
    Math.sin(latitude)*axes.y*radial,
    Math.sin(longitude)*cosLat*axes.z*radial,
  );
}

/* One indexed surface contains local, broad, torn filament ribbons. Paths use
   offset Catmull-Rom control points and cover only a neighborhood of the
   remnant: no pole-to-pole or latitude/longitude rails that could read as a
   wireframe cage. Golden-angle anchors keep the bundles distributed without
   making a triangular lattice. */
function makeFilamentCageGeometry(scope, rnd){
  const positions = [];
  const colors = [];
  const uvs = [];
  const seeds = [];
  const indices = [];
  const axes = new THREE.Vector3(38,31,22);
  const palette = [0xff7d42,0xe44937,0xffb05a,0xb83c62,0xf06635,0xffc06a];
  const point = new THREE.Vector3();
  const before = new THREE.Vector3();
  const after = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const across = new THREE.Vector3();

  function appendPath(path, width, color, seed){
    const base = positions.length/3;
    for (let j = 0; j < path.length; j++){
      const t = j/(path.length-1);
      point.copy(path[j]);
      before.copy(path[Math.max(0,j-1)]);
      after.copy(path[Math.min(path.length-1,j+1)]);
      tangent.copy(after).sub(before).normalize();
      normal.set(point.x/(axes.x*axes.x),point.y/(axes.y*axes.y),
        point.z/(axes.z*axes.z)).normalize();
      across.copy(normal).cross(tangent).normalize();
      const taper=.10+.90*Math.pow(Math.sin(Math.PI*t),.38);
      const bulge=.72+.28*Math.sin(Math.PI*t*(1+(Math.floor(seed)%2))+
        seed*.37);
      const torn=1+.19*Math.sin(t*23+seed)+.10*Math.sin(t*61-seed*.7);
      for (const side of [-1,1]){
        const asymmetric=side<0?.82+rnd()*.24:.94+rnd()*.28;
        const edge=side*width*taper*bulge*torn*asymmetric;
        positions.push(
          point.x+across.x*edge+normal.x*Math.sin(t*29+seed)*.16,
          point.y+across.y*edge+normal.y*Math.sin(t*29+seed)*.16,
          point.z+across.z*edge+normal.z*Math.sin(t*29+seed)*.16,
        );
        colors.push(color.r,color.g,color.b);
        uvs.push(side<0?0:1,t);
        seeds.push(seed);
      }
    }
    for (let j = 0; j < path.length-1; j++){
      const a=base+j*2;
      indices.push(a,a+1,a+2,a+1,a+3,a+2);
    }
  }

  const goldenAngle=Math.PI*(3-Math.sqrt(5));
  for (let i=0;i<QUALITY.filamentPaths;i++){
    const phase=rnd()*Math.PI*2;
    const anchorFraction=(i+.5)/QUALITY.filamentPaths;
    const anchorLatitude=Math.asin(anchorFraction*2-1)*.76+gaussian(rnd)*.045;
    const anchorLongitude=i*goldenAngle+(rnd()-.5)*.34;
    const heading=rnd()*Math.PI*2;
    const span=.52+rnd()*.72;
    const latitudeRun=Math.cos(heading)*span*.62;
    const longitudeRun=Math.sin(heading)*span/
      Math.max(.52,Math.cos(anchorLatitude));
    const controlPoints=[];
    const controlCount=5+(i%3);
    for(let control=0;control<controlCount;control++){
      const s=control/(controlCount-1)-.5;
      const bend=Math.sin((s+.5)*Math.PI*2+phase)*(.075+rnd()*.055);
      const counterBend=Math.sin((s+.5)*Math.PI*3-phase*.63)*
        (.075+rnd()*.070);
      const latitude=THREE.MathUtils.clamp(
        anchorLatitude+latitudeRun*s+bend+gaussian(rnd)*.025,-1.28,1.28);
      const longitude=anchorLongitude+longitudeRun*s+counterBend+
        gaussian(rnd)*.035;
      const radial=.91+.055*Math.sin(s*Math.PI*3+phase)+
        .025*Math.sin(s*Math.PI*7-phase*.4)+gaussian(rnd)*.012;
      controlPoints.push(ellipsoidPoint(latitude,longitude,axes,radial));
    }
    const curve=new THREE.CatmullRomCurve3(controlPoints,false,'centripetal',.45);
    const steps=QUALITY.filamentSteps+(i%3)*3;
    const path=curve.getPoints(steps-1);
    const color=new THREE.Color(palette[i%palette.length]);
    const width=1.15+rnd()*1.85;
    appendPath(path,width,color,phase+i*.31);
  }

  const geometry=scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface=true;
  geometry.userData.scientificRole='three-dimensional-optical-filament-ribbon-cage';
  return geometry;
}

function makeFilamentMaterial(scope){
  const material=scope.own(new THREE.ShaderMaterial({
    name:'Crab.FilamentRibbonMaterial',
    uniforms:{
      uTime:{value:0},
      uOpacity:{value:1},
      uWarm:{value:0},
    },
    vertexShader:`
      precision ${PRECISION} float;
      attribute float aSeed;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec2 vUv;
      varying float vSeed;
      void main(){
        vColor=color;
        vUv=uv;
        vSeed=aSeed;
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        vNormalView=normalize(normalMatrix*normal);
        vView=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      precision ${PRECISION} float;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uWarm;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec2 vUv;
      varying float vSeed;
      float hash21(vec2 p){
        p=fract(p*vec2(123.34,456.21));
        p+=dot(p,p+45.32);
        return fract(p.x*p.y);
      }
      void main(){
        float edge=smoothstep(.015,.18,min(vUv.x,1.0-vUv.x));
        float ends=smoothstep(0.0,.055,vUv.y)*smoothstep(0.0,.055,1.0-vUv.y);
        float cellular=.55+.27*sin(vUv.y*31.0+vSeed)+
          .18*sin(vUv.y*73.0-vSeed*.7);
        float grain=hash21(floor(vUv*vec2(8.0,67.0))+vSeed);
        float brokenArc=.5+.5*sin(vUv.y*(12.0+mod(vSeed,6.0))+vSeed*1.7);
        if(cellular+grain*.20<.28||brokenArc<.075) discard;
        float facing=abs(dot(normalize(vNormalView),normalize(vView)));
        float ridge=pow(max(0.0,1.0-facing),1.15);
        vec3 warm=vec3(1.0,.25,.07);
        vec3 color=mix(vColor,mix(vColor,warm,.42),uWarm);
        float alpha=uOpacity*edge*ends*(.72+.28*grain)*(.74+.26*ridge);
        if(alpha<.025) discard;
        gl_FragColor=vec4(color*(.76+ridge*.46+cellular*.14),alpha);
      }`,
    vertexColors:true,
    transparent:true,
    depthWrite:false,
    depthTest:true,
    side:THREE.DoubleSide,
    blending:THREE.NormalBlending,
    toneMapped:false,
  }));
  material.userData.baseOpacity=1;
  return material;
}

function addFilamentKnots(scope,parent,rnd){
  const geometry=scope.own(new THREE.IcosahedronGeometry(1,1));
  geometry.userData.scientificRole='faceted-optical-filament-knot-prototype';
  const material=scope.own(new THREE.MeshStandardMaterial({
    name:'Crab.FilamentKnotMaterial',
    color:0xffffff,
    emissive:0x7d1f12,
    emissiveIntensity:1.65,
    roughness:.63,
    metalness:.02,
    flatShading:true,
    vertexColors:true,
    transparent:true,
    opacity:.86,
    depthWrite:false,
    toneMapped:false,
  }));
  const mesh=scope.own(new THREE.InstancedMesh(
    geometry,material,QUALITY.filamentKnots));
  mesh.name='Crab.FacetedFilamentKnots';
  mesh.userData.instanceRole='dense-optical-ejecta-knots';
  const dummy=new THREE.Object3D();
  const palette=[0xff6a3d,0xffad58,0xd83442,0x5ec8c2,0xff7759];
  for(let i=0;i<QUALITY.filamentKnots;i++){
    const latitude=Math.asin(rnd()*2-1)*.92;
    const longitude=rnd()*Math.PI*2;
    const radial=.79+Math.pow(rnd(),.55)*.20;
    dummy.position.copy(ellipsoidPoint(latitude,longitude,
      new THREE.Vector3(38,31,22),radial));
    dummy.position.x+=gaussian(rnd)*.42;
    dummy.position.y+=gaussian(rnd)*.42;
    dummy.position.z+=gaussian(rnd)*.30;
    dummy.rotation.set(rnd()*Math.PI,rnd()*Math.PI,rnd()*Math.PI);
    const scale=.18+Math.pow(rnd(),2.1)*.82;
    dummy.scale.set(scale*(.62+rnd()*.82),scale*(.54+rnd()*.96),
      scale*(.58+rnd()*.70));
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
    mesh.setColorAt(i,new THREE.Color(palette[i%palette.length]));
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
  mesh.renderOrder=6;
  parent.add(mesh);
  return {mesh,material};
}

function makeEllipticalTubeGeometry(scope,{
  radiusX,
  radiusY,
  tube,
  segments=QUALITY.tubeSegments,
  crossSegments=QUALITY.tubeCrossSegments,
  phase=0,
  role,
}){
  const positions=[];
  const normals=[];
  const uvs=[];
  const indices=[];
  for(let ring=0;ring<=segments;ring++){
    const u=ring/segments;
    const theta=u*Math.PI*2;
    const cx=Math.cos(theta)*radiusX;
    const cy=Math.sin(theta)*radiusY;
    const cz=Math.sin(theta*5+phase)*.18;
    const radial=new THREE.Vector3(Math.cos(theta),Math.sin(theta),0).normalize();
    const corrugation=1+.13*Math.sin(theta*13+phase)+.055*Math.sin(theta*31-phase);
    for(let side=0;side<=crossSegments;side++){
      const v=side/crossSegments;
      const phi=v*Math.PI*2;
      const normal=radial.clone().multiplyScalar(Math.cos(phi))
        .addScaledVector(new THREE.Vector3(0,0,1),Math.sin(phi)).normalize();
      const r=tube*corrugation*(1+.08*Math.sin(phi*3+theta*7));
      positions.push(cx+normal.x*r,cy+normal.y*r,cz+normal.z*r);
      normals.push(normal.x,normal.y,normal.z);
      uvs.push(u,v);
    }
  }
  const stride=crossSegments+1;
  for(let ring=0;ring<segments;ring++){
    for(let side=0;side<crossSegments;side++){
      const a=ring*stride+side;
      const b=a+stride;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  const geometry=scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface=true;
  geometry.userData.scientificRole=role;
  return geometry;
}

function makeArcRibbonGeometry(scope,{
  inner,
  outer,
  start,
  span,
  z,
  phase,
  role,
}){
  const positions=[];
  const uvs=[];
  const indices=[];
  for(let i=0;i<=QUALITY.wispSegments;i++){
    const u=i/QUALITY.wispSegments;
    const theta=start+u*span;
    const wobble=Math.sin(theta*7+phase)*.16;
    for(const side of [0,1]){
      const radius=THREE.MathUtils.lerp(inner,outer,side)+
        Math.sin(theta*11+phase)*.10;
      positions.push(Math.cos(theta)*radius,Math.sin(theta)*radius,
        z+wobble+(side-.5)*.12);
      uvs.push(u,side);
    }
  }
  for(let i=0;i<QUALITY.wispSegments;i++){
    const a=i*2;
    indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  const geometry=scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface=true;
  geometry.userData.scientificRole=role;
  return geometry;
}

function makeJetSurfaceGeometry(scope,{direction,role}){
  const positions=[];
  const uvs=[];
  const indices=[];
  for(let y=0;y<=QUALITY.jetLengthSegments;y++){
    const v=y/QUALITY.jetLengthSegments;
    const axial=direction*(2.0+v*27);
    const radius=.58+v*.78+.24*Math.sin(v*Math.PI*5.5);
    const cx=Math.sin(v*8.2)*.34*v;
    const cy=Math.sin(v*5.7+1.3)*.28*v;
    for(let x=0;x<=QUALITY.jetRadialSegments;x++){
      const u=x/QUALITY.jetRadialSegments;
      const theta=u*Math.PI*2;
      const patch=1+.13*Math.sin(theta*5+v*19)+.07*Math.sin(theta*11-v*9);
      positions.push(cx+Math.cos(theta)*radius*patch,
        cy+Math.sin(theta)*radius*patch,axial);
      uvs.push(u,v);
    }
  }
  const stride=QUALITY.jetRadialSegments+1;
  for(let y=0;y<QUALITY.jetLengthSegments;y++){
    for(let x=0;x<QUALITY.jetRadialSegments;x++){
      const a=y*stride+x;
      const b=a+stride;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  const geometry=scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface=true;
  geometry.userData.scientificRole=role;
  return geometry;
}

function makeEngineMaterial(scope,{name,inner,outer,opacity,segments,cutout}){
  const material=scope.own(new THREE.ShaderMaterial({
    name,
    uniforms:{
      uTime:{value:0},
      uOpacity:{value:opacity},
      uInner:{value:new THREE.Color(inner)},
      uOuter:{value:new THREE.Color(outer)},
      uSegments:{value:segments},
      uCutout:{value:cutout},
    },
    vertexShader:`
      precision ${PRECISION} float;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vView;
      void main(){
        vUv=uv;
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        vNormalView=normalize(normalMatrix*normal);
        vView=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      precision ${PRECISION} float;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uInner;
      uniform vec3 uOuter;
      uniform float uSegments;
      uniform float uCutout;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vView;
      void main(){
        float clumps=.52+.30*sin(vUv.x*uSegments*6.28318-uTime*.28)+
          .18*sin(vUv.x*uSegments*13.0+vUv.y*8.0+uTime*.17);
        float crossGlow=.58+.42*sin(vUv.y*6.28318)*sin(vUv.y*6.28318);
        if(clumps<uCutout) discard;
        float facing=abs(dot(normalize(vNormalView),normalize(vView)));
        float rim=pow(max(0.0,1.0-facing),1.15);
        vec3 color=mix(uInner,uOuter,clamp(.20+rim*.56+clumps*.20,0.0,1.0));
        float alpha=uOpacity*(.62+.38*rim)*crossGlow;
        if(alpha<.018) discard;
        gl_FragColor=vec4(color*(1.0+rim*.72+clumps*.18),alpha);
      }`,
    transparent:true,
    depthWrite:false,
    depthTest:true,
    side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending,
    toneMapped:false,
  }));
  material.userData.baseOpacity=opacity;
  return material;
}

function buildPulsarEngine(scope,parent){
  const root=new THREE.Group();
  root.name='Crab.PulsarWindEngine';
  root.rotation.set(.24,-.34,.10);
  // The termination shock is physically tiny beside the optical remnant.
  // It is still display-scale exaggerated, but must read as its compact engine
  // rather than touching or clipping through the outer filament cage.
  root.scale.setScalar(.80);
  parent.add(root);

  const innerMaterial=makeEngineMaterial(scope,{
    name:'Crab.TerminationShockMaterial',inner:0xeefcff,outer:0x4fbfff,
    opacity:.92,segments:13,cutout:.22,
  });
  const outerMaterial=makeEngineMaterial(scope,{
    name:'Crab.OuterWindRingMaterial',inner:0xaed9ff,outer:0x7b4ce1,
    opacity:.58,segments:9,cutout:.34,
  });
  const wispMaterial=makeEngineMaterial(scope,{
    name:'Crab.MovingWispMaterial',inner:0xdaf8ff,outer:0x4d72dc,
    opacity:.48,segments:7,cutout:.28,
  });
  const jetMaterial=makeEngineMaterial(scope,{
    name:'Crab.PolarJetMaterial',inner:0xe8fbff,outer:0x3a8dd8,
    opacity:.56,segments:11,cutout:.32,
  });

  const inner=new THREE.Mesh(makeEllipticalTubeGeometry(scope,{
    radiusX:6.5,radiusY:4.1,tube:.52,phase:.3,
    role:'indexed-pulsar-termination-shock-tube',
  }),innerMaterial);
  inner.name='Crab.IndexedTerminationShock';
  inner.renderOrder=9;
  root.add(inner);

  const outer=new THREE.Mesh(makeEllipticalTubeGeometry(scope,{
    radiusX:10.1,radiusY:6.1,tube:.42,phase:1.7,
    role:'indexed-outer-pulsar-wind-tube',
  }),outerMaterial);
  outer.name='Crab.IndexedOuterWindRing';
  outer.rotation.z=-.08;
  outer.renderOrder=8;
  root.add(outer);

  const wisps=[];
  for(let i=0;i<5;i++){
    const wisp=new THREE.Mesh(makeArcRibbonGeometry(scope,{
      inner:4.4+i*1.25,
      outer:5.2+i*1.25,
      start:.20+i*.81,
      span:Math.PI*(.62+(i%2)*.16),
      z:(i-2)*.22,
      phase:i*.87,
      role:'indexed-moving-pulsar-wisp-surface',
    }),wispMaterial);
    wisp.name=`Crab.IndexedMovingWisp.${i+1}`;
    wisp.renderOrder=8;
    root.add(wisp);
    wisps.push(wisp);
  }

  const jets=[];
  for(const direction of [-1,1]){
    const jet=new THREE.Mesh(makeJetSurfaceGeometry(scope,{
      direction,
      role:direction>0?'northwest-pulsar-jet-surface':'southeast-counterjet-surface',
    }),jetMaterial);
    jet.name=direction>0?'Crab.IndexedNorthwestJet':'Crab.IndexedSoutheastCounterjet';
    jet.renderOrder=7;
    root.add(jet);
    jets.push(jet);
  }

  const coreMaterial=scope.own(new THREE.MeshPhysicalMaterial({
    name:'Crab.PulsarCoreMaterial',
    color:0xf4fbff,
    emissive:0x7fd4ff,
    emissiveIntensity:4.2,
    roughness:.22,
    metalness:.03,
    clearcoat:.4,
    toneMapped:false,
  }));
  const coreGeometry=scope.own(new THREE.IcosahedronGeometry(.72,3));
  coreGeometry.userData.scientificRole='display-scale-exaggerated-crab-pulsar';
  const core=new THREE.Mesh(coreGeometry,coreMaterial);
  core.name='Crab.CentralPulsar';
  core.userData.displayScaleExaggerated=true;
  core.renderOrder=12;
  root.add(core);

  return {
    root,inner,outer,wisps,jets,core,coreMaterial,
    materials:[innerMaterial,outerMaterial,wispMaterial,jetMaterial],
  };
}

function buildHistoricalBlast(scope,parent,rnd){
  const root=new THREE.Group();
  root.name='Crab.SN1054IndexedExplosionReconstruction';
  parent.add(root);
  const shellMaterial=makeSurfaceMaterial(scope,{
    name:'Crab.SN1054RaggedShockMaterial',inner:0xffffff,outer:0xff6b24,
    opacity:.94,cutout:.43,scale:.72,fresnel:1.1,
    blending:THREE.AdditiveBlending,
  });
  const shellGeometry=makeIrregularShellGeometry(scope,{
    radius:11,
    axes:new THREE.Vector3(1.04,.90,.96),
    phase:4.2,
    widthSegments:Math.max(42,Math.round(QUALITY.shellWidth*.62)),
    heightSegments:Math.max(26,Math.round(QUALITY.shellHeight*.62)),
    role:'compact-ragged-1054-explosion-front',
  });
  const shell=new THREE.Mesh(shellGeometry,shellMaterial);
  shell.name='Crab.SN1054RaggedShockFront';
  shell.renderOrder=10;
  root.add(shell);

  const shardGeometry=scope.own(new THREE.TetrahedronGeometry(1,1));
  shardGeometry.userData.scientificRole='faceted-early-ejecta-shard-prototype';
  const shardMaterial=scope.own(new THREE.MeshStandardMaterial({
    name:'Crab.SN1054ShardMaterial',
    color:0xffb056,
    emissive:0xff3b11,
    emissiveIntensity:2.8,
    roughness:.58,
    flatShading:true,
    transparent:true,
    opacity:0,
    depthWrite:false,
    toneMapped:false,
  }));
  const shards=scope.own(new THREE.InstancedMesh(
    shardGeometry,shardMaterial,QUALITY.blastShards));
  shards.name='Crab.SN1054FacetedEjectaShards';
  shards.userData.instanceRole='compact-supernova-ejecta-shards';
  const dummy=new THREE.Object3D();
  for(let i=0;i<QUALITY.blastShards;i++){
    const polar=rnd()*2-1;
    const azimuth=rnd()*Math.PI*2;
    const radial=Math.sqrt(Math.max(0,1-polar*polar));
    const radius=7+Math.pow(rnd(),.74)*9;
    dummy.position.set(Math.cos(azimuth)*radial*radius,polar*radius,
      Math.sin(azimuth)*radial*radius);
    dummy.rotation.set(rnd()*Math.PI,rnd()*Math.PI,rnd()*Math.PI);
    const scale=.22+rnd()*.76;
    dummy.scale.set(scale*(.55+rnd()),scale*(.62+rnd()*.72),
      scale*(.55+rnd()*.88));
    dummy.updateMatrix();
    shards.setMatrixAt(i,dummy.matrix);
  }
  shards.instanceMatrix.needsUpdate=true;
  shards.renderOrder=11;
  root.add(shards);

  const coreMaterial=scope.own(new THREE.MeshPhysicalMaterial({
    name:'Crab.SN1054FlashCoreMaterial',
    color:0xffffff,
    emissive:0xffb25a,
    emissiveIntensity:5,
    roughness:.2,
    transparent:true,
    opacity:0,
    depthWrite:false,
    toneMapped:false,
  }));
  const core=new THREE.Mesh(scope.own(new THREE.IcosahedronGeometry(2.1,3)),
    coreMaterial);
  core.name='Crab.SN1054CompactFlashCore';
  core.renderOrder=12;
  root.add(core);
  return {root,shell,shellMaterial,shards,shardMaterial,core,coreMaterial};
}

function makeArchivePanel(scope,{name,file,width,aspect,accent}){
  const group=new THREE.Group();
  group.name=name;
  group.userData.flatScientificSource=true;
  group.userData.sourceFile=file;
  const height=width/aspect;
  const backingMaterial=scope.own(new THREE.MeshBasicMaterial({
    name:`${name}.BackingMaterial`,
    color:0x020609,
    transparent:true,
    opacity:0,
    depthWrite:false,
    depthTest:false,
    side:THREE.DoubleSide,
  }));
  const backing=new THREE.Mesh(scope.own(new THREE.PlaneGeometry(width+1.3,height+1.3)),
    backingMaterial);
  backing.name=`${name}.Backing`;
  backing.position.z=-.12;
  backing.renderOrder=70;
  group.add(backing);

  const imageMaterial=scope.own(new THREE.MeshBasicMaterial({
    name:`${name}.ImageMaterial`,
    color:0xffffff,
    transparent:true,
    opacity:0,
    depthWrite:false,
    depthTest:false,
    side:THREE.DoubleSide,
    toneMapped:false,
  }));
  imageMaterial.userData.keepMaps=true;
  const image=new THREE.Mesh(scope.own(new THREE.PlaneGeometry(width,height)),imageMaterial);
  image.name=`${name}.AuthenticObservation`;
  image.userData.flatScientificSource=true;
  image.renderOrder=71;
  group.add(image);

  const frameMaterial=scope.own(new THREE.MeshBasicMaterial({
    name:`${name}.FrameMaterial`,
    color:accent,
    transparent:true,
    opacity:0,
    depthWrite:false,
    depthTest:false,
    toneMapped:false,
  }));
  const horizontal=scope.own(new THREE.BoxGeometry(1,1,.08));
  const vertical=scope.own(new THREE.BoxGeometry(1,1,.08));
  for(const y of [-height*.5-.38,height*.5+.38]){
    const bar=new THREE.Mesh(horizontal,frameMaterial);
    bar.scale.set(width+1.45,.11,1);
    bar.position.set(0,y,.06);
    bar.renderOrder=72;
    group.add(bar);
  }
  for(const x of [-width*.5-.38,width*.5+.38]){
    const bar=new THREE.Mesh(vertical,frameMaterial);
    bar.scale.set(.11,height+1.45,1);
    bar.position.set(x,0,.06);
    bar.renderOrder=72;
    group.add(bar);
  }

  let requested=false;
  let loaded=false;
  function request(){
    if(requested||scope.disposed) return;
    requested=true;
    loadTexture(file,scope.guard(texture=>{
      imageMaterial.map=texture;
      imageMaterial.needsUpdate=true;
      loaded=true;
      group.userData.sourceLoaded=true;
    }));
  }
  function setOpacity(alpha){
    const visible=alpha>.003;
    group.visible=visible;
    if(visible) request();
    backingMaterial.opacity=.88*alpha;
    imageMaterial.opacity=(loaded?1:0)*alpha;
    frameMaterial.opacity=.72*alpha;
  }
  setOpacity(0);
  return {group,setOpacity,width,height,file};
}

function buildArchiveDock(scope,parent){
  const root=new THREE.Group();
  root.name='Crab.AuthenticObservationArchive';
  root.userData.observationSidecar=true;
  root.userData.sourceIsFlatObservation=true;
  root.userData.modelReplacement=false;
  parent.add(root);

  const hubble=makeArchivePanel(scope,{
    name:'Crab.Hubble2024Context',file:HUBBLE_2024,width:25,aspect:1,
    accent:0xff9a70,
  });
  const webb=makeArchivePanel(scope,{
    name:'Crab.Webb2023Infrared',file:WEBB_2023,width:26,aspect:WEBB_ASPECT,
    accent:0xb78cff,
  });
  const earlier=makeArchivePanel(scope,{
    name:'Crab.Hubble1999Registered',file:HUBBLE_1999,width:14.6,aspect:1,
    accent:0xff8870,
  });
  const later=makeArchivePanel(scope,{
    name:'Crab.Hubble2024Registered',file:HUBBLE_2024,width:14.6,aspect:1,
    accent:0x72d8ff,
  });
  earlier.group.position.x=-7.75;
  later.group.position.x=7.75;
  root.add(hubble.group,webb.group,earlier.group,later.group);

  let mode='none';
  let alpha=0;
  const cameraQuaternion=new THREE.Quaternion();
  const right=new THREE.Vector3();
  const up=new THREE.Vector3();

  function setMode(next){
    mode=next||'none';
    root.userData.activeArchiveMode=mode;
  }
  function dimensions(){
    if(mode==='comparison') return {width:31,height:14.6};
    if(mode==='webb') return {width:webb.width,height:webb.height};
    return {width:hubble.width,height:hubble.height};
  }
  function update(dt,camera,targetAlpha){
    alpha=damp(alpha,targetAlpha,7.5,dt);
    hubble.setOpacity(mode==='hubble'?alpha:0);
    webb.setOpacity(mode==='webb'?alpha:0);
    earlier.setOpacity(mode==='comparison'?alpha:0);
    later.setOpacity(mode==='comparison'?alpha:0);
    root.visible=alpha>.003&&mode!=='none';
    if(!root.visible||!camera) return;

    const viewportAspect=Number.isFinite(camera.aspect)?camera.aspect:1.6;
    const distance=Math.max(1,camera.position.length());
    const halfHeight=distance*Math.tan(THREE.MathUtils.degToRad(
      Number.isFinite(camera.fov)?camera.fov:52)*.5);
    const halfWidth=halfHeight*viewportAspect;
    const size=dimensions();
    const heroRadius=36;
    let layoutScale;
    let x;
    let y;
    if(viewportAspect<1.05||halfWidth-heroRadius<18){
      const widthScale=(halfWidth*2-4)/size.width;
      const heightScale=(halfHeight-heroRadius-4)/size.height;
      layoutScale=THREE.MathUtils.clamp(Math.min(.64,widthScale,heightScale),.28,.64);
      x=0;
      y=Math.max(0,halfHeight-2-size.height*layoutScale*.5);
      root.userData.layoutMode='portrait-top-evidence-gutter';
    }else{
      layoutScale=THREE.MathUtils.clamp(
        (halfWidth-heroRadius-5)/size.width,.38,.82);
      x=halfWidth-2-size.width*layoutScale*.5;
      y=Math.min(8,halfHeight*.14);
      root.userData.layoutMode='landscape-side-evidence-gutter';
    }
    root.scale.setScalar(layoutScale*(.97+alpha*.03));
    camera.getWorldQuaternion(cameraQuaternion);
    root.quaternion.copy(cameraQuaternion);
    right.copy(X_AXIS).applyQuaternion(cameraQuaternion);
    up.copy(Y_AXIS).applyQuaternion(cameraQuaternion);
    root.position.copy(right).multiplyScalar(x).addScaledVector(up,y);
    root.userData.layoutScale=layoutScale;
  }
  return {root,setMode,update,get mode(){return mode;}};
}

function setSurfaceOpacity(material,value){
  material.uniforms.uOpacity.value=Math.max(0,value);
  material.visible=value>.002;
}

function setSurfaceTime(material,time){
  material.uniforms.uTime.value=time;
}

export function buildCrabFeatured({entry}){
  const scope=new ResourceScope('crab-model-first');
  const group=new THREE.Group();
  group.name='Crab.ModelFirstRemnantAndArchive';
  const modelRoot=new THREE.Group();
  modelRoot.name='Crab.PersistentThreeDimensionalRemnant';
  modelRoot.userData.persistentThreeDimensionalModel=true;
  group.add(modelRoot);
  const rnd=mulberry(hashStr(`crab-model-first:${entry&&entry.id||'crab'}`));

  const cocoonMaterial=makeSurfaceMaterial(scope,{
    name:'Crab.SynchrotronCocoonMaterial',inner:0x203c89,outer:0x6f9eff,
    opacity:.44,cutout:.32,scale:.23,fresnel:1.65,
  });
  const cocoon=new THREE.Mesh(makeIrregularShellGeometry(scope,{
    radius:25,
    axes:new THREE.Vector3(1.02,.82,.73),
    phase:1.3,
    role:'porous-blue-synchrotron-cocoon-surface',
  }),cocoonMaterial);
  cocoon.name='Crab.PorousSynchrotronCocoon';
  cocoon.renderOrder=1;
  modelRoot.add(cocoon);

  const ejectaMaterial=makeSurfaceMaterial(scope,{
    name:'Crab.FragmentedEjectaSurfaceMaterial',inner:0x5d6fa8,outer:0xe05436,
    opacity:.38,cutout:.42,scale:.30,fresnel:1.45,
  });
  const ejecta=new THREE.Mesh(makeIrregularShellGeometry(scope,{
    radius:32.5,
    axes:new THREE.Vector3(1.02,.88,.74),
    phase:3.7,
    role:'fragmented-mixed-ejecta-surface',
  }),ejectaMaterial);
  ejecta.name='Crab.FragmentedEjectaSurface';
  ejecta.renderOrder=2;
  modelRoot.add(ejecta);

  const filamentMaterial=makeFilamentMaterial(scope);
  const filamentCage=new THREE.Mesh(makeFilamentCageGeometry(scope,rnd),
    filamentMaterial);
  filamentCage.name='Crab.FilamentCageIndexedSurface';
  filamentCage.renderOrder=5;
  modelRoot.add(filamentCage);
  const knots=addFilamentKnots(scope,modelRoot,rnd);
  const engine=buildPulsarEngine(scope,modelRoot);
  const blast=buildHistoricalBlast(scope,modelRoot,rnd);
  const archive=buildArchiveDock(scope,group);

  let activeState=STATES.PULSAR;
  let previousNonWebbState=STATES.PULSAR;
  let target={...PRESETS[activeState]};
  const current={...target};
  let elapsed=0;

  Object.assign(group.userData,{
    renderer:'crab-model-first-sculpt-v3',
    activeState,
    modelFirst:true,
    modelAlwaysVisible:true,
    persistentThreeDimensionalModel:true,
    genericImageVolume:false,
    observationRequested:false,
    observationAssets:{
      hubble1999:HUBBLE_1999,
      hubble2024:HUBBLE_2024,
      webb2023:WEBB_2023,
    },
    supportedStates:Object.values(STATES),
    qualityTier:TEX_TIER,
    qualityBudget:{...QUALITY},
    primitivePolicy:
      'Indexed shell, ribbon, toroidal-flow and jet surfaces plus instanced faceted knots; no point clouds, sprites, wireframes, generic fuzzy volumes or image-extruded surfels.',
    scientificStructure:{
      filaments:
        'Broad indexed ribbons and faceted knots reconstruct the optical filament cage statistically. Their depth and branching are model-led, not tomography.',
      synchrotron:
        'A porous asymmetric inner surface communicates the pulsar-powered synchrotron volume without turning it into a smooth transparent sphere.',
      engine:
        'True cross-section termination-shock tubes, partial moving-wisp surfaces and opposed indexed jet surfaces explain the pulsar wind at strongly compressed scale.',
      observations:
        'Hubble and Webb products stay flat in a camera-relative archive sidecar. Hubble 1999/2024 share the official matched presentation; Webb is a separate wavelength and crop.',
      supernova:
        'The 1054 state is a compact ragged indexed shock and faceted ejecta reconstruction, not an observed image or a present-day shell run backward.',
    },
    scientificCaveat:
      'Filament depth, ejecta placement, color, simultaneous visibility and pulsar-wind scale are explanatory. Only the archive panels are telescope observations.',
  });

  function applyState(next){
    if(!PRESETS[next]) next=STATES.PULSAR;
    if(next!==STATES.WEBB) previousNonWebbState=next;
    activeState=next;
    target={...PRESETS[next]};
    archive.setMode(target.archiveMode);
    group.userData.activeState=next;
    group.userData.observationRequested=target.archiveMode!=='none';
    group.userData.activePresentation=target.archiveMode==='none'
      ? 'persistent-scientific-model'
      : 'model-plus-source-observation';
  }
  applyState(activeState);

  return {
    group,
    focusDist:108,
    startTheta:.34,
    startPhi:1.22,
    autoRotate:false,
    hasIR:true,
    isImage:false,
    imageCredit:IMAGE_CREDIT,
    modelCredit:MODEL_CREDIT,
    setMoment(visual){
      if(!scope.disposed) applyState(stateFromVisual(visual));
    },
    setIR(on){
      if(scope.disposed) return;
      applyState(on?STATES.WEBB:previousNonWebbState);
    },
    update(dt,camera){
      if(scope.disposed) return;
      dt=clampStep(dt);
      elapsed+=dt;
      for(const key of ['filaments','cocoon','ejecta','knots','engine','blast','warm','archive'])
        current[key]=damp(current[key],target[key],3.9,dt);

      filamentMaterial.uniforms.uOpacity.value=.96*current.filaments;
      filamentMaterial.uniforms.uTime.value=elapsed;
      filamentMaterial.uniforms.uWarm.value=current.warm;
      filamentCage.visible=current.filaments>.002;

      setSurfaceOpacity(cocoonMaterial,.44*current.cocoon);
      setSurfaceOpacity(ejectaMaterial,.38*current.ejecta);
      cocoonMaterial.uniforms.uWarm.value=current.warm*.22;
      ejectaMaterial.uniforms.uWarm.value=current.warm*.58;
      setSurfaceTime(cocoonMaterial,elapsed);
      setSurfaceTime(ejectaMaterial,elapsed);

      knots.material.opacity=Math.min(1,.86*current.knots);
      knots.material.emissiveIntensity=1.35+current.warm*.85;
      knots.mesh.visible=current.knots>.002;

      engine.root.visible=current.engine>.002;
      for(const material of engine.materials){
        material.uniforms.uOpacity.value=material.userData.baseOpacity*current.engine;
        material.uniforms.uTime.value=elapsed;
      }
      engine.inner.rotation.z=elapsed*.018;
      engine.outer.rotation.z=-elapsed*.011;
      for(let i=0;i<engine.wisps.length;i++)
        engine.wisps[i].rotation.z+=dt*(i%2?-.010:.013);
      engine.coreMaterial.emissiveIntensity=(3.4+current.engine*.95)*
        (.96+.04*Math.sin(elapsed*.92));
      engine.core.scale.setScalar(.92+current.engine*.08+
        Math.sin(elapsed*.78)*.025);

      blast.root.visible=current.blast>.002;
      setSurfaceOpacity(blast.shellMaterial,.94*current.blast);
      setSurfaceTime(blast.shellMaterial,elapsed);
      blast.shardMaterial.opacity=.88*current.blast;
      blast.coreMaterial.opacity=current.blast;
      blast.coreMaterial.emissiveIntensity=4.4*current.blast*
        (.96+.04*Math.sin(elapsed*.72));
      blast.root.scale.setScalar(.76+Math.sin(elapsed*.18)*.012);
      blast.root.rotation.y=elapsed*.010;
      blast.root.rotation.x=Math.sin(elapsed*.06)*.025;

      modelRoot.visible=true;
      filamentCage.rotation.y+=dt*.0015;
      cocoon.rotation.y-=dt*.0010;
      archive.update(dt,camera,current.archive);
      group.userData.modelVisible=true;
      group.userData.observationRequested=
        current.archive>.02&&archive.mode!=='none';
    },
    dispose(){
      if(scope.disposed) return;
      scope.dispose();
      group.removeFromParent();
      group.clear();
      group.userData.disposed=true;
    },
  };
}
