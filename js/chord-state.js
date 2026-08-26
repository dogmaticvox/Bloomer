// The canonical resolve → voice pipeline, shared by live play and
// progression playback so a recorded chord sounds identical to how it was
// played (§6 of the build doc).

import { resolveChord } from './chord-theory.js';
import { baseNotesForRoot, computeVoicing } from './voicing.js';

/**
 * @param {{root:number, type:string, modifiers:Iterable<string>, voicing:number}} state
 * @returns {number[]} absolute MIDI notes, voiced
 */
export function chordStateToNotes(state) {
  const intervals = resolveChord(state.root, state.type, state.modifiers);
  const base = baseNotesForRoot(state.root, intervals);
  return computeVoicing(base, state.voicing);
}
