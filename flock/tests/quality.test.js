// R6 RECORDING QUALITIES: the gen~ engine vs the independent reference (tools/beads_ref.js runHost:
// codec clock + FLØCK converters + Processor at the quality's rate). Same random stream for both.
// Plus checks of the constants against the Beads source itself (buffer lengths, µ-law table points).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { GenPatch } = require("../tools/genexpr");
const { fromKnobs, runHost, Lin2MuLaw, MuLaw2Lin, kaiserSinc } = require("../tools/beads_ref");
const SR = 48000;
const SRC = fs.readFileSync(path.join(__dirname, "..", "gen", "flock.genexpr"), "utf8");
const BASE = { time: 0.5, density: 0.3, pitch: 0.5, size: 0.45, shape: 0.5, time_amt: 0.5, pitch_amt: 0.5, size_amt: 0.5,
  shape_amt: 0.5, feedback: 0, drywet: 0.5, reverb: 0.2, freeze: 0, seed: 0, seedlatch: 1, agc: 0, ingain: 1, dn_amt: 1 };
const NAMES = ["Pristine", "Cold digital", "Sunny tape", "Scorched cassette"];

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function source(n, seed) {
  const r = lcg(seed), L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; L[i] = 0.3 * Math.sin(2 * Math.PI * 220 * t) * (0.6 + 0.4 * Math.sin(t * 3)) + 0.05 * (r() - 0.5); R[i] = 0.25 * Math.sin(2 * Math.PI * 330 * t + 1) + 0.05 * (r() - 0.5); }
  return [L, R];
}
function compare(q, phases, seed = 11) {
  if (!Array.isArray(phases)) phases = [{ sec: 2, knobs: phases }];
  const n = Math.round(phases.reduce((a, p) => a + p.sec, 0) * SR), [L, R] = source(n, 99);
  const g = new GenPatch(SRC, { sr: SR, seed });
  const go = [new Float64Array(n), new Float64Array(n)];
  let at = 0, k = Object.assign({ quality: q }, BASE);
  const rp = [];
  for (const ph of phases) {
    k = Object.assign({}, k, ph.knobs);
    const m = Math.round(ph.sec * SR);
    for (const [key, v] of Object.entries(k)) g.set(key, v);
    const a = g.run(m, [L.subarray(at, at + m), R.subarray(at, at + m)]);
    go[0].set(a[0], at); go[1].set(a[1], at);
    rp.push({ hostSamples: m, P: fromKnobs(k) });
    at += m;
  }
  let s = seed >>> 0 || 1;
  const [rL, rR, ref] = runHost(SR, q, () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }, rp, L, R);
  const ro = [rL, rR];
  let err = 0, sig = 0, maxd = 0;
  for (let ch = 0; ch < 2; ch++) for (let i = 0; i < n; i++) { const d = go[ch][i] - ro[ch][i]; err += d * d; sig += ro[ch][i] ** 2; maxd = Math.max(maxd, Math.abs(d)); }
  return { rel: Math.sqrt(err / Math.max(sig, 1e-12)), maxd, sig: Math.sqrt(sig / (2 * n)), g, ref, out: go };
}

const CASES = [
  ["default", {}],
  // TIME is a fraction of the buffer (8 / 10.7 / 16 s here): keep it inside what 2 s have recorded
  ["dense grains +12 st, wet only", { density: 0.05, size: 0.62, shape: 0.6, pitch: (5.15 / 6 + 1) / 2, drywet: 1, time: 0.05 }],
  ["heavy feedback (soft-clipped feedback path) + reverb", { density: 0.08, size: 0.7, feedback: 0.85, reverb: 0.8, time: 0.02, drywet: 0.9 }],
  ["freeze, then unfreeze", [{ sec: 1, knobs: { density: 0.1, size: 0.6, time: 0.03, drywet: 1 } }, { sec: 0.5, knobs: { freeze: 1 } }, { sec: 0.5, knobs: { freeze: 0 } }]],
  ["manual gain ×4 (soft clipping ON / DYNAMIC on the tapes)", { agc: 0, ingain: 4, density: 0.1, time: 0.05, drywet: 0.4 }],
  // DYNAMIC soft clip (Sunny tape) in its middle range: manual ×2 vs optimal ×1.8 (first second) → amount ≈ 0.72
  ["manual gain ×2 (soft clipping amount between 0 and 1)", [{ sec: 0.75, knobs: { agc: 0, ingain: 2, density: 0.1, time: 0.05, drywet: 0.3 } }]],
  ["auto gain learning", [{ sec: 2, knobs: { agc: 1, density: 0.1, time: 0.05, drywet: 0.6 } }, { sec: 1, knobs: {} }]],
  ["reversed short grains, TIME further back", [{ sec: 2.5, knobs: { density: 0.2, size: 0.15, shape: 0, drywet: 1, time: 0.12 } }]],
];
for (const q of [1, 2, 3]) for (const [name, k] of CASES) {
  test(`R6 ${NAMES[q]}: gen~ = Beads reference (same random stream): ${name}`, () => {
    const r = compare(q, k);
    assert.ok(r.sig > 1e-3, "audible");
    assert.ok(r.rel < 1e-9, `relative error ${r.rel.toExponential(2)} (max |diff| ${r.maxd.toExponential(2)})`);
  });
}

test("R6 Pristine through the quality path is still the v0.2 engine (reference with quality 0)", () => {
  const r = compare(0, { density: 0.08, size: 0.7, feedback: 0.6, reverb: 0.6, time: 0.05, drywet: 0.9 });
  assert.ok(r.rel < 1e-9, `relative error ${r.rel.toExponential(2)}`);
});

test("R6 buffer lengths from processor.h: kDelayBufferSizeBits / (bits · 2) → 4 s / 8 s / 10.7 s / 16 s", () => {
  const bits = 768 * 1000 * 8;
  const expect = [[bits / 32, 48000], [bits / 24, 32000], [bits / 24, 24000], [bits / 16, 24000]];
  for (let q = 0; q < 4; q++) {
    const g = new GenPatch(SRC, { sr: SR, seed: 1 }); g.set("quality", q); g.set("density", 0.5);
    const n = 9000; g.run(n, [new Float64Array(n), new Float64Array(n)]);
    // the head moves backwards one frame per core sample: wp = MAXD − frames written
    const rate = expect[q][1], frames = Math.floor(n * rate / SR);
    const wp = g.H.wp, MAXD = expect[q][0];
    assert.ok(Math.abs((MAXD - wp) - frames) <= 1, `${NAMES[q]}: wp ${wp}, MAXD ${MAXD}, frames ${frames}`);
  }
});

test("R6 µ-law: encoder + decoder table points from mu_law.cc (lut_ulaw_f[0], [127], [128], [255], [200])", () => {
  assert.strictEqual(MuLaw2Lin(0), -0.98035);
  assert.strictEqual(MuLaw2Lin(16), -0.48816);
  assert.strictEqual(MuLaw2Lin(255), 0);
  assert.strictEqual(MuLaw2Lin(Lin2MuLaw(32767)), 0.98035);
  assert.strictEqual(MuLaw2Lin(Lin2MuLaw(-32768)), -0.98035);
  // logarithmic: the error is small for quiet samples and large for loud ones
  const err = (x) => Math.abs(MuLaw2Lin(Lin2MuLaw(Math.trunc(x * 32768))) - x);
  let quiet = 0, loud = 0;
  for (let i = 1; i < 200; i++) { quiet = Math.max(quiet, err(0.001 * i / 200)); loud = Math.max(loud, err(0.8 + 0.1 * i / 200)); }
  assert.ok(quiet < 0.0002 && loud > 0.01, `quiet ${quiet}, loud ${loud}`);
});

test("R6 codec converter kernel: unity at 0, zero at ±16 samples, low-pass (cutoff 0.47 · rate)", () => {
  assert.ok(Math.abs(kaiserSinc(0) - 0.94) < 1e-12);
  assert.ok(kaiserSinc(16) === 0 && kaiserSinc(-16) === 0);
  // frequency response of the continuous kernel (codec-rate units, sampled finely as on the host side): pass 0.35, stop 0.6
  const H = (f) => { let a = 0, w = 0; for (let x = -16; x <= 16; x += 0.125) { const k = kaiserSinc(x); a += k * Math.cos(2 * Math.PI * f * x); w += k; } return Math.abs(a / w); };
  assert.ok(Math.abs(H(0.35) - 1) < 0.01, "passband " + H(0.35));
  assert.ok(H(0.6) < 0.001, "stopband " + H(0.6));
});

test("R6 Scorched cassette sounds like a worn cassette: µ-law noise, wow & flutter pitch drift, dull top", () => {
  // a steady 1 kHz tone straight through (dry), Pristine vs Scorched cassette
  const n = SR * 3, x = Float64Array.from({ length: n }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 1000 * i / SR));
  const run = (q, extra = {}) => { const g = new GenPatch(SRC, { sr: SR, seed: 2 }); for (const [k, v] of Object.entries(Object.assign({ quality: q }, BASE, { drywet: 0, reverb: 0 }, extra))) g.set(k, v); return g.run(n, [x, x])[0]; };
  const zc = (a) => { const p = []; for (let i = SR + 1; i < n; i++) if (a[i - 1] < 0 && a[i] >= 0) p.push(i - a[i] / (a[i] - a[i - 1])); const per = []; for (let i = 1; i < p.length; i++) per.push(p[i] - p[i - 1]); return per; };
  const spread = (per) => Math.max(...per) - Math.min(...per);
  const clean = zc(run(0)), dirty = zc(run(3));
  assert.ok(spread(clean) < 0.01, "Pristine is stable: " + spread(clean));
  assert.ok(spread(dirty) > 0.3, "Scorched cassette wobbles: period spread " + spread(dirty).toFixed(2) + " samples");
  // 15 kHz is gone at 24 kHz (Nyquist 12 kHz)
  const hf = Float64Array.from({ length: n }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 15000 * i / SR));
  const g = new GenPatch(SRC, { sr: SR, seed: 2 }); for (const [k, v] of Object.entries(Object.assign({ quality: 3 }, BASE, { drywet: 0, reverb: 0 }))) g.set(k, v);
  const o = g.run(n, [hf, hf])[0]; let e = 0; for (let i = SR; i < n; i++) e += o[i] * o[i];
  assert.ok(Math.sqrt(e / (n - SR)) < 0.003, "15 kHz removed: rms " + Math.sqrt(e / (n - SR)));
});

test("R6 Cold digital: the dry signal is truncated to 12 bits — a signal below 1/4096 disappears, Pristine keeps it", () => {
  const n = SR, x = Float64Array.from({ length: n }, (_, i) => 0.0002 * Math.sin(2 * Math.PI * 200 * i / SR));
  const rms = (q) => {
    const g = new GenPatch(SRC, { sr: SR, seed: 2 }); for (const [k, v] of Object.entries(Object.assign({ quality: q }, BASE, { drywet: 0, reverb: 0, density: 0.5 }))) g.set(k, v);
    const o = g.run(n, [x, x])[0]; let e = 0; for (let i = n / 2; i < n; i++) e += o[i] * o[i]; return Math.sqrt(e / (n / 2));
  };
  const p = rms(0), c = rms(1);
  assert.ok(p > 0.0001, "Pristine passes it: " + p);
  assert.ok(c < 1e-9, "Cold digital truncates it to 0: " + c);
});

test("R6 changing the quality clears the buffer and restarts the grains; held while FREEZE is on (R7)", () => {
  const g = new GenPatch(SRC, { sr: SR, seed: 4 });
  for (const [k, v] of Object.entries(Object.assign({}, BASE, { quality: 0, density: 0.1, drywet: 1 }))) g.set(k, v);
  const n = SR, [L, R] = source(n, 3);
  g.run(n, [L, R]);
  let nz = 0; for (let i = 0; i < 192000; i++) if (g.D.buf.a[i] !== 0) nz++;
  assert.ok(nz > 40000, "recorded");
  g.set("freeze", 1); g.run(100, [L.subarray(0, 100), R.subarray(0, 100)]);
  g.set("quality", 3); g.run(1000, [L.subarray(0, 1000), R.subarray(0, 1000)]);
  assert.strictEqual(g.H.qc, 0, "held while frozen");
  g.set("freeze", 0); g.run(10, [L.subarray(0, 10), R.subarray(0, 10)]);
  assert.strictEqual(g.H.qc, 3, "applied after unfreeze");
  nz = 0; for (let i = 0; i < 384000; i++) if (g.D.buf.a[i] !== 0) nz++;
  assert.ok(nz < 20, "cleared (only the newest frames): " + nz);
});

test("X3 caveman reverb (every quality but Pristine): darker tail than Pristine (lp 0.4 vs 0.6 in the loop)", () => {
  const n = SR * 3, x = new Float64Array(n); for (let i = 0; i < 2400; i++) x[i] = 0.5 * Math.sin(i * 0.9) * Math.exp(-i / 600);
  const tail = (q) => {
    const g = new GenPatch(SRC, { sr: SR, seed: 2 }); for (const [k, v] of Object.entries(Object.assign({ quality: q }, BASE, { drywet: 0, reverb: 0.6 }))) g.set(k, v);
    const o = g.run(n, [x, x])[0]; let e = 0, zc = 0;
    for (let i = SR; i < 2 * SR; i++) { e += o[i] * o[i]; if ((o[i] < 0) !== (o[i - 1] < 0)) zc++; }
    return { e, zc };
  };
  const p = tail(0), c = tail(2);   // Sunny tape: same 48 kHz codec rate, only the reverb settings differ in the dry path
  // (the longer time 0.45 + 0.5 r³ does not win over the stronger damping: less energy after 1 s)
  assert.ok(c.e > 0 && c.e !== p.e, `different tail: ${c.e.toExponential(2)} vs ${p.e.toExponential(2)}`);
  assert.ok(c.zc < p.zc, `darker: ${c.zc} vs ${p.zc} zero crossings`);
});
