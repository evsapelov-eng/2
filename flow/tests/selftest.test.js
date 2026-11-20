'use strict';
// SELF-TEST must report what Live actually does. These tests run it against simulator
// variants of the unknowns and check that the report tells them apart.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { LiveSim } = require('./sim/live-sim');

const BUNDLE = path.join(__dirname, '..', 'device', 'flow', 'flow.js');

function runSelfTest(opts) {
  const sim = new LiveSim(Object.assign({ playing: false, pos: 0, obsInterval: 50, obsJitter: 15, cues: [{ name: 'X', time: 64 }] }, opts));
  const js = sim.loadScript(BUNDLE);
  sim.deviceReady();
  sim.run(100);
  js.self_test(); sim.run(10); js.self_test();
  const ok = sim.runUntil(() => sim.posts.some(p => /SELF-TEST DONE/.test(p)), 600000);
  assert.ok(ok, 'SELF-TEST did not finish\n' + sim.posts.slice(-10).join(''));
  const line = (id) => sim.posts.find(p => new RegExp('SELFTEST ' + id + ' (PASS|FAIL|INFO|NOT RUN|ABORTED) ').test(p)) || '';
  return { sim, js, line, calib: js.store.doc.calibration };
}

test('default behaviour: every step PASS/INFO, report saved next to the set, calibration stored, loop restored', () => {
  const { sim, line, calib } = runSelfTest({ setLatency: 20 });
  for (const id of ['S0', 'S1', 'S2', 'S3', 'S4', 'S8']) assert.match(line(id), /PASS/, id + ': ' + line(id));
  for (const id of ['S5', 'S6', 'S7']) assert.match(line(id), /INFO/, id + ': ' + line(id));
  const file = Object.keys(sim.files).find(f => /FLOW-SelfTest-.*\.txt$/.test(f));
  assert.ok(file && file.startsWith('/Users/test/Music/FLOW Test Project/'), 'report next to the .als');
  const report = sim.files[file].join('\n');
  assert.match(report, /FLOW SELF-TEST REPORT/);
  assert.match(report, /S8 +PASS/);
  assert.ok(calib.safeLeadMs >= 80);
  assert.equal(calib.cueJumpQuantized, true);
  assert.equal(sim.loop, 0);
  assert.equal(sim.loopStart, 0);
  assert.equal(sim.loopLength, 16);
  assert.equal(sim.playing, 1, 'transport left running');
});

test('slow command latency (120 ms): late RELEASE leads are caught and the safe lead grows', () => {
  const { line, calib } = runSelfTest({ setLatency: 120 });
  assert.match(line('S4'), /30ms 0\/2/);
  assert.ok(calib.safeLeadMs >= 300, 'safe lead ' + calib.safeLeadMs);
  assert.match(line('S8'), /PASS/, 'engine still works with the calibrated lead: ' + line('S8'));
});

test('Live jumping back when the loop is enabled late is reported', () => {
  const { line, calib } = runSelfTest({ setLatency: 20, lateLoopJumpsBack: true });
  assert.match(line('S5'), /-150ms:JUMPED_BACK/);
  assert.equal(calib.lateLoopJumpsBack, true);
});

test('quantized vs immediate current_song_time is reported', () => {
  assert.match(runSelfTest({ setLatency: 20, seekQuantized: true }).line('S6'), /QUANTIZED/);
  assert.match(runSelfTest({ setLatency: 20 }).line('S6'), /IMMEDIATE/);
});

test('a set without locators: locator jump test NOT RUN (not a fake PASS)', () => {
  const { line, calib } = runSelfTest({ setLatency: 20, cues: [] });
  assert.match(line('S7'), /NOT RUN/);
  assert.equal(calib.cueJumpQuantized, undefined);
});

test('unsaved set: report kept in memory, SAVE REPORT writes it', () => {
  const { sim, js } = runSelfTest({ setLatency: 20, filePath: '' });
  assert.ok(sim.posts.some(p => /press SAVE REPORT/.test(p)));
  js.savereport('/tmp/report.txt');
  assert.match(sim.files['/tmp/report.txt'].join('\n'), /FLOW SELF-TEST REPORT/);
});

test('SELF-TEST needs a second press; CANCEL aborts it and restores the loop', () => {
  const sim = new LiveSim({ playing: true, pos: 0 });
  const js = sim.loadScript(BUNDLE);
  sim.deviceReady();
  sim.run(100);
  js.self_test();
  sim.run(5000);
  assert.ok(!sim.posts.some(p => /SELF-TEST started/.test(p)), 'one press does not start it');
  js.self_test(); sim.run(10); js.self_test();
  sim.run(12000);
  js.cancel();
  sim.run(100);
  assert.ok(sim.posts.some(p => /ABORTED/.test(p)));
  assert.ok(sim.posts.some(p => /SELF-TEST DONE/.test(p)));
  assert.equal(sim.loop, 0);
  assert.equal(sim.loopLength, 16);
});

test('performance buttons are ignored while SELF-TEST runs', () => {
  const sim = new LiveSim({ playing: true, pos: 0 });
  const js = sim.loadScript(BUNDLE);
  sim.deviceReady();
  sim.run(100);
  js.self_test(); sim.run(10); js.self_test();
  sim.run(1000);
  const before = js.engine.history.length;
  js.hold(); js.next(); js.stop();
  assert.equal(js.engine.history.length, before);
});
