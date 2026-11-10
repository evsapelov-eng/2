// Runs the real jsui script (max/noiz_ui.js) against an mgraphics→SVG shim wired to
// the real engine (max/noiz_engine.js). Catches JS errors, checks click → command
// routing, and writes renders/ui_preview_*.svg. NOT a Max screenshot (UI VALID = NOT TESTED).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const MAXDIR = path.join(__dirname, "..", "max");
const OUT = path.join(__dirname, "..", "renders");

function makeShim(w, h) {
  const els = [];
  let rgba = [1, 1, 1, 1], lw = 1, font = 10, bold = 0, pathD = "", cur = [0, 0], tx = [0, 0], sc = 1;
  const color = () => `rgba(${Math.round(rgba[0] * 255)},${Math.round(rgba[1] * 255)},${Math.round(rgba[2] * 255)},${rgba[3]})`;
  const g = {
    size: [w, h],
    relative_coords: 0, autofill: 0,
    init() {}, redraw() { g.__redraws = (g.__redraws || 0) + 1; },
    scale(a) { sc = a; },
    set_source_rgba(r, gg, b, a) { rgba = [r, gg, b, a]; },
    set_line_width(v) { lw = v; },
    rectangle(x, y, ww, hh) { pathD += `M${x},${y}h${ww}v${hh}h${-ww}Z`; },
    ellipse(x, y, ww, hh) { const rx = ww / 2, ry = hh / 2; pathD += `M${x},${y + ry}a${rx},${ry} 0 1,0 ${ww},0a${rx},${ry} 0 1,0 ${-ww},0`; },
    move_to(x, y) { pathD += `M${x},${y}`; cur = [x, y]; tx = [x, y]; },
    line_to(x, y) { pathD += `L${x},${y}`; cur = [x, y]; },
    fill() { els.push(`<path d="${pathD}" fill="${color()}"/>`); pathD = ""; },
    stroke() { els.push(`<path d="${pathD}" fill="none" stroke="${color()}" stroke-width="${lw}"/>`); pathD = ""; },
    select_font_face(n) { bold = /Bold/.test(n || ""); }, set_font_size(s) { font = s; },
    text_measure(s) { return [s.length * font * 0.62, font]; },
    show_text(s) {
      els.push(`<text x="${tx[0]}" y="${tx[1]}" font-family="Arial, Helvetica, sans-serif" font-size="${font}" font-weight="${bold ? 700 : 400}" fill="${color()}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`);
      pathD = "";
    },
  };
  g.svg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">${els.join("")}</svg>`;
  g.reset = () => { els.length = 0; };
  return g;
}

function boot() {
  const globals = {};
  const tasks = [];
  const engineOut = [];
  const uiOut = [];
  const common = {
    post() {}, notifyclients() {},
    arrayfromargs: (a) => Array.prototype.slice.call(a),
    Global: function (n) { return (globals[n] = globals[n] || {}); },
    Task: function (fn) { this.fn = fn; this.repeat = () => tasks.push(this); this.cancel = () => {}; },
  };
  const eng = vm.createContext(Object.assign({}, common, { outlet: (...a) => engineOut.push(a) }));
  vm.runInContext(fs.readFileSync(path.join(MAXDIR, "noiz_engine.js"), "utf8"), eng);
  const mg = makeShim(760, 169);
  const ui = vm.createContext(Object.assign({}, common, { mgraphics: mg, outlet: (...a) => uiOut.push(a) }));
  vm.runInContext(fs.readFileSync(path.join(MAXDIR, "noiz_ui.js"), "utf8"), ui);
  eng.loadbang();
  const bind = engineOut.find((m) => m[1] === "bind");
  ui.bind(bind[2]);
  // route UI commands into the engine like the patch does (outlet → js inlet)
  const send = () => {
    while (uiOut.length) {
      const [, sel, ...args] = uiOut.shift();
      if (typeof eng[sel] !== "function") throw new Error("engine has no handler for UI message " + sel);
      eng[sel](...args);
    }
  };
  const draw = () => { mg.reset(); ui.paint(); };
  return { eng, ui, mg, uiOut, send, draw, tasks };
}

test("jsui script paints without errors and every UI message has an engine handler", () => {
  const b = boot();
  b.draw();
  // click a step cell: HISS step 2 (index 1) → toggle
  const stepX = 186 + 1 * 18 + 5, stepY = 26 + 5;
  b.ui.onclick(stepX, stepY, 1, 0, 0, 0, 0, 0);
  assert.deepStrictEqual(b.uiOut[0].slice(1), ["toggle", 0, 1]);
  b.send();
  b.draw();
  // generate, mutate, keep, undo buttons
  for (const [x, y, sel] of [[540, 18, "generate"], [660, 18, "mutate"], [660, 43, "keep"], [720, 43, "undo"]]) {
    b.ui.onclick(x, y, 1, 0, 0, 0, 0, 0);
    assert.strictEqual(b.uiOut[b.uiOut.length - 1][1], sel, sel);
    b.send(); b.draw();
  }
});

test("node drag = one gesture: macro values while dragging, gesture 0 on mouse up", () => {
  const b = boot();
  b.draw();
  const nodeX = 528 + 0 * 58 + 28, nodeY = 98 + 24; // TONE node
  b.ui.onclick(nodeX, nodeY, 1, 0, 0, 0, 0, 0);
  for (let i = 1; i <= 20; i++) b.ui.ondrag(nodeX, nodeY - i * 2, 1, 0, 0, 0, 0, 0);
  b.ui.ondrag(nodeX, nodeY - 40, 0, 0, 0, 0, 0, 0); // release
  const sels = b.uiOut.map((m) => m[1]);
  assert.strictEqual(sels[0], "gesture");
  assert.strictEqual(b.uiOut[0][2], 1);
  assert.strictEqual(sels.filter((s) => s === "macro").length, 21);
  assert.deepStrictEqual(b.uiOut[b.uiOut.length - 1].slice(1), ["gesture", 0]);
  const last = b.uiOut.filter((m) => m[1] === "macro").pop();
  assert.ok(Math.abs(last[3] - (0.68 + 40 * 0.007)) < 1e-3, "tone after +40px drag: " + last[3]);
  b.send();
  const st = JSON.parse(b.eng.getvalueof());
  assert.ok(st.tracks[0].sound.tone > 0.9);
});

test("option-click on a step enters STEP mode; macro drag writes a P-Lock, not the base sound", () => {
  const b = boot();
  b.draw();
  b.ui.onclick(186 + 6 * 18 + 5, 26 + 5, 1, 0, 0, 0, 1, 0); // option-click HISS step 7
  b.send(); b.draw();
  const nodeX = 528 + 1 * 58 + 28, nodeY = 98 + 24; // DECAY
  b.ui.onclick(nodeX, nodeY, 1, 0, 0, 0, 0, 0);
  b.ui.ondrag(nodeX, nodeY + 200, 0, 0, 0, 0, 0, 0);
  b.send(); b.draw();
  const st = JSON.parse(b.eng.getvalueof());
  assert.strictEqual(st.tracks[0].steps[6].pLocks.decay, 0);
  assert.strictEqual(st.tracks[0].sound.decay, 0.2);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ui_preview_step_mode.svg"), b.mg.svg());
});

test("preview render of the default device (for review only)", () => {
  const b = boot();
  b.eng.tick(1, 1, 0, 480, 124);
  for (let i = 1; i < 40; i++) b.eng.tick(1, 1 + Math.floor(i * 0.02), ((i * 0.02) % 1) * 480, 480, 124);
  b.send(); b.draw();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ui_preview_base.svg"), b.mg.svg());
  assert.ok(b.mg.svg().includes("GENERATE"));
});

test("STEP mode left panel edits velocity / probability / ratchet of the selected step", () => {
  const b = boot();
  b.draw();
  b.ui.onclick(186 + 0 * 18 + 5, 26 + 5, 1, 0, 0, 0, 1, 0); // option-click HISS step 1
  b.send(); b.draw();
  b.ui.onclick(30, 116, 1, 0, 0, 0, 0, 0);                   // PROB row
  b.ui.ondrag(30, 116 + 200, 0, 0, 0, 0, 0, 0);               // drag down → 0%
  b.ui.onclick(30, 132, 1, 0, 0, 0, 0, 0);                   // RAT row
  b.ui.ondrag(30, 132 - 36, 0, 0, 0, 0, 0, 0);                // drag up → ratchet 4
  b.send(); b.draw();
  const st = JSON.parse(b.eng.getvalueof());
  assert.strictEqual(st.tracks[0].steps[0].probability, 0);
  assert.strictEqual(st.tracks[0].steps[0].ratchet, 4);
});
