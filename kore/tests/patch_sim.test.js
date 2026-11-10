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
const FILES = { SUB: "sub", "TOM L": "toml", "TOM H": "tomh", HAT: "hat" };

function load(file) { return new Patch(JSON.parse(fs.readFileSync(path.join(MAXDIR, file), "utf8")), 99); }
function hit(voice, over = {}, ms = 600, p0) {
  const p = p0 || load(`kore_voice_${FILES[voice]}.maxpat`);
  const params = Object.assign({}, MAP.voices[voice].defaults, over);
  const keys = MAP.voices[voice].params.filter((k) => k !== "pan");
  const list = [over.amp === undefined ? 0.8 : over.amp];
  for (let i = 0; i < 5; i++) list.push(i < keys.length ? params[keys[i]] : 0);
  list.push(over.isOpen ? 1 : 0);
  list.push(params.pan === undefined ? 0.5 : params.pan);
  p.send(p.inletBox().id, 0, list);
  return { out: p.run(Math.round(ms / 1000 * SR))[1], patch: p, params };
}
const energy = (x, a = 0, b = x.length) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return e; };
function zcHz(x, a, b) { let n = 0; for (let i = a + 1; i < b; i++) if ((x[i] < 0) !== (x[i - 1] < 0)) n++; return n / 2 / ((b - a) / SR); }
function t90(x) { const e = energy(x); let a = 0; for (let i = 0; i < x.length; i++) { a += x[i] * x[i]; if (a >= e * 0.9) return i / SR * 1000; } return 0; }
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12);

for (const voice of ["SUB", "TOM L", "TOM H", "HAT"]) {
  test(`${voice} patch: sounds, is bounded, ends at zero (instance frees)`, () => {
    const { out } = hit(voice, {}, 1500);
    assert.ok(energy(out) > 1e-3, "silent");
    assert.ok(out.every((s) => Number.isFinite(s) && Math.abs(s) < 1.5));
    assert.ok(energy(out, out.length - 2000) < 1e-12, "tail must reach 0");
  });
  test(`${voice} patch: every input of the trigger list changes the sound`, () => {
    const base = voice === "HAT" ? { isOpen: 1 } : {};   // OPEN (length) only acts on open hats
    const ref = hit(voice, base).out;
    const keys = MAP.voices[voice].params.concat(["amp"]);
    for (const k of keys) {
      const v = MAP.voices[voice].defaults[k];
      const o = hit(voice, Object.assign({}, base, { [k]: k === "amp" ? 0.2 : (v > 0.5 ? 0.02 : 0.98) })).out;
      const d = Math.max(rel(energy(ref), energy(o)), rel(t90(ref), t90(o)), rel(zcHz(ref, 0, 4800), zcHz(o, 0, 4800)));
      assert.ok(d > 0.05, `${voice}.${k} has no effect (${d.toFixed(4)})`);
    }
  });
}

// ---- PUNCH: the rendered kick (played sample-accurately from a buffer, see kick_sim) ----
const kick = (over) => M.koreRenderKick(MAP, Object.assign({}, MAP.voices.PUNCH.defaults, over), SR);

test("SUB / TOM patches = model: same glide and decay", () => {
  for (const voice of ["SUB", "TOM L"]) {
    const { out, params } = hit(voice, { snap: 0, drive: 0, pan: 0.5 }, 600);
    const m = M.koreModelHit(MAP, voice, Object.assign({ amp: 0.8 }, params), SR, 600, 1).L;
    assert.ok(rel(t90(out), t90(m)) < 0.06, `${voice} decay patch ${t90(out).toFixed(1)} vs model ${t90(m).toFixed(1)} ms`);
    const info = M.koreModelInfo(MAP, voice, params);
    const settled = zcHz(out, Math.round(0.08 * SR), Math.round(0.14 * SR));
    assert.ok(Math.abs(settled - info.tuneHz) / info.tuneHz < 0.08, `${voice} ${settled} vs ${info.tuneHz}`);
  }
});

test("A03: kick TUNE sets the settled fundamental (40-80 Hz range)", () => {
  for (const tune of [0.1, 0.5, 0.9]) {
    const k = kick({ tune, click: 0 });
    const s = zcHz(k.L, Math.round(0.12 * SR), Math.round(0.2 * SR));
    assert.ok(Math.abs(s - k.info.tuneHz) / k.info.tuneHz < 0.08, `tune ${tune}: ${s.toFixed(1)} vs ${k.info.tuneHz.toFixed(1)} Hz`);
  }
});

test("A04: kick PUNCH raises the onset pitch (sweep), level stays normalised", () => {
  const lo = kick({ punch: 0.05, click: 0 }), hi = kick({ punch: 0.95, click: 0 });
  const on = (x) => zcHz(x, 0, Math.round(0.01 * SR));
  assert.ok(on(hi.L) > on(lo.L) * 1.4, `onset ${on(lo.L).toFixed(0)} → ${on(hi.L).toFixed(0)} Hz`);
  const pk = (x) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  assert.ok(Math.abs(pk(lo.L) - pk(hi.L)) < 0.02);
});

test("A05: kick BODY and DECAY lengthen the tail without clicks at the end", () => {
  const a = kick({ decay: 0.1, body: 0 }), b = kick({ decay: 0.9, body: 0 }), c = kick({ decay: 0.1, body: 1 });
  assert.ok(t90(b.L) > t90(a.L) * 2 && t90(c.L) > t90(a.L) * 1.3, `${t90(a.L)} / ${t90(b.L)} / ${t90(c.L)} ms`);
  for (const k of [a, b, c]) assert.ok(Math.abs(k.L[k.L.length - 1]) === 0 && Math.abs(k.L[k.L.length - 50]) < 1e-3, "tail ends at 0");
});

test("A06: kick DRIVE adds harmonics; output peak normalised (no loudness jump)", () => {
  const clean = kick({ drive: 0, click: 0 }), hot = kick({ drive: 1, click: 0 });
  const crest = (x) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0) / Math.sqrt(energy(x, 0, Math.round(0.1 * SR)) / Math.round(0.1 * SR));
  assert.ok(crest(hot.L) < crest(clean.L) * 0.85, "denser");
  const pk = (x) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  assert.ok(Math.abs(pk(hot.L) - pk(clean.L)) < 0.02);
});

test("A07: kick CLICK adds a high-frequency attack; CLICK TONE moves it; fundamental unchanged", () => {
  const hf = (x) => { let e = 0; for (let i = 1; i < 240; i++) e += (x[i] - x[i - 1]) ** 2; return e; };
  const off = kick({ click: 0 }), on = kick({ click: 1 });
  assert.ok(hf(on.L) > hf(off.L) * 2, "click energy");
  const dark = kick({ click: 1, clicktone: 0 }), bright = kick({ click: 1, clicktone: 1 });
  assert.ok(hf(bright.L) > hf(dark.L) * 1.3, "click tone");
  assert.ok(rel(zcHz(on.L, 6000, 9600), zcHz(off.L, 6000, 9600)) < 0.05);
});

test("A15: HAT open is longer than closed; a closed hit right after chokes the open tail", () => {
  const closed = hit("HAT", { isOpen: 0 }, 800).out, open = hit("HAT", { isOpen: 1 }, 800).out;
  assert.ok(t90(open) > t90(closed) * 3, `open ${t90(open)} vs closed ${t90(closed)} ms`);
  const p = load("kore_voice_hat.maxpat"), list = (o) => [0.8, 0.55, 0.35, 0.2, 0.45, 0, o, 0.5];
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
  const lHz = (t) => M.koreModelInfo(MAP, "TOM L", { tune: t, decay: 0.4, drive: 0.3 }).tuneHz;
  const hHz = (t) => M.koreModelInfo(MAP, "TOM H", { tune: t, decay: 0.4, drive: 0.3 }).tuneHz;
  assert.ok(lHz(0.5) < hHz(0.5));
  const l = hit("TOM L", { snap: 0, drive: 0 }).out, h = hit("TOM H", { snap: 0, drive: 0 }).out;
  assert.ok(zcHz(h, 2400, 4800) > zcHz(l, 2400, 4800) * 1.4, `${zcHz(h, 2400, 4800)} vs ${zcHz(l, 2400, 4800)}`);
});

test("A12: RUMBLE wet follows the kick, feedback bounded, no runaway after many seconds", () => {
  const r = load("kore_rumble.maxpat");
  const [sigIn, msgIn, proxIn] = r.inlets();
  const k = M.koreRenderKick(MAP, MAP.voices.PUNCH.defaults, SR).L;
  const n = SR * 6, x = new Float64Array(n);
  for (let b = 0; b < 12; b++) k.forEach((v, i) => { const j = b * SR / 2 + i; if (j < n) x[j] += v; });
  r.feed(sigIn, x);
  r.feed(proxIn, new Float64Array(n));
  r.send(msgIn.id, 0, [1, 0.6, 1.0, 0.5, 0.5, 1.0, 0]);   // max tail, max drive
  const out = r.run(n)[1];
  assert.ok(energy(out) > 1e-4, "wet audible");
  const pk = out.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  assert.ok(pk < 2 && out.every(Number.isFinite), "bounded: " + pk);
  const info = M.koreModelInfo(MAP, "RUMBLE", { amount: 0.6, tail: 1, duck: 0.5, tone: 0.5, drive: 1 });
  assert.ok(info.feedback <= MAP.voices.RUMBLE.fbMax);
});

test("A13: the kick proximity signal ducks the RUMBLE tail; TONE and DRIVE change it", () => {
  const mk = () => { const r = load("kore_rumble.maxpat"); const [s, m, p] = r.inlets(); return { r, s, m, p }; };
  const n = Math.round(0.3 * SR), src = new Float64Array(n);
  for (let i = 0; i < n; i++) src[i] = Math.sin(i * 0.02) * 0.8;
  const go = (prox, params) => {
    const a = mk(); a.r.feed(a.s, src); a.r.feed(a.p, prox); a.r.send(a.m.id, 0, params);
    return a.r.run(n)[1];
  };
  const zero = new Float64Array(n), one = new Float64Array(n).fill(1);
  const base = [1, 0.6, 0.6, 0.9, 0.5, 0.2, 0];
  const free = go(zero, base), ducked = go(one, base);
  assert.ok(energy(ducked, SR * 0.15, n) < energy(free, SR * 0.15, n) * 0.05, "ducked by ~duck");
  const dark = go(zero, [1, 0.6, 0.6, 0.9, 0, 0.2, 0]), dirty = go(zero, [1, 0.6, 0.6, 0.9, 0.5, 1, 0]);
  assert.ok(rel(energy(dark, SR * 0.1, n), energy(free, SR * 0.1, n)) > 0.05, "TONE");
  assert.ok(rel(energy(dirty, SR * 0.1, n), energy(free, SR * 0.1, n)) > 0.05, "DRIVE");
});

test("v0.4 TOMs = the kick's synthesis higher up: patch = model with DRIVE, and CLICK adds a bright attack", () => {
  for (const voice of ["TOM L", "TOM H"]) {
    const { out, params } = hit(voice, { snap: 0, drive: 0.9, pan: 0.5 }, 300);
    const m = M.koreModelHit(MAP, voice, Object.assign({ amp: 0.8 }, params), SR, 300, 1).L;
    let best = Infinity, ref = 0;
    for (let i = 0; i < Math.min(9600, m.length); i++) ref += m[i] ** 2;
    for (let sh = -2; sh <= 2; sh++) {   // the sim and the model may differ by a sample of latency
      let err = 0;
      for (let i = 2; i < Math.min(9600, m.length, out.length) - 2; i++) err += (out[i + sh] - m[i]) ** 2;
      best = Math.min(best, err);
    }
    const err = best;
    assert.ok(err / ref < 0.01, `${voice} patch vs model rel. error ${(err / ref).toExponential(2)}`);
    const hf = (x) => { let e = 0; for (let i = 1; i < 240; i++) e += (x[i] - x[i - 1]) ** 2; return e; };
    assert.ok(hf(hit(voice, { snap: 1 }).out) > hf(hit(voice, { snap: 0 }).out) * 2, voice + " click");
    const info = M.koreModelInfo(MAP, voice, params);
    assert.ok(info.startHz > info.tuneHz * 2, voice + ": pitch drop like a kick");
  }
});

test("PAN: balance per hit on TOM / HAT (centre = same level both sides, hard left = right silent)", () => {
  for (const voice of ["TOM L", "TOM H", "HAT"]) {
    const run = (pan) => { const p = load(`kore_voice_${FILES[voice]}.maxpat`); hit(voice, { pan }, 300, p); return [p.outs[1].state.buf, p.outs[2].state.buf]; };
    const [cl, cr] = run(0.5), [ll, lr] = run(0), [rl, rr] = run(1);
    assert.ok(Math.abs(energy(cl) - energy(cr)) / energy(cl) < 1e-6, voice + " centre");
    assert.ok(energy(lr) < energy(cl) * 1e-3 && Math.abs(energy(ll) - energy(cl)) / energy(cl) < 0.05, voice + " left");
    assert.ok(energy(rl) < energy(cl) * 1e-3 && Math.abs(energy(rr) - energy(cl)) / energy(cl) < 0.05, voice + " right");
  }
  const sub = load("kore_voice_sub.maxpat");
  assert.ok(!sub.outs[2], "SUB stays mono (low end)");
});
