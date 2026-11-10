// Runs the real jsui script (max/kore_ui.js) — one panel in the device strip — against an mgraphics→SVG shim
// wired to the real engine (max/kore_engine.js). NOT a Max screenshot (UI VALID = NOT TESTED).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const MAXDIR = path.join(__dirname, "..", "max");
const OUT = path.join(__dirname, "..", "renders");
const J = (o) => JSON.stringify(o);
const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(J(a)), JSON.parse(J(b)), m);

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
    stroke() { els.push(`<path d="${d}" fill="none" stroke="${color()}" stroke-width="${lw}"/>`); d = ""; },
    select_font_face(n) { bold = /Bold/.test(n || ""); }, set_font_size(s) { font = s; },
    text_measure(s) { return [s.length * font * 0.6, font]; },
    show_text(s) { els.push(`<text x="${tx[0]}" y="${tx[1]}" font-family="Arial,Helvetica,sans-serif" font-size="${font}" font-weight="${bold ? 700 : 400}" fill="${color()}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`); d = ""; },
  };
  g.svg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#090a0a"/>${els.join("")}</svg>`;
  g.reset = () => { els.length = 0; };
  return g;
}

function boot() {
  const globals = {}, engOut = [], uiOut = [];
  const common = { post() {}, notifyclients() {}, arrayfromargs: (a) => Array.prototype.slice.call(a),
    Global: function (n) { return (globals[n] = globals[n] || {}); }, Task: function (fn) { this.fn = fn; this.repeat = () => {}; this.cancel = () => {}; this.schedule = () => {}; },
    Buffer: function () { this.send = () => {}; this.poke = () => {}; } };
  const eng = vm.createContext(Object.assign({}, common, { outlet: (...a) => engOut.push(a) }));
  vm.runInContext(fs.readFileSync(path.join(MAXDIR, "kore_engine.js"), "utf8"), eng);
  const mg = makeShim(1240, 169);
  const ui = vm.createContext(Object.assign({}, common, { mgraphics: mg, jsarguments: ["kore_ui.js"], outlet: (...a) => uiOut.push(a) }));
  vm.runInContext(fs.readFileSync(path.join(MAXDIR, "kore_ui.js"), "utf8"), ui);
  eng.loadbang();
  ui.bind(engOut.find((m) => m[1] === "bind")[2]);
  const send = () => {
    while (uiOut.length) {
      const [, sel, ...args] = uiOut.shift();
      if (typeof eng[sel] !== "function") throw new Error("engine has no handler for UI message " + sel);
      eng[sel](...args);
    }
  };
  const draw = () => { mg.reset(); ui.PREVIEW_MIN_MS = 0; ui.paint(); };
  const click = (x, y, opt = 0) => { ui.onclick(x, y, 1, 0, 0, 0, opt, 0); };
  const dragTo = (x, y, up = true) => ui.ondrag(x, y, up ? 0 : 1, 0, 0, 0, 0, 0);
  const state = () => JSON.parse(eng.getvalueof());
  const tab = (name) => { click(70, { SEQUENCE: 67, SOUND: 88, LANES: 109 }[name]); send(); draw(); };
  const voice = (v) => { click(158 + v * 54 + 25, 14); send(); draw(); };
  const save = (name) => { fs.mkdirSync(OUT, { recursive: true }); draw(); fs.writeFileSync(path.join(OUT, name), mg.svg()); };
  return { eng, ui, mg, uiOut, send, draw, click, dragTo, state, tab, voice, save };
}
const cell = (t, s) => [256 + s * 25 + 10, 10 + t * 25 + 10];
const svgText = (svg) => (svg.match(/>([^<]*)<\/text>/g) || []).join(" ");

test("one strip (1240×169): everything fits — no editor window, nothing drawn outside", () => {
  const b = boot();
  for (const view of ["SEQUENCE", "SOUND", "LANES"]) {
    b.draw(); b.tab(view);
    for (let v = 0; v < 6; v++) {
      if (view !== "SEQUENCE") b.voice(v);
      const svg = b.mg.svg();
      assert.ok(!svg.includes("UI error"), view + " voice " + v);
      for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" [^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)) {
        const [x, y, fsz, s] = [+m[1], +m[2], +m[3], m[4]];
        assert.ok(x >= 0 && y <= 169 && y - fsz >= 0 && x + s.length * fsz * 0.6 <= 1240 + 1, `${view}/${v}: "${s}" at ${x},${y}`);
      }
      for (const n of ["GENERATE", "MUTATE PERC", "AMOUNT", "HUM", "KICK", "OUT"]) assert.ok(svg.includes(n), view + " " + n);
    }
  }
  const patch = JSON.parse(fs.readFileSync(path.join(MAXDIR, "kore_main.maxpat"), "utf8")).patcher;
  const txt = J(patch);
  assert.ok(!txt.includes("pcontrol") && !txt.includes("KORE_EDITOR") && !txt.includes("openeditor"));
  const js = patch.boxes.map((x) => x.box).filter((x) => x.maxclass === "jsui");
  assert.strictEqual(js.length, 1);
  deq(js[0].presentation_rect, [0, 0, 1240, 169]);
  assert.strictEqual(patch.devicewidth, 1240);
});

test("strip: GENERATE / MUTATE / KEEP / UNDO / style / KICK-SUB route correctly", () => {
  const b = boot();
  b.draw();
  b.click(1120, 20); assert.strictEqual(b.uiOut.pop()[1], "generate"); b.eng.generate(); b.draw();
  b.click(1120, 52); assert.strictEqual(b.uiOut.pop()[1], "mutate");
  b.click(1090, 98); assert.strictEqual(b.uiOut.pop()[1], "keep");
  b.click(1150, 98); assert.strictEqual(b.uiOut.pop()[1], "undo");
  b.uiOut.length = 0;
  b.click(60, 133); b.send(); assert.strictEqual(b.state().global.style, "DRIVING");
  b.click(1068 + 2 * 41 + 19, 134); b.send(); assert.strictEqual(b.state().global.kickInteraction, "LAYER");
  b.click(1140, 78); b.send(); assert.ok(Math.abs(b.state().global.mutationAmount - (1140 - 1068 - 38) / 58) < 0.02);
  b.save("ui_strip_sequence.svg");
});

test("HUM knob: drag sets PUNCH hum whatever voice is selected; double-click resets; dB readout", () => {
  const b = boot();
  b.draw(); b.click(...cell(5, 0).map((v, i) => (i ? v : 170))); b.send(); b.draw(); // select HAT
  assert.strictEqual(b.state().global.selectedTrack, 5);
  b.click(1020, 60); for (let i = 1; i <= 10; i++) b.dragTo(1020, 60 - i * 5, false); b.dragTo(1020, 0);
  const sel = b.uiOut.map((m) => m[1]);
  assert.strictEqual(sel[0], "gesture"); assert.strictEqual(sel[sel.length - 1], "gesture"); assert.ok(sel.includes("humlevel"));
  b.send(); b.draw();
  assert.ok(b.state().tracks[0].params.hum > 0.7);
  assert.strictEqual(b.state().tracks[5].params.hum, undefined);
  assert.ok(svgText(b.mg.svg()).includes("-1dB") || svgText(b.mg.svg()).includes("-2dB") || /-\d+dB/.test(svgText(b.mg.svg())));
  b.click(1020, 60); b.dragTo(1020, 400); b.send(); b.draw();
  assert.strictEqual(b.state().tracks[0].params.hum, 0); assert.ok(svgText(b.mg.svg()).includes("OFF"));
  b.ui.ondblclick(1020, 60); b.send();
  assert.strictEqual(b.state().tracks[0].params.hum, 0.4);
  b.save("ui_strip_hum.svg");
});

test("SEQUENCE: six rows, step toggle, option-click → step strip, open-hat toggle, step P-Lock from SOUND", () => {
  const b = boot();
  b.draw();
  const svg = b.mg.svg();
  for (const n of ["PUNCH", "SUB", "RUMBLE", "TOM L", "TOM H", "HAT"]) assert.ok(svg.includes(n), n);
  b.click(...cell(3, 5)); deq(b.uiOut.pop().slice(1), ["toggle", 3, 5]); b.send(); b.draw();
  b.click(...cell(5, 10), 1); b.send(); b.draw();          // option-click HAT step 11
  assert.ok(b.mg.svg().includes("HAT / STEP 11"));
  b.click(678 + 55, 118); b.send(); b.draw();              // OPEN/CLOSED toggle
  assert.strictEqual(b.state().tracks[5].steps[10].open, false); // starter had it open → now closed
  b.tab("SOUND");
  assert.ok(b.mg.svg().includes("HAT / STEP 11"));
  b.click(676 + 33, 26 + 30); b.dragTo(676 + 33, -200); b.send();  // TONE node → step lock
  const st = b.state().tracks[5];
  assert.strictEqual(st.steps[10].pLocks.tone, 1);
  assert.notStrictEqual(st.params.tone, 1);
});

test("SOUND: every PUNCH node changes the waveform/pitch picture (model-driven)", () => {
  const b = boot();
  b.draw(); b.tab("SOUND");
  assert.ok(b.mg.svg().includes("PITCH vs TIME"));
  const sig = () => { const pv = b.ui.previewFor(b.state().global, true); return J([pv.data.L.length, pv.data.L.slice(0, 4000).map((x) => +x.toFixed(4)), (pv.data.pitch || []).slice(0, 2000).map((x) => +x.toFixed(2))]); };
  const ref = sig();
  const nodes = b.ui.hits.filter((h) => h.kind === "param");
  assert.strictEqual(nodes.length, 8);
  for (const n of nodes) {
    const x = n.x + n.w / 2, y = n.y + 25;
    b.click(x, y); b.dragTo(x, y - 150); b.send(); b.draw();
    assert.notStrictEqual(sig(), ref, "node " + n.key + " did not change the picture");
    b.ui.ondblclick(x, y); b.send(); b.draw();
  }
  b.save("ui_strip_sound.svg");
});

test("LANES: draw a parameter across steps in one gesture; option-click clears one", () => {
  const b = boot();
  b.draw(); b.tab("LANES"); b.voice(3);                    // TOM L
  b.click(158 + 330 + 1 * 62 + 29, 14); b.draw();          // DECAY lane
  const colX = (s) => 160 + s * 50 + 20;
  b.click(colX(0), 40);
  for (let s = 1; s < 16; s++) b.dragTo(colX(s), 40 + s * 6, false);
  b.dragTo(colX(15), 138);
  deq(b.uiOut.filter((m) => m[1] === "gesture").map((m) => m[2]), [1, 0]);
  b.send(); b.draw();
  const lane = b.state().tracks[3].steps.slice(0, 16).map((s) => s.pLocks.decay);
  assert.ok(lane.every((v) => typeof v === "number") && lane[0] > lane[12]);
  b.click(colX(4), 80, 1); b.send();
  assert.strictEqual(b.state().tracks[3].steps[4].pLocks.decay, undefined);
  b.save("ui_strip_lanes.svg");
});

test("SOUND graph handles: dragging the PITCH and WAVE handles changes the right kick params", () => {
  const b = boot();
  b.draw(); b.tab("SOUND");
  const byKey = (k) => b.ui.hits.filter((h) => h.kind === "handle").find((h) => h.key === k);
  for (const k of ["tune", "punch", "time", "body", "decay"]) assert.ok(byKey(k), "handle " + k);
  const before = b.state().tracks[0].params;
  const h = byKey("tune");
  b.click(h.x + 9, h.y + 9); b.dragTo(h.x + 9, h.y - 30); b.send(); b.draw();
  assert.ok(b.state().tracks[0].params.tune > before.tune, "TUNE up");
  const d = byKey("decay");
  b.click(d.x + 9, d.y + 9); b.dragTo(d.x + 60, d.y + 9); b.send(); b.draw();
  assert.ok(b.state().tracks[0].params.decay > before.decay, "DECAY longer");
  const pu = byKey("punch");
  b.click(pu.x + 9, pu.y + 9); b.dragTo(pu.x + 9, pu.y + 40); b.send(); b.draw();
  assert.ok(b.state().tracks[0].params.punch < before.punch, "PUNCH lower");
  b.voice(5);                                              // HAT: one handle sets TONE (x) and RESO (y)
  const ht = byKey("tone"), h0 = b.state().tracks[5].params;
  b.click(ht.x + 9, ht.y + 9); b.dragTo(ht.x + 40, ht.y - 40); b.send();
  const h1 = b.state().tracks[5].params;
  assert.ok(h1.tone > h0.tone && h1.reso > h0.reso, "HAT tone+reso");
  b.save("ui_strip_sound_hat.svg");
});
