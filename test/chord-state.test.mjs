// node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';

import { chordStateToNotes } from '../js/chord-state.js';

function state(overrides = {}) {
  return { root: 0, type: 'major', modifiers: [], voicing: 0, slashRoot: null, ...overrides };
}

test('every chord gets a bass note one octave below the root', () => {
  // C major: root-position triad is [60,64,67]; bass adds C3 = 48
  assert.deepEqual(chordStateToNotes(state()), [48, 60, 64, 67]);
});

test('bass note follows the root to a different pitch class', () => {
  // D major (root=2): triad [62,66,69], bass D3 = 50
  assert.deepEqual(chordStateToNotes(state({ root: 2 })), [50, 62, 66, 69]);
});

test('slash substitutes the bass pitch class, still an octave below the chord', () => {
  // C major / E: bass becomes E3 = 52, upper triad C4 E4 G4 unchanged
  assert.deepEqual(chordStateToNotes(state({ slashRoot: 4 })), [52, 60, 64, 67]);
});

test('slash equal to the root is a no-op', () => {
  assert.deepEqual(chordStateToNotes(state({ slashRoot: 0 })), chordStateToNotes(state({ slashRoot: null })));
});

test('slash bass is always below the upper chord, regardless of pitch class chosen', () => {
  for (let slashRoot = 0; slashRoot < 12; slashRoot++) {
    const notes = chordStateToNotes(state({ slashRoot }));
    const [bass, ...rest] = notes;
    assert.ok(bass < Math.min(...rest), `bass ${bass} should be below ${rest}`);
  }
});

test('the voicing dial applies to the full bass+chord stack', () => {
  // C major with bass: [48,60,64,67] (4 tones) — dial +1 inverts the lowest
  assert.deepEqual(chordStateToNotes(state({ voicing: 1 })), [60, 64, 67, 60]);
});
