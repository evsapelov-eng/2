'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GO, organism, MidiChecker } = require('./helpers');

test('player: every note-on gets its note-off, also across pattern swaps', () => {
  for (const gen of ['melodic', 'rhythmic']) {
    const o = organism({ gen, bars: 2 }, 3), pl = new GO.Player(), chk = new MidiChecker();
    pl.load(o.pattern(), true);
    for (let abs = 0; abs < 16 * 64; abs++) {
      if (abs % 7 === 3) { o.mutate(); pl.load(o.pattern(), false); }   // mid-bar mutation
      chk.feed(pl.tick(abs), abs);
    }
    chk.feed(pl.stop(), 'stop');
    assert.deepStrictEqual(chk.errors, []);
    assert.strictEqual(chk.held.size, 0, 'hanging notes after stop');
    assert.strictEqual(chk.ons, chk.offs);
    assert.ok(chk.ons > 100);
  }
});

test('player: a new pattern starts only on a bar boundary', () => {
  const pl = new GO.Player();
  const mk = p => ({ len: 16, spb: 16, voices: [{ ch: 1, on: true, ev: [{ t: 0, d: 1, p, v: 100 }, { t: 8, d: 1, p, v: 100 }] }] });
  pl.load(mk(60), true);
  const ons = [];
  for (let abs = 0; abs < 48; abs++) {
    if (abs === 5) pl.load(mk(72), false);
    pl.tick(abs).filter(m => (m[0] & 0xf0) === 0x90).forEach(m => ons.push([abs, m[1]]));
  }
  assert.deepStrictEqual(ons, [[0, 60], [8, 60], [16, 72], [24, 72], [32, 72], [40, 72]]);
});

test('player: repeated step is ignored, a jump releases held notes first', () => {
  const pl = new GO.Player(), chk = new MidiChecker();
  pl.load({ len: 16, spb: 16, voices: [{ ch: 2, on: true, ev: [{ t: 0, d: 8, p: 50, v: 90 }] }] }, true);
  chk.feed(pl.tick(0), 0);
  assert.deepStrictEqual(pl.tick(0), [], 'duplicate tick produced events');
  const jump = pl.tick(32);                       // loop brace jumped back/forward
  assert.deepStrictEqual(jump[0], [0x81, 50, 0]);
  chk.feed(jump, 32);
  chk.feed(pl.stop(), 'stop');
  assert.deepStrictEqual(chk.errors, []);
  assert.strictEqual(chk.held.size, 0);
});

test('player: channels keep the four voices apart', () => {
  const o = organism({ gen: 'rhythmic' }, 2);
  o.params.voices.forEach((v, i) => { v.ch = 5 + i; });
  const pl = new GO.Player(), seen = new Set();
  pl.load(o.pattern(), true);
  for (let abs = 0; abs < 64; abs++) pl.tick(abs).forEach(m => seen.add((m[0] & 15) + 1));
  assert.deepStrictEqual([...seen].sort(), [5, 6, 7, 8]);
});

// ---- the Max glue, driven like Live drives it ------------------------------

function loadDevice() {
  const out = { midi: [], state: null, status: [], self: [] };
  const apis = [];
  const ctx = {
    post: () => {},
    outlet: (n, ...a) => {
      const v = a.length === 1 ? a[0] : a;
      if (n === 0) out.midi.push(v);
      else if (n === 1) out.state = v;
      else if (n === 2) out.status.push(v.slice(1).join(' '));
      else out.self.push(v);
    },
    arrayfromargs: args => Array.prototype.slice.call(args),
    LiveAPI: function (cb, p) { this.cb = cb; this.path = p; apis.push(this); this.get = k => (k === 'is_playing' ? [0] : [4]); }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'device', 'organism.js'), 'utf8'), ctx);
  return { ctx, out, apis };
}

function transport(abs) {
  // Live's transport reports bars/beats/units; a 16th tick may arrive as 119 instead of 120
  const jitter = abs % 3 === 0 ? -1 : 0;
  const ticks = abs * 120 + jitter;
  const bar = Math.floor(ticks / 1920), beat = Math.floor((ticks % 1920) / 480), units = ticks % 480;
  return [bar + 1, beat + 1, units];
}

test('device: AUTO evolution, buttons, stop and state saving work through the Max glue', () => {
  const { ctx, out, apis } = loadDevice();
  assert.strictEqual(ctx.pos.immediate, 1, 'pos must run in the scheduler thread');
  ctx.param('gen', 0); ctx.param('bars', 1); ctx.param('evo', 1); ctx.param('every', 0);
  ctx.init();
  assert.ok(out.state && out.state[0] === 'set', 'state not saved on init');
  apis[0].cb(['is_playing', 1]);
  const chk = new MidiChecker();
  let evolveReq = [], gens = new Set();
  for (let abs = 0; abs < 16 * 40; abs++) {
    ctx.pos.apply(null, transport(abs));
    while (out.self.length) { const m = out.self.shift(); if (m === 'evolve') { evolveReq.push(abs); ctx.evolve(); } }
    gens.add(out.status[out.status.length - 1]);
    if (abs === 100) { ctx.param('evo', 2); ctx.btn('mutate', 1); ctx.btn('mutate', 0); }
    if (abs === 200) ctx.voice(2, 'on', 0);
    if (abs === 260) ctx.voice(1, 'ch', 9);
    if (abs === 300) { ctx.param('gen', 1); }
    if (abs === 400) ctx.param('freeze', 1);
    chk.feed(out.midi, abs);
    out.midi = [];
  }
  assert.ok(evolveReq.length > 20);
  assert.ok(evolveReq.every(a => (a + 2) % 16 === 0), 'evolution requested off the bar grid: ' + evolveReq.slice(0, 5));
  const afterFreeze = evolveReq.filter(a => a > 400);
  assert.strictEqual(afterFreeze.length, 0, 'AUTO kept evolving while frozen');
  out.midi = [];
  apis[0].cb(['is_playing', 0]);
  chk.feed(out.midi, 'stop');
  assert.deepStrictEqual(chk.errors, []);
  assert.strictEqual(chk.held.size, 0, 'hanging notes after Stop');
  assert.ok(gens.size > 10, 'generation counter did not move');

  // reload the saved state into a fresh device
  const saved = out.state.slice(1);
  const b = loadDevice();
  b.ctx.param('gen', 1);
  b.ctx.restore.apply(null, saved);
  b.ctx.init();
  const a1 = JSON.parse(decodeURIComponent(saved.join(''))).dna;
  const a2 = JSON.parse(decodeURIComponent(b.out.state.slice(1).join(''))).dna;
  assert.deepStrictEqual(a2, a1);
});

test('device: MANUAL ignores the clock, AUTO ignores the MUTATE button', () => {
  const { ctx, out, apis } = loadDevice();
  ctx.init(); apis[0].cb(['is_playing', 1]);
  for (let abs = 0; abs < 200; abs++) ctx.pos.apply(null, transport(abs));
  assert.strictEqual(out.self.length, 0);
  ctx.param('evo', 1);
  const before = out.state.join('');
  ctx.btn('mutate', 1);
  assert.strictEqual(out.state.join(''), before);
  assert.match(out.status[out.status.length - 1], /AUTO/);
});

// ---- the patcher ------------------------------------------------------------

test('device files: ES5 engine, consistent patcher, valid .amxd container', () => {
  const acorn = require('acorn');
  const src = fs.readFileSync(path.join(__dirname, '..', 'device', 'organism.js'), 'utf8');
  acorn.parse(src, { ecmaVersion: 5 });           // classic Max [js] is ES5

  const buf = fs.readFileSync(path.join(__dirname, '..', 'device', 'GenerativeOrganism.amxd'));
  assert.strictEqual(buf.toString('latin1', 0, 4), 'ampf');
  assert.strictEqual(buf.toString('latin1', 8, 12), 'mmmm');
  assert.strictEqual(buf.toString('latin1', 24, 28), 'ptch');
  const len = buf.readUInt32LE(28);
  assert.strictEqual(32 + len, buf.length);
  const pat = JSON.parse(buf.toString('utf8', 32, 32 + len).replace(/\0$/, '')).patcher;

  const byId = new Map(pat.boxes.map(b => [b.box.id, b.box]));
  for (const l of pat.lines) {
    const [s, so] = l.patchline.source, [d, di] = l.patchline.destination;
    assert.ok(byId.has(s) && byId.has(d), 'dangling patchline');
    assert.ok(so < byId.get(s).numoutlets, `outlet ${so} of ${byId.get(s).text || byId.get(s).maxclass}`);
    assert.ok(di < byId.get(d).numinlets, `inlet ${di} of ${byId.get(d).text || byId.get(d).maxclass}`);
  }
  const names = pat.boxes.filter(b => b.box.parameter_enable).map(b => b.box.saved_attribute_attributes.valueof.parameter_longname);
  assert.strictEqual(new Set(names).size, names.length, 'duplicate parameter names');
  // every UI control reaches the engine
  const js = pat.boxes.find(b => b.box.text === 'js organism.js').box.id;
  for (const b of pat.boxes.filter(x => x.box.parameter_enable && x.box.maxclass.indexOf('live.') === 0)) {
    const pre = pat.lines.find(l => l.patchline.source[0] === b.box.id);
    assert.ok(pre, b.box.varname + ' is not connected');
    assert.ok(pat.lines.some(l => l.patchline.source[0] === pre.patchline.destination[0] && l.patchline.destination[0] === js),
      b.box.varname + ' does not reach the engine');
  }
  // the presentation fits Live's device height
  for (const b of pat.boxes) if (b.box.presentation) assert.ok(b.box.presentation_rect[1] + b.box.presentation_rect[3] <= 169);
});
