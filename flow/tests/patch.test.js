'use strict';
// Static checks of the generated Max patch and .amxd wrapper. They prove internal
// consistency only; whether Live/Max accept the files is verified on a Mac (UNVERIFIED).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { LiveSim } = require('./sim/live-sim');

const ROOT = path.join(__dirname, '..');
const MAXPAT = path.join(ROOT, 'device', 'm0-spike', 'flow-spike.maxpat');
const AMXD = path.join(ROOT, 'dist', 'FLOW-M0-Spike.amxd');
const JS = path.join(ROOT, 'device', 'm0-spike', 'flow_spike.js');

const patch = JSON.parse(fs.readFileSync(MAXPAT, 'utf8')).patcher;
const byId = Object.fromEntries(patch.boxes.map(b => [b.box.id, b.box]));

test('every patchline references existing boxes and valid outlet/inlet indices', () => {
  for (const { patchline: l } of patch.lines) {
    const s = byId[l.source[0]], d = byId[l.destination[0]];
    assert.ok(s && d, JSON.stringify(l));
    assert.ok(l.source[1] < s.numoutlets, 'outlet out of range ' + JSON.stringify(l));
    assert.ok(l.destination[1] < d.numinlets, 'inlet out of range ' + JSON.stringify(l));
  }
});

test('box ids are unique and presentation rects fit the device height (169 px)', () => {
  assert.equal(new Set(patch.boxes.map(b => b.box.id)).size, patch.boxes.length);
  for (const { box } of patch.boxes) {
    if (!box.presentation) continue;
    const [x, y, w, h] = box.presentation_rect;
    assert.ok(y + h <= 169, box.text + ' exceeds device height');
    assert.ok(x + w <= patch.devicewidth, box.text + ' exceeds device width');
  }
});

test('LiveAPI init is driven by live.thisdevice through deferlow', () => {
  const td = patch.boxes.find(b => b.box.text === 'live.thisdevice').box.id;
  const l1 = patch.lines.find(l => l.patchline.source[0] === td).patchline;
  assert.equal(byId[l1.destination[0]].text, 'deferlow');
  const l2 = patch.lines.find(l => l.patchline.source[0] === l1.destination[0]).patchline;
  assert.equal(byId[l2.destination[0]].text, 'init');
});

test('MIDI passes through the effect (midiin -> midiout)', () => {
  const mi = patch.boxes.find(b => b.box.text === 'midiin').box.id;
  const l = patch.lines.find(x => x.patchline.source[0] === mi).patchline;
  assert.equal(byId[l.destination[0]].text, 'midiout');
});

test('every message reaching js has a handler function in flow_spike.js', () => {
  const jsBox = patch.boxes.find(b => /^js /.test(b.box.text || '')).box;
  assert.equal(jsBox.text, 'js flow_spike.js');
  const sim = new LiveSim();
  const ctx = sim.loadScript(JS);
  const selectors = new Set();
  for (const { patchline: l } of patch.lines) {
    if (l.destination[0] !== jsBox.id) continue;
    const src = byId[l.source[0]];
    const m = /^(?:prepend )?(\S+)/.exec(src.text || '');
    selectors.add(m[1]);
  }
  for (const s of selectors) assert.equal(typeof ctx[s], 'function', 'no handler for "' + s + '"');
  assert.ok(selectors.size >= 25);
});

test('js outlet keys match the route object', () => {
  const route = patch.boxes.find(b => /^route /.test(b.box.text || '')).box.text.split(' ').slice(1);
  const src = fs.readFileSync(JS, 'utf8');
  const used = new Set([...src.matchAll(/ui\("(\w+)"/g)].map(m => m[1]));
  for (const k of used) assert.ok(route.includes(k), 'route lacks key ' + k);
});

test('ui() emits plain atoms without Max message separators', () => {
  const sim = new LiveSim({ playing: true });
  const ctx = sim.loadScript(JS);
  sim.deviceReady();
  ctx.ui('exp', 'a; b, c  d');
  assert.equal(JSON.stringify(sim.outlets.at(-1)), JSON.stringify([0, ['exp', 'a', '/', 'b', '/', 'c', 'd']]));
});

test('.amxd wrapper: ampf/mmmm/meta/ptch chunks around the same patch JSON', () => {
  const b = fs.readFileSync(AMXD);
  assert.equal(b.toString('ascii', 0, 4), 'ampf');
  assert.equal(b.readUInt32LE(4), 4);
  assert.equal(b.toString('ascii', 8, 12), 'mmmm');
  assert.equal(b.toString('ascii', 12, 16), 'meta');
  assert.equal(b.toString('ascii', 24, 28), 'ptch');
  const len = b.readUInt32LE(28);
  assert.equal(32 + len, b.length);
  const json = b.toString('utf8', 32, 32 + len).replace(/\u0000$/, '');
  assert.deepEqual(JSON.parse(json), JSON.parse(fs.readFileSync(MAXPAT, 'utf8')));
  assert.equal(fs.readFileSync(path.join(ROOT, 'dist', 'flow_spike.js'), 'utf8'), fs.readFileSync(JS, 'utf8'));
});
