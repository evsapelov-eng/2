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
  assert.strictEqual(params.length, 17);
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
  }
  const route = boxes.find((b) => (b.text || "").startsWith("route "));
  assert.deepStrictEqual(route.text.split(" ").slice(1).sort(), params.map((p) => p.varname).sort());
});

test("gen~ box embeds the engine code with matching inlet/outlet counts; device is an audio effect strip 900×169", () => {
  const g = boxes.find((b) => b.text === "gen~");
  const cb = g.patcher.boxes.map((b) => b.box).find((b) => b.maxclass === "codebox");
  assert.ok(cb.code.includes("Param time(") && g.patcher.classnamespace === "dsp.gen");
  assert.strictEqual(g.numinlets, 6); assert.strictEqual(g.numoutlets, 7);
  assert.strictEqual(patch.devicewidth, 900);
  const ui = boxes.find((b) => b.maxclass === "jsui");
  assert.deepStrictEqual(ui.presentation_rect, [0, 0, 900, 169]);
});

// ---------- panel in an SVG shim ----------
function makeShim(w, h) {
  const els = [];
  let rgba = [1, 1, 1, 1], lw = 1, font = 10, bold = false, d = "", tx = [0, 0];
  const color = () => `rgba(${Math.round(rgba[0] * 255)},${Math.round(rgba[1] * 255)},${Math.round(rgba[2] * 255)},${rgba[3]})`;
  const g = {
    size: [w, h], init() {}, redraw() {}, scale() {},
    set_source_rgba(r, gg, b, a) { rgba = [r, gg, b, a]; }, set_line_width(v) { lw = v; },
    rectangle(x, y, ww, hh) { d += `M${x},${y}h${ww}v${hh}h${-ww}Z`; },
    ellipse(x, y, ww, hh) { const rx = ww / 2, ry = hh / 2; d += `M${x},${y + ry}a${rx},${ry} 0 1,0 ${ww},0a${rx},${ry} 0 1,0 ${-ww},0`; },
    move_to(x, y) { d += `M${x},${y}`; tx = [x, y]; }, line_to(x, y) { d += `L${x},${y}`; },
    fill() { els.push(`<path d="${d}" fill="${color()}"/>`); d = ""; },
    stroke() { els.push(`<path d="${d}" fill="none" stroke="${color()}" stroke-width="${lw}" stroke-linecap="round"/>`); d = ""; },
    select_font_face(n) { bold = /Bold/.test(n || ""); }, set_font_size(s) { font = s; },
    text_measure(s) { return [s.length * font * 0.58, font]; },
    show_text(s) { els.push(`<text x="${tx[0]}" y="${tx[1]}" font-family="Arial,Helvetica,sans-serif" font-size="${font}" font-weight="${bold ? 700 : 400}" fill="${color()}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`); d = ""; },
  };
  g.svg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${els.join("")}</svg>`;
  g.reset = () => { els.length = 0; };
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
  const t = hitFor("time"); b.out.length = 0; b.ctx.ondblclick(t.x + 10, t.y + 10); assert.deepStrictEqual(b.out.pop().slice(1), ["time", 0.5]);
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
