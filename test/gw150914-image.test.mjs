import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

import { LANDMARK_IMAGES } from '../js/data/landmarkImages.js';
import { LANDMARKS } from '../js/data/landmarks.js';
import { landmarkExperience } from '../js/data/fieldStories.js';

test('GW150914 uses distinct official artwork and detector evidence', async () => {
  const image = LANDMARK_IMAGES.gw150914;
  assert.equal(image.file, 'images/gw150914.jpg');
  assert.equal(image.coverFile, 'images/gw150914-illustration.jpg');
  assert.match(image.credit, /LIGO Scientific Collaboration/);
  assert.match(image.coverCredit, /official discovery artwork/i);
  assert.match(image.coverAlt, /artist's illustration/i);
  await Promise.all([
    access(new URL('../' + image.file, import.meta.url)),
    access(new URL('../' + image.coverFile, import.meta.url)),
  ]);

  const experience = landmarkExperience(
    LANDMARKS.find(entry => entry.id === 'gw150914'));
  const opening = experience.moments.find(moment => moment.id === experience.defaultMoment);
  const detection = experience.moments.find(moment => moment.id === 'gw150914-detection');
  assert.equal(opening.visual.evidence, 'illustration');
  assert.equal(detection.visual.evidence, 'signal');

  const [hud, blackHoles] = await Promise.all([
    readFile(new URL('../js/ui/hud.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/procgen/featured/blackHoles.js', import.meta.url), 'utf8'),
  ]);
  assert.match(hud, /img\.coverFile \|\| img\.file/,
    'Explore should prefer the artwork while retaining the evidence image');
  assert.match(blackHoles, /IllustrationDock/);
  assert.match(blackHoles, /DetectorSignalDock/);
  assert.match(blackHoles, /OFFICIAL ILLUSTRATION \+ MODEL/);
  assert.match(blackHoles, /DETECTOR SIGNAL \+ MODEL/);
});
