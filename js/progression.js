// Progression recording & playback (§6). A progression is a plain,
// serializable array of chord-state snapshots plus a held duration —
// simple enough that exporting it later is a non-event.

import { chordStateToNotes } from './chord-state.js';
import * as audioEngine from './audio-engine.js';

/**
 * @typedef {object} ProgressionItem
 * @property {number} root
 * @property {string} type
 * @property {string[]} modifiers
 * @property {number} voicing
 * @property {string} performanceMode
 * @property {object} modeOpts - snapshotted at record time (tempo-derived
 *   seconds), so playback matches what was actually heard live.
 * @property {number} tempo - BPM at record time; durations are shown and
 *   edited in beats of this tempo.
 * @property {number} duration - seconds the chord lasts (held time, or edited)
 */

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 2;
export const BEAT_STEP = 0.5; // −/+ nudge a chord's length by half a beat
export const MIN_BEATS = 0.25;

const GAP_SEC = 0.02; // release a hair early so repeated notes re-articulate

/** Seconds a chord lasts at a given playback speed (1 = as recorded). */
export function effectiveDuration(item, speed = 1) {
  return item.duration / speed;
}

/** Performance-mode timings (strum/arp/alt-bass) scaled to playback speed. */
export function scaleModeOpts(modeOpts = {}, speed = 1) {
  const scaled = { ...modeOpts };
  for (const key of ['subdivisionSec', 'strumStepSec', 'arpStepSec']) {
    if (typeof scaled[key] === 'number') scaled[key] /= speed;
  }
  return scaled;
}

export function durationToBeats(item) {
  return (item.duration * item.tempo) / 60;
}

export function beatsToDuration(beats, tempo) {
  return (beats * 60) / tempo;
}

/**
 * Nudge a length in beats by one BEAT_STEP, snapping onto the BEAT_STEP
 * grid first — so an as-played 1.37 beats goes to 1.5 (+) or 1 (−).
 * Never goes below MIN_BEATS (or below the current length, if that's
 * already shorter).
 * @param {number} beats
 * @param {1|-1} direction
 */
export function stepBeats(beats, direction) {
  const EPS = 1e-6;
  const next = direction > 0
    ? (Math.floor(beats / BEAT_STEP + EPS) + 1) * BEAT_STEP
    : (Math.ceil(beats / BEAT_STEP - EPS) - 1) * BEAT_STEP;
  return Math.max(next, Math.min(beats, MIN_BEATS));
}

/**
 * Play a recorded progression. Chords are scheduled one at a time, each
 * reading the list and the speed afresh, so edits, removals and speed
 * changes take effect from the next chord onward — even mid-loop.
 * @param {() => ProgressionItem[]} getItems
 * @param {{
 *   loop?: () => boolean,
 *   speed?: () => number,
 *   onStep?: (index:number) => void,
 *   onDone?: () => void,
 * }} opts
 * @returns {{stop(): void}}
 */
export function scheduleProgression(getItems, { loop = () => false, speed = () => 1, onStep, onDone } = {}) {
  let stopped = false;
  let timer = null;

  function finish() {
    if (stopped) return;
    stopped = true;
    onDone?.();
  }

  // Queue chord `index` to start at audio time `time`.
  function queue(index, time) {
    timer = audioEngine.scheduleAt(() => play(index, time), time);
  }

  function play(index, time) {
    timer = null;
    if (stopped) return;

    const items = getItems();
    if (index >= items.length) {
      if (items.length > 0 && loop()) {
        play(0, time);
      } else {
        audioEngine.drawAt(finish, time);
      }
      return;
    }

    const item = items[index];
    const rate = speed();
    const duration = Math.max(effectiveDuration(item, rate), 0.05);
    const handle = audioEngine.triggerVoice(chordStateToNotes(item), item.performanceMode, scaleModeOpts(item.modeOpts, rate), time);
    audioEngine.drawAt(() => { if (!stopped) onStep?.(index); }, time);

    const end = time + duration;
    audioEngine.releaseVoice(handle, end - Math.min(GAP_SEC, duration / 4));
    queue(index + 1, end);
  }

  if (getItems().length === 0) {
    onDone?.();
    return { stop() {} };
  }
  queue(0, audioEngine.now() + 0.05);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== null) audioEngine.cancelTimer(timer);
      audioEngine.stopAll();
    },
  };
}
