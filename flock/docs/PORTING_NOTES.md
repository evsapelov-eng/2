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
| Auto input gain (+0…+32 dB) | ported in v0.2.x (GainControl 1:1, incl. the soft clipping modes per quality) | |
| Mono buffer when only L is patched (twice as long) | always stereo (mono option: v0.2) | Live always feeds stereo |
| SEED / FREEZE gate inputs, clocked divider | not yet (v0.3 brings Live-tempo clock) | |
| SIZE ∞ → delay mode, WAVES | later | staged port |

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

## v0.3 — the four recording qualities (R6, R7, X3)
Ported from `processor.h/.cc` (ENABLE_HARDWARE_24K is defined in the firmware), `granular_processor.h`,
`delay_line.h`, `mu_law.cc`, `fx/wow_and_flutter.h`, `sample_rate_conversion_filters.h`, `gain_control.cc`:

| Quality (MEDIA_*) | codec rate | core rate | buffer | item | feedback | dry | extras |
|---|---|---|---|---|---|---|---|
| Pristine (DIGITAL) | 48 k | 48 k | 192000 | 16-bit | fb² · 3, brickwall, LP 0.999 | as is | reverb 0.3 + 0.6 r³, lp 0.6 |
| Cold digital (VINTAGE_DIGITAL) | 32 k | 32 k | 256000 | 12-bit | fb · 3/1.3, limiter, SoftClip(·1.3) crossfaded by fb, LP 0.9 | trunc ·4096 | caveman reverb |
| Sunny tape (CLEAN_TAPE) | 48 k | 24 k (SRC ratio 2, 48 taps) | 256000 | 12-bit | as Cold digital | as is | caveman reverb; gain soft clip DYNAMIC |
| Scorched cassette (DIRTY_TAPE) | 24 k | 24 k | 384000 | 8-bit µ-law | fb · 3/1.75, SoftClip(·1.75), LP 0.75 | µ-law | wow & flutter (lp 0.95); gain soft clip ON; caveman reverb |

Everything the module runs per codec sample (gain control, trigger generator, CV/pots per block of
rate/4000 samples, mix, wow & flutter, limiters, reverb with delays in samples) runs at the codec rate:
at 24 kHz the reverb is twice as long in time, like on the module.

Checked against the source itself (not only the reference):
- **processor.cc reverb**: `caveman = media_ != MEDIA_DIGITAL`, so the `0.75` low-pass meant for
  MEDIA_VINTAGE_DIGITAL is unreachable — Cold digital uses 0.4 like the tapes. Ported as written.
- **µ-law**: `lut_ulaw_f` = the G.711 decoder / 32768 printed with 5 decimals; the formula reproduces
  all 256 entries of `mu_law.cc` (checked once against the file, spot values in a test).
- **Configure on a quality change**: DelayLine::Reset clears the buffer; grains, trigger generator,
  limiters and reverb LFOs re-initialised; GainControl::Init(reset = false) keeps a finished learning.
- **Random draw order**: WowAndFlutter draws its next random rate after the grains of the block; gen~
  does the draw on the last sample of the block, after the grains → the same stream as the module.

Deviations (FLØCK):
| Module | FLØCK | Why |
|---|---|---|
| The codec itself runs at 32 / 24 kHz | the engine runs on ticks of the codec rate inside the host rate, between two FLØCK converters: Kaiser-windowed sinc (β 7.5, cutoff 0.47 · codec rate, ±16 codec samples; −77 dB at 0.55); latency 32 codec samples (1 ms at 32 k, 1.3 ms at 24 k), not reported to Live | gen~ cannot change the host rate; the codec's own filters are not documented |
| Sunny tape: ratio-2 converters in block processing | the same 48-tap filters, streamed: a pair is processed on its second sample → wet path 2 codec samples later (42 µs) | per-sample gen~ |
| Pristine / Sunny tape at 48 kHz | at the host rate (as before) | |
| Each quality has its own GranularProcessor object (its feedback / DC filter / limiter state survive while another quality is used) | these states restart at a change | inaudible; one engine |
| Codec stopped during Configure (silence) | no gap; the clear of the buffer happens within one sample (a CPU spike on the change) | |
| lut_sine read with float32 | double sin() at the same table points | rounding only |
| Quality held while FREEZE is on (R7, manual) | held, applied after unfreeze | |

Tests: `tests/quality.test.js` — 21 differential scenarios (3 qualities × 7) against `beads_ref.js runHost`
(error < 1e-9), buffer lengths from `kDelayBufferSizeBits`, µ-law points, converter response, wow &
flutter and bandwidth of Scorched cassette, 12-bit dry truncation, clear + freeze hold, caveman reverb.
My wrong expectation, corrected against the formulas: "the caveman reverb is longer" — its time is
longer (0.45 + 0.5 r³) but the stronger damping (lp 0.4) leaves less energy after 1 s.

Test control (`npm run verify`, 37 mutations, 15 of them for the qualities): 35 caught on the first run. Two survived, and both were real blind spots:
- **AGC ceiling ×40 → ×35**: the optimal-gain expression had been duplicated for the tape soft clip, and the mutation hit the copy that only matters there. Now there is one `gopt`, used by both.
- **DYNAMIC soft clip 0.75 → 0.7**: the ×4 manual-gain case clamps the amount to 1. A ×2 case (amount ≈ 0.72) was added.

Both were re-checked one at a time (caught). All 37 are now caught.

## v0.3.1 — silent in Live again (v0.3.0)
v0.3.0 gave no sound at all in Live, not even the dry signal, which points to gen~ not compiling. The new code used names that are gen~ operators in Max: `rmod` (reverse modulo), `r` and `s` (receive / send). The linter's reserved list did not know them. Renamed (`wrm`, `rk`, `sk`, and the other short locals of the new functions); `History qc(-1)` → `qc(0)` (a negative initial value is not needed). The linter now also knows rsub / rdiv / rmod / r / s, fast math and the *p comparisons. Not confirmed in Max until the user tests it.
