// DIFFERENTIAL test: the gen~ engine vs an independent transcription of the Beads C++
// (tools/beads_ref.js, blocks of 24 like the module). Same random stream for both.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { GenPatch } = require("../tools/genexpr");
const { Ref, fromKnobs, BLOCK } = require("../tools/beads_ref");
const SR = 48000;
const SRC = fs.readFileSync(path.join(__dirname, "..", "gen", "flock.genexpr"), "utf8");
// these scenarios were written for the v0.1 defaults; they set them explicitly (manual unity gain, DENSITY CV depth 1 = Beads)
const BASE = { time: 0.5, density: 0.3, pitch: 0.5, size: 0.45, shape: 0.5, time_amt: 0.5, pitch_amt: 0.5, size_amt: 0.5,
  shape_amt: 0.5, feedback: 0, drywet: 0.5, reverb: 0.2, freeze: 0, seed: 0, seedlatch: 1, agc: 0, ingain: 1, dn_amt: 1 };

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
    for (let b = at; b < at + m; b += BLOCK) ref.processBlock(P, L, R, oL, oR, b, Math.min(BLOCK, at + m - b));
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
  ["sorted voice stealing: 4 s grains at 30 grains/s (all 32 voices busy, the 5 ms fades act)", { density: 0.1328, size: 0.98, shape: 0.6, time: 0.05, drywet: 1 }],
  ["TIME turned slowly in small steps (pot low-pass + 0.001 hysteresis)", [{ sec: 0.5, knobs: { density: 0.05, time: 0.05, size: 0.5, drywet: 1 } }, { sec: 0.3, knobs: { time: 0.0512 } }, { sec: 0.3, knobs: { time: 0.0505 } }, { sec: 0.3, knobs: { time: 0.0531 } }, { sec: 0.3, knobs: { time: 0.0524 } }]],
  ["R5 AUTO gain on a quiet, swelling source (learning, then slow tracking)", [{ sec: 3, knobs: { agc: 1, density: 0.1, time: 0.05, size: 0.6, drywet: 0.6 } }, { sec: 4, knobs: {} }]],
  ["R5 manual gain ×3 with clipping at ±1", { agc: 0, ingain: 3, density: 0.1, time: 0.05, drywet: 0.6 }],
  ["MIDI keys (FLØCK Keys): a held key fires grains, +7 st from the note", { seedlatch: 0, ktrig: 1, kon: 1, knote: 7, density: 0.2, time: 0.05, drywet: 1 }],
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

// ---- inputs (what the MOD matrix plugs in): gen~ test inlets in3..in11 vs the reference's X signals
const sq = (n, hz, duty = 0.5, ph = 0.1) => Float64Array.from({ length: n }, (_, i) => (((i / SR) * hz + ph) % 1) < duty ? 1 : 0);
const sinus = (n, hz, a, off = 0) => Float64Array.from({ length: n }, (_, i) => off + a * Math.sin(2 * Math.PI * hz * i / SR));
function compareX(knobs, X, sec = 2, seed = 21) {
  const k = Object.assign({}, BASE, knobs), n = Math.round(sec * SR), [L, R] = source(n, 7);
  const g = new GenPatch(SRC, { sr: SR, seed });
  for (const [key, v] of Object.entries(k)) g.set(key, v);
  const z = new Float64Array(n);
  if (X.seed) g.set("dst_seed", 7);
  if (X.freeze) g.set("dst_freeze", 7);
  if (X.density) g.set("dst_density", 7);
  for (const [d, key, amt] of [["fb", "dst_feedback", "fb_amt"], ["dw", "dst_drywet", "dw_amt"], ["rv", "dst_reverb", "rv_amt"]]) if (X[d]) { g.set(key, 7); g.set(amt, X.amt[d]); }
  for (const [d, key] of [["time", "time_cv"], ["size", "size_cv"], ["shape", "shape_cv"], ["pitch", "pitch_cv"]]) if (X[d]) g.set(key, 1);
  const assign = X.fb || X.dw || X.rv || z;
  const go = g.run(n, [L, R, X.time || z, X.size || z, X.shape || z, X.pitch || z, z, X.seed || z, X.freeze || z, X.density || z, assign]);
  let s = seed >>> 0 || 1;
  const ref = new Ref(SR, () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; });
  const ro = [new Float64Array(n), new Float64Array(n)], P = fromKnobs(k);
  for (let b = 0; b < n; b += BLOCK) ref.processBlock(JSON.parse(JSON.stringify(P)), L, R, ro[0], ro[1], b, Math.min(BLOCK, n - b), X);
  let err = 0, sig = 0;
  for (let ch = 0; ch < 2; ch++) for (let i = 0; i < n; i++) { const d = go[ch][i] - ro[ch][i]; err += d * d; sig += ro[ch][i] ** 2; }
  return { rel: Math.sqrt(err / Math.max(sig, 1e-12)), sig: Math.sqrt(sig / (2 * n)), grains: go[2].reduce((a, v) => a + (v > 0.5), 0) };
}
const N3 = 3 * SR;
const XCASES = [
  ["G4 clocked SEED (latched) 8 Hz clock, DENSITY CCW = division", { density: 0.3, time: 0.05, size: 0.5, drywet: 1 }, { seed: sq(N3, 8) }],
  ["G4 clocked SEED, DENSITY CW = probability", { density: 0.8, time: 0.05, size: 0.5, drywet: 1 }, { seed: sq(N3, 8) }],
  ["G4 clocked SEED at audio rate (100 Hz) — tracked by a free-running phasor", { density: 0.2, time: 0.05, size: 0.42, drywet: 1 }, { seed: sq(N3, 100) }],
  ["G6 400 Hz clock into SEED: grains faster than 5 ms apart → the 5 ms voice-stealing fades act", { density: 0, size: 0.9, shape: 0.6, time: 0.05, drywet: 1 }, { seed: sq(N3, 400) }],
  ["G3 gated SEED from the input, 12 o'clock = one grain per rising edge", { seedlatch: 0, density: 0.5, time: 0.05, size: 0.55, drywet: 1 }, { seed: sq(N3, 4) }],
  ["G3 gated SEED from the input, grains repeat while the gate is high", { seedlatch: 0, density: 0.2, time: 0.05, size: 0.5, drywet: 1 }, { seed: sq(N3, 1.5, 0.4) }],
  ["G5 DENSITY CV in the middle = linear", { density: 0.3, time: 0.05, drywet: 1 }, { density: sinus(N3, 0.7, 0.15) }],
  ["G5 DENSITY CV near the extreme = exponential FM", { density: 0.03, time: 0.05, size: 0.45, drywet: 1 }, { density: sinus(N3, 0.5, 0.2) }],
  ["R2 FREEZE gate input", { density: 0.1, time: 0.1, size: 0.6, drywet: 1 }, { freeze: sq(N3, 0.6, 0.5, 0.6) }],
  ["X4 assignable CV → FEEDBACK / DRY-WET / REVERB with amounts", { density: 0.08, time: 0.02, size: 0.65, feedback: 0.3, reverb: 0.3, drywet: 0.5 }, { fb: sinus(N3, 0.4, 0.5), amt: { fb: 0.8 } }],
  ["X4 assignable CV → REVERB", { density: 0.1, time: 0.05, reverb: 0.2, drywet: 0.6 }, { rv: sinus(N3, 0.3, 0.6), amt: { rv: 1 } }],
  ["X4 assignable CV → DRY/WET", { density: 0.1, time: 0.05, drywet: 0.5 }, { dw: sinus(N3, 0.9, 0.5), amt: { dw: 0.6 } }],
  ["P8 TIME CV (scrub) with CW = amount", { density: 0.1, time: 0, time_amt: 1, size: 0.55, drywet: 1 }, { time: Float64Array.from({ length: N3 }, (_, i) => ((i / SR) * 0.5) % 1 * 0.3) }],
  ["P8 PITCH CV (semitones) with CW = amount", { density: 0.1, time: 0.05, pitch_amt: 1, size: 0.55, drywet: 1 }, { pitch: sinus(N3, 0.5, 7) }],
  ["P8 SIZE / SHAPE CV with CCW = CV-controlled randomness", { density: 0.1, time: 0.05, size_amt: 0.1, shape_amt: 0.2, drywet: 1 }, { size: sinus(N3, 0.3, 0.6, 0.2), shape: sinus(N3, 0.2, 0.5, 0.3) }],
];
for (const [name, k, X] of XCASES) {
  test(`gen~ = Beads reference with inputs: ${name}`, () => {
    const r = compareX(k, X);
    assert.ok(r.sig > 1e-3 && r.grains > 0, `audible (${r.grains} grains)`);
    assert.ok(r.rel < 1e-9, `relative error ${r.rel.toExponential(2)}`);
  });
}

// ---- trigger streams, swept finely (catches errors only some knob positions reach)
function trigStreams(knobs, X, sec, seed = 31) {
  const k = Object.assign({}, BASE, { reverb: 0, drywet: 1, time: 0.05 }, knobs), n = Math.round(sec * SR), z = new Float64Array(n);
  const g = new GenPatch(SRC, { sr: SR, seed });
  for (const [key, v] of Object.entries(k)) g.set(key, v);
  if (X.seed) g.set("dst_seed", 7);
  if (X.density) g.set("dst_density", 7);
  const go = g.run(n, [z, z, z, z, z, z, z, X.seed || z, z, X.density || z, z]);
  let s = seed >>> 0 || 1;
  const ref = new Ref(SR, () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; });
  const rt = [], orig = ref.playerRender.bind(ref);
  ref.playerRender = (t, p, o) => { rt.push(t.trigger ? 1 : 0); orig(t, p, o); };
  const ro = [new Float64Array(n), new Float64Array(n)];
  for (let b = 0; b < n; b += BLOCK) ref.processBlock(JSON.parse(JSON.stringify(fromKnobs(k))), z, z, ro[0], ro[1], b, Math.min(BLOCK, n - b), X);
  const gt = Array.from(go[2], (v) => (v > 0.5 ? 1 : 0));
  return { gt, rt, count: gt.reduce((a, v) => a + v, 0) };
}
const sweep = (lo, hi, step) => { const a = []; for (let d = lo; d <= hi + 1e-9; d += step) a.push(+d.toFixed(4)); return a; };
test("G4 divider: grain triggers identical to the reference for every DENSITY position (0…1) at 40 Hz and 180 Hz clocks", () => {
  const counts = new Set();
  for (const hz of [40, 180]) for (const d of sweep(0, 1, 0.025)) {
    const r = trigStreams({ density: d }, { seed: sq(SR, hz) }, 1);
    assert.deepStrictEqual(r.gt, r.rt, `density ${d} @ ${hz} Hz`);
    counts.add(r.count);
  }
  assert.ok(counts.size > 10, "the sweep reaches many different divisions / probabilities: " + counts.size);
});
test("G5 DENSITY CV: triggers identical in the linear middle, the transition band (≈0.25 / 0.75) and the exponential ends", () => {
  for (const d of [0.02, 0.2, 0.235, 0.25, 0.265, 0.3, 0.7, 0.735, 0.75, 0.765, 0.98]) {
    const r = trigStreams({ density: d }, { density: sinus(SR, 1.3, 0.15) }, 1);
    assert.deepStrictEqual(r.gt, r.rt, `density ${d}`);
  }
});
