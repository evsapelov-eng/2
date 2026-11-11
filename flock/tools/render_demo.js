#!/usr/bin/env node
// Offline demo: the REAL gen~ code (gen/flock.genexpr) run by tools/genexpr.js on a synthetic
// source (plucked arpeggio + a little noise), through several settings. NOT a Max recording.
"use strict";
const fs = require("fs");
const path = require("path");
const { GenPatch } = require("./genexpr");
const ROOT = path.join(__dirname, "..");
const SR = 48000;
const src = fs.readFileSync(path.join(ROOT, "gen", "flock.genexpr"), "utf8");

function source(n) {
  const L = new Float64Array(n), R = new Float64Array(n);
  const notes = [57, 60, 64, 67, 69, 72, 64, 60];
  const step = Math.round(SR * 0.25);
  for (let s = 0; s * step < n; s++) {
    const f = 440 * Math.pow(2, (notes[s % notes.length] - 69) / 12);
    for (let i = 0; i < step * 2 && s * step + i < n; i++) {
      const t = i / SR, e = Math.exp(-t * 6);
      const v = 0.35 * e * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t));
      L[s * step + i] += v; R[s * step + i] += v * 0.9;
    }
  }
  return [L, R];
}
function writeWav(file, L, R) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 4, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, b);
}
// [label, seconds, params]
const scenes = [
  ["dry source", 4, { drywet: 0, density: 0.5 }],
  ["cloud: even grains, +12 st, long smooth", 6, { drywet: 0.8, density: 0.15, size: 0.62, shape: 0.6, pitch: (5.15 / 6 + 1) / 2, time: 0.1, reverb: 0.4 }],
  ["random rate, pitch spread, reverse grains", 6, { drywet: 0.9, density: 0.75, size: 0.2, shape: 0.7, pitch_amt: 0.85, time: 0.2, time_amt: 0.8, reverb: 0.5 }],
  ["freeze + dense texture, feedback", 7, { drywet: 1, density: 0.05, size: 0.7, shape: 0.55, time: 0.3, time_amt: 0.9, pitch: (-4.15 / 6 + 1) / 2, feedback: 0.5, reverb: 0.6, freeze: 1 }],
  ["stutter: square short grains", 5, { drywet: 0.9, density: 0.3, size: 0.42, shape: 0.0, time: 0.05, reverb: 0.2 }],
  // ---- v0.2 MOD (120 BPM from "Live")
  ["MOD: CLOCK 1/16 -> SEED (LATCH off), grains on sixteenths", 6, { drywet: 0.9, seedlatch: 0, density: 0.5, dst_seed: 5, ck_sync: 1, ck_rate: 12 / 14, size: 0.42, shape: 0.2, time: 0.05, reverb: 0.25 }],
  ["MOD: CLOCK 1/16 -> SEED, LATCH on, DENSITY divides", 4, { drywet: 0.9, seedlatch: 1, density: 0.3, dst_seed: 5, ck_sync: 1, ck_rate: 12 / 14, size: 0.45, shape: 0.2, time: 0.05, reverb: 0.25 }],
  ["MOD: SEQ -> SEED + SEQ -> TIME on a FROZEN buffer = slicer", 8, { drywet: 1, seedlatch: 0, density: 0.5, dst_seed: 6, dst_time: 6, time: 0, time_amt: 1, size: 0.45, shape: 0.15, freeze: 1, reverb: 0.15,
    sq0: 0.05, sq1: -1, sq2: 0.3, sq3: 0.12, sq4: 0.5, sq5: -1, sq6: 0.3, sq7: -1, sq8: 0.7, sq9: 0.05, sq10: -1, sq11: 0.85, sq12: 0.3, sq13: -1, sq14: 0.12, sq15: 0.6 }],
  ["MOD: LFO 1 (synced 1 bar) -> PITCH, RANDOM -> REVERB", 7, { drywet: 0.85, seedlatch: 1, density: 0.12, size: 0.6, shape: 0.6, time: 0.08, pitch_amt: 0.95, dst_pitch: 1, l1_sync: 1, l1_rate: 3 / 14, dst_reverb: 3, rn_rate: 0.45, reverb: 0.3, freeze: 0 }],
];
const g = new GenPatch(src, { sr: SR, seed: 3 });
const total = scenes.reduce((a, s) => a + s[1], 0) * SR;
const [inL, inR] = source(total);
const outL = new Float64Array(total), outR = new Float64Array(total);
let at = 0;
const BAR = Math.round(SR * 2);   // 120 BPM
const phase = Float64Array.from({ length: total }, (_, i) => (i / BAR) % 1);
const z = new Float64Array(total);
const base = { dst_seed: 0, dst_time: 0, dst_pitch: 0, dst_reverb: 0, seedlatch: 1, time: 0.5, density: 0.3, pitch: 0.5, size: 0.45, shape: 0.5, time_amt: 0.5, pitch_amt: 0.5, size_amt: 0.5, shape_amt: 0.5, feedback: 0, drywet: 0.5, reverb: 0.2, freeze: 0 };
for (const [label, sec, prm] of scenes) {
  for (const [k, v] of Object.entries(Object.assign({}, base, prm))) g.set(k, v);
  const n = sec * SR, o = g.run(n, [inL.subarray(at, at + n), inR.subarray(at, at + n), z, z, z, z, phase.subarray(at, at + n)]);
  outL.set(o[0], at); outR.set(o[1], at);
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(o[0][i]), Math.abs(o[1][i]));
  console.log(`${String(at / SR).padStart(3)} s  ${label}  (peak ${(20 * Math.log10(pk + 1e-9)).toFixed(1)} dBFS)`);
  at += n;
}
fs.mkdirSync(path.join(ROOT, "renders"), { recursive: true });
writeWav(path.join(ROOT, "renders", "flock_demo.wav"), outL, outR);
console.log("renders/flock_demo.wav");
