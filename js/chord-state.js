// The canonical resolve → voice pipeline, shared by live play and
// progression playback so a recorded chord sounds identical to how it was
// played (§6 of the build doc).

import { resolveChord } from './chord-theory.js';
import { baseNotesForRoot, computeVoicing, MIDI_C4 } from './voicing.js';

/**
 * @param {{root:number, type:string, modifiers:Iterable<string>, voicing:number, slashRoot?:number|null}} state
 * @returns {number[]} absolute MIDI notes, voiced
 */
export function chordStateToNotes(state) {
  const intervals = resolveChord(state.root, state.type, state.modifiers);
  const base = baseNotesForRoot(state.root, intervals);

  // Slash chord: substitute the root tone (always base[0] — intervals are
  // sorted ascending and the root's own interval is always 0) with a bass
  // note of the chosen pitch class, placed an octave below so it stays the
  // lowest note regardless of the original root's register.
  if (state.slashRoot != null && state.slashRoot !== state.root) {
    base[0] = MIDI_C4 - 12 + state.slashRoot;
  }

  return computeVoicing(base, state.voicing);
}
