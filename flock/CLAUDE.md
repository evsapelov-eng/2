# FLØCK — rules for Claude Code

The user's request (2026-11-11): **after every action, check yourself for logic and compare it with the main matrix and idea of the instrument we are porting.**

The reference is **`docs/FEATURE_MATRIX.md`** (Beads → source → FLØCK → test → status). The source of truth for behaviour is the Beads code (`pichenettes/eurorack/beads` @ f4cfa76) and its manual, not my assumptions.

## Before a change
1. Name the matrix rows the change touches (IDs: R…, G…, P…, X…, D…, W…, L…).
2. Look at what Beads does in that place: the line in the C++ or the manual paragraph. Don't invent behaviour.

## After every change (required)
1. `npm test`, which includes `tools/check_matrix.js`. A DONE / PARTIAL / DEVIATION status without an existing test fails the run.
2. Update the matrix rows: status, how it's done, which test proves it.
3. Any deliberate departure from Beads goes to DEVIATION here and to `docs/PORTING_NOTES.md` with the reason.
4. Logic check:
   - Does it behave as in Beads (code/manual)?
   - Did it break other rows (run the tests again)?
   - Do the panel texts, help, `dist_README.txt` and the parameter names say the same thing?
   - If a test contradicts Beads, the test is wrong. If it contradicts my expectation but matches Beads, my expectation is wrong; fix the test against the formula from C.
5. In the reply to the user, a short **"Check against the matrix"** section: which rows were touched, what was confirmed and by what, what is still not like Beads.

## Technical
- `gen/flock.genexpr` is the gen~ code. Only the subset that `tools/genexpr.js` runs and lints: reserved gen~ names, block scope of locals, History written at the end of a pass, **functions before Param/Data/History**, **no locals from outside a loop assigned inside it (accumulators in Data)**. The rules come from a real Max 9.1 compiler (see PORTING_NOTES). The very first test in Live (v0.1.1) was silent precisely because of them.
- `js/flock_ui.js` is ES5 jsui. Every control is a Live parameter (`tools/build_device.py`).
- Build: `npm run dist` (the .amxd is a test build; the final one is a Freeze in Max).
- Beads is MIT: keep `LICENSE-BEADS.txt`; don't use the Mutable Instruments / Beads names and logos in the product.
