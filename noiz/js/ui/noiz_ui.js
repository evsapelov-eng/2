// NØIZ — device UI for [jsui] (mgraphics), 760×169 logical px, monochrome.
// Two screens: SEQ (pattern) and SYNTH (voice sound). Only controls wired to the
// engine/DSP are shown (docs/CONTROL_AUDIT.md). ES5 only; text ASCII; Ø drawn as geometry.
// NOIZ_DSP_MAP (unit display) is injected by js/build.js from spec/dsp_map.json.
//
// SEQ:   step click = on/off · alt/option+click = select step (STEP mode: P-Locks)
//        name = select voice · M = mute · L = protect voice from Generate/Mutate
//        LEN / DIV (or VEL / PROB / RAT in STEP mode): drag up/down
// SYNTH: voice list · 10 sound nodes for the selected voice
// Nodes: drag up/down anywhere on the node, Shift = fine, double-click = default.
// GENERATE / MUTATE act on what the screen shows: SEQ → rhythm + P-Locks, SYNTH → sound.

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;
inlets = 1;
outlets = 1;

var W0 = 760, H0 = 169;
var COL = {
  bg: [0.039, 0.039, 0.043, 1],        // #0A0A0B
  primary: [0.957, 0.957, 0.941, 1],   // #F4F4F0
  secondary: [0.655, 0.659, 0.659, 1], // #A7A8A8
  inactive: [0.302, 0.318, 0.329, 1],  // #4D5154
  divider: [0.333, 0.345, 0.353, 1]    // #55585A
};
var NAMES = ["HISS", "DUST", "METAL", "ATMOS"];
var VOICE_KEYS = ["HISS", "DUST", "METAL", "ATMOS"];

var G = null, S = null, seenVersion = -1;
var phPos = [-1, -1, -1, -1];
var hits = [], drag = null, dirty = true, scaleF = 1, lastError = "";

// ---------- engine link ----------
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
frame.interval = 33; // ≤ 30 fps, only when something changed
frame.repeat();
function notifydeleted() { frame.cancel(); }

// ---------- units (display only; values are 0..1 in the model) ----------
function expMap(r, x) { return r[0] * Math.pow(r[1] / r[0], x); }
function fmtHz(hz) { return hz >= 1000 ? (Math.round(hz / 100) / 10) + "k" : String(Math.round(hz)); }
function fmtMs(ms) { return ms < 10 ? (Math.round(ms * 10) / 10) + "ms" : Math.round(ms) + "ms"; }
function pct(v) { return Math.round(v * 100) + "%"; }
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function fmtPan(v) {
  var p = Math.round((v - 0.5) * 200);
  return p === 0 ? "C" : (p < 0 ? "L" + (-p) : "R" + p);
}
var LEVEL_MIN = -36, LEVEL_MAX = 6;
function levelToV(db) { return (db - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN); }
function vToLevel(v) { return Math.round((LEVEL_MIN + v * (LEVEL_MAX - LEVEL_MIN)) * 2) / 2; }
function voiceMap(t) { return NOIZ_DSP_MAP.voices[VOICE_KEYS[t]]; }

function valueText(key, v, t) {
  var vm = voiceMap(t);
  if (key === "tone") return fmtHz(expMap(vm.toneHz, v));
  if (key === "decay") return fmtMs(expMap(vm.decayMs, v));
  if (key === "attack") return fmtMs(expMap(NOIZ_DSP_MAP.envelope.attackMs, v));
  if (key === "pan") return fmtPan(v);
  if (key === "level") return vToLevel(v) + "dB";
  return pct(v);
}

// ---------- drawing helpers ----------
function col(c, a) { mgraphics.set_source_rgba(c[0], c[1], c[2], a === undefined ? c[3] : a); }
function rect(x, y, w, h, c, fill, lw) {
  col(c);
  mgraphics.set_line_width(lw || 1);
  if (fill) { mgraphics.rectangle(x, y, w, h); mgraphics.fill(); }
  else { mgraphics.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); mgraphics.stroke(); }
}
function font(size, bold) { mgraphics.select_font_face(bold ? "Arial Bold" : "Arial"); mgraphics.set_font_size(size); }
function text(s, x, y, size, c, bold) { font(size, bold); col(c); mgraphics.move_to(x, y); mgraphics.show_text(s); }
function textW(s, size, bold) { font(size, bold); return mgraphics.text_measure(s)[0]; }
function textC(s, cx, y, size, c, bold) { text(s, cx - textW(s, size, bold) / 2, y, size, c, bold); }
function line(x1, y1, x2, y2, c, lw, a) {
  col(c, a); mgraphics.set_line_width(lw || 1);
  mgraphics.move_to(x1, y1); mgraphics.line_to(x2, y2); mgraphics.stroke();
}
function dot(x, y, r, c) { col(c); mgraphics.ellipse(x - r, y - r, 2 * r, 2 * r); mgraphics.fill(); }
function hit(o) { hits.push(o); }

function drawLogo(x, y) {
  text("N", x, y, 24, COL.primary, true);
  var ox = x + textW("N", 24, true) + 1;
  text("O", ox, y, 24, COL.primary, true);
  var ow = textW("O", 24, true);
  line(ox + 1, y + 1, ox + ow - 1, y - 18, COL.primary, 2.2);
  text("IZ", ox + ow + 1, y, 24, COL.primary, true);
}

function button(x, y, w, h, label, cmd, size, strong, enabled) {
  var on = enabled !== false;
  rect(x, y, w, h, on ? COL.primary : COL.inactive, false, strong ? 1.5 : 1);
  textC(label, x + w / 2, y + h / 2 + size * 0.36, size, on ? COL.primary : COL.inactive, true);
  if (on) hit({ x: x, y: y, w: w, h: h, kind: "cmd", cmd: cmd });
}

function toggleBox(x, y, w, h, label, on, o) {
  rect(x, y, w, h, on ? COL.primary : COL.inactive, on);
  textC(label, x + w / 2, y + h / 2 + 3, 7.5, on ? COL.bg : COL.secondary, true);
  o.x = x; o.y = y; o.w = w; o.h = h;
  hit(o);
}

// ---------- paint ----------
function paint() {
  try { paintUi(); }
  catch (e) {
    lastError = String(e);
    post("NOIZ UI error: " + lastError + "\n");
    rect(0, 0, W0, H0, COL.bg, true);
    text("NOIZ UI error (see Max Console):", 10, 20, 11, COL.primary);
    text(lastError.substring(0, 110), 10, 38, 11, COL.primary);
  }
}

function paintUi() {
  pull();
  var sz = mgraphics.size;
  scaleF = Math.min(sz[0] / W0, sz[1] / H0);
  if (!(scaleF > 0)) scaleF = 1;
  mgraphics.scale(scaleF, scaleF);
  hits = [];
  rect(0, 0, W0, H0, COL.bg, true);
  drawLogo(12, 30);
  text("GENERATIVE PERCUSSION", 13, 43, 7, COL.secondary);
  if (!S) { text("waiting for engine...", 200, 90, 11, COL.secondary); return; }
  var g = S.global;
  var synthView = g.activeView === "SOUND";
  // screen tabs
  toggleBox(12, 51, 48, 15, "SEQ", !synthView, { kind: "view", v: "SEQUENCE" });
  toggleBox(62, 51, 48, 15, "SYNTH", synthView, { kind: "view", v: "SOUND" });
  // transport status (read-only, from Live)
  if (S.playing) dot(16, 80, 2.5, COL.primary); else rect(13.5, 77.5, 5, 5, COL.inactive, false);
  var st = (Math.round(S.tempo * 10) / 10) + " BPM";
  if (S.playing && G && G.pos !== undefined) st += "  " + (Math.floor(G.pos / 4) + 1) + "." + (Math.floor(G.pos % 4) + 1);
  text(st, 24, 83, 8, S.playing ? COL.primary : COL.secondary);
  if (S.pending) text("NEXT BAR", 13, 96, 7.5, COL.primary, true);
  line(124, 8, 124, 161, COL.divider);
  drawActions(g);
  if (synthView) drawSynth(g); else drawSeq(g);
}

// GENERATE / MUTATE / AMOUNT / KEEP / UNDO — same place on both screens
function drawActions(g) {
  var x = 528;
  rect(x, 6, 110, 26, COL.primary, false, 1.5);
  rect(x + 10, 12, 13, 13, COL.primary, false);
  var pts = [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]];
  for (var i = 0; i < pts.length; i++) dot(x + 10 + pts[i][0], 12 + pts[i][1], 1.1, COL.primary);
  text("GENERATE", x + 31, 23, 9.5, COL.primary, true);
  hit({ x: x, y: 6, w: 110, h: 26, kind: "cmd", cmd: "generate" });
  button(x + 118, 6, 110, 26, "MUTATE", "mutate", 9.5, true);
  text(g.activeView === "SOUND" ? "ACTS ON: SOUND" : "ACTS ON: RHYTHM + P-LOCKS", x, 44, 6.5, COL.secondary);
  // amount
  text("AMOUNT", x, 58, 7, COL.secondary);
  var bx = x + 40, bw = 82;
  rect(bx, 51, bw, 7, COL.inactive, false);
  rect(bx + 1, 52, Math.max(0, (bw - 2) * g.mutationAmount), 5, COL.primary, true);
  text(pct(g.mutationAmount), bx + bw + 4, 58, 7.5, COL.primary, true);
  hit({ x: x, y: 48, w: 150, h: 13, kind: "amount", bx: bx, bw: bw });
  button(x + 156, 48, 34, 13, "KEEP", "keep", 7);
  button(x + 194, 48, 34, 13, "UNDO", "undo", 7, false, S.canUndo);
  line(x - 8, 8, x - 8, 161, COL.divider);
}

// ---------- SEQ screen ----------
var GRID_X = 172, GRID_Y = 22, CELL = 16, GAP = 3, ROW_H = 32;

function drawSeq(g) {
  var tr = S.tracks[g.selectedTrack];
  // left: track or step settings
  if (g.selectedStep >= 0) {
    var sst = tr.steps[g.selectedStep];
    numRow(13, 116, "VEL", pct(sst.velocity), "vel");
    numRow(13, 132, "PROB", pct(sst.probability), "prob");
    numRow(13, 148, "RAT", "x" + sst.ratchet, "rat");
  } else {
    numRow(13, 116, "LEN", String(tr.length), "len");
    numRow(13, 132, "DIV", tr.division.n + ":" + tr.division.m, "div");
  }
  // grid (16 visible; 17-32 page appears only if a track is longer than 16)
  var anyLong = false;
  for (var t0 = 0; t0 < 4; t0++) if (S.tracks[t0].length > 16) anyLong = true;
  var page = anyLong ? g.selectedPage : 0;
  var off = page * 16;
  if (anyLong) {
    var px = GRID_X + 16 * (CELL + GAP) - 40;
    toggleBox(px, 4, 18, 12, "1", page === 0, { kind: "page", v: 0 });
    toggleBox(px + 21, 4, 18, 12, "2", page === 1, { kind: "page", v: 1 });
  }
  for (var t = 0; t < 4; t++) {
    var trk = S.tracks[t];
    var y = GRID_Y + t * ROW_H;
    var sel = t === g.selectedTrack;
    if (sel) rect(129, y + 4, 3, 8, COL.primary, true);
    text(NAMES[t], 135, y + 11, 8, sel ? COL.primary : COL.secondary, sel);
    hit({ x: 128, y: y - 3, w: 42, h: 22, kind: "track", t: t });
    for (var i = 0; i < 16; i++) {
      var s = off + i, x = GRID_X + i * (CELL + GAP), step = trk.steps[s];
      if (s >= trk.length) { line(x + 5, y + CELL / 2, x + CELL - 5, y + CELL / 2, COL.inactive); continue; }
      var c = trk.mute ? COL.inactive : COL.primary;
      if (step.on) {
        if (step.probability < 1) { rect(x, y, CELL, CELL, c, false); rect(x + 4, y + 4, CELL - 8, CELL - 8, c, true); }
        else rect(x, y, CELL, CELL, c, true);
        var rn = Math.min(step.ratchet, 6);
        for (var r = 1; r < rn; r++) line(x + r * CELL / rn, y + 2, x + r * CELL / rn, y + 5, COL.bg);
      } else rect(x, y, CELL, CELL, COL.inactive, false);
      var lk = false;
      for (var k in step.pLocks) if (step.pLocks.hasOwnProperty(k)) lk = true;
      if (lk && step.on) dot(x + CELL / 2, y + CELL + 3.5, 1.5, COL.primary);
      if (sel && g.selectedStep === s) rect(x - 2, y - 2, CELL + 4, CELL + 4, COL.primary, false, 1.5);
      if (phPos[t] === s) line(x, y + CELL + 8, x + CELL, y + CELL + 8, COL.secondary, 1.5);
      hit({ x: x, y: y, w: CELL, h: CELL, kind: "step", t: t, s: s });
    }
    var fx = GRID_X + 16 * (CELL + GAP) + 3;
    toggleBox(fx, y + 2, 13, 12, "M", trk.mute, { kind: "mute", t: t, v: trk.mute ? 0 : 1 });
    var held = trk.locks.rhythm && trk.locks.sound;
    toggleBox(fx + 16, y + 2, 13, 12, "L", held, { kind: "hold", t: t, v: held ? 0 : 1 });
  }
  // sound quick editor: BASE or STEP nn — always explicit
  var x0 = 528, stepMode = g.selectedStep >= 0;
  var label = NAMES[g.selectedTrack] + "  /  " + (stepMode ? "STEP " + pad2(g.selectedStep + 1) : "BASE");
  text(label, x0, 76, 8, COL.primary, true);
  if (stepMode) {
    var sx = x0 + textW(label, 8, true) + 6;
    button(sx, 67, 12, 12, "x", "exitstep", 7);
    var hasLk = false, pl = tr.steps[g.selectedStep].pLocks;
    for (var kk in pl) if (pl.hasOwnProperty(kk)) hasLk = true;
    if (hasLk) button(x0 + 196, 67, 32, 12, "CLR", "clearsteplocks", 7);
  }
  var keys = ["tone", "decay", "texture", "drive", "pan"], labels = ["TONE", "DECAY", "TEXTURE", "DRIVE", "PAN"];
  var stp = stepMode ? tr.steps[g.selectedStep] : null;
  for (var m = 0; m < 5; m++) {
    var key = keys[m], locked = stp && stp.pLocks.hasOwnProperty(key);
    var v = locked ? stp.pLocks[key] : tr.sound[key];
    drawNode(x0 + m * 45.6, 84, 45, 82, labels[m], v, valueText(key, v, g.selectedTrack),
      { kind: "macro", key: key }, locked);
  }
}

function numRow(x, y, label, value, which) {
  text(label, x, y, 7.5, COL.secondary);
  text(value, x + 36, y, 9, COL.primary, true);
  hit({ x: x, y: y - 10, w: 104, h: 14, kind: "num", which: which });
}

// ---------- SYNTH screen ----------
function drawSynth(g) {
  var t = g.selectedTrack, tr = S.tracks[t], vm = voiceMap(t);
  // voice list
  for (var v = 0; v < 4; v++) {
    var yy = 104 + v * 15, sel = v === t;
    if (sel) rect(13, yy - 7, 3, 8, COL.primary, true);
    text(NAMES[v], 20, yy, 8, sel ? COL.primary : COL.secondary, sel);
    hit({ x: 12, y: yy - 10, w: 100, h: 14, kind: "track", t: v });
  }
  // header + envelope preview computed from the real values
  text(NAMES[t] + "  SYNTH", 134, 18, 10, COL.primary, true);
  var att = expMap(NOIZ_DSP_MAP.envelope.attackMs, tr.synth.attack);
  var dec = expMap(vm.decayMs, tr.sound.decay);
  text("ATT " + fmtMs(att) + "   DEC " + fmtMs(dec) + "   TONE " + fmtHz(expMap(vm.toneHz, tr.sound.tone)) + "Hz", 134, 30, 7, COL.secondary);
  drawEnvelope(134, 36, 340, 22, att, dec);
  // 10 nodes: macros (BASE) + synth + level
  var defs = [
    ["tone", "TONE", "macro"], ["decay", "DECAY", "macro"], ["texture", "TEXTURE", "macro"], ["drive", "DRIVE", "macro"],
    ["reso", "RESO", "synth"], ["attack", "ATTACK", "synth"], ["character", NOIZ_DSP_MAP.character[VOICE_KEYS[t]].label, "synth"],
    ["pan", "PAN", "macro"], ["spread", "SPREAD", "synth"], ["level", "LEVEL", "level"]
  ];
  for (var n = 0; n < defs.length; n++) {
    var d = defs[n], val;
    if (d[2] === "macro") val = tr.sound[d[0]];
    else if (d[2] === "synth") val = tr.synth[d[0]];
    else val = levelToV(tr.levelDb);
    drawNode(130 + n * 62.2, 66, 61, 100, d[1], val, valueText(d[0], val, t), { kind: d[2], key: d[0] }, false);
  }
}

function drawEnvelope(x, y, w, h, attMs, decMs) {
  var total = Math.max(attMs + decMs, 1), span = Math.max(total * 1.1, 120);
  line(x, y + h, x + w, y + h, COL.divider, 1);
  col(COL.primary); mgraphics.set_line_width(1.2);
  var n = 80;
  for (var i = 0; i <= n; i++) {
    var tms = (i / n) * span;
    var lin = tms < attMs ? tms / attMs : Math.max(0, 1 - (tms - attMs) / decMs);
    var px = x + (i / n) * w, py = y + h - lin * lin * h;
    if (i === 0) mgraphics.move_to(px, py); else mgraphics.line_to(px, py);
  }
  mgraphics.stroke();
  text(Math.round(span) + "ms", x + w + 4, y + h, 6.5, COL.inactive);
}

// Node: the whole area is the drag target. Ring irregularity grows with the value
// (0% → near-perfect circle). Static: audio reactivity comes with P7.
function drawNode(x, y, w, h, label, v, vtext, target, locked) {
  var cx = x + w / 2, r = Math.min(15, w / 2 - 6), cy = y + r + 6;
  for (var ring = 0; ring < 3; ring++) {
    var n = 44;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = r - ring * 0.9 + v * (0.15 * r * Math.sin(3 * a + ring * 1.7) + 0.09 * r * Math.sin(5 * a - ring));
      var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i === 0) mgraphics.move_to(px, py); else mgraphics.line_to(px, py);
    }
    col(COL.primary, ring === 0 ? 1 : 0.4);
    mgraphics.set_line_width(1);
    mgraphics.stroke();
  }
  var ang = -Math.PI / 2 + v * Math.PI * 2;
  dot(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 2, COL.primary);
  textC(label, cx, cy + r + 15, 6.8, COL.secondary);
  textC(vtext, cx, cy + r + 26, 8, COL.primary, true);
  if (locked) rect(x + 3, y + 2, 5, 5, COL.primary, true); // P-Lock marker (shape)
  target.x = x; target.y = y; target.w = w; target.h = h; target.v = v;
  hit(target);
}

// ---------- interaction ----------
function find(x, y) {
  for (var i = hits.length - 1; i >= 0; i--) {
    var h = hits[i];
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  }
  return null;
}

function sendValue(target, v) {
  var t = S.global.selectedTrack;
  if (target.kind === "macro") outlet(0, "macro", target.key, v);
  else if (target.kind === "synth") outlet(0, "synth", target.key, v);
  else if (target.kind === "level") outlet(0, "level", t, vToLevel(v));
}

function onclick(x, y, but, cmd, shift, capslock, option, ctrl) {
  if (!S) return;
  x /= scaleF; y /= scaleF;
  var h = find(x, y);
  if (!h) return;
  var g = S.global, tr = S.tracks[g.selectedTrack];
  if (h.kind === "step") {
    if (option) {
      if (g.selectedTrack !== h.t) outlet(0, "select", h.t);
      outlet(0, "selstep", (g.selectedStep === h.s && g.selectedTrack === h.t) ? -1 : h.s);
    } else outlet(0, "toggle", h.t, h.s);
  } else if (h.kind === "track") outlet(0, "select", h.t);
  else if (h.kind === "mute") outlet(0, "mute", h.t, h.v);
  else if (h.kind === "hold") outlet(0, "hold", h.t, h.v);
  else if (h.kind === "page") outlet(0, "page", h.v);
  else if (h.kind === "view") { outlet(0, "selstep", -1); outlet(0, "view", h.v); }
  else if (h.kind === "cmd") {
    if (h.cmd === "exitstep") outlet(0, "selstep", -1);
    else outlet(0, h.cmd);
  } else if (h.kind === "amount") {
    outlet(0, "amount", Math.max(0, Math.min(1, (x - h.bx) / h.bw)));
    drag = { kind: "amount", h: h };
  } else if (h.kind === "macro" || h.kind === "synth" || h.kind === "level") {
    outlet(0, "gesture", 1);
    drag = { kind: "node", target: h, y0: y, v0: h.v };
  } else if (h.kind === "num") {
    var st0 = g.selectedStep >= 0 ? tr.steps[g.selectedStep] : null;
    outlet(0, "gesture", 1);
    drag = { kind: "num", which: h.which, y0: y, t: g.selectedTrack, step: g.selectedStep,
      len0: tr.length, n0: tr.division.n, m0: tr.division.m,
      vel0: st0 ? st0.velocity : 0, prob0: st0 ? st0.probability : 0, rat0: st0 ? st0.ratchet : 1 };
  }
}

var DIVS = [[1, 1], [3, 4], [5, 4], [7, 4], [3, 2], [2, 3], [4, 3], [1, 2], [2, 1]];

function ondrag(x, y, but, cmd, shift, capslock, option, ctrl) {
  if (!drag || !S) return;
  x /= scaleF; y /= scaleF;
  if (drag.kind === "amount") {
    outlet(0, "amount", Math.max(0, Math.min(1, (x - drag.h.bx) / drag.h.bw)));
  } else if (drag.kind === "node") {
    var sens = shift ? 0.0007 : 0.007;          // full range ≈ 140 px; Shift = 1/10
    var v = Math.max(0, Math.min(1, drag.v0 + (drag.y0 - y) * sens));
    sendValue(drag.target, Math.round(v * 1000) / 1000);
    if (shift) { drag.v0 = v; drag.y0 = y; }
  } else if (drag.kind === "num") {
    var dy = Math.round((drag.y0 - y) / 6), t = drag.t;
    if (drag.which === "len") outlet(0, "tracklength", t, Math.max(1, Math.min(32, drag.len0 + dy)));
    else if (drag.which === "div") {
      var idx = 0;
      for (var i = 0; i < DIVS.length; i++) if (DIVS[i][0] === drag.n0 && DIVS[i][1] === drag.m0) idx = i;
      var o = DIVS[((idx + dy) % DIVS.length + DIVS.length) % DIVS.length];
      outlet(0, "division", t, o[0], o[1]);
    } else if (drag.which === "vel") outlet(0, "stepset", t, drag.step, "velocity", Math.max(0, Math.min(1, drag.vel0 + dy * 0.02)));
    else if (drag.which === "prob") outlet(0, "stepset", t, drag.step, "probability", Math.max(0, Math.min(1, drag.prob0 + dy * 0.05)));
    else if (drag.which === "rat") outlet(0, "stepset", t, drag.step, "ratchet", Math.max(1, Math.min(8, drag.rat0 + Math.round(dy / 2))));
  }
  if (!but) { // mouse up closes the gesture → exactly one undo entry
    if (drag.kind === "node" || drag.kind === "num") outlet(0, "gesture", 0);
    drag = null;
  }
}

function ondblclick(x, y) {
  if (!S) return;
  x /= scaleF; y /= scaleF;
  var h = find(x, y);
  if (!h) return;
  var t = S.global.selectedTrack;
  if (h.kind === "macro") outlet(0, "macroreset", h.key);
  else if (h.kind === "synth") outlet(0, "synthreset", h.key);
  else if (h.kind === "level") outlet(0, "level", t, S.defaults.levelDb[t]);
}

function onresize() { dirty = true; }
