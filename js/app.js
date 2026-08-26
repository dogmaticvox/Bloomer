import { NOTE_NAMES, CHORD_TYPES, MODIFIERS } from './chord-theory.js';
import { chordStateToNotes } from './chord-state.js';
import { PERFORMANCE_MODES } from './performance-modes.js';
import * as audioEngine from './audio-engine.js';
import { scheduleProgression } from './progression.js';

const $ = (sel, root = document) => root.querySelector(sel);

const el = {
  keyboard: $('#keyboard'),
  rootLabel: $('#root-label'),
  chordName: $('#chord-name'),
  typeRow: $('#type-row'),
  modifierRow: $('#modifier-row'),
  modeRow: $('#mode-row'),
  dial: $('#voicing-dial'),
  dialNeedle: $('#dial-needle'),
  voicingValue: $('#voicing-value'),
  voicingSub: $('#voicing-sub'),
  voicingReset: $('#voicing-reset'),
  tempo: $('#tempo'),
  tempoVal: $('#tempo-val'),
  strumRow: $('#strum-row'),
  strumSpeed: $('#strum-speed'),
  strumSpeedVal: $('#strum-speed-val'),
  arpRow: $('#arp-row'),
  recBtn: $('#rec-btn'),
  playProgBtn: $('#play-prog-btn'),
  loopToggle: $('#loop-toggle'),
  clearProgBtn: $('#clear-prog-btn'),
  progressionList: $('#progression-list'),
  progressionCount: $('#progression-count'),
  progressionHint: $('#progression-hint'),
};

const TYPE_LABELS = { major: 'MAJ', minor: 'MIN', sus: 'SUS', dim: 'DIM' };
const TYPE_NAMES = { major: 'MAJOR', minor: 'MINOR', sus: 'SUS', dim: 'DIM' };
const MODIFIER_LABELS = { '6': '6', m7: 'm7', maj7: 'Maj7', '9': '9' };
const MODIFIER_SYMBOL = { '6': ' 6', m7: ' 7', maj7: ' Δ7', '9': ' 9' };
const MODE_LABELS = { block: 'BLOCK', altBass: 'ALT BASS', strum: 'STRUM', arp: 'ARP' };
const MODE_ABBR = { block: '', altBass: 'B/C', strum: 'STR', arp: 'ARP' };

const state = {
  root: 0,
  type: 'major',
  modifiers: new Set(),
  voicing: 0,
  performanceMode: 'block',
  tempo: 100,
  strumSpeed: 40,
  arpDivision: '8n',
  arpOrder: 'up',
};

let progression = [];
let recording = false;
let activeVoice = null; // { root, handle, startedAt, snapshot, modeOpts }
let playback = null; // { stop() } while progression is playing

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function chordNameText(chordState) {
  const mods = [...chordState.modifiers].map((m) => MODIFIER_SYMBOL[m]).join('');
  return `${NOTE_NAMES[chordState.root]} ${TYPE_NAMES[chordState.type]}${mods}`;
}

function computeModeOpts() {
  const beatSec = 60 / state.tempo;
  const eighthSec = beatSec / 2;
  const sixteenthSec = beatSec / 4;
  const strumStepSec = lerp(0.008, sixteenthSec, state.strumSpeed / 100);
  return {
    subdivisionSec: eighthSec,
    strumStepSec,
    arpStepSec: state.arpDivision === '16n' ? sixteenthSec : eighthSec,
    order: state.arpOrder,
  };
}

// ------------------------------------------------------------- keyboard

const WHITE_ORDER = [0, 2, 4, 5, 7, 9, 11];
const BLACK_CENTER = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };
const WHITE_W = 100 / 7;
const BLACK_W = WHITE_W * 0.6;

function buildKeyboard() {
  el.keyboard.innerHTML = '';
  WHITE_ORDER.forEach((pc, i) => {
    const key = document.createElement('div');
    key.className = 'key key-white';
    key.dataset.note = String(pc);
    key.style.left = `${i * WHITE_W}%`;
    key.style.width = `${WHITE_W}%`;
    const label = document.createElement('span');
    label.className = 'key-label';
    label.textContent = NOTE_NAMES[pc];
    key.appendChild(label);
    el.keyboard.appendChild(key);
  });
  Object.entries(BLACK_CENTER).forEach(([pcStr, centerUnit]) => {
    const pc = Number(pcStr);
    const key = document.createElement('div');
    key.className = 'key key-black';
    key.dataset.note = String(pc);
    key.style.left = `${centerUnit * WHITE_W - BLACK_W / 2}%`;
    key.style.width = `${BLACK_W}%`;
    el.keyboard.appendChild(key);
  });

  el.keyboard.querySelectorAll('.key').forEach((key) => {
    const pc = Number(key.dataset.note);
    key.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      key.setPointerCapture(e.pointerId);
      pressKey(pc);
    });
    key.addEventListener('pointerup', () => releaseKey(pc));
    key.addEventListener('pointercancel', () => releaseKey(pc));
  });
}

function updateKeyboardUI() {
  el.keyboard.querySelectorAll('.key').forEach((key) => {
    const pc = Number(key.dataset.note);
    key.classList.toggle('is-root', pc === state.root);
    key.classList.toggle('is-active', activeVoice != null && pc === activeVoice.root);
  });
  el.rootLabel.textContent = NOTE_NAMES[state.root];
}

// ------------------------------------------------------------ chord UI

function buildTypeRow() {
  el.typeRow.innerHTML = '';
  for (const type of CHORD_TYPES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn';
    btn.textContent = TYPE_LABELS[type];
    btn.setAttribute('role', 'radio');
    btn.dataset.type = type;
    btn.addEventListener('click', () => {
      state.type = type;
      updateChordUI();
    });
    el.typeRow.appendChild(btn);
  }
}

function buildModifierRow() {
  el.modifierRow.className = 'seg-row modifier-row';
  el.modifierRow.innerHTML = '';
  for (const mod of MODIFIERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn';
    btn.textContent = MODIFIER_LABELS[mod];
    btn.dataset.mod = mod;
    btn.addEventListener('click', () => {
      if (state.modifiers.has(mod)) {
        state.modifiers.delete(mod);
      } else {
        // m7 / Maj7 occupy the same "7th slot" — selecting one clears the other.
        if (mod === 'm7') state.modifiers.delete('maj7');
        if (mod === 'maj7') state.modifiers.delete('m7');
        state.modifiers.add(mod);
      }
      updateChordUI();
    });
    el.modifierRow.appendChild(btn);
  }
}

function updateChordUI() {
  el.typeRow.querySelectorAll('.seg-btn').forEach((btn) => {
    const active = btn.dataset.type === state.type;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });
  el.modifierRow.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('is-active', state.modifiers.has(btn.dataset.mod));
  });
  el.chordName.textContent = chordNameText(state);
}

// ---------------------------------------------------------- voicing dial

function voicingSubText(value) {
  if (value === 0) return 'root position';
  return value > 0 ? `${value} up` : `${Math.abs(value)} down`;
}

function updateDialUI() {
  const angle = (state.voicing / 12) * 150;
  el.dialNeedle.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
  el.voicingValue.textContent = String(state.voicing);
  el.voicingSub.textContent = voicingSubText(state.voicing);
  el.dial.setAttribute('aria-valuenow', String(state.voicing));
  el.dial.setAttribute('aria-valuetext', `${state.voicing}, ${voicingSubText(state.voicing)}`);
}

function setVoicing(value) {
  state.voicing = clamp(Math.round(value), -12, 12);
  updateDialUI();
}

function wireVoicingDial() {
  let dragStartY = 0;
  let dragStartValue = 0;
  let dragging = false;

  el.dial.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartY = e.clientY;
    dragStartValue = state.voicing;
    el.dial.setPointerCapture(e.pointerId);
  });

  el.dial.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const deltaY = dragStartY - e.clientY; // up = increase
    setVoicing(dragStartValue + Math.round(deltaY / 8));
  });

  const endDrag = () => { dragging = false; };
  el.dial.addEventListener('pointerup', endDrag);
  el.dial.addEventListener('pointercancel', endDrag);

  el.dial.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowRight'].includes(e.key)) { e.preventDefault(); setVoicing(state.voicing + 1); }
    else if (['ArrowDown', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); setVoicing(state.voicing - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setVoicing(0); }
  });

  el.voicingReset.addEventListener('click', () => setVoicing(0));
}

// ------------------------------------------------------- performance UI

function buildModeRow() {
  el.modeRow.innerHTML = '';
  for (const mode of PERFORMANCE_MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn';
    btn.textContent = MODE_LABELS[mode];
    btn.setAttribute('role', 'radio');
    btn.dataset.mode = mode;
    btn.addEventListener('click', () => {
      state.performanceMode = mode;
      updateModeUI();
    });
    el.modeRow.appendChild(btn);
  }
}

function updateModeUI() {
  el.modeRow.querySelectorAll('.seg-btn').forEach((btn) => {
    const active = btn.dataset.mode === state.performanceMode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });
  el.strumRow.hidden = state.performanceMode !== 'strum';
  el.arpRow.hidden = state.performanceMode !== 'arp';
}

function wirePerformanceControls() {
  el.tempo.addEventListener('input', () => {
    state.tempo = Number(el.tempo.value);
    el.tempoVal.textContent = `${state.tempo} BPM`;
  });
  el.strumSpeed.addEventListener('input', () => {
    state.strumSpeed = Number(el.strumSpeed.value);
    el.strumSpeedVal.textContent = `${state.strumSpeed}%`;
  });
  el.arpRow.querySelectorAll('[data-division]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.arpDivision = btn.dataset.division;
      el.arpRow.querySelectorAll('[data-division]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
  el.arpRow.querySelectorAll('[data-order]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.arpOrder = btn.dataset.order;
      el.arpRow.querySelectorAll('[data-order]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
}

// --------------------------------------------------------------- play

function snapshotState() {
  return {
    root: state.root,
    type: state.type,
    modifiers: [...state.modifiers],
    voicing: state.voicing,
    performanceMode: state.performanceMode,
  };
}

async function pressKey(root) {
  await audioEngine.ensureAudioStarted();
  if (activeVoice) finishVoice(activeVoice, false);

  state.root = root;
  updateChordUI();
  updateKeyboardUI();

  const snapshot = snapshotState();
  const modeOpts = computeModeOpts();
  const notes = chordStateToNotes(snapshot);
  const t = audioEngine.now();
  const handle = audioEngine.triggerVoice(notes, snapshot.performanceMode, modeOpts, t);

  activeVoice = { root, handle, startedAt: performance.now(), snapshot, modeOpts };
}

function finishVoice(voice, capture) {
  const t = audioEngine.now();
  audioEngine.releaseVoice(voice.handle, t);
  if (capture && recording) {
    const heldSec = (performance.now() - voice.startedAt) / 1000;
    const duration = Math.max(heldSec, audioEngine.MIN_HOLD_SEC);
    progression.push({ ...voice.snapshot, modeOpts: voice.modeOpts, duration });
    renderProgression();
  }
}

function releaseKey(root) {
  if (!activeVoice || activeVoice.root !== root) return;
  finishVoice(activeVoice, true);
  activeVoice = null;
  updateKeyboardUI();
}

// --------------------------------------------------------- progression

function renderProgression() {
  el.progressionList.innerHTML = '';
  for (const [index, item] of progression.entries()) {
    const chip = document.createElement('li');
    chip.className = 'chord-chip';
    chip.dataset.index = String(index);

    const text = document.createElement('span');
    text.textContent = chordNameText(item) + (MODE_ABBR[item.performanceMode] ? ` · ${MODE_ABBR[item.performanceMode]}` : '');
    chip.appendChild(text);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chord-chip-remove';
    removeBtn.setAttribute('aria-label', 'Remove chord');
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      progression.splice(index, 1);
      renderProgression();
    });
    chip.appendChild(removeBtn);

    el.progressionList.appendChild(chip);
  }

  el.progressionCount.textContent = `${progression.length} chord${progression.length === 1 ? '' : 's'}`;
  el.playProgBtn.disabled = progression.length === 0;
  el.clearProgBtn.disabled = progression.length === 0;
  el.progressionHint.hidden = progression.length > 0;
}

function highlightChip(index) {
  el.progressionList.querySelectorAll('.chord-chip').forEach((chip) => {
    chip.classList.toggle('is-playing', Number(chip.dataset.index) === index);
  });
}

function stopPlayback() {
  if (playback) {
    playback.stop();
    playback = null;
  }
  el.playProgBtn.textContent = '▸ PLAY';
  el.progressionList.querySelectorAll('.chord-chip').forEach((chip) => chip.classList.remove('is-playing'));
}

function togglePlayback() {
  if (playback) {
    stopPlayback();
    return;
  }
  playback = scheduleProgression(progression, {
    loop: el.loopToggle.checked,
    onStep: highlightChip,
    onDone: stopPlayback,
  });
  el.playProgBtn.textContent = '■ STOP';
}

function wireProgressionControls() {
  el.recBtn.addEventListener('click', async () => {
    await audioEngine.ensureAudioStarted();
    recording = !recording;
    el.recBtn.setAttribute('aria-pressed', String(recording));
  });

  el.playProgBtn.addEventListener('click', async () => {
    await audioEngine.ensureAudioStarted();
    togglePlayback();
  });

  el.clearProgBtn.addEventListener('click', () => {
    stopPlayback();
    progression = [];
    renderProgression();
  });
}

// ------------------------------------------------------------------ init

function init() {
  buildKeyboard();
  buildTypeRow();
  buildModifierRow();
  buildModeRow();
  wireVoicingDial();
  wirePerformanceControls();
  wireProgressionControls();

  updateKeyboardUI();
  updateChordUI();
  updateModeUI();
  updateDialUI();
  renderProgression();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

init();
