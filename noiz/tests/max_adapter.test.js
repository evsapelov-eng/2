// Runs the GENERATED max/noiz_engine.js inside a mock of Max's JS globals.
// This proves the adapter's message API and wiring logic — NOT that it loads in Max.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadInMockMax() {
  const out = [];
  const globals = {};
  const tasks = [];
  const ctx = {
    post: () => {},
    outlet: (...a) => out.push(a),
    arrayfromargs: (args) => Array.prototype.slice.call(args),
    notifyclients: () => { ctx.__notified = (ctx.__notified || 0) + 1; },
    Global: function (name) { return (globals[name] = globals[name] || {}); },
    Task: function (fn) { this.fn = fn; this.repeat = () => tasks.push(this); this.cancel = () => {}; },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "max", "noiz_engine.js"), "utf8"), ctx);
  return { ctx, out, globals, tasks };
}

test("generated noiz_engine.js declares Max inlets/outlets and loads without Max-specific errors", () => {
  const { ctx } = loadInMockMax();
  assert.strictEqual(ctx.inlets, 1);
  assert.strictEqual(ctx.outlets, 3);
  for (const fn of ["tick", "generate", "mutate", "keep", "undo", "toggle", "macro", "gesture", "getvalueof", "setvalueof", "loopon", "loopstart", "looplength", "tracklength", "hold", "synth", "synthreset", "view"]) {
    assert.strictEqual(typeof ctx[fn], "function", fn);
  }
});

test("transport ticks produce timed trig messages with 7 numeric args", () => {
  const { ctx, out } = loadInMockMax();
  // 120 BPM, 480 PPQ: poll every 10 ms → 0.02 beat = 9.6 ticks
  for (let i = 0; i <= 200; i++) {
    const pos = i * 0.02;
    const beats = Math.floor(pos);
    ctx.tick(1 + Math.floor(beats / 4), 1 + (beats % 4), (pos - beats) * 480, 480, 120);
  }
  const trig = out.filter((m) => m[0] === 0 && m[1] === "trig");
  assert.ok(trig.length >= 15, "trig count " + trig.length); // default bar ≈ 19 hits + ratchets − probability misses
  trig.forEach((m) => {
    assert.strictEqual(m.length, 13); // outlet, "trig", 10 values, delay
    m.slice(2).forEach((v) => assert.ok(Number.isFinite(v)));
    assert.ok(m[12] >= 0 && m[12] <= 60, "delay " + m[12]);
    assert.ok(m[8] >= 0 && m[8] <= 1, "pan " + m[8]);
    assert.ok([0, 1, 2, 3].includes(m[2]));
  });
  assert.ok(out.some((m) => m[0] === 1 && m[1] === "playhead"));
  assert.ok(out.some((m) => m[0] === 2 && m[1] === "sync" && m[2] === 1));
});

test("UI shared state is published under a per-instance Global name", () => {
  const a = loadInMockMax();
  a.ctx.loadbang();
  const bind = a.out.find((m) => m[1] === "bind");
  const name = bind[2];
  assert.match(name, /^noiz_ui_\d+$/);
  const s = JSON.parse(a.globals[name].state);
  assert.strictEqual(s.tracks.length, 4);
  const v = a.globals[name].version;
  a.ctx.generate();
  assert.ok(a.globals[name].version > v);
});

test("pattr round trip through getvalueof/setvalueof restores the pattern", () => {
  const a = loadInMockMax();
  a.ctx.generate();
  a.ctx.macro("tone", 0.11);
  const blob = a.ctx.getvalueof();
  const b = loadInMockMax();
  b.ctx.setvalueof(blob);
  assert.strictEqual(b.ctx.getvalueof(), blob);
  b.ctx.setvalueof("garbage");
  assert.ok(b.out.some((m) => m[0] === 2 && m[1] === "error"));
  assert.strictEqual(b.ctx.getvalueof(), blob); // failed restore keeps state
});

test("persistence notify is throttled through the Task, not per edit", () => {
  const a = loadInMockMax();
  for (let i = 0; i < 50; i++) a.ctx.macro("decay", i / 50);
  assert.strictEqual(a.ctx.__notified || 0, 0);
  a.tasks.forEach((t) => t.fn());
  assert.strictEqual(a.ctx.__notified, 1);
});
