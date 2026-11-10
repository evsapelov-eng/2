// NØIZ — reference model of one voice hit (ES5). Single source used by:
//   - the jsui SYNTH/LANES preview (what you see is this model),
//   - tools/render_voices.js (offline audio checks).
// It mirrors the Max voice patches built from spec/dsp_map.json. It is not Max output:
// svf~/noise~/pink~ in Max differ in detail, the shape of the result does not.
//
// p = {amp, tone, decay, texture, drive, pan, reso, attack, character} (0..1)

function NoizModelRng(seed) { this.s = (seed >>> 0) || 1; }
NoizModelRng.prototype.next = function () {
  // xorshift32 — no Math.imul needed (legacy Max JS)
  var x = this.s;
  x ^= (x << 13); x >>>= 0;
  x ^= (x >>> 17);
  x ^= (x << 5); x >>>= 0;
  this.s = x;
  return x / 4294967296;
};

// Math.tanh is ES2015 — not available in Max's legacy JS engine.
function noizTanh(x) {
  if (x > 20) return 1;
  if (x < -20) return -1;
  var e = Math.exp(2 * x);
  return (e - 1) / (e + 1);
}

function noizModelExp(r, x) { return r[0] * Math.pow(r[1] / r[0], x); }

function noizModelSvf(freq, res, sr) {
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

// Derived, human-readable values of a parameter set (for labels and checks).
function noizModelInfo(map, voiceName, p) {
  var v = map.voices[voiceName];
  return {
    toneHz: noizModelExp(v.toneHz, p.tone),
    decayMs: Math.max(map.envelope.minDecayMs, noizModelExp(v.decayMs, p.decay)),
    attackMs: noizModelExp(map.envelope.attackMs, p.attack),
    q: map.reso.q[0] + (map.reso.q[1] - map.reso.q[0]) * p.reso
  };
}

// Renders one hit. maxMs caps the length (preview), sr may be lowered for speed.
// Returns {L: [], R: [], sr, info}.
function noizModelHit(map, voiceName, p, sr, maxMs, seed) {
  var v = map.voices[voiceName], CH = map.character[voiceName], T = map.texture;
  var info = noizModelInfo(map, voiceName, p);
  var total = info.attackMs + info.decayMs;
  var n = Math.ceil((Math.min(total, maxMs || total) / 1000) * sr) + 16;
  var chans = v.stereo.indexOf("decorrelated") === 0 ? 2 : 1;
  var tex = p.texture, c = p.character;
  var g = 1 + p.drive * map.drive.gainMax, comp = Math.pow(g, -map.drive.compExp);
  var f = info.toneHz, isDust = voiceName === "DUST", isMetal = voiceName === "METAL";
  var ratioK = isMetal ? CH.range[0] + (CH.range[1] - CH.range[0]) * c : 1;
  var out = [[], []];
  for (var ch = 0; ch < chans; ch++) {
    var rnd = new NoizModelRng((seed || 1) * 7919 + ch * 104729 + 17);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    var filt = noizModelSvf(isMetal ? f * v.noiseBpRatio : f, isMetal ? 0.7 : info.q, sr);
    var color = isMetal ? noizModelSvf(f * v.noiseBpRatio, info.q, sr) : null;
    var dens = isDust ? CH.dens[0] + (CH.dens[1] - CH.dens[0]) * c : T.crackleMaxDensity * tex;
    var noiseG = isDust ? 1 - CH.noiseCut * c : 1;
    var oc = [], os = [], rc = [], rs = [];
    if (isMetal) {
      for (var o = 0; o < v.partialRatios.length; o++) {
        var w0 = 2 * Math.PI * f * (1 + (v.partialRatios[o] - 1) * ratioK) / sr;
        oc.push(1); os.push(0); rc.push(Math.cos(w0)); rs.push(Math.sin(w0));
      }
    }
    var sig = out[ch];
    for (var i = 0; i < n; i++) {
      var tMs = (i / sr) * 1000;
      var lin = tMs < info.attackMs ? tMs / info.attackMs : Math.max(0, 1 - (tMs - info.attackMs) / info.decayMs);
      var env = p.amp * lin * lin;
      var w = rnd.next() * 2 - 1, wp = rnd.next() * 2 - 1;
      b0 = 0.99886 * b0 + wp * 0.0555179; b1 = 0.99332 * b1 + wp * 0.0750759; b2 = 0.969 * b2 + wp * 0.153852;
      b3 = 0.8665 * b3 + wp * 0.3104856; b4 = 0.55 * b4 + wp * 0.5329522; b5 = -0.7616 * b5 - wp * 0.016898;
      var pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + wp * 0.5362) * 0.11; b6 = wp * 0.115926;
      var src = ((1 - tex) * w * T.whiteGain + tex * pink * T.pinkGain) * noiseG;
      var ck = rnd.next() * 2 - 1, ca = rnd.next() * 2 - 1;
      if (v.crackleGain > 0 && Math.abs(ck) > 1 - dens) src += ca * v.crackleGain;
      filt.tick(src);
      var x = v.filter === "hp" ? filt.hp : (v.filter === "lp" ? filt.lp : filt.bp);
      if (voiceName === "HISS") x = (1 - c) * filt.hp + c * filt.bp * CH.bpGain;
      if (isMetal) {
        var part = 0;
        for (var q = 0; q < oc.length; q++) { // sine by rotation: (c,s) *= e^{iw}
          var nc = oc[q] * rc[q] - os[q] * rs[q];
          os[q] = oc[q] * rs[q] + os[q] * rc[q]; oc[q] = nc;
          part += os[q] * v.partialGains[q];
        }
        x = (1 - tex) * part + tex * x * 2.5;
        var kk = p.reso * map.metalColor.gain;
        color.tick(x);
        x = (x + color.bp * kk) / (1 + map.metalColor.norm * kk);
      }
      sig.push(noizTanh(g * x * env * v.outGain) * comp);
    }
  }
  var L = out[0], R = chans === 2 ? out[1] : out[0];
  if (chans === 2) {
    var R2 = [];
    for (var j = 0; j < n; j++) R2.push((1 - c) * L[j] + c * R[j]);
    R = R2;
  }
  var pan = p.pan === undefined ? 0.5 : p.pan;
  var gl = Math.SQRT2 * Math.cos(pan * Math.PI / 2), gr = Math.SQRT2 * Math.sin(pan * Math.PI / 2);
  var Lo = [], Ro = [];
  for (var m = 0; m < n; m++) { Lo.push(L[m] * gl); Ro.push(R[m] * gr); }
  return { L: Lo, R: Ro, sr: sr, info: info };
}

// Magnitude spectrum in `bands` log-spaced bands (40 Hz .. sr/2) of a window of the signal.
function noizModelSpectrum(sig, sr, start, size, bands) {
  var N = size, re = [], im = [], i, j = 0;
  for (i = 0; i < N; i++) {
    var s = sig[start + i] || 0;
    re.push(s * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)))); im.push(0);
  }
  for (i = 1, j = 0; i < N; i++) { // bit reversal
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
        var u = a + k, v2 = a + k + len / 2;
        var xr = re[v2] * cr - im[v2] * ci, xi = re[v2] * ci + im[v2] * cr;
        re[v2] = re[u] - xr; im[v2] = im[u] - xi; re[u] += xr; im[u] += xi;
        var t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  var outB = [], fmin = 40, fmax = sr / 2;
  for (var b = 0; b < bands; b++) {
    var f0 = fmin * Math.pow(fmax / fmin, b / bands), f1 = fmin * Math.pow(fmax / fmin, (b + 1) / bands);
    var k0 = Math.max(1, Math.floor(f0 * N / sr)), k1 = Math.max(k0 + 1, Math.ceil(f1 * N / sr));
    var e = 0;
    for (var q2 = k0; q2 < k1 && q2 < N / 2; q2++) e = Math.max(e, re[q2] * re[q2] + im[q2] * im[q2]);
    outB.push(e);
  }
  return outB;
}
