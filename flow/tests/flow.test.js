'use strict';
// FLOW device (bundled device/flow/flow.js) against the Live simulator.
// These tests prove FLOW's logic and safety rules. They do NOT prove Live's behaviour:
// that is what SELF-TEST measures on the user's computer.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { LiveSim } = require('./sim/live-sim');
const FS = require('../src/sections.js');

const BUNDLE = path.join(__dirname, '..', 'device', 'flow', 'flow.js');

// 4/4: 1 bar = 4 beats. INTRO 4 bars, GROOVE 8 bars, BREAK 4 bars, DROP 8 bars.
const DOC = {
  sections: [
    { id: 'in', name: 'INTRO', startBeat: 0, lengthBeats: 16 },
    { id: 'gr', name: 'GROOVE', startBeat: 16, lengthBeats: 32, digitone: { enabled: true, pattern: 'A02' } },
    { id: 'br', name: 'BREAK', startBeat: 48, lengthBeats: 16 },
    { id: 'dr', name: 'DROP', startBeat: 64, lengthBeats: 32 },
  ],
  performanceOrder: ['in', 'gr', 'br', 'gr', 'dr'],
};

function boot(opts = {}, doc = DOC, prefs = {}) {
  const sim = new LiveSim(Object.assign({ cues: [{ name: 'INTRO', time: 0 }, { name: 'DROP', time: 64 }] }, opts));
  const js = sim.loadScript(BUNDLE);
  if (doc) {
    const d = JSON.parse(JSON.stringify(doc));
    d.preferences = Object.assign({}, d.preferences || {}, prefs);
    const n = FS.normalizeDoc(d);
    assert.deepEqual(n.errors, []);
    js.restoredoc(FS.encodeForStorage(n.doc));
  }
  sim.deviceReady();
  sim.run(50);
  return { sim, js, st: () => js.engine.state(), ev: (type) => js.engine.history.filter(e => e.type === type) };
}

function until(sim, pred, ms, what) {
  const ok = sim.runUntil(pred, ms);
  assert.ok(ok, 'timed out waiting for ' + (what || pred.toString()) + '\n' + sim.posts.slice(-12).join(''));
}

function press(sim, js, name) { js[name](); sim.run(20); }

test('load: transport and loop untouched; stored sections restored; menus mirror the document', () => {
  const { sim, js, st } = boot({ playing: false, pos: 7 }, DOC, { navMode: 'source', jumpMode: 'experimental' });
  sim.run(2000);
  assert.equal(sim.playing, 0);
  assert.equal(sim.pos, 7);
  assert.equal(sim.loop, 0);
  assert.deepEqual(sim.setLog, []);
  assert.equal(sim.calls.filter(c => c.fn !== 'get_current_beats_song_time').length, 0);
  assert.equal(st(), 'IDLE');
  assert.equal(js.store.doc.sections.length, 4);
  const pushed = sim.outlets.filter(o => /^ui_/.test(o[1] && o[1][0])).map(o => o[1].join(' '));
  assert.ok(pushed.includes('ui_nav set 1'));
  assert.ok(pushed.includes('ui_jump set 1'));
});

test('menu values arriving at load time do not overwrite the stored document', () => {
  const { sim, js } = boot({ playing: false }, DOC, { navMode: 'source' });
  js.navmode(0); // e.g. a parameter emitting its default right after load
  assert.equal(js.store.doc.preferences.navMode, 'source');
  sim.run(1500);
  js.navmode(0); // a real click later
  assert.equal(js.store.doc.preferences.navMode, 'setlist');
});

test('the document is written to the pattr blob on every edit', () => {
  const { sim, js } = boot({ playing: false });
  sim.run(1500);
  js.jumpmode(1);
  const sets = sim.outlets.filter(o => o[0] === 1 && o[1] === 'set');
  assert.ok(sets.length);
  const back = FS.decodeFromStorage(sets.at(-1)[2]).doc;
  assert.equal(back.preferences.jumpMode, 'experimental');
});

test('T04: current section, bar within section and next setlist entry are shown', () => {
  const { sim, js } = boot({ playing: true, pos: 21 });
  sim.run(300);
  const s = js.engine.status(sim.t);
  assert.equal(s.current.name, 'GROOVE');
  assert.equal(s.current.bar, 2);
  assert.equal(s.current.bars, 8);
  assert.equal(s.current.pattern, 'A02');
  assert.equal(s.next.name, 'BREAK');
  assert.ok(sim.outlets.some(o => o[1] && o[1][0] === 'current' && o[1][1] === 'GROOVE'));
});

for (const tempo of [80, 120, 160]) {
  test(`T05: HOLD at ${tempo} BPM becomes ACTIVE only after Live confirms, and Live repeats the section`, () => {
    const { sim, js, st, ev } = boot({ playing: true, pos: 50, tempo, setLatency: 25 });
    press(sim, js, 'hold');
    assert.equal(st(), 'HOLD_ARMED');
    until(sim, () => st() === 'HOLD_ACTIVE', 500, 'HOLD_ACTIVE');
    assert.equal(sim.loopStart, 48);
    assert.equal(sim.loopLength, 16);
    const before = sim.wraps;
    sim.run(Math.ceil(16 / (tempo / 60000)) * 2 + 200);
    assert.ok(sim.wraps - before >= 2, 'section repeated');
    assert.ok(sim.playing);
    assert.equal(st(), 'HOLD_ACTIVE');
    assert.ok(ev('wrap').length >= 2);
  });
}

test('HOLD in "LAST 2 BARS" mode loops the end of the section', () => {
  const { sim, js, st } = boot({ playing: true, pos: 18 }, DOC, { holdMode: 'last2' });
  press(sim, js, 'hold');
  until(sim, () => st() === 'HOLD_ACTIVE', 500);
  assert.equal(sim.loopStart, 40);
  assert.equal(sim.loopLength, 8);
});

test('HOLD too close to the section end is refused, nothing is written', () => {
  const { sim, js, st } = boot({ playing: true, pos: 63.8 });
  press(sim, js, 'hold');
  assert.equal(st(), 'PLAYING');
  assert.match(js.engine.status(sim.t).message, /TOO LATE TO HOLD BREAK/);
  assert.equal(sim.setLog.length, 0);
});

test('T06: RELEASE x10 exits after the current cycle with no extra cycle and no stop', () => {
  for (let i = 0; i < 10; i++) {
    const { sim, js, st, ev } = boot({ playing: true, pos: 48.3 + i * 1.5, seed: 11 + i }, DOC, { autoFollowSetlist: false });
    press(sim, js, 'hold');
    until(sim, () => st() === 'HOLD_ACTIVE', 500);
    sim.run(500 + i * 300);
    press(sim, js, 'release');
    until(sim, () => st() === 'PLAYING', 20000, 'released');
    const r = ev('released').at(-1);
    assert.equal(r.extraCycles, 0);
    assert.ok(sim.pos >= 64 && sim.pos < 66, 'continued into DROP at ' + sim.pos);
    assert.equal(sim.loop, 0);
    assert.equal(sim.playing, 1);
  }
});

test('RELEASE in the last moments before the loop end waits one cycle ("EXIT NEXT CYCLE")', () => {
  const { sim, js, st, ev } = boot({ playing: true, pos: 48.5, setLatency: 5 });
  press(sim, js, 'hold');
  until(sim, () => st() === 'HOLD_ACTIVE', 500);
  until(sim, () => sim.pos > 63.85 && sim.pos < 63.95, 20000);
  press(sim, js, 'release');
  assert.equal(js.engine.status(sim.t).pendingLabel, 'EXIT NEXT CYCLE');
  until(sim, () => st() === 'PLAYING', 20000);
  assert.equal(ev('released').at(-1).extraCycles, 0);
  assert.ok(sim.pos >= 64);
});

test('T07: setlist NEXT backwards (BREAK -> GROOVE) uses the loop wrap and lands exactly on GROOVE at the bar line', () => {
  const { sim, js, st, ev } = boot({ playing: true, pos: 48.5 });
  sim.run(200);
  press(sim, js, 'next');
  const armed = ev('jump_armed').at(-1);
  assert.equal(armed.mech, 'wrap');
  assert.equal(armed.target, 'GROOVE');
  assert.equal(armed.B, 52);   // next bar line (quantization 1 bar)
  until(sim, () => st() === 'PLAYING' && ev('landed').length, 10000, 'landing');
  sim.run(50);
  const l = ev('landed').at(-1);
  assert.ok(Math.abs(l.preJump - 52) < 0.2, 'jumped at the boundary: ' + l.preJump);
  assert.ok(Math.abs(l.offsetBeats) < 0.2);
  assert.equal(sim.loop, 0, 'loop switched off after the wrap');
  assert.equal(js.engine.status(sim.t).setIndex, 3, 'setlist position = 2nd GROOVE');
  sim.run(200);
  assert.equal(js.engine.status(sim.t).next.name, 'DROP');
});

test('NEXT forward to a section with a locator uses CuePoint.jump in the last bar and lands at the boundary', () => {
  const { sim, js, ev } = boot({ playing: true, pos: 21 }, DOC, { navMode: 'source', quantizationBeats: 4 });
  // GROOVE -> next by coordinate is BREAK (48); give BREAK a locator.
  sim.cues = [{ name: 'BREAK', time: 48 }];
  sim.run(2100);
  const p0 = sim.pos;
  press(sim, js, 'next');
  const armed = ev('jump_armed').at(-1);
  assert.equal(armed.mech, 'cue');
  until(sim, () => ev('landed').length, 10000);
  const l = ev('landed').at(-1);
  assert.equal(l.T, 48);
  assert.ok(Math.abs(l.preJump - armed.B) < 0.25, 'jump at boundary ' + armed.B + ' (pre ' + l.preJump + ', from ' + p0 + ')');
  assert.equal(sim.calls.filter(c => c.fn === 'jump').length, 1, 'exactly one jump');
});

test('SAFE mode refuses a forward jump without a locator; EXPERIMENTAL does a timed seek', () => {
  {
    const { sim, js, st } = boot({ playing: true, pos: 21, cues: [] }, DOC, { navMode: 'source' });
    press(sim, js, 'next');
    assert.equal(st(), 'PLAYING');
    assert.match(js.engine.status(sim.t).message, /NO LOCATOR AT 013\.1/);
    assert.equal(sim.setLog.length, 0);
  }
  {
    const { sim, js, ev } = boot({ playing: true, pos: 21, cues: [], setLatency: 5 }, DOC, { navMode: 'source', jumpMode: 'experimental' });
    press(sim, js, 'next');
    assert.equal(ev('jump_armed').at(-1).mech, 'seek');
    until(sim, () => ev('landed').length, 10000);
    const l = ev('landed').at(-1);
    assert.ok(Math.abs(l.preJump - 24) < 0.3, 'seek near the boundary: ' + l.preJump);
  }
});

test('T08: NEXT from HOLD finishes the current cycle, then goes to the target (no double jump, no endless loop)', () => {
  // HOLD BREAK (setlist index 2), NEXT -> GROOVE (index 3): backwards, done by moving the loop start.
  const { sim, js, st, ev } = boot({ playing: true, pos: 48.5 });
  sim.run(100);
  press(sim, js, 'hold');
  until(sim, () => st() === 'HOLD_ACTIVE', 500);
  sim.run(1000);
  press(sim, js, 'next');
  const a = ev('jump_armed').at(-1);
  assert.equal(a.mech, 'wrap');
  assert.equal(a.fromHold, true);
  assert.equal(a.B, 64, 'boundary is the end of the held cycle');
  until(sim, () => ev('landed').length, 12000);
  sim.run(50);
  assert.equal(ev('landed').length, 1);
  assert.equal(st(), 'PLAYING');
  assert.equal(sim.loop, 0);
  sim.run(4000);
  assert.ok(sim.pos > 17 && sim.pos < 30, 'playing GROOVE linearly at ' + sim.pos);
});

test('T08: NEXT from HOLD when the target follows the held section is a plain RELEASE', () => {
  const { sim, js, st, ev } = boot({ playing: true, pos: 17 }, DOC, { navMode: 'source' });
  press(sim, js, 'hold');
  until(sim, () => st() === 'HOLD_ACTIVE', 500);
  press(sim, js, 'next');
  assert.equal(st(), 'RELEASE_ARMED');
  until(sim, () => st() === 'PLAYING', 20000);
  assert.ok(sim.pos >= 48 && sim.pos < 50);
  assert.equal(ev('landed').length, 0);
});

test('T09: PREV goes to the previous setlist entry regardless of position', () => {
  const { sim, js, ev } = boot({ playing: true, pos: 49 });
  sim.run(200);  // in BREAK = setlist index 2
  press(sim, js, 'prev');
  assert.equal(ev('jump_armed').at(-1).target, 'GROOVE');
  until(sim, () => ev('landed').length, 10000);
  assert.equal(ev('landed').at(-1).T, 16);
  assert.equal(js.engine.status(sim.t).setIndex, 1);
});

test('setlist auto-follow: at the end of BREAK FLOW goes back to GROOVE by itself; PAUSE turns it off', () => {
  {
    const { sim, ev } = boot({ playing: true, pos: 58 });
    until(sim, () => ev('landed').length, 20000, 'auto jump');
    const l = ev('landed').at(-1);
    assert.equal(l.auto, true);
    assert.equal(l.T, 16);
    assert.ok(Math.abs(l.preJump - 64) < 0.2);
  }
  {
    const { sim, ev } = boot({ playing: true, pos: 58 }, DOC, { autoFollowSetlist: false });
    sim.run(8000);
    assert.equal(ev('landed').length, 0);
    assert.ok(sim.pos > 64);
  }
});

test('STOP needs a second press within 2 s; a stopped transport is never "stopped" again', () => {
  const { sim, js } = boot({ playing: true, pos: 5 });
  press(sim, js, 'stop');
  sim.run(300);
  assert.equal(sim.playing, 1);
  assert.match(js.engine.status(sim.t).message, /PRESS STOP AGAIN/);
  press(sim, js, 'stop');
  sim.run(50);
  assert.equal(sim.playing, 0);
  sim.run(3000);
  press(sim, js, 'stop'); sim.run(200); press(sim, js, 'stop');
  assert.equal(sim.calls.filter(c => c.fn === 'stop_playing').length, 1, 'no stop_playing on a stopped transport (would reset position)');
  // single press after the window expired again does nothing
});

test('CANCEL disarms a pending jump and a hold', () => {
  const { sim, js, st } = boot({ playing: true, pos: 48.5 });
  sim.run(100);
  press(sim, js, 'next');
  assert.equal(st(), 'JUMPING');
  press(sim, js, 'cancel');
  assert.equal(st(), 'PLAYING');
  sim.run(100);
  assert.equal(sim.loop, 0);
  sim.run(3000);
  assert.ok(sim.pos > 52, 'no jump happened');
  press(sim, js, 'hold');
  press(sim, js, 'cancel');
  sim.run(100);
  assert.equal(sim.loop, 0);
  assert.equal(st(), 'PLAYING');
});

test('T11: loop brace moved by the user during HOLD -> MANUAL OVERRIDE, FLOW stops writing; CANCEL resumes', () => {
  const { sim, js, st } = boot({ playing: true, pos: 50 });
  press(sim, js, 'hold');
  until(sim, () => st() === 'HOLD_ACTIVE', 500);
  const writes = sim.setLog.length;
  sim.applySet('loop_start', 40); // user drags the brace
  sim.run(50);
  assert.equal(st(), 'MANUAL_OVERRIDE');
  press(sim, js, 'release');
  press(sim, js, 'next');
  assert.equal(sim.setLog.length, writes, 'no writes while overridden');
  press(sim, js, 'cancel');
  assert.equal(st(), 'PLAYING');
  assert.equal(sim.loop, 1, 'the user\'s loop is left alone');
});

test('Back to Arrangement lit: HOLD/NEXT are refused with a warning; BACK TO ARR button clears it', () => {
  const { sim, js, st } = boot({ playing: true, pos: 5 });
  sim.applySet('back_to_arranger', 1);
  press(sim, js, 'hold');
  assert.equal(st(), 'PLAYING');
  assert.ok(js.engine.status(sim.t).warnings.join().includes('BACK TO ARRANGEMENT'));
  press(sim, js, 'back_to_arr');
  sim.run(50);
  assert.equal(sim.b2a, 0);
});

test('a manual HOLD overrides an automatic setlist transition that has not happened yet', () => {
  const { sim, js, st, ev } = boot({ playing: true, pos: 60.5 });
  sim.run(200);
  assert.equal(ev('jump_armed').at(-1).auto, true);
  press(sim, js, 'hold');
  until(sim, () => st() === 'HOLD_ACTIVE', 500);
  sim.run(3000);
  assert.equal(ev('landed').length, 0);
  assert.ok(sim.pos >= 48 && sim.pos < 64, 'still holding BREAK at ' + sim.pos);
  assert.equal(sim.loopStart, 48);
});

test('debounce: a double-triggered button produces one command', () => {
  const { sim, js, ev } = boot({ playing: true, pos: 48.5 });
  js.next(); sim.run(30); js.next();
  sim.run(20);
  assert.equal(ev('jump_armed').length, 1);
});

test('transport stopped while HOLD is armed: operation cancelled, loop off, state IDLE', () => {
  const { sim, js, st } = boot({ playing: true, pos: 50, setLatency: 40 });
  press(sim, js, 'hold');
  sim.applySet('is_playing', 0);
  sim.run(100);
  assert.equal(st(), 'IDLE');
  assert.equal(sim.loop, 0);
});

test('Live never confirms a loop write -> ERROR, FLOW stops sending; CANCEL resets', () => {
  const { sim, js, st } = boot({ playing: true, pos: 18, dropWrites: ['loop'] });
  press(sim, js, 'hold');
  sim.run(2000);
  assert.equal(st(), 'ERROR');
  const n = sim.setLog.length;
  press(sim, js, 'next');
  assert.equal(sim.setLog.length, n);
  press(sim, js, 'cancel');
  assert.equal(st(), 'PLAYING');
});

test('T14: a second FLOW instance is read-only until TAKE OVER', () => {
  const sim = new LiveSim({ playing: true, pos: 5 });
  const a = sim.loadScript(BUNDLE); sim.deviceReady(a);
  const b = sim.loadScript(BUNDLE); sim.deviceReady(b);
  sim.run(100);
  b.next(); sim.run(20);
  assert.match(b.engine.status(sim.t).message, /READ-ONLY/);
  assert.equal(b.engine.status(sim.t).readOnly, true);
  assert.equal(a.engine.status(sim.t).readOnly, false);
  b.take_over(); sim.run(50);
  assert.equal(b.engine.status(sim.t).readOnly, false);
  assert.equal(a.engine.status(sim.t).readOnly, true, 'old master steps down');
});

test('T13: importing a broken JSON file keeps the current sections', () => {
  const { sim, js } = boot({ playing: false });
  sim.files['/tmp/bad.json'] = ['{ "sections": [ { "id": "x", "name": "", "startBeat": 0'];
  js.importjson('/tmp/bad.json');
  assert.equal(js.store.doc.sections.length, 4);
  assert.ok(sim.outlets.some(o => o[1] && o[1][0] === 'msg' && o[1].join(' ').includes('IMPORT REJECTED')));
  js.exportjson('/tmp/good.json');
  js.importjson('/tmp/good.json');
  assert.equal(js.store.doc.sections.length, 4);
});

test('T03: import locators shows a preview and changes nothing until CONFIRM; locators are not modified', () => {
  const { sim, js } = boot({ playing: false, cues: [{ name: 'A', time: 0 }, { name: 'B', time: 32 }, { name: 'END', time: 64 }] }, null);
  sim.run(10);
  js.import_locators();
  assert.equal(js.store.doc.sections.length, 0);
  js.confirm_import();
  assert.equal(JSON.stringify(js.store.doc.sections.map(s => [s.name, s.startBeat, s.lengthBeats])), JSON.stringify([['A', 0, 32], ['B', 32, 32]]));
  assert.equal(sim.calls.filter(c => c.fn === 'set_or_delete_cue').length, 0);
});

test('commands are refused while the transport is stopped (no hidden transport start)', () => {
  const { sim, js } = boot({ playing: false, pos: 5 });
  press(sim, js, 'hold');
  press(sim, js, 'next');
  assert.equal(sim.setLog.length, 0);
  assert.equal(sim.playing, 0);
});
