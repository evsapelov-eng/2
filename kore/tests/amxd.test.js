"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const PKG = path.join(__dirname, "..", "dist", "KORE");

test("KØRE.amxd = Max Instrument container wrapping kore_main.maxpat; all dependencies packaged", { skip: !fs.existsSync(PKG) }, () => {
  const d = fs.readFileSync(path.join(PKG, "KØRE.amxd"));
  assert.strictEqual(d.toString("latin1", 0, 4), "ampf");
  assert.strictEqual(d.toString("latin1", 8, 12), "iiii");
  const off = 20 + d.readUInt32LE(16);
  assert.strictEqual(d.toString("latin1", off, off + 4), "ptch");
  const plen = d.readUInt32LE(off + 4);
  assert.strictEqual(off + 8 + plen, d.length);
  const patch = JSON.parse(d.toString("utf8", off + 8, d.length - 1));
  assert.ok(patch.patcher.boxes.some((b) => b.box.text === "plugout~"));
  assert.ok(patch.patcher.boxes.some((b) => b.box.text === "p KORE_EDITOR"));
  for (const dep of patch.patcher.dependency_cache) assert.ok(fs.existsSync(path.join(PKG, dep.name)), dep.name);
  for (const f of ["kore_engine.js", "kore_ui.js"]) {
    assert.strictEqual(fs.readFileSync(path.join(PKG, f), "utf8"), fs.readFileSync(path.join(__dirname, "..", "max", f), "utf8"));
  }
});
