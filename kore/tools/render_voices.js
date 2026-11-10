#!/usr/bin/env node
// Offline REFERENCE render of KØRE: shared voice model (js/shared/kore_dsp_model.js) driven
// by the real core scheduler, with the low-end coordinator (SUB/RUMBLE duck on PUNCH),
// DC block and soft safety like the main patch. NOT Max output — the final judgement is
// listening in Live. Writes renders/*.wav and renders/report.json.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadCore } = require("../js/node_loader");

const ROOT = path.join(__dirname, "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "spec", "dsp_map.json"), "utf8"));
const M = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "shared", "kore_dsp_model.js"), "utf8"), M);
const C = loadCore();
const SR = 48000, OUT = path.join(ROOT, "renders");
fs.mkdirSync(OUT, { recursive: true });

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

// Renders a pattern (array of {bars, state}) at bpm through the whole chain.
function renderGroove(sections, bpm) {
  const beatS = 60 / bpm, total = sections.reduce((a, s) => a + s.bars, 0);
  const n = Math.ceil((total * 4 * beatS + 1.5) * SR);
  const bus = { punch: new Float64Array(n), sub: new Float64Array(n), other: new Float64Array(n), rumbleIn: new Float64Array(n) };
  const punchHits = [], rumbleEvents = [];
  let barAt = 0, hits = 0;
  for (const sec of sections) {
    const evs = C.koreEventsInRange(sec.state, 0, sec.bars * 4, { minSpacingBeats: (12 / 60000) * bpm });
    for (const e of evs) {
      const at = Math.round((barAt * 4 + e.beat) * beatS * SR);
      const m = C.koreEventToTrigger(e), name = C.KORE_TRACK_NAMES[e.trackId];
      hits++;
      if (name === "RUMBLE") { rumbleEvents.push({ at, p: e.params }); continue; }
      const p = Object.assign({ amp: m[1], open: e.open }, e.params);
      const h = M.koreModelHit(MAP, name, p, SR, 0, 1000 + hits).L;
      const dst = name === "PUNCH" ? bus.punch : name === "SUB" ? bus.sub : bus.other;
      for (let i = 0; i < h.length && at + i < n; i++) dst[at + i] += h[i];
      if (name === "PUNCH") punchHits.push(at);
    }
    barAt += sec.bars;
  }
  // low-end coordinator: SUB duck + RUMBLE (bus FX on the PUNCH bus, gated by RUMBLE steps, ducked by PUNCH)
  const le = MAP.lowEnd, rv = MAP.voices.RUMBLE;
  const subDuck = new Float64Array(n).fill(1), rDuck = new Float64Array(n).fill(1);
  let curDuckDepth = rv.defaults.duck;
  const rEv = rumbleEvents.slice().sort((a, b) => a.at - b.at);
  let ri = 0;
  for (const at of punchHits) {
    while (ri < rEv.length && rEv[ri].at <= at) curDuckDepth = rEv[ri++].p.duck;
    for (let i = 0; i < SR * 0.3 && at + i < n; i++) {
      const tMs = i / SR * 1000;
      const sd = tMs < le.subDuckAttackMs ? 1 - le.subDuckDepth * tMs / le.subDuckAttackMs : Math.min(1, 1 - le.subDuckDepth + le.subDuckDepth * (tMs - le.subDuckAttackMs) / le.subDuckReleaseMs);
      subDuck[at + i] = Math.min(subDuck[at + i], sd);
      const rd = tMs < rv.duckAttackMs ? 1 - curDuckDepth * tMs / rv.duckAttackMs : Math.min(1, 1 - curDuckDepth + curDuckDepth * (tMs - rv.duckAttackMs) / rv.duckReleaseMs);
      rDuck[at + i] = Math.min(rDuck[at + i], rd);
    }
  }
  const rum = new Float64Array(n);
  {
    const lp = M.koreSvf(rv.lowpassHz, rv.lowpassQ, SR), buf = new Float64Array(n);
    const d1 = Math.round(rv.tapsMs[0] / 1000 * SR), d2 = Math.round(rv.tapsMs[1] / 1000 * SR);
    let gate = 0, amount = 0, fb = 0, gStart = -1, tail = 350, k = 0;
    for (let i = 0; i < n; i++) {
      while (k < rEv.length && rEv[k].at === i) {
        const info = M.koreModelInfo(MAP, "RUMBLE", rEv[k].p);
        fb = info.feedback; tail = info.tailMs; amount = rEv[k].p.amount; gStart = i; k++;
      }
      if (gStart >= 0) { const t = (i - gStart) / SR * 1000; gate = Math.min(1, t / rv.gateAttackMs) * (t < tail ? 1 : Math.max(0, 1 - (t - tail) / tail)); }
      lp.tick(bus.punch[i]);
      const taps = 0.5 * ((i >= d1 ? buf[i - d1] : 0) + (i >= d2 ? buf[i - d2] : 0));
      buf[i] = lp.lp + taps * fb;
      rum[i] = taps * gate * rDuck[i] * amount * rv.wetGain;
    }
  }
  const L = new Float32Array(n), hp = M.koreSvf(le.dcBlockHz, 0.05, SR);
  let peak = 0, lowSum = 0;
  for (let i = 0; i < n; i++) {
    const x = bus.punch[i] + bus.sub[i] * subDuck[i] + rum[i] + bus.other[i];
    hp.tick(x);
    const y = M.koreTanh(hp.hp * MAP.master.drive) * MAP.master.ceiling;
    L[i] = y; peak = Math.max(peak, Math.abs(y)); lowSum += x * x;
  }
  return { L, hits, peak, peakDb: 20 * Math.log10(peak), bus, subDuck, rum };
}

const report = { model: "offline reference (shared model + real scheduler), not Max output", checks: [] };
const check = (id, ok, detail) => report.checks.push({ id, pass: !!ok, detail });
const snap = (e) => ({ global: JSON.parse(JSON.stringify(e.state.global)), tracks: JSON.parse(JSON.stringify(e.state.tracks)) });

// 1) demo: starter preset + every style + mutate
const e = new C.KoreEngine();
const sections = [{ bars: 4, state: snap(e) }], names = ["starter preset"];
for (const st of ["FOUNDATION", "DRIVING", "HYPNOTIC", "BROKEN"]) {
  e.setGlobal("style", st); e.generate(); sections.push({ bars: 4, state: snap(e) }); names.push("GENERATE " + st);
  e.keep(); e.mutate("ALL", 0.2); sections.push({ bars: 2, state: snap(e) }); names.push("MUTATE 20%");
}
const demo = renderGroove(sections, 130);
writeWav(path.join(OUT, "kore_demo_130bpm.wav"), demo.L, demo.L);
report.demo = { seconds: +(demo.L.length / SR).toFixed(1), hits: demo.hits, peakDb: +demo.peakDb.toFixed(1), sections: names };
check("A36 proxy: demo never reaches 0 dBFS", demo.peak < 0.95, `peak ${demo.peakDb.toFixed(1)} dBFS`);

// 2) starter preset headroom (spec: ≈ -6 dBFS in the test preset)
const starter = renderGroove([{ bars: 4, state: snap(new C.KoreEngine()) }], 130);
check("starter preset peak ≈ -6 dBFS (−9 … −3)", starter.peakDb < -3 && starter.peakDb > -9.5, `${starter.peakDb.toFixed(1)} dBFS`);

// 3) A10: layered PUNCH+SUB stays controlled
const lay = new C.KoreEngine();
lay.state.tracks.forEach((t, i) => { if (i > 1) t.mute = true; });
lay.state.tracks[1].steps.forEach((s, i) => { s.on = [0, 4, 8, 12].includes(i); s.velocity = 1; });
lay.state.tracks[1].levelDb = 0; lay.state.tracks[0].levelDb = 0;
const layR = renderGroove([{ bars: 2, state: snap(lay) }], 130);
check("A10 proxy: PUNCH+SUB layered at 0 dB levels stays below full scale", layR.peak < 0.95, `${layR.peakDb.toFixed(1)} dBFS`);
// 4) A11: sub duck only around PUNCH hits
const ducked = layR.subDuck.filter((v) => v < 0.99).length / layR.subDuck.length;
check("A11 proxy: SUB duck active only briefly around PUNCH hits", ducked > 0.05 && ducked < 0.5, `${(ducked * 100).toFixed(0)}% of the time`);

// 5) worst case: 6 voices, ratchet 8, drive 100%, max levels
const w = new C.KoreEngine();
w.state.tracks.forEach((t) => { t.levelDb = 0; t.steps.forEach((s, i) => { s.on = i < 16; s.velocity = 1; s.probability = 1; s.ratchet = t.id === 0 ? 1 : 8; }); });
w.state.tracks[0].params.drive = 1; w.state.tracks[2].params.amount = 1; w.state.tracks[2].params.tail = 1;
const wr = renderGroove([{ bars: 2, state: snap(w) }], 145);
check("A36 proxy: worst case (6 voices, ratchet 8, drive 100%, rumble max) bounded", wr.peak < 0.95 && wr.L.every(Number.isFinite), `${wr.peakDb.toFixed(1)} dBFS`);
writeWav(path.join(OUT, "kore_worstcase.wav"), wr.L, wr.L);

// 6) one-shot per voice with the macro sweeps (for listening)
for (const voice of ["PUNCH", "SUB", "TOM L", "TOM H", "HAT"]) {
  const keys = MAP.voices[voice].params;
  for (const k of keys) {
    const seg = Math.round(SR * 0.9), L = new Float32Array(seg * 5);
    [0, 0.25, 0.5, 0.75, 1].forEach((x, j) => {
      const p = Object.assign({ amp: 0.8 }, MAP.voices[voice].defaults, { [k]: x });
      const h = M.koreModelHit(MAP, voice, p, SR, 850, 3).L;
      for (let i = 0; i < h.length && i < seg; i++) L[j * seg + i] = h[i];
    });
    writeWav(path.join(OUT, `sweep_${voice.replace(" ", "")}_${k}.wav`), L, L);
  }
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
const failed = report.checks.filter((c) => !c.pass);
console.log(report.checks.map((c) => `${c.pass ? "PASS" : "FAIL"}  ${c.id} — ${c.detail}`).join("\n"));
console.log(`demo: ${JSON.stringify(report.demo)}`);
console.log(`${report.checks.length - failed.length}/${report.checks.length} checks pass`);
process.exitCode = failed.length ? 1 : 0;
