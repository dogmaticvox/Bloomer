// node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeVoicing, baseNotesForRoot } from '../js/voicing.js';

test('dial value 0 returns root position unchanged (sorted)', () => {
  assert.deepEqual(computeVoicing([67, 60, 64], 0), [60, 64, 67]);
});

test('positive dial steps move the lowest note up an octave, one per step', () => {
  const root = [60, 64, 67]; // C major, root position
  assert.deepEqual(computeVoicing(root, 1), [64, 67, 72]); // 1st inversion
  assert.deepEqual(computeVoicing(root, 2), [67, 72, 76]); // 2nd inversion
});

test('a full inversion cycle (one step per tone) shifts the whole chord up an octave', () => {
  const root = [60, 64, 67]; // 3 tones
  assert.deepEqual(computeVoicing(root, 3), [72, 76, 79]); // root + 12
});

test('negative dial steps move the highest note down an octave', () => {
  const root = [60, 64, 67];
  assert.deepEqual(computeVoicing(root, -1), [55, 60, 64]);
});

test('a full negative cycle shifts the whole chord down an octave', () => {
  const root = [60, 64, 67];
  assert.deepEqual(computeVoicing(root, -3), [48, 52, 55]); // root - 12
});

test('extreme dial values keep producing genuinely new registers, not just repeats', () => {
  const root = [60, 64, 67];
  const far = computeVoicing(root, 12);
  assert.deepEqual(far, [60 + 48, 64 + 48, 67 + 48]); // 4 full cycles up
});

test('works for chords of any size (e.g. a 9 chord with 5 tones)', () => {
  const notes = [60, 64, 67, 70, 74];
  assert.deepEqual(computeVoicing(notes, 1), [64, 67, 70, 74, 72]);
});

test('baseNotesForRoot places intervals at octave 4 by default', () => {
  assert.deepEqual(baseNotesForRoot(0, [0, 4, 7]), [60, 64, 67]);
  assert.deepEqual(baseNotesForRoot(7, [0, 4, 7]), [67, 71, 74]);
});
