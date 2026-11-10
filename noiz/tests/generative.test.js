// Generate / Mutate / Keep / Undo / Locks — A06–A10, A12, A13.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { loadCore } = require("../js/node_loader");
const C = loadCore();
const plain = (x) => JSON.parse(JSON.stringify(x));
const deq = (a, b, m) => assert.deepStrictEqual(plain(a), plain(b), m);

const J = (o) => JSON.stringify(o);
const rhythmOf = (t) => J({ l: t.length, d: t.division, s: t.steps.map((s) => [s.on, s.velocity, s.probability, s.ratchet]) });
const onsOf = (t) => t.steps.slice(0, t.length).map((s) => (s.on ? 1 : 0)).join("");
const locksOf = (t) => J(t.steps.map((s) => s.pLocks));
function diffSteps(a, b) {
  let n = 0;
  for (let i = 0; i < 32; i++) if (a.steps[i].on !== b.steps[i].on) n++;
  return n;
}

test("A06: Generate x10 → different usable rhythms, never all-16, never silent tracks", () => {
  const e = new C.NoizEngine();
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    e.generate("RHYTHM");
    const sig = e.state.tracks.map(onsOf).join("|");
    seen.add(sig);
    e.state.tracks.forEach((t) => {
      const hits = C.noizCountHits(t);
      assert.ok(hits >= 1, t.name + " silent");
      assert.ok(hits < t.length, t.name + " all steps on");
    });
    // character: HISS densest, ATMOS sparse (on average sense, per pattern for ATMOS)
    assert.ok(C.noizCountHits(e.state.tracks[3]) <= Math.ceil(e.state.tracks[3].length * 0.35));
  }
  assert.strictEqual(seen.size, 10);
});

test("Generate is reproducible from the same state and seed", () => {
  const a = new C.NoizEngine(), b = new C.NoizEngine();
  for (let i = 0; i < 5; i++) { a.generate("ALL"); b.generate("ALL"); }
  assert.strictEqual(J(a.state.tracks), J(b.state.tracks));
  assert.strictEqual(a.state.global.seed, b.state.global.seed);
});

test("Generate across 200 seeds: some polymeter/poly ratios, but not in most patterns", () => {
  const e = new C.NoizEngine();
  let poly = 0;
  for (let i = 0; i < 200; i++) {
    e.generate("RHYTHM");
    if (e.state.tracks.some((t) => t.length !== 16 || t.division.n !== t.division.m)) poly++;
  }
  assert.ok(poly > 20 && poly < 110, "poly patterns: " + poly);
});

test("Generate limits 4-voice strong stacked transients", () => {
  const e = new C.NoizEngine();
  let worst = 0;
  for (let i = 0; i < 100; i++) {
    e.generate("RHYTHM");
    let stacks = 0;
    for (let s = 0; s < 16; s++) {
      if (e.state.tracks.every((t) => t.division.n === 1 && t.division.m === 1 && t.steps[s % t.length].on && t.steps[s % t.length].velocity > 0.75)) stacks++;
    }
    worst = Math.max(worst, stacks);
  }
  assert.ok(worst <= 1, "max stacked strong hits " + worst);
});

test("A07: Mutate amount 0 → exactly no change, no history entry", () => {
  const e = new C.NoizEngine();
  e.generate("ALL");
  const before = J(e.state.tracks);
  const undoLen = e.undoStack.length;
  assert.strictEqual(e.mutate("ALL", 0), false);
  assert.strictEqual(J(e.state.tracks), before);
  assert.strictEqual(e.undoStack.length, undoLen);
});

test("A08: Mutate ~15% keeps the groove recognizable (1–4 changed steps on 16)", () => {
  const e = new C.NoizEngine();
  const counts = [];
  for (let i = 0; i < 40; i++) {
    e.generate("RHYTHM");
    const anchor = JSON.parse(J(e.state.tracks));
    e.mutate("RHYTHM", 0.15);
    e.state.tracks.forEach((t, k) => {
      if (anchor[k].length === 16 && t.length === 16) counts.push(diffSteps(anchor[k], t));
    });
  }
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  assert.ok(Math.max(...counts) <= 6, "max " + Math.max(...counts));
  assert.ok(mean >= 0.8 && mean <= 4, "mean changed steps " + mean);
});

test("Mutate at 10% changes ~1–3 events per 16-step track; 60% is wider but keeps silence", () => {
  const e = new C.NoizEngine();
  const at = (amt) => {
    const c = [];
    for (let i = 0; i < 30; i++) {
      e.generate("RHYTHM");
      const anchor = JSON.parse(J(e.state.tracks[0]));
      e.mutate("RHYTHM", amt);
      c.push(diffSteps(anchor, e.state.tracks[0]));
      assert.ok(C.noizCountHits(e.state.tracks[0]) < 16);
    }
    return c.reduce((a, b) => a + b, 0) / c.length;
  };
  const m10 = at(0.1), m60 = at(0.6);
  assert.ok(m10 >= 0.8 && m10 <= 3.5, "10%: " + m10);
  assert.ok(m60 > m10 * 2, "60%: " + m60 + " vs 10%: " + m10);
});

test("A09: Mutate derives from Keep anchor; repeated mutates differ; Undo restores state and anchor", () => {
  const e = new C.NoizEngine();
  e.generate("RHYTHM");
  e.keep();
  const anchor = J(e.anchorTracks);
  const s0 = J(e.state.tracks);
  e.mutate("RHYTHM", 0.3);
  const m1 = J(e.state.tracks);
  e.mutate("RHYTHM", 0.3);
  const m2 = J(e.state.tracks);
  assert.notStrictEqual(m1, m2);
  // both are variations of the anchor, not of each other (no accumulating drift)
  const a = JSON.parse(anchor), v2 = JSON.parse(m2);
  const drift = a.reduce((sum, t, k) => sum + diffSteps(t, v2[k]), 0);
  assert.ok(drift <= 20, "drift from anchor " + drift);
  assert.strictEqual(J(e.anchorTracks), anchor);
  e.undo();
  assert.strictEqual(J(e.state.tracks), m1);
  e.undo();
  assert.strictEqual(J(e.state.tracks), s0);
  e.keep();
  e.mutate("RHYTHM", 0.3);
  e.keep(); // new anchor
  const newAnchor = J(e.anchorTracks);
  e.undo(); // undo the keep → previous anchor back
  assert.notStrictEqual(J(e.anchorTracks), newAnchor);
});

test("Undo stack is bounded to 16 and Undo on empty stack is a safe no-op", () => {
  const e = new C.NoizEngine();
  for (let i = 0; i < 40; i++) e.generate("RHYTHM");
  assert.strictEqual(e.undoStack.length, 16);
  for (let i = 0; i < 16; i++) assert.ok(e.undo());
  assert.strictEqual(e.undo(), false);
});

for (const scope of ["RHYTHM", "SOUND", "PLOCKS", "ALL"]) {
  test("A10: locked rhythm+sound track is untouched by Generate and Mutate in scope " + scope, () => {
    const e = new C.NoizEngine();
    e.setGlobal("lockDensity", 1);
    e.setGlobal("lockAmount", 0.8);
    e.generate("ALL");
    e.keep();
    e.setLock(2, "rhythm", true);
    e.setLock(2, "sound", true);
    e.setPLock(2, 3, "tone", 0.777);
    const locked = J(e.state.tracks[2]);
    for (let i = 0; i < 8; i++) {
      e.generate(scope);
      e.mutate(scope, 0.9);
      assert.strictEqual(J(e.state.tracks[2]), locked);
    }
  });
}

test("Lock Rhythm only: sound may change, rhythm may not; Lock Sound only: the opposite (P-Locks included)", () => {
  const e = new C.NoizEngine();
  e.setLock(0, "rhythm", true);
  e.setLock(1, "sound", true);
  e.setPLock(1, 1, "drive", 0.5);
  const r0 = rhythmOf(e.state.tracks[0]);
  const s1 = J(e.state.tracks[1].sound), l1 = locksOf(e.state.tracks[1]);
  let soundChanged = false, rhythmChanged = false;
  for (let i = 0; i < 6; i++) {
    e.generate("ALL");
    assert.strictEqual(rhythmOf(e.state.tracks[0]), r0);
    assert.strictEqual(J(e.state.tracks[1].sound), s1);
    assert.strictEqual(locksOf(e.state.tracks[1]), l1);
    if (J(e.state.tracks[0].sound) !== J(C.noizDefaultState().tracks[0].sound)) soundChanged = true;
    if (rhythmOf(e.state.tracks[1]) !== rhythmOf(C.noizDefaultState().tracks[1])) rhythmChanged = true;
  }
  assert.ok(soundChanged && rhythmChanged);
});

test("A12: Random P-Locks with Density=0 adds no P-Locks", () => {
  const e = new C.NoizEngine();
  e.setGlobal("lockDensity", 0);
  e.setGlobal("lockAmount", 0.8);
  for (let i = 0; i < 10; i++) {
    e.generate("PLOCKS");
    e.state.tracks.forEach((t) => t.steps.forEach((s) => assert.strictEqual(Object.keys(s.pLocks).length, 0)));
  }
});

test("A13: Random P-Locks Density=1, Amount>0 → locks on active steps, rhythm/base sound unchanged", () => {
  const e = new C.NoizEngine();
  e.generate("RHYTHM");
  e.setGlobal("lockDensity", 1);
  e.setGlobal("lockAmount", 0.5);
  const rhythm = e.state.tracks.map(rhythmOf);
  const sound = J(e.state.tracks.map((t) => t.sound));
  e.generate("PLOCKS");
  deq(e.state.tracks.map(rhythmOf), rhythm);
  assert.strictEqual(J(e.state.tracks.map((t) => t.sound)), sound);
  e.state.tracks.forEach((t) => t.steps.forEach((s, i) => {
    const n = Object.keys(s.pLocks).length;
    if (i < t.length) assert.ok(n >= 1, t.name + " step " + i + " has no lock"); // lanes cover the whole cycle
    else assert.strictEqual(n, 0, "nothing beyond the track length");
  }));
  // drive is not slammed to 100% everywhere
  const drives = [];
  e.state.tracks.forEach((t) => t.steps.forEach((s) => { if (s.pLocks.drive !== undefined) drives.push(s.pLocks.drive); }));
  assert.ok(drives.filter((d) => d >= 0.99).length <= 1);
});

test("Mutate P-Locks stays near the anchor locks at small amounts", () => {
  const e = new C.NoizEngine();
  e.setGlobal("lockDensity", 0.6);
  e.setGlobal("lockAmount", 0.3);
  e.generate("ALL");
  e.keep();
  const anchor = JSON.parse(J(e.anchorTracks));
  e.mutate("PLOCKS", 0.1);
  e.state.tracks.forEach((t, k) => t.steps.forEach((s, i) => {
    for (const key of Object.keys(s.pLocks)) {
      const a = anchor[k].steps[i].pLocks[key];
      if (a !== undefined) assert.ok(Math.abs(a - s.pLocks[key]) <= 0.1 * 0.3 + 1e-9);
    }
  }));
});

test("every Generate/Mutate uses a new seed, stored in state", () => {
  const e = new C.NoizEngine();
  const seeds = new Set([e.state.global.seed]);
  for (let i = 0; i < 20; i++) { e.generate("RHYTHM"); seeds.add(e.state.global.seed); e.mutate("RHYTHM", 0.2); seeds.add(e.state.global.seed); }
  assert.strictEqual(seeds.size, 41);
});

test("while playing, Generate is applied at the next bar; stopped → immediately", () => {
  const e = new C.NoizEngine({ clock: { lookaheadMs: 0 } });
  e.generate("RHYTHM");
  assert.strictEqual(e.pending, false);
  const old = J(e.state.tracks);
  let pos = 0;
  e.tick(pos, 120);
  for (let i = 0; i < 50; i++) { pos += 0.02; e.tick(pos, 120); } // playing, pos = 1.0
  assert.ok(e.transportPlaying);
  const oldGlobal = JSON.parse(J(e.state.global));
  const posAtCommand = pos;
  e.generate("RHYTHM");
  assert.strictEqual(e.pending, true);
  assert.strictEqual(J(e.playState.tracks), old);
  const out = [];
  while (pos < 4.5) { pos += 0.02; out.push(...e.tick(pos, 120)); }
  assert.strictEqual(e.pending, false);
  const before = out.filter((x) => x.beat < 4), after = out.filter((x) => x.beat >= 4);
  const oldS = { global: oldGlobal, tracks: JSON.parse(old), schemaVersion: 1 };
  const exp1 = C.noizEventsInRange(oldS, posAtCommand, 4);
  deq(before.map((x) => [x.beat, x.trackId]), exp1.map((x) => [x.beat, x.trackId])); // old pattern until the bar
  assert.ok(after.every((x) => {
    const st = e.state.tracks[x.trackId].steps[x.stepIndex];
    return st.on;
  }));
});

test("PATTERN scope (SEQ screen): new rhythm + P-Locks, base sound and synth untouched", () => {
  const e = new C.NoizEngine();
  e.setGlobal("lockDensity", 0.5);
  e.setGlobal("lockAmount", 0.4);
  const sound = J(e.state.tracks.map((t) => [t.sound, t.synth]));
  e.generate("PATTERN");
  assert.strictEqual(J(e.state.tracks.map((t) => [t.sound, t.synth])), sound);
  const locks = e.state.tracks.reduce((n, t) => n + t.steps.filter((s) => Object.keys(s.pLocks).length).length, 0);
  assert.ok(locks > 0);
});

test("SOUND scope (SYNTH screen): generates pan, spread and synth params; rhythm untouched", () => {
  const e = new C.NoizEngine();
  const rhythm = e.state.tracks.map(rhythmOf);
  const pans = new Set(), spreads = new Set();
  for (let i = 0; i < 8; i++) {
    e.generate("SOUND");
    deq(e.state.tracks.map(rhythmOf), rhythm);
    e.state.tracks.forEach((t) => { pans.add(t.sound.pan); spreads.add(t.synth.spread); });
  }
  assert.ok(pans.size > 10 && spreads.size > 10);
});

test("GENERATE (ALL, any screen) changes rhythm, base sound, synth params and per-step locks of every unlocked voice", () => {
  const e = new C.NoizEngine();
  for (const view of ["SEQUENCE", "SOUND"]) {
    e.setGlobal("activeView", view);
    assert.strictEqual(e.contextScope(), "ALL");
    const before = JSON.parse(J(e.state.tracks));
    e.generate(e.contextScope());
    e.state.tracks.forEach((t, i) => {
      assert.notStrictEqual(rhythmOf(t), rhythmOf(before[i]), t.name + " rhythm");
      for (const k of ["tone", "decay", "texture", "drive", "pan"]) assert.notStrictEqual(t.sound[k], before[i].sound[k], t.name + " " + k);
      for (const k of ["reso", "attack", "character", "spread"]) assert.notStrictEqual(t.synth[k], before[i].synth[k], t.name + " " + k);
    });
  }
});

test("random P-Locks reach synth parameters too", () => {
  const e = new C.NoizEngine();
  e.setGlobal("lockDensity", 1);
  e.setGlobal("lockAmount", 0.5);
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    e.generate("ALL");
    e.state.tracks.forEach((t) => t.steps.forEach((s) => Object.keys(s.pLocks).forEach((k) => seen.add(k))));
  }
  for (const k of C.NOIZ_LOCKABLE) assert.ok(seen.has(k), "never locked: " + k);
});

const lanesOf = (t, k) => t.steps.slice(0, t.length).map((s) => s.pLocks[k]);
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };

test("GENERATE draws per-step lanes: decay, pan, reso, attack (and the rest) get real step-to-step variation", () => {
  const e = new C.NoizEngine();
  const counts = {}, spreads = {};
  for (const k of C.NOIZ_LOCKABLE) { counts[k] = 0; spreads[k] = []; }
  const N = 20;
  for (let i = 0; i < N; i++) {
    e.generate("ALL");
    e.state.tracks.forEach((t) => {
      for (const k of C.NOIZ_LOCKABLE) {
        const lane = lanesOf(t, k);
        if (lane.every((v) => typeof v === "number")) { counts[k]++; spreads[k].push(sd(lane)); }
      }
    });
  }
  for (const k of C.NOIZ_LOCKABLE) {
    const share = counts[k] / (N * 4);
    assert.ok(share > 0.55, `${k}: lane in only ${(share * 100).toFixed(0)}% of voices`);
    const meanSd = spreads[k].reduce((a, b) => a + b, 0) / spreads[k].length;
    assert.ok(meanSd > (k === "drive" ? 0.03 : 0.07), `${k}: lanes too flat (sd ${meanSd.toFixed(3)})`);
  }
});

test("every GENERATE gives a different lane picture", () => {
  const e = new C.NoizEngine();
  const pics = new Set();
  for (let i = 0; i < 12; i++) {
    e.generate("ALL");
    pics.add(JSON.stringify(e.state.tracks.map((t) => ["decay", "pan", "reso", "attack"].map((k) => lanesOf(t, k)))));
  }
  assert.strictEqual(pics.size, 12);
});

test("pan lanes use the stereo field (some voices swing wide L/R)", () => {
  const e = new C.NoizEngine();
  let wide = 0;
  for (let i = 0; i < 20; i++) {
    e.generate("ALL");
    e.state.tracks.forEach((t) => {
      const lane = lanesOf(t, "pan");
      if (lane.every((v) => typeof v === "number") && Math.max(...lane) - Math.min(...lane) > 0.5) wide++;
    });
  }
  assert.ok(wide > 15, "wide pan lanes: " + wide);
});

test("MUTATE keeps lanes recognisable at small amounts and varies them at large ones", () => {
  const e = new C.NoizEngine();
  e.generate("ALL");
  e.keep();
  const anchor = JSON.parse(J(e.anchorTracks));
  const dist = () => {
    let d = 0, n = 0;
    e.state.tracks.forEach((t, k) => t.steps.slice(0, t.length).forEach((s, i) => {
      for (const key of Object.keys(s.pLocks)) {
        const a = anchor[k].steps[i].pLocks[key];
        if (a !== undefined && anchor[k].length === t.length) { d += Math.abs(a - s.pLocks[key]); n++; }
      }
    }));
    return d / Math.max(1, n);
  };
  e.mutate("ALL", 0.1); const small = dist();
  e.mutate("ALL", 0.9); const big = dist();
  assert.ok(small < 0.06, "small mutate moved lanes by " + small);
  assert.ok(big > small, `big ${big} vs small ${small}`);
});

test("lanes keep their shape near the range ends (no half-flattened lanes)", () => {
  const e = new C.NoizEngine();
  let clipped = 0, total = 0;
  for (let i = 0; i < 20; i++) {
    e.generate("ALL");
    e.state.tracks.forEach((t) => ["attack", "drive", "spread"].forEach((k) => {
      const lane = lanesOf(t, k);
      if (!lane.every((v) => typeof v === "number")) return;
      total += lane.length;
      clipped += lane.filter((v) => v <= 0 || v >= 1).length;
    }));
  }
  assert.ok(clipped / total < 0.08, `clipped ${(100 * clipped / total).toFixed(1)}% of lane values`);
});

test("after EVERY Generate: all 9 parameters of every unlocked voice have a per-step lane", () => {
  const e = new C.NoizEngine();
  e.setHold(2, true);
  for (let n = 0; n < 15; n++) {
    e.generate("ALL");
    e.state.tracks.forEach((t) => {
      if (t.id === 2) return;
      for (const k of C.NOIZ_LOCKABLE) assert.ok(lanesOf(t, k).every((v) => typeof v === "number"), `gen ${n} ${t.name} ${k} has no lane`);
    });
  }
});

for (const amt of [0.05, 0.25, 1]) {
  test(`after EVERY Mutate (amount ${amt}): every base value and every step value of every unlocked voice changes`, () => {
    const e = new C.NoizEngine();
    e.generate("ALL");
    e.keep();
    e.setHold(1, true);
    const locked = J(e.state.tracks[1]);
    for (let n = 0; n < 8; n++) {
      const before = JSON.parse(J(e.state.tracks));
      e.mutate("ALL", amt);
      e.state.tracks.forEach((t, i) => {
        if (i === 1) { assert.strictEqual(J(t), locked); return; }
        for (const k of C.NOIZ_MACROS) assert.notStrictEqual(t.sound[k], before[i].sound[k], `${t.name}.${k}`);
        for (const k of C.NOIZ_SYNTH) assert.notStrictEqual(t.synth[k], before[i].synth[k], `${t.name}.${k}`);
        if (t.length !== before[i].length) return;
        for (const k of C.NOIZ_LOCKABLE) {
          const a = lanesOf(before[i], k), b = lanesOf(t, k);
          b.forEach((v, s) => assert.ok(typeof v === "number" && v !== a[s], `${t.name} ${k} step ${s + 1} unchanged`));
        }
      });
    }
  });
}

// ---- sound variety on GENERATE ----
const vm2 = require("vm"), fs2 = require("fs"), path2 = require("path");
const MAP = JSON.parse(fs2.readFileSync(path2.join(__dirname, "..", "spec", "dsp_map.json"), "utf8"));
const MODEL = vm2.createContext({});
vm2.runInContext(fs2.readFileSync(path2.join(__dirname, "..", "js", "shared", "noiz_dsp_model.js"), "utf8"), MODEL);

test("every GENERATE gives each voice a new sound: all 9 base values change, archetype name shown", () => {
  const e = new C.NoizEngine();
  for (let n = 0; n < 20; n++) {
    const before = JSON.parse(J(e.state.tracks));
    e.generate("ALL");
    e.state.tracks.forEach((t, i) => {
      for (const k of C.NOIZ_MACROS) assert.notStrictEqual(t.sound[k], before[i].sound[k], `gen ${n} ${t.name}.${k}`);
      for (const k of C.NOIZ_SYNTH) assert.notStrictEqual(t.synth[k], before[i].synth[k], `gen ${n} ${t.name}.${k}`);
      assert.ok(t.soundName.length > 0);
    });
  }
});

test("GENERATE covers wide sound space: archetypes vary, params span most of their range", () => {
  const e = new C.NoizEngine();
  const names = [new Set(), new Set(), new Set(), new Set()];
  const lo = {}, hi = {};
  for (let n = 0; n < 60; n++) {
    e.generate("ALL");
    e.state.tracks.forEach((t, i) => {
      names[i].add(t.soundName);
      for (const k of [...C.NOIZ_MACROS, ...C.NOIZ_SYNTH]) {
        const v = k in t.sound ? t.sound[k] : t.synth[k];
        const key = i + k;
        lo[key] = Math.min(lo[key] ?? 1, v); hi[key] = Math.max(hi[key] ?? 0, v);
      }
    });
  }
  names.forEach((s, i) => assert.ok(s.size >= 5, `voice ${i}: only ${[...s]}`));
  for (let i = 0; i < 4; i++) for (const k of ["tone", "decay", "texture", "reso", "attack", "character", "spread"]) {
    assert.ok(hi[i + k] - lo[i + k] > 0.6, `voice ${i} ${k} spans only ${lo[i + k]}..${hi[i + k]}`);
  }
});

test("generated sounds are audibly different (brightness and length vary several-fold per voice)", () => {
  const e = new C.NoizEngine();
  const NM = ["HISS", "DUST", "METAL", "ATMOS"];
  const stats = NM.map(() => ({ zc: [], len: [] }));
  for (let n = 0; n < 12; n++) {
    e.generate("ALL");
    e.state.tracks.forEach((t, i) => {
      const p = Object.assign({ amp: 0.8 }, t.sound, t.synth);
      const h = MODEL.noizModelHit(MAP, NM[i], p, 22050, 1500, 3);
      let z = 0; for (let s = 1; s < Math.min(h.L.length, 2205); s++) if ((h.L[s] < 0) !== (h.L[s - 1] < 0)) z++;
      stats[i].zc.push(z / Math.min(h.L.length, 2205)); stats[i].len.push(h.info.attackMs + h.info.decayMs);
    });
  }
  stats.forEach((s, i) => {
    assert.ok(Math.max(...s.zc) / Math.max(1e-3, Math.min(...s.zc)) > 2, `${NM[i]} brightness barely varies`);
    assert.ok(Math.max(...s.len) / Math.min(...s.len) > 3, `${NM[i]} length barely varies`);
  });
});
