/* Crisp, profile-driven sculpture for Orion, Horsehead, Ring, Helix, and
   Lagoon. The observation plate remains authoritative head-on; these meshes
   supply narrow ridges, shells, knots, and opaque dust only as depth reveals.
   Deliberately no sprites or broad point-cloud materials live here. */

import * as THREE from 'three';
import { gaussian, hashStr, mulberry } from '../../utils/rng.js';

const DISPLAY_HEIGHT = 62;
const TAU = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }

function number(value, fallback){
  return Number.isFinite(value) ? value : fallback;
}

function color(profile, role, fallback = 0x8bc4d4){
  const raw = profile.palette && profile.palette[role];
  try{ return new THREE.Color(raw == null ? fallback : raw); }
  catch(_error){ return new THREE.Color(fallback); }
}

function reconstruction(profile){
  return profile.reconstruction || {};
}

function feature(profile, id){
  const features = reconstruction(profile).features || [];
  return features.find(item => item && item.id === id) || null;
}

function detailScale(budget){
  return number(budget && budget.familyPoints, 5000) >= 4000 ? 1 : 0.42;
}

function worldFromUv(profile, uv, z = 0){
  const aspect = number(reconstruction(profile).plateAspect, 1);
  return new THREE.Vector3(
    (number(uv && uv[0], .5)-.5)*DISPLAY_HEIGHT*aspect,
    (.5-number(uv && uv[1], .5))*DISPLAY_HEIGHT,
    number(z, 0));
}

function makeMaterial(profile, role, opacity, tracker, options = {}){
  const baseOpacity = clamp(number(opacity, .7), 0, 1);
  const dust = options.dust || role === 'dust';
  const normal = options.normal || dust;
  const material = tracker.material(new THREE.MeshBasicMaterial({
    color: color(profile, role, dust ? 0x100a10 : 0x8bc4d4),
    transparent: true,
    opacity: baseOpacity,
    blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: dust,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  }));
  if(normal && !dust) material.color.multiplyScalar(.62);
  material.userData.baseOpacity = baseOpacity;
  return material;
}

function addSilhouette(root, profile, item, material, tracker){
  if (!item || !Array.isArray(item.polygon) || item.polygon.length < 3) return null;
  const points = item.polygon.map(uv => worldFromUv(profile,uv,0));
  const depth = Math.max(.3,number(item.thickness,4));
  const layerCount=6;
  const center=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3())
    .multiplyScalar(1/points.length);
  const taper=clamp(number(item.extrusionTaper,.42),.18,.7);
  const positions=[];
  const indices=[];
  for(let layer=0;layer<layerCount;layer++){
    const t=layer/(layerCount-1);
    const scale=1-taper*(1-t);
    const bendX=Math.sin(t*Math.PI*1.3)*depth*.055;
    const bendY=Math.sin(t*Math.PI*1.8+.6)*depth*.032;
    for(let i=0;i<points.length;i++){
      const point=points[i];
      const edgeRipple=Math.sin(i*2.17+t*4.6)*depth*.018*(1-t*.55);
      positions.push(
        center.x+(point.x-center.x)*scale+bendX+edgeRipple,
        center.y+(point.y-center.y)*scale+bendY+edgeRipple*.42,
        number(item.z,0)-depth*.5+t*depth,
      );
    }
  }
  const count=points.length;
  for(let layer=0;layer<layerCount-1;layer++){
    for(let i=0;i<count;i++){
      const next=(i+1)%count;
      const a=layer*count+i,b=layer*count+next;
      const c=(layer+1)*count+i,d=(layer+1)*count+next;
      indices.push(a,b,c,b,d,c);
    }
  }
  const faces=THREE.ShapeUtils.triangulateShape(
    points.map(point=>new THREE.Vector2(point.x,point.y)),[]);
  const frontOffset=(layerCount-1)*count;
  for(const face of faces){
    indices.push(face[2],face[1],face[0]);
    indices.push(frontOffset+face[0],frontOffset+face[1],frontOffset+face[2]);
  }
  const geometry=tracker.geometry(new THREE.BufferGeometry());
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = item.id || 'sculpted-dust-silhouette';
  root.add(mesh);
  return mesh;
}

function randomPointInRegion(profile, polygon, rnd, z = 0){
  const points = (polygon || []).map(uv => worldFromUv(profile,uv,z));
  if (points.length < 3) return new THREE.Vector3(0,0,z);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (const p of points){ minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x);
    minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); }
  for (let attempt=0; attempt<40; attempt++){
    const x=THREE.MathUtils.lerp(minX,maxX,rnd()), y=THREE.MathUtils.lerp(minY,maxY,rnd());
    let inside=false;
    for (let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i], b=points[j];
      if (((a.y>y)!==(b.y>y)) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y+1e-9)+a.x)
        inside=!inside;
    }
    if (inside) return new THREE.Vector3(x,y,z);
  }
  return points[0].clone();
}

function addInstancedHeadsAndTails(root, profile, item, tracker, rnd, budget,
  options = {}){
  const scale = detailScale(budget);
  const cap = options.cap || (scale === 1 ? 760 : 240);
  const count = Math.max(1,Math.min(Math.round(number(item.count,40)*scale),cap));
  const headGeometry = tracker.geometry(new THREE.IcosahedronGeometry(1,1));
  const tailGeometry = tracker.geometry(new THREE.ConeGeometry(1,1,5,1,true));
  const headMaterial = makeMaterial(profile,options.headRole || item.headColorRole ||
    item.colorRole || 'dust',number(item.opacity,.9),tracker,{dust:options.dust !== false});
  const tailMaterial = makeMaterial(profile,options.tailRole || item.tailColorRole ||
    item.colorRole || 'dust',number(item.opacity,.9)*.62,tracker,{dust:options.dust !== false});
  const heads = new THREE.InstancedMesh(headGeometry,headMaterial,count);
  const tails = new THREE.InstancedMesh(tailGeometry,tailMaterial,count);
  heads.name = `${item.id || 'knots'}-heads`;
  tails.name = `${item.id || 'knots'}-tails`;
  const dummy = new THREE.Object3D();
  const center = worldFromUv(profile,item.centerUv || [.5,.5],0);
  const radiusUv = item.radiusUv || [.1,.3];
  const radiusMin = number(Array.isArray(radiusUv)?radiusUv[0]:radiusUv,.1)*DISPLAY_HEIGHT;
  const radiusMax = number(Array.isArray(radiusUv)?radiusUv[1]:radiusUv,.3)*DISPLAY_HEIGHT;
  const headRange = item.headRadiusUv || item.radiusUv || [.0015,.004];
  const headMin = number(Array.isArray(headRange)?headRange[0]:headRange,.0015)*DISPLAY_HEIGHT;
  const headMax = number(Array.isArray(headRange)?headRange[1]:headRange,.004)*DISPLAY_HEIGHT;
  const tailRange = item.tailLengthUv || item.lengthUv || [.008,.03];
  const tailMin = number(Array.isArray(tailRange)?tailRange[0]:tailRange,.008)*DISPLAY_HEIGHT;
  const tailMax = number(Array.isArray(tailRange)?tailRange[1]:tailRange,.03)*DISPLAY_HEIGHT;
  const zRange = Array.isArray(item.z)?item.z:[number(item.z,2),number(item.z,2)];
  for (let i=0;i<count;i++){
    let position, direction;
    if (item.region){
      position=randomPointInRegion(profile,item.region,rnd,THREE.MathUtils.lerp(zRange[0],zRange[1],rnd()));
      const facing=item.facingUv || item.tailDirectionUv || [0,-1];
      direction=new THREE.Vector3(number(facing[0],0),-number(facing[1],-1),0).normalize();
    } else {
      const a=rnd()*TAU;
      const radius=THREE.MathUtils.lerp(radiusMin,radiusMax,rnd());
      position=center.clone().add(new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,
        THREE.MathUtils.lerp(zRange[0],zRange[1],rnd())));
      direction=position.clone().sub(center); direction.z*=.25; direction.normalize();
    }
    const head=THREE.MathUtils.lerp(headMin,headMax,Math.pow(rnd(),2));
    dummy.position.copy(position); dummy.quaternion.identity(); dummy.scale.setScalar(head);
    dummy.updateMatrix(); heads.setMatrixAt(i,dummy.matrix);
    const length=THREE.MathUtils.lerp(tailMin,tailMax,rnd());
    dummy.position.copy(position).addScaledVector(direction,length*.5);
    dummy.quaternion.setFromUnitVectors(Y_AXIS,direction);
    dummy.scale.set(head*.42,length,head*.42);
    dummy.updateMatrix(); tails.setMatrixAt(i,dummy.matrix);
  }
  heads.instanceMatrix.needsUpdate=true; tails.instanceMatrix.needsUpdate=true;
  heads.computeBoundingSphere(); tails.computeBoundingSphere();
  root.add(heads,tails);
  return {heads,tails};
}

function addInstancedSegments(root,segments,material,tracker,name,{tapered=false}={}){
  if(!segments.length) return null;
  const geometry=tracker.geometry(tapered
    ? new THREE.ConeGeometry(1,1,5,1,true)
    : new THREE.CylinderGeometry(1,1,1,4,1,true));
  const instances=new THREE.InstancedMesh(geometry,material,segments.length);
  instances.name=name;
  const dummy=new THREE.Object3D();
  const direction=new THREE.Vector3();
  for(let i=0;i<segments.length;i++){
    const segment=segments[i];
    direction.copy(segment.end).sub(segment.start);
    const length=Math.max(.001,direction.length());
    direction.multiplyScalar(1/length);
    dummy.position.copy(segment.start).add(segment.end).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(Y_AXIS,direction);
    dummy.scale.set(number(segment.radius,.04),length,number(segment.radius,.04));
    dummy.updateMatrix();
    instances.setMatrixAt(i,dummy.matrix);
  }
  instances.instanceMatrix.needsUpdate=true;
  instances.computeBoundingSphere();
  root.add(instances);
  return instances;
}

function addIonizingSources(root,profile,tracker){
  const sources=(profile.sources || []).filter(source => source &&
    !(source.label || '').includes('OFF-FRAME'));
  if(!sources.length) return;
  const geometry=tracker.geometry(new THREE.SphereGeometry(1,12,8));
  for(const source of sources){
    const opacity=number(source.opacity,.94);
    const material=tracker.material(new THREE.MeshBasicMaterial({
      color:source.color == null?0xe8f5ff:source.color,
      transparent:true,opacity,blending:THREE.AdditiveBlending,
      depthWrite:false,depthTest:true,toneMapped:false,
    }));
    material.userData.baseOpacity=opacity;
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name='authored-ionizing-source-sphere';
    if(Array.isArray(source.photoUv)) mesh.position.copy(worldFromUv(profile,source.photoUv,
      Array.isArray(source.position)?number(source.position[2],0):0));
    else mesh.position.fromArray(source.position || [0,0,0]);
    mesh.scale.setScalar(Math.max(.22,number(source.size,3.5)*.13));
    mesh.userData.sourceLabel=source.label || null;
    mesh.userData.scientificSource=true;
    root.add(mesh);
  }
}

function addRadialFilaments(root,profile,item,material,tracker,rnd,budget){
  const scale=detailScale(budget);
  const count=Math.max(8,Math.round(number(item.count,64)*scale));
  const center=worldFromUv(profile,item.centerUv || [.5,.5],0);
  const range=item.radiusUv || [.2,.35];
  const minR=number(range[0],.2)*DISPLAY_HEIGHT,maxR=number(range[1],.35)*DISPLAY_HEIGHT;
  const width=item.widthUv || [.0005,.0015];
  const segments=[];
  for(let i=0;i<count;i++){
    const a=(i+rnd()*.42)/count*TAU;
    const start=minR*(.94+rnd()*.1),end=THREE.MathUtils.lerp(start,maxR,rnd());
    const z=Array.isArray(item.z)?THREE.MathUtils.lerp(item.z[0],item.z[1],rnd()):number(item.z,0);
    const radius=THREE.MathUtils.lerp(number(width[0],.0005),
      number(width[1],.0015),rnd())*DISPLAY_HEIGHT*.5;
    const midR=THREE.MathUtils.lerp(start,end,.48);
    const midAngle=a+.016;
    const startPoint=center.clone().add(new THREE.Vector3(Math.cos(a)*start,Math.sin(a)*start,z));
    const midPoint=center.clone().add(new THREE.Vector3(
      Math.cos(midAngle)*midR,Math.sin(midAngle)*midR,z+.65));
    const endPoint=center.clone().add(new THREE.Vector3(Math.cos(a)*end,Math.sin(a)*end,z));
    segments.push({start:startPoint,end:midPoint,radius},{start:midPoint,end:endPoint,radius:radius*.72});
  }
  return addInstancedSegments(root,segments,material,tracker,
    `${item.id || 'radial-filament'}-instanced`,{tapered:true});
}

function buildOrion(root,profile,budget,tracker,rnd){
  const bright=feature(profile,'orion-bright-bar');
  if(bright) root.userData.brightBar='source-depth-relief';
  // The registered relief already carries the Dark Bay silhouette. Duplicating
  // it as one extruded polygon produced a detached slab at edge-on angles.
  const m43=feature(profile,'m43-ionization-bubble');
  if(m43) root.userData.m43Bubble='source-depth-relief';
  const lip=feature(profile,'orion-southeast-cavity-lip');
  if(lip) root.userData.southeastCavityLip='source-depth-relief';
  const proplyds=feature(profile,'trapezium-proplyds');
  addInstancedHeadsAndTails(root,profile,proplyds,tracker,rnd,budget,{cap:40,dust:true,
    headRole:'accent',tailRole:'inner'});
  const bows=feature(profile,'ll-ori-like-bow-shocks');
  if(bows) root.userData.bowShocks='source-depth-relief';
  const wisps=feature(profile,'southwest-outflow-wisps');
  if(wisps) root.userData.southwestOutflow='source-depth-relief';
}

function buildHorsehead(root,profile,budget,tracker,rnd){
  const body=feature(profile,'barnard33-body');
  addSilhouette(root,profile,body,makeMaterial(profile,'dust',1,tracker,{dust:true}),tracker);
  const skin=feature(profile,'horsehead-pdr-skin');
  if(skin) root.userData.pdrSkin='source-depth-relief';
  // Mane scallops are already resolved by the registered relief; a second
  // bundle of glowing tubes turned the silhouette into a wire outline.
  const front=feature(profile,'cloud-bed-ionization-front');
  if(front) root.userData.cloudBedFront='source-depth-relief';
  const neck=feature(profile,'neck-filament');
  if(neck) root.userData.neckFilament='source-depth-relief';
  const striations=feature(profile,'photoevaporative-striations');
  if(striations) root.userData.photoevaporativeStriations='source-depth-relief';
  const ngc=feature(profile,'ngc2023-blue-rim');
  if(ngc) root.userData.ngc2023BlueRim='source-depth-relief';
}

function buildRing(root,profile,budget,tracker,rnd,double=false){
  const ring=feature(profile,double?'main-outer-torus':'main-thick-torus');
  // The source/depth relief already supplies the thick, azimuthally broken
  // ring with its real colours. A complete TorusGeometry made both nebulae
  // read as smooth plastic donuts from orbit, so it is intentionally absent.
  if (ring) root.userData[double?'helixMainRing':'ringMainRing']='source-depth-relief';
  const layers=feature(profile,double?'thermal-ionization-rims':'ionization-stratification');
  // Closed ionization-loop geometry still read as wireframe when viewed on
  // edge. The registered colour relief carries those zones without adding
  // synthetic outlines.
  if(layers) root.userData.ionizationZones='source-depth-relief';
  const knots=feature(profile,double?'cometary-knot-forest':'inner-rim-knot-heads');
  if(knots) addInstancedHeadsAndTails(root,profile,knots,tracker,rnd,budget,{dust:true});
  const radial=feature(profile,double?'radial-knot-tails':'knot-shadow-spokes');
  if(radial) addRadialFilaments(root,profile,radial,
    makeMaterial(profile,double?'outer':'dust',radial.opacity,tracker,{dust:!double}),
    tracker,rnd,budget);
  const arcs=feature(profile,double?'outermost-collision-arc':'outer-halo-scallops');
  if(arcs) root.userData.outerHaloArcs='source-depth-relief';
  if(double){
    const disk=feature(profile,'inner-ionized-disk');
    if(disk) root.userData.innerIonizedDisk='source-depth-relief';
    const plumes=feature(profile,'polar-low-density-plumes');
    if(plumes) root.userData.polarPlumes='source-depth-relief';
  }else{
    // The registered relief already bends the blue interior into the accepted
    // line-of-sight lobes. A second closed ellipsoid read as a cyan soap bubble.
    root.userData.ringBipolarLobes='source-depth-relief';
  }
}

function buildLagoon(root,profile,budget,tracker,rnd){
  const cavity=feature(profile,'herschel36-wind-cavity');
  if(cavity) root.userData.windCavity='source-depth-relief';
  const hourglass=feature(profile,'compact-hourglass');
  if(hourglass) root.userData.compactHourglass='source-depth-relief';
  // Broad dust lanes are already reconstructed from the aligned depth map.
  // Re-extruding them here created detached rectangular slabs edge-on.
  const twist=feature(profile,'paired-interstellar-twisters');
  if(twist) root.userData.interstellarTwisters='source-depth-relief';
  const curtains=feature(profile,'wind-pushed-curtains');
  if(curtains) root.userData.windCurtains='source-depth-relief';
  const pillars=feature(profile,'elephant-trunk-field');
  if(pillars) addInstancedHeadsAndTails(root,profile,{...pillars,tailLengthUv:pillars.lengthUv,
    headRadiusUv:pillars.widthUv,tailDirectionUv:pillars.facingUv},tracker,rnd,budget,
  {cap:28,dust:true,headRole:'dust',tailRole:'dust'});
  const globules=feature(profile,'bok-globules');
  if(globules) addInstancedHeadsAndTails(root,profile,{...globules,tailLengthUv:[.001,.004],
    headRadiusUv:globules.radiusUv,tailDirectionUv:[0,-1]},tracker,rnd,budget,
  {cap:80,dust:true,headRole:'dust',tailRole:'dust'});
  const arcs=feature(profile,'cavity-ionization-rims');
  if(arcs) root.userData.cavityIonizationRims='source-depth-relief';
}

export function buildNebulaSculptA({root,profile,budget,tracker,seed}){
  if (!root || !profile || !tracker) return false;
  const rnd=mulberry(hashStr(`${seed || 'nebula'}:crisp-sculpt-a`));
  switch(profile.family){
    case 'open-bowl': buildOrion(root,profile,budget,tracker,rnd); break;
    case 'edge-ridge': buildHorsehead(root,profile,budget,tracker,rnd); break;
    case 'planetary-ring': buildRing(root,profile,budget,tracker,rnd,false); break;
    case 'double-ring': buildRing(root,profile,budget,tracker,rnd,true); break;
    case 'star-cavity': buildLagoon(root,profile,budget,tracker,rnd); break;
    default: return false;
  }
  addIonizingSources(root,profile,tracker);
  root.userData.crispSculpture='profile-a';
  root.userData.genericClouds=false;
  return true;
}
