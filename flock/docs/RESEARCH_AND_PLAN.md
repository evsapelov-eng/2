# FLØCK — granular texture synthesizer for Max for Live (research and plan)

Working name: **FLØCK** (a "flock" of grains). This is our own device. The algorithm is a port of the open (MIT) **Beads** code by Mutable Instruments / Emilie Gillet. We do not use the Mutable Instruments name, logo or panel graphics, and we do not copy another developer's M4L device ("Seeds" from the screenshots). The layout of tabs, big knobs and the modulation matrix is only a guide; the look will be our own.

## 1. What I found

| Source | What's there | Licence |
|---|---|---|
| `github.com/pichenettes/eurorack`, folder `beads/` (published 12 Oct 2026, commit f4cfa76) | **Full Beads firmware**: `dsp/` (≈5,800 lines: granular engine, delay, reverb, wow/flutter, μ-law, wavetable synth), `ui.cc`, `cv_reader.cc`, `settings.cc`, `resources/waves.bin` (waveforms), a desktop test build `beads/test` | Code — **MIT** (keep the notice). Hardware — CC-BY-SA 3.0 (we don't need it) |
| Same repo, `clouds/` | The predecessor, Clouds (the "Cold digital" mode imitates its sound) | MIT |
| `github.com/pichenettes/mutable-instruments-documentation` → `docs/modules/beads/manual.md`, `beads_history.md` | Official manual and the module's history | — |
| Ports | **No ready Max/Pd/VCV ports of Beads exist yet** (CDM, VCV forum). We'd be among the first | — |
| "Seeds" (screenshots) | No such texture synthesizer found under that name in public sources (Cycling '74's "Seeds" is a set of MIDI devices). Probably a third-party M4L device modelled on Beads | — |

The mutable-instruments.net and manuals.plus sites are not reachable from this environment (network rule), but the same manual sits on GitHub, and I took it from there.

## 2. Everything Beads can do (full matrix)

### Recording and input
- Continuous recording into a buffer ("tape"); **FREEZE** stops recording. The buffer is backed up if FREEZE is held for more than 10 s.
- Mono/stereo, depending on the patched inputs.
- **Auto input gain** (+0…+32 dB over 5 s) plus a limiter; manual gain (hold A + FEEDBACK).

**4 recording qualities (button A)**, taken from the code (`processor.h/.cc`):

| Mode (manual) | Code | Rate | Resolution | Buffer (stereo/mono) | Specifics |
|---|---|---|---|---|---|
| Pristine | `MEDIA_DIGITAL` | 48 kHz | 16 bit | 4 s / 8 s | clean feedback with a hard limiter; "bright" reverb |
| Cold digital | `MEDIA_VINTAGE_DIGITAL` | 32 kHz | 12 bit | 8 s / 16 s | sound of Clouds; dry signal quantised to 12 bit |
| Sunny tape | `MEDIA_CLEAN_TAPE` | 24 kHz (resampled ×2 inside) | 12 bit | ≈10.7 s / 21 s | dry signal at 48 kHz |
| Scorched cassette | `MEDIA_DIRTY_TAPE` | 24 kHz | 8 bit μ-law | 16 s / 32 s | **wow & flutter**, tape saturation in the feedback |

Feedback per mode: 16 bit uses a hard limiter (no soft-clip). 12 bit uses soft-clip ×1.3 with LP 0.9. 8 bit uses soft-clip ×1.75 with LP 0.75. Reverb: time 0.3+0.6·r³ (Pristine) or 0.45+0.5·r³; LP 0.6 / 0.75 / 0.4.

### Grain generation (SEED, DENSITY)
- **Latched** (default; hold SEED 4 s or FREEZE+SEED): continuous generation. DENSITY at 12 o'clock = silence. Clockwise = **random** rate, counter-clockwise = **constant** rate, up to the period of a C3 note. At audio rates, the DENSITY CV is exponential FM (1 V/oct).
- **Clocked** (latched + signal on the SEED input): clockwise = trigger probability 0→100%, counter-clockwise = division 1/16…1.
- **Gated/triggered** (short press on SEED): grains only while held or on a gate; DENSITY = repetition rate; at 12 o'clock = one grain per press.
- Up to **30 grains** at once, with voice stealing.

### Grain parameters (read once at the start of each grain)
- **TIME** — where in the buffer to read (from fresh to old).
- **PITCH** — ±24 semitones, with "notches" at intervals.
- **SIZE** — 30 ms at 11 o'clock → up to 4 s; counter-clockwise = reversed grain up to 4 s; **fully clockwise (∞) = DELAY mode**.
- **SHAPE** — envelope: rectangle (clicks) → smooth → slow attack ("reversed" feel).
- **Attenurandomizer** on TIME / PITCH / SIZE / SHAPE (`randomized_parameter.h`):
  - with CV: + = amount of CV, − = CV-controlled randomness;
  - without CV: internal random source, − = "peaky" (clustered around the middle), + = uniform.
  - In DELAY mode, slow random LFOs (random walk) are routed to them.
- If any parameter is randomised, the grain's **pan is randomised too**.

### Mix and output
- **FEEDBACK** (schemes depend on quality), **DRY/WET** (dry=(1−x)(1+x)·0.75, wet=x(2−x)·1.5), **REVERB** (mix r²·0.9).
- An assignable CV input (button M) goes to FEEDBACK / DRY/WET / REVERB, each with its own depth.
- The whole chain is stereo; with R unpatched, L+R are summed to L.
- Option: a grain **trigger output** on R (M+SEED).

### DELAY mode (SIZE = ∞)
- Base time: from DENSITY (12 o'clock = the whole buffer → down to audio rates, flanger/comb). Clockwise from 12 adds an extra uneven tap.
- Or **tap tempo** / external clock on SEED. DENSITY then picks a subdivision: counter-clockwise = binary only, clockwise = varied ratios.
- FREEZE off = delay; TIME = multiple of the base time.
- FREEZE on = **slicer**: loops a slice, TIME picks which one.
- SHAPE = tempo-synced envelope on the repeats.
- PITCH = rotary-head pitch shifter (bypassed at 12 o'clock).
- The switch between granular and delay mode is smooth (1.5 s, crossfade 0.75 s).

### Wavetable synth (no input)
- After 10 s with no input, it granularises built-in buffers of Plaits waveforms (`waves.bin`). The manual says 8 banks; in the code `kNumBanks = 12` (to check while porting).
- FEEDBACK = bank, DRY/WET = continuous oscillator ↔ granulated signal, FREEZE = stops envelopes and new grains, quality = output resolution, PITCH CV = always 1 V/oct.

## 3. How to build it in Max for Live

### The engine: a gen~ port (GenExpr)
- **Why gen~:** it runs in any Live Suite / Max for Live, needs no compilation, and the user installs nothing. A C++ external would have to be built on a Mac with Xcode and signed.
- The DSP is ported almost line by line into GenExpr codebox: grains as arrays in `Data`, the buffer in `Data`/`buffer~`, functions instead of classes.
- **Lower qualities at a host rate of 44.1/48 kHz:**
  - 24 kHz (tape): processed at half rate with the same SRC filters from `sample_rate_conversion_filters.h` (exact port);
  - 32 kHz (Cold digital): bandwidth limiting plus 12-bit storage (an approximation, documented);
  - 8-bit μ-law and wow & flutter: exact port.
- **Validation without Max** (as with KØRE):
  - Our own GenExpr interpreter in node runs the same codebox text and checks it against a JS model.
  - Ideally also against the **original C++** (`beads/test`, builds on a desktop): reference WAVs for each mode. **This needs your permission** — running code downloaded from GitHub is blocked by the session's safety rule (details at the end).

### Modulation instead of jacks (Seeds-style, our own design)
- **Sources:**
  - LFO 1, LFO 2 (Hz or synced to tempo, phase reset on Play);
  - RANDOM (smooth random);
  - ENV (input envelope follower, ×gain);
  - CLOCK (Live tempo, divisions, a trigger for SEED).
- **Destinations:** FREEZE, SEED, TIME, PITCH, SIZE, SHAPE, DENSITY, FEEDBACK, REVERB, DRY/WET.
- **Matrix:** draw cables with the mouse; **RANDOM** (random patch, up to MAX cables) and **CLEAR**.
- A cable into TIME/PITCH/SIZE/SHAPE = "a CV is patched". The attenurandomizer then switches to CV mode exactly as in Beads (+ amount / − CV randomness).
- **MIDI** (in the instrument version): note → PITCH (1 V/oct as in Beads), note-on → SEED (gated mode). Lets you play grains and the wavetable synth from a keyboard.

### Interface (light panel, one strip in Live, our own design)
- **SOUND** tab:
  - TIME, DENSITY (with "random ↔ constant" marks), PITCH (scale quantise), SIZE (∞ mark), SHAPE (envelope icons);
  - FEEDBACK, DRY/WET, REVERB;
  - INPUT/OUTPUT gain (+ AUTO);
  - FREEZE, SEED, LATCH;
  - QUALITY (4 icons), AUDIO/WAVES;
  - an under-knob caption with the meaning (BUFFER POSITION, GRAIN RATE…).
- **MOD** tab: 4 attenurandomizers, settings for the 4 modulators, the matrix, a help line on hover.
- Live a little: a grain display (where the grains fly over the buffer), the buffer waveform, the delay mode.
- All knobs are Live parameters (automation, Push, macros).

### Device type
- **Audio Effect** (the main one; with an AUDIO/WAVES switch).
- Plus, optionally, **Instrument** (MIDI → pitch/SEED; source WAVES or sidechain) — a separate build from the same engine.

## 4. Stages

1. **v0.1 core:**
   - 16-bit buffer, 30 grains, SEED/DENSITY (latched/gated, constant/random), TIME/PITCH/SIZE/SHAPE with attenurandomizers;
   - FEEDBACK/DRY-WET, reverb, limiters;
   - SOUND tab; playable on any audio.
2. **v0.2 qualities:** 12-bit, Sunny tape (24k), Scorched cassette (μ-law + wow & flutter), feedback schemes, auto gain.
3. **v0.3 DELAY mode:** ∞, delay controller, multitap, tap/clock from Live tempo, slicer, rotary pitch.
4. **v0.4 WAVES:** wavetable synth (banks from `waves.bin`), MIDI version.
5. **v0.5 MOD:** modulators, cable matrix, RANDOM/CLEAR, grain trigger output.
6. Docs, host test guide, Freeze.

Each stage is a separate test build, as with KØRE. Honestly: it is a large port (≈6,000 lines of C++ → GenExpr), so it will take several iterations, and the real listening test is yours in Live.
