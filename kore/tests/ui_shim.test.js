// Runs the real jsui script (max/kore_ui.js) in both modes against an mgraphics→SVG shim
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

function boot(mode) {
  const globals = {}, engOut = [], uiOut = [];
  const common = { post() {}, notifyclients() {}, arrayfromargs: (a) => Array.prototype.slice.call(a),
    Global: function (n) { return (globals[n] = globals[n] || {}); }, Task: function (fn) { this.fn = fn; this.repeat = () => {}; this.cancel = () => {}; this.schedule = () => {}; },
    Buffer: function () { this.send = () => {}; this.poke = () => {}; } };
  const eng = vm.createContext(Object.assign({}, common, { outlet: (...a) => engOut.push(a) }));
  vm.runInContext(fs.readFileSync(path.join(MAXDIR, "kore_engine.js"), "utf8"), eng);
  const [w, h] = mode === "editor" ? [1200, 760] : [760, 169];
  const mg = makeShim(w, h);
  const ui = vm.createContext(Object.assign({}, common, { mgraphics: mg, jsarguments: ["kore_ui.js", mode], outlet: (...a) => uiOut.push(a) }));
  vm.runInContext(fs.readFileSync(path.join(MAXDIR, "kore_ui.js"), "utf8"), ui);
  eng.loadbang();
  ui.bind(engOut.find((m) => m[1] === "bind")[2]);
  const send = () => {
    while (uiOut.length) {
      const [, sel, ...args] = uiOut.shift();
      if (sel === "openeditor" || sel === "closeeditor") continue; // handled by the patch (pcontrol)
      if (typeof eng[sel] !== "function") throw new Error("engine has no handler for UI message " + sel);
      eng[sel](...args);
    }
  };
  const draw = () => { mg.reset(); ui.PREVIEW_MIN_MS = 0; ui.paint(); };
  const click = (x, y, opt = 0) => { ui.onclick(x, y, 1, 0, 0, 0, opt, 0); };
  const dragTo = (x, y, up = true) => ui.ondrag(x, y, up ? 0 : 1, 0, 0, 0, 0, 0);
  const state = () => JSON.parse(eng.getvalueof());
  return { eng, ui, mg, uiOut, send, draw, click, dragTo, state };
}

test("compact strip: paints, GENERATE / MUTATE / KEEP / UNDO / OPEN EDITOR route correctly", () => {
  const b = boot("compact");
  b.draw();
  assert.ok(b.mg.svg().includes("GENERATE") && b.mg.svg().includes("OPEN"));
  b.click(440, 30); assert.strictEqual(b.uiOut.pop()[1], "generate"); b.eng.generate(); b.draw();
  b.click(440, 66); assert.strictEqual(b.uiOut.pop()[1], "mutate");
  b.click(410, 124); assert.strictEqual(b.uiOut.pop()[1], "keep");
  b.click(710, 66); assert.strictEqual(b.uiOut.pop()[1], "openeditor");
  // mini pattern: toggle PUNCH step 2, select HAT
  b.click(202 + 1 * 10 + 4, 20 + 4); deq(b.uiOut.pop().slice(1), ["toggle", 0, 1]);
  b.click(170, 20 + 5 * 14 + 4); deq(b.uiOut.pop().slice(1), ["select", 5]);
  b.send(); b.draw();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ui_compact.svg"), b.mg.svg());
});

test("compact: TUNE node drag on PUNCH changes the voice tune with one gesture", () => {
  const b = boot("compact");
  b.draw();
  b.click(553, 60); for (let i = 1; i <= 10; i++) b.dragTo(553, 60 - i * 3, false); b.dragTo(553, 30);
  const sel = b.uiOut.map((m) => m[1]);
  assert.strictEqual(sel[0], "gesture"); assert.strictEqual(sel[sel.length - 1], "gesture");
  b.send();
  assert.ok(b.state().tracks[0].params.tune > 0.5);
});

test("editor SEQUENCE: six rows, step toggle, option-click → step strip, open-hat toggle, voice nodes", () => {
  const b = boot("editor");
  b.draw();
  const svg = b.mg.svg();
  for (const n of ["PUNCH", "SUB", "RUMBLE", "TOM L", "TOM H", "HAT", "LOW END", "AMOUNT"]) assert.ok(svg.includes(n), n);
  const cell = (t, s) => [190 + s * 40 + 10, 104 + t * 64 + 10];
  b.click(...cell(3, 5)); deq(b.uiOut.pop().slice(1), ["toggle", 3, 5]); b.send(); b.draw();
  b.click(...cell(5, 10), 1); b.send(); b.draw();          // option-click HAT step 11
  assert.ok(b.mg.svg().includes("HAT / STEP 11"));
  b.click(900, 262); b.send(); b.draw();                   // OPEN/CLOSED toggle
  assert.strictEqual(b.state().tracks[5].steps[10].open, false); // starter had it open → now closed
  // voice node in the bottom panel writes the step value
  b.click(36 + 0 * 112 + 50, 590); b.dragTo(86, 400); b.send();
  const st = b.state().tracks[5];
  assert.strictEqual(st.steps[10].pLocks.tone, 1);
  assert.notStrictEqual(st.params.tone, 1);
});

test("editor SOUND: every PUNCH node changes the waveform/pitch picture (model-driven)", () => {
  const b = boot("editor");
  b.draw();
  b.click(496, 30); b.send(); b.draw();                    // SOUND tab
  assert.ok(b.mg.svg().includes("PITCH vs TIME"));
  const sig = () => { const pv = b.ui.previewFor(b.state().global, true); return J([pv.data.L.length, pv.data.L.slice(0, 4000).map((x) => +x.toFixed(4)), (pv.data.pitch || []).slice(0, 2000).map((x) => +x.toFixed(2))]); };
  const ref = sig();
  const nKeys = 8, nw = Math.min(134, 790 / (nKeys + 1));
  for (let n = 0; n < nKeys; n++) {
    const x = 24 + n * nw + nw / 2, y = 450;
    b.click(x, y); b.dragTo(x, 100); b.send(); b.draw();
    assert.notStrictEqual(sig(), ref, "node " + n + " did not change the picture");
    b.ui.ondblclick(x, y); b.send(); b.draw();
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ui_editor_sound.svg"), b.mg.svg());
});

test("editor SOUND works for every voice (incl. RUMBLE tail and HAT spectrum)", () => {
  const b = boot("editor");
  b.draw(); b.click(496, 30); b.send(); b.draw();
  for (let v = 0; v < 6; v++) {
    b.click(24 + v * 118 + 50, 86); b.send(); b.draw();
    const svg = b.mg.svg();
    assert.ok(!svg.includes("UI error"), "voice " + v);
  }
});

test("editor LANES: draw a parameter across steps in one gesture; option-click clears one", () => {
  const b = boot("editor");
  b.draw(); b.click(608, 30); b.send(); b.draw();          // LANES
  b.click(24 + 3 * 118 + 50, 86); b.send(); b.draw();      // TOM L
  b.click(24 + 1 * 118 + 50, 122); b.draw();               // DECAY lane
  const colX = (s) => 60 + s * 66 + 20;
  b.click(colX(0), 220);
  for (let s = 1; s < 16; s++) b.dragTo(colX(s), 220 + s * 15, false);
  b.dragTo(colX(15), 480);
  deq(b.uiOut.filter((m) => m[1] === "gesture").map((m) => m[2]), [1, 0]);
  b.send(); b.draw();
  let t = b.state().tracks[3];
  const lane = t.steps.slice(0, 16).map((s) => s.pLocks.decay);
  assert.ok(lane.every((v) => typeof v === "number") && lane[0] > lane[12]);
  b.click(colX(4), 300, 1); b.send();
  assert.strictEqual(b.state().tracks[3].steps[4].pLocks.decay, undefined);
  fs.mkdirSync(OUT, { recursive: true });
  b.draw(); fs.writeFileSync(path.join(OUT, "ui_editor_lanes.svg"), b.mg.svg());
});

test("editor bottom bar: style and kick/sub interaction route to the engine", () => {
  const b = boot("editor");
  b.draw();
  b.click(300 + 2 * 96 + 40, 730); b.send(); assert.strictEqual(b.state().global.style, "HYPNOTIC");
  b.click(746 + 2 * 74 + 30, 730); b.send(); assert.strictEqual(b.state().global.kickInteraction, "LAYER");
  b.click(700, 30); b.send(); b.draw();                    // GENERATE
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ui_editor_sequence.svg"), b.mg.svg());
});

test("SOUND graph handles: dragging the PITCH and WAVE handles changes the right kick params", () => {
  const b = boot("editor");
  b.draw(); b.click(496, 30); b.send(); b.draw();
  const handles = () => b.ui.hits.filter((h) => h.kind === "handle");
  const byKey = (k) => handles().find((h) => h.key === k);
  for (const k of ["tune", "punch", "time", "body", "decay"]) assert.ok(byKey(k), "handle " + k);
  const before = b.state().tracks[0].params;
  const h = byKey("tune");
  b.click(h.x + 12, h.y + 12); b.dragTo(h.x + 12, h.y - 40); b.send(); b.draw();
  assert.ok(b.state().tracks[0].params.tune > before.tune, "TUNE up");
  const d = byKey("decay");
  b.click(d.x + 12, d.y + 12); b.dragTo(d.x + 120, d.y + 12); b.send(); b.draw();
  assert.ok(b.state().tracks[0].params.decay > before.decay, "DECAY longer");
  const pu = byKey("punch");
  b.click(pu.x + 12, pu.y + 12); b.dragTo(pu.x + 12, pu.y + 60); b.send(); b.draw();
  assert.ok(b.state().tracks[0].params.punch < before.punch, "PUNCH lower");
  // HAT: one handle sets TONE (x) and RESO (y)
  b.click(24 + 5 * 118 + 50, 86); b.send(); b.draw();
  const ht = byKey("tone");
  const h0 = b.state().tracks[5].params;
  b.click(ht.x + 12, ht.y + 12); b.dragTo(ht.x + 80, ht.y - 60); b.send();
  const h1 = b.state().tracks[5].params;
  assert.ok(h1.tone > h0.tone && h1.reso > h0.reso, "HAT tone+reso");
  fs.mkdirSync(OUT, { recursive: true }); b.draw();
  fs.writeFileSync(path.join(OUT, "ui_editor_sound_hat.svg"), b.mg.svg());
});
