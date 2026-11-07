// Prints the numbers behind the STABILITY / AMOUNT / PROBABILITY behaviour.
'use strict';
const { GO, organism } = require('../test/helpers.js');
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function lineage(over, seed, steps) {
  const o = organism(over, seed), origin = o.render(), r = { o: [], p: [] };
  for (let i = 0; i < steps; i++) {
    const b = o.render(); o.mutate(); const a = o.render();
    r.p.push(GO.Similarity.organism(a, b)); r.o.push(GO.Similarity.organism(a, origin));
  }
  return r;
}
function row(label, over, key) {
  const out = [];
  for (const gen of ['melodic', 'rhythmic', 'hybrid', 'experimental']) {
    const v = [];
    for (let s = 1; s <= 10; s++) v.push(mean(lineage(Object.assign({ gen }, over), s, 10)[key]));
    out.push(mean(v).toFixed(2));
  }
  console.log(label.padEnd(34), out.join('      '));
}
console.log('similarity (1 = identical)          melodic   rhythmic  hybrid   experimental');
for (const s of [0, 0.25, 0.5, 0.75, 1]) row('to ORIGIN, stability ' + s, { stability: s }, 'o');
for (const a of [0.1, 0.5, 1]) row('to PARENT, amount ' + a + ' (stab 0)', { amount: a, stability: 0 }, 'p');
for (const p of [0.05, 0.5, 1]) row('to PARENT, probability ' + p + ' (stab 0)', { prob: p, stability: 0 }, 'p');
