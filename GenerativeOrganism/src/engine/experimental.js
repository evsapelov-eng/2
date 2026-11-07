// experimental.js: EXPERIMENTAL generator.
//
// Material is derived from an interval row developed by serial operations,
// not from motifs or Euclidean cycles:
//   row[]      interval row in semitones (tritones, sevenths, ninths allowed)
//   ops[]      one transformation per pass of the row: P, R, I, RI, rotation,
//              multiplication (M5 / M7) and time scaling (augmentation /
//              diminution): non-standard phrase development
//   cells[]    durations of odd lengths (3, 5, 7 sixteenths...) with Messiaen-
//              style added values, so phrases drift across the barline
//   chaos      logistic map x -> r x (1 - x): the gene r (from periodic to
//              chaotic) decides unpredictable pauses, dynamics and octave
//              displacements; it is deterministic, so a mutation can tune
//              how unpredictable the voice is (controlled randomness)
// With harmonic constraints (default) the row is read in scale degrees of the
// active system, so every note stays in the mode. FREE reads it chromatically.

GO.Experimental = (function () {
  var U = GO.util;

  function generate(rng, role, P, frame) {
    var len = 5 + Math.round(P.complexity * 6 + rng.next() * 2), row = [], i;
    var pool = [[1, 1], [2, 1], [3, 1.2], [4, 1], [5, 1.3], [6, 1.4], [7, 1], [10, 1], [11, 1.2], [13, 0.4 + P.variation]];
    for (i = 0; i < len; i++) row.push(rng.sign() * rng.table(pool));
    var ops = [];
    for (i = 0; i < 8; i++) ops.push(newOp(rng, P, i));
    var cellPool = role === 'bass' ? [[4, 1], [6, 1], [5, 1], [7, 1], [10, 0.5]]
      : [[1, 0.6 + P.complexity], [2, 1], [3, 1.4], [5, 1.2], [7, 0.8], [4, 0.6]];
    var cells = [], added = [];
    for (i = 0; i < rng.int(3, 7); i++) { cells.push(rng.table(cellPool)); added.push(rng.chance(0.25) ? 1 : 0); }
    return {
      type: 'experimental', role: role, row: row, ops: ops, cells: cells, added: added,
      chaos: { x0: 0.1 + rng.next() * 0.8, r: 3.5 + 0.49 * U.clamp(P.variation + (rng.next() - 0.5) * 0.3, 0, 1) },
      restT: 0.05 + rng.next() * 0.2, spread: rng.next() * 0.25, dyad: role === 'harmony' ? 0.5 + rng.next() * 0.5 : 0,
      legato: 0.5 + rng.next() * 0.5, seed: rng.int(1, 99999)
    };
  }

  function newOp(rng, P, i) {
    if (i === 0) return { p: 'P', rot: 0, mul: 1, time: 1 };
    return { p: rng.table([['P', 0.3], ['R', 0.25], ['I', 0.25], ['RI', 0.2]]),
             rot: rng.chance(0.3 + 0.4 * P.complexity) ? rng.int(1, 4) : 0,
             mul: rng.chance(0.25 * P.complexity) ? rng.pick([5, 7]) : 1,
             time: rng.table([[1, 1], [2, 0.25 + 0.3 * P.variation], [0.5, 0.2 + 0.3 * P.complexity]]) };
  }

  function transform(row, op) {
    var r = row.slice(), i;
    if (op.rot) { var k = op.rot % r.length; r = r.slice(k).concat(r.slice(0, k)); }
    if (op.p === 'R' || op.p === 'RI') { r.reverse(); for (i = 0; i < r.length; i++) r[i] = -r[i]; }
    if (op.p === 'I' || op.p === 'RI') for (i = 0; i < r.length; i++) r[i] = -r[i];
    if (op.mul !== 1) for (i = 0; i < r.length; i++) { var m = U.mod(r[i] * op.mul, 12); r[i] = m > 6 ? m - 12 : m; if (!r[i]) r[i] = 12; }
    return r;
  }

  function hash(a, b) { var x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); }

  function render(g, ctx) {
    var F = ctx.frame, n = F.n, len = ctx.len, free = ctx.free, ev = [];
    var center = (ctx.lo + ctx.hi) / 2, curP = Math.round(center), curD = F.degreeOf(center, 0);
    var x = g.chaos.x0, t = 0, s = 0, count = 0, guard = 0;
    while (t < len && guard++ < 4096) {
      var op = g.ops[s % g.ops.length], row = transform(g.row, op), j;
      for (j = 0; j < row.length && t < len; j++) {
        x = g.chaos.r * x * (1 - x);
        var ci = count % g.cells.length;
        var d = Math.max(1, Math.round((g.cells[ci] + g.added[ci]) * op.time));
        count++;
        if (x < g.restT) { t += d; continue; }                       // unpredictable pause
        var pf;
        if (free) {
          curP += row[j];
          while (curP > ctx.hi) curP -= 12;
          while (curP < ctx.lo) curP += 12;
          pf = curP;
        } else {
          var step = Math.round(row[j] * n / 12) || U.sign(row[j]);
          curD = F.fold(curD + step, t, ctx.lo, ctx.hi);
          pf = F.pitch(curD, t);
        }
        if (x > 1 - g.spread) {                                      // octave displacement
          if (pf + 12 <= ctx.hi) pf += 12; else if (pf - 12 >= ctx.lo) pf -= 12;
        }
        if (hash(g.seed, count) < ctx.density / 0.75 || j === 0) {
          var dur = Math.min(Math.max(1, Math.round(d * g.legato)), len - t);
          var vel = ctx.vel - 30 + x * 60;
          ev.push(F.event(t, dur, pf, vel));
          if (g.dyad && hash(g.seed + 7, count) < g.dyad) {         // the row heard vertically
            var up = Math.abs(row[(j + 1) % row.length]);
            var p2 = free ? pf + up : F.pitch(F.degreeOf(pf, t) + (Math.round(up * n / 12) || 2), t);
            if (p2 <= ctx.hi && Math.round(p2) !== Math.round(pf)) ev.push(F.event(t, dur, p2, vel - 10));
          }
        }
        t += d;
      }
      s++;
    }
    return ev;
  }

  function mutate(g0, rng, P) {
    var g = U.clone(g0), count = 1 + Math.floor(P.amount * 3 + rng.next() * P.amount * 2), k, i;
    for (k = 0; k < count; k++) {
      var r = rng.next();
      if (r < 0.2) {
        for (i = 0; i < g.row.length; i++) if (rng.chance(P.prob * 0.5) || i === 0) g.row[(i + rng.int(0, g.row.length - 1)) % g.row.length] += rng.sign() * rng.int(1, 1 + Math.round(2 * P.amount));
      } else if (r < 0.3) {
        i = rng.int(0, g.row.length - 2); var tmp = g.row[i]; g.row[i] = g.row[i + 1]; g.row[i + 1] = tmp;
      } else if (r < 0.45) g.ops[rng.int(1, g.ops.length - 1)] = newOp(rng, P, 1);
      else if (r < 0.58) g.cells[rng.int(0, g.cells.length - 1)] = rng.pick([1, 2, 3, 5, 7]);
      else if (r < 0.66) { i = rng.int(0, g.added.length - 1); g.added[i] = g.added[i] ? 0 : 1; }
      else if (r < 0.76) g.chaos.r = U.clamp(g.chaos.r + (rng.next() - 0.5) * 0.2 * (0.5 + P.variation), 3.4, 3.99);
      else if (r < 0.84) g.chaos.x0 = U.clamp(g.chaos.x0 + (rng.next() - 0.5) * 0.2, 0.05, 0.95);
      else if (r < 0.9) g.restT = U.clamp(g.restT + rng.sign() * 0.05, 0, 0.4);
      else if (r < 0.95) g.spread = U.clamp(g.spread + rng.sign() * 0.08, 0, 0.5);
      else if (P.complexity > 0.5 && g.row.length < 12) g.row.push(rng.sign() * rng.pick([1, 5, 6, 11]));
      else if (g.row.length > 4) g.row.pop();
    }
    for (i = 0; i < g.row.length; i++) { if (!g.row[i]) g.row[i] = 1; g.row[i] = U.clamp(g.row[i], -14, 14); }
    return g;
  }

  return { generate: generate, render: render, mutate: mutate, transform: transform };
})();
