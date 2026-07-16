/* Dedicated, model-led black-hole landmarks. The compact object and its
   relativistic light paths come from the shared black-hole visual; real source
   products can appear alongside that persistent 3D model as evidence docks. */

import * as THREE from 'three';
import {
  createBlackHoleVisual,
  resolveBlackHoleProfile,
} from '../../objects/blackHoleVisual.js';
import {
  keplerPositionAtEccentricAnomaly,
  S_STAR_DISPLAY_DAYS_PER_SECOND,
  S_STAR_ORBITS,
  sStarPositionAtDays,
} from '../../data/sStars.js';
import { TEX_TIER } from '../../core/quality.js';
import { buildGravWave } from '../exhibits.js';
import { createObservationDock } from './observationDock.js';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const UP = new THREE.Vector3(0, 1, 0);
const FRAGMENT_PRECISION = TEX_TIER === 'high' ? 'highp' : 'mediump';

const LANDMARK_CONFIG = Object.freeze({
  'cygnus-x-1': Object.freeze({
    profile: 'cygnus-x1',
    radius: 4.15,
    focusDist: 92,
    context: 'blue-supergiant-companion-and-mass-transfer-stream',
    credit: 'Procedural 3D model · Cygnus X-1 companion-fed accretion geometry is qualitative',
    observation: Object.freeze({
      width: 26, offsetX: -28, offsetY: 8, accent: 0x79bcff, heroRadius: 22,
    }),
  }),
  'm87-star': Object.freeze({
    profile: 'm87',
    radius: 5.8,
    focusDist: 108,
    context: 'relativistic-core-and-bipolar-jet',
    credit: 'Procedural 3D model · M87* lensing and polar-jet scales are qualitative',
    observation: Object.freeze({
      width: 27, offsetX: 29, offsetY: 9, accent: 0xffb766, heroRadius: 26,
    }),
  }),
  'sagittarius-a-star': Object.freeze({
    profile: 'sagittarius-a',
    radius: 5.05,
    focusDist: 105,
    context: 'quiescent-core-and-s-star-orbits',
    credit: 'Procedural 3D model · Sagittarius A* lensing and S-star orbit scales are illustrative',
    observation: Object.freeze({
      width: 27, offsetX: 28, offsetY: 8, accent: 0xffc77c, heroRadius: 25,
    }),
  }),
});

const GW150914_IDS = new Set([
  'gw150914',
  'gw150914-first-gravitational-wave',
]);

function clampStep(dt){
  return THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
}

function isObservationMoment(visual){
  if (!visual) return false;
  if (typeof visual === 'string') return visual === 'observation';
  return visual.observation === true || visual.state === 'observation';
}

function makeResourceBag(){
  const geometries = new Set();
  const materials = new Set();
  let disposed = false;
  return {
    geometry(value){ geometries.add(value); return value; },
    material(value){ materials.add(value); return value; },
    dispose(){
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      geometries.clear();
      materials.clear();
    },
  };
}

function exposeContext(object, profile, role, details = {}){
  object.userData.blackHoleContext = true;
  object.userData.profileId = profile.id;
  object.userData.contextRole = role;
  Object.assign(object.userData, details);
  return object;
}

function sweptStreamGeometry(curve, segments, sides, startRadius, endRadius){
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const colors = [];
  const indices = [];
  const cool = new THREE.Color(0x6faeff);
  const hot = new THREE.Color(0xf7fcff);

  for (let segment = 0; segment <= segments; segment++){
    const u = segment / segments;
    const center = curve.getPointAt(u);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, u)
      * (1 + Math.sin(u * 23.0) * 0.055);
    const color = cool.clone().lerp(hot, Math.pow(u, 0.72));
    for (let side = 0; side <= sides; side++){
      const angle = side / sides * TAU;
      const offset = frames.normals[segment].clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[segment], Math.sin(angle) * radius);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = sides + 1;
  for (let segment = 0; segment < segments; segment++){
    for (let side = 0; side < sides; side++){
      const a = segment * row + side;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexed = true;
  geometry.userData.role = 'broad-curved-mass-transfer-surface';
  return geometry;
}

function createCygnusContext(group, core, profile, resources){
  const context = new THREE.Group();
  context.name = 'CygnusX1.CompanionFedSystem';
  exposeContext(context, profile, 'blue-supergiant-binary-system', {
    companion: 'HDE 226868',
    reconstruction: 'qualitative-not-to-scale',
  });
  group.add(context);

  const companionMaterial = resources.material(new THREE.ShaderMaterial({
    name: 'CygnusX1.BlueSupergiantPhotosphereMaterial',
    precision: FRAGMENT_PRECISION,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vObjectPosition;
      varying vec3 vNormalView;
      varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vObjectPosition = normalize(position);
        vNormalView = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      precision ${FRAGMENT_PRECISION} float;
      uniform float uTime;
      varying vec3 vObjectPosition;
      varying vec3 vNormalView;
      varying vec3 vView;
      void main(){
        float mu = clamp(dot(vNormalView, vView), 0.0, 1.0);
        float granulation = sin(dot(vObjectPosition, vec3(31.0, 17.0, 23.0))
          + uTime * 0.17);
        granulation += 0.52 * sin(dot(vObjectPosition, vec3(-19.0, 37.0, 11.0))
          - uTime * 0.13 + 1.7);
        granulation += 0.27 * sin(dot(vObjectPosition, vec3(13.0, -29.0, 41.0))
          + uTime * 0.11 + 3.1);
        granulation /= 1.79;
        float belt = 0.5 + 0.5 * sin(vObjectPosition.y * 17.0
          + vObjectPosition.x * 4.0 + uTime * 0.08);
        vec3 limb = vec3(0.10, 0.25, 0.58);
        vec3 face = vec3(0.42, 0.64, 0.88);
        vec3 core = vec3(0.76, 0.86, 0.98);
        vec3 color = mix(limb, face, pow(mu, 0.42));
        color = mix(color, core, pow(mu, 4.2) * 0.72);
        color *= 0.92 + granulation * 0.055 + belt * 0.035;
        gl_FragColor = vec4(color, 1.0);
      }`,
    toneMapped: false,
  }));
  const companion = new THREE.Mesh(
    resources.geometry(new THREE.SphereGeometry(10.5, 48, 32)),
    companionMaterial,
  );
  companion.name = 'CygnusX1.HDE226868.BlueSupergiant';
  companion.position.set(37, 0, 0);
  companion.scale.set(1.08, 1, 1);
  exposeContext(companion, profile, 'blue-supergiant-companion', {
    designation: 'HDE 226868',
    transfersMassTo: 'Cygnus X-1',
  });
  context.add(companion);

  const atmosphereMaterial = resources.material(new THREE.MeshBasicMaterial({
    name: 'CygnusX1.BlueSupergiantAtmosphereMaterial',
    color: 0xb7dbff,
    transparent: true,
    opacity: 0.13,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  const atmosphere = new THREE.Mesh(
    resources.geometry(new THREE.IcosahedronGeometry(11.35, 3)),
    atmosphereMaterial,
  );
  atmosphere.name = 'CygnusX1.BlueSupergiant.ExtendedAtmosphereSurface';
  atmosphere.position.copy(companion.position);
  atmosphere.scale.copy(companion.scale);
  exposeContext(atmosphere, profile, 'extended-blue-supergiant-atmosphere');
  context.add(atmosphere);

  const streamCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(26.7, 0, 0),
    new THREE.Vector3(22.0, 5.8, -2.2),
    new THREE.Vector3(17.1, 4.4, 3.7),
    new THREE.Vector3(11.7, -0.9, 1.2),
  );
  const broadMaterial = resources.material(new THREE.MeshBasicMaterial({
    name: 'CygnusX1.MassTransferSheathMaterial',
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  const broadStream = new THREE.Mesh(
    resources.geometry(sweptStreamGeometry(streamCurve, 54, 12, 3.15, 0.82)),
    broadMaterial,
  );
  broadStream.name = 'CygnusX1.BroadCurvedMassTransferStream';
  exposeContext(broadStream, profile, 'broad-curved-mass-transfer-stream', {
    origin: 'blue-supergiant-Roche-lobe',
    destination: 'compact-hot-accretion-flow',
  });
  context.add(broadStream);

  const hotMaterial = resources.material(new THREE.MeshBasicMaterial({
    name: 'CygnusX1.MassTransferHotCoreMaterial',
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  const hotStream = new THREE.Mesh(
    resources.geometry(sweptStreamGeometry(streamCurve, 54, 9, 1.18, 0.24)),
    hotMaterial,
  );
  hotStream.name = 'CygnusX1.CompactHotTransferCore';
  hotStream.renderOrder = 4;
  exposeContext(hotStream, profile, 'compact-hot-transfer-core');
  context.add(hotStream);

  const companionLight = new THREE.PointLight(0x8fc4ff, 1.15, 95);
  companionLight.name = 'CygnusX1.BlueSupergiantLight';
  companionLight.position.copy(companion.position);
  exposeContext(companionLight, profile, 'blue-supergiant-context-light');
  context.add(companionLight);

  core.group.userData.contextRole = 'compact-hot-X-ray-binary-core';
  core.group.userData.companionDesignation = 'HDE 226868';

  return {
    update(_dt, elapsed){
      const pulse = Math.sin(elapsed * 2.1);
      broadMaterial.opacity = 0.205 + pulse * 0.018;
      hotMaterial.opacity = 0.49 + Math.sin(elapsed * 3.4 + 0.8) * 0.045;
      companionMaterial.uniforms.uTime.value = elapsed;
      companion.scale.y = 1 + Math.sin(elapsed * 0.42) * 0.004;
      atmosphere.rotation.y = elapsed * 0.035;
    },
  };
}

function jetSurfaceGeometry(length, startRadius, endRadius, longitudinal, radial){
  const positions = [];
  const coordinates = [];
  const indices = [];
  for (let row = 0; row <= longitudinal; row++){
    const u = row / longitudinal;
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, Math.pow(u, 0.78));
    const y = 7.4 + length * u;
    for (let side = 0; side <= radial; side++){
      const angle = side / radial * TAU;
      const corrugation = 1 + Math.sin(angle * 3 + u * 19) * 0.045;
      positions.push(
        Math.cos(angle) * radius * corrugation,
        y,
        Math.sin(angle) * radius * corrugation,
      );
      coordinates.push(u, side / radial);
    }
  }
  const stride = radial + 1;
  for (let row = 0; row < longitudinal; row++){
    for (let side = 0; side < radial; side++){
      const a = row * stride + side;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aJetCoord', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.indexed = true;
  geometry.userData.role = 'broad-polar-jet-surface';
  return geometry;
}

function jetSurfaceMaterial(resources, color, hotColor, opacity){
  return resources.material(new THREE.ShaderMaterial({
    name: 'M87.BroadPolarJetSurfaceMaterial',
    precision: FRAGMENT_PRECISION,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uHotColor: { value: new THREE.Color(hotColor) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      attribute vec2 aJetCoord;
      varying vec2 vJetCoord;
      void main(){
        vJetCoord = aJetCoord;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      precision ${FRAGMENT_PRECISION} float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uHotColor;
      uniform float uOpacity;
      varying vec2 vJetCoord;
      void main(){
        float launch = smoothstep(0.0, 0.07, vJetCoord.x);
        float terminal = 1.0 - smoothstep(0.68, 1.0, vJetCoord.x);
        float rib = 0.35 + 0.65 * pow(abs(sin(vJetCoord.y * 18.8495559
          + vJetCoord.x * 17.0 - uTime * 0.7)), 5.0);
        float knotTrain = 0.62 + 0.38 * pow(0.5 + 0.5 * sin(
          vJetCoord.x * 46.0 - uTime * 1.15), 6.0);
        float energy = launch * terminal * rib * knotTrain;
        float alpha = uOpacity * energy;
        if (alpha < 0.002) discard;
        vec3 color = mix(uHotColor, uColor, smoothstep(0.04, 0.82, vJetCoord.x));
        gl_FragColor = vec4(color, alpha);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }));
}

function orientAlongAxis(object, axis){
  object.quaternion.setFromUnitVectors(UP, axis);
  return object;
}

function addJetSurface(context, profile, resources, axis, options){
  const material = jetSurfaceMaterial(
    resources, options.color, options.hotColor, options.opacity);
  const mesh = new THREE.Mesh(
    resources.geometry(jetSurfaceGeometry(
      options.length, options.startRadius, options.endRadius,
      options.longitudinal || 26, options.radial || 18)),
    material,
  );
  mesh.name = options.name;
  orientAlongAxis(mesh, axis);
  exposeContext(mesh, profile, options.role, {
    axis: axis.toArray(),
    morphology: 'open-corrugated-surface-not-a-wire',
  });
  context.add(mesh);
  return { mesh, material };
}

function createM87Context(group, core, profile, resources){
  const context = new THREE.Group();
  context.name = 'M87.RelativisticJetContext';
  exposeContext(context, profile, 'bipolar-relativistic-jet-context', {
    reconstruction: 'qualitative-not-to-scale',
  });
  group.add(context);

  const axis = new THREE.Vector3(...core.group.userData.jetContext.localAxis).normalize();
  if (axis.y < 0) axis.negate();
  const counterAxis = axis.clone().negate();
  const surfaces = [
    addJetSurface(context, profile, resources, axis, {
      name: 'M87.PrimaryJet.BroadFaintSheath',
      role: 'primary-broad-polar-jet-surface',
      length: 58, startRadius: 2.2, endRadius: 10.0,
      color: 0xd66c2c, hotColor: 0xffe0a2, opacity: 0.14,
    }),
    addJetSurface(context, profile, resources, axis, {
      name: 'M87.PrimaryJet.CollimatedInnerSurface',
      role: 'primary-collimated-jet-surface',
      length: 52, startRadius: 0.72, endRadius: 3.4,
      color: 0xff9142, hotColor: 0xffffdc, opacity: 0.19,
      longitudinal: 30, radial: 14,
    }),
    addJetSurface(context, profile, resources, counterAxis, {
      name: 'M87.CounterJet.FaintBroadSurface',
      role: 'faint-counter-jet-surface',
      length: 34, startRadius: 1.8, endRadius: 6.5,
      color: 0x9a4828, hotColor: 0xffb879, opacity: 0.065,
      longitudinal: 22,
    }),
  ];

  const knotGeometry = resources.geometry(new THREE.OctahedronGeometry(1, 2));
  const knotMaterial = resources.material(new THREE.MeshBasicMaterial({
    name: 'M87.JetKnotMaterial',
    color: 0xffc179,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  const tangent = new THREE.Vector3(1, 0, 0);
  if (Math.abs(axis.dot(tangent)) > 0.9) tangent.set(0, 0, 1);
  const sideA = new THREE.Vector3().crossVectors(axis, tangent).normalize();
  const sideB = new THREE.Vector3().crossVectors(axis, sideA).normalize();
  const knots = [];
  [0.17, 0.29, 0.44, 0.61, 0.78].forEach((u, index) => {
    const knot = new THREE.Mesh(knotGeometry, knotMaterial);
    const offset = Math.sin(index * 2.7) * (0.45 + u * 1.8);
    knot.position.copy(axis).multiplyScalar(7.4 + u * 54)
      .addScaledVector(sideA, offset)
      .addScaledVector(sideB, Math.cos(index * 1.9) * u * 0.75);
    const size = 0.72 + u * 1.15;
    knot.scale.setScalar(size);
    knot.name = `M87.PrimaryJet.Knot${index + 1}`;
    exposeContext(knot, profile, 'resolved-polar-jet-knot', {
      sequence: index + 1,
      distanceFraction: u,
    });
    context.add(knot);
    knots.push({ knot, size, phase: index * 1.37 });
  });

  core.group.userData.contextRole = 'strong-orange-relativistic-core';
  core.group.userData.polarAxis = axis.toArray();

  return {
    update(_dt, elapsed){
      for (const surface of surfaces)
        surface.material.uniforms.uTime.value = elapsed;
      for (const record of knots){
        const scale = record.size * (1 + Math.sin(elapsed * 1.15 + record.phase) * 0.055);
        record.knot.scale.setScalar(scale);
        record.knot.rotation.y = elapsed * 0.08 + record.phase;
      }
    },
  };
}

function orbitGeometry(config){
  const points = [];
  const point = new THREE.Vector3();
  for (let segment = 0; segment < 192; segment++){
    keplerPositionAtEccentricAnomaly(config, segment / 192 * TAU, point);
    points.push(point.clone());
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.computeBoundingSphere();
  geometry.userData.role = 'three-dimensional-S-star-orbit-curve';
  geometry.userData.focusAtBlackHole = true;
  return geometry;
}

const S_STAR_VISUALS = Object.freeze({
  S2: Object.freeze({ radius: 1.02, color: 0xf4f6ff }),
  S38: Object.freeze({ radius: 0.82, color: 0xd9e8ff }),
  S55: Object.freeze({ radius: 0.76, color: 0xffeee0 }),
});

function createLuminousStar(config, profile, resources){
  const visual = S_STAR_VISUALS[config.id];
  const star = new THREE.Group();
  star.name = `SagittariusA.SStar.${config.id}`;
  exposeContext(star, profile, 'luminous-S-star', {
    designation: config.id,
    orbitRepresentation: 'shared-display-Kepler-orbit',
    orbitalPeriodDays: config.period,
  });

  const photosphereMaterial = resources.material(new THREE.MeshBasicMaterial({
    name: `SagittariusA.${config.id}.PhotosphereMaterial`,
    color: visual.color,
    toneMapped: false,
  }));
  const photosphere = new THREE.Mesh(
    resources.geometry(new THREE.SphereGeometry(visual.radius, 20, 14)),
    photosphereMaterial,
  );
  photosphere.name = `SagittariusA.${config.id}.Photosphere`;
  exposeContext(photosphere, profile, 'S-star-photosphere', { designation: config.id });
  star.add(photosphere);

  const coronaMaterial = resources.material(new THREE.MeshBasicMaterial({
    name: `SagittariusA.${config.id}.FacetedCoronaMaterial`,
    color: visual.color,
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  const corona = new THREE.Mesh(
    resources.geometry(new THREE.IcosahedronGeometry(visual.radius * 1.72, 2)),
    coronaMaterial,
  );
  corona.name = `SagittariusA.${config.id}.FacetedCoronaSurface`;
  exposeContext(corona, profile, 'luminous-S-star-corona-surface', {
    designation: config.id,
  });
  star.add(corona);
  return star;
}

function createSagittariusContext(group, core, profile, resources){
  const context = new THREE.Group();
  context.name = 'SagittariusA.SStarOrbitalContext';
  exposeContext(context, profile, 'three-S-star-orbits', {
    orbitCount: S_STAR_ORBITS.length,
    reconstruction: 'shared-system-view-Keplerian-context',
    displayDaysPerSecond: S_STAR_DISPLAY_DAYS_PER_SECOND,
  });
  group.add(context);

  const stars = [];
  for (const config of S_STAR_ORBITS){
    const orbitMaterial = resources.material(new THREE.LineBasicMaterial({
      name: `SagittariusA.${config.id}.OrbitMaterial`,
      color: config.id === 'S55' ? 0x4e9eb5 : 0x54c5e8,
      transparent: true,
      opacity: config.id === 'S2' ? 0.31 : 0.21,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    const orbit = new THREE.LineLoop(
      resources.geometry(orbitGeometry(config)),
      orbitMaterial,
    );
    orbit.name = `SagittariusA.${config.id}.OrbitCurve`;
    exposeContext(orbit, profile, 'S-star-orbit-curve', {
      designation: config.id,
      eccentricity: config.e,
      focusAtBlackHole: true,
    });
    context.add(orbit);

    const star = createLuminousStar(config, profile, resources);
    context.add(star);
    stars.push({ config, star, position: new THREE.Vector3() });
  }

  core.group.userData.contextRole = 'warm-quiescent-galactic-center-core';
  core.group.userData.orbitingStars = S_STAR_ORBITS.map(config => config.id);

  return {
    update(_dt, elapsed){
      for (const record of stars){
        sStarPositionAtDays(
          record.config,
          elapsed * S_STAR_DISPLAY_DAYS_PER_SECOND,
          record.position,
        );
        record.star.position.copy(record.position);
        const shimmer = 1 + Math.sin(elapsed * 2.3 + record.config.phase) * 0.045;
        record.star.scale.setScalar(shimmer);
        record.star.rotation.y = elapsed * 0.16;
      }
    },
  };
}

function buildRealBlackHole(entry, config, image){
  if (!entry || entry.id !== Object.keys(LANDMARK_CONFIG)
    .find(id => LANDMARK_CONFIG[id] === config))
    throw new Error('Black-hole landmark config does not match entry');

  const profile = resolveBlackHoleProfile(config.profile);
  const resources = makeResourceBag();
  const group = new THREE.Group();
  group.name = `BlackHoleLandmark.${entry.id}`;
  group.userData.blackHoleLandmark = true;
  group.userData.entryId = entry.id;
  group.userData.profileId = profile.id;
  group.userData.profileLabel = profile.label;
  group.userData.contextRole = config.context;
  group.userData.flatSourceImage = false;
  group.userData.modelAlwaysVisible = true;
  group.userData.observationPolicy =
    'source image is a flat sidecar; explanatory 3D model remains visible';

  const modelRoot = new THREE.Group();
  modelRoot.name = `BlackHoleLandmark.${entry.id}.PersistentModel`;
  modelRoot.userData.persistentThreeDimensionalModel = true;
  group.add(modelRoot);

  const core = createBlackHoleVisual({
    profile,
    radius: config.radius,
    name: `BlackHoleLandmark.${entry.id}.RelativisticCore`,
    jetContext: entry.id === 'm87-star',
  });
  core.group.userData.landmarkEntryId = entry.id;
  core.group.userData.landmarkContext = config.context;
  modelRoot.add(core.group);

  let context;
  if (entry.id === 'cygnus-x-1')
    context = createCygnusContext(modelRoot, core, profile, resources);
  else if (entry.id === 'm87-star')
    context = createM87Context(modelRoot, core, profile, resources);
  else
    context = createSagittariusContext(modelRoot, core, profile, resources);

  const observationDock = createObservationDock({
    image,
    name: `BlackHoleLandmark.${entry.id}.ObservationDock`,
    ...config.observation,
  });
  group.add(observationDock.group);

  let elapsed = 0;
  let disposed = false;
  context.update(0, elapsed);

  function setMoment(visual){
    if (disposed) return;
    const observation = isObservationMoment(visual);
    modelRoot.visible = true;
    observationDock.setVisible(observation);
    group.userData.activePresentation = observation
      ? 'model-plus-source-observation'
      : 'three-dimensional-model';
  }
  setMoment({ state: 'model' });

  return {
    group,
    focusDist: config.focusDist,
    startTheta: 0,
    startPhi: HALF_PI,
    autoRotate: false,
    isImage: false,
    modelCredit: config.credit,
    setMoment,
    update(dt, camera){
      if (disposed) return;
      const step = clampStep(dt);
      elapsed = (elapsed + step) % 8192;
      modelRoot.visible = true;
      core.update(step, camera);
      context.update(step, elapsed);
      observationDock.update(step, camera);
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      group.userData.disposed = true;
      observationDock.dispose();
      core.dispose();
      resources.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}

export function buildCygnusX1Featured({ entry, image }){
  return buildRealBlackHole(entry, LANDMARK_CONFIG['cygnus-x-1'], image);
}

export function buildM87StarFeatured({ entry, image }){
  return buildRealBlackHole(entry, LANDMARK_CONFIG['m87-star'], image);
}

export function buildSagittariusAStarFeatured({ entry, image }){
  return buildRealBlackHole(entry, LANDMARK_CONFIG['sagittarius-a-star'], image);
}

export function buildBlackHoleFeatured({ entry, image }){
  const config = entry && LANDMARK_CONFIG[entry.id];
  if (!config) throw new Error((entry && entry.id || 'unknown') + ': no black-hole profile');
  return buildRealBlackHole(entry, config, image);
}

/* A featured route is intentional here even though the existing procedural
   merger remains the renderer: it prevents the archive JPEG from replacing
   the animated inspiral in LandmarkView. */
export function buildGW150914Featured({ entry, image }){
  if (!entry || !GW150914_IDS.has(entry.id))
    throw new Error('GW150914 featured wrapper requires the gw150914 entry');
  const delegate = buildGravWave(entry);
  const modelRoot = delegate.group;
  modelRoot.name = `BlackHoleMerger.${entry.id}.PersistentModel`;
  modelRoot.userData.persistentThreeDimensionalModel = true;
  const group = new THREE.Group();
  group.name = 'BlackHoleMerger.GW150914';
  group.userData.blackHoleMerger = true;
  group.userData.entryId = entry.id;
  group.userData.contextRole = 'binary-black-hole-inspiral-and-wavefronts';
  group.userData.flatSourceImage = false;
  group.userData.modelAlwaysVisible = true;
  group.userData.observationPolicy =
    'official artwork or detector figure stays flat beside the explanatory 3D merger';
  group.add(modelRoot);
  const illustration = image && image.coverFile ? {
    file: image.coverFile,
    credit: image.coverCredit || image.credit,
    alt: image.coverAlt || '',
  } : image;
  const illustrationDock = createObservationDock({
    image: illustration,
    name: `BlackHoleMerger.${entry.id}.IllustrationDock`,
    width: 27,
    offsetX: 24,
    offsetY: 10,
    accent: 0x93b8ff,
    heroRadius: 25,
  });
  const signalDock = createObservationDock({
    image,
    name: `BlackHoleMerger.${entry.id}.DetectorSignalDock`,
    width: 27,
    offsetX: 24,
    offsetY: 10,
    accent: 0x93b8ff,
    heroRadius: 25,
  });
  group.add(illustrationDock.group, signalDock.group);
  let disposed = false;
  const modelCredit =
    'Procedural 3D model · GW150914 inspiral timing and scale are illustrative';
  let activeEvidence = 'illustration';

  function setMoment(visual){
    if (disposed) return;
    activeEvidence = visual && visual.evidence === 'signal' ? 'signal' : 'illustration';
    modelRoot.visible = true;
    illustrationDock.setVisible(activeEvidence === 'illustration');
    signalDock.setVisible(activeEvidence === 'signal');
    group.userData.observationVisible = activeEvidence === 'signal';
    group.userData.activeEvidence = activeEvidence;
    group.userData.activePresentation = activeEvidence === 'signal'
      ? 'model-plus-detector-signal'
      : 'model-plus-official-illustration';
  }
  setMoment({ state: 'model', evidence: 'illustration' });

  return {
    ...delegate,
    group,
    startTheta: 0.38,
    startPhi: 1.05,
    autoRotate: false,
    isImage: false,
    imageCredit: image && image.credit || null,
    modelCredit,
    creditForPresentation(){
      const evidenceCredit = activeEvidence === 'signal'
        ? image && image.credit
        : illustration && illustration.credit;
      return {
        label: activeEvidence === 'signal'
          ? 'DETECTOR SIGNAL + MODEL'
          : 'OFFICIAL ILLUSTRATION + MODEL',
        text: [evidenceCredit, modelCredit].filter(Boolean).join(' · '),
      };
    },
    setMoment,
    update(dt, camera){
      if (disposed) return;
      const step = clampStep(dt);
      modelRoot.visible = true;
      if (typeof delegate.update === 'function') delegate.update(step, camera);
      illustrationDock.update(step, camera);
      signalDock.update(step, camera);
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      group.userData.disposed = true;
      illustrationDock.dispose();
      signalDock.dispose();
      if (typeof delegate.dispose === 'function') delegate.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
