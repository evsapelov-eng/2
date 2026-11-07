// melodic.js: MELODIC generator.
//
// Genotype (the voice's melodic DNA):
//   motifSteps  length of the motif in 16th steps (8 or 16)
//   cells[]     the motif: { d: duration, iv: interval in scale degrees from the
//               previous note, rest, acc: accent, fx: chord-affinity gene,
//               w: density rank, sp: split (passing-note) gene }
//   anchor/reg  starting degree and octave
//   ops[]       phrase plan: how each motif slot after the first restates the
//               motif (stmt, seq, var, inv, retro, frag, rest)
//   cad/period  cadence gene and antecedent/consequent (half cadence) switch
//   affinity    how strongly strong-beat notes are pulled to chord tones
//   legato      articulation
//   imit        (texture voice only) canon imitation of the melody voice
//
// render() turns genotype + harmony + settings into note events. The phrase is
// always built from the motif, so mutations of a gene show up as a coherent
// variation of the whole phrase instead of scattered random notes.

GO.Melodic = (function () {
  var U = GO.util, S = GO.Scales, H = GO.Harmony;

  var PALETTE = {
    bass:    [[4, 4], [8, 3], [2, 1], [6, 1]],
    harmony: [[8, 4], [4, 3], [6, 1], [2, 1]],
    melody:  [[4, 4], [2, 3], [8, 2], [6, 1], [1, 1], [3, 1]],
    texture: [[2, 4], [4, 3], [1, 1], [3, 1], [6, 1]]
  };
  var INTERVALS = {
    bass:    [[0, 0.12], [1, 0.18], [2, 0.18], [3, 0.26], [4, 0.2], [7, 0.06]],
    harmony: [[0, 0.3], [1, 0.45], [2, 0.2], [3, 0.05]],
    melody:  [[0, 0.1], [1, 0.4], [2, 0.22], [3, 0.1], [4, 0.08], [5, 0.04], [7, 0.02]],
    texture: [[0, 0.08], [1, 0.35], [2, 0.27], [3, 0.12], [4, 0.1], [5, 0.05], [7, 0.03]]
  };
  var AFFINITY = { bass: 0.9, harmony: 0.85, melody: 0.55, texture: 0.45 };

  function palette(role, c) {
    var src = PALETTE[role], out = [], i;
    for (i = 0; i < src.length; i++) {
      var d = src[i][0], w = src[i][1];
      if ((d === 1 || d === 3) && c < 0.35) continue;          // simple: no 16ths/dotted
      if (d === 1 || d === 3) w = w * (0.5 + 2 * c);
      out.push([d, w]);
    }
    return out;
  }

  function intervalTable(role, P) {
    var src = INTERVALS[role], out = [], i;
    for (i = 0; i < src.length; i++) {
      var s = src[i][0], w = src[i][1];
      if (s >= 3) w *= (1 + 2.5 * P.variation);
      if (s >= 4) w *= (0.5 + P.complexity);
      out.push([s, w]);
    }
    return out;
  }

  function chooseInterval(rng, role, P, prevIv, cum, n) {
    // after a leap, fill the gap stepwise in the opposite direction
    if (Math.abs(prevIv) >= 3 && rng.chance(0.75 - 0.45 * P.variation)) return -U.sign(prevIv);
    var size = rng.table(intervalTable(role, P));
    var dir = rng.sign();
    if (cum + dir * size > n + 1 || cum + dir * size < -(n - 1)) dir = -dir;
    return dir * size;
  }

  function newCell(rng, d, iv) {
    return { d: d, iv: iv, rest: false, acc: rng.next(), fx: rng.next(), w: rng.next(), sp: rng.next() };
  }

  function boundContour(cells, n) {
    var cum = 0, i;
    for (i = 1; i < cells.length; i++) {
      if (cum + cells[i].iv > n + 2 || cum + cells[i].iv < -n - 1) cells[i].iv = -cells[i].iv;
      cum += cells[i].iv;
    }
  }

  function genOp(rng, P, slot, n) {
    if (slot % 2 === 0) {     // even slots return towards the theme
      return rng.table([[{ t: 'stmt' }, 0.5], [{ t: 'var', i: rng.int(1, 7), k: rng.sign() }, 0.3],
                        [{ t: 'seq', k: rng.pick([1, -1, 2]) }, 0.2]]);
    }
    var c = P.complexity, v = P.variation;
    return rng.table([
      [{ t: 'stmt' }, 0.25],
      [{ t: 'seq', k: rng.pick([1, -1, 2, -2, 3]) }, 0.28],
      [{ t: 'var', i: rng.int(1, 7), k: rng.sign() * (rng.chance(v) ? 2 : 1) }, 0.2],
      [{ t: 'frag', k: rng.pick([0, 1, -1]) }, 0.1 + 0.1 * c],
      [{ t: 'inv' }, 0.1 * c],
      [{ t: 'retro' }, 0.08 * c],
      [{ t: 'rest' }, 0.06 * v]
    ]);
  }

  function generate(rng, role, P, n) {
    var motifSteps = rng.chance(0.4) ? 8 : 16;
    if (role === 'bass' || role === 'harmony') motifSteps = 16;
    var pal = palette(role, P.complexity), cells = [], t = 0;
    while (t < motifSteps) {
      var d = rng.table(pal);
      if (t + d > motifSteps) d = motifSteps - t;
      cells.push(newCell(rng, d, 0));
      t += d;
    }
    var cum = 0, prev = 0, i;
    for (i = 1; i < cells.length; i++) {
      cells[i].iv = chooseInterval(rng, role, P, prev, cum, n);
      cum += cells[i].iv; prev = cells[i].iv;
      cells[i].rest = rng.chance(0.06 + 0.14 * P.variation) && cells[i].d <= 4;
    }
    cells[0].acc = 1;
    var ops = [];
    for (i = 1; i <= 15; i++) ops.push(genOp(rng, P, i, n));
    var g = {
      type: 'melodic', role: role, motifSteps: motifSteps, cells: cells,
      anchor: rng.pick(n >= 7 ? [0, 0, 2, 4] : [0, 0, 2, 3]), reg: 0,
      ops: ops, cad: { k: rng.pick([0, 0, 1, -1]) }, period: rng.chance(0.6),
      affinity: U.clamp(AFFINITY[role] + (rng.next() - 0.5) * 0.2, 0, 1),
      legato: role === 'harmony' ? 0.95 : 0.6 + rng.next() * 0.35,
      imit: null
    };
    if (role === 'texture' && rng.chance(0.55)) g.imit = newImit(rng, n);
    return g;
  }

  function newImit(rng, n) {
    var w = [], i;
    for (i = 0; i < 16; i++) w.push(rng.next());
    return { delay: rng.pick([2, 4, 6, 8]), shift: rng.pick([n, 4, n + 2]), w: w };
  }

  // degrees of one motif slot after applying a phrase operation
  function slotNotes(g, op) {
    var cells = g.cells, rel = [], cum = 0, i, t = 0, out = [];
    for (i = 0; i < cells.length; i++) { if (i > 0) cum += cells[i].iv; rel.push(cum); }
    var degs = rel.slice(), rests = [];
    for (i = 0; i < cells.length; i++) rests.push(cells[i].rest && i > 0);
    if (op.t === 'seq') for (i = 0; i < degs.length; i++) degs[i] += op.k;
    else if (op.t === 'inv') for (i = 0; i < degs.length; i++) degs[i] = -rel[i];
    else if (op.t === 'retro') degs.reverse();
    else if (op.t === 'var' && degs.length > 1) {
      var idx = 1 + (op.i - 1) % (degs.length - 1);
      degs[idx] += op.k;
    }
    for (i = 0; i < cells.length; i++) {
      var rest = rests[i] || op.t === 'rest' || (op.t === 'frag' && t >= g.motifSteps / 2);
      out.push({ t: t, d: cells[i].d, rel: degs[i] + (op.t === 'frag' ? op.k : 0), rest: rest, ci: i });
      t += cells[i].d;
    }
    return out;
  }

  function nearestClass(D, cls, n) {
    var best = D, k;
    for (k = 0; k < n; k++) {
      if (U.mod(D - k, n) === cls) { best = D - k; break; }
      if (U.mod(D + k, n) === cls) { best = D + k; break; }
    }
    return best;
  }

  function fold(scale, key, D, lo, hi) {
    var n = scale.steps.length, p = S.pitch(scale, key, D);
    while (p > hi) { D -= n; p = S.pitch(scale, key, D); }
    while (p < lo) { D += n; p = S.pitch(scale, key, D); }
    while (p > hi && D > -100) { D -= 1; p = S.pitch(scale, key, D); }   // range under an octave
    return D;
  }

  // ctx: { scale, key, harmony, bars, spb, lo, hi, density, vel }
  function render(g, ctx, srcEvents) {
    if (g.imit && srcEvents) return renderImitation(g, ctx, srcEvents);
    var scale = ctx.scale, n = scale.steps.length, len = ctx.bars * ctx.spb;
    var center = Math.round((ctx.lo + ctx.hi) / 2);
    var base = S.tonicBelow(scale, ctx.key, center) + g.anchor + g.reg * n;
    var N = Math.max(1, Math.ceil(len / g.motifSteps));   // odd meters: last slot is cut
    var notes = [], s, i;
    for (s = 0; s < N; s++) {
      var op = s === 0 ? { t: 'stmt' } : g.ops[(s - 1) % g.ops.length];
      var last = s === N - 1;
      if (last && N > 1) op = { t: g.cad.k ? 'seq' : 'stmt', k: g.cad.k };
      var sn = slotNotes(g, op), off = s * g.motifSteps;
      var half = g.period && N >= 4 && s === N / 2 - 1;
      var target = last ? 0 : (half ? scale.dom : -1);
      var lastIdx = -1;
      for (i = 0; i < sn.length; i++) if (!sn[i].rest) lastIdx = i;
      for (i = 0; i < sn.length; i++) {
        var x = sn[i];
        notes.push({ t: off + x.t, d: x.d, D: base + x.rel, rest: x.rest, ci: x.ci,
                     cad: i === lastIdx && target >= 0, target: target, first: s === 0 && i === 0 });
      }
    }
    // cadences, chord affinity, bass roots
    var prevD = base;
    for (i = 0; i < notes.length; i++) {
      var no = notes[i];
      if (no.rest) continue;
      var cell = g.cells[no.ci];
      if (no.cad) no.D = nearestClass(no.D, no.target, n);
      else if (no.t % 4 === 0 && cell.fx < g.affinity) {
        var ch = H.chordAt(ctx.harmony, scale, no.t, ctx.spb, ctx.bars);
        if (g.role === 'bass' && no.t % ctx.spb === 0) no.D = nearestClass(no.D, ch.root, n);
        else no.D = H.nearestChordTone(no.D, ch, n, U.sign(no.D - prevD) || 1);
      }
      prevD = no.D;
    }
    // density: thin below 75%, add passing notes above
    var dens = ctx.density, kept = [], prev = null;
    for (i = 0; i < notes.length; i++) {
      var m = notes[i];
      var keep = m.first || m.cad || g.cells[m.ci].w < dens / 0.75;
      if (m.rest || !keep) {
        if (!m.rest && prev && prev.t + prev.d === m.t) prev.d += m.d;
        else prev = null;
        continue;
      }
      prev = { t: m.t, d: m.d, D: m.D, ci: m.ci };
      kept.push(prev);
    }
    var out = [];
    for (i = 0; i < kept.length; i++) {
      var k = kept[i], gc = g.cells[k.ci];
      if (dens > 0.75 && k.d >= 2 && gc.sp < (dens - 0.75) * 4) {
        var nextD = i + 1 < kept.length ? kept[i + 1].D : k.D;
        var d1 = Math.ceil(k.d / 2);
        out.push({ t: k.t, d: d1, D: k.D, acc: gc.acc });
        out.push({ t: k.t + d1, d: k.d - d1, D: k.D + (U.sign(nextD - k.D) || 1), acc: 0 });
      } else out.push({ t: k.t, d: k.d, D: k.D, acc: gc.acc });
    }
    var ev = [];
    for (i = 0; i < out.length; i++) {
      var o = out[i];
      if (o.t >= len) break;
      var D = fold(scale, ctx.key, o.D, ctx.lo, ctx.hi);
      var dur = Math.max(1, Math.round(o.d * g.legato));
      dur = Math.min(dur, len - o.t);
      var accent = o.t % ctx.spb === 0 ? 8 : (o.t % 4 === 0 ? 4 : 0);
      var vel = U.clamp(Math.round(ctx.vel + (o.acc - 0.5) * 24 + accent), 20, 127);
      ev.push({ t: o.t, d: dur, p: S.pitch(scale, ctx.key, D), v: vel });
    }
    return ev;
  }

  function renderImitation(g, ctx, src) {
    var scale = ctx.scale, len = ctx.bars * ctx.spb, im = g.imit, ev = [], i;
    for (i = 0; i < src.length; i++) {
      if (im.w[i % 16] >= ctx.density / 0.75) continue;
      var t = (src[i].t + im.delay) % len;
      var D = fold(scale, ctx.key, S.degreeOf(scale, ctx.key, src[i].p) + im.shift, ctx.lo, ctx.hi);
      ev.push({ t: t, d: src[i].d, p: S.pitch(scale, ctx.key, D), v: U.clamp(src[i].v - 10, 20, 127) });
    }
    ev.sort(function (a, b) { return a.t - b.t; });
    var mono = [];
    for (i = 0; i < ev.length; i++) {
      if (mono.length && mono[mono.length - 1].t === ev[i].t) continue;
      if (mono.length) {
        var pr = mono[mono.length - 1];
        if (pr.t + pr.d > ev[i].t) pr.d = Math.max(1, ev[i].t - pr.t);
      }
      ev[i].d = Math.min(ev[i].d, len - ev[i].t);
      mono.push(ev[i]);
    }
    return mono;
  }

  // ---- mutation ----------------------------------------------------------

  function pickCells(g, rng, P) {
    var idx = [], i;
    for (i = 1; i < g.cells.length; i++) if (rng.chance(P.prob)) idx.push(i);
    if (!idx.length && g.cells.length > 1) idx.push(rng.int(1, g.cells.length - 1));
    return idx;
  }

  var OPS = {
    interval: function (g, rng, P, n) {
      var idx = pickCells(g, rng, P), i;
      for (i = 0; i < idx.length; i++) {
        var mag = 1 + (rng.chance(P.amount) ? rng.int(1, 2) : 0);
        g.cells[idx[i]].iv += rng.sign() * mag;
      }
      boundContour(g.cells, n);
    },
    rhythm: function (g, rng, P) {
      var maxCells = 4 + Math.round(P.complexity * 10), c = g.cells, i, r = rng.next();
      if (r < 0.4 && c.length < maxCells) {                     // split a note
        var cand = [];
        for (i = 0; i < c.length; i++) if (c[i].d >= 2) cand.push(i);
        if (!cand.length) return;
        i = rng.pick(cand);
        var d1 = c[i].d >= 4 && rng.chance(0.6) ? Math.floor(c[i].d / 2) : rng.int(1, c[i].d - 1);
        var nc = newCell(rng, c[i].d - d1, rng.sign());
        c[i].d = d1;
        c.splice(i + 1, 0, nc);
        if (c[i + 2]) c[i + 2].iv -= nc.iv;                      // later pitches stay put
      } else if (r < 0.75 && c.length > 2) {                    // merge two notes
        i = rng.int(1, c.length - 2);
        c[i].d += c[i + 1].d;
        var removed = c[i + 1].iv;
        c.splice(i + 1, 1);
        if (c[i + 1]) c[i + 1].iv += removed;
      } else if (c.length > 1) {                                 // shift a boundary
        i = rng.int(0, c.length - 2);
        var dir = rng.sign();
        if (dir < 0 && c[i].d > 1) { c[i].d -= 1; c[i + 1].d += 1; }
        else if (c[i + 1].d > 1) { c[i].d += 1; c[i + 1].d -= 1; }
      }
    },
    rest: function (g, rng) {
      if (g.cells.length < 2) return;
      var c = g.cells[rng.int(1, g.cells.length - 1)];
      c.rest = !c.rest;
    },
    plan: function (g, rng, P, n) {
      var N = Math.max(1, Math.floor(P.bars * P.spb / g.motifSteps));
      if (N <= 2) { g.cad.k = rng.pick([0, 1, -1, 2]); g.period = !g.period; return; }
      var j = rng.int(0, Math.min(N - 3, g.ops.length - 1));
      g.ops[j] = genOp(rng, P, j + 1, n);
    },
    anchor: function (g, rng, P, n) { g.anchor = rng.pick(n >= 7 ? [0, 2, 4, -3] : [0, 2, 3, -2]); },
    register: function (g, rng) { g.reg = U.clamp(g.reg + rng.sign(), -1, 1); },
    accent: function (g, rng, P) {
      var idx = pickCells(g, rng, P), i;
      for (i = 0; i < idx.length; i++) g.cells[idx[i]].acc = rng.next();
    },
    genes: function (g, rng, P) {
      var idx = pickCells(g, rng, P), i, keys = ['fx', 'w', 'sp'];
      for (i = 0; i < idx.length; i++) {
        var k = rng.pick(keys), c = g.cells[idx[i]];
        c[k] = U.clamp(c[k] + (rng.next() - 0.5) * (0.4 + P.amount), 0, 0.999);
      }
    },
    legato: function (g, rng) { g.legato = U.clamp(g.legato + rng.sign() * 0.15, 0.45, 1); },
    imit: function (g, rng, P, n) {
      if (g.role !== 'texture') return;
      if (!g.imit || rng.chance(0.25 * P.amount)) g.imit = g.imit ? null : newImit(rng, n);
      else if (rng.chance(0.5)) g.imit.delay = rng.pick([2, 4, 6, 8]);
      else g.imit.shift = rng.pick([n, 4, n + 2]);
    }
  };

  function mutate(g0, rng, P, n) {
    var g = U.clone(g0);
    var a = P.amount, c = P.complexity;
    var table = [['interval', 0.28], ['rhythm', 0.16 * (0.5 + c)], ['rest', 0.08], ['plan', 0.16],
                 ['anchor', 0.05 * a], ['register', 0.03 * a], ['accent', 0.07], ['genes', 0.1],
                 ['legato', 0.04], ['imit', g.role === 'texture' ? 0.08 : 0]];
    var count = 1 + Math.floor(a * 3 + rng.next() * a * 2), k;
    for (k = 0; k < count; k++) OPS[rng.table(table)](g, rng, P, n);
    return g;
  }

  return { generate: generate, render: render, mutate: mutate };
})();
