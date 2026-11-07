'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GO, organism, MidiChecker } = require('./helpers');

const GENS = ['melodic', 'rhythmic', 'hybrid', 'experimental'];

test('player: every note-on gets its note-off, also across pattern swaps (all generators)', () => {
  for (const gen of GENS) {
    const o = organism({ gen, bars: 2 }, 3), pl = new GO.Player(), chk = new MidiChecker();
    pl.load(o.pattern(), true);
    for (let abs = 0; abs < 16 * 48; abs++) {
      if (abs % 7 === 3) { o.mutate(); pl.load(o.pattern(), false); }
      chk.feed(pl.tick(abs), abs);
    }
    chk.feed(pl.stop(), 'stop');
    assert.deepStrictEqual(chk.errors, [], gen);
    assert.strictEqual(chk.held.size, 0, gen + ': hanging notes after stop');
    assert.ok(chk.ons > 50, gen);
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

test('player: repeated step is ignored, a jump releases held notes first, bends re-centre on stop', () => {
  const pl = new GO.Player(), chk = new MidiChecker();
  pl.load({ len: 16, spb: 16, voices: [{ ch: 2, on: true, ev: [{ t: 0, d: 8, p: 50, v: 90, c: -50 }] }] }, true);
  const first = pl.tick(0);
  assert.deepStrictEqual(first[0], [0xE1, 0, 48], 'bend -50 cents before the note');
  chk.feed(first, 0);
  assert.deepStrictEqual(pl.tick(0), []);
  const jump = pl.tick(32);
  assert.deepStrictEqual(jump[0], [0x81, 50, 0]);
  chk.feed(jump, 32);
  const stop = pl.stop();
  chk.feed(stop, 'stop');
  assert.ok(stop.some(m => m[0] === 0xE1 && m[1] === 0 && m[2] === 64), 'bend not re-centred');
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

// ---- CAPTURE ----------------------------------------------------------------

function readSMF(bytes) {
  const b = Buffer.from(bytes);
  assert.strictEqual(b.toString('latin1', 0, 4), 'MThd');
  const ntr = b.readUInt16BE(10), tracks = [];
  let off = 14;
  for (let t = 0; t < ntr; t++) {
    assert.strictEqual(b.toString('latin1', off, off + 4), 'MTrk');
    const len = b.readUInt32BE(off + 4), end = off + 8 + len, ev = [];
    let p = off + 8, tick = 0, running = 0;
    while (p < end) {
      let d = 0, x;
      do { x = b[p++]; d = (d << 7) | (x & 127); } while (x & 128);
      tick += d;
      let st = b[p];
      if (st === 0xff) { const l = b[p + 2]; p += 3 + l; continue; }
      if (st & 0x80) { running = st; p++; } else st = running;
      ev.push({ tick, msg: [st, b[p], b[p + 1]] });
      p += 2;
    }
    tracks.push(ev);
    off = end;
  }
  return tracks;
}

test('CAPTURE is an independent copy; clip notes and MIDI file keep time, channel, microtones', () => {
  const o = organism({ gen: 'melodic', sysCat: 4, sysVar: 1, bars: 2 }, 9);
  const cap = o.capture(), frozen = JSON.stringify(cap);
  for (let i = 0; i < 5; i++) o.mutate();
  assert.strictEqual(JSON.stringify(o.captures[0]), frozen, 'mutation changed the capture');
  assert.strictEqual(cap.beats, 8);
  const R0 = cap.notes.filter(n => n.voice === 2);
  assert.ok(R0.length && R0.every(n => n.ch === 3));
  const clip = GO.Capture.clipNotes(cap);
  assert.strictEqual(clip.length, cap.notes.length);
  assert.ok(clip.every(n => n.start_time >= 0 && n.start_time < 8 && n.duration > 0 && n.velocity > 0));
  const tracks = readSMF(GO.Capture.smf(cap, 100));
  assert.strictEqual(tracks.length, 5);
  const ons = tracks.slice(1).flat().filter(e => (e.msg[0] & 0xf0) === 0x90);
  assert.strictEqual(ons.length, cap.notes.length);
  const bends = tracks.slice(1).flat().filter(e => (e.msg[0] & 0xf0) === 0xe0);
  assert.ok(bends.length > 0, 'quarter tones lost in export');
  for (const tr of tracks.slice(1)) {
    for (let i = 0; i < tr.length; i++) if ((tr[i].msg[0] & 0xf0) === 0xe0) {
      assert.ok(tr.slice(i + 1).some(e => e.tick === tr[i].tick && (e.msg[0] & 0xf0) === 0x90), 'bend not before its note');
    }
  }
  const first = cap.notes[0];
  const n1 = ons.find(e => e.msg[1] === first.p && e.tick === Math.round(first.start * 480));
  assert.ok(n1 && (n1.msg[0] & 15) === first.ch - 1);
});

// ---- the Max glue, driven like Live drives it ------------------------------

function mockLive() {
  const calls = [], slots = [{ has: 1 }, { has: 0 }, { has: 0 }], controls = [];
  for (let i = 0; i < 8; i++) controls.push(i + '_Volume', 'Device_Control_' + i, 'Track_Control_' + i);
  for (let c = 0; c < 8; c++) for (let r = 0; r < 5; r++) controls.push(c + '_Clip_' + r + '_Button');
  for (let i = 0; i < 5; i++) controls.push('Scene_' + i + '_Launch_Button');
  controls.push('Crossfader', 'Master_Volume');
  const observers = {};
  function LiveAPI(cb, p) {
    if (typeof cb === 'string') { p = cb; cb = null; }            // new LiveAPI(path) is valid in Max
    this.cb = cb; this.path = p; this.unquotedpath = p === 'this_device canonical_parent' ? 'live_set tracks 0' : p;
    this.id = 1; this.type = 'Unknown'; this.info = '';
    if (p && p.indexOf('control_surfaces') === 0) { const i = +p.split(' ')[1]; this.id = i <= 1 ? 10 + i : 0; this.type = i === 1 ? 'APC40_MkII' : 'Push2'; }
    if (cb && p && p.indexOf('id ') === 0) observers[p] = this;
    LiveAPI.all.push(this);
  }
  LiveAPI.all = [];
  LiveAPI.prototype.get = function (k) {
    if (k === 'is_playing') return [0];
    if (k === 'tempo') return [100];
    if (k === 'has_clip') return [slots[+this.path.split(' ').pop()].has];
    return [4];
  };
  LiveAPI.prototype.getcount = function () { return slots.length; };
  LiveAPI.prototype.set = function (k, v) { calls.push(['set', this.path, k, v]); };
  LiveAPI.prototype.call = function (...a) {
    calls.push(['call', this.path].concat(a));
    if (a[0] === 'get_control_names') return controls;
    if (a[0] === 'get_control') return ['id', 1000 + controls.indexOf(a[1])];
    return [];
  };
  return { LiveAPI, calls, observers, controls };
}

function loadDevice() {
  const out = { midi: [], state: null, status: [], sys: [], harm: [], edit: [], self: [], dialog: 0 };
  const live = mockLive(), ui = {}, files = {};
  const ctx = {
    post: (m) => { if (process.env.GO_DEBUG) console.log('POST', m); },
    outlet: (n, ...a) => {
      const v = a.length === 1 ? a[0] : a;
      if (n === 0) out.midi.push(v);
      else if (n === 1) out.state = v;
      else if (n === 2) out[a[0]].push(a.slice(1).join(' '));
      else if (n === 3) out.self.push(v);
      else out.dialog++;
    },
    arrayfromargs: args => Array.prototype.slice.call(args),
    LiveAPI: live.LiveAPI,
    File: function (name, mode) {
      this.isopen = mode === 'write'; this.position = 0; this.eof = 0;
      this.writebytes = b => { files[name] = b.slice(); this.position = b.length; };
      this.close = () => {};
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'device', 'organism.js'), 'utf8'), ctx);
  // live.* objects: getnamed(name).message() sets the control, which sends its value back to js
  const routes = {
    'Freeze': v => ctx.param('freeze', v), 'Generator': v => ctx.param('gen', v), 'Evolution': v => ctx.param('evo', v),
    'Library': v => ctx.param('lib', v), 'Mutation Amount': v => ctx.param('amount', v), 'Key': v => ctx.param('key', v),
    'V2 Density': v => ctx.voice(1, 'dens', v), 'Voice 3': v => ctx.voice(2, 'on', v), 'V2 Mutation': v => ctx.voice(1, 'mut', v)
  };
  ctx.self.patcher = { getnamed: name => ({ message: (type, v) => { ui[name] = v; if (routes[name]) routes[name](v); } }) };
  return { ctx, out, live, ui, files };
}

function transport(abs) {
  const jitter = abs % 3 === 0 ? -1 : 0;
  const ticks = abs * 120 + jitter;
  const bar = Math.floor(ticks / 1920), beat = Math.floor((ticks % 1920) / 480), units = ticks % 480;
  return [bar + 1, beat + 1, units];
}

test('device: AUTO evolution, buttons, generators, systems, stop and state saving through the Max glue', () => {
  const { ctx, out, live } = loadDevice();
  assert.strictEqual(ctx.pos.immediate, 1, 'pos must run in the scheduler thread');
  ctx.param('gen', 0); ctx.param('bars', 1); ctx.param('evo', 1); ctx.param('every', 0);
  ctx.init();
  assert.ok(out.state && out.state[0] === 'set', 'state not saved on init');
  assert.ok(out.sys.length && out.harm.length, 'info lines missing');
  const play = live.LiveAPI.all.find(a => a.cb && a.path === 'live_set');
  play.cb(['is_playing', 1]);
  const chk = new MidiChecker();
  const evolveReq = [], gens = new Set();
  for (let abs = 0; abs < 16 * 48; abs++) {
    ctx.pos.apply(null, transport(abs));
    while (out.self.length) { const m = out.self.shift(); if (m === 'evolve') { evolveReq.push(abs); ctx.evolve(); } }
    gens.add(out.status[out.status.length - 1]);
    if (abs === 100) { ctx.param('evo', 2); ctx.btn('mutate', 1); ctx.btn('mutate', 0); }
    if (abs === 150) ctx.param('gen', 2);
    if (abs === 200) ctx.voice(2, 'on', 0);
    if (abs === 260) ctx.voice(1, 'ch', 9);
    if (abs === 300) { ctx.param('syscat', 4); ctx.param('sysvar', 1); }
    if (abs === 360) ctx.param('gen', 3);
    if (abs === 420) { ctx.param('syscat', 0); ctx.param('lib', 6); ctx.param('prog', 1); }
    if (abs === 500) ctx.param('freeze', 1);
    chk.feed(out.midi, abs);
    out.midi = [];
  }
  assert.ok(evolveReq.length > 20);
  assert.ok(evolveReq.every(a => (a + 2) % 16 === 0), 'evolution requested off the bar grid');
  assert.strictEqual(evolveReq.filter(a => a > 500).length, 0, 'AUTO kept evolving while frozen');
  play.cb(['is_playing', 0]);
  chk.feed(out.midi, 'stop');
  assert.deepStrictEqual(chk.errors, []);
  assert.strictEqual(chk.held.size, 0, 'hanging notes after Stop');
  assert.ok(gens.size > 10);
  assert.match(out.harm[out.harm.length - 1], /ii-V-I major/);

  const saved = out.state.slice(1);
  const b = loadDevice();
  b.ctx.param('gen', 3); b.ctx.param('lib', 6);
  b.ctx.restore.apply(null, saved);
  b.ctx.init();
  const a1 = JSON.parse(decodeURIComponent(saved.join(''))).dna;
  const a2 = JSON.parse(decodeURIComponent(b.out.state.slice(1).join(''))).dna;
  assert.deepStrictEqual(a2, a1);
});

test('device: MANUAL ignores the clock, AUTO ignores the MUTATE button', () => {
  const { ctx, out, live } = loadDevice();
  ctx.init();
  live.LiveAPI.all.find(a => a.cb && a.path === 'live_set').cb(['is_playing', 1]);
  for (let abs = 0; abs < 200; abs++) ctx.pos.apply(null, transport(abs));
  assert.strictEqual(out.self.length, 0);
  ctx.param('evo', 1);
  const before = out.state.join('');
  ctx.btn('mutate', 1);
  assert.strictEqual(out.state.join(''), before);
  assert.match(out.status[out.status.length - 1], /AUTO/);
});

test('device: CAPTURE writes a Live clip into the first free slot; EXPORT writes a .mid file', () => {
  const { ctx, out, live, files } = loadDevice();
  ctx.init();
  ctx.btn('capture', 1);
  const c = live.calls;
  const create = c.find(x => x[2] === 'create_clip');
  assert.deepStrictEqual(create.slice(1), ['live_set tracks 0 clip_slots 1', 'create_clip', 8]);
  const add = c.find(x => x[2] === 'add_new_notes');
  assert.strictEqual(add[1], 'live_set tracks 0 clip_slots 1 clip');
  assert.ok(add[3].notes.length > 5 && add[3].notes.every(n => n.start_time < 8));
  assert.match(out.status[out.status.length - 1], /clip .* slot 2/);
  ctx.btn('mutate', 1);
  ctx.btn('export', 1);
  assert.strictEqual(out.dialog, 1);
  ctx.exportmidi('Macintosh HD:/tmp/go.mid');
  const bytes = files['Macintosh HD:/tmp/go.mid'];
  assert.ok(bytes && bytes.length > 100);
  const ons = readSMF(bytes).slice(1).flat().filter(e => (e.msg[0] & 0xf0) === 0x90).length;
  assert.strictEqual(ons, add[3].notes.length, 'export is not the captured material');
});

test('device: typed progression goes to the User slot and drives the music', () => {
  const { ctx, out } = loadDevice();
  ctx.init();
  ctx.param('lib', 9); ctx.param('prog', 2);
  ctx.custom('Dm7', 'G7', 'Cmaj7', 'A7');
  assert.match(out.status[out.status.length - 1], /User progression 2 stored/);
  assert.match(out.harm[out.harm.length - 1], /Dm7 G7 Cmaj7 A7/);
  ctx.custom('I', 'V7', 'Zz9');
  assert.match(out.harm[out.harm.length - 1], /Cannot use/);
});

test('device: APC40 MK2 controls reach the parameters, grid slots and crossfader', () => {
  const { ctx, out, live, ui } = loadDevice();
  ctx.init();
  ctx.param('apc', 1);
  assert.match(out.status[out.status.length - 1], /APC40 MK2: \d+ controls/);
  const grabbed = live.calls.filter(x => x[2] === 'grab_control').length;
  assert.ok(grabbed >= 8 * 3 + 40 + 5 + 1, 'grabbed ' + grabbed);
  const ctl = name => live.observers['id ' + (1000 + live.controls.indexOf(name))];
  ctl('0_Volume').cb(['value', 127]);
  assert.strictEqual(ui['Mutation Amount'], 100);
  ctl('Device_Control_1').cb(['value', 0]);
  assert.strictEqual(ui['V2 Density'], -50);
  ctl('Track_Control_0').cb(['value', 127]);
  assert.strictEqual(ui['Key'], 11);
  ctl('0_Clip_2_Button').cb(['value', 127]);               // generator MELODIC... HYBRID
  ctl('2_Clip_2_Button').cb(['value', 127]);
  assert.strictEqual(ui['Generator'], 2);
  ctl('0_Clip_0_Button').cb(['value', 127]);               // store slot 1
  ctl('Scene_0_Launch_Button').cb(['value', 127]);         // mutate
  ctl('Scene_0_Launch_Button').cb(['value', 0]);
  ctl('1_Clip_0_Button').cb(['value', 127]);               // store slot 2
  assert.match(out.status[out.status.length - 1], /slots 12------/);
  const led = live.calls.filter(x => x[2] === 'send_value');
  assert.ok(led.some(x => x[3] === GO.APC.LED.stored));
  ctl('Crossfader').cb(['value', 127]);
  assert.match(out.status[out.status.length - 1], /MORPH/);
  ctl('7_Clip_2_Button').cb(['value', 127]);               // freeze
  assert.strictEqual(ui['Freeze'], 1);
  ctl('5_Clip_3_Button').cb(['value', 127]);               // lock voice 2
  assert.strictEqual(ui['V2 Mutation'], 0);
  ctx.param('apc', 0);
  assert.ok(live.calls.filter(x => x[2] === 'release_control').length === grabbed);
});

test('APC40 control names are classified whatever the index base', () => {
  const c = GO.APC.classify(['1_Volume', '2_Volume', 'Device_Control_1', '1_Clip_1_Button', '2_Clip_1_Button', 'Crossfader', 'Junk'], GO.APC.PATTERNS);
  assert.deepStrictEqual(c.fader, ['1_Volume', '2_Volume']);
  assert.deepStrictEqual(c.deviceKnob, ['Device_Control_1']);
  assert.strictEqual(c.grid['0,0'], '1_Clip_1_Button');
  assert.strictEqual(c.grid['1,0'], '2_Clip_1_Button');
  assert.strictEqual(c.crossfader, 'Crossfader');
});

// ---- the patcher ------------------------------------------------------------

test('device files: ES5 engine, consistent patcher, Push banks, valid .amxd container', () => {
  const acorn = require('acorn');
  const src = fs.readFileSync(path.join(__dirname, '..', 'device', 'organism.js'), 'utf8');
  acorn.parse(src, { ecmaVersion: 5 });

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
  const js = pat.boxes.find(b => b.box.text === 'js organism.js').box.id;
  for (const b of pat.boxes.filter(x => x.box.parameter_enable && x.box.maxclass.indexOf('live.') === 0)) {
    const pre = pat.lines.find(l => l.patchline.source[0] === b.box.id);
    assert.ok(pre, b.box.varname + ' is not connected');
    assert.ok(pat.lines.some(l => l.patchline.source[0] === pre.patchline.destination[0] && l.patchline.destination[0] === js),
      b.box.varname + ' does not reach the engine');
    assert.strictEqual(b.box.varname, b.box.saved_attribute_attributes.valueof.parameter_longname, 'getnamed needs varname = name');
  }
  for (const b of pat.boxes) if (b.box.presentation) {
    const r = b.box.presentation_rect;
    assert.ok(r[1] + r[3] <= 169, 'too tall: ' + (b.box.text || b.box.varname));
  }
  // presentation controls do not overlap
  const pres = pat.boxes.filter(b => b.box.presentation).map(b => [b.box.varname || b.box.text, b.box.presentation_rect]);
  for (let i = 0; i < pres.length; i++) for (let j = i + 1; j < pres.length; j++) {
    const a = pres[i][1], c = pres[j][1];
    const overlap = a[0] < c[0] + c[2] - 1 && c[0] < a[0] + a[2] - 1 && a[1] < c[1] + c[3] - 1 && c[1] < a[1] + a[3] - 1;
    assert.ok(!overlap, `overlap: ${pres[i][0]} / ${pres[j][0]}`);
  }
  // Push 2 banks and the APC40 map only name existing parameters
  const banks = pat.parameters.parameterbanks;
  assert.ok(Object.keys(banks).length >= 6);
  for (const k in banks) for (const n of banks[k].parameters) assert.ok(names.includes(n), 'bank names ' + n);
  for (const kind of ['fader', 'deviceKnob', 'trackKnob']) for (const n of GO.APC.MAP[kind]) assert.ok(names.includes(n), 'APC map names ' + n);
});
