// KØRE — device UI for [jsui] (mgraphics). ONE panel that fits Live's device strip
// (1240×169): no separate editor window. Tabs SEQUENCE / SOUND / LANES switch the middle
// area; GENERATE / MUTATE PERC / AMOUNT, the HUM sub knob and the meters are always visible.
// Reads the published engine state (Global) and sends commands to the engine.
// Monochrome, flat (spec §14). Waveform and pitch-vs-time come from the shared voice model
// (js/shared/kore_dsp_model.js, bundled by js/build.js); meters use measured peaks from
// [peakamp~] — never decorative noise. ES5; ASCII text; Ø drawn as geometry.

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;
inlets = 1;
outlets = 1;

var W0 = 1240, H0 = 169;
var COL = {
  bg: [0.035, 0.039, 0.039, 1],        // #090A0A
  panel: [0.063, 0.071, 0.071, 1],     // #101212
  primary: [0.953, 0.953, 0.937, 1],   // #F3F3EF
  stroke: [0.522, 0.541, 0.525, 1],    // #858A86
  inactive: [0.235, 0.255, 0.247, 1]   // #3C413F
};
var NAMES = ["PUNCH", "SUB", "RUMBLE", "TOM L", "TOM H", "HAT"];
var PARAMS = [];            // editable on SOUND / LANES (HUM has its own knob on the right)
for (var pi = 0; pi < NAMES.length; pi++) {
  var pk = KORE_DSP_MAP.voices[NAMES[pi]].params, pl = [];
  for (var pj = 0; pj < pk.length; pj++) if (pk[pj] !== "hum") pl.push(pk[pj]);
  PARAMS.push(pl);
}
var LABEL = { tune: "TUNE", punch: "PUNCH", time: "TIME", body: "BODY", decay: "DECAY", drive: "DRIVE", click: "CLICK",
  clicktone: "CLK TONE", sweep: "GLIDE", tone: "TONE", snap: "SNAP", reso: "RESO", open: "OPEN", amount: "AMOUNT", tail: "TAIL", duck: "DUCK", hum: "HUM" };
var STYLES = ["FOUNDATION", "DRIVING", "HYPNOTIC", "BROKEN"];
var DIVS = [[1, 1], [3, 4], [5, 4], [7, 4], [3, 2], [2, 3], [4, 3], [1, 2], [2, 1]];

// layout (device strip)
var MX = 158, MR = 966, RX = 976;                 // middle area, right column
var SROW = 25, SCELL = 21, SGAP = 4, SGX = 256, SGY = 10; // sequencer grid
var CX = 678;                                      // contextual strip (SEQUENCE)
var LX = 160, LCOL = 50, LTOP = 36, LH = 104;      // lanes

var G = null, S = null, seenVersion = -1, phPos = [-1, -1, -1, -1, -1, -1];
var hits = [], drag = null, dirty = true, scaleF = 1, lastError = "", laneKey = null;

// ---------- engine link ----------
function bind(name) { G = new Global(name); refresh(); }
function refresh() { pull(); dirty = true; }
function pull() {
  if (!G || G.state === undefined) return;
  if (G.version === seenVersion && S) return;
  seenVersion = G.version;
  try { S = JSON.parse(G.state); } catch (e) { S = null; }
}
function playhead(a, b, c, d, e, f) { phPos = [a, b, c, d, e, f]; dirty = true; }

var frame = new Task(function () {
  if (G && G.version !== seenVersion) { pull(); dirty = true; }
  if (S && S.playing) dirty = true;                // meters / playhead
  if (dirty) { dirty = false; mgraphics.redraw(); }
}, this);
frame.interval = 33; // ≤ 30 fps
frame.repeat();
function notifydeleted() { frame.cancel(); }

// ---------- units ----------
function expMap(r, x) { return r[0] * Math.pow(r[1] / r[0], x); }
function vmap(t) { return KORE_DSP_MAP.voices[NAMES[t]]; }
function fmtHz(hz) { return hz >= 1000 ? (Math.round(hz / 100) / 10) + "k" : String(Math.round(hz)); }
function fmtMs(ms) { return ms < 10 ? (Math.round(ms * 10) / 10) + "ms" : Math.round(ms) + "ms"; }
function pct(v) { return Math.round(v * 100) + "%"; }
function pad2(n) { return (n < 10 ? "0" : "") + n; }
var LEVEL_MIN = -36, LEVEL_MAX = 6;
function levelToV(db) { return (db - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN); }
function vToLevel(v) { return Math.round((LEVEL_MIN + v * (LEVEL_MAX - LEVEL_MIN)) * 2) / 2; }
function valueText(t, key, v) {
  var m = vmap(t);
  if (key === "level") return vToLevel(v) + "dB";
  if (key === "hum") { var hm = KORE_DSP_MAP.voices.PUNCH.hum; return v > 0 ? Math.round(hm.maxDb + 20 * Math.log(v) / Math.LN10) + "dB" : "OFF"; }
  if (key === "tune") return fmtHz(expMap(m.tuneHz, v)) + "Hz";
  if (key === "decay") return fmtMs(expMap(m.decayMs, v));
  if (key === "tail") return fmtMs(expMap(m.tailMs, v));
  if (t === 0) {
    if (key === "punch") return "+" + Math.round(m.sweepSemis[0] + (m.sweepSemis[1] - m.sweepSemis[0]) * v) + "st";
    if (key === "time") return fmtMs(expMap(m.sweepTauMs, v));
    if (key === "body") return fmtMs(m.holdMs[0] + (m.holdMs[1] - m.holdMs[0]) * v);
    if (key === "clicktone") return fmtHz(expMap(m.clickToneHz, v)) + "Hz";
  }
  if (key === "sweep") return "+" + Math.round(m.sweepSemisRange[0] + (m.sweepSemisRange[1] - m.sweepSemisRange[0]) * v) + "st";
  if (key === "tone" && m.toneHz) return fmtHz(expMap(m.toneHz, v)) + "Hz";
  if (key === "tone" && t === 2) return fmtHz(expMap(m.lowpassHz, v)) + "Hz";
  if (key === "open") return "x" + (Math.round((m.openFactor[0] + (m.openFactor[1] - m.openFactor[0]) * v) * 10) / 10);
  return pct(v);
}
function hasLock(step, k) { return !!(step && step.pLocks && step.pLocks.hasOwnProperty(k)); }
function effOf(tr, step, k) { return hasLock(step, k) ? step.pLocks[k] : tr.params[k]; }

// ---------- drawing helpers ----------
function col(c, a) { mgraphics.set_source_rgba(c[0], c[1], c[2], a === undefined ? c[3] : a); }
function rect(x, y, w, h, c, fill, lw, a) {
  col(c, a); mgraphics.set_line_width(lw || 1);
  if (fill) { mgraphics.rectangle(x, y, w, h); mgraphics.fill(); }
  else { mgraphics.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); mgraphics.stroke(); }
}
function font(size, bold) { mgraphics.select_font_face(bold ? "Arial Bold" : "Arial"); mgraphics.set_font_size(size); }
function text(s, x, y, size, c, bold) { font(size, bold); col(c); mgraphics.move_to(x, y); mgraphics.show_text(s); }
function textW(s, size, bold) { font(size, bold); return mgraphics.text_measure(s)[0]; }
function textC(s, cx, y, size, c, bold) { text(s, cx - textW(s, size, bold) / 2, y, size, c, bold); }
function line(x1, y1, x2, y2, c, lw, a) { col(c, a); mgraphics.set_line_width(lw || 1); mgraphics.move_to(x1, y1); mgraphics.line_to(x2, y2); mgraphics.stroke(); }
function dot(x, y, r, c, a) { col(c, a); mgraphics.ellipse(x - r, y - r, 2 * r, 2 * r); mgraphics.fill(); }
function circle(cx, cy, r, c, a, lw) { col(c, a); mgraphics.set_line_width(lw || 1); mgraphics.ellipse(cx - r, cy - r, 2 * r, 2 * r); mgraphics.stroke(); }
function hit(o) { hits.push(o); }
function hn(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

function drawLogo(x, y, size) {
  var s = size, ox = x;
  text("K", ox, y, s, COL.primary, true);
  ox += textW("K", s, true) + 1;
  text("O", ox, y, s, COL.primary, true);
  var ow = textW("O", s, true);
  line(ox + 1, y + 1, ox + ow - 1, y - s * 0.75, COL.primary, Math.max(1.6, s / 11));
  text("RE", ox + ow + 1, y, s, COL.primary, true);
}
function button(x, y, w, h, label, cmd, size, strong, enabled, extra) {
  var on = enabled !== false;
  rect(x, y, w, h, on ? COL.primary : COL.inactive, false, strong ? 1.5 : 1);
  textC(label, x + w / 2, y + h / 2 + size * 0.36, size, on ? COL.primary : COL.inactive, true);
  if (on) { var o = { x: x, y: y, w: w, h: h, kind: "cmd", cmd: cmd }; if (extra) for (var k in extra) o[k] = extra[k]; hit(o); }
}
function toggle(x, y, w, h, label, on, o, size) {
  rect(x, y, w, h, on ? COL.primary : COL.inactive, on);
  textC(label, x + w / 2, y + h / 2 + (size || 8) * 0.36, size || 8, on ? COL.bg : COL.stroke, true);
  o.x = x; o.y = y; o.w = w; o.h = h; hit(o);
}
function dice(x, y, s) {
  rect(x, y, s, s, COL.primary, false);
  var p = [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]];
  for (var i = 0; i < p.length; i++) dot(x + p[i][0] * s, y + p[i][1] * s, s * 0.08, COL.primary);
}

// ---------- paint ----------
function paint() {
  try {
    pull();
    var sz = mgraphics.size;
    scaleF = Math.min(sz[0] / W0, sz[1] / H0);
    if (!(scaleF > 0)) scaleF = 1;
    mgraphics.scale(scaleF, scaleF);
    hits = [];
    rect(0, 0, W0, H0, COL.bg, true);
    if (!S) { drawLogo(16, 40, 26); text("waiting for engine...", 200, 90, 12, COL.stroke); return; }
    if (laneKey === null || PARAMS[S.global.selectedTrack].indexOf(laneKey) < 0) laneKey = PARAMS[S.global.selectedTrack][0];
    var g = S.global;
    rect(4, 4, W0 - 8, H0 - 8, COL.stroke, false, 1, 0.5);
    paintLeft(g);
    line(150, 12, 150, H0 - 12, COL.inactive);
    if (g.activeView === "SOUND") paintSound(g);
    else if (g.activeView === "LANES") paintLanes(g);
    else paintSequence(g);
    line(RX - 6, 12, RX - 6, H0 - 12, COL.inactive);
    paintRight(g);
  } catch (e) {
    lastError = String(e);
    post("KORE UI error: " + lastError + "\n");
    rect(0, 0, W0, H0, COL.bg, true);
    text("KORE UI error (see Max Console):", 10, 20, 11, COL.primary);
    text(lastError.substring(0, 140), 10, 38, 11, COL.primary);
  }
}

function status(x, y, size) {
  if (S.playing) dot(x + 3, y - size * 0.35, size * 0.32, COL.primary); else rect(x, y - size * 0.65, size * 0.6, size * 0.6, COL.inactive, false);
  var st = (Math.round(S.tempo * 10) / 10) + " BPM";
  if (S.playing && G && G.pos !== undefined) st += "  " + (Math.floor(G.pos / 4) + 1) + "." + (Math.floor(G.pos % 4) + 1);
  else if (!S.playing) st += "  STOPPED";
  text(st, x + size, y, size, S.playing ? COL.primary : COL.stroke);
  if (S.pending) text("NEXT BAR", x + size + textW(st, size) + 6, y, size, COL.primary, true);
}

function meterBar(x, y, w, h, v, label) {
  rect(x, y, w, h, COL.inactive, false);
  var db = v > 0 ? 20 * Math.log(v) / Math.LN10 : -60, f = Math.max(0, Math.min(1, (db + 48) / 48));
  rect(x + 1, y + h - 1 - f * (h - 2), w - 2, f * (h - 2), COL.primary, true);
  if (db > -0.5) rect(x - 1, y - 5, w + 2, 3, COL.primary, true); // clip marker (shape, not colour)
  if (label) textC(label, x + w / 2, y + h + 9, 6, COL.stroke);
}

// ---------- left: logo, tabs, style, status ----------
function paintLeft(g) {
  drawLogo(14, 34, 26);
  text("MULTI-KICK", 15, 48, 7, COL.stroke);
  var tabs = ["SEQUENCE", "SOUND", "LANES"];
  for (var i = 0; i < 3; i++) toggle(14, 58 + i * 21, 128, 18, tabs[i], g.activeView === tabs[i], { kind: "view", v: tabs[i] }, 7.5);
  text("STYLE", 14, 136, 6.5, COL.stroke);
  text(g.style, 44, 136, 7.5, COL.primary, true);
  line(14, 139, 142, 139, COL.inactive);
  hit({ x: 12, y: 126, w: 132, h: 15, kind: "stylecycle" });
  status(14, 156, 7);
}

// ---------- right: HUM knob, actions, meters ----------
function paintRight(g) {
  // HUM — the long humming sub under the kick (PUNCH's own knob, D8; GENERATE never moves it)
  var hv = S.tracks[0].params.hum, hx = RX;
  rect(hx, 8, 84, 153, COL.primary, false, 1.2);
  text("HUM", hx + 8, 22, 10, COL.primary, true);
  text("SUB", hx + 50, 22, 6.5, COL.stroke);
  drawNode(hx + 2, 26, 80, 112, "hum", "LONG SUB", hv, valueText(0, "hum", hv), { kind: "hum" }, false, 0, 22);
  var hz = expMap(vmap(0).tuneHz, S.tracks[0].params.tune);
  textC("@ " + fmtHz(hz) + "Hz", hx + 42, 150, 7, COL.stroke);
  // actions
  var ax = RX + 92, aw = 120;
  rect(ax, 8, aw, 28, COL.primary, false, 1.5); dice(ax + 8, 14, 15); text("GENERATE", ax + 30, 26, 9, COL.primary, true);
  hit({ x: ax, y: 8, w: aw, h: 28, kind: "cmd", cmd: "generate" });
  button(ax, 40, aw, 24, "MUTATE PERC", "mutate", 8.5, true);
  amountBar(ax, 74, aw);
  button(ax, 90, 58, 16, "KEEP", "keep", 7);
  button(ax + 62, 90, 58, 16, "UNDO", "undo", 7, false, S.canUndo);
  text("KICK / SUB", ax, 122, 6.5, COL.stroke);
  var modes = ["HYBRID", "ALTERNATE", "LAYER"], short = ["HYB", "ALT", "LAY"];
  for (var m = 0; m < 3; m++) toggle(ax + m * 41, 127, 38, 15, short[m], g.kickInteraction === modes[m], { kind: "interaction", v: modes[m] }, 6.5);
  // meters (measured)
  meterBar(RX + 222, 14, 9, 126, G ? +G.kick || 0 : 0, "KICK");
  meterBar(RX + 240, 14, 9, 126, G ? +G.meter || 0 : 0, "OUT");
}

function amountBar(x, y, w) {
  text("AMOUNT", x, y + 7, 6.5, COL.stroke);
  var bx = x + 38, bw = w - 38 - 24;
  rect(bx, y, bw, 8, COL.inactive, false);
  rect(bx + 1, y + 1, Math.max(0, (bw - 2) * S.global.mutationAmount), 6, COL.primary, true);
  text(pct(S.global.mutationAmount), bx + bw + 3, y + 7, 7, COL.primary, true);
  hit({ x: x, y: y - 3, w: w, h: 14, kind: "amount", bx: bx, bw: bw });
}

function voiceRow(g) { // voice selector (SOUND / LANES)
  for (var v = 0; v < 6; v++) toggle(MX + v * 54, 6, 50, 16, NAMES[v], g.selectedTrack === v, { kind: "track", t: v }, 7);
}
function stepLabel(g) { return NAMES[g.selectedTrack] + " / " + (g.selectedStep >= 0 ? "STEP " + pad2(g.selectedStep + 1) : "BASE"); }

// ---------- SEQUENCE ----------
function cellX(i) { return SGX + i * (SCELL + SGAP); }
function rowY(t) { return SGY + t * SROW; }
function paintSequence(g) {
  var anyLong = false, t, i;
  for (t = 0; t < 6; t++) if (S.tracks[t].length > 16) anyLong = true;
  var off = anyLong ? g.selectedPage * 16 : 0;
  for (t = 0; t < 6; t++) {
    var tr = S.tracks[t], y = rowY(t), sel = t === g.selectedTrack;
    if (sel) rect(MX, y - 2, 94, SCELL + 4, COL.primary, false, 1.2);
    text(NAMES[t], MX + 6, y + 14, 8, sel ? COL.primary : COL.stroke, sel);
    hit({ x: MX, y: y - 2, w: 56, h: SCELL + 4, kind: "track", t: t });
    toggle(MX + 58, y + 2, 16, 16, "M", tr.mute, { kind: "mute", t: t, v: tr.mute ? 0 : 1 }, 7);
    var held = tr.locks.rhythm && tr.locks.sound;
    toggle(MX + 76, y + 2, 16, 16, "L", held, { kind: "hold", t: t, v: held ? 0 : 1 }, 7);
    for (i = 0; i < 16; i++) {
      var s = off + i, x = cellX(i), st = tr.steps[s];
      if (i % 4 === 0 && t === 0) line(x - 2, 6, x - 2, rowY(5) + SCELL + 4, COL.inactive, 1, 0.5);
      if (s >= tr.length) { line(x + 5, y + SCELL / 2, x + SCELL - 5, y + SCELL / 2, COL.inactive); continue; }
      var c = tr.mute ? COL.inactive : COL.primary;
      if (st.on) {
        if (st.probability < 1) { rect(x, y, SCELL, SCELL, c, false); rect(x + 5, y + 5, SCELL - 10, SCELL - 10, c, true); }
        else rect(x, y, SCELL, SCELL, c, true, 1, 0.35 + 0.65 * st.velocity);
        if (st.open) circle(x + SCELL / 2, y + SCELL / 2, 4.5, COL.bg, 1, 1.6);          // open hat: ring
        var nr = Math.min(st.ratchet, 6);
        for (var r = 1; r < nr; r++) line(x + r * SCELL / nr, y + 2, x + r * SCELL / nr, y + 6, COL.bg, 1.3);
      } else rect(x, y, SCELL, SCELL, COL.inactive, false);
      var lk = false;
      for (var k in st.pLocks) if (st.pLocks.hasOwnProperty(k)) lk = true;
      if (lk && st.on) dot(x + SCELL - 3, y + SCELL - 3, 1.6, COL.bg);
      if (sel && g.selectedStep === s) rect(x - 2, y - 2, SCELL + 4, SCELL + 4, COL.primary, false, 1.3);
      if (phPos[t] === s) line(x, y + SCELL + 2, x + SCELL, y + SCELL + 2, COL.stroke, 1.5);
      hit({ x: x, y: y, w: SCELL, h: SCELL, kind: "step", t: t, s: s });
    }
  }
  // contextual strip: selected voice / step
  var tr2 = S.tracks[g.selectedTrack];
  line(CX - 10, 12, CX - 10, H0 - 12, COL.inactive);
  text(stepLabel(g), CX, 20, 9, COL.primary, true);
  if (tr2.soundName) text(tr2.soundName, CX, 32, 6.5, COL.stroke);
  if (anyLong) { toggle(CX + 222, 8, 30, 16, "1-16", g.selectedPage === 0, { kind: "page", v: 0 }, 6); toggle(CX + 254, 8, 30, 16, "17-32", g.selectedPage === 1, { kind: "page", v: 1 }, 6); }
  if (g.selectedStep >= 0) {
    button(CX + 170, 8, 46, 16, "BASE", "exitstep", 7);
    var st2 = tr2.steps[g.selectedStep];
    numRow(CX, 54, "VELOCITY", pct(st2.velocity), "vel");
    if (g.selectedTrack !== 0) {
      numRow(CX, 76, "PROBABILITY", pct(st2.probability), "prob");
      numRow(CX, 98, "RATCHET", "x" + st2.ratchet, "rat");
    }
    if (g.selectedTrack === 5) toggle(CX, 110, 110, 16, st2.open ? "OPEN HAT" : "CLOSED HAT", st2.open, { kind: "open", v: st2.open ? 0 : 1 }, 7);
    var any = false;
    for (var q in st2.pLocks) if (st2.pLocks.hasOwnProperty(q)) any = true;
    if (any) button(CX + 120, 110, 110, 16, "CLEAR P-LOCKS", "clearsteplocks", 7);
    text("SOUND tab = this step's own sound (P-Lock)", CX, 146, 6.5, COL.stroke);
  } else if (g.selectedTrack === 0) {
    text("LENGTH 16 · RATE 1:1 (fixed)", CX, 54, 8, COL.primary, true);
    text("sample-accurate: same sound on every hit,", CX, 72, 7, COL.stroke);
    text("exactly on the beat. Shape it on SOUND.", CX, 84, 7, COL.stroke);
    text("MUTATE PERC never changes the kick.", CX, 96, 7, COL.stroke);
    text("HUM (right) = long humming sub under it.", CX, 112, 7, COL.stroke);
  } else {
    numRow(CX, 54, "LENGTH", String(tr2.length), "len");
    numRow(CX, 76, "RATE / POLY", tr2.division.n + ":" + tr2.division.m, "div");
    text("drag values up/down", CX, 100, 6.5, COL.stroke);
    text("option-click a step = edit that step", CX, 112, 6.5, COL.stroke);
  }
}

function numRow(x, y, label, value, which) {
  text(label, x, y, 7, COL.stroke);
  text(value, x + 84, y, 10, COL.primary, true);
  line(x, y + 4, x + 160, y + 4, COL.inactive, 1, 0.6);
  hit({ x: x, y: y - 14, w: 170, h: 20, kind: "num", which: which });
}

// ---------- SOUND (interactive graphs) ----------
// Every graph is computed by the voice model from the current values, and its handles
// ARE the parameters: drag a handle and the matching parameter (and the sound) changes.
var preview = { key: "" }, PREV_SR = 22050, PREVIEW_MIN_MS = 90;
function srFor(t) { return t === 5 ? 44100 : 22050; } // HAT: full band for its spectrum
var WAVE = { x: MX, y: 28, w: 252, h: 134 }, GRAPH = { x: MX + 258, y: 28, w: 252, h: 134 };
var NODES = { x: MX + 518, y: 26, w: MR - MX - 518 };
var PITCH_MS = 200, PITCH_FMIN = 30, PITCH_FMAX = 800, PX0 = 30;

function effectiveParams(g) {
  var tr = S.tracks[g.selectedTrack], stp = (g.selectedStep >= 0 && g.selectedTrack !== 0) ? tr.steps[g.selectedStep] : null, p = { amp: 0.9 };
  var keys = PARAMS[g.selectedTrack];
  for (var i = 0; i < keys.length; i++) p[keys[i]] = effOf(tr, stp, keys[i]);
  if (stp && stp.open) p.isOpen = 1;
  return p;
}
function previewFor(g, force) {
  PREV_SR = srFor(g.selectedTrack);
  var p = effectiveParams(g), t = g.selectedTrack, key = t + JSON.stringify(p) + (t === 2 ? JSON.stringify(S.tracks[0].params) : "");
  if (preview.key === key) return preview;
  var now = new Date().getTime();
  if (!force && preview.data && now - preview.at < PREVIEW_MIN_MS) { dirty = true; return preview; }
  PREV_SR = srFor(t);
  var h = t === 2 ? koreModelRumble(KORE_DSP_MAP, effectiveFor(0), p, PREV_SR, 1400) : koreModelHit(KORE_DSP_MAP, NAMES[t], p, PREV_SR, 1400, 3);
  preview = { key: key, data: h, spec: koreModelSpectrum(h.L, PREV_SR, 0, 2048, 48), p: p, at: now };
  return preview;
}
function effectiveFor(t) { var tr = S.tracks[t], p = { amp: 0.9 }; for (var k in tr.params) p[k] = tr.params[k]; return p; }

// axes
function tLog(ms, w) { return w * Math.log(1 + ms / 3) / Math.log(1 + 1400 / 3); }
function tLogInv(px, w) { return 3 * (Math.exp(px / w * Math.log(1 + 1400 / 3)) - 1); }
function fyPitch(f) { var G = GRAPH; return G.y + G.h - 12 - (Math.log(Math.max(PITCH_FMIN, f) / PITCH_FMIN) / Math.log(PITCH_FMAX / PITCH_FMIN)) * (G.h - 28); }
function fyPitchInv(y) { var G = GRAPH; return PITCH_FMIN * Math.pow(PITCH_FMAX / PITCH_FMIN, (G.y + G.h - 12 - y) / (G.h - 28)); }
function txPitch(ms) { return GRAPH.x + PX0 + ms / PITCH_MS * (GRAPH.w - PX0 - 8); }
function txPitchInv(x) { return (x - GRAPH.x - PX0) / (GRAPH.w - PX0 - 8) * PITCH_MS; }
function fxSpec(f) { return GRAPH.x + 6 + Math.log(Math.max(20, f) / 20) / Math.log(PREV_SR / 2 / 20) * (GRAPH.w - 12); }
function fxSpecInv(x) { return 20 * Math.pow(PREV_SR / 2 / 20, (x - GRAPH.x - 6) / (GRAPH.w - 12)); }
function invExp(r, val) { return Math.max(0, Math.min(1, Math.log(Math.max(r[0], Math.min(r[1], val)) / r[0]) / Math.log(r[1] / r[0]))); }
function invLin(r, val) { return Math.max(0, Math.min(1, (val - r[0]) / (r[1] - r[0]))); }

// handle: small filled square + label; drag maps the mouse to one parameter
function handle(x, y, label, key, fn, axis) {
  var box = x >= GRAPH.x ? GRAPH : WAVE, fs = 6.5;
  x = Math.max(box.x + 7, Math.min(box.x + box.w - 7, x)); y = Math.max(box.y + 16, Math.min(box.y + box.h - 8, y));
  var lw = textW(label, fs, true), lx = x + 8;
  if (lx + lw > box.x + box.w - 2) lx = x - 8 - lw;
  rect(x - 7, y - 7, 14, 14, COL.bg, true);          // dark halo: visible over white bars
  rect(x - 4, y - 4, 8, 8, COL.primary, true);
  rect(x - 6, y - 6, 12, 12, COL.primary, false, 1, 0.8);
  rect(lx - 1, y - 14, lw + 2, 9, COL.bg, true, 1, 0.7);
  text(label, lx, y - 7, fs, COL.primary, true);
  hit({ x: x - 9, y: y - 9, w: 18, h: 18, kind: "handle", key: key, fn: fn, axis: axis });
}

function paintSound(g) {
  voiceRow(g);
  var t = g.selectedTrack, pv = previewFor(g), info = pv.data.info, m = vmap(t), p = pv.p;
  var stepMode = g.selectedStep >= 0 && t !== 0;
  text((stepMode ? NAMES[t] + " / STEP " + pad2(g.selectedStep + 1) : NAMES[t] + " / BASE") + "  " + (S.tracks[t].soundName || ""), MX + 330, 18, 8, COL.primary, true);
  if (stepMode) button(MR - 50, 6, 46, 16, "BASE", "exitstep", 7);
  // ---- left: amplitude / waveform (log time 0..1.4 s)
  panel(WAVE.x, WAVE.y, WAVE.w, WAVE.h, t === 2 ? "RUMBLE TAIL" : "WAVEFORM");
  drawWave(pv.data.L, WAVE.x, WAVE.y, WAVE.w, WAVE.h);
  var X0 = WAVE.x + 2, W = WAVE.w - 4, top = WAVE.y + 22;
  if (t === 0) {
    var holdEnd = 0.2 + info.holdMs, decEnd = holdEnd + info.decayMs;
    handle(X0 + tLog(holdEnd, W), top, "BODY " + fmtMs(info.holdMs), "body", function (x) { return invLin(m.holdMs, tLogInv(x - X0, W) - 0.2); }, "x");
    handle(X0 + tLog(decEnd, W), WAVE.y + WAVE.h / 2, "DECAY " + fmtMs(info.decayMs), "decay", function (x) { return invExp(m.decayMs, tLogInv(x - X0, W) - 0.2 - info.holdMs); }, "x");
  } else if (t === 2) {
    handle(X0 + tLog(info.tailMs, W), top, "TAIL " + fmtMs(info.tailMs), "tail", function (x) { return invExp(m.tailMs, tLogInv(x - X0, W)); }, "x");
    handle(X0 + tLog(40, W), WAVE.y + WAVE.h / 2 - p.amount * (WAVE.h / 2 - 16), "AMOUNT " + pct(p.amount), "amount", function (x, y) { return invLin([0, 1], (WAVE.y + WAVE.h / 2 - y) / (WAVE.h / 2 - 16)); }, "y");
  } else {
    handle(X0 + tLog(info.decayMs, W), WAVE.y + WAVE.h / 2, "DECAY " + fmtMs(info.decayMs), "decay", function (x) {
      var ms = tLogInv(x - X0, W);
      if (t === 5 && p.isOpen) ms = ms / info.openFactor;
      return invExp(m.decayMs, ms);
    }, "x");
  }
  // ---- middle: pitch vs time (tonal voices) or spectrum (HAT, RUMBLE)
  if (t === 5 || t === 2) {
    panel(GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h, "SPECTRUM");
    drawSpectrum(pv.spec, GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h);
    var fc = t === 5 ? info.toneHz : info.lowpassHz, hy = t === 5 ? GRAPH.y + GRAPH.h - 16 - p.reso * (GRAPH.h - 40) : GRAPH.y + 34;
    line(fxSpec(fc), GRAPH.y + 16, fxSpec(fc), GRAPH.y + GRAPH.h - 6, COL.primary, 1, 0.5);
    var fr = t === 5 ? m.toneHz : m.lowpassHz;
    handle(fxSpec(fc), hy, (t === 5 ? "HP " : "LP ") + fmtHz(fc) + "Hz" + (t === 5 ? " RESO " + pct(p.reso) : ""), "tone",
      function (x, y) { return invExp(fr, fxSpecInv(x)); }, "x");
    if (t === 5) { // the same handle also sets RESO vertically
      var hh2 = hits[hits.length - 1];
      hh2.key2 = "reso"; hh2.fn2 = function (x, y) { return invLin([0, 1], (GRAPH.y + GRAPH.h - 16 - y) / (GRAPH.h - 40)); };
    }
  } else {
    panel(GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h, "PITCH vs TIME");
    drawPitch(pv.data.pitch);
    var startKey = t === 0 ? "punch" : "sweep", sr = t === 0 ? m.sweepSemis : m.sweepSemisRange;
    handle(txPitch(0), fyPitch(info.startHz), (t === 0 ? "PUNCH " : "GLIDE ") + "+" + Math.round(info.sweepSemis) + "st", startKey,
      function (x, y) { return invLin(sr, 12 * Math.log(fyPitchInv(y) / info.tuneHz) / Math.LN2); }, "y");
    if (t === 0) {
      var fTau = info.tuneHz * Math.pow(2, info.sweepSemis / 12 * Math.exp(-1));
      handle(txPitch(info.sweepMs), fyPitch(fTau), "TIME " + fmtMs(info.sweepMs), "time", function (x) { return invExp(m.sweepTauMs, txPitchInv(x)); }, "x");
    }
    handle(GRAPH.x + GRAPH.w - 24, fyPitch(info.tuneHz), "TUNE " + fmtHz(info.tuneHz) + "Hz", "tune", function (x, y) { return invExp(m.tuneHz, fyPitchInv(y)); }, "y");
  }
  // ---- right of the graphs: every parameter of the voice + level (2 rows)
  drawVoiceNodes(g, NODES.x, NODES.y, NODES.w);
}

function nodeLayout(n, w) { var perRow = Math.ceil(n / 2); return { perRow: perRow, nw: Math.min(66, w / perRow) }; }
function drawVoiceNodes(g, x, y, w) {
  var t = g.selectedTrack, tr = S.tracks[t], stp = (g.selectedStep >= 0 && t !== 0) ? tr.steps[g.selectedStep] : null;
  var keys = PARAMS[t], L = nodeLayout(keys.length + 1, w), i;
  for (i = 0; i <= keys.length; i++) {
    var nx = x + (i % L.perRow) * L.nw, ny = y + Math.floor(i / L.perRow) * 68;
    if (i < keys.length) {
      var v = effOf(tr, stp, keys[i]);
      drawNode(nx, ny, L.nw - 4, 66, keys[i], LABEL[keys[i]], v, valueText(t, keys[i], v), { kind: "param", key: keys[i] }, hasLock(stp, keys[i]), t, 11);
    } else {
      var lv = levelToV(tr.levelDb);
      drawNode(nx, ny, L.nw - 4, 66, "level", "LEVEL", lv, valueText(t, "level", lv), { kind: "level" }, false, t, 11);
    }
  }
}

function panel(x, y, w, h, label) {
  rect(x, y, w, h, COL.stroke, false, 1, 0.6);
  text(label, x + 6, y + 11, 6.5, COL.stroke, true);
}
function drawWave(sig, x, y, w, h) {
  var mid = y + h / 2, cols = Math.floor(w - 4), pk = [], i, c;
  for (c = 0; c < cols; c++) pk.push(-1);
  for (i = 0; i < sig.length; i++) { c = Math.min(cols - 1, Math.floor(tLog(i / PREV_SR * 1000, cols))); pk[c] = Math.max(pk[c], Math.abs(sig[i])); }
  var last = 0, end = Math.min(cols - 1, Math.floor(tLog(sig.length / PREV_SR * 1000, cols)));
  line(x + 2, mid, x + w - 2, mid, COL.inactive);
  col(COL.primary);
  for (c = 0; c <= end; c++) {
    if (pk[c] < 0) pk[c] = last; last = pk[c];
    var hh = Math.min(1, pk[c]) * (h / 2 - 16);
    if (hh > 0.3) mgraphics.rectangle(x + 2 + c, mid - hh, 1, 2 * hh);
  }
  mgraphics.fill();
  var ticks = [[10, "10ms"], [100, "100ms"], [1000, "1s"]];
  for (var k = 0; k < ticks.length; k++) { var px = x + 2 + tLog(ticks[k][0], cols); line(px, y + h - 5, px, y + h, COL.stroke); text(ticks[k][1], px + 2, y + h - 2, 6, COL.stroke); }
}
function drawPitch(pitch) {
  var G = GRAPH, marks = [40, 60, 100, 200, 400];
  for (var m = 0; m < marks.length; m++) { line(G.x + PX0, fyPitch(marks[m]), G.x + G.w - 6, fyPitch(marks[m]), COL.inactive, 1, 0.7); text(String(marks[m]), G.x + 6, fyPitch(marks[m]) + 3, 6, COL.stroke); }
  col(COL.primary); mgraphics.set_line_width(1.4);
  var cols = G.w - PX0 - 8;
  for (var c = 0; c <= cols; c++) {
    var idx = Math.min(pitch.length - 1, Math.floor(c / cols * PITCH_MS / 1000 * PREV_SR));
    var px = G.x + PX0 + c, py = fyPitch(pitch[idx] || PITCH_FMIN);
    if (c === 0) mgraphics.move_to(px, py); else mgraphics.line_to(px, py);
  }
  mgraphics.stroke();
  text("0", G.x + PX0, G.y + G.h - 2, 6, COL.stroke); text("100ms", G.x + PX0 + cols / 2 - 10, G.y + G.h - 2, 6, COL.stroke); text("200ms", G.x + G.w - 30, G.y + G.h - 2, 6, COL.stroke);
}
function drawSpectrum(b, x, y, w, h) {
  var mx = 1e-12, i, n = b.length, bw = (w - 12) / n;
  for (i = 0; i < n; i++) mx = Math.max(mx, b[i]);
  col(COL.primary);
  for (i = 0; i < n; i++) {
    var db = 10 * Math.log(b[i] / mx + 1e-12) / Math.LN10, hh = Math.max(0, 1 + db / 60) * (h - 24);
    if (hh > 0.5) mgraphics.rectangle(x + 6 + i * bw, y + h - 7 - hh, Math.max(1, bw - 1), hh);
  }
  mgraphics.fill();
  var fm = [100, 1000, 10000];
  for (var k = 0; k < fm.length; k++) text(fm[k] >= 1000 ? fm[k] / 1000 + "k" : String(fm[k]), fxSpec(fm[k]) - 5, y + h - 1, 6, COL.stroke);
}

// ---------- LANES ----------
function laneY(v) { return LTOP + LH - 1 - v * (LH - 2); }
function paintLanes(g) {
  voiceRow(g);
  var t = g.selectedTrack, tr = S.tracks[t], keys = PARAMS[t];
  if (t === 0) {
    text("PUNCH has no per-step values: one steady kick sound on every hit, exactly on the beat.", MX, 60, 10, COL.primary, true);
    text("Shape it on SOUND. Choose another voice to draw per-step values.", MX, 80, 8, COL.stroke);
    return;
  }
  for (var i = 0; i < keys.length; i++) toggle(MX + 330 + i * 62, 6, 58, 16, LABEL[keys[i]], laneKey === keys[i], { kind: "lanekey", key: keys[i] }, 6.5);
  var anyLong = tr.length > 16, off = anyLong ? g.selectedPage * 16 : 0;
  if (anyLong) { toggle(MR - 66, 6, 30, 16, "1-16", g.selectedPage === 0, { kind: "page", v: 0 }, 6); toggle(MR - 32, 6, 30, 16, "17-32", g.selectedPage === 1, { kind: "page", v: 1 }, 6); }
  var base = tr.params[laneKey], rd = drag && drag.kind === "lane" ? drag.last : -1;
  text(rd >= 0 ? "STEP " + pad2(rd + 1) + "  " + valueText(t, laneKey, effOf(tr, tr.steps[rd], laneKey))
    : LABEL[laneKey] + " per step · draw with the mouse · option-click = back to the voice value (dashed)", MX + 2, 31, 6.5, rd >= 0 ? COL.primary : COL.stroke, rd >= 0);
  for (var c = 0; c < 16; c++) {
    var s = off + c, x = LX + c * LCOL, w = LCOL - 8;
    if (s >= tr.length) { line(x + 6, LTOP + LH / 2, x + w - 6, LTOP + LH / 2, COL.inactive); continue; }
    var st = tr.steps[s], lk = hasLock(st, laneKey), v = effOf(tr, st, laneKey), a = st.on ? 1 : 0.35;
    rect(x, LTOP, w, LH, COL.inactive, false, 1, a);
    var y1 = laneY(v), bh = Math.max(1, LTOP + LH - 1 - y1);
    if (lk) rect(x + 1, y1, w - 2, bh, COL.primary, true, 1, a); else rect(x + 1, y1, w - 2, bh, COL.stroke, false, 1, a * 0.6);
    var by = laneY(base);
    for (var dx = 0; dx < w; dx += 6) line(x + dx, by, x + Math.min(w, dx + 3), by, COL.primary, 1, 0.6);
    if (st.on) rect(x + w / 2 - 4, LTOP + LH + 6, 8, 8, COL.primary, true); else rect(x + w / 2 - 4, LTOP + LH + 6, 8, 8, COL.inactive, false);
    if (phPos[t] === s) line(x, LTOP + LH + 18, x + w, LTOP + LH + 18, COL.stroke, 1.5);
    hit({ x: x, y: LTOP, w: LCOL, h: LH, kind: "lanecol", s: s });
  }
}

// ---------- node glyphs (one visual idea per parameter) ----------
function glyph(key, v, cx, cy, r) {
  var i;
  col(COL.primary); mgraphics.set_line_width(1);
  if (key === "tune") { var lobes = Math.round(2 + v * 10); path(cx, cy, function (a) { return r * (1 - 0.12 * (0.5 + 0.5 * Math.sin(lobes * a))); }); }
  else if (key === "punch") { // pitch drop: a steep curve from top-left
    circle(cx, cy, r, COL.primary, 0.3);
    col(COL.primary); mgraphics.set_line_width(1.4);
    for (i = 0; i <= 30; i++) { var tt = i / 30, yy = cy + r * 0.6 - (r * 1.2) * Math.exp(-tt * (2 + 10 * v)); if (i === 0) mgraphics.move_to(cx - r * 0.7 + tt * r * 1.4, yy); else mgraphics.line_to(cx - r * 0.7 + tt * r * 1.4, yy); }
    mgraphics.stroke();
  } else if (key === "decay" || key === "tail") { // longer = longer arc
    var end = Math.max(0.12, v);
    for (i = 0; i <= 60; i++) { var a = -Math.PI / 2 + i / 60 * end * Math.PI * 2; if (i === 0) mgraphics.move_to(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else mgraphics.line_to(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    mgraphics.stroke(); dot(cx, cy - r, 2.5, COL.primary);
  } else if (key === "drive") { var e = 2 + v * 8; path(cx, cy, function (a) { var c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return r * 0.86 / Math.pow(Math.pow(c, e) + Math.pow(s, e), 1 / e); }); }
  else if (key === "click") { circle(cx, cy, r, COL.primary, 0.3); var spikes = 2 + Math.round(v * 10); for (i = 0; i < spikes; i++) { var an = i / spikes * Math.PI * 2; line(cx + Math.cos(an) * r * 0.3, cy + Math.sin(an) * r * 0.3, cx + Math.cos(an) * r * (0.3 + 0.7 * v), cy + Math.sin(an) * r * (0.3 + 0.7 * v), COL.primary, 1.2); } }
  else if (key === "tone") { var rings = 1 + Math.round(v * 4); for (i = 0; i < rings; i++) circle(cx, cy, r - i * 3, COL.primary, 1 - i * 0.18); }
  else if (key === "amount") { circle(cx, cy, r, COL.primary, 0.3); circle(cx, cy, Math.max(2, r * v), COL.primary, 1, 2); }
  else if (key === "duck") { circle(cx, cy, r, COL.primary, 0.3); var dip = v * r * 0.8; col(COL.primary); mgraphics.move_to(cx - r * 0.8, cy - r * 0.3); mgraphics.line_to(cx - r * 0.2, cy - r * 0.3 + dip); mgraphics.line_to(cx + r * 0.8, cy - r * 0.3); mgraphics.stroke(); }
  else if (key === "level") circle(cx, cy, r * (0.25 + 0.75 * v), COL.primary, 1);
  else if (key === "hum") { // long low sine whose height is the HUM level
    circle(cx, cy, r, COL.primary, 0.3);
    col(COL.primary); mgraphics.set_line_width(1.6);
    for (i = 0; i <= 48; i++) { var hx = cx - r * 0.8 + i / 48 * r * 1.6, hy = cy - Math.sin(i / 48 * Math.PI * 3) * r * 0.65 * v; if (i === 0) mgraphics.move_to(hx, hy); else mgraphics.line_to(hx, hy); }
    mgraphics.stroke();
  }
  else if (key === "time") { // glide time: the knee of the pitch curve moves right
    circle(cx, cy, r, COL.primary, 0.3);
    col(COL.primary); mgraphics.set_line_width(1.4);
    for (i = 0; i <= 30; i++) { var t2 = i / 30, y2 = cy + r * 0.6 - r * 1.2 * Math.exp(-t2 / (0.05 + 0.5 * v)); if (i === 0) mgraphics.move_to(cx - r * 0.7 + t2 * r * 1.4, y2); else mgraphics.line_to(cx - r * 0.7 + t2 * r * 1.4, y2); }
    mgraphics.stroke();
  } else if (key === "body") { // hold before the decay: a flat top that grows
    circle(cx, cy, r, COL.primary, 0.3);
    var hx = cx - r * 0.7 + r * 1.0 * v;
    col(COL.primary); mgraphics.set_line_width(1.4);
    mgraphics.move_to(cx - r * 0.7, cy + r * 0.5); mgraphics.line_to(cx - r * 0.7, cy - r * 0.5); mgraphics.line_to(hx, cy - r * 0.5); mgraphics.line_to(cx + r * 0.75, cy + r * 0.5);
    mgraphics.stroke();
  } else if (key === "clicktone" || key === "snap") { // brightness / amount of the transient: denser ticks
    circle(cx, cy, r, COL.primary, 0.3);
    var nT = 3 + Math.round(v * 12);
    for (i = 0; i < nT; i++) line(cx - r * 0.7 + i * (r * 1.4) / nT, cy - r * 0.35 * (key === "snap" ? (0.3 + v) : 1), cx - r * 0.7 + i * (r * 1.4) / nT, cy + r * 0.35 * (key === "snap" ? (0.3 + v) : 1), COL.primary, 1.2);
  } else if (key === "sweep") glyph("punch", v, cx, cy, r);
  else if (key === "reso") { var rn = 1 + Math.round(v * 5); for (i = 0; i < rn; i++) circle(cx, cy, r * (1 - i * 0.16), COL.primary, 1 - i * 0.12); }
  else if (key === "open") { // open hat length: a longer second arc
    circle(cx, cy, r * 0.45, COL.primary, 1);
    col(COL.primary);
    for (i = 0; i <= 40; i++) { var an2 = -Math.PI / 2 + i / 40 * (0.2 + 0.8 * v) * Math.PI * 2; if (i === 0) mgraphics.move_to(cx + Math.cos(an2) * r, cy + Math.sin(an2) * r); else mgraphics.line_to(cx + Math.cos(an2) * r, cy + Math.sin(an2) * r); }
    mgraphics.stroke();
  }
}
function path(cx, cy, fn) {
  for (var i = 0; i <= 120; i++) { var a = i / 120 * Math.PI * 2, rr = fn(a); if (i === 0) mgraphics.move_to(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else mgraphics.line_to(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  mgraphics.stroke();
}
function drawNode(x, y, w, h, key, label, v, vtext, target, locked, t, r) {
  var cx = x + w / 2, cy = y + r + 8, fs = r > 25 ? 11 : 7.5;
  glyph(key, v, cx, cy, r);
  textC(label, cx, cy + r + fs + 6, fs - 1, COL.stroke);
  textC(vtext, cx, cy + r + 2 * fs + 8, fs + 1, COL.primary, true);
  if (locked) rect(x + 4, y + 2, 6, 6, COL.primary, true);
  target.x = x; target.y = y; target.w = w; target.h = h; target.v = v;
  hit(target);
}

// ---------- interaction ----------
function find(x, y) { for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }
function findLane(x) { for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (h.kind === "lanecol" && x >= h.x && x < h.x + h.w) return h.s; } return -1; }
function laneValue(y) { return Math.round(Math.max(0, Math.min(1, (LTOP + LH - 1 - y) / (LH - 2))) * 1000) / 1000; }

function onclick(x, y, but, cmd, shift, capslock, option, ctrl) {
  if (!S) return;
  x /= scaleF; y /= scaleF;
  var h = find(x, y);
  if (!h) return;
  var g = S.global, tr = S.tracks[g.selectedTrack];
  if (h.kind === "step") {
    if (option) { if (g.selectedTrack !== h.t) outlet(0, "select", h.t); outlet(0, "selstep", (g.selectedStep === h.s && g.selectedTrack === h.t) ? -1 : h.s); }
    else outlet(0, "toggle", h.t, h.s);
  } else if (h.kind === "track") outlet(0, "select", h.t);
  else if (h.kind === "mute") outlet(0, "mute", h.t, h.v);
  else if (h.kind === "hold") outlet(0, "hold", h.t, h.v);
  else if (h.kind === "page") outlet(0, "page", h.v);
  else if (h.kind === "view") outlet(0, "view", h.v);
  else if (h.kind === "stylecycle") outlet(0, "style", STYLES[(STYLES.indexOf(g.style) + 1) % 4]);
  else if (h.kind === "interaction") outlet(0, "interaction", h.v);
  else if (h.kind === "open") outlet(0, "stepset", g.selectedTrack, g.selectedStep, "open", h.v);
  else if (h.kind === "lanekey") { laneKey = h.key; dirty = true; }
  else if (h.kind === "cmd") { if (h.cmd === "exitstep") outlet(0, "selstep", -1); else outlet(0, h.cmd); }
  else if (h.kind === "amount") { outlet(0, "amount", Math.max(0, Math.min(1, (x - h.bx) / h.bw))); drag = { kind: "amount", h: h }; }
  else if (h.kind === "lanecol") {
    if (option) { outlet(0, "clearlock", g.selectedTrack, h.s, laneKey); return; }
    outlet(0, "gesture", 1);
    drag = { kind: "lane", t: g.selectedTrack, last: h.s };
    outlet(0, "lane", g.selectedTrack, h.s, laneKey, laneValue(y));
  } else if (h.kind === "param" || h.kind === "level" || h.kind === "hum") { outlet(0, "gesture", 1); drag = { kind: "node", target: h, y0: y, v0: h.v }; }
  else if (h.kind === "handle") { outlet(0, "gesture", 1); drag = { kind: "handle", h: h }; }
  else if (h.kind === "num") {
    var st0 = g.selectedStep >= 0 ? tr.steps[g.selectedStep] : null;
    outlet(0, "gesture", 1);
    drag = { kind: "num", which: h.which, y0: y, t: g.selectedTrack, step: g.selectedStep, len0: tr.length, n0: tr.division.n, m0: tr.division.m,
      vel0: st0 ? st0.velocity : 0, prob0: st0 ? st0.probability : 0, rat0: st0 ? st0.ratchet : 1 };
  }
}

function ondrag(x, y, but, cmd, shift, capslock, option, ctrl) {
  if (!drag || !S) return;
  x /= scaleF; y /= scaleF;
  if (drag.kind === "amount") outlet(0, "amount", Math.max(0, Math.min(1, (x - drag.h.bx) / drag.h.bw)));
  else if (drag.kind === "handle") {
    var hv = drag.h.fn(x, y);
    if (isFinite(hv)) outlet(0, "param", drag.h.key, Math.round(hv * 1000) / 1000);
    if (drag.h.key2) { var v2 = drag.h.fn2(x, y); if (isFinite(v2)) outlet(0, "param", drag.h.key2, Math.round(v2 * 1000) / 1000); }
    dirty = true;
  } else if (drag.kind === "lane") {
    var s = findLane(x);
    if (s >= 0) { var v = laneValue(y), a = Math.min(s, drag.last), b = Math.max(s, drag.last); for (var k = a; k <= b; k++) outlet(0, "lane", drag.t, k, laneKey, v); drag.last = s; dirty = true; }
  } else if (drag.kind === "node") {
    var sens = shift ? 0.0007 : 0.007;
    var nv = Math.max(0, Math.min(1, drag.v0 + (drag.y0 - y) * sens));
    nv = Math.round(nv * 1000) / 1000;
    if (drag.target.kind === "param") outlet(0, "param", drag.target.key, nv);
    else if (drag.target.kind === "hum") outlet(0, "humlevel", nv);
    else outlet(0, "level", S.global.selectedTrack, vToLevel(nv));
    if (shift) { drag.v0 = nv; drag.y0 = y; }
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
  if (!but) { if (drag.kind === "node" || drag.kind === "num" || drag.kind === "lane" || drag.kind === "handle") outlet(0, "gesture", 0); drag = null; dirty = true; }
}

function ondblclick(x, y) {
  if (!S) return;
  x /= scaleF; y /= scaleF;
  var h = find(x, y);
  if (!h) return;
  var t = S.global.selectedTrack;
  if (h.kind === "param") outlet(0, "paramreset", h.key);
  else if (h.kind === "hum") outlet(0, "humreset");
  else if (h.kind === "level") outlet(0, "level", t, S.defaults.levelDb[t]);
  else if (h.kind === "lanecol") outlet(0, "clearlock", t, h.s, laneKey);
}

function onresize() { dirty = true; }
