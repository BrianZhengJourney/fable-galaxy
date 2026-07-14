/* Crisp, source-registered geometry for the four collection-B nebulae.
   This module intentionally contains no sprites, point clouds, tubes, or
   contour cages: observed colour stays in the shared depth relief, with only
   discrete hard knots and occluding dust solids added here. */

import * as THREE from 'three';
import { mulberry, hashStr, gaussian } from '../../utils/rng.js';
import {
  addInstancedKnots,
  addStar as addSculptedStar,
  addTrackedMesh,
  arcPoints,
  makeNebulaMaterial,
  numeric,
  organicEllipsoidGeometry,
  organicRingGeometry,
  jaggedRibbonGeometry,
  sweptFilamentGeometry,
} from './nebulaSculptPrimitives.js';

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

function addContinuousMesh(root,geometry,material,name,tracker,transform={}){
  const mesh=addTrackedMesh(root,geometry,material,tracker,name);
  if(transform.position) mesh.position.copy(vector(transform.position));
  if(transform.rotationDeg) mesh.rotation.copy(rotation(transform.rotationDeg));
  if(transform.scale) mesh.scale.copy(vector(transform.scale,[1,1,1]));
  if(Number.isFinite(transform.renderOrder)) mesh.renderOrder=transform.renderOrder;
  return mesh;
}

function emissiveSurface(tracker,colorA,colorB,opacity,options={}){
  return makeNebulaMaterial(tracker,{
    colorA,colorB,opacity,rim:options.rim,filaments:options.filaments,
    scale:options.scale,phase:options.phase,erosion:options.erosion,
  });
}

function dustSurface(tracker,colorValue,opacity,options={}){
  const base=color(colorValue,0x10090d);
  return makeNebulaMaterial(tracker,{
    colorA:base,colorB:options.colorB || base.clone().multiplyScalar(1.55),opacity,dust:true,
    depthWrite:true,scale:options.scale || .28,phase:options.phase || 0,
    filaments:options.filaments || .16,
  });
}

function instances(root, samples, material, tracker, name, kind = 'icosahedron'){
  if (!samples.length) return null;
  const geometry = kind === 'sphere'
    ? new THREE.SphereGeometry(1, 12, 8)
    : kind === 'octahedron'
      ? new THREE.OctahedronGeometry(1, 0)
      : new THREE.IcosahedronGeometry(1, 0);
  tracker.geometry(geometry);
  const mesh = tracker.instanced(
    new THREE.InstancedMesh(geometry, material, samples.length));
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
  const sourcesToDraw = [];
  for (const source of sources){
    const position = sourcePosition(profile, source);
    if (!position) continue;
    const label = String(source.label || 'AUTHORED IONIZING SOURCE');
    if (anchorPositions.length && /cluster/i.test(label)) continue;
    const sourceSize = Number(source.size) || 2.5;
    const duplicate = anchorPositions.some(anchor =>
      anchor.position.distanceTo(position) < Math.max(.8, sourceSize*.22, anchor.size*.18));
    if (duplicate) continue;
    sourcesToDraw.push({ source,position,label,sourceSize });
  }
  if (!sourcesToDraw.length){
    root.userData.authoredSourceAnchors = 0;
    return null;
  }
  const stars=sourcesToDraw.map(({source,position,label,sourceSize})=>{
    const star=addSculptedStar(root,tracker,{
      position,size:Math.max(.24,sourceSize*.13),
      color:source.color == null?0xe8f5ff:source.color,
      name:'authored-physical-source-anchor',scientificSource:true,
    });
    star.userData.sourceLabel=label;
    return star;
  });
  root.userData.authoredSourceAnchors = stars.length;
  return stars;
}

function buildCatsEye(root, profile, quality, tracker, rnd){
  const structure = profile.structure || {};
  const palette = profile.palette || {};

  for(const [bubbleIndex,bubble] of (structure.innerBubbles || []).entries()){
    const material=emissiveSurface(tracker,bubbleIndex===3?palette.inner:
      bubble.color || palette.shell,bubbleIndex===3?palette.highlight:
      bubbleIndex===0?palette.rim:palette.inner,(bubble.opacity || .22)*1.24,{
        rim:(bubble.rimBoost || 1.45)*1.08,filaments:.92,scale:.42,
        phase:bubbleIndex*.83+.4,erosion:.28+bubbleIndex*.06,
      });
    addContinuousMesh(root,organicEllipsoidGeometry({
      radii:bubble.radii,longitude:quality.high?66:38,latitude:quality.high?36:22,
      irregularity:.055+(bubble.clumpiness || .2)*.10,phase:bubbleIndex*.91+.3,
      openPolar:bubbleIndex===3?.11:0,
    }),material,`cat-eye-continuous-bubble:${bubble.id}`,tracker,{
      position:bubble.center,rotationDeg:bubble.rotationDeg,
    });
  }
  root.userData.innerBubbles='continuous-indexed-shells';

  addContinuousMesh(root,organicRingGeometry({major:[8.4,11.1],tube:[1.25,1.5,2.5],
    majorSegments:quality.high?88:48,tubeSegments:quality.high?12:8,
    irregularity:.09,phase:.8}),emissiveSurface(tracker,palette.inner,palette.rim,.38,{
      rim:1.85,filaments:.92,scale:.48,phase:.8,erosion:.18}),
  'cat-eye-cyan-inner-eye-ring',tracker,{rotationDeg:[18,-9,42]});
  addContinuousMesh(root,organicRingGeometry({major:[11.5,8.1],tube:[1.0,1.25,2.0],
    majorSegments:quality.high?88:48,tubeSegments:quality.high?12:8,
    irregularity:.11,phase:2.2}),emissiveSurface(tracker,palette.shell,palette.highlight,.31,{
      rim:1.78,filaments:1.0,scale:.52,phase:2.2,erosion:.26}),
  'cat-eye-crimson-crossed-eye-ring',tracker,{rotationDeg:[-15,13,-28]});

  const pulse=structure.pulseShells;
  if(pulse){
    const shellIndices=quality.high
      ? pulse.radii.map((_radius,index)=>index)
      : pulse.radii.map((_radius,index)=>index).filter(index=>index%2===0);
    for(const shellIndex of shellIndices){
      const t=shellIndex/Math.max(1,pulse.radii.length-1);
      const radius=pulse.radii[shellIndex]*.64;
      const opacity=THREE.MathUtils.lerp(pulse.opacityRange[0],pulse.opacityRange[1],1-t)*.48;
      const ellipticity=1+Math.sin(shellIndex*1.37)*.075;
      const material=emissiveSurface(tracker,pulse.color || palette.outer,palette.rim,
        opacity,{rim:pulse.edgeBrightness || 1.6,filaments:.68,scale:.26,
          phase:shellIndex*1.17,erosion:.68+.18*t});
      addContinuousMesh(root,organicEllipsoidGeometry({
        radii:[radius*pulse.scale[0]*ellipticity,
          radius*pulse.scale[1]/ellipticity,radius*pulse.scale[2]*.86],
        longitude:quality.high?54:30,latitude:quality.high?28:18,
        irregularity:.018+(pulse.radialJitter || .3)/radius,
        phase:shellIndex*.73,
      }),material,`cat-eye-mass-loss-shell:${shellIndex}`,tracker,{
        position:[Math.sin(shellIndex*1.7)*pulse.centerJitter*3.2,
          Math.cos(shellIndex*1.3)*pulse.centerJitter*2.7,
          Math.sin(shellIndex*.9)*pulse.centerJitter*1.5],
      });
    }
    root.userData.pulseShells='continuous-limb-brightened-shells';
  }

  for(const [arcIndex,arc] of (structure.pointSymmetricArcs || []).entries()){
    const strands=Math.max(1,arc.strandCount || 1);
    for(let strand=0;strand<strands;strand++){
      const offset=(strand-(strands-1)/2)*numeric(arc.thickness,.3)*1.8;
      const points=arcPoints({center:arc.center,radius:arc.radius+offset,
        axisRatio:1,startDeg:arc.startDeg,arcDeg:arc.arcDeg,
        segments:quality.high?58:32,rotationDeg:arc.rotationDeg,
        depthWave:.7+strand*.16,phase:arcIndex+strand*.8});
      const material=emissiveSurface(tracker,arc.color || palette.rim,
        arcIndex>1?palette.inner:palette.highlight,(arc.opacity || .25)*.78,{
          rim:1.65,filaments:.52,scale:.55,phase:arcIndex+strand,
        });
      addContinuousMesh(root,sweptFilamentGeometry(points,{
        radius:[numeric(arc.thickness,.3)*.8,numeric(arc.thickness,.3)*.44],
        depthRatio:.64,segments:quality.high?58:32,radialSegments:7,
        irregularity:.07,phase:arcIndex+strand,
      }),material,`cat-eye-point-symmetric-ribbon:${arc.id}:${strand}`,tracker);
    }
  }
  root.userData.pointSymmetricArcs='continuous-precession-ribbons';

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
    const capMaterial = makeMaterial(tracker, 0xffffff, .38, {
      vertexColors:true });
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
    const jetMaterial=emissiveSurface(tracker,jet.color || palette.rim,palette.inner,
      .18,{rim:1.8,filaments:.45,scale:.6,phase:1.8});
    for (const sign of [-1, 1]){
      const origin=vector(jet.origin);
      const end=origin.clone().addScaledVector(axis,(jet.length || 30)*sign);
      const control=origin.clone().addScaledVector(axis,(jet.length || 30)*sign*.48)
        .add(new THREE.Vector3(-axis.y,axis.x,axis.z*.2)
          .multiplyScalar(sign*(jet.halfOpeningDeg || 20)*.025));
      addContinuousMesh(root,sweptFilamentGeometry([origin,control,end],{
        radius:[jet.radius || .18,.045],depthRatio:.68,
        segments:quality.high?46:26,radialSegments:6,irregularity:.09,phase:sign,
      }),jetMaterial,`cat-eye-precessing-jet:${sign}`,tracker);
      const spacing = Math.max(1.2, jet.knotSpacing || 3.4);
      for (let distance = spacing; distance < (jet.length || 30); distance += spacing){
        knotSamples.push({
          position: vector(jet.origin).addScaledVector(axis, distance * sign).toArray(),
          scale: .16 + rnd() * .22, color: jet.color || palette.rim,
          rotationDeg: [rnd()*180, rnd()*180, rnd()*180],
        });
      }
    }
    const knotMaterial = makeMaterial(tracker,0xffffff,.34,{
      vertexColors:true });
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
    const material = makeMaterial(tracker,0xffffff,.32,{
      vertexColors:true });
    instances(root, samples, material, tracker, 'cat-eye-shock-knots');
  }

  root.userData.heroSurfaceMode='continuous-volumetric-nested-shell';
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
  const internalKnots=[];

  for(const [lobeIndex,lobe] of (structure.emissionLobes || []).entries()){
    const material=emissiveSurface(tracker,lobeIndex===1?0xff2f78:0xff355e,
      lobeIndex===2?0xff8b72:0xff6fa0,(lobe.opacity || .24)*1.78,{
        rim:1.82,filaments:1.16,scale:.43,phase:lobeIndex*.92+.3,
        erosion:.42,
      });
    addContinuousMesh(root,organicEllipsoidGeometry({radii:lobe.radii,
      longitude:quality.high?62:36,latitude:quality.high?34:20,
      irregularity:.18,phase:lobeIndex*1.14+.4,openPolar:.16,
    }),material,`trifid-continuous-emission-lobe:${lobe.id}`,tracker,{
      position:lobe.center,rotationDeg:lobe.rotationDeg,
    });
    addContinuousMesh(root,organicEllipsoidGeometry({
      radii:lobe.radii.map(value=>value*.69),
      longitude:quality.high?48:30,latitude:quality.high?28:18,
      irregularity:.14,phase:lobeIndex*1.4+2.1,openPolar:.10,
    }),emissiveSurface(tracker,0xff285f,0xffa06f,.22,{
      rim:1.48,filaments:1.0,scale:.5,phase:lobeIndex+2.1,erosion:.18}),
    `trifid-magenta-inner-glow:${lobe.id}`,tracker,{
      position:lobe.center,rotationDeg:lobe.rotationDeg,
    });
    const center=vector(lobe.center),radii=vector(lobe.radii),turn=rotation(lobe.rotationDeg);
    for(let i=0;i<(quality.high?32:14);i++){
      const direction=new THREE.Vector3(gaussian(rnd),gaussian(rnd),gaussian(rnd)).normalize();
      const radius=Math.pow(rnd(),.45)*.86;
      const p=new THREE.Vector3(direction.x*radii.x,direction.y*radii.y,
        direction.z*radii.z).multiplyScalar(radius).applyEuler(turn).add(center);
      internalKnots.push({position:p.toArray(),scale:[.12+rnd()*.44,.10+rnd()*.54,
        .12+rnd()*.40],rotationDeg:[rnd()*180,rnd()*180,rnd()*180],
        color:i%4===0?palette.rim:lobe.color || palette.emission});
    }
  }
  root.userData.emissionLobes='continuous-sculpted-volumes';

  const cavity = structure.ionizedCavity;
  if (cavity){
    const material=emissiveSurface(tracker,cavity.color || palette.emission,
      0xff6d98,(cavity.opacity || .16)*1.34,{
        rim:(cavity.edgeBrightness || 1.5)*1.08,filaments:1.0,scale:.38,phase:2.4,
        erosion:.48,
      });
    addContinuousMesh(root,organicEllipsoidGeometry({radii:cavity.radii,
      longitude:quality.high?66:38,latitude:quality.high?36:22,
      irregularity:.16,phase:2.4,openPolar:.22,
    }),material,'trifid-connected-ionized-cavity',tracker,{position:cavity.center});
    root.userData.ionizedCavity='continuous-connected-shell';
  }

  for(const [regionIndex,region] of (structure.reflectionRegions || []).entries()){
    const material=emissiveSurface(tracker,regionIndex?0x356dff:0x347dff,
      0x65e3ff,(region.opacity || .15)*2.25,{
        rim:1.82,filaments:1.08,scale:.42,phase:regionIndex+4.1,
        erosion:.38,
      });
    addContinuousMesh(root,organicEllipsoidGeometry({radii:region.radii,
      longitude:quality.high?58:34,latitude:quality.high?32:20,
      irregularity:.19,phase:regionIndex+3.4,openPolar:.18,
    }),material,`trifid-reflection-volume:${region.id}`,tracker,{
      position:region.center,rotationDeg:region.rotationDeg,
    });
    addContinuousMesh(root,organicEllipsoidGeometry({
      radii:region.radii.map(value=>value*.68),
      longitude:quality.high?44:28,latitude:quality.high?26:16,
      irregularity:.15,phase:regionIndex+6.2,openPolar:.10,
    }),emissiveSurface(tracker,0x2d68ff,0x7ceaff,.18,{
      rim:1.55,filaments:.92,scale:.52,phase:regionIndex+6.2,erosion:.16}),
    `trifid-cyan-reflection-inner-glow:${region.id}`,tracker,{
      position:region.center,rotationDeg:region.rotationDeg,
    });
    const center=vector(region.center),radii=vector(region.radii),turn=rotation(region.rotationDeg);
    for(let i=0;i<(quality.high?24:10);i++){
      const direction=new THREE.Vector3(gaussian(rnd),gaussian(rnd),gaussian(rnd)).normalize();
      const p=new THREE.Vector3(direction.x*radii.x,direction.y*radii.y,
        direction.z*radii.z).multiplyScalar(Math.pow(rnd(),.5)*.82)
        .applyEuler(turn).add(center);
      internalKnots.push({position:p.toArray(),scale:.12+rnd()*.38,
        rotationDeg:[rnd()*180,rnd()*180,rnd()*180],
        color:i%3===0?palette.highlight:region.color || palette.reflection});
    }
  }
  root.userData.reflectionRegions='continuous-blue-scattering-volumes';
  addInstancedKnots(root,tracker,internalKnots,{name:'trifid-internal-emission-knots',
    opacity:.50,additive:true,color:palette.rim});

  const darkMaterial=dustSurface(tracker,0x170b12,.86,{
    colorB:0x5b2a32,scale:.42,phase:.7,filaments:.34,
  });
  for(const [laneIndex,lane] of (structure.dustLanes || []).entries()){
    const widths=lane.width || [2.5,5.2];
    const rimMaterial=emissiveSurface(tracker,lane.edgeColor || palette.rim,
      palette.emission,Math.max(.18,(lane.edgeGlow || .15)*1.5),{
        rim:1.7,filaments:.48,scale:.53,phase:laneIndex+1,
      });
    addContinuousMesh(root,jaggedRibbonGeometry(lane.points,{
      width:[numeric(widths[0],2.5)*1.22,numeric(widths[1],5.2)*1.18],
      depth:[3.2,5.6],segments:quality.high?62:34,
      irregularity:.22,phase:laneIndex+1,
    }),rimMaterial,`trifid-photodissociation-rim:${lane.id}`,tracker,{renderOrder:4});
    addContinuousMesh(root,jaggedRibbonGeometry(lane.points,{
      width:[numeric(widths[0],2.5),numeric(widths[1],5.2)],
      depth:[2.7,5.0],segments:quality.high?62:34,
      irregularity:.28,phase:laneIndex+1.7,
    }),darkMaterial,`trifid-occluding-dust-lane:${lane.id}`,tracker,{renderOrder:8});
  }
  root.userData.dustLanes='continuous-foreground-molecular-solids';
  root.userData.photodissociationRims='continuous-lane-edge-emission';

  for (const feature of structure.photoevaporationFeatures || []){
    const center = vector(feature.center), tail = vector(feature.tailToward);
    const scale = feature.scale || [2, 4, 3];
    addContinuousMesh(root,organicEllipsoidGeometry({radii:scale,
      longitude:quality.high?34:22,latitude:quality.high?20:14,
      irregularity:.14,phase:rnd()*TAU}),darkMaterial,
    `trifid-eroding-head:${feature.id}`,tracker,{position:center});
    addContinuousMesh(root,jaggedRibbonGeometry([tail,center],{
      width:[scale[0]*.82,scale[0]*.34],depth:[scale[2]*.72,scale[2]*.28],
      segments:quality.high?28:18,irregularity:.22,phase:rnd()*TAU,
    }),darkMaterial,`trifid-photoevaporating-tail:${feature.id}`,tracker);
  }

  const jet = structure.hh399Jet;
  if (jet){
    const origin=vector(jet.origin),direction=vector(jet.direction).normalize();
    for(const [sign,length] of [[1,jet.length],[-1,jet.counterLength]]){
      const end=origin.clone().addScaledVector(direction,numeric(length,2)*sign);
      addContinuousMesh(root,sweptFilamentGeometry([origin,end],{
        radius:[numeric(jet.radius,.13)*1.35,.035],depthRatio:.7,
        segments:quality.high?26:16,radialSegments:6,irregularity:.08,phase:sign,
      }),emissiveSurface(tracker,jet.color || palette.rim,palette.highlight,.24,{
        rim:1.8,filaments:.42,scale:.62,phase:sign,
      }),`trifid-hh399-jet:${sign}`,tracker);
    }
    root.userData.hh399Jet='continuous-bipolar-outflow';
  }

  const stars = structure.starAnchors || [];
  for(const star of stars){
    const mesh=addSculptedStar(root,tracker,{position:star.position,
      size:Math.max(.22,(star.size || 2)*.13),color:star.color,
      name:'trifid-embedded-colored-star',scientificSource:true});
    mesh.userData.starId=star.id || null;
  }
  root.userData.heroSurfaceMode='continuous-volumetric-trilobe';
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
