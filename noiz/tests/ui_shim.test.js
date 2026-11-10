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
const C_DEF_RESO_METAL = 0.45;
const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);

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

// layout constants mirrored from noiz_ui.js
const GRID_X = 172, GRID_Y = 22, CELL = 16, GAP = 3, ROW_H = 32;
const cell = (t, s) => [GRID_X + s * (CELL + GAP) + 5, GRID_Y + t * ROW_H + 5];
const seqNode = (m) => [528 + m * 45.6 + 22, 84 + 20];
const synthNode = (n) => [130 + n * 62.2 + 30, 66 + 20];
const click = (b, [x, y], opt = 0) => b.ui.onclick(x, y, 1, 0, 0, 0, opt, 0);
const last = (b) => b.uiOut[b.uiOut.length - 1].slice(1);

test("SEQ screen paints, step click toggles, main buttons route to engine handlers", () => {
  const b = boot();
  b.draw();
  click(b, cell(0, 1));
  deq(last(b), ["toggle", 0, 1]);
  b.send(); b.draw();
  for (const [xy, sel] of [[[540, 18], "generate"], [[660, 18], "mutate"], [[700, 54], "keep"], [[740, 54], "undo"]]) {
    click(b, xy);
    assert.strictEqual(last(b)[0], sel, sel);
    b.send(); b.draw();
  }
});

test("simplified UI: removed controls are gone, M and L per voice work", () => {
  const b = boot();
  b.draw();
  const svg = b.mg.svg();
  for (const gone of [">RHY<", ">SND<", ">PLK<", ">ALL<", "LK DENS", "LK AMT", ">DENS<", ">R<", ">S<", ">BASE<"]) {
    assert.ok(!svg.includes(gone), "should be removed: " + gone);
  }
  const fx = GRID_X + 16 * (CELL + GAP) + 3;
  click(b, [fx + 5, GRID_Y + 2 * ROW_H + 6]);      // M on METAL
  deq(last(b), ["mute", 2, 1]);
  click(b, [fx + 21, GRID_Y + 3 * ROW_H + 6]);     // L on ATMOS
  deq(last(b), ["hold", 3, 1]);
  b.send();
  const st = JSON.parse(b.eng.getvalueof());
  assert.ok(st.tracks[2].mute);
  assert.ok(st.tracks[3].locks.rhythm && st.tracks[3].locks.sound);
});

test("node drag = one gesture: macro values while dragging, gesture 0 on mouse up", () => {
  const b = boot();
  b.draw();
  const [nx, ny] = seqNode(0); // TONE
  b.ui.onclick(nx, ny, 1, 0, 0, 0, 0, 0);
  for (let i = 1; i <= 20; i++) b.ui.ondrag(nx, ny - i * 2, 1, 0, 0, 0, 0, 0);
  b.ui.ondrag(nx, ny - 40, 0, 0, 0, 0, 0, 0);
  const sels = b.uiOut.map((m) => m[1]);
  deq(b.uiOut[0].slice(1), ["gesture", 1]);
  assert.strictEqual(sels.filter((x) => x === "macro").length, 21);
  deq(last(b), ["gesture", 0]);
  b.send();
  assert.ok(JSON.parse(b.eng.getvalueof()).tracks[0].sound.tone > 0.9);
});

test("STEP mode: option-click selects a step; DECAY and PAN drags write P-Locks only", () => {
  const b = boot();
  b.draw();
  click(b, cell(0, 6), 1);
  b.send(); b.draw();
  for (const m of [1, 4]) { // DECAY down, PAN up
    const [nx, ny] = seqNode(m);
    b.ui.onclick(nx, ny, 1, 0, 0, 0, 0, 0);
    b.ui.ondrag(nx, m === 1 ? ny + 200 : ny - 200, 0, 0, 0, 0, 0, 0);
    b.send(); b.draw();
  }
  const st = JSON.parse(b.eng.getvalueof());
  assert.strictEqual(st.tracks[0].steps[6].pLocks.decay, 0);
  assert.strictEqual(st.tracks[0].steps[6].pLocks.pan, 1);
  assert.strictEqual(st.tracks[0].sound.decay, 0.2);
  assert.strictEqual(st.tracks[0].sound.pan, 0.56);
  assert.ok(b.mg.svg().includes("STEP 07"));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ui_preview_step_mode.svg"), b.mg.svg());
});

test("STEP mode left panel edits velocity / probability / ratchet", () => {
  const b = boot();
  b.draw();
  click(b, cell(0, 0), 1);
  b.send(); b.draw();
  b.ui.onclick(30, 128, 1, 0, 0, 0, 0, 0);  // PROB row
  b.ui.ondrag(30, 328, 0, 0, 0, 0, 0, 0);
  b.ui.onclick(30, 144, 1, 0, 0, 0, 0, 0);  // RAT row
  b.ui.ondrag(30, 108, 0, 0, 0, 0, 0, 0);
  b.send();
  const st = JSON.parse(b.eng.getvalueof());
  assert.strictEqual(st.tracks[0].steps[0].probability, 0);
  assert.strictEqual(st.tracks[0].steps[0].ratchet, 4);
});

test("SYNTH screen: tab switch, voice select, all 10 nodes write the right parameter", () => {
  const b = boot();
  b.draw();
  click(b, [86, 58]);                     // SYNTH tab
  b.send(); b.draw();
  assert.ok(b.mg.svg().includes("HISS  SYNTH"));
  click(b, [30, 134]);                    // voice list: METAL (y = 104 + 2*15)
  b.send(); b.draw();
  assert.ok(b.mg.svg().includes("METAL  SYNTH"));
  assert.ok(b.mg.svg().includes("RATIO"), "METAL character label");
  const expect = [["macro", "tone"], ["macro", "decay"], ["macro", "texture"], ["macro", "drive"], ["synth", "reso"],
    ["synth", "attack"], ["synth", "character"], ["macro", "pan"], ["synth", "spread"], ["level", null]];
  expect.forEach(([sel, key], n) => {
    const [nx, ny] = synthNode(n);
    b.ui.onclick(nx, ny, 1, 0, 0, 0, 0, 0);
    b.ui.ondrag(nx, ny - 300, 0, 0, 0, 0, 0, 0);
    const m = b.uiOut.filter((x) => x[1] === sel).pop();
    assert.ok(m, `node ${n} sent no ${sel}`);
    if (key) assert.strictEqual(m[2], key);
    b.send(); b.draw();
  });
  const t = JSON.parse(b.eng.getvalueof()).tracks[2];
  assert.ok(["tone", "decay", "texture", "drive", "pan"].every((k) => t.sound[k] === 1));
  assert.ok(["reso", "attack", "character", "spread"].every((k) => t.synth[k] === 1));
  assert.strictEqual(t.levelDb, 6);
  // double-click resets
  const [lx, ly] = synthNode(9);
  b.ui.ondblclick(lx, ly); b.send();
  assert.strictEqual(JSON.parse(b.eng.getvalueof()).tracks[2].levelDb, -14);
  const [rx, ry] = synthNode(4);
  b.ui.ondblclick(rx, ry); b.send(); b.draw();
  assert.strictEqual(JSON.parse(b.eng.getvalueof()).tracks[2].synth.reso, C_DEF_RESO_METAL);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ui_preview_synth.svg"), b.mg.svg());
});

test("GENERATE on SYNTH screen changes sound, not rhythm; on SEQ changes rhythm, not sound", () => {
  const b = boot();
  b.draw();
  const snap = () => JSON.parse(b.eng.getvalueof()).tracks;
  const rhythm = (ts) => JSON.stringify(ts.map((t) => t.steps.map((s) => s.on)));
  const sound = (ts) => JSON.stringify(ts.map((t) => [t.sound, t.synth]));
  let before = snap();
  click(b, [86, 58]); b.send(); b.draw();   // SYNTH
  click(b, [540, 18]); b.send(); b.draw();   // GENERATE
  let after = snap();
  assert.strictEqual(rhythm(after), rhythm(before));
  assert.notStrictEqual(sound(after), sound(before));
  before = after;
  click(b, [36, 58]); b.send(); b.draw();   // SEQ
  click(b, [540, 18]); b.send(); b.draw();
  after = snap();
  assert.notStrictEqual(rhythm(after), rhythm(before));
  assert.strictEqual(sound(after), sound(before));
});

test("preview render of the SEQ screen (for review only)", () => {
  const b = boot();
  for (let i = 0; i < 60; i++) { const p = i * 0.02; b.eng.tick(1, 1 + Math.floor(p), (p % 1) * 480, 480, 124); }
  b.send(); b.draw();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ui_preview_base.svg"), b.mg.svg());
  assert.ok(b.mg.svg().includes("GENERATE"));
});
