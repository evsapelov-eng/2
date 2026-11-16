// The real engine (gen/stomp.genexpr) run in node through tools/genexpr.js (which also lints the gen~
// rules FLØCK learned in Max). NOT Max: proves the maths and logic.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const { GenPatch } = require("../tools/genexpr");
const SRC = fs.readFileSync(path.join(__dirname, "..", "gen", "stomp.genexpr"), "utf8");
const SR = 48000;
function eng(params = {}, sr = SR, seed = 5) {
  const g = new GenPatch(SRC, { sr, seed });
  for (const [k, v] of Object.entries(params)) g.set(k, v);
  g.run(32);
  g.k = 0;
  g.hit = (note = 36, vel = 1, n = sr) => { g.set("knote", note); g.set("kvel", vel); g.k += 1; g.set("ktrig", g.k); return g.run(n); };
  return g;
}
const peak = (x, a = 0, b = x.length) => { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i])); return p; };
const rms = (x, a, b) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / (b - a)); };
function zcHz(x, a, b, sr = SR) { let n = 0; for (let i = a + 1; i < b; i++) if ((x[i] < 0) !== (x[i - 1] < 0)) n++; return n / 2 / ((b - a) / sr); }
const clean = { clk_amt: 0, nz_amt: 0, hm_amt: 0, dr_amt: 0, fm_amt: 0, sp_amt: 0, rnd_amt: 0 };
// frequency from the first two full periods after sample a (upward zero crossings, interpolated)
function periodHz(x, a, sr = SR) {
  const up = [];
  for (let i = a + 1; i < x.length && up.length < 3; i++) if (x[i - 1] < 0 && x[i] >= 0) up.push(i - 1 + x[i - 1] / (x[i - 1] - x[i]));
  return 2 * sr / (up[2] - up[0]);
}

test("silent at load and until the first hit (no sound when the device is dropped on a track)", () => {
  const g = eng();
  assert.strictEqual(peak(g.run(SR)[0]), 0);
});

test("a hit sounds; the same ktrig value again is not a new hit", () => {
  const g = eng();
  const o = g.hit();
  assert.ok(peak(o[0]) > 0.3);
  const o2 = g.run(SR);   // ktrig unchanged → the tail has ended, nothing new
  assert.ok(peak(o2[0], SR / 2) < 1e-6);
});

test("the MIDI note is the pitch the kick lands on (C1 = 65.4 Hz, C2 = 130.8 Hz), TUNE shifts it", () => {
  for (const [note, tune, want] of [[36, 0.5, 65.41], [48, 0.5, 130.81], [36, 0.75, 130.81], [41, 0.5, 87.31]]) {
    const g = eng(Object.assign({ amp_len: 0.8, amp_crv: 0.9, tune }, clean));
    const o = g.hit(note);
    const hz = zcHz(o[0], SR * 0.15, SR * 0.4);
    assert.ok(Math.abs(hz - want) / want < 0.02, `note ${note} tune ${tune}: ${hz.toFixed(1)} vs ${want}`);
  }
});

test("SWEEP: the hit starts SWEEP semitones above the note and falls within TIME", () => {
  const g = eng(Object.assign({ pit_swp: 0.5, pit_time: 0.9, pit_crv: 0.5 }, clean));   // +36 st, 210 ms, linear
  const o = g.hit(36);
  const start = periodHz(o[0], 0);   // the first periods
  assert.ok(start > 65.41 * 8 * 0.85 && start < 65.41 * 8 * 1.05, "start " + start.toFixed(0));
  const g2 = eng(Object.assign({ pit_swp: 0 }, clean));
  const s2 = zcHz(g2.hit(36)[0], 0, 4800);
  assert.ok(Math.abs(s2 - 65.4) < 12, "no sweep → starts on the note: " + s2.toFixed(1));
});

test("LENGTH: the kick ends exactly at attack + LENGTH (50 ms .. 2 s)", () => {
  for (const v of [0, 0.5, 1]) {
    const g = eng(Object.assign({ amp_len: v }, clean));
    const alen = 0.05 * Math.pow(2, v * 5.32), n = Math.ceil((alen + 0.05) * SR);
    const o = g.hit(36, 1, n);
    const end = Math.round(alen * SR);
    assert.ok(rms(o[2], end - 2400, end - 1200) > 0, "still sounding just before the end");
    assert.strictEqual(peak(o[0], end + 4, n), 0, `silent after ${alen.toFixed(3)} s`);
  }
});

test("velocity (default cable VEL > LEVEL, 50 %): a half-velocity hit is about 9 dB softer", () => {
  const a = peak(eng(clean).hit(36, 1)[0]), b = peak(eng(clean).hit(36, 0.5)[0]);
  const db = 20 * Math.log10(b / a);
  assert.ok(db < -7 && db > -11, db.toFixed(1) + " dB");
  const c = peak(eng(Object.assign({ vel_amt: 0 }, clean)).hit(36, 0.5)[0]);
  assert.ok(Math.abs(c - a) < 1e-9, "VELOCITY amount 0 → velocity changes nothing");
});

test("RANDOM: with a cable every hit is different; RANDOM amount 0 makes the hits identical", () => {
  const two = (p) => { const g = eng(Object.assign({}, clean, p)); const a = g.hit(36, 1, SR / 2)[0]; const b = g.hit(36, 1, SR / 2)[0]; return [a, b]; };
  let [a, b] = two({ r_pit_swp: 1, rnd_amt: 1 });
  assert.ok(Math.abs(rms(a, 0, 2400) - rms(b, 0, 2400)) > 1e-4 || Math.abs(zcHz(a, 0, 960) - zcHz(b, 0, 960)) > 5);
  [a, b] = two({ r_pit_swp: 1, r_clk_tone: 0, r_nz_col: 0, rnd_amt: 0 });
  for (let i = 0; i < a.length; i += 97) assert.ok(Math.abs(a[i] - b[i]) < 1e-9);
});

test("a fast retrigger does not click (the jump fades out in ~1.5 ms)", () => {
  const g = eng(Object.assign({ amp_len: 0.9 }, clean, { clk_amt: 0 }));
  g.hit(36, 1, 4000);   // mid-note
  const before = g.run(1)[0][0];
  const o = g.hit(36, 1, 200);
  assert.ok(Math.abs(o[0][0] - before) < 0.05, `jump ${(o[0][0] - before).toFixed(3)}`);
  let mx = 0; for (let i = 1; i < 200; i++) mx = Math.max(mx, Math.abs(o[0][i] - o[0][i - 1]));
  assert.ok(mx < 0.25, "max step " + mx.toFixed(3));
});

test("never above 0 dBFS and never NaN, even with every knob at max (44.1 / 48 / 96 kHz)", () => {
  const all = {};
  for (const n of ["amp_len", "amp_att", "amp_crv", "pit_swp", "pit_time", "pit_crv", "clk_amt", "clk_tone", "nz_amt", "nz_col", "nz_dec",
    "hm_amt", "hm_spr", "dr_amt", "dr_knee", "fm_amt", "fm_rat", "fm_dec", "wd_amt", "sp_amt", "sp_time", "level", "tune",
    "amp_phs", "sub_lvl", "sub_len", "sub_crv", "clk_bw", "dr_asym", "glue"]) all[n] = 1;
  for (const sr of [44100, 48000, 96000]) {
    for (const p0 of [all, Object.fromEntries(Object.keys(all).map((k) => [k, 0]))]) for (const sw of [0, 1]) {
      const g = eng(Object.assign({}, p0, { p808: sw, dr_pre: sw }), sr);
      const o = g.hit(127, 1, sr);
      for (const ch of [0, 1]) for (const v of o[ch]) assert.ok(Number.isFinite(v) && Math.abs(v) <= 1, "sr " + sr);
    }
  }
});

test("turning a knob while the kick rings does not jump (per-sample smoothing)", () => {
  const g = eng(Object.assign({ amp_len: 0.9 }, clean));
  g.hit(36, 1, 4800);
  g.set("level", 1);
  const o = g.run(480);
  let mx = 0; for (let i = 1; i < 480; i++) mx = Math.max(mx, Math.abs(o[0][i] - o[0][i - 1]));
  assert.ok(mx < 0.1, "step " + mx.toFixed(3));
});

test("WIDTH: 0 = mono, more = a wider top (the sub/body stays centred)", () => {
  const side = (w) => { const o = eng({ wd_amt: w, nz_amt: 0.6, hm_amt: 0.6 }).hit(36, 1, SR / 2); let s = 0, m = 0; for (let i = 0; i < o[0].length; i++) { s += (o[0][i] - o[1][i]) ** 2; m += (o[0][i] + o[1][i]) ** 2; } return s / m; };
  assert.ok(side(0) < 1e-12);
  assert.ok(side(1) > 0.001);
  const o = eng(Object.assign({ wd_amt: 1 }, clean)).hit(36, 1, SR / 2);
  for (let i = 0; i < o[0].length; i += 31) assert.ok(Math.abs(o[0][i] - o[1][i]) < 1e-9, "body alone is mono at any WIDTH");
});

test("SPACE adds a tail after the kick; 0 = completely dry", () => {
  const alen = 0.05 * Math.pow(2, 0.4 * 5.32), end = Math.round((alen + 0.01) * SR);
  const dry = eng({ amp_len: 0.4, sp_amt: 0 }).hit(36, 1, SR)[0], wet = eng({ amp_len: 0.4, sp_amt: 1 }).hit(36, 1, SR)[0];
  assert.strictEqual(peak(dry, end), 0);
  assert.ok(peak(wet, end) > 0.005);
});

test("the default kick is dry and mono: L = R, and nothing at all after the end of LENGTH", () => {
  const g = eng();
  const alen = 0.05 * Math.pow(2, 0.52 * 5.32), n = SR;
  const o = g.hit(36, 1, n);
  for (let i = 0; i < n; i++) assert.ok(o[0][i] === o[1][i], "mono at " + i);
  assert.strictEqual(peak(o[0], Math.round(alen * SR) + 4, n), 0, "no tail");
});

// ---------------- v0.2 ----------------
// the per-hit random value: the engine's hsh() written once more in JS (the panel has the same)
function hsh(n, k) {
  let x = n * 0.7548776662466927 + k * 0.5698402909980532 + 0.5; x = x - Math.floor(x);
  x = x * (x + 33.33) * 17; x = x - Math.floor(x); x = x * (x + 11.7) * 29; return x - Math.floor(x);
}
function envEnd(o) { let last = 0; for (let i = 0; i < o[2].length; i++) if (o[2][i] > 0) last = i; return last; }
const alenOf = (v) => 0.05 * Math.pow(2, v * 5.32);

test("RANDOM is hsh(hit number, knob index): the hit lands exactly where the panel says", () => {
  const g = eng(Object.assign({}, clean, { rnd_amt: 1, r_amp_len: 1, amp_len: 0.5 }));
  for (let n = 1; n <= 4; n++) {
    const o = g.hit(36, 1, SR * 2);
    const e = Math.max(0, Math.min(1, 0.5 + (hsh(n, 0) - 0.5)));
    assert.ok(Math.abs(envEnd(o) - alenOf(e) * SR) < 3, `hit ${n}: ${envEnd(o)} vs ${(alenOf(e) * SR).toFixed(0)}`);
  }
  const vals = Array.from({ length: 200 }, (_, n) => hsh(n + 1, 3));
  const mean = vals.reduce((a, b) => a + b) / vals.length;
  assert.ok(Math.abs(mean - 0.5) < 0.08 && Math.min(...vals) < 0.1 && Math.max(...vals) > 0.9, "spread over 0..1");
});

test("NOTE source: C1 = no change, C3 = +depth, C-1 = -depth", () => {
  for (const [note, want] of [[36, 0.4], [60, 0.4 + 0.5], [12, 0.4 - 0.5]]) {
    const o = eng(Object.assign({}, clean, { amp_len: 0.4, k_amp_len: 1, note_amt: 0.5 })).hit(note, 1, SR * 2);
    assert.ok(Math.abs(envEnd(o) - alenOf(Math.max(0, want)) * SR) < 3, "note " + note);
  }
});

test("SUB layer: same phase as the body (adds, never cancels) and its own LENGTH", () => {
  const body = eng(Object.assign({}, clean, { amp_len: 0.2, pit_swp: 0 })).hit(36, 1, SR)[0];
  const both = eng(Object.assign({}, clean, { amp_len: 0.2, pit_swp: 0, sub_lvl: 1, sub_len: 0.7 })).hit(36, 1, SR)[0];
  assert.ok(rms(both, 0, 2400) > rms(body, 0, 2400) * 1.5, "in phase: louder");
  const bEnd = Math.round(alenOf(0.2) * SR), sEnd = Math.round(alenOf(0.7) * SR);
  assert.strictEqual(peak(body, bEnd + 4), 0);
  assert.ok(rms(both, bEnd + 2000, bEnd + 4000) > 0.05, "the sub goes on after the body");
  assert.strictEqual(peak(both, sEnd + 4), 0, "and stops at its own LENGTH");
});

test("808 mode: an exponential ring whose pitch falls with its loudness and lands on the note", () => {
  const o = eng(Object.assign({}, clean, { p808: 1, amp_len: 0.7, amp_crv: 0.5, pit_swp: 0.4, pit_time: 0.5 })).hit(36, 1, SR);
  const early = periodHz(o[0], 0), late = periodHz(o[0], Math.round(0.55 * SR));
  assert.ok(early > 65.4 * 2, "starts high: " + early.toFixed(0));
  assert.ok(Math.abs(late - 65.4) < 3, "lands on C1: " + late.toFixed(1));
  // exponential: equal steps in time = equal steps in dB (CURVE 0.5 → -60 dB at LENGTH)
  const L = alenOf(0.7), e = (t) => o[2][Math.round(t * SR)];
  const d1 = 20 * Math.log10(e(0.25 * L) / e(0.05 * L)), d2 = 20 * Math.log10(e(0.45 * L) / e(0.25 * L));
  assert.ok(Math.abs(d1 - d2) < 0.5 && Math.abs(d1 + 12) < 0.6, `${d1.toFixed(2)} / ${d2.toFixed(2)} dB`);
});

function harm(x, a, b, f) {   // Goertzel magnitude at f
  const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w); let s1 = 0, s2 = 0;
  for (let i = a; i < b; i++) { const s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
  return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2);
}
test("DRIVE PRE keeps the dirt in the tail; POST cleans up as the kick dies (909 vs bus drive)", () => {
  const p = Object.assign({}, clean, { pit_swp: 0, amp_len: 0.7, amp_crv: 0.5, dr_amt: 0.6, dr_knee: 0.5, level: 30 / 36 });
  const L = alenOf(0.7), a = Math.round(0.75 * L * SR), b = a + 4800, f = 65.406;
  const third = (o) => harm(o, a, b, 3 * f) / harm(o, a, b, f);
  const post = eng(Object.assign({}, p, { dr_pre: 0 })).hit(36, 1, SR * 2)[0];
  const pre = eng(Object.assign({}, p, { dr_pre: 1 })).hit(36, 1, SR * 2)[0];
  assert.ok(third(pre) > 0.15 && third(pre) > 2 * third(post), `3rd harmonic in the tail: pre ${third(pre).toFixed(3)} post ${third(post).toFixed(3)}`);
});

test("ASYM adds even harmonics; at 0 the drive is symmetric (no 2nd harmonic)", () => {
  const p = Object.assign({}, clean, { pit_swp: 0, amp_len: 0.8, amp_crv: 0.8, dr_amt: 0.5, dr_pre: 1 });
  const a = 4800, b = 4800 * 3, f = 65.406;
  const second = (o) => harm(o, a, b, 2 * f) / harm(o, a, b, f);
  assert.ok(second(eng(p).hit(36, 1, SR)[0]) < 0.01);
  assert.ok(second(eng(Object.assign({}, p, { dr_asym: 1 })).hit(36, 1, SR)[0]) > 0.05);
});

test("GLUE: louder (RMS up), the peak still under 0 dBFS", () => {
  const p = Object.assign({}, clean, { level: 30 / 36, dr_amt: 0.2 });
  const a = eng(p).hit(36, 1, SR / 2)[0], b = eng(Object.assign({}, p, { glue: 1 })).hit(36, 1, SR / 2)[0];
  const up = 20 * Math.log10(rms(b, 0, 12000) / rms(a, 0, 12000));
  assert.ok(up > 2, "+" + up.toFixed(1) + " dB");
  assert.ok(peak(b) <= 1);
});

test("a new note does not cut the old kick dead: it fades over 5 ms (no gap, no click)", () => {
  const p = Object.assign({}, clean, { pit_swp: 0, amp_len: 0.9, amp_crv: 0.8 });
  const g = eng(p);
  const before = g.hit(36, 1, 7000)[0];
  const after = g.hit(36, 1, 480)[0];
  assert.ok(rms(after, 0, 144) > 0.5 * rms(before, 7000 - 144, 7000), "no dip at the retrigger");
  let mx = 0; for (let i = 1; i < 480; i++) mx = Math.max(mx, Math.abs(after[i] - after[i - 1]));
  assert.ok(mx < 0.1, "max step " + mx.toFixed(3));
});

test("PHASE: 0 starts at zero, 100 % starts at the peak (a hard attack)", () => {
  const z = eng(Object.assign({}, clean, { pit_swp: 0 })).hit(36, 1, 10)[0];
  const h = eng(Object.assign({}, clean, { pit_swp: 0, amp_phs: 1 })).hit(36, 1, 10)[0];
  assert.ok(Math.abs(z[0]) < 0.01 && Math.abs(h[0]) > 0.5);
});

test("CLICK BAND: narrow = a pitched tick at TONE, wide = noise", () => {
  const diff = (p) => { const a = eng(Object.assign({}, clean, p)).hit(36, 1, 480)[0], b = eng(Object.assign({}, clean, p, { clk_amt: 0 })).hit(36, 1, 480)[0]; return a.map((v, i) => v - b[i]); };
  const tone = 1500 * Math.pow(2, 0.6 * 3);
  const n = diff({ clk_amt: 0.6, clk_tone: 0.6, clk_bw: 0 }), w = diff({ clk_amt: 0.6, clk_tone: 0.6, clk_bw: 1 });
  const ratio = (x) => harm(x, 0, 480, tone) / (harm(x, 0, 480, tone / 2.5) + harm(x, 0, 480, tone * 2.5));
  assert.ok(ratio(n) > 2 * ratio(w), `narrow ${ratio(n).toFixed(2)} wide ${ratio(w).toFixed(2)}`);
  assert.ok(peak(n) > 0.1 && peak(w) > 0.1, "both audible");
});

// ---------------- v0.3 ----------------
test("noise LFO runs on its own: every hit catches it somewhere else; LFO 0 = the same noise every hit", () => {
  // RATE 0.33 → 0.125 * 2^3 = 1 Hz. Hits 0.25 s apart land a quarter period further each time.
  const level = (lfo) => {
    const p = Object.assign({}, clean, { nz_amt: 0.8, nz_dec: 0.3, amp_len: 0.3, nz_lrt: 1 / 3, nz_lfo: lfo });
    const a = eng(p, SR, 9), b = eng(Object.assign({}, p, { nz_amt: 0 }), SR, 9), r = [];
    for (let h = 0; h < 4; h++) { const x = a.hit(36, 1, SR / 4)[0], y = b.hit(36, 1, SR / 4)[0]; r.push(rms(x.map((v, i) => v - y[i]), 0, 960)); }
    return r;
  };
  const free = level(1), off = level(0);
  const spread = (r) => Math.max(...r) / Math.min(...r);
  assert.ok(spread(free) > 3, "different noise on every hit: " + free.map((v) => v.toFixed(3)).join(" "));
  assert.ok(spread(off) < 1.3, "LFO 0: the same: " + off.map((v) => v.toFixed(3)).join(" "));
  // and it keeps moving between hits (no reset): out4 = the LFO, one period = 1 s
  const g = eng({ nz_lrt: 1 / 3 });
  const o = g.run(SR);
  let up = 0; for (let i = 1; i < SR; i++) if (o[3][i - 1] < 0 && o[3][i] >= 0) up++;
  assert.strictEqual(up, 1, "1 Hz, running before any hit");
});
