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
  time: { v: 0.5, d: 0.5 }, density: { v: 0.3, d: 0.3 }, pitch: { v: 0.5, d: 0.5 }, size: { v: 0.45, d: 0.45 }, shape: { v: 0.5, d: 0.5 },
  time_amt: { v: 0.5, d: 0.5 }, pitch_amt: { v: 0.5, d: 0.5 }, size_amt: { v: 0.5, d: 0.5 }, shape_amt: { v: 0.5, d: 0.5 },
  feedback: { v: 0, d: 0 }, drywet: { v: 0.5, d: 0.5 }, reverb: { v: 0.2, d: 0.2 },
  freeze: { v: 0, d: 0 }, seed: { v: 0, d: 0 }, seedlatch: { v: 1, d: 1 },
  input: { v: 0, d: 0, lo: -12, hi: 32 }, output: { v: 0, d: 0, lo: -24, hi: 12 }
};
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
function tape(w, a) { tapeSt.w = +w; tapeSt.active = +a; dirty = true; }
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
  if (dirty || grains.length) { dirty = false; mgraphics.redraw(); }
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
  if (name.indexOf("_amt") > 0) { var a = attenu(v); return Math.abs(a) < 0.005 ? "0" : (a < 0 ? "peaky " : "even ") + pct(Math.abs(a)); }
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
  drawLogo(14, 34, 24);
  text("granular texture", 15, 48, 7.5, C.mid);
  roundButton(42, 82, 15, "FREEZE", P.freeze.v > 0.5, "freeze", false);
  roundButton(110, 82, 15, "SEED", P.seed.v > 0.5 || (P.seedlatch.v > 0.5 && pulseOn()), "seed", true);
  var lx = 14, ly = 120;
  rect(lx, ly, 126, 16, C.ink, P.seedlatch.v > 0.5, 1);
  textC(P.seedlatch.v > 0.5 ? "LATCH  ON  (continuous)" : "LATCH  OFF  (hold SEED)", lx + 63, ly + 11, 7, P.seedlatch.v > 0.5 ? C.panel : C.ink, true);
  hit({ x: lx, y: ly, w: 126, h: 16, kind: "toggle", name: "seedlatch" });
  text("grains " + tapeSt.active + " / 32", 15, 156, 7.5, C.mid);
  line(152, 12, 152, H0 - 12, C.line);
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
      text("RND", cx + 14, 129, 6, C.mid, true);
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
  gainBox(812, 22, "input", "IN");
  gainBox(812, 52, "output", "OUT");
  // ---- tape: record head + where the grains start
  drawTape(598, 90, 290, 58);
  text(hoverHelp(), 160, 162, 6.5, hover ? C.ink : C.mid, !!hover);
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
  text("TAPE  (now  >  " + BUF_S + " s ago)", x + 4, y + 10, 6, C.mid, true);
  // record head at the left edge: "now"; older material to the right
  line(x + 2, y + 14, x + 2, y + h - 3, C.accent, 2);
  if (P.freeze.v > 0.5) textC("FROZEN", x + w / 2, y + h - 6, 7, C.accent, true);
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
  input: "IN: input gain (drag) - the grains record what they hear",
  output: "OUT: output gain",
  freeze: "FREEZE: stop recording - the grains keep playing what is in the buffer",
  seed: "SEED: hold = grains (LATCH off) · tap = 1 grain at 12h · tap while latched = LATCH off · hold 4 s = LATCH on",
  seedlatch: "LATCH: grains are generated continuously at the DENSITY rate"
};
function hoverHelp() { return hover && HELP[hover] ? HELP[hover] : "drag knobs up/down · shift = fine · double-click = default · hover = help"; }

// ---------- interaction ----------
function find(x, y) { for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }
function send(name, v) { outlet(0, name, v); }
function norm(name, v) { var q = P[name]; return q.lo !== undefined ? (v - q.lo) / (q.hi - q.lo) : v; }
function denorm(name, n) { var q = P[name]; return q.lo !== undefined ? Math.round((q.lo + n * (q.hi - q.lo)) * 10) / 10 : Math.round(n * 1000) / 1000; }
function onclick(x, y, but, cmd, shift) {
  x /= scaleF; y /= scaleF;
  var h = find(x, y); if (!h) return;
  if (h.kind === "toggle") send(h.name, P[h.name].v > 0.5 ? 0 : 1);
  else if (h.kind === "momentary") {
    if (h.name === "seed" && P.seedlatch.v > 0.5) send("seedlatch", 0);   // short press unlatches (Beads)
    send(h.name, 1);
    drag = { kind: "momentary", name: h.name, t0: now() };
  }
  else if (h.kind === "knob") drag = { kind: "knob", name: h.name, y0: y, n0: norm(h.name, P[h.name].v) };
}
function ondrag(x, y, but, cmd, shift) {
  if (!drag) return;
  x /= scaleF; y /= scaleF;
  if (drag.kind === "knob") {
    var n = Math.max(0, Math.min(1, drag.n0 + (drag.y0 - y) * (shift ? 0.0007 : 0.007)));
    send(drag.name, denorm(drag.name, n));
    if (shift) { drag.n0 = n; drag.y0 = y; }
  }
  if (!but) { if (drag.kind === "momentary") send(drag.name, 0); drag = null; dirty = true; }
}
function ondblclick(x, y) {
  x /= scaleF; y /= scaleF;
  var h = find(x, y); if (h && h.kind === "knob") send(h.name, P[h.name].d);
}
function onidle(x, y) { var h = find(x / scaleF, y / scaleF), k = h ? h.name : null; if (k !== hover) { hover = k; dirty = true; } }
function onidleout() { if (hover) { hover = null; dirty = true; } }
function onresize() { dirty = true; }
