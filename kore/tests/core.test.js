"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { loadCore } = require("../js/node_loader");
const C = loadCore();
const J = (o) => JSON.stringify(o);
const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(J(a)), JSON.parse(J(b)), m);
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "spec", "dsp_map.json"), "utf8"));

test("six voices with the spec roles; voice params and defaults match spec/dsp_map.json", () => {
  const s = C.koreDefaultState();
  deq(s.tracks.map((t) => t.name), ["PUNCH", "SUB", "RUMBLE", "TOM L", "TOM H", "HAT"]);
  s.tracks.forEach((t, i) => {
    const v = MAP.voices[t.name];
    deq(C.KORE_VOICE_PARAMS[i], v.params, t.name + " params");
    deq(t.params, v.defaults, t.name + " defaults");
    assert.strictEqual(t.levelDb, v.levelDb);
    assert.strictEqual(t.steps.length, 32);
  });
  deq(s.tracks[0].steps.slice(0, 16).map((x) => x.on ? 1 : 0).join(""), "1000100010001000");
});

test("starter preset: techno kick 55 Hz, glide from ~300 Hz (tau 18 ms), hold 42 ms + decay 230 ms; SUB 280 ms; RUMBLE tail 350 ms", () => {
  const vm = require("vm");
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "shared", "kore_dsp_model.js"), "utf8"), ctx);
  const d = C.KORE_DEFAULT_PARAMS;
  const p = ctx.koreModelInfo(MAP, "PUNCH", d[0]);
  assert.ok(Math.abs(p.tuneHz - 55) < 0.1, "tune " + p.tuneHz);
  assert.ok(p.startHz > 280 && p.startHz < 330, "start " + p.startHz);
  assert.ok(Math.abs(p.sweepMs - 18) < 0.1 && Math.abs(p.decayMs - 230) < 0.5 && Math.abs(p.holdMs - 42) < 0.1);
  assert.ok(Math.abs(ctx.koreModelInfo(MAP, "SUB", d[1]).decayMs - 280) < 0.5);
  assert.ok(Math.abs(ctx.koreModelInfo(MAP, "RUMBLE", d[2]).tailMs - 350) < 0.5);
});

test("A31: a P-Lock affects only its step and only valid ids of its voice (no leakage)", () => {
  const e = new C.KoreEngine();
  const t = e.state.tracks[3];
  t.steps.forEach((s, i) => { s.on = i % 2 === 0; });
  e.setPLock(3, 4, "decay", 0.9);
  e.setPLock(3, 4, "reso", 0.9);        // HAT id on TOM L: rejected
  e.setPLock(5, 2, "tune", 0.9);        // TOM id on HAT: rejected
  e.setPLock(0, 4, "decay", 0.9);       // kick: no per-step values at all (D6)
  assert.strictEqual(t.steps[4].pLocks.reso, undefined);
  assert.strictEqual(e.state.tracks[5].steps[2].pLocks.tune, undefined);
  assert.strictEqual(Object.keys(e.state.tracks[0].steps[4].pLocks).length, 0);
  const ev = C.koreEventsInRange(e.state, 0, 4).filter((x) => x.trackId === 3);
  ev.forEach((x) => assert.strictEqual(x.params.decay, x.stepIndex === 4 ? 0.9 : t.params.decay));
  assert.strictEqual(t.params.decay, C.KORE_DEFAULT_PARAMS[3].decay);
  e.clearLock(3, 4, "decay");
  C.koreEventsInRange(e.state, 0, 4).filter((x) => x.trackId === 3).forEach((x) => assert.strictEqual(x.params.decay, t.params.decay));
  // normalization drops foreign ids loaded from a Live Set
  const st = C.koreValidateAndNormalize({ tracks: [{}, {}, {}, { steps: [{ on: true, pLocks: { reso: 0.3, decay: 0.1 } }] }] });
  deq(st.tracks[3].steps[0].pLocks, { decay: 0.1 });
});

test("trigger message: 8 values, voice params in order, HAT open flag", () => {
  const ev = { trackId: 5, velocity: 1, levelDb: 0, open: true, params: { tone: 0.3, decay: 0.6, reso: 0.2, open: 0.5 } };
  deq(C.koreEventToTrigger(ev), [5, 1, 0.3, 0.6, 0.2, 0.5, 0, 1]);
  const k = { trackId: 3, velocity: 1, levelDb: -6, open: false, params: { tune: 0.1, decay: 0.2, sweep: 0.3, tone: 0.4, snap: 0.5 } };
  const m = C.koreEventToTrigger(k);
  assert.strictEqual(m.length, 8);
  deq(m.slice(2), [0.1, 0.2, 0.3, 0.4, 0.5, 0]);
  assert.ok(Math.abs(m[1] - Math.pow(10, -6 / 20)) < 1e-4);
});

test("BASE vs STEP routing, voice knob moves the lane, gesture = one undo entry", () => {
  const e = new C.KoreEngine();
  for (let s = 0; s < 16; s++) e.setPLock(3, s, "tune", 0.3 + 0.01 * s);
  e.setGlobal("selectedTrack", 3);
  e.undoStack = [];
  const u0 = e.undoStack.length;
  e.beginGesture();
  for (let i = 0; i <= 50; i++) e.setParam("tune", e.state.tracks[3].params.tune + 0.002);
  e.endGesture();
  assert.strictEqual(e.undoStack.length, u0 + 1);
  const shift = e.state.tracks[3].params.tune - C.KORE_DEFAULT_PARAMS[3].tune;
  e.state.tracks[3].steps.slice(0, 16).forEach((s, i) => assert.ok(Math.abs(s.pLocks.tune - (0.3 + 0.01 * i + shift)) < 1e-3));
  e.setGlobal("selectedStep", 2);
  e.setParam("decay", 0.05);
  assert.strictEqual(e.state.tracks[3].steps[2].pLocks.decay, 0.05);
  assert.strictEqual(e.state.tracks[3].params.decay, C.KORE_DEFAULT_PARAMS[3].decay);
  e.resetParam("decay");
  assert.strictEqual(e.state.tracks[3].steps[2].pLocks.decay, undefined);
});

test("A35 (static part): serialize → restore keeps steps, P-Locks, seed, anchor, style; foreign data refused", () => {
  const e = new C.KoreEngine();
  e.setGlobal("style", "HYPNOTIC");
  e.generate(); e.keep(); e.mutate("ALL", 0.3);
  e.setHold(4, true); e.setStep(5, 2, "open", 1);
  const text = e.serialize();
  const e2 = new C.KoreEngine();
  assert.ok(e2.restore(text).ok);
  assert.strictEqual(e2.serialize(), text);
  assert.strictEqual(e2.state.global.style, "HYPNOTIC");
  assert.ok(text.length < 60000, "blob " + text.length);
  assert.strictEqual(e2.restore("{bad").ok, false);
  assert.strictEqual(e2.restore(J({ format: "NOIZ" })).ok, false);
  assert.strictEqual(e2.serialize(), text);
});
