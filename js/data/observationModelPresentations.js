/* Declarative observation -> model entry presentations for the high-fidelity
   Explore fields. `defaultMoment` remains model-first; renderers may opt into
   the opening sequence through `entrySequence` without changing story
   semantics or treating a flat source frame as recovered spatial depth. */

const ENTRY_TIMING = Object.freeze({
  holdSeconds: 1.2,
  durationSeconds: 1.2,
  readinessTimeoutSeconds: 0.8,
});

const GENERIC_SPLIT_COPY = Object.freeze({
  title: 'OBSERVATION BESIDE THE 3D INTERPRETATION',
  text: 'The source observation remains a flat image beside the scientific 3D interpretation. The pairing supports visual comparison; it does not recover line-of-sight depth from image pixels.',
});

const PILLARS_SPLIT_COPY = Object.freeze({
  title: 'THE HUBBLE FRAME BESIDE THE SCULPT',
  text: 'The 2015 Hubble observation remains a flat source image beside the scientific 3D interpretation. Their shared silhouette guides comparison, but the image itself contains no recovered line-of-sight depth.',
});

const CARINA_SPLIT_COPY = Object.freeze({
  title: 'TWO CARINA VIEWS, KEPT DISTINCT',
  text: 'The Webb Cosmic Cliffs observation remains a flat source image beside the broader Carina reconstruction. They show different fields, so this is a contextual comparison—not a registered-depth view or a pixel-aligned morph.',
});

const CRAB_SPLIT_COPY = Object.freeze({
  title: 'MEASURED EXPANSION BESIDE THE ENGINE MODEL',
  text: 'The registered Hubble expansion comparison remains a flat observation beside the pulsar-engine interpretation. The observation measures projected filament motion; it does not recover the model’s full three-dimensional depth.',
});

const SN1987A_SPLIT_COPY = Object.freeze({
  title: 'THE HUBBLE REMNANT BESIDE ITS 3D INTERPRETATION',
  text: 'The Hubble observation remains a flat source image beside the scientific ring-and-ejecta model. Projected ring overlap constrains the interpretation, but the image is not a measured three-dimensional volume.',
});

const CASA_SPLIT_COPY = Object.freeze({
  title: 'THE WEBB REMNANT BESIDE ITS 3D INTERPRETATION',
  text: 'The Webb MIRI observation remains a flat, assigned-color source image beside the scientific remnant model. Element families and line-of-sight knot placement in the model remain interpretive.',
});

function config(observationMomentId, modelMomentId, splitMomentId,
  splitCopy = GENERIC_SPLIT_COPY, transitionNote = ''){
  return Object.freeze({
    observationMomentId,
    modelMomentId,
    splitMomentId,
    splitCopy,
    transitionNote,
  });
}

/* The 13 nebula/remnant cards currently published in Explore. Keep this list
   explicit so adding a renderer does not silently opt it into the sequence. */
export const HIGH_FIDELITY_PRESENTATION_IDS = Object.freeze([
  'pillars-of-creation',
  'orion-nebula',
  'carina-nebula',
  'horsehead-nebula',
  'ring-nebula',
  'helix-nebula',
  'lagoon-nebula',
  'cats-eye-nebula',
  'trifid-nebula',
  'crab-nebula-sn-1054',
  'sn-1987a',
  'cassiopeia-a',
  'veil-nebula',
]);

export const OBSERVATION_MODEL_PRESENTATION_CONFIGS = Object.freeze({
  'pillars-of-creation': config(
    'hubble-2015', 'carved', 'pillars-of-creation-split',
    PILLARS_SPLIT_COPY,
  ),
  'orion-nebula': config(
    'orion-nebula-observation', 'orion-nebula-model', 'orion-nebula-split',
  ),
  'carina-nebula': config(
    'carina-webb', 'carina-ignites', 'carina-nebula-split',
    CARINA_SPLIT_COPY,
    'The opening image overlay is only a presentation transition. Webb’s Cosmic Cliffs and the broader Carina reconstruction are different fields, so the transition is not registered depth or a pixel-aligned morph.',
  ),
  'horsehead-nebula': config(
    'horsehead-nebula-observation', 'horsehead-nebula-model', 'horsehead-nebula-split',
  ),
  'ring-nebula': config(
    'ring-nebula-observation', 'ring-nebula-model', 'ring-nebula-split',
  ),
  'helix-nebula': config(
    'helix-nebula-observation', 'helix-nebula-model', 'helix-nebula-split',
  ),
  'lagoon-nebula': config(
    'lagoon-nebula-observation', 'lagoon-nebula-model', 'lagoon-nebula-split',
  ),
  'cats-eye-nebula': config(
    'cats-eye-nebula-observation', 'cats-eye-nebula-model', 'cats-eye-nebula-split',
  ),
  'trifid-nebula': config(
    'trifid-nebula-observation', 'trifid-nebula-model', 'trifid-nebula-split',
  ),
  'crab-nebula-sn-1054': config(
    'crab-hubble-expansion', 'crab-pulsar', 'crab-nebula-sn-1054-split',
    CRAB_SPLIT_COPY,
  ),
  'crab-nebula': config(
    'crab-hubble-expansion', 'crab-pulsar', 'crab-nebula-split',
    CRAB_SPLIT_COPY,
  ),
  'sn-1987a': config(
    'sn1987a-observation', 'sn1987a-model', 'sn1987a-split',
    SN1987A_SPLIT_COPY,
  ),
  'cassiopeia-a': config(
    'casa-observation', 'casa-model', 'casa-split',
    CASA_SPLIT_COPY,
  ),
  'veil-nebula': config(
    'veil-nebula-observation', 'veil-nebula-model', 'veil-nebula-split',
  ),
});

export function observationModelPresentationConfig(id){
  return OBSERVATION_MODEL_PRESENTATION_CONFIGS[id] || null;
}

function presentedMoment(moment, presentation){
  return {
    ...moment,
    visual: { ...(moment.visual || {}), presentation },
  };
}

function splitMoment(configRecord, observationMoment, modelMoment,
  existingMoment = null){
  const modelVisual = { ...(modelMoment.visual || {}) };
  return {
    ...(existingMoment || {}),
    id: configRecord.splitMomentId,
    date: 'OBSERVATION + MODEL',
    kind: 'FLAT OBSERVATION + SCIENTIFIC 3D MODEL',
    title: configRecord.splitCopy.title,
    text: configRecord.splitCopy.text,
    source: observationMoment.source || modelMoment.source,
    presentationOnly: true,
    visual: {
      ...modelVisual,
      state: 'split',
      observation: true,
      presentation: 'split',
      delegate: modelVisual,
    },
  };
}

function appendNote(note, addition){
  if (!addition || (note || '').includes(addition)) return note;
  return [note, addition].filter(Boolean).join(' ');
}

/**
 * Add the observation -> model opening contract and the three explicit view
 * modes to a curated high-fidelity experience. Unknown or incomplete records
 * are returned unchanged so archive entries cannot acquire fictional views.
 */
export function withObservationModelPresentation(entry, experience){
  const configRecord = observationModelPresentationConfig(entry && entry.id);
  if (!configRecord || !experience || !Array.isArray(experience.moments))
    return experience;

  const observation = experience.moments.find(
    moment => moment.id === configRecord.observationMomentId,
  );
  const model = experience.moments.find(
    moment => moment.id === configRecord.modelMomentId,
  );
  if (!observation || !model || configRecord.splitMomentId === observation.id ||
      configRecord.splitMomentId === model.id || observation.id === model.id)
    return experience;

  const observationMoment = presentedMoment(observation, 'observation');
  const modelMoment = presentedMoment(model, 'model');
  const existingSplit = experience.moments.find(
    moment => moment.id === configRecord.splitMomentId,
  );
  const normalizedSplit = splitMoment(
    configRecord, observationMoment, modelMoment, existingSplit,
  );

  const moments = experience.moments.map(moment => {
    if (moment.id === observationMoment.id) return observationMoment;
    if (moment.id === modelMoment.id) return modelMoment;
    if (moment.id === normalizedSplit.id) return normalizedSplit;
    return moment;
  });
  if (!existingSplit) moments.push(normalizedSplit);

  return {
    ...experience,
    /* Deliberately preserve the story's model-first semantic default. */
    defaultMoment: experience.defaultMoment,
    note: appendNote(experience.note, configRecord.transitionNote),
    entrySequence: {
      observationMomentId: observationMoment.id,
      modelMomentId: modelMoment.id,
      splitMomentId: normalizedSplit.id,
      ...ENTRY_TIMING,
    },
    viewModes: [
      { id: 'split', label: 'SPLIT', momentId: normalizedSplit.id },
      { id: 'observation', label: 'OBSERVATION', momentId: observationMoment.id },
      { id: 'model', label: '3D MODEL', momentId: modelMoment.id },
    ],
    moments,
  };
}
