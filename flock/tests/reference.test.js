// DIFFERENTIAL test: the gen~ engine vs an independent transcription of the Beads C++
// (tools/beads_ref.js, blocks of 24 like the module). Same random stream for both.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { GenPatch } = require("../tools/genexpr");
const { Ref, fromKnobs } = require("../tools/beads_ref");
const SR = 48000;
const SRC = fs.readFileSync(path.join(__dirname, "..", "gen", "flock.genexpr"), "utf8");
const BASE = { time: 0.5, density: 0.3, pitch: 0.5, size: 0.45, shape: 0.5, time_amt: 0.5, pitch_amt: 0.5, size_amt: 0.5,
  shape_amt: 0.5, feedback: 0, drywet: 0.5, reverb: 0.2, freeze: 0, seed: 0, seedlatch: 1 };

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function source(n, seed) {
  const r = lcg(seed), L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; L[i] = 0.3 * Math.sin(2 * Math.PI * 220 * t) * (0.6 + 0.4 * Math.sin(t * 3)) + 0.05 * (r() - 0.5); R[i] = 0.25 * Math.sin(2 * Math.PI * 330 * t + 1) + 0.05 * (r() - 0.5); }
  return [L, R];
}
// phases: [{sec, knobs}] applied one after another to both models
function compare(phases, seed = 11) {
  if (!Array.isArray(phases)) phases = [{ sec: 2, knobs: phases }];
  const n = Math.round(phases.reduce((a, p) => a + p.sec, 0) * SR), [L, R] = source(n, 99);
  const g = new GenPatch(SRC, { sr: SR, seed });
  let s = seed >>> 0 || 1;
  const ref = new Ref(SR, () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; });
  const go = [new Float64Array(n), new Float64Array(n)], ro = [new Float64Array(n), new Float64Array(n)];
  let at = 0, k = Object.assign({}, BASE);
  for (const ph of phases) {
    k = Object.assign({}, k, ph.knobs);
    const m = Math.round(ph.sec * SR);
    for (const [key, v] of Object.entries(k)) g.set(key, v);
    const a = g.run(m, [L.subarray(at, at + m), R.subarray(at, at + m)]);
    go[0].set(a[0], at); go[1].set(a[1], at);
    const P = fromKnobs(k), oL = ro[0], oR = ro[1];
    for (let b = at; b < at + m; b += 24) ref.processBlock(P, L, R, oL, oR, b, Math.min(24, at + m - b));
    at += m;
  }
  let err = 0, sig = 0, maxd = 0;
  for (let ch = 0; ch < 2; ch++) for (let i = 0; i < n; i++) { const d = go[ch][i] - ro[ch][i]; err += d * d; sig += ro[ch][i] ** 2; maxd = Math.max(maxd, Math.abs(d)); }
  return { rel: Math.sqrt(err / Math.max(sig, 1e-12)), maxd, sig: Math.sqrt(sig / (2 * n)) };
}

const CASES = [
  ["default", {}],
  ["dense even grains +12 st", { density: 0.05, size: 0.62, shape: 0.6, pitch: (5.15 / 6 + 1) / 2, drywet: 1 }],
  ["reversed short square grains", { density: 0.2, size: 0.15, shape: 0, drywet: 1, time: 0.1 }],
  ["random spreads on all four", { density: 0.1, time_amt: 0.9, pitch_amt: 0.1, size_amt: 0.8, shape_amt: 0.2, drywet: 1 }],
  ["feedback + reverb", { density: 0.08, size: 0.7, feedback: 0.7, reverb: 0.8, time: 0.02, drywet: 0.9 }],
  ["freeze after 1 s of recording, then unfreeze", [{ sec: 1, knobs: { density: 0.1, size: 0.6, time: 0.1, drywet: 1 } }, { sec: 1, knobs: { freeze: 1 } }, { sec: 0.5, knobs: { freeze: 0 } }]],
  ["gated SEED: press, release, press (one grain each at 12 o'clock)", [{ sec: 1, knobs: { seedlatch: 0, density: 0.5, size: 0.7, time: 0.2, drywet: 1 } }, { sec: 0.3, knobs: { seed: 1 } }, { sec: 0.3, knobs: { seed: 0 } }, { sec: 0.6, knobs: { seed: 1 } }]],
  ["very dense, 32-voice stealing", { density: 0.0, size: 0.9, shape: 0.7, time: 0.05, drywet: 1 }],
  ["knobs moving between phases (interpolators)", [{ sec: 0.7, knobs: { density: 0.1, time: 0.05, drywet: 0.3, reverb: 0.1 } }, { sec: 0.7, knobs: { drywet: 0.9, reverb: 0.7, feedback: 0.5, pitch: 0.7 } }, { sec: 0.7, knobs: { drywet: 0.2, reverb: 0.3, feedback: 0 } }]],
];
for (const [name, k] of CASES) {
  test(`gen~ = Beads reference (same random stream): ${name}`, () => {
    const r = compare(k);
    assert.ok(r.sig > 1e-3, "audible");
    assert.ok(r.rel < 1e-9, `relative error ${r.rel.toExponential(2)} (max |diff| ${r.maxd.toExponential(2)})`);
  });
}
// random grain rate: the module draws the trigger randomness for a whole 24-sample block before
// the grains; gen~ draws per sample → same law, different order of the random stream
test("random grain rate (CW): same statistics as the reference (order of random draws differs by design)", () => {
  const k = Object.assign({}, BASE, { density: 0.8, drywet: 1, size: 0.5 });
  const n = SR * 8, [L, R] = source(n, 5);
  const g = new GenPatch(SRC, { sr: SR, seed: 3 }); for (const [key, v] of Object.entries(k)) g.set(key, v);
  const go = g.run(n, [L, R]);
  const gs = go[2].reduce((a, v) => a + (v > 0.5 ? 1 : 0), 0);
  let count = 0; const ref = new Ref(SR, lcg(3));
  const orig = ref.playerRender.bind(ref); ref.playerRender = (t, p, o) => { if (t.trigger) count++; orig(t, p, o); };
  ref.run(fromKnobs(k), L, R);
  assert.ok(Math.abs(gs - count) / count < 0.15, `grain count gen ${gs} vs ref ${count}`);
});
