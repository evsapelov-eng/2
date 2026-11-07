'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GO, organism } = require('./helpers');

const MAJ = GO.Scales.byId('ionian').steps, MIN = GO.Scales.byId('aeolian').steps, HARM = GO.Scales.byId('harmonic').steps;
const pcs = (t, steps, key) => GO.Library.parse(t, steps || MAJ, key || 0).events[0].pcs.slice().sort((a, b) => a - b);

test('roman numerals, secondary dominants and special chords', () => {
  assert.deepStrictEqual(pcs('V7'), [2, 5, 7, 11]);                 // G B D F
  assert.deepStrictEqual(pcs('ii'), [2, 5, 9]);                     // D F A
  assert.deepStrictEqual(pcs('V7/V'), [0, 2, 6, 9]);                // D F# A C
  assert.deepStrictEqual(pcs('V7/ii'), [1, 4, 7, 9]);               // A C# E G
  assert.deepStrictEqual(pcs('N'), [1, 5, 8]);                      // Db F Ab
  assert.deepStrictEqual(pcs('Ger6'), [0, 3, 6, 8]);                // Ab C Eb F#
  assert.deepStrictEqual(pcs('It6'), [0, 6, 8]);
  assert.deepStrictEqual(pcs('Fr6'), [0, 2, 6, 8]);
  assert.deepStrictEqual(pcs('bVI'), [0, 3, 8]);                    // Ab C Eb
  assert.deepStrictEqual(pcs('VI', MIN), [0, 3, 8]);                // in minor VI is Ab
  assert.deepStrictEqual(pcs('iiø7', HARM), [0, 2, 5, 8]);          // D F Ab C
  assert.deepStrictEqual(pcs('V7b9', HARM), [2, 5, 7, 8, 11]);      // G B D F Ab
  assert.deepStrictEqual(pcs('Imaj7'), [0, 4, 7, 11]);
  assert.deepStrictEqual(pcs('#iio7'), [0, 3, 6, 9]);
  assert.deepStrictEqual(pcs('Dm7'), [0, 2, 5, 9]);                  // chord names
  assert.deepStrictEqual(pcs('Dm7', MAJ, 2), [0, 3, 7, 10]);         // relative to Key D
  assert.deepStrictEqual(pcs('[0,5,10]'), [0, 5, 10]);
  const p = GO.Library.parse('I:2 IV:0.5 V:1.5', MAJ, 0);
  assert.deepStrictEqual(p.events.map(e => [e.t, e.d]), [[0, 2], [2, 0.5], [2.5, 1.5]]);
  assert.strictEqual(p.bars, 4);
  assert.throws(() => GO.Library.parse('I V7 Xyz', MAJ, 0));
  assert.throws(() => GO.Library.parse('', MAJ, 0));
});

test('every library progression parses and has a musical rationale', () => {
  let n = 0;
  for (const c of GO.Library.CATEGORIES) {
    assert.ok(c.list.length >= 6, c.name);
    for (const p of c.list) {
      const parsed = GO.Library.parse(p.chords, GO.Scales.byId(p.mode).steps, 0);
      assert.ok(parsed.events.length >= 1 && parsed.bars > 0, p.name);
      assert.ok(p.logic.length > 5, p.name + ' has no rationale');
      n++;
    }
  }
  assert.ok(n >= 50, n + ' progressions');
  assert.deepStrictEqual(GO.Library.CATEGORIES.map(c => c.name),
    ['Renaissance', 'Baroque', 'Classical', 'Romantic', 'Impressionism', 'Jazz', 'Contemporary', 'World Traditions']);
});

test('library progressions drive every generator, chromatic chords included', () => {
  const cats = GO.Library.CATEGORIES;
  for (let c = 1; c <= cats.length; c++) for (let i = 1; i <= cats[c - 1].list.length; i++) {
    for (const gen of ['melodic', 'rhythmic', 'hybrid', 'experimental']) {
      const o = organism({ gen, lib: c, prog: i, key: 3 }, c * 7 + i), F = o.frame();
      assert.strictEqual(o.libError, null);
      const R = o.render();
      assert.strictEqual(R.len % F.lib.len === 0 || R.len === F.lib.len, true);
      R.forEach(ev => ev.forEach(e => assert.ok(F.inScale(e.p + (e.c || 0) / 100, e.t),
        `${cats[c - 1].name} ${i} ${gen}: ${e.p} at ${e.t} not in local scale`)));
    }
  }
  // V7/V really produces the raised fourth in the music
  const o = organism({ gen: 'hybrid', lib: 3, prog: 7, key: 0 }, 2);
  const F = o.frame(), seg = F.segments().find(s => s.chord.label === 'V7/V');
  const notes = o.render().flat().filter(e => e.t >= seg.t && e.t < seg.t + seg.d);
  assert.ok(notes.some(e => e.p % 12 === 6), 'no F# over V7/V');
});

test('harmonic length stretches the progression; the cycle holds it whole', () => {
  const half = organism({ lib: 2, prog: 1, hlen: 0.5, bars: 2 }, 1), dbl = organism({ lib: 2, prog: 1, hlen: 2, bars: 2 }, 1);
  assert.strictEqual(half.frame().lib.len, 4 * 16);
  assert.strictEqual(dbl.frame().lib.len, 16 * 16);
  assert.strictEqual(dbl.render().len, 16 * 16);
});

test('user progressions: stored per slot, validated, used by the generators', () => {
  const o = organism({ gen: 'hybrid', lib: 9, prog: 3 }, 5);
  assert.ok(o.libError);
  assert.throws(() => o.setUserProg(3, 'I V7 Qz'));
  o.setUserProg(3, 'Imaj7 vi7 ii7 V7');
  o.invalidate();
  const F = o.frame();
  assert.strictEqual(o.libError, null);
  assert.deepStrictEqual(F.lib.events.map(e => e.label), ['Imaj7', 'vi7', 'ii7', 'V7']);
  assert.ok(o.render()[1].length > 0);
});

test('musica ficta: Renaissance dominant gets a leading tone, Gregorian chant does not', () => {
  const r = organism({ gen: 'hybrid', sysCat: 2, sysVar: 1, key: 2 }, 1);     // Renaissance Dorian on D
  const F = r.frame();
  const dom = F.segments().find(s => s.chord.root === 4);
  if (dom) assert.ok(r.render()[1].filter(e => e.t === dom.t).some(e => e.p % 12 === 1), 'no C# in the A chord');
  const g = organism({ gen: 'melodic', sysCat: 1, sysVar: 1, key: 2 }, 1);
  g.render().forEach(ev => ev.forEach(e => assert.notStrictEqual(e.p % 12, 1, 'C# in Gregorian Dorian')));
});
