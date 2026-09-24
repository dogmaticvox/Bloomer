// node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  effectiveDuration, scaleModeOpts, durationToBeats, beatsToDuration, stepBeats,
} from '../js/progression.js';

test('playback speed scales chord duration', () => {
  const item = { duration: 1.2, tempo: 100 };
  assert.equal(effectiveDuration(item, 1), 1.2);
  assert.equal(effectiveDuration(item, 2), 0.6);
  assert.equal(effectiveDuration(item, 0.5), 2.4);
});

test('playback speed scales strum/arp/alt-bass timing too', () => {
  const opts = { subdivisionSec: 0.3, strumStepSec: 0.04, arpStepSec: 0.3, order: 'up' };
  assert.deepEqual(scaleModeOpts(opts, 2), { subdivisionSec: 0.15, strumStepSec: 0.02, arpStepSec: 0.15, order: 'up' });
  assert.deepEqual(opts.arpStepSec, 0.3, 'input is not mutated');
});

test('durations convert to and from beats at the recorded tempo', () => {
  assert.equal(durationToBeats({ duration: 1.2, tempo: 100 }), 2);
  assert.equal(beatsToDuration(2, 100), 1.2);
  assert.equal(beatsToDuration(1, 60), 1);
});

test('stepping a length snaps onto the half-beat grid', () => {
  assert.equal(stepBeats(1.37, 1), 1.5);
  assert.equal(stepBeats(1.37, -1), 1);
  assert.equal(stepBeats(1.5, 1), 2);
  assert.equal(stepBeats(1.5, -1), 1);
});

test('stepping down bottoms out at a quarter beat', () => {
  assert.equal(stepBeats(0.5, -1), 0.25);
  assert.equal(stepBeats(0.25, -1), 0.25);
  assert.equal(stepBeats(0.25, 1), 0.5);
  // an as-played length already under the floor is left alone, not lengthened
  assert.equal(stepBeats(0.2, -1), 0.2);
});
