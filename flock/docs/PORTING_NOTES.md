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

## v0.3.2 — the Live test of the diagnostic kit
The kit had four devices: A pass-through, B engine v0.2.0, C v0.2.x (auto gain), D v0.3.1. All four
SOUNDED, so gen~ compiles. B sounded right to the user; C and D "screamed". Two causes:
- **Loudness**: AUTO was on by default. Like the module it raises a quiet source to near full scale
  (up to +32 dB). On a Eurorack module that makes sense, but on a DAW track it is far louder than the
  source. Now AUTO is off by default. When it is on, the output is divided by the gain: the engine
  (limiters, soft clip, 12-bit, µ-law) works on the normalised signal, and the level comes back to
  the input's. This is a deviation (R5).
- **"No sound" with the normal build** (v0.3.0 / v0.3.1): probably a name clash. Max resolves an
  .amxd and a jsui file by name, so an old FLØCK.amxd / flock_ui.js (still loaded, or elsewhere in
  the search path) can win over the new one. The diagnostic devices had other names and loaded
  fine. The file names now carry the version: FLØCK_<v>.amxd, flock_ui_<v>.js.

Playability tests: the level must be near the INPUT's level (−20 … +12 dB), no longer "above −40 dBFS".

## v0.3.4 — correction: only B (v0.2.0) sounded
I misread the report on the diagnostic kit: only B sounded, and D (v0.3.1) was silent too, so the v0.3
engine does not run in Max. The structural novelty against every version that sounded: v0.3 wrote
almost all History inside big if-blocks (the codec / core stages). v0.1–v0.2 always wrote History
unconditionally at the end of the pass. Changes:
- All 117 History writes go through `nh_*` locals and are written back at the top level at the end.
  The behaviour is unchanged (all 108 tests, the differential tests included, are identical).
- The linter now rejects History written inside a block (it rejects v0.3.0 with 120 errors).
- The codebox gets the code without comments and ASCII only (the source keeps its comments).
- Second diagnostic kit: A pass-through, B v0.2.0, M = v0.3.4, X = v0.3.4 with the two big blocks
  opened (the qualities run at the wrong rate; it only tells whether the blocks themselves are the
  problem).
Not confirmed in Max until the user tests it.

## v0.3.5 — size of the codebox text (main suspect after diagnostic kit 2)
Kit 2 had a bug of its own: the panel file had the old name, so every device showed a grey circle.
Its sound result was still clear: A and B sounded, M and X did not. So the History in the blocks was
not the cause (X has no blocks).

Codebox text sizes: the engines that sounded are 26–32 KB, the silent ones 40–50 KB. Max's classic
limit for one text/symbol is 32767 characters, and a cut-off code does not compile. The codebox now
gets `compact_code()`: comments stripped, internal names shortened, no indentation. It is the same
program, 30.4 KB, and the device test checks that it gives the same output as the source.

Kit 3 tests this directly: Z = the working v0.2.0 engine padded to 44 KB (silent if the limit is
real), M3 = the new engine compacted to 30 KB.

## v0.3.6 — found: big loops (diagnostic kits 4–6)
- Kit 4: B and C sounded; every v0.3 variant N1–N4 was silent.
- Kit 5: C plus one v0.3 construct each. Only K4 (the host-stage converter) was silent.
- Kit 6: K4 split into four parts. Only K4c was silent: the converter kernel table filled by a
  4097-step loop on the first sample. The converter loop alone (66 steps), the input ring and the
  functions called once per sample all sounded.

So Max does not run big loops. Probably gen~ unrolls loops with constant bounds and the compile
fails, but I have no confirmation. The working engines only had loops ≤ 32 steps.

Fix:
- The kernel table is filled progressively, 8 entries per host sample. The codec qualities are
  silent for the first 512 host samples (the reference does the same).
- The Sunny tape filter mirror is written out line by line.
- A quality change no longer loops over the buffer (384004 steps) or the SEED delay line. The
  frames written since the change are counted, and everything older reads as 0 (`bvalid`) — the
  same as a cleared buffer. Stale converter / SRC rings are not cleared, which gives a sub-ms
  transient on a change; the module's codec restart is silent instead.

The linter now rejects loops > 128 steps and loop bounds that look large (it rejects v0.3.5 with
four errors).

## v0.4.0 — native device (Live's own controls)
`FLOCK_<v>_native.amxd`: the hidden parameter objects of the SOUND page are placed in presentation
(`NATIVE_LAYOUT` in tools/build_device.py):
- live.dial for the five big knobs, the four RND, the mix and IN / OUT;
- live.text for FREEZE / LATCH / AUTO;
- live.tab for the quality.
The jsui draws everything else (logo, tabs, SEED with its gestures, DICE / BACK, the values in
musical units, tape, MOD page). On the MOD tab it hides the page's native objects with
`thispatcher` ("script sendbox <name> hidden 1").

Limitations:
- Live's objects follow Live's theme, but the panel's own background is dark. With a light Live
  theme the native labels may be hard to read.
- The look cannot be checked here (only a mock-up, renders/panel_native_mockup.png).

## v0.4.1 — the qualities rebuilt on the engine that runs in Max
Diagnostic kit 7: every variant of the v0.3 engine stayed silent, even with all suspects removed
(converter loops, tape effects, buffer gating, runtime loop bounds). Only B and N (both on the v0.2
engine) sounded. So Max does not run the v0.3 structure itself: the codec stage and the core stage as
nested conditional blocks executed on "ticks". The exact cause is unknown without Max's console.

Kit 8 rebuilt the qualities on the working engine C (v0.2.x) in cumulative steps Q0…Q4
(tools/lite_qualities.py). ALL sounded in Live. Q4 is the engine now:
- Formats, feedback soft clip and low-pass, dry formats, GainControl soft clip modes and the caveman
  reverb are as in Beads.
- Buffer durations are as in Beads: frames = duration × host rate, up to 768000.
- Wow & flutter keeps the module's times and depths, converted from 24 kHz to the host rate (delay ×
  FS/24000, low-pass 1 − 0.05^(24000/FS), rates per host sample).
- The codec rates are NOT emulated. Cold digital and Scorched cassette get the codec's bandwidth (two
  one-poles at 14 / 10 kHz on the input), and Sunny tape's grains run at the full rate.
- A quality change clears the buffer by counting the written frames (no loop).
- The reference (beads_ref.js) follows the same model. The differential tests pass for all qualities.
- The native device (Live's controls) is only built on request (`--native`): the user preferred the
  drawn Ableton-style panel.

## v0.5.0 — the critique worked through (U6–U8 in the matrix)
- Silence traps:
  - DENSITY 12 h with AUTO GRAINS = the slowest even grains, not none (deviation G1).
  - A quality change keeps the recording (deviation R7).
  - The tape shows "recording…" until the buffer reaches TIME (gen~ out12 = filled part).
- Names and readability:
  - SEED → TRIGGER, LATCH → AUTO GRAINS, RND → SPREAD (DEPTH when a cable is in);
  - fonts ≥ 7 px;
  - DEPTH bars with %;
  - step values in the help line;
  - tape seconds scale;
  - readable Live parameter names.
- One randomizer: DICE with SOUND / MOD / ALL and the recipe name; BACK undoes DICE, RANDOM and
  SLICE; SLICE = one-click slicer.
- Output level meter (peakamp~), IN / OUT as knobs, LEARN removed (AUTO on = learn afresh), one look.
- MIDI: FLØCK Keys (a MIDI effect, `send flock_keys`) → FLØCK (`receive flock_keys` → panel → gen~
  `ktrig` / `knote` / `kon`). Live does not send MIDI to audio effects, hence the second device.
- Not done in this round:
  - saving a frozen buffer in the Live Set (R3) — it needs the buffer outside gen~, a large change
    of the engine that just started running in Max;
  - delay mode (P5 / D1–D4) and the mono mode (R4) — whole DSP ports;
  - tempo-locked SIZE / TIME without the MOD tab;
  - presets as Live files (.adv cannot be checked here).

## v0.5.1 — clicks after RANDOM, IN / OUT knobs
- Clicks: a stepped source (CLOCK, SEQ, square / saw LFO, STEPS random) routed to DRY/WET, FEEDBACK
  or REVERB moved the level within ~2.5 ms (Beads' assign CV low-pass, 0.1 per block). A limiter
  cannot remove that: it is a jump in the waveform, not an over.
  - The low-pass is now 0.02 per block (≈12 ms). Measured: the fastest level jump of a 1 kHz tone
    under a square clock into DRY/WET went from 3.3 dB/ms to 0.8 dB/ms.
  - RANDOM gives these destinations only smooth sources (sine / triangle LFO, smooth RANDOM, ENV).
  - The output got a soft knee above 0.9, so there is never a hard digital clip.
- IN / OUT: the knob angle was drawn from the dB number instead of the knob position → it spun.
  Fixed (`norm()`), with a test of the needle.

## v0.6.0 — FILTER (FLØCK, not Beads)
A box like Live's Echo with two points.
- High cut: a Moog-style 4-pole ladder (Zavalishin TPT, linear solve of the feedback, tanh at the
  input, k = 4·res up to self-oscillation, output ×(1 + k/2) for part of the bass loss).
- Low cut: a 12 dB TPT state-variable high-pass, Q 0.707 … ≈4.7.
- Frequencies 20 Hz … 20 kHz on one log axis. The knobs are smoothed per sample (≈10 ms).
- The Cutoff modulation is ±5 octaves × depth.
- Placement: on the wet signal by default (FLØCK sounds in the band, the dry stays clean); `flt_all`
  puts it on the whole output.
- Defaults are fully open, so the filter is bypassed bit-exactly. The differential tests against the
  reference are therefore unaffected; the filter itself is measured in tests/engine.test.js.
- Found while building it: a filter local named `lv1` collided with the reverb LFO's `lv1` (legal
  in GenExpr: the later assignment wins). The filter state blew up. All filter locals now carry an
  `fq_` prefix.
- The panel is 1060 px wide now.
