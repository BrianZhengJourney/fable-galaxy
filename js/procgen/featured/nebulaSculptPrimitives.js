/* Deterministic, texture-free primitives for model-first nebula exhibits.
   These are closed or continuous indexed surfaces rather than billboards,
   surfels, point clouds, or image-derived fragments. */

import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const UP = new THREE.Vector3(0, 1, 0);

export function numeric(value, fallback = 0){
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function vector(value, fallback = [0, 0, 0]){
  if(value && value.isVector3) return value.clone();
  if(value && !Array.isArray(value) &&
      Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))){
    return new THREE.Vector3(
      numeric(value.x,0),numeric(value.y,0),numeric(value.z,0));
  }
  const source = Array.isArray(value) ? value : fallback;
  return new THREE.Vector3(
    numeric(source[0], fallback[0] || 0),
    numeric(source[1], fallback[1] || 0),
    numeric(source[2], fallback[2] || 0));
}

export function color(value, fallback = 0xffffff){
  try{ return new THREE.Color(value == null ? fallback : value); }
  catch(_error){ return new THREE.Color(fallback); }
}

export function eulerDegrees(value){
  const source = Array.isArray(value) ? value : [0, 0, numeric(value, 0)];
  return new THREE.Euler(
    THREE.MathUtils.degToRad(numeric(source[0], 0)),
    THREE.MathUtils.degToRad(numeric(source[1], 0)),
    THREE.MathUtils.degToRad(numeric(source[2], 0)), 'XYZ');
}

export function qualityFromBudget(budget){
  const high = numeric(budget && budget.familyPoints, 0) >= 3000;
  return {
    high,
    longitude: high ? 64 : 36,
    latitude: high ? 34 : 20,
    ring: high ? 96 : 52,
    crossSection: high ? 14 : 9,
    ribbon: high ? 56 : 30,
    countScale: high ? 1 : .46,
  };
}

export function makeNebulaMaterial(tracker, options = {}){
  const baseOpacity = THREE.MathUtils.clamp(numeric(options.opacity, .52), 0, 1);
  const dust = options.dust === true;
  const uniforms = {
    uColorA: { value: color(options.colorA, dust ? 0x120a12 : 0x5ec8d7) },
    uColorB: { value: color(options.colorB, options.colorA || 0xef765f) },
    uOpacity: { value: baseOpacity },
    uRim: { value: numeric(options.rim, dust ? .16 : 1.25) },
    uFilaments: { value: numeric(options.filaments, dust ? .18 : .62) },
    uScale: { value: numeric(options.scale, .24) },
    uPhase: { value: numeric(options.phase, 0) },
    uDust: { value: dust ? 1 : 0 },
    uErosion: { value: THREE.MathUtils.clamp(numeric(options.erosion, 0),0,1) },
    uBounds: { value: new THREE.Vector2(
      numeric(options.bounds && options.bounds[0],0),
      numeric(options.bounds && options.bounds[1],0)) },
    uEdgeFeather: { value: THREE.MathUtils.clamp(numeric(options.edgeFeather,0),0,1) },
  };
  const material = tracker.material(new THREE.ShaderMaterial({
    uniforms,
    transparent: baseOpacity < 1 || !dust,
    depthTest: true,
    depthWrite: options.depthWrite === true || dust,
    blending: dust ? THREE.NormalBlending : THREE.AdditiveBlending,
    side: options.side == null ? THREE.DoubleSide : options.side,
    toneMapped: false,
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vLocal = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uOpacity;
      uniform float uRim;
      uniform float uFilaments;
      uniform float uScale;
      uniform float uPhase;
      uniform float uDust;
      uniform float uErosion;
      uniform vec2 uBounds;
      uniform float uEdgeFeather;
      varying vec3 vLocal;
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float rim = pow(max(0.0, 1.0-facing), 1.55);
        float a = sin(vLocal.x*uScale + sin(vLocal.z*uScale*.73+uPhase)*1.8);
        float b = sin(vLocal.y*uScale*.83 - vLocal.z*uScale*.42 + uPhase*1.71);
        float c = sin((vLocal.x-vLocal.y+vLocal.z)*uScale*.37-uPhase*.61);
        float ridge = smoothstep(.36,.96,abs(a*.48+b*.34+c*.18));
        float porous = smoothstep(-.38+uErosion*.46,.58,
          a*.50+b*.31+c*.19);
        float chroma = clamp(.48 + .25*a + .18*c, 0.0, 1.0);
        vec3 tint = mix(uColorA,uColorB,chroma);
        float gasAlpha = uOpacity*(.10 + rim*.56 + ridge*.34)*
          mix(1.0,.16+porous*.84,uErosion);
        float gasLight = .52 + rim*uRim + ridge*uFilaments;
        float dustLight = .26 + facing*.48 + ridge*.10 + rim*.08;
        float dustAlpha = uOpacity*(.82 + facing*.18);
        float edgeMask = 1.0;
        if(uEdgeFeather > .001 && uBounds.x > .001 && uBounds.y > .001){
          float edgeX = smoothstep(0.0,uBounds.x*uEdgeFeather,
            uBounds.x-abs(vLocal.x));
          float edgeY = smoothstep(0.0,uBounds.y*uEdgeFeather,
            uBounds.y-abs(vLocal.y));
          vec2 cloudUv = vLocal.xy/uBounds;
          float irregularEdge = length(cloudUv)*
            (1.0+.075*sin(atan(cloudUv.y,cloudUv.x)*7.0+uPhase));
          float cloudMask = 1.0-smoothstep(.76,1.035,irregularEdge);
          edgeMask = edgeX*edgeY*cloudMask;
        }
        float alpha = mix(gasAlpha,dustAlpha,uDust)*edgeMask;
        vec3 lit = tint*mix(gasLight,dustLight,uDust);
        if(alpha < .012 || (uDust < .5 && uErosion > .54 && porous < .055)) discard;
        gl_FragColor = vec4(lit,alpha);
      }`,
  }));
  material.userData.baseOpacity = baseOpacity;
  material.userData.opacityUniform = uniforms.uOpacity;
  material.userData.continuousNebulaSurface = true;
  material.userData.nebulaMatter = dust ? 'occluding-dust' : 'emissive-gas';
  return material;
}

export function makeBasicMaterial(tracker, value, opacity = 1, options = {}){
  const baseOpacity = THREE.MathUtils.clamp(numeric(opacity, 1), 0, 1);
  const material = tracker.material(new THREE.MeshBasicMaterial({
    color: color(value, 0xffffff),
    transparent: baseOpacity < 1,
    opacity: baseOpacity,
    blending: options.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: options.depthWrite !== false && !options.additive,
    depthTest: options.depthTest !== false,
    side: options.side == null ? THREE.DoubleSide : options.side,
    toneMapped: false,
    vertexColors: options.vertexColors === true,
  }));
  material.userData.baseOpacity = baseOpacity;
  return material;
}

export function addTrackedMesh(root, geometry, material, tracker, name){
  tracker.geometry(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.continuousNebulaFeature = true;
  root.add(mesh);
  return mesh;
}

function finalizeGeometry(positions, indices){
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function organicEllipsoidGeometry({
  radii = [10, 10, 8], longitude = 56, latitude = 30,
  irregularity = .045, phase = 0, openPolar = 0,
} = {}){
  const r = vector(radii, [10,10,8]);
  const lon = Math.max(12, Math.round(longitude));
  const lat = Math.max(8, Math.round(latitude));
  const positions = [], indices = [];
  const polarCut = THREE.MathUtils.clamp(openPolar, 0, .38)*Math.PI;
  for(let y=0;y<=lat;y++){
    const v = y/lat;
    const theta = polarCut + v*(Math.PI-polarCut*2);
    const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
    for(let x=0;x<=lon;x++){
      const u=x/lon, phi=u*TAU;
      const ripple = 1 + irregularity*(
        Math.sin(phi*3+phase)*Math.sin(theta*2.1)*.55+
        Math.sin(phi*7-theta*3.2+phase*1.7)*.28+
        Math.cos(phi*11+theta*5.1-phase)*.17);
      positions.push(
        Math.cos(phi)*sinTheta*r.x*ripple,
        cosTheta*r.y*ripple,
        Math.sin(phi)*sinTheta*r.z*ripple);
    }
  }
  const stride=lon+1;
  for(let y=0;y<lat;y++) for(let x=0;x<lon;x++){
    const a=y*stride+x,b=a+1,c=a+stride,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  return finalizeGeometry(positions,indices);
}

export function organicRingGeometry({
  major = [20, 20], tube = [4, 4, 5], majorSegments = 80,
  tubeSegments = 12, irregularity = .055, phase = 0,
} = {}){
  const m = Array.isArray(major) ? major : [major,major];
  const t = vector(tube,[4,4,5]);
  const around=Math.max(18,Math.round(majorSegments));
  const cross=Math.max(6,Math.round(tubeSegments));
  const positions=[],indices=[];
  for(let i=0;i<=around;i++){
    const u=i/around*TAU;
    const wobble=1+irregularity*(Math.sin(u*5+phase)*.6+Math.sin(u*11-phase*.7)*.4);
    for(let j=0;j<=cross;j++){
      const v=j/cross*TAU;
      const grain=1+irregularity*.58*Math.sin(u*9+v*4+phase*1.3);
      positions.push(
        (numeric(m[0],20)*wobble+t.x*Math.cos(v)*grain)*Math.cos(u),
        (numeric(m[1],20)*wobble+t.y*Math.cos(v)*grain)*Math.sin(u),
        t.z*Math.sin(v)*grain);
    }
  }
  const stride=cross+1;
  for(let i=0;i<around;i++) for(let j=0;j<cross;j++){
    const a=i*stride+j,b=a+1,c=a+stride,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  return finalizeGeometry(positions,indices);
}

export function bowlGeometry({
  radii=[28,24], depth=18, inner=.04, radial=28, angular=72,
  phase=0, irregularity=.055,
}={}){
  const rx=numeric(radii[0],28), ry=numeric(radii[1],24);
  const rings=Math.max(8,Math.round(radial));
  const around=Math.max(20,Math.round(angular));
  const positions=[],indices=[];
  for(let j=0;j<=rings;j++){
    const t=j/rings;
    const radius=inner+(1-inner)*t;
    for(let i=0;i<=around;i++){
      const a=i/around*TAU;
      const ripple=1+irregularity*(Math.sin(a*5+phase)*.58+
        Math.sin(a*13+t*9-phase)*.42)*(0.25+t*.75);
      positions.push(
        Math.cos(a)*rx*radius*ripple,
        Math.sin(a)*ry*radius*ripple,
        -depth*Math.pow(radius,1.65)+Math.sin(a*3+t*8+phase)*depth*.045);
    }
  }
  const stride=around+1;
  for(let j=0;j<rings;j++) for(let i=0;i<around;i++){
    const a=j*stride+i,b=a+1,c=a+stride,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  return finalizeGeometry(positions,indices);
}

export function corrugatedSheetGeometry({
  width=62,height=52,depth=8,segmentsX=44,segmentsY=34,phase=0,
}={}){
  const sx=Math.max(8,Math.round(segmentsX));
  const sy=Math.max(8,Math.round(segmentsY));
  const positions=[],indices=[];
  for(let y=0;y<=sy;y++){
    const v=y/sy;
    for(let x=0;x<=sx;x++){
      const u=x/sx;
      const edge=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
      const z=(Math.sin(u*TAU*2.3+phase)*.42+
        Math.sin(v*TAU*3.1-phase*.7)*.33+
        Math.sin((u+v)*TAU*4.4+phase*1.4)*.25)*depth*edge;
      positions.push((u-.5)*width,(.5-v)*height,z);
    }
  }
  const stride=sx+1;
  for(let y=0;y<sy;y++) for(let x=0;x<sx;x++){
    const a=y*stride+x,b=a+1,c=a+stride,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  return finalizeGeometry(positions,indices);
}

export function sweptFilamentGeometry(pointsValue, options = {}){
  const points=(pointsValue || []).map(point => vector(point));
  if(points.length<2) return new THREE.BufferGeometry();
  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal',.42);
  const segments=Math.max(4,Math.round(numeric(options.segments,36)));
  const radial=Math.max(4,Math.round(numeric(options.radialSegments,7)));
  const startRadius=numeric(Array.isArray(options.radius)?options.radius[0]:options.radius,.7);
  const endRadius=numeric(Array.isArray(options.radius)?options.radius[1]:options.radius,startRadius);
  const depthRatio=numeric(options.depthRatio,.72);
  const positions=[],indices=[];
  const tangent=new THREE.Vector3(),side=new THREE.Vector3(),binormal=new THREE.Vector3();
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    const center=curve.getPointAt(t);
    curve.getTangentAt(t,tangent).normalize();
    const reference=Math.abs(tangent.z)<.86
      ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0);
    side.crossVectors(tangent,reference).normalize();
    binormal.crossVectors(tangent,side).normalize();
    const taper=THREE.MathUtils.lerp(startRadius,endRadius,t);
    const pulse=1+numeric(options.irregularity,.08)*(
      Math.sin(t*TAU*5+numeric(options.phase,0))*.62+
      Math.sin(t*TAU*11-numeric(options.phase,0))*.38);
    for(let j=0;j<=radial;j++){
      const angle=j/radial*TAU;
      const p=center.clone()
        .addScaledVector(side,Math.cos(angle)*taper*pulse)
        .addScaledVector(binormal,Math.sin(angle)*taper*pulse*depthRatio);
      positions.push(p.x,p.y,p.z);
    }
  }
  const stride=radial+1;
  for(let i=0;i<segments;i++) for(let j=0;j<radial;j++){
    const a=i*stride+j,b=a+1,c=a+stride,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  return finalizeGeometry(positions,indices);
}

export function jaggedRibbonGeometry(pointsValue,options={}){
  const points=(pointsValue || []).map(point=>vector(point));
  if(points.length<2) return new THREE.BufferGeometry();
  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal',.34);
  const segments=Math.max(4,Math.round(numeric(options.segments,34)));
  const widthValue=Array.isArray(options.width)?options.width:[options.width,options.width];
  const depthValue=Array.isArray(options.depth)?options.depth:[options.depth,options.depth];
  const startWidth=Math.max(.05,numeric(widthValue[0],2));
  const endWidth=Math.max(.05,numeric(widthValue[1],startWidth));
  const startDepth=Math.max(.05,numeric(depthValue[0],1.5));
  const endDepth=Math.max(.05,numeric(depthValue[1],startDepth));
  const phase=numeric(options.phase,0);
  const irregularity=numeric(options.irregularity,.14);
  const positions=[],indices=[];
  const tangent=new THREE.Vector3(),side=new THREE.Vector3();
  for(let i=0;i<=segments;i++){
    const t=i/segments,center=curve.getPointAt(t);
    curve.getTangentAt(t,tangent).normalize();
    side.set(-tangent.y,tangent.x,0);
    if(side.lengthSq()<1e-5) side.set(1,0,0); else side.normalize();
    const jag=1+irregularity*(Math.sin(t*TAU*7+phase)*.58+
      Math.sin(t*TAU*17-phase*.8)*.42);
    const halfWidth=THREE.MathUtils.lerp(startWidth,endWidth,t)*.5*jag;
    const halfDepth=THREE.MathUtils.lerp(startDepth,endDepth,t)*.5*
      (1+irregularity*.45*Math.sin(t*TAU*11+phase*.7));
    const left=center.clone().addScaledVector(side,halfWidth);
    const right=center.clone().addScaledVector(side,-halfWidth);
    positions.push(left.x,left.y,left.z+halfDepth,
      right.x,right.y,right.z+halfDepth,
      left.x,left.y,left.z-halfDepth,
      right.x,right.y,right.z-halfDepth);
  }
  for(let i=0;i<segments;i++){
    const a=i*4,b=a+1,c=a+2,d=a+3;
    const e=a+4,f=a+5,g=a+6,h=a+7;
    indices.push(a,e,b,b,e,f,c,d,g,d,h,g,a,c,e,c,g,e,b,f,d,d,f,h);
  }
  indices.push(0,1,2,1,3,2);
  const end=segments*4;
  indices.push(end,end+2,end+1,end+1,end+2,end+3);
  return finalizeGeometry(positions,indices);
}

export function arcPoints({
  center=[0,0,0],radius=10,axisRatio=1,startDeg=0,arcDeg=180,
  segments=42,rotationDeg=[0,0,0],depthWave=0,phase=0,
}={}){
  const c=vector(center), result=[];
  const rotation=eulerDegrees(rotationDeg);
  const count=Math.max(5,Math.round(segments));
  for(let i=0;i<=count;i++){
    const t=i/count;
    const a=THREE.MathUtils.degToRad(startDeg+arcDeg*t);
    const p=new THREE.Vector3(
      Math.cos(a)*radius,
      Math.sin(a)*radius*axisRatio,
      Math.sin(t*Math.PI*2+phase)*depthWave).applyEuler(rotation).add(c);
    result.push(p);
  }
  return result;
}

export function addStar(root, tracker, options = {}){
  const position=vector(options.position);
  const size=Math.max(.12,numeric(options.size,.7));
  const coreGeometry=tracker.geometry(new THREE.SphereGeometry(size,16,10));
  const coreMaterial=makeBasicMaterial(tracker,options.color || 0xe9f6ff,1,{
    additive:true,depthWrite:false,
  });
  const core=new THREE.Mesh(coreGeometry,coreMaterial);
  core.name=options.name || 'embedded-colored-star';
  core.position.copy(position);
  core.userData.scientificSource=options.scientificSource === true;
  root.add(core);
  const haloGeometry=tracker.geometry(new THREE.SphereGeometry(size*2.8,14,8));
  const haloMaterial=makeNebulaMaterial(tracker,{
    colorA:options.color || 0xc9eaff,colorB:0xffffff,opacity:.18,
    rim:.9,filaments:.08,scale:.7,phase:size,
  });
  const halo=new THREE.Mesh(haloGeometry,haloMaterial);
  halo.name=`${core.name}-halo`;
  halo.position.copy(position);
  halo.renderOrder=18;
  root.add(halo);
  return core;
}

export function addInstancedKnots(root, tracker, samples, options = {}){
  if(!samples || !samples.length) return null;
  const geometry=tracker.geometry(new THREE.IcosahedronGeometry(1,1));
  const material=makeBasicMaterial(tracker,0xffffff,numeric(options.opacity,.72),{
    additive:options.additive !== false,
    depthWrite:options.additive === false,
    vertexColors:true,
  });
  const mesh=tracker.instanced(
    new THREE.InstancedMesh(geometry,material,samples.length));
  mesh.name=options.name || 'nebula-sculpted-knots';
  mesh.userData.continuousNebulaDetail=true;
  const dummy=new THREE.Object3D();
  samples.forEach((sample,index)=>{
    dummy.position.copy(vector(sample.position));
    const scale=Array.isArray(sample.scale)
      ? vector(sample.scale,[1,1,1])
      : new THREE.Vector3().setScalar(Math.max(.02,numeric(sample.scale,.3)));
    dummy.scale.copy(scale);
    dummy.rotation.copy(eulerDegrees(sample.rotationDeg || [0,0,0]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index,dummy.matrix);
    mesh.setColorAt(index,color(sample.color,options.color || 0xffffff));
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();
  root.add(mesh);
  return mesh;
}
