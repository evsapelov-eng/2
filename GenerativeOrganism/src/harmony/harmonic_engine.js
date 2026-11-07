// harmonic_engine.js: the shared harmonic foundation all four voices read.
//
// Harmony gene: { roots: [8 root degrees, one per bar], seventh: bool }.
// Chords are built inside the mode by stacking every other scale degree, so
// they never leave the selected scale. One chord per bar; a cycle of B bars
// uses the first B roots (special-cased for 1 and 2 bars).
// The Harmony Library (Stage C) will replace `roots` with user-chosen or
// historical progressions stored as timed harmonic events.

GO.Harmony = (function () {
  var U = GO.util;

  function generate(rng, scale, complexity) {
    var tpl = rng.pick(scale.prog).slice();
    var second = tpl.slice();
    // the second half varies one inner chord by a third-relation, keeps the cadence
    var i = rng.int(1, 2);
    second[i] = U.mod(second[i] + rng.pick([2, -2]), scale.steps.length);
    return { roots: tpl.concat(second), seventh: complexity > 0.6 && rng.chance(complexity) };
  }

  function rootsFor(h, bars) {
    if (bars <= 1) return [h.roots[0]];
    if (bars === 2) return [h.roots[0], h.roots[1]];
    if (bars <= 4) return h.roots.slice(0, 4);
    return h.roots.slice(0, 8);
  }

  // chord at a step of the cycle: { root, tones: [degree classes] }
  function chordAt(h, scale, step, stepsPerBar, bars) {
    var roots = rootsFor(h, bars);
    var bar = Math.floor(step / stepsPerBar) % roots.length;
    var n = scale.steps.length;
    var r = roots[bar];
    var tones = [U.mod(r, n), U.mod(r + 2, n), U.mod(r + 4, n)];
    if (h.seventh) tones.push(U.mod(r + 6, n));
    return { root: U.mod(r, n), tones: tones };
  }

  function isChordTone(D, chord, n) {
    var c = U.mod(D, n), i;
    for (i = 0; i < chord.tones.length; i++) if (chord.tones[i] === c) return true;
    return false;
  }

  // nearest chord tone to degree D; dir (-1/1) breaks ties
  function nearestChordTone(D, chord, n, dir) {
    if (isChordTone(D, chord, n)) return D;
    var k;
    for (k = 1; k < n; k++) {
      var a = D + k * (dir || 1), b = D - k * (dir || 1);
      if (isChordTone(a, chord, n)) return a;
      if (isChordTone(b, chord, n)) return b;
    }
    return D;
  }

  // chord tone index (0 root, 1 third, 2 fifth, 3 seventh/octave) -> degree near base
  function toneDegree(chord, idx, n) {
    var oct = Math.floor(idx / chord.tones.length);
    return chord.tones[U.mod(idx, chord.tones.length)] + oct * n;
  }

  // Changes the harmonic movement inside the mode: one inner root moves by a
  // third (shared tones) or to a neighbour; the first bar stays the tonic.
  function mutate(h, rng, P, scale) {
    var out = U.clone(h);
    var i = rng.int(1, out.roots.length - 1);
    var n = scale.steps.length;
    var move = P.amount > 0.6 ? rng.pick([1, -1, 2, -2, 3]) : rng.pick([2, -2]);
    out.roots[i] = U.mod(out.roots[i] + move, n);
    if (P.complexity > 0.6 && rng.chance(0.3)) out.seventh = !out.seventh;
    return out;
  }

  return { generate: generate, rootsFor: rootsFor, chordAt: chordAt, isChordTone: isChordTone,
           nearestChordTone: nearestChordTone, toneDegree: toneDegree, mutate: mutate };
})();
