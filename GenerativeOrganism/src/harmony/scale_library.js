// scale_library.js: keys and the Western modes (the "Western" system).
//
// Every tonal system in the device (these modes, the historical systems in
// historical_modes.js, the modes of Harmony Library progressions) is described
// by the same rule object, read by harmony/frame.js:
//   steps    pitch of each degree above the final, in semitones (floats allowed:
//            3.5 = quarter tone, sent as pitch bend when MICRO is on)
//   down     optional steps used in descending motion
//   harmony  'chords' (triads in the mode, root progression gene), 'drone',
//            'ison', 'organum' or 'heterophony' (no Western chords imposed)
//   prog     root templates for 'chords'
//   half     degree of the secondary centre (dominant, repercussa, ghammaz,
//            shahed, vadi, mese): target of half cadences
//   emph     further emphasised degrees; drone: degrees of the drone
//   ambitus  [low, high] range of the melody in degrees around the final
//   formulas characteristic melodic formulas (degrees), used as motif seeds
//   cad      approach to the final (+1 from above, -1 from below), ficta: raise
//            the subtonium at cadences, upAvoid/downAvoid: degrees skipped in
//            ascent/descent, contour: -1 favours descending lines,
//            rhythms: traditional cycles, feet: poetic feet for durations
//
// Pitches are handled as absolute scale degrees D:
//   pitch(D) = key + steps[D mod n] + 12 * floor(D / n)

GO.Scales = (function () {
  var U = GO.util;
  var KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  function mode(id, name, steps, half, prog) {
    return { id: id, name: name, steps: steps, half: half, dom: half, prog: prog, harmony: 'chords' };
  }

  var LIST = [
    mode('ionian', 'Major', [0, 2, 4, 5, 7, 9, 11], 4, [[0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 0, 4], [0, 1, 4, 0]]),
    mode('dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10], 4, [[0, 3, 0, 3], [0, 3, 6, 0], [0, 6, 3, 4], [0, 1, 3, 0]]),
    mode('phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10], 6, [[0, 1, 0, 1], [0, 1, 6, 0], [0, 5, 1, 0], [0, 6, 5, 1]]),
    mode('lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11], 1, [[0, 1, 0, 1], [0, 1, 4, 0], [0, 6, 1, 0], [0, 2, 1, 0]]),
    mode('mixolydian', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10], 6, [[0, 6, 3, 0], [0, 6, 0, 3], [0, 3, 6, 0], [0, 4, 6, 0]]),
    mode('aeolian', 'Minor', [0, 2, 3, 5, 7, 8, 10], 4, [[0, 5, 6, 0], [0, 3, 4, 0], [0, 5, 2, 6], [0, 6, 5, 4]]),
    mode('locrian', 'Locrian', [0, 1, 3, 5, 6, 8, 10], 1, [[0, 1, 0, 6], [0, 5, 1, 0], [0, 6, 5, 1]]),
    mode('harmonic', 'Harmonic Minor', [0, 2, 3, 5, 7, 8, 11], 4, [[0, 3, 4, 0], [0, 5, 3, 4], [0, 5, 1, 4]]),
    mode('melodicmin', 'Melodic Minor', [0, 2, 3, 5, 7, 9, 11], 4, [[0, 3, 4, 0], [0, 1, 4, 0], [0, 3, 1, 4]]),
    mode('majpent', 'Major Pentatonic', [0, 2, 4, 7, 9], 3, [[0, 3, 4, 0], [0, 4, 3, 0], [0, 1, 3, 0]]),
    mode('minpent', 'Minor Pentatonic', [0, 3, 5, 7, 10], 3, [[0, 2, 3, 0], [0, 4, 2, 0], [0, 4, 3, 0]]),
    mode('phrygdom', 'Phrygian Dominant', [0, 1, 4, 5, 7, 8, 10], 3, [[0, 1, 0, 1], [0, 3, 1, 0], [0, 6, 1, 0]]),
    mode('wholetone', 'Whole Tone', [0, 2, 4, 6, 8, 10], 1, [[0, 1, 0, 5], [0, 2, 1, 0]]),
    mode('octatonic', 'Octatonic', [0, 1, 3, 4, 6, 7, 9, 10], 2, [[0, 2, 0, 6], [0, 4, 2, 6]])
  ];

  function get(i) { return LIST[U.clamp(i | 0, 0, LIST.length - 1)]; }
  function byId(id) { var i; for (i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return LIST[0]; }
  function size(scale) { return scale.steps.length; }

  function pitch(scale, key, D) {
    var n = scale.steps.length;
    return key + scale.steps[U.mod(D, n)] + 12 * Math.floor(D / n);
  }

  function degreeOf(scale, key, p) {
    var n = scale.steps.length;
    var D = n * Math.floor((p - key) / 12) - n;
    var best = D, bestDist = 999, i;
    for (i = 0; i < 3 * n; i++) {
      var dist = Math.abs(pitch(scale, key, D + i) - p);
      if (dist < bestDist - 1e-9) { bestDist = dist; best = D + i; }
    }
    return best;
  }

  function tonicBelow(scale, key, p) { return scale.steps.length * Math.floor((p - key) / 12); }

  function inScale(scale, key, p) {
    var pc = U.mod(p - key, 12), i;
    for (i = 0; i < scale.steps.length; i++) if (Math.abs(scale.steps[i] - pc) < 0.02) return true;
    return false;
  }

  function names() { var r = [], i; for (i = 0; i < LIST.length; i++) r.push(LIST[i].name); return r; }

  return { KEYS: KEYS, LIST: LIST, get: get, byId: byId, size: size, pitch: pitch, degreeOf: degreeOf,
           tonicBelow: tonicBelow, inScale: inScale, names: names };
})();
