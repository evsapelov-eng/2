'use strict';
// Static checks of the generated FLOW device patch and .amxd. Internal consistency only;
// that Live opens it is verified on the user's Mac (UNVERIFIED until then).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { LiveSim } = require('./sim/live-sim');

const ROOT = path.join(__dirname, '..');
const MAXPAT = path.join(ROOT, 'device', 'flow', 'FLOW.maxpat');
const BUNDLE = path.join(ROOT, 'device', 'flow', 'flow.js');
const AMXD = path.join(ROOT, 'dist', 'FLOW.amxd');

const patch = JSON.parse(fs.readFileSync(MAXPAT, 'utf8')).patcher;
const byId = Object.fromEntries(patch.boxes.map(b => [b.box.id, b.box]));
const from = (id) => patch.lines.filter(l => l.patchline.source[0] === id).map(l => l.patchline);
const find = (pred) => patch.boxes.map(b => b.box).filter(pred);
const jsBox = find(b => /^js /.test(b.text || ''))[0];

test('patchlines reference existing boxes and valid inlets/outlets; ids unique', () => {
  assert.equal(new Set(patch.boxes.map(b => b.box.id)).size, patch.boxes.length);
  for (const { patchline: l } of patch.lines) {
    const s = byId[l.source[0]], d = byId[l.destination[0]];
    assert.ok(s && d, JSON.stringify(l));
    assert.ok(l.source[1] < s.numoutlets && l.destination[1] < d.numinlets, JSON.stringify(l));
  }
});

test('presentation fits the device (169 px high) and nothing overlaps', () => {
  const pres = find(b => b.presentation);
  const W = patch.openrect[2];
  for (const b of pres) {
    const [x, y, w, h] = b.presentation_rect;
    assert.ok(x >= 0 && y >= 0 && x + w <= W && y + h <= 169, (b.text || b.maxclass) + ' out of bounds');
  }
  for (let i = 0; i < pres.length; i++) {
    for (let j = i + 1; j < pres.length; j++) {
      const [x1, y1, w1, h1] = pres[i].presentation_rect, [x2, y2, w2, h2] = pres[j].presentation_rect;
      const overlap = x1 < x2 + w2 && x2 < x1 + w1 && y1 < y2 + h2 && y2 < y1 + h1;
      assert.ok(!overlap, `overlap: ${pres[i].text || pres[i].maxclass} / ${pres[j].text || pres[j].maxclass}`);
    }
  }
});

test('init chain live.thisdevice -> deferlow -> init -> js; MIDI passes through', () => {
  const td = find(b => b.text === 'live.thisdevice')[0];
  const d = byId[from(td.id)[0].destination[0]];
  assert.equal(d.text, 'deferlow');
  const i = byId[from(d.id)[0].destination[0]];
  assert.equal(i.text, 'init');
  assert.equal(from(i.id)[0].destination[0], jsBox.id);
  const mi = find(b => b.text === 'midiin')[0];
  assert.equal(byId[from(mi.id)[0].destination[0]].text, 'midiout');
});

test('every message reaching js has a handler in the bundle', () => {
  const sim = new LiveSim();
  const ctx = sim.loadScript(BUNDLE);
  const selectors = new Set();
  for (const { patchline: l } of patch.lines) {
    if (l.destination[0] !== jsBox.id) continue;
    const src = byId[l.source[0]];
    selectors.add(/^(?:prepend )?(\S+)/.exec(src.text)[1]);
  }
  for (const s of selectors) assert.equal(typeof ctx[s], 'function', 'no handler for ' + s);
  for (const s of ['hold', 'release', 'prev', 'next', 'stop', 'cancel', 'self_test', 'restoredoc', 'import_locators', 'exportjson', 'importjson', 'savereport']) {
    assert.ok(selectors.has(s), 'patch does not send ' + s);
  }
});

test('ui() keys used by main.js are all routed', () => {
  const route = find(b => /^route state /.test(b.text || ''))[0].text.split(' ').slice(1);
  const src = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  for (const m of src.matchAll(/ui\("(\w+)"/g)) assert.ok(route.includes(m[1]), 'route lacks ' + m[1]);
});

test('performance buttons are momentary live.text parameters (MIDI-mappable), names unique', () => {
  const lt = find(b => b.maxclass === 'live.text');
  assert.deepEqual(lt.map(b => b.text).sort(), ['CANCEL', 'HOLD', 'NEXT', 'PREV', 'RELEASE', 'STOP']);
  const names = new Set();
  for (const b of lt) {
    const v = b.saved_attribute_attributes.valueof;
    assert.equal(v.parameter_button_mode, 'Momentary');
    assert.equal(b.parameter_enable, 1);
    assert.ok(!names.has(v.parameter_longname)); names.add(v.parameter_longname);
    assert.ok(patch.parameters[b.id], 'listed in patcher.parameters');
  }
});

test('the document is stored in a hidden blob pattr parameter, wired both ways', () => {
  const p = find(b => /^pattr /.test(b.text || ''))[0];
  assert.equal(p.saved_object_attributes.parameter_enable, 1);
  assert.equal(p.saved_attribute_attributes.valueof.parameter_type, 3);
  assert.equal(p.saved_attribute_attributes.valueof.parameter_invisible, 1);
  assert.ok(patch.lines.some(l => l.patchline.source[0] === jsBox.id && l.patchline.source[1] === 1 && l.patchline.destination[0] === p.id));
  assert.equal(byId[from(p.id)[0].destination[0]].text, 'prepend restoredoc');
});

test('option menus are hidden parameters fed back from the document', () => {
  const menus = find(b => b.maxclass === 'live.menu');
  assert.equal(menus.length, 6);
  const route = find(b => /^route state /.test(b.text || ''))[0];
  for (const m of menus) {
    assert.equal(m.saved_attribute_attributes.valueof.parameter_invisible, 2);
    assert.ok(patch.lines.some(l => l.patchline.source[0] === route.id && l.patchline.destination[0] === m.id), 'menu gets set N');
  }
});

test('.amxd = MIDI Effect wrapper of the same patch; dist/flow.js equals the bundle', () => {
  const b = fs.readFileSync(AMXD);
  assert.equal(b.toString('ascii', 0, 4), 'ampf');
  assert.equal(b.toString('ascii', 8, 12), 'mmmm');
  assert.equal(b.toString('ascii', 24, 28), 'ptch');
  const len = b.readUInt32LE(28);
  assert.equal(32 + len, b.length);
  assert.equal(b[b.length - 1], 0);
  assert.deepEqual(JSON.parse(b.toString('utf8', 32, b.length - 1)), JSON.parse(fs.readFileSync(MAXPAT, 'utf8')));
  assert.equal(fs.readFileSync(path.join(ROOT, 'dist', 'flow.js'), 'utf8'), fs.readFileSync(BUNDLE, 'utf8'));
  assert.equal(patch.project.amxdtype, 1835887981);
});

test('bundle is ES5-safe for Max classic js (no let/const/arrow/template/class)', () => {
  const src = fs.readFileSync(BUNDLE, 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  assert.doesNotMatch(src, /\blet\s|\bconst\s|=>|`|\bclass\s/);
});
