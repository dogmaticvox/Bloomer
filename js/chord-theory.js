// Chord theory engine — pure functions, no UI, no audio.
// resolveChord() turns (root, type, modifiers) into a deduplicated array of
// semitone offsets from the root, before any octave placement.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const CHORD_TYPES = ['major', 'minor', 'sus', 'dim'];

export const TYPE_INTERVALS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  sus: [0, 5, 7], // sus4 (see build doc §7 — sus2 not implemented)
  dim: [0, 3, 6],
};

export const MODIFIERS = ['6', 'm7', 'maj7', '9'];

// Interval added on top of the base triad, in semitones from the root.
export const MODIFIER_INTERVALS = {
  '6': 9,
  m7: 10,
  maj7: 11,
  '9': 14,
};

/**
 * Resolve a chord to its semitone offsets from the root (root always 0).
 * @param {number} root - pitch class 0-11 (unused by the resolver itself,
 *   kept in the signature so callers can pass a full chord-state shape;
 *   the returned offsets are root-relative regardless of root's value).
 * @param {"major"|"minor"|"sus"|"dim"} type
 * @param {Iterable<"6"|"m7"|"maj7"|"9">} modifiers
 * @returns {number[]} ascending, deduplicated (mod 12) semitone offsets
 */
export function resolveChord(root, type, modifiers = []) {
  const base = TYPE_INTERVALS[type];
  if (!base) throw new Error(`Unknown chord type: ${type}`);

  const selected = new Set(modifiers);

  // A "9" chord implies a minor 7th underneath it unless a 7th is already
  // present — standard jazz convention. This is resolver-internal only: it
  // never mutates the caller's modifier set, so the UI never lights up m7.
  const effective = new Set(selected);
  if (effective.has('9') && !effective.has('m7') && !effective.has('maj7')) {
    effective.add('m7');
  }

  const intervals = [...base];
  // Fixed iteration order keeps output deterministic regardless of the
  // input Set's insertion order.
  for (const mod of MODIFIERS) {
    if (effective.has(mod)) intervals.push(MODIFIER_INTERVALS[mod]);
  }

  const seenPitchClasses = new Set();
  const result = [];
  for (const interval of intervals) {
    const pitchClass = ((interval % 12) + 12) % 12;
    if (seenPitchClasses.has(pitchClass)) continue;
    seenPitchClasses.add(pitchClass);
    result.push(interval);
  }

  return result.sort((a, b) => a - b);
}
