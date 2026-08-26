# Bloomer

A neon, installable PWA for sketching chord progressions — everything runs on your
device, nothing is uploaded. Inspired by the Telepathic Instruments Orchid: a
single-octave root keyboard, combinable chord-type and modifier buttons, a voicing
dial for inversions, four performance modes, and a recordable/loopable progression.

Sibling to [Clipper](https://github.com/dogmaticvox/Clipper),
[Shifter](https://github.com/dogmaticvox/Shifter) and
[CipherDeck](https://github.com/dogmaticvox/CipherDeck): same theme, same card
layout, same no-build-step plumbing.

**Features**

- 🎹 **Root keyboard** — single octave, 12 keys, press-and-hold to sound a chord
- 🎼 **Chord type** — Major, Minor, Sus, Diminished (single-select)
- ➕ **Modifiers** — 6, m7, Maj7, 9 — stack freely; a bare "9" implies m7 underneath it
  automatically, standard jazz-convention style
- 🎛️ **Voicing dial** — inverts the chord tone by tone; a full cycle naturally lands
  you a register up or down
- 🥁 **Performance modes** — Block, Alt bass/chord, Strum, Arpeggiate (up / down / up-down)
- ⏺️ **Record** — capture whatever you're holding (root, type, modifiers, voicing,
  performance mode, and how long you held it) into a progression
- 🔁 **Progression playback** — replays each chord through the exact same
  resolve → voice → performance-mode pipeline used live, with an optional loop
- 📴 **Offline-first** — installs to your home screen and works with no connection

## Install on your phone

1. Enable hosting once: repo **Settings → Pages → Source: GitHub Actions** (the included
   workflow deploys automatically on every push to `main`).
2. Open **https://dogmaticvox.github.io/Bloomer/** on your phone.
3. Add it to your home screen:
   - **Android/Chrome**: tap the install prompt, or ⋮ menu → *Add to Home screen*
   - **iOS/Safari**: Share sheet → *Add to Home Screen*

## Using it

Press and hold a root key to sound a chord built from the current type + modifiers,
voiced by the dial, and played through the selected performance mode. Press **REC**,
then play a few chords — each one is captured the moment you let go, with a chip
appended to the progression list (✕ to drop a mistake). **PLAY** replays the whole
thing; **LOOP** repeats it.

## Local development

No build step — it's plain HTML/CSS/JS. Serve the folder over HTTP and open it:

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

The chord theory engine, voicing dial and performance-mode planner are pure ES
modules with no audio or DOM dependency, so they're fully testable without a browser:

```sh
node --test test/chord-theory.test.mjs test/voicing.test.mjs test/performance-modes.test.mjs
```

## How it works

- **Chord resolution** (`js/chord-theory.js`) is a single pure function,
  `resolveChord(root, type, modifiers)`, that starts from a base triad and adds each
  modifier's interval on top, de-duplicating by pitch class. It's root-relative and
  has no notion of octave — that's the voicing engine's job.
- **Voicing** (`js/voicing.js`) walks a chord through inversions one dial-step at a
  time: each step moves whichever note is currently most extreme (lowest, for a
  step up) into the opposite octave. A full inversion cycle is just that same rule
  applied once per chord tone, so extreme dial values naturally produce new
  registers with no separate "cycle complete" logic.
- **Performance modes** (`js/performance-modes.js`) turn a voiced chord into a
  schedule — a list of note onsets for Block/Alt-bass/Strum, or an ordered,
  repeating note cycle for Arp — as a pure function with no timing side effects.
- **Audio** runs on [Tone.js](https://tonejs.github.io/) (vendored at
  `js/vendor/tone.js`), with `Tone.PolySynth` as the voice and `Tone.Transport` as
  the single shared clock for both live play and recorded playback.
- **Recording** (`js/progression.js`) snapshots the full chord state plus how long it
  was held. Playback re-runs every recorded chord through the exact same
  trigger/release functions used live, so a looped progression sounds identical to
  how it was played.
- `sw.js` precaches every asset, Tone.js included, so the installed app works fully
  offline.
