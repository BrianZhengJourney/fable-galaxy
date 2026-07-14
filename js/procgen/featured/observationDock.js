/* Evidence sidecar for model-led landmark exhibits. The source product stays a
   flat, unlit observation plane while the explanatory 3D model remains in the
   scene. The dock is camera-relative so it reads as an archive panel rather
   than image-derived geometry. */

import * as THREE from 'three';
import { loadTexture } from '../../utils/assets.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function clampStep(dt){
  return THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
}

function rectGeometry(width, height){
  const x = width * 0.5;
  const y = height * 0.5;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -x, -y, 0,
     x, -y, 0,
     x,  y, 0,
    -x,  y, 0,
  ]), 3));
  return geometry;
}

function replaceGeometry(mesh, next){
  const previous = mesh.geometry;
  mesh.geometry = next;
  if (previous) previous.dispose();
}

export function createObservationDock({
  image,
  name = 'ObservationDock',
  width = 25,
  offsetX = 25,
  offsetY = 8,
  accent = 0x62e6ff,
  heroRadius = 22,
  gutter = 3,
} = {}){
  const sourceFile = image && image.file;
  const group = new THREE.Group();
  group.name = name;
  group.visible = false;
  group.userData.observationSidecar = true;
  group.userData.sourceFile = sourceFile || null;
  group.userData.sourceCredit = image && image.credit || null;
  group.userData.sourceIsFlatObservation = true;
  group.userData.modelReplacement = false;

  let aspect = 4 / 3;
  let height = width / aspect;
  const backingMaterial = new THREE.MeshBasicMaterial({
    color: 0x02070b,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 1.8, height + 1.8), backingMaterial);
  backing.name = `${name}.Backing`;
  backing.position.z = -0.16;
  backing.renderOrder = 70;
  group.add(backing);

  const imageMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  // `loadTexture` owns its cache. The dock disposes only its presentation
  // geometry/material; `evictTextures()` releases the shared source product.
  imageMaterial.userData.keepMaps = true;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(width, height), imageMaterial);
  plate.name = `${name}.SourceObservation`;
  plate.renderOrder = 71;
  plate.userData.flatScientificSource = true;
  group.add(plate);

  const frameMaterial = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const frame = new THREE.LineLoop(rectGeometry(width + 0.8, height + 0.8), frameMaterial);
  frame.name = `${name}.Frame`;
  frame.position.z = 0.08;
  frame.renderOrder = 72;
  group.add(frame);

  const railMaterial = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const railGeometry = new THREE.BufferGeometry();
  railGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -width * 0.5, height * 0.5 + 0.95, 0,
     width * 0.18, height * 0.5 + 0.95, 0,
     width * 0.28, height * 0.5 + 0.95, 0,
     width * 0.5, height * 0.5 + 0.95, 0,
  ]), 3));
  const rails = new THREE.LineSegments(railGeometry, railMaterial);
  rails.name = `${name}.ArchiveRails`;
  rails.position.z = 0.08;
  rails.renderOrder = 72;
  group.add(rails);

  let disposed = false;
  let requested = false;
  let loaded = false;
  let alpha = 0;
  let elapsed = 0;
  const cameraQuaternion = new THREE.Quaternion();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  function rebuildForAspect(nextAspect){
    aspect = THREE.MathUtils.clamp(nextAspect || aspect, 0.45, 2.4);
    height = width / aspect;
    replaceGeometry(plate, new THREE.PlaneGeometry(width, height));
    replaceGeometry(backing, new THREE.PlaneGeometry(width + 1.8, height + 1.8));
    replaceGeometry(frame, rectGeometry(width + 0.8, height + 0.8));
    const positions = rails.geometry.attributes.position.array;
    const y = height * 0.5 + 0.95;
    for (let i = 1; i < positions.length; i += 3) positions[i] = y;
    rails.geometry.attributes.position.needsUpdate = true;
  }

  function requestSource(){
    if (!sourceFile || requested || disposed) return;
    requested = true;
    loadTexture(sourceFile, texture => {
      if (disposed) return;
      const source = texture.image || {};
      rebuildForAspect((source.width || 4) / (source.height || 3));
      imageMaterial.map = texture;
      imageMaterial.needsUpdate = true;
      loaded = true;
      group.userData.sourceLoaded = true;
    });
  }

  function applyOpacity(){
    backingMaterial.opacity = 0.84 * alpha;
    imageMaterial.opacity = (loaded ? 1 : 0) * alpha;
    frameMaterial.opacity = 0.72 * alpha;
    railMaterial.opacity = 0.5 * alpha;
  }

  function setVisible(on){
    const visible = !!on && !!sourceFile && !disposed;
    group.userData.observationVisible = visible;
    if (!visible){
      alpha = 0;
      group.visible = false;
      applyOpacity();
      return;
    }
    group.visible = true;
    requestSource();
  }

  function update(dt, camera){
    if (disposed || !group.visible) return;
    const step = clampStep(dt);
    elapsed = (elapsed + step) % 8192;
    alpha += (1 - alpha) * (1 - Math.exp(-step * 8));
    applyOpacity();
    if (!camera) return;
    const aspect = Number.isFinite(camera.aspect) ? camera.aspect : 1.6;
    const distance = Math.max(1, camera.position.length());
    const halfHeight = distance * Math.tan(
      THREE.MathUtils.degToRad(Number.isFinite(camera.fov) ? camera.fov : 52) * .5);
    const halfWidth = halfHeight * aspect;
    const margin = 2;
    const side = offsetX < 0 ? -1 : 1;
    const minimumScale = .30;
    const sideScale = THREE.MathUtils.clamp(
      (halfWidth - margin - heroRadius - gutter) / Math.max(width, 1),
      minimumScale,
      1,
    );
    const sideInnerEdge = halfWidth - margin - width * sideScale;
    const topGutter = aspect < 1.05 || sideInnerEdge < heroRadius + gutter;
    let layoutScale;
    let x;
    let y;

    if (topGutter){
      const widthScale = (halfWidth * 2 - margin * 2) / Math.max(width, 1);
      const heightScale = (halfHeight - margin - heroRadius - gutter) /
        Math.max(height, 1);
      layoutScale = THREE.MathUtils.clamp(
        Math.min(.68, widthScale, heightScale), minimumScale, .68);
      const panelHalfWidth = width * layoutScale * .5;
      const panelHalfHeight = height * layoutScale * .5;
      x = side * Math.max(0, halfWidth - margin - panelHalfWidth);
      y = Math.max(
        heroRadius + gutter + panelHalfHeight,
        halfHeight - margin - panelHalfHeight,
      );
      // If an exceptionally short viewport cannot contain both regions, keep
      // the panel inside the frustum; its reduced scale still protects the
      // event-horizon silhouette on normal phone/tablet aspect ratios.
      y = Math.min(y, halfHeight - margin - panelHalfHeight);
      group.userData.layoutMode = 'portrait-top-gutter';
    } else {
      layoutScale = sideScale;
      const panelHalfWidth = width * layoutScale * .5;
      const panelHalfHeight = height * layoutScale * .5;
      x = side * (halfWidth - margin - panelHalfWidth);
      y = THREE.MathUtils.clamp(
        offsetY,
        -halfHeight + margin + panelHalfHeight,
        halfHeight - margin - panelHalfHeight,
      );
      group.userData.layoutMode = 'landscape-side-gutter';
    }

    group.scale.setScalar((0.97 + alpha * 0.03) * layoutScale);
    camera.getWorldQuaternion(cameraQuaternion);
    group.quaternion.copy(cameraQuaternion);
    right.copy(X_AXIS).applyQuaternion(cameraQuaternion);
    up.copy(Y_AXIS).applyQuaternion(cameraQuaternion);
    group.position.copy(right).multiplyScalar(x)
      .addScaledVector(up, y + Math.sin(elapsed * 0.42) * 0.16);
    group.userData.reservedHeroRadius = heroRadius;
    group.userData.layoutScale = layoutScale;
  }

  function dispose(){
    if (disposed) return;
    disposed = true;
    group.visible = false;
    plate.geometry.dispose();
    backing.geometry.dispose();
    frame.geometry.dispose();
    rails.geometry.dispose();
    imageMaterial.dispose();
    backingMaterial.dispose();
    frameMaterial.dispose();
    railMaterial.dispose();
    group.removeFromParent();
    group.clear();
  }

  return {
    group,
    setVisible,
    update,
    dispose,
    get visible(){ return group.visible; },
    imageCredit: image && image.credit || null,
  };
}
