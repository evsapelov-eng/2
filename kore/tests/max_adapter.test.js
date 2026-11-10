// Runs the GENERATED max/kore_engine.js in a mock of Max's JS globals (message API only).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load() {
  const out = [], globals = {}, tasks = [];
  const ctx = { post() {}, outlet: (...a) => out.push(a), arrayfromargs: (a) => Array.prototype.slice.call(a),
    notifyclients() { ctx.__n = (ctx.__n || 0) + 1; }, Global: function (n) { return (globals[n] = globals[n] || {}); },
    Task: function (fn) { this.fn = fn; this.repeat = () => tasks.push(this); this.cancel = () => {}; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "max", "kore_engine.js"), "utf8"), ctx);
  return { ctx, out, globals, tasks };
}

test("engine bundle: Max inlets/outlets and every documented message exists", () => {
  const { ctx } = load();
  assert.strictEqual(ctx.inlets, 1); assert.strictEqual(ctx.outlets, 3);
  for (const fn of ["tick", "loopon", "loopstart", "looplength", "generate", "mutate", "keep", "undo", "amount", "style", "interaction",
    "unlockpunch", "select", "selstep", "page", "view", "toggle", "stepset", "tracklength", "division", "level", "mute", "hold",
    "param", "paramreset", "lane", "clearlock", "clearsteplocks", "gesture", "meter", "kickmeter", "getvalueof", "setvalueof"]) {
    assert.strictEqual(typeof ctx[fn], "function", fn);
  }
});

test("130 BPM transport ticks → trig messages: 8 values + delay, four-on-the-floor PUNCH", () => {
  const { ctx, out } = load();
  for (let i = 0; i <= 190; i++) { // up to beat 3.8 (+ 40 ms lookahead < beat 4)
    const pos = i * 0.02, b = Math.floor(pos);
    ctx.tick(1 + Math.floor(b / 4), 1 + (b % 4), (pos - b) * 480, 480, 130);
  }
  const trig = out.filter((m) => m[0] === 0 && m[1] === "trig");
  trig.forEach((m) => { assert.strictEqual(m.length, 11); m.slice(2).forEach((v) => assert.ok(Number.isFinite(v))); assert.ok(m[10] >= 0 && m[10] <= 60); });
  assert.strictEqual(trig.filter((m) => m[2] === 0).length, 4, "4 kicks in one bar");
  assert.ok(out.some((m) => m[1] === "playhead" && m.length === 8));
});

test("Live Set persistence round trip and throttled notify", () => {
  const a = load();
  a.ctx.generate();
  const blob = a.ctx.getvalueof();
  const b = load();
  b.ctx.setvalueof(blob);
  assert.strictEqual(b.ctx.getvalueof(), blob);
  for (let i = 0; i < 20; i++) b.ctx.param("decay", i / 20);
  assert.strictEqual(b.ctx.__n || 0, 0);
  b.tasks.forEach((t) => t.fn());
  assert.strictEqual(b.ctx.__n, 1);
});

test("meters are UI telemetry only (never change the pattern)", () => {
  const a = load();
  const before = a.ctx.getvalueof();
  a.ctx.meter(0.7); a.ctx.kickmeter(0.9);
  assert.strictEqual(a.ctx.getvalueof(), before);
});
