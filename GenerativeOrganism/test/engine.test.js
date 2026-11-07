'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GO, organism } = require('./helpers');

const GENS = ['melodic', 'rhythmic', 'hybrid', 'experimental'];
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const fp = e => e.p + (e.c || 0) / 100;

function checkOrganism(o, label) {
  const R = o.render(), F = o.frame();
  R.forEach((ev, i) => {
    const v = o.params.voices[i];
    for (const e of ev) {
      if (!(o.params.gen === 'experimental' && o.params.free)) {
        assert.ok(F.inScale(fp(e), e.t), `${label} voice ${i}: ${fp(e)} at ${e.t} outside the system`);
      }
      assert.ok(e.p >= v.lo && e.p <= v.hi, `${label} voice ${i}: ${e.p} outside ${v.lo}-${v.hi}`);
      assert.ok(e.t >= 0 && e.d >= 1 && e.t + e.d <= R.len, `${label}: bad timing ${JSON.stringify(e)} len ${R.len}`);
      assert.ok(e.v >= 1 && e.v <= 127);
    }
  });
}

test('Western modes: every note in the mode and range, all generators and cycle lengths', () => {
  for (const gen of GENS) for (let scale = 0; scale < GO.Scales.LIST.length; scale++) {
    for (const bars of [1, 2, 4, 8]) {
      const o = organism({ gen, scale, key: (scale * 5) % 12, bars, complexity: 0.9, variation: 0.9, density: 1 }, scale * 13 + bars);
      for (let m = 0; m < 2; m++) { checkOrganism(o, `${gen} scale ${scale} bars ${bars}`); o.mutate(); }
    }
  }
});

test('historical systems: every system, every generator stays in its pitch set (incl. quarter tones)', () => {
  const cats = GO.Systems.CATEGORIES;
  let count = 0;
  for (let c = 1; c < cats.length; c++) for (let v = 1; v <= cats[c].list.length; v++) {
    count++;
    for (const gen of GENS) {
      const o = organism({ gen, sysCat: c, sysVar: v, key: v % 12 }, c * 31 + v);
      checkOrganism(o, `${cats[c].name} ${v} ${gen}`);
      o.mutate();
      checkOrganism(o, `${cats[c].name} ${v} ${gen} mutated`);
    }
  }
  assert.ok(count >= 50, 'catalogue has ' + count + ' systems');
});

test('historical systems carry rules, not just pitch sets', () => {
  for (const s of GO.Systems.all()) {
    assert.ok(['chords', 'drone', 'ison', 'organum', 'heterophony'].includes(s.harmony), s.name);
    assert.ok(s.half >= 0 && s.half < s.steps.length, s.name + ' half');
    assert.ok(s.formulas && s.formulas.length, s.name + ' formulas');
    if (s.cat !== 'Renaissance') assert.notStrictEqual(s.harmony, 'chords', s.name + ' must not get Western chords');
  }
  const cats = GO.Systems.CATEGORIES.map(c => c.name);
  for (const want of ['Gregorian', 'Renaissance', 'Byzantine', 'Arabic', 'Persian', 'Indian', 'Ancient Greek']) assert.ok(cats.includes(want));
  assert.ok(GO.Systems.resolve(4, 1).steps.some(x => x % 1), 'Rast must have quarter tones');
  assert.ok(GO.Systems.resolve(6, 1).upAvoid.length, 'Yaman has aroha restrictions');
});

test('Gregorian: melodies end on the final, approached from above, inside the ambitus', () => {
  let cad = 0, total = 0;
  for (let v = 1; v <= 8; v++) for (let s = 1; s <= 6; s++) {
    const o = organism({ gen: 'melodic', sysCat: 1, sysVar: v, key: 2, bars: 4 }, s * 10 + v);
    const F = o.frame(), mel = o.render()[2];
    const rules = F.rules, final = F.degreeOf(fp(mel[mel.length - 1]), mel[mel.length - 1].t);
    total++;
    if (((final % 7) + 7) % 7 === 0) cad++;
    const degs = mel.map(e => F.degreeOf(fp(e), e.t));
    const span = Math.max(...degs) - Math.min(...degs);
    assert.ok(span <= rules.ambitus[1] - rules.ambitus[0] + 1, `mode ${v}: span ${span} beyond ambitus`);
  }
  assert.ok(cad / total > 0.8, `only ${cad}/${total} phrases end on the final`);
});

test('ragas: no ascending step into a degree the aroha omits', () => {
  for (let s = 1; s <= 20; s++) {
    const o = organism({ gen: 'melodic', sysCat: 6, sysVar: 1, key: 0, bars: 4 }, s);   // Yaman: Pa avoided in ascent
    const F = o.frame(), mel = o.render()[2];
    for (let i = 1; i < mel.length; i++) {
      const a = F.degreeOf(fp(mel[i - 1]), 0), b = F.degreeOf(fp(mel[i]), 0);
      if (b > a) assert.notStrictEqual(((b % 7) + 7) % 7, 4, 'ascending into Pa in Yaman');
    }
  }
});

test('traditional cycles drive RHYTHMIC in their traditions', () => {
  const names = new Set();
  for (let s = 1; s <= 10; s++) {
    for (const cat of [4, 6]) {
      const o = organism({ gen: 'rhythmic', sysCat: cat, sysVar: 1 }, s);
      o.dna.voices.forEach(v => v.layers.forEach(l => { if (l.cyc) names.add(l.cyc); }));
    }
  }
  assert.ok([...names].some(n => /Maqsum|Baladi|Sa'idi|Sama'i|Ayyub/.test(n)), 'no iqa');
  assert.ok([...names].some(n => /taal|Rupak|Keherwa|Dadra/.test(n)), 'no tala');
});

test('accompaniment follows the tradition (organum, ison, drone, heterophony)', () => {
  // Gregorian organum: the harmony voice sits a fourth or fifth under the chant
  const g = organism({ gen: 'hybrid', sysCat: 1, sysVar: 1, key: 2 }, 3);
  const R = g.render(), mel = R[2], org = R[1];
  let ok = 0;
  for (const e of org) {
    const m = mel.find(x => x.t === e.t);
    if (m && [5, 7, 17, 19].includes(Math.round(fp(m) - fp(e)) % 24)) ok++;
  }
  assert.ok(ok / org.length > 0.8, `organum intervals ${ok}/${org.length}`);
  // Byzantine ison: long held notes on the base or the dominant only
  const b = organism({ gen: 'hybrid', sysCat: 3, sysVar: 1, key: 2 }, 3), F = b.frame();
  for (const e of b.render()[1]) assert.ok([0, 3].includes(((F.degreeOf(fp(e), e.t) % 7) + 7) % 7));
  // Indian: no chords; the harmony voice is a drone on Sa and Pa
  const r = organism({ gen: 'hybrid', sysCat: 6, sysVar: 1, key: 0 }, 3);
  for (const e of r.render()[1]) assert.ok([0, 7].includes(e.p % 12), 'drone note ' + e.p);
});

test('microtones are sent as pitch bend only when MICRO is on', () => {
  const o = organism({ gen: 'melodic', sysCat: 4, sysVar: 1, key: 0, density: 1 }, 2);
  const pl = new GO.Player();
  pl.load(o.pattern(), true);
  let bends = 0;
  for (let t = 0; t < 128; t++) bends += pl.tick(t).filter(m => (m[0] & 0xf0) === 0xe0).length;
  assert.ok(bends > 0, 'no pitch bend in maqam Rast');
  pl.stop(); pl.micro = false; pl.load(o.pattern(), true);
  for (let t = 0; t < 128; t++) assert.strictEqual(pl.tick(t).filter(m => (m[0] & 0xf0) === 0xe0).length, 0);
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
    assert.strictEqual(new Set(starts).size, starts.length);
    for (let i = 1; i < R.length; i++) assert.ok(R[i - 1].t + R[i - 1].d <= R[i].t);
    const M = g.motifSteps, first = starts.filter(t => t < M).join(',');
    total++;
    for (let k = 1; k * M < 64; k++) {
      if (starts.filter(t => t >= k * M && t < (k + 1) * M).map(t => t - k * M).join(',') === first) { restated++; break; }
    }
  }
  assert.ok(restated / total > 0.6, `motif rhythm restated in only ${restated}/${total}`);
});

test('MELODIC strong beats lean on the shared harmony', () => {
  let chordTones = 0, strong = 0;
  for (let s = 1; s <= 30; s++) {
    const o = organism({ gen: 'melodic', bars: 4, key: 2, scale: 0 }, s), F = o.frame();
    o.render().forEach(ev => ev.forEach(e => {
      if (e.t % 4) return;
      strong++;
      if (GO.Harmony.isChordTone(F.degreeOf(fp(e), e.t), F.chordAt(e.t), F.n)) chordTones++;
    }));
  }
  assert.ok(chordTones / strong > 0.65, `${(100 * chordTones / strong).toFixed(0)}% chord tones on strong beats`);
});

test('RHYTHMIC: Euclidean layers with their own cycle lengths', () => {
  let poly = 0;
  for (let s = 1; s <= 40; s++) {
    const x = organism({ gen: 'rhythmic', complexity: 1, variation: 1 }, s);
    if (x.dna.voices.some(v => v.layers.some(l => l.n !== 16 && l.n !== 8))) poly++;
  }
  assert.ok(poly > 20, `polymeter in only ${poly}/40`);
  assert.ok(GO.Rhythmic.hit(0, 3, 8, 0) && !GO.Rhythmic.hit(1, 3, 8, 0));
});

test('HYBRID: the parts are built around each other', () => {
  let cons = 0, strong = 0, parallels = 0, moves = 0, roots = 0, segs = 0;
  for (let s = 1; s <= 25; s++) {
    const o = organism({ gen: 'hybrid', bars: 4, scale: 0 }, s), F = o.frame(), R = o.render();
    const mel = R[2], cp = R[3];
    for (const e of cp) {
      const m = mel.find(x => x.t <= e.t && x.t + x.d > e.t) || mel.filter(x => x.t <= e.t).pop();
      if (!m || !mel.some(x => x.t === e.t)) continue;
      strong++;
      if (GO.Hybrid.consonance(Math.abs(fp(e) - fp(m))) > 0) cons++;
    }
    for (let i = 1; i < cp.length; i++) {
      const m0 = mel.find(x => x.t === cp[i - 1].t), m1 = mel.find(x => x.t === cp[i].t);
      if (!m0 || !m1) continue;
      const i0 = Math.abs(cp[i - 1].p - m0.p) % 12, i1 = Math.abs(cp[i].p - m1.p) % 12;
      const dc = cp[i].p - cp[i - 1].p, dm = m1.p - m0.p;
      if (dc && dm) { moves++; if ((i0 === 7 || i0 === 0) && i0 === i1 && Math.sign(dc) === Math.sign(dm)) parallels++; }
    }
    if (o.dna.voices[0].style !== 'pedal') {
      for (const sg of F.segments()) {
        const b = R[0].find(e => e.t === sg.t);
        if (!b) continue;
        segs++;
        if (((F.degreeOf(fp(b), b.t) - sg.chord.root) % F.n + F.n) % F.n === 0) roots++;
      }
    }
  }
  assert.ok(cons / strong > 0.85, `counterpoint consonant on ${cons}/${strong} melody attacks`);
  assert.ok(parallels / moves < 0.05, `parallel perfect intervals ${parallels}/${moves}`);
  assert.ok(roots / segs > 0.9, `bass on the chord root at ${roots}/${segs} chord changes`);
});

test('HYBRID harmony: chord tones only, smooth voice leading', () => {
  let leaps = 0, moves = 0;
  for (let s = 1; s <= 20; s++) {
    const o = organism({ gen: 'hybrid', bars: 4, scale: 0, lib: 6, prog: 1 }, s), F = o.frame();
    const H = o.render()[1];
    for (const e of H) {
      const ch = F.chordAt(e.t);
      assert.ok(ch.pcs.some(pc => ((e.p - o.params.key - pc) % 12 + 12) % 12 === 0), `non-chord tone ${e.p} over ${ch.label}`);
    }
    const starts = [...new Set(H.map(e => e.t))].sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) {
      const a = H.filter(e => e.t === starts[i - 1]).map(e => e.p).sort((x, y) => x - y);
      const b = H.filter(e => e.t === starts[i]).map(e => e.p).sort((x, y) => x - y);
      for (let k = 0; k < Math.min(a.length, b.length); k++) { moves++; if (Math.abs(a[k] - b[k]) > 5) leaps++; }
    }
  }
  assert.ok(leaps / moves < 0.15, `voice leaps ${leaps}/${moves}`);
});

test('EXPERIMENTAL: serial operations, constrained vs free', () => {
  assert.deepStrictEqual(GO.Experimental.transform([1, 4, -2], { p: 'R', rot: 0, mul: 1 }), [2, -4, -1]);
  assert.deepStrictEqual(GO.Experimental.transform([1, 4, -2], { p: 'I', rot: 0, mul: 1 }), [-1, -4, 2]);
  assert.deepStrictEqual(GO.Experimental.transform([1, 4, -2], { p: 'P', rot: 1, mul: 1 }), [4, -2, 1]);
  let chromatic = 0;
  for (let s = 1; s <= 10; s++) {
    const o = organism({ gen: 'experimental', free: true, scale: 0 }, s), F = o.frame();
    o.render().forEach(ev => ev.forEach(e => { if (!F.inScale(fp(e), e.t)) chromatic++; }));
    const c = organism({ gen: 'experimental', free: false, scale: 0 }, s);
    checkOrganism(c, 'experimental constrained');
  }
  assert.ok(chromatic > 20, 'FREE produced no chromatic notes');
  // odd durations make phrases cross the barline
  const o = organism({ gen: 'experimental' }, 4);
  assert.ok(o.render().some(ev => ev.some(e => e.t % 4)), 'everything on the beat');
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

test('STABILITY keeps the lineage close to the original idea (all generators)', () => {
  for (const gen of GENS) {
    const hi = [], lo = [];
    for (let s = 1; s <= 8; s++) {
      hi.push(mean(lineage({ gen, stability: 0.95 }, s, 10).toOrigin));
      lo.push(mean(lineage({ gen, stability: 0.05 }, s, 10).toOrigin));
    }
    assert.ok(mean(hi) > mean(lo) + 0.15, `${gen}: .95 → ${mean(hi).toFixed(2)}, .05 → ${mean(lo).toFixed(2)}`);
    assert.ok(mean(hi) > 0.6, `${gen}: high stability lost the idea (${mean(hi).toFixed(2)})`);
  }
});

test('MUTATION AMOUNT and PROBABILITY scale the size of each change (all generators)', () => {
  for (const gen of GENS) {
    const small = [], big = [], fewP = [], manyP = [];
    for (let s = 1; s <= 8; s++) {
      small.push(mean(lineage({ gen, amount: 0.1, stability: 0 }, s, 6).toParent));
      big.push(mean(lineage({ gen, amount: 1, stability: 0 }, s, 6).toParent));
      fewP.push(mean(lineage({ gen, prob: 0.05, stability: 0 }, s, 6).toParent));
      manyP.push(mean(lineage({ gen, prob: 1, stability: 0 }, s, 6).toParent));
    }
    assert.ok(mean(small) > mean(big) + 0.05, `${gen}: amount .1 → ${mean(small).toFixed(2)}, 1 → ${mean(big).toFixed(2)}`);
    assert.ok(mean(fewP) > mean(manyP) + 0.03, `${gen}: prob .05 → ${mean(fewP).toFixed(2)}, 1 → ${mean(manyP).toFixed(2)}`);
  }
});

test('every MUTATE changes the material audibly and keeps the previous DNA', () => {
  for (const gen of GENS) {
    const o = organism({ gen }, 11);
    for (let i = 0; i < 8; i++) {
      const before = JSON.stringify(o.render()), dna = JSON.stringify(o.dna);
      assert.strictEqual(o.mutate(), true, gen);
      assert.notStrictEqual(JSON.stringify(o.render()), before);
      assert.strictEqual(JSON.stringify(o.prev[o.prev.length - 1]), dna);
    }
  }
});

test('mutating one voice leaves the others untouched', () => {
  const o = organism({ gen: 'melodic' }, 12);
  const before = o.dna.voices.map(v => JSON.stringify(v));
  assert.ok(o.mutate(1));
  o.dna.voices.forEach((v, i) => { if (i !== 1) assert.strictEqual(JSON.stringify(v), before[i]); });
  assert.notStrictEqual(JSON.stringify(o.dna.voices[1]), before[1]);
});

test('FREEZE blocks mutation, REVERT restores, RESET DNA starts a new idea', () => {
  const o = organism({ gen: 'melodic' }, 21);
  const g0 = JSON.stringify(o.render());
  o.params.frozen = true;
  assert.strictEqual(o.mutate(), false);
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

test('key change re-voices the same DNA; system change grows a new organism', () => {
  const o = organism({ gen: 'melodic', key: 0 }, 8);
  const a = o.render(), dna = o.dna;
  o.params.key = 5; o.invalidate();
  assert.deepStrictEqual(a.map(v => v.map(e => e.t)), o.render().map(v => v.map(e => e.t)));
  o.params.sysCat = 6; o.params.sysVar = 2; o.invalidate();
  o.render();
  assert.notStrictEqual(o.dna, dna);
  assert.strictEqual(o.dna.sys, GO.Systems.resolve(6, 2).id);
  assert.ok(o.revert());
});

test('variation slots and crossfader morph', () => {
  const o = organism({ gen: 'melodic' }, 30);
  o.storeSlot(0);
  const A = JSON.stringify(o.dna.voices);
  o.mutate(); o.mutate(); o.mutate();
  o.storeSlot(1);
  const B = o.dna.voices.map(v => JSON.stringify(v));
  o.morph(0);
  assert.strictEqual(JSON.stringify(o.dna.voices), A);
  o.morph(0.5);
  assert.strictEqual(JSON.stringify(o.dna.voices[0]), B[0]);
  assert.strictEqual(JSON.stringify(o.dna.voices[1]), B[1]);
  assert.notStrictEqual(JSON.stringify(o.dna.voices[3]), B[3]);
  o.morph(1);
  assert.deepStrictEqual(o.dna.voices.map(v => JSON.stringify(v)), B);
  assert.ok(o.recallSlot(0));
  assert.strictEqual(JSON.stringify(o.dna.voices), A);
});

test('state survives serialize/restore exactly (with slots, captures, user progressions)', () => {
  for (const gen of GENS) {
    const o = organism({ gen }, 33);
    for (let i = 0; i < 4; i++) o.mutate();
    o.storeSlot(2); o.capture(); o.setUserProg(1, 'i iv V7 i', 'aeolian');
    const s = encodeURIComponent(o.serialize());
    const p = GO.Organism.defaultParams(); p.gen = gen;
    const o2 = new GO.Organism.Organism(p, 1);
    assert.ok(o2.restore(decodeURIComponent(s)));
    assert.deepStrictEqual(o2.render(), o.render());
    assert.deepStrictEqual(o2.captures, o.captures);
    assert.ok(o2.hasSlot(2) && o2.userProgs[0].chords === 'i iv V7 i');
    assert.ok(o2.revert() && o.revert());
    assert.deepStrictEqual(o2.render(), o.render());
  }
});
