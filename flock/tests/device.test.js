// Static checks of the generated device + the panel run in an mgraphics→SVG shim. NOT Max.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { parse } = require("../tools/genexpr");

const ROOT = path.join(__dirname, "..");
const patch = JSON.parse(fs.readFileSync(path.join(ROOT, "max", "flock_main.maxpat"), "utf8")).patcher;
const boxes = patch.boxes.map((b) => b.box);
const decl = parse(fs.readFileSync(path.join(ROOT, "gen", "flock.genexpr"), "utf8")).decl;

test("every Live parameter reaches an existing gen~ Param and the panel; panel outputs route to the parameters", () => {
  const params = boxes.filter((b) => b.parameter_enable);
  assert.strictEqual(params.length, 75);
  const byId = Object.fromEntries(boxes.map((b) => [b.id, b]));
  const outsOf = (id) => patch.lines.filter((l) => l.patchline.source[0] === id).map((l) => byId[l.patchline.destination[0]]);
  for (const p of params) {
    const targets = outsOf(p.id);
    const toUi = targets.find((b) => b.text === "prepend p " + p.varname);
    assert.ok(toUi, p.varname + " → panel");
    let chain = targets.filter((b) => b !== toUi);
    if (chain[0].text === "dbtoa") chain = outsOf(chain[0].id);
    const eng = chain[0].text.split(" ")[1];
    assert.ok(decl.params[eng], `${p.varname} → gen~ Param '${eng}' exists`);
    assert.ok(outsOf(chain[0].id).some((b) => b.text === "gen~"));
    const va = p.saved_attribute_attributes.valueof;
    const def = decl.params[eng].def;
    if (va.parameter_unitstyle !== 4) assert.strictEqual(va.parameter_initial[0], def, p.varname + " default = engine default");
    if (decl.params[eng].min !== undefined && va.parameter_unitstyle !== 4) assert.ok(va.parameter_mmin >= decl.params[eng].min && va.parameter_mmax <= decl.params[eng].max, p.varname + " range inside the engine range");
  }
  const route = boxes.find((b) => (b.text || "").startsWith("route "));
  assert.deepStrictEqual(route.text.split(" ").slice(1).sort(), params.map((p) => p.varname).sort());
});

test("gen~ box embeds the engine code with matching inlet/outlet counts; device is an audio effect strip 1060×169", () => {
  const g = boxes.find((b) => b.text === "gen~");
  const cb = g.patcher.boxes.map((b) => b.box).find((b) => b.maxclass === "codebox");
  assert.ok(cb.code.includes("Param time(") && g.patcher.classnamespace === "dsp.gen");
  // the embedded text: ASCII, no comments, passes the lint (incl. "no History written inside a
  // block") and runs exactly like the commented source
  assert.ok(!/[^\x00-\x7f]/.test(cb.code) && !cb.code.includes("//"), "ASCII, no comments");
  const { GenPatch } = require("../tools/genexpr");
  const src = fs.readFileSync(path.join(ROOT, "gen", "flock.genexpr"), "utf8");
  const n = 4800, x = Float64Array.from({ length: n }, (_, i) => 0.3 * Math.sin(i * 0.05));
  const a = new GenPatch(cb.code, { sr: 48000, seed: 1 }).run(n, [x, x]), b = new GenPatch(src, { sr: 48000, seed: 1 }).run(n, [x, x]);
  assert.deepStrictEqual(Array.from(a[0]), Array.from(b[0]));
  assert.strictEqual(g.numinlets, 11); assert.strictEqual(g.numoutlets, 13);
  const byId = Object.fromEntries(boxes.map((b) => [b.id, b]));
  const ph = boxes.find((b) => b.text === "phasor~ 1n @lock 1");
  assert.ok(patch.lines.some((l) => l.patchline.source[0] === ph.id && byId[l.patchline.destination[0]].text === "gen~" && l.patchline.destination[1] === 6), "bar phase → gen~ in7");
  assert.strictEqual(patch.devicewidth, 1060);
  const ui = boxes.find((b) => b.maxclass === "jsui");
  assert.deepStrictEqual(ui.presentation_rect, [0, 0, 1060, 169]);
});

// ---------- panel in an SVG shim ----------
function makeShim(w, h) {
  const els = [];
  let rgba = [1, 1, 1, 1], lw = 1, font = 10, bold = false, d = "", tx = [0, 0], gid = 0, pattern = null;
  const defs = [];
  const color = () => `rgba(${Math.round(rgba[0] * 255)},${Math.round(rgba[1] * 255)},${Math.round(rgba[2] * 255)},${rgba[3]})`;
  const g = {
    size: [w, h], init() {}, redraw() {}, scale() {},
    set_source_rgba(r, gg, b, a) { rgba = [r, gg, b, a]; pattern = null; }, set_line_width(v) { lw = v; },
    rectangle(x, y, ww, hh) { d += `M${x},${y}h${ww}v${hh}h${-ww}Z`; },
    ellipse(x, y, ww, hh) { const rx = ww / 2, ry = hh / 2; d += `M${x},${y + ry}a${rx},${ry} 0 1,0 ${ww},0a${rx},${ry} 0 1,0 ${-ww},0`; },
    move_to(x, y) { d += `M${x},${y}`; tx = [x, y]; }, line_to(x, y) { d += `L${x},${y}`; },
    curve_to(a, b, c, e, x, y) { d += `C${a},${b} ${c},${e} ${x},${y}`; },
    pattern_create_radial(x1, y1, r1, x2, y2, r2) {
      const id = "g" + (gid++), stops = [];
      return { id, add_color_stop_rgba(o, r, gg, b, al) { stops.push(`<stop offset="${o}" stop-color="rgb(${Math.round(r * 255)},${Math.round(gg * 255)},${Math.round(b * 255)})" stop-opacity="${al}"/>`); },
        def() { return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${x2}" cy="${y2}" r="${r2}" fx="${x1}" fy="${y1}">${stops.join("")}</radialGradient>`; } };
    },
    set_source(pt) { pattern = pt; },
    fill() { if (pattern) { defs.push(pattern.def()); els.push(`<path d="${d}" fill="url(#${pattern.id})"/>`); pattern = null; } else els.push(`<path d="${d}" fill="${color()}"/>`); d = ""; },
    stroke() { els.push(`<path d="${d}" fill="none" stroke="${color()}" stroke-width="${lw}" stroke-linecap="round"/>`); d = ""; },
    select_font_face(n) { bold = /Bold/.test(n || ""); }, set_font_size(s) { font = s; },
    text_measure(s) { return [s.length * font * 0.58, font]; },
    show_text(s) { els.push(`<text x="${tx[0]}" y="${tx[1]}" font-family="Arial,Helvetica,sans-serif" font-size="${font}" font-weight="${bold ? 700 : 400}" fill="${color()}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`); d = ""; },
  };
  g.svg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join("")}</defs>${els.join("")}</svg>`;
  g.reset = () => { els.length = 0; defs.length = 0; };
  return g;
}
function boot() {
  const mg = makeShim(1060, 169), out = [];
  const ctx = vm.createContext({ mgraphics: mg, outlet: (...a) => out.push(a), post() {}, Task: function () { this.repeat = () => {}; this.cancel = () => {}; } });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "flock_ui.js"), "utf8"), ctx);
  const draw = () => { mg.reset(); ctx.paint(); };
  return { ctx, mg, out, draw };
}

test("panel: knobs send their parameter, toggles toggle, SEED is momentary, double-click = default, text stays inside", () => {
  const b = boot();
  b.draw();
  const hitFor = (name) => b.ctx.hits.find((h) => h.name === name);
  for (const name of ["time", "density", "pitch", "size", "shape", "time_amt", "pitch_amt", "size_amt", "shape_amt", "feedback", "drywet", "reverb", "input", "output"]) {
    const h = hitFor(name); assert.ok(h, name);
    b.out.length = 0;
    b.ctx.onclick(h.x + h.w / 2, h.y + h.h / 2, 1, 0, 0); b.ctx.ondrag(h.x + h.w / 2, h.y + h.h / 2 - 30, 0, 0, 0);
    const m = b.out.pop(); assert.strictEqual(m[1], name);
    b.ctx.p(name, m[2]); b.draw();
  }
  const fz = hitFor("freeze"); b.out.length = 0; b.ctx.onclick(fz.x + 5, fz.y + 5, 1); assert.deepStrictEqual(b.out.pop().slice(1), ["freeze", 1]);
  b.ctx.p("seedlatch", 0);   // gated mode: SEED is a plain momentary button
  const sd = hitFor("seed"); b.out.length = 0; b.ctx.onclick(sd.x + 5, sd.y + 5, 1); b.ctx.ondrag(sd.x + 5, sd.y + 5, 0);
  assert.deepStrictEqual(b.out.map((m) => m.slice(1)), [["seed", 1], ["seed", 0]]);
  const t = hitFor("time"); b.out.length = 0; b.ctx.ondblclick(t.x + 10, t.y + 10); assert.deepStrictEqual(b.out.pop().slice(1), ["time", 0.15]);
  b.ctx.tape(0.3, 12); b.ctx.grain(0.4, 2); b.ctx.grain(0.6, -1); b.ctx.onidle(t.x + 10, t.y + 10); b.draw();
  const svg = b.mg.svg();
  assert.ok(svg.includes("TIME: where the grains start"));
  for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" [^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)) {
    const [x, y, f, s] = [+m[1], +m[2], +m[3], m[4]];
    assert.ok(x >= 0 && y <= 169 && y - f >= 0 && x + s.length * f * 0.58 <= 1061, `"${s}" at ${x},${y}`);
  }
  fs.mkdirSync(path.join(ROOT, "renders"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "renders", "panel.svg"), svg);
});

test("value texts follow the engine laws (grain rate, transposition, grain length)", () => {
  const b = boot();
  b.ctx.p("density", 0.2); assert.match(b.ctx.valueText("density"), /^\d+(\.\d)? \/s even$/);
  b.ctx.p("density", 0.5); assert.strictEqual(b.ctx.valueText("density"), "0.64 /s even");   // FLØCK: no dead zone with AUTO GRAINS
  b.ctx.p("pitch", (5.15 / 6 + 1) / 2); assert.strictEqual(b.ctx.valueText("pitch"), "+12 st");
  b.ctx.p("size", 0.2); assert.match(b.ctx.valueText("size"), /^rev /);
});

test("SEED gestures as on Beads: short press while latched → LATCH off (+ a grain); hold 4 s → LATCH on", () => {
  const b = boot(); b.draw();
  let t = 1000; b.ctx.now = () => t;
  const sd = b.ctx.hits.find((h) => h.name === "seed");
  b.out.length = 0;
  b.ctx.onclick(sd.x + 5, sd.y + 5, 1); b.ctx.ondrag(sd.x + 5, sd.y + 5, 0);
  assert.deepStrictEqual(b.out.map((m) => m.slice(1)), [["seedlatch", 0], ["seed", 1], ["seed", 0]]);
  b.ctx.p("seedlatch", 0); b.out.length = 0;
  b.ctx.onclick(sd.x + 5, sd.y + 5, 1); t += 3900; b.ctx.checkHold();
  assert.ok(!b.out.some((m) => m[1] === "seedlatch"), "not yet at 3.9 s");
  t += 200; b.ctx.checkHold(); b.ctx.checkHold();
  assert.strictEqual(b.out.filter((m) => m[1] === "seedlatch" && m[2] === 1).length, 1, "latched once at 4 s");
});

test("SIZE fully CW shows the longest grain (no promise of an unfinished mode); TIME seconds follow the host rate and the quality", () => {
  const b = boot();
  b.ctx.p("size", 1); assert.match(b.ctx.valueText("size"), /^4(\.0)? s$/);
  b.ctx.p("time", 1); assert.strictEqual(b.ctx.valueText("time"), "-4 s");
  b.ctx.sr(44100); assert.strictEqual(b.ctx.valueText("time"), "-4.4 s");
  b.ctx.p("quality", 3); assert.strictEqual(b.ctx.valueText("time"), "-16 s");
});

test("engine status: the panel warns when the record head stops moving (gen~ not running), not while FROZEN", () => {
  const b = boot(); let t = 0; b.ctx.now = () => t;
  const shown = () => { b.draw(); return b.mg.svg().includes("ENGINE NOT RUNNING"); };
  assert.ok(shown(), "no engine data yet");
  b.ctx.tape(0.5, 3); t += 100; b.ctx.tape(0.49, 3);
  assert.ok(!shown(), "head moves → ok");
  t += 2000; b.ctx.tape(0.49, 3);
  assert.ok(shown(), "head stopped for 2 s → warning");
  b.ctx.p("freeze", 1);
  assert.ok(!shown(), "frozen: a standing head is expected");
});

test("gen~ code obeys the Max 9.1 compiler rules (functions first, no loop-carried locals) — lint passes", () => {
  const { compile } = require("../tools/genexpr");
  const src = fs.readFileSync(path.join(ROOT, "gen", "flock.genexpr"), "utf8");
  assert.doesNotThrow(() => compile(src));
  const bad = "Param a(0, min=0, max=1);\nf(x) {\n\treturn x;\n}\nout1 = f(a);\n";
  assert.throws(() => compile(bad), /defined after a Param/);
  const carried = "Param a(0, min=0, max=1);\ns = 0;\nfor (i = 0; i < 4; i += 1) {\n\tif (a > 0) {\n\t\ts = s + 1;\n\t}\n}\nout1 = s;\n";
  assert.throws(() => compile(carried), /keep it in Data/);
});


test("MOD tab: drag a cable source → destination, pick it up again, RANDOM ≤ MAX cables, CLEAR; RND turns into CV when patched", () => {
  const b = boot(); b.draw();
  const tab = b.ctx.hits.find((h) => h.kind === "tab" && h.tab === "MOD");
  b.ctx.onclick(tab.x + 5, tab.y + 5, 1); b.draw();
  const src = (i) => b.ctx.hits.find((h) => h.kind === "jack_src" && h.src === i);
  const dst = (n) => b.ctx.hits.find((h) => h.kind === "jack_dst" && h.name === "dst_" + n);
  // CLOCK (5) → Seed
  let s = src(5), d = dst("seed");
  b.out.length = 0;
  b.ctx.onclick(s.x + 8, s.y + 8, 1); b.ctx.ondrag(d.x + 8, d.y + 7, 1); b.ctx.ondrag(d.x + 8, d.y + 7, 0);
  assert.deepStrictEqual(b.out.pop().slice(1), ["dst_seed", 5]);
  b.ctx.p("dst_seed", 5); b.draw();
  // pick it up and drop it nowhere → removed
  b.out.length = 0; d = dst("seed");
  b.ctx.onclick(d.x + 8, d.y + 7, 1); b.ctx.ondrag(400, 100, 0);
  assert.deepStrictEqual(b.out.map((m) => m.slice(1)), [["dst_seed", 0]]);
  // destination → source works too: Time ← SEQ (6)
  b.ctx.p("dst_seed", 0); b.draw(); b.out.length = 0;
  d = dst("time"); s = src(6);
  b.ctx.onclick(d.x + 8, d.y + 7, 1); b.ctx.ondrag(s.x + 8, s.y + 8, 0);
  assert.deepStrictEqual(b.out.pop().slice(1), ["dst_time", 6]);
  b.ctx.p("dst_time", 6); b.ctx.p("time_amt", 0.9);
  assert.match(b.ctx.valueText("time_amt"), /^CV x/);
  b.ctx.p("time_amt", 0.1); assert.match(b.ctx.valueText("time_amt"), /^CV rnd/);
  // RANDOM with MAX 3: 10 resets, then 1..3 cables
  for (let k = 0; k < 20; k++) {
    b.out.length = 0;
    const r = b.ctx.hits.find((h) => h.name === "random"); b.ctx.onclick(r.x + 5, r.y + 5, 1);
    const set = b.out.filter((m) => /^dst_/.test(m[1]) && m[2] > 0);
    assert.ok(set.length >= 1 && set.length <= 3 && set.every((m) => m[2] >= 1 && m[2] <= 6));
  }
  b.out.length = 0;
  const c = b.ctx.hits.find((h) => h.name === "clear"); b.ctx.onclick(c.x + 5, c.y + 5, 1);
  assert.strictEqual(b.out.filter((m) => /^dst_/.test(m[1]) && m[2] === 0).length, 11);   // 11 destinations (+ Cutoff)
  b.ctx.p("dst_seed", 5); b.ctx.p("dst_time", 6); b.ctx.p("dst_reverb", 1); b.ctx.seq(3, 1); b.draw();
  const svg = b.mg.svg();
  for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" [^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)) {
    const [x, y, f, t] = [+m[1], +m[2], +m[3], m[4]];
    assert.ok(x >= 0 && y <= 169 && y - f >= 0 && x + t.length * f * 0.58 <= 1061, `"${t}" at ${x},${y}`);
  }
  fs.writeFileSync(path.join(ROOT, "renders", "panel_mod.svg"), svg);
});

test("MOD tab sequencer: click toggles a step (value kept), drag sets its value; DIV / LEN drag in steps", () => {
  const b = boot(); b.ctx.onclick(70, 55, 1); b.draw();
  const tab = b.ctx.hits.find((h) => h.kind === "tab" && h.tab === "MOD"); b.ctx.onclick(tab.x + 5, tab.y + 5, 1); b.draw();
  const step = (i) => b.ctx.hits.find((h) => h.kind === "step" && h.step === i);
  let h = step(4); b.out.length = 0;                         // step 5 is on (0.25) → off, value kept
  b.ctx.onclick(h.x + 3, h.y + 5, 1); b.ctx.ondrag(h.x + 3, h.y + 5, 0);
  const off = b.out.pop(); assert.strictEqual(off[1], "sq4"); assert.ok(off[2] < 0);
  b.ctx.p("sq4", off[2]); assert.ok(Math.abs(b.ctx.stepVal(4) - 0.25) < 0.01, "value kept while off");
  h = step(1); b.out.length = 0;                             // drag on an off step: on + value
  b.ctx.onclick(h.x + 3, h.y + h.h - 2, 1); b.ctx.ondrag(h.x + 3, h.y + 2, 1); b.ctx.ondrag(h.x + 3, h.y + 2, 0);
  const on = b.out.pop(); assert.strictEqual(on[1], "sq1"); assert.ok(on[2] > 0.8);
  const div = b.ctx.hits.find((x) => x.name === "sq_div"); b.out.length = 0;
  b.ctx.onclick(div.x + 5, div.y + 5, 1); b.ctx.ondrag(div.x + 5, div.y - 20, 0);
  const dv = b.out.pop(); assert.strictEqual(dv[1], "sq_div"); assert.ok(Number.isInteger(dv[2]) && dv[2] >= 0 && dv[2] <= 14);
});

test("v0.5 panel: MIDI keys, one randomizer with BACK, SLICE, DEPTH labels, level / fill messages", () => {
  const b = boot(); b.draw();
  // a key: AUTO GRAINS off, keys on, note relative to C3, held; release: not held
  b.out.length = 0; b.ctx.p("seedlatch", 1);
  b.ctx.note(67, 100);
  const sent = b.out.map((m) => m.slice(1).join(" "));
  assert.ok(sent.includes("seedlatch 0") && sent.includes("kon 1") && sent.includes("knote 7") && sent.includes("ktrig 1"), sent.join(", "));
  b.ctx.note(72, 90); b.out.length = 0; b.ctx.note(72, 0);
  assert.deepStrictEqual(b.out.map((m) => m.slice(1).join(" ")).filter((x) => /^k/.test(x)), ["kon 1", "knote 7", "ktrig 1"], "back to the held key");
  b.out.length = 0; b.ctx.note(67, 0);
  assert.deepStrictEqual(b.out.map((m) => m.slice(1).join(" ")), ["ktrig 0"]);
  // DICE modes: SOUND / MOD / ALL; BACK undoes a RANDOM patch too
  const before = JSON.stringify(b.ctx.snapshot());
  b.ctx.diceMode = 1; vm.runInContext("diceMode = 1", b.ctx);
  b.ctx.diceButton();
  b.out.forEach((m) => { if (m[1] && b.ctx.P[m[1]]) b.ctx.p(m[1], m[2]); });
  b.ctx.back(); b.out.forEach((m) => { if (m[1] && b.ctx.P[m[1]]) b.ctx.p(m[1], m[2]); });
  assert.strictEqual(JSON.stringify(b.ctx.snapshot()), before, "BACK after a random patch");
  // SLICE: SEQ into TRIGGER and TIME, AUTO GRAINS off
  b.out.length = 0; b.ctx.slice();
  const sl = Object.fromEntries(b.out.map((m) => [m[1], m[2]]));
  assert.ok(sl.dst_seed === 6 && sl.dst_time === 6 && sl.seedlatch === 0, JSON.stringify(sl));
  // display messages and the MOD page labels
  b.ctx.level(0.5, 1.2); b.ctx.fill(0.3); b.draw();
  b.ctx.p("time", 0.6); b.draw();
  assert.ok(b.mg.svg().includes("recording..."), "TIME beyond what is recorded yet");
  vm.runInContext('tab = "MOD"', b.ctx); b.draw();
  const svg = b.mg.svg();
  assert.ok(svg.includes(">DEPTH<") && svg.includes(">SLICE<") && svg.includes(">Trigger<"));
});

test("FLØCK Keys: a MIDI effect device that sends its notes to FLØCK (and passes MIDI through)", () => {
  const dir = path.join(ROOT, "dist", "FLOCK"), f = fs.readdirSync(dir).find((x) => x.startsWith("FLOCK_Keys_"));
  const buf = fs.readFileSync(path.join(dir, f));
  assert.strictEqual(buf.slice(8, 12).toString(), "mmmm", "MIDI effect");
  const i = buf.indexOf("ptch"), n = buf.readUInt32LE(i + 4);
  const pj = JSON.parse(buf.slice(i + 8, i + 8 + n).toString("utf8").replace(/\n\0$/, "")).patcher;
  const t = pj.boxes.map((x) => x.box.text);
  assert.ok(t.includes("midiin") && t.includes("midiparse") && t.includes("send flock_keys") && t.includes("midiout"));
  assert.ok(boxes.some((x) => x.text === "receive flock_keys") && boxes.some((x) => x.text === "route agc_restart ktrig knote kon"));
});

test("IN / OUT knobs: the needle follows the knob position (dB range), not the dB number", () => {
  const b = boot();
  const A0 = Math.PI * 0.75, A1 = Math.PI * 2.25, rr = 10 * 0.82;
  for (const [db, n] of [[-12, 0], [-2, 10 / 44], [32, 1]]) {
    b.ctx.p("input", db); b.draw();
    const a = A0 + (A1 - A0) * n, x = 978 + Math.cos(a) * rr, y = 40 + Math.sin(a) * rr;
    assert.ok(b.mg.svg().includes(`M978,40L${x},${y}`), `needle for ${db} dB at ${Math.round(n * 100)} %`);
  }
});

test("RANDOM never puts a stepped source (CLOCK, SEQ, square / saw LFO, STEPS random) into a loudness destination", () => {
  const b = boot();
  const state = Object.fromEntries(Object.keys(b.ctx.P).map((k) => [k, b.ctx.P[k].v]));
  b.ctx.outlet = (o, name, v) => { state[name] = v; b.ctx.p(name, v); };
  vm.runInContext("outlet = function (o, n, v) { __o(o, n, v); }", Object.assign(b.ctx, { __o: b.ctx.outlet }));
  for (let k = 0; k < 300; k++) {
    b.ctx.p("l1_shape", k % 4); b.ctx.p("l2_shape", (k + 2) % 4); b.ctx.p("rn_smooth", k % 2);
    b.ctx.randomPatch(true);
    for (const d of ["feedback", "reverb", "drywet", "density"]) {
      const s = Math.round(b.ctx.P["dst_" + d].v);
      if (!s) continue;
      assert.ok(s !== 5 && s !== 6, d + " <- " + s);
      if (s <= 2) assert.ok(b.ctx.P["l" + s + "_shape"].v < 1.5, d + " <- LFO " + s + " shape " + b.ctx.P["l" + s + "_shape"].v);
      if (s === 3) assert.strictEqual(b.ctx.P.rn_smooth.v, 1);
    }
  }
});

test("FILTER box: drag a point = frequency across, resonance up; click picks the nearest point; double-click = home", () => {
  const b = boot(); b.draw();
  const box = b.ctx.hits.find((h) => h.name === "fbox");
  assert.ok(box && box.w > 100, "the box");
  const X = (f) => box.x + 6 + Math.log(f / 20) / Math.log(1000) * (box.w - 12), Y = (r) => box.y + box.h - 8 - r * (box.h - 22);
  // grab the high-cut point (right edge, open) and pull it to 2 kHz, half resonance
  const pl = b.ctx.hits.find((h) => h.name === "f_lp");
  b.out.length = 0; b.ctx.onclick(pl.x + 8, pl.y + 8, 1); b.ctx.ondrag(X(2000), Y(0.5), 1);
  const last = (n) => b.out.filter((m) => m[1] === n).pop()[2];
  assert.ok(Math.abs(last("lp_cut") - Math.log(100) / Math.log(1000)) < 0.01 && Math.abs(last("lp_res") - 0.5) < 0.01);
  b.ctx.ondrag(X(2000), Y(0.5), 0);
  b.ctx.p("lp_cut", last("lp_cut")); b.ctx.p("lp_res", 0.5); b.draw();
  // a click near the left = the low-cut point moves there
  b.out.length = 0; b.ctx.onclick(X(150), Y(0), 1); b.ctx.ondrag(X(150), Y(0), 0);
  assert.ok(Math.abs(last("hp_cut") - Math.log(7.5) / Math.log(1000)) < 0.01, "low cut to 150 Hz");
  // double-click on the high-cut point: open again
  b.draw(); const p2 = b.ctx.hits.find((h) => h.name === "f_lp");
  b.out.length = 0; b.ctx.ondblclick(p2.x + 8, p2.y + 8);
  assert.ok(last("lp_cut") === 1 && last("lp_res") === 0);
  assert.strictEqual(b.ctx.valueText("hp_cut"), "off"); b.ctx.p("lp_cut", Math.log(100) / Math.log(1000)); assert.strictEqual(b.ctx.valueText("lp_cut"), "2 kHz");
});
