// Performance modes — pure planning functions. Turns a voiced chord
// (absolute MIDI notes) into a schedule the audio engine can trigger.
// No Tone.js, no timing side effects, no hardcoded tempo — the caller
// resolves tempo/subdivisions into seconds before calling in.

export const PERFORMANCE_MODES = ['block', 'altBass', 'strum', 'arp'];
export const ARP_ORDERS = ['up', 'down', 'upDown'];

function orderNotes(notes, order) {
  switch (order) {
    case 'down':
      return [...notes].reverse();
    case 'upDown': {
      if (notes.length <= 2) return [...notes];
      const down = [...notes].reverse().slice(1, -1);
      return [...notes, ...down];
    }
    case 'up':
    default:
      return [...notes];
  }
}

/**
 * @param {"block"|"altBass"|"strum"|"arp"} mode
 * @param {number[]} notes - absolute MIDI notes (any order)
 * @param {object} opts
 * @param {number} [opts.subdivisionSec] - altBass: delay before the rest of
 *   the chord comes in after the bass note.
 * @param {number} [opts.strumStepSec] - strum: delay between consecutive
 *   notes, low to high.
 * @param {number} [opts.arpStepSec] - arp: delay between consecutive notes
 *   in the cycle.
 * @param {"up"|"down"|"upDown"} [opts.order] - arp note order.
 * @returns {{kind:'onsets', onsets:{note:number, time:number}[]} |
 *           {kind:'arp', notes:number[], stepSec:number}}
 */
export function buildPerformancePlan(mode, notes, opts = {}) {
  const sorted = [...notes].sort((a, b) => a - b);

  switch (mode) {
    case 'block':
      return { kind: 'onsets', onsets: sorted.map((note) => ({ note, time: 0 })) };

    case 'altBass': {
      if (sorted.length === 0) return { kind: 'onsets', onsets: [] };
      const subdivisionSec = opts.subdivisionSec ?? 0.2;
      const [bass, ...rest] = sorted;
      const onsets = [{ note: bass, time: 0 }, ...rest.map((note) => ({ note, time: subdivisionSec }))];
      return { kind: 'onsets', onsets };
    }

    case 'strum': {
      const strumStepSec = opts.strumStepSec ?? 0.03;
      return { kind: 'onsets', onsets: sorted.map((note, i) => ({ note, time: i * strumStepSec })) };
    }

    case 'arp':
      return {
        kind: 'arp',
        notes: orderNotes(sorted, opts.order ?? 'up'),
        stepSec: opts.arpStepSec ?? 0.15,
      };

    default:
      return { kind: 'onsets', onsets: sorted.map((note) => ({ note, time: 0 })) };
  }
}
