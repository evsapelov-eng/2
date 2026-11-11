# Max/gen~ details written from memory — verify in Max

| # | What | Assumption | Check |
|---|---|---|---|
| F1 | gen~ embedded codebox | `gen~` box with `patcher.classnamespace = "dsp.gen"`, a `codebox` with the `code` attribute, `in 1..6`, `out 1..7` | the device loads; no error in the Max Console |
| F2 | GenExpr subset | `Param n(def, min=, max=)`, `History`, `Data n(len, ch)`, `peek/poke(data, …, channel)`, user functions before the body, `trunc`, `clamp`, `noise()`, `pi`; no reserved names reused (`tools/genexpr.js` lint) | gen~ compiles; sound |
| F3 | `Data buf(192004, 2)` | ~3 MB per channel accepted | no memory error |
| F4 | Messages `time 0.4` into gen~ inlet 1 | set the Param | knobs change the sound |
| F5 | live.dial / live.toggle as hidden parameters, `bang` from loadbang outputs the stored value | Live restores the values and sends them | the panel shows the saved values after reopening the Set |
| F6 | `snapshot~ 40`, `edge~`, `dbtoa`, `plugin~`/`plugout~` | standard MSP/Max | tape display moves; IN/OUT gain |
| F7 | jsui `onidle` / `onidleout` | hover events | hover help appears |
| F8 | CPU | 32 grains × Hermite read per sample in gen~ | Live CPU meter acceptable at 48 kHz |
