// Audio engine — wraps Tone.js. Owns the synth voice and turns a
// performance-mode plan (see performance-modes.js) into actual note-on /
// note-off calls. Both live play and recorded playback call the same
// triggerVoice()/releaseVoice() pair, so a played-back chord sounds
// identical to how it sounded live.

import { buildPerformancePlan } from './performance-modes.js';

const MIN_HOLD_SEC = 0.12; // floor for recorded chord duration

let synth = null;
let started = false;

export function isReady() {
  return started;
}

/** Must be called from a user gesture (audio can't start otherwise). */
export async function ensureAudioStarted() {
  if (started) return;
  await Tone.start();
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
    envelope: { attack: 0.012, decay: 0.18, sustain: 0.55, release: 0.9 },
  });
  const filter = new Tone.Filter({ frequency: 2600, type: 'lowpass', rolloff: -12 });
  synth.connect(filter);
  filter.toDestination();
  synth.volume.value = -8;
  // Runs continuously as a free clock — nothing here is transport-position
  // (bars/beats) based, but scheduleOnce()/Loop only advance while it's
  // playing, so it has to be started once, up front.
  Tone.getTransport().start();
  started = true;
}

/** Current transport time (seconds) — pass as `startTime` for "now". */
export function now() {
  return Tone.getTransport().seconds;
}

function midiToFreq(note) {
  return Tone.Frequency(note, 'midi').toFrequency();
}

/**
 * Trigger a voiced chord through the given performance mode, starting at
 * transport time `startTime` (seconds — see now()). Returns a handle to
 * pass to releaseVoice().
 */
export function triggerVoice(notes, mode, modeOpts, startTime) {
  const plan = buildPerformancePlan(mode, notes, modeOpts);
  const scheduledIds = [];

  if (plan.kind === 'onsets') {
    for (const { note, time } of plan.onsets) {
      const id = Tone.getTransport().scheduleOnce((t) => {
        synth.triggerAttack(midiToFreq(note), t);
      }, startTime + time);
      scheduledIds.push(id);
    }
    return { kind: 'onsets', notes: plan.onsets.map((o) => o.note), scheduledIds };
  }

  // arp: repeat the ordered note cycle until released
  let step = 0;
  const loop = new Tone.Loop((t) => {
    const note = plan.notes[step % plan.notes.length];
    synth.triggerAttackRelease(midiToFreq(note), plan.stepSec * 0.92, t);
    step++;
  }, plan.stepSec);
  loop.start(startTime);
  return { kind: 'arp', loop, notes: plan.notes };
}

/** Release everything from a triggerVoice() handle at transport time `time`. */
export function releaseVoice(handle, time) {
  if (!handle) return;
  if (handle.kind === 'arp') {
    handle.loop.stop(time);
    handle.loop.dispose();
    return;
  }
  for (const id of handle.scheduledIds) Tone.getTransport().clear(id);
  const freqs = handle.notes.map(midiToFreq);
  synth.triggerRelease(freqs, time);
}

/** Immediately silence every currently-sounding note (safety net for a global stop). */
export function stopAll() {
  if (!synth) return;
  synth.releaseAll();
}

export { MIN_HOLD_SEC };
