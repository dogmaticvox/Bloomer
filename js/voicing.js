// Voicing dial — pure function, no audio.
//
// computeVoicing() walks a chord's absolute MIDI notes through inversions:
// each dial step moves the lowest note up an octave (or the highest note
// down, for negative values). Because every step operates on whichever
// note is currently most extreme, a full inversion cycle (one step per
// chord tone) naturally ends with the entire chord shifted by one octave —
// no separate "cycle complete, now shift register" logic needed.

export const DEFAULT_OCTAVE = 4;
export const MIDI_C4 = 60; // octave 4 reference

/** Absolute MIDI notes for a resolved chord at the default register. */
export function baseNotesForRoot(root, intervals, octave = DEFAULT_OCTAVE) {
  const rootMidi = MIDI_C4 + root + (octave - DEFAULT_OCTAVE) * 12;
  return intervals.map((i) => rootMidi + i);
}

/**
 * @param {number[]} baseIntervals - absolute MIDI notes at dial value 0
 * @param {number} dialValue - integer, roughly -12..+12
 * @returns {number[]} absolute MIDI notes, ascending
 */
export function computeVoicing(baseIntervals, dialValue) {
  let notes = [...baseIntervals].sort((a, b) => a - b);
  const steps = Math.round(dialValue);
  if (steps === 0 || notes.length === 0) return notes;

  const direction = steps > 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(steps); i++) {
    if (direction > 0) {
      const lowest = notes.shift();
      notes.push(lowest + 12);
    } else {
      const highest = notes.pop();
      notes.unshift(highest - 12);
    }
  }
  return notes;
}
