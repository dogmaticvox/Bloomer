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

  // Every chord gets a bass note one octave below its root — a slash pick
  // substitutes that bass note's pitch class instead of the root's, still
  // an octave below the main chord. Always strictly below base[0] (which
  // sits at MIDI_C4 + root, octave 4): the bass note lives in octave 3
  // (MIDI_C4 - 12 + pitch class, i.e. 48-59), below base[0]'s 60-71 range.
  const bassPitchClass = state.slashRoot != null ? state.slashRoot : state.root;
  const bassNote = MIDI_C4 - 12 + bassPitchClass;

  return computeVoicing([bassNote, ...base], state.voicing);
}
