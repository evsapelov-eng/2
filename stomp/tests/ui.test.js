// The panel (js/stomp_ui.js) in node with an mgraphics shim. NOT Max.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { boot } = require("../tools/preview");
const sent = (ui) => ui.out.map((a) => a.slice(1));
function center(ui, name) { ui.svg(); const k = ui.ctx.KNOB_POS[name]; return [k[0], k[1]]; }

test("the panel draws every section and knob label", () => {
  const svg = boot().svg();
  for (const t of ["AMP", "PITCH", "CLICK", "NOISE", "HARM", "DRIVE", "FM", "STEREO", "OUT", "LENGTH", "SWEEP", "PLAY", "DICE", "PATCH", "VEL", "RND"])
    assert.ok(svg.includes(">" + t + "<"), t);
});

test("dragging a knob up sends its new value; double-click = default", () => {
  const ui = boot(), [x, y] = center(ui, "dr_amt");
  ui.ctx.onclick(x, y); ui.ctx.ondrag(x, y - 20, 1); ui.ctx.ondrag(x, y - 20, 0);
  const s = sent(ui).filter((m) => m[0] === "dr_amt");
  assert.ok(Math.abs(s[s.length - 1][1] - 0.49) < 1e-9);
  ui.out.length = 0; ui.ctx.ondblclick(x, y);
  assert.deepStrictEqual(sent(ui), [["dr_amt", 0.35]]);
});

test("PLAY pad: the last MIDI note at full velocity, then a hit", () => {
  const ui = boot("note(43, 100);");
  ui.svg(); ui.ctx.onclick(40, 80);
  assert.deepStrictEqual(sent(ui), [["knote", 43], ["kvel", 1], ["hit"]]);
});

test("PATCH: click a knob = cable from the source (depth 50 %), drag = depth, double-click = cut", () => {
  const ui = boot();
  ui.svg(); ui.ctx.onclick(1040, 60);           // RND (second source) → patch mode, RANDOM selected
  assert.ok(ui.ctx.patchMode && ui.ctx.selSrc === 1);
  const [x, y] = center(ui, "fm_amt");
  ui.ctx.onclick(x, y);
  assert.deepStrictEqual(sent(ui).pop(), ["r_fm_amt", 0.5]);
  ui.ctx.ondrag(x, y - 10, 1);
  assert.deepStrictEqual(sent(ui).pop(), ["r_fm_amt", 0.64]);
  ui.ctx.ondrag(x, y - 10, 0);
  ui.ctx.ondblclick(x, y);
  assert.deepStrictEqual(sent(ui).pop(), ["r_fm_amt", 0]);
  ui.ctx.p("r_fm_amt", 0.4);
  assert.ok(ui.svg().includes(">+40%<"), "patch mode shows the depth under the knob");
});

test("presets and DICE set every sound knob inside 0..1 (LEVEL / TUNE survive DICE)", () => {
  const ui = boot(), n = ui.ctx.SPEC_KNOBS.length;
  for (let i = 0; i < ui.ctx.PRESETS.length; i++) {
    ui.out.length = 0; ui.ctx.loadPreset(i);
    assert.strictEqual(ui.out.length, n);
    for (const [, , v] of ui.out) assert.ok(v >= 0 && v <= 1);
  }
  ui.ctx.p("level", 0.6); ui.ctx.p("tune", 0.7);
  for (let k = 0; k < 50; k++) {
    ui.out.length = 0; ui.ctx.dice();
    const m = Object.fromEntries(sent(ui));
    assert.strictEqual(m.level, 0.6); assert.strictEqual(m.tune, 0.7);
    for (const v of Object.values(m)) assert.ok(v >= 0 && v <= 1);
  }
});

test("the panel's numbers use the engine's maps (length, landing pitch)", () => {
  const ui = boot("p('amp_len', 0.5); p('tune', 0.5);");
  assert.strictEqual(ui.ctx.valueText("amp_len"), Math.round(0.05 * Math.pow(2, 2.66) * 1000) + " ms");
  assert.ok(Math.abs(ui.ctx.fnote(36) - 65.406) < 0.01);
  assert.ok(Math.abs(ui.ctx.model(0, 36).f - 65.40639 * Math.pow(2, 72 * ui.ctx.P.pit_swp.v / 12)) < 1e-3);
});
