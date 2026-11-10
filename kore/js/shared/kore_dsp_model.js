// KØRE — reference model of the voice graphs (ES5). Single source used by:
//   - the jsui SOUND/compact preview (waveform + pitch-vs-time are THIS model),
//   - tools/render_voices.js (offline audio checks).
// Mirrors the Max patches built from spec/dsp_map.json; not Max output.
//
// Envelopes are linear ramps in dB → amplitude (exactly exponential), like
// [line~] → [dbtoa~] in the patches. Pitch sweep (spec §03):
//   f(t) = f_base * 2^((semis/12) * e(t)),  e(t) = exp(-t / tau),  tau = sweepMs
//   (patch: dB ramp 0 → -60 over 6.9078·tau → dbtoa~ = exp(-t/tau))

function KoreModelRng(seed) { this.s = (seed >>> 0) || 1; }
KoreModelRng.prototype.next = function () {
  var x = this.s;
  x ^= (x << 13); x >>>= 0; x ^= (x >>> 17); x ^= (x << 5); x >>>= 0;
  this.s = x;
  return x / 4294967296;
};

function koreTanh(x) { if (x > 20) return 1; if (x < -20) return -1; var e = Math.exp(2 * x); return (e - 1) / (e + 1); }
function koreExpMap(r, x) { return r[0] * Math.pow(r[1] / r[0], x); }
function koreDbToA(db) { return Math.pow(10, db / 20); }

function koreSvf(freq, res, sr) {
  var g = Math.tan(Math.PI * Math.min(Math.max(freq, 1), sr * 0.45) / sr);
  var k = 2 * (1 - Math.min(res, 0.98));
  var a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
  var st = { ic1: 0, ic2: 0, lp: 0, bp: 0, hp: 0 };
  st.tick = function (x) {
    var v3 = x - st.ic2, v1 = a1 * st.ic1 + a2 * v3, v2 = st.ic2 + a2 * st.ic1 + a3 * v3;
    st.ic1 = 2 * v1 - st.ic1; st.ic2 = 2 * v2 - st.ic2;
    st.lp = v2; st.bp = v1; st.hp = x - k * v1 - v2;
  };
  return st;
}

// Physical values of a parameter set (labels, checks and the patch exprs agree on these).
function koreModelInfo(map, voice, p) {
  var v = map.voices[voice], info = {};
  if (v.tuneHz) info.tuneHz = koreExpMap(v.tuneHz, p.tune);
  if (v.decayMs) info.decayMs = koreExpMap(v.decayMs, p.decay);
  if (voice === "PUNCH") {
    info.sweepSemis = v.sweepSemis[0] + (v.sweepSemis[1] - v.sweepSemis[0]) * p.punch;
    info.sweepMs = Math.max(v.sweepMs.min, v.sweepMs.a - v.sweepMs.b * p.punch);
    info.startHz = info.tuneHz * Math.pow(2, info.sweepSemis / 12);
  } else if (voice === "SUB" || voice === "TOM L" || voice === "TOM H") {
    info.sweepSemis = v.sweepSemis; info.sweepMs = v.sweepMs;
    info.startHz = info.tuneHz * Math.pow(2, info.sweepSemis / 12);
  }
  if (voice === "HAT") {
    info.toneHz = koreExpMap(v.toneHz, p.tone);
    if (p.open) info.decayMs = info.decayMs * v.openFactor;
  }
  if (voice === "TOM L" || voice === "TOM H") info.q = v.q[0] + (v.q[1] - v.q[0]) * p.tone;
  if (voice === "RUMBLE") {
    info.tailMs = koreExpMap(v.tailMs, p.tail);
    var avg = (v.tapsMs[0] + v.tapsMs[1]) / 2;
    info.feedback = Math.min(v.fbMax, Math.pow(10, -3 * avg / info.tailMs));
  }
  return info;
}

// Exponential envelope in dB: rises to 0 dB in attackMs, falls to floorDb over decayMs,
// then a short linear gate fade (frees the poly~ instance).
function koreEnv(tMs, attackMs, decayMs, floorDb, fadeMs) {
  var db;
  if (tMs < attackMs) db = floorDb * (1 - tMs / attackMs);
  else db = floorDb * Math.min(1, (tMs - attackMs) / decayMs);
  var gate = 1, end = attackMs + decayMs;
  if (tMs > end) gate = Math.max(0, 1 - (tMs - end) / fadeMs);
  return koreDbToA(db) * gate;
}
var KORE_TAU_TO_60DB = 6.907755; // ln(1000): exp(-t/tau) reaches -60 dB at 6.9·tau
function koreSweep(tMs, tau) { return koreDbToA(-60 * tMs / (tau * KORE_TAU_TO_60DB)); } // = exp(-t/tau)

// One hit. p: normalized params + amp (+ open for HAT). Returns {L:[], pitch:[], info, sr}
// (mono voices: L only; pitch[] = instantaneous body frequency in Hz, for the graph).
function koreModelHit(map, voice, p, sr, maxMs, seed) {
  var v = map.voices[voice], E = map.envelope, D = map.drive;
  var info = koreModelInfo(map, voice, p);
  var amp = p.amp === undefined ? 1 : p.amp;
  var total = E.attackMs + info.decayMs + E.gateFadeMs;
  var n = Math.ceil(Math.min(total, maxMs || total) / 1000 * sr) + 8;
  var rnd = new KoreModelRng((seed || 1) * 2654435761);
  var out = [], pitch = [], ph = 0, i, tMs;
  if (voice === "PUNCH" || voice === "SUB") {
    var g = 1 + (voice === "PUNCH" ? p.drive : 0) * D.gainMax, comp = Math.pow(g, -D.compExp);
    var hp = koreSvf(v.clickHpHz || 3000, 0.3, sr);
    for (i = 0; i < n; i++) {
      tMs = i / sr * 1000;
      var f = info.tuneHz * Math.pow(2, info.sweepSemis / 12 * koreSweep(tMs, info.sweepMs));
      pitch.push(f);
      ph += f / sr;
      var body = Math.sin(2 * Math.PI * ph) * koreEnv(tMs, E.attackMs, info.decayMs, E.floorDb, E.gateFadeMs);
      var click = 0;
      if (voice === "PUNCH") {
        hp.tick(rnd.next() * 2 - 1);
        click = hp.hp * Math.max(0, 1 - tMs / v.clickMs) * v.clickGain * p.click;
      }
      out.push(koreTanh(g * (body + click) * v.outGain) * comp * amp);
    }
  } else if (voice === "TOM L" || voice === "TOM H") {
    var bp = koreSvf(info.tuneHz * v.noiseBpRatio, info.q, sr);
    for (i = 0; i < n; i++) {
      tMs = i / sr * 1000;
      var ft = info.tuneHz * Math.pow(2, info.sweepSemis / 12 * koreSweep(tMs, info.sweepMs));
      pitch.push(ft);
      ph += ft / sr;
      bp.tick(rnd.next() * 2 - 1);
      var env = koreEnv(tMs, E.attackMs, info.decayMs, E.floorDb, E.gateFadeMs);
      var x = (Math.sin(2 * Math.PI * ph) * (1 - 0.6 * p.tone) + bp.bp * v.noiseGain * p.tone) * env;
      out.push(x * v.outGain * amp);
    }
  } else if (voice === "HAT") {
    var hh = koreSvf(info.toneHz, v.q, sr);
    for (i = 0; i < n; i++) {
      tMs = i / sr * 1000;
      hh.tick(rnd.next() * 2 - 1);
      out.push(hh.hp * koreEnv(tMs, 0.3, info.decayMs, E.floorDb, E.gateFadeMs) * v.outGain * amp);
      pitch.push(info.toneHz);
    }
  }
  return { L: out, pitch: pitch, info: info, sr: sr };
}

// RUMBLE response to one PUNCH hit (bus FX): lowpass → 2-tap feedback delay, gated
// by the RUMBLE step, ducked when PUNCH hits (here: the exciting hit itself).
function koreModelRumble(map, punchP, rp, sr, ms, seed) {
  var v = map.voices.RUMBLE, info = koreModelInfo(map, "RUMBLE", rp);
  var kick = koreModelHit(map, "PUNCH", punchP, sr, ms, seed).L;
  var n = Math.ceil(ms / 1000 * sr);
  var lp = koreSvf(v.lowpassHz, v.lowpassQ, sr);
  var buf = [], out = [], d1 = Math.round(v.tapsMs[0] / 1000 * sr), d2 = Math.round(v.tapsMs[1] / 1000 * sr);
  for (var i = 0; i < n; i++) {
    var tMs = i / sr * 1000;
    lp.tick(kick[i] || 0);
    var taps = 0.5 * ((buf[i - d1] || 0) + (buf[i - d2] || 0));
    buf.push(lp.lp + taps * info.feedback);
    var duck = 1 - rp.duck * Math.max(0, tMs < v.duckAttackMs ? tMs / v.duckAttackMs : 1 - (tMs - v.duckAttackMs) / v.duckReleaseMs);
    var gate = Math.min(1, tMs / v.gateAttackMs) * (tMs < info.tailMs ? 1 : Math.max(0, 1 - (tMs - info.tailMs) / info.tailMs));
    out.push(taps * gate * duck * rp.amount * v.wetGain);
  }
  return { L: out, info: info, sr: sr, kick: kick };
}

// Magnitude in `bands` log bands 20 Hz .. sr/2 of a window (for the spectrum view).
function koreModelSpectrum(sig, sr, start, size, bands) {
  var N = size, re = [], im = [], i, j = 0;
  for (i = 0; i < N; i++) { re.push((sig[start + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)))); im.push(0); }
  for (i = 1; i < N; i++) {
    var bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { var tr = re[i]; re[i] = re[j]; re[j] = tr; var ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (var len = 2; len <= N; len <<= 1) {
    var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (var a = 0; a < N; a += len) {
      var cr = 1, ci = 0;
      for (var k = 0; k < len / 2; k++) {
        var u = a + k, w = a + k + len / 2;
        var xr = re[w] * cr - im[w] * ci, xi = re[w] * ci + im[w] * cr;
        re[w] = re[u] - xr; im[w] = im[u] - xi; re[u] += xr; im[u] += xi;
        var t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  var out = [], fmin = 20, fmax = sr / 2;
  for (var b = 0; b < bands; b++) {
    var f0 = fmin * Math.pow(fmax / fmin, b / bands), f1 = fmin * Math.pow(fmax / fmin, (b + 1) / bands);
    var k0 = Math.max(1, Math.floor(f0 * N / sr)), k1 = Math.max(k0 + 1, Math.ceil(f1 * N / sr)), e = 0;
    for (var q = k0; q < k1 && q < N / 2; q++) e = Math.max(e, re[q] * re[q] + im[q] * im[q]);
    out.push(e);
  }
  return out;
}
