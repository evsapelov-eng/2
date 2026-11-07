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
// The tradition's rules come from the frame: characteristic formulas seed the
// motif, poetic feet give durations, cadences go to the final (approached as
// the tradition requires, with musica ficta where it applies), half cadences
// to the repercussa / ghammaz / vadi / mese, the melody stays in the mode's
// ambitus, ragas skip the degrees their aroha/avaroha omit.

GO.Melodic = (function () {
  var U = GO.util, H = GO.Harmony;

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
      if ((d === 1 || d === 3) && c < 0.35) continue;
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

  function chooseInterval(rng, role, P, prevIv, cum, n, contour) {
    if (Math.abs(prevIv) >= 3 && rng.chance(0.75 - 0.45 * P.variation)) return -U.sign(prevIv);
    var size = rng.table(intervalTable(role, P));
    var dir = rng.chance(contour < 0 ? 0.62 : 0.5) ? -1 : 1;
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

  function genOp(rng, P, slot) {
    if (slot % 2 === 0) {
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

  // durations of a motif from poetic feet (Greek): long = 4, short = 2 steps
  function feetDurations(rng, feet, motifSteps) {
    var f = rng.pick(feet), out = [], t = 0, i = 0;
    while (t < motifSteps) {
      var d = f.pat.charAt(i % f.pat.length) === 'L' ? 4 : 2;
      if (t + d > motifSteps) d = motifSteps - t;
      out.push(d); t += d; i++;
      if (i % f.pat.length === 0 && rng.chance(0.3)) f = rng.pick(feet);
    }
    return out;
  }

  function generate(rng, role, P, frame) {
    var n = frame.n, rules = frame.rules;
    var motifSteps = rng.chance(0.4) ? 8 : 16;
    if (role === 'bass' || role === 'harmony') motifSteps = 16;
    var durs = [], t = 0, i;
    if (rules.feet && role !== 'bass') durs = feetDurations(rng, rules.feet, motifSteps);
    else {
      var pal = palette(role, P.complexity);
      while (t < motifSteps) {
        var d = rng.table(pal);
        if (t + d > motifSteps) d = motifSteps - t;
        durs.push(d); t += d;
      }
    }
    var cells = [];
    for (i = 0; i < durs.length; i++) cells.push(newCell(rng, durs[i], 0));
    var anchor = rng.pick(n >= 7 ? [0, 0, 2, 4] : [0, 0, 2, 3]);
    if (rules.half !== undefined && rng.chance(0.3)) anchor = rules.half;
    var formula = null;
    if (rules.formulas && role !== 'bass' && rng.chance(0.75)) formula = rng.pick(rules.formulas);
    var cum = 0, prev = 0;
    for (i = 1; i < cells.length; i++) {
      if (formula && i < formula.length) cells[i].iv = formula[i] - formula[i - 1];
      else cells[i].iv = chooseInterval(rng, role, P, prev, cum, n, rules.contour || 0);
      cum += cells[i].iv; prev = cells[i].iv;
      cells[i].rest = !(formula && i < formula.length) && rng.chance(0.06 + 0.14 * P.variation) && cells[i].d <= 4;
    }
    if (formula) anchor = formula[0];
    cells[0].acc = 1;
    var ops = [];
    for (i = 1; i <= 15; i++) ops.push(genOp(rng, P, i));
    var g = {
      type: 'melodic', role: role, motifSteps: motifSteps, cells: cells, anchor: anchor, reg: 0,
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

  function slotNotes(g, op) {
    var cells = g.cells, rel = [], cum = 0, i, t = 0, out = [];
    for (i = 0; i < cells.length; i++) { if (i > 0) cum += cells[i].iv; rel.push(cum); }
    var degs = rel.slice(), rests = [];
    for (i = 0; i < cells.length; i++) rests.push(cells[i].rest && i > 0);
    if (op.t === 'seq') for (i = 0; i < degs.length; i++) degs[i] += op.k;
    else if (op.t === 'inv') for (i = 0; i < degs.length; i++) degs[i] = -rel[i];
    else if (op.t === 'retro') degs.reverse();
    else if (op.t === 'var' && degs.length > 1) degs[1 + (op.i - 1) % (degs.length - 1)] += op.k;
    for (i = 0; i < cells.length; i++) {
      var rest = rests[i] || op.t === 'rest' || (op.t === 'frag' && t >= g.motifSteps / 2);
      out.push({ t: t, d: cells[i].d, rel: degs[i] + (op.t === 'frag' ? op.k : 0), rest: rest, ci: i });
      t += cells[i].d;
    }
    return out;
  }

  function inList(x, list) { var i; for (i = 0; i < list.length; i++) if (list[i] === x) return true; return false; }

  // ctx: { frame, len, spb, lo, hi, density, vel }
  function render(g, ctx, others) {
    if (g.imit && others && others[2]) return renderImitation(g, ctx, others[2]);
    var F = ctx.frame, rules = F.rules, n = F.n, len = ctx.len;
    var center = Math.round((ctx.lo + ctx.hi) / 2);
    var finalD = F.tonicBelow(center), amb = null;
    if (rules.ambitus && (g.role === 'melody' || g.role === 'texture')) {
      var mid = (rules.ambitus[0] + rules.ambitus[1]) / 2;
      finalD = n * Math.round((F.degreeOf(center, 0) - mid) / n);
      amb = [finalD + rules.ambitus[0], finalD + rules.ambitus[1]];
    }
    var base = finalD + g.anchor + g.reg * n;
    var N = Math.max(1, Math.ceil(len / g.motifSteps));
    var notes = [], s, i;
    var halfTarget = rules.half !== undefined ? U.mod(rules.half, n) : (n >= 7 ? 4 : 3);
    for (s = 0; s < N; s++) {
      var op = s === 0 ? { t: 'stmt' } : g.ops[(s - 1) % g.ops.length];
      var last = s === N - 1;
      if (last && N > 1) op = { t: g.cad.k ? 'seq' : 'stmt', k: g.cad.k };
      var sn = slotNotes(g, op), off = s * g.motifSteps;
      var half = g.period && N >= 4 && s === N / 2 - 1;
      var target = last ? 0 : (half ? halfTarget : -1);
      var lastIdx = -1;
      for (i = 0; i < sn.length; i++) if (!sn[i].rest) lastIdx = i;
      for (i = 0; i < sn.length; i++) {
        var x = sn[i];
        notes.push({ t: off + x.t, d: x.d, D: base + x.rel, rest: x.rest, ci: x.ci,
                     cad: i === lastIdx && target >= 0, target: target, first: s === 0 && i === 0, alt: 0 });
      }
    }
    // cadences (with the tradition's approach to the final), affinity, bass roots
    var prevD = base, prevNote = null;
    for (i = 0; i < notes.length; i++) {
      var no = notes[i];
      if (no.rest) continue;
      var cell = g.cells[no.ci];
      if (no.cad) {
        no.D = H.nearestClass(no.D, no.target, n);
        if (no.target === 0 && prevNote && !prevNote.cad) {
          if (rules.cad) prevNote.D = no.D + rules.cad;
          if (rules.ficta && U.mod(prevNote.D, n) === n - 1 && Math.abs(F.steps[n - 1] - 10) < 0.01) prevNote.alt = 1;
        }
      } else if (no.t % 4 === 0 && cell.fx < g.affinity) {
        var ch = F.chordAt(no.t);
        if (g.role === 'bass' && no.t % ctx.spb === 0) no.D = H.nearestClass(no.D, ch.root, n);
        else no.D = H.nearestChordTone(no.D, ch, n, U.sign(no.D - prevD) || 1);
      }
      prevD = no.D; prevNote = no;
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
      prev = { t: m.t, d: m.d, D: m.D, ci: m.ci, alt: m.alt };
      kept.push(prev);
    }
    var out = [];
    for (i = 0; i < kept.length; i++) {
      var k = kept[i], gc = g.cells[k.ci];
      if (dens > 0.75 && k.d >= 2 && gc.sp < (dens - 0.75) * 4) {
        var nextD = i + 1 < kept.length ? kept[i + 1].D : k.D;
        var d1 = Math.ceil(k.d / 2);
        out.push({ t: k.t, d: d1, D: k.D, acc: gc.acc, alt: 0 });
        out.push({ t: k.t + d1, d: k.d - d1, D: k.D + (U.sign(nextD - k.D) || 1), acc: 0, alt: k.alt });
      } else out.push({ t: k.t, d: k.d, D: k.D, acc: gc.acc, alt: k.alt });
    }
    // ambitus, raga ascent/descent rules, register
    var ev = [], lastD = null;
    for (i = 0; i < out.length; i++) {
      var o = out[i];
      if (o.t >= len) break;
      var D = o.D;
      if (amb) { while (D > amb[1]) D -= n; while (D < amb[0]) D += n; }
      D = F.fold(D, o.t, ctx.lo, ctx.hi);
      var dir = lastD === null ? 0 : U.sign(D - lastD);
      if (dir > 0 && inList(U.mod(D, n), rules.upAvoid || [])) D += 1;
      else if (dir < 0 && inList(U.mod(D, n), rules.downAvoid || [])) D -= 1;
      lastD = D;
      var dur = Math.min(Math.max(1, Math.round(o.d * g.legato)), len - o.t);
      var accent = o.t % ctx.spb === 0 ? 8 : (o.t % 4 === 0 ? 4 : 0);
      var vel = ctx.vel + (o.acc - 0.5) * 24 + accent;
      ev.push(F.event(o.t, dur, F.pitch(D, o.t, o.alt, dir), vel));
    }
    return ev;
  }

  function renderImitation(g, ctx, src) {
    var F = ctx.frame, len = ctx.len, im = g.imit, ev = [], i;
    for (i = 0; i < src.length; i++) {
      if (im.w[i % 16] >= ctx.density / 0.75) continue;
      var t = (src[i].t + im.delay) % len;
      var D = F.fold(F.degreeOf(GO.Frame.fpitch(src[i]), src[i].t) + im.shift, t, ctx.lo, ctx.hi);
      ev.push(F.event(t, src[i].d, F.pitch(D, t), src[i].v - 10));
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
      if (r < 0.4 && c.length < maxCells) {
        var cand = [];
        for (i = 0; i < c.length; i++) if (c[i].d >= 2) cand.push(i);
        if (!cand.length) return;
        i = rng.pick(cand);
        var d1 = c[i].d >= 4 && rng.chance(0.6) ? Math.floor(c[i].d / 2) : rng.int(1, c[i].d - 1);
        var nc = newCell(rng, c[i].d - d1, rng.sign());
        c[i].d = d1;
        c.splice(i + 1, 0, nc);
        if (c[i + 2]) c[i + 2].iv -= nc.iv;
      } else if (r < 0.75 && c.length > 2) {
        i = rng.int(1, c.length - 2);
        c[i].d += c[i + 1].d;
        var removed = c[i + 1].iv;
        c.splice(i + 1, 1);
        if (c[i + 1]) c[i + 1].iv += removed;
      } else if (c.length > 1) {
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
    plan: function (g, rng, P) {
      var N = Math.max(1, Math.floor(P.len / g.motifSteps));
      if (N <= 2) { g.cad.k = rng.pick([0, 1, -1, 2]); g.period = !g.period; return; }
      var j = rng.int(0, Math.min(N - 3, g.ops.length - 1));
      g.ops[j] = genOp(rng, P, j + 1);
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

  function mutate(g0, rng, P, frame) {
    var g = U.clone(g0), a = P.amount, c = P.complexity, n = frame.n;
    var table = [['interval', 0.28], ['rhythm', 0.16 * (0.5 + c)], ['rest', 0.08], ['plan', 0.16],
                 ['anchor', 0.05 * a], ['register', 0.03 * a], ['accent', 0.07], ['genes', 0.1],
                 ['legato', 0.04], ['imit', g.role === 'texture' ? 0.08 : 0]];
    var count = 1 + Math.floor(a * 3 + rng.next() * a * 2), k;
    for (k = 0; k < count; k++) OPS[rng.table(table)](g, rng, P, n);
    return g;
  }

  return { generate: generate, render: render, mutate: mutate };
})();
