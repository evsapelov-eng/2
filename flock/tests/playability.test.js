// PLAYABILITY (the user's complaint as a measurement): a quiet field recording (≈ −52 dBFS rms,
// like a dictaphone) runs through the real gen~ engine while the real panel code presses DICE /
// RANDOM. Every result must be audible, and the recipes must sound different from each other.
// One engine keeps running the whole time, like the device on a track in Live.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { GenPatch } = require("../tools/genexpr");
const ROOT = path.join(__dirname, "..");
const SR = 48000, BAR = 96000;
const SRC = fs.readFileSync(path.join(ROOT, "gen", "flock.genexpr"), "utf8");

function foley(n, seed) {   // wind / leaves: filtered noise with slow swells + sparse clicks
  let s = seed; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const L = new Float64Array(n), R = new Float64Array(n); let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    lp += 0.08 * (r() - lp); lp2 += 0.3 * (r() - lp2);
    const v = 0.06 * (lp * 0.8 + lp2 * 0.2) * (0.5 + 0.5 * Math.sin(i / SR * 0.7));
    if (r() > 0.4997) for (let k = 0; k < 200 && i + k < n; k++) L[i + k] += 0.03 * Math.exp(-k / 40) * r();
    L[i] += v; R[i] += v * 0.9;
  }
  return [L, R];
}
const dbtoa = (db) => Math.pow(10, db / 20);
const rmsDb = (a, from, to) => { let e = 0; for (let i = from; i < to; i++) e += a[i] * a[i]; return 10 * Math.log10(e / (to - from) + 1e-20); };

// the panel (real code) wired to the engine like tools/build_device.py does
function rig(seed = 1) {
  const g = new GenPatch(SRC, { sr: SR, seed });
  const ui = vm.createContext({ mgraphics: { init() {}, size: [900, 169] }, post() {}, Task: function () { this.repeat = () => {}; this.cancel = () => {}; } });
  const toEngine = (name, v) => {
    if (name === "input") { g.set("ingain", dbtoa(v)); return; }
    if (name === "output") { g.set("outgain", dbtoa(v)); return; }
    if (name === "seed") { g.set("seed", v); return; }
    g.set(name, v);
  };
  ui.outlet = (o, name, v) => { toEngine(name, v); if (name !== "agc_restart") ui.p(name, v); };   // the Live parameter echoes back
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "flock_ui.js"), "utf8"), ui);
  // the panel's own randomness (DICE / RANDOM) seeded → reproducible test (FLOCK_UI_SEED overrides)
  let us = (+process.env.FLOCK_UI_SEED || 1000 + seed) >>> 0;
  vm.runInContext("Math.random = function () { return __r(); };", Object.assign(ui, { __r: () => { us = (Math.imul(us, 1664525) + 1013904223) >>> 0; return us / 4294967296; } }));
  let t = 0; const N = SR * 120, [L, R] = foley(N, 7), z = new Float64Array(N);
  const ph = Float64Array.from({ length: N }, (_, i) => (i / BAR) % 1);
  const play = (sec) => {
    const n = Math.round(sec * SR), o = g.run(n, [L.subarray(t, t + n), R.subarray(t, t + n), z, z, z, z, ph.subarray(t, t + n)]);
    t += n; return o;
  };
  return { g, ui, play, inDb: rmsDb(L, 0, N) };
}
function measure(o) {
  const n = o[0].length, from = Math.round(n / 3);
  const db = rmsDb(o[0], from, n);
  const grains = o[2].reduce((a, v) => a + (v > 0.5), 0);
  let zc = 0; for (let i = from + 1; i < n; i++) if ((o[0][i] < 0) !== (o[0][i - 1] < 0)) zc++;
  return { db, grains, bright: zc / (n - from) };
}

test("the source really is quiet (dictaphone level)", () => {
  const r = rig();
  assert.ok(r.inDb < -45, "input " + r.inDb.toFixed(1) + " dBFS");
});

test("default sound after loading: AUTO gain lifts the quiet source and a grain cloud is audible within seconds", () => {
  const r = rig();
  const first = measure(r.play(3));
  const later = measure(r.play(5));
  assert.ok(first.grains > 50, "grains from the start: " + first.grains);
  assert.ok(later.db > -35, "audible after the gain learned: " + later.db.toFixed(1) + " dBFS (input " + r.inDb.toFixed(1) + ")");
});

test("RANDOM, pressed 20 times in a row while playing: every patch is audible", () => {
  const r = rig(3); r.play(7);   // the device has been running (gain learned)
  const bad = [];
  for (let k = 0; k < 20; k++) {
    r.ui.randomPatch();
    const m = measure(r.play(3));
    if (m.db < -40 || m.grains < 3) bad.push(`#${k}: ${m.db.toFixed(1)} dB, ${m.grains} grains`);
  }
  assert.deepStrictEqual(bad, []);
});

test("DICE: every recipe (3 times each) is audible, and the recipes sound different from each other", () => {
  const r = rig(5); r.play(7);
  const byRecipe = {}, bad = [];
  for (const name of r.ui.RECIPE_NAMES) for (let k = 0; k < 3; k++) {
    r.ui.dice(name);
    const m = measure(r.play(4));
    (byRecipe[name] = byRecipe[name] || []).push(m);
    if (m.db < -40 || m.grains < 3) bad.push(`${name} #${k}: ${m.db.toFixed(1)} dB, ${m.grains} grains`);
  }
  assert.deepStrictEqual(bad, []);
  // difference: grain rate and brightness spread across recipes
  const rates = Object.values(byRecipe).map((a) => a.reduce((s, m) => s + m.grains, 0) / a.length);
  const bright = Object.values(byRecipe).map((a) => a.reduce((s, m) => s + m.bright, 0) / a.length);
  assert.ok(Math.max(...rates) / Math.max(1, Math.min(...rates)) > 4, "grain rates differ: " + rates.map((x) => x.toFixed(0)));
  assert.ok(Math.max(...bright) / Math.min(...bright) > 1.5, "brightness differs: " + bright.map((x) => x.toFixed(3)));
});

test("BACK restores the sound before the last DICE", () => {
  const r = rig(9);
  const before = JSON.stringify(r.ui.snapshot());
  r.ui.dice("SLICER");
  assert.notStrictEqual(JSON.stringify(r.ui.snapshot()), before);
  r.ui.back();
  assert.strictEqual(JSON.stringify(r.ui.snapshot()), before);
});

test("a cable into TIME / PITCH / SIZE / SHAPE has an audible effect at once (CV amount set when the knob was centred)", () => {
  const r = rig(11); r.play(7);
  r.ui.p("time_amt", 0.5);
  r.ui.patchCable("dst_time", 1);
  assert.ok(r.g.P.time_amt > 0.8, "RND under TIME became a CV amount: " + r.g.P.time_amt);
  const a = r.play(3), starts = []; a[2].forEach((v, i) => { if (v > 0.5) starts.push(a[5][i]); });
  const spread = Math.max(...starts) - Math.min(...starts);
  assert.ok(spread > 0.1, "grain positions follow the LFO: spread " + spread.toFixed(3));
});

test("R6 every recording quality is audible on the quiet foley within seconds of switching to it (from the panel)", () => {
  const r = rig(13); r.play(7);
  const bad = [];
  for (const q of [1, 2, 3, 0]) {
    r.ui.onclick(0, 0, 0, 0, 0);   // no-op click (nothing there) — the panel must not throw
    r.ui.outlet(0, "quality", q);
    const m = measure(r.play(4));
    if (m.db < -40 || m.grains < 3) bad.push(`quality ${q}: ${m.db.toFixed(1)} dB, ${m.grains} grains`);
  }
  assert.deepStrictEqual(bad, []);
});
