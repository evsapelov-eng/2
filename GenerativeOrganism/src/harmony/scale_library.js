// scale_library.js: keys, modes and degree <-> pitch arithmetic.
//
// Pitches are handled as absolute scale degrees D (integers):
//   pitch(D) = key + steps[D mod n] + 12 * floor(D / n)
// so D = 0 is the tonic in MIDI octave -1. All generators work in degrees,
// which is why the DNA survives a change of key or mode.
//
// Stage A/B covers the Western modes and the two pentatonics. The historical
// systems (finalis, repercussa, maqam, raga...) are Stage C and get their own
// rule sets in historical_modes.js; they are not faked here.

GO.Scales = (function () {
  var U = GO.util;
  var KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  // prog: root-degree templates (one root per bar) that suit the mode.
  // dom: degree index used for half cadences.
  var LIST = [
    { id: 'ionian', name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11], dom: 4,
      prog: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 0, 4], [0, 1, 4, 0]] },
    { id: 'dorian', name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], dom: 4,
      prog: [[0, 3, 0, 3], [0, 3, 6, 0], [0, 6, 3, 4], [0, 1, 3, 0]] },
    { id: 'phrygian', name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10], dom: 6,
      prog: [[0, 1, 0, 1], [0, 1, 6, 0], [0, 5, 1, 0], [0, 6, 5, 1]] },
    { id: 'lydian', name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], dom: 1,
      prog: [[0, 1, 0, 1], [0, 1, 4, 0], [0, 6, 1, 0], [0, 2, 1, 0]] },
    { id: 'mixolydian', name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], dom: 6,
      prog: [[0, 6, 3, 0], [0, 6, 0, 3], [0, 3, 6, 0], [0, 4, 6, 0]] },
    { id: 'aeolian', name: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10], dom: 4,
      prog: [[0, 5, 6, 0], [0, 3, 4, 0], [0, 5, 2, 6], [0, 6, 5, 4]] },
    { id: 'locrian', name: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10], dom: 1,
      prog: [[0, 1, 0, 6], [0, 5, 1, 0], [0, 6, 5, 1]] },
    { id: 'harmonic', name: 'Harmonic Minor', steps: [0, 2, 3, 5, 7, 8, 11], dom: 4,
      prog: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 5, 1, 4]] },
    { id: 'melodicmin', name: 'Melodic Minor', steps: [0, 2, 3, 5, 7, 9, 11], dom: 4,
      prog: [[0, 3, 4, 0], [0, 1, 4, 0], [0, 3, 1, 4]] },
    { id: 'majpent', name: 'Major Pentatonic', steps: [0, 2, 4, 7, 9], dom: 3,
      prog: [[0, 3, 4, 0], [0, 4, 3, 0], [0, 1, 3, 0]] },
    { id: 'minpent', name: 'Minor Pentatonic', steps: [0, 3, 5, 7, 10], dom: 3,
      prog: [[0, 2, 3, 0], [0, 4, 2, 0], [0, 4, 3, 0]] }
  ];

  function get(i) { return LIST[U.clamp(i | 0, 0, LIST.length - 1)]; }
  function size(scale) { return scale.steps.length; }

  function pitch(scale, key, D) {
    var n = scale.steps.length;
    return key + scale.steps[U.mod(D, n)] + 12 * Math.floor(D / n);
  }

  // Nearest degree to a MIDI pitch (ties resolve downwards).
  function degreeOf(scale, key, p) {
    var n = scale.steps.length;
    var D = n * Math.floor((p - key) / 12) - n;
    var best = D, bestDist = 999, i;
    for (i = 0; i < 3 * n; i++) {
      var dist = Math.abs(pitch(scale, key, D + i) - p);
      if (dist < bestDist) { bestDist = dist; best = D + i; }
    }
    return best;
  }

  // Degree of the tonic at or below a MIDI pitch.
  function tonicBelow(scale, key, p) {
    return scale.steps.length * Math.floor((p - key) / 12);
  }

  function inScale(scale, key, p) {
    var pc = U.mod(p - key, 12), i;
    for (i = 0; i < scale.steps.length; i++) if (scale.steps[i] === pc) return true;
    return false;
  }

  // Tonal weight of a degree class: tonic, then tonic-triad tones, then the rest.
  function gravity(scale, idx) {
    var n = scale.steps.length;
    idx = U.mod(idx, n);
    if (idx === 0) return 1;
    if (n >= 7 && (idx === 2 || idx === 4)) return 0.6;
    if (n < 7 && idx === 3) return 0.6;
    return 0.3;
  }

  function names() { var r = [], i; for (i = 0; i < LIST.length; i++) r.push(LIST[i].name); return r; }

  return { KEYS: KEYS, LIST: LIST, get: get, size: size, pitch: pitch, degreeOf: degreeOf,
           tonicBelow: tonicBelow, inScale: inScale, gravity: gravity, names: names };
})();
