'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { LiveSim } = require('./sim/live-sim');

const SCRIPT = path.join(__dirname, '..', 'device', 'm0-spike', 'flow_spike.js');

function boot(opts) {
  const sim = new LiveSim(opts);
  const js = sim.loadScript(SCRIPT);
  sim.deviceReady();
  return { sim, js };
}

function result(sim, name) {
  const lines = sim.logs(new RegExp('EXP ' + name + ' RESULT'));
  return lines.length ? lines[lines.length - 1] : null;
}

function runExp(sim, name, maxMs) {
  const ok = sim.runUntil(() => result(sim, name) !== null, maxMs);
  assert.ok(ok, 'experiment ' + name + ' did not finish. Last log:\n' + sim.posts.slice(-15).join(''));
  return result(sim, name);
}

test('LiveAPI is not touched in global code (script loads before live.thisdevice)', () => {
  const sim = new LiveSim();
  assert.doesNotThrow(() => sim.loadScript(SCRIPT));
  assert.equal(sim.observers.length, 0);
});

test('init observes the documented Song properties and leaves transport untouched', () => {
  const { sim } = boot({ playing: false, pos: 12 });
  const props = sim.observers.map(o => o._prop).sort();
  assert.deepEqual(props, ['back_to_arranger', 'current_song_time', 'is_playing', 'loop', 'loop_length',
    'loop_start', 'signature_denominator', 'signature_numerator', 'tempo'].sort());
  sim.run(500);
  assert.equal(sim.playing, 0);
  assert.equal(sim.pos, 12);
  assert.ok(sim.logs(/READ loop_length = 16/).length);
  assert.ok(sim.logs(/CUE 1 name="GROOVE" time=32.000/).length);
});

test('init twice is harmless', () => {
  const { sim, js } = boot();
  js.init();
  assert.ok(sim.logs(/already initialised/).length);
});

test('exp_bars matches Live bars in 4/4 and 3/4', () => {
  for (const [num, pos] of [[4, 37], [3, 37]]) {
    const { sim, js } = boot({ num, pos });
    js.exp_bars();
    const r = runExp(sim, 'bars', 100);
    assert.match(r, /PASS/, r);
  }
});

test('exp_rates reports observer, poll and task statistics and a consistent tempo', () => {
  const { sim, js } = boot({ playing: true, tempo: 120 });
  js.exp_rates(3);
  const r = runExp(sim, 'rates', 6000);
  assert.doesNotMatch(r, /FAIL/);
  const tempoLine = sim.logs(/derived_tempo/)[0];
  const derived = Number(/derived_tempo ([\d.]+)/.exec(tempoLine)[1]);
  assert.ok(Math.abs(derived - 120) < 1, tempoLine);
  assert.ok(sim.logs(/observer_interval_ms n=\d+/).length);
});

test('experiments that need playback refuse when the transport is stopped', () => {
  const { sim, js } = boot({ playing: false });
  js.exp_hold(1);
  assert.match(result(sim, 'hold'), /FAIL transport is stopped/);
  assert.equal(sim.loop, 0);
});

test('exp_hold loops the aligned region and observes wraps; no sets inside notifications', () => {
  for (const tempo of [80, 120, 160]) {
    const { sim, js } = boot({ playing: true, tempo, pos: 5.3 });
    js.exp_hold(1, 2);
    const r = runExp(sim, 'hold', 10000);
    assert.match(r, /PASS 2 wraps/, r);
    assert.equal(sim.loop, 1);
    assert.equal(sim.loopStart, 4);
    assert.equal(sim.loopLength, 4);
    assert.deepEqual(sim.violations, []);
  }
});

test('exp_hold reports MISSED when the command lands after the boundary', () => {
  // 1 bar at 120 BPM = 2000 ms; start 10 ms before the bar line, latency 50 ms.
  const { sim, js } = boot({ playing: true, pos: 3.98, setLatency: 50 });
  js.exp_hold(1, 2);
  const r = runExp(sim, 'hold', 10000);
  assert.match(r, /FAIL MISSED/, r);
});

test('exp_release: clean exit with enough lead, EXTRA CYCLE detected when the set is late', () => {
  {
    const { sim, js } = boot({ playing: true, pos: 0.5 });
    sim.applySet('loop_start', 0); sim.applySet('loop_length', 4); sim.applySet('loop', 1);
    sim.run(200);
    js.exp_release();
    const r = runExp(sim, 'release', 10000);
    assert.match(r, /PASS clean exit/, r);
    assert.equal(sim.loop, 0);
  }
  {
    // Release requested ~20 ms before loop end with 80 ms command latency.
    const { sim, js } = boot({ playing: true, pos: 0, setLatency: 80 });
    sim.applySet('loop_start', 0); sim.applySet('loop_length', 4); sim.applySet('loop', 1);
    sim.runUntil(() => sim.pos > 3.96 && sim.pos < 3.97, 5000);
    sim.run(1);
    js.exp_release();
    const r = runExp(sim, 'release', 10000);
    assert.match(r, /EXTRA CYCLE/, r);
  }
});

test('exp_release_sweep separates safe and unsafe lead times for a given latency', () => {
  const { sim, js } = boot({ playing: true, pos: 1, setLatency: 40, obsInterval: 50, obsJitter: 15 });
  js.exp_release_sweep(1, 2, 500, 150, 10);
  runExp(sim, 'release_sweep', 120000);
  const summary = sim.logs(/SWEEP SUMMARY/).join('');
  assert.match(summary, /lead=500ms clean=2\/2/);
  assert.match(summary, /lead=150ms clean=2\/2/);
  assert.match(summary, /lead=10ms clean=0\/2/);
  assert.ok(sim.logs(/RECOMMENDED_RELEASE_LEAD_MS 300/).length, summary);
  assert.equal(sim.loop, 0);
  assert.deepEqual(sim.violations, []);
});

test('exp_hold_sweep distinguishes "late loop jumps back" from "late loop is ignored"', () => {
  for (const jumpsBack of [false, true]) {
    const { sim, js } = boot({ playing: true, pos: 1, setLatency: 5, lateLoopJumpsBack: jumpsBack });
    js.exp_hold_sweep(1, 1, 300, -100);
    runExp(sim, 'hold_sweep', 60000);
    const s = sim.logs(/HOLDSWEEP SUMMARY/).join('');
    assert.match(s, /lead=300ms HELD=1/, s);
    assert.match(s, jumpsBack ? /lead=-100ms JUMPED_BACK=1/ : /lead=-100ms NO_JUMP=1/, s);
  }
});

test('exp_seek classifies immediate vs quantized jumps', () => {
  for (const q of [false, true]) {
    const { sim, js } = boot({ playing: true, pos: 9.1, seekQuantized: q });
    js.target(2); // bar 2 = beat 4
    js.exp_seek();
    const r = runExp(sim, 'seek', 10000);
    assert.match(r, q ? /LIKELY_QUANTIZED/ : /LIKELY_IMMEDIATE/, r);
  }
});

test('exp_cuejump measures CuePoint.jump', () => {
  const { sim, js } = boot({ playing: true, pos: 9.1 });
  js.cueindex(1);
  js.exp_cuejump();
  const r = runExp(sim, 'cuejump', 10000);
  assert.match(r, /LIKELY_QUANTIZED/, r);
  assert.ok(sim.pos >= 32 && sim.pos < 34);
});

test('exp_wrapjump performs a backward jump at the next bar via the loop brace and restores it', () => {
  const { sim, js } = boot({ playing: true, pos: 21.2 });
  sim.applySet('loop_start', 64); sim.applySet('loop_length', 8);
  sim.run(100);
  js.exp_wrapjump.call(js); // target bar 1 (default)
  const r = runExp(sim, 'wrapjump', 10000);
  assert.match(r, /PASS jumped at ~2[34]\.\d+ \(boundary 24\.000\) landed 0\./, r);
  sim.run(100);
  assert.equal(sim.loop, 0);
  assert.equal(sim.loopStart, 64);
  assert.equal(sim.loopLength, 8);
});

test('wrapjump refuses forward targets', () => {
  const { sim, js } = boot({ playing: true, pos: 2 });
  js.target(9);
  js.exp_wrapjump();
  assert.match(result(sim, 'wrapjump'), /FAIL target bar must be before/);
});

test('exp_notifyset records the outcome of a set inside a callback', () => {
  const { sim, js } = boot();
  js.exp_notifyset();
  assert.ok(sim.logs(/NOTIFYSET set inside callback threw: Error: Changes cannot be triggered/).length);
});

test('only one experiment at a time; abort ends it', () => {
  const { sim, js } = boot({ playing: true });
  js.exp_rates(30);
  js.exp_hold(1);
  assert.ok(sim.logs(/BUSY: rates/).length);
  js.abort();
  assert.match(result(sim, 'rates'), /ABORTED/);
});

test('back_to_arranger is surfaced as a warning', () => {
  const { sim } = boot();
  sim.applySet('back_to_arranger', 1);
  assert.ok(sim.logs(/BACK TO ARRANGEMENT/).length);
});

test('savelog writes every log line', () => {
  const { sim, js } = boot();
  js.savelog('/tmp/flow.txt');
  assert.ok(sim.files['/tmp/flow.txt'].length > 5);
  assert.match(sim.files['/tmp/flow.txt'][0], /m0-spike/);
});

test('restore puts back the loop state captured at init', () => {
  const { sim, js } = boot({ playing: false });
  js.setloop(5, 2);
  js.loopon();
  sim.run(20);
  assert.equal(sim.loop, 1);
  js.restore();
  sim.run(20);
  assert.equal(sim.loop, 0);
  assert.equal(sim.loopStart, 0);
  assert.equal(sim.loopLength, 16);
});
