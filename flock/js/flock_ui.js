// FLØCK — device panel for [jsui] (mgraphics, ES5). One light panel in Live's device strip (900×169).
// The knobs here are only a face: every value lives in a hidden live.dial / live.toggle (Live
// parameter: automation, Push, presets). Dragging sends "<name> <value>" to that parameter; the
// parameter sends "p <name> <value>" back here. Display data from the engine:
//   "tape <writePos 0..1> <activeGrains>"   "grain <startBehindHead 0..1> <speed>"
// ASCII text only; Ø drawn as geometry.

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;
inlets = 1;
outlets = 1;

var W0 = 900, H0 = 169;
var C = {
  bg: [0.925, 0.918, 0.890, 1],     // warm paper
  panel: [0.965, 0.960, 0.940, 1],
  ink: [0.106, 0.106, 0.102, 1],
  mid: [0.50, 0.49, 0.47, 1],
  line: [0.78, 0.765, 0.73, 1],
  accent: [0.17, 0.30, 0.61, 1],    // cobalt
  on: [0.17, 0.30, 0.61, 1]
};
// name, default, label, caption
var P = {
  time: { v: 0.15, d: 0.15 }, density: { v: 0.12, d: 0.12 }, pitch: { v: 0.5, d: 0.5 }, size: { v: 0.6, d: 0.6 }, shape: { v: 0.6, d: 0.6 },
  time_amt: { v: 0.75, d: 0.75 }, pitch_amt: { v: 0.5, d: 0.5 }, size_amt: { v: 0.5, d: 0.5 }, shape_amt: { v: 0.5, d: 0.5 },
  feedback: { v: 0.1, d: 0.1 }, drywet: { v: 0.7, d: 0.7 }, reverb: { v: 0.35, d: 0.35 }, agc: { v: 0, d: 0 },
  freeze: { v: 0, d: 0 }, seed: { v: 0, d: 0 }, seedlatch: { v: 1, d: 1 },
  input: { v: 0, d: 0, lo: -12, hi: 32 }, output: { v: 0, d: 0, lo: -24, hi: 12 },
  quality: { v: 0, d: 0, lo: 0, hi: 3, int: true }
};
// recording qualities (Beads MEDIA): name, help
var QUAL = [["PRISTINE", "PRISTINE: 48 kHz 16-bit, 4 s buffer, clean feedback, bright reverb"],
  ["COLD DIGITAL", "COLD DIGITAL: 32 kHz 12-bit, 8 s buffer, soft-clipped feedback, dark reverb"],
  ["SUNNY TAPE", "SUNNY TAPE: grains at half rate (24 kHz) 12-bit, 10.7 s buffer, warm saturated feedback"],
  ["SCORCHED", "SCORCHED CASSETTE: 24 kHz 8-bit mu-law, 16 s buffer, wow & flutter, hiss, crushed feedback"]];
// ---- MOD tab: sources, destinations (a destination takes one source, like a jack), modulators
var SRC = ["LFO 1", "LFO 2", "RANDOM", "ENV", "CLOCK", "SEQ"];
var SRC_LIGHT = [[0.17, 0.30, 0.61, 1], [0.13, 0.52, 0.50, 1], [0.76, 0.22, 0.38, 1], [0.84, 0.55, 0.13, 1], [0.35, 0.35, 0.33, 1], [0.45, 0.30, 0.62, 1]];
var SRC_DARK = [[0.36, 0.82, 0.84, 1], [0.55, 0.85, 0.45, 1], [0.95, 0.50, 0.66, 1], [0.98, 0.70, 0.30, 1], [0.75, 0.75, 0.75, 1], [0.70, 0.58, 0.95, 1]];
var SRC_COL = SRC_LIGHT.slice();
var DST = [["freeze", "Freeze"], ["seed", "Trigger"], ["time", "Time"], ["pitch", "Pitch"], ["size", "Size"], ["shape", "Shape"],
  ["density", "Density"], ["feedback", "Feedback"], ["reverb", "Reverb"], ["drywet", "Dry/Wet"]];
var DIVS = ["8 bars", "4 bars", "2 bars", "1 bar", "1/2", "1/4D", "1/2T", "1/4", "1/8D", "1/4T", "1/8", "1/8T", "1/16", "1/16T", "1/32"];
var SHAPES = ["sine", "tri", "saw", "square"];
(function () {
  var i, d = function (v, extra) { var o = { v: v, d: v }; if (extra) for (var k in extra) o[k] = extra[k]; return o; };
  for (i = 0; i < DST.length; i++) P["dst_" + DST[i][0]] = d(0, { lo: 0, hi: 6, int: 1 });
  P.fb_amt = d(1); P.dw_amt = d(1); P.rv_amt = d(1); P.dn_amt = d(0.5);
  P.l1_rate = d(0.4); P.l1_sync = d(0); P.l1_shape = d(0, { lo: 0, hi: 3, int: 1 }); P.l1_reset = d(0); P.l1_amt = d(1);
  P.l2_rate = d(0.25); P.l2_sync = d(0); P.l2_shape = d(1, { lo: 0, hi: 3, int: 1 }); P.l2_reset = d(0); P.l2_amt = d(1);
  P.rn_rate = d(0.4); P.rn_sync = d(0); P.rn_smooth = d(1); P.rn_amt = d(1);
  P.env_gain = d(0.5);
  P.ck_rate = d(0.857); P.ck_sync = d(1);
  P.sq_div = d(12, { lo: 0, hi: 14, int: 1 }); P.sq_len = d(16, { lo: 1, hi: 16, int: 1 });
  var SQ = [1, -1, -1, -1, 0.25, -1, -1, -1, 0.5, -1, 0.75, -1, 0.625, -1, -1, -1];
  for (i = 0; i < 16; i++) P["sq" + i] = d(SQ[i], { lo: -1, hi: 1 });
})();
var tab = "SOUND", maxCables = 3, seqPos = -1, running = 0;
// DICE: what it changes; MIDI keys (FLØCK Keys device): held notes, last one wins
var DICE_MODES = ["SOUND", "MOD", "ALL"], diceMode = 0;
var keyStack = [], keyNote = null, keyHeld = false;
function noteName(n) { var nm = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; return nm[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 2); }
// "note <pitch> <velocity>" from [receive flock_keys]: a key held = grains (like holding TRIGGER),
// the note transposes from C3; the first note turns AUTO GRAINS off so the keys are heard
function note(pitch, vel) {
  pitch = +pitch; vel = +vel;
  var i = keyStack.indexOf(pitch);
  if (i >= 0) keyStack.splice(i, 1);
  if (vel > 0) keyStack.push(pitch);
  if (keyStack.length) {
    if (P.seedlatch.v > 0.5) send("seedlatch", 0);
    keyNote = keyStack[keyStack.length - 1];
    outlet(0, "kon", 1); outlet(0, "knote", keyNote - 60); outlet(0, "ktrig", 1);
    keyHeld = true;
  } else { outlet(0, "ktrig", 0); keyHeld = false; }
  dirty = true;
}
var agcGain = 1, agcLearning = 0, learnCount = 0;
function agcinfo(g, l) { agcGain = +g; agcLearning = +l; dirty = true; }   // from the engine
function seq(stepIndex, run) { seqPos = +stepIndex; running = +run; dirty = true; }   // from the engine
// a sequencer step: value 0..1 when on; off = -(v + 0.01) / 1.01 (keeps the value while off)
function stepOn(i) { return P["sq" + i].v >= 0; }
function stepVal(i) { var v = P["sq" + i].v; return v >= 0 ? v : Math.max(0, -v * 1.01 - 0.01); }
function stepCode(on, v) { return on ? Math.round(v * 1000) / 1000 : Math.round(-(v + 0.01) / 1.01 * 1000) / 1000; }
var BIG = [["time", "TIME", "BUFFER POSITION"], ["density", "DENSITY", "GRAIN RATE"], ["pitch", "PITCH", "TRANSPOSE"],
  ["size", "SIZE", "GRAIN LENGTH"], ["shape", "SHAPE", "ENVELOPE"]];
var MIX = [["feedback", "FEEDBACK"], ["drywet", "DRY/WET"], ["reverb", "REVERB"]];
var KX = [204, 288, 372, 456, 540], KY = 58, KR = 23;
var hits = [], drag = null, dirty = true, scaleF = 1, hover = null;
var tapeSt = { w: 0, active: 0 }, grains = [];
var BUF_S = 192000 / 48000, HOST_SR = 48000;
// buffer length in seconds for the current quality (processor.h buffer sizes at the quality's rate)
function bufSeconds() {
  var q = Math.round(P.quality.v);
  var s = q === 1 ? 256000 / Math.min(32000, HOST_SR) : q === 2 ? 256000 / (HOST_SR / 2) : q === 3 ? 384000 / Math.min(24000, HOST_SR) : 192000 / HOST_SR;
  return Math.round(s * 10) / 10;
}
var now = function () { return new Date().getTime(); };
function sr(v) { if (v > 0) { HOST_SR = +v; BUF_S = Math.round(192000 / v * 100) / 100; dirty = true; } }   // from [dspstate~]

function p(name, v) { if (P[name]) { P[name].v = +v; dirty = true; } }
var engineMoved = -1;   // time the record head last moved (-1 = never)
function tape(w, a) {
  if (+w !== tapeSt.w) engineMoved = now();
  tapeSt.w = +w; tapeSt.active = +a; dirty = true;
}
// the record head always moves while the engine runs (unless FROZEN): if it does not,
// gen~ is not running (compile error → Max Console) or Live's audio engine is off
function engineStopped() { return P.freeze.v < 0.5 && (engineMoved < 0 || now() - engineMoved > 1500); }
function grain(pos, spd) { grains.push({ pos: +pos, spd: +spd, age: 0 }); if (grains.length > 40) grains.shift(); dirty = true; }

// Beads SEED gestures (manual "Latched"): a short press while latched turns LATCH off;
// holding SEED for 4 s turns LATCH on. (FREEZE+SEED needs two buttons at once — use LATCH.)
function checkHold() {
  if (drag && drag.kind === "momentary" && drag.name === "seed" && !drag.latched && P.seedlatch.v < 0.5 && now() - drag.t0 >= 4000) {
    drag.latched = true;
    send("seedlatch", 1);
  }
}
var frame = new Task(function () {
  checkHold();
  for (var i = grains.length - 1; i >= 0; i--) { grains[i].age += 1; if (grains[i].age > 24) grains.splice(i, 1); }
  if (dirty || grains.length || engineStopped()) { dirty = false; mgraphics.redraw(); }
}, this);
frame.interval = 40;
frame.repeat();
function notifydeleted() { frame.cancel(); }

// ---------- value texts (same laws as the engine) ----------
var NOTCH = [0, 1, 3, 4, 7, 12, 24, 24];
function sstep(x) { return x * x * (3 - 2 * x); }
function detune(k) {
  var d = 2 * k - 1, sg = d < 0 ? -1 : 1; d = d * sg * 6;
  var di = Math.floor(d), df = Math.max((d - di - 0.33333333) * 1.5, 0);
  var a = NOTCH[Math.min(7, di)], b = NOTCH[Math.min(7, di + 1)];
  return (a + (b - a) * sstep(df)) * sg;
}
function attenu(k) { var v = k - 0.5; return (2 / 0.47) * v * Math.max(Math.abs(v) - 0.03, 0); }
function grainMs(s) {
  var rev = s < 0.3333333, csh = rev ? s * 3 * (2 - s * 3) : 1 - 1.5 * (s - 0.3333333);
  return Math.pow(2, Math.min(1, 1.025 * csh) * -9) * 4000;
}
function fmtHz(hz) { return (hz < 1 ? Math.round(hz * 100) / 100 : Math.round(hz * 10) / 10) + " Hz"; }
function fmtMs(ms) { return ms >= 1000 ? (Math.round(ms / 100) / 10) + " s" : Math.round(ms) + " ms"; }
function pct(v) { return Math.round(v * 100) + "%"; }
function valueText(name) {
  var v = P[name].v;
  if (name === "time") return "-" + (Math.round(v * bufSeconds() * 10) / 10) + " s";
  if (name === "density") {
    if (v < 0.48) return (Math.round(130.81278 * Math.pow(2, -v * 16) * 10) / 10) + " /s even";
    if (v > 0.52) return "~" + (Math.round(0.5 * 130.81278 * Math.pow(2, -(1 - v) * 16) * 10) / 10) + " /s random";
    return P.seedlatch.v > 0.5 ? (Math.round(130.81278 * Math.pow(2, -0.479 * 16) * 100) / 100) + " /s even" : "1 per TRIGGER";
  }
  if (name === "pitch") { var st = detune(v); return (st > 0 ? "+" : "") + (Math.round(st * 10) / 10) + " st"; }
  if (name === "size") return (v < 0.3333333 ? "rev " : "") + fmtMs(grainMs(v));
  if (name === "shape") return v < 0.12 ? "square" : v < 0.3 ? "hold+decay" : v < 0.45 ? "decay" : v < 0.6 ? "smooth" : v < 0.85 ? "bell" : "slow attack";
  if (/^(time|pitch|size|shape)_amt$/.test(name)) {
    var a = attenu(v), routed = P["dst_" + name.split("_")[0]].v > 0.5;
    if (Math.abs(a) < 0.005) return "off";
    // with a cable (Beads, CV patched): CW = amount of the CV, CCW = CV-controlled randomness
    if (routed) return (a < 0 ? "CV rnd " : "CV x") + pct(Math.abs(a));
    return (a < 0 ? "peaky " : "even ") + pct(Math.abs(a));
  }
  if (/^l[12]_rate$|^rn_rate$/.test(name)) { var sy = P[name.replace("rate", "sync")].v > 0.5; return sy ? DIVS[Math.round(v * 14)] : fmtHz(0.02 * Math.pow(1000, v)); }
  if (name === "ck_rate") return P.ck_sync.v > 0.5 ? DIVS[Math.round(v * 14)] : fmtHz(0.1 * Math.pow(400, v));
  if (name === "env_gain") return "x" + (Math.round(0.25 * Math.pow(64, v) * 10) / 10);
  if (name === "sq_div") return DIVS[Math.round(v)];
  if (name === "sq_len") return String(Math.round(v));
  if (name === "input" && P.agc.v > 0.5) { var gdb = 20 * Math.log(Math.max(agcGain, 1e-6)) / Math.LN10; return "AUTO " + (gdb > 0 ? "+" : "") + Math.round(gdb) + " dB"; }
  if (name === "input" || name === "output") return (v > 0 ? "+" : "") + (Math.round(v * 10) / 10) + " dB";
  return pct(v);
}

// ---------- drawing ----------
function col(c, a) { mgraphics.set_source_rgba(c[0], c[1], c[2], a === undefined ? c[3] : a); }
function rect(x, y, w, h, c, fill, lw, a) {
  col(c, a); mgraphics.set_line_width(lw || 1);
  if (fill) { mgraphics.rectangle(x, y, w, h); mgraphics.fill(); } else { mgraphics.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); mgraphics.stroke(); }
}
function font(s, b) {
  // Live's own typeface (installed with Live) for the Ableton style
  if (STYLE === "ableton") mgraphics.select_font_face(b ? "Ableton Sans Bold" : "Ableton Sans Medium");
  else mgraphics.select_font_face(b ? "Arial Bold" : "Arial");
  mgraphics.set_font_size(s);
}
function text(s, x, y, size, c, b) { font(size, b); col(c); mgraphics.move_to(x, y); mgraphics.show_text(s); }
function tw(s, size, b) { font(size, b); return mgraphics.text_measure(s)[0]; }
function textC(s, cx, y, size, c, b) { text(s, cx - tw(s, size, b) / 2, y, size, c, b); }
function line(x1, y1, x2, y2, c, lw, a) { col(c, a); mgraphics.set_line_width(lw || 1); mgraphics.move_to(x1, y1); mgraphics.line_to(x2, y2); mgraphics.stroke(); }
function circle(cx, cy, r, c, fill, lw, a) { col(c, a); mgraphics.set_line_width(lw || 1); mgraphics.ellipse(cx - r, cy - r, 2 * r, 2 * r); if (fill) mgraphics.fill(); else mgraphics.stroke(); }
function arc(cx, cy, r, a0, a1, c, lw, a) {
  col(c, a); mgraphics.set_line_width(lw || 1);
  var n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.08));
  for (var i = 0; i <= n; i++) { var t = a0 + (a1 - a0) * i / n, x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r; if (i === 0) mgraphics.move_to(x, y); else mgraphics.line_to(x, y); }
  mgraphics.stroke();
}
function hit(o) { hits.push(o); }
// ---------- "live" look: soft gradients, shadows, knurled knobs, engraved lace, brushed panel ----------
// mgraphics radial gradients if available (Max jsui); a flat colour otherwise — never throws
var HAS_GRAD = typeof mgraphics.pattern_create_radial === "function";
// panel style: "live" (soft light, like real hardware) or "toon" (cel-shaded cartoon / anime look)
// "ableton": dark, flat, like Live's own devices (default)
var STYLE = "ableton";
var OUTLINE = [0.08, 0.07, 0.1, 1];
var PAL = {
  light: { bg: [0.925, 0.918, 0.890, 1], panel: [0.965, 0.960, 0.940, 1], ink: [0.106, 0.106, 0.102, 1], mid: [0.50, 0.49, 0.47, 1],
    line: [0.78, 0.765, 0.73, 1], accent: [0.17, 0.30, 0.61, 1], on: [0.17, 0.30, 0.61, 1] },
  ableton: { bg: [0.105, 0.105, 0.105, 1], panel: [0.155, 0.155, 0.155, 1], ink: [0.84, 0.84, 0.84, 1], mid: [0.56, 0.56, 0.56, 1],
    line: [0.30, 0.30, 0.30, 1], accent: [0.36, 0.82, 0.84, 1], on: [0.36, 0.82, 0.84, 1] }
};
var PINK = [0.95, 0.50, 0.66, 1];
function style(name) {
  STYLE = name === "toon" || name === "live" ? name : "ableton";
  var p = PAL[STYLE === "ableton" ? "ableton" : "light"];
  for (var k in p) C[k] = p[k].slice();
  var sc = STYLE === "ableton" ? SRC_DARK : SRC_LIGHT;
  for (var i = 0; i < sc.length; i++) SRC_COL[i] = sc[i].slice();
  dirty = true;
}
// NATIVE mode (the "native" device): the SOUND controls are Live's own live.dial / live.text /
// live.tab objects placed over this panel; the panel draws only the rest and hides them on MOD
var NATIVE = false;
var NATIVE_OBJECTS = ["time", "density", "pitch", "size", "shape", "time_amt", "pitch_amt", "size_amt", "shape_amt",
  "feedback", "drywet", "reverb", "input", "output", "agc", "quality"];   // FREEZE / LATCH: left column, always shown
function showNative() {
  if (!NATIVE) return;
  for (var i = 0; i < NATIVE_OBJECTS.length; i++) outlet(0, "script", "sendbox", NATIVE_OBJECTS[i], "hidden", tab === "MOD" ? 1 : 0);
}
function native(v) { NATIVE = +v > 0.5; if (NATIVE) style("ableton"); showNative(); dirty = true; }
function nextStyle() { }   // one look now (Ableton); the other styles stay in the code
// cel shading: base colour with a hard shadow crescent (bottom-right) and a bold outline
function celCircle(cx, cy, r, base, shade, ow) {
  circle(cx, cy, r, shade, true);
  circle(cx - r * 0.1, cy - r * 0.12, r * 0.86, base, true);
  circle(cx, cy, r, OUTLINE, false, ow || 2);
}
function sparkle(x, y, s) {   // anime highlight: white blob + small four-point star
  circle(x, y, s, [1, 1, 1, 1], true, 1, 0.95);
  var x2 = x + s * 2.2, y2 = y + s * 0.4;
  line(x2 - s * 0.9, y2, x2 + s * 0.9, y2, [1, 1, 1, 1], 1, 0.9);
  line(x2, y2 - s * 0.9, x2, y2 + s * 0.9, [1, 1, 1, 1], 1, 0.9);
}
function radialFill(cx, cy, r, hx, hy, c0, c1) {   // circle lit from (hx, hy): c0 at the highlight, c1 at the rim
  if (HAS_GRAD) {
    try {
      var pt = mgraphics.pattern_create_radial(hx, hy, 0, cx, cy, r);
      pt.add_color_stop_rgba(0, c0[0], c0[1], c0[2], c0[3]);
      pt.add_color_stop_rgba(1, c1[0], c1[1], c1[2], c1[3]);
      mgraphics.set_source(pt);
      mgraphics.ellipse(cx - r, cy - r, 2 * r, 2 * r); mgraphics.fill();
      return;
    } catch (e) { HAS_GRAD = false; }
  }
  circle(cx, cy, r, [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2, 1], true);
}
function shadow(cx, cy, r) {
  circle(cx + 1.2, cy + 2.2, r + 1.5, [0, 0, 0, 1], true, 1, 0.07);
  circle(cx + 0.8, cy + 1.6, r + 0.5, [0, 0, 0, 1], true, 1, 0.14);
}
// brushed / anodised panel: fixed hairlines and specks (same every frame)
var TEX = (function () {
  var s = 12345, r = function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }, o = { lines: [], dots: [] };
  for (var i = 0; i < 70; i++) o.lines.push([r() * W0, 6 + r() * (H0 - 12), 20 + r() * 160, r() < 0.5 ? 1 : 0, 0.025 + r() * 0.035]);
  for (var j = 0; j < 160; j++) o.dots.push([6 + r() * (W0 - 12), 6 + r() * (H0 - 12), 0.35 + r() * 0.5, r() < 0.6 ? 0 : 1]);
  return o;
})();
function panelTexture() {
  if (STYLE === "ableton") {   // section boxes like Live's devices
    rect(8, 6, 140, H0 - 12, C.panel, true);
    if (tab === "MOD") rect(156, 6, W0 - 164, H0 - 12, C.panel, true);
    else { rect(156, 6, 426, H0 - 12, C.panel, true); rect(590, 6, W0 - 598, H0 - 12, C.panel, true); }
    return;
  }
  if (STYLE === "toon") {   // manga screentone in two corners, dots growing towards the edge
    for (var gx = 0; gx < 22; gx++) for (var gy = 0; gy < 21; gy++) {
      var x = 8 + gx * 7 + (gy % 2) * 3.5, y = 8 + gy * 7.6, k = 1 - (gx / 22 + gy / 21) / 1.2;
      if (k > 0.15) circle(x, y, 1.6 * k, OUTLINE, true, 1, 0.07);
      var x2 = W0 - x, y2 = H0 - y;
      if (k > 0.15) circle(x2, y2, 1.6 * k, OUTLINE, true, 1, 0.07);
    }
    return;
  }
  for (var i = 0; i < TEX.lines.length; i++) {
    var L = TEX.lines[i];
    line(L[0], L[1], Math.min(W0 - 6, L[0] + L[2]), L[1], L[3] ? [1, 1, 1, 1] : [0.45, 0.43, 0.38, 1], 0.6, L[4]);
  }
  for (var j = 0; j < TEX.dots.length; j++) {
    var D = TEX.dots[j];
    circle(D[0], D[1], D[2], D[3] ? [1, 1, 1, 1] : [0.35, 0.33, 0.3, 1], true, 1, 0.12);
  }
}
// engraved lace around a big knob: dots and dashes on two rings (own pattern)
function lace(cx, cy, r) {
  if (STYLE === "toon") {
    for (var q = 0; q < 24; q++) { var tq = q / 24 * Math.PI * 2; circle(cx + Math.cos(tq) * r, cy + Math.sin(tq) * r, q % 3 ? 0.9 : 1.6, OUTLINE, true, 1, q % 3 ? 0.25 : 0.45); }
    return;
  }
  var n = 40;
  for (var i = 0; i < n; i++) {
    var t = i / n * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
    if (i % 2) circle(cx + c * r, cy + sn * r, 0.75, C.mid, true, 1, 0.35);
    else line(cx + c * (r - 1.6), cy + sn * (r - 1.6), cx + c * (r + 1.6), cy + sn * (r + 1.6), C.mid, 0.8, 0.28);
    var t2 = t + Math.PI / n;
    circle(cx + Math.cos(t2) * (r + 3.2), cy + Math.sin(t2) * (r + 3.2), 0.55, C.mid, true, 1, 0.22);
  }
}
// a jack: metal nut, dark hole, coloured ring (source colour / patched cable)
function jack(x, y, c, patched) {
  if (STYLE === "ableton") {   // patch points like Live's modulation devices: ring + lit dot
    circle(x, y, 5, C.mid, false, 1.2);
    if (c) circle(x, y, patched ? 3.2 : 2, c, true);
    return;
  }
  if (STYLE === "toon") {
    circle(x + 1.5, y + 2, 6.5, OUTLINE, true, 1, 0.18);
    celCircle(x, y, 6.2, [0.9, 0.9, 0.94, 1], [0.62, 0.63, 0.72, 1], 1.6);
    circle(x, y, 3.4, c || OUTLINE, true);
    circle(x, y, 2.2, OUTLINE, true);
    if (patched) circle(x - 0.6, y - 0.6, 0.8, [1, 1, 1, 1], true);
    return;
  }
  shadow(x, y, 5.5);
  radialFill(x, y, 6, x - 2.2, y - 2.6, [0.95, 0.95, 0.93, 1], [0.55, 0.55, 0.53, 1]);
  circle(x, y, 6, [0, 0, 0, 1], false, 0.6, 0.35);
  circle(x, y, 3.6, c || [0.2, 0.2, 0.2, 1], false, c ? 1.6 : 0.8, c ? 1 : 0.6);
  radialFill(x, y, 2.6, x + 0.6, y + 0.8, [0.22, 0.22, 0.22, 1], [0, 0, 0, 1]);
  if (patched) circle(x, y, 1.4, c, true);
}
var SKIRT0 = [0.30, 0.30, 0.29, 1], SKIRT1 = [0.04, 0.04, 0.04, 1], CAP0 = [1, 1, 0.99, 1], CAP1 = [0.86, 0.85, 0.81, 1];
// a real-looking knob body: shadow, black skirt with knurling that turns with the value, cream cap
function knobBody(cx, cy, r, a, capR) {
  if (STYLE === "toon") {
    circle(cx + 2, cy + 2.5, r + 1, OUTLINE, true, 1, 0.18);                 // hard drop shadow
    celCircle(cx, cy, r, [0.20, 0.20, 0.27, 1], [0.07, 0.07, 0.1, 1], r > 8 ? 2.2 : 1.4);
    var n = Math.max(10, Math.round(r * 0.9));
    for (var i = 0; i < n; i++) {   // chunky grip notches turning with the value
      var t = a + i / n * Math.PI * 2;
      line(cx + Math.cos(t) * r * 0.82, cy + Math.sin(t) * r * 0.82, cx + Math.cos(t) * r * 0.97, cy + Math.sin(t) * r * 0.97, OUTLINE, r > 8 ? 1.6 : 1, 0.8);
    }
    if (capR > 0) {
      celCircle(cx, cy, capR, [1, 0.97, 0.88, 1], [0.93, 0.80, 0.62, 1], 2);
      sparkle(cx - capR * 0.42, cy - capR * 0.45, capR * 0.14);
    } else sparkle(cx - r * 0.35, cy - r * 0.4, Math.max(0.8, r * 0.13));
    return;
  }
  shadow(cx, cy, r);
  radialFill(cx, cy, r, cx - r * 0.35, cy - r * 0.45, SKIRT0, SKIRT1);
  var n = Math.max(16, Math.round(r * 1.6));
  for (var i = 0; i < n; i++) {
    var t = a + i / n * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t), lit = 0.5 - 0.5 * Math.sin(t + Math.PI * 0.25);
    line(cx + c * r * 0.8, cy + sn * r * 0.8, cx + c * r * 0.97, cy + sn * r * 0.97, lit > 0.5 ? [0.5, 0.5, 0.48, 1] : [0, 0, 0, 1], 0.8, 0.35 + 0.3 * lit);
  }
  if (capR > 0) {
    circle(cx, cy, capR + 0.8, [0, 0, 0, 1], true, 1, 0.5);
    radialFill(cx, cy, capR, cx - capR * 0.4, cy - capR * 0.5, CAP0, CAP1);
    circle(cx, cy, capR, [1, 1, 1, 1], false, 0.8, 0.6);
  }
}
var A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;   // 270° knob travel, 0 at 7:30
function knob(cx, cy, r, name, bipolar) {
  // the angle comes from the knob position 0..1 (IN / OUT hold dB: −12…+32 / −24…+12)
  var v = norm(name, P[name].v), a = A0 + (A1 - A0) * v, act = hover === name || (drag && drag.name === name);
  if (STYLE === "ableton") {   // live.dial look: grey track, coloured value arc, needle
    var rr = r * 0.82, lw = Math.max(2.5, r * 0.13);
    arc(cx, cy, rr, A0, A1, C.line, lw);
    if (bipolar) { var am0 = (A0 + A1) / 2; arc(cx, cy, rr, Math.min(am0, a), Math.max(am0, a), C.accent, lw); }
    else arc(cx, cy, rr, A0, a, C.accent, lw);
    line(cx, cy, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, C.ink, Math.max(1.5, r * 0.07));
    if (act) circle(cx, cy, rr + lw + 1.5, C.accent, false, 1, 0.45);
    hit({ x: cx - r - 6, y: cy - r - 6, w: 2 * r + 12, h: 2 * r + 12, kind: "knob", name: name });
    return;
  }
  if (r > 14) lace(cx, cy, r + 8);
  arc(cx, cy, r + 4, A0, A1, C.line, 2.5);
  if (bipolar) { var am = (A0 + A1) / 2; arc(cx, cy, r + 4, Math.min(am, a), Math.max(am, a), C.accent, 2.5); }
  else arc(cx, cy, r + 4, A0, a, C.accent, 2.5);
  knobBody(cx, cy, r, a, r * 0.6);
  // white notch on the skirt, continued as a dark line on the cap
  line(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97, [0.98, 0.98, 0.96, 1], Math.max(2, r * 0.11));
  line(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, C.ink, Math.max(1.2, r * 0.06), 0.55);
  if (act) circle(cx, cy, r + 7, C.accent, false, 1, 0.5);
  hit({ x: cx - r - 6, y: cy - r - 6, w: 2 * r + 12, h: 2 * r + 12, kind: "knob", name: name });
}
function drawLogo(x, y, s) {
  text("FL", x, y, s, C.ink, true);
  var ox = x + tw("FL", s, true) + 1, ow = tw("O", s, true);
  text("O", ox, y, s, C.ink, true);
  line(ox + 1, y + 1, ox + ow - 1, y - s * 0.75, C.ink, Math.max(1.6, s / 11));
  text("CK", ox + ow + 1, y, s, C.ink, true);
}
function roundButton(cx, cy, r, label, on, name, momentary) {
  if (STYLE === "ableton") {   // Live's toggle buttons: flat rounded box, lit when on
    rect(cx - r - 4, cy - r * 0.75, 2 * r + 8, r * 1.5, on ? C.accent : C.panel, true);
    rect(cx - r - 4, cy - r * 0.75, 2 * r + 8, r * 1.5, on ? C.accent : C.line, false, 1);
    circle(cx, cy, 3, on ? C.bg : C.mid, true);
    textC(label, cx, cy + r + 12, 8, C.ink, true);
    hit({ x: cx - r - 4, y: cy - r - 2, w: 2 * r + 8, h: 2 * r + 4, kind: momentary ? "momentary" : "toggle", name: name });
    return;
  }
  if (STYLE === "toon") {
    if (on) for (var q = 0; q < 7; q++) {   // "pop" burst lines when on (upper half only: the label is below)
      var tq = Math.PI * (1.08 + q * 0.14);
      line(cx + Math.cos(tq) * (r + 5), cy + Math.sin(tq) * (r + 5), cx + Math.cos(tq) * (r + 8.5), cy + Math.sin(tq) * (r + 8.5), C.accent, 2);
    }
    circle(cx + 2, cy + 2.5, r + 2.5, OUTLINE, true, 1, 0.18);
    celCircle(cx, cy, r + 2.5, [0.85, 0.86, 0.9, 1], [0.6, 0.62, 0.7, 1], 2);
    celCircle(cx, cy, r - 0.5, on ? [0.55, 0.75, 1, 1] : [1, 0.97, 0.9, 1], on ? [0.25, 0.42, 0.8, 1] : [0.92, 0.8, 0.66, 1], 1.8);
    sparkle(cx - r * 0.4, cy - r * 0.42, r * 0.16);
    textC(label, cx, cy + r + 12, 8, C.ink, true);
    hit({ x: cx - r - 2, y: cy - r - 2, w: 2 * r + 4, h: 2 * r + 4, kind: momentary ? "momentary" : "toggle", name: name });
    return;
  }
  if (on) { circle(cx, cy, r + 6, C.accent, true, 1, 0.08); circle(cx, cy, r + 3.5, C.accent, true, 1, 0.16); }
  shadow(cx, cy, r + 1.5);
  radialFill(cx, cy, r + 2.5, cx - r * 0.5, cy - r * 0.6, [0.80, 0.80, 0.78, 1], [0.38, 0.38, 0.36, 1]);   // metal bezel
  radialFill(cx, cy, r, cx - r * 0.35, cy - r * 0.45, on ? [0.92, 0.95, 1, 1] : CAP0, on ? [0.45, 0.58, 0.85, 1] : [0.83, 0.82, 0.78, 1]);
  circle(cx, cy, r, [0, 0, 0, 1], false, 0.8, 0.35);
  if (on) circle(cx, cy, r * 0.35, [1, 1, 1, 1], true, 1, 0.55);
  textC(label, cx, cy + r + 12, 8, C.ink, true);
  hit({ x: cx - r - 2, y: cy - r - 2, w: 2 * r + 4, h: 2 * r + 4, kind: momentary ? "momentary" : "toggle", name: name });
}

function paint() {
  var sz = mgraphics.size;
  scaleF = Math.min(sz[0] / W0, sz[1] / H0); if (!(scaleF > 0)) scaleF = 1;
  mgraphics.scale(scaleF, scaleF);
  hits = [];
  rect(0, 0, W0, H0, C.bg, true);
  panelTexture();
  if (STYLE !== "ableton") {
    rect(3, 3, W0 - 6, H0 - 6, C.line, false, 1);
    rect(4, 4, W0 - 8, H0 - 8, [1, 1, 1, 1], false, 1, 0.55);
  }   // engraved edge: dark line + light line
  // ---- left: logo, tabs, FREEZE / TRIGGER, AUTO GRAINS, DICE
  drawLogo(14, 30, 22);
  for (var ti = 0; ti < 2; ti++) {
    var tn = ti ? "MOD" : "SOUND", tx0 = 14 + ti * 64, on = tab === tn;
    rect(tx0, 40, 60, 14, C.line, on, 1);
    textC(tn, tx0 + 30, 51, 8, C.ink, true);
    hit({ x: tx0, y: 40, w: 60, h: 14, kind: "tab", name: "tab_" + tn, tab: tn });
  }
  if (NATIVE) { paintNativeLeft(); line(152, 12, 152, H0 - 12, C.line); if (tab === "MOD") paintMod(); else paintNativeSound(); return; }
  flatButton(14, 60, 60, 24, "FREEZE", P.freeze.v > 0.5, "toggle", "freeze");
  flatButton(80, 60, 60, 24, "TRIGGER", P.seed.v > 0.5 || keyHeld || (P.seedlatch.v > 0.5 && pulseOn()), "momentary", "seed");
  flatButton(14, 90, 126, 16, P.seedlatch.v > 0.5 ? "AUTO GRAINS  ON" : "AUTO GRAINS  OFF", P.seedlatch.v > 0.5, "toggle", "seedlatch");
  flatButton(14, 112, 58, 18, "DICE", false, "dice", "dice");
  flatButton(76, 112, 64, 18, "> " + DICE_MODES[diceMode], false, "dicemode", "dicemode");
  text(lastRecipe ? lastRecipe : "", 16, 145, 8, C.accent, true);
  flatButton(100, 134, 40, 16, "BACK", false, history.length ? "back" : "none", "back", history.length ? 1 : 0.35);
  if (keyNote !== null) text("KEYS " + noteName(keyNote), 16, 160, 7.5, C.accent, true);
  line(152, 12, 152, H0 - 12, C.line);
  if (tab === "MOD") { paintMod(); return; }
  // ---- big knobs
  for (var i = 0; i < BIG.length; i++) {
    var b = BIG[i], cx = KX[i];
    textC(b[1], cx, 18, 9.5, C.ink, true);
    knob(cx, KY, KR, b[0], b[0] === "pitch");
    textC(valueText(b[0]), cx, 94, 9, C.accent, true);
    textC(b[2], cx, 105, 7, C.mid);
    if (b[0] === "density") {
      textC("even  <   >  random", cx, 128, 7.5, C.mid);
      textC("12h = slowest", cx, 139, 7.5, C.mid);
    } else {
      var an = b[0] + "_amt", cv = P["dst_" + b[0]].v > 0.5;
      knob(cx - 12, 131, 9, an, true);
      text(cv ? "DEPTH" : "SPREAD", cx + 2, 129, 7.5, cv ? C.accent : C.mid, true);
      text(valueText(an), cx + 2, 140, 7.5, C.ink);
    }
  }
  line(586, 12, 586, H0 - 12, C.line);
  // ---- mix
  for (var m = 0; m < MIX.length; m++) {
    var mx = 622 + m * 62;
    textC(MIX[m][1], mx, 18, 8.5, C.ink, true);
    knob(mx, 44, 15, MIX[m][0], false);
    textC(valueText(MIX[m][0]), mx, 76, 8.5, C.accent, true);
  }
  // IN / OUT as knobs, AUTO, output level
  textC("IN", 818, 18, 8.5, C.ink, true); knob(818, 40, 10, "input", false); textC(valueText("input"), 818, 62, 7.5, C.accent, true);
  textC("OUT", 858, 18, 8.5, C.ink, true); knob(858, 40, 10, "output", false); textC(valueText("output"), 858, 62, 7.5, C.accent, true);
  pill(800, 67, 36, "AUTO", P.agc.v > 0.5, "toggle", "agc");
  meter(884, 12, 66);
  // ---- recording quality: held while FREEZE is on, like the module
  var qx = 598, qw = [56, 72, 66, 84], qz = P.freeze.v > 0.5;
  for (var qq = 0; qq < 4; qq++) {
    var qon = Math.round(P.quality.v) === qq;
    rect(qx, 84, qw[qq], 14, qon ? C.accent : C.line, qon, 1, qz && !qon ? 0.35 : 1);
    textC(QUAL[qq][0], qx + qw[qq] / 2, 94.5, 7.5, qon ? C.bg : (qz ? C.line : C.ink), true);
    hit({ x: qx, y: 84, w: qw[qq], h: 14, kind: "quality", name: "quality_" + qq, val: qq });
    qx += qw[qq] + 4;
  }
  // ---- tape
  drawTape(598, 102, 290, 48);
  fitHelp(160, 163, 420);
}
// flat button like Live's toggles: label inside, lit when on
function flatButton(x, y, w, h, label, on, kind, name, alpha) {
  rect(x, y, w, h, on ? C.accent : C.panel, true, 1, alpha);
  rect(x, y, w, h, on ? C.accent : C.line, false, 1, alpha);
  textC(label, x + w / 2, y + h / 2 + 3.5, h >= 20 ? 9 : 8, on ? C.bg : C.ink, true);
  if (kind !== "none") hit({ x: x, y: y, w: w, h: h, kind: kind, name: name });
}
// output level (from the patch: "level <L> <R>", peak, 0..1)
var levL = 0, levR = 0;
function level(l, r) { levL = +l; levR = +r; dirty = true; }
function meter(x, y, h) {
  var db = function (v) { var d = 20 * Math.log(Math.max(v, 1e-6)) / Math.LN10; return Math.max(0, Math.min(1, (d + 48) / 48)); };
  var ls = [levL, levR];
  for (var c = 0; c < 2; c++) {
    var mx = x + c * 4, f = db(ls[c]);
    rect(mx, y, 3, h, C.line, true);
    rect(mx, y + h * (1 - f), 3, h * f, ls[c] > 0.98 ? PINK : C.accent, true);
  }
}
// ================= NATIVE device: what the panel still draws =================
// (positions of Live's objects: tools/build_device.py NATIVE_LAYOUT — keep in step)
function paintNativeLeft() {
  // FREEZE [14,68,60,24] and LATCH [14,98,126,16] are live.text; SEED stays here (hold / latch gestures)
  var sOn = P.seed.v > 0.5 || (P.seedlatch.v > 0.5 && pulseOn());
  rect(80, 68, 60, 24, sOn ? C.accent : C.panel, true);
  rect(80, 68, 60, 24, sOn ? C.accent : C.line, false, 1);
  textC("SEED", 110, 84, 8, sOn ? C.bg : C.ink, true);
  hit({ x: 80, y: 68, w: 60, h: 24, kind: "momentary", name: "seed" });
  textC("hold SEED for 4 s = LATCH", 77, 128, 6, C.mid);
  rect(14, 141, 84, 17, C.accent, true);
  textC("DICE  new sound", 56, 153, 7.5, C.bg, true);
  hit({ x: 14, y: 141, w: 84, h: 17, kind: "dice", name: "dice" });
  rect(102, 141, 38, 17, C.line, false, 1, history.length ? 1 : 0.3);
  textC("BACK", 121, 153, 7, history.length ? C.ink : C.line, true);
  if (history.length) hit({ x: 102, y: 141, w: 38, h: 17, kind: "back", name: "back" });
}
function paintNativeSound() {
  // big dials [KX-28,10,56,64] and RND dials [KX-22,100,44,44] are live.dial: here only the values in
  // musical units (seconds, grains/s, semitones, ms) and what they mean
  for (var i = 0; i < BIG.length; i++) {
    var b = BIG[i], cx = KX[i];
    textC(valueText(b[0]), cx, 84, 8.5, C.accent, true);
    textC(b[2], cx, 95, 6, C.mid);
    if (b[0] === "density") {
      textC("even  <  12h  >  random", cx, 118, 6, C.mid);
      textC("12h = off (latched)", cx, 128, 6, C.mid);
    } else {
      var an = b[0] + "_amt", cv = P["dst_" + b[0]].v > 0.5;
      textC(valueText(an), cx, 152, 6, cv ? C.accent : C.ink);
    }
  }
  line(586, 12, 586, H0 - 12, C.line);
  // mix dials [cx-26,10,52,56]: values
  for (var m = 0; m < MIX.length; m++) textC(valueText(MIX[m][0]), 626 + m * 66, 76, 8, C.accent, true);
  // IN / OUT dials [808,10,42,52] [852,10,42,52]; AUTO live.text [808,66,42,13]; LEARN here
  pill(852, 66, 40, agcLearning ? "..." : "LEARN", agcLearning > 0, "cmd", "learn");
  if (P.agc.v > 0.5) { var gdb = 20 * Math.log(Math.max(agcGain, 1e-6)) / Math.LN10; textC("auto gain " + (gdb > 0 ? "+" : "") + Math.round(gdb) + " dB", 850, 85, 6, C.mid); }
  // quality: live.tab [598,88,290,13]; the tape is Max's waveform~ [598,118,290,30] (the recording itself,
  // record head = pink selection); here only its caption
  text("TAPE  " + bufSeconds() + " s  ·  record head = pink  ·  grains " + tapeSt.active + " / 32", 600, 113, 6, C.mid, true);
  if (engineStopped()) textC("ENGINE NOT RUNNING - see Max Console", 743, 136, 7, PINK, true);
  text(hoverHelp(), 160, 162, 6.5, hover ? C.ink : C.mid, !!hover);
}
// ================= MOD tab =================
var JS_X = 575, JD_X = 790;
function srcY(i) { return 26 + i * 23; }
function dstY(j) { return 14 + j * 14.2; }
// small knob for the MOD tab: thin ring, fits in a 14 px row
function smallKnob(cx, cy, name) {
  var v = norm(name, P[name].v), a = A0 + (A1 - A0) * v, act = hover === name || (drag && drag.name === name);
  arc(cx, cy, 6.5, A0, A1, C.line, 1.6);
  arc(cx, cy, 6.5, A0, a, C.accent, 1.6);
  if (STYLE === "ableton") {
    line(cx, cy, cx + Math.cos(a) * 6.5, cy + Math.sin(a) * 6.5, C.ink, 1.3);
    if (act) circle(cx, cy, 8.5, C.accent, false, 1, 0.5);
    hit({ x: cx - 8, y: cy - 8, w: 16, h: 16, kind: "knob", name: name });
    return;
  }
  knobBody(cx, cy, 4.6, a, 0);
  line(cx + Math.cos(a) * 1.2, cy + Math.sin(a) * 1.2, cx + Math.cos(a) * 4.4, cy + Math.sin(a) * 4.4, [0.98, 0.98, 0.96, 1], 1.2);
  if (act) circle(cx, cy, 8.5, C.accent, false, 1, 0.5);
  hit({ x: cx - 8, y: cy - 8, w: 16, h: 16, kind: "knob", name: name });
}
// thin horizontal amount bar (FEEDBACK / DRY-WET / REVERB CV amounts next to their jacks)
function amountBar(x, y, w, name) {
  rect(x, y - 5, w, 10, C.line, true);
  rect(x, y - 5, w * P[name].v, 10, C.accent, true);
  textC(pct(P[name].v), x + w / 2, y + 3, 7, P[name].v > 0.55 ? C.bg : C.ink, true);
  hit({ x: x - 2, y: y - 6, w: w + 4, h: 12, kind: "knob", name: name });
}
function pill(x, y, w, label, on, kind, name, extra) {
  if (STYLE === "ableton") { rect(x, y, w, 12, on ? C.accent : C.line, on, 1); if (!on) rect(x, y, w, 12, C.bg, true, 1, 0.35); }
  else rect(x, y, w, 12, C.ink, on, 1);
  textC(label, x + w / 2, y + 9.2, 7.5, on ? (STYLE === "ableton" ? C.bg : C.panel) : C.ink, true);
  var o = { x: x, y: y, w: w, h: 12, kind: kind, name: name };
  if (extra) for (var k in extra) o[k] = extra[k];
  hit(o);
}
function shapeIcon(x, y, w, h, shp) {
  col(C.ink); mgraphics.set_line_width(1.2);
  for (var i = 0; i <= 20; i++) {
    var ph = i / 20, v = shp === 0 ? Math.sin(2 * Math.PI * ph) : shp === 1 ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : shp === 2 ? 1 - 2 * ph : (ph < 0.5 ? 1 : -1);
    var px = x + ph * w, py = y + h / 2 - v * h / 2;
    if (i === 0) mgraphics.move_to(px, py); else mgraphics.line_to(px, py);
  }
  mgraphics.stroke();
}
function paintMod() {
  text("MODULATORS", 160, 13, 8, C.mid, true);
  text(running ? "PLAYING (synced to Live)" : "Live stopped: synced sources wait", 260, 13, 7.5, running ? C.accent : C.mid);
  for (var i = 0; i < 6; i++) {
    var y = srcY(i);
    text(SRC[i], 160, y + 3, 7.5, C.ink, true);
    if (i < 2) {
      var pre = "l" + (i + 1) + "_";
      smallKnob(222, y, pre + "rate"); text(valueText(pre + "rate"), 233, y + 3, 7.5, C.ink);
      pill(282, y - 6, 28, "SYNC", P[pre + "sync"].v > 0.5, "toggle", pre + "sync");
      rect(314, y - 6, 34, 12, C.ink, false, 1); shapeIcon(317, y - 4, 28, 8, Math.round(P[pre + "shape"].v));
      hit({ x: 314, y: y - 6, w: 34, h: 12, kind: "cycle", name: pre + "shape", n: 4 });
      pill(352, y - 6, 14, "R", P[pre + "reset"].v > 0.5, "toggle", pre + "reset");
      smallKnob(384, y, pre + "amt"); text("AMT " + pct(P[pre + "amt"].v), 395, y + 3, 7.5, C.ink);
    } else if (i === 2) {
      smallKnob(222, y, "rn_rate"); text(valueText("rn_rate"), 233, y + 3, 7.5, C.ink);
      pill(282, y - 6, 28, "SYNC", P.rn_sync.v > 0.5, "toggle", "rn_sync");
      pill(314, y - 6, 42, P.rn_smooth.v > 0.5 ? "SMOOTH" : "STEPS", P.rn_smooth.v > 0.5, "toggle", "rn_smooth");
      smallKnob(384, y, "rn_amt"); text("AMT " + pct(P.rn_amt.v), 395, y + 3, 7.5, C.ink);
    } else if (i === 3) {
      smallKnob(222, y, "env_gain"); text("GAIN " + valueText("env_gain"), 233, y + 3, 7.5, C.ink);
      text("follows the input level", 300, y + 3, 7.5, C.mid);
    } else if (i === 4) {
      smallKnob(222, y, "ck_rate"); text(valueText("ck_rate"), 233, y + 3, 7.5, C.ink);
      pill(282, y - 6, 28, "SYNC", P.ck_sync.v > 0.5, "toggle", "ck_sync");
      text("pulses -> TRIGGER (AUTO GRAINS on: DENSITY divides / thins)", 316, y + 3, 7, C.mid);
    } else {
      rect(202, y - 7, 34, 14, C.ink, false, 1); textC(valueText("sq_div"), 219, y + 3, 7.5, C.ink, true);
      hit({ x: 202, y: y - 7, w: 34, h: 14, kind: "knob", name: "sq_div" });
      rect(240, y - 7, 22, 14, C.ink, false, 1); textC(valueText("sq_len"), 251, y + 3, 7.5, C.ink, true);
      hit({ x: 240, y: y - 7, w: 22, h: 14, kind: "knob", name: "sq_len" });
      drawSeq(268, y - 10, 290, 20);
    }
    // source jack
    jack(JS_X, y, SRC_COL[i], true);
    hit({ x: JS_X - 8, y: y - 8, w: 16, h: 16, kind: "jack_src", name: "src" + i, src: i + 1 });
  }
  // destinations
  for (var j = 0; j < DST.length; j++) {
    var dy = dstY(j), dn = "dst_" + DST[j][0], si = Math.round(P[dn].v);
    jack(JD_X, dy, si ? SRC_COL[si - 1] : null, !!si);
    text(DST[j][1], 800, dy + 3, 7.5, C.ink, si > 0);
    hit({ x: JD_X - 8, y: dy - 7, w: 60, h: 14, kind: "jack_dst", name: dn, dst: j });
    var an = { feedback: "fb_amt", drywet: "dw_amt", reverb: "rv_amt", density: "dn_amt" }[DST[j][0]];
    if (an) amountBar(852, dy, 36, an);
  }
  text("DEPTH", 852, dstY(6) - 8, 7, C.mid, true);
  // cables (drawn last, on top)
  for (var k = 0; k < DST.length; k++) {
    var s2 = Math.round(P["dst_" + DST[k][0]].v);
    if (s2 > 0) cable(JS_X, srcY(s2 - 1), JD_X, dstY(k), SRC_COL[s2 - 1], 1);
  }
  if (drag && drag.kind === "cable") cable(drag.x0, drag.y0, drag.x, drag.y, drag.src ? SRC_COL[drag.src - 1] : C.ink, 0.6);
  // SLICE / RANDOM patch / MAX / CLEAR
  pill(560, 151, 44, "SLICE", false, "cmd", "slice");
  pill(608, 151, 56, "RANDOM", false, "cmd", "random");
  rect(668, 151, 40, 12, C.line, false, 1); textC("MAX " + maxCables, 688, 160.2, 7.5, C.ink, true);
  hit({ x: 668, y: 151, w: 40, h: 12, kind: "max", name: "maxcables" });
  pill(712, 151, 50, "CLEAR", false, "cmd", "clear");
  fitHelp(160, 163, 390);
}
function cable(x1, y1, x2, y2, c, a) {
  col(c, a); mgraphics.set_line_width(2);
  var sag = 10 + Math.abs(x2 - x1) * 0.08;
  mgraphics.move_to(x1, y1);
  mgraphics.curve_to(x1 + (x2 - x1) * 0.35, y1 + sag, x1 + (x2 - x1) * 0.65, y2 + sag, x2, y2);
  mgraphics.stroke();
}
function drawSeq(x, y, w, h) {
  var cw = w / 16, len = Math.round(P.sq_len.v);
  for (var i = 0; i < 16; i++) {
    var cx = x + i * cw, inLen = i < len, on = stepOn(i), v = stepVal(i);
    rect(cx + 0.5, y, cw - 1.5, h, inLen ? C.ink : C.line, false, 1, inLen ? 1 : 0.6);
    if (on) rect(cx + 1.5, y + h - 1 - v * (h - 2), cw - 3.5, Math.max(1.5, v * (h - 2)), inLen ? SRC_COL[5] : C.line, true);
    if (i === seqPos && running) rect(cx + 0.5, y - 3, cw - 1.5, 2, C.accent, true);
    if (i % 4 === 0) line(cx, y + h + 1, cx, y + h + 3, C.mid);
    hit({ x: cx, y: y, w: cw, h: h, kind: "step", name: "sq" + i, step: i, top: y, h2: h });
  }
}
function fitHelp(x, y, w) {
  var s = hoverHelp(), fs = 7.5;
  while (tw(s, fs, !!hover) > w && s.length > 8) s = s.substring(0, s.length - 2);
  text(s, x, y, fs, hover ? C.ink : C.mid, !!hover);
}
// ---------- making sound quickly: DICE (recipes), BACK, smart RANDOM, CV amounts ----------
var history = [];
function rr(a, b) { return a + Math.random() * (b - a); }
function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
function pitchKnob(st) { var iv = [0, 1, 3, 4, 7, 12, 24], k = iv.indexOf(Math.abs(st)); return Math.round((((st < 0 ? -1 : 1) * (k + 0.15) / 6) + 1) / 2 * 1000) / 1000; }
var CV_AMOUNT = { time: 0.85, size: 0.8, shape: 0.8, pitch: 0.8 };   // RND knob → CV amount when a cable is patched
var SAFE_KEYS = null;
function soundKeys() {   // everything DICE may set (not IN / OUT / AUTO)
  if (SAFE_KEYS) return SAFE_KEYS;
  SAFE_KEYS = [];
  // not IN / OUT / AUTO / SEED, and not the quality (a change clears the buffer, like the module)
  for (var k in P) if (k !== "input" && k !== "output" && k !== "agc" && k !== "seed" && k !== "quality") SAFE_KEYS.push(k);
  return SAFE_KEYS;
}
function snapshot() { var o = {}, keys = soundKeys(); for (var i = 0; i < keys.length; i++) o[keys[i]] = P[keys[i]].v; return o; }
function applySet(set) { for (var k in set) send(k, Math.round(set[k] * 1000) / 1000); }
// each recipe = a known-good region of the knobs + a matching patch; values random inside it
var RECIPES = {
  CLOUD: function () { return { density: rr(0.08, 0.18), size: rr(0.58, 0.7), shape: rr(0.5, 0.75), time: rr(0.05, 0.35), time_amt: rr(0.75, 0.9), pitch: pitchKnob(pickOne([0, 0, 12, -12])), pitch_amt: rr(0.55, 0.62), reverb: rr(0.3, 0.55), drywet: rr(0.7, 0.9), feedback: rr(0, 0.25) }; },
  SHIMMER: function () { return { density: rr(0.06, 0.12), size: rr(0.62, 0.75), shape: rr(0.6, 0.8), time: rr(0.02, 0.12), time_amt: rr(0.6, 0.75), pitch: pitchKnob(pickOne([12, 7, 24])), pitch_amt: rr(0.5, 0.55), feedback: rr(0.35, 0.6), reverb: rr(0.6, 0.85), drywet: rr(0.75, 0.9) }; },
  "REVERSE SWELLS": function () { return { density: rr(0.68, 0.8), size: rr(0.04, 0.12), shape: rr(0.85, 1), time: rr(0.1, 0.6), time_amt: rr(0.8, 1), pitch: pitchKnob(pickOne([0, -12, 12])), pitch_amt: rr(0.5, 0.6), reverb: rr(0.4, 0.7), drywet: rr(0.8, 1) }; },
  STUTTER: function () { return { seedlatch: 0, density: 0.5, dst_seed: 5, ck_sync: 1, ck_rate: pickOne([10, 12, 11, 13]) / 14, size: rr(0.42, 0.52), shape: rr(0, 0.25), time: rr(0.01, 0.08), pitch: pitchKnob(pickOne([0, 0, 12])), reverb: rr(0.15, 0.35), drywet: rr(0.85, 1) }; },
  SLICER: function () {
    var o = { seedlatch: 0, density: 0.5, dst_seed: 6, dst_time: 6, time: 0, time_amt: 1, sq_div: pickOne([12, 12, 10, 13]), sq_len: pickOne([16, 16, 12, 8, 7, 5]), size: rr(0.62, 0.7), shape: rr(0.0, 0.2), reverb: rr(0.1, 0.3), drywet: rr(0.9, 1) };
    // slices from the last ~1.6 s (the material that is playing now), on 1 + ~60 % of the steps
    for (var i = 0; i < 16; i++) { var v = Math.round(rr(0, 0.4) * 32) / 32; o["sq" + i] = (i % 4 === 0 || Math.random() < 0.5) ? v : stepCode(false, v); }
    return o;
  },
  RAIN: function () { return { density: rr(0.75, 0.9), size: rr(0.45, 0.55), shape: rr(0.3, 0.5), time: rr(0.05, 0.4), time_amt: rr(0.85, 1), pitch: pitchKnob(pickOne([0, 12])), pitch_amt: rr(0.75, 0.95), reverb: rr(0.35, 0.6), drywet: rr(0.6, 0.8) }; },
  DRONE: function () { return { density: rr(0.02, 0.07), size: rr(0.78, 0.88), shape: rr(0.55, 0.7), time: rr(0.2, 0.6), time_amt: rr(0.6, 0.75), pitch: pitchKnob(pickOne([0, -12, -12, 7])), pitch_amt: rr(0.5, 0.55), feedback: rr(0.2, 0.45), reverb: rr(0.55, 0.8), drywet: rr(0.85, 1) }; },
  WOBBLE: function () { return { density: rr(0.08, 0.15), size: rr(0.55, 0.65), shape: rr(0.55, 0.7), time: rr(0.05, 0.3), time_amt: 0.75, dst_pitch: 1, l1_sync: 1, l1_rate: pickOne([2, 3, 4]) / 14, l1_shape: pickOne([0, 1]), pitch_amt: CV_AMOUNT.pitch, dst_size: 3, size_amt: CV_AMOUNT.size, rn_rate: rr(0.4, 0.6), reverb: rr(0.3, 0.5), drywet: rr(0.8, 0.95) }; }
};
// one randomizer: SOUND = a recipe, MOD = a random patch, ALL = both; BACK undoes any of them
function diceButton() {
  if (diceMode === 0) dice();
  else if (diceMode === 1) { randomPatch(); lastRecipe = "RANDOM PATCH"; }
  else { dice(); randomPatch(true); lastRecipe += " + PATCH"; }
  dirty = true;
}
// SLICE: one click = the sequencer cuts the recording into rhythmic slices (SEQ -> TRIGGER and TIME)
function slice() {
  history.push(snapshot()); if (history.length > 16) history.shift();
  var o = RECIPES.SLICER();
  for (var k in o) send(k, Math.round(o[k] * 1000) / 1000);
  lastRecipe = "SLICE"; dirty = true;
}
var RECIPE_NAMES = []; (function () { for (var k in RECIPES) RECIPE_NAMES.push(k); })();
var lastRecipe = "";
function dice(name) {
  history.push(snapshot()); if (history.length > 16) history.shift();
  var r = name && RECIPES[name] ? name : pickOne(RECIPE_NAMES);
  lastRecipe = r;
  // start from the defaults (no cables, no freeze, LATCH on), then the recipe
  var set = {}, keys = soundKeys();
  for (var i = 0; i < keys.length; i++) set[keys[i]] = P[keys[i]].d;
  var o = RECIPES[r]();
  for (var k in o) set[k] = o[k];
  applySet(set);
  dirty = true;
  return r;
}
function back() { if (history.length) { applySet(history.pop()); lastRecipe = ""; dirty = true; } }
// plugging a cable into TIME / SIZE / SHAPE / PITCH: Beads turns the RND knob into the CV amount;
// a knob left at the centre would mean "no effect" → set a working amount
// LATCH off + nothing in SEED = no grains at all (the module waits for SEED). After a change of the
// SEED cable, if that would be the result, switch LATCH back on and leave the 12 o'clock dead zone.
function ensureGrains(seedSrc) {
  if (seedSrc > 0) return;
  if (P.seedlatch.v < 0.5) send("seedlatch", 1);
  if (P.density.v > 0.46 && P.density.v < 0.54) send("density", P.density.d);
}
function patchCable(dst, src) {
  send(dst, src);
  if (dst === "dst_seed") ensureGrains(src);
  var base = dst.replace("dst_", "");
  if (src > 0 && CV_AMOUNT[base] !== undefined && Math.abs(P[base + "_amt"].v - 0.5) < 0.08) send(base + "_amt", CV_AMOUNT[base]);
}
// RANDOM: musical rules — rhythm (CLOCK / SEQ) is the only thing that goes into SEED (and then LATCH
// off, DENSITY 12h: one grain per pulse); FREEZE is never patched at random; continuous sources go
// to TIME / PITCH / SIZE / SHAPE (with a working CV amount), DENSITY (limited depth) and the mix.
function randomPatch(noHistory) {
  if (!noHistory) { history.push(snapshot()); if (history.length > 16) history.shift(); }
  var i, n = 1 + Math.floor(Math.random() * maxCables), dests = ["time", "pitch", "size", "shape", "density", "feedback", "reverb", "drywet", "seed"];
  for (i = 0; i < DST.length; i++) send("dst_" + DST[i][0], 0);
  ensureGrains(0);   // a fresh patch starts from running grains; SEED (if chosen below) changes that
  for (i = dests.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = dests[i]; dests[i] = dests[j]; dests[j] = t; }
  for (i = 0; i < Math.min(n, dests.length); i++) {
    var dname = dests[i], dkey = "dst_" + dname;
    if (dname === "seed") {
      var src = pickOne([5, 6]);
      send(dkey, src); send("seedlatch", 0); send("density", 0.5);
      if (src === 5) send("ck_sync", 1);
      var on = 0; for (var q = 0; q < Math.round(P.sq_len.v); q++) if (stepOn(q)) on++;
      if (src === 6 && on < 3) for (q = 0; q < 16; q++) send("sq" + q, stepCode(q % 4 === 0 || Math.random() < 0.35, rr(0, 0.8)));
    } else {
      // loudness destinations (feedback / reverb / dry-wet / density) only get smooth sources: a square /
      // saw LFO, STEPS random, CLOCK or SEQ there makes the level jump = clicks
      var smoothOnly = dname === "feedback" || dname === "reverb" || dname === "drywet" || dname === "density";
      var s2 = smoothOnly ? pickOne([1, 2, 3, 3, 4]) : pickOne([1, 2, 3, 3, 4, 6]);
      send(dkey, s2);
      if (smoothOnly && (s2 === 1 || s2 === 2) && P["l" + s2 + "_shape"].v > 1.5) send("l" + s2 + "_shape", pickOne([0, 1]));
      if (smoothOnly && s2 === 3) send("rn_smooth", 1);
      if (CV_AMOUNT[dname] !== undefined) send(dname + "_amt", CV_AMOUNT[dname]);
      if (dname === "density") send("dn_amt", rr(0.15, 0.35));
      if (dname === "feedback") send("fb_amt", rr(0.2, 0.5));
      if (dname === "reverb") send("rv_amt", rr(0.3, 0.6));
      if (dname === "drywet") send("dw_amt", rr(0.2, 0.4));
    }
  }
}
var t0 = new Date().getTime();
function pulseOn() { return Math.floor((new Date().getTime() - t0) / 600) % 2 === 0; }
function gainBox(x, y, name, label) {
  text(label, x, y + 11, 7, C.mid, true);
  rect(x + 24, y, 58, 16, C.ink, false, 1);
  textC(valueText(name), x + 53, y + 11, 7.5, C.ink, true);
  hit({ x: x + 24, y: y, w: 58, h: 16, kind: "knob", name: name });
}
function drawTape(x, y, w, h) {
  rect(x, y, w, h, C.bg, true);
  rect(x, y, w, h, C.line, false, 1);
  var secs = bufSeconds();
  text("TAPE   now  <  " + secs + " s ago      grains " + tapeSt.active + " / 32", x + 4, y + 10, 7, C.mid, true);
  if (tapeFill < 0.999 && P.time.v > tapeFill + 0.02) text("recording...", x + w - 58, y + 10, 7, PINK, true);
  // second marks under the tape area
  var step = secs > 9 ? 4 : secs > 5 ? 2 : 1;
  for (var t = step; t < secs; t += step) {
    var sx = x + 2 + t / secs * (w - 6);
    line(sx, y + h - 6, sx, y + h - 2, C.mid, 1, 0.6);
    text(t + "s", sx + 1.5, y + h - 2.5, 7, C.mid);
  }
  // record head at the left edge: "now"; older material to the right
  line(x + 2, y + 13, x + 2, y + h - 3, C.accent, 2);
  // not recorded yet (after loading): the grains there play silence
  if (tapeFill < 0.999) {
    var fx = x + 2 + tapeFill * (w - 6);
    rect(fx, y + 13, x + w - 2 - fx, h - 16, C.panel, true);
  }
  if (P.freeze.v > 0.5) textC("FROZEN", x + w / 2, y + h - 12, 8, C.accent, true);
  if (engineStopped()) {
    rect(x + 1, y + 13, w - 2, h - 14, C.ink, true, 1, 0.85);
    textC("ENGINE NOT RUNNING", x + w / 2, y + 28, 8.5, C.bg, true);
    textC("Live audio off, or a gen~ error - see Max Console", x + w / 2, y + 41, 7, C.bg);
  }
  // TIME window
  var tx = x + 2 + P.time.v * (w - 6);
  line(tx, y + 13, tx, y + h - 8, C.ink, 1, 0.5);
  // grains: higher = pitched up, pink = reversed
  for (var i = 0; i < grains.length; i++) {
    var g = grains[i], gx = x + 2 + g.pos * (w - 6), gy = y + h / 2 + 3 - Math.max(-9, Math.min(9, Math.log(Math.abs(g.spd) || 1) / Math.LN2 * 4.5));
    circle(gx, gy, 3 + g.age * 0.15, g.spd < 0 ? PINK : C.accent, true, 1, Math.max(0, 1 - g.age / 24));
  }
}
var tapeFill = 1;
function fill(v) { tapeFill = +v; dirty = true; }
var HELP = {
  time: "TIME: where the grains start in the recorded buffer - fresh (left) to old (right)",
  density: "DENSITY: grain rate - CCW even, CW random; 12 o'clock = slowest grains (AUTO GRAINS) / 1 grain per TRIGGER",
  pitch: "PITCH: transposition +-24 st with notches at 1, 3, 4, 7, 12, 24",
  size: "SIZE: grain length - CCW reversed grains, CW longer (up to 4 s)",
  shape: "SHAPE: grain envelope - square (CCW) > decay > bell > slow attack (CW)",
  time_amt: "SPREAD: random variation per grain - CW even, CCW mostly close, sometimes far. With a cable: DEPTH of the modulation",
  pitch_amt: "SPREAD: random variation per grain - CW even, CCW mostly close, sometimes far. With a cable: DEPTH of the modulation",
  size_amt: "SPREAD: random variation per grain - CW even, CCW mostly close, sometimes far. With a cable: DEPTH of the modulation",
  shape_amt: "SPREAD: random variation per grain - CW even, CCW mostly close, sometimes far. With a cable: DEPTH of the modulation",
  feedback: "FEEDBACK: output fed back into the recording (limited)",
  drywet: "DRY/WET: input vs grains",
  reverb: "REVERB: amount and length of the reverb",
  input: "IN: input gain (drag) - or AUTO",
  output: "OUT: output gain",
  freeze: "FREEZE: stop recording - the grains keep playing what is in the buffer",
  seed: "TRIGGER: hold = grains · tap at 12h = one grain · tap with AUTO GRAINS = off · hold 4 s = AUTO GRAINS on",
  seedlatch: "AUTO GRAINS: grains are generated all the time at the DENSITY rate (off = only while TRIGGER is held)",
  dice: "DICE: SOUND = a recipe, MOD = a random patch, ALL = both (choose with the button on the right)",
  back: "BACK: undo the last DICE / RANDOM / SLICE",
  agc: "AUTO: the engine hears a level-matched input (up to +32 dB); the output stays at the input level",
  learn: "LEARN: learn the input level again (play the source)", dn_amt: "DENSITY DEPTH: how far the cable moves DENSITY",
  tab_SOUND: "SOUND: the sound controls", tab_MOD: "MOD: modulators and the patch matrix",
  l1_rate: "LFO 1 RATE: Hz, or a tempo division when SYNC is on", l2_rate: "LFO 2 RATE: Hz, or a tempo division when SYNC is on",
  l1_sync: "SYNC: lock to Live's tempo and bar", l2_sync: "SYNC: lock to Live's tempo and bar", rn_sync: "SYNC: lock to Live's tempo and bar", ck_sync: "SYNC: clock divisions of Live's tempo (else Hz)",
  l1_shape: "SHAPE: sine / triangle / saw / square (click)", l2_shape: "SHAPE: sine / triangle / saw / square (click)",
  l1_reset: "R: restart the LFO when Live starts playing", l2_reset: "R: restart the LFO when Live starts playing",
  l1_amt: "AMT: LFO level", l2_amt: "AMT: LFO level", rn_amt: "AMT: random level",
  rn_rate: "RANDOM RATE: how often a new random value is chosen", rn_smooth: "SMOOTH glides between random values, STEPS jumps",
  env_gain: "ENV GAIN: input level follower x0.25 ... x16",
  ck_rate: "CLOCK: pulses at a tempo division (SYNC) or in Hz - into SEED for rhythmic grains",
  sq_div: "SEQ RATE: step length (drag) - 1/16 = sixteenth notes", sq_len: "SEQ LENGTH: 1 ... 16 steps (drag)",
  step: "STEP: click = on/off, drag up/down = value (into TIME = which slice, into PITCH = transposition)",
  style: "click the logo: switch the panel look (Ableton / live hardware / cartoon)",
  jack_src: "drag from a source to a destination to patch a cable", jack_dst: "drag to a source to patch · click a patched jack = remove the cable",
  random: "RANDOM: a random patch with up to MAX cables", maxcables: "MAX: drag = maximum number of cables for RANDOM", clear: "CLEAR: remove all cables",
  fb_amt: "FEEDBACK DEPTH: how far the cable moves FEEDBACK (drag)", dw_amt: "DRY/WET DEPTH: how far the cable moves DRY/WET (drag)", rv_amt: "REVERB DEPTH: how far the cable moves REVERB (drag)",
  dicemode: "what DICE changes: SOUND / MOD / ALL (click)", slice: "SLICE: one click - the sequencer cuts the recording into rhythmic slices (SEQ -> TRIGGER + TIME)",
  dst_freeze: "Freeze: freezes while the source is high", dst_seed: "Trigger: gate/clock input - AUTO GRAINS on: DENSITY divides (CCW) or thins (CW) the pulses; off: grains while high",
  dst_time: "Time: the SPREAD knob under TIME becomes the DEPTH (CW) / random depth (CCW)", dst_pitch: "Pitch: +-12 st per unit, DEPTH = the knob under PITCH",
  dst_size: "Size: DEPTH = the knob under SIZE", dst_shape: "Shape: DEPTH = the knob under SHAPE", dst_density: "Density CV: linear in the middle, exponential FM near the ends",
  dst_feedback: "Feedback CV x amount", dst_reverb: "Reverb CV x amount", dst_drywet: "Dry/Wet CV x amount"
};
function hoverHelp() {
  var k = hover;
  if (k && /^sq\d+$/.test(k)) {
    var si = +k.substring(2), on = stepOn(si), v = stepVal(si);
    return "STEP " + (si + 1) + ": " + (on ? "on, value " + Math.round(v * 100) + "%  (into TIME: " + (Math.round(v * bufSeconds() * 10) / 10) + " s back)" : "off") + "  ·  click = on/off, drag = value";
  }
  if (k && /^src\d$/.test(k)) k = "jack_src";
  if (k && /^quality_\d$/.test(k)) return QUAL[+k.charAt(8)][1] + (P.freeze.v > 0.5 ? "  (unfreeze to change)" : "");
  return k && HELP[k] ? HELP[k] : "drag knobs up/down · shift = fine · double-click = default · hover = help";
}

// ---------- interaction ----------
function find(x, y) { for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }
function send(name, v) { outlet(0, name, v); }
function norm(name, v) { var q = P[name]; return q.lo !== undefined ? (v - q.lo) / (q.hi - q.lo) : v; }
function denorm(name, n) {
  var q = P[name];
  if (q.int) return Math.round(q.lo + n * (q.hi - q.lo));
  return q.lo !== undefined ? Math.round((q.lo + n * (q.hi - q.lo)) * 10) / 10 : Math.round(n * 1000) / 1000;
}
function onclick(x, y, but, cmd, shift) {
  x /= scaleF; y /= scaleF;
  var h = find(x, y); if (!h) return;
  if (h.kind === "toggle") {
    send(h.name, P[h.name].v > 0.5 ? 0 : 1);
    if (h.name === "agc" && P.agc.v < 0.5) { learnCount++; outlet(0, "agc_restart", learnCount); }   // AUTO on = learn afresh
  }
  else if (h.kind === "momentary") {
    if (h.name === "seed" && P.seedlatch.v > 0.5) send("seedlatch", 0);   // short press unlatches (Beads)
    send(h.name, 1);
    drag = { kind: "momentary", name: h.name, t0: now() };
  }
  else if (h.kind === "knob") {
    if (h.name === "input" && P.agc.v > 0.5) {   // like Beads: turning the gain by hand = manual gain from the current value
      send("agc", 0);
      P.input.v = 0;   // manual from 0 dB (AUTO compensates its gain at the output; manual does not)
    }
    drag = { kind: "knob", name: h.name, y0: y, n0: norm(h.name, P[h.name].v) };
  }
  else if (h.kind === "tab") { tab = h.tab; showNative(); dirty = true; }
  else if (h.kind === "cycle") send(h.name, (Math.round(P[h.name].v) + 1) % h.n);
  else if (h.kind === "cmd") {
    if (h.name === "random") randomPatch();
    else if (h.name === "slice") slice();
    else if (h.name === "learn") { learnCount++; outlet(0, "agc_restart", learnCount); if (P.agc.v < 0.5) send("agc", 1); }
    else { for (var c = 0; c < DST.length; c++) send("dst_" + DST[c][0], 0); ensureGrains(0); }
  }
  else if (h.kind === "quality") { if (P.freeze.v < 0.5) send("quality", h.val); }
  else if (h.kind === "style") nextStyle();
  else if (h.kind === "dice") diceButton();
  else if (h.kind === "dicemode") { diceMode = (diceMode + 1) % 3; dirty = true; }
  else if (h.kind === "back") back();
  else if (h.kind === "max") drag = { kind: "max", y0: y, m0: maxCables };
  else if (h.kind === "step") drag = { kind: "step", name: h.name, step: h.step, top: h.top, h2: h.h2, y0: y, moved: false };
  else if (h.kind === "jack_src") drag = { kind: "cable", src: h.src, x0: JS_X, y0: srcY(h.src - 1), x: x, y: y };
  else if (h.kind === "jack_dst") {
    var cur = Math.round(P[h.name].v);
    if (cur > 0) { patchCable(h.name, 0); drag = { kind: "cable", src: cur, x0: JS_X, y0: srcY(cur - 1), x: x, y: y, fromDst: h.name }; }  // pick up the cable
    else drag = { kind: "cable", dst: h.name, x0: JD_X, y0: dstY(h.dst), x: x, y: y };
  }
}
function ondrag(x, y, but, cmd, shift) {
  if (!drag) return;
  x /= scaleF; y /= scaleF;
  if (drag.kind === "knob") {
    var n = Math.max(0, Math.min(1, drag.n0 + (drag.y0 - y) * (shift ? 0.0007 : 0.007)));
    send(drag.name, denorm(drag.name, n));
    if (shift) { drag.n0 = n; drag.y0 = y; }
  }
  if (drag.kind === "max") maxCables = Math.max(1, Math.min(10, drag.m0 + Math.round((drag.y0 - y) / 8)));
  if (drag.kind === "step") {
    if (Math.abs(y - drag.y0) > 2) drag.moved = true;
    if (drag.moved) send(drag.name, stepCode(true, Math.max(0, Math.min(1, (drag.top + drag.h2 - y) / drag.h2))));
  }
  if (drag.kind === "cable") { drag.x = x; drag.y = y; dirty = true; }
  if (!but) {
    if (drag.kind === "momentary") send(drag.name, 0);
    if (drag.kind === "step" && !drag.moved) send(drag.name, stepCode(!stepOn(drag.step), stepVal(drag.step)));
    if (drag.kind === "cable") dropCable(x, y);
    drag = null; dirty = true;
  }
}
function dropCable(x, y) {
  var h = find(x, y);
  if (drag.src && h && h.kind === "jack_dst") patchCable(h.name, drag.src);          // source → destination
  else if (drag.dst && h && h.kind === "jack_src") patchCable(drag.dst, h.src);       // destination → source
  // dropped anywhere else: no cable (a picked-up cable is removed)
}
function ondblclick(x, y) {
  x /= scaleF; y /= scaleF;
  var h = find(x, y); if (h && h.kind === "knob") send(h.name, P[h.name].d);
}
function onidle(x, y) { var h = find(x / scaleF, y / scaleF), k = h ? h.name : null; if (k !== hover) { hover = k; dirty = true; } }
function onidleout() { if (hover) { hover = null; dirty = true; } }
function onresize() { dirty = true; }
style(STYLE);
