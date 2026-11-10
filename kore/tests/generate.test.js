"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadCore } = require("../js/node_loader");
const C = loadCore();
const J = (o) => JSON.stringify(o);
const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(J(a)), JSON.parse(J(b)), m);
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "spec", "dsp_map.json"), "utf8"));
const MODEL = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "shared", "kore_dsp_model.js"), "utf8"), MODEL);
const ons = (t) => t.steps.slice(0, t.length).map((s) => (s.on ? 1 : 0)).join("");
const kickOK = (t) => t.length === 16 && [0, 4, 8, 12].every((i) => t.steps[i].on);
const rhythm = (t) => J([t.length, t.division, t.steps.map((s) => [s.on, s.velocity, s.probability, s.ratchet, s.open])]);
const lane = (t, k) => t.steps.slice(0, t.length).map((s) => s.pLocks[k]);

test("A24 + gate: 1000 seeded generations in FOUNDATION/DRIVING/HYPNOTIC keep PUNCH at [0,4,8,12], length 16, no ratchets", () => {
  for (const style of ["FOUNDATION", "DRIVING", "HYPNOTIC"]) {
    const e = new C.KoreEngine();
    e.setGlobal("style", style);
    for (let i = 0; i < 334; i++) {
      e.generate();
      const p = e.state.tracks[0];
      assert.ok(kickOK(p), style + " gen " + i + ": " + ons(p));
      assert.ok(p.steps.every((s) => s.ratchet === 1));
      assert.strictEqual(C.koreValidateGroove(e.state.tracks, e.state.global), "");
    }
  }
});

test("D6: the kick is steady — exactly 4 equal hits (velocity 1) in every style, no ghost kicks", () => {
  const e = new C.KoreEngine();
  for (const style of C.KORE_STYLES) {
    e.setGlobal("style", style);
    for (let i = 0; i < 60; i++) {
      e.generate();
      const p = e.state.tracks[0];
      assert.strictEqual(ons(p), "1000100010001000", style + " " + ons(p));
      [0, 4, 8, 12].forEach((s) => { assert.strictEqual(p.steps[s].velocity, 1); assert.strictEqual(p.steps[s].probability, 1); });
    }
  }
});

test("D6: MUTATE at any amount never changes the kick (rhythm, sound)", () => {
  const e = new C.KoreEngine();
  e.generate(); e.keep();
  const k = J(e.state.tracks[0]);
  for (const a of [0.05, 0.3, 0.7, 1]) { e.mutate("ALL", a); assert.strictEqual(J(e.state.tracks[0]), k); }
});

test("the rendered kick is identical every time for the same settings and changes with every kick param", () => {
  const p = Object.assign({}, MAP.voices.PUNCH.defaults);
  const a = MODEL.koreRenderKick(MAP, p, 48000).L, b = MODEL.koreRenderKick(MAP, p, 48000).L;
  assert.ok(a.length === b.length && a.every((x, i) => x === b[i]));
  for (const k of MAP.voices.PUNCH.params) {
    const q = Object.assign({}, p, { [k]: p[k] > 0.5 ? 0.05 : 0.95 });
    const c = MODEL.koreRenderKick(MAP, q, 48000).L;
    let diff = Math.abs(c.length - a.length);
    for (let i = 0; i < Math.min(a.length, c.length); i++) diff += Math.abs(a[i] - c[i]);
    assert.ok(diff > 1, "kick param " + k + " has no effect");
  }
});

test("A26: BROKEN with unlocked PUNCH may move the anchor but keeps the downbeat and stays rhythmic", () => {
  const e = new C.KoreEngine();
  e.setGlobal("style", "BROKEN"); e.setGlobal("unlockPunch", true);
  let moved = 0;
  for (let i = 0; i < 100; i++) {
    e.generate();
    const p = e.state.tracks[0];
    assert.ok(p.steps[0].on);
    const hits = C.koreCountHits(p);
    assert.ok(hits >= 3 && hits <= 6);
    if (!kickOK(p)) moved++;
  }
  assert.ok(moved > 20 && moved < 90, "moved " + moved);
});

test("A25: styles are structurally different (hat density, tom/hat lengths, n:m)", () => {
  const stats = {};
  for (const style of ["FOUNDATION", "DRIVING", "HYPNOTIC", "BROKEN"]) {
    const e = new C.KoreEngine();
    e.setGlobal("style", style);
    let hat = 0, odd = 0, poly = 0;
    for (let i = 0; i < 200; i++) {
      e.generate();
      const h = e.state.tracks[5];
      hat += C.koreCountHits(h) / h.length;
      if ([3, 4].some((k) => e.state.tracks[k].length % 2 === 1)) odd++;
      if (e.state.tracks.some((t) => t.division.n !== t.division.m)) poly++;
    }
    stats[style] = { hat: hat / 200, odd, poly };
  }
  assert.ok(stats.DRIVING.hat > stats.FOUNDATION.hat * 1.2, J(stats));
  assert.ok(stats.HYPNOTIC.odd > stats.FOUNDATION.odd * 2, J(stats));
  assert.ok(stats.HYPNOTIC.poly > stats.FOUNDATION.poly, J(stats));
});

test("user D1: every GENERATE changes rhythm+length of the 5 other voices and the synth settings of ALL six", () => {
  const e = new C.KoreEngine();
  for (let n = 0; n < 30; n++) {
    const before = JSON.parse(J(e.state.tracks));
    e.setGlobal("style", C.KORE_STYLES[n % 4]);
    e.generate();
    e.state.tracks.forEach((t, i) => {
      for (const k of C.KORE_VOICE_PARAMS[i]) assert.notStrictEqual(t.params[k], before[i].params[k], `gen ${n} ${t.name}.${k}`);
      assert.ok(t.soundName.length > 0);
      if (i === 0) return;
      assert.notStrictEqual(t.length, before[i].length, `gen ${n} ${t.name} length`);
      const h = C.koreCountHits(t);
      assert.ok(h >= 1 && h < t.length, `${t.name} ${ons(t)}`);
    });
  }
});

test("user D2/D6: GENERATE gives every parameter of every PERCUSSION voice a value on every step; the kick has none", () => {
  const e = new C.KoreEngine();
  for (let n = 0; n < 10; n++) {
    e.generate();
    e.state.tracks[0].steps.forEach((s) => assert.strictEqual(Object.keys(s.pLocks).length, 0, "kick must stay one steady sound"));
    e.state.tracks.forEach((t, i) => {
      if (i === 0) return;
      for (const k of C.KORE_VOICE_PARAMS[i]) assert.ok(lane(t, k).every((v) => typeof v === "number"), `${t.name}.${k}`);
      for (let s = t.length; s < 32; s++) assert.strictEqual(Object.keys(t.steps[s].pLocks).length, 0);
    });
  }
});

test("lanes keep club safety: SUB tune varies by at most ~1 semitone", () => {
  const e = new C.KoreEngine();
  for (let n = 0; n < 40; n++) {
    e.generate();
    for (const i of [1]) {
      const t = e.state.tracks[i], v = MAP.voices[t.name], hz = (x) => v.tuneHz[0] * Math.pow(v.tuneHz[1] / v.tuneHz[0], x);
      const l = lane(t, "tune"), semis = 12 * Math.log2(hz(Math.max(...l)) / hz(Math.min(...l)));
      assert.ok(semis <= 2 * 0.04 * 12 * Math.log2(v.tuneHz[1] / v.tuneHz[0]) + 1e-6, `${t.name} tune lane spans ${semis.toFixed(2)} semitones`);
    }
  }
});

test("A27: same seed and settings → same complete pattern incl. P-Locks; Generate is deterministic", () => {
  const a = new C.KoreEngine(), b = new C.KoreEngine();
  for (let i = 0; i < 5; i++) { a.generate(); b.generate(); }
  assert.strictEqual(J(a.state.tracks), J(b.state.tracks));
  const c = new C.KoreEngine();
  c.restore(a.serialize());
  c.generate(); a.generate();
  assert.strictEqual(J(c.state.tracks), J(a.state.tracks));
});

test("A28: Mutate amount 0 = exact no-op; 15% keeps the four-on-the-floor and barely touches the kick sound", () => {
  const e = new C.KoreEngine();
  e.generate(); e.keep();
  const before = J(e.state.tracks);
  assert.strictEqual(e.mutate("ALL", 0), false);
  assert.strictEqual(J(e.state.tracks), before);
  const anchor = JSON.parse(J(e.anchorTracks));
  for (let i = 0; i < 20; i++) {
    e.mutate("ALL", 0.15);
    const p = e.state.tracks[0];
    assert.ok(kickOK(p));
    assert.strictEqual(J(p), J(anchor[0]), "MUTATE must not touch the kick at all (D6)");
  }
});

test("A29 + user D3: each Mutate is a new variation from KEEP; every non-kick value changes", () => {
  const e = new C.KoreEngine();
  e.generate(); e.keep();
  const seen = new Set();
  for (let n = 0; n < 8; n++) {
    const before = JSON.parse(J(e.state.tracks));
    e.mutate("ALL", 0.25);
    seen.add(J(e.state.tracks));
    e.state.tracks.forEach((t, i) => {
      if (i === 0) return;
      for (const k of C.KORE_VOICE_PARAMS[i]) {
        assert.notStrictEqual(t.params[k], before[i].params[k], `${t.name}.${k}`);
        if (t.length === before[i].length) lane(t, k).forEach((v, s) => assert.notStrictEqual(v, before[i].steps[s].pLocks[k], `${t.name}.${k} step ${s + 1}`));
      }
    });
  }
  assert.strictEqual(seen.size, 8);
  assert.ok(e.mutate("ALL", 1));
  assert.ok(kickOK(e.state.tracks[0]), "even 100% keeps the kick anchor");
});

test("A30: KEEP changes the anchor; UNDO restores the exact previous rhythm+sound+lock state", () => {
  const e = new C.KoreEngine();
  e.generate();
  const s1 = J(e.state.tracks);
  e.keep();
  e.mutate("ALL", 0.5);
  e.setHold(2, true);
  e.undo();
  assert.ok(!e.state.tracks[2].locks.rhythm);
  e.undo();
  assert.strictEqual(J(e.state.tracks), s1);
});

test("A10-like: L protects a voice from Generate and Mutate completely", () => {
  const e = new C.KoreEngine();
  e.generate();
  e.setHold(3, true); e.setHold(0, true);
  const t3 = J(e.state.tracks[3]), t0 = J(e.state.tracks[0]);
  for (let i = 0; i < 6; i++) { e.generate(); e.keep(); e.mutate("ALL", 0.8); }
  assert.strictEqual(J(e.state.tracks[3]), t3);
  assert.strictEqual(J(e.state.tracks[0]), t0);
});

test("A32: lane density 0 → no new P-Locks; 1 → values on every step", () => {
  const e = new C.KoreEngine();
  e.setGlobal("lockDensity", 0);
  e.generate();
  e.state.tracks.forEach((t) => t.steps.forEach((s) => assert.strictEqual(Object.keys(s.pLocks).length, 0)));
  e.setGlobal("lockDensity", 1);
  e.generate();
  e.state.tracks.slice(1).forEach((t) => t.steps.slice(0, t.length).forEach((s) => assert.ok(Object.keys(s.pLocks).length > 0)));
});

test("ALTERNATE interaction keeps SUB off the kick steps; LAYER adds a controlled layered sub", () => {
  const e = new C.KoreEngine();
  e.setGlobal("kickInteraction", "ALTERNATE");
  for (let i = 0; i < 50; i++) {
    e.generate();
    const s = e.state.tracks[1];
    for (let j = 0; j < s.length; j++) if (s.steps[j].on && j % 4 === 0 && j < 16 && s.length % 4 === 0) assert.fail("sub on kick step " + j + " " + ons(s));
  }
  e.setGlobal("kickInteraction", "LAYER");
  let layered = 0;
  for (let i = 0; i < 30; i++) { e.generate(); if (e.state.tracks[1].steps[0].on) layered++; }
  assert.strictEqual(layered, 30);
});

test("generated sounds differ audibly (model): PUNCH body length and pitch sweep vary several-fold", () => {
  const e = new C.KoreEngine();
  const dec = [], start = [];
  for (let i = 0; i < 15; i++) {
    e.generate();
    const info = MODEL.koreModelInfo(MAP, "PUNCH", e.state.tracks[0].params);
    dec.push(info.decayMs); start.push(info.startHz);
  }
  assert.ok(Math.max(...dec) / Math.min(...dec) > 2, "decay " + dec.map(Math.round));
  assert.ok(Math.max(...start) / Math.min(...start) > 2, "sweep start " + start.map(Math.round));
});

test("while playing, Generate applies at the next bar", () => {
  const e = new C.KoreEngine({ clock: { lookaheadMs: 0 } });
  let pos = 0; e.tick(0, 130);
  for (let i = 0; i < 50; i++) { pos += 0.02; e.tick(pos, 130); }
  e.generate();
  assert.ok(e.pending);
  while (pos < 4.2) { pos += 0.02; e.tick(pos, 130); }
  assert.ok(!e.pending);
});
