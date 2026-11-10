// NØIZ — compact device UI for [jsui] (mgraphics). TEMPORARY DIAGNOSTIC UI (spec §16.5):
// functional, monochrome, 760×169 logical px; final Compact/Full designs are P5/P6.
// ES5 only. Text is ASCII; the Ø of the logo is drawn as geometry (encoding-proof).
//
// Reads state from a Global published by noiz_engine.js ("bind <name>"), sends
// commands out of outlet 0. Never owns state: compact and full editor share one model.
//
// Gestures:  step cell click = on/off · alt/option+click step = select STEP (P-Lock mode)
//            track name click = select track · M / R / S = mute / lock rhythm / lock sound
//            node area: left-drag up/down = value, shift = fine, double-click = default
//            LEN / DIV / DENS / AMOUNT: vertical drag (AMOUNT also horizontal)

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;
inlets = 1;
outlets = 1;

var W0 = 760, H0 = 169;
var COL = {
  bg: [0.039, 0.039, 0.043, 1],      // #0A0A0B
  surface: [0.063, 0.067, 0.071, 1], // #101112
  primary: [0.957, 0.957, 0.941, 1], // #F4F4F0
  secondary: [0.655, 0.659, 0.659, 1], // #A7A8A8
  inactive: [0.302, 0.318, 0.329, 1],  // #4D5154
  divider: [0.333, 0.345, 0.353, 1]    // #55585A
};
var NAMES = ["HISS", "DUST", "METAL", "ATMOS"];
var MACROS = ["tone", "decay", "texture", "drive"];
var MACRO_LABEL = ["TONE", "DECAY", "TEXTURE", "DRIVE"];
var SCOPES = ["RHYTHM", "SOUND", "PLOCKS", "ALL"];
var SCOPE_LABEL = ["RHY", "SND", "PLK", "ALL"];

var G = null;         // shared Global
var S = null;         // parsed state
var seenVersion = -1;
var phPos = [-1, -1, -1, -1];
var hits = [];        // clickable regions
var drag = null;      // active drag
var dirty = true;
var scaleF = 1;

// ---------- layout ----------
var GRID_X = 186, GRID_Y = 26, CELL = 15, GAP = 3, ROW_H = 30;
var RIGHT_X = 528;

function bind(name) { G = new Global(name); refresh(); }
function refresh() { pull(); dirty = true; }
function pull() {
  if (!G || G.state === undefined) return;
  if (G.version === seenVersion && S) return;
  seenVersion = G.version;
  try { S = JSON.parse(G.state); } catch (e) { S = null; }
}
function playhead(a, b, c, d) { phPos = [a, b, c, d]; dirty = true; }

var frame = new Task(function () {
  if (G && G.version !== seenVersion) { pull(); dirty = true; }
  if (dirty) { dirty = false; mgraphics.redraw(); }
}, this);
frame.interval = 33; // ≈30 fps cap, redraw only when something changed
frame.repeat();
function notifydeleted() { frame.cancel(); }

// ---------- drawing helpers ----------
function col(c) { mgraphics.set_source_rgba(c[0], c[1], c[2], c[3]); }
function rect(x, y, w, h, c, fill, lw) {
  col(c);
  mgraphics.set_line_width(lw || 1);
  if (fill) { mgraphics.rectangle(x, y, w, h); mgraphics.fill(); }
  else { mgraphics.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); mgraphics.stroke(); }
}
function text(s, x, y, size, c, bold) {
  mgraphics.select_font_face("Arial");
  mgraphics.set_font_weight(bold ? 1 : 0);
  mgraphics.set_font_size(size);
  col(c);
  mgraphics.move_to(x, y);
  mgraphics.show_text(s);
}
function textW(s, size) {
  mgraphics.set_font_size(size);
  return mgraphics.text_measure(s)[0];
}
function line(x1, y1, x2, y2, c, lw) {
  col(c); mgraphics.set_line_width(lw || 1);
  mgraphics.move_to(x1, y1); mgraphics.line_to(x2, y2); mgraphics.stroke();
}
function hit(x, y, w, h, kind, a, b) { hits.push({ x: x, y: y, w: w, h: h, kind: kind, a: a, b: b }); }
function pct(v) { return Math.round(v * 100) + "%"; }
function pad2(n) { return (n < 10 ? "0" : "") + n; }

function drawLogo(x, y) {
  // N Ø I Z — Ø = O with a diagonal stroke, drawn as geometry
  text("N", x, y, 26, COL.primary, true);
  var ox = x + textW("N", 26) + 2;
  text("O", ox, y, 26, COL.primary, true);
  var ow = textW("O", 26);
  line(ox + 1, y + 1, ox + ow - 1, y - 20, COL.primary, 2.2);
  text("IZ", ox + ow + 1, y, 26, COL.primary, true);
}

// ---------- paint ----------
function paint() {
  pull(); // always draw the latest published state
  var sz = mgraphics.size;
  scaleF = Math.min(sz[0] / W0, sz[1] / H0);
  if (!(scaleF > 0)) scaleF = 1;
  mgraphics.scale(scaleF, scaleF);
  hits = [];
  rect(0, 0, W0, H0, COL.bg, true);
  drawLogo(12, 34);
  text("GENERATIVE PERCUSSION", 13, 48, 7.5, COL.secondary, false);
  text("DIAGNOSTIC UI", 13, 160, 7, COL.inactive, false);
  if (!S) { text("waiting for engine...", 200, 90, 11, COL.secondary); return; }
  var g = S.global;
  // status
  text(S.playing ? "SYNC  LIVE" : "SYNC  STOPPED", 13, 64, 8, S.playing ? COL.primary : COL.secondary);
  if (S.playing) rect(78, 57, 6, 6, COL.primary, true);
  text(Math.round(S.tempo * 10) / 10 + " BPM", 13, 76, 8, COL.secondary);
  if (S.pending) text("PENDING > NEXT BAR", 13, 88, 8, COL.primary, true);
  // selected track settings (drag numbers)
  var tr = S.tracks[g.selectedTrack];
  if (g.selectedStep >= 0) {
    // STEP mode: per-step Velocity / Probability / Ratchet of the selected step
    var sst = tr.steps[g.selectedStep];
    drawNumber(13, 104, "VEL", pct(sst.velocity), "vel");
    drawNumber(13, 120, "PROB", pct(sst.probability), "prob");
    drawNumber(13, 136, "RAT", "x" + sst.ratchet, "rat");
  } else {
    drawNumber(13, 104, "LEN", String(tr.length), "len");
    drawNumber(13, 120, "DIV", tr.division.n + ":" + tr.division.m, "div");
    drawNumber(13, 136, "DENS", pct(tr.density), "dens");
  }
  line(176, 8, 176, 161, COL.divider);
  drawGrid(g);
  line(RIGHT_X - 8, 8, RIGHT_X - 8, 161, COL.divider);
  drawActions(g);
}

function drawNumber(x, y, label, value, kind) {
  text(label, x, y, 8, COL.secondary);
  text(value, x + 40, y, 9, COL.primary, true);
  hit(x, y - 10, 150, 14, "num", kind);
}

function drawGrid(g) {
  var page = g.selectedPage;
  var off = page * 16;
  // page switch
  text("STEPS " + (off + 1) + "-" + (off + 16), GRID_X, 14, 7.5, COL.secondary);
  var px = GRID_X + 16 * (CELL + GAP) - 34;
  rect(px, 5, 15, 12, page === 0 ? COL.primary : COL.inactive, page === 0);
  text("1", px + 5, 14, 8, page === 0 ? COL.bg : COL.secondary, true);
  rect(px + 18, 5, 15, 12, page === 1 ? COL.primary : COL.inactive, page === 1);
  text("2", px + 23, 14, 8, page === 1 ? COL.bg : COL.secondary, true);
  hit(px, 5, 15, 12, "page", 0); hit(px + 18, 5, 15, 12, "page", 1);
  for (var t = 0; t < 4; t++) {
    var tr = S.tracks[t];
    var y = GRID_Y + t * ROW_H;
    var sel = (t === g.selectedTrack);
    // name: selected = filled marker (shape, not only colour)
    if (sel) rect(132, y + 4, 4, 6, COL.primary, true); // selected-track marker (shape)
    for (var i = 0; i < 16; i++) {
      var s = off + i;
      var x = GRID_X + i * (CELL + GAP);
      var st = tr.steps[s];
      var inLen = s < tr.length;
      var cy = y + 0;
      if (!inLen) {
        line(x + 4, cy + CELL / 2, x + CELL - 4, cy + CELL / 2, COL.inactive); // outside length: dash
      } else if (st.on) {
        if (st.probability < 1) {
          rect(x, cy, CELL, CELL, COL.primary, false);
          rect(x + 3, cy + 3, CELL - 6, CELL - 6, tr.mute ? COL.inactive : COL.primary, true); // inset = probability<1
        } else {
          rect(x, cy, CELL, CELL, tr.mute ? COL.inactive : COL.primary, true);
        }
        if (st.ratchet > 1) for (var r = 1; r < Math.min(st.ratchet, 5); r++) line(x + r * CELL / Math.min(st.ratchet, 5), cy + 2, x + r * CELL / Math.min(st.ratchet, 5), cy + 5, COL.bg, 1);
      } else {
        rect(x, cy, CELL, CELL, COL.inactive, false);
      }
      var hasLock = false;
      for (var k in st.pLocks) if (st.pLocks.hasOwnProperty(k)) hasLock = true;
      if (hasLock && st.on && inLen) { col(COL.primary); mgraphics.ellipse(x + CELL / 2 - 1.5, cy + CELL + 2, 3, 3); mgraphics.fill(); }
      if (sel && g.selectedStep === s) rect(x - 2, cy - 2, CELL + 4, CELL + 4, COL.primary, false, 1.5);
      if (phPos[t] === s) line(x, cy + CELL + 7, x + CELL, cy + CELL + 7, COL.secondary, 1.5);
      if (inLen) hit(x, cy, CELL, CELL, "step", t, s);
    }
    // name + M R S
    text(NAMES[t], 140, y + 11, 8.5, sel ? COL.primary : COL.secondary, sel);
    hit(132, y - 2, 44, 18, "track", t);
    var bx = GRID_X + 16 * (CELL + GAP) + 2;
    drawFlag(bx, y + 1, "M", tr.mute, "mute", t);
    drawFlag(bx + 13, y + 1, "R", tr.locks.rhythm, "lockr", t);
    drawFlag(bx + 26, y + 1, "S", tr.locks.sound, "locks", t);
  }
}

function drawFlag(x, y, label, on, kind, t) {
  rect(x, y, 11, 12, on ? COL.primary : COL.inactive, on);
  text(label, x + 2.5, y + 9, 7.5, on ? COL.bg : COL.secondary, true);
  hit(x, y, 11, 12, kind, t, on ? 0 : 1);
}

function button(x, y, w, h, label, kind, size, primary) {
  rect(x, y, w, h, COL.primary, false, primary ? 1.5 : 1);
  var tw = textW(label, size);
  text(label, x + (w - tw) / 2, y + h / 2 + size * 0.36, size, COL.primary, true);
  hit(x, y, w, h, kind);
}

function drawDie(x, y) {
  rect(x, y, 13, 13, COL.primary, false);
  col(COL.primary);
  var pts = [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]];
  for (var i = 0; i < pts.length; i++) { mgraphics.ellipse(x + pts[i][0] - 0.8, y + pts[i][1] - 0.8, 2.2, 2.2); mgraphics.fill(); }
}

function drawActions(g) {
  var x = RIGHT_X;
  rect(x, 6, 110, 26, COL.primary, false, 1.5);
  drawDie(x + 10, 12);
  text("GENERATE", x + 31, 23, 9.5, COL.primary, true);
  hit(x, 6, 110, 26, "generate");
  button(x + 118, 6, 110, 26, "MUTATE", "mutate", 9.5, true);
  // scope
  for (var i = 0; i < 4; i++) {
    var sx = x + i * 31, on = g.randomScope === SCOPES[i];
    rect(sx, 37, 29, 13, on ? COL.primary : COL.inactive, on);
    text(SCOPE_LABEL[i], sx + 5, 47, 7.5, on ? COL.bg : COL.secondary, true);
    hit(sx, 37, 29, 13, "scope", SCOPES[i]);
  }
  button(x + 128, 37, 48, 13, "KEEP", "keep", 7.5);
  if (S.canUndo) button(x + 180, 37, 48, 13, "UNDO", "undo", 7.5);
  else { rect(x + 180, 37, 48, 13, COL.inactive, false); text("UNDO", x + 193, 47, 7.5, COL.inactive, true); }
  // amount (+ lock density/amount when scope = PLOCKS)
  drawBar(x, 56, 228, "AMOUNT", g.mutationAmount, "amount");
  if (g.randomScope === "PLOCKS" || g.randomScope === "ALL") {
    drawBar(x, 70, 110, "LK DENS", g.lockDensity, "lockdensity");
    drawBar(x + 118, 70, 110, "LK AMT", g.lockAmount, "lockamount");
  }
  // macro nodes for selected track: BASE or STEP nn, always explicit
  var tr = S.tracks[g.selectedTrack];
  var mode = g.selectedStep >= 0 ? "STEP " + pad2(g.selectedStep + 1) : "BASE";
  text(NAMES[g.selectedTrack] + "  /  " + mode, x, 92, 8, COL.primary, true);
  if (g.selectedStep >= 0) { button(x + 150, 83, 36, 12, "CLR", "clearsteplocks", 7); button(x + 190, 83, 38, 12, "BASE", "base", 7); }
  var st = g.selectedStep >= 0 ? tr.steps[g.selectedStep] : null;
  for (var m = 0; m < 4; m++) {
    var key = MACROS[m];
    var locked = st && st.pLocks.hasOwnProperty(key);
    var v = locked ? st.pLocks[key] : tr.sound[key];
    drawNode(x + m * 58, 98, 56, 64, MACRO_LABEL[m], v, key, locked, st !== null);
  }
}

function drawBar(x, y, w, label, v, kind) {
  text(label, x, y + 8, 7, COL.secondary);
  var bx = x + 46, bw = w - 46 - 30;
  rect(bx, y + 2, bw, 6, COL.inactive, false);
  rect(bx + 1, y + 3, Math.max(0, (bw - 2) * v), 4, COL.primary, true);
  text(pct(v), bx + bw + 4, y + 8, 7.5, COL.primary, true);
  hits.push({ x: x, y: y - 1, w: w, h: 12, kind: "bar", msg: kind, bx: bx, bw: bw });
}

// Node: whole area is the hit target. Shape = circle whose irregularity grows with value
// (0% → near-perfect circle). Static here: audio reactivity is P7, after DSP is host-validated.
function drawNode(x, y, w, h, label, v, key, locked, stepMode) {
  var cx = x + w / 2, cy = y + 24, r = 15;
  col(COL.primary);
  mgraphics.set_line_width(1);
  for (var ring = 0; ring < 3; ring++) {
    var n = 48;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var wob = v * (2.2 * Math.sin(3 * a + ring * 1.7) + 1.4 * Math.sin(5 * a - ring));
      var rr = r - ring * 0.9 + wob;
      var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i === 0) mgraphics.move_to(px, py); else mgraphics.line_to(px, py);
    }
    mgraphics.set_source_rgba(COL.primary[0], COL.primary[1], COL.primary[2], ring === 0 ? 1 : 0.45);
    mgraphics.stroke();
  }
  // value marker on the orbit
  var ang = -Math.PI / 2 + v * Math.PI * 2;
  col(COL.primary);
  mgraphics.ellipse(cx + Math.cos(ang) * r - 2, cy + Math.sin(ang) * r - 2, 4, 4); mgraphics.fill();
  var lw = textW(label, 7);
  text(label, cx - lw / 2, y + 52, 7, COL.secondary);
  var vs = pct(v);
  var vw = textW(vs, 8.5);
  text(vs, cx - vw / 2, y + 62, 8.5, COL.primary, true);
  if (stepMode && locked) { rect(x + 2, y + 2, 5, 5, COL.primary, true); } // P-Lock marker (shape)
  hit(x, y, w, h, "node", key);
}

// ---------- interaction ----------
function find(x, y) {
  for (var i = hits.length - 1; i >= 0; i--) {
    var h = hits[i];
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  }
  return null;
}

function currentNodeValue(key) {
  var g = S.global, tr = S.tracks[g.selectedTrack];
  if (g.selectedStep >= 0 && tr.steps[g.selectedStep].pLocks.hasOwnProperty(key)) return tr.steps[g.selectedStep].pLocks[key];
  return tr.sound[key];
}

function onclick(x, y, but, cmd, shift, capslock, option, ctrl) {
  if (!S) return;
  x /= scaleF; y /= scaleF;
  var h = find(x, y);
  if (!h) return;
  var g = S.global;
  switch (h.kind) {
    case "step":
      if (option) {
        if (g.selectedTrack !== h.a) outlet(0, "select", h.a);
        outlet(0, "selstep", (g.selectedStep === h.b && g.selectedTrack === h.a) ? -1 : h.b);
      } else outlet(0, "toggle", h.a, h.b);
      break;
    case "track": outlet(0, "select", h.a); break;
    case "mute": case "lockr": case "locks": outlet(0, h.kind, h.a, h.b); break;
    case "page": outlet(0, "page", h.a); break;
    case "scope": outlet(0, "scope", h.a); break;
    case "generate": case "mutate": case "keep": case "undo": case "clearsteplocks": outlet(0, h.kind); break;
    case "base": outlet(0, "selstep", -1); break;
    case "bar":
      setBar(h, x);
      drag = { kind: "bar", h: h };
      break;
    case "node":
      outlet(0, "gesture", 1);
      drag = { kind: "node", key: h.a, y0: y, v0: currentNodeValue(h.a) };
      break;
    case "num":
      var tr = S.tracks[g.selectedTrack];
      outlet(0, "gesture", 1);
      var st0 = g.selectedStep >= 0 ? tr.steps[g.selectedStep] : null;
      drag = { kind: "num", which: h.a, y0: y, len0: tr.length, n0: tr.division.n, m0: tr.division.m, d0: tr.density,
        vel0: st0 ? st0.velocity : 0, prob0: st0 ? st0.probability : 0, rat0: st0 ? st0.ratchet : 1, step: g.selectedStep };
      break;
  }
}

function setBar(h, x) { outlet(0, h.msg, Math.max(0, Math.min(1, (x - h.bx) / h.bw))); }

function ondrag(x, y, but, cmd, shift, capslock, option, ctrl) {
  if (!drag || !S) return;
  x /= scaleF; y /= scaleF;
  var g = S.global;
  if (drag.kind === "bar") {
    setBar(drag.h, x);
  } else if (drag.kind === "node") {
    var sens = shift ? 0.0007 : 0.007;          // full range ≈ 140 px; shift = 1/10
    var v = Math.max(0, Math.min(1, drag.v0 + (drag.y0 - y) * sens));
    outlet(0, "macro", drag.key, Math.round(v * 1000) / 1000);
    if (shift) { drag.v0 = v; drag.y0 = y; }   // keep fine mode relative
  } else if (drag.kind === "num") {
    var dy = Math.round((drag.y0 - y) / 6);
    var t = g.selectedTrack;
    if (drag.which === "len") outlet(0, "tracklength", t, Math.max(1, Math.min(32, drag.len0 + dy)));
    else if (drag.which === "div") {
      var opts = [[1, 1], [3, 4], [5, 4], [7, 4], [3, 2], [2, 3], [4, 3], [1, 2], [2, 1]];
      var idx = 0;
      for (var i = 0; i < opts.length; i++) if (opts[i][0] === drag.n0 && opts[i][1] === drag.m0) idx = i;
      var o = opts[(idx + Math.max(0, dy) + opts.length * 10 + Math.min(0, dy)) % opts.length];
      outlet(0, "division", t, o[0], o[1]);
    } else if (drag.which === "dens") outlet(0, "density", t, Math.max(0.02, Math.min(0.9, drag.d0 + dy * 0.01)));
    else if (drag.which === "vel") outlet(0, "stepset", t, drag.step, "velocity", Math.max(0, Math.min(1, drag.vel0 + dy * 0.02)));
    else if (drag.which === "prob") outlet(0, "stepset", t, drag.step, "probability", Math.max(0, Math.min(1, drag.prob0 + dy * 0.05)));
    else if (drag.which === "rat") outlet(0, "stepset", t, drag.step, "ratchet", Math.max(1, Math.min(8, drag.rat0 + Math.round(dy / 2))));
  }
  if (!but) { // mouse up: close the gesture → exactly one undo entry
    if (drag.kind === "node" || drag.kind === "num") outlet(0, "gesture", 0);
    drag = null;
  }
}

function ondblclick(x, y) {
  if (!S) return;
  x /= scaleF; y /= scaleF;
  var h = find(x, y);
  if (h && h.kind === "node") outlet(0, "macroreset", h.a);
}

function onresize() { dirty = true; }
