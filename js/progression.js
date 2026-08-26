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
 * @property {number} duration - seconds the chord was held
 */

/**
 * Schedule a recorded progression on the Tone Transport.
 * @param {ProgressionItem[]} items
 * @param {{loop?: boolean, onStep?: (index:number)=>void, onDone?: () => void}} opts
 * @returns {{stop(): void}}
 */
export function scheduleProgression(items, { loop = false, onStep, onDone } = {}) {
  const transport = Tone.getTransport();
  if (items.length === 0) return { stop() {} };

  const totalDuration = Math.max(items.reduce((sum, it) => sum + it.duration, 0), 0.05);
  const startTime = audioEngine.now() + 0.05;

  const pendingIds = [];
  const activeHandles = new Set();
  let repeatId = null;
  let stopped = false;

  function scheduleCycle(cycleStart) {
    let offset = 0;
    items.forEach((item, index) => {
      const chordStart = cycleStart + offset;
      const notes = chordStateToNotes(item);
      const holdSec = Math.max(item.duration - 0.02, 0.02);

      const attackId = transport.scheduleOnce((t) => {
        const handle = audioEngine.triggerVoice(notes, item.performanceMode, item.modeOpts, t);
        activeHandles.add(handle);
        onStep?.(index);

        const releaseId = transport.scheduleOnce((rt) => {
          audioEngine.releaseVoice(handle, rt);
          activeHandles.delete(handle);
        }, chordStart + holdSec);
        pendingIds.push(releaseId);
      }, chordStart);
      pendingIds.push(attackId);

      offset += item.duration;
    });

    if (!loop) {
      const endId = transport.scheduleOnce(() => {
        if (repeatId !== null) transport.clear(repeatId);
        onDone?.();
      }, cycleStart + offset + 0.001);
      pendingIds.push(endId);
    }
  }

  repeatId = transport.scheduleRepeat((cycleStart) => scheduleCycle(cycleStart), totalDuration, startTime);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (repeatId !== null) transport.clear(repeatId);
      for (const id of pendingIds) transport.clear(id);
      const now = transport.seconds;
      for (const handle of activeHandles) audioEngine.releaseVoice(handle, now);
      activeHandles.clear();
      audioEngine.stopAll();
    },
  };
}
