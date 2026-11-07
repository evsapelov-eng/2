// evolution.js: the organism: DNA of the four voices plus the shared harmony,
// mutation with STABILITY control, history for REVERT, FREEZE, RESET DNA,
// variation slots (APC40 grid / crossfader morph) and captured material.
//
// DNA = { gen, sys, seed, harmony, voices: [genotype x4] }
// The DNA is kept separately from playback: render() produces note events from
// DNA + current settings; the MIDI engine only ever sees rendered patterns.
// A mutation is built on a copy and only replaces the current DNA once it
// passed the stability check, so the previous generation is never destroyed
// before a new one exists.

GO.Organism = (function () {
  var U = GO.util, S = GO.Scales, G = GO.Generator, Sim = GO.Similarity;
  var HISTORY = 8, SLOTS = 8, CAPTURES = 8, MAX_BARS = 16;

  function defaultParams() {
    var v = [], i;
    for (i = 0; i < 4; i++) {
      var r = GO.Roles[i];
      v.push({ on: true, ch: i + 1, lo: r.lo, hi: r.hi, dens: 0, mut: 1 });
    }
    return {
      gen: 'melodic', key: 0, scale: 1, sysCat: 0, sysVar: 1, bars: 2, density: 0.75,
      lib: 0, prog: 1, hlen: 1, micro: true, free: false,
      evo: 'manual', every: 2, amount: 0.5, prob: 0.5, stability: 0.5,
      complexity: 0.5, variation: 0.5, frozen: false, spb: 16, voices: v
    };
  }

  function Organism(params, seed) {
    this.params = params || defaultParams();
    this.rng = new U.Rng(seed || 1);
    this.dna = null; this.origin = null; this.prev = []; this.generation = 0;
    this.slots = []; this.captures = []; this.userProgs = [];
    this.renderCache = null; this.libError = null;
  }

  function round3(k, x) { return typeof x === 'number' && x % 1 !== 0 ? Math.round(x * 1000) / 1000 : x; }
  function quantize(dna) { return JSON.parse(JSON.stringify(dna, round3)); }
  function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }

  // ---- tonal system, harmony source, cycle -------------------------------

  Organism.prototype.rules = function () {
    var p = this.params;
    if (p.sysCat > 0) { var r = GO.Systems.resolve(p.sysCat, p.sysVar); if (r) return r; }
    return S.get(p.scale);
  };
  Organism.prototype.systemId = function () { return this.params.sysCat > 0 ? this.rules().id : 'western'; };

  // selected Harmony Library progression compiled to steps, or null
  Organism.prototype.progression = function () {
    var p = this.params;
    this.libError = null;
    if (!p.lib) return null;
    var pr = GO.Library.resolve(p.lib, p.prog, this.userProgs);
    if (!pr) { this.libError = 'empty user slot ' + p.prog; return null; }
    try {
      var mode = S.byId(pr.mode);
      var parsed = GO.Library.parse(pr.chords, mode.steps, p.key);
      var st = GO.Library.toSteps(parsed, p.spb, p.hlen);
      st.name = pr.name; st.mode = mode; st.text = pr.chords; st.logic = pr.logic;
      return st;
    } catch (e) { this.libError = String(e.message || e); return null; }
  };

  Organism.prototype.cycleLen = function (lib) {
    var p = this.params, base = p.bars * p.spb;
    if (!lib) return base;
    var l = base * lib.len / gcd(base, lib.len);
    return l <= MAX_BARS * p.spb ? l : lib.len;
  };

  Organism.prototype.frame = function (dna) {
    var p = this.params, lib = this.progression(), rules = this.rules();
    if (lib) rules = lib.mode;                       // a progression brings its own mode
    return new GO.Frame.Frame({ key: p.key, rules: rules, spb: p.spb, len: this.cycleLen(lib),
                                harmony: (dna || this.dna).harmony, lib: lib });
  };

  Organism.prototype.mutationParams = function (scale) {
    var p = this.params;
    return { amount: U.clamp(p.amount * (scale === undefined ? 1 : scale), 0, 1), prob: p.prob,
             complexity: p.complexity, variation: p.variation, stability: p.stability,
             bars: p.bars, spb: p.spb, len: p.bars * p.spb };
  };

  Organism.prototype.newDNA = function (seed) {
    var p = this.params, rng = new U.Rng(seed), rules = this.rules(), i;
    var P = this.mutationParams();
    var dna = { gen: p.gen, sys: this.systemId(), seed: seed, harmony: GO.Harmony.generate(rng, rules, p.complexity), voices: [] };
    var F = this.frame(dna);
    for (i = 0; i < 4; i++) dna.voices.push(G.generate(p.gen, rng, GO.Roles[i].id, P, F));
    return quantize(dna);
  };

  Organism.prototype.pushHistory = function () {
    if (!this.dna) return;
    this.prev.push(this.dna);
    if (this.prev.length > HISTORY) this.prev.shift();
  };

  // RESET DNA: a new original idea (the old one stays reachable with REVERT)
  Organism.prototype.reset = function (seed) {
    if (seed === undefined) seed = 1 + Math.floor(this.rng.next() * 2147483646);
    this.pushHistory();
    this.dna = this.newDNA(seed);
    this.origin = this.dna;
    this.generation = 0;
    this.renderCache = null;
    return true;
  };

  // a new generator or tonal system grows a new organism (formulas, cycles...)
  Organism.prototype.ensure = function () {
    if (!this.dna || this.dna.gen !== this.params.gen || (this.dna.sys || 'western') !== this.systemId()) this.reset();
  };

  Organism.prototype.ctx = function (i, F) {
    var p = this.params, v = p.voices[i];
    return { frame: F, len: F.len, spb: p.spb, lo: Math.min(v.lo, v.hi), hi: Math.max(v.lo, v.hi),
             density: U.clamp(p.density + v.dens, 0, 1), vel: GO.Roles[i].vel, free: p.free };
  };

  Organism.prototype.renderDNA = function (dna, includeOff) {
    var F = this.frame(dna), all = [null, null, null, null], order = G.order(dna.gen), out = [], k, i;
    for (k = 0; k < order.length; k++) {
      i = order[k];
      all[i] = G.render(dna.voices[i], this.ctx(i, F), all);
    }
    for (i = 0; i < 4; i++) out.push(includeOff || this.params.voices[i].on ? all[i] : []);
    out.len = F.len;
    return out;
  };

  Organism.prototype.render = function () {
    this.ensure();
    if (!this.renderCache) this.renderCache = this.renderDNA(this.dna);
    return this.renderCache;
  };
  Organism.prototype.invalidate = function () { this.renderCache = null; };

  // ---- mutation ----------------------------------------------------------

  // copy one sub-gene back from the original idea ("return of the theme")
  function home(child, origin, i, rng) {
    var g = child.voices[i], o = origin.voices[i];
    if (!o || o.type !== g.type || o.role !== g.role) return;
    if (g.type === 'hybrid' && g.role === 'melody') { g = g.mel; o = o.mel; }
    else if (g.type === 'hybrid') { child.voices[i] = U.clone(o); return; }
    if (g.type === 'melodic' || g.cells && g.motifSteps) {
      var what = rng.pick(['motif', 'ops', 'anchor', 'motif']);
      if (what === 'motif') { g.cells = U.clone(o.cells); g.motifSteps = o.motifSteps; }
      else if (what === 'ops') g.ops = U.clone(o.ops);
      else { g.anchor = o.anchor; g.reg = o.reg; }
    } else if (g.type === 'rhythmic') {
      var j = rng.int(0, Math.min(g.layers.length, o.layers.length) - 1);
      if (j >= 0) g.layers[j] = U.clone(o.layers[j]);
    } else if (g.type === 'experimental') {
      if (rng.chance(0.5)) g.row = o.row.slice(); else { g.cells = o.cells.slice(); g.added = o.added.slice(); }
    }
  }

  Organism.prototype.mutateOnce = function (scaleAmount, only) {
    var p = this.params, rng = this.rng, F = this.frame();
    var child = U.clone(this.dna), P = this.mutationParams(scaleAmount), i, any = false;
    var active = [];
    for (i = 0; i < 4; i++) if (p.voices[i].on && p.voices[i].mut > 0 && (only === undefined || only === i)) active.push(i);
    if (!active.length) return null;
    for (i = 0; i < active.length; i++) {
      var vi = active[i], vm = p.voices[vi].mut;
      if (only === undefined && !rng.chance(0.35 + 0.65 * p.prob)) continue;
      var Pv = U.clone(P); Pv.amount *= vm; Pv.prob *= vm;
      child.voices[vi] = G.mutate(child.voices[vi], rng, Pv, F);
      if (rng.chance(p.stability * 0.3)) home(child, this.origin, vi, rng);
      any = true;
    }
    if (!any) {
      var one = rng.pick(active);
      child.voices[one] = G.mutate(child.voices[one], rng, P, F);
    }
    if (only === undefined && !p.lib && rng.chance(0.12 * P.amount * (1 - p.stability))) {
      child.harmony = GO.Harmony.mutate(child.harmony, rng, P, this.rules());
    }
    return child;
  };

  Organism.prototype.stabilityFloor = function () {
    return 0.92 * Math.pow(this.params.stability, 1.3);
  };

  // MUTATE (all voices, or only one voice). Returns true if the material changed.
  Organism.prototype.mutate = function (only) {
    this.ensure();
    if (this.params.frozen) return false;
    var parentR = this.renderDNA(this.dna, true), originR = this.renderDNA(this.origin, true);
    var floor = this.stabilityFloor(), best = null, bestSim = -1, attempt;
    for (attempt = 0; attempt < 8; attempt++) {
      var child = this.mutateOnce(Math.pow(0.65, attempt), only);
      if (!child) return false;
      var R = this.renderDNA(child, true);
      if (Sim.organism(R, parentR) > 0.999) continue;
      var simO = Sim.organism(R, originR);
      if (simO >= floor) { best = child; break; }
      if (simO > bestSim) { bestSim = simO; best = child; }
    }
    if (!best) return false;
    this.pushHistory();
    this.dna = quantize(best);
    this.generation++;
    this.renderCache = null;
    return true;
  };

  Organism.prototype.revert = function () {
    if (!this.prev.length) return false;
    this.dna = this.prev.pop();
    if (this.generation > 0) this.generation--;
    this.params.gen = this.dna.gen;
    this.renderCache = null;
    return true;
  };

  // ---- variation slots and morph (APC40 grid and crossfader) ---------------

  Organism.prototype.storeSlot = function (i) { this.ensure(); this.slots[i] = U.clone(this.dna); return true; };
  Organism.prototype.hasSlot = function (i) { return !!this.slots[i]; };
  Organism.prototype.recallSlot = function (i) {
    var s = this.slots[i];
    if (!s) return false;
    this.pushHistory();
    this.dna = U.clone(s);
    this.params.gen = this.dna.gen;
    this.renderCache = null;
    return true;
  };
  // crossfader between slot A (0) and B (1): voices switch from A to B one by
  // one as x goes from 0 to 1 (bass first); the harmony follows the majority
  Organism.prototype.morph = function (x) {
    var A = this.slots[0], B = this.slots[1], i;
    if (!A || !B || A.gen !== B.gen || (A.sys || '') !== (B.sys || '')) return false;
    var dna = U.clone(A);
    for (i = 0; i < 4; i++) if (x > (i + 0.5) / 4) dna.voices[i] = U.clone(B.voices[i]);
    if (x >= 0.5) dna.harmony = U.clone(B.harmony);
    this.dna = dna;
    this.params.gen = dna.gen;
    this.renderCache = null;
    return true;
  };

  // ---- user progressions ---------------------------------------------------

  Organism.prototype.setUserProg = function (slot, text, modeId) {
    var mode = S.byId(modeId || 'ionian');
    GO.Library.parse(text, mode.steps, this.params.key);      // throws on bad input
    this.userProgs[U.clamp(slot | 0, 1, GO.Library.USER_SLOTS) - 1] = { chords: String(text), mode: mode.id };
    this.renderCache = null;
    return true;
  };

  // ---- capture ---------------------------------------------------------

  Organism.prototype.capture = function () {
    var cap = GO.Capture.make(this);
    this.captures.push(cap);
    if (this.captures.length > CAPTURES) this.captures.shift();
    return cap;
  };

  // ---- output ----------------------------------------------------------

  Organism.prototype.pattern = function () {
    var R = this.render(), p = this.params, v = [], i;
    for (i = 0; i < 4; i++) v.push({ ch: p.voices[i].ch, on: p.voices[i].on, ev: R[i] });
    return { len: R.len, spb: p.spb, voices: v };
  };

  Organism.prototype.serialize = function () {
    return JSON.stringify({ v: 2, dna: this.dna, origin: this.origin, prev: this.prev,
                            generation: this.generation, rng: this.rng.s, slots: this.slots,
                            captures: this.captures, userProgs: this.userProgs });
  };

  Organism.prototype.restore = function (json) {
    var o = JSON.parse(json);
    if (!o || (o.v !== 1 && o.v !== 2) || !o.dna) return false;
    this.dna = o.dna; this.origin = o.origin || o.dna; this.prev = o.prev || [];
    this.generation = o.generation || 0; this.rng.s = o.rng || 1;
    this.slots = o.slots || []; this.captures = o.captures || []; this.userProgs = o.userProgs || [];
    this.params.gen = this.dna.gen;
    if (!this.dna.sys) this.dna.sys = 'western';
    this.renderCache = null;
    return true;
  };

  return { Organism: Organism, defaultParams: defaultParams, SLOTS: SLOTS };
})();
