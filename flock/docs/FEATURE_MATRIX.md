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
| R1 | Continuous recording into a buffer, 48 kHz 16-bit stereo, 192000 frames ≈ 4 s (C processor.h, delay_line.h); other qualities: R6 | `buf` (sized for the longest quality), Pristine 192000 frames, `q16` truncation like Clip16, record head moving backwards, 4-sample tail | buffer (Pristine): 192000 frames | DONE |
| R2 | FREEZE stops recording, the grains play what was recorded; smooth return (freeze tail 256) (M, C delay_line.h) | `freeze` + MOD → `Freeze` (gate), freeze tail with SmoothStep | R2 FREEZE gate input | DONE |
| R3 | FREEZE > 10 s → buffer backed up and restored at power-on (M) | buffer saved into the Live Set | — | PLANNED v0.5 |
| R4 | Mono/stereo by inputs; mono buffer twice as long (M, C) | always stereo; MONO switch planned | — | PLANNED v0.2 |
| R5 | Auto input gain +0…+32 dB over 5 s, limiter; manual gain A+FEEDBACK (M) | `agc` = GainControl ported 1:1 (wait 1 s with ×1.8, learn 5 s, gain = 0.9/peak up to ×40, then slow tracking); LEARN = Restart; `input` = manual gain (dragging IN switches to manual, like A+FEEDBACK), clipped at ±1. FLØCK DEVIATIONS: AUTO is off by default (a DAW signal is at line level; AUTO on by default made v0.3.0 scream), and with AUTO on the output is divided by the same gain, so the level returns to the input level (the nonlinear parts still see the normalised signal) | R5 AUTO gain | DONE |
| R6 | 4 recording qualities: Pristine / Cold digital / Sunny tape / Scorched cassette (M, C processor.h/.cc, granular_processor.h, delay_line.h, mu_law.cc, wow_and_flutter.h, gain_control.cc) | `quality`: buffer durations 4 / 8 / 10.7 / 16 s; 16-bit / 12-bit / 12-bit / µ-law items; feedback brickwall vs SoftClip ×1.3 / ×1.75 with LP 0.999 / 0.9 / 0.75; dry 12-bit / µ-law; wow & flutter (Scorched); GainControl soft clip ON / DYNAMIC; caveman reverb; change = buffer cleared (by counting), grains reset. DEVIATIONS (v0.4.1): everything at the host rate — the codec rates 32 / 24 kHz are represented by the bandwidth (two one-poles 14 / 10 kHz) and wow & flutter converted to the host rate; Sunny tape grains at full rate. The exact v0.3 codec-rate structure did not run in Max | R6 buffer lengths: the module's durations | PARTIAL |
| R7 | Quality and mono/stereo cannot change while FREEZE is on (M) | the quality is held while frozen and applied after unfreeze; panel greys the selector (mono: see R4). DEVIATION: the change keeps the recording (Beads clears it) | R6 changing the quality keeps the recording | DONE |
| G1 | LATCH: continuous generation at the DENSITY rate; 12 o'clock = none; CCW even, CW random; fastest = C3 period (M, C trigger_generator) | `density`, `seedlatch`. DEVIATION: with AUTO GRAINS (latched, nothing in SEED) 12 o'clock = the slowest even grains instead of none (no silent dead zone) | DENSITY (latched) | DONE |
| G2 | LATCH on: hold SEED 4 s or FREEZE while SEED is held; off: short press on SEED. On at power-on (M) | LATCH toggle; SEED: short press when latched = off, hold 4 s = on; on by default. FREEZE+SEED (two buttons at once) cannot be done with one mouse → the LATCH toggle | SEED gestures | DONE |
| G3 | Without LATCH: grains while SEED is held; at 12 o'clock one grain per press (M) | `seed` (momentary) | SEED gated | DONE |
| G4 | Signal on the SEED input: CW trigger probability, CCW division 1/16…1 (M, C RenderDivider) | any MOD source → `Seed` (CLOCK/SEQ synced to Live): LATCH on = RenderDivider ported 1:1 (division 1…16 with hysteresis, probability, audio-rate tracking); LATCH off = gate | G4 divider | DONE |
| G5 | DENSITY CV: exponential FM 1 V/oct at audio rates (M, C) | MOD → `Density`: linear in the middle, exponential FM near the ends (Processor::Process); depth `dn_amt` (FLØCK, Beads = 1) | G5 DENSITY CV | DONE |
| G6 | Up to 30 grains (manual); code uses 32 with voice stealing (M, C delay_granular_player) | 32, voice stealing and safety fades as in C | dense long grains | DONE |
| P1 | Grain parameters are read once at its start (M) | values latched at the start | parameters are read once | DONE |
| P2 | TIME: fresh (CCW) … old (CW) (M) | `time` | TIME: grains start | DONE |
| P3 | PITCH ±24 st with "virtual notches" (M, C LAW_DETUNE) | `pitch`, same law | pitch knob | DONE |
| P4 | SIZE: short grain near 11 o'clock, CW up to 4 s, CCW reversed up to 4 s (M) | `size`, law from C (shortest ≈ 8 ms at 1/3 of the travel; the manual says "30 ms") | SIZE: below 1/3 | DONE |
| P5 | SIZE fully CW (∞) → delay mode (M) | not yet: fully CW is the longest grain (the panel no longer promises the mode) | SIZE fully CW shows the longest grain | PARTIAL |
| P6 | SHAPE: rectangle → decay → bell → slow attack (M, C grain_envelope) | `shape`, same envelope | SHAPE: CCW | DONE |
| P7 | Attenurandomizer without CV: CCW peaky, CW uniform internal random (M, C randomized_parameter) | `time_amt` `pitch_amt` `size_amt` `shape_amt`, law from C: CW = even within a window ±a/2, CCW = clustered with rare far values | RND: CW uniform | DONE |
| P8 | Attenurandomizer with CV: CW = CV amount, CCW = CV-controlled randomness (M, C) | MOD → `Time` `Pitch` `Size` `Shape`: CW = CV amount, CCW = CV randomness; the panel relabels RND → CV | P8 TIME CV | DONE |
| P9 | A randomised parameter or random rate → random grain pan (M) | as in C (BoundedRandomFloat) | randomised parameters | DONE |
| X1 | FEEDBACK with limiting per quality (16-bit: hard limiting) (M, C granular_processor) | `feedback`, Pristine scheme | FEEDBACK at 100% | DONE |
| X2 | DRY/WET: dry (1−x)(1+x)·0.75, wet x(2−x)·1.5 (C processor) | `drywet` | dry/wet law | DONE |
| X3 | REVERB ("Thoreau's cabin"), length and tone depend on quality (M, C reverb, processor.cc) | `reverb`; Pristine time 0.3 + 0.6 r³, lp 0.6; other qualities ("caveman") 0.45 + 0.5 r³, lp 0.4 (the 0.75 branch for MEDIA_VINTAGE_DIGITAL is unreachable in processor.cc); delays in samples of the codec rate | X3 caveman reverb | DONE |
| X4 | Assignable CV → FEEDBACK/DRY-WET/REVERB with individual depth (M) | MOD → `Feedback` `Dry/Wet` `Reverb` with their own amounts `fb_amt` `dw_amt` `rv_amt` (beads.cc: base·1.005 + cv·amount). DEVIATION: CV low-pass 0.02 per block instead of 0.1 (≈12 ms) — a stepped source made the level click; RANDOM puts only smooth sources there | X4 assignable CV | DONE |
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
| M1 | (FLØCK) LFO 1/2: Hz (0.02…20) or synced to Live's tempo (8 bars … 1/32, T and D), sine/tri/saw/square, R = restart on Play, AMT | `l1_rate` `l1_sync` `l1_shape` `l1_reset` `l1_amt` `l2_rate` `l2_sync` `l2_shape` `l2_reset` `l2_amt` | LFO synced 1 bar | DONE |
| M2 | (FLØCK) RANDOM: random walk (SMOOTH) or steps (STEPS), Hz or tempo, AMT; its own generator does not affect the grains' random stream | `rn_rate` `rn_sync` `rn_smooth` `rn_amt` | RANDOM: values stay | DONE |
| M3 | (FLØCK) ENV: input level follower, gain ×0.25…16 | `env_gain` | ENV → SEED | DONE |
| M4 | (FLØCK) CLOCK: pulses at a tempo division (1/1…1/32, T, D) from Live's transport (stops when Live stops) or in Hz | `ck_rate` `ck_sync` | CLOCK synced to Live | DONE |
| M5 | (FLØCK) SEQ: 16 steps (on/off + value), length 1…16, rate (tempo division). Into SEED = rhythm of grains, into TIME = **slicing** (with FREEZE = a slicer of the frozen buffer) | `sq_div` `sq_len` `sq0` `sq1` `sq2` `sq3` `sq4` `sq5` `sq6` `sq7` `sq8` `sq9` `sq10` `sq11` `sq12` `sq13` `sq14` `sq15` | slicing: SEQ | DONE |
| M6 | (FLØCK) Patching parameters: each destination is a Live parameter (source 0…6), automatable | `dst_freeze` `dst_seed` `dst_time` `dst_pitch` `dst_size` `dst_shape` `dst_density` `dst_feedback` `dst_reverb` `dst_drywet` | every Live parameter | DONE |
| M7 | (FLØCK) Control of the tests themselves: 20 deliberate bugs in gen~ (divider, probability, DENSITY CV, CV low-pass, pan, envelope, fixed point, feedback, reverb, spread, C3 frequency, 5 ms voice stealing, freeze tail, notches, TIME hysteresis, 2.5 ms SEED delay, block sr/4000, sync to Live's grid, ENV, LFO rate) — the tests must catch every one | `tools/mutation_check.js` | `npm run verify` | DONE |
| U1 | (FLØCK, user's request) DICE: a new sound from 8 recipes (CLOUD, SHIMMER, REVERSE SWELLS, STUTTER, SLICER, RAIN, DRONE, WOBBLE) — random inside proven ranges; BACK = the previous sound | panel | DICE: every recipe | DONE |
| U2 | (FLØCK) RANDOM with musical rules: only rhythm (CLOCK/SEQ) goes into SEED (then LATCH off, DENSITY 12h); FREEZE is not patched at random; working CV amounts; limited DENSITY depth | panel | RANDOM, pressed 20 times | DONE |
| U3 | (FLØCK) A cable into TIME/PITCH/SIZE/SHAPE sets a working CV amount if the RND knob was at the centre (in Beads the centre = no effect) | panel | a cable into TIME | DONE |
| U4 | (FLØCK) Grains never end up "off by accident": without a cable in SEED, LATCH comes back on and DENSITY leaves the 12h dead zone (RANDOM, CLEAR, removing a cable) | panel | RANDOM, pressed 20 times | DONE |
| U5 | (FLØCK) Starting sound: a dense soft cloud (≈34 grains/s, 87 ms, bell, spread, reverb) — audible right away on a quiet source (−52 dB) | defaults (gen = device = panel) | default sound after loading | DONE |
| U6 | (FLØCK) MIDI keys: the FLØCK Keys MIDI effect sends its notes to FLØCK — a held key fires grains like TRIGGER, the note transposes from C3 (last note wins), the first note turns AUTO GRAINS off | `ktrig` `knote` `kon` (engine, not Live parameters), receive flock_keys | MIDI keys (FLØCK Keys) | DONE |
| U7 | (FLØCK) One randomizer: DICE with SOUND / MOD / ALL, the recipe name shown, BACK undoes DICE, RANDOM and SLICE; SLICE = one-click slicer | panel | v0.5 panel | DONE |
| U8 | (FLØCK) Readable panel: TRIGGER / AUTO GRAINS / SPREAD↔DEPTH names, fonts ≥ 7 px, DEPTH bars with %, step values in the help line, output level meter, tape seconds scale and "recording…" until the buffer is filled | panel + patch (peakamp~, out12) | v0.5 panel | DONE |
| U9 | (FLØCK) FILTER like Live's Echo: one box with two points — pink cuts the lows (12 dB high-pass, resonance), blue cuts the highs (Moog-style 4-pole ladder, tanh drive, resonance up to self-oscillation, thins the bass); across = frequency 20 Hz…20 kHz, up = resonance; on the grains (dry untouched) or on ALL; MOD destination Cutoff (±5 oct × depth); defaults = bit-exact bypass | `lp_cut` `lp_res` `hp_cut` `hp_res` `flt_all` `dst_cutoff` `ct_amt` | FILTER low-pass | DONE |
| L5 | (FLØCK) The device warns when the engine is not running (the record head stands still while not frozen) | "ENGINE NOT RUNNING" on the tape | engine status | DONE |
| L6 | (FLØCK) gen~ code follows the real compiler rules (Max 9.1): functions before declarations, no loop-carried locals | lint in `tools/genexpr.js` | gen~ code obeys | DONE |
| L7 | (FLØCK) Verification: gen~ = an independent transcription of the Beads C++ (`tools/beads_ref.js`, blocks of sr/4000 = 12, fixed point, pots per block, 2.5 ms SEED delay) sample for sample, relative error < 1e-9 over 29 scenarios (freeze, SEED gated/clocked/audio-rate, all CV inputs, feedback, reverb, 32 voices, moving knobs) | differential test | gen~ = Beads reference | DONE |
| L4 | (FLØCK) MOD tab: LFO 1/2, Random, Env, Clock → 10 destinations, RANDOM/CLEAR | MOD tab: sources LFO 1/2, RANDOM, ENV, CLOCK, SEQ; cables to 10 destinations (one source per destination, like a jack); RANDOM ≤ MAX, CLEAR | MOD tab: drag a cable | DONE |
