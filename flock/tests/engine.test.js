// Runs the real gen~ code (gen/flock.genexpr) through tools/genexpr.js and checks the
// behaviour that the Beads code / manual define. NOT Max: proves maths + logic of the port.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { GenPatch } = require("../tools/genexpr");

const SRC = fs.readFileSync(path.join(__dirname, "..", "gen", "flock.genexpr"), "utf8");
const SR = 48000;
const sine = (hz, n, a = 0.5) => Float64Array.from({ length: n }, (_, i) => a * Math.sin(2 * Math.PI * hz * i / SR));
function engine(params = {}, seed = 7) {
  const g = new GenPatch(SRC, { sr: SR, seed });
  // behaviour tests use manual unity gain and the v0.1 knob defaults unless they set their own
  const base = { reverb: 0, drywet: 1, time: 0.02, time_amt: 0.5, size_amt: 0.5, shape_amt: 0.5, pitch_amt: 0.5,
    agc: 0, ingain: 1, density: 0.3, size: 0.45, shape: 0.5, feedback: 0, dn_amt: 1 };
  for (const [k, v] of Object.entries(Object.assign(base, params))) g.set(k, v);
  return g;
}
const rms = (x, a = 0, b = x.length) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / (b - a)); };
function zcHz(x, a, b) { let n = 0; for (let i = a + 1; i < b; i++) if ((x[i] < 0) !== (x[i - 1] < 0)) n++; return n / 2 / ((b - a) / SR); }
// dominant frequency (Goertzel scan, 1 Hz steps)
function peakHz(x, a, b, lo, hi) {
  let best = 0, bh = 0;
  for (let f = lo; f <= hi; f += 1) {
    const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w); let s1 = 0, s2 = 0;
    for (let i = a; i < b; i++) { const s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
    const p = s1 * s1 + s2 * s2 - c * s1 * s2;
    if (p > best) { best = p; bh = f; }
  }
  return bh;
}
const knobForSemis = (st) => { const iv = [0, 1, 3, 4, 7, 12, 24]; const k = iv.indexOf(Math.abs(st)); return (Math.sign(st) * (k + 0.15) / 6 + 1) / 2; }; // inside the notch
const grainStarts = (o) => { const t = []; o[2].forEach((v, i) => { if (v > 0.5) t.push(i); }); return t; };

test("pitch knob: virtual notches at 0, ±7, ±12, ±24 st; a grain transposes the recorded audio exactly", () => {
  for (const st of [12, -12, 7, 0, 24]) {
    // one long square grain (gated SEED, 12 o'clock DENSITY), pitch measured inside it
    const g = engine({ pitch: knobForSemis(st), seedlatch: 0, density: 0.5, size: 0.8, shape: 0, time: 0.3 });
    const n = SR * 3, x = sine(220, n);
    g.run(SR * 2, [x.subarray(0, SR * 2), x.subarray(0, SR * 2)]);
    g.set("seed", 1);
    const o = g.run(SR / 2, [x.subarray(SR * 2), x.subarray(SR * 2)]);
    const hz = zcHz(o[0], 2400, SR / 2 - 2400);
    const want = 220 * Math.pow(2, st / 12);
    assert.ok(Math.abs(hz - want) / want < 0.005, `${st} st: ${hz.toFixed(1)} Hz vs ${want.toFixed(1)}`);
  }
});

test("TIME: grains start at time·(buffer − 2·safety) + safety samples behind the record head", () => {
  for (const t of [0, 0.25, 0.8]) {
    const g = engine({ time: t, density: 0.2 });
    g.run(4000, [sine(100, 4000), sine(100, 4000)]);
    // find the most recently started grain = prio[31] after a rotate or the one with the largest remaining
    let best = -1, rem = -1;
    for (let k = 0; k < 32; k++) { const r = g.D.gr.a[14 * 32 + k]; if (r > rem) { rem = r; best = k; } }
    const delay = g.D.gr.a[8 * 32 + best];
    const want = t * (192000 - 514) + 257;
    assert.ok(Math.abs(delay - want) < 2500, `time ${t}: delay ${delay.toFixed(0)} vs ${want.toFixed(0)}`);
  }
});

test("SIZE: below 1/3 grains play reversed (negative speed), above forward; duration grows clockwise", () => {
  const speeds = (size) => { const g = engine({ size, density: 0.1 }); g.run(SR / 2, [sine(100, SR / 2), sine(100, SR / 2)]); return Array.from({ length: 32 }, (_, k) => g.D.gr.a[9 * 32 + k]).filter((v) => v !== 0); };
  assert.ok(speeds(0.15).every((v) => v < 0), "reversed");
  assert.ok(speeds(0.6).every((v) => v > 0), "forward");
  const dur = (size) => { const g = engine({ size, density: 0.05 }); g.run(2000, [sine(100, 2000), sine(100, 2000)]); return Math.max(...Array.from({ length: 32 }, (_, k) => g.D.gr.a[14 * 32 + k])); };
  assert.ok(dur(0.4) < dur(0.6) && dur(0.6) < dur(0.9), `${dur(0.4)} < ${dur(0.6)} < ${dur(0.9)}`);
  assert.ok(dur(0.97) > SR * 2, "up to ~4 s");
});

test("DENSITY (latched): CCW = constant rate, CW = random rate, 12 o'clock = slowest even grains (FLØCK: no silent dead zone)", () => {
  const n = SR * 4;
  const iv = (d) => { const s = grainStarts(engine({ density: d }).run(n, [sine(100, n), sine(100, n)])); return s.slice(1).map((v, i) => v - s[i]); };
  const cv = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m; };
  const steady = iv(0.2), rnd = iv(0.8);
  assert.ok(steady.length > 10 && cv(steady) < 0.01, "constant: cv " + cv(steady));
  assert.ok(rnd.length > 10 && cv(rnd) > 0.3, "random: cv " + cv(rnd));
  // Beads is silent here; FLØCK plays the slowest even grains (≈ 0.65 /s) so the knob never "switches off"
  const mid = iv(0.5);
  assert.ok(mid.length >= 1 && Math.abs(mid[0] - SR / (130.81278 * Math.pow(2, -0.479 * 16))) < 2, "12 o'clock: slowest even rate " + mid);
  const fast = iv(0.02), want = SR / 130.81278 * Math.pow(2, 0.02 * 16);
  assert.ok(Math.abs(fast[3] - want) < 2, `fastest ≈ C3 period: ${fast[3]} vs ${want.toFixed(1)}`);
});

test("SEED gated (LATCH off): grains only while SEED is held; at 12 o'clock one grain per press", () => {
  const g = engine({ seedlatch: 0, density: 0.5 });
  const n = SR / 4;
  let o = g.run(n, [sine(100, n), sine(100, n)]);
  assert.strictEqual(grainStarts(o).length, 0, "nothing without SEED");
  g.set("seed", 1); o = g.run(n, [sine(100, n), sine(100, n)]);
  assert.strictEqual(grainStarts(o).length, 1, "one grain per press");
  g.set("seed", 0); g.run(200, []);
  g.set("density", 0.2); g.set("seed", 1); o = g.run(n, [sine(100, n), sine(100, n)]);
  assert.ok(grainStarts(o).length > 3, "repeats while held");
  g.set("seed", 0); o = g.run(n, []);
  assert.strictEqual(grainStarts(o).length, 0, "stops on release");
});

test("FREEZE: recording stops (buffer and record head unchanged) and the grains keep playing the frozen audio", () => {
  const g = engine({ density: 0.15, size: 0.6, time: 0.05 });
  const n = SR;
  g.run(n, [sine(330, n), sine(330, n)]);
  g.set("freeze", 1);
  g.run(100, [sine(330, 100), sine(330, 100)]);
  const w0 = g.H.wp, snap = g.D.buf.a.slice(0, 1000);
  const o = g.run(n, [new Float64Array(n), new Float64Array(n)]); // input goes silent
  assert.strictEqual(g.H.wp, w0);
  assert.ok(g.D.buf.a.slice(0, 1000).every((v, i) => v === snap[i]));
  assert.ok(rms(o[0], n / 2, n) > 0.05, "still sounding from the frozen buffer");
  assert.ok(Math.abs(zcHz(o[0], n / 2, n) - 330) < 15);
  g.set("freeze", 0);
  const o2 = g.run(n * 2, [new Float64Array(2 * n), new Float64Array(2 * n)]);
  assert.ok(rms(o2[0], 1.8 * n, 2 * n) < 0.01, "after unfreeze the silence is recorded and played");
});

test("FEEDBACK at 100% for 10 s stays bounded (brickwall limiting in Pristine) and finite", () => {
  const g = engine({ feedback: 1, density: 0.05, size: 0.7, time: 0, pitch: knobForSemis(7), reverb: 1 });
  const n = SR * 10, x = sine(200, n, 0.8);
  const o = g.run(n, [x, x]);
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(o[0][i]), Math.abs(o[1][i]));
  assert.ok(o[0].every(Number.isFinite) && pk < 1.0, "peak " + pk);
});

test("SHAPE: CCW = square (sustain), CW = slow attack, middle = decay", () => {
  const env = (shape) => {
    const g = engine({ shape, density: 0.5, seedlatch: 0, size: 0.66, time: 0 });
    const n = SR, dc = new Float64Array(n).fill(0.5);
    g.run(SR / 2, [dc, dc]);           // fill the buffer with DC
    g.set("seed", 1);
    const o = g.run(SR / 2, [dc, dc])[0];
    return o;
  };
  const sq = env(0), rv = env(1), dec = env(0.33);
  const at = (x, ms) => x[Math.round(ms / 1000 * SR)];
  assert.ok(Math.abs(at(sq, 5) - at(sq, 60)) < 0.02, "square holds");
  assert.ok(at(rv, 5) < at(rv, 80) * 0.3, "reverse-like slow attack");
  assert.ok(at(dec, 2) > at(dec, 60) * 2, "decay");
});

test("dense long grains: at most 32 voices, smooth stealing, no NaN", () => {
  const g = engine({ density: 0.0, size: 0.9, shape: 0.6 });
  const n = SR * 2, o = g.run(n, [sine(150, n), sine(150, n)]);
  assert.ok(Math.max(...o[3]) <= 32 && Math.max(...o[3]) >= 20);
  assert.ok(o[0].every(Number.isFinite));
  let jump = 0; for (let i = SR; i < n; i++) jump = Math.max(jump, Math.abs(o[0][i] - o[0][i - 1]));
  assert.ok(jump < 0.2, "max step " + jump);
});

test("randomised parameters also randomise the pan; without randomness L = R for a mono source", () => {
  const n = SR * 2, x = sine(200, n);
  const plain = engine({ density: 0.15, size: 0.6 }).run(n, [x, x]);
  let d = 0; for (let i = 0; i < n; i++) d = Math.max(d, Math.abs(plain[0][i] - plain[1][i]));
  assert.ok(d < 1e-9, "centred: " + d);
  const spread = engine({ density: 0.15, size: 0.6, pitch_amt: 1 }).run(n, [x, x]);
  let s = 0; for (let i = 0; i < n; i++) s += Math.abs(spread[0][i] - spread[1][i]);
  assert.ok(s / n > 0.01, "spread");
});

test("dry/wet law: 0 = dry ×0.75, 1 = no dry; reverb adds a tail and stays stable", () => {
  const n = SR / 2, x = sine(200, n, 0.3);
  const dry = engine({ drywet: 0, density: 0.5 }).run(n, [x, x]);
  assert.ok(Math.abs(rms(dry[0], n / 2, n) / rms(x, n / 2, n) - 0.75) < 0.01);
  const imp = new Float64Array(SR * 3); for (let i = 0; i < 2400; i++) imp[i] = 0.5 * Math.sin(i * 0.37) * Math.sin(i * 0.011);
  const r0 = engine({ drywet: 0, reverb: 0, density: 0.5 }).run(imp.length, [imp, imp])[0];
  const r1 = engine({ drywet: 0, reverb: 0.8, density: 0.5 }).run(imp.length, [imp, imp])[0];
  assert.ok(rms(r1, SR / 2, SR) > 1e-3 && rms(r0, SR / 2, SR) < 1e-6, "reverb tail");
  assert.ok(rms(r1, 2.5 * SR, 3 * SR) < rms(r1, SR / 2, SR), "decays");
});

test("buffer (Pristine): 192000 frames, 16-bit truncation like Clip16, record head moves backwards and wraps", () => {
  const g = engine({ density: 0.5 });
  const n = 192000 + 10, x = Float64Array.from({ length: n }, (_, i) => 0.3 + 0.1 * Math.sin(i * 0.001));
  g.run(n, [x, x]);
  assert.strictEqual(g.H.wp, (((-n) % 192000) + 192000) % 192000);
  const i = 1000, w = (((-(n - 1 - 0)) % 192000) + 192000) % 192000; // the sample written last sits at wp+1
  const last = g.D.buf.a[(g.H.wp + 1) % 192000];
  assert.strictEqual(last, Math.trunc(x[n - 1] * 32768) / 32768);
  // the Data holds the longest quality
  assert.ok(g.D.buf.a.length === 768004 * 2 && i < w + 192000);   // 16 s at 48 kHz (Scorched cassette) + 4
});

test("IN gain scales what is recorded; OUT gain scales the output", () => {
  const n = 2000, x = sine(300, n, 0.2);
  const a = engine({ density: 0.5, ingain: 2 }); a.run(n, [x, x]);
  const b = engine({ density: 0.5, ingain: 1 }); b.run(n, [x, x]);
  const peak = (d) => { let m = 0; for (let i = 0; i < 192000; i++) m = Math.max(m, Math.abs(d[i])); return m; };
  const pa = peak(a.D.buf.a), pb = peak(b.D.buf.a);
  assert.ok(Math.abs(pa / pb - 2) < 0.01, "recorded ×2: " + pa / pb);
  const o1 = engine({ drywet: 0, density: 0.5, outgain: 1 }).run(n, [x, x])[0];
  const o2 = engine({ drywet: 0, density: 0.5, outgain: 0.5 }).run(n, [x, x])[0];
  assert.ok(Math.abs(rms(o2, 1000, n) / rms(o1, 1000, n) - 0.5) < 0.01);
});

test("parameters are read once at the start of a grain (turning PITCH later does not bend a playing grain)", () => {
  const g = engine({ seedlatch: 0, density: 0.5, size: 0.8, shape: 0, time: 0.3, pitch: knobForSemis(0) });
  const n = SR * 3, x = sine(220, n);
  g.run(SR * 2, [x.subarray(0, SR * 2), x.subarray(0, SR * 2)]);
  g.set("seed", 1);
  const a = g.run(SR / 4, [x.subarray(SR * 2), x.subarray(SR * 2)]);
  g.set("pitch", knobForSemis(12));
  const b = g.run(SR / 4, [x.subarray(SR * 2.25), x.subarray(SR * 2.25)]);
  assert.ok(Math.abs(zcHz(a[0], 2400, SR / 4) - 220) < 3 && Math.abs(zcHz(b[0], 0, SR / 4) - 220) < 3, "still 220 Hz");
  assert.strictEqual(grainStarts(b).length, 0, "no new grain was started");
});

function startPositions(params, n = SR * 6) {
  const g = engine(Object.assign({ density: 0.05, size: 0.35, time: 0.5 }, params));
  const o = g.run(n, [new Float64Array(n), new Float64Array(n)]);
  return grainStarts(o).map((i) => (o[5][i] * 192000 - 257) / (192000 - 514));
}
// the exact law of RandomizedParameter::value() without CV (C randomized_parameter.h), simulated
function lawNear(att, base, N = 200000) {
  let near = 0, s = 12345;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < N; i++) {
    const blend = att > 0 ? att : Math.min(1, att * r() * -3);
    const v = Math.min(1, Math.max(0, base + (r() - base) * blend));
    if (Math.abs(v - base) < 0.1) near++;
  }
  return near / N;
}
test("RND: CW uniform spread, CCW peaky spread — distributions match the Beads law; centre = none", () => {
  const near = (a) => a.filter((v) => Math.abs(v - 0.5) < 0.1).length / a.length;
  const att = (k) => { const v = k - 0.5; return (2 / 0.47) * v * Math.max(Math.abs(v) - 0.03, 0); };
  const none = startPositions({ time_amt: 0.5 });
  assert.ok(none.every((v) => Math.abs(v - 0.5) < 0.002), "centre: no spread");
  for (const k of [1, 0.75, 0.25, 0]) {
    const got = near(startPositions({ time_amt: k }, SR * 10)), want = lawNear(att(k), 0.5);
    assert.ok(Math.abs(got - want) < 0.06, `knob ${k}: near-centre share ${got.toFixed(3)} vs law ${want.toFixed(3)}`);
  }
  // shape: CW = even spread inside a bounded window (±|att|/2); CCW = clustered with rare far outliers
  const cw = startPositions({ time_amt: 0.75 }, SR * 10), ccw = startPositions({ time_amt: 0.25 }, SR * 10), a = Math.abs(att(0.75));
  const far = (arr) => Math.max(...arr.map((v) => Math.abs(v - 0.5)));
  assert.ok(far(cw) <= a / 2 + 0.01, `CW bounded: ${far(cw).toFixed(3)} ≤ ${(a / 2).toFixed(3)}`);
  assert.ok(far(ccw) > a / 2 + 0.05, `CCW has outliers: ${far(ccw).toFixed(3)}`);
});

test("CV mode: CW = amount of CV, CCW = CV-controlled randomness (MOD sources plug in here)", () => {
  const run = (amt, cv) => {
    const g = engine({ density: 0.05, size: 0.35, time: 0, time_amt: amt, time_cv: 1 });
    const n = SR * 3, c = new Float64Array(n).fill(cv), z = new Float64Array(n);
    const o = g.run(n, [z, z, c]);
    return grainStarts(o).map((i) => (o[5][i] * 192000 - 257) / (192000 - 514));
  };
  const amount = run(1, 0.4);
  assert.ok(amount.every((v) => Math.abs(v - 0.4) < 0.01), "CW: base + CV");
  const rnd = run(0, 0.4), rnd0 = run(0, 0);
  assert.ok(Math.max(...rnd) - Math.min(...rnd) > 0.2 && rnd.every((v) => v <= 0.41), "CCW: randomness scaled by CV");
  assert.ok(rnd0.every((v) => Math.abs(v) < 0.002), "CCW with CV 0: none");
});

// ---- MOD sources (v0.2): tempo from Live arrives as a bar phase on in7
const BPM = 120, BAR = Math.round(SR * 60 / BPM * 4);   // 96000 samples per bar
const barPhase = (n, start = 0) => Float64Array.from({ length: n }, (_, i) => ((i + start) / BAR) % 1);
function modRun(params, bars, input, phase) {
  const n = Math.round(bars * BAR), g = engine(Object.assign({ drywet: 1 }, params));
  const x = input || sine(220, n, 0.4), z = new Float64Array(n);
  const o = g.run(n, [x, x, z, z, z, z, phase || barPhase(n)]);
  return { o, g, n };
}
const DIVIDX = { "1/4": 7, "1/8": 10, "1/8T": 11, "1/16": 12, "1/2T": 6 };
test("CLOCK synced to Live → SEED (LATCH off, 12 o'clock): exactly one grain per division (1/16 = 16 per bar, 1/8T = 12, 1/4 = 4)", () => {
  for (const [div, per] of [["1/16", 16], ["1/8T", 12], ["1/4", 4]]) {
    const r = modRun({ seedlatch: 0, density: 0.5, dst_seed: 5, ck_sync: 1, ck_rate: DIVIDX[div] / 14, time: 0.02, size: 0.4 }, 2);
    const t = grainStarts(r.o);
    assert.strictEqual(t.length, per * 2, `${div}: ${t.length} grains in 2 bars`);
    const step = BAR / per;
    // the module delays SEED by 2.5 ms (120 samples); synced sources run that much ahead, so every
    // grain is on the grid — except the very first after Play (nothing to run ahead of yet)
    assert.ok(t[0] <= 121, `${div}: first grain within 2.5 ms of the downbeat (${t[0]})`);
    t.slice(1).forEach((s) => { const k = s / step; assert.ok(Math.abs(k - Math.round(k)) * step <= 1, `${div}: grain at ${s} is on the grid`); });
  }
});
test("Live stopped (bar phase frozen): a synced CLOCK sends no pulses", () => {
  const n = BAR, frozenPhase = new Float64Array(n).fill(0.3);
  const r = modRun({ seedlatch: 0, density: 0.5, dst_seed: 5, ck_sync: 1, ck_rate: DIVIDX["1/16"] / 14 }, 1, null, frozenPhase);
  assert.strictEqual(grainStarts(r.o).length, 0);
});
test("CLOCK into SEED with LATCH on = Beads clocked mode: DENSITY CCW divides the pulses", () => {
  const counts = [0.47, 0.3, 0.05].map((d) => grainStarts(modRun({ seedlatch: 1, density: d, dst_seed: 5, ck_sync: 1, ck_rate: DIVIDX["1/16"] / 14, time: 0.02, size: 0.4 }, 2).o).length);
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2], "more division towards 12 o'clock: " + counts);
  assert.ok(counts[2] >= 31 && counts[2] <= 32, "fully CCW = every pulse: " + counts[2]);
});
test("SEQ → SEED: grains only on the steps that are on, exactly on the 1/16 grid", () => {
  const on = [0, 3, 6, 8, 10, 14];
  const steps = {}; for (let i = 0; i < 16; i++) steps["sq" + i] = on.includes(i) ? 0.5 : -1;
  const r = modRun(Object.assign({ seedlatch: 0, density: 0.5, dst_seed: 6, sq_div: 12, sq_len: 16, time: 0.02, size: 0.4 }, steps), 2);
  const t = grainStarts(r.o).map((s) => Math.round(s / (BAR / 16)) % 16);
  assert.deepStrictEqual(t, on.concat(on));
});
test("SEQ length: a 3-step pattern repeats every 3 sixteenths (polyrhythm against the bar)", () => {
  const steps = { sq0: 0.5, sq1: -1, sq2: -1 };
  const r = modRun(Object.assign({ seedlatch: 0, density: 0.5, dst_seed: 6, sq_div: 12, sq_len: 3, time: 0.02, size: 0.4 }, steps), 1.5);
  const t = grainStarts(r.o).slice(1), d = t.slice(1).map((v, i) => v - t[i]);   // after the first grain (see the CLOCK test)
  assert.ok(d.every((x) => Math.abs(x - 3 * BAR / 16) <= 1), "every 3 sixteenths: " + d.slice(0, 4));
});
test("slicing: SEQ → SEED and SEQ → TIME (RND fully CW = CV amount): each step plays its own slice of the frozen buffer", () => {
  const vals = [0.1, 0.4, 0.7, 0.25];
  const steps = {}; for (let i = 0; i < 16; i++) steps["sq" + i] = i < 4 ? vals[i] : -1;
  // record 2 s, then freeze and play the pattern
  const n = 2 * SR + BAR, g = engine(Object.assign({ drywet: 1, seedlatch: 0, density: 0.5, time: 0, time_amt: 1, size: 0.4, dst_seed: 6, dst_time: 6, sq_div: 12, sq_len: 4 }, steps));
  const z = new Float64Array(n), x = sine(220, n, 0.4);
  const ph = Float64Array.from({ length: n }, (_, i) => (i < 2 * SR ? 0 : ((i - 2 * SR) / BAR) % 1));
  g.set("freeze", 0); g.run(2 * SR, [x, x, z, z, z, z, ph.subarray(0, 2 * SR)]);
  g.set("freeze", 1);
  const o = g.run(BAR, [x.subarray(2 * SR), x.subarray(2 * SR), z, z, z, z, ph.subarray(2 * SR)]);
  const pos = grainStarts(o).map((i) => (o[5][i] * 192000 - 257) / (192000 - 514));
  assert.ok(pos.length >= 15, "grains: " + pos.length);
  pos.forEach((p, k) => assert.ok(Math.abs(p - vals[k % 4]) < 0.003, `step ${k % 4}: slice ${p.toFixed(3)} vs ${vals[k % 4]}`));
});
test("LFO synced 1 bar → TIME: grain positions follow the LFO shape (sine / saw)", () => {
  for (const shp of [0, 2]) {
    const r = modRun({ density: 0.1, time: 0.5, time_amt: 0.75, dst_time: 1, l1_sync: 1, l1_rate: 3 / 14, l1_shape: shp }, 1);
    const t = grainStarts(r.o), att = (2 / 0.47) * 0.25 * (0.25 - 0.03);
    let err = 0;
    for (const i of t) {
      const want = Math.min(1, Math.max(0, 0.5 + att * (shp === 0 ? Math.sin(2 * Math.PI * i / BAR) : 1 - 2 * (i / BAR))));
      err = Math.max(err, Math.abs((r.o[5][i] * 192000 - 257) / (192000 - 514) - want));
    }
    assert.ok(t.length > 20 && err < 0.02, `shape ${shp}: max error ${err.toFixed(4)} over ${t.length} grains`);
  }
});
test("LFO free rate in Hz: 0.02 · 1000^rate; R restarts its phase when Live starts", () => {
  const r = modRun({ density: 0.05, time: 0.5, time_amt: 0.75, dst_time: 1, l1_sync: 0, l1_rate: 0.5, l1_shape: 3 }, 1);
  const hz = 0.02 * Math.pow(1000, 0.5), t = grainStarts(r.o), pos = t.map((i) => r.o[5][i]);
  let flips = 0; for (let k = 1; k < pos.length; k++) if (Math.abs(pos[k] - pos[k - 1]) > 0.1) flips++;
  assert.ok(Math.abs(flips - 2 * hz * BAR / SR) <= 2, `square flips ${flips} vs ${2 * hz * BAR / SR}`);
  // R: Live stopped then started → phase restarts at 0 (square starts high)
  const n = SR, ph = Float64Array.from({ length: n }, (_, i) => (i < SR / 2 ? 0 : ((i - SR / 2) / BAR) % 1));
  const g = engine({ drywet: 1, density: 0.05, time: 0.5, time_amt: 0.75, dst_time: 1, l1_sync: 0, l1_rate: 0.3, l1_shape: 3, l1_reset: 1 });
  const z = new Float64Array(n), x = sine(220, n);
  const o = g.run(n, [x, x, z, z, z, z, ph]);
  // Live starts on sample SR/2 + 1 (first sample where the bar phase moves): the phase restarts there
  assert.ok(Math.abs(g.H.l1_ph - fract(0.02 * Math.pow(1000, 0.3) * (SR / 2 - 2) / SR)) < 1e-9, "phase counted from the restart");
});
function fract(x) { return x - Math.floor(x); }
test("RANDOM: values stay within ±AMT; STEPS hold between changes, SMOOTH glides; own generator (grain random stream untouched)", () => {
  const rr = (smooth) => { const r = modRun({ density: 0.05, time: 0.5, time_amt: 0.75, dst_time: 3, rn_rate: 0.5, rn_smooth: smooth, rn_amt: 0.5 }, 1); return grainStarts(r.o).map((i) => (r.o[5][i] * 192000 - 257) / (192000 - 514)); };
  const att = (2 / 0.47) * 0.25 * 0.22, step = rr(0), smooth = rr(1);
  for (const p of step.concat(smooth)) assert.ok(Math.abs(p - 0.5) <= att * 0.5 + 1e-6);
  const distinct = (a) => new Set(a.map((v) => v.toFixed(5))).size;
  assert.ok(distinct(step) < step.length / 2, "steps repeat values: " + distinct(step) + "/" + step.length);
  assert.ok(distinct(smooth) > smooth.length * 0.8, "smooth keeps moving");
});
test("ENV → SEED (LATCH off): grains only while the input is loud", () => {
  const n = BAR, x = Float64Array.from({ length: n }, (_, i) => (i < n / 2 ? 0.5 : 0.001) * Math.sin(2 * Math.PI * 220 * i / SR));
  const r = modRun({ seedlatch: 0, density: 0.2, dst_seed: 4, env_gain: 0.5, time: 0.02 }, 1, x);
  const t = grainStarts(r.o);
  assert.ok(t.length > 5 && t.every((i) => i < n / 2 + 0.2 * SR), "grains in the loud half only: " + t.length);
});

// ---- R5 auto input gain (Beads GainControl)
test("R5 AUTO gain: learns for 1 + 5 s, then gain = 0.9 / peak (max ×40); LEARN restarts; manual = IN with ±1 clipping", () => {
  const run = (amp, extra = {}, sec = 8) => {
    const g = engine(Object.assign({ agc: 1, drywet: 0, density: 0.5 }, extra)), n = sec * SR, x = sine(300, n, amp), z = new Float64Array(n);
    const o = g.run(n, [x, x, z, z, z, z, z]);
    return { g, o, n };
  };
  const loud = run(0.3), quiet = run(0.01), silentish = run(0.001);
  const gainAt = (r, s) => r.o[9][Math.round(s * SR)];
  assert.ok(Math.abs(gainAt(loud, 7.9) - 0.9 / 0.3) / 3 < 0.05, "loud: ×" + gainAt(loud, 7.9).toFixed(2));
  assert.ok(Math.abs(gainAt(quiet, 7.9) - 40) < 1, "quiet (-40 dB): ×" + gainAt(quiet, 7.9).toFixed(1) + " (capped at 40)");
  // first second: agc_peak is held at 0.5 → gain 0.9 / 0.5 = ×1.8 (GainControl), whatever the input
  assert.ok(Math.abs(gainAt(loud, 0.5) - 1.8) < 1e-9 && Math.abs(gainAt(quiet, 0.9) - 1.8) < 1e-9, "×1.8 during the first second");
  assert.ok(loud.o[10][Math.round(3 * SR)] === 1 && loud.o[10][Math.round(7 * SR)] === 0, "learning flag 1 → 0 after 6 s");
  // FLØCK: the engine works on the raised signal, the output is divided by the gain → the dry
  // output of the quiet source is back at its own level (0.01 × 0.75 dry gain), not +32 dB louder
  let pk = 0; for (let i = 7 * SR; i < 8 * SR; i++) pk = Math.max(pk, Math.abs(quiet.o[0][i]));
  assert.ok(Math.abs(pk - 0.0075) < 0.0005, "output back at the input level: peak " + pk.toFixed(4));
  // LEARN: a new agc_restart value skips the 1 s wait and learns again
  const r = run(0.3, {}, 7); r.g.set("agc_restart", 1);
  const z = new Float64Array(SR), x = sine(300, SR, 0.05);
  const o2 = r.g.run(SR, [x, x, z, z, z, z, z]);
  assert.ok(o2[10][100] === 1, "learning again");
  // manual
  const m = run(0.3, { agc: 0, ingain: 2 }, 1);
  assert.ok(Math.abs(m.o[9][SR - 1] - 2) < 1e-9 && silentish.o[9].length);
});

// ---- FILTER (FLØCK): Moog-style ladder low-pass + high-pass; FLØCK sounds between them
function filterGain(f, k) {
  const g = engine(Object.assign({ drywet: 0, reverb: 0, flt_all: 1, density: 0.5, seedlatch: 0 }, k));
  const n = SR / 2, x = Float64Array.from({ length: n }, (_, i) => 0.2 * Math.sin(2 * Math.PI * f * i / SR));
  const o = g.run(n, [x, x])[0]; let e = 0, ei = 0; for (let i = n / 2; i < n; i++) { e += o[i] ** 2; ei += x[i] ** 2; }
  return 10 * Math.log10(e / ei) + 2.499;   // dry gain 0.75 removed
}
const at = (hz) => Math.log(hz / 20) / Math.log(1000);   // knob position for a frequency (20 Hz … 20 kHz)
test("FILTER strength (the points' height, like Echo): 6 dB/oct at the bottom … 24 dB/oct at the top, both cuts, no peak", () => {
  for (const [k, cut, f2, f4] of [["lp", "lp_cut", 4000, 8000], ["hp", "hp_cut", 250, 125]]) {   // an octave away from the knee
    for (const [sl, want] of [[0, 6], [1, 24]]) {
      const o = { [cut]: at(1000), [k + "_slope"]: sl };
      const a = filterGain(f2, o), b = filterGain(f4, o), c = filterGain(1000, o);
      assert.ok(Math.abs(a - b - want) < 2.5, `${k} strength ${sl}: ${(a - b).toFixed(1)} dB/oct`);
      assert.ok(Math.abs(c + want / 2) < 1.5, `${k} at the cutoff: ${c.toFixed(1)} dB`);
    }
  }
  const lp = { lp_cut: at(1000) };
  const d = [250, 500, 700, 1000, 2000, 4000].map((f) => filterGain(f, lp));
  assert.ok(d.every((v, k) => k === 0 || v <= d[k - 1] + 0.3) && d[0] <= 0.3, "falls monotonically (no bump): " + d.map((v) => v.toFixed(1)));
});
test("FILTER: together a smooth bell; defaults = fully open (bit-exact bypass)", () => {
  const band = { hp_cut: at(300), lp_cut: at(3000) };
  const g = [100, 300, 1000, 3000, 9000].map((f) => filterGain(f, band));
  assert.ok(g[2] > g[1] && g[2] > g[3] && g[2] <= 0.5 && g[0] < g[1] && g[4] < g[3], "bell: " + g.map((v) => v.toFixed(1)));
  const n = 4000, x = sine(300, n, 0.3);
  const o1 = engine({}).run(n, [x, x]), o2 = engine({ lp_cut: 1, hp_cut: 0, lp_slope: 0.2, hp_slope: 0.9 }).run(n, [x, x]);
  assert.deepStrictEqual(Array.from(o1[0]), Array.from(o2[0]));
});
test("FILTER on the grains only by default: the dry signal is untouched", () => {
  const dryOnly = (k) => { const g = engine(Object.assign({ drywet: 0, reverb: 0, density: 0.5, seedlatch: 0 }, k)); const n = 4000, x = sine(3000, n, 0.3); return g.run(n, [x, x])[0]; };
  assert.deepStrictEqual(Array.from(dryOnly({ lp_cut: at(300) })), Array.from(dryOnly({})));
});

test("FILTER OFF: no filter at all, whatever the points say (bit-exact)", () => {
  const n = 4000, x = sine(3000, n, 0.3);
  const a = engine({ flt_all: 1 }).run(n, [x, x]), b = engine({ flt_all: 1, flt_on: 0, lp_cut: 0.3, hp_cut: 0.5, lp_slope: 1 }).run(n, [x, x]);
  assert.deepStrictEqual(Array.from(a[0]), Array.from(b[0]));
  assert.ok(filterGain(3000, { lp_cut: 0.3 }) < -20 && Math.abs(filterGain(3000, { lp_cut: 0.3, flt_on: 0 })) < 0.5);
});
