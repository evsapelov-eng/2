// Executes the GENERATED voice / RUMBLE patches in tools/maxsim.js and compares them with
// the shared model (js/shared/kore_dsp_model.js): same pitch glide, decay, click, drive,
// tone, choke and bounded feedback. Proves wiring + maths, not Max's own objects.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { Patch, SR } = require("../tools/maxsim");
const MAXDIR = path.join(__dirname, "..", "max");
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "spec", "dsp_map.json"), "utf8"));
const M = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "shared", "kore_dsp_model.js"), "utf8"), M);
const FILES = { PUNCH: "punch", SUB: "sub", "TOM L": "toml", "TOM H": "tomh", HAT: "hat" };

function load(file) { return new Patch(JSON.parse(fs.readFileSync(path.join(MAXDIR, file), "utf8")), 99); }
function hit(voice, over = {}, ms = 600, p0) {
  const p = p0 || load(`kore_voice_${FILES[voice]}.maxpat`);
  const params = Object.assign({}, MAP.voices[voice].defaults, over);
  const keys = MAP.voices[voice].params;
  const list = [over.amp === undefined ? 0.8 : over.amp];
  for (let i = 0; i < 5; i++) list.push(i < keys.length ? params[keys[i]] : 0);
  list.push(over.open ? 1 : 0);
  p.send(p.inletBox().id, 0, list);
  return { out: p.run(Math.round(ms / 1000 * SR))[1], patch: p, params };
}
const energy = (x, a = 0, b = x.length) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return e; };
function zcHz(x, a, b) { let n = 0; for (let i = a + 1; i < b; i++) if ((x[i] < 0) !== (x[i - 1] < 0)) n++; return n / 2 / ((b - a) / SR); }
function t90(x) { const e = energy(x); let a = 0; for (let i = 0; i < x.length; i++) { a += x[i] * x[i]; if (a >= e * 0.9) return i / SR * 1000; } return 0; }
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12);

for (const voice of ["PUNCH", "SUB", "TOM L", "TOM H", "HAT"]) {
  test(`${voice} patch: sounds, is bounded, ends at zero (instance frees)`, () => {
    const { out } = hit(voice, {}, 1500);
    assert.ok(energy(out) > 1e-3, "silent");
    assert.ok(out.every((s) => Number.isFinite(s) && Math.abs(s) < 1.5));
    assert.ok(energy(out, out.length - 2000) < 1e-12, "tail must reach 0");
  });
  test(`${voice} patch: every input of the trigger list changes the sound`, () => {
    const ref = hit(voice).out;
    const keys = MAP.voices[voice].params.concat(["amp"]);
    for (const k of keys) {
      const v = MAP.voices[voice].defaults[k];
      const o = hit(voice, { [k]: k === "amp" ? 0.2 : (v > 0.5 ? 0.02 : 0.98) }).out;
      const d = Math.max(rel(energy(ref), energy(o)), rel(t90(ref), t90(o)), rel(zcHz(ref, 0, 4800), zcHz(o, 0, 4800)));
      assert.ok(d > 0.05, `${voice}.${k} has no effect (${d.toFixed(4)})`);
    }
  });
}

test("PUNCH patch = model: settled pitch at TUNE, glide from the sweep start, same decay", () => {
  for (const tune of [0.1, 0.5, 0.9]) {
    const { out, params } = hit("PUNCH", { tune, drive: 0, click: 0 }, 500);
    const info = M.koreModelInfo(MAP, "PUNCH", params);
    const settled = zcHz(out, Math.round(0.12 * SR), Math.round(0.2 * SR));
    assert.ok(Math.abs(settled - info.tuneHz) / info.tuneHz < 0.06, `tune ${tune}: ${settled.toFixed(1)} Hz vs ${info.tuneHz.toFixed(1)} Hz`);
    const early = zcHz(out, 0, Math.round(0.006 * SR));
    assert.ok(early > info.tuneHz * 1.8, `sweep start ${early.toFixed(0)} Hz`);
    const m = M.koreModelHit(MAP, "PUNCH", Object.assign({ amp: 0.8 }, params), SR, 500, 1).L;
    assert.ok(rel(t90(out), t90(m)) < 0.05, `decay patch ${t90(out).toFixed(1)} vs model ${t90(m).toFixed(1)} ms`);
  }
});

test("A04: PUNCH macro changes the onset sweep, not the level", () => {
  const lo = hit("PUNCH", { punch: 0.05, click: 0, drive: 0 }).out, hi = hit("PUNCH", { punch: 0.95, click: 0, drive: 0 }).out;
  const s = (x) => zcHz(x, 0, Math.round(0.004 * SR));
  assert.ok(s(hi) > s(lo) * 1.5, `onset ${s(lo).toFixed(0)} → ${s(hi).toFixed(0)} Hz`);
  const pk = (x) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  assert.ok(rel(pk(lo), pk(hi)) < 0.25, "peak level should stay similar");
});

test("A06: DRIVE adds harmonics with output compensation (peak bounded)", () => {
  const clean = hit("PUNCH", { drive: 0, click: 0 }).out, hot = hit("PUNCH", { drive: 1, click: 0 }).out;
  const pk = (x) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  const crest = (x) => pk(x) / Math.sqrt(energy(x) / x.length);
  assert.ok(crest(hot) < crest(clean) * 0.85, "saturation lowers crest");
  assert.ok(pk(hot) <= pk(clean) * 1.2, `peak ${pk(clean).toFixed(3)} → ${pk(hot).toFixed(3)}`);
});

test("A07: CLICK adds high-frequency attack energy in the first ms, pitch unchanged", () => {
  const off = hit("PUNCH", { click: 0, drive: 0 }).out, on = hit("PUNCH", { click: 1, drive: 0 }).out;
  const hf = (x) => { let e = 0; for (let i = 1; i < 240; i++) e += (x[i] - x[i - 1]) ** 2; return e; };
  assert.ok(hf(on) > hf(off) * 3, "click energy");
  assert.ok(rel(zcHz(on, 6000, 9600), zcHz(off, 6000, 9600)) < 0.03, "settled pitch unchanged");
});

test("A15: HAT open is longer than closed; a closed hit right after chokes the open tail", () => {
  const closed = hit("HAT", { open: 0 }, 800).out, open = hit("HAT", { open: 1 }, 800).out;
  assert.ok(t90(open) > t90(closed) * 3, `open ${t90(open)} vs closed ${t90(closed)} ms`);
  const p = load("kore_voice_hat.maxpat"), list = (o) => [0.8, 0.55, 0.35, 0, 0, 0, o];
  p.send(p.inletBox().id, 0, list(1));
  const a = p.run(Math.round(0.03 * SR))[1].slice();
  p.send(p.inletBox().id, 0, list(0));
  const b = p.run(Math.round(0.5 * SR))[1];
  // window 80..200 ms: the open hat alone still rings there; after the closed hit it must be gone
  const w = (x) => energy(x, Math.round(0.08 * SR), Math.round(0.2 * SR));
  assert.ok(w(open) > 1e-3, "open hat rings in the window");
  assert.ok(w(b) < w(open) * 0.05, `open tail must be cut (${w(b).toExponential(2)} vs ${w(open).toExponential(2)})`);
});

test("A14: TOM L and TOM H sit in distinct pitch ranges", () => {
  const lHz = (t) => M.koreModelInfo(MAP, "TOM L", { tune: t, decay: 0.4, tone: 0.3 }).tuneHz;
  const hHz = (t) => M.koreModelInfo(MAP, "TOM H", { tune: t, decay: 0.4, tone: 0.3 }).tuneHz;
  assert.ok(lHz(0.5) < hHz(0.5));
  const l = hit("TOM L", { tone: 0 }).out, h = hit("TOM H", { tone: 0 }).out;
  assert.ok(zcHz(h, 4800, 9600) > zcHz(l, 4800, 9600) * 1.4);
});

test("A12: RUMBLE wet follows the kick, feedback bounded, no runaway after many seconds", () => {
  const r = load("kore_rumble.maxpat");
  const [sigIn, msgIn, duckIn] = r.inlets();
  const kick = M.koreModelHit(MAP, "PUNCH", Object.assign({ amp: 1 }, MAP.voices.PUNCH.defaults), SR, 1000, 3).L;
  const n = SR * 6, x = new Float64Array(n);
  for (let b = 0; b < 12; b++) kick.forEach((v, i) => { const j = b * SR / 2 + i; if (j < n) x[j] += v; });
  r.feed(sigIn, x);
  r.send(duckIn.id, 0, ["bang"]);
  r.send(msgIn.id, 0, [1, 0.6, 1.0, 0.5, 0, 0, 0]);   // max tail
  const out = r.run(n)[1];
  assert.ok(energy(out) > 1e-4, "wet audible");
  const pk = out.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  assert.ok(pk < 2 && out.every(Number.isFinite), "bounded: " + pk);
  const info = M.koreModelInfo(MAP, "RUMBLE", { amount: 0.6, tail: 1, duck: 0.5 });
  assert.ok(info.feedback <= MAP.voices.RUMBLE.fbMax);
});

test("A13: a PUNCH hit ducks the RUMBLE tail", () => {
  const mk = () => { const r = load("kore_rumble.maxpat"); const [s, m, d] = r.inlets(); return { r, s, m, d }; };
  const noise = new Float64Array(SR); for (let i = 0; i < SR; i++) noise[i] = Math.sin(i * 0.02) * 0.8;
  const a = mk(), b = mk();
  a.r.feed(a.s, noise); b.r.feed(b.s, noise);
  a.r.send(a.m.id, 0, [1, 0.6, 0.6, 0.9, 0, 0, 0]); b.r.send(b.m.id, 0, [1, 0.6, 0.6, 0.9, 0, 0, 0]);
  const pre = Math.round(0.2 * SR);
  const oa = a.r.run(pre), ob = b.r.run(pre);
  b.r.send(b.d.id, 0, ["bang"]); // PUNCH hit on b only
  const ra = a.r.run(Math.round(0.02 * SR))[1].slice(pre), rb = b.r.run(Math.round(0.02 * SR))[1].slice(pre);
  assert.ok(energy(rb) < energy(ra) * 0.5, "ducked");
});
