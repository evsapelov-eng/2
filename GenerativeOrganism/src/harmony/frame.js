// frame.js: the tonal frame every generator reads.
//
// It combines the active system rules (Western mode or historical system),
// the harmonic source and the cycle length, and answers:
//   chordAt(t)        { root, tones (degree classes), steps (local), label }
//   pitch(D, t, alt, dir)  float MIDI pitch of degree D at step t
//   fold / degreeOf / tonicBelow / inScale / segments / event
// Harmonic sources:
//   'modal'    root-progression gene (Western and Renaissance 'chords' systems)
//   'static'   no Western chords: centre tones of the tradition (final,
//              repercussa/ghammaz/vadi...) and its drone
//   'library'  Harmony Library events, each turned into a local chord-scale:
//              chord tones replace the nearest scale degree, so chromatic
//              chords keep the 7-degree arithmetic of the generators.

GO.Frame = (function () {
  var U = GO.util, H = GO.Harmony;

  function Frame(o) {
    this.key = o.key;
    this.rules = o.rules;
    this.steps = o.rules.steps;
    this.n = this.steps.length;
    this.spb = o.spb;
    this.len = o.len;
    this.gene = o.harmony;           // harmony gene (modal source)
    this.lib = o.lib || null;        // { events, len } in steps
    this.kind = this.lib ? 'library' : (o.rules.harmony === 'chords' ? 'modal' : 'static');
    this.cache = {};
  }

  function near(a, b) { var d = Math.abs(U.mod(a - b + 6, 12) - 6); return d < 0.02; }

  function localize(base, pcs) {
    var steps = base.slice(), tones = [], fixed = {}, i, j;
    for (i = 0; i < pcs.length; i++) {
      var pc = pcs[i], found = -1;
      for (j = 0; j < steps.length; j++) if (near(steps[j], pc)) { found = j; break; }
      if (found < 0) {
        var best = -1, bd = 99;
        for (j = 0; j < steps.length; j++) {
          if (fixed[j]) continue;
          var d = Math.abs(U.mod(pc - steps[j] + 6, 12) - 6);
          if (d < bd) { bd = d; best = j; }
        }
        if (best >= 0 && bd <= 1.01) {
          var cand = steps.slice(), v = U.mod(pc, 12);
          if (best === 0 && v > 6) v -= 12;
          cand[best] = v;
          var ok = true;
          for (j = 1; j < cand.length; j++) if (cand[j] <= cand[j - 1]) ok = false;
          if (ok) { steps = cand; found = best; }
        }
      }
      if (found >= 0 && !fixed[found]) { fixed[found] = true; tones.push(found); }
    }
    return { steps: steps, tones: tones };
  }

  Frame.prototype.libEventAt = function (t) {
    var ev = this.lib.events, tt = U.mod(t, this.lib.len), i;
    for (i = ev.length - 1; i >= 0; i--) if (ev[i].t <= tt) return i;
    return 0;
  };

  Frame.prototype.chordAt = function (t) {
    var key, c;
    if (this.kind === 'library') {
      var i = this.libEventAt(t);
      key = 'L' + i;
      if (this.cache[key]) return this.cache[key];
      var e = this.lib.events[i], loc = localize(this.steps, e.pcs);
      var rootIdx = loc.tones.length ? loc.tones[0] : 0;
      c = { root: rootIdx, tones: loc.tones.length ? loc.tones : [0], steps: loc.steps, label: e.label, id: key, pcs: e.pcs };
    } else if (this.kind === 'modal') {
      var bars = Math.max(1, Math.ceil(this.len / this.spb));
      var roots = H.rootsFor(this.gene, bars);
      var bar = Math.floor(U.mod(t, this.len) / this.spb) % roots.length;
      key = 'M' + bar;
      if (this.cache[key]) return this.cache[key];
      var n = this.n, r = U.mod(roots[bar], n);
      var tones = [r, U.mod(r + 2, n), U.mod(r + 4, n)];
      if (this.gene.seventh && !this.rules.noSevenths && n >= 7) tones.push(U.mod(r + 6, n));
      var steps = this.steps;
      // musica ficta: the dominant gets a raised third (subtonium -> leading tone)
      if (this.rules.ficta && r === 4 && n === 7 && Math.abs(steps[6] - 10) < 0.01) { steps = steps.slice(); steps[6] = 11; }
      c = { root: r, tones: tones, steps: steps, label: 'deg ' + (r + 1), id: key };
    } else {
      key = 'S';
      if (this.cache[key]) return this.cache[key];
      var t2 = [0], add = [this.rules.half].concat(this.rules.emph || []), k;
      for (k = 0; k < add.length; k++) {
        var a = U.mod(add[k], this.n);
        if (t2.indexOf(a) < 0) t2.push(a);
      }
      c = { root: 0, tones: t2, steps: this.steps, label: 'drone', id: key };
    }
    this.cache[key] = c;
    return c;
  };

  // drone degrees of the tradition (bass/harmony voices of static systems)
  Frame.prototype.drone = function () { return this.rules.drone || [0]; };

  Frame.prototype.pitch = function (D, t, alt, dir) {
    var steps = this.chordAt(t).steps;
    if (dir < 0 && this.rules.down && this.kind !== 'library') steps = this.rules.down;
    return this.key + steps[U.mod(D, this.n)] + 12 * Math.floor(D / this.n) + (alt || 0);
  };

  Frame.prototype.tonicBelow = function (p) { return this.n * Math.floor((p - this.key) / 12); };

  Frame.prototype.degreeOf = function (p, t) {
    var D = this.tonicBelow(p) - this.n, best = D, bd = 999, i;
    for (i = 0; i < 3 * this.n; i++) {
      var d = Math.abs(this.pitch(D + i, t) - p);
      if (d < bd - 1e-9) { bd = d; best = D + i; }
    }
    return best;
  };

  Frame.prototype.fold = function (D, t, lo, hi) {
    var p = this.pitch(D, t), guard = 0;
    while (p > hi + 0.01 && guard++ < 20) { D -= this.n; p = this.pitch(D, t); }
    while (p < lo - 0.01 && guard++ < 40) { D += this.n; p = this.pitch(D, t); }
    while (p > hi + 0.01 && guard++ < 60) { D -= 1; p = this.pitch(D, t); }
    return D;
  };

  Frame.prototype.inScale = function (p, t) {
    var pc = U.mod(p - this.key, 12), lists = [this.chordAt(t).steps], i, j;
    if (this.rules.down) lists.push(this.rules.down);
    if (this.rules.ficta && this.n === 7) { var f = this.steps.slice(); f[6] = this.steps[6] + 1; lists.push(f); }   // musica ficta
    for (j = 0; j < lists.length; j++) for (i = 0; i < lists[j].length; i++) if (near(lists[j][i], pc)) return true;
    return false;
  };

  // harmonic segments of the cycle: [{ t, d, chord }]
  Frame.prototype.segments = function () {
    var out = [], t, cur = null;
    for (t = 0; t < this.len; t++) {
      var c = this.chordAt(t);
      if (!cur || cur.chord.id !== c.id) { cur = { t: t, d: 0, chord: c }; out.push(cur); }
      cur.d++;
    }
    return out;
  };

  // note event from a float pitch: integer note + cents for pitch bend
  Frame.prototype.event = function (t, d, pf, v) {
    var p = Math.round(pf), c = Math.round((pf - p) * 100);
    if (p < 0) p = 0; if (p > 127) p = 127;
    var e = { t: t, d: d, p: p, v: U.clamp(Math.round(v), 1, 127) };
    if (c) e.c = c;
    return e;
  };

  // MIDI pitch (with cents) of an event, for analysis
  function fpitch(e) { return e.p + (e.c || 0) / 100; }

  return { Frame: Frame, localize: localize, fpitch: fpitch };
})();
