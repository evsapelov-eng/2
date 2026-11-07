'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GO, organism } = require('./helpers');

const GENS = ['melodic', 'rhythmic'];
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

test('every note is in the selected mode and inside the voice range', () => {
  for (const gen of GENS) {
    for (let scale = 0; scale < GO.Scales.LIST.length; scale++) {
      for (const key of [0, 3, 7, 11]) {
        for (const bars of [1, 2, 4, 8]) {
          const o = organism({ gen, scale, key, bars, complexity: 0.9, variation: 0.9, density: 1 }, scale * 13 + key + bars);
          for (let m = 0; m < 3; m++) {
            o.render().forEach((ev, i) => {
              const v = o.params.voices[i];
              for (const e of ev) {
                assert.ok(GO.Scales.inScale(GO.Scales.get(scale), key, e.p), `${gen} ${scale}/${key}: ${e.p} out of scale`);
                assert.ok(e.p >= v.lo && e.p <= v.hi, `${gen} voice ${i}: ${e.p} outside ${v.lo}-${v.hi}`);
                assert.ok(e.t >= 0 && e.t < bars * 16 && e.d >= 1 && e.t + e.d <= bars * 16, `bad timing ${JSON.stringify(e)}`);
                assert.ok(e.v >= 1 && e.v <= 127);
              }
            });
            o.mutate();
          }
        }
      }
    }
  }
});

test('same seed gives the same organism; different seeds differ', () => {
  for (const gen of GENS) {
    const a = organism({ gen }, 5).render(), b = organism({ gen }, 5).render(), c = organism({ gen }, 6).render();
    assert.deepStrictEqual(a, b);
    assert.notDeepStrictEqual(a, c);
  }
});

test('MELODIC lines are monophonic and restate their motif', () => {
  let restated = 0, total = 0;
  for (let s = 1; s <= 40; s++) {
    const o = organism({ gen: 'melodic', bars: 4 }, s);
    const g = o.dna.voices[2], R = o.render()[2];
    const starts = R.map(e => e.t);
    assert.strictEqual(new Set(starts).size, starts.length, 'two notes at once in a melodic voice');
    for (let i = 1; i < R.length; i++) assert.ok(R[i - 1].t + R[i - 1].d <= R[i].t, 'overlapping melodic notes');
    // rhythm of the first motif slot appears again later in the phrase
    const M = g.motifSteps, first = starts.filter(t => t < M).join(',');
    total++;
    for (let k = 1; k * M < 64; k++) {
      if (starts.filter(t => t >= k * M && t < (k + 1) * M).map(t => t - k * M).join(',') === first) { restated++; break; }
    }
  }
  assert.ok(restated / total > 0.6, `motif rhythm restated in only ${restated}/${total} phrases`);
});

test('MELODIC strong beats lean on the shared harmony', () => {
  let chordTones = 0, strong = 0;
  for (let s = 1; s <= 30; s++) {
    const o = organism({ gen: 'melodic', bars: 4, key: 2, scale: 0 }, s);
    const scale = GO.Scales.get(0), n = 7;
    o.render().forEach(ev => ev.forEach(e => {
      if (e.t % 4) return;
      const ch = GO.Harmony.chordAt(o.dna.harmony, scale, e.t, 16, 4);
      strong++;
      if (GO.Harmony.isChordTone(GO.Scales.degreeOf(scale, 2, e.p), ch, n)) chordTones++;
    }));
  }
  assert.ok(chordTones / strong > 0.65, `only ${(100 * chordTones / strong).toFixed(0)}% chord tones on strong beats`);
});

test('RHYTHMIC voices are built from Euclidean layers of their own cycle length', () => {
  const o = organism({ gen: 'rhythmic', bars: 2, density: 0.75, variation: 0 }, 3);
  const L = o.dna.voices[0].layers[0];
  const expected = [];
  for (let t = 0; t < 32; t++) if (GO.Rhythmic.hit(t % L.n, L.k, L.n, L.rot)) expected.push(t);
  const got = new Set(o.render()[0].map(e => e.t));
  const shifted = L.shift.some(x => x) || L.drops.some(x => x);
  if (!shifted && o.dna.voices[0].layers.length === 1) assert.deepStrictEqual([...got].sort((a, b) => a - b), expected);
  // across many organisms, polymetric layers (n != 16 and != 8) appear at high complexity
  let poly = 0;
  for (let s = 1; s <= 40; s++) {
    const x = organism({ gen: 'rhythmic', complexity: 1, variation: 1 }, s);
    if (x.dna.voices.some(v => v.layers.some(l => l.n !== 16 && l.n !== 8))) poly++;
  }
  assert.ok(poly > 20, `polymeter in only ${poly}/40`);
});

test('the two generators are different algorithms', () => {
  const m = organism({ gen: 'melodic' }, 9).dna.voices[2], r = organism({ gen: 'rhythmic' }, 9).dna.voices[2];
  assert.ok(m.cells && m.ops && !m.layers);
  assert.ok(r.layers && !r.cells);
});

function lineage(over, seed, steps) {
  const o = organism(over, seed);
  const origin = o.render(), out = { toOrigin: [], toParent: [] };
  for (let i = 0; i < steps; i++) {
    const before = o.render();
    o.mutate();
    const after = o.render();
    out.toParent.push(GO.Similarity.organism(after, before));
    out.toOrigin.push(GO.Similarity.organism(after, origin));
  }
  return out;
}

test('STABILITY keeps the lineage close to the original idea', () => {
  for (const gen of GENS) {
    const hi = [], lo = [];
    for (let s = 1; s <= 12; s++) {
      hi.push(mean(lineage({ gen, stability: 0.95 }, s, 12).toOrigin));
      lo.push(mean(lineage({ gen, stability: 0.05 }, s, 12).toOrigin));
    }
    assert.ok(mean(hi) > mean(lo) + 0.15, `${gen}: stability .95 → ${mean(hi).toFixed(2)}, .05 → ${mean(lo).toFixed(2)}`);
    assert.ok(mean(hi) > 0.6, `${gen}: high stability lost the idea (${mean(hi).toFixed(2)})`);
  }
});

test('MUTATION AMOUNT and PROBABILITY scale the size of each change', () => {
  for (const gen of GENS) {
    const small = [], big = [], fewP = [], manyP = [];
    for (let s = 1; s <= 12; s++) {
      small.push(mean(lineage({ gen, amount: 0.1, stability: 0 }, s, 6).toParent));
      big.push(mean(lineage({ gen, amount: 1, stability: 0 }, s, 6).toParent));
      fewP.push(mean(lineage({ gen, prob: 0.05, stability: 0 }, s, 6).toParent));
      manyP.push(mean(lineage({ gen, prob: 1, stability: 0 }, s, 6).toParent));
    }
    assert.ok(mean(small) > mean(big) + 0.05, `${gen}: amount .1 → ${mean(small).toFixed(2)}, 1 → ${mean(big).toFixed(2)}`);
    assert.ok(mean(fewP) > mean(manyP) + 0.03, `${gen}: prob .05 → ${mean(fewP).toFixed(2)}, 1 → ${mean(manyP).toFixed(2)}`);
  }
});

test('every MUTATE changes the material audibly but keeps the previous DNA', () => {
  for (const gen of GENS) {
    const o = organism({ gen }, 11);
    for (let i = 0; i < 10; i++) {
      const before = JSON.stringify(o.render()), dna = JSON.stringify(o.dna);
      assert.strictEqual(o.mutate(), true);
      assert.notStrictEqual(JSON.stringify(o.render()), before);
      assert.strictEqual(JSON.stringify(o.prev[o.prev.length - 1]), dna);
    }
  }
});

test('FREEZE blocks mutation, REVERT restores, RESET DNA starts a new idea', () => {
  const o = organism({ gen: 'melodic' }, 21);
  const g0 = JSON.stringify(o.render());
  o.params.frozen = true;
  assert.strictEqual(o.mutate(), false);
  assert.strictEqual(JSON.stringify(o.render()), g0);
  o.params.frozen = false;
  o.mutate();
  const g1 = JSON.stringify(o.render());
  o.mutate();
  assert.ok(o.revert());
  assert.strictEqual(JSON.stringify(o.render()), g1);
  assert.ok(o.revert());
  assert.strictEqual(JSON.stringify(o.render()), g0);
  o.reset(999);
  assert.notStrictEqual(JSON.stringify(o.render()), g0);
  assert.ok(o.revert());
  assert.strictEqual(JSON.stringify(o.render()), g0);
});

test('a voice with Mutation 0 never changes', () => {
  const o = organism({ gen: 'rhythmic' }, 4);
  o.params.voices[1].mut = 0;
  const v1 = JSON.stringify(o.dna.voices[1]);
  for (let i = 0; i < 15; i++) o.mutate();
  assert.strictEqual(JSON.stringify(o.dna.voices[1]), v1);
});

test('key and mode changes re-voice the same DNA', () => {
  const o = organism({ gen: 'melodic', key: 0 }, 8);
  const a = o.render();
  o.params.key = 5; o.invalidate();
  const b = o.render();
  assert.deepStrictEqual(a.map(v => v.map(e => e.t)), b.map(v => v.map(e => e.t)), 'rhythm must not change with key');
});

test('state survives serialize/restore exactly', () => {
  for (const gen of GENS) {
    const o = organism({ gen }, 33);
    for (let i = 0; i < 5; i++) o.mutate();
    const s = encodeURIComponent(o.serialize());
    const chunks = [];
    for (let i = 0; i < s.length; i += 2000) chunks.push(s.substr(i, 2000));
    const p = GO.Organism.defaultParams(); p.gen = gen;
    const o2 = new GO.Organism.Organism(p, 1);
    assert.ok(o2.restore(decodeURIComponent(chunks.join(''))));
    assert.deepStrictEqual(o2.render(), o.render());
    assert.ok(o2.revert() && o.revert());
    assert.deepStrictEqual(o2.render(), o.render());
  }
});
