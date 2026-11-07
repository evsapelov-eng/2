// evolution.js: the organism: DNA of the four voices plus the shared harmony,
// mutation with STABILITY control, history for REVERT, FREEZE, RESET DNA.
//
// DNA = { gen, seed, harmony, voices: [genotype x4] }
// The DNA is kept separately from playback: render() produces note events from
// DNA + current settings; the MIDI engine only ever sees rendered patterns.
// A mutation is built on a copy and only replaces the current DNA once it
// passed the stability check, so the previous generation is never destroyed
// before a new one exists.

GO.Organism = (function () {
  var U = GO.util, S = GO.Scales, G = GO.Generator, Sim = GO.Similarity;
  var HISTORY = 8;

  function defaultParams() {
    var v = [], i;
    for (i = 0; i < 4; i++) {
      var r = GO.Roles[i];
      v.push({ on: true, ch: i + 1, lo: r.lo, hi: r.hi, dens: 0, mut: 1 });
    }
    return {
      gen: 'melodic', key: 0, scale: 1, bars: 2, density: 0.75,
      evo: 'manual', every: 2, amount: 0.5, prob: 0.5, stability: 0.5,
      complexity: 0.5, variation: 0.5, frozen: false, spb: 16, voices: v
    };
  }

  function Organism(params, seed) {
    this.params = params || defaultParams();
    this.rng = new U.Rng(seed || 1);
    this.dna = null; this.origin = null; this.prev = []; this.generation = 0;
    this.renderCache = null;
  }

  // genes are kept at 3 decimals so a saved Live Set restores exactly the same DNA
  function round3(k, x) { return typeof x === 'number' && x % 1 !== 0 ? Math.round(x * 1000) / 1000 : x; }
  function quantize(dna) { return JSON.parse(JSON.stringify(dna, round3)); }

  Organism.prototype.mutationParams = function (scale) {
    var p = this.params;
    return { amount: U.clamp(p.amount * (scale === undefined ? 1 : scale), 0, 1), prob: p.prob,
             complexity: p.complexity, variation: p.variation, stability: p.stability,
             bars: p.bars, spb: p.spb };
  };

  Organism.prototype.newDNA = function (seed) {
    var p = this.params, rng = new U.Rng(seed), scale = S.get(p.scale), n = scale.steps.length, i;
    var P = this.mutationParams();
    var dna = { gen: p.gen, seed: seed, harmony: GO.Harmony.generate(rng, scale, p.complexity), voices: [] };
    for (i = 0; i < 4; i++) dna.voices.push(G.generate(p.gen, rng, GO.Roles[i].id, P, n));
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

  Organism.prototype.ensure = function () { if (!this.dna || this.dna.gen !== this.params.gen) this.reset(); };

  Organism.prototype.ctx = function (i) {
    var p = this.params, v = p.voices[i];
    return { scale: S.get(p.scale), key: p.key, harmony: this.dna.harmony, bars: p.bars, spb: p.spb,
             lo: Math.min(v.lo, v.hi), hi: Math.max(v.lo, v.hi), density: U.clamp(p.density + v.dens, 0, 1),
             vel: GO.Roles[i].vel };
  };

  // note events of all voices for a DNA under the current settings
  Organism.prototype.renderDNA = function (dna, includeOff) {
    var save = this.dna, out = [], i;
    this.dna = dna;
    var all = [];
    for (i = 0; i < 4; i++) {
      var g = dna.voices[i];
      var src = (g.type === 'melodic' && g.imit) ? all[2] : null;
      all.push(G.render(g, this.ctx(i), src));
    }
    this.dna = save;
    for (i = 0; i < 4; i++) out.push(includeOff || this.params.voices[i].on ? all[i] : []);
    return out;
  };

  Organism.prototype.render = function () {
    this.ensure();
    if (!this.renderCache) this.renderCache = this.renderDNA(this.dna);
    return this.renderCache;
  };
  Organism.prototype.invalidate = function () { this.renderCache = null; };

  // copy one sub-gene back from the original idea ("return of the theme")
  function home(child, origin, i, rng) {
    var g = child.voices[i], o = origin.voices[i];
    if (!o || o.type !== g.type) return;
    if (g.type === 'melodic') {
      var what = rng.pick(['motif', 'ops', 'anchor', 'motif']);
      if (what === 'motif') { g.cells = U.clone(o.cells); g.motifSteps = o.motifSteps; }
      else if (what === 'ops') g.ops = U.clone(o.ops);
      else { g.anchor = o.anchor; g.reg = o.reg; }
    } else {
      var j = rng.int(0, Math.min(g.layers.length, o.layers.length) - 1);
      if (j >= 0) g.layers[j] = U.clone(o.layers[j]);
    }
  }

  Organism.prototype.mutateOnce = function (scaleAmount) {
    var p = this.params, rng = this.rng, scale = S.get(p.scale), n = scale.steps.length;
    var child = U.clone(this.dna), P = this.mutationParams(scaleAmount), i, any = false;
    var active = [];
    for (i = 0; i < 4; i++) if (p.voices[i].on && p.voices[i].mut > 0) active.push(i);
    if (!active.length) return null;
    for (i = 0; i < active.length; i++) {
      var vi = active[i], vm = p.voices[vi].mut;
      if (!rng.chance(0.35 + 0.65 * p.prob)) continue;
      var Pv = U.clone(P); Pv.amount *= vm; Pv.prob *= vm;
      child.voices[vi] = G.mutate(child.voices[vi], rng, Pv, n);
      if (rng.chance(p.stability * 0.3)) home(child, this.origin, vi, rng);
      any = true;
    }
    if (!any) {
      var only = rng.pick(active);
      child.voices[only] = G.mutate(child.voices[only], rng, P, n);
    }
    if (rng.chance(0.12 * P.amount * (1 - p.stability))) child.harmony = GO.Harmony.mutate(child.harmony, rng, P, scale);
    return child;
  };

  // minimum similarity to the original idea that STABILITY allows
  Organism.prototype.stabilityFloor = function () {
    return 0.92 * Math.pow(this.params.stability, 1.3);
  };

  // MUTATE. Returns true if the material changed.
  Organism.prototype.mutate = function () {
    this.ensure();
    if (this.params.frozen) return false;
    var parentR = this.renderDNA(this.dna, true), originR = this.renderDNA(this.origin, true);
    var floor = this.stabilityFloor(), best = null, bestSim = -1, attempt;
    for (attempt = 0; attempt < 8; attempt++) {
      var child = this.mutateOnce(Math.pow(0.65, attempt));
      if (!child) return false;
      var R = this.renderDNA(child, true);
      if (Sim.organism(R, parentR) > 0.999) continue;          // no audible change
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

  // REVERT: back to the previous DNA
  Organism.prototype.revert = function () {
    if (!this.prev.length) return false;
    this.dna = this.prev.pop();
    if (this.generation > 0) this.generation--;
    if (this.dna.gen !== this.params.gen) this.params.gen = this.dna.gen;
    this.renderCache = null;
    return true;
  };

  // pattern for the MIDI engine
  Organism.prototype.pattern = function () {
    var R = this.render(), p = this.params, v = [], i;
    for (i = 0; i < 4; i++) v.push({ ch: p.voices[i].ch, on: p.voices[i].on, ev: R[i] });
    return { len: p.bars * p.spb, spb: p.spb, voices: v };
  };

  Organism.prototype.serialize = function () {
    return JSON.stringify({ v: 1, dna: this.dna, origin: this.origin, prev: this.prev,
                            generation: this.generation, rng: this.rng.s });
  };

  Organism.prototype.restore = function (json) {
    var o = JSON.parse(json);
    if (!o || o.v !== 1 || !o.dna) return false;
    this.dna = o.dna; this.origin = o.origin || o.dna; this.prev = o.prev || [];
    this.generation = o.generation || 0; this.rng.s = o.rng || 1;
    this.params.gen = this.dna.gen;
    this.renderCache = null;
    return true;
  };

  return { Organism: Organism, defaultParams: defaultParams };
})();
