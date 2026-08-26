// node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPerformancePlan } from '../js/performance-modes.js';

const CHORD = [67, 60, 64]; // unsorted on purpose — plan should sort

test('block: all notes onset at time 0', () => {
  const plan = buildPerformancePlan('block', CHORD);
  assert.equal(plan.kind, 'onsets');
  assert.deepEqual(plan.onsets, [
    { note: 60, time: 0 },
    { note: 64, time: 0 },
    { note: 67, time: 0 },
  ]);
});

test('altBass: root at t=0, rest of the chord at the subdivision', () => {
  const plan = buildPerformancePlan('altBass', CHORD, { subdivisionSec: 0.25 });
  assert.deepEqual(plan.onsets, [
    { note: 60, time: 0 },
    { note: 64, time: 0.25 },
    { note: 67, time: 0.25 },
  ]);
});

test('strum: notes staggered low-to-high by the strum step', () => {
  const plan = buildPerformancePlan('strum', CHORD, { strumStepSec: 0.02 });
  assert.deepEqual(plan.onsets, [
    { note: 60, time: 0 },
    { note: 64, time: 0.02 },
    { note: 67, time: 0.04 },
  ]);
});

test('arp: up order is ascending', () => {
  const plan = buildPerformancePlan('arp', CHORD, { order: 'up', arpStepSec: 0.1 });
  assert.equal(plan.kind, 'arp');
  assert.deepEqual(plan.notes, [60, 64, 67]);
  assert.equal(plan.stepSec, 0.1);
});

test('arp: down order is descending', () => {
  const plan = buildPerformancePlan('arp', CHORD, { order: 'down' });
  assert.deepEqual(plan.notes, [67, 64, 60]);
});

test('arp: upDown does not repeat the endpoints', () => {
  const plan = buildPerformancePlan('arp', [60, 64, 67, 70], { order: 'upDown' });
  assert.deepEqual(plan.notes, [60, 64, 67, 70, 67, 64]);
});

test('arp: upDown on a 2-note chord has nothing to fold back', () => {
  const plan = buildPerformancePlan('arp', [60, 67], { order: 'upDown' });
  assert.deepEqual(plan.notes, [60, 67]);
});
