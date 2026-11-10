#!/usr/bin/env node
// Offline REFERENCE MODEL of the NØIZ voice graphs (spec/dsp_map.json) + the real
// core scheduler. Produces WAV files to audition and a metrics report that checks
// "no empty knobs" (A05 proxy) and "four different timbres" (A04 proxy).
//
// This is NOT Max/MSP output. svf~/pink~/noise~ in Max differ in detail; the
// report only shows that the mapping itself is audible and monotonic.
// Final judgement: listening in Live (spec §07, P2 Done).
"use strict";
const fs = require("fs");
const path = require("path");
const { loadCore } = require("../js/node_loader");

const ROOT = path.join(__dirname, "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "spec", "dsp_map.json"), "utf8"));
const SR = MAP.sampleRate;
const OUT = path.join(ROOT, "renders");
const NAMES = ["HISS", "DUST", "METAL", "ATMOS"];
const C = loadCore();

// ---------- DSP primitives ----------
function makeNoise(seed) {
  const r = new C.NoizRng(seed);
  return () => r.next() * 2 - 1;
}
function makePink(white) { // Paul Kellet's refined method
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = white();
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    return p * 0.11;
  };
}
function makeSvf(freq, res) { // TPT state-variable filter; res 0..1 like svf~
  const g = Math.tan(Math.PI * Math.min(freq, SR * 0.45) / SR);
  const k = 2 * (1 - Math.min(res, 0.98));
  const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
  let ic1 = 0, ic2 = 0;
  return (x) => {
    const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    return { lp: v2, bp: v1, hp: x - k * v1 - v2 };
  };
}
const expMap = (range, x) => range[0] * Math.pow(range[1] / range[0], x);

// One hit of one voice → {L, R}. Mirrors the Max voice patch graph.
// snd: tone decay texture drive (pan unused here: per-hit pan comes in `pan`), sy: reso attack character
function renderHit(voiceName, snd, sy, amp, pan, seed) {
  const v = MAP.voices[voiceName];
  const CH = MAP.character[voiceName];
  const decayMs = Math.max(MAP.envelope.minDecayMs, expMap(v.decayMs, snd.decay));
  const attMs = expMap(MAP.envelope.attackMs, sy.attack);
  const q = MAP.reso.q[0] + (MAP.reso.q[1] - MAP.reso.q[0]) * sy.reso;
  const n = Math.ceil(((attMs + decayMs) / 1000) * SR) + 64;
  const out = [new Float32Array(n), new Float32Array(n)];
  const chans = v.stereo.startsWith("decorrelated") ? 2 : 1;
  const tex = snd.texture, T = MAP.texture, c = sy.character;
  const g = 1 + snd.drive * MAP.drive.gainMax, comp = Math.pow(g, -(+process.env.NOIZ_COMP_EXP || MAP.drive.compExp));
  const f = expMap(v.toneHz, snd.tone);
  const isDust = voiceName === "DUST";
  const ratioK = voiceName === "METAL" ? CH.range[0] + (CH.range[1] - CH.range[0]) * c : 1;
  for (let ch = 0; ch < chans; ch++) {
    const white = makeNoise(seed * 2 + ch + 1), pink = makePink(makeNoise(seed * 7 + ch + 3));
    const crk = makeNoise(seed * 13 + ch + 5), crkAmp = makeNoise(seed * 17 + ch + 9);
    const filt = makeSvf(voiceName === "METAL" ? f * v.noiseBpRatio : f, voiceName === "METAL" ? 0.7 : q);
    const dens = isDust ? CH.dens[0] + (CH.dens[1] - CH.dens[0]) * c : T.crackleMaxDensity * tex;
    const noiseG = isDust ? 1 - CH.noiseCut * c : 1;
    const color = voiceName === "METAL" ? makeSvf(f * v.noiseBpRatio, q) : null;
    const ph = (v.partialRatios || []).map(() => 0);
    const sig = out[ch];
    for (let i = 0; i < n; i++) {
      const tMs = (i / SR) * 1000;
      const lin = tMs < attMs ? tMs / attMs : Math.max(0, 1 - (tMs - attMs) / decayMs);
      const env = amp * lin * lin;
      if (env <= 0 && tMs > attMs) break;
      let src = ((1 - tex) * white() * T.whiteGain + tex * pink() * T.pinkGain) * noiseG;
      if (v.crackleGain > 0 && Math.abs(crk()) > 1 - dens) src += crkAmp() * v.crackleGain;
      const fo = filt(src);
      let x = v.filter === "hp" ? fo.hp : v.filter === "lp" ? fo.lp : fo.bp;
      if (voiceName === "HISS") x = (1 - c) * fo.hp + c * fo.bp * CH.bpGain;
      if (voiceName === "METAL") {
        let part = 0;
        for (let p = 0; p < ph.length; p++) {
          ph[p] += (2 * Math.PI * f * (1 + (v.partialRatios[p] - 1) * ratioK)) / SR;
          part += Math.sin(ph[p]) * v.partialGains[p];
        }
        x = (1 - tex) * part + tex * x * 2.5;
        const k = sy.reso * MAP.metalColor.gain;
        x = (x + color(x).bp * k) / (1 + MAP.metalColor.norm * k);
      }
      sig[i] = Math.tanh(g * x * env * v.outGain) * comp;
    }
  }
  let L = out[0], R = chans === 2 ? out[1] : out[0];
  if (chans === 2) { // ATMOS WIDTH: R = (1-w)L + wR
    const R2 = new Float32Array(n);
    for (let i = 0; i < n; i++) R2[i] = (1 - c) * L[i] + c * R[i];
    R = R2;
  }
  const gl = Math.SQRT2 * Math.cos((pan * Math.PI) / 2), gr = Math.SQRT2 * Math.sin((pan * Math.PI) / 2);
  const Lo = new Float32Array(n), Ro = new Float32Array(n);
  for (let i = 0; i < n; i++) { Lo[i] = L[i] * gl; Ro[i] = R[i] * gr; }
  return { L: Lo, R: Ro };
}

// ---------- analysis ----------
function fftMag(sig) {
  let N = 1; while (N < sig.length) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < sig.length; i++) re[i] = sig[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / sig.length));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai; re[i + k] += ar; im[i + k] += ai;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  const mag = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return { mag, N };
}
function centroidHz(sig) {
  const { mag, N } = fftMag(sig.subarray(0, Math.min(sig.length, 8192)));
  let num = 0, den = 0;
  for (let i = 1; i < mag.length; i++) { const p = mag[i] * mag[i]; num += p * (i * SR) / N; den += p; }
  return den > 0 ? num / den : 0;
}
function rmsDb(sig) { let s = 0; for (const x of sig) s += x * x; return 10 * Math.log10(s / sig.length + 1e-20); }
function peak(sig) { let p = 0; for (const x of sig) p = Math.max(p, Math.abs(x)); return p; }
function decayTimeMs(sig, dropDb = 40) {
  const w = Math.round(SR * 0.002); const env = [];
  for (let i = 0; i + w <= sig.length; i += w) { let s = 0; for (let j = 0; j < w; j++) s += sig[i + j] ** 2; env.push(Math.sqrt(s / w)); }
  const pk = Math.max(...env), thr = pk * Math.pow(10, -dropDb / 20);
  let last = 0; env.forEach((e, i) => { if (e >= thr) last = i; });
  return ((last + 1) * w * 1000) / SR;
}
function crest(sig) { const r = Math.sqrt(sig.reduce((a, x) => a + x * x, 0) / sig.length); return 20 * Math.log10(peak(sig) / (r + 1e-12)); }
function flatness(sig) {
  const { mag } = fftMag(sig.subarray(0, Math.min(sig.length, 8192)));
  let lg = 0, ar = 0, n = 0;
  for (let i = 4; i < mag.length; i++) { const p = mag[i] * mag[i] + 1e-20; lg += Math.log(p); ar += p; n++; }
  return Math.exp(lg / n) / (ar / n);
}

// ---------- WAV ----------
function writeWav(file, L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}
function mixInto(L, R, hit, at, gain = 1) {
  for (let i = 0; i < hit.L.length && at + i < L.length; i++) { L[at + i] += hit.L[i] * gain; R[at + i] += hit.R[i] * gain; }
}
const master = (x) => Math.tanh(x * MAP.master.drive) * MAP.master.ceiling;

// ---------- main ----------
const defTracks = C.noizDefaultState().tracks;
const defaults = defTracks.map((t) => t.sound);
const defSynth = defTracks.map((t) => t.synth);
const report = { model: "offline reference of spec/dsp_map.json (not Max output)", sampleRate: SR, voices: {}, checks: [] };
const steps = [0, 0.25, 0.5, 0.75, 1];
fs.mkdirSync(OUT, { recursive: true });

NAMES.forEach((name, vi) => {
  const r = { default: {}, sweeps: {} };
  const d = renderHit(name, defaults[vi], defSynth[vi], 1, 0.5, 100 + vi);
  r.default = { centroidHz: Math.round(centroidHz(d.L)), decayMs: Math.round(decayTimeMs(d.L)), rmsDb: +rmsDb(d.L.subarray(0, Math.round(SR * 0.05))).toFixed(1), peak: +peak(d.L).toFixed(3), flatness: +flatness(d.L).toFixed(3) };
  const params = ["tone", "decay", "texture", "drive", "reso", "attack", "character"];
  for (const macro of params) {
    const gap = Math.round(SR * 0.15), seg = Math.round(SR * 1.3);
    const L = new Float32Array(seg * steps.length), R = new Float32Array(seg * steps.length);
    const m = [];
    steps.forEach((x, k) => {
      const isSynth = C.NOIZ_SYNTH.includes(macro);
      const snd = isSynth ? defaults[vi] : Object.assign({}, defaults[vi], { [macro]: x });
      const sy = isSynth ? Object.assign({}, defSynth[vi], { [macro]: x }) : defSynth[vi];
      const h = renderHit(name, snd, sy, 1, 0.5, 200 + vi * 10); // same noise: only the parameter changes
      mixInto(L, R, h, k * seg + gap);
      const sig = h.L;
      const ar = h.R;
      let etot = 0; for (let i = 0; i < sig.length; i++) etot += sig[i] * sig[i];
      let acc = 0, pkI = 0; for (let i = 0; i < sig.length; i++) { acc += sig[i] * sig[i]; if (acc >= etot * 0.1) { pkI = i; break; } }
      let cor = 0, ea = 0, eb = 0; for (let i = 0; i < sig.length; i++) { cor += sig[i] * ar[i]; ea += sig[i] ** 2; eb += ar[i] ** 2; }
      m.push({ value: x, centroidHz: Math.round(centroidHz(sig)), decayMs: Math.round(decayTimeMs(sig)), rmsDb: +rmsDb(sig.subarray(0, Math.min(sig.length, Math.round(SR * 0.03)))).toFixed(1), crestDb: +crest(sig.subarray(0, Math.min(sig.length, Math.round(SR * 0.08)))).toFixed(1), flatness: +flatness(sig).toFixed(3), peak: +peak(sig).toFixed(3), peakMs: +((pkI / SR) * 1000).toFixed(1), lrCorr: +(cor / Math.sqrt(ea * eb + 1e-20)).toFixed(3) });
    });
    writeWav(path.join(OUT, `sweep_${name}_${macro}.wav`), L.map(master), R.map(master));
    r.sweeps[macro] = m;
  }
  // pan sweep: L/R energy ratio
  r.pan = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const h = renderHit(name, defaults[vi], defSynth[vi], 1, p, 300 + vi);
    const el = h.L.reduce((a, x) => a + x * x, 0), er = h.R.reduce((a, x) => a + x * x, 0);
    return { pan: p, lrDb: +(10 * Math.log10((el + 1e-20) / (er + 1e-20))).toFixed(1) };
  });
  writeWav(path.join(OUT, `oneshot_${name}.wav`), d.L.map(master), d.R.map(master));
  report.voices[name] = r;
});

// ---------- checks (A04 / A05 proxies) ----------
const check = (id, ok, detail) => report.checks.push({ id, pass: !!ok, detail });
const mono = (arr, key, dir = 1) => arr.every((x, i) => i === 0 || (x[key] - arr[i - 1][key]) * dir > 0);
NAMES.forEach((n) => {
  const s = report.voices[n].sweeps;
  check(`${n} TONE brighter monotonic`, mono(s.tone, "centroidHz"), s.tone.map((x) => x.centroidHz).join(" → ") + " Hz");
  check(`${n} DECAY longer monotonic`, mono(s.decay, "decayMs"), s.decay.map((x) => x.decayMs).join(" → ") + " ms");
  const flat = s.texture.map((x) => x.flatness), cr = s.texture.map((x) => x.crestDb), ce = s.texture.map((x) => x.centroidHz);
  const texDelta = Math.max(Math.abs(flat[4] - flat[0]) / Math.max(flat[0], flat[4], 1e-6), Math.abs(cr[4] - cr[0]) / 6, Math.abs(Math.log2((ce[4] + 1) / (ce[0] + 1))));
  check(`${n} TEXTURE audible change`, texDelta > 0.25, `flatness ${flat.join("/")}, crest ${cr.join("/")} dB, centroid ${ce.join("/")} Hz`);
  const dr = s.drive.map((x) => x.rmsDb), crd = s.drive.map((x) => x.crestDb);
  check(`${n} DRIVE saturates (crest drops)`, crd[4] < crd[0] - 1.5, `crest ${crd.join(" → ")} dB`);
  check(`${n} DRIVE level stable (±3 dB)`, Math.max(...dr) - Math.min(...dr) <= 6, `RMS ${dr.join(" / ")} dB`);
});
NAMES.forEach((n) => {
  const s = report.voices[n].sweeps;
  const rs = s.reso.map((x) => x.flatness), rc = s.reso.map((x) => x.crestDb);
  check(`${n} RESO audible change`, Math.abs(rs[4] - rs[0]) / Math.max(rs[0], rs[4], 1e-6) > 0.25 || Math.abs(rc[4] - rc[0]) > 1.5 || Math.abs(Math.log2((s.reso[4].centroidHz + 1) / (s.reso[0].centroidHz + 1))) > 0.25, `flatness ${rs.join("/")}, crest ${rc.join("/")} dB`);
  check(`${n} ATTACK slower monotonic`, s.attack[4].peakMs > s.attack[0].peakMs + 15 && s.attack.every((x, i) => i === 0 || x.peakMs >= s.attack[i - 1].peakMs - 1), "10% energy at " + s.attack.map((x) => x.peakMs).join(" → ") + " ms");
  const ch = s.character;
  const chDelta = n === "ATMOS" ? Math.abs(ch[4].lrCorr - ch[0].lrCorr) : Math.max(Math.abs(Math.log2((ch[4].centroidHz + 1) / (ch[0].centroidHz + 1))), Math.abs(ch[4].crestDb - ch[0].crestDb) / 6, Math.abs(ch[4].flatness - ch[0].flatness) / Math.max(ch[0].flatness, ch[4].flatness, 1e-6));
  check(`${n} CHARACTER (${MAP.character[n].label}) audible change`, chDelta > 0.25, n === "ATMOS" ? "L/R correlation " + ch.map((x) => x.lrCorr).join(" → ") : `centroid ${ch.map((x) => x.centroidHz).join("/")} Hz, crest ${ch.map((x) => x.crestDb).join("/")} dB, flatness ${ch.map((x) => x.flatness).join("/")}`);
  const pn = report.voices[n].pan;
  check(`${n} PAN left→right`, pn[0].lrDb > 20 && pn[4].lrDb < -20 && Math.abs(pn[2].lrDb) < 1.5, pn.map((x) => x.lrDb).join(" / ") + " dB (L−R)");
});
const cents = NAMES.map((n) => report.voices[n].default.centroidHz), decs = NAMES.map((n) => report.voices[n].default.decayMs);
const flats = NAMES.map((n) => report.voices[n].default.flatness);
check("A04 proxy: four distinct timbres (centroid, decay or spectral flatness differ ≥ 25% pairwise)",
  NAMES.every((a, i) => NAMES.every((b, j) => i >= j || Math.abs(Math.log(cents[i] / cents[j])) > 0.22 || Math.abs(Math.log(decs[i] / decs[j])) > 0.22 || Math.abs(Math.log((flats[i] + 1e-4) / (flats[j] + 1e-4))) > 0.4)),
  NAMES.map((n, i) => `${n}: ${cents[i]} Hz, ${decs[i]} ms, flatness ${flats[i]}`).join("; "));

// ---------- groove demo through the real core scheduler ----------
function renderGroove(file, bpm, sections) {
  const beatS = 60 / bpm, barS = beatS * 4;
  const total = sections.reduce((a, s) => a + s.bars, 0);
  const n = Math.ceil((total * barS + 1.5) * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  let barAt = 0, hits = 0, maxPeak = 0;
  for (const sec of sections) {
    const st = sec.state;
    const evs = C.noizEventsInRange(st, 0, sec.bars * 4, { minSpacingBeats: (12 / 60000) * bpm });
    evs.forEach((e, k) => {
      const m = C.noizEventToTrigger(e);
      const h = renderHit(NAMES[e.trackId], e.sound, e.synth, m[1], e.pan, 1000 + barAt * 97 + k);
      mixInto(L, R, h, Math.round((barAt * barS + e.beat * beatS) * SR));
      hits++;
    });
    barAt += sec.bars;
  }
  for (let i = 0; i < n; i++) { L[i] = master(L[i]); R[i] = master(R[i]); maxPeak = Math.max(maxPeak, Math.abs(L[i]), Math.abs(R[i])); }
  writeWav(file, L, R);
  return { hits, peak: +maxPeak.toFixed(3), seconds: +(n / SR).toFixed(1) };
}
const e = new C.NoizEngine();
const snap = () => ({ global: JSON.parse(JSON.stringify(e.state.global)), tracks: JSON.parse(JSON.stringify(e.state.tracks)) });
const sections = [{ bars: 4, state: snap() }];
e.generate("RHYTHM"); sections.push({ bars: 4, state: snap() });
e.keep(); e.mutate("RHYTHM", 0.15); sections.push({ bars: 4, state: snap() });
e.setGlobal("lockDensity", 0.6); e.setGlobal("lockAmount", 0.45); e.generate("PLOCKS"); sections.push({ bars: 4, state: snap() });
e.generate("SOUND"); sections.push({ bars: 4, state: snap() });
e.generate("PATTERN"); sections.push({ bars: 4, state: snap() });
report.groove = renderGroove(path.join(OUT, "demo_groove_124bpm.wav"), 124, sections);
report.groove.sections = ["default preset", "Generate RHYTHM", "Keep + Mutate 15%", "Random P-Locks incl. pan (density 0.6, amount 0.45)", "SYNTH screen Generate (sound, pan, spread, synth)", "SEQ screen Generate (rhythm + P-Locks)"];

// worst case A25 proxy: 4 voices × ratchet 8 × drive 100%
const w = C.noizDefaultState();
w.tracks.forEach((t) => { t.sound.drive = 1; t.levelDb = 0; t.steps.forEach((s, i) => { s.on = i < 16; s.ratchet = 8; s.velocity = 1; s.probability = 1; }); });
report.worstCase = renderGroove(path.join(OUT, "worstcase_4x8ratchet_drive100.wav"), 140, [{ bars: 2, state: w }]);
check("A25 proxy: worst case stays below full scale (soft safety)", report.worstCase.peak < 1, `peak ${report.worstCase.peak}`);

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
const failed = report.checks.filter((c) => !c.pass);
console.log(report.checks.map((c) => `${c.pass ? "PASS" : "FAIL"}  ${c.id} — ${c.detail}`).join("\n"));
console.log(`groove: ${JSON.stringify(report.groove)}`);
console.log(`${report.checks.length - failed.length}/${report.checks.length} checks pass`);
process.exitCode = failed.length ? 1 : 0;
