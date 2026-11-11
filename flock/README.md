# FLØCK — granular texture audio effect for Max for Live

A gen~ port of the open-source **Beads** DSP (Emilie Gillet / Mutable Instruments, MIT — `LICENSE-BEADS.txt`). Not affiliated with Mutable Instruments.

**Status v0.1.0: test build, STATIC VALID + simulated. Not loaded in Max/Live yet.**

- `gen/flock.genexpr` — the engine (gen~ codebox), embedded into the device.
- `js/flock_ui.js` — the panel (jsui).
- `tools/build_device.py` — builds `max/flock_main.maxpat` and `dist/FLOCK/FLØCK.amxd` (`--dist`).
- `tools/genexpr.js` — runs/lints the GenExpr code in node; `tests/` — engine + device tests.
- `tools/render_demo.js` — offline demo through the real gen code (`renders/flock_demo.wav`).
- Plan and research: `docs/RESEARCH_AND_PLAN.md`; deviations: `docs/PORTING_NOTES.md`.

`npm test` · `npm run dist`
