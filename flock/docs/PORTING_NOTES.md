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
| Block interpolation (blocks of sr/4000 = 12 samples), pot ADC low-pass + hysteresis | ported (block 12 at 48 kHz, LP per block, TIME hysteresis); only the load glide differs | |
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

## gen~ compiler rules (fix for v0.1.2 "silent device in Live")
The v0.1.0/0.1.1 report from Live: with FLØCK on there is no sound at all (not even dry) → gen~ was not running. Cause: the code broke two rules of the real gen~ compiler (Max 9.1), documented in the header of `nube.genexpr` (github.com/cipp0/Nube_Texture_Synth, a working GenExpr port of Clouds):
1. **function definitions must come before any Param/Data/History** — ours came after them → the code does not compile;
2. **loop-carried locals updated in a loop can be dropped by the compiler** — that is how we summed the grains (`outl = outl + …` inside `for`) → silent grains even when it compiles.
Fix: functions first; the accumulators (L/R, grain counter, active-grain count, sort minimum) live in `Data sum`. Output matches the old code sample for sample in node (0 difference over 2 s with 30 active grains). `tools/genexpr.js` enforces both rules in its lint, and the panel shows "ENGINE NOT RUNNING" if gen~ is not running.

## Re-check 2026-11-11 (v0.1.3): independent reference
`tools/beads_ref.js` is transcribed class by class from the C++ (not from the gen~ code): DelayLine, DelayGrain (fixed point ×1024), GrainEnvelope, VoiceStealingEnvelope, GranularPlayer (priority list), TriggerGenerator, GranularProcessor, Limiter, FxEngine/Reverb (CosineOscillator), Processor (blocks of sr/4000 = 12, ParameterInterpolator), CvReader (law → LP 0.05 per block → hysteresis). `tests/reference.test.js` feeds the same random stream to both. The comparison found **4 real discrepancies** in the port, now fixed:
1. grain position and speed were floats, the module uses fixed point ×1024 (speed error up to 0.1 %);
2. the reverb LFOs started at 0.5 instead of `y1 = c·0.25` (value ≈ 1.0);
3. mix parameters used a one-pole; the module interpolates linearly over a block (left a difference in the reverb tail);
4. pots used a per-sample one-pole; the module reads them once per block (LP 0.05, hysteresis 0.001 on TIME), including FEEDBACK/DRY-WET/REVERB.
Result: relative error < 1e-9 over 10 scenarios. **Remaining deliberate differences:** the trigger generator's randomness (random rate) is drawn per sample rather than for the whole block up front (same statistics, checked by the grain count); float32 rounding of the module is not emulated; the time-multiplexing of the pot ADC is not modelled; on load the knobs don't glide up from zero.

## Re-check v0.2 (modulation): what the comparison and the source itself found
- **Block size was wrong in both models**: I took the codec buffer maximum (24), but the module runs `kBlockRate = 4000` → **sr/4000 = 12 samples at 48 kHz**. The reference agreed with gen~ because the mistake was the same in both (a common-mode error: a differential test cannot catch it). Found by reading `beads.cc` (the "Delay the seed input by 2.5ms" comment = 10 blocks). Fixed in both; parameter interpolation, pots and CV are read every 12 samples.
- **SEED input delayed by 10 blocks (2.5 ms)** (`event_delay` in beads.cc) was not ported → a CV sent together with a gate (SEQ → TIME + SEQ → SEED, slicing) played the previous step's slice. Ported.
- **Our own tempo sources** (CLOCK, SEQ, synced LFO/RANDOM) run 2.5 ms ahead, so the delayed gates land exactly on Live's grid (to the sample); only the first grain after Play can be up to 2.5 ms late. This is a FLØCK property, not a Beads one.
- **RANDOM** started at 0 until its first new value (up to seconds) → now starts from a random value.
- New in the reference: RenderDivider (clocked SEED: divisions with the quantizer's hysteresis, probability, audio-rate tracking), DENSITY CV (linear/exponential), the assignable CV (base·1.005 + cv·amount), CV channels with their LP coefficients, the SEED/FREEZE gate inputs.
- **Test control**: `npm run verify` breaks the gen~ code in 15 places. Two bugs went unnoticed at first (the 5 ms voice-stealing fade, TIME hysteresis). An analysis showed the 5 ms fade only matters when grains come more than 200 per second apart (otherwise those voices are already finished). Scenarios added (400 Hz clock into SEED; slow TIME turning). Now all 15 are caught.

## Validation
- `tests/engine.test.js` runs the very same codebox text through `tools/genexpr.js` (a translator + linter for the GenExpr subset used): pitch notches inside one grain, TIME position, reverse below 1/3, duration law, constant vs random rate and the C3 maximum, gated SEED (one grain per press), FREEZE, 10 s of 100 % feedback bounded, envelope shapes, 32-voice stealing without clicks, pan spread, dry/wet law, reverb tail.
- Not done: comparison against the original C++ (building/running the downloaded code needs the owner's permission in this environment), and gen~ compilation in Max (no Max here).
