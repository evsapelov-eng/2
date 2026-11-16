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
    "amp_phs", "sub_lvl", "sub_len", "sub_crv", "clk_bw", "dr_asym", "glue", "nz_lfo", "nz_lrt",
    "rmb_amt", "rmb_dec", "rmb_drv", "rmb_tone", "rmb_duck"]) all[n] = 1;
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

test("WIDTH widens the stereo base above ~180 Hz; mono-safe (L + R unchanged); the sub stays in the centre", () => {
  const sideToMid = (o, a = 0, b = o[0].length) => { let m = 0, sd = 0; for (let i = a; i < b; i++) { m += (o[0][i] + o[1][i]) ** 2; sd += (o[0][i] - o[1][i]) ** 2; } return 10 * Math.log10(sd / m); };
  assert.strictEqual(sideToMid(eng({ wd_amt: 0 }).hit(36, 1, SR / 2)), -Infinity, "WIDTH 0 = mono");
  const wide = eng({ wd_amt: 1 }).hit(36, 1, SR / 2);
  assert.ok(sideToMid(wide) > -14, "WIDTH 100 %: side " + sideToMid(wide).toFixed(1) + " dB");
  // mono-safe: with a mono source (body only) L + R is exactly what it is at WIDTH 0
  const p = Object.assign({}, clean, { dr_amt: 0.6, dr_pre: 1, level: 0.5 });   // below the output safety knee
  const m0 = eng(Object.assign({}, p, { wd_amt: 0 })).hit(36, 1, SR / 2), m1 = eng(Object.assign({}, p, { wd_amt: 1 })).hit(36, 1, SR / 2);
  for (let i = 0; i < SR / 2; i += 7) assert.ok(Math.abs((m0[0][i] + m0[1][i]) - (m1[0][i] + m1[1][i])) < 1e-9, "L+R at " + i);
  assert.ok(sideToMid(m1) > -20, "a driven body gets wide too: " + sideToMid(m1).toFixed(1));
  // the sub (65 Hz, after the sweep) stays in the middle
  const side = m1[0].map((v, i) => v - m1[1][i]), mid = m1[0].map((v, i) => v + m1[1][i]);
  const f = 65.406, r = 20 * Math.log10(harm(side, 9600, 19200, f) / harm(mid, 9600, 19200, f));
  assert.ok(r < -24, "65 Hz in the side: " + r.toFixed(1) + " dB");
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

// ---------------- v0.4 RUMBLE ----------------
function rumbleOnly(p, n = SR * 2) {
  const a = eng(Object.assign({}, clean, p, { rmb_amt: 0 }), SR, 4).hit(36, 1, n)[0], b = eng(Object.assign({}, clean, p), SR, 4).hit(36, 1, n)[0];
  return b.map((v, i) => v - a[i]);
}
test("RUMBLE 0 = nothing at all (the kick is untouched)", () => {
  const a = eng(clean).hit(36, 1, SR)[0], b = eng(Object.assign({}, clean, { rmb_amt: 0, rmb_dec: 1, rmb_drv: 1 })).hit(36, 1, SR)[0];
  for (let i = 0; i < SR; i++) assert.strictEqual(a[i], b[i]);
});
test("RUMBLE: a low, long tail after the kick; DECAY makes it longer; TONE = how high it reaches", () => {
  const p = { rmb_amt: 0.8, amp_len: 0.4 };
  const short = rumbleOnly(Object.assign({ rmb_dec: 0.2 }, p)), long = rumbleOnly(Object.assign({ rmb_dec: 0.8 }, p));
  assert.ok(rms(long, SR * 0.4, SR * 0.7) > 0.03, "audible after the kick");
  assert.ok(rms(long, SR * 1.2, SR * 1.6) > 4 * rms(short, SR * 1.2, SR * 1.6), "DECAY: longer");
  const lo = (x, f) => harm(x, SR * 0.3, SR * 0.8, f);
  const dark = rumbleOnly(Object.assign({ rmb_tone: 0.1 }, p)), bright = rumbleOnly(Object.assign({ rmb_tone: 0.9 }, p));
  const hiShare = (x) => lo(x, 600) / lo(x, 70);
  assert.ok(hiShare(bright) > 3 * hiShare(dark), `TONE: 600 Hz vs 70 Hz ${hiShare(dark).toFixed(4)} / ${hiShare(bright).toFixed(4)}`);
});
test("RUMBLE ducks under the kick and swells after it (DUCK); mono", () => {
  const p = { rmb_amt: 0.8, amp_len: 0.5, amp_crv: 0.8, rmb_dec: 0.6 };
  const during = (x) => rms(x, SR * 0.1, SR * 0.25), after = (x) => rms(x, SR * 0.45, SR * 0.6);
  const ducked = rumbleOnly(Object.assign({ rmb_duck: 1 }, p)), open = rumbleOnly(Object.assign({ rmb_duck: 0 }, p));
  assert.ok(during(ducked) < 0.35 * during(open), `under the kick: ${during(ducked).toFixed(3)} vs ${during(open).toFixed(3)}`);
  assert.ok(after(ducked) > 0.6 * after(open), "after the kick it is back");
  const o = eng(Object.assign({}, clean, p)).hit(36, 1, SR);
  for (let i = 0; i < SR; i += 13) assert.ok(Math.abs(o[0][i] - o[1][i]) < 1e-12);
});

// ---------------- v0.5 TUNER ----------------
test("TUNER (out 5): the Hz the hit rings at, within 1 cent, for notes, TUNE and mods; 808 drift shows as sharp", () => {
  const want = (note, tune) => 440 * Math.pow(2, (note - 69 + (tune - 0.5) * 48) / 12);
  const cents = (a, b) => 1200 * Math.log2(a / b);
  for (const [p, note] of [[{}, 36], [{}, 24], [{}, 55], [{ tune: 0.53 }, 36], [{ dr_amt: 0.9, dr_pre: 1, dr_asym: 0.6, fm_amt: 0.5 }, 36], [{ amp_len: 0.1 }, 40]]) {
    const o = eng(Object.assign({}, clean, p)).hit(note, 1, SR);
    const c = cents(o[4][SR - 1], want(note, p.tune || 0.5));
    assert.ok(Math.abs(c) < 1, `note ${note} ${JSON.stringify(p)}: ${c.toFixed(2)} cents`);
  }
  // a random TUNE per hit: the tuner follows each hit
  const g = eng(Object.assign({}, clean, { r_tune: 0.2, rnd_amt: 1 }));
  const a = g.hit(36, 1, SR / 2)[4][SR / 2 - 1], b = g.hit(36, 1, SR / 2)[4][SR / 2 - 1];
  assert.ok(Math.abs(cents(a, b)) > 5, "different hits, different readings");
  const s808 = eng(Object.assign({}, clean, { p808: 1, amp_len: 0.8 })).hit(36, 1, SR)[4][SR - 1];
  assert.ok(cents(s808, 65.406) > 10, "808 rings sharp: +" + cents(s808, 65.406).toFixed(0) + " c");
  assert.strictEqual(eng(clean).run(100)[4][99], 0, "0 before any hit");
});
