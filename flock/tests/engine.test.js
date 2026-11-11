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
  const base = { reverb: 0, drywet: 1, time: 0.02, time_amt: 0.5, size_amt: 0.5, shape_amt: 0.5, pitch_amt: 0.5 };
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

test("DENSITY (latched): CCW = constant rate, CW = random rate, 12 o'clock = no grains", () => {
  const n = SR * 4;
  const iv = (d) => { const s = grainStarts(engine({ density: d }).run(n, [sine(100, n), sine(100, n)])); return s.slice(1).map((v, i) => v - s[i]); };
  const cv = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m; };
  const steady = iv(0.2), rnd = iv(0.8);
  assert.ok(steady.length > 10 && cv(steady) < 0.01, "constant: cv " + cv(steady));
  assert.ok(rnd.length > 10 && cv(rnd) > 0.3, "random: cv " + cv(rnd));
  assert.strictEqual(iv(0.5).length, 0, "12 o'clock: silent");
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
