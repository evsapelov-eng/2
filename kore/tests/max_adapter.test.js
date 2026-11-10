// Runs the GENERATED max/kore_engine.js in a mock of Max's JS globals (message API only).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load() {
  const out = [], globals = {}, tasks = [], buffers = {};
  const ctx = { post() {}, outlet: (...a) => out.push(a), arrayfromargs: (a) => Array.prototype.slice.call(a),
    notifyclients() { ctx.__n = (ctx.__n || 0) + 1; }, Global: function (n) { return (globals[n] = globals[n] || {}); },
    Task: function (fn) { this.fn = fn; this.repeat = () => tasks.push(this); this.cancel = () => {}; this.schedule = () => { this.scheduled = true; if (!tasks.includes(this)) tasks.push(this); }; },
    Buffer: function (name) { const b = (buffers[name] = buffers[name] || { name, size: 0, data: [] });
      this.send = (msg, n) => { if (msg === "sizeinsamps") { b.size = n; b.data = new Array(n).fill(0); } };
      this.poke = (ch, frame, vals) => { (Array.isArray(vals) ? vals : [vals]).forEach((v, i) => { b.data[frame + i] = v; }); }; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "max", "kore_engine.js"), "utf8"), ctx);
  return { ctx, out, globals, tasks, buffers };
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

test("130 BPM transport ticks → trig messages: 8 values + delay; PUNCH is NOT sent as messages (signal domain)", () => {
  const { ctx, out } = load();
  for (let i = 0; i <= 190; i++) { // up to beat 3.8 (+ 40 ms lookahead < beat 4)
    const pos = i * 0.02, b = Math.floor(pos);
    ctx.tick(1 + Math.floor(b / 4), 1 + (b % 4), (pos - b) * 480, 480, 130);
  }
  const trig = out.filter((m) => m[0] === 0 && m[1] === "trig");
  trig.forEach((m) => { assert.strictEqual(m.length, 11); m.slice(2).forEach((v) => assert.ok(Number.isFinite(v))); assert.ok(m[10] >= 0 && m[10] <= 60); });
  assert.strictEqual(trig.filter((m) => m[2] === 0).length, 0, "kick runs from buffers, not messages");
  assert.ok(trig.length > 5);
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

test("kick buffers: pattern (16 amps) written on load and on edits; sound rendered into the inactive buffer, then switched", () => {
  const a = load();
  a.ctx.sr(48000);
  a.ctx.bufnames("---kick_a", "---kick_b", "---kpat");
  assert.deepStrictEqual(a.buffers["---kpat"].data.map((v) => (v > 0 ? 1 : 0)).join(""), "1000100010001000");
  const runScheduled = () => a.tasks.filter((t) => t.scheduled).forEach((t) => { t.scheduled = false; t.fn(); });
  runScheduled();
  const sw = a.out.filter((m) => m[1] === "kickbuf");
  assert.strictEqual(sw.length, 1);
  const name = sw[0][2], buf = a.buffers[name].data;
  assert.ok(buf.length > 5000 && buf[buf.length - 1] === 0 && Math.max(...buf.map(Math.abs)) > 0.9, "rendered kick");
  // a kick sound edit renders into the OTHER buffer
  a.ctx.select(0); a.ctx.param("tune", 0.9);
  runScheduled();
  const sw2 = a.out.filter((m) => m[1] === "kickbuf");
  assert.notStrictEqual(sw2[sw2.length - 1][2], name);
  // mute PUNCH → pattern zeros; level → kicklevel message
  a.ctx.mute(0, 1);
  assert.ok(a.buffers["---kpat"].data.every((v) => v === 0));
  a.ctx.level(0, -12);
  assert.ok(a.out.some((m) => m[1] === "kicklevel" && Math.abs(m[2] - Math.pow(10, -12 / 20)) < 1e-4));
});
