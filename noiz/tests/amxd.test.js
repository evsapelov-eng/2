// Checks the packed test-build devices: container layout, device type, embedded
// patch == generated source, dependencies present next to the device.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const PKG = path.join(__dirname, "..", "dist", "NOIZ");

function readAmxd(file) {
  const d = fs.readFileSync(file);
  assert.strictEqual(d.toString("latin1", 0, 4), "ampf");
  const type = d.toString("latin1", 8, 12);
  assert.strictEqual(d.toString("latin1", 12, 16), "meta");
  const mlen = d.readUInt32LE(16);
  const off = 20 + mlen;
  assert.strictEqual(d.toString("latin1", off, off + 4), "ptch");
  const plen = d.readUInt32LE(off + 4);
  assert.strictEqual(off + 8 + plen, d.length, "ptch length must cover the rest of the file");
  assert.strictEqual(d[d.length - 1], 0);
  return { type, patch: JSON.parse(d.toString("utf8", off + 8, d.length - 1)) };
}

test("NØIZ.amxd is a Max Instrument container wrapping the generated main patch", { skip: !fs.existsSync(PKG) }, () => {
  const { type, patch } = readAmxd(path.join(PKG, "NØIZ.amxd"));
  assert.strictEqual(type, "iiii");
  const src = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "max", "noiz_main.maxpat"), "utf8"));
  assert.strictEqual(patch.patcher.boxes.length, src.patcher.boxes.length);
  assert.strictEqual(patch.patcher.openinpresentation, 1);
  assert.ok(patch.patcher.boxes.some((b) => b.box.text === "plugout~"));
  for (const dep of patch.patcher.dependency_cache) assert.ok(fs.existsSync(path.join(PKG, dep.name)), dep.name);
});

test("P1 hello device is an Instrument with plugout~ and no JS dependency", { skip: !fs.existsSync(PKG) }, () => {
  const { type, patch } = readAmxd(path.join(PKG, "NØIZ P1 hello.amxd"));
  assert.strictEqual(type, "iiii");
  assert.ok(patch.patcher.boxes.some((b) => b.box.text === "plugout~"));
  assert.ok(!patch.patcher.boxes.some((b) => /^js |jsui/.test(b.box.text || b.box.maxclass)));
});

test("packaged JS is identical to the built sources", { skip: !fs.existsSync(PKG) }, () => {
  for (const f of ["noiz_engine.js", "noiz_ui.js"]) {
    assert.strictEqual(fs.readFileSync(path.join(PKG, f), "utf8"), fs.readFileSync(path.join(__dirname, "..", "max", f), "utf8"));
  }
});
