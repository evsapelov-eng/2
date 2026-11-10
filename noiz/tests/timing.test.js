// Timing / scheduler tests — reference vectors from spec §06 and A14–A19.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { loadCore } = require("../js/node_loader");
const C = loadCore();
const plain = (x) => JSON.parse(JSON.stringify(x));
const deq = (a, b, m) => assert.deepStrictEqual(plain(a), plain(b), m);

const msPerBeat = (bpm) => 60000 / bpm;
const toMs = (beat, bpm = 120) => beat * msPerBeat(bpm);
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function soloState(trackId, mutate) {
  const s = C.noizDefaultState();
  s.tracks.forEach((t) => { t.mute = t.id !== trackId; });
  const t = s.tracks[trackId];
  t.steps.forEach((st) => { st.on = false; st.probability = 1; st.ratchet = 1; st.pLocks = {}; });
  if (mutate) mutate(t);
  return s;
}

test("120 BPM, 1:1, 16 steps: step 0 at 0 ms, step 1 at 125 ms, cycle 2 s", () => {
  const s = soloState(0, (t) => t.steps.forEach((st) => { st.on = true; }));
  const ev = C.noizEventsInRange(s, 0, 4);
  assert.strictEqual(ev.length, 16);
  assert.ok(close(toMs(ev[0].beat), 0));
  assert.ok(close(toMs(ev[1].beat), 125));
  const ev2 = C.noizEventsInRange(s, 0, 8);
  assert.strictEqual(ev2[16].stepIndex, 0);
  assert.ok(close(toMs(ev2[16].beat), 2000));
});

test("A17: 3:4 gives 3 steps per 500 ms (~166.667 ms), 5:4 gives 5 steps per 500 ms (100 ms)", () => {
  const s3 = soloState(0, (t) => { t.division = { n: 3, m: 4 }; t.steps.forEach((st) => { st.on = true; }); });
  const e3 = C.noizEventsInRange(s3, 0, 1); // 1 beat = 500 ms
  assert.strictEqual(e3.length, 3);
  assert.ok(close(toMs(e3[1].beat), 500 / 3, 1e-6));
  const s5 = soloState(0, (t) => { t.division = { n: 5, m: 4 }; t.steps.forEach((st) => { st.on = true; }); });
  const e5 = C.noizEventsInRange(s5, 0, 1);
  assert.strictEqual(e5.length, 5);
  assert.ok(close(toMs(e5[1].beat), 100));
});

test("A15: ratchet 4 in a 125 ms step starts at 0, 31.25, 62.5, 93.75 ms", () => {
  const s = soloState(0, (t) => { t.steps[0].on = true; t.steps[0].ratchet = 4; });
  const ev = C.noizEventsInRange(s, 0, 0.25, { minSpacingBeats: C.NoizEngine ? (12 / 60000) * 120 : 0 });
  deq(ev.map((e) => toMs(e.beat)), [0, 31.25, 62.5, 93.75]);
  assert.ok(ev.every((e) => e.ratchetCount === 4));
});

test("ratchet fallback: too-short step reduces sub-hits, never below 1, spacing kept", () => {
  const s = soloState(0, (t) => { t.division = { n: 8, m: 1 }; t.steps[0].on = true; t.steps[0].ratchet = 8; });
  const minSpacing = (12 / 60000) * 120; // 12 ms at 120 BPM
  const ev = C.noizEventsInRange(s, 0, 0.25 / 8 + 1e-9, { minSpacingBeats: minSpacing });
  assert.ok(ev.length >= 1 && ev.length < 8);
  for (let i = 1; i < ev.length; i++) assert.ok(toMs(ev[i].beat - ev[i - 1].beat) >= 12 - 1e-9);
});

test("A14: probability 0 -> no events, 1 -> all enabled events", () => {
  const s0 = soloState(0, (t) => t.steps.forEach((st) => { st.on = true; st.probability = 0; }));
  assert.strictEqual(C.noizEventsInRange(s0, 0, 64).length, 0);
  const s1 = soloState(0, (t) => t.steps.forEach((st) => { st.on = true; st.probability = 1; }));
  assert.strictEqual(C.noizEventsInRange(s1, 0, 64).length, 256);
});

test("probability failure removes the hit and all its ratchets together", () => {
  const s = soloState(0, (t) => { t.steps[0].on = true; t.steps[0].probability = 0.5; t.steps[0].ratchet = 3; });
  const ev = C.noizEventsInRange(s, 0, 400);
  const byCycle = {};
  ev.forEach((e) => { byCycle[e.cycleIndex] = (byCycle[e.cycleIndex] || 0) + 1; });
  Object.values(byCycle).forEach((n) => assert.strictEqual(n, 3));
  const cycles = Object.keys(byCycle).length;
  assert.ok(cycles > 30 && cycles < 70, "about half of 100 cycles should pass, got " + cycles);
});

test("same seed -> identical events; independent of window size", () => {
  const s = C.noizDefaultState();
  s.tracks.forEach((t) => t.steps.forEach((st) => { if (st.on) st.probability = 0.6; }));
  const whole = C.noizEventsInRange(s, 0, 32);
  const sliced = [];
  let a = 0;
  const sizes = [0.013, 0.2, 0.0007, 1.1, 0.05];
  let i = 0;
  while (a < 32) {
    const b = Math.min(32, a + sizes[i++ % sizes.length]);
    sliced.push(...C.noizEventsInRange(s, a, b));
    a = b;
  }
  assert.strictEqual(JSON.stringify(sliced), JSON.stringify(whole));
  const again = C.noizEventsInRange(C.noizValidateAndNormalize(JSON.parse(JSON.stringify(s))), 0, 32);
  assert.strictEqual(JSON.stringify(again), JSON.stringify(whole));
});

test("A16: 16 vs 13 steps — 13-step track does not reset on bar lines (polymeter)", () => {
  const s = soloState(1, (t) => { t.length = 13; t.steps[0].on = true; });
  s.tracks[0].mute = false;
  s.tracks[0].steps.forEach((st) => { st.on = false; });
  s.tracks[0].steps[0].on = true;
  const ev = C.noizEventsInRange(s, 0, 52); // 13 bars
  const dust = ev.filter((e) => e.trackId === 1).map((e) => e.beat);
  const hiss = ev.filter((e) => e.trackId === 0).map((e) => e.beat);
  assert.strictEqual(hiss.length, 13);
  assert.strictEqual(dust.length, 16); // 52 beats / 3.25 beats per cycle
  assert.ok(close(dust[1], 3.25));
  // only coincide at 0 within 13 bars
  deq(dust.filter((b) => hiss.some((h) => close(h, b))), [0]);
});

test("US-05 setup: HISS 16/1:1, DUST 13/1:1, METAL 7/3:4, ATMOS 5/5:4 run independently", () => {
  const s = C.noizDefaultState();
  const cfg = [[16, 1, 1], [13, 1, 1], [7, 3, 4], [5, 5, 4]];
  s.tracks.forEach((t, i) => {
    t.length = cfg[i][0]; t.division = { n: cfg[i][1], m: cfg[i][2] };
    t.steps.forEach((st) => { st.on = true; st.probability = 1; st.ratchet = 1; });
  });
  const ev = C.noizEventsInRange(s, 0, 16);
  const count = (id) => ev.filter((e) => e.trackId === id).length;
  assert.strictEqual(count(0), 64);
  assert.strictEqual(count(1), 64);
  assert.strictEqual(count(2), 48);  // 3 per beat
  assert.strictEqual(count(3), 80);  // 5 per beat
  const metal = ev.filter((e) => e.trackId === 2);
  assert.strictEqual(metal[7].stepIndex, 0); // wraps after 7 steps
});

test("mute removes events of that track only", () => {
  const s = C.noizDefaultState();
  s.tracks[2].mute = true;
  assert.ok(C.noizEventsInRange(s, 0, 16).every((e) => e.trackId !== 2));
});

// ---- clock follower: A18/A19 ----

function runClock(engine, positions, tempo) {
  const out = [];
  positions.forEach((p) => { out.push(...engine.tick(p, tempo)); });
  return out;
}
function allOnEngine(clockOpts) {
  const e = new C.NoizEngine({ clock: clockOpts || { lookaheadMs: 0 } });
  e.state.tracks.forEach((t, i) => {
    t.mute = i !== 0;
    t.steps.forEach((st) => { st.on = true; st.probability = 1; st.ratchet = 1; });
  });
  return e;
}
function ramp(from, to, stepBeats) {
  const out = [];
  for (let p = from; p < to - 1e-12; p += stepBeats) out.push(p);
  out.push(to);
  return out;
}

test("A18: tempo 80->160 while running: no doubles, no gaps, musical position preserved", () => {
  const e = allOnEngine();
  const out = [];
  let pos = 0;
  e.tick(0, 80);
  for (let i = 0; i < 4000; i++) {
    const bpm = i < 2000 ? 80 : 160;
    pos += (1.3 / 60000) * bpm; // 1.3 ms polling
    out.push(...e.tick(pos, bpm));
  }
  const beats = out.map((x) => x.beat);
  const expected = Math.floor(pos / 0.25) + 1;
  assert.strictEqual(beats.length, expected);
  for (let i = 0; i < beats.length; i++) assert.ok(close(beats[i], i * 0.25));
});

test("A19: loop wrap re-triggers loop start once, never doubles across the boundary", () => {
  const e = allOnEngine();
  // loop region [0, 4) beats, polled every 0.01 beat, three passes
  const positions = [];
  for (let pass = 0; pass < 3; pass++) for (let p = (pass === 0 ? 0 : 0.004); p < 4; p += 0.01) positions.push(p);
  const out = runClock(e, positions, 120);
  const firstPass = out.filter((x) => x.beat < 4);
  assert.strictEqual(out.length, 48); // 16 per pass, 3 passes
  const zeros = out.filter((x) => x.beat === 0).length;
  assert.strictEqual(zeros, 3);
  assert.ok(firstPass.length === 48);
});

test("A19: seek forward does not emit skipped events; stop/start resumes without doubles", () => {
  const e = allOnEngine();
  const out1 = runClock(e, ramp(0, 1, 0.01), 120);  // steps 0..4 (pos 1.0 inclusive end)
  assert.strictEqual(out1.length, 4);
  const out2 = runClock(e, ramp(8.0, 8.6, 0.01), 120); // seek to bar 3
  assert.ok(out2.every((x) => x.beat >= 8 - 0.05));
  assert.strictEqual(out2[0].beat, 8);
  // stop: position frozen
  const still = runClock(e, [8.6, 8.6, 8.6, 8.6, 8.6, 8.6], 120);
  assert.strictEqual(still.length, 0);
  assert.strictEqual(e.transportPlaying, false);
  // resume from same position: contiguous, no repeat of 8.5
  const out3 = runClock(e, ramp(8.61, 9.1, 0.01), 120);
  deq(out3.map((x) => x.beat), [8.75, 9]);
});

// ---- lookahead scheduling (the mode used in Max) ----

function jitterSeq(n, maxMs) {
  const r = new C.NoizRng(7);
  return Array.from({ length: n }, () => r.next() * maxMs);
}

function simulate(engine, { bpm = 120, durationMs = 6000, pollMs = 10, jitterMs = 25, posAt }) {
  const fires = [];
  const jit = jitterSeq(Math.ceil(durationMs / pollMs) + 1, jitterMs);
  let lastT = -1;
  for (let k = 0; k * pollMs < durationMs; k++) {
    const t = Math.max(lastT, k * pollMs + jit[k]); // low-priority thread: late, never early
    lastT = t;
    const evs = engine.tick(posAt(t), bpm);
    if (engine.flushRequested) fires.push({ flushAt: t });
    evs.forEach((e) => fires.push({ t: t + e.delayMs, beat: e.beat, trackId: e.trackId }));
  }
  return { fires: fires.filter((f) => f.t !== undefined), lastT };
}

test("lookahead: events fire exactly on time despite up to 25 ms JS jitter", () => {
  const e = allOnEngine({ lookaheadMs: 40 });
  const { fires, lastT } = simulate(e, { posAt: (t) => t / 500 });
  const times = fires.map((f) => f.t).filter((t) => t < lastT);
  const expected = [];
  for (let t = 0; t < lastT; t += 125) expected.push(t);
  assert.strictEqual(times.length, expected.length);
  // Known limit: the very first hit after Play is detected on the next poll (≤ poll + jitter late).
  assert.ok(times[0] - expected[0] <= 35, "first hit late by " + (times[0] - expected[0]));
  times.slice(1).forEach((t, i) => assert.ok(Math.abs(t - expected[i + 1]) < 1e-6, `event ${i + 1}: ${t} vs ${expected[i + 1]}`));
});

test("lookahead + Live loop [0,4): nothing past loop end is queued, every pass on time", () => {
  const e = allOnEngine({ lookaheadMs: 40 });
  e.setLoop(true, 0, 4); // 4 beats = 2000 ms at 120
  const { fires, lastT } = simulate(e, { durationMs: 7000, posAt: (t) => (t / 500) % 4 });
  assert.ok(fires.every((f) => f.beat < 4));
  const times = fires.map((f) => f.t).filter((t) => t < lastT);
  const expected = [];
  for (let t = 0; t < lastT; t += 125) expected.push(t);
  deq(times.length, expected.length);
  // Known limit: the very first hit after Play is detected on the next poll (≤ poll + jitter late).
  assert.ok(times[0] - expected[0] <= 35, "first hit late by " + (times[0] - expected[0]));
  times.slice(1).forEach((t, i) => assert.ok(Math.abs(t - expected[i + 1]) < 1e-6, `event ${i + 1}: ${t} vs ${expected[i + 1]}`));
});

test("lookahead: seek requests a flush and restarts at the new position", () => {
  const e = allOnEngine({ lookaheadMs: 40 });
  const posAt = (t) => (t < 1000 ? t / 500 : 16 + (t - 1000) / 500);
  const fires = [];
  let flushes = 0;
  for (let t = 0; t < 1600; t += 10) {
    const evs = e.tick(posAt(t), 120);
    if (e.flushRequested) flushes++;
    evs.forEach((x) => fires.push(x.beat));
  }
  assert.strictEqual(flushes, 1);
  assert.ok(fires.includes(16));
  assert.ok(!fires.some((b) => b > 2.1 && b < 16)); // nothing from the skipped region
});

test("lookahead: stop requests a flush; resume continues without doubles", () => {
  const e = allOnEngine({ lookaheadMs: 40 });
  const beats = [];
  let t = 0;
  for (; t <= 1000; t += 10) e.tick(t / 500, 120).forEach((x) => beats.push(x.beat));
  let flushed = false;
  for (let k = 0; k < 6; k++) { e.tick(2.0, 120); flushed = flushed || e.flushRequested; }
  assert.ok(flushed);
  assert.strictEqual(e.transportPlaying, false);
  const after = [];
  for (let k = 1; k <= 50; k++) e.tick(2.0 + k * 0.02, 120).forEach((x) => after.push(x.beat));
  assert.strictEqual(after[0], 2); // the hit at 2.0 that was flushed is re-scheduled once
  assert.strictEqual(new Set(after).size, after.length);
});

// ---- panorama ----

test("pan: spread 0 → every hit at the track pan; P-Lock pan overrides on its step", () => {
  const s = soloState(0, (t) => { t.steps.forEach((st) => { st.on = true; }); t.synth.spread = 0; t.sound.pan = 0.3; t.steps[5].pLocks = { pan: 0.9 }; });
  const ev = C.noizEventsInRange(s, 0, 4);
  ev.forEach((e) => assert.ok(Math.abs(e.pan - (e.stepIndex === 5 ? 0.9 : 0.3)) < 1e-9));
});

test("pan: spread moves hits around the base, deterministically and inside the field", () => {
  const s = soloState(1, (t) => { t.steps.forEach((st) => { st.on = true; }); t.synth.spread = 0.6; t.sound.pan = 0.5; });
  const a = C.noizEventsInRange(s, 0, 16).map((e) => e.pan);
  const b = C.noizEventsInRange(s, 0, 16).map((e) => e.pan);
  deq(a, b);
  assert.ok(a.every((p) => p >= 0.2 - 1e-9 && p <= 0.8 + 1e-9));
  assert.ok(Math.max(...a) - Math.min(...a) > 0.4, "spread should be audible");
  assert.ok(new Set(a.map((p) => p.toFixed(3))).size > 20);
});

test("pan: ratchet sub-hits sweep across the stereo field", () => {
  const s = soloState(0, (t) => { t.steps[0].on = true; t.steps[0].ratchet = 4; t.synth.spread = 0.5; t.sound.pan = 0.5; });
  const p = C.noizEventsInRange(s, 0, 0.25).map((e) => e.pan);
  assert.strictEqual(p.length, 4);
  const d = p.slice(1).map((x, i) => x - p[i]);
  assert.ok(d.every((x) => x > 0) || d.every((x) => x < 0), "monotonic sweep " + p);
  assert.ok(Math.abs(Math.abs(p[3] - p[0]) - 0.5) < 1e-9);
});
