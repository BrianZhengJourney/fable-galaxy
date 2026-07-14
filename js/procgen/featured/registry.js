import * as THREE from 'three';
import { createFeaturedExhibit } from './contract.js';
import { buildPillarsFeatured } from './pillars.js';
import { buildCarinaFeatured } from './carina.js';
import { buildCrabFeatured } from './crab.js';
import { buildM87Featured, M87_STATES } from './m87.js';
import { buildPaleBlueDotFeatured } from './paleBlueDot.js';
import { buildNebulaCollectionFeatured } from './nebulaCollection.js';
import {
  buildCassiopeiaAFeatured,
  buildSN1987AFeatured,
} from './supernovae.js';
import { createObservationDock } from './observationDock.js';
import {
  buildCygnusX1Featured,
  buildGW150914Featured,
  buildM87StarFeatured,
  buildSagittariusAStarFeatured,
} from './blackHoles.js';
import { FEATURED_NEBULA_PROFILE_IDS } from '../../data/nebulaProfiles.js';

function buildCrabAlias(context){
  return buildCrabFeatured({
    ...context,
    entry: { ...context.entry, id: 'crab-nebula' },
  });
}

/* The milestone keeps its six sourced history/presentation states, but they no
   longer replace M87* itself. The shared relativistic M87 core and bipolar jet
   remain the centered hero while the existing evidence renderer occupies a
   camera-relative sidecar region. */
function buildM87MilestoneExperience(context){
  const evidence = buildM87Featured(context);
  const model = buildM87StarFeatured({
    ...context,
    entry: { ...context.entry, id: 'm87-star', name: 'M87*' },
    image: null,
  });
  const modelRoot = model.group;
  const evidenceRoot = evidence.group;
  modelRoot.name = 'M87Milestone.PersistentRelativisticModel';
  modelRoot.userData.persistentThreeDimensionalModel = true;
  modelRoot.userData.entryId = context.entry.id;
  evidenceRoot.name = 'M87Milestone.SixStateEvidenceSidecar';
  evidenceRoot.userData.mixedPresentationSidecar = true;
  evidenceRoot.userData.containsObservationPlates = true;
  evidenceRoot.userData.containsExplanatoryArrayView = true;

  const group = new THREE.Group();
  group.name = 'M87Milestone.ModelAndEvidence';
  Object.assign(group.userData, {
    entryId: context.entry.id,
    blackHoleMilestone: true,
    modelAlwaysVisible: true,
    activeState: 'model',
    observationVisible: false,
    explanatoryViewVisible: false,
    observationPolicy:
      'five sourced observation plates and one explanatory array view remain sidecars beside a persistent shared M87 relativistic model',
  });
  group.add(modelRoot, evidenceRoot);

  const cameraQuaternion = new THREE.Quaternion();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  let disposed = false;
  let evidenceVisible = false;
  evidenceRoot.visible = false;

  function layout(camera){
    if (!camera || !camera.isCamera) return;
    const aspect = THREE.MathUtils.clamp(
      Number.isFinite(camera.aspect) ? camera.aspect : 1.6, .42, 2.4);
    const distance = Math.max(1, camera.position.length());
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov || 52) * .5);
    const halfWidth = halfHeight * aspect;
    const portrait = aspect < 1;

    camera.getWorldQuaternion(cameraQuaternion);
    right.set(1, 0, 0).applyQuaternion(cameraQuaternion);
    up.set(0, 1, 0).applyQuaternion(cameraQuaternion);

    // The evidence comparison is the widest state (~164 world units). Keep it
    // wholly in a reserved top gutter on portrait screens and at the outer
    // right edge in landscape, never across the event-horizon hero.
    const evidenceScale = portrait
      ? THREE.MathUtils.clamp(aspect * .22, .095, .17)
      : THREE.MathUtils.clamp(.16 + (aspect - 1) * .11, .17, .26);
    const evidenceHalfWidth = 82 * evidenceScale;
    const evidenceHalfHeight = 68 * evidenceScale;
    const margin = 2.5;
    const evidenceX = Math.max(0, halfWidth - margin - evidenceHalfWidth);
    const evidenceY = portrait
      ? Math.max(18, halfHeight - margin - evidenceHalfHeight)
      : Math.min(9, halfHeight * .18);
    evidenceRoot.scale.setScalar(evidenceScale);
    evidenceRoot.position.copy(right).multiplyScalar(evidenceX)
      .addScaledVector(up, evidenceY);

    const modelScale = portrait
      ? THREE.MathUtils.clamp(aspect * .95, .48, .76)
      : THREE.MathUtils.clamp(.72 + aspect * .18, .88, 1);
    const modelX = portrait ? -Math.min(8, halfWidth * .27) : -Math.min(9, halfWidth * .11);
    const modelY = portrait ? -Math.min(7, halfHeight * .13) : 0;
    modelRoot.scale.setScalar(modelScale);
    modelRoot.position.copy(right).multiplyScalar(modelX)
      .addScaledVector(up, modelY);
    group.userData.layoutMode = portrait
      ? 'persistent-hero-with-top-evidence-gutter'
      : 'persistent-hero-with-side-evidence-gutter';
  }

  model.setMoment({ state: 'model' });
  return {
    group,
    focusDist: model.focusDist,
    startTheta: 0,
    startPhi: Math.PI / 2,
    autoRotate: false,
    hasIR: false,
    isImage: false,
    imageCredit: evidence.imageCredit || evidence.modelCredit ||
      context.image && context.image.credit || null,
    modelCredit: model.modelCredit,
    creditForPresentation(){
      if (group.userData.activeState === M87_STATES.ARRAY){
        return {
          label: 'MODEL / EXPLANATORY VIEW',
          text: [
            model.modelCredit,
            'EHT 2017 array geometry is an explanatory 3D view',
            'Earth albedo: Solar System Scope · CC BY 4.0',
          ].filter(Boolean).join(' · '),
        };
      }
      if (group.userData.observationVisible){
        return {
          label: 'OBSERVATION + MODEL',
          text: [
            evidence.imageCredit || context.image && context.image.credit,
            model.modelCredit,
          ].filter(Boolean).join(' · '),
        };
      }
      return model.modelCredit ? { label: 'MODEL', text: model.modelCredit } : null;
    },
    setMoment(visual){
      if (disposed || !visual) return;
      modelRoot.visible = true;
      evidenceVisible = visual.state !== 'model';
      evidenceRoot.visible = evidenceVisible;
      if (evidenceVisible) evidence.setMoment(visual);
      group.userData.activeState = evidenceVisible
        ? evidenceRoot.userData.activeState
        : 'model';
      const explanatoryViewVisible = evidenceVisible &&
        group.userData.activeState === M87_STATES.ARRAY;
      group.userData.explanatoryViewVisible = explanatoryViewVisible;
      group.userData.observationVisible = evidenceVisible && !explanatoryViewVisible;
      group.userData.activePresentation = explanatoryViewVisible
        ? 'model-plus-explanatory-view'
        : evidenceVisible ? 'model-plus-source-observation' : 'model';
    },
    update(dt, camera){
      if (disposed) return;
      modelRoot.visible = true;
      evidenceRoot.visible = evidenceVisible;
      layout(camera);
      model.update(dt, camera);
      if (evidenceVisible) evidence.update(dt, camera);
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      evidence.dispose();
      model.dispose();
      group.removeFromParent();
      group.clear();
      group.userData.disposed = true;
    },
  };
}

function isObservationMoment(visual){
  return !!visual && (visual.observation === true || visual.state === 'observation');
}

/* The remnant stays the hero. Authentic Hubble/JWST imagery is shown only as
   a camera-relative evidence panel during the explicit observation chapter. */
function buildRemnantWithObservation(context, build, options){
  const delegate = build(context);
  const modelRoot = delegate.group;
  modelRoot.name += '.PersistentModel';
  modelRoot.userData.persistentThreeDimensionalModel = true;

  const group = new THREE.Group();
  group.name = options.name;
  Object.assign(group.userData, modelRoot.userData, {
    modelAlwaysVisible: true,
    observationAsset: context.image && context.image.file || null,
    observationRequested: false,
  });
  group.add(modelRoot);
  const dock = createObservationDock({ image: context.image, ...options.dock });
  group.add(dock.group);
  let disposed = false;

  return {
    ...delegate,
    group,
    imageCredit: null,
    modelCredit: options.modelCredit,
    setMoment(visual){
      if (disposed) return;
      modelRoot.visible = true;
      if (delegate.setMoment) delegate.setMoment(visual);
      const observation = isObservationMoment(visual);
      dock.setVisible(observation);
      group.userData.observationRequested = observation;
      group.userData.activeState = modelRoot.userData.activeState;
    },
    update(dt, camera){
      if (disposed) return;
      modelRoot.visible = true;
      if (delegate.update) delegate.update(dt, camera);
      dock.update(dt, camera);
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      dock.dispose();
      if (delegate.dispose) delegate.dispose();
      group.removeFromParent();
      group.clear();
      group.userData.disposed = true;
    },
  };
}

function buildSN1987AExperience(context){
  return buildRemnantWithObservation(context, buildSN1987AFeatured, {
    name: 'SN1987A.ModelAndObservation',
    modelCredit: 'Scientific 3D model · ring thickness, depth and hotspot timing are interpretive',
    dock: { name: 'SN1987A.HubbleObservation', width: 25, offsetX: 27, offsetY: 8, accent: 0xffad73 },
  });
}

function buildCassiopeiaAExperience(context){
  return buildRemnantWithObservation(context, buildCassiopeiaAFeatured, {
    name: 'CasA.ModelAndObservation',
    modelCredit: 'Scientific 3D model · element colors and clump depth are explanatory',
    dock: { name: 'CasA.JWSTObservation', width: 25, offsetX: 28, offsetY: 8, accent: 0x7df2b0 },
  });
}

/* One stable dispatch point for the curated field stories. Keeping each entry
   in its own module lets the dedicated visuals evolve independently. */
const FEATURED_BUILDERS = new Map([
  ['pillars-of-creation', {
    renderer: 'pillars-hybrid', build: buildPillarsFeatured,
  }],
  ['carina-nebula', {
    renderer: 'carina-multi-state', build: buildCarinaFeatured,
  }],
  ['crab-nebula', {
    renderer: 'crab-observation-volume', build: buildCrabFeatured,
  }],
  ['crab-nebula-sn-1054', {
    renderer: 'crab-observation-volume', build: buildCrabAlias,
  }],
  ['m87-black-hole-image', {
    renderer: 'm87-model-plus-six-state-evidence', build: buildM87MilestoneExperience,
  }],
  ['cygnus-x-1', {
    renderer: 'black-hole-lensing-v1', build: buildCygnusX1Featured,
  }],
  ['m87-star', {
    renderer: 'black-hole-lensing-v1', build: buildM87StarFeatured,
  }],
  ['sagittarius-a-star', {
    renderer: 'black-hole-lensing-v1', build: buildSagittariusAStarFeatured,
  }],
  ['gw150914', {
    renderer: 'black-hole-merger-v1', build: buildGW150914Featured,
  }],
  ['gw150914-first-gravitational-wave', {
    renderer: 'black-hole-merger-v1', build: buildGW150914Featured,
  }],
  ['sn-1987a', {
    renderer: 'sn1987a-triple-ring-sculpt-v1', build: buildSN1987AExperience,
  }],
  ['cassiopeia-a', {
    renderer: 'cassiopeia-a-element-sculpt-v1', build: buildCassiopeiaAExperience,
  }],
  ['pale-blue-dot', {
    renderer: 'pale-blue-dot-multi-state', build: buildPaleBlueDotFeatured,
  }],
  ...FEATURED_NEBULA_PROFILE_IDS.map(id => [id, {
    renderer: 'nebula-photo-sculpt-v2', build: buildNebulaCollectionFeatured,
  }]),
]);

export const FEATURED_EXHIBIT_IDS = Object.freeze([...FEATURED_BUILDERS.keys()]);

export function hasFeaturedExhibit(id){
  return FEATURED_BUILDERS.has(id);
}
/* Returns null for archive landmarks so callers can preserve the existing
   category/vizStyle fallback without another ID switch. */
export function buildFeaturedExhibit(context){
  const id = context && context.entry && context.entry.id;
  const record = FEATURED_BUILDERS.get(id);
  if (!record) return null;
  return createFeaturedExhibit(id, record.renderer, record.build(context));
}
