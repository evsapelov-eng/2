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
  feedback: { v: 0.1, d: 0.1 }, drywet: { v: 0.7, d: 0.7 }, reverb: { v: 0.35, d: 0.35 }, agc: { v: 1, d: 1 },
  freeze: { v: 0, d: 0 }, seed: { v: 0, d: 0 }, seedlatch: { v: 1, d: 1 },
  input: { v: 0, d: 0, lo: -12, hi: 32 }, output: { v: 0, d: 0, lo: -24, hi: 12 }
};
// ---- MOD tab: sources, destinations (a destination takes one source, like a jack), modulators
var SRC = ["LFO 1", "LFO 2", "RANDOM", "ENV", "CLOCK", "SEQ"];
var SRC_COL = [[0.17, 0.30, 0.61, 1], [0.13, 0.52, 0.50, 1], [0.76, 0.22, 0.38, 1], [0.84, 0.55, 0.13, 1], [0.35, 0.35, 0.33, 1], [0.45, 0.30, 0.62, 1]];
var DST = [["freeze", "Freeze"], ["seed", "Seed"], ["time", "Time"], ["pitch", "Pitch"], ["size", "Size"], ["shape", "Shape"],
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
var BUF_S = 192000 / 48000;
var now = function () { return new Date().getTime(); };
function sr(v) { if (v > 0) { BUF_S = Math.round(192000 / v * 100) / 100; dirty = true; } }   // from [dspstate~]

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
  if (name === "time") return "-" + (Math.round(v * BUF_S * 10) / 10) + " s";
  if (name === "density") {
    if (v < 0.48) return (Math.round(130.81278 * Math.pow(2, -v * 16) * 10) / 10) + " /s even";
    if (v > 0.52) return "~" + (Math.round(0.5 * 130.81278 * Math.pow(2, -(1 - v) * 16) * 10) / 10) + " /s random";
    return P.seedlatch.v > 0.5 ? "no grains" : "1 per SEED";
  }
  if (name === "pitch") { var st = detune(v); return (st > 0 ? "+" : "") + (Math.round(st * 10) / 10) + " st"; }
  if (name === "size") return v > 0.99 ? "inf: delay v0.3" : (v < 0.3333333 ? "rev " : "") + fmtMs(grainMs(v));
  if (name === "shape") return v < 0.12 ? "square" : v < 0.3 ? "hold+decay" : v < 0.45 ? "decay" : v < 0.6 ? "smooth" : v < 0.85 ? "bell" : "slow attack";
  if (/^(time|pitch|size|shape)_amt$/.test(name)) {
    var a = attenu(v), routed = P["dst_" + name.split("_")[0]].v > 0.5;
    if (Math.abs(a) < 0.005) return "0";
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
function font(s, b) { mgraphics.select_font_face(b ? "Arial Bold" : "Arial"); mgraphics.set_font_size(s); }
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
var A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;   // 270° knob travel, 0 at 7:30
function knob(cx, cy, r, name, bipolar) {
  var v = P[name].v, a = A0 + (A1 - A0) * v, act = hover === name || (drag && drag.name === name);
  arc(cx, cy, r + 4, A0, A1, C.line, 3);
  if (bipolar) { var am = (A0 + A1) / 2; arc(cx, cy, r + 4, Math.min(am, a), Math.max(am, a), C.accent, 3); }
  else arc(cx, cy, r + 4, A0, a, C.accent, 3);
  circle(cx, cy, r, C.ink, true);
  circle(cx, cy, r * 0.62, C.panel, true);
  line(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98, C.panel, Math.max(2, r * 0.12));
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
  circle(cx, cy, r, on ? C.on : C.panel, true);
  circle(cx, cy, r, C.ink, false, 1.5);
  if (on) circle(cx, cy, r * 0.45, C.panel, true, 1, 0.9);
  textC(label, cx, cy + r + 12, 8, C.ink, true);
  hit({ x: cx - r - 2, y: cy - r - 2, w: 2 * r + 4, h: 2 * r + 4, kind: momentary ? "momentary" : "toggle", name: name });
}

function paint() {
  var sz = mgraphics.size;
  scaleF = Math.min(sz[0] / W0, sz[1] / H0); if (!(scaleF > 0)) scaleF = 1;
  mgraphics.scale(scaleF, scaleF);
  hits = [];
  rect(0, 0, W0, H0, C.bg, true);
  rect(3, 3, W0 - 6, H0 - 6, C.line, false, 1);
  // ---- left: logo, FREEZE / SEED, LATCH
  drawLogo(14, 30, 22);
  text("granular texture", 15, 42, 7, C.mid);
  for (var ti = 0; ti < 2; ti++) {
    var tn = ti ? "MOD" : "SOUND", tx0 = 14 + ti * 64, on = tab === tn;
    rect(tx0, 49, 60, 13, C.ink, on, 1);
    textC(tn, tx0 + 30, 59, 7, on ? C.panel : C.ink, true);
    hit({ x: tx0, y: 49, w: 60, h: 13, kind: "tab", name: "tab_" + tn, tab: tn });
  }
  roundButton(42, 82, 15, "FREEZE", P.freeze.v > 0.5, "freeze", false);
  roundButton(110, 82, 15, "SEED", P.seed.v > 0.5 || (P.seedlatch.v > 0.5 && pulseOn()), "seed", true);
  var lx = 14, ly = 120;
  rect(lx, ly, 126, 16, C.ink, P.seedlatch.v > 0.5, 1);
  textC(P.seedlatch.v > 0.5 ? "LATCH  ON  (continuous)" : "LATCH  OFF  (hold SEED)", lx + 63, ly + 11, 7, P.seedlatch.v > 0.5 ? C.panel : C.ink, true);
  hit({ x: lx, y: ly, w: 126, h: 16, kind: "toggle", name: "seedlatch" });
  rect(14, 141, 84, 17, C.accent, true);
  textC("DICE  new sound", 56, 153, 7.5, C.panel, true);
  hit({ x: 14, y: 141, w: 84, h: 17, kind: "dice", name: "dice" });
  rect(102, 141, 38, 17, C.ink, false, 1, history.length ? 1 : 0.3);
  textC("BACK", 121, 153, 7, history.length ? C.ink : C.line, true);
  if (history.length) hit({ x: 102, y: 141, w: 38, h: 17, kind: "back", name: "back" });
  line(152, 12, 152, H0 - 12, C.line);
  if (tab === "MOD") { paintMod(); return; }
  // ---- big knobs
  for (var i = 0; i < BIG.length; i++) {
    var b = BIG[i], cx = KX[i];
    textC(b[1], cx, 18, 9, C.ink, true);
    knob(cx, KY, KR, b[0], b[0] === "pitch");
    textC(valueText(b[0]), cx, 98, 8.5, C.ink, true);
    textC(b[2], cx, 109, 6, C.mid);
    if (b[0] === "density") {
      textC("even  <  12h  >  random", cx, 132, 6, C.mid);
      textC("12h = off (latched)", cx, 142, 6, C.mid);
    } else {
      var an = b[0] + "_amt";
      knob(cx, 131, 8, an, true);
      text(P["dst_" + b[0]].v > 0.5 ? "CV" : "RND", cx + 14, 129, 6, P["dst_" + b[0]].v > 0.5 ? C.accent : C.mid, true);
      text(valueText(an), cx + 14, 138, 6, C.ink);
    }
  }
  line(586, 12, 586, H0 - 12, C.line);
  // ---- mix
  for (var m = 0; m < MIX.length; m++) {
    var mx = 626 + m * 66;
    textC(MIX[m][1], mx, 18, 8, C.ink, true);
    knob(mx, 44, 15, MIX[m][0], false);
    textC(valueText(MIX[m][0]), mx, 76, 8, C.ink, true);
  }
  gainBox(812, 18, "input", "IN");
  pill(836, 37, 26, "AUTO", P.agc.v > 0.5, "toggle", "agc");
  pill(864, 37, 30, agcLearning ? "..." : "LEARN", agcLearning > 0, "cmd", "learn");
  gainBox(812, 58, "output", "OUT");
  // ---- tape: record head + where the grains start
  drawTape(598, 90, 290, 58);
  text(hoverHelp(), 160, 162, 6.5, hover ? C.ink : C.mid, !!hover);
}
// ================= MOD tab =================
var JS_X = 575, JD_X = 790;
function srcY(i) { return 26 + i * 23; }
function dstY(j) { return 14 + j * 14.2; }
// small knob for the MOD tab: thin ring, fits in a 14 px row
function smallKnob(cx, cy, name) {
  var v = norm(name, P[name].v), a = A0 + (A1 - A0) * v, act = hover === name || (drag && drag.name === name);
  arc(cx, cy, 6, A0, A1, C.line, 2);
  arc(cx, cy, 6, A0, a, C.accent, 2);
  circle(cx, cy, 3.2, C.ink, true);
  line(cx + Math.cos(a) * 2, cy + Math.sin(a) * 2, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, C.ink, 1.5);
  if (act) circle(cx, cy, 8.5, C.accent, false, 1, 0.5);
  hit({ x: cx - 8, y: cy - 8, w: 16, h: 16, kind: "knob", name: name });
}
// thin horizontal amount bar (FEEDBACK / DRY-WET / REVERB CV amounts next to their jacks)
function amountBar(x, y, w, name) {
  rect(x, y - 3, w, 6, C.line, true);
  rect(x, y - 3, w * P[name].v, 6, C.accent, true);
  hit({ x: x - 2, y: y - 6, w: w + 4, h: 12, kind: "knob", name: name });
}
function pill(x, y, w, label, on, kind, name, extra) {
  rect(x, y, w, 12, C.ink, on, 1);
  textC(label, x + w / 2, y + 9, 6.5, on ? C.panel : C.ink, true);
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
  text("MODULATORS", 160, 13, 7, C.mid, true);
  text(running ? "PLAYING (synced to Live)" : "Live stopped: synced sources wait", 260, 13, 6.5, running ? C.accent : C.mid);
  for (var i = 0; i < 6; i++) {
    var y = srcY(i);
    text(SRC[i], 160, y + 3, 7.5, C.ink, true);
    if (i < 2) {
      var pre = "l" + (i + 1) + "_";
      smallKnob(222, y, pre + "rate"); text(valueText(pre + "rate"), 233, y + 3, 6.5, C.ink);
      pill(282, y - 6, 28, "SYNC", P[pre + "sync"].v > 0.5, "toggle", pre + "sync");
      rect(314, y - 6, 34, 12, C.ink, false, 1); shapeIcon(317, y - 4, 28, 8, Math.round(P[pre + "shape"].v));
      hit({ x: 314, y: y - 6, w: 34, h: 12, kind: "cycle", name: pre + "shape", n: 4 });
      pill(352, y - 6, 14, "R", P[pre + "reset"].v > 0.5, "toggle", pre + "reset");
      smallKnob(384, y, pre + "amt"); text("AMT " + pct(P[pre + "amt"].v), 395, y + 3, 6.5, C.ink);
    } else if (i === 2) {
      smallKnob(222, y, "rn_rate"); text(valueText("rn_rate"), 233, y + 3, 6.5, C.ink);
      pill(282, y - 6, 28, "SYNC", P.rn_sync.v > 0.5, "toggle", "rn_sync");
      pill(314, y - 6, 42, P.rn_smooth.v > 0.5 ? "SMOOTH" : "STEPS", P.rn_smooth.v > 0.5, "toggle", "rn_smooth");
      smallKnob(384, y, "rn_amt"); text("AMT " + pct(P.rn_amt.v), 395, y + 3, 6.5, C.ink);
    } else if (i === 3) {
      smallKnob(222, y, "env_gain"); text("GAIN " + valueText("env_gain"), 233, y + 3, 6.5, C.ink);
      text("follows the input level", 300, y + 3, 6.5, C.mid);
    } else if (i === 4) {
      smallKnob(222, y, "ck_rate"); text(valueText("ck_rate"), 233, y + 3, 6.5, C.ink);
      pill(282, y - 6, 28, "SYNC", P.ck_sync.v > 0.5, "toggle", "ck_sync");
      text("pulses -> SEED: LATCH on = DENSITY divides / thins them", 316, y + 3, 6, C.mid);
    } else {
      rect(202, y - 7, 34, 14, C.ink, false, 1); textC(valueText("sq_div"), 219, y + 3, 6.5, C.ink, true);
      hit({ x: 202, y: y - 7, w: 34, h: 14, kind: "knob", name: "sq_div" });
      rect(240, y - 7, 22, 14, C.ink, false, 1); textC(valueText("sq_len"), 251, y + 3, 6.5, C.ink, true);
      hit({ x: 240, y: y - 7, w: 22, h: 14, kind: "knob", name: "sq_len" });
      drawSeq(268, y - 10, 290, 20);
    }
    // source jack
    circle(JS_X, y, 5, C.panel, true); circle(JS_X, y, 5, SRC_COL[i], false, 2); circle(JS_X, y, 1.8, SRC_COL[i], true);
    hit({ x: JS_X - 8, y: y - 8, w: 16, h: 16, kind: "jack_src", name: "src" + i, src: i + 1 });
  }
  // destinations
  for (var j = 0; j < DST.length; j++) {
    var dy = dstY(j), dn = "dst_" + DST[j][0], si = Math.round(P[dn].v);
    circle(JD_X, dy, 5, C.panel, true); circle(JD_X, dy, 5, si ? SRC_COL[si - 1] : C.ink, false, si ? 2 : 1.2);
    if (si) circle(JD_X, dy, 1.8, SRC_COL[si - 1], true);
    text(DST[j][1], 800, dy + 3, 7, C.ink, si > 0);
    hit({ x: JD_X - 8, y: dy - 7, w: 60, h: 14, kind: "jack_dst", name: dn, dst: j });
    var an = { feedback: "fb_amt", drywet: "dw_amt", reverb: "rv_amt", density: "dn_amt" }[DST[j][0]];
    if (an) amountBar(852, dy, 30, an);
  }
  // cables (drawn last, on top)
  for (var k = 0; k < DST.length; k++) {
    var s2 = Math.round(P["dst_" + DST[k][0]].v);
    if (s2 > 0) cable(JS_X, srcY(s2 - 1), JD_X, dstY(k), SRC_COL[s2 - 1], 1);
  }
  if (drag && drag.kind === "cable") cable(drag.x0, drag.y0, drag.x, drag.y, drag.src ? SRC_COL[drag.src - 1] : C.ink, 0.6);
  // RANDOM patch / MAX / CLEAR
  pill(596, 152, 56, "RANDOM", false, "cmd", "random");
  rect(656, 152, 40, 12, C.ink, false, 1); textC("MAX " + maxCables, 676, 161, 6.5, C.ink, true);
  hit({ x: 656, y: 152, w: 40, h: 12, kind: "max", name: "maxcables" });
  pill(700, 152, 50, "CLEAR", false, "cmd", "clear");
  fitHelp(160, 162, 420);
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
  var s = hoverHelp(), fs = 6.5;
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
  for (var k in P) if (k !== "input" && k !== "output" && k !== "agc" && k !== "seed") SAFE_KEYS.push(k);
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
  RAIN: function () { return { density: rr(0.75, 0.9), size: rr(0.4, 0.5), shape: rr(0.3, 0.5), time: rr(0.05, 0.4), time_amt: rr(0.85, 1), pitch: pitchKnob(pickOne([0, 12])), pitch_amt: rr(0.75, 0.95), reverb: rr(0.35, 0.6), drywet: rr(0.8, 1) }; },
  DRONE: function () { return { density: rr(0.02, 0.07), size: rr(0.78, 0.88), shape: rr(0.55, 0.7), time: rr(0.2, 0.6), time_amt: rr(0.6, 0.75), pitch: pitchKnob(pickOne([0, -12, -12, 7])), pitch_amt: rr(0.5, 0.55), feedback: rr(0.2, 0.45), reverb: rr(0.55, 0.8), drywet: rr(0.85, 1) }; },
  WOBBLE: function () { return { density: rr(0.08, 0.15), size: rr(0.55, 0.65), shape: rr(0.55, 0.7), time: rr(0.05, 0.3), time_amt: 0.75, dst_pitch: 1, l1_sync: 1, l1_rate: pickOne([2, 3, 4]) / 14, l1_shape: pickOne([0, 1]), pitch_amt: CV_AMOUNT.pitch, dst_size: 3, size_amt: CV_AMOUNT.size, rn_rate: rr(0.4, 0.6), reverb: rr(0.3, 0.5), drywet: rr(0.8, 0.95) }; }
};
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
function randomPatch() {
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
      var s2 = pickOne([1, 2, 3, 3, 4, 6]);
      send(dkey, s2);
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
  rect(x, y, w, h, C.panel, true);
  rect(x, y, w, h, C.line, false, 1);
  text("TAPE  (now  >  " + BUF_S + " s ago)   grains " + tapeSt.active + " / 32", x + 4, y + 10, 6, C.mid, true);
  // record head at the left edge: "now"; older material to the right
  line(x + 2, y + 14, x + 2, y + h - 3, C.accent, 2);
  if (P.freeze.v > 0.5) textC("FROZEN", x + w / 2, y + h - 6, 7, C.accent, true);
  if (engineStopped()) {
    rect(x + 1, y + 14, w - 2, h - 15, C.ink, true, 1, 0.85);
    textC("ENGINE NOT RUNNING", x + w / 2, y + 30, 8, C.panel, true);
    textC("Live audio off, or a gen~ error - see Max Console", x + w / 2, y + 44, 6.5, C.panel);
  }
  // TIME window
  var tx = x + 2 + P.time.v * (w - 6);
  line(tx, y + 14, tx, y + h - 3, C.ink, 1, 0.5);
  for (var i = 0; i < grains.length; i++) {
    var g = grains[i], gx = x + 2 + g.pos * (w - 6), gy = y + h / 2 + 6 - Math.max(-10, Math.min(10, Math.log(Math.abs(g.spd) || 1) / Math.LN2 * 5));
    circle(gx, gy, 3 + g.age * 0.15, g.spd < 0 ? C.ink : C.accent, true, 1, Math.max(0, 1 - g.age / 24));
  }
}
var HELP = {
  time: "TIME: where the grains start in the recorded buffer - fresh (left) to old (right)",
  density: "DENSITY: grain rate - CCW even, CW random; 12 o'clock = none (latched) / 1 per SEED",
  pitch: "PITCH: transposition +-24 st with notches at 1, 3, 4, 7, 12, 24",
  size: "SIZE: grain length - CCW reversed grains, CW longer up to 4 s; fully CW = delay mode (coming in v0.3)",
  shape: "SHAPE: grain envelope - square (CCW) > decay > bell > slow attack (CW)",
  time_amt: "RND: CW even spread inside a window - CCW mostly close, sometimes far (peaky)",
  pitch_amt: "RND: CW even spread inside a window - CCW mostly close, sometimes far (peaky)",
  size_amt: "RND: CW even spread inside a window - CCW mostly close, sometimes far (peaky)",
  shape_amt: "RND: CW even spread inside a window - CCW mostly close, sometimes far (peaky)",
  feedback: "FEEDBACK: output fed back into the recording (limited)",
  drywet: "DRY/WET: input vs grains",
  reverb: "REVERB: amount and length of the reverb",
  input: "IN: input gain - AUTO or drag for manual (the grains record what they hear)",
  output: "OUT: output gain",
  freeze: "FREEZE: stop recording - the grains keep playing what is in the buffer",
  seed: "SEED: hold = grains (LATCH off) · tap = 1 grain at 12h · tap while latched = LATCH off · hold 4 s = LATCH on",
  seedlatch: "LATCH: grains are generated continuously at the DENSITY rate",
  dice: "DICE: a new sound from a recipe (cloud, shimmer, reverse swells, stutter, slicer, rain, drone, wobble)",
  back: "BACK: the sound before the last DICE",
  agc: "AUTO: input gain learns the level (6 s) and lifts quiet sources up to +32 dB (like the original)",
  learn: "LEARN: learn the input level again (play the source)", dn_amt: "DENSITY CV amount",
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
  jack_src: "drag from a source to a destination to patch a cable", jack_dst: "drag to a source to patch · click a patched jack = remove the cable",
  random: "RANDOM: a random patch with up to MAX cables", maxcables: "MAX: drag = maximum number of cables for RANDOM", clear: "CLEAR: remove all cables",
  fb_amt: "FEEDBACK CV amount (Beads assignable CV)", dw_amt: "DRY/WET CV amount (Beads assignable CV)", rv_amt: "REVERB CV amount (Beads assignable CV)",
  dst_freeze: "Freeze: freezes while the source is high", dst_seed: "Seed: gate/clock input - LATCH on: DENSITY divides (CCW) or thins (CW) the pulses; LATCH off: grains while high",
  dst_time: "Time CV: RND knob turns into CV amount (CW) / CV randomness (CCW)", dst_pitch: "Pitch CV: +-12 st per unit, scaled by the PITCH RND knob",
  dst_size: "Size CV via the SIZE RND knob", dst_shape: "Shape CV via the SHAPE RND knob", dst_density: "Density CV: linear in the middle, exponential FM near the ends",
  dst_feedback: "Feedback CV x amount", dst_reverb: "Reverb CV x amount", dst_drywet: "Dry/Wet CV x amount"
};
function hoverHelp() {
  var k = hover;
  if (k && /^sq\d+$/.test(k)) k = "step";
  if (k && /^src\d$/.test(k)) k = "jack_src";
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
  if (h.kind === "toggle") send(h.name, P[h.name].v > 0.5 ? 0 : 1);
  else if (h.kind === "momentary") {
    if (h.name === "seed" && P.seedlatch.v > 0.5) send("seedlatch", 0);   // short press unlatches (Beads)
    send(h.name, 1);
    drag = { kind: "momentary", name: h.name, t0: now() };
  }
  else if (h.kind === "knob") {
    if (h.name === "input" && P.agc.v > 0.5) {   // like Beads: turning the gain by hand = manual gain from the current value
      send("agc", 0);
      P.input.v = Math.max(-12, Math.min(32, 20 * Math.log(Math.max(agcGain, 1e-6)) / Math.LN10));
    }
    drag = { kind: "knob", name: h.name, y0: y, n0: norm(h.name, P[h.name].v) };
  }
  else if (h.kind === "tab") { tab = h.tab; dirty = true; }
  else if (h.kind === "cycle") send(h.name, (Math.round(P[h.name].v) + 1) % h.n);
  else if (h.kind === "cmd") {
    if (h.name === "random") randomPatch();
    else if (h.name === "learn") { learnCount++; outlet(0, "agc_restart", learnCount); if (P.agc.v < 0.5) send("agc", 1); }
    else { for (var c = 0; c < DST.length; c++) send("dst_" + DST[c][0], 0); ensureGrains(0); }
  }
  else if (h.kind === "dice") dice();
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
