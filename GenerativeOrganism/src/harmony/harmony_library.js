// harmony_library.js: Harmony Library: historically grounded progressions
// and user progressions.
//
// A progression is written as text (roman numerals relative to the
// progression's mode, or chord names) and compiled into structured harmonic
// events: { t: start step, d: duration in steps, root: pitch class of the
// root relative to Key, pcs: chord pitch classes relative to Key, label }.
// The frame turns each event into a local chord-scale, so chromatic chords
// (secondary dominants, Neapolitan, augmented sixths, mediants) produce
// correct chromatic notes in every voice.
//
// Text syntax, tokens separated by spaces:
//   I ii iii IV V vi vii      case = major/minor triad; b/# prefix alters
//   suffixes: 7 maj7 m7 o o7 ø7 + sus4 sus2 7sus4 6 m6 9 m9 maj9 add9 7b9 13 6/9
//   V7/V  secondary (V7 of V);  N  Neapolitan;  It6 Fr6 Ger6  augmented sixths
//   Cad64  cadential six-four;  Dm7 G7 Cmaj7  chord names (root as a note)
//   [0,4,7]  raw pitch classes over Key;  ":2"  duration in bars (default 1)

GO.Library = (function () {
  var U = GO.util;
  var ROMANS = ['vii', 'vi', 'v', 'iv', 'iii', 'ii', 'i'];
  var ROMAN_IDX = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };
  var MAJOR = [0, 2, 4, 5, 7, 9, 11];
  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  var QUAL = {
    '': null, 'm': [0, 3, 7], 'o': [0, 3, 6], 'dim': [0, 3, 6], 'o7': [0, 3, 6, 9], 'dim7': [0, 3, 6, 9],
    'ø': [0, 3, 6, 10], 'ø7': [0, 3, 6, 10], 'm7b5': [0, 3, 6, 10], '+': [0, 4, 8], 'aug': [0, 4, 8], '+7': [0, 4, 8, 10],
    '7': 'seventh', 'maj7': [0, 4, 7, 11], 'M7': [0, 4, 7, 11], 'mM7': [0, 3, 7, 11], 'm7': [0, 3, 7, 10],
    'sus4': [0, 5, 7], 'sus2': [0, 2, 7], '7sus4': [0, 5, 7, 10], '6': 'sixth', 'm6': [0, 3, 7, 9],
    'add9': 'add9', '9': 'ninth', 'm9': [0, 3, 7, 10, 14], 'maj9': [0, 4, 7, 11, 14], '7b9': [0, 4, 7, 10, 13],
    '13': [0, 4, 7, 10, 14, 21], '6/9': [0, 4, 7, 9, 14]
  };

  function intervals(suffix, minor) {
    if (!QUAL.hasOwnProperty(suffix)) throw new Error('unknown chord quality "' + suffix + '"');
    var q = QUAL[suffix];
    var triad = minor ? [0, 3, 7] : [0, 4, 7];
    if (q === null) return triad;
    if (q === 'seventh') return minor ? [0, 3, 7, 10] : [0, 4, 7, 10];
    if (q === 'sixth') return triad.concat([9]);
    if (q === 'add9') return triad.concat([14]);
    if (q === 'ninth') return minor ? [0, 3, 7, 10, 14] : [0, 4, 7, 10, 14];
    return q;
  }

  // roman numeral without suffix -> { root semitones, minor }
  function romanRoot(s, modeSteps) {
    var acc = 0;
    while (s.charAt(0) === 'b' || s.charAt(0) === '#') { acc += s.charAt(0) === 'b' ? -1 : 1; s = s.substr(1); }
    var lower = s.toLowerCase(), i;
    for (i = 0; i < ROMANS.length; i++) {
      if (lower.indexOf(ROMANS[i]) === 0) {
        var ref = modeSteps.length === 7 ? modeSteps : MAJOR;
        var numeral = s.substr(0, ROMANS[i].length);
        return { root: U.mod(ref[ROMAN_IDX[ROMANS[i]]] + acc, 12), minor: numeral === numeral.toLowerCase(),
                 rest: s.substr(ROMANS[i].length) };
      }
    }
    return null;
  }

  function chord(token, modeSteps) {
    var m, r, pcs, i;
    if (token.charAt(0) === '[') {
      pcs = token.replace(/[\[\]]/g, '').split(',');
      for (i = 0; i < pcs.length; i++) pcs[i] = U.mod(parseFloat(pcs[i]), 12);
      return { root: pcs[0], pcs: pcs };
    }
    if (token === 'N' || token === 'N6') return { root: 1, pcs: [1, 5, 8] };
    if (token === 'It6') return { root: 8, pcs: [8, 0, 6] };
    if (token === 'Fr6') return { root: 8, pcs: [8, 0, 2, 6] };
    if (token === 'Ger6') return { root: 8, pcs: [8, 0, 3, 6] };
    if (token === 'Cad64') { r = romanRoot('I', modeSteps); r.minor = modeSteps[2] === 3; return build(r.root, intervals('', r.minor)); }
    var slash = token.indexOf('/');
    if (slash > 0 && token.substr(slash) !== '/9') {
      var target = romanRoot(token.substr(slash + 1).replace(/[^b#ivIV]/g, ''), modeSteps);
      var main = romanRoot(token.substr(0, slash), MAJOR);
      if (!target || !main) throw new Error('bad secondary chord "' + token + '"');
      return build(U.mod(target.root + main.root, 12), intervals(main.rest, main.minor));
    }
    r = romanRoot(token, modeSteps);
    if (r) return build(r.root, intervals(r.rest, r.minor));
    m = /^([A-G])([#b]?)(.*)$/.exec(token);
    if (m) {
      var root = U.mod(NOTE[m[1]] + (m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0)), 12);
      var suf = m[3], minor = false;
      if (suf.charAt(0) === 'm' && suf.substr(0, 3) !== 'maj') { minor = true; suf = suf.substr(1); if (suf === '7b5') suf = 'ø7'; }
      return { abs: true, root: root, pcs: offsets(root, intervals(suf, minor)) };
    }
    throw new Error('cannot read chord "' + token + '"');
  }

  function offsets(root, iv) { var p = [], i; for (i = 0; i < iv.length; i++) p.push(U.mod(root + iv[i], 12)); return p; }
  function build(root, iv) { return { root: root, pcs: offsets(root, iv) }; }

  // text -> { events, bars }; key is needed only to place chord names
  function parse(text, modeSteps, key) {
    var tokens = String(text).replace(/\|/g, ' ').split(/\s+/), ev = [], t = 0, i;
    for (i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (!tok) continue;
      var dur = 1, c = tok.lastIndexOf(':');
      if (c > 0) { dur = parseFloat(tok.substr(c + 1)); tok = tok.substr(0, c); }
      if (!(dur > 0)) throw new Error('bad duration in "' + tokens[i] + '"');
      var ch = chord(tok, modeSteps);
      if (ch.abs) { ch.root = U.mod(ch.root - key, 12); ch.pcs = offsets(0, ch.pcs.map(function (p) { return p - key; })); }
      ev.push({ t: t, d: dur, root: ch.root, pcs: ch.pcs, label: tok });
      t += dur;
    }
    if (!ev.length) throw new Error('empty progression');
    return { events: ev, bars: t };
  }

  // events in bars -> events in steps, durations scaled by the harmonic length factor
  function toSteps(parsed, spb, factor) {
    var out = [], i, t = 0;
    for (i = 0; i < parsed.events.length; i++) {
      var e = parsed.events[i], d = Math.max(1, Math.round(e.d * factor * spb));
      out.push({ t: t, d: d, root: e.root, pcs: e.pcs, label: e.label });
      t += d;
    }
    return { events: out, len: t };
  }

  function P(name, mode, chords, logic) { return { name: name, mode: mode, chords: chords, logic: logic }; }

  var CATEGORIES = [
    { name: 'Renaissance', list: [
      P('Passamezzo antico', 'aeolian', 'i VII i V III VII i:0.5 V:0.5 i', 'ground bass of the 16th c.; root motion by fifths and seconds'),
      P('Passamezzo moderno', 'ionian', 'I IV I V I IV I:0.5 V:0.5 I', 'major ground; plagal and authentic motions'),
      P('Romanesca', 'aeolian', 'III VII i V III VII i:0.5 V:0.5 i', 'descending fourth bass under parallel tenths'),
      P('Folia (early)', 'aeolian', 'i V i VII III VII i V', 'dance ground; cadence with ficta leading tone'),
      P('Ruggiero', 'ionian', 'I V I V I IV V I', 'aria ground of the late Renaissance'),
      P('Clausula vera (Dorian)', 'dorian', 'i VII i IV i V:0.5 i:1.5', 'tenor 2-1, cantus 7-8 with raised subtonium'),
      P('Phrygian cadence', 'phrygian', 'i VI vii I', 'lower voice falls a semitone 2-1 into a major final')
    ] },
    { name: 'Baroque', list: [
      P('Pachelbel canon', 'ionian', 'I V vi iii IV I IV V', 'descending stepwise bass, falling-fourth pairs'),
      P('Circle of fifths (major)', 'ionian', 'I IV viio iii vi ii V I', 'diatonic sequence by descending fifths'),
      P('Circle of fifths (minor)', 'aeolian', 'i iv VII III VI iio V i', 'minor diatonic fifth sequence'),
      P('Lament ground', 'aeolian', 'i v VI V', 'descending tetrachord bass 8-7-6-5'),
      P('Monte', 'ionian', 'V7/IV IV V7/V V', 'rising sequence by step with secondary dominants'),
      P('Fonte', 'ionian', 'V7/ii ii V7 I', 'falling sequence: minor then major'),
      P('Prinner', 'ionian', 'IV I viio I', 'bass 4-3-2-1 under 6-5-4-3'),
      P('Folia (Corelli)', 'aeolian', 'i V i VII III VII i V i V i VII III VII i:0.5 V:0.5 i', 'later Folia: two eight-bar halves')
    ] },
    { name: 'Classical', list: [
      P('Authentic cadence', 'ionian', 'I IV V7 I', 'T-S-D-T; leading tone resolves up, seventh down'),
      P('Pre-dominant ii-V', 'ionian', 'I vi ii V7', 'stepwise bass towards the dominant'),
      P('Cadential six-four', 'ionian', 'I IV Cad64:0.5 V7:0.5 I', 'six-four as dominant suspension'),
      P('Neapolitan cadence', 'aeolian', 'i iv N V7 i', 'bII in first inversion, b2 falls to the leading tone'),
      P('Augmented sixth', 'harmonic', 'i iv Ger6 V i', 'b6 and #4 expand to the dominant octave'),
      P('Period', 'ionian', 'I IV V I I IV V7 I', 'antecedent (half cadence implied) and consequent'),
      P('Modulation to V', 'ionian', 'I ii V7/V V', 'secondary dominant tonicises V')
    ] },
    { name: 'Romantic', list: [
      P('Chromatic mediants', 'ionian', 'I bVI I III', 'third-related major chords, common tone held'),
      P('Plagal minor iv', 'ionian', 'I IV iv I', 'modal mixture: b6 falls to 5'),
      P('Tristan resolution', 'aeolian', '[8,2,6,11] V7 VI V7', 'Tristan chord to E7, deceptive turn to F (in A)'),
      P('Common-tone diminished', 'ionian', 'I #iio7 I V7', 'diminished seventh around a held tonic'),
      P('Schubert mixture', 'ionian', 'I i bVI V7', 'major-minor shift, flat submediant'),
      P('Sequence by thirds', 'ionian', 'I vi IV ii bVI IV V7 I', 'falling thirds with modal mixture')
    ] },
    { name: 'Impressionism', list: [
      P('Planing major sevenths', 'lydian', 'Imaj7 IImaj7 Imaj7 VIImaj7', 'parallel chords in Lydian colour'),
      P('Whole-tone', 'wholetone', 'I+ II+ I+ bVII+', 'augmented triads on a whole-tone scale'),
      P('Lydian vamp', 'lydian', 'I II I II', 'raised fourth sustained over the tonic'),
      P('Dorian ninths', 'dorian', 'im9 IV9 im9 IV9', 'modal oscillation, no dominant'),
      P('Gymnopedie sway', 'ionian', 'IVmaj7 Imaj7', 'two major sevenths rocking a fourth apart'),
      P('Aeolian planing', 'aeolian', 'im7 VIImaj7 VImaj7 VIImaj7', 'diatonic parallel sevenths'),
      P('Octatonic', 'octatonic', 'I7 bIII7 bV7 VI7', 'dominant sevenths a minor third apart')
    ] },
    { name: 'Jazz', list: [
      P('ii-V-I major', 'ionian', 'iim7 V7 Imaj7 Imaj7', 'guide tones: 7th falls to 3rd'),
      P('ii-V-i minor', 'harmonic', 'iiø7 V7b9 im7 im7', 'half-diminished pre-dominant'),
      P('Rhythm changes A', 'ionian', 'Imaj7:0.5 vi7:0.5 iim7:0.5 V7:0.5 iiim7:0.5 VI7:0.5 iim7:0.5 V7:0.5', 'I-vi-ii-V turnarounds'),
      P('12-bar blues', 'mixolydian', 'I7 IV7 I7 I7 IV7 IV7 I7 VI7 iim7 V7 I7 V7', 'dominant sevenths on I, IV, V'),
      P('Coltrane changes', 'ionian', 'Imaj7 bIII7 bVImaj7 VII7 IIImaj7 V7 Imaj7 Imaj7', 'tonics a major third apart'),
      P('Tritone substitution', 'ionian', 'iim7 bII7 Imaj7 Imaj7', 'bII7 shares the tritone of V7'),
      P('Diatonic cycle', 'ionian', 'iim7 V7 Imaj7 IVmaj7 viiø7 III7 vim7 vim7', 'falling fifths through the key'),
      P('Modal (So What)', 'dorian', 'im7:2 #im7:2', 'Dorian vamp shifted up a semitone'),
      P('Backdoor ii-V', 'ionian', 'ivm7 bVII7 Imaj7 Imaj7', 'minor plagal approach')
    ] },
    { name: 'Contemporary', list: [
      P('Axis', 'ionian', 'I V vi IV', 'pop loop'),
      P('Andalusian', 'aeolian', 'i VII VI V', 'descending tetrachord to a major dominant'),
      P('Mixolydian rock', 'mixolydian', 'I bVII IV I', 'double plagal motion'),
      P('Aeolian loop', 'aeolian', 'i VI III VII', 'minor loop without leading tone'),
      P('Neo-soul', 'ionian', 'IVmaj7 iiim7 vim7 Imaj7', 'extended chords, stepwise bass'),
      P('Quartal', 'dorian', '[0,5,10] [2,7,0] [3,8,1] [2,7,0]', 'stacked fourths, modal'),
      P('Film minor', 'aeolian', 'i VI VII i', 'epic minor with flat-six and flat-seven'),
      P('Chromatic mediant (film)', 'ionian', 'I bVI I iv', 'major tonic and borrowed iv')
    ] },
    { name: 'World Traditions', list: [
      P('Flamenco cadence', 'phrygdom', 'iv bIII bII I', 'Andalusian cadence ending on major Phrygian tonic'),
      P('Son / tumbao', 'ionian', 'I IV V IV', 'Cuban montuno cycle'),
      P('Highlife', 'ionian', 'I IV I V', 'West African guitar-band cycle'),
      P('Celtic double tonic', 'mixolydian', 'I bVII I bVII', 'alternating tonic and lower whole-step'),
      P('Klezmer (Freygish)', 'phrygdom', 'I iv bVII I', 'Ahava raba mode with major tonic'),
      P('Bossa nova', 'ionian', 'Imaj7 II7 iim7 bII7', 'chromatic descent to the tonic'),
      P('Drone (tonic and fifth)', 'ionian', '[0,7]:4', 'static drone for modal music')
    ] }
  ];

  var USER_SLOTS = 12;
  function categoryNames() { var r = ['Off (organism)'], i; for (i = 0; i < CATEGORIES.length; i++) r.push(CATEGORIES[i].name); r.push('User'); return r; }

  // library category (0 off, 1..8, 9 user) + 1-based index -> progression or null
  function resolve(cat, idx, userProgs) {
    cat = cat | 0;
    if (cat <= 0) return null;
    if (cat === CATEGORIES.length + 1) {
      var u = (userProgs || [])[((idx | 0) - 1 + USER_SLOTS) % USER_SLOTS];
      return u ? P('User ' + idx, u.mode || 'ionian', u.chords, 'user progression') : null;
    }
    var c = CATEGORIES[cat - 1];
    if (!c) return null;
    var i = ((idx | 0) - 1) % c.list.length;
    if (i < 0) i += c.list.length;
    return c.list[i];
  }

  return { CATEGORIES: CATEGORIES, USER_SLOTS: USER_SLOTS, parse: parse, toSteps: toSteps, chord: chord,
           resolve: resolve, categoryNames: categoryNames };
})();
