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
  assert.strictEqual(params.length, 68);
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

test("gen~ box embeds the engine code with matching inlet/outlet counts; device is an audio effect strip 900×169", () => {
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
  assert.strictEqual(patch.devicewidth, 900);
  const ui = boxes.find((b) => b.maxclass === "jsui");
  assert.deepStrictEqual(ui.presentation_rect, [0, 0, 900, 169]);
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
  const mg = makeShim(900, 169), out = [];
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
    assert.ok(x >= 0 && y <= 169 && y - f >= 0 && x + s.length * f * 0.58 <= 901, `"${s}" at ${x},${y}`);
  }
  fs.mkdirSync(path.join(ROOT, "renders"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "renders", "panel.svg"), svg);
});

test("value texts follow the engine laws (grain rate, transposition, grain length)", () => {
  const b = boot();
  b.ctx.p("density", 0.2); assert.match(b.ctx.valueText("density"), /^\d+(\.\d)? \/s even$/);
  b.ctx.p("density", 0.5); assert.strictEqual(b.ctx.valueText("density"), "no grains");
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

test("SIZE ∞ marked: fully CW shows the delay mode as coming; TIME seconds follow the host sample rate", () => {
  const b = boot();
  b.ctx.p("size", 1); assert.match(b.ctx.valueText("size"), /inf: delay v0\.3/);
  b.ctx.p("time", 1); assert.strictEqual(b.ctx.valueText("time"), "-4 s");
  b.ctx.sr(44100); assert.strictEqual(b.ctx.valueText("time"), "-4.4 s");
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
  assert.strictEqual(b.out.filter((m) => /^dst_/.test(m[1]) && m[2] === 0).length, 10);
  b.ctx.p("dst_seed", 5); b.ctx.p("dst_time", 6); b.ctx.p("dst_reverb", 1); b.ctx.seq(3, 1); b.draw();
  const svg = b.mg.svg();
  for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" [^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)) {
    const [x, y, f, t] = [+m[1], +m[2], +m[3], m[4]];
    assert.ok(x >= 0 && y <= 169 && y - f >= 0 && x + t.length * f * 0.58 <= 901, `"${t}" at ${x},${y}`);
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

// ---------- the NATIVE device (Live's own controls on the SOUND page) ----------
test("native device: Live's own live.dial / live.text / live.tab on the SOUND page, panel hides them on MOD", () => {
  const { execFileSync } = require("child_process");
  const file = path.join(ROOT, "dist", "FLOCK", fs.readdirSync(path.join(ROOT, "dist", "FLOCK")).find((f) => f.endsWith("_native.amxd")));
  const buf = fs.readFileSync(file), i = buf.indexOf("ptch"), n = buf.readUInt32LE(i + 4);
  const pj = JSON.parse(buf.slice(i + 8, i + 8 + n).toString("utf8").replace(/\n\0$/, "")).patcher;
  const bx = pj.boxes.map((b) => b.box);
  const shown = bx.filter((b) => b.presentation && b.parameter_enable);
  const names = shown.map((b) => b.varname).sort();
  const expect = ["agc", "density", "drywet", "feedback", "freeze", "input", "output", "pitch", "pitch_amt", "quality", "reverb", "seedlatch", "shape", "shape_amt", "size", "size_amt", "time", "time_amt"];
  assert.deepStrictEqual(names, expect);
  for (const b of shown) {
    const [x, y, w, h] = b.presentation_rect;
    assert.ok(x >= 0 && y >= 0 && x + w <= 900 && y + h <= 169, b.varname + " inside the device");
  }
  assert.strictEqual(bx.find((b) => b.varname === "quality").maxclass, "live.tab");
  for (const v of ["freeze", "seedlatch", "agc"]) assert.strictEqual(bx.find((b) => b.varname === v).maxclass, "live.text");
  // native objects are drawn over the panel: they come after the jsui in the box list
  const ui = bx.findIndex((b) => b.maxclass === "jsui");
  for (const b of shown) assert.ok(bx.indexOf(b) > ui, b.varname + " above the panel");
  assert.ok(bx.some((b) => b.maxclass === "message" && b.text === "native 1") && bx.some((b) => b.text === "thispatcher"));
  // the tape: Max's waveform~ of a buffer~ that poke~ fills from gen~ out12 / out13
  const wf = bx.find((b) => b.maxclass === "waveform~");
  assert.ok(wf && wf.presentation && wf.buffername === "---flock_tape");
  const pk = bx.find((b) => b.text === "poke~ ---flock_tape"), gen = bx.find((b) => b.text === "gen~");
  const into = (dst, inlet) => pj.lines.map((l) => l.patchline).filter((l) => l.destination[0] === dst.id && l.destination[1] === inlet).map((l) => [l.source[0], l.source[1]]);
  assert.deepStrictEqual(into(pk, 0), [[gen.id, 11]]); assert.deepStrictEqual(into(pk, 1), [[gen.id, 12]]);
  // the panel in native mode: no own control where Live's objects sit; tab switch hides / shows them
  const b2 = boot();
  b2.ctx.native(1);
  const msgs = () => b2.out.filter((m) => m[1] === "script").map((m) => m[3] + "=" + m[5]);
  b2.out.length = 0; b2.draw();
  for (const h of b2.ctx.hits) assert.ok(!expect.includes(h.name), "panel hit under a native object: " + h.name);
  const tabHit = (t) => b2.ctx.hits.find((h) => h.name === "tab_" + t);
  b2.out.length = 0; b2.ctx.onclick(tabHit("MOD").x + 2, tabHit("MOD").y + 2, 0, 0, 0);
  const pageOnly = expect.filter((v) => v !== "freeze" && v !== "seedlatch");   // the left column stays
  assert.deepStrictEqual(msgs().map((m) => m.split("=")[0]).sort(), pageOnly);
  assert.ok(msgs().every((m) => m.endsWith("=1")), "hidden on MOD");
  b2.draw();
  b2.out.length = 0; b2.ctx.onclick(tabHit("SOUND").x + 2, tabHit("SOUND").y + 2, 0, 0, 0);
  assert.ok(msgs().every((m) => m.endsWith("=0")), "shown on SOUND");
});
