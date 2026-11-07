// historical_modes.js: catalogue of historical modal systems with their rules.
//
// Each entry is a rule object (format in scale_library.js). The rules, not
// only the pitch set, drive generation: finalis and repercussa / ghammaz /
// shahed / vadi, ambitus (authentic vs plagal), characteristic formulas,
// approach to the final, ascent/descent restrictions of ragas, descending
// Greek orientation, traditional rhythmic cycles (iqa'at, talas, poetic
// feet) and the kind of accompaniment the tradition allows (no Western
// chords for traditions that do not use functional harmony).
//
// Pitches are relative to the final (Key = the final / tonic / Sa / qarar).
// Quarter tones and Byzantine moria are given as fractional semitones and are
// played with pitch bend (MICRO). The Byzantine values follow the Chrysanthine
// division of the octave into 72 moria; the Arabic and Persian neutral steps
// use the common 24-tone approximation. Indian ragas are given in 12-tone
// equal temperament (shruti nuances are not modelled).

GO.Systems = (function () {
  // ---- rhythmic cycles, in 16th steps ------------------------------------
  function cyc(name, n, on, acc, soft) { return { name: name, n: n, on: on, acc: acc || [0], soft: soft || [] }; }
  function every(n, d) { var a = [], i; for (i = 0; i < n; i += d) a.push(i); return a; }

  var IQAAT = [  // Arabic: dum (accent) and tek, notated in eighths -> 16ths
    cyc('Maqsum', 16, [0, 2, 6, 8, 12], [0, 8]),
    cyc('Baladi', 16, [0, 2, 6, 8, 12], [0, 2, 8]),
    cyc("Sa'idi", 16, [0, 2, 6, 8, 12], [0, 6, 8]),
    cyc("Sama'i Thaqil 10/8", 20, [0, 6, 10, 12, 14], [0, 10, 12]),
    cyc('Ayyub 2/4', 8, [0, 3, 4, 6], [0, 4])
  ];
  var TALAS = [  // Hindustani: one matra = an eighth; accents on tali, softer khali
    cyc('Teentaal 16', 32, every(32, 2), [0, 8, 24], [16, 18, 20, 22]),
    cyc('Ektaal 12', 24, every(24, 2), [0, 8, 16, 20], [4, 12]),
    cyc('Jhaptaal 10', 20, every(20, 2), [0, 4, 14], [10, 12]),
    cyc('Rupak 7', 14, every(14, 2), [6, 10], [0, 2, 4]),
    cyc('Keherwa 8', 16, every(16, 2), [0], [8, 10]),
    cyc('Dadra 6', 12, every(12, 2), [0], [6, 8])
  ];
  var PERSIAN = [
    cyc('Reng 6/8', 12, [0, 3, 5, 6, 9, 11], [0, 6]),
    cyc('Zarbi 2/4', 8, [0, 3, 4, 6], [0, 4])
  ];
  // Greek poetic feet: L = long (4 steps), S = short (2 steps)
  function foot(name, pat) { return { name: name, pat: pat }; }
  var FEET = [foot('Dactyl', 'LSS'), foot('Anapest', 'SSL'), foot('Iamb', 'SL'), foot('Trochee', 'LS'),
              foot('Cretic', 'LSL'), foot('Spondee', 'LL'), foot('Paeon', 'LSSS')];
  function feetRhythms() {
    var r = [], i, j;
    for (i = 0; i < FEET.length; i++) {
      var t = 0, on = [];
      for (j = 0; j < FEET[i].pat.length; j++) { on.push(t); t += FEET[i].pat.charAt(j) === 'L' ? 4 : 2; }
      r.push(cyc(FEET[i].name, t, on, [0]));
    }
    return r;
  }

  function sys(cat, name, steps, o) {
    var s = { id: cat + ':' + name, cat: cat, name: name, steps: steps, harmony: o.harmony, half: o.half,
              emph: o.emph || [], drone: o.drone || [0], ambitus: o.ambitus || null, formulas: o.formulas || null,
              cad: o.cad || 0, ficta: !!o.ficta, upAvoid: o.upAvoid || [], downAvoid: o.downAvoid || [],
              down: o.down || null, contour: o.contour || 0, rhythms: o.rhythms || null, feet: o.feet || null,
              prog: o.prog || null, noSevenths: !!o.noSevenths, note: o.note || '' };
    s.dom = s.half;
    return s;
  }

  // ---- Gregorian / Medieval: the eight church modes ------------------------
  var DOR = [0, 2, 3, 5, 7, 9, 10], PHR = [0, 1, 3, 5, 7, 8, 10], LYD = [0, 2, 4, 6, 7, 9, 11], MIX = [0, 2, 4, 5, 7, 9, 10];
  function greg(name, steps, tenor, plagal, formulas, note) {
    return sys('Gregorian', name, steps, { harmony: 'organum', half: tenor, drone: [0, 4],
      ambitus: plagal ? [-3, 5] : [-1, 8], formulas: formulas, cad: 1, contour: 0, note: note });
  }
  var GREGORIAN = [
    greg('Mode 1 Dorian (authentic)', DOR, 4, false, [[0, 4], [0, 2, 3, 4], [0, 1, 2, 1, 0]], 'final D, tenor A, ambitus D-d'),
    greg('Mode 2 Hypodorian (plagal)', DOR, 2, true, [[0, -1, 0, 2], [-3, -2, 0], [0, 2, 1, 0]], 'final D, tenor F, ambitus A-a'),
    greg('Mode 3 Phrygian (authentic)', PHR, 5, false, [[0, 2, 4, 5], [0, 3, 5], [5, 4, 3, 2, 1, 0]], 'final E, tenor C'),
    greg('Mode 4 Hypophrygian (plagal)', PHR, 3, true, [[0, 1, 3], [-1, 0, 1, 3], [3, 2, 1, 0]], 'final E, tenor A'),
    greg('Mode 5 Lydian (authentic)', LYD, 4, false, [[0, 2, 4], [0, 4, 5, 4], [4, 3, 2, 1, 0]], 'final F, tenor C'),
    greg('Mode 6 Hypolydian (plagal)', LYD, 2, true, [[0, 2, 1, 0], [0, -1, 0, 2], [2, 1, 0]], 'final F, tenor A'),
    greg('Mode 7 Mixolydian (authentic)', MIX, 4, false, [[0, 4, 5, 4], [0, 3, 4], [4, 3, 2, 1, 0]], 'final G, tenor D'),
    greg('Mode 8 Hypomixolydian (plagal)', MIX, 3, true, [[0, 1, 3], [0, 2, 3], [3, 2, 1, 0]], 'final G, tenor C')
  ];

  // ---- Renaissance modal polyphony (Glarean), triads only, musica ficta -----
  function ren(name, steps, half, prog, formulas, cad) {
    return sys('Renaissance', name, steps, { harmony: 'chords', half: half, prog: prog, ficta: true, noSevenths: true,
      formulas: formulas, cad: cad === undefined ? -1 : cad, note: 'triads, clausula vera with ficta leading tone' });
  }
  var RENAISSANCE = [
    ren('Dorian', DOR, 4, [[0, 6, 2, 4], [0, 3, 4, 0], [0, 5, 6, 4]], [[0, 4, 3, 2, 1, 0], [0, 2, 3, 4]]),
    ren('Phrygian', PHR, 3, [[0, 3, 6, 0], [0, 5, 3, 0], [0, 6, 5, 0]], [[0, 2, 3, 2, 1, 0], [3, 2, 1, 0]], 1),
    ren('Lydian (with B-flat)', [0, 2, 4, 5, 7, 9, 11], 4, [[0, 4, 3, 0], [0, 5, 4, 0], [0, 3, 4, 0]], [[0, 2, 4, 3, 2, 1, 0]]),
    ren('Mixolydian', MIX, 4, [[0, 6, 3, 0], [0, 3, 4, 0], [0, 6, 4, 0]], [[0, 4, 5, 4, 3], [0, 2, 3, 4]]),
    ren('Aeolian', [0, 2, 3, 5, 7, 8, 10], 4, [[0, 5, 6, 0], [0, 3, 4, 0], [0, 6, 4, 0]], [[0, 2, 4, 3, 2, 1, 0]]),
    ren('Ionian', [0, 2, 4, 5, 7, 9, 11], 4, [[0, 3, 4, 0], [0, 5, 3, 4], [0, 1, 4, 0]], [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]])
  ];

  // ---- Byzantine Oktoechos (Chrysanthine moria), ison accompaniment ----------
  function byz(name, steps, half, formulas, note) {
    return sys('Byzantine', name, steps, { harmony: 'ison', half: half, drone: [0], ambitus: [-2, 8],
      formulas: formulas, cad: 1, note: note });
  }
  var BYZANTINE = [
    byz('Echos 1 (Protos, diatonic)', [0, 1.667, 3, 5, 7, 8.667, 10], 3, [[0, 1, 2, 3], [3, 2, 1, 0], [0, 2, 1, 0]], 'base Pa, dominant Di'),
    byz('Echos 2 (soft chromatic)', [0, 1.333, 3.667, 5, 7, 8.333, 10.667], 6, [[0, 1, 2, 1, 0], [-1, 0, 1, 0]], 'base Di, soft chromatic tetrachords'),
    byz('Echos 3 (Tritos, enharmonic)', [0, 2, 4, 5, 7, 9, 11], 2, [[0, 2, 3, 2], [2, 1, 0]], 'base Ga, enharmonic semitone Zo-flat'),
    byz('Echos 4 (Tetartos, diatonic)', [0, 2, 3.667, 5, 7, 8.667, 10], 2, [[0, 1, 2, 1, 0], [2, 3, 2, 1, 0]], 'base Di'),
    byz('Plagal 2 (hard chromatic)', [0, 1, 4.333, 5, 7, 8, 11.333], 3, [[0, 1, 2, 3], [3, 2, 1, 0]], 'base Pa, hard chromatic'),
    byz('Plagal 4 (diatonic)', [0, 2, 3.667, 5, 7, 9, 10.667], 4, [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]], 'base Ni')
  ];

  // ---- Arabic maqamat: heterophony over the qarar, sayr through the ghammaz ---
  function maq(name, steps, ghammaz, formulas, down) {
    return sys('Arabic', name, steps, { harmony: 'heterophony', half: ghammaz, drone: [0], ambitus: [-2, 9],
      formulas: formulas, cad: 1, down: down || null, rhythms: IQAAT, note: 'ghammaz on degree ' + (ghammaz + 1) });
  }
  var ARABIC = [
    maq('Rast', [0, 2, 3.5, 5, 7, 9, 10.5], 4, [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0], [2, 1, 0]], [0, 2, 3.5, 5, 7, 9, 10]),
    maq('Bayati', [0, 1.5, 3, 5, 7, 8, 10], 3, [[0, 1, 2, 3], [3, 2, 1, 0], [0, 1, 0, -1, 0]]),
    maq('Sikah', [0, 1.5, 3.5, 5.5, 7, 8.5, 10.5], 2, [[0, 1, 2], [2, 1, 0], [0, 2, 1, 0]]),
    maq('Hijaz', [0, 1, 4, 5, 7, 8, 10], 3, [[0, 1, 2, 3], [3, 2, 1, 0], [0, 2, 1, 0]]),
    maq('Saba', [0, 1.5, 3, 4, 7, 8, 10], 2, [[0, 1, 2, 3, 2, 1, 0], [2, 1, 0]]),
    maq('Nahawand', [0, 2, 3, 5, 7, 8, 11], 4, [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]], [0, 2, 3, 5, 7, 8, 10]),
    maq('Kurd', [0, 1, 3, 5, 7, 8, 10], 3, [[0, 1, 2, 3], [3, 2, 1, 0]]),
    maq('Ajam', [0, 2, 4, 5, 7, 9, 11], 4, [[0, 2, 4], [4, 3, 2, 1, 0]])
  ];

  // ---- Persian dastgah: drone on the tonic, shahed as centre ----------------
  function dast(name, steps, shahed, formulas) {
    return sys('Persian', name, steps, { harmony: 'drone', half: shahed, drone: [0], ambitus: [-2, 8],
      formulas: formulas, cad: 1, rhythms: PERSIAN, note: 'shahed on degree ' + (shahed + 1) + ', forud to the tonic' });
  }
  var PERSIAN_SYS = [
    dast('Shur', [0, 1.5, 3, 5, 7, 8, 10], 3, [[0, 1, 2, 1, 0], [3, 2, 1, 0]]),
    dast('Segah', [0, 1.5, 3.5, 5, 7, 8.5, 10.5], 0, [[0, 1, 0, -1, 0], [2, 1, 0]]),
    dast('Chahargah', [0, 1.5, 4, 5, 7, 8.5, 11], 4, [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]]),
    dast('Homayun', [0, 1.5, 4, 5, 7, 8, 10], 3, [[0, 1, 2, 3], [3, 2, 1, 0]]),
    dast('Mahur', [0, 2, 4, 5, 7, 9, 11], 4, [[0, 2, 4, 3, 2], [4, 3, 2, 1, 0]])
  ];

  // ---- Hindustani ragas: tanpura drone, vadi/samvadi, aroha/avaroha ----------
  function raga(name, steps, vadi, samvadi, drone, pakad, upAvoid, downAvoid) {
    return sys('Indian', name, steps, { harmony: 'drone', half: vadi, emph: [samvadi], drone: drone,
      formulas: pakad, upAvoid: upAvoid, downAvoid: downAvoid, rhythms: TALAS, ambitus: [-3, 9],
      note: 'vadi ' + (vadi + 1) + ', samvadi ' + (samvadi + 1) });
  }
  var INDIAN = [
    raga('Yaman', [0, 2, 4, 6, 7, 9, 11], 2, 6, [0, 4], [[-1, 1, 2, 1, 0], [4, 3, 2, 1, 0]], [4]),
    raga('Bhairav', [0, 1, 4, 5, 7, 8, 11], 5, 1, [0, 4], [[2, 3, 5, 5, 4], [2, 3, 1, 1, 0]]),
    raga('Bhupali', [0, 2, 4, 7, 9], 2, 4, [0, 3], [[2, 1, 0, -1], [0, 1, 2, 3, 2, 4, 3, 2, 1, 0]]),
    raga('Kafi', [0, 2, 3, 5, 7, 9, 10], 4, 0, [0, 4], [[0, 0, 1, 1, 2, 2, 3, 3, 4], [4, 3, 2, 1, 0]]),
    raga('Bhimpalasi', [0, 2, 3, 5, 7, 9, 10], 3, 0, [0, 4], [[-1, 0, 2, 3, 4, 3, 2, 1, 0]], [1, 5]),
    raga('Marwa', [0, 1, 4, 6, 9, 11], 1, 4, [0, 5], [[-2, -1, 1, 2, 3, 2, 1, 0]]),
    raga('Todi', [0, 1, 3, 6, 7, 8, 11], 5, 2, [0, 4], [[-2, -1, 0, 1, 2, 1, 0]]),
    raga('Malkauns', [0, 3, 5, 8, 10], 2, 0, [0, 2], [[2, 1, 2, 3, 4, 3, 2, 1, 0]])
  ];

  // ---- Ancient Greek harmoniai and genera: descending, centred on mese -------
  function greek(name, steps, mese) {
    return sys('Ancient Greek', name, steps, { harmony: 'heterophony', half: mese, drone: [mese],
      ambitus: [-1, 8], contour: -1, cad: 1, feet: FEET, rhythms: feetRhythms(),
      formulas: [[mese, mese - 1, mese - 2, mese - 3], [7, 6, 5, 4]], note: 'descending; mese on degree ' + (mese + 1) });
  }
  var GREEK = [
    greek('Dorian (E, diatonic)', [0, 1, 3, 5, 7, 8, 10], 3),
    greek('Phrygian (D)', [0, 2, 3, 5, 7, 9, 10], 4),
    greek('Lydian (C)', [0, 2, 4, 5, 7, 9, 11], 5),
    greek('Mixolydian (B)', [0, 1, 3, 5, 6, 8, 10], 6),
    greek('Hypodorian (A)', [0, 2, 3, 5, 7, 8, 10], 0),
    greek('Hypophrygian (G)', [0, 2, 4, 5, 7, 9, 10], 1),
    greek('Hypolydian (F)', [0, 2, 4, 6, 7, 9, 11], 2),
    greek('Dorian, chromatic genus', [0, 1, 2, 5, 7, 8, 9], 3),
    greek('Dorian, enharmonic genus', [0, 0.5, 1, 5, 7, 7.5, 8], 3)
  ];

  var CATEGORIES = [
    { name: 'Western', list: null },
    { name: 'Gregorian', list: GREGORIAN },
    { name: 'Renaissance', list: RENAISSANCE },
    { name: 'Byzantine', list: BYZANTINE },
    { name: 'Arabic', list: ARABIC },
    { name: 'Persian', list: PERSIAN_SYS },
    { name: 'Indian', list: INDIAN },
    { name: 'Ancient Greek', list: GREEK }
  ];

  // category index (0 = Western) and 1-based variant -> rule object or null
  function resolve(cat, variant) {
    var c = CATEGORIES[cat | 0];
    if (!c || !c.list) return null;
    var i = ((variant | 0) - 1) % c.list.length;
    if (i < 0) i += c.list.length;
    return c.list[i];
  }
  function categoryNames() { var r = [], i; for (i = 0; i < CATEGORIES.length; i++) r.push(CATEGORIES[i].name); return r; }
  function all() {
    var r = [], i, j;
    for (i = 1; i < CATEGORIES.length; i++) for (j = 0; j < CATEGORIES[i].list.length; j++) r.push(CATEGORIES[i].list[j]);
    return r;
  }

  return { CATEGORIES: CATEGORIES, resolve: resolve, categoryNames: categoryNames, all: all,
           IQAAT: IQAAT, TALAS: TALAS, FEET: FEET };
})();
