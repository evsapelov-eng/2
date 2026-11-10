// Executes the GENERATED kick player (max/kore_kick.maxpat) in tools/maxsim.js with a
// transport phase ramp: kicks must start exactly on the step boundary sample, be
// identical, follow the pattern buffer, and produce the duck proximity signal.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { Patch, SR } = require("../tools/maxsim");
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "spec", "dsp_map.json"), "utf8"));
const M = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "shared", "kore_dsp_model.js"), "utf8"), M);
const KICK = M.koreRenderKick(MAP, MAP.voices.PUNCH.defaults, SR).L;

function run(bpm, bars, pattern, startPhase = 0) {
  const p = new Patch(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "max", "kore_kick.maxpat"), "utf8")), 1);
  p.buffers["---kpat"] = Float64Array.from(pattern);
  p.buffers["---kick_a"] = Float64Array.from(KICK);
  const msg = p.inlets()[0];
  p.send(msg.id, 0, ["sr", SR]); p.send(msg.id, 0, ["tempo", bpm]); p.send(msg.id, 0, ["level", 1]); p.send(msg.id, 0, ["playing", 1]);
  const barS = 4 * 60 / bpm * SR, n = Math.round(bars * barS);
  const ph = new Float64Array(n);
  for (let i = 0; i < n; i++) ph[i] = (startPhase + i / barS) % 1;
  const phb = Object.values(p.boxes).find((b) => b.cls === "phasor~");
  phb.state.ext = ph; phb.state.i = 0;
  p.run(n);
  const outs = Object.values(p.boxes).filter((b) => b.cls === "outlet").sort((a, b) => a.patching_rect[0] - b.patching_rect[0]);
  return { audio: outs[0].state.buf, prox: outs[1].state.buf, barS, n };
}
const onsets = (x) => { const o = []; for (let i = 1; i < x.length; i++) if (x[i - 1] === 0 && x[i] !== 0 && (o.length === 0 || i - o[o.length - 1] > 100)) o.push(i); return o; };

for (const bpm of [120, 130, 145]) {
  test(`four-on-the-floor at ${bpm} BPM: kicks start exactly on the quarter-note sample (±1)`, () => {
    const pat = new Array(16).fill(0); [0, 4, 8, 12].forEach((s) => { pat[s] = 1; });
    const r = run(bpm, 2.05, pat, 0.999);
    const want = [];
    for (let b = 1; b < 9; b++) want.push(Math.round((b * 0.25 - 0.999 + 1) % 2 * r.barS));
    // find the first non-zero sample after each expected boundary
    const checked = want.filter((x) => x > 0 && x < r.audio.length - 2000);
    assert.ok(checked.length >= 6, "must check at least 6 kicks, got " + checked.length);
    for (const w of checked) {
      let i = w - 3; while (i < w + 20 && r.audio[i] === 0) i++;
      assert.ok(Math.abs(i - w) <= 2, `bpm ${bpm}: kick at ${i}, expected ${w}`);
    }
  });
}

test("every kick is the same sound (sample-identical hits)", () => {
  const pat = new Array(16).fill(0); [0, 4, 8, 12].forEach((s) => { pat[s] = 1; });
  const r = run(130, 1.2, pat, 0.9999);
  const quarter = r.barS / 4, starts = [];
  for (let b = 1; b <= 4; b++) starts.push(Math.round(b * quarter - 0.9999 * r.barS + r.barS) % r.barS);
  const seg = (s) => Array.from(r.audio.slice(s + 2, s + 2 + 3000));
  const a = seg(starts[0]), b = seg(starts[1]);
  let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  assert.ok(d < 1e-9, "hits differ by " + d);
});

test("pattern buffer drives the kick: steps off are silent, amplitude follows the pattern", () => {
  const pat = new Array(16).fill(0); pat[0] = 1; pat[8] = 0.3;
  const r = run(120, 1.02, pat, 0.9999);
  const half = Math.round(r.barS / 2) + Math.round(0.0001 * r.barS);
  const pk = (a, b) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(r.audio[i])); return m; };
  const first = pk(0, 4000), second = pk(half, half + 4000), quiet = pk(Math.round(r.barS / 4) + 200, Math.round(r.barS / 4) + 3000);
  assert.ok(first > 0.5 && Math.abs(second / first - 0.3) < 0.05, `amps ${first} ${second}`);
  assert.ok(quiet < 1e-6 || quiet < first * 0.05, "step 4 must be silent (only the previous tail)");
});

test("proximity signal (low-end duck): 1 at the kick, 0 after the release, never above 1", () => {
  const pat = new Array(16).fill(0); pat[0] = 1;
  const r = run(120, 1.2, pat, 0.9);          // first kick after 0.1 bar (the 'playing' ramp has settled)
  const s0 = Math.round(0.1 * r.barS);
  assert.ok(r.prox[s0 + 2] > 0.95, "prox at hit " + r.prox[s0 + 2]);
  const rel = MAP.lowEnd.duckReleaseMs / 1000 * SR;
  assert.ok(r.prox[Math.round(s0 + rel + 50)] === 0, "released");
  assert.ok(Array.from(r.prox).every((v) => v >= 0 && v <= 1));
});

test("stopped transport (playing 0) → silence and no duck", () => {
  const p = new Patch(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "max", "kore_kick.maxpat"), "utf8")), 1);
  p.buffers["---kpat"] = Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  p.buffers["---kick_a"] = Float64Array.from(KICK);
  const msg = p.inlets()[0];
  p.send(msg.id, 0, ["tempo", 120]); p.send(msg.id, 0, ["level", 1]); p.send(msg.id, 0, ["playing", 0]);
  const phb = Object.values(p.boxes).find((b) => b.cls === "phasor~");
  const n = SR; phb.state.ext = Float64Array.from({ length: n }, (_, i) => (i / (2 * SR)) % 1); phb.state.i = 0;
  p.run(n);
  const outs = Object.values(p.boxes).filter((b) => b.cls === "outlet");
  outs.forEach((o) => assert.ok(o.state.buf.every((v) => v === 0)));
});

// ---- HUM: the sub that hits with the kick and hums until the next one ----
function runHum(humAmp, pattern, gate = 1, bars = 1.3, humpitch = 0.5) {
  const p = new Patch(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "max", "kore_kick.maxpat"), "utf8")), 1);
  const hp = Object.assign({}, MAP.voices.PUNCH.defaults, { humpitch });
  p.buffers["---kpat"] = Float64Array.from(pattern);
  p.buffers["---kick_a"] = Float64Array.from(KICK);
  p.buffers["---hum_a"] = Float64Array.from(M.koreRenderHum(MAP, hp, SR, 120).L);
  const msg = p.inlets()[0];
  p.send(msg.id, 0, ["sr", SR]); p.send(msg.id, 0, ["tempo", 120]); p.send(msg.id, 0, ["level", 1]);
  p.send(msg.id, 0, ["playing", 1]); p.send(msg.id, 0, ["gate", gate]); p.send(msg.id, 0, ["hum", humAmp]);
  const barS = 2 * SR, n = Math.round(bars * barS);
  const phb = Object.values(p.boxes).find((b) => b.cls === "phasor~");
  phb.state.ext = Float64Array.from({ length: n }, (_, i) => (0.9 + i / barS) % 1); phb.state.i = 0;
  p.run(n);
  const outs = Object.values(p.boxes).filter((b) => b.cls === "outlet").sort((a, b) => a.patching_rect[0] - b.patching_rect[0]);
  return { kick: outs[0].state.buf, hum: outs[2].state.buf, barS, hz: M.koreHumHz(MAP, hp) };
}
const four = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

test("HUM hits WITH the kick (same sample), hums at TUNE·PITCH until the next kick, no clicks", () => {
  const r = runHum(0.5, four);
  const k1 = Math.round(0.1 * r.barS), q = r.barS / 4;   // first kick at 0.1 bar
  const rms = (a, b) => Math.sqrt(r.hum.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a));
  assert.strictEqual(r.hum[k1 - 1], 0, "silent before the first kick");
  assert.ok(rms(k1, k1 + Math.round(0.01 * SR)) > 0.2, "already loud in the first 10 ms: it hits with the kick");
  assert.ok(rms(k1 + 0.2 * SR, k1 + 0.3 * SR) > 0.15, "keeps humming");
  let zc = 0; for (let i = k1 + 0.15 * SR; i < k1 + 0.4 * SR; i++) if ((r.hum[i] < 0) !== (r.hum[i - 1] < 0)) zc++;
  assert.ok(Math.abs(zc / 2 / 0.25 - r.hz) / r.hz < 0.06, `pitch ${zc / 2 / 0.25} vs ${r.hz} Hz`);
  let jump = 0; for (let i = 1; i < r.hum.length; i++) jump = Math.max(jump, Math.abs(r.hum[i] - r.hum[i - 1]));
  assert.ok(jump < 0.04, "no clicks (1 ms attack is the only steep part), also at the restart (max step " + jump + ")");
  assert.ok(Math.abs(r.hum[k1 + q - 2]) < 1e-3 && rms(k1 + q, k1 + q + 480) > 0.2, "fades to 0 just before the next kick, then hits again");
});

test("HUM PITCH moves the hum (−12 … +12 st around the kick TUNE)", () => {
  const lo = runHum(0.5, four, 1, 0.6, 0), hi = runHum(0.5, four, 1, 0.6, 1);
  assert.ok(Math.abs(hi.hz / lo.hz - 4) < 1e-6);
  const zcHz = (x) => { const a = Math.round(0.1 * 2 * SR + 0.15 * SR), b = a + 0.2 * SR; let z = 0; for (let i = a + 1; i < b; i++) if ((x[i] < 0) !== (x[i - 1] < 0)) z++; return z / 2 / 0.2; };
  assert.ok(zcHz(hi.hum) > zcHz(lo.hum) * 3.5);
});

test("HUM 0 → silence; empty pattern (gate 0) → no kick, no hum, no replay of the last hit", () => {
  const off = runHum(0, four);
  assert.ok(off.hum.every((v) => Math.abs(v) < 1e-9));
  const silent = runHum(0.5, new Array(16).fill(0), 0, 2.3);
  assert.ok(silent.kick.every((v) => v === 0) && silent.hum.every((v) => v === 0));
});
