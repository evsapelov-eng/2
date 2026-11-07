// rhythmic.js: RHYTHMIC generator.
//
// Genotype: one to three rhythmic layers. Each layer is a rotated Euclidean
// cycle of its own length n (so layers of 16, 12, 7... steps run against each
// other: polyrhythm/polymeter), plus genes for syncopation (pulses shifted off
// the grid), accent displacement (an accent every 3/4/5 pulses runs across the
// bar), long/short duration patterns, dropped pulses (breaks) and a chord-tone
// sequence that ties the rhythm to the shared harmony.
//
// Layer: { n, k, rot, kx, shift[n], drops[32], w[32], tones[], oct, vel,
//          accEvery, accOff, durPat[], legato }
// Voice: { type:'rhythmic', role, layers[], chord: notes per hit (1-3) }
//
// Traditions with their own rhythmic cycles (Arabic iqa'at, Hindustani talas,
// Persian reng/zarbi, Greek poetic feet) seed the main layer with that cycle:
// { pat[n] onsets, accs[n] strong strokes (dum, tali, sam), soft[n] khali }.
// Such a layer keeps its cycle under mutation (no pulse/rotation/meter
// changes); only breaks, syncopation, tones and articulation vary.

GO.Rhythmic = (function () {
  var U = GO.util, H = GO.Harmony;
  var ODD = [3, 5, 6, 7, 9, 12];

  function hit(i, k, n, rot) { return U.mod((i + rot) * k, n) < k; }
  function layerHit(L, li, k) { return L.pat ? L.pat[li] === 1 : hit(li, k, L.n, L.rot); }
  function mask(n, list) { var a = [], i; for (i = 0; i < n; i++) a.push(0); for (i = 0; i < list.length; i++) a[list[i]] = 1; return a; }

  function arr(rng, len, f) { var a = [], i; for (i = 0; i < len; i++) a.push(f(rng)); return a; }

  function newLayer(rng, P, spec) {
    var n = spec.n, L = {
      n: n, k: spec.k, rot: spec.rot || 0, kx: rng.int(0, 3), oct: spec.oct || 0,
      vel: spec.vel, tones: spec.tones, accEvery: rng.pick([3, 4, 4, 5]), accOff: rng.int(0, 3),
      durPat: P.complexity < 0.3 ? [1] : rng.pick([[1], [1, 0.4], [1, 0.4, 0.4], [0.4, 1], [1, 1, 0.4]]),
      legato: spec.legato || 0.5 + rng.next() * 0.4,
      shift: arr(rng, n, function () { return 0; }),
      drops: arr(rng, 32, function (r) { return r.chance(0.04 + 0.14 * P.variation) ? 1 : 0; }),
      w: arr(rng, 32, function (r) { return r.next(); })
    };
    if (spec.cyc) {
      L.pat = mask(n, spec.cyc.on); L.accs = mask(n, spec.cyc.acc); L.soft = mask(n, spec.cyc.soft);
      L.cyc = spec.cyc.name; L.k = spec.cyc.on.length; L.rot = 0;
    }
    var i, ps = (spec.cyc ? 0.04 : 0.08) + 0.18 * P.variation + 0.1 * P.complexity;
    for (i = 0; i < n; i++) if (layerHit(L, i, L.k) && i > 0 && rng.chance(ps)) L.shift[i] = rng.chance(0.65) ? -1 : 1;
    return L;
  }

  function toneSeq(rng, len, pool) { var a = [], i; for (i = 0; i < len; i++) a.push(rng.pick(pool)); a[0] = pool[0]; return a; }

  function generate(rng, role, P, frame) {
    var layers = [], c = P.complexity, chord = 1, base, rules = frame.rules;
    if (role === 'bass') {
      base = { n: 16, k: rng.pick([2, 3, 4, 5]), rot: rng.pick([0, 0, 0, 3]),
               tones: rng.chance(0.5) ? [0] : toneSeq(rng, rng.pick([2, 4]), [0, 0, 2, 3]), vel: 98 };
    } else if (role === 'harmony') {
      var n8 = rng.chance(0.4);
      base = { n: n8 ? 8 : 16, k: n8 ? rng.pick([2, 3]) : rng.pick([3, 5, 6]), rot: rng.int(0, 2),
               tones: [0], vel: 76, legato: 0.45 };
      chord = rng.pick([2, 3, 3]);
    } else if (role === 'melody') {
      base = { n: 16, k: rng.pick([5, 6, 7, 9]), rot: rng.int(0, 3),
               tones: toneSeq(rng, rng.int(3, 5), [0, 1, 2, 3, 4]), vel: 90 };
    } else {
      base = rng.chance(0.5) ? { n: 16, k: 4, rot: 2, tones: toneSeq(rng, 2, [2, 3, 4]), vel: 68 }
                             : { n: rng.pick(ODD), k: 0, rot: 0, tones: toneSeq(rng, 3, [1, 2, 3, 4]), vel: 68 };
      if (!base.k) base.k = rng.int(2, Math.max(2, Math.floor(base.n / 2)));
    }
    if (rules.rhythms && rng.chance(role === 'harmony' ? 0.5 : 0.8)) {
      var cy = rng.pick(rules.rhythms);
      base.cyc = cy; base.n = cy.n;
    }
    layers.push(newLayer(rng, P, base));
    var extra = (rng.chance(c) ? 1 : 0) + (c > 0.8 && rng.chance(c - 0.5) ? 1 : 0);
    if (role === 'harmony') extra = Math.min(extra, 1);
    var e;
    for (e = 0; e < extra; e++) layers.push(newLayer(rng, P, extraSpec(rng, role, P)));
    return { type: 'rhythmic', role: role, layers: layers, chord: chord };
  }

  function extraSpec(rng, role, P) {
    var n = rng.chance(0.3 + 0.5 * P.variation) ? rng.pick(ODD) : rng.pick([8, 16]);
    return { n: n, k: rng.int(1, Math.max(1, Math.floor(n / 2))), rot: rng.int(0, n - 1),
             tones: toneSeq(rng, rng.int(1, 3), role === 'bass' ? [0, 2, 3] : [1, 2, 3, 4]),
             oct: role === 'bass' ? 0 : rng.pick([0, 1]), vel: role === 'bass' ? 84 : 72 };
  }

  function renderLayer(L, g, ctx, len, base, notes) {
    var F = ctx.frame, n = F.n, dens = ctx.density;
    var k = L.k + (dens > 0.75 ? Math.round((dens - 0.75) * 4 * L.kx) : 0);
    k = Math.min(k, L.n);
    var on = [], t, occ = 0;
    for (t = 0; t < len; t++) {
      var li = t % L.n;
      if (!layerHit(L, li, k)) continue;
      var o = occ++;
      if (L.drops[o % 32] || L.w[o % 32] >= dens / 0.75) continue;
      var tt = U.clamp(t + (L.shift[li] || 0), 0, len - 1);
      on.push({ t: tt, o: o, li: li });
    }
    var ev = [], i, j;
    for (i = 0; i < on.length; i++) {
      var x = on[i], next = i + 1 < on.length ? on[i + 1].t : len;
      if (next <= x.t) continue;
      var gap = next - x.t;
      var d = Math.max(1, Math.round(gap * L.legato * L.durPat[x.o % L.durPat.length]));
      var chord = F.chordAt(x.t);
      // traditions without chords: bass and harmony layers play the drone tones
      if (F.kind === 'static' && (g.role === 'bass' || g.role === 'harmony')) chord = { root: 0, tones: F.drone() };
      var ti = L.tones[x.o % L.tones.length];
      var acc, down;
      if (L.pat) { acc = L.accs[x.li] ? 18 : 0; down = L.soft[x.li] ? -14 : 0; }
      else { acc = U.mod(x.o - L.accOff, L.accEvery) === 0 ? 18 : 0; down = x.t % ctx.spb === 0 ? 6 : 0; }
      var v = U.clamp(Math.round(L.vel * ctx.vel / 90) + acc + down - 6, 20, 127);
      for (j = 0; j < notes; j++) {
        var D = F.fold(base + L.oct * n + H.toneDegree(chord, ti + j, n), x.t, ctx.lo, ctx.hi);
        ev.push(F.event(x.t, Math.min(d, len - x.t), F.pitch(D, x.t), v));
      }
    }
    return ev;
  }

  function render(g, ctx) {
    var F = ctx.frame, len = ctx.len, center = Math.round((ctx.lo + ctx.hi) / 2);
    var base = F.tonicBelow(center);
    if (g.role === 'bass' || g.role === 'harmony') base = F.tonicBelow(ctx.lo + 5);
    var ev = [], i;
    // only the main layer is voiced as a chord; added layers are single tones
    for (i = 0; i < g.layers.length; i++) ev = ev.concat(renderLayer(g.layers[i], g, ctx, len, base, i === 0 ? g.chord : 1));
    ev.sort(function (a, b) { return a.t - b.t || a.p - b.p; });
    // no duplicate or overlapping notes of the same pitch inside the voice
    var out = [], last = {};
    for (i = 0; i < ev.length; i++) {
      var e = ev[i], prev = last[e.p];
      if (prev && prev.t === e.t) continue;
      if (prev && prev.t + prev.d > e.t) prev.d = e.t - prev.t;
      last[e.p] = e;
      out.push(e);
    }
    return out;
  }

  // ---- mutation ----------------------------------------------------------

  function anyLayer(g, rng) { return g.layers[rng.int(0, g.layers.length - 1)]; }

  var OPS = {
    pulses: function (g, rng) { var L = anyLayer(g, rng); if (!L.pat) L.k = U.clamp(L.k + rng.sign(), 1, L.n - 1); },
    rotate: function (g, rng, P) { var L = anyLayer(g, rng); if (!L.pat) L.rot = U.mod(L.rot + rng.sign() * rng.int(1, 1 + Math.round(P.amount * 2)), L.n); },
    meter: function (g, rng, P) {
      if (P.complexity < 0.4) return;
      var L = anyLayer(g, rng), opts = [3, 4, 5, 6, 7, 8, 9, 12, 16], i = opts.indexOf(L.n);
      if (L.pat) return;
      var n = opts[U.clamp((i < 0 ? 7 : i) + rng.sign(), 0, opts.length - 1)];
      var sh = [], j;
      for (j = 0; j < n; j++) sh.push(L.shift[j] || 0);
      L.n = n; L.shift = sh; L.k = U.clamp(L.k, 1, n - 1); L.rot = U.mod(L.rot, n);
    },
    sync: function (g, rng, P) {
      var L = anyLayer(g, rng), i;
      for (i = 1; i < L.n; i++) {
        if (layerHit(L, i, L.k) && rng.chance(P.prob * 0.6)) L.shift[i] = L.shift[i] ? 0 : (rng.chance(0.65) ? -1 : 1);
      }
    },
    drops: function (g, rng, P) {
      var L = anyLayer(g, rng), i, touched = false;
      for (i = 1; i < 32; i++) if (rng.chance(P.prob * 0.3)) { L.drops[i] = L.drops[i] ? 0 : 1; touched = true; }
      if (!touched) { i = rng.int(1, 31); L.drops[i] = L.drops[i] ? 0 : 1; }
    },
    tones: function (g, rng, P) {
      var L = anyLayer(g, rng), i;
      if (L.tones.length < 6 && rng.chance(0.3 * P.complexity)) L.tones.push(rng.int(0, 4));
      for (i = 0; i < L.tones.length; i++) if (rng.chance(P.prob)) L.tones[i] = U.clamp(L.tones[i] + rng.sign(), 0, 5);
    },
    durations: function (g, rng) {
      var L = anyLayer(g, rng);
      if (rng.chance(0.5)) L.durPat = rng.pick([[1], [1, 0.4], [1, 0.4, 0.4], [0.4, 1], [1, 1, 0.4], [0.4, 0.4, 1]]);
      else L.legato = U.clamp(L.legato + rng.sign() * 0.15, 0.25, 1);
    },
    accent: function (g, rng) {
      var L = anyLayer(g, rng);
      if (rng.chance(0.5)) L.accEvery = rng.pick([2, 3, 4, 5, 7]); else L.accOff = rng.int(0, 4);
    },
    layer: function (g, rng, P) {
      if (P.amount < 0.5) return;
      if (g.layers.length < 1 + Math.round(P.complexity * 2) && g.layers.length < 3) {
        g.layers.push(newLayer(rng, P, extraSpec(rng, g.role, P)));
      } else if (g.layers.length > 1) g.layers.pop();
    },
    genes: function (g, rng, P) {
      var L = anyLayer(g, rng), i;
      for (i = 0; i < 32; i++) if (rng.chance(P.prob * 0.4)) L.w[i] = U.clamp(L.w[i] + (rng.next() - 0.5) * (0.4 + P.amount), 0, 0.999);
      if (rng.chance(0.3)) L.kx = rng.int(0, 3);
    },
    chord: function (g, rng) { if (g.role === 'harmony') g.chord = U.clamp(g.chord + rng.sign(), 1, 3); }
  };

  function mutate(g0, rng, P) {
    var g = U.clone(g0), a = P.amount, c = P.complexity;
    var table = [['pulses', 0.18], ['rotate', 0.14], ['meter', 0.06 * c], ['sync', 0.12], ['drops', 0.12],
                 ['tones', 0.14], ['durations', 0.08], ['accent', 0.08], ['layer', 0.05 * a],
                 ['genes', 0.06], ['chord', g.role === 'harmony' ? 0.05 : 0]];
    var count = 1 + Math.floor(a * 3 + rng.next() * a * 2), k;
    for (k = 0; k < count; k++) OPS[rng.table(table)](g, rng, P);
    return g;
  }

  return { generate: generate, render: render, mutate: mutate, hit: hit };
})();
