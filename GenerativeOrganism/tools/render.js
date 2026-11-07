#!/usr/bin/env node
// Offline listening test: runs the organism with AUTO evolution through the
// same MIDI engine the device uses and writes .mid files to demos/.
// Drag a file into Live (4 tracks = 4 voices) to hear how a lineage evolves.
'use strict';
const fs = require('fs');
const path = require('path');
const GO = require('../dist/organism_core.js');

const SCENARIOS = [
  { file: 'melodic_D_dorian_stable.mid', seed: 7, bars: 32, every: 2,
    p: { gen: 'melodic', key: 2, scale: 1, bars: 2, stability: 0.8, amount: 0.4 } },
  { file: 'melodic_D_dorian_wild.mid', seed: 7, bars: 32, every: 2,
    p: { gen: 'melodic', key: 2, scale: 1, bars: 2, stability: 0.1, amount: 0.9, variation: 0.8 } },
  { file: 'melodic_A_minor_4bars.mid', seed: 21, bars: 32, every: 4,
    p: { gen: 'melodic', key: 9, scale: 5, bars: 4, stability: 0.6, complexity: 0.4 } },
  { file: 'rhythmic_E_phrygian.mid', seed: 3, bars: 32, every: 2,
    p: { gen: 'rhythmic', key: 4, scale: 2, bars: 2, complexity: 0.8, stability: 0.6 } },
  { file: 'rhythmic_F_lydian_simple.mid', seed: 12, bars: 32, every: 4,
    p: { gen: 'rhythmic', key: 5, scale: 3, bars: 1, complexity: 0.2, variation: 0.3 } }
];

function run(sc) {
  const params = Object.assign(GO.Organism.defaultParams(), sc.p);
  const org = new GO.Organism.Organism(params, sc.seed);
  org.reset(sc.seed);
  const player = new GO.Player();
  player.load(org.pattern(), true);
  const tracks = [0, 1, 2, 3].map(i => ({ name: 'Voice ' + (i + 1) + ' ' + GO.Roles[i].name, events: [] }));
  const spb = params.spb, total = sc.bars * spb;
  for (let abs = 0; abs <= total; abs++) {
    const msgs = abs === total ? player.stop() : player.tick(abs);
    for (const m of msgs) tracks[m[0] & 15].events.push({ tick: abs * 120, msg: m });
    if ((abs + 2) % (sc.every * spb) === 0 && abs < total - 2) { org.mutate(); player.load(org.pattern(), false); }
  }
  const bytes = GO.SMF.write(tracks, 480, 110);
  fs.mkdirSync(path.join(__dirname, '..', 'demos'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'demos', sc.file), Buffer.from(bytes));
  console.log(sc.file.padEnd(32), 'generations:', String(org.generation).padStart(3),
    ' notes:', tracks.map(t => t.events.filter(e => (e.msg[0] & 0xf0) === 0x90).length).join('/'));
}

SCENARIOS.forEach(run);
