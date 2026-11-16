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
const clean = { clk_amt: 0, nz_amt: 0, hm_amt: 0, dr_amt: 0, fm_amt: 0, sp_amt: 0 };

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
  const start = zcHz(o[0], 0, 96);   // first 2 ms
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
    "hm_amt", "hm_spr", "dr_amt", "dr_knee", "fm_amt", "fm_rat", "fm_dec", "wd_amt", "sp_amt", "sp_time", "level", "tune"]) all[n] = 1;
  for (const sr of [44100, 48000, 96000]) {
    for (const p of [all, Object.fromEntries(Object.keys(all).map((k) => [k, 0]))]) {
      const g = eng(p, sr);
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
