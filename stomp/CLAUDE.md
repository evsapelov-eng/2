# STØMP — rules for Claude Code
- Parameters live in `tools/spec.py`; the voice in `gen/voice.part.genexpr`. Never edit `gen/stomp.genexpr`
  or the SPEC block of `js/stomp_ui.js` by hand: `npm run gen`.
- gen~ subset (FLØCK's lessons from real Max): functions first, then Param/Data/History; History written only
  at the top level at the end; no loops; no exponent literals (1e-9); no gen~ operator names as locals.
  `tools/genexpr.js` lints this — the tests fail on a violation.
- The panel maps (valueText / model) must match the engine's formulas; `tests/ui.test.js` checks it.
- After a change: `npm test`; after DSP changes also `npm run render` and listen to / measure the presets.
- Own design: do not copy the look, names or layout of a commercial device.
- Replies to the user in Russian.
