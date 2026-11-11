# FLØCK — porting notes (Beads → gen~)

Source: `pichenettes/eurorack` @ f4cfa76 (`beads/`), `pichenettes/stmlib` (MIT, see `LICENSE-BEADS.txt`).

## v0.1 — what is ported 1:1
- `processor.cc` (Pristine path): feedback → granular → dry/wet (`(1−x)(1+x)·0.75`, `x(2−x)·1.5`) → pre-reverb limiter → reverb (mix r²·0.9, time 0.3+0.6r³, lp 0.6) → output limiter.
- `granular_processor.h`: 16-bit feedback scheme (`s = in + prev·fb²·3`, input limiter 0.95), DC blocker (Svf HP 40 Hz, q 0.5, FREQUENCY_FAST tan approximation), feedback one-pole 0.999.
- `delay_line.h`: 16-bit stereo items (truncating `Clip16`), write head moving backwards, 4-sample interpolation tail, Hermite read with the latency fix, freeze tail (256 frames) with SmoothStep crossfade on unfreeze.
- `delay_grain.h` / `delay_granular_player.h` / `granular_player.h`: 32 grains, STOP head-crossing policy with SmoothStep fade zone 256, start-delay/duration clamps, pan law, amplitude 1/√(n+1), spread → pan, duration law `2^(−9·shortness)·4 s`, priority list with rotate / partial sort and the 4 safety fade-outs.
- `grain_envelope.h`, `voice_stealing_envelope.h`: exact.
- `trigger_generator.cc`: pulse train (constant / random with `−1/log(1−x)` ratios), manual taps, latched silence at 12 o'clock.
- `randomized_parameter.h`: internal random (uniform / peaky blend) and CV modes (+ amount / − PseudoGaussian randomness).
- `cv_reader.h`: attenuverter law and the PITCH detune law (notches 0, 1, 3, 4, 7, 12, 24).
- `fx/reverb.h` + `fx_engine.h`: Griesinger topology, 16-bit storage, 32768 words, LFOs as stmlib CosineOscillator (approximate) updated every 32 samples.

## Deviations (deliberate)
| Module | FLØCK v0.1 | Why |
|---|---|---|
| Runs at a fixed 48 kHz | runs at the host rate; buffer keeps 192000 frames (4 s @48k, 4.35 s @44.1k); reverb delay lengths in samples unchanged | gen~ cannot change the host rate |
| Block interpolation (24-sample blocks), pot ADC low-pass + hysteresis | per-sample one-pole smoothing, no hysteresis; values jump to their targets on load | per-sample engine |
| Global LCG random | gen~ `noise()` | same distribution, different sequence |
| Auto input gain (+0…+32 dB) | manual IN gain parameter (auto gain: later) | a DAW signal is already at line level |
| Mono buffer when only L is patched (twice as long) | always stereo (mono option: v0.2) | Live always feeds stereo |
| SEED / FREEZE gate inputs, clocked divider | not yet (v0.3 brings Live-tempo clock) | |
| SIZE ∞ → delay mode, quality modes, WAVES, CV/assign | v0.2–v0.5 | staged port |

## Audit 2026-11-11 against `FEATURE_MATRIX.md`
- **SEED gestures (G2)** were missing: Beads turns LATCH off with a short SEED press and on with a 4 s hold. Done in the panel. FREEZE+SEED (two buttons at once) is impossible with one mouse → the LATCH toggle.
- **SIZE ∞ (P5)**: in Beads it is delay mode. The panel now says "inf: delay v0.3" so it doesn't pretend to be done.
- **TIME seconds**: the panel showed seconds for 48 kHz; it now takes the rate from `dspstate~` (at 44.1 kHz the buffer is 4.35 s).
- **RND (P7)**: test against the exact formula from `randomized_parameter.h`. Full CCW in Beads only clusters mildly (≈28 % within ±0.1 instead of 20 % for uniform); the difference between CW and CCW is the **shape**: CW is even inside a window ±a/2, CCW is clustered with rare far values. The engine matches the formula at 4 knob positions.

## Validation
- `tests/engine.test.js` runs the very same codebox text through `tools/genexpr.js` (a translator + linter for the GenExpr subset used): pitch notches inside one grain, TIME position, reverse below 1/3, duration law, constant vs random rate and the C3 maximum, gated SEED (one grain per press), FREEZE, 10 s of 100 % feedback bounded, envelope shapes, 32-voice stealing without clicks, pan spread, dry/wet law, reverb tail.
- Not done: comparison against the original C++ (building/running the downloaded code needs the owner's permission in this environment), and gen~ compilation in Max (no Max here).
