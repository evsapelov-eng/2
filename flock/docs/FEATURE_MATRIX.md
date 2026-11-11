# FLØCK — feature matrix (reference: Beads)

The **single reference point** for the project. Every change is checked against this table (see `CLAUDE.md`). `tools/check_matrix.js` runs in `npm test` and checks that:
- every DONE / PARTIAL / DEVIATION row names an **existing test**;
- every Live parameter of the device (`` `name` `` in the FLØCK column) appears in the table;
- statuses come only from the list below.

Statuses:
- **DONE** — behaves as in Beads, with a test.
- **PARTIAL** — part done (says what is missing).
- **DEVIATION** — deliberately different from Beads (why, in the FLØCK column and in `PORTING_NOTES.md`).
- **PLANNED vX** — planned for that version.
- **N/A** — meaningless inside Live (with a replacement).

Sources: M = `docs/modules/beads/manual.md`; C = `pichenettes/eurorack/beads` @ f4cfa76.

| ID | Beads: what it does (source) | FLØCK: how | Test | Status |
|---|---|---|---|---|
| R1 | Continuous recording into a buffer, 48 kHz 16-bit stereo, 192000 frames ≈ 4 s (C processor.h, delay_line.h) | `buf` 192000 frames, `q16` truncation like Clip16, record head moving backwards, 4-sample tail | buffer: 192000 frames | DONE |
| R2 | FREEZE stops recording, the grains play what was recorded; smooth return (freeze tail 256) (M, C delay_line.h) | `freeze`, freeze tail with SmoothStep | FREEZE: recording stops | DONE |
| R3 | FREEZE > 10 s → buffer backed up and restored at power-on (M) | buffer saved into the Live Set | — | PLANNED v0.5 |
| R4 | Mono/stereo by inputs; mono buffer twice as long (M, C) | always stereo; MONO switch planned | — | PLANNED v0.2 |
| R5 | Auto input gain +0…+32 dB over 5 s, limiter; manual gain A+FEEDBACK (M) | `input` gain −12…+32 dB by hand; input limiter 0.95 as in C | IN gain scales what is recorded | DEVIATION |
| R6 | 4 recording qualities: Pristine / Cold digital / Sunny tape / Scorched cassette (M, C processor) | Pristine only so far | — | PLANNED v0.2 |
| R7 | Quality and mono/stereo cannot change while FREEZE is on (M) | — | — | PLANNED v0.2 |
| G1 | LATCH: continuous generation at the DENSITY rate; 12 o'clock = none; CCW even, CW random; fastest = C3 period (M, C trigger_generator) | `density`, `seedlatch` | DENSITY (latched) | DONE |
| G2 | LATCH on: hold SEED 4 s or FREEZE while SEED is held; off: short press on SEED. On at power-on (M) | LATCH toggle; SEED: short press when latched = off, hold 4 s = on; on by default. FREEZE+SEED (two buttons at once) cannot be done with one mouse → the LATCH toggle | SEED gestures | DONE |
| G3 | Without LATCH: grains while SEED is held; at 12 o'clock one grain per press (M) | `seed` (momentary) | SEED gated | DONE |
| G4 | Signal on the SEED input: CW trigger probability, CCW division 1/16…1 (M, C RenderDivider) | clock from Live tempo / MIDI | — | PLANNED v0.3 |
| G5 | DENSITY CV: exponential FM 1 V/oct at audio rates (M, C) | MOD source → DENSITY | — | PLANNED v0.5 |
| G6 | Up to 30 grains (manual); code uses 32 with voice stealing (M, C delay_granular_player) | 32, voice stealing and safety fades as in C | dense long grains | DONE |
| P1 | Grain parameters are read once at its start (M) | values latched at the start | parameters are read once | DONE |
| P2 | TIME: fresh (CCW) … old (CW) (M) | `time` | TIME: grains start | DONE |
| P3 | PITCH ±24 st with "virtual notches" (M, C LAW_DETUNE) | `pitch`, same law | pitch knob | DONE |
| P4 | SIZE: short grain near 11 o'clock, CW up to 4 s, CCW reversed up to 4 s (M) | `size`, law from C (shortest ≈ 8 ms at 1/3 of the travel; the manual says "30 ms") | SIZE: below 1/3 | DONE |
| P5 | SIZE fully CW (∞) → delay mode (M) | panel shows "∞ delay — v0.3"; grains stay granular for now | SIZE ∞ marked | PARTIAL |
| P6 | SHAPE: rectangle → decay → bell → slow attack (M, C grain_envelope) | `shape`, same envelope | SHAPE: CCW | DONE |
| P7 | Attenurandomizer without CV: CCW peaky, CW uniform internal random (M, C randomized_parameter) | `time_amt` `pitch_amt` `size_amt` `shape_amt`, law from C: CW = even within a window ±a/2, CCW = clustered with rare far values | RND: CW uniform | DONE |
| P8 | Attenurandomizer with CV: CW = CV amount, CCW = CV-controlled randomness (M, C) | engine ready (in3..in6, `*_cv`); sources arrive with MOD | CV mode | PARTIAL |
| P9 | A randomised parameter or random rate → random grain pan (M) | as in C (BoundedRandomFloat) | randomised parameters | DONE |
| X1 | FEEDBACK with limiting per quality (16-bit: hard limiting) (M, C granular_processor) | `feedback`, Pristine scheme | FEEDBACK at 100% | DONE |
| X2 | DRY/WET: dry (1−x)(1+x)·0.75, wet x(2−x)·1.5 (C processor) | `drywet` | dry/wet law | DONE |
| X3 | REVERB ("Thoreau's cabin"), length and tone depend on quality (M, C reverb) | `reverb`, Pristine parameters | reverb adds a tail | DONE |
| X4 | Assignable CV → FEEDBACK/DRY-WET/REVERB with individual depth (M) | MOD matrix | — | PLANNED v0.5 |
| X5 | The chain is always stereo (M) | stereo | randomised parameters | DONE |
| X6 | Grain trigger output on R (M) | no jack in Live → "grain trigger" source in MOD | — | N/A |
| X7 | LEDs: input level, CV amounts, SEED "breathes" when latched (M) | SEED pulses when latched, grain counter, tape view; input meter in v0.2 | panel: knobs send | PARTIAL |
| X8 | Output gain (none on the module) | `output` −24…+12 dB | IN gain scales | DONE |
| D1 | Delay: base time from DENSITY (12 o'clock = whole buffer → audio rates), CW an extra tap (M) | — | — | PLANNED v0.3 |
| D2 | Tap tempo / clock on SEED, subdivisions (M) | Live tempo + taps | — | PLANNED v0.3 |
| D3 | Delay with FREEZE = slicer, TIME picks the slice (M) | — | — | PLANNED v0.3 |
| D4 | SHAPE = synced envelope on the repeats; PITCH = rotary pitch shift (M) | — | — | PLANNED v0.3 |
| D5 | Slow random LFOs into the attenurandomizers in delay mode; 1.5 s mode transition (M, C) | — | — | PLANNED v0.3 |
| W1 | No input → granular synth from Plaits waveforms after 10 s (M) | AUDIO/WAVES switch | — | PLANNED v0.4 |
| W2 | WAVES: FEEDBACK = bank, DRY/WET = oscillator↔grains, FREEZE stops envelopes, quality = output resolution, PITCH CV = V/oct (M) | + MIDI note → pitch | — | PLANNED v0.4 |
| L1 | (FLØCK) Every control is a Live parameter: automation, Push | 17 parameters | every Live parameter | DONE |
| L2 | (FLØCK) Fits the strip, light panel | 900×169 | gen~ box embeds | DONE |
| L3 | (FLØCK) Every control is explained on hover | help line | panel: knobs send | DONE |
| L4 | (FLØCK) MOD tab: LFO 1/2, Random, Env, Clock → 10 destinations, RANDOM/CLEAR | — | — | PLANNED v0.5 |
