// Audio engine — wraps Tone.js. Owns the synth voice and turns a
// performance-mode plan (see performance-modes.js) into actual note-on /
// note-off calls. Both live play and recorded playback call the same
// triggerVoice()/releaseVoice() pair, so a played-back chord sounds
// identical to how it sounded live.
//
// Every time in this module is AudioContext time (seconds, the same clock
// as Tone.now()). The Transport is deliberately not used: mixing its
// position with context time is what made playback go silent on devices
// whose AudioContext was already running before the first tap.

import { buildPerformancePlan } from './performance-modes.js';

const MIN_HOLD_SEC = 0.12; // floor for recorded chord duration

let synth = null;
let startPromise = null;
const liveHandles = new Set(); // every voice not yet fully released

function ctx() {
  return Tone.getContext();
}

function createSynth() {
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
    envelope: { attack: 0.012, decay: 0.18, sustain: 0.55, release: 0.9 },
  });
  const filter = new Tone.Filter({ frequency: 2600, type: 'lowpass', rolloff: -12 });
  synth.connect(filter);
  filter.toDestination();
  synth.volume.value = -8;
}

/** True once the synth exists and the AudioContext is actually running. */
export function isReady() {
  return synth !== null && ctx().state === 'running';
}

/**
 * Start (or resume) audio. Safe to call repeatedly and concurrently. Must
 * be reached from a user gesture — note that on touch screens only
 * pointerup/touchend/click count, not pointerdown (see unlockOnGesture).
 */
export function ensureAudioStarted() {
  if (!synth) createSynth();
  if (ctx().state === 'running') return Promise.resolve();
  // A fresh resume() on every call — one made outside a real gesture can
  // sit pending forever, so a later gesture has to be able to ask again.
  Tone.start().catch(() => {});
  if (!startPromise) {
    const raw = ctx().rawContext;
    startPromise = new Promise((resolve) => {
      const onChange = () => {
        if (raw.state !== 'running') return;
        raw.removeEventListener('statechange', onChange);
        startPromise = null;
        resolve();
      };
      raw.addEventListener('statechange', onChange);
      onChange();
    });
  }
  return startPromise;
}

/**
 * Browsers only let audio start on "activation" events, and for touch input
 * pointerdown/touchstart are not among them — so a key's pointerdown alone
 * can never unlock audio on a phone. Resume on every gesture that does
 * count while the context isn't running (this also recovers after Android
 * suspends audio when the app is backgrounded).
 */
export function unlockOnGesture(target = document) {
  const unlock = () => {
    if (ctx().state !== 'running') ensureAudioStarted();
  };
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    target.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

/** Current audio time (seconds) — pass as `startTime` for "now". */
export function now() {
  return Tone.now();
}

/**
 * Run `fn` when audio time `time` is about to happen (Tone's lookahead
 * window). Returns an id for cancelTimer().
 */
export function scheduleAt(fn, time) {
  return ctx().setTimeout(fn, Math.max(0, time - ctx().now()));
}

export function cancelTimer(id) {
  ctx().clearTimeout(id);
}

/** Run a UI callback in sync with audio time `time` (on an animation frame). */
export function drawAt(fn, time) {
  Tone.getDraw().schedule(fn, time);
}

function midiToFreq(note) {
  return Tone.Frequency(note, 'midi').toFrequency();
}

function startOnsets(plan, startTime) {
  const handle = { kind: 'onsets', notes: [], released: false };
  handle.notes = plan.onsets.map(({ note, time }) => {
    const entry = { freq: midiToFreq(note), time: startTime + time, timer: null, attacked: false, releaseAt: null };
    const attack = () => {
      entry.timer = null;
      entry.attacked = true;
      synth.triggerAttack(entry.freq, entry.time);
      if (entry.releaseAt !== null) synth.triggerRelease(entry.freq, entry.releaseAt);
      forgetIfDone(handle);
    };
    if (entry.time <= ctx().now()) attack();
    else entry.timer = scheduleAt(attack, entry.time);
    return entry;
  });
  return handle;
}

// An onsets handle stays tracked until it's released and every note that
// will ever start has started, so stopAll() can still cancel stragglers.
function forgetIfDone(handle) {
  if (handle.released && handle.notes.every((e) => e.timer === null)) liveHandles.delete(handle);
}

function startArp(plan, startTime) {
  const handle = { kind: 'arp', nextTime: startTime, step: 0, stopAt: Infinity, timer: null, released: false };
  const tick = () => {
    handle.timer = null;
    while (handle.nextTime < handle.stopAt && handle.nextTime <= ctx().now()) {
      const note = plan.notes[handle.step % plan.notes.length];
      synth.triggerAttackRelease(midiToFreq(note), plan.stepSec * 0.92, handle.nextTime);
      handle.step++;
      handle.nextTime += plan.stepSec;
    }
    if (handle.nextTime < handle.stopAt) handle.timer = scheduleAt(tick, handle.nextTime);
    else liveHandles.delete(handle);
  };
  tick();
  return handle;
}

/**
 * Trigger a voiced chord through the given performance mode, starting at
 * audio time `startTime` (seconds — see now()). Returns a handle to pass to
 * releaseVoice().
 */
export function triggerVoice(notes, mode, modeOpts, startTime) {
  const plan = buildPerformancePlan(mode, notes, modeOpts);
  const handle = plan.kind === 'arp' ? startArp(plan, startTime) : startOnsets(plan, startTime);
  liveHandles.add(handle);
  return handle;
}

/** Release everything from a triggerVoice() handle at audio time `time`. */
export function releaseVoice(handle, time) {
  if (!handle || !liveHandles.has(handle) || handle.released) return;

  if (handle.kind === 'arp') {
    handle.released = true;
    handle.stopAt = time;
    // Steps before `time` still sound — the tick loop stops itself once it
    // reaches stopAt. If nothing is left before it, stop right here.
    if (handle.nextTime >= time) {
      if (handle.timer !== null) cancelTimer(handle.timer);
      handle.timer = null;
      liveHandles.delete(handle);
    }
    return;
  }

  handle.released = true;
  for (const entry of handle.notes) {
    if (entry.releaseAt !== null) continue;
    if (!entry.attacked && entry.time >= time) {
      // Never started — e.g. a strum released before its top note.
      cancelTimer(entry.timer);
      entry.timer = null;
      continue;
    }
    // A note is never released before it starts, or it would be left
    // hanging once its (later) attack lands.
    entry.releaseAt = Math.max(time, entry.time + 0.005);
    if (entry.attacked) synth.triggerRelease(entry.freq, entry.releaseAt);
  }
  forgetIfDone(handle);
}

/** Immediately silence everything, including notes queued for later. */
export function stopAll() {
  if (!synth) return;
  for (const handle of liveHandles) {
    if (handle.kind === 'arp') {
      handle.stopAt = -Infinity;
      if (handle.timer !== null) cancelTimer(handle.timer);
    } else {
      for (const entry of handle.notes) {
        if (entry.timer !== null) cancelTimer(entry.timer);
        entry.timer = null;
      }
    }
  }
  liveHandles.clear();
  synth.releaseAll();
}

export { MIN_HOLD_SEC };
