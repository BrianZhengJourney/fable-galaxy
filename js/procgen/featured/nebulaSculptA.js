/* Model-first sculptures for Orion, Horsehead, Ring, Helix, and Lagoon.
   Source photographs remain an explicit head-on evidence mode in the shared
   renderer. The hero view is built from continuous indexed gas shells,
   occluding dust solids, real front/back depth, and embedded colored stars. */

import * as THREE from 'three';
import { gaussian, hashStr, mulberry } from '../../utils/rng.js';
import {
  TAU, UP, addInstancedKnots, addStar, addTrackedMesh, arcPoints,
  bowlGeometry, color, corrugatedSheetGeometry, eulerDegrees,
  makeBasicMaterial, makeNebulaMaterial, numeric, organicEllipsoidGeometry,
  organicRingGeometry, qualityFromBudget, sweptFilamentGeometry, vector,
  jaggedRibbonGeometry,
} from './nebulaSculptPrimitives.js';

const DISPLAY_HEIGHT = 62;

function reconstruction(profile){ return profile.reconstruction || {}; }

function feature(profile,id){
  return (reconstruction(profile).features || [])
    .find(item => item && item.id === id) || null;
}

function profileColor(profile,role,fallback){
  return color(profile.palette && profile.palette[role],fallback);
}

function worldFromUv(profile,uv,z=0){
  const aspect=numeric(reconstruction(profile).plateAspect,1);
  return new THREE.Vector3(
    (numeric(uv && uv[0],.5)-.5)*DISPLAY_HEIGHT*aspect,
    (.5-numeric(uv && uv[1],.5))*DISPLAY_HEIGHT,
    numeric(z,0));
}

function surface(root,tracker,geometry,material,name,transform={}){
  const mesh=addTrackedMesh(root,geometry,material,tracker,name);
  if(transform.position) mesh.position.copy(vector(transform.position));
  if(transform.rotationDeg) mesh.rotation.copy(eulerDegrees(transform.rotationDeg));
  if(transform.scale) mesh.scale.copy(vector(transform.scale,[1,1,1]));
  if(Number.isFinite(transform.renderOrder)) mesh.renderOrder=transform.renderOrder;
  return mesh;
}

function gasMaterial(profile,tracker,roleA,roleB,opacity,options={}){
  return makeNebulaMaterial(tracker,{
    colorA:profileColor(profile,roleA,0x5fc7d7),
    colorB:profileColor(profile,roleB,0xef6d68),
    opacity,rim:options.rim,filaments:options.filaments,
    scale:options.scale,phase:options.phase,erosion:options.erosion,
    bounds:options.bounds,edgeFeather:options.edgeFeather,
  });
}

function dustMaterial(profile,tracker,opacity=.96,options={}){
  return makeNebulaMaterial(tracker,{
    colorA:profileColor(profile,'dust',0x100810),
    colorB:options.colorB || profileColor(profile,'dust',0x26141d)
      .multiplyScalar(1.42),
    opacity,dust:true,depthWrite:true,scale:options.scale || .28,
    phase:options.phase || 0,filaments:options.filaments || .15,
  });
}

function addEllipsoid(root,profile,tracker,quality,options){
  const material=options.material || gasMaterial(profile,tracker,
    options.roleA || 'inner',options.roleB || 'outer',options.opacity || .42,options);
  return surface(root,tracker,organicEllipsoidGeometry({
    radii:options.radii,longitude:quality.longitude,latitude:quality.latitude,
    irregularity:numeric(options.irregularity,.055),phase:numeric(options.phase,0),
    openPolar:numeric(options.openPolar,0),
  }),material,options.name,options);
}

function addRing(root,profile,tracker,quality,options){
  const material=options.material || gasMaterial(profile,tracker,
    options.roleA || 'inner',options.roleB || 'outer',options.opacity || .42,options);
  return surface(root,tracker,organicRingGeometry({
    major:options.major,tube:options.tube,majorSegments:quality.ring,
    tubeSegments:quality.crossSection,irregularity:numeric(options.irregularity,.065),
    phase:numeric(options.phase,0),
  }),material,options.name,options);
}

function addUvFilament(root,profile,tracker,item,options={}){
  if(!item || !Array.isArray(item.path) || item.path.length<2) return null;
  const z=numeric(options.z,item.z);
  const points=item.path.map((uv,index)=>worldFromUv(profile,uv,
    z+Math.sin(index*1.7+numeric(options.phase,0))*numeric(options.depthWave,.7)));
  const widthUv=Array.isArray(item.widthUv)
    ? numeric(item.widthUv[0],.004) : numeric(item.widthUv,.004);
  const radius=options.radius || Math.max(.12,widthUv*DISPLAY_HEIGHT*.62);
  const material=options.material || gasMaterial(profile,tracker,
    options.role || item.colorRole || 'accent',options.roleB || 'inner',
    numeric(options.opacity,item.opacity || .7),options);
  return surface(root,tracker,sweptFilamentGeometry(points,{
    radius:options.radiusRange || [radius,radius*numeric(item.taper,.72)],
    depthRatio:numeric(options.depthRatio,.75),segments:numeric(options.segments,44),
    radialSegments:numeric(options.radialSegments,8),irregularity:.11,
    phase:numeric(options.phase,0),
  }),material,options.name || item.id,{});
}

function pointInsidePolygon(point,polygon){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if(((a.y>point.y)!==(b.y>point.y)) &&
      point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y+1e-9)+a.x) inside=!inside;
  }
  return inside;
}

function randomUvInRegion(item,rnd){
  const polygon=(item.region || []).map(uv=>new THREE.Vector2(uv[0],uv[1]));
  if(polygon.length<3) return new THREE.Vector2(.5,.5);
  let minX=1,maxX=0,minY=1,maxY=0;
  for(const point of polygon){
    minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);
    minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
  }
  for(let attempt=0;attempt<48;attempt++){
    const point=new THREE.Vector2(
      THREE.MathUtils.lerp(minX,maxX,rnd()),
      THREE.MathUtils.lerp(minY,maxY,rnd()));
    if(pointInsidePolygon(point,polygon)) return point;
  }
  return polygon[0].clone();
}

function addHeadsAndTails(root,profile,item,tracker,rnd,quality,options={}){
  if(!item) return null;
  const cap=numeric(options.cap,quality.high?620:230);
  const count=Math.max(1,Math.min(cap,Math.round(numeric(item.count,32)*quality.countScale)));
  const center=worldFromUv(profile,item.centerUv || [.5,.5],0);
  const radiusUv=item.radiusUv || [.1,.3];
  const radiusMin=numeric(Array.isArray(radiusUv)?radiusUv[0]:radiusUv,.1)*DISPLAY_HEIGHT;
  const radiusMax=numeric(Array.isArray(radiusUv)?radiusUv[1]:radiusUv,.3)*DISPLAY_HEIGHT;
  const headRange=item.headRadiusUv || item.widthUv || item.radiusUv || [.0015,.004];
  const headMin=numeric(Array.isArray(headRange)?headRange[0]:headRange,.0015)*DISPLAY_HEIGHT;
  const headMax=numeric(Array.isArray(headRange)?headRange[1]:headRange,.004)*DISPLAY_HEIGHT;
  const tailRange=item.tailLengthUv || item.lengthUv || [.008,.03];
  const tailMin=numeric(Array.isArray(tailRange)?tailRange[0]:tailRange,.008)*DISPLAY_HEIGHT;
  const tailMax=numeric(Array.isArray(tailRange)?tailRange[1]:tailRange,.03)*DISPLAY_HEIGHT;
  const zRange=Array.isArray(item.z)?item.z:[numeric(item.z,2),numeric(item.z,2)];
  const heads=[],tails=[];
  for(let i=0;i<count;i++){
    let position,direction;
    if(item.region){
      const uv=randomUvInRegion(item,rnd);
      position=worldFromUv(profile,[uv.x,uv.y],
        THREE.MathUtils.lerp(numeric(zRange[0],0),numeric(zRange[1],0),rnd()));
      const facing=item.facingUv || item.tailDirectionUv || [0,-1];
      direction=new THREE.Vector3(numeric(facing[0],0),-numeric(facing[1],-1),
        numeric(options.directionZ,.14)).normalize();
    }else{
      const angle=rnd()*TAU;
      const radius=THREE.MathUtils.lerp(radiusMin,radiusMax,rnd());
      position=center.clone().add(new THREE.Vector3(
        Math.cos(angle)*radius,Math.sin(angle)*radius,
        THREE.MathUtils.lerp(numeric(zRange[0],0),numeric(zRange[1],0),rnd())));
      direction=position.clone().sub(center);direction.z*=.22;direction.normalize();
    }
    const size=THREE.MathUtils.lerp(Math.max(.08,headMin),Math.max(headMin+.01,headMax),
      Math.pow(rnd(),2))*numeric(options.headScale,1);
    const length=THREE.MathUtils.lerp(tailMin,Math.max(tailMin+.01,tailMax),rnd())*
      numeric(options.tailScale,1);
    heads.push({position:position.toArray(),scale:[size,size*(.72+rnd()*.5),size],
      rotationDeg:[rnd()*180,rnd()*180,rnd()*180],
      color:profileColor(profile,options.headRole || item.headColorRole ||
        item.colorRole || 'accent',0xe4ad68)});
    if(options.tails !== false) tails.push({position,direction,length,radius:size*.34});
  }
  const dust=options.dust === true;
  const headMesh=addInstancedKnots(root,tracker,heads,{
    name:`${item.id || 'nebula'}-sculpted-heads`,opacity:numeric(item.opacity,.82),
    additive:!dust,color:profileColor(profile,options.headRole || 'accent',0xe4ad68),
  });
  if(!tails.length) return {heads:headMesh,tails:null};
  const geometry=tracker.geometry(new THREE.ConeGeometry(1,1,6,2,false));
  const material=dust
    ? makeBasicMaterial(tracker,profileColor(profile,options.tailRole || 'dust',0x12090e),
      numeric(item.opacity,.9)*.78,{depthWrite:true})
    : makeBasicMaterial(tracker,profileColor(profile,options.tailRole || 'outer',0xd05b71),
      numeric(item.opacity,.72)*.64,{additive:true,depthWrite:false});
  const tailMesh=tracker.instanced(
    new THREE.InstancedMesh(geometry,material,tails.length));
  tailMesh.name=`${item.id || 'nebula'}-volumetric-tails`;
  const dummy=new THREE.Object3D();
  tails.forEach((tail,index)=>{
    dummy.position.copy(tail.position).addScaledVector(tail.direction,tail.length*.5);
    dummy.quaternion.setFromUnitVectors(UP,tail.direction);
    dummy.scale.set(tail.radius,tail.length,tail.radius);
    dummy.updateMatrix();tailMesh.setMatrixAt(index,dummy.matrix);
  });
  tailMesh.instanceMatrix.needsUpdate=true;tailMesh.computeBoundingSphere();
  root.add(tailMesh);
  return {heads:headMesh,tails:tailMesh};
}

function addRadialFilaments(root,profile,item,tracker,rnd,quality,options={}){
  if(!item) return null;
  const count=Math.max(12,Math.round(numeric(item.count,72)*quality.countScale));
  const center=worldFromUv(profile,item.centerUv || [.5,.5],0);
  const range=item.radiusUv || [.2,.35];
  const min=numeric(range[0],.2)*DISPLAY_HEIGHT;
  const max=numeric(range[1],.35)*DISPLAY_HEIGHT;
  const geometry=tracker.geometry(new THREE.CylinderGeometry(1,1,1,5,1,true));
  const material=makeBasicMaterial(tracker,
    profileColor(profile,options.role || item.colorRole || 'outer',0xd15f55),
    numeric(options.opacity,numeric(item.opacity,.52)),
    {additive:options.dust !== true,depthWrite:false});
  const mesh=tracker.instanced(new THREE.InstancedMesh(geometry,material,count));
  mesh.name=`${item.id}-depth-filaments`;
  const dummy=new THREE.Object3D(),direction=new THREE.Vector3();
  for(let i=0;i<count;i++){
    const angle=(i+rnd()*.42)/count*TAU;
    const start=min*(.94+rnd()*.11);
    const end=options.short
      ? Math.min(max,start+THREE.MathUtils.lerp(.8,numeric(options.maxLength,3.2),rnd()))
      : THREE.MathUtils.lerp(start,max,rnd());
    const z=Array.isArray(item.z)
      ? THREE.MathUtils.lerp(numeric(item.z[0],0),numeric(item.z[1],0),rnd())
      : numeric(item.z,0);
    const a=center.clone().add(new THREE.Vector3(Math.cos(angle)*start,
      Math.sin(angle)*start,z+rnd()*1.6));
    const b=center.clone().add(new THREE.Vector3(Math.cos(angle+.012)*end,
      Math.sin(angle+.012)*end,z-rnd()*1.6));
    direction.copy(b).sub(a);const length=direction.length();direction.normalize();
    const width=item.widthUv || [.0005,.0015];
    const radius=THREE.MathUtils.lerp(numeric(width[0],.0005),numeric(width[1],.0015),rnd())
      *DISPLAY_HEIGHT*.5;
    dummy.position.copy(a).add(b).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(UP,direction);
    dummy.scale.set(radius,length,radius);dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
  return mesh;
}

function addAuthoredSources(root,profile,tracker){
  for(const source of profile.sources || []){
    if(!source || /OFF-FRAME/i.test(source.label || '')) continue;
    const position=Array.isArray(source.photoUv)
      ? worldFromUv(profile,source.photoUv,Array.isArray(source.position)
        ? numeric(source.position[2],0):0)
      : vector(source.position);
    const star=addStar(root,tracker,{
      position,size:Math.max(.32,numeric(source.size,3)*.14),
      color:source.color || 0xdff3ff,name:'authored-ionizing-source',scientificSource:true,
    });
    star.userData.sourceLabel=source.label || null;
  }
}

function extrudedPolygonGeometry(profile,item){
  const points=(item.polygon || []).map(uv=>worldFromUv(profile,uv,0));
  if(points.length<3) return new THREE.BufferGeometry();
  const depth=Math.max(.6,numeric(item.thickness,5));
  const layers=7,positions=[],indices=[];
  const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3())
    .multiplyScalar(1/points.length);
  for(let layer=0;layer<layers;layer++){
    const t=layer/(layers-1),scale=.72+t*.28;
    for(let i=0;i<points.length;i++){
      const p=points[i],ripple=Math.sin(i*2.3+t*5.1)*depth*.025;
      positions.push(center.x+(p.x-center.x)*scale+ripple,
        center.y+(p.y-center.y)*scale+ripple*.36,
        numeric(item.z,0)-depth*.5+t*depth+Math.sin(i+t*3)*depth*.025);
    }
  }
  const count=points.length;
  for(let layer=0;layer<layers-1;layer++) for(let i=0;i<count;i++){
    const next=(i+1)%count,a=layer*count+i,b=layer*count+next;
    const c=(layer+1)*count+i,d=(layer+1)*count+next;
    indices.push(a,b,c,b,d,c);
  }
  const flat=points.map(p=>new THREE.Vector2(p.x,p.y));
  for(const face of THREE.ShapeUtils.triangulateShape(flat,[])){
    indices.push(face[2],face[1],face[0]);
    const offset=(layers-1)*count;
    indices.push(offset+face[0],offset+face[1],offset+face[2]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

function buildOrion(root,profile,quality,tracker,rnd){
  const wall=surface(root,tracker,bowlGeometry({radii:[31,27],depth:18,inner:.16,
    radial:quality.latitude,angular:quality.ring,phase:.7,irregularity:.13}),
  gasMaterial(profile,tracker,'inner','outer',.43,{rim:1.48,filaments:1.08,
    scale:.31,phase:.8,erosion:.48}),
  'orion-continuous-ionization-bowl',{position:[0,0,-1],rotationDeg:[-5,4,-7]});
  wall.userData.scientificMorphology='foreground blister cavity wall';
  surface(root,tracker,bowlGeometry({radii:[25,22],depth:13,inner:.25,
    radial:quality.latitude,angular:quality.ring,phase:2.1,irregularity:.15}),
  gasMaterial(profile,tracker,'accent','outer',.18,{rim:1.7,filaments:1.08,
    scale:.42,phase:1.9,erosion:.81}),
  'orion-layered-emission-front',{position:[1,-1,1],rotationDeg:[-9,-5,4]});
  surface(root,tracker,bowlGeometry({radii:[18,16],depth:9,inner:.10,
    radial:quality.latitude,angular:quality.ring,phase:3.4,irregularity:.12}),
  makeNebulaMaterial(tracker,{colorA:0xff6586,colorB:0xffb05c,opacity:.31,
    rim:1.72,filaments:1.02,scale:.48,phase:3.4,erosion:.38}),
  'orion-trapezium-facing-warm-inner-glow',{
    position:worldFromUv(profile,[.48,.51],2),rotationDeg:[-11,7,-5]});
  surface(root,tracker,bowlGeometry({radii:[34,30],depth:20,inner:.34,
    radial:quality.latitude,angular:quality.ring,phase:4.7,irregularity:.15}),
  makeNebulaMaterial(tracker,{colorA:0x42c7d5,colorB:0x5b8fd4,opacity:.15,
    rim:1.58,filaments:.96,scale:.4,phase:4.7,erosion:.60}),
  'orion-cool-eroded-outer-cavity-wall',{position:[0,0,-3],rotationDeg:[-3,-6,-9]});
  surface(root,tracker,corrugatedSheetGeometry({width:65,height:55,depth:6,
    segmentsX:quality.ribbon,segmentsY:quality.latitude,phase:1.4}),
  gasMaterial(profile,tracker,'outer','inner',.11,{rim:.98,filaments:1.0,
    scale:.37,phase:2.6,erosion:.58,bounds:[32.5,27.5],edgeFeather:.28}),
  'orion-molecular-backwall-glow',{position:[0,0,-18],rotationDeg:[0,3,0]});

  const darkBay=feature(profile,'dark-bay-front');
  if(darkBay) surface(root,tracker,extrudedPolygonGeometry(profile,darkBay),
    dustMaterial(profile,tracker,.98,{phase:.4}),darkBay.id,{});
  addEllipsoid(root,profile,tracker,quality,{name:'orion-dark-bay-depth-core',
    radii:[7.6,7.1,5.4],position:worldFromUv(profile,[.22,.27],5),
    rotationDeg:[12,-18,-12],material:dustMaterial(profile,tracker,.86,{phase:1.2}),
    irregularity:.12,phase:1.2});
  const molecularRidge=[[-33,13,-11],[-23,18,-9],[-11,17,-7],[1,11,-8],[8,4,-10]];
  surface(root,tracker,sweptFilamentGeometry(molecularRidge,{radius:[6.2,2.8],
    depthRatio:.92,segments:quality.ribbon,radialSegments:quality.crossSection,
    irregularity:.18,phase:2.3}),dustMaterial(profile,tracker,.58,{
      colorB:0x59303b,phase:2.3,scale:.34,filaments:.28}),
  'orion-cold-molecular-back-ridge',{});

  const emissionKnots=[];
  for(let i=0;i<(quality.high?110:46);i++){
    const angle=rnd()*TAU,radius=THREE.MathUtils.lerp(9,29,Math.sqrt(rnd()));
    const normalized=radius/31;
    emissionKnots.push({position:[Math.cos(angle)*radius,
      Math.sin(angle)*radius*.86,-2-16*Math.pow(normalized,1.55)+gaussian(rnd)*1.5],
      scale:[.14+rnd()*.48,.12+rnd()*.62,.16+rnd()*.42],
      rotationDeg:[rnd()*180,rnd()*180,rnd()*180],
      color:[profile.palette.inner,profile.palette.outer,profile.palette.accent][i%3]});
  }
  addInstancedKnots(root,tracker,emissionKnots,{name:'orion-eroded-emission-knots',
    opacity:.46,additive:true,color:profile.palette.accent});

  const bright=feature(profile,'orion-bright-bar');
  addUvFilament(root,profile,tracker,bright,{name:'orion-bright-bar-volume',
    role:'accent',roleB:'outer',radius:.68,depthRatio:.62,opacity:.92,phase:.4});
  addUvFilament(root,profile,tracker,feature(profile,'orion-southeast-cavity-lip'),{
    name:'orion-southeast-cavity-rim',role:'outer',roleB:'accent',radius:.58,
    opacity:.62,phase:1.7,z:0});
  const m43=feature(profile,'m43-ionization-bubble');
  if(m43){
    const center=worldFromUv(profile,m43.centerUv,-3);
    addRing(root,profile,tracker,quality,{name:'orion-m43-ionization-shell',
      major:[6.1,5.6],tube:[.7,.7,1.3],position:center,
      rotationDeg:[12,-10,numeric(m43.axisTiltDeg,-8)],roleA:'inner',roleB:'outer',
      opacity:.32,irregularity:.1,phase:1.3,scale:.42,filaments:.7});
  }
  const wisps=feature(profile,'southwest-outflow-wisps');
  if(wisps) for(let i=0;i<(quality.high?12:6);i++){
    const offset=(i-(quality.high?5.5:2.5))*.18;
    addUvFilament(root,profile,tracker,{...wisps,path:wisps.path.map(uv=>[
      uv[0]+offset*.012+gaussian(rnd)*.002,uv[1]+offset*.008])},{
      name:`orion-outflow-wisp:${i}`,role:'inner',roleB:'accent',radius:.10+rnd()*.10,
      opacity:.26+rnd()*.14,depthWave:1.8,phase:i*.6,z:-1+i*.18,
    });
  }
  addHeadsAndTails(root,profile,feature(profile,'trapezium-proplyds'),tracker,rnd,quality,
    {cap:quality.high?34:16,dust:true,headRole:'accent',tailRole:'dust',directionZ:.24});
}

function buildHorsehead(root,profile,quality,tracker,rnd){
  surface(root,tracker,corrugatedSheetGeometry({width:65,height:56,depth:5.4,
    segmentsX:quality.ribbon,segmentsY:quality.latitude,phase:.9}),
  makeNebulaMaterial(tracker,{colorA:0xe84561,colorB:0x58c8d0,opacity:.42,
    rim:1.08,filaments:.92,scale:.36,phase:.2,erosion:.26,
    bounds:[32.5,28],edgeFeather:.26}),
  'horsehead-ic434-continuous-emission-sheet',{position:[0,2,-18],rotationDeg:[1,-3,0]});
  addEllipsoid(root,profile,tracker,quality,{name:'horsehead-l1630-parent-cloud',
    radii:[43,18,13],position:[0,-26,2],rotationDeg:[2,0,-2],
    material:dustMaterial(profile,tracker,.90,{phase:.9,scale:.3,colorB:0x57251f,
      filaments:.28}),
    irregularity:.13,phase:.9});

  const body=feature(profile,'barnard33-body');
  const dark=dustMaterial(profile,tracker,.95,{phase:1.7,scale:.46,
    colorB:0x6d382c,filaments:.36});
  if(body) surface(root,tracker,extrudedPolygonGeometry(profile,body),dark,
    'horsehead-barnard33-authored-silhouette',{});
  const volumes=[
    {name:'horsehead-neck-volume',uv:[.535,.60],z:8,r:[5.6,16.2,6.8],rot:[-4,12,-4],p:.7},
    {name:'horsehead-cranium-volume',uv:[.545,.34],z:8.4,r:[7.1,6.8,7.2],rot:[5,-12,-10],p:1.2},
    {name:'horsehead-muzzle-volume',uv:[.602,.345],z:8.8,r:[6.3,2.9,4.9],rot:[-7,10,-12],p:2.2},
    {name:'horsehead-jaw-volume',uv:[.575,.415],z:8.3,r:[4.4,4.8,5.2],rot:[8,-6,4],p:2.8},
    {name:'horsehead-mane-volume',uv:[.492,.43],z:7.2,r:[3.8,9.5,5.2],rot:[-12,8,-8],p:3.3},
  ];
  for(const item of volumes) addEllipsoid(root,profile,tracker,quality,{
    name:item.name,radii:item.r,position:worldFromUv(profile,item.uv,item.z),
    rotationDeg:item.rot,material:dark,irregularity:.14,phase:item.p});
  const earPoints=[worldFromUv(profile,[.515,.31],8.4),worldFromUv(profile,[.505,.22],9.2)];
  surface(root,tracker,sweptFilamentGeometry(earPoints,{radius:[2.2,.38],
    depthRatio:.85,segments:18,radialSegments:8,irregularity:.1,phase:.8}),
  dark,'horsehead-sculpted-ear',{});

  const dustClumps=[];
  const neckCenter=worldFromUv(profile,[.535,.59],8.8);
  const headCenter=worldFromUv(profile,[.55,.35],9.2);
  for(let i=0;i<(quality.high?118:48);i++){
    const neck=i%3!==0,angle=rnd()*TAU;
    const center=neck?neckCenter:headCenter;
    const rx=neck?5.1:7.1,ry=neck?15.2:6.3;
    const radial=.72+rnd()*.35;
    dustClumps.push({position:[center.x+Math.cos(angle)*rx*radial,
      center.y+Math.sin(angle)*ry*radial,center.z+gaussian(rnd)*(neck?2.6:3.5)],
      scale:[.16+rnd()*.58,.12+rnd()*.72,.15+rnd()*.52],
      rotationDeg:[rnd()*180,rnd()*180,rnd()*180],
      color:[0x9a5038,0x6c342b,0x3b1b1a,0xb86445][i%4]});
  }
  addInstancedKnots(root,tracker,dustClumps,{name:'horsehead-granular-mane-and-neck',
    opacity:.48,additive:false,color:0x6c342b});

  addUvFilament(root,profile,tracker,feature(profile,'horsehead-pdr-skin'),{
    name:'horsehead-luminous-pdr-skin',radius:.34,opacity:.98,depthRatio:.48,
    phase:.6,z:9.5,material:makeNebulaMaterial(tracker,{colorA:0xff9a72,
      colorB:0xff3164,opacity:.98,rim:1.95,filaments:.84,scale:.62,phase:.6})});
  addUvFilament(root,profile,tracker,feature(profile,'cloud-bed-ionization-front'),{
    name:'horsehead-cloud-bed-ionization-rim',radius:.44,opacity:.62,
    depthRatio:.55,phase:1.5,z:4.2,material:makeNebulaMaterial(tracker,{
      colorA:0xea5164,colorB:0xffaa78,opacity:.62,rim:1.5,filaments:.78,
      scale:.48,phase:1.5,erosion:.18})});
  const ngc=feature(profile,'ngc2023-blue-rim');
  if(ngc) addRing(root,profile,tracker,quality,{name:'horsehead-ngc2023-reflection-cavity',
    major:[6.5,7.2],tube:[.65,.7,1.2],position:worldFromUv(profile,ngc.centerUv,-3),
    rotationDeg:[13,-8,numeric(ngc.axisTiltDeg,-18)],roleA:'inner',roleB:'accent',
    opacity:.3,phase:1.1,irregularity:.1,filaments:.8,scale:.44});

  const striationMaterial=makeNebulaMaterial(tracker,{colorA:0xe94f67,
    colorB:0xffa06d,opacity:.12,rim:1.45,filaments:.52,scale:.72,
    phase:2.5,erosion:.28});
  const striationCount=quality.high?30:14;
  for(let i=0;i<striationCount;i++){
    const x=THREE.MathUtils.lerp(-28,28,rnd());
    const y=THREE.MathUtils.lerp(1,20,rnd());
    const z=-14+rnd()*3;
    const length=THREE.MathUtils.lerp(2.2,6.5,rnd());
    const bend=gaussian(rnd)*.7;
    const points=[new THREE.Vector3(x,y,z),
      new THREE.Vector3(x+bend,y+length*.52,z+.3+gaussian(rnd)*.25),
      new THREE.Vector3(x+bend*.35+gaussian(rnd)*.35,y+length,z+gaussian(rnd)*.5)];
    surface(root,tracker,sweptFilamentGeometry(points,{radius:[.085,.018],
      depthRatio:.55,segments:14,radialSegments:5,irregularity:.12,phase:i}),
    striationMaterial,`horsehead-curved-fading-striation:${i}`,{});
  }
}

function buildRingNebula(root,profile,quality,tracker,rnd,isHelix){
  const centerFeature=feature(profile,isHelix?'main-outer-torus':'main-thick-torus');
  const center=worldFromUv(profile,centerFeature && centerFeature.centerUv || [.5,.5],0);
  const mainRadius=isHelix?20.2:18.4;
  const mainTilt=isHelix?53:13;
  const mainMaterial=makeNebulaMaterial(tracker,{colorA:isHelix?0xd84a42:0xc93e48,
    colorB:isHelix?0xff8a43:0xe75d3e,opacity:isHelix?.39:.47,rim:1.5,
    filaments:1.02,scale:.31,phase:isHelix?2.1:.8,erosion:.26});
  const coolMaterial=makeNebulaMaterial(tracker,{colorA:isHelix?0x43d6b2:0x43cbd5,
    colorB:isHelix?0x45a9d9:0x5a89dc,opacity:.32,rim:1.72,
    filaments:.88,scale:.41,phase:3.2,erosion:.18});
  const outerMaterial=makeNebulaMaterial(tracker,{colorA:0xc93646,colorB:0xf27d43,
    opacity:.18,rim:1.45,filaments:1.12,scale:.48,phase:4.4,erosion:.56});
  addRing(root,profile,tracker,quality,{name:isHelix?'helix-main-knot-bearing-torus':'ring-main-thick-torus',
    major:[mainRadius,mainRadius*(isHelix?1.04:1.1)],tube:isHelix?[4.1,4.3,6.4]:[4.5,4.8,6.2],
    position:center,rotationDeg:[mainTilt,0,isHelix?7:-4],material:mainMaterial,
    phase:isHelix?2.1:.8,irregularity:isHelix?.11:.085});
  addRing(root,profile,tracker,quality,{name:isHelix?'helix-oxygen-inner-rim':'ring-oxygen-inner-rim',
    major:[mainRadius*.92,mainRadius*(isHelix?1.00:1.04)],tube:[2.2,2.5,4.2],
    position:center,rotationDeg:[mainTilt+2,-3,isHelix?4:-6],material:coolMaterial,
    phase:3.2,irregularity:.095});
  addRing(root,profile,tracker,quality,{name:isHelix?'helix-faint-outer-ejection':'ring-nitrogen-outer-rim',
    major:[mainRadius*1.18,mainRadius*1.2],tube:[1.7,1.9,3.2],position:center,
    rotationDeg:[mainTilt-3,4,isHelix?10:-2],material:outerMaterial,
    phase:4.4,irregularity:.14});

  if(isHelix){
    addRing(root,profile,tracker,quality,{name:'helix-second-inclined-ejection-ring',
      major:[25.2,24.2],tube:[2.2,2.5,3.7],position:center,
      rotationDeg:[23,18,-8],material:makeNebulaMaterial(tracker,{
        colorA:0xc8394c,colorB:0xf07b43,opacity:.17,rim:1.52,
        filaments:.94,scale:.38,phase:1.1,erosion:.42}),
      phase:1.1,irregularity:.14});
    addEllipsoid(root,profile,tracker,quality,{name:'helix-inner-ionized-disk-volume',
      radii:[15.2,15.8,10.5],position:center,rotationDeg:[23,0,-6],
      material:makeNebulaMaterial(tracker,{colorA:0x3ed6bc,colorB:0x3e96d5,
        opacity:.18,rim:1.72,filaments:.7,scale:.31,phase:2.4,erosion:.2}),
      phase:2.4,irregularity:.09,openPolar:.14});
  }else{
    addEllipsoid(root,profile,tracker,quality,{name:'ring-line-of-sight-football-shell',
      radii:[12.8,14.8,29],position:center,rotationDeg:[13,0,-5],
      material:makeNebulaMaterial(tracker,{colorA:0x3cced2,colorB:0x477ed0,
        opacity:.19,rim:1.7,filaments:.66,scale:.3,phase:1.8,erosion:.14}),
      phase:1.8,irregularity:.07,openPolar:.17});
    addEllipsoid(root,profile,tracker,quality,{name:'ring-faint-early-mass-loss-halo',
      radii:[28,29,16],position:center,rotationDeg:[5,-4,-4],roleA:'outer',roleB:'inner',
      opacity:.07,phase:5.2,irregularity:.11,rim:1.7,filaments:.75,scale:.35});
  }

  addHeadsAndTails(root,profile,feature(profile,isHelix?'cometary-knot-forest':'inner-rim-knot-heads'),
    tracker,rnd,quality,{cap:isHelix?(quality.high?620:230):(quality.high?430:180),
      dust:false,headRole:isHelix?'accent':'accent',tailRole:isHelix?'outer':'inner',
      headScale:isHelix?.72:.56,tailScale:isHelix?.46:.38});
  addRadialFilaments(root,profile,feature(profile,isHelix?'radial-knot-tails':'knot-shadow-spokes'),
    tracker,rnd,quality,{role:isHelix?'inner':'accent',dust:false,short:true,
      maxLength:isHelix?2.8:2.2,opacity:isHelix?.30:.24});

  const arcFeature=feature(profile,isHelix?'outermost-collision-arc':'outer-halo-scallops');
  if(arcFeature){
    const count=isHelix?8:10;
    for(let i=0;i<count;i++){
      const radius=THREE.MathUtils.lerp(
        numeric(arcFeature.radiusUv[0],.36),numeric(arcFeature.radiusUv[1],.44),rnd())*DISPLAY_HEIGHT;
      const points=arcPoints({center:center.toArray(),radius,axisRatio:numeric(arcFeature.axisRatio,1),
        startDeg:rnd()*360,arcDeg:THREE.MathUtils.lerp(14,isHelix?48:30,rnd()),segments:quality.ribbon/2,
        rotationDeg:[isHelix?18:8,isHelix?14:-5,-6],depthWave:1.2,phase:i});
      surface(root,tracker,sweptFilamentGeometry(points,{radius:[.18+rnd()*.2,.08],
        depthRatio:.6,segments:Math.max(16,quality.ribbon/2),radialSegments:6,phase:i}),
      gasMaterial(profile,tracker,'outer','accent',.16,{rim:1.6,filaments:.6,scale:.52,phase:i}),
      `${isHelix?'helix':'ring'}-broken-outer-arc:${i}`,{});
    }
  }
  if(isHelix){
    const plumeMaterial=gasMaterial(profile,tracker,'inner','outer',.12,{
      rim:1.6,filaments:.85,scale:.4,phase:.6});
    for(let i=0;i<(quality.high?18:9);i++){
      const angle=rnd()*TAU;
      const start=center.clone().add(new THREE.Vector3(Math.cos(angle)*4,Math.sin(angle)*4,-8));
      const sign=i%2?1:-1;
      const end=center.clone().add(new THREE.Vector3(Math.cos(angle)*8,Math.sin(angle)*8,sign*27));
      surface(root,tracker,sweptFilamentGeometry([start,end],{radius:[.22,.05],
        depthRatio:.7,segments:16,radialSegments:5,phase:i}),plumeMaterial,
      `helix-polar-plume:${i}`,{});
    }
  }
}

function buildLagoon(root,profile,quality,tracker,rnd){
  surface(root,tracker,corrugatedSheetGeometry({width:66,height:56,depth:7.5,
    segmentsX:quality.ribbon,segmentsY:quality.latitude,phase:2.1}),
  gasMaterial(profile,tracker,'outer','inner',.24,{rim:1.05,filaments:1.08,
    scale:.36,phase:1.4,erosion:.48,bounds:[33,28],edgeFeather:.28}),
  'lagoon-continuous-extended-hii-field',{position:[0,0,-15],rotationDeg:[2,-5,0]});
  addEllipsoid(root,profile,tracker,quality,{name:'lagoon-herschel36-wind-cavity-volume',
    radii:[18,15,14],position:worldFromUv(profile,[.49,.49],-2),
    rotationDeg:[-10,12,-22],roleA:'inner',roleB:'accent',opacity:.27,
    phase:.9,irregularity:.16,openPolar:.18,rim:1.72,filaments:.92,
    scale:.38,erosion:.68});
  addEllipsoid(root,profile,tracker,quality,{name:'lagoon-warm-cavity-wall',
    radii:[24,19,12],position:[-2,-1,-7],rotationDeg:[9,-6,11],
    roleA:'outer',roleB:'accent',opacity:.16,phase:2.8,irregularity:.18,
    openPolar:.24,rim:1.58,filaments:1.08,scale:.42,erosion:.76});

  const cavityKnots=[];
  for(let i=0;i<(quality.high?96:40);i++){
    const angle=rnd()*TAU,radius=THREE.MathUtils.lerp(10,25,Math.sqrt(rnd()));
    cavityKnots.push({position:[Math.cos(angle)*radius-2,
      Math.sin(angle)*radius*.78-1,-8+gaussian(rnd)*4.5],
      scale:[.12+rnd()*.52,.10+rnd()*.68,.14+rnd()*.48],
      rotationDeg:[rnd()*180,rnd()*180,rnd()*180],
      color:[0x5bc8d0,0xe25b76,0xf0a45c][i%3]});
  }
  addInstancedKnots(root,tracker,cavityKnots,{name:'lagoon-cavity-wall-emission-knots',
    opacity:.30,additive:true,color:0xe25b76});

  const lane=feature(profile,'lagoon-main-dust-lane');
  if(lane){
    const points=lane.path.map((uv,index)=>worldFromUv(profile,[
      uv[0]+Math.sin(index*2.1)*.008,uv[1]+Math.cos(index*1.7)*.007],
    7.2+Math.sin(index*1.35)*2.6));
    surface(root,tracker,jaggedRibbonGeometry(points,{width:[2.6,5.2],depth:[3.4,5.6],
      segments:quality.ribbon,irregularity:.20,phase:.7}),
    makeNebulaMaterial(tracker,{colorA:0xff9b62,colorB:0xe95770,opacity:.32,
      rim:1.65,filaments:.72,scale:.5,phase:.7,erosion:.18}),
    'lagoon-main-dust-river-warm-rim',{renderOrder:4});
    surface(root,tracker,jaggedRibbonGeometry(points,{width:[2.1,4.5],depth:[2.8,5.0],
      segments:quality.ribbon,irregularity:.24,phase:1.2}),
    dustMaterial(profile,tracker,.84,{phase:.7,scale:.38,colorB:0x6d3130,filaments:.34}),
    'lagoon-main-foreground-dust-river',{renderOrder:8});
  }
  const south=feature(profile,'southern-dust-ridge');
  if(south){
    const points=south.path.map((uv,index)=>worldFromUv(profile,uv,
      6.2+Math.cos(index*1.1)*1.7));
    surface(root,tracker,jaggedRibbonGeometry(points,{width:[1.8,3.6],depth:[2.5,4.0],
      segments:quality.ribbon,irregularity:.22,phase:2.2}),
    makeNebulaMaterial(tracker,{colorA:0xf29a5e,colorB:0xd74e6d,opacity:.27,
      rim:1.6,filaments:.68,scale:.52,phase:2.2}),
    'lagoon-southern-dust-ridge-warm-rim',{renderOrder:4});
    surface(root,tracker,jaggedRibbonGeometry(points,{width:[1.4,3.1],depth:[2.1,3.6],
      segments:quality.ribbon,irregularity:.25,phase:2.8}),
    dustMaterial(profile,tracker,.80,{phase:2.2,scale:.4,colorB:0x67302f,filaments:.34}),
    'lagoon-southern-sculpted-dust-ridge',{renderOrder:8});
  }

  const curtains=feature(profile,'wind-pushed-curtains');
  if(curtains) for(const [pathIndex,path] of curtains.paths.entries()){
    for(let i=0;i<(quality.high?7:3);i++){
      const shifted=path.map((uv,index)=>worldFromUv(profile,[
        uv[0]+gaussian(rnd)*.005,uv[1]+gaussian(rnd)*.004],
      -4+pathIndex*2+i*.7+Math.sin(index+i)*1.2));
      surface(root,tracker,sweptFilamentGeometry(shifted,{radius:[.32,.10],
        depthRatio:.55,segments:quality.ribbon/2,radialSegments:6,phase:i+pathIndex}),
      gasMaterial(profile,tracker,'outer','accent',.22,{rim:1.5,filaments:.78,
        scale:.46,phase:i+pathIndex}),`lagoon-wind-curtain:${pathIndex}:${i}`,{});
    }
  }

  const hourglass=feature(profile,'compact-hourglass');
  if(hourglass){
    const center=worldFromUv(profile,hourglass.centerUv,2.8);
    for(const sign of [-1,1]) addEllipsoid(root,profile,tracker,quality,{
      name:`lagoon-hourglass-lobe:${sign}`,radii:[3.2,6.4,4.8],
      position:center.clone().add(new THREE.Vector3(sign*2.5,sign*5.2,sign*1.5)),
      rotationDeg:[18,-8,-18],roleA:'accent',roleB:'inner',opacity:.32,
      phase:sign+2,irregularity:.08,openPolar:.24,rim:1.8,filaments:.72,scale:.52});
  }
  addHeadsAndTails(root,profile,feature(profile,'elephant-trunk-field'),tracker,rnd,quality,
    {cap:quality.high?19:9,dust:true,headRole:'dust',tailRole:'dust',directionZ:.2,
      headScale:.48,tailScale:.52});
  addHeadsAndTails(root,profile,feature(profile,'bok-globules'),tracker,rnd,quality,
    {cap:quality.high?58:24,dust:true,headRole:'dust',tailRole:'dust',
      headScale:.34,tails:false});

  const arcs=feature(profile,'cavity-ionization-rims');
  if(arcs) for(let i=0;i<(quality.high?16:7);i++){
    const radius=THREE.MathUtils.lerp(arcs.radiusUv[0],arcs.radiusUv[1],rnd())*DISPLAY_HEIGHT;
    const center=worldFromUv(profile,arcs.centerUv,-2+rnd()*5);
    const points=arcPoints({center:center.toArray(),radius,axisRatio:.82,startDeg:rnd()*360,
      arcDeg:THREE.MathUtils.lerp(12,42,rnd()),segments:22,rotationDeg:[12,-8,-22],
      depthWave:1.6,phase:i});
    surface(root,tracker,sweptFilamentGeometry(points,{radius:[.24,.08],depthRatio:.6,
      segments:22,radialSegments:6,phase:i}),gasMaterial(profile,tracker,'accent','inner',.25,
      {rim:1.7,filaments:.72,scale:.48,phase:i}),`lagoon-cavity-rim:${i}`,{});
  }
}

export function buildNebulaSculptA({root,profile,budget,tracker,seed}){
  if(!root || !profile || !tracker) return false;
  const quality=qualityFromBudget(budget);
  const rnd=mulberry(hashStr(`${seed || 'nebula'}:continuous-sculpt-a`));
  switch(profile.family){
    case 'open-bowl': buildOrion(root,profile,quality,tracker,rnd); break;
    case 'edge-ridge': buildHorsehead(root,profile,quality,tracker,rnd); break;
    case 'planetary-ring': buildRingNebula(root,profile,quality,tracker,rnd,false); break;
    case 'double-ring': buildRingNebula(root,profile,quality,tracker,rnd,true); break;
    case 'star-cavity': buildLagoon(root,profile,quality,tracker,rnd); break;
    default: return false;
  }
  addAuthoredSources(root,profile,tracker);
  root.userData.crispSculpture='continuous-volumetric-profile-a';
  root.userData.heroSurfaceMode='procedural-indexed-surfaces';
  root.userData.genericClouds=false;
  root.userData.photoFragments=false;
  return true;
}
