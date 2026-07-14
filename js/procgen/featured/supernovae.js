/* Dedicated model-first supernova-remnant exhibits.
   Real observations remain catalog assets for the observation/history UI; the
   primary scene is explicit geometry whose uncertain depth is disclosed in
   userData instead of a photograph extruded into a generic cloud. */

import * as THREE from 'three';
import { TEX_TIER } from '../../core/quality.js';
import { mulberry, hashStr, gaussian } from '../../utils/rng.js';
import { ResourceScope } from './resourceScope.js';

const HIGH_TIER = TEX_TIER === 'high';
const FRAGMENT_PRECISION = HIGH_TIER ? 'highp' : 'mediump';

const QUALITY = Object.freeze(HIGH_TIER ? Object.freeze({
  ringSegments: 192,
  ringCrossSegments: 14,
  shellWidthSegments: 128,
  shellHeightSegments: 72,
  hourglassLengthSegments: 48,
  hourglassRadialSegments: 96,
  hotspotCount: 24,
  casaClumps: 960,
  casaShellWidthSegments: 144,
  casaShellHeightSegments: 84,
  jetLengthSegments: 34,
  jetRadialSegments: 58,
  greenRadialSegments: 12,
  greenAngularSegments: 128,
}) : Object.freeze({
  ringSegments: 96,
  ringCrossSegments: 8,
  shellWidthSegments: 64,
  shellHeightSegments: 36,
  hourglassLengthSegments: 24,
  hourglassRadialSegments: 48,
  hotspotCount: 12,
  casaClumps: 300,
  casaShellWidthSegments: 72,
  casaShellHeightSegments: 42,
  jetLengthSegments: 18,
  jetRadialSegments: 30,
  greenRadialSegments: 7,
  greenAngularSegments: 64,
}));

function clampStep(dt){
  return THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
}

function damp(value, target, speed, dt){
  return THREE.MathUtils.lerp(value, target, 1-Math.exp(-speed*dt));
}

function basisFromEuler(rotation){
  const quaternion = new THREE.Quaternion().setFromEuler(rotation || new THREE.Euler());
  return {
    u: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
    v: new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion),
    n: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
  };
}

function ellipsePoint(config, theta, target = new THREE.Vector3()){
  const basis = config.basis || basisFromEuler(config.rotation);
  const center = config.center || new THREE.Vector3();
  return target.copy(center)
    .addScaledVector(basis.u, Math.cos(theta)*config.radiusX)
    .addScaledVector(basis.v, Math.sin(theta)*config.radiusY)
    .addScaledVector(basis.n,
      (config.ripple || 0)*Math.sin(theta*(config.rippleFrequency || 3)+.4));
}

/* Indexed tube around an authored elliptical centerline. Unlike a line or
   billboard ring, it has a true cross-section, normals, self-occlusion and
   visible thickness from every camera angle. */
function makeEllipticalTubeGeometry(scope, config){
  const segments = config.segments;
  const crossSegments = config.crossSegments;
  const basis = config.basis || basisFromEuler(config.rotation);
  const center = config.center || new THREE.Vector3();
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const centerline = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();

  for (let ring = 0; ring <= segments; ring++){
    const f = ring/segments;
    const theta = f*Math.PI*2;
    ellipsePoint({ ...config, basis, center }, theta, centerline);
    radial.copy(basis.u).multiplyScalar(Math.cos(theta))
      .addScaledVector(basis.v, Math.sin(theta)).normalize();
    const corrugation = 1+(config.corrugation || 0)*
      Math.sin(theta*(config.corrugationFrequency || 11)+.8);
    for (let side = 0; side <= crossSegments; side++){
      const phi = side/crossSegments*Math.PI*2;
      surfaceNormal.copy(radial).multiplyScalar(Math.cos(phi))
        .addScaledVector(basis.n, Math.sin(phi)).normalize();
      const radius = config.tube*corrugation*
        (1+(config.tubeVariation || 0)*Math.sin(theta*7+phi*3));
      positions.push(
        centerline.x+surfaceNormal.x*radius,
        centerline.y+surfaceNormal.y*radius,
        centerline.z+surfaceNormal.z*radius);
      normals.push(surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
      uvs.push(f, side/crossSegments);
    }
  }
  const stride = crossSegments+1;
  for (let ring = 0; ring < segments; ring++){
    for (let side = 0; side < crossSegments; side++){
      const a = ring*stride+side;
      const b = a+stride;
      indices.push(a, b, a+1, b, b+1, a+1);
    }
  }
  const geometry = scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface = true;
  geometry.userData.scientificRole = config.role || 'three-dimensional-ring-surface';
  return geometry;
}

function makeAsymmetricShellGeometry(scope, config){
  const widthSegments = config.widthSegments;
  const heightSegments = config.heightSegments;
  const positions = [];
  const uvs = [];
  const indices = [];
  const axes = config.axes || new THREE.Vector3(1, 1, 1);
  const seedPhase = config.seedPhase || 0;
  for (let y = 0; y <= heightSegments; y++){
    const v = y/heightSegments;
    const phi = v*Math.PI;
    const sinPhi = Math.sin(phi);
    for (let x = 0; x <= widthSegments; x++){
      const u = x/widthSegments;
      const theta = u*Math.PI*2;
      const directional =
        .11*Math.sin(theta*3+seedPhase)*sinPhi*sinPhi+
        .075*Math.cos(theta*5-phi*2.4+seedPhase*.7)+
        .055*Math.sin(theta*11+phi*7+seedPhase*1.7)+
        (config.northBias || 0)*Math.cos(phi);
      const radius = config.radius*(1+directional*(config.asymmetry || 1));
      positions.push(
        Math.cos(theta)*sinPhi*radius*axes.x,
        Math.cos(phi)*radius*axes.y,
        Math.sin(theta)*sinPhi*radius*axes.z);
      uvs.push(u, v);
    }
  }
  const stride = widthSegments+1;
  for (let y = 0; y < heightSegments; y++){
    for (let x = 0; x < widthSegments; x++){
      const a = y*stride+x;
      const b = a+stride;
      indices.push(a, b, a+1, b, b+1, a+1);
    }
  }
  const geometry = scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface = true;
  geometry.userData.scientificRole = config.role || 'asymmetric-expanding-shell';
  return geometry;
}

function makeHourglassGeometry(scope, config){
  const lengthSegments = config.lengthSegments;
  const radialSegments = config.radialSegments;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let y = 0; y <= lengthSegments; y++){
    const v = y/lengthSegments;
    const axial = v*2-1;
    const radius = config.waist+
      config.opening*Math.pow(Math.abs(axial), .72)+
      Math.sin(v*Math.PI*5+.3)*config.corrugation;
    for (let x = 0; x <= radialSegments; x++){
      const u = x/radialSegments;
      const theta = u*Math.PI*2;
      const warp = 1+.06*Math.sin(theta*4+axial*3);
      positions.push(
        Math.cos(theta)*radius*warp*config.axisX,
        axial*config.halfLength,
        Math.sin(theta)*radius*warp*config.axisZ);
      uvs.push(u, v);
    }
  }
  const stride = radialSegments+1;
  for (let y = 0; y < lengthSegments; y++){
    for (let x = 0; x < radialSegments; x++){
      const a = y*stride+x;
      const b = a+stride;
      indices.push(a, b, a+1, b, b+1, a+1);
    }
  }
  const geometry = scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface = true;
  geometry.userData.scientificRole = config.role || 'bipolar-hourglass-surface';
  return geometry;
}

function makeJetGeometry(scope, config){
  const lengthSegments = config.lengthSegments;
  const radialSegments = config.radialSegments;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let y = 0; y <= lengthSegments; y++){
    const v = y/lengthSegments;
    const axial = .5+v*config.length;
    const radius = config.baseRadius+config.opening*Math.pow(v, .78);
    for (let x = 0; x <= radialSegments; x++){
      const u = x/radialSegments;
      const theta = u*Math.PI*2;
      const patch = 1+.14*Math.sin(theta*5+v*17)+.07*Math.sin(theta*11-v*9);
      positions.push(Math.cos(theta)*radius*patch, axial,
        Math.sin(theta)*radius*patch);
      uvs.push(u, v);
    }
  }
  const stride = radialSegments+1;
  for (let y = 0; y < lengthSegments; y++){
    for (let x = 0; x < radialSegments; x++){
      const a = y*stride+x;
      const b = a+stride;
      indices.push(a, b, a+1, b, b+1, a+1);
    }
  }
  const geometry = scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface = true;
  geometry.userData.scientificRole = config.role || 'broad-ejecta-jet-surface';
  return geometry;
}

function makeGreenInteriorGeometry(scope, config){
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= config.radialSegments; r++){
    const v = r/config.radialSegments;
    const radius = THREE.MathUtils.lerp(config.innerRadius, config.outerRadius, v);
    for (let a = 0; a <= config.angularSegments; a++){
      const u = a/config.angularSegments;
      const theta = u*Math.PI*2;
      const radialWarp = 1+.09*Math.sin(theta*5+.8)+.045*Math.sin(theta*13-v*7);
      const z = 2.1*Math.sin(theta*3+v*5)+1.2*Math.cos(theta*7-v*3);
      positions.push(
        Math.cos(theta)*radius*radialWarp,
        Math.sin(theta)*radius*(.72+.08*Math.sin(theta*2)),
        z);
      uvs.push(u, v);
    }
  }
  const stride = config.angularSegments+1;
  for (let r = 0; r < config.radialSegments; r++){
    for (let a = 0; a < config.angularSegments; a++){
      const i = r*stride+a;
      indices.push(i, i+stride, i+1, i+stride, i+stride+1, i+1);
    }
  }
  const geometry = scope.own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexedSurface = true;
  geometry.userData.scientificRole = 'green-monster-inspired-circumstellar-sheet';
  return geometry;
}

function makeEmissionMaterial(scope, options){
  const material = scope.own(new THREE.ShaderMaterial({
    name: options.name,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: options.opacity == null ? 1 : options.opacity },
      uInner: { value: new THREE.Color(options.inner) },
      uOuter: { value: new THREE.Color(options.outer) },
      uPatternScale: { value: options.patternScale || .25 },
      uCutout: { value: options.cutout || 0 },
      uFresnelPower: { value: options.fresnelPower || 1.7 },
    },
    vertexShader: `
      precision ${FRAGMENT_PRECISION} float;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec2 vUv;
      void main(){
        vLocal = position;
        vUv = uv;
        vec4 mv = modelViewMatrix*vec4(position, 1.0);
        vNormalView = normalize(normalMatrix*normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      precision ${FRAGMENT_PRECISION} float;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uInner;
      uniform vec3 uOuter;
      uniform float uPatternScale;
      uniform float uCutout;
      uniform float uFresnelPower;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec2 vUv;
      void main(){
        float p1 = sin(dot(vLocal, vec3(.73,1.17,.51))*uPatternScale+uTime*.17);
        float p2 = sin(dot(vLocal, vec3(-1.09,.39,.91))*uPatternScale*1.61-uTime*.11);
        float p3 = sin((vUv.x*31.0+vUv.y*19.0)+uTime*.07);
        float pattern = .5+.19*p1+.17*p2+.10*p3;
        float occupancy = 1.0;
        if (uCutout > .001)
          occupancy = smoothstep(uCutout, min(.98,uCutout+.15), pattern);
        float facing = abs(dot(normalize(vNormalView), normalize(vView)));
        float fresnel = pow(max(0.0,1.0-facing), uFresnelPower);
        float ridge = .58+.42*smoothstep(.28,.78,pattern);
        float alpha = uOpacity*occupancy*ridge*(.34+.66*fresnel);
        if (alpha < .008) discard;
        vec3 color = mix(uInner,uOuter,
          clamp(.25+.48*fresnel+.22*pattern,0.0,1.0));
        gl_FragColor = vec4(color*(.78+fresnel*.72), alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: options.side || THREE.DoubleSide,
    blending: options.blending || THREE.AdditiveBlending,
    toneMapped: false,
  }));
  material.userData.baseOpacity = material.uniforms.uOpacity.value;
  material.userData.scientificRole = options.role || options.name;
  return material;
}

function setEmissionOpacity(material, value){
  material.uniforms.uOpacity.value = Math.max(0, value);
  material.visible = value > .002;
}

function setEmissionTime(material, time){
  material.uniforms.uTime.value = time;
}

function makeMesh(parent, geometry, material, name, renderOrder = 1){
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = renderOrder;
  parent.add(mesh);
  return mesh;
}

function addHotspots(scope, parent, ringConfig, count){
  const geometry = scope.own(new THREE.IcosahedronGeometry(1, 1));
  const material = scope.own(new THREE.MeshPhysicalMaterial({
    name: 'SN1987A.ShockHotspotMaterial',
    color: 0xffe8bc,
    emissive: 0xff5c18,
    emissiveIntensity: 2.8,
    roughness: .38,
    metalness: 0,
    transparent: true,
    opacity: .94,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const hotspots = scope.own(new THREE.InstancedMesh(geometry, material, count));
  hotspots.name = 'SN1987A.EquatorialShockHotspots';
  hotspots.userData.instanceRole = 'ring-impact-hotspots';
  hotspots.userData.interpretiveTiming = true;
  const dummy = new THREE.Object3D();
  const point = new THREE.Vector3();
  const phases = [];
  for (let i = 0; i < count; i++){
    const theta = i/count*Math.PI*2+.16*Math.sin(i*2.3);
    ellipsePoint(ringConfig, theta, point);
    const scale = .48+.42*(.5+.5*Math.sin(i*4.7));
    dummy.position.copy(point);
    dummy.rotation.set(i*.7, i*1.3, i*.43);
    dummy.scale.set(scale*(.8+(i%3)*.12), scale, scale*.72);
    dummy.updateMatrix();
    hotspots.setMatrixAt(i, dummy.matrix);
    phases.push(i*.77);
  }
  hotspots.instanceMatrix.needsUpdate = true;
  hotspots.renderOrder = 7;
  parent.add(hotspots);
  return { mesh: hotspots, material, phases };
}

function makeElementClumps(scope, parent, geometry, options){
  const material = scope.own(new THREE.MeshStandardMaterial({
    name: `CasA.${options.label}ClumpMaterial`,
    color: options.color,
    emissive: options.emissive || options.color,
    emissiveIntensity: options.emissiveIntensity || 1.1,
    roughness: .68,
    metalness: .03,
    flatShading: true,
    transparent: true,
    opacity: options.opacity || .84,
    depthWrite: false,
  }));
  const mesh = scope.own(new THREE.InstancedMesh(geometry, material, options.count));
  mesh.name = `CasA.${options.label}Knots`;
  mesh.userData.element = options.label;
  mesh.userData.instanceRole = 'element-separated-ejecta-clumps';
  const rnd = mulberry(hashStr(options.seed));
  const dummy = new THREE.Object3D();
  const axis = options.axes || new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < options.count; i++){
    const polar = rnd()*2-1;
    const azimuth = rnd()*Math.PI*2;
    const radial = Math.sqrt(Math.max(0,1-polar*polar));
    const direction = new THREE.Vector3(
      Math.cos(azimuth)*radial,
      polar,
      Math.sin(azimuth)*radial);
    if (options.bias) direction.addScaledVector(options.bias,
      Math.max(0, gaussian(rnd)*options.biasStrength)).normalize();
    const radius = THREE.MathUtils.lerp(options.radiusMin, options.radiusMax,
      Math.pow(rnd(), options.radiusPower || .72));
    dummy.position.set(
      direction.x*radius*axis.x+gaussian(rnd)*.65,
      direction.y*radius*axis.y+gaussian(rnd)*.65,
      direction.z*radius*axis.z+gaussian(rnd)*.65);
    dummy.rotation.set(rnd()*Math.PI, rnd()*Math.PI, rnd()*Math.PI);
    const scale = THREE.MathUtils.lerp(options.scaleMin, options.scaleMax,
      Math.pow(rnd(),1.7));
    dummy.scale.set(
      scale*(.62+rnd()*.82),
      scale*(.55+rnd()*.95),
      scale*(.60+rnd()*.76));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = options.renderOrder || 5;
  parent.add(mesh);
  return { mesh, material };
}

function stateKey(visual){
  return String(visual && (visual.state || visual.moment || visual.id) || '')
    .toLowerCase();
}

export function buildSN1987AFeatured({ entry, image }){
  if (!entry || entry.id !== 'sn-1987a')
    throw new Error('SN 1987A renderer requires the sn-1987a entry');
  const scope = new ResourceScope('sn-1987a-featured');
  const group = new THREE.Group();
  group.name = 'SN1987A.ModelFirstRemnant';
  const ringRoot = new THREE.Group();
  ringRoot.name = 'SN1987A.TripleRingSystem';
  group.add(ringRoot);

  const equatorialConfig = {
    center: new THREE.Vector3(0, 0, 0),
    radiusX: 24,
    radiusY: 9.2,
    tube: 1.05,
    rotation: new THREE.Euler(-.13,.04,.015),
    ripple: .30,
    rippleFrequency: 7,
    corrugation: .12,
    corrugationFrequency: 17,
    tubeVariation: .10,
    segments: QUALITY.ringSegments,
    crossSegments: QUALITY.ringCrossSegments,
    role: 'dense-equatorial-circumstellar-ring',
  };
  equatorialConfig.basis = basisFromEuler(equatorialConfig.rotation);
  const northConfig = {
    center: new THREE.Vector3(0, 13.2, -3.4),
    radiusX: 22.5,
    radiusY: 6.8,
    tube: .62,
    rotation: new THREE.Euler(.48,-.16,.05),
    ripple: .24,
    rippleFrequency: 5,
    corrugation: .10,
    segments: QUALITY.ringSegments,
    crossSegments: QUALITY.ringCrossSegments,
    role: 'northern-outer-circumstellar-ring',
  };
  const southConfig = {
    ...northConfig,
    center: new THREE.Vector3(0, -13.2, -3.4),
    rotation: new THREE.Euler(-.48,.16,-.05),
    role: 'southern-outer-circumstellar-ring',
  };
  const ringMaterials = [
    makeEmissionMaterial(scope, {
      name: 'SN1987A.EquatorialRingSurface', inner: 0xffe3a0, outer: 0xff4c17,
      opacity: .92, patternScale: .41, fresnelPower: 1.1,
      role: 'shock-heated-equatorial-ring-surface',
    }),
    makeEmissionMaterial(scope, {
      name: 'SN1987A.NorthOuterRingSurface', inner: 0x8ccfff, outer: 0xc54cff,
      opacity: .46, patternScale: .34, fresnelPower: 1.45,
      role: 'fainter-northern-outer-ring-surface',
    }),
    makeEmissionMaterial(scope, {
      name: 'SN1987A.SouthOuterRingSurface', inner: 0x78bfff, outer: 0xc34bdf,
      opacity: .42, patternScale: .36, fresnelPower: 1.45,
      role: 'fainter-southern-outer-ring-surface',
    }),
  ];
  makeMesh(ringRoot, makeEllipticalTubeGeometry(scope,equatorialConfig),
    ringMaterials[0], 'SN1987A.EquatorialRing', 5);
  makeMesh(ringRoot, makeEllipticalTubeGeometry(scope,northConfig),
    ringMaterials[1], 'SN1987A.NorthOuterRing', 3);
  makeMesh(ringRoot, makeEllipticalTubeGeometry(scope,southConfig),
    ringMaterials[2], 'SN1987A.SouthOuterRing', 3);

  const hourglassMaterial = makeEmissionMaterial(scope, {
    name: 'SN1987A.BipolarHourglassSurface', inner: 0x25406f, outer: 0x8d4d9f,
    opacity: .18, patternScale: .18, cutout: .47, fresnelPower: 2.1,
    role: 'low-density-bipolar-circumstellar-context',
    blending: THREE.NormalBlending,
  });
  const hourglass = makeMesh(group, makeHourglassGeometry(scope, {
    lengthSegments: QUALITY.hourglassLengthSegments,
    radialSegments: QUALITY.hourglassRadialSegments,
    waist: 7.8,
    opening: 14.5,
    corrugation: .55,
    halfLength: 30,
    axisX: 1.04,
    axisZ: .68,
    role: 'bipolar-hourglass-circumstellar-surface',
  }), hourglassMaterial, 'SN1987A.BipolarHourglass', 0);
  hourglass.rotation.z = .035;

  const ejectaMaterial = makeEmissionMaterial(scope, {
    name: 'SN1987A.AsymmetricEjectaSurface', inner: 0x68a7ff, outer: 0xff7750,
    opacity: .76, patternScale: .42, cutout: .43, fresnelPower: 1.4,
    role: 'fragmented-asymmetric-ejecta-surface',
  });
  const ejecta = makeMesh(group, makeAsymmetricShellGeometry(scope, {
    radius: 11.8,
    axes: new THREE.Vector3(.92,1.16,.84),
    asymmetry: 1.05,
    northBias: .035,
    seedPhase: 1.7,
    widthSegments: QUALITY.shellWidthSegments,
    heightSegments: QUALITY.shellHeightSegments,
    role: 'asymmetric-expanding-supernova-ejecta',
  }), ejectaMaterial, 'SN1987A.ExpandingEjecta', 4);

  const shockMaterial = makeEmissionMaterial(scope, {
    name: 'SN1987A.ForwardShockSurface', inner: 0x5d84ff, outer: 0xffb66c,
    opacity: .22, patternScale: .31, cutout: .52, fresnelPower: 2.6,
    role: 'forward-shock-approaching-equatorial-ring',
  });
  const shock = makeMesh(group, makeAsymmetricShellGeometry(scope, {
    radius: 18.5,
    axes: new THREE.Vector3(1.05,.73,.92),
    asymmetry: .72,
    seedPhase: 3.2,
    widthSegments: QUALITY.shellWidthSegments,
    heightSegments: QUALITY.shellHeightSegments,
    role: 'forward-shock-interaction-surface',
  }), shockMaterial, 'SN1987A.ForwardShock', 2);

  const explosionMaterial = makeEmissionMaterial(scope, {
    name: 'SN1987A.ExplosionFrontMaterial', inner: 0xffffff, outer: 0x62a8ff,
    opacity: .02, patternScale: .55, cutout: .34, fresnelPower: 1.15,
    role: 'illustrative-early-explosion-front',
  });
  const explosionFront = makeMesh(group, makeAsymmetricShellGeometry(scope, {
    radius: 4.2,
    axes: new THREE.Vector3(.92,1.17,.88),
    asymmetry: .84,
    seedPhase: .4,
    widthSegments: Math.max(32,QUALITY.shellWidthSegments/2),
    heightSegments: Math.max(20,QUALITY.shellHeightSegments/2),
    role: 'illustrative-early-explosion-front',
  }), explosionMaterial, 'SN1987A.EarlyExplosionFront', 8);

  const hotspots = addHotspots(scope, ringRoot, equatorialConfig, QUALITY.hotspotCount);

  const present = Object.freeze({
    rings: 1, outerRings: 1, hourglass: 1, ejecta: 1, shock: 1,
    hotspots: 1, explosion: .02, ejectaScale: 1, shockScale: 1,
  });
  const current = { ...present };
  let target = { ...present };
  let activeState = 'sn1987a.present-remnant';
  let elapsed = 0;

  function selectState(visual){
    const key = stateKey(visual);
    activeState = key || 'sn1987a.present-remnant';
    const observation = !!(visual && visual.observation) || key === 'observation';
    group.userData.observationRequested = observation;
    if (observation){
      // The shared observation dock may use this hook later. Keep a restrained
      // model visible so the source product remains evidence beside the model,
      // never a texture pasted onto it.
      target = {
        rings: .58, outerRings: .48, hourglass: .28, ejecta: .34, shock: .28,
        hotspots: .32, explosion: 0, ejectaScale: 1, shockScale: 1,
      };
    } else if (key === 'ring-hotspots' || /ring|hotspot|impact|shock/.test(key)){
      target = {
        rings: 1.14, outerRings: .92, hourglass: .58, ejecta: .62, shock: 1.16,
        hotspots: 1.18, explosion: 0, ejectaScale: 1, shockScale: 1.02,
      };
    } else if (key === 'ejecta-hourglass' || /hourglass|circumstellar|progenitor|ejecta/.test(key)){
      target = {
        rings: .72, outerRings: 1.08, hourglass: 1.35, ejecta: .72, shock: .22,
        hotspots: .18, explosion: 0, ejectaScale: 1, shockScale: 1,
      };
    } else if (/explosion|1987-flash|neutrino/.test(key)){
      target = {
        rings: .15, outerRings: .18, hourglass: .18, ejecta: .85, shock: .08,
        hotspots: 0, explosion: 1.15, ejectaScale: .26, shockScale: .22,
      };
    } else target = { ...present };
    group.userData.activeState = activeState;
  }

  group.userData.renderer = 'sn1987a-triple-ring-sculpt-v1';
  group.userData.modelFirst = true;
  group.userData.genericImageVolume = false;
  group.userData.activeState = activeState;
  group.userData.qualityTier = TEX_TIER;
  group.userData.qualityBudget = { ...QUALITY };
  group.userData.observationAsset = image && image.file || null;
  group.userData.observationRequested = false;
  group.userData.supportedStates = [
    'model', 'default', 'ring-hotspots', 'ejecta-hourglass', 'observation',
  ];
  group.userData.scientificStructure = {
    rings: 'One dense equatorial ring and two fainter outer rings are modeled as true tubular surfaces; their display thickness is exaggerated for legibility.',
    ejecta: 'The asymmetric fragmented shell represents the expanding debris and forward shock qualitatively; knot locations are seeded, not tomography.',
    hotspots: 'Discrete knots mark shock interaction around the equatorial ring. Their pulse timing is illustrative rather than a measured light curve.',
    hourglass: 'The faint bipolar/hourglass surface communicates circumstellar geometry inferred from the ring system; its line-of-sight depth is model-led.',
  };
  group.userData.scientificCaveat =
    'Scale, thickness, color and simultaneous visibility are compressed for explanation. This is a physically informed spatial model, not a recovered three-dimensional observation.';
  group.userData.primitivePolicy =
    'Indexed emitting surfaces and instanced faceted impact knots only; no sprites, point clouds, wireframes or generic fuzzy volumes.';

  return {
    group,
    focusDist: 94,
    startTheta: .20,
    startPhi: 1.22,
    autoRotate: false,
    isImage: false,
    hasIR: false,
    imageCredit: image && image.credit || null,
    setMoment(visual){ if (!scope.disposed) selectState(visual); },
    update(dt){
      if (scope.disposed) return;
      dt = clampStep(dt);
      elapsed += dt;
      for (const key of Object.keys(current))
        current[key] = damp(current[key], target[key], 3.8, dt);
      setEmissionOpacity(ringMaterials[0], .92*current.rings);
      setEmissionOpacity(ringMaterials[1], .46*current.outerRings);
      setEmissionOpacity(ringMaterials[2], .42*current.outerRings);
      setEmissionOpacity(hourglassMaterial, .18*current.hourglass);
      setEmissionOpacity(ejectaMaterial, .76*current.ejecta);
      setEmissionOpacity(shockMaterial, .22*current.shock);
      setEmissionOpacity(explosionMaterial, current.explosion);
      for (const material of [...ringMaterials, hourglassMaterial, ejectaMaterial,
        shockMaterial, explosionMaterial]) setEmissionTime(material, elapsed);
      hotspots.material.opacity = Math.min(1,.9*current.hotspots)*
        (.84+.16*Math.sin(elapsed*2.2));
      hotspots.mesh.visible = current.hotspots > .003;
      const expansion = 1+Math.min(.018,elapsed*.00018);
      ejecta.scale.setScalar(current.ejectaScale*expansion);
      shock.scale.setScalar(current.shockScale*expansion);
      explosionFront.rotation.y += dt*.045;
    },
    dispose(){
      if (scope.disposed) return;
      scope.dispose();
      group.clear();
      group.userData.disposed = true;
    },
  };
}

export function buildCassiopeiaAFeatured({ entry, image }){
  if (!entry || entry.id !== 'cassiopeia-a')
    throw new Error('Cassiopeia A renderer requires the cassiopeia-a entry');
  const scope = new ResourceScope('cassiopeia-a-featured');
  const group = new THREE.Group();
  group.name = 'CasA.ModelFirstRemnant';
  const ejectaRoot = new THREE.Group();
  ejectaRoot.name = 'CasA.ExpandingEjectaSystem';
  group.add(ejectaRoot);

  const outerShellMaterial = makeEmissionMaterial(scope, {
    name: 'CasA.ForwardShockSurface', inner: 0x55bde8, outer: 0xff6a36,
    opacity: .52, patternScale: .34, cutout: .48, fresnelPower: 1.65,
    role: 'asymmetric-forward-shock-surface',
  });
  const outerShell = makeMesh(ejectaRoot, makeAsymmetricShellGeometry(scope, {
    radius: 30,
    axes: new THREE.Vector3(1.08,.92,1.0),
    asymmetry: 1.18,
    northBias: -.025,
    seedPhase: 2.4,
    widthSegments: QUALITY.casaShellWidthSegments,
    heightSegments: QUALITY.casaShellHeightSegments,
    role: 'cassiopeia-a-forward-shock-shell',
  }), outerShellMaterial, 'CasA.ForwardShockShell', 2);

  const reverseShellMaterial = makeEmissionMaterial(scope, {
    name: 'CasA.ReverseShockSurface', inner: 0x8d68ff, outer: 0xffad42,
    opacity: .34, patternScale: .46, cutout: .50, fresnelPower: 1.35,
    role: 'reverse-shock-and-shocked-ejecta-surface',
  });
  makeMesh(ejectaRoot, makeAsymmetricShellGeometry(scope, {
    radius: 22.5,
    axes: new THREE.Vector3(.98,.88,1.05),
    asymmetry: 1.08,
    northBias: .02,
    seedPhase: 4.8,
    widthSegments: QUALITY.casaShellWidthSegments,
    heightSegments: QUALITY.casaShellHeightSegments,
    role: 'cassiopeia-a-reverse-shock-shell',
  }), reverseShellMaterial, 'CasA.ReverseShockShell', 3);

  const clumpGeometry = scope.own(new THREE.IcosahedronGeometry(1, 1));
  clumpGeometry.userData.scientificRole = 'faceted-ejecta-knot-prototype';
  const oxygenCount = Math.round(QUALITY.casaClumps*.44);
  const sulfurCount = Math.round(QUALITY.casaClumps*.31);
  const ironCount = QUALITY.casaClumps-oxygenCount-sulfurCount;
  const oxygen = makeElementClumps(scope,ejectaRoot,clumpGeometry,{
    label: 'OxygenRich', count: oxygenCount, seed: 'casa:oxygen',
    color: 0x5be0ef, emissive: 0x187b9f, emissiveIntensity: 1.42,
    radiusMin: 22, radiusMax: 33, radiusPower: .68,
    scaleMin: .28, scaleMax: 1.08, axes: new THREE.Vector3(1.08,.92,1),
    opacity: .86, renderOrder: 5,
  });
  const sulfur = makeElementClumps(scope,ejectaRoot,clumpGeometry,{
    label: 'SulfurRich', count: sulfurCount, seed: 'casa:sulfur',
    color: 0xff4e3f, emissive: 0xa91718, emissiveIntensity: 1.34,
    radiusMin: 19, radiusMax: 30, radiusPower: .77,
    scaleMin: .30, scaleMax: 1.18, axes: new THREE.Vector3(1.04,.91,1.02),
    opacity: .84, renderOrder: 6,
  });
  const iron = makeElementClumps(scope,ejectaRoot,clumpGeometry,{
    label: 'IronRich', count: ironCount, seed: 'casa:iron',
    color: 0xffb041, emissive: 0xb3420d, emissiveIntensity: 1.48,
    radiusMin: 12, radiusMax: 27, radiusPower: .92,
    scaleMin: .34, scaleMax: 1.28, axes: new THREE.Vector3(.95,.84,1.05),
    bias: new THREE.Vector3(.68,-.18,.36).normalize(), biasStrength: .42,
    opacity: .88, renderOrder: 7,
  });
  const elementLayers = [oxygen,sulfur,iron];

  const jetMaterial = makeEmissionMaterial(scope, {
    name: 'CasA.SiliconSulfurJetSurface', inner: 0xffcf68, outer: 0xff4a32,
    opacity: .58, patternScale: .43, cutout: .44, fresnelPower: 1.35,
    role: 'broad-silicon-sulfur-rich-ejecta-jet',
  });
  const counterJetMaterial = makeEmissionMaterial(scope, {
    name: 'CasA.CounterjetSurface', inner: 0xffad52, outer: 0xc53b42,
    opacity: .37, patternScale: .46, cutout: .47, fresnelPower: 1.48,
    role: 'fainter-counterjet-ejecta-surface',
  });
  const jetAxis = new THREE.Vector3(.80,.48,.35).normalize();
  const jet = makeMesh(ejectaRoot, makeJetGeometry(scope, {
    length: 46, baseRadius: 1.5, opening: 8.4,
    lengthSegments: QUALITY.jetLengthSegments,
    radialSegments: QUALITY.jetRadialSegments,
    role: 'northeast-broad-ejecta-jet-surface',
  }), jetMaterial, 'CasA.NortheastJet', 4);
  jet.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),jetAxis);
  const counterJet = makeMesh(ejectaRoot, makeJetGeometry(scope, {
    length: 32, baseRadius: 1.35, opening: 6.2,
    lengthSegments: QUALITY.jetLengthSegments,
    radialSegments: QUALITY.jetRadialSegments,
    role: 'southwest-fainter-counterjet-surface',
  }), counterJetMaterial, 'CasA.SouthwestCounterjet', 4);
  counterJet.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),
    jetAxis.clone().negate());

  const greenMaterial = makeEmissionMaterial(scope, {
    name: 'CasA.GreenMonsterInteriorSurface', inner: 0x72ff9b, outer: 0x2ebc7e,
    opacity: .38, patternScale: .58, cutout: .50, fresnelPower: 1.25,
    role: 'green-monster-inspired-interior-circumstellar-sheet',
    blending: THREE.NormalBlending,
  });
  const greenMonster = makeMesh(ejectaRoot, makeGreenInteriorGeometry(scope, {
    innerRadius: 6.5,
    outerRadius: 17,
    radialSegments: QUALITY.greenRadialSegments,
    angularSegments: QUALITY.greenAngularSegments,
  }), greenMaterial, 'CasA.GreenMonsterInterior', 4);
  greenMonster.rotation.set(.72,.16,-.36);

  const compactMaterial = scope.own(new THREE.MeshPhysicalMaterial({
    name: 'CasA.CentralCompactObjectMaterial',
    color: 0xb9e4ff,
    emissive: 0x3e8ed1,
    emissiveIntensity: 2.1,
    roughness: .32,
    metalness: .04,
    clearcoat: .35,
    clearcoatRoughness: .3,
    toneMapped: false,
  }));
  const compactGeometry = scope.own(new THREE.SphereGeometry(1.45,
    HIGH_TIER ? 48 : 28, HIGH_TIER ? 32 : 18));
  compactGeometry.userData.scientificRole = 'exaggerated-central-compact-object';
  const compactObject = makeMesh(group,compactGeometry,compactMaterial,
    'CasA.CentralCompactObject',9);
  compactObject.position.set(.7,-.45,.2);
  compactObject.userData.physicalIdentity = 'central-compact-object-neutron-star';
  compactObject.userData.displayScaleExaggerated = true;

  const present = Object.freeze({
    outer: 1, reverse: 1, elements: 1, jets: 1, green: 1,
    compact: 1, scale: 1,
  });
  const current = { ...present };
  let target = { ...present };
  let activeState = 'casa.present-remnant';
  let elapsed = 0;

  function selectState(visual){
    const key = stateKey(visual);
    activeState = key || 'casa.present-remnant';
    const observation = !!(visual && visual.observation) || key === 'observation';
    group.userData.observationRequested = observation;
    if (observation){
      target = { outer: .30, reverse: .22, elements: .26, jets: .18,
        green: .10, compact: .35, scale: 1 };
    } else if (key === 'ejecta-elements' ||
        /element|oxygen|sulfur|iron|composition|ejecta/.test(key)){
      target = { outer: .24, reverse: .34, elements: 1.18, jets: .58,
        green: .12, compact: .45, scale: 1 };
    } else if (key === 'jets-compact-object'){
      target = { outer: .18, reverse: .18, elements: .34, jets: 1.18,
        green: .08, compact: 1.72, scale: 1 };
    } else if (/explosion|1680|guest-star/.test(key)){
      target = { outer: 1.18, reverse: .72, elements: .38, jets: .42,
        green: .08, compact: .18, scale: .24 };
    } else if (/jet|counterjet|outflow/.test(key)){
      target = { outer: .28, reverse: .22, elements: .52, jets: 1.32,
        green: .08, compact: .38, scale: 1 };
    } else if (/green|monster|circumstellar/.test(key)){
      target = { outer: .18, reverse: .16, elements: .30, jets: .12,
        green: 1.48, compact: .30, scale: 1 };
    } else if (/compact|neutron|central/.test(key)){
      target = { outer: .12, reverse: .14, elements: .16, jets: .08,
        green: .08, compact: 2.2, scale: 1 };
    } else target = { ...present };
    group.userData.activeState = activeState;
  }

  group.userData.renderer = 'cassiopeia-a-element-sculpt-v1';
  group.userData.modelFirst = true;
  group.userData.genericImageVolume = false;
  group.userData.activeState = activeState;
  group.userData.qualityTier = TEX_TIER;
  group.userData.qualityBudget = { ...QUALITY,
    oxygenClumps: oxygenCount, sulfurClumps: sulfurCount, ironClumps: ironCount };
  group.userData.observationAsset = image && image.file || null;
  group.userData.observationRequested = false;
  group.userData.supportedStates = [
    'model', 'default', 'ejecta-elements', 'jets-compact-object',
    'green-monster', 'observation',
  ];
  group.userData.scientificStructure = {
    shocks: 'Separate indexed surfaces distinguish the outer forward shock from the reverse-shocked ejecta zone.',
    elements: 'Faceted instanced knots separate oxygen-rich, sulfur-rich and iron-rich structures. Their statistical placement follows broad morphology, not voxel-resolved spectroscopy.',
    jets: 'Broad northeast and southwest surfaces communicate the observed silicon/sulfur-rich jet and fainter counterjet; they are ejecta, not steady relativistic beams.',
    greenMonster: 'The porous green interior sheet references JWST’s Green Monster morphology and is treated as shocked circumstellar material; its reconstructed depth is illustrative.',
    compactObject: 'The central compact object is physically tiny and unresolved at this scale, so its rendered sphere is deliberately exaggerated.',
  };
  group.userData.scientificCaveat =
    'Colors identify explanatory element families and shock structures rather than natural visible color. Relative depth, knot positions, thickness and simultaneous visibility are model-led.';
  group.userData.primitivePolicy =
    'Indexed shock/jet/sheet surfaces and instanced faceted ejecta knots only; no sprites, point clouds, wireframes or generic fuzzy volumes.';

  return {
    group,
    focusDist: 98,
    startTheta: .30,
    startPhi: 1.18,
    autoRotate: false,
    isImage: false,
    hasIR: false,
    imageCredit: image && image.credit || null,
    setMoment(visual){ if (!scope.disposed) selectState(visual); },
    update(dt){
      if (scope.disposed) return;
      dt = clampStep(dt);
      elapsed += dt;
      for (const key of Object.keys(current))
        current[key] = damp(current[key],target[key],3.7,dt);
      setEmissionOpacity(outerShellMaterial,.52*current.outer);
      setEmissionOpacity(reverseShellMaterial,.34*current.reverse);
      setEmissionOpacity(jetMaterial,.58*current.jets);
      setEmissionOpacity(counterJetMaterial,.37*current.jets);
      setEmissionOpacity(greenMaterial,.38*current.green);
      for (const material of [outerShellMaterial,reverseShellMaterial,
        jetMaterial,counterJetMaterial,greenMaterial])
        setEmissionTime(material,elapsed);
      for (const layer of elementLayers){
        layer.material.opacity = Math.min(1,.84*current.elements);
        layer.mesh.visible = current.elements > .003;
      }
      compactMaterial.emissiveIntensity = 2.1*current.compact*
        (.96+.04*Math.sin(elapsed*.72));
      compactObject.visible = current.compact > .003;
      const expansion = 1+Math.min(.014,elapsed*.00014);
      ejectaRoot.scale.setScalar(current.scale*expansion);
      compactObject.rotation.y += dt*.16;
      compactObject.rotation.x += dt*.05;
      outerShell.rotation.y += dt*.0018;
      greenMonster.rotation.z += dt*.0022;
    },
    dispose(){
      if (scope.disposed) return;
      scope.dispose();
      group.clear();
      group.userData.disposed = true;
    },
  };
}
