// node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveChord, TYPE_INTERVALS, CHORD_TYPES, EXTENDED_TYPES } from '../js/chord-theory.js';

test('base triads match the spec table', () => {
  assert.deepEqual(resolveChord(0, 'major', []), [0, 4, 7]);
  assert.deepEqual(resolveChord(0, 'minor', []), [0, 3, 7]);
  assert.deepEqual(resolveChord(0, 'sus', []), [0, 5, 7]);
  assert.deepEqual(resolveChord(0, 'dim', []), [0, 3, 6]);
});

test('extended dominant-family types are complete formulas, not additive', () => {
  assert.deepEqual(resolveChord(0, 'dom7', []), [0, 4, 7, 10]); // 1 3 5 b7
  assert.deepEqual(resolveChord(0, 'add9', []), [0, 4, 7, 14]); // 1 3 5 9, no 7th
  assert.deepEqual(resolveChord(0, 'dom7sharp9', []), [0, 4, 10, 15]); // 1 3 b7 #9, no 5
  assert.deepEqual(resolveChord(0, 'dom7sharp11', []), [0, 4, 10, 18]); // 1 3 b7 #11, no 5
});

test('extended types still compose with the additive modifiers', () => {
  // dom7 (1,3,5,b7) + 9 modifier -> proper 9 chord, no redundant implied m7
  assert.deepEqual(resolveChord(0, 'dom7', ['9']), [0, 4, 7, 10, 14]);
});

test('modifiers add their interval on top of the triad', () => {
  assert.deepEqual(resolveChord(0, 'major', ['6']), [0, 4, 7, 9]);
  assert.deepEqual(resolveChord(0, 'major', ['m7']), [0, 4, 7, 10]);
  assert.deepEqual(resolveChord(0, 'major', ['maj7']), [0, 4, 7, 11]);
});

test('9 without a 7th silently implies m7, without exposing it', () => {
  const result = resolveChord(0, 'major', ['9']);
  assert.deepEqual(result, [0, 4, 7, 10, 14]);
});

test('9 with maj7 explicitly selected keeps maj7, does not add m7', () => {
  const result = resolveChord(0, 'major', ['maj7', '9']);
  assert.deepEqual(result, [0, 4, 7, 11, 14]);
});

test('9 with m7 explicitly selected does not double up', () => {
  const result = resolveChord(0, 'major', ['m7', '9']);
  assert.deepEqual(result, [0, 4, 7, 10, 14]);
});

test('6 combines freely with anything, including "unusual" combos', () => {
  const result = resolveChord(0, 'dim', ['6', '9']);
  // dim [0,3,6] + 6(9) + implied m7(10) + 9(14) — no theory gate blocks this
  assert.deepEqual(result, [0, 3, 6, 9, 10, 14]);
});

test('m7 and maj7 both selected produces both tones (resolver does not enforce UI exclusivity)', () => {
  assert.deepEqual(resolveChord(0, 'major', ['m7', 'maj7']), [0, 4, 7, 10, 11]);
});

test('stacking every modifier still yields distinct, sorted pitch classes', () => {
  const result = resolveChord(0, 'major', ['6', 'm7', 'maj7', '9']);
  const pitchClasses = result.map((i) => ((i % 12) + 12) % 12);
  assert.deepEqual(pitchClasses, [...new Set(pitchClasses)]); // no duplicates
  assert.deepEqual(result, [...result].sort((a, b) => a - b)); // sorted
});

test('output is root-relative regardless of root pitch class', () => {
  assert.deepEqual(resolveChord(7, 'major', []), resolveChord(0, 'major', []));
});

test('unknown chord type throws', () => {
  assert.throws(() => resolveChord(0, 'blorp', []));
});

test('every CHORD_TYPES and EXTENDED_TYPES entry has a TYPE_INTERVALS formula', () => {
  for (const type of [...CHORD_TYPES, ...EXTENDED_TYPES]) {
    assert.ok(Array.isArray(TYPE_INTERVALS[type]), `missing TYPE_INTERVALS for "${type}"`);
  }
});
