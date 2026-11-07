'use strict';
const path = require('path');
const GO = require(path.join(__dirname, '..', 'dist', 'organism_core.js'));

function organism(over, seed) {
  const p = GO.Organism.defaultParams();
  Object.assign(p, over || {});
  const o = new GO.Organism.Organism(p, seed || 1);
  o.reset(seed || 1);
  return o;
}

// Runs the player like Live's transport would and checks MIDI hygiene.
function MidiChecker() {
  this.held = new Map();
  this.ons = 0; this.offs = 0; this.errors = [];
}
MidiChecker.prototype.feed = function (msgs, where) {
  for (const m of msgs) {
    const type = m[0] & 0xf0, key = (m[0] & 15) * 128 + m[1];
    if (type === 0x90 && m[2] > 0) {
      if (this.held.has(key)) this.errors.push('note-on while held ' + key + ' at ' + where);
      this.held.set(key, where); this.ons++;
    } else if (type === 0x80) {
      if (!this.held.has(key)) this.errors.push('note-off without note-on ' + key + ' at ' + where);
      this.held.delete(key); this.offs++;
    }
  }
};

module.exports = { GO, organism, MidiChecker };
