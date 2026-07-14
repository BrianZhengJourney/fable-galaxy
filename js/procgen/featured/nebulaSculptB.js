/* Crisp, source-registered geometry for the four collection-B nebulae.
   This module intentionally contains no sprites, point clouds, tubes, or
   contour cages: observed colour stays in the shared depth relief, with only
   discrete hard knots and occluding dust solids added here. */

import * as THREE from 'three';
import { mulberry, hashStr, gaussian } from '../../utils/rng.js';

const TAU = Math.PI * 2;
const DISPLAY_HEIGHT = 62;
const UP = new THREE.Vector3(0, 1, 0);

function vector(value, fallback = [0, 0, 0]){
  const source = Array.isArray(value) ? value : fallback;
  return new THREE.Vector3(
    Number(source[0]) || 0,
    Number(source[1]) || 0,
    Number(source[2]) || 0);
}

function color(value, fallback = 0xffffff){
  try{ return new THREE.Color(value == null ? fallback : value); }
  catch(_error){ return new THREE.Color(fallback); }
}

function rotation(value){
  const source = Array.isArray(value) ? value : [0, 0, Number(value) || 0];
  return new THREE.Euler(
    THREE.MathUtils.degToRad(Number(source[0]) || 0),
    THREE.MathUtils.degToRad(Number(source[1]) || 0),
    THREE.MathUtils.degToRad(Number(source[2]) || 0), 'XYZ');
}

function makeMaterial(tracker, value, opacity, options = {}){
  const material = tracker.material(new THREE.MeshBasicMaterial({
    color: color(value, 0xffffff),
    transparent: opacity < 1 || options.transparent !== false,
    opacity,
    blending: options.blending == null ? THREE.AdditiveBlending : options.blending,
    depthWrite: options.depthWrite === true,
    depthTest: options.depthTest !== false,
    side: options.side == null ? THREE.DoubleSide : options.side,
    vertexColors: options.vertexColors === true,
    toneMapped: false,
  }));
  material.userData.baseOpacity = opacity;
  material.userData.crispNebulaSurface = true;
  return material;
}

function addMesh(root, geometry, material, name, tracker){
  tracker.geometry(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.crispNebulaFeature = true;
  root.add(mesh);
  return mesh;
}

function instances(root, samples, material, tracker, name, kind = 'icosahedron'){
  if (!samples.length) return null;
  const geometry = kind === 'sphere'
    ? new THREE.SphereGeometry(1, 12, 8)
    : kind === 'octahedron'
      ? new THREE.OctahedronGeometry(1, 0)
      : new THREE.IcosahedronGeometry(1, 0);
  tracker.geometry(geometry);
  const mesh = new THREE.InstancedMesh(geometry, material, samples.length);
  mesh.name = name;
  mesh.userData.crispNebulaFeature = true;
  const dummy = new THREE.Object3D();
  samples.forEach((sample, index) => {
    dummy.position.copy(vector(sample.position));
    const scale = Array.isArray(sample.scale)
      ? vector(sample.scale, [1, 1, 1])
      : new THREE.Vector3(1, 1, 1).multiplyScalar(Number(sample.scale) || 1);
    dummy.scale.copy(scale);
    dummy.rotation.copy(rotation(sample.rotationDeg));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, color(sample.color, 0xffffff));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  root.add(mesh);
  return mesh;
}

function taperedSolid(root, startValue, endValue, baseRadius, tipRadius,
  material, quality, tracker, name){
  const start = vector(startValue), end = vector(endValue);
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 1e-4) return null;
  const geometry = new THREE.CylinderGeometry(
    Math.max(.02, tipRadius), Math.max(.03, baseRadius), length,
    quality.solidSides, 1, false);
  const mesh = addMesh(root, geometry, material, name, tracker);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.userData.occludingSolid = material.blending === THREE.NormalBlending;
  return mesh;
}

function qualityFrom(budget){
  const high = Number(budget && budget.familyPoints) >= 3000;
  return {
    high,
    solidSides: high ? 9 : 6,
    countScale: high ? 1 : .46,
  };
}

function sourcePosition(profile, source){
  if (!source) return null;
  const fallback = Array.isArray(source.position) ? vector(source.position) : null;
  if (!Array.isArray(source.photoUv) || source.photoUv.length < 2) return fallback;
  const u = Number(source.photoUv[0]), v = Number(source.photoUv[1]);
  if (!Number.isFinite(u) || !Number.isFinite(v)) return fallback;
  const frame = profile.structure && profile.structure.featureFrame || {};
  const reconstruction = profile.reconstruction || {};
  const plate = Array.isArray(frame.plateSize) ? frame.plateSize : null;
  const height = plate && Number.isFinite(Number(plate[1]))
    ? Number(plate[1]) : DISPLAY_HEIGHT;
  const width = plate && Number.isFinite(Number(plate[0]))
    ? Number(plate[0])
    : height * (Number(reconstruction.plateAspect) || 1);
  return new THREE.Vector3(
    (u - .5) * width,
    (.5 - v) * height,
    fallback ? fallback.z : Number(source.z) || 0,
  );
}

/* Profiles sometimes describe a single physical source while their structure
   already contains a more detailed stellar cluster. Keep the physical source
   explicit when it is unique (notably Cat's Eye), but do not draw a second
   marker over an authored star anchor or collapse a resolved cluster to one
   oversized point. */
function addAuthoredSources(root, profile, tracker){
  const sources = Array.isArray(profile.sources) ? profile.sources : [];
  const anchors = profile.structure && Array.isArray(profile.structure.starAnchors)
    ? profile.structure.starAnchors : [];
  const anchorPositions = anchors
    .filter(anchor => anchor && Array.isArray(anchor.position))
    .map(anchor => ({
      position: vector(anchor.position),
      size: Number(anchor.size) || 2,
    }));
  const samples = [];
  const labels = [];
  for (const source of sources){
    const position = sourcePosition(profile, source);
    if (!position) continue;
    const label = String(source.label || 'AUTHORED IONIZING SOURCE');
    if (anchorPositions.length && /cluster/i.test(label)) continue;
    const sourceSize = Number(source.size) || 2.5;
    const duplicate = anchorPositions.some(anchor =>
      anchor.position.distanceTo(position) < Math.max(.8, sourceSize*.22, anchor.size*.18));
    if (duplicate) continue;
    samples.push({
      position: position.toArray(),
      scale: Math.max(.20, sourceSize * .13),
      rotationDeg: [0, 0, 0],
      color: source.color == null ? 0xe8f5ff : source.color,
    });
    labels.push(label);
  }
  if (!samples.length){
    root.userData.authoredSourceAnchors = 0;
    return null;
  }
  const material = makeMaterial(tracker, 0xffffff, .94, {
    vertexColors: true,
  });
  const mesh = instances(root, samples, material, tracker,
    'authored-physical-source-anchors', 'sphere');
  mesh.userData.sourceLabels = labels;
  mesh.userData.scientificSources = true;
  root.userData.authoredSourceAnchors = samples.length;
  return mesh;
}

function buildCatsEye(root, profile, quality, tracker, rnd){
  const structure = profile.structure || {};
  const palette = profile.palette || {};
  // The registered source/depth mesh carries the nested bubbles, pulse rings,
  // and point-symmetric arcs in their observed colours. Closed sphere shells
  // and contour ribbons made the object look like a neon wire diagram when
  // orbiting, so only discrete three-dimensional knots are added here.
  root.userData.innerBubbles = 'source-depth-relief';
  root.userData.pulseShells = 'source-depth-relief';
  root.userData.pointSymmetricArcs = 'source-depth-relief';

  const capSamples = [];
  for (const [capIndex, cap] of (structure.polarCaps || []).entries()){
    const count = Math.max(3, Math.round((cap.knotCount || 16) *
      quality.countScale * .55));
    const center = vector(cap.position), scale = vector(cap.scale, [4, 2, 2]);
    for (let i = 0; i < count; i++){
      const angle = rnd() * TAU;
      const p = new THREE.Vector3(
        Math.cos(angle) * scale.x * (.72 + rnd() * .28),
        Math.sin(angle) * scale.y * (.72 + rnd() * .28),
        gaussian(rnd) * scale.z * .48).applyEuler(rotation(cap.rotationDeg)).add(center);
      capSamples.push({
        position: p.toArray(), scale: .18 + rnd() * .42,
        rotationDeg: [rnd()*180, rnd()*180, rnd()*180],
        color: cap.color || palette.rim,
      });
    }
  }
  if (capSamples.length){
    const capMaterial = makeMaterial(tracker, 0xffffff, .18, {
      vertexColors:true,blending:THREE.NormalBlending });
    instances(root, capSamples, capMaterial, tracker, 'cat-eye-cap-knots');
  }

  const jet = structure.precessingJet;
  if (jet){
    const angle = THREE.MathUtils.degToRad(jet.axisAngleDeg || 0);
    const inclination = THREE.MathUtils.degToRad(jet.inclinationDeg || 0);
    const axis = new THREE.Vector3(
      Math.cos(angle) * Math.cos(inclination),
      Math.sin(angle) * Math.cos(inclination), Math.sin(inclination)).normalize();
    const knotSamples = [];
    for (const sign of [-1, 1]){
      const spacing = Math.max(1.2, jet.knotSpacing || 3.4);
      for (let distance = spacing; distance < (jet.length || 30); distance += spacing){
        knotSamples.push({
          position: vector(jet.origin).addScaledVector(axis, distance * sign).toArray(),
          scale: .16 + rnd() * .22, color: jet.color || palette.rim,
          rotationDeg: [rnd()*180, rnd()*180, rnd()*180],
        });
      }
    }
    const knotMaterial = makeMaterial(tracker,0xffffff,.20,{
      vertexColors:true,blending:THREE.NormalBlending });
    instances(root, knotSamples, knotMaterial, tracker, 'cat-eye-jet-knots');
  }

  const shock = structure.shockKnots;
  if (shock){
    const count = Math.max(12, Math.round((shock.count || 48) * quality.countScale));
    const samples = [];
    for (let i = 0; i < count; i++){
      const angle = rnd() * TAU;
      const radius = THREE.MathUtils.lerp(shock.radialRange[0], shock.radialRange[1], rnd());
      const axial = 1 + (shock.axialBias || 0) * Math.abs(Math.sin(angle * 2));
      samples.push({
        position: [Math.cos(angle) * radius, Math.sin(angle) * radius * axial,
          THREE.MathUtils.lerp(shock.depthRange[0], shock.depthRange[1], rnd())],
        scale: THREE.MathUtils.lerp(shock.sizeRange[0], shock.sizeRange[1], rnd()),
        rotationDeg: [rnd()*180, rnd()*180, rnd()*180],
        color: shock.colors[Math.floor(rnd() * shock.colors.length)],
      });
    }
    const material = makeMaterial(tracker,0xffffff,.18,{
      vertexColors:true,blending:THREE.NormalBlending });
    instances(root, samples, material, tracker, 'cat-eye-shock-knots');
  }
}

function buildVeil(root, profile, quality, tracker, rnd){
  const structure = profile.structure || {};
  // Every authored shock strand is already selected directly from the source
  // RGB/depth relief. Additional analytic ribbons were smooth rails laid over
  // the real filaments, especially obvious edge-on.
  if (structure.filamentBundles) root.userData.filamentBundles='source-depth-relief';
  if (structure.speciesLayers) root.userData.speciesLayers='source-depth-relief';
  if (structure.turbulenceCells) root.userData.turbulenceCells='source-depth-relief';
}

function sheetTransform(point, structure){
  const sheet = structure.molecularSheet || {};
  const euler = rotation([sheet.inclinationDeg || 0, 0, sheet.positionAngleDeg || 0]);
  return point.clone().applyEuler(euler).add(vector(sheet.center));
}

function buildRosette(root, profile, quality, tracker, rnd){
  const structure = profile.structure || {};
  const palette = profile.palette || {};
  const sheet = structure.molecularSheet;
  const cavity = structure.cavity;
  if (sheet) root.userData.molecularSheet='source-depth-relief';
  if (cavity) root.userData.windCavity='source-depth-relief';

  const sectorKnots = [];
  for (const sector of structure.rimSectors || []){
    const knots = Math.max(4, Math.round(
      sector.arcDeg / 12 * (sector.density || .5) * quality.countScale));
    for (let i = 0; i < knots; i++){
      const angle = THREE.MathUtils.degToRad(
        sector.startDeg + sector.arcDeg * rnd());
      const radius = sector.radius + gaussian(rnd) * sector.thickness * .36;
      const p = new THREE.Vector3(Math.cos(angle) * radius,
        Math.sin(angle) * radius, sector.depth + gaussian(rnd) * 1.2);
      p.applyEuler(rotation([
        structure.molecularSheet && structure.molecularSheet.inclinationDeg || 0,
        0,
        structure.molecularSheet && structure.molecularSheet.positionAngleDeg || 0,
      ])).add(vector(structure.featureFrame && structure.featureFrame.center));
      sectorKnots.push({
        position: p.toArray(),
        scale: [.18+rnd()*.52, .18+rnd()*.72, .18+rnd()*.48],
        rotationDeg: [rnd()*180, rnd()*180, rnd()*180],
        color: sector.color || palette.emission,
      });
    }
  }
  if (sectorKnots.length){
    const material = makeMaterial(tracker, 0xffffff, .40, { vertexColors: true });
    instances(root, sectorKnots, material, tracker, 'rosette-sector-knots');
  }

  if (structure.ionizationFronts)
    root.userData.ionizationFronts='source-depth-relief';

  const darkMaterial = makeMaterial(tracker, palette.dust || 0x180c12, .58, {
    blending: THREE.NormalBlending, depthWrite: true,
  });
  const tipSamples = [];
  for (const pillar of structure.pillarAnchors || []){
    taperedSolid(root, pillar.base, pillar.tip, pillar.width * .52,
      pillar.width * .18, darkMaterial, quality, tracker,
      `rosette-occluding-pillar:${pillar.id}`);
    tipSamples.push({
      position: pillar.tip, scale: [pillar.width*.46, pillar.width*.62, pillar.width*.42],
      rotationDeg: [rnd()*90, rnd()*90, rnd()*180], color: palette.dust,
    });
  }
  if (tipSamples.length){
    const tipsMaterial = makeMaterial(tracker, 0xffffff, .92, {
      blending: THREE.NormalBlending, depthWrite: true, vertexColors: true,
    });
    instances(root, tipSamples, tipsMaterial, tracker, 'rosette-pillar-heads');
  }

  const field = structure.rimClumpField;
  if (field){
    const count = Math.max(20, Math.round(Math.min(field.count || 100,
      quality.high ? 96 : 42)));
    const center = vector(field.pointToward);
    const samples = [];
    for (let i = 0; i < count; i++){
      const southeast = rnd() < (field.southeastBias || 0);
      const angle = southeast
        ? THREE.MathUtils.degToRad(-70 + gaussian(rnd) * 42)
        : rnd() * TAU;
      const radius = THREE.MathUtils.lerp(field.radiusRange[0], field.radiusRange[1], rnd());
      const p = new THREE.Vector3(Math.cos(angle)*radius, Math.sin(angle)*radius,
        gaussian(rnd) * (sheet && sheet.thickness || 5) * .42);
      const transformed = sheetTransform(p, structure);
      const size = THREE.MathUtils.lerp(field.sizeRange[0], field.sizeRange[1],
        Math.pow(rnd(), 1.8));
      samples.push({
        position: transformed.toArray(), scale: [size, size*(.6+rnd()*.6), size*(.5+rnd()*.5)],
        rotationDeg: [rnd()*180, rnd()*180, rnd()*180],
        color: rnd() < .28 ? palette.warm : palette.outer,
      });
      if (i < (quality.high ? 12 : 5)){
        const length = THREE.MathUtils.lerp(
          field.shadowLengthRange[0], field.shadowLengthRange[1], rnd());
        const direction = center.clone().sub(transformed).normalize();
        taperedSolid(root, transformed, transformed.clone().addScaledVector(direction, length),
          size*.28, size*.08, darkMaterial, quality, tracker,
          `rosette-cometary-tail:${i}`);
      }
    }
    const clumpMaterial = makeMaterial(tracker, 0xffffff, .36, { vertexColors: true });
    instances(root, samples, clumpMaterial, tracker, 'rosette-rim-clumps');
  }

  const stars = structure.starAnchors || [];
  if (stars.length){
    const starSamples = stars.map(star => ({
      position: star.position,
      scale: Math.max(.14, (star.size || 2) * .14),
      rotationDeg: [45, 45, 0], color: star.color,
    }));
    const starMaterial = makeMaterial(tracker, 0xffffff, .86, { vertexColors: true });
    instances(root, starSamples, starMaterial, tracker, 'rosette-ob-star-anchors', 'octahedron');
  }
}

function buildTrifid(root, profile, quality, tracker, rnd){
  const structure = profile.structure || {};
  const palette = profile.palette || {};
  if (structure.emissionLobes) root.userData.emissionLobes='source-depth-relief';

  const cavity = structure.ionizedCavity;
  if (cavity) root.userData.ionizedCavity='source-depth-relief';

  if (structure.dustLanes) root.userData.dustLanes='source-depth-relief';
  if (structure.photodissociationRims)
    root.userData.photodissociationRims='source-depth-relief';
  if (structure.reflectionRegions)
    root.userData.reflectionRegions='source-depth-relief';

  const darkMaterial = makeMaterial(tracker, palette.dust || 0x10090d, .82, {
    blending: THREE.NormalBlending, depthWrite: true,
  });
  for (const feature of structure.photoevaporationFeatures || []){
    const center = vector(feature.center), tail = vector(feature.tailToward);
    const scale = feature.scale || [2, 4, 3];
    taperedSolid(root, tail, center, scale[0] * .52, scale[0] * .18,
      darkMaterial, quality, tracker, `trifid-eroding-head:${feature.id}`);
  }

  const jet = structure.hh399Jet;
  if (jet) root.userData.hh399Jet='source-depth-relief';

  const stars = structure.starAnchors || [];
  if (stars.length){
    const samples = stars.map(star => ({
      position: star.position,
      scale: Math.max(.16, (star.size || 2) * .13),
      rotationDeg: [45,45,rnd()*90], color: star.color,
    }));
    const material = makeMaterial(tracker, 0xffffff, .88, { vertexColors: true });
    instances(root, samples, material, tracker, 'trifid-stellar-anchors', 'octahedron');
  }
}

export function buildNebulaSculptB({ root, profile, budget, tracker, seed }){
  if (!root || !profile || !tracker) return false;
  const quality = qualityFrom(budget);
  const rnd = mulberry(hashStr(String(seed || profile.family || 'nebula-sculpt-b')));
  let handled = true;
  switch (profile.family){
    case 'nested-shell':
      buildCatsEye(root, profile, quality, tracker, rnd); break;
    case 'shock-sheet':
      buildVeil(root, profile, quality, tracker, rnd); break;
    case 'wind-bubble':
      buildRosette(root, profile, quality, tracker, rnd); break;
    case 'trilobe':
      buildTrifid(root, profile, quality, tracker, rnd); break;
    default:
      handled = false;
  }
  if (!handled) return false;
  addAuthoredSources(root, profile, tracker);
  return true;
}
