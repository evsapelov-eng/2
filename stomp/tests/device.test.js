// The generated Max patch (tools/build_device.py): MIDI path, parameters, gen~ codebox. Static checks — NOT Max.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
cp.execFileSync("python3", [path.join(ROOT, "tools", "build_device.py")]);
const pat = JSON.parse(fs.readFileSync(path.join(ROOT, "max", "stomp_main.maxpat"), "utf8")).patcher;
const boxes = Object.fromEntries(pat.boxes.map((b) => [b.box.id, b.box]));
const byText = (t) => pat.boxes.map((b) => b.box).filter((b) => b.text === t);
const one = (t) => { const r = byText(t); assert.strictEqual(r.length, 1, t); return r[0]; };
const links = (from, outlet) => pat.lines.map((l) => l.patchline).filter((l) => l.source[0] === from.id && l.source[1] === outlet).map((l) => boxes[l.destination[0]]);
const spec = JSON.parse(cp.execFileSync("python3", ["-c", "import sys,json;sys.path.insert(0,'tools');import spec;print(json.dumps({'k':[k[0] for k in spec.KNOBS],'s':[s[0] for s in spec.SOURCES],'d':spec.depth_names()}))"], { cwd: ROOT }));

test("instrument: MIDI in → note-ons → velocity, then the note, then a new hit number → gen~ → plugout~", () => {
  const mp = one("midiparse"), sn = one("stripnote"), tbi = one("t b i"), gen = one("gen~");
  assert.ok(links(one("midiin"), 0).includes(mp));
  assert.ok(links(mp, 0).includes(sn));
  assert.strictEqual(links(sn, 1)[0].text, "/ 127.");
  assert.strictEqual(links(links(sn, 1)[0], 0)[0].text, "prepend kvel");
  assert.ok(links(sn, 0).includes(tbi));
  assert.strictEqual(links(tbi, 1)[0].text, "prepend knote");    // right outlet fires first: the note before the hit
  const cnt = links(tbi, 0)[0], inc = links(cnt, 0)[0];
  assert.strictEqual(cnt.text, "i"); assert.strictEqual(inc.text, "+ 1");
  assert.ok(links(inc, 0).some((b) => b.text === "prepend ktrig") && links(inc, 0).includes(cnt));
  assert.ok(links(inc, 0).some((b) => b.text === "prepend hitno"), "the panel learns the hit number (same random values)");
  const lfoSnap = links(gen, 3).filter((b) => b.text === "snapshot~ 33")[0];
  assert.ok(lfoSnap && links(lfoSnap, 0)[0].text === "prepend nlfo", "the noise LFO goes to the panel");
  const out = one("plugout~");
  assert.ok(links(gen, 0).includes(out) && links(gen, 1).includes(out));
  assert.strictEqual(byText("plugin~").length, 0, "an instrument has no audio input");
});

test("every knob, source amount and cable depth is a Live parameter with the engine's default", () => {
  const code = fs.readFileSync(path.join(ROOT, "gen", "stomp.genexpr"), "utf8");
  const dials = pat.boxes.map((b) => b.box).filter((b) => b.maxclass === "live.dial");
  const names = spec.k.concat(spec.s, spec.d);
  assert.strictEqual(dials.length, names.length);
  for (const n of names) {
    const d = dials.find((x) => x.varname === n); assert.ok(d, n);
    const m = code.match(new RegExp("Param " + n + "\\(([-\\d.]+)")); assert.ok(m, "Param " + n);
    assert.strictEqual(d.saved_attribute_attributes.valueof.parameter_initial[0], +m[1], n);
    assert.ok(links(d, 0).some((b) => b.text === "prepend " + n), n + " → gen~");
  }
  const toggles = pat.boxes.map((b) => b.box).filter((b) => b.maxclass === "live.toggle").map((b) => b.varname).sort();
  assert.deepStrictEqual(toggles, ["dr_pre", "p808"]);
  const longs = dials.map((d) => d.saved_attribute_attributes.valueof.parameter_longname);
  assert.strictEqual(new Set(longs).size, longs.length);
});

test("gen~ codebox holds the engine (ASCII, no comments) and the panel is a versioned jsui", () => {
  const gen = one("gen~"), cb = gen.patcher.boxes.find((b) => b.box.maxclass === "codebox").box;
  assert.ok(/^[\x00-\x7f]*$/.test(cb.code) && !/\/\//.test(cb.code));
  assert.ok(cb.code.includes("Param ktrig(0);"));
  const ui = pat.boxes.map((b) => b.box).find((b) => b.maxclass === "jsui");
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"))).version.replace(/\./g, "_");
  assert.strictEqual(ui.filename, "stomp_ui_" + v + ".js");
  const W = require("../tools/preview").boot().ctx.W0;   // the panel's own width
  assert.deepStrictEqual(ui.presentation_rect, [0, 0, W, 169]);
  assert.strictEqual(pat.devicewidth, W);
});

test("the .amxd container says instrument ('iiii')", () => {
  const b = cp.execFileSync("python3", ["-c", "import sys;sys.path.insert(0,'tools');import build_device as d;sys.stdout.buffer.write(d.amxd_bytes({'patcher':{}})[:12])"], { cwd: ROOT });
  assert.strictEqual(b.toString("latin1"), "ampf\x04\x00\x00\x00iiii");
});

test("user slots live in a [pattr] Live parameter of type blob (saved with the set); panel <-> pattr wired", () => {
  const ps = one("pattr stomp_slots");
  assert.strictEqual(ps.parameter_enable, 1);
  assert.strictEqual(ps.saved_attribute_attributes.valueof.parameter_type, 3);
  const ui = pat.boxes.map((b) => b.box).find((b) => b.maxclass === "jsui");
  assert.ok(links(ps, 0).includes(ui), "pattr -> panel");
  const rt2 = one("route knote kvel hit slotdata");
  assert.strictEqual(links(rt2, 3)[0].text, "prepend slots");
  assert.ok(links(links(rt2, 3)[0], 0).includes(ps), "panel -> pattr");
});
