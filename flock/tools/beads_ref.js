// Independent REFERENCE of the Beads DSP (granular mode, the four qualities), transcribed
// class by class from the C++ (pichenettes/eurorack beads @ f4cfa76 + stmlib, MIT), WITHOUT
// looking at gen/flock.genexpr. Used only by tests to check the gen~ port sample by sample.
// Kept like the module: blocks of sr/4000 samples (kBlockRate = 4000 → 12 at 48 kHz) with ParameterInterpolator, fixed-point (×1024)
// grain positions, 16-bit buffer. float32 rounding of the module is NOT emulated (double).
// Random: one shared generator (Random::GetFloat) — the caller passes the same stream as gen~.
"use strict";

const kMaxGrainFrequency = 130.81278;
const BLOCK = 12;   // beads.cc kBlockRate = 4000 → 48000 / 4000

function SmoothStep(x) { return x * x * (3 - 2 * x); }
function SemitonesToRatio(s) { return Math.pow(2, s / 12); }   // stmlib uses a LUT (≈ exact)
function Clip16(x) { return x < -32768 ? -32768 : x > 32767 ? 32767 : x; }
function ONE_POLE(out, inp, c) { return out + c * (inp - out); }
function SoftLimit(x) { return x * (27 + x * x) / (27 + 9 * x * x); }
function SoftClip(x) { return x < -3 ? -1 : x > 3 ? 1 : SoftLimit(x); }
// mu_law.h Lin2MuLaw (int16 in) and lut_ulaw_f (G.711 decoder / 32768, 5 decimals as printed in mu_law.cc)
function Lin2MuLaw(pcm) {
  pcm = pcm >> 2;
  let mask;
  if (pcm < 0) { pcm = -pcm; mask = 0x7f; } else mask = 0xff;
  if (pcm > 8159) pcm = 8159;
  pcm += 0x84 >> 2;
  const seg = pcm <= 0x3f ? 0 : pcm <= 0x7f ? 1 : pcm <= 0xff ? 2 : pcm <= 0x1ff ? 3 : pcm <= 0x3ff ? 4 : pcm <= 0x7ff ? 5 : pcm <= 0xfff ? 6 : pcm <= 0x1fff ? 7 : 8;
  if (seg >= 8) return 0x7f ^ mask;
  return ((seg << 4) | ((pcm >> (seg + 1)) & 0x0f)) ^ mask;
}
const LUT_ULAW = Array.from({ length: 256 }, (_, u) => {
  const uv = (~u) & 0xff; let t = ((uv & 0xf) << 3) + 0x84; t <<= (uv & 0x70) >> 4;
  const lin = (uv & 0x80) ? (0x84 - t) : (t - 0x84);
  return Math.floor(lin / 32768 * 100000 + 0.5) / 100000;
});
function MuLaw2Lin(u) { return LUT_ULAW[u]; }
// lut_sine (1025+ points of sin 2πi/1024) read by stmlib::Interpolate
function lutSine(phase) { const x = phase * 1024, i = Math.trunc(x); return Math.sin(2 * Math.PI * i / 1024) + (Math.sin(2 * Math.PI * (i + 1) / 1024) - Math.sin(2 * Math.PI * i / 1024)) * (x - i); }
// (v0.3 only, kept for reference) sample_rate_conversion_filters.h: SRC_FIR<SRC_DOWN / SRC_UP, 2, 48> (first half; symmetric)
const SRC_DOWN_2 = [-2.143728787e-04, -4.113243578e-04, 3.550026182e-04, 1.123588805e-03, 2.013790146e-04, -2.135889966e-03, -1.946536068e-03, 2.421957824e-03,
  5.099674271e-03, -4.847193956e-04, -8.638296788e-03, -5.137744633e-03, 1.000597441e-02, 1.464501735e-02, -5.419339385e-03, -2.582247866e-02,
  -9.106955536e-03, 3.335521514e-02, 3.702172341e-02, -2.802414194e-02, -8.416883646e-02, -1.192656678e-02, 1.955030744e-01, 3.837045956e-01];
const SRC_UP_2 = [-4.287457573e-04, -8.226487157e-04, 7.100052364e-04, 2.247177610e-03, 4.027580292e-04, -4.271779932e-03, -3.893072135e-03, 4.843915649e-03,
  1.019934854e-02, -9.694387912e-04, -1.727659358e-02, -1.027548927e-02, 2.001194882e-02, 2.929003471e-02, -1.083867877e-02, -5.164495731e-02,
  -1.821391107e-02, 6.671043028e-02, 7.404344683e-02, -5.604828388e-02, -1.683376729e-01, -2.385313356e-02, 3.910061488e-01, 7.674091912e-01];
const mirror48 = (h, i) => (i >= 24 ? h[47 - i] : h[i]);   // Accumulator<…, mirror = 48>
// Processor: codec rate per quality (ENABLE_HARDWARE_24K) and granular ratio
// 0 MEDIA_DIGITAL, 1 MEDIA_VINTAGE_DIGITAL, 2 MEDIA_CLEAN_TAPE, 3 MEDIA_DIRTY_TAPE (FLØCK order)
// FLØCK v0.4.1 ("lite"): every quality runs at the host rate; the buffer keeps the module's DURATION
// (kDelayBufferSizeBits / (bits · 2) frames at 48 / 32 / 24 / 24 kHz = 4 / 8 / 10.67 / 16 s); the codec
// rate shows as bandwidth (two one-poles at 14 kHz / 10 kHz on the input for Cold digital / Scorched)
const QUALITY = [
  { bits: 16, seconds: 0, band: 0 },            // 192000 frames, as before
  { bits: 12, seconds: 8, band: 14000 },
  { bits: 12, seconds: 10.6666667, band: 0 },
  { bits: 8, seconds: 16, band: 10000 },
];

// ---------------- cv_reader.h pot laws
function attenuverterLaw(k) { let v = k - 0.5; return (2 / 0.47) * v * Math.max(Math.abs(v) - 0.03, 0); }
function detuneLaw(k) {
  let detune = 2 * k - 1;
  const sign = detune < 0 ? -1 : 1;
  detune = detune * sign * 6;
  const di = Math.floor(detune);
  let df = detune - di;
  const intervals = [0, 1, 3, 4, 7, 12, 24, 24];
  df = Math.max((df - 0.33333333) * 1.5, 0);
  const a = intervals[di], b = intervals[di + 1];
  return (a + (b - a) * SmoothStep(df)) * sign;
}

class Ref {
  // sr = the codec rate this processor runs at (FLØCK: host rate for Pristine / Sunny tape)
  constructor(sr, random, quality = 0) {
    const Q = QUALITY[quality];
    this.q = quality; this.bits = Q.bits; this.ratio = 1; this.band = Q.band;
    this.codec_sr = sr;
    this.R = random;   // () => [0,1)
    this.MAX = Q.seconds ? Math.min(768000, Math.floor(Q.seconds * sr)) : 192000;
    this.BLK = Math.floor(sr / 4000 + 0.5);   // beads.cc: codec.Start(sr, sr / kBlockRate)
    this.sr = sr;
    this.bl = [0, 0, 0, 0];
    // ---- DelayLine<16 bit, 192000, 2>
    this.l = new Float64Array(this.MAX + 4); this.r = new Float64Array(this.MAX + 4);
    this.write_ptr = 0; this.frozen = false; this.tail = new Float64Array(512); this.tail_write_ptr = 0; this.tail_xfade_duration = 0;
    // ---- grains
    this.grains = [];
    for (let i = 0; i < 32; i++) this.grains.push(this.newGrain());
    this.prio = this.grains.slice();
    this.instant = Math.trunc(sr * 0.005); this.preempt = Math.trunc(sr * 0.1); this.simpleThr = Math.trunc(sr * 0.025);
    this.grain_interval = 1; this.max_grain_duration = sr * 4;
    // ---- trigger generator
    const cs = this.codec_sr;   // TriggerGenerator::Init(codec rate)
    this.tg = { phase: 0, ratio: 1, elapsed: Math.trunc(cs / 2), frequency: 0, prev: false, prevExt: false,
      target: 0, lp: 1, audio: false, accept: true, count: 0, division: 1, quant: 0,
      defaultReset: Math.trunc(cs * 4), resetInt: Math.trunc(cs * 4), audioInt: Math.trunc(cs / 48), one_hertz: 1 / cs };
    this.tg.frequency = this.tg.target = 1 / this.tg.elapsed;
    this.cv = null;
    // GainControl::Init(reset = true)
    this.gc = { peak: 0.5, agc: 0.5, stable: 0.5, gain: 1, time: 0, ignore: Math.trunc(cs * 1), active: Math.trunc(cs * 6), sca: 0,
      mode: quality === 3 ? "on" : quality === 2 ? "dynamic" : "off" };
    // ---- granular processor
    this.feedback = 0; this.prev = [0, 0];
    this.dc = [this.svf(40 / sr, 0.5), this.svf(40 / sr, 0.5)];
    this.lim_in = { peak: 0.5, lp: 0.5, decay: 1 / sr, max: 0.95 };
    // ---- processor
    this.dry = 0; this.wet = 0;
    this.lim_pre = { peak: 0.5, lp: 0.5, decay: 1 / (cs * 4), max: 0.9 };
    this.lim_out = { peak: 0.5, lp: 0.5, decay: 1 / (cs * 6), max: 0.9 };
    // ---- reverb (FxEngine 32768, 16 bit), Reset(codec rate)
    this.rb = new Float64Array(32768); this.rwp = 0;
    this.lfo = [this.cosOsc(0.5 / cs * 32), this.cosOsc(0.3 / cs * 32)];
    // ---- SampleRateConverter<…, 2, 48> states (Sunny tape) — streamed, see processBlock
    this.srcDown = [new Float64Array(48), new Float64Array(48)]; this.srcUp = [new Float64Array(24), new Float64Array(24)];
    this.pend = null;
    // ---- WowAndFlutter::Init(24000), set_lp(0.95) — converted to the host rate (times and depths kept)
    this.wf = { one_hertz: 1 / sr, rf: 0.125 / sr, rph: 0, wph: 0, fph: 0, delay: 0, lp: 1 - Math.pow(0.05, 24000 / sr), lps: [0, 0],
      line: [new Float64Array(1024), new Float64Array(1024)], wp: 0 };
    this.rv = { lp1: 0, lp2: 0, dry: 0, wet: 0, send: 0 };
  }
  newGrain() {
    return { stage: 3, phase: 0, inc: [0.5, 0.5, 0.5, 0], smooth: 0, vs: 1, vsdec: 0, delay: 0, speed: 1024, g: [[0.5, 0.5], [0.5, 0.5]], remaining: 0 };
  }
  svf(f, q) {
    const a = 3.260e-01 * Math.PI ** 3, b = 1.823e-01 * Math.PI ** 5, f2 = f * f;
    const g = f * (Math.PI + f2 * (a + b * f2)), r = 1 / q, h = 1 / (1 + r * g + g * g);
    return { g, r, h, s1: 0, s2: 0 };
  }
  svfHP(s, x) {
    const hp = (x - s.r * s.s1 - s.g * s.s1 - s.s2) * s.h, bp = s.g * hp + s.s1;
    s.s1 = s.g * hp + bp; const lp = s.g * bp + s.s2; s.s2 = s.g * bp + lp;
    return hp;
  }
  cosOsc(frequency) {
    let sign = 16; frequency -= 0.25;
    if (frequency < 0) frequency = -frequency; else if (frequency > 0.5) frequency -= 0.5; else sign = -16;
    const c = sign * frequency * (1 - 2 * frequency);
    return { c, y1: c * 0.25, y0: 0.5 };
  }
  limiter(L, fr) {
    const peak = Math.min(Math.max(Math.abs(fr[0]), Math.abs(fr[1])), 40);
    let e = peak - L.peak; L.peak += (e > 0 ? 0.1 : L.decay) * e;
    e = L.peak - L.lp; L.lp += (e > 0 ? 0.5 : L.decay) * e;
    const gain = L.lp <= L.max ? 1 : L.max / L.lp;
    fr[0] *= gain; fr[1] *= gain;
  }
  // ---------------- randomized_parameter.h
  value(p, range, clamp) {
    let result = p.base;
    if (!p.has_cv) {
      const blend = p.attenuverter > 0 ? p.attenuverter : Math.min(1, p.attenuverter * this.R() * -3);
      const random_value = !clamp ? (2 * this.R() - 1) * range : this.R() * range - result;
      result += random_value * blend;
    } else if (p.attenuverter < 0) {
      const u = this.R(), pg = u * (u * (4 * u - 6) + 4) - 1;
      result += Math.max(p.cv, 0) * -p.attenuverter * pg;
    } else result += p.attenuverter * p.cv;
    if (clamp) result = Math.min(1, Math.max(0, result));
    return result;
  }
  randomness(p) { return p.has_cv ? Math.max(-p.attenuverter, 0) : Math.abs(p.attenuverter); }
  // ---------------- delay_line.h
  // Item<resolution, 2>::Store + value()
  item(x) {
    const c = Clip16(Math.trunc(x * 32768));
    return this.bits === 16 ? c / 32768 : this.bits === 12 ? (c >> 4) / 2048 : MuLaw2Lin(Lin2MuLaw(c));
  }
  store(i, fr) { this.l[i] = this.item(fr[0]); this.r[i] = this.item(fr[1]); }
  writeFrame(fr, frozen) {
    if (frozen) {
      if (!this.frozen) this.tail_write_ptr = 0;
      if (this.tail_write_ptr < 256) { this.tail[2 * this.tail_write_ptr] = fr[0]; this.tail[2 * this.tail_write_ptr + 1] = fr[1]; this.tail_write_ptr++; }
    } else {
      if (this.frozen && this.tail_write_ptr) this.tail_xfade_duration = this.tail_write_ptr;
      if (this.tail_write_ptr) {
        const pos = this.tail_xfade_duration - this.tail_write_ptr, gain = SmoothStep(this.tail_write_ptr / this.tail_xfade_duration);
        fr = [fr[0] + (this.tail[2 * pos] - fr[0]) * gain, fr[1] + (this.tail[2 * pos + 1] - fr[1]) * gain];
        this.tail_write_ptr--;
      }
      this.store(this.write_ptr, fr);
      if (this.write_ptr < 4) this.store(this.write_ptr + this.MAX, fr);
      this.write_ptr = this.write_ptr === 0 ? this.MAX - 1 : this.write_ptr - 1;
    }
    this.frozen = frozen;
  }
  readHermite(di, df) {
    di += this.MAX - 1;
    const i = (this.write_ptr + di) % this.MAX, out = [0, 0];
    for (const [ch, a] of [[0, this.l], [1, this.r]]) {
      const x0 = a[i], x1 = a[i + 1], x2 = a[i + 2], x3 = a[i + 3];
      const c = (x2 - x0) * 0.5, v = x1 - x2, w = c + v, aa = w + v + (x3 - x1) * 0.5, b_neg = w + aa;
      out[ch] = (((aa * df) - b_neg) * df + c) * df + x1;
    }
    return out;
  }
  // ---------------- grain_envelope.h
  envStart(g, duration, shape, frac) {
    g.stage = 0; g.phase = 0;
    const sustain = Math.max(1 - 3 * shape, 0);
    shape = (shape - 0.33333333) * 1.5;
    if (shape < 0) shape = 0; else if (shape < 0.5) shape = shape * shape * shape * 4;
    const attack = shape, release = (1 - attack) * (1 - sustain);
    const ad = Math.max(duration * attack, 0.0005 * this.sr * (1 + 3 * sustain));
    const sd = Math.max(duration * sustain, 2), rd = Math.max(duration * release, 0.010 * this.sr);
    g.inc = [1 / ad, 1 / sd, 1 / rd, 0];
    g.smooth = attack < 0.5 ? 2 * attack : 2 - 2 * attack;
    g.phase += g.inc[g.stage] * frac;
    this.envWrap(g);
  }
  envWrap(g) { if (g.phase >= 1) { const t = (g.phase - 1) / g.inc[g.stage]; g.stage++; g.phase = t * g.inc[g.stage]; } }
  envRender(g) {
    if (g.stage === 3) return 0;
    let value;
    if (g.stage === 1) value = 1;
    else { const attack = g.stage === 0, t = attack ? g.phase : 1 - g.phase, base = attack ? t : (t * t) * (t * t); value = base + (SmoothStep(t) - base) * g.smooth; }
    g.phase += g.inc[g.stage];
    this.envWrap(g);
    return value;
  }
  done(g) { return g.stage >= 3 || g.vs <= 0; }
  fadeOut(g, duration) { if (g.remaining > duration) { g.vsdec = 1 / duration; g.remaining = Math.trunc(g.vs * duration); } }
  // ---------------- delay_grain.h (STOP policy, fade_out = true)
  grainStart(g, delay, speed, duration, shape, gain, pan, frac) {
    const consumption = speed - (this.frozen ? 0 : 1);
    delay -= frac * consumption;
    if (consumption !== 0) duration = Math.min(duration, this.MAX / Math.abs(consumption));
    if (consumption > 0) delay = Math.max(delay, duration * consumption);
    else if (consumption < 0) delay = Math.min(delay, this.MAX + duration * consumption);
    g.delay = Math.trunc(delay * 1024); g.speed = Math.trunc(speed * 1024);
    if (pan < 0.5) { pan *= 2; g.g = [[gain, (1 - pan) * (1 + pan) * gain], [0, pan * (2 - pan) * gain]]; }
    else { pan = (1 - pan) * 2; g.g = [[pan * (2 - pan) * gain, 0], [(1 - pan) * (1 + pan) * gain, gain]]; }
    this.envStart(g, duration, shape, frac);
    g.remaining = Math.trunc(duration);
    g.vs = 1; g.vsdec = 0;
  }
  grainRender(g, out) {
    if (this.done(g)) return;
    g.delay -= g.speed;
    if (!this.frozen) g.delay += 1024;
    const tail = this.MAX * 1024, fade_zone = 256 * 1024;
    if (g.delay < 0 || g.delay >= tail) { g.delay = 0; g.stage = 3; }
    const d = Math.abs(g.delay >= tail / 2 ? g.delay - tail : g.delay);
    const fade_ramp = d < fade_zone ? d / fade_zone : 1;
    const s = this.readHermite(Math.floor(g.delay / 1024), (g.delay % 1024) / 1024);
    const f = SmoothStep(fade_ramp);
    const e = this.envRender(g) * (g.vs = g.vs - g.vsdec, Math.max(g.vs, 0));
    const sl = s[0] * f * e, sr = s[1] * f * e;
    out[0] += sl * g.g[0][0] + sr * g.g[0][1];
    out[1] += sl * g.g[1][0] + sr * g.g[1][1];
    g.remaining--;
    if (this.done(g)) g.remaining = 0;
  }
  // ---------------- granular_player.h + delay_granular_player.h
  playerRender(trig, p, out) {
    if (trig.trigger) {
      const duration = this.value(p.size, 1, true);
      const reverse = duration < 0.3333333;
      let n = 1; for (const g of this.grains) if (!this.done(g)) n++;
      const amplitude = 1 / Math.sqrt(n);
      const spread = Math.min(1, this.randomness(p.time) + this.randomness(p.size) + this.randomness(p.shape) + this.randomness(p.pitch) + 1 - trig.regularity);
      const u = this.R(), v = this.R();
      const pan = 0.5 + (u - 0.5) * Math.min(0.5 * n * spread * v, 1);
      const safety = 257, max_delay = this.MAX - 2 * safety;
      const delay = this.value(p.time, 1, true) * max_delay + safety;                 // argument order: left to right
      const pitch = p.kon ? Object.assign({}, p.pitch, { base: p.pitch.base + p.knote }) : p.pitch;   // FLØCK keys
      const speed = (reverse ? -1 : 1) * SemitonesToRatio(this.value(pitch, 24, false));
      const csh = reverse ? duration * 3 * (2 - duration * 3) : 1 - 1.5 * (duration - 0.3333333);
      const gdur = SemitonesToRatio(Math.min(1, 1.025 * csh) * -108) * this.max_grain_duration;
      const shape = this.value(p.shape, 1, true);
      this.grainStart(this.prio[0], delay, speed, gdur, shape, amplitude, pan, trig.fractional_sample);
      this.sortGrainList();
    }
    for (const g of this.grains) this.grainRender(g, out);
    this.grain_interval++;
  }
  sortGrainList() {
    const fade = [0, 0, 0, 0], gi = this.grain_interval;
    if (gi < this.simpleThr) {
      this.prio.push(this.prio.shift());                       // std::rotate by one
      fade[0] = gi + 1; fade[1] = this.instant; fade[2] = this.instant; fade[3] = this.preempt;
      if (gi > this.instant) { const t = fade[0]; fade[0] = fade[2]; fade[2] = t; }
    } else {
      // std::partial_sort of the first 4 by remaining samples (order of the rest unspecified:
      // selection with swaps, the same choice as the port)
      for (let k = 0; k < 4; k++) {
        let best = k;
        for (let j = k + 1; j < 32; j++) if (this.prio[j].remaining < this.prio[best].remaining) best = j;
        const t = this.prio[k]; this.prio[k] = this.prio[best]; this.prio[best] = t;
      }
      fade[0] = this.instant; fade[1] = this.instant; fade[2] = gi; fade[3] = this.preempt;
      if (gi > this.preempt) { const t = fade[2]; fade[2] = fade[3]; fade[3] = t; }
    }
    for (let i = 0; i < 4; i++) this.fadeOut(this.prio[i], Math.max(fade[i], 1));
    this.grain_interval = 0;
  }
  // ---------------- trigger_generator.cc (no external SEED input)
  // HysteresisQuantizer2(8, 0.075, false)
  quantize(v) {
    const value = v * 8 - 0.5, sign = value > this.tg.quant ? -1 : 1;
    this.tg.quant = Math.min(7, Math.max(0, Math.trunc(value + sign * 0.075 + 0.5)));
    return this.tg.quant;
  }
  renderDivider(flags, density, out) {
    const tg = this.tg, ratios = [1, 2, 3, 4, 6, 8, 12, 16];
    const division = density < 0.48 ? ratios[this.quantize(density * 2.15)] : 1;
    const probability_sqrt = density < 0.48 ? 1.01 : Math.max((density - 0.52) * 2.15, 0);
    const probability = probability_sqrt * probability_sqrt;
    const regularity = probability >= 1 ? 1 : 0;
    for (const fl of flags) {
      tg.frequency = ONE_POLE(tg.frequency, tg.target, tg.lp);
      tg.phase += tg.frequency;
      if (fl.rising) {
        if (tg.elapsed >= tg.resetInt) { tg.count = 0; tg.phase = 0; }
        tg.resetInt = Math.max(tg.defaultReset, 4 * tg.elapsed);
        const threshold = tg.audioInt + (tg.audio ? 8 : 0);
        tg.audio = tg.elapsed < threshold && probability >= 1;
        tg.accept = this.R() < probability && (tg.count % division) === 0;
        if (tg.accept) {
          const period = tg.elapsed, frequency = 1 / period;
          tg.target = probability >= 1 ? frequency / division : frequency * probability;
          if (tg.audio) {
            let no_glide = division !== tg.division;
            tg.division = division;
            const up = (1.02 + 2 * frequency) * tg.frequency, down = (0.98 - 2 * frequency) * tg.frequency;
            no_glide = no_glide || tg.target > up || tg.target < down;
            tg.lp = no_glide ? 1 : period * tg.one_hertz;
          } else { tg.phase = 0; tg.lp = 1; }
        } else if (probability < 1) tg.target *= (1 - probability);
        tg.count = (tg.count + 1) % 48;
        tg.elapsed = 0;
      }
      tg.elapsed++;
      if (tg.audio) {
        let t = 0; const reset = tg.phase >= 1;
        if (reset) { tg.phase -= 1; t = tg.phase / tg.frequency; }
        out.push({ trigger: reset, fractional_sample: t, regularity });
      } else {
        if (tg.phase >= 1) tg.phase = 1;
        out.push({ trigger: tg.accept && fl.rising, fractional_sample: 0, regularity });
      }
    }
  }
  // TriggerGenerator::Render(seed_button_state, external_input (null = unpatched), density, linear_fm, exponential_fm)
  triggers(seedState, density, n, ext, linear_fm = 0, exponential_fm = 0) {
    const out = [], tg = this.tg, maxf = kMaxGrainFrequency / this.codec_sr;
    // beads.cc: the SEED input's own gate flags (previous_seed), updated whenever it is patched
    const extFlags = [];
    if (ext) for (let i = 0; i < n; i++) { const g = !!ext[i]; extFlags.push({ high: g, rising: g && !tg.prevExt }); tg.prevExt = g; }
    if (ext && seedState === 2) {
      density = Math.min(1, Math.max(0, density + linear_fm + exponential_fm));
      this.renderDivider(extFlags, density, out);
      return out;
    }
    density = Math.min(1, Math.max(0, density + linear_fm));
    // FLØCK: AUTO GRAINS (latched, no SEED input) has no silent 12 o'clock: the slowest even grains
    if (seedState === 2 && !ext && density >= 0.48 && density <= 0.52) density = 0.479;
    const fm = SemitonesToRatio(exponential_fm * 60);
    const flags = [];
    for (let i = 0; i < n; i++) {
      let gate = seedState !== 0;
      if (ext) gate = gate || !!ext[i];
      flags.push({ high: gate, rising: gate && !tg.prev }); tg.prev = gate;
    }
    const pulse = (frequency, randomize) => {
      if (!randomize) tg.ratio = 1;
      for (const fl of flags) {
        let f = frequency * tg.ratio; f = Math.min(0.25, Math.max(0.000001, f));
        tg.phase += fl.high ? f : 0;
        let t = 0, reset = false;
        if (fl.rising) { tg.phase = 0; reset = true; } else if (tg.phase >= 1) { tg.phase -= 1; t = tg.phase / f; reset = true; }
        if (reset && randomize) { const x = 0.1 + 0.9 * this.R(); tg.ratio = -1 / (-x * (1 + x * (0.5 + x * (0.3333 + x * 0.25)))); }
        out.push({ trigger: reset && fl.high, fractional_sample: t, regularity: randomize ? 0 : 1 });
      }
    };
    if (density < 0.48) pulse(maxf * SemitonesToRatio(-density * 192) * fm, false);
    else if (density > 0.52) pulse(0.5 * maxf * SemitonesToRatio(-(1 - density) * 192) * fm, true);
    else if (seedState === 2) for (let i = 0; i < n; i++) out.push({ trigger: false, fractional_sample: 0, regularity: 0 });
    else for (const fl of flags) {
      tg.phase += tg.frequency;
      if (fl.rising) { tg.phase = 0; tg.frequency = 1 / tg.elapsed; tg.elapsed = 0; }
      tg.elapsed++;
      if (tg.phase >= 1) tg.phase = 1;
      out.push({ trigger: fl.rising, fractional_sample: 0, regularity: 1 - (density - 0.48) * 25 });
    }
    return out;
  }
  // ---------------- reverb.h (FxEngine)
  rdl(i) { return this.rb[((i % 32768) + 32768) % 32768]; }
  rwr(i, v) { this.rb[((i % 32768) + 32768) % 32768] = Clip16(Math.trunc(v * 32768)) / 32768; }
  reverb(block, amount) {
    const caveman = this.q !== 0;
    const mix = amount * amount * 0.9, time = caveman ? 0.45 + 0.5 * amount * amount * amount : 0.3 + 0.6 * amount * amount * amount;
    const lp = caveman ? 0.4 : (this.q === 1 ? 0.75 : 0.6), kap = 0.625;
    const input_gain = 0.2 * (1 - 0.333 * time), output_gain = 0.4 / input_gain;
    const ssq = mix * (2 - mix), send = ssq * (2 - ssq);
    const n = block.length, rv = this.rv;
    const dInc = ((1 - mix) * (1 + mix) - rv.dry) / n, wInc = (output_gain - rv.wet) / n, sInc = (send * input_gain - rv.send) / n;
    const base = [0, 151, 366, 686, 1214, 3397, 6088, 10590, 13116, 15314], len = [150, 214, 319, 527, 2182, 2690, 4501, 2525, 2197, 6312];
    for (const fr of block) {
      rv.dry += dInc; rv.wet += wInc; rv.send += sInc;
      this.rwp = this.rwp - 1 < 0 ? this.rwp - 1 + 32768 : this.rwp - 1;
      const w = this.rwp;
      let lv = [0, 0];
      if ((w & 31) === 0) for (let k = 0; k < 2; k++) { const o = this.lfo[k], t = o.y0; o.y0 = o.c * o.y0 - o.y1; o.y1 = t; }
      lv = [this.lfo[0].y1 + 0.5, this.lfo[1].y1 + 0.5];
      const interp = (d, off) => { const oi = Math.floor(off), of = off - oi; const a = this.rdl(w + oi + base[d]), b = this.rdl(w + oi + base[d] + 1); return a + (b - a) * of; };
      const tailOf = (d) => this.rdl(w + base[d] + len[d] - 1);
      let acc = interp(0, 10 + 80 * lv[0]);
      this.rwr(w + base[0] + 100, acc); acc = 0;
      acc += (fr[0] + fr[1]) * rv.send;
      for (let d = 0; d < 4; d++) { const pr = tailOf(d); acc += pr * kap; this.rwr(w + base[d], acc); acc = acc * -kap + pr; }
      const apout = acc;
      acc = apout + interp(9, 6261 + 50 * lv[1]) * time;
      rv.lp1 += lp * (acc - rv.lp1); acc = rv.lp1;
      let pr = tailOf(4); acc += pr * -kap; this.rwr(w + base[4], acc); acc = acc * kap + pr;
      pr = tailOf(5); acc += pr * kap; this.rwr(w + base[5], acc); acc = acc * -kap + pr;
      this.rwr(w + base[6], acc);
      const wl = acc;
      acc = apout + interp(6, 4460 + 40 * lv[0]) * time;
      rv.lp2 += lp * (acc - rv.lp2); acc = rv.lp2;
      pr = tailOf(7); acc += pr * kap; this.rwr(w + base[7], acc); acc = acc * -kap + pr;
      pr = tailOf(8); acc += pr * -kap; this.rwr(w + base[8], acc); acc = acc * kap + pr;
      this.rwr(w + base[9], acc);
      const wr = acc;
      fr[0] = fr[0] * rv.dry + wl * rv.wet;
      fr[1] = fr[1] * rv.dry + wr * rv.wet;
    }
  }
  // ---------------- processor.cc (Pristine) for one block
  // P: { time, size, shape, pitch: {base, attenuverter, cv, has_cv}, density, feedback, dry_wet, reverb, freeze, seedState }
  // CvReader::Read once per block: law (done in fromKnobs) → ONE_POLE 0.05 → hysteresis (TIME 0.001).
  // The first block takes the values directly (FLØCK: no glide from zero on load).
  pots(P) {
    const keys = [["time", "base"], ["size", "base"], ["shape", "base"], ["pitch", "base"], ["time", "attenuverter"], ["size", "attenuverter"],
      ["shape", "attenuverter"], ["pitch", "attenuverter"], ["density"], ["fbk"], ["dwk"], ["rvk"]];
    const get = (k) => (k.length === 2 ? P[k[0]][k[1]] : P[k[0]]);
    if (!this.pot) { this.pot = keys.map(get); this.timeh = P.time.base; }
    else keys.forEach((k, i) => { this.pot[i] = ONE_POLE(this.pot[i], get(k), 0.05); });
    const err = this.pot[0] - this.timeh;
    if (err > 0.001) this.timeh = this.pot[0] - 0.001; else if (err < -0.001) this.timeh = this.pot[0] + 0.001;
    const q = JSON.parse(JSON.stringify(P));
    keys.forEach((k, i) => { if (k.length === 2) q[k[0]][k[1]] = this.pot[i]; else q[k[0]] = this.pot[i]; });
    q.time.base = this.timeh;
    q.feedback = Math.min(1, q.fbk * 1.005); q.dry_wet = Math.min(1, q.dwk * 1.005); q.reverb = Math.min(1, q.rvk * 1.005);
    return q;
  }
  // GainControl::Process (auto gain: learning 1 s + 5 s; manual: hard clip at ±1)
  gainBlock(inL, inR, at, n, auto, manual) {
    this.gainTrace = new Float64Array(n);
    const gc = this.gc, hz = n / this.codec_sr, L = new Float64Array(n), R = new Float64Array(n);
    const slope = (out, inp, pos, neg) => { const e = inp - out; return out + (e > 0 ? pos : neg) * e; };
    if (gc.time < gc.ignore) gc.agc = 0.5;
    else if (gc.time < gc.active) { gc.agc = slope(gc.agc, gc.peak, 10 * hz, 2 * hz); gc.stable = gc.agc; }
    else gc.agc = slope(gc.agc, gc.peak, 5 * hz, (gc.peak > gc.stable ? 0.5 : 0.01) * hz);
    if (gc.time > gc.ignore || gc.peak > 0.001) gc.time += n;
    if (gc.time >= gc.active) gc.time = gc.active;
    const optimal = Math.min(0.9 / Math.min(gc.agc, 0.9), 40), target = auto ? optimal : manual;
    const inc = (target - gc.gain) / n;
    // soft clipping amount (manual gain only): ON 1, DYNAMIC 2·(manual / optimal − 0.75), OFF none
    const scTarget = gc.mode === "on" ? 1 : gc.mode === "dynamic" ? Math.min(1, Math.max(0, 2 * (manual / optimal - 0.75))) : 0;
    const scInc = (scTarget - gc.sca) / n;
    const C = (x) => Math.min(1, Math.max(-1, x)), bias = 0.05;
    for (let i = 0; i < n; i++) {
      let l = inL[at + i], r = inR[at + i];
      gc.peak = slope(gc.peak, Math.max(Math.abs(l), Math.abs(r)), 0.1, 2 / this.codec_sr);
      if (this.band) {   // the codec's bandwidth (FLØCK)
        const bc = 1 - Math.exp(-2 * Math.PI * this.band / this.sr), b = this.bl;
        b[0] = b[0] + bc * (l - b[0]); b[1] = b[1] + bc * (b[0] - b[1]); b[2] = b[2] + bc * (r - b[2]); b[3] = b[3] + bc * (b[2] - b[3]);
        l = b[1]; r = b[3];
      }
      gc.gain += inc;
      l *= gc.gain; r *= gc.gain;
      if (!auto) {
        if (gc.mode === "off") { l = C(l); r = C(r); }
        else {
          gc.sca += scInc; const amount = gc.sca;
          const sl = (1 - bias) * SoftClip(l + bias) - bias, sr = (1 - bias) * SoftClip(r + bias) - bias;
          l = C(l); r = C(r);
          l = l + (sl - l) * amount; r = r + (sr - r) * amount;
        }
      }
      L[i] = l; R[i] = r; this.gainTrace[i] = gc.gain;
    }
    return [L, R];
  }
  processBlock(Praw, inL0, inR0, outL, outR, at0, n, X) {
    // the input goes through the gain control first (beads.cc: gain_control before the processor)
    const [gL, gR] = this.gainBlock(inL0, inR0, at0, n, !!Praw.agc, Praw.ingain === undefined ? 1 : Praw.ingain);
    const inL = gL, inR = gR, at = 0, Xat = at0;
    const P = this.pots(Praw);
    X = X || {};
    // CvReader: CV channels read once per block with their low-pass (TIME/SIZE/SHAPE 0.5, PITCH/DENSITY 1, ASSIGN 0.1)
    const lpc = { time: 0.5, size: 0.5, shape: 0.5, pitch: 1, density: 1, fb: 0.1, dw: 0.1, rv: 0.1 };
    // FLØCK: the DENSITY CV is scaled by dn_amt before the CV low-pass (1 = Beads)
    const raw = (k) => (X[k] ? X[k][Xat] * (k === "density" ? (Praw.dn_amt === undefined ? 1 : Praw.dn_amt) : 1) : 0);
    if (!this.cv) { this.cv = {}; for (const k in lpc) this.cv[k] = raw(k); }
    else for (const k in lpc) this.cv[k] = ONE_POLE(this.cv[k], raw(k), lpc[k]);
    for (const k of ["time", "size", "shape", "pitch"]) if (X[k]) { P[k].has_cv = true; P[k].cv = this.cv[k]; }
    // assignable CV: mix = base·1.005 + cv·amount, clamped (only for routed destinations)
    const amt = X.amt || {};
    if (X.fb) P.feedback = Math.min(1, Math.max(0, P.fbk * 1.005 + this.cv.fb * amt.fb));
    if (X.dw) P.dry_wet = Math.min(1, Math.max(0, P.dwk * 1.005 + this.cv.dw * amt.dw));
    if (X.rv) P.reverb = Math.min(1, Math.max(0, P.rvk * 1.005 + this.cv.rv * amt.rv));
    // Processor: DENSITY CV is linear in the middle, exponential FM near the extremes
    const expo = Math.min(1, Math.max(0, 20 * (Math.abs(P.density - 0.5) - 0.225)));
    const dcv = X.density ? this.cv.density : 0;
    // beads.cc: the SEED input is delayed by 10 blocks (event_delay.Read(size * 10), 2.5 ms)
    const ext = X.seed ? Array.from({ length: n }, (_, i) => { const j = Xat + i - 10 * this.BLK; return j >= 0 && X.seed[j] > 0.5; }) : null;
    const trig = this.triggers(P.seedState, P.density, n, ext, (1 - expo) * dcv, expo * dcv);
    const freezeAt = (i) => P.freeze || (X.freeze ? X.freeze[Xat + i] > 0.5 : false);
    const wet_out = [];
    if (this.ratio === 1) {
      this.coreBlock(P, trig, [...Array(n).keys()].map((i) => [inL[at + i], inR[at + i]]), [...Array(n).keys()].map(freezeAt), wet_out);
    } else {
      // GranularProcessor<…, ratio 2>: DownsampleTriggers / DownsampleGate / SRC_DOWN → core → SRC_UP.
      // FLØCK streams it: each pair is processed on its second sample and the up-converted samples of
      // that pair come out on the next two codec samples (2 samples later than block processing).
      const d_trig = [], d_in = [], d_fr = [];
      for (let i = 0; i < n; i += 2) {
        const t0 = trig[i], t1 = trig[i + 1];
        let has = false, fs = 0;
        for (const [j, t] of [[0, t0], [1, t1]]) if (t.trigger && !has) { has = true; fs = (t.fractional_sample + j) * 0.5; }
        d_trig.push({ trigger: has, fractional_sample: fs, regularity: t0.regularity });
        d_fr.push(freezeAt(i) || freezeAt(i + 1));
        const x = [0, 0];
        for (let ch = 0; ch < 2; ch++) {
          const h = this.srcDown[ch], src = ch ? inR : inL;
          for (const v of [src[at + i], src[at + i + 1]]) { h.copyWithin(1, 0, 47); h[0] = v; }
          let acc = 0; for (let k = 0; k < 48; k++) acc += h[k] * mirror48(SRC_DOWN_2, k);
          x[ch] = acc;
        }
        d_in.push(x);
      }
      const d_out = [];
      this.coreBlock(P, d_trig, d_in, d_fr, d_out);
      for (let m = 0; m < n / 2; m++) {
        for (let j = 0; j < 2; j++) {
          const fr = [0, 0];
          for (let ch = 0; ch < 2; ch++) { let acc = 0; for (let k = 0; k < 24; k++) acc += this.srcUp[ch][k] * mirror48(SRC_UP_2, 2 * k + j); fr[ch] = acc; }
          wet_out.push(fr);
        }
        for (let ch = 0; ch < 2; ch++) { this.srcUp[ch].copyWithin(1, 0, 23); this.srcUp[ch][0] = d_out[m][ch]; }
      }
    }
    // Processor: the dry signal through the quality's format
    const dryOf = (x) => this.q === 1 ? Math.trunc(x * 4096) / 4096 : this.q === 3 ? MuLaw2Lin(Lin2MuLaw(Clip16(Math.trunc(x * 32768)))) : x;
    const dw = P.dry_wet, dry = (1 - dw) * (1 + dw) * 0.75, wet = dw * (2 - dw) * 1.5;
    const dInc = (dry - this.dry) / n, wInc = (wet - this.wet) / n;
    const block = [];
    for (let i = 0; i < n; i++) {
      this.dry += dInc; this.wet += wInc;
      block.push([this.dry * dryOf(inL[at + i]) + this.wet * wet_out[i][0], this.dry * dryOf(inR[at + i]) + this.wet * wet_out[i][1]]);
    }
    if (this.q === 3) this.wowAndFlutter(block);
    for (const fr of block) this.limiter(this.lim_pre, fr);
    this.reverb(block, P.reverb);
    // FLØCK output stage (not Beads): with AUTO gain the output is divided by the input gain
    for (let i = 0; i < n; i++) {
      this.limiter(this.lim_out, block[i]);
      const comp = Praw.agc ? 1 / this.gainTrace[i] : 1;
      outL[at0 + i] = block[i][0] * comp; outR[at0 + i] = block[i][1] * comp;
    }
  }
  // GranularProcessor::ProcessInternal (granular mode) for one block of core samples
  coreBlock(P, trig, input, freeze, wet_out) {
    const n = input.length;
    const fbInc = (P.feedback - this.feedback) / n;
    const max_feedback_gain = 3;
    const lp_coefficient = { 8: 0.75, 12: 0.9, 16: 0.999 }[this.bits];
    const soft_limit_gain = { 8: 1.75, 12: 1.3, 16: 0 }[this.bits];
    for (let i = 0; i < n; i++) {
      this.feedback += fbInc;
      const fb = this.feedback;
      const inp = input[i];
      let s;
      if (soft_limit_gain) { const gain = max_feedback_gain / soft_limit_gain; s = [inp[0] + this.prev[0] * fb * gain, inp[1] + this.prev[1] * fb * gain]; }
      else s = [inp[0] + this.prev[0] * fb * fb * max_feedback_gain, inp[1] + this.prev[1] * fb * fb * max_feedback_gain];
      this.limiter(this.lim_in, s);
      if (soft_limit_gain) {
        s = [SoftClip(s[0] * soft_limit_gain), SoftClip(s[1] * soft_limit_gain)];
        s = [inp[0] + fb * (s[0] - inp[0]), inp[1] + fb * (s[1] - inp[1])];
      }
      const out = [0, 0];
      this.writeFrame(s, freeze[i]);
      this.playerRender(trig[i], P, out);
      this.prev[0] = ONE_POLE(this.prev[0], this.svfHP(this.dc[0], out[0]), lp_coefficient);
      this.prev[1] = ONE_POLE(this.prev[1], this.svfHP(this.dc[1], out[1]), lp_coefficient);
      wet_out.push(out);
    }
  }
  // fx/wow_and_flutter.h Process(block)
  wowAndFlutter(block) {
    const w = this.wf, size = block.length;
    const sine = (o, f) => { o[0] += f; if (o[0] >= 1) o[0] -= 1; return 0.5 + 0.5 * lutSine(o[0]); };
    const rp = [w.rph], previous_phase = w.rph;
    const random_modulation = sine(rp, w.rf * size); w.rph = rp[0];
    if (w.rph >= 0.25 && previous_phase < 0.25) w.rf = (1 / 24000) * (0.05 + this.R() * 0.2) * 24000 / this.sr;
    const fm = 0.5 + 1.5 * random_modulation * random_modulation;
    const amount = (1 - 0.4 * random_modulation) * 1;
    const wp_ = [w.wph]; const wow = sine(wp_, w.one_hertz * 0.23 * size * fm); w.wph = wp_[0];
    const fp_ = [w.fph]; const flutter = sine(fp_, w.one_hertz * 1.99 * size); w.fph = fp_[0];
    const delay = (1 + (105 * wow + 17 * flutter) * amount) * this.sr / 24000;
    const inc = (delay - w.delay) / size;
    for (const fr of block) {
      w.delay += inc;
      const di = Math.trunc(w.delay), df = w.delay - di;
      for (let ch = 0; ch < 2; ch++) {
        const line = w.line[ch];
        line[w.wp] = fr[ch];
        const p = (w.wp - 1 + 1024) % 1024;
        const a = line[(p + di) % 1024], b = line[(p + di + 1) % 1024];
        w.lps[ch] = ONE_POLE(w.lps[ch], a + (b - a) * df, w.lp);
      }
      w.wp = (w.wp - 1 + 1024) % 1024;
      fr[0] = w.lps[0]; fr[1] = w.lps[1];
    }
  }
  run(P, inL, inR) {
    const n = inL.length, outL = new Float64Array(n), outR = new Float64Array(n);
    for (let at = 0; at < n; at += this.BLK) this.processBlock(P, inL, inR, outL, outR, at, Math.min(this.BLK, n - at));
    return [outL, outR];
  }
}

// The whole device at the host rate (v0.4.1: no codec converters). phases: [{ hostSamples, P }].
function runHost(hostSr, quality, random, phases, inL, inR) {
  const ref = new Ref(hostSr, random, quality);
  const N = inL.length, oL = new Float64Array(N), oR = new Float64Array(N);
  let h0 = 0;
  for (const ph of phases) {
    const h1 = h0 + ph.hostSamples;
    if ((h1 - h0) % ref.BLK !== 0 && h1 < N) throw new Error("phase not aligned to blocks");
    for (let b = h0; b < h1; b += ref.BLK) ref.processBlock(ph.P, inL, inR, oL, oR, b, Math.min(ref.BLK, h1 - b));
    h0 = h1;
  }
  return [oL, oR, ref];
}

// knob values (0..1, as the device sends them) → module parameters (C++ units)
function fromKnobs(k) {
  const rp = (base, amt, cv, has) => ({ base, attenuverter: attenuverterLaw(amt), cv: cv || 0, has_cv: !!has });
  return {
    time: rp(k.time, k.time_amt), size: rp(k.size, k.size_amt), shape: rp(k.shape, k.shape_amt),
    pitch: rp(detuneLaw(k.pitch), k.pitch_amt),
    agc: k.agc > 0.5, ingain: k.ingain === undefined ? 1 : k.ingain, dn_amt: k.dn_amt === undefined ? 1 : k.dn_amt,
    density: k.density, fbk: k.feedback, dwk: k.drywet, rvk: k.reverb, freeze: k.freeze > 0.5, seedState: k.seedlatch > 0.5 ? 2 : (k.seed > 0.5 || k.ktrig > 0.5) ? 1 : 0,
    kon: k.kon > 0.5, knote: k.knote || 0,
  };
}

module.exports = { Ref, fromKnobs, attenuverterLaw, detuneLaw, BLOCK, runHost, QUALITY, Lin2MuLaw, MuLaw2Lin };
