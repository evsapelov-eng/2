// State model, normalization, persistence, P-Lock semantics (A11, A20 static part).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { loadCore } = require("../js/node_loader");
const C = loadCore();
const plain = (x) => JSON.parse(JSON.stringify(x));
const deq = (a, b, m) => assert.deepStrictEqual(plain(a), plain(b), m);

function noBadValues(o, path = "state") {
  if (o === undefined) assert.fail(path + " is undefined");
  if (typeof o === "number") assert.ok(Number.isFinite(o), path + " is not finite");
  if (o && typeof o === "object") for (const k of Object.keys(o)) noBadValues(o[k], path + "." + k);
}

test("default state: 4 tracks x exactly 32 steps, spec §07 defaults, musical first preset", () => {
  const s = C.noizDefaultState();
  assert.strictEqual(s.tracks.length, 4);
  deq(s.tracks.map((t) => t.name), ["HISS", "DUST", "METAL", "ATMOS"]);
  s.tracks.forEach((t) => {
    assert.strictEqual(t.steps.length, 32);
    assert.ok(C.noizCountHits(t) >= 2 && C.noizCountHits(t) < t.length);
  });
  assert.strictEqual(s.tracks[0].sound.tone, 0.68);
  assert.strictEqual(s.tracks[3].levelDb, -16);
  assert.strictEqual(s.name, "NØIZ");
  noBadValues(s);
});

test("normalize fills defaults, clamps ranges, never leaves undefined/NaN", () => {
  const raw = {
    global: { seed: "x", mutationAmount: 7, randomScope: "WAT" },
    tracks: [{ length: 99, division: { n: 0, m: 3.6 }, sound: { tone: NaN, decay: -1 }, steps: [{ on: true, velocity: 2, ratchet: 20, pLocks: { tone: 0, bogus: 1, drive: "x" } }] }]
  };
  const s = C.noizValidateAndNormalize(raw);
  noBadValues(s);
  const t = s.tracks[0];
  assert.strictEqual(t.length, 32);
  deq(JSON.parse(JSON.stringify(t.division)), { n: 1, m: 4 });
  assert.strictEqual(t.sound.tone, 0.68);
  assert.strictEqual(t.sound.decay, 0);
  assert.strictEqual(t.steps[0].velocity, 1);
  assert.strictEqual(t.steps[0].ratchet, 8);
  deq(JSON.parse(JSON.stringify(t.steps[0].pLocks)), { tone: 0 });
  assert.strictEqual(t.steps.length, 32);
  assert.strictEqual(s.global.mutationAmount, 1);
  assert.strictEqual(s.global.randomScope, "RHYTHM");
  assert.strictEqual(s.tracks.length, 4);
});

test("effectiveSound = {...track.sound, ...step.pLocks}; 0 is a real lock; pure", () => {
  const s = C.noizDefaultState();
  const t = s.tracks[0];
  const before = JSON.stringify(t.sound);
  const st = { on: true, pLocks: { decay: 0 } };
  const eff = C.noizEffectiveSound(t, st);
  assert.strictEqual(eff.decay, 0);
  assert.strictEqual(eff.tone, t.sound.tone);
  assert.strictEqual(JSON.stringify(t.sound), before);
});

test("A11: P-Lock decay=0 on step 7 changes only step 7 events", () => {
  const e = new C.NoizEngine();
  const t = e.state.tracks[0];
  t.steps.forEach((st) => { st.on = true; st.probability = 1; st.ratchet = 1; });
  e.setPLock(0, 6, "decay", 0); // UI step 7 = index 6
  const ev = C.noizEventsInRange(e.state, 0, 4).filter((x) => x.trackId === 0);
  ev.forEach((x) => assert.strictEqual(x.sound.decay, x.stepIndex === 6 ? 0 : t.sound.decay));
  assert.strictEqual(t.sound.decay, 0.2); // base untouched
});

test("A20 (static part): serialize -> deserialize restores steps, P-Locks, seed, anchor, locks", () => {
  const e = new C.NoizEngine();
  e.generate("ALL");
  e.keep();
  e.setGlobal("mutationAmount", 0.4);
  e.mutate("RHYTHM");
  e.setPLock(2, 3, "tone", 0.123);
  e.setLock(1, "rhythm", true);
  e.setMute(3, true);
  const text = e.serialize();
  const e2 = new C.NoizEngine();
  const r = e2.restore(text);
  assert.ok(r.ok);
  const round = (o) => JSON.parse(C.noizSerialize(o.state, o.anchorTracks, o.generationCounter));
  deq(round(e2), round(e));
  assert.strictEqual(e2.state.global.seed, e.state.global.seed);
  assert.strictEqual(e2.state.tracks[2].steps[3].pLocks.tone, 0.123);
  assert.strictEqual(e2.state.tracks[1].locks.rhythm, true);
  assert.strictEqual(e2.state.tracks[3].mute, true);
  assert.ok(text.length < 40000, "blob size " + text.length);
});

test("deserialize refuses foreign/future formats safely and keeps defaults", () => {
  const e = new C.NoizEngine();
  e.generate("RHYTHM");
  const before = e.serialize();
  assert.strictEqual(e.restore("{not json").ok, false);
  assert.strictEqual(e.restore(JSON.stringify({ format: "OTHER" })).ok, false);
  assert.strictEqual(e.restore(JSON.stringify({ format: "NOIZ", schemaVersion: 99 })).ok, false);
  assert.strictEqual(e.serialize(), before);
  // partial state is filled with defaults
  const r = e.restore(JSON.stringify({ format: "NOIZ", schemaVersion: 1, tracks: [{ length: 5 }] }));
  assert.ok(r.ok);
  assert.strictEqual(e.state.tracks[0].length, 5);
  assert.strictEqual(e.state.tracks[0].steps.length, 32);
});

test("gesture: a whole drag records exactly one undo entry", () => {
  const e = new C.NoizEngine();
  e.beginGesture();
  for (let i = 0; i <= 200; i++) e.setMacro("tone", i / 200);
  e.endGesture();
  assert.strictEqual(e.undoStack.length, 1);
  assert.strictEqual(e.state.tracks[0].sound.tone, 1);
  e.undo();
  assert.strictEqual(e.state.tracks[0].sound.tone, 0.68);
});

test("BASE vs STEP mode: macro edits route to track sound or to the selected step only", () => {
  const e = new C.NoizEngine();
  e.setGlobal("selectedTrack", 1);
  e.setMacro("tone", 0.9);
  assert.strictEqual(e.state.tracks[1].sound.tone, 0.9);
  e.setGlobal("selectedStep", 4);
  e.setMacro("tone", 0.1);
  assert.strictEqual(e.state.tracks[1].sound.tone, 0.9);
  assert.strictEqual(e.state.tracks[1].steps[4].pLocks.tone, 0.1);
  assert.strictEqual(Object.keys(e.state.tracks[1].steps[5].pLocks).length, 0);
  e.resetMacro("tone"); // double-click in STEP mode removes the lock
  assert.strictEqual(e.state.tracks[1].steps[4].pLocks.tone, undefined);
  e.setPLock(1, 2, "decay", 0.3);
  e.clearStepLocks(1, 2);
  assert.strictEqual(Object.keys(e.state.tracks[1].steps[2].pLocks).length, 0);
});

test("trigger message: amp from velocity+level, effective sound, per-hit pan, voice synth", () => {
  const ev = { trackId: 2, velocity: 1, levelDb: -6, pan: 0.25, synth: { reso: 0.4, attack: 0.1, character: 0.9, spread: 0 },
    sound: { tone: 0.5, decay: 0.25, texture: 0.1, drive: 0, pan: 0.5 } };
  const m = C.noizEventToTrigger(ev);
  assert.strictEqual(m.length, 10);
  assert.strictEqual(m[0], 2);
  assert.ok(Math.abs(m[1] - Math.pow(10, -6 / 20)) < 1e-4);
  deq(m.slice(2), [0.5, 0.25, 0.1, 0, 0.25, 0.4, 0.1, 0.9]);
});

test("schema v1 Live Sets migrate to v2: pattern kept, pan/synth get defaults", () => {
  const v1 = { format: "NOIZ", schemaVersion: 1, tracks: [{ length: 7, sound: { tone: 0.1, decay: 0.2, texture: 0.3, drive: 0.4 },
    steps: [{ on: true, pLocks: { tone: 0.9 } }] }] };
  const e = new C.NoizEngine();
  assert.ok(e.restore(JSON.stringify(v1)).ok);
  const t = e.state.tracks[0];
  assert.strictEqual(t.length, 7);
  assert.strictEqual(t.sound.tone, 0.1);
  assert.strictEqual(t.sound.pan, 0.56);
  deq(t.synth, C.NOIZ_DEFAULT_SYNTH[0]);
  assert.strictEqual(t.steps[0].pLocks.tone, 0.9);
  assert.strictEqual(JSON.parse(e.serialize()).schemaVersion, 2);
});

test("SYNTH params: setSynth/resetSynth with one undo entry each; hold locks rhythm and sound", () => {
  const e = new C.NoizEngine();
  e.setSynth(1, "reso", 0.9);
  assert.strictEqual(e.state.tracks[1].synth.reso, 0.9);
  e.resetSynth(1, "reso");
  assert.strictEqual(e.state.tracks[1].synth.reso, C.NOIZ_DEFAULT_SYNTH[1].reso);
  assert.strictEqual(e.undoStack.length, 2);
  e.setHold(3, true);
  assert.ok(e.state.tracks[3].locks.rhythm && e.state.tracks[3].locks.sound);
});
