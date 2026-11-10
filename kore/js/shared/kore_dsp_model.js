// KØRE — reference model of the voices (ES5). Single source used by:
//   - the engine: PUNCH is RENDERED by koreRenderKick() into a buffer~ and played
//     sample-accurately in the signal domain (every kick identical, on the grid),
//   - the jsui SOUND/compact views (waveform, pitch-vs-time, spectrum),
//   - tools/render_voices.js and the patch-vs-model tests (SUB, TOMs, HAT, RUMBLE are
//     MSP patches built from the same spec/dsp_map.json).
// Envelopes are linear ramps in dB → amplitude (exponential), like [line~]→[dbtoa~].
// Pitch glide (spec §03): f(t) = f0 * 2^((semis/12) * exp(-t/tau)).

function KoreModelRng(seed) { this.s = (seed >>> 0) || 1; }
KoreModelRng.prototype.next = function () {
  var x = this.s;
  x ^= (x << 13); x >>>= 0; x ^= (x >>> 17); x ^= (x << 5); x >>>= 0;
  this.s = x;
  return x / 4294967296;
};

function koreTanh(x) { if (x > 20) return 1; if (x < -20) return -1; var e = Math.exp(2 * x); return (e - 1) / (e + 1); }
function koreExpMap(r, x) { return r[0] * Math.pow(r[1] / r[0], x); }
function koreLin(r, x) { return r[0] + (r[1] - r[0]) * x; }
function koreDbToA(db) { return Math.pow(10, db / 20); }
var KORE_TAU_TO_60DB = 6.907755; // exp(-t/tau) reaches -60 dB at 6.9078·tau
function koreSweep(tMs, tau) { return koreDbToA(-60 * tMs / (tau * KORE_TAU_TO_60DB)); } // = exp(-t/tau)

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

// Physical values of a parameter set (labels, graphs, checks, patch exprs agree on these).
function koreModelInfo(map, voice, p) {
  var v = map.voices[voice], i = {};
  if (voice === "PUNCH") {
    i.tuneHz = koreExpMap(v.tuneHz, p.tune);
    i.sweepSemis = koreLin(v.sweepSemis, p.punch);
    i.sweepMs = koreExpMap(v.sweepTauMs, p.time);
    i.startHz = i.tuneHz * Math.pow(2, i.sweepSemis / 12);
    i.holdMs = koreLin(v.holdMs, p.body);
    i.decayMs = koreExpMap(v.decayMs, p.decay);
    i.driveGain = koreExpMap(v.driveGain, p.drive);
    i.clickHz = koreExpMap(v.clickToneHz, p.clicktone);
    i.lengthMs = 0.2 + i.holdMs + i.decayMs;
    return i;
  }
  if (v.tuneHz) i.tuneHz = koreExpMap(v.tuneHz, p.tune);
  if (v.decayMs) i.decayMs = koreExpMap(v.decayMs, p.decay);
  if (voice === "SUB") {
    i.sweepSemis = koreLin(v.sweepSemisRange, p.sweep); i.sweepMs = v.sweepMs;
    i.startHz = i.tuneHz * Math.pow(2, i.sweepSemis / 12);
    i.driveGain = koreLin(v.driveGain, p.drive);
  } else if (voice === "TOM L" || voice === "TOM H") {
    i.sweepSemis = koreLin(v.sweepSemisRange, p.sweep); i.sweepMs = v.sweepMs;
    i.startHz = i.tuneHz * Math.pow(2, i.sweepSemis / 12);
    i.driveGain = koreExpMap(v.driveGain, p.drive);
    i.clickHz = v.clickHz;
  } else if (voice === "HAT") {
    i.toneHz = koreExpMap(v.toneHz, p.tone);
    i.q = koreLin(v.q, p.reso);
    i.openFactor = koreLin(v.openFactor, p.open);
    if (p.isOpen) i.decayMs = i.decayMs * i.openFactor;
  } else if (voice === "RUMBLE") {
    i.tailMs = koreExpMap(v.tailMs, p.tail);
    var avg = (v.tapsMs[0] + v.tapsMs[1]) / 2;
    i.feedback = Math.min(v.fbMax, Math.pow(10, -3 * avg / i.tailMs));
    i.lowpassHz = koreExpMap(v.lowpassHz, p.tone);
    i.driveGain = koreExpMap(v.driveGain, p.drive);
  }
  if (i.decayMs !== undefined) i.lengthMs = map.envelope.attackMs + i.decayMs;
  return i;
}

// Exponential envelope in dB with a final short gate fade (frees poly~ instances).
function koreEnv(tMs, attackMs, decayMs, floorDb, fadeMs) {
  var db = tMs < attackMs ? floorDb * (1 - tMs / attackMs) : floorDb * Math.min(1, (tMs - attackMs) / decayMs);
  var end = attackMs + decayMs, gate = tMs > end ? Math.max(0, 1 - (tMs - end) / fadeMs) : 1;
  return koreDbToA(db) * gate;
}

// ---------- PUNCH: the rendered techno kick ----------
// body: phase-continuous sine with the exponential glide, amp = 0.2 ms rise → HOLD (BODY)
// at full level → -60 dB over DECAY (exponential); CLICK = high-passed noise burst + a
// short tick at CLICK TONE; DRIVE = tanh saturation; low cut keeps the sub tight; peak
// normalised (DRIVE adds density, not level). Deterministic: noise seeded from params.
function koreRenderKick(map, p, sr) {
  var v = map.voices.PUNCH, info = koreModelInfo(map, "PUNCH", p);
  var n = Math.ceil((info.lengthMs + 3) / 1000 * sr);
  var seed = Math.floor((p.tune * 7 + p.punch * 13 + p.click * 17 + p.clicktone * 19) * 100000) + 1;
  var rnd = new KoreModelRng(seed), hp = koreSvf(info.clickHz, 0.55, sr);
  var lowcut = 1 - Math.exp(-2 * Math.PI * v.lowCutHz / sr), lc = 0;
  var out = [], pitch = [], ph = 0, peak = 1e-9, i, tMs, g = info.driveGain, comp = Math.pow(g, -0.3);
  for (i = 0; i < n; i++) {
    tMs = i / sr * 1000;
    var f = info.tuneHz * Math.pow(2, info.sweepSemis / 12 * koreSweep(tMs, info.sweepMs));
    pitch.push(f);
    ph += f / sr;
    var amp;
    if (tMs < 0.2) amp = tMs / 0.2;
    else if (tMs < 0.2 + info.holdMs) amp = 1;
    else amp = koreDbToA(-60 * Math.min(1, (tMs - 0.2 - info.holdMs) / info.decayMs));
    if (tMs > info.lengthMs) amp *= Math.max(0, 1 - (tMs - info.lengthMs) / 2);
    var body = Math.sin(2 * Math.PI * ph) * amp;
    hp.tick(rnd.next() * 2 - 1);
    // band-passed noise centred on CLICK TONE + a tick at the same frequency
    var click = p.click * v.clickGain * (hp.bp * 2.2 * Math.exp(-tMs / v.clickTauMs) + Math.sin(2 * Math.PI * info.clickHz * tMs / 1000) * Math.exp(-tMs / v.tickTauMs));
    var x = koreTanh(g * (body + click)) * comp;
    lc += lowcut * (x - lc);             // one-pole low-pass state …
    var y = x - lc;                      // … subtracted = gentle low cut
    out.push(y);
    if (Math.abs(y) > peak) peak = Math.abs(y);
  }
  var norm = 0.95 / peak;
  for (i = 0; i < n; i++) out[i] *= norm;
  out[n - 1] = 0; // index~ past the end reads the last sample: make it silent
  return { L: out, pitch: pitch, info: info, sr: sr };
}

// ---------- HUM: the sub that hits with the kick ----------
function koreHumHz(map, p) {
  var v = map.voices.PUNCH, h = v.hum, semis = koreLin(h.pitchSemis, p.humpitch === undefined ? 0.5 : p.humpitch);
  return koreExpMap(v.tuneHz, p.tune) * Math.pow(2, semis / 12);
}
// One beat long (the kick is always 4/4): sine from phase 0 at the hit with a short glide
// borrowed from the kick's PUNCH, 1 ms attack, settles to 'sustain', fades to exactly 0
// before the next beat so the restart at the next kick is click-free. Peak 1 (level is
// applied in the player).
function koreRenderHum(map, p, sr, tempo) {
  var v = map.voices.PUNCH, h = v.hum, info = koreModelInfo(map, "PUNCH", p), hz = koreHumHz(map, p);
  var beatMs = 60000 / Math.max(20, tempo || 120), n = Math.max(16, Math.round(beatMs / 1000 * sr));
  var endMs = beatMs - h.endGapMs, fadeStart = endMs - h.fadeMs, out = [], pitch = [], ph = 0;
  for (var i = 0; i < n; i++) {
    var tMs = i / sr * 1000;
    var f = hz * Math.pow(2, info.sweepSemis * h.glideFrac / 12 * koreSweep(tMs, info.sweepMs));
    pitch.push(f); ph += f / sr;
    var a = Math.min(1, tMs / h.attackMs) * (h.sustain + (1 - h.sustain) * Math.exp(-tMs / h.settleMs));
    if (tMs >= endMs) a = 0; else if (tMs > fadeStart) a *= 0.5 + 0.5 * Math.cos(Math.PI * (tMs - fadeStart) / h.fadeMs);
    out.push(Math.sin(2 * Math.PI * (ph - f / sr)) * a);
  }
  out[n - 1] = 0;
  return { L: out, pitch: pitch, hz: hz, sr: sr };
}

// ---------- MSP voices (mirrors of the patches) ----------
// p: normalized params + amp (+ isOpen for HAT). Returns {L:[], pitch:[], info, sr}.
function koreModelHit(map, voice, p, sr, maxMs, seed) {
  if (voice === "PUNCH") {
    var k = koreRenderKick(map, p, sr), a = p.amp === undefined ? 1 : p.amp, cap = maxMs ? Math.min(k.L.length, Math.ceil(maxMs / 1000 * sr)) : k.L.length;
    var L = [];
    for (var q = 0; q < cap; q++) L.push(k.L[q] * a);
    return { L: L, pitch: k.pitch.slice(0, cap), info: k.info, sr: sr };
  }
  var v = map.voices[voice], E = map.envelope, info = koreModelInfo(map, voice, p);
  var amp = p.amp === undefined ? 1 : p.amp;
  var total = E.attackMs + info.decayMs + E.gateFadeMs;
  var n = Math.ceil(Math.min(total, maxMs || total) / 1000 * sr) + 8;
  var rnd = new KoreModelRng((seed || 1) * 2654435761);
  var out = [], pitch = [], ph = 0, i, tMs;
  if (voice === "SUB") {
    var g = info.driveGain, comp = Math.pow(g, -0.3);
    for (i = 0; i < n; i++) {
      tMs = i / sr * 1000;
      var f = info.tuneHz * Math.pow(2, info.sweepSemis / 12 * koreSweep(tMs, info.sweepMs));
      pitch.push(f); ph += f / sr;
      out.push(koreTanh(g * Math.sin(2 * Math.PI * ph) * koreEnv(tMs, E.attackMs, info.decayMs, E.floorDb, E.gateFadeMs)) * comp * amp);
    }
  } else if (voice === "TOM L" || voice === "TOM H") {
    // the kick's synthesis at a higher pitch: glide body + CLICK (noise band + tick) → tanh DRIVE
    var bp = koreSvf(info.clickHz, v.clickQ, sr), tg = info.driveGain, tc = Math.pow(tg, -0.3);
    for (i = 0; i < n; i++) {
      tMs = i / sr * 1000;
      var ft = info.tuneHz * Math.pow(2, info.sweepSemis / 12 * koreSweep(tMs, info.sweepMs));
      pitch.push(ft); ph += ft / sr;
      bp.tick(rnd.next() * 2 - 1);
      var env = koreEnv(tMs, E.attackMs, info.decayMs, E.floorDb, E.gateFadeMs);
      var endT = E.attackMs + info.decayMs, gateT = tMs > endT ? Math.max(0, 1 - (tMs - endT) / E.gateFadeMs) : 1;
      var ce = koreDbToA(-60 * Math.min(2, tMs / (v.clickTauMs * KORE_TAU_TO_60DB)));
      var te = koreDbToA(-60 * Math.min(2, tMs / (v.tickTauMs * KORE_TAU_TO_60DB)));
      var clk = p.snap * v.clickGain * (bp.bp * 2.2 * ce + Math.sin(2 * Math.PI * info.clickHz * tMs / 1000) * te) * gateT;
      out.push(koreTanh(tg * v.outGain * (Math.sin(2 * Math.PI * ph) * env + clk)) * tc * amp);
    }
  } else if (voice === "HAT") {
    var hh = koreSvf(info.toneHz, info.q, sr);
    for (i = 0; i < n; i++) {
      tMs = i / sr * 1000;
      hh.tick(rnd.next() * 2 - 1);
      out.push(hh.hp * koreEnv(tMs, 0.3, info.decayMs, E.floorDb, E.gateFadeMs) * v.outGain * amp);
      pitch.push(info.toneHz);
    }
  }
  return { L: out, pitch: pitch, info: info, sr: sr };
}

// RUMBLE bus response to one kick: lowpass(TONE) → 2-tap feedback delay (TAIL) → drive →
// gate → duck (by the kick itself) → AMOUNT.
function koreModelRumble(map, punchP, rp, sr, ms) {
  var v = map.voices.RUMBLE, info = koreModelInfo(map, "RUMBLE", rp);
  var kick = koreRenderKick(map, punchP, sr).L;
  var n = Math.ceil(ms / 1000 * sr), lp = koreSvf(info.lowpassHz, v.lowpassQ, sr);
  var buf = [], out = [], d1 = Math.round(v.tapsMs[0] / 1000 * sr), d2 = Math.round(v.tapsMs[1] / 1000 * sr);
  var g = info.driveGain, comp = Math.pow(g, -0.3), rel = v.duckReleaseMs;
  for (var i = 0; i < n; i++) {
    var tMs = i / sr * 1000;
    lp.tick(kick[i] || 0);
    var taps = 0.5 * ((buf[i - d1] || 0) + (buf[i - d2] || 0));
    buf.push(lp.lp + taps * info.feedback);
    var duck = 1 - rp.duck * Math.max(0, Math.min(1, 1 - tMs / rel));
    var gate = Math.min(1, tMs / v.gateAttackMs) * (tMs < info.tailMs ? 1 : Math.max(0, 1 - (tMs - info.tailMs) / info.tailMs));
    out.push(koreTanh(g * taps) * comp * gate * duck * rp.amount * v.wetGain);
  }
  return { L: out, info: info, sr: sr, kick: kick };
}

// Magnitude in `bands` log bands 20 Hz .. sr/2 of a window (spectrum views).
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
