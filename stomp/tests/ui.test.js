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
  ui.svg(); ui.ctx.onclick(1284, 80);           // RND (third source) → patch mode, RANDOM selected
  assert.ok(ui.ctx.patchMode && ui.ctx.selSrc === 2);
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

test("presets and DICE set every sound knob inside 0..1, stay dry and mono (LEVEL / TUNE / WIDTH / SPACE survive DICE)", () => {
  const ui = boot(), n = ui.ctx.SPEC_KNOBS.length + ui.ctx.SPEC_SWITCHES.length;
  for (let i = 0; i < ui.ctx.PRESETS.length; i++) {
    ui.out.length = 0; ui.ctx.loadPreset(i);
    assert.strictEqual(ui.out.length, n);
    for (const [, , v] of ui.out) assert.ok(v >= 0 && v <= 1);
    const m = Object.fromEntries(sent(ui));
    assert.strictEqual(m.sp_amt, 0, ui.ctx.PRESETS[i][0] + " has no room");
    assert.strictEqual(m.wd_amt, 0, ui.ctx.PRESETS[i][0] + " is mono");
  }
  ui.ctx.p("level", 0.6); ui.ctx.p("tune", 0.7);
  for (let k = 0; k < 50; k++) {
    ui.out.length = 0; ui.ctx.dice();
    const m = Object.fromEntries(sent(ui));
    assert.strictEqual(m.level, 0.6); assert.strictEqual(m.tune, 0.7); assert.strictEqual(m.sp_amt, 0); assert.strictEqual(m.wd_amt, 0);
    for (const v of Object.values(m)) assert.ok(v >= 0 && v <= 1);
  }
});

test("the panel's numbers use the engine's maps (length, landing pitch)", () => {
  const ui = boot("p('amp_len', 0.5); p('tune', 0.5);");
  assert.strictEqual(ui.ctx.valueText("amp_len"), Math.round(0.05 * Math.pow(2, 2.66) * 1000) + " ms");
  assert.ok(Math.abs(ui.ctx.fnote(36) - 65.406) < 0.01);
  assert.ok(Math.abs(ui.ctx.model(0, 36, ui.ctx.effAll()).f - 65.40639 * Math.pow(2, 72 * ui.ctx.P.pit_swp.v / 12)) < 1e-3);
});

test("Max's old JavaScript: the whole panel draws with no ES6 (screen, VEL/RND, PATCH, cables, meter)", () => {
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "stomp_ui.js"), "utf8").replace(/\/\/[^\n]*/g, "");
  assert.ok(!/=>|\blet\b|\bconst\b|`|Math\.(tanh|log10|log2|sign|cbrt|hypot|trunc)|\.(includes|find|findIndex|padStart)\(|Object\.(assign|entries|values)/.test(src), "ES6 in the panel");
  for (const setup of ["note(36, 120); hitT = now() - 80;", "patchMode = true; selSrc = 1; p('r_fm_amt', 0.5);"]) {
    const ui = boot(setup), svg = ui.svg();
    assert.strictEqual(ui.ctx.lastError, "", ui.ctx.lastError);
    for (const t of ["VEL", "RND", "PATCH"]) assert.ok(svg.includes(">" + t + "<"), t);
  }
  assert.ok(boot("note(36, 100);").svg().match(/>65.4 Hz</), "the screen draws its labels");
});

// ---------------- v0.2 ----------------
test("alt-click locks a knob: DICE leaves it alone; UNDO brings the previous kick back", () => {
  const ui = boot("p('amp_len', 0.61); p('dr_amt', 0.2);"), [x, y] = center(ui, "amp_len");
  ui.ctx.onclick(x, y, 1, 0, 0, 0, 1);          // alt
  assert.ok(ui.ctx.locked.amp_len);
  assert.ok(ui.svg().length > 0);
  for (let k = 0; k < 20; k++) { ui.out.length = 0; ui.ctx.dice(); assert.strictEqual(Object.fromEntries(sent(ui)).amp_len, 0.61); }
  ui.out.length = 0; ui.ctx.undo();
  const m = Object.fromEntries(sent(ui));
  assert.strictEqual(m.dr_amt, 0.2, "UNDO sends the set from before the DICE");
});

test("808 and PRE are switches in the column headers", () => {
  const ui = boot(); ui.svg();
  const sw = Array.from(ui.ctx.hits.filter((h) => h.kind === "switch"), (h) => h.name).sort();
  assert.deepStrictEqual(sw, ["dr_pre", "p808"]);
  const h = Array.from(ui.ctx.hits).filter((q) => q.name === "p808")[0];
  ui.ctx.onclick(h.x + 3, h.y + 3);
  assert.deepStrictEqual(Array.from(sent(ui).pop()), ["p808", 1]);
});

test("the screen shows the REAL last hit: the panel's velocity / note / random = the engine's", () => {
  const fs = require("fs"), path = require("path"), { GenPatch } = require("../tools/genexpr");
  const set = { amp_len: 0.5, r_amp_len: 1, rnd_amt: 1, v_amp_len: 0.4, vel_amt: 1, k_amp_len: 0.3, note_amt: 1 };
  const g = new GenPatch(fs.readFileSync(path.join(__dirname, "..", "gen", "stomp.genexpr"), "utf8"), { sr: 48000 });
  for (const [k, v] of Object.entries(set)) g.set(k, v);
  g.run(16);
  const ui = boot(Object.entries(set).map(([k, v]) => `p('${k}', ${v});`).join(""));
  for (const [n, note, vel] of [[1, 36, 127], [2, 43, 90], [3, 30, 60]]) {
    g.set("knote", note); g.set("kvel", vel / 127); g.set("ktrig", n);
    const o = g.run(48000 * 2.2);
    let end = 0; for (let i = 0; i < o[2].length; i++) if (o[2][i] > 0) end = i;
    ui.ctx.note(note, vel); ui.ctx.hitno(n);
    const want = 0.05 * Math.pow(2, ui.ctx.eff("amp_len") * 5.32) * 48000;
    assert.ok(Math.abs(end - want) < 3, `hit ${n}: engine ${end} panel ${want.toFixed(0)}`);
  }
});
