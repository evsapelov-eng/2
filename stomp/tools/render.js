// Offline render of the real engine (gen/stomp.genexpr via tools/genexpr.js) — every panel preset,
// 4 hits at 125 BPM on C1 → renders/stomp_demo.wav + a few numbers per preset. NOT Max.
"use strict";
const fs = require("fs"), path = require("path");
const { GenPatch } = require("./genexpr");
const { boot } = require("./preview");
const SR = 48000, SRC = fs.readFileSync(path.join(__dirname, "..", "gen", "stomp.genexpr"), "utf8");
function presetValues(i) {   // what the panel sends for preset i
  const ui = boot(); ui.out.length = 0; ui.ctx.loadPreset(i);
  const o = {}; for (const [, n, v] of ui.out) o[n] = v; return { name: ui.ctx.presetName, vals: o, count: ui.ctx.PRESETS.length };
}
function renderHits(vals, hits, beat, note = 36, vel = 1) {
  const g = new GenPatch(SRC, { sr: SR, seed: 3 });
  for (const [k, v] of Object.entries(vals)) g.set(k, v);
  g.run(64);
  const L = [], R = [];
  for (let h = 0; h < hits; h++) {
    g.set("knote", note); g.set("kvel", vel); g.set("ktrig", h + 1);
    const o = g.run(Math.round(beat * SR));
    L.push(o[0]); R.push(o[1]);
  }
  const cat = (a) => { const n = a.reduce((s, x) => s + x.length, 0), r = new Float64Array(n); let k = 0; for (const x of a) { r.set(x, k); k += x.length; } return r; };
  return [cat(L), cat(R)];
}
function wav(file, L, R) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 4, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
  fs.writeFileSync(file, b);
}
module.exports = { presetValues, renderHits, SR };
if (require.main === module) {
  const allL = [], allR = [], n = presetValues(0).count;
  for (let i = 0; i < n; i++) {
    const p = presetValues(i), [L, R] = renderHits(p.vals, 4, 0.48);
    let pk = 0; for (const v of L) pk = Math.max(pk, Math.abs(v));
    console.log(p.name.padEnd(9), "peak", pk.toFixed(2));
    allL.push(L); allR.push(R);
  }
  const cat = (a) => Float64Array.from([].concat(...a.map((x) => Array.from(x))));
  const out = path.join(__dirname, "..", "renders", "stomp_demo.wav");
  wav(out, cat(allL), cat(allR));
  console.log("wrote", path.relative(process.cwd(), out));
}
