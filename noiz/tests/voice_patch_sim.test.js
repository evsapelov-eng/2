// Executes the GENERATED voice .maxpat files in tools/maxsim.js and checks that every
// input of the trigger list reaches the sound through the wiring (no dead wires).
// Proves wiring/logic only — not that Max's own objects behave identically.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { Patch, SR } = require("../tools/maxsim");
const { loadCore } = require("../js/node_loader");
const C = loadCore();

const MAXDIR = path.join(__dirname, "..", "max");
const NAMES = ["HISS", "DUST", "METAL", "ATMOS"];
const FIELDS = ["amp", "tone", "decay", "texture", "drive", "pan", "reso", "attack", "character"];

function hit(name, over, ms = 400) {
  const json = JSON.parse(fs.readFileSync(path.join(MAXDIR, `noiz_voice_${name.toLowerCase()}.maxpat`), "utf8"));
  const p = new Patch(json, 1234);
  const vi = NAMES.indexOf(name);
  const base = Object.assign({ amp: 0.6 }, C.NOIZ_DEFAULT_SOUND[vi], C.NOIZ_DEFAULT_SYNTH[vi]);
  const v = Object.assign(base, over);
  p.send(p.inletBox().id, 0, FIELDS.map((k) => v[k]));
  return p.run(Math.round((ms / 1000) * SR));
}

const energy = (x) => x.reduce((a, s) => a + s * s, 0);
function zc(x) { let n = 0; for (let i = 1; i < x.length; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) n++; return n; }
function t10(x) { const e = energy(x); let a = 0; for (let i = 0; i < x.length; i++) { a += x[i] * x[i]; if (a >= e * 0.1) return i; } return 0; }
function tail(x) { const e = energy(x); let a = 0; for (let i = 0; i < x.length; i++) { a += x[i] * x[i]; if (a >= e * 0.9) return i; } return 0; }
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12);

for (const name of NAMES) {
  test(`${name} voice patch: a trigger produces bounded stereo sound that ends (voice frees)`, () => {
    const o = hit(name, {}, 1500);
    assert.ok(energy(o[1]) > 1e-3 && energy(o[2]) > 1e-3, "silent output");
    assert.ok(o[1].every((s) => Math.abs(s) < 2 && Number.isFinite(s)));
    const end = o[1].slice(-2000);
    assert.ok(energy(end) < 1e-9, "envelope must reach 0 (thispoly~ frees the instance)");
  });

  test(`${name} voice patch: every input is wired to the sound`, () => {
    const ref = hit(name, {});
    const diffs = {};
    const probes = {
      amp: [{ amp: 0.1 }, (o) => energy(o[1])],
      tone: [{ tone: 0.95 }, (o) => zc(o[1])],
      decay: [{ decay: 0.9 }, (o) => tail(o[1])],
      texture: [{ texture: 0.0 }, (o) => zc(o[1]) + energy(o[1]) * 1000],
      drive: [{ drive: 1 }, (o) => { const e = energy(o[1]); let pk = 0; o[1].forEach((s) => { pk = Math.max(pk, Math.abs(s)); }); return pk / Math.sqrt(e / o[1].length); }],
      pan: [{ pan: 0.05 }, (o) => energy(o[1]) / (energy(o[2]) + 1e-12)],
      reso: [{ reso: 0.98 }, (o) => zc(o[1]) + energy(o[1]) * 1000],
      attack: [{ attack: 0.9 }, (o) => t10(o[1])],
      character: [{ character: name === "HISS" ? 1 : name === "ATMOS" ? 0 : 0.95 }, (o) => (name === "ATMOS" ? energy(o[1].map((s, i) => s - o[2][i])) : zc(o[1]) + energy(o[1]) * 1000)],
    };
    for (const [k, [over, metric]] of Object.entries(probes)) {
      const o = hit(name, over);
      diffs[k] = rel(metric(ref), metric(o));
    }
    for (const k of FIELDS) assert.ok(diffs[k] > 0.05, `${name}.${k} has no effect (Δ=${diffs[k].toFixed(4)})`);
  });

  test(`${name} voice patch: pan law — hard left, centre, hard right`, () => {
    const L = hit(name, { pan: 0 }), M = hit(name, { pan: 0.5 }), R = hit(name, { pan: 1 });
    assert.ok(energy(L[2]) < energy(L[1]) * 1e-6, "pan 0 must be left only");
    assert.ok(energy(R[1]) < energy(R[2]) * 1e-6, "pan 1 must be right only");
    if (name !== "ATMOS") assert.ok(rel(energy(M[1]), energy(M[2])) < 1e-4, "centre must be balanced (±0.0004 dB)");
  });
}

test("main patch: the trig list order matches the voice input order", () => {
  const main = JSON.parse(fs.readFileSync(path.join(MAXDIR, "noiz_main.maxpat"), "utf8"));
  const texts = main.patcher.boxes.map((b) => b.box.text || "");
  const unp = texts.find((t) => t.startsWith("unpack 0 "));
  const pipe = texts.find((t) => t.startsWith("pipe "));
  assert.strictEqual(unp.split(" ").length - 1, 11); // track + 9 voice values + delay
  assert.strictEqual(pipe.split(" ").length - 1, 11);
  const m = C.noizEventToTrigger({ trackId: 0, velocity: 1, levelDb: 0, pan: 0.2, synth: C.NOIZ_DEFAULT_SYNTH[0], sound: C.NOIZ_DEFAULT_SOUND[0] });
  assert.strictEqual(m.length - 1, FIELDS.length); // minus track
});
