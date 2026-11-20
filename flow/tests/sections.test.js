'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FS = require('../src/sections.js');

const SPEC_EXAMPLE = {
  schemaVersion: 1, projectId: 'flow-project-001', title: 'LIVE SESSION',
  sections: [
    { id: 's-intro', name: 'INTRO', startBeat: 0, lengthBeats: 64, digitone: { enabled: true, pattern: 'A01', programNumber: 0 }, holdEligible: true, defaultHoldBeats: 16, notes: 'atmosphere' },
    { id: 's-groove', name: 'GROOVE', startBeat: 64, lengthBeats: 128, digitone: { enabled: true, pattern: 'A02', programNumber: 1 }, holdEligible: true, defaultHoldBeats: 32, notes: 'main rhythm' },
  ],
  performanceOrder: ['s-intro', 's-groove'],
  preferences: { quantizationBeats: 4, digitoneControlEnabled: false, stopMode: 'confirm', externalLoopConflictPolicy: 'warn-and-disarm' },
};

test('spec §4 example document is accepted', () => {
  const r = FS.normalizeDoc(SPEC_EXAMPLE);
  assert.deepEqual(r.errors, []);
  assert.equal(r.doc.sections.length, 2);
  assert.equal(r.doc.preferences.stopMode, 'confirm');
  assert.equal(r.doc.preferences.navMode, 'setlist');
});

test('Digitone pattern <-> Program Change: A01=0, A02=1, H16=127 (spec §4, H03)', () => {
  assert.equal(FS.patternToProgram('A01'), 0);
  assert.equal(FS.patternToProgram('a02'), 1);
  assert.equal(FS.patternToProgram('B01'), 16);
  assert.equal(FS.patternToProgram('H16'), 127);
  assert.equal(FS.patternToProgram('H17'), null);
  assert.equal(FS.patternToProgram('I01'), null);
  assert.equal(FS.patternToProgram('A00'), null);
  for (let pc = 0; pc < 128; pc++) assert.equal(FS.patternToProgram(FS.programToPattern(pc)), pc);
  assert.equal(FS.programToPattern(128), null);
});

test('validation: empty names, bad numbers, overlaps, missing references, duplicate ids', () => {
  const bad = {
    sections: [
      { id: 'a', name: '', startBeat: 0, lengthBeats: 16 },
      { id: 'b', name: 'B', startBeat: -1, lengthBeats: 16 },
      { id: 'c', name: 'C', startBeat: 8, lengthBeats: 0 },
      { id: 'd', name: 'D', startBeat: 10, lengthBeats: 16 },
      { id: 'd', name: 'D2', startBeat: 100, lengthBeats: 16 },
    ],
    performanceOrder: ['a', 'zzz'],
  };
  const r = FS.normalizeDoc(bad);
  assert.equal(r.doc, null);
  const all = r.errors.join('\n');
  assert.match(all, /empty name/);
  assert.match(all, /startBeat must be a number >= 0/);
  assert.match(all, /lengthBeats must be a number > 0/);
  assert.match(all, /overlap/);
  assert.match(all, /missing section 'zzz'/);
  assert.match(all, /duplicate section id 'd'/);
});

test('programNumber inconsistent with pattern is corrected with a warning', () => {
  const r = FS.normalizeDoc({ sections: [{ id: 'x', name: 'X', startBeat: 0, lengthBeats: 4, digitone: { enabled: true, pattern: 'A03', programNumber: 7 } }] });
  assert.equal(r.doc.sections[0].digitone.programNumber, 2);
  assert.match(r.warnings.join(), /corrected to 2/);
});

test('T13: broken JSON returns errors and no document', () => {
  for (const text of ['{ "sections": [', 'null', '[]', '{"schemaVersion": 99, "sections": []}']) {
    const r = FS.importJson(text);
    assert.equal(r.doc, null, text);
    assert.ok(r.errors.length, text);
  }
});

test('missing performanceOrder defaults to source order', () => {
  const r = FS.normalizeDoc({ sections: [{ id: 'b', name: 'B', startBeat: 16, lengthBeats: 4 }, { id: 'a', name: 'A', startBeat: 0, lengthBeats: 4 }] });
  assert.deepEqual(r.doc.performanceOrder, ['a', 'b']);
});

test('setlist may reference the same section twice (spec §3)', () => {
  const r = FS.normalizeDoc({ sections: [{ id: 'g', name: 'G', startBeat: 0, lengthBeats: 4 }, { id: 'b', name: 'B', startBeat: 4, lengthBeats: 4 }], performanceOrder: ['g', 'b', 'g'] });
  assert.deepEqual(r.doc.performanceOrder, ['g', 'b', 'g']);
});

test('storage encoding round-trips and has no spaces or quotes (one Max symbol)', () => {
  const doc = FS.normalizeDoc(SPEC_EXAMPLE).doc;
  doc.sections[0].name = 'INTRO "slow" part; one, two';
  const enc = FS.encodeForStorage(doc);
  assert.doesNotMatch(enc, /[\s"';,]/);
  assert.deepEqual(FS.decodeFromStorage(enc).doc, FS.normalizeDoc(doc).doc);
  assert.equal(FS.decodeFromStorage('garbage').doc, null);
  assert.equal(FS.decodeFromStorage('FLOW1:%E0%A4%A').doc, null);
});

test('locator import: ranges between locators, END locator closes the last one, nothing guessed', () => {
  const cues = [{ name: 'GROOVE', time: 32 }, { name: 'INTRO', time: 0 }, { name: 'BREAK', time: 96 }];
  let r = FS.locatorPreview(cues);
  assert.deepEqual(r.sections.map(s => [s.name, s.startBeat, s.lengthBeats]), [['INTRO', 0, 32], ['GROOVE', 32, 64]]);
  assert.match(r.problems.join(), /'BREAK' has no end: add a locator named END/);
  r = FS.locatorPreview(cues.concat([{ name: 'end', time: 128 }]));
  assert.deepEqual(r.sections.map(s => [s.name, s.startBeat, s.lengthBeats]), [['INTRO', 0, 32], ['GROOVE', 32, 64], ['BREAK', 96, 32]]);
  assert.deepEqual(r.problems, []);
  assert.match(FS.locatorPreview([]).problems.join(), /no locators/);
});

test('Store: commit validates, refuses invalid edits, undo/redo', () => {
  const st = new FS.Store();
  assert.ok(st.commit(d => { d.sections.push({ id: 'a', name: 'A', startBeat: 0, lengthBeats: 16 }); d.performanceOrder.push('a'); }).ok);
  const bad = st.commit(d => { d.sections.push({ id: 'b', name: 'B', startBeat: 8, lengthBeats: 16 }); });
  assert.equal(bad.ok, false);
  assert.equal(st.doc.sections.length, 1, 'refused edit leaves the document untouched');
  assert.ok(st.commit(d => { d.sections[0].name = 'INTRO'; }).ok);
  assert.ok(st.undo());
  assert.equal(st.doc.sections[0].name, 'A');
  assert.ok(st.redo());
  assert.equal(st.doc.sections[0].name, 'INTRO');
});
