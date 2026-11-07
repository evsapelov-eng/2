// harmonic_engine.js: the root-progression gene of the organism and chord
// helpers shared by the generators.
//
// Harmony gene: { roots: [8 root degrees, one per bar], seventh: bool }.
// It is used by systems whose harmony is 'chords' (Western modes,
// Renaissance modes) when no Harmony Library progression is selected. For
// traditions without functional harmony the gene is kept but unused: the
// frame supplies the tradition's centre tones and drone instead.

GO.Harmony = (function () {
  var U = GO.util;

  function generate(rng, rules, complexity) {
    if (!rules.prog) return { roots: [0, 0, 0, 0, 0, 0, 0, 0], seventh: false };
    var tpl = rng.pick(rules.prog).slice();
    var second = tpl.slice();
    var i = rng.int(1, 2);
    second[i] = U.mod(second[i] + rng.pick([2, -2]), rules.steps.length);
    return { roots: tpl.concat(second), seventh: !rules.noSevenths && complexity > 0.6 && rng.chance(complexity) };
  }

  function rootsFor(h, bars) {
    if (bars <= 1) return [h.roots[0]];
    if (bars === 2) return [h.roots[0], h.roots[1]];
    if (bars <= 4) return h.roots.slice(0, 4);
    return h.roots.slice(0, 8);
  }

  function isChordTone(D, chord, n) {
    var c = U.mod(D, n), i;
    for (i = 0; i < chord.tones.length; i++) if (chord.tones[i] === c) return true;
    return false;
  }

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

  function toneDegree(chord, idx, n) {
    var oct = Math.floor(idx / chord.tones.length);
    return chord.tones[U.mod(idx, chord.tones.length)] + oct * n;
  }

  // nearest degree of a given class
  function nearestClass(D, cls, n) {
    var k;
    for (k = 0; k < n; k++) {
      if (U.mod(D - k, n) === cls) return D - k;
      if (U.mod(D + k, n) === cls) return D + k;
    }
    return D;
  }

  // changes the harmonic movement inside the mode (first bar stays the final)
  function mutate(h, rng, P, rules) {
    var out = U.clone(h);
    if (!rules.prog) return out;
    var i = rng.int(1, out.roots.length - 1), n = rules.steps.length;
    var move = P.amount > 0.6 ? rng.pick([1, -1, 2, -2, 3]) : rng.pick([2, -2]);
    out.roots[i] = U.mod(out.roots[i] + move, n);
    if (!rules.noSevenths && P.complexity > 0.6 && rng.chance(0.3)) out.seventh = !out.seventh;
    return out;
  }

  return { generate: generate, rootsFor: rootsFor, isChordTone: isChordTone, nearestChordTone: nearestChordTone,
           toneDegree: toneDegree, nearestClass: nearestClass, mutate: mutate };
})();
