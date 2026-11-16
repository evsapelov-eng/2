# STØMP — kick drum synthesizer (Max for Live Instrument)

A kick synth for Ableton Live 12: one gen~ voice — pitch-swept (or 808-style amplitude-coupled) sine body + phase-locked
SUB layer + band-passed noise click + noise + partials + FM + drive (PRE/POST, ASYM) + GLUE clipper + stereo top + small
room; a 5 ms crossfade on retrigger. jsui panel, every knob a Live parameter. MIDI notes set the pitch the kick lands on;
velocity, note and a per-hit random value (hsh(hit, knob) — the panel computes the same, so the screen shows the real
last hit) can be patched to any knob. DICE with locks and UNDO.

Built on FLØCK's pipeline (the one that runs in Live): one gen~ codebox, Params by message, hidden live.dials.

| Path | What |
|---|---|
| `tools/spec.py` | the parameter table (single source) |
| `gen/voice.part.genexpr` | the voice DSP, hand-written |
| `gen/stomp.genexpr` | GENERATED engine (`npm run gen`) — what goes into the codebox |
| `js/stomp_ui.js` | panel; its SPEC block is generated |
| `tools/build_device.py` | patch + `.amxd` (type `iiii`) + zip |
| `tools/render.js` | offline render of every preset → `renders/stomp_demo.wav` |
| `tests/` | engine (through `tools/genexpr.js`, which also lints gen~ rules), patch, panel |

```
npm test      # spec → engine up to date + all tests
npm run dist  # dist/STOMP_v<version>_test_build.zip
npm run render
```
Status: STATIC VALID + tests. Not yet opened in Max / Live.
