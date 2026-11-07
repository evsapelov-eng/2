// main.js: glue between the Max patch, the engine and Live (Max [js] only).
//
// inlet 0 messages:
//   pos <bars> <beats> <units>  from [metro 16n] -> [transport]; high priority
//   init                         from [live.thisdevice]; Live API ready
//   param <name> <value>         device controls
//   voice <index> <name> <value> per-voice controls
//   btn <name> [value]           MUTATE / REVERT / RESET / CAPTURE / EXPORT
//   custom <chords...>           text from the progression editor
//   exportmidi <path>            file chosen in [savedialog]
//   restore <chunks...>          saved state from the hidden [pattr]
//   evolve                       AUTO evolution request (back via [deferlow])
//   panic                        all notes off
// outlets: 0 MIDI bytes -> [iter] -> [midiout]
//          1 state for [pattr] ("set <chunks>")
//          2 displays: status / sys / harm / edit <text> -> [route]
//          3 self messages -> [deferlow] -> inlet
//          4 bang -> [savedialog] (EXPORT)

inlets = 1;
outlets = 5;
autowatch = 0;

var self = this;
var U = GO.util;
var params = GO.Organism.defaultParams();
var org = new GO.Organism.Organism(params, (new Date().getTime() % 2147483646) + 1);
var player = new GO.Player();
var ready = false, playing = false, lastReq = -1;
var spBeat = 4;
var apiPlay = null, apiSig = null, apc = null, morphBucket = -1;
var GEN = GO.Generator.MODES, EVO = ['manual', 'auto', 'hybrid'], BARS = [1, 2, 4, 8], HLEN = [0.5, 1, 2];

function send(msgs) { var i; for (i = 0; i < msgs.length; i++) outlet(0, msgs[i]); }

function show(kind, text) { outlet(2, kind, String(text)); }

function status(text) {
  var p = params;
  show('status', text || ('GEN ' + org.generation + '  ' + p.gen.toUpperCase() + '  ' + p.evo.toUpperCase() +
       (p.frozen ? '  FROZEN' : '') + '  slots ' + slotsText() + '  captures ' + org.captures.length));
}

function slotsText() { var s = '', i; for (i = 0; i < 8; i++) s += org.hasSlot(i) ? (i + 1) : '-'; return s; }

function info() {
  var r = org.rules(), key = GO.Scales.KEYS[params.key];
  if (params.sysCat > 0) show('sys', r.cat + ' / ' + r.name + ' on ' + key + ' - ' + r.note + ' - ' + accompaniment(r));
  else show('sys', 'Western / ' + key + ' ' + r.name);
  var lib = org.progression();
  if (lib) show('harm', lib.name + ' (' + lib.mode.name + '): ' + lib.text + ' - ' + lib.logic);
  else if (org.libError) show('harm', 'Harmony Library: ' + org.libError);
  else show('harm', 'Harmony: ' + (r.harmony === 'chords' ? 'organism root progression in the mode' : 'no Western chords, ' + accompaniment(r)));
  if (params.lib === GO.Library.categoryNames().length - 1) {
    var u = org.userProgs[params.prog - 1];
    show('edit', u ? u.chords : '');
  }
}

function accompaniment(r) {
  return { chords: 'triads', drone: 'drone', ison: 'ison', organum: 'parallel organum', heterophony: 'heterophony' }[r.harmony] || r.harmony;
}

function save() {
  if (!ready) return;
  var s = encodeURIComponent(org.serialize()), chunks = ['set'], i;
  for (i = 0; i < s.length; i += 2000) chunks.push(s.substr(i, 2000));
  outlet(1, chunks);
}

function refresh() { player.micro = params.micro; player.load(org.pattern(), !playing); }

function onPlay(args) {
  if (!args || args[0] !== 'is_playing') return;
  var p = args[1] ? true : false;
  if (!p && playing) send(player.stop());
  playing = p;
}

function onSig() {
  if (!apiSig) return;
  var num = apiSig.get('signature_numerator'), den = apiSig.get('signature_denominator');
  num = num && num.length ? num[0] : 4; den = den && den.length ? den[0] : 4;
  var spb = Math.max(1, Math.round(num * 16 / den));
  spBeat = 16 / den;
  if (spb !== params.spb) { params.spb = spb; org.invalidate(); refresh(); }
}

function init() {
  try {
    apiPlay = new LiveAPI(onPlay, 'live_set');
    apiPlay.property = 'is_playing';
    var ip = apiPlay.get('is_playing');
    playing = ip && ip[0] ? true : false;
    apiSig = new LiveAPI(onSig, 'live_set');
    apiSig.property = 'signature_numerator';
    onSig();
  } catch (e) { post('GenerativeOrganism: Live API not available: ' + e + '\n'); }
  ready = true;
  org.ensure();
  refresh();
  save();
  status();
  info();
}

// Called on every 16th note from the scheduler thread.
function pos(bars, beats, units) {
  var spb = params.spb;
  var abs = (bars - 1) * spb + (beats - 1) * spBeat + Math.round(units / 120);
  send(player.tick(abs));
  if (params.evo !== 'manual' && !params.frozen) {
    var every = params.every * spb;
    if (U.mod(abs + 2, every) === 0 && abs !== lastReq) { lastReq = abs; outlet(3, 'evolve'); }
  }
}
pos.immediate = 1;

function evolve() {
  if (params.evo === 'manual' || params.frozen) return;
  if (org.mutate()) { refresh(); save(); }
  status();
}

function changed() { org.invalidate(); if (ready) { refresh(); status(); info(); } }

// a change of generator or tonal system grows a new organism
function regrow() { if (ready) { org.ensure(); refresh(); save(); status(); info(); } }

function param(name, value) {
  var v = Number(value);
  if (name === 'gen') {
    var g = GEN[U.clamp(v | 0, 0, GEN.length - 1)];
    if (g === params.gen) return;
    params.gen = g; regrow(); return;
  }
  if (name === 'syscat') { params.sysCat = U.clamp(v | 0, 0, GO.Systems.CATEGORIES.length - 1); regrow(); return; }
  if (name === 'sysvar') { params.sysVar = U.clamp(v | 0, 1, 12); regrow(); return; }
  if (name === 'key') params.key = U.clamp(v | 0, 0, 11);
  else if (name === 'scale') params.scale = U.clamp(v | 0, 0, GO.Scales.LIST.length - 1);
  else if (name === 'bars') params.bars = BARS[U.clamp(v | 0, 0, 3)];
  else if (name === 'density') params.density = U.clamp(v / 100, 0, 1);
  else if (name === 'lib') params.lib = U.clamp(v | 0, 0, GO.Library.categoryNames().length - 1);
  else if (name === 'prog') params.prog = U.clamp(v | 0, 1, 12);
  else if (name === 'hlen') params.hlen = HLEN[U.clamp(v | 0, 0, 2)];
  else if (name === 'micro') params.micro = v ? true : false;
  else if (name === 'free') params.free = v ? true : false;
  else if (name === 'evo') { params.evo = EVO[U.clamp(v | 0, 0, 2)]; if (ready) status(); return; }
  else if (name === 'every') { params.every = BARS[U.clamp(v | 0, 0, 3)]; return; }
  else if (name === 'freeze') { params.frozen = v ? true : false; if (ready) status(); return; }
  else if (name === 'amount' || name === 'prob' || name === 'stability' ||
           name === 'complexity' || name === 'variation') { params[name] = U.clamp(v / 100, 0, 1); return; }
  else if (name === 'apc') { hardware(v ? 1 : 0); return; }
  else { post('GenerativeOrganism: unknown param ' + name + '\n'); return; }
  changed();
}

function voice(i, name, value) {
  i = U.clamp(i | 0, 0, 3);
  var vp = params.voices[i], v = Number(value);
  if (name === 'on') {
    vp.on = v ? true : false;
    if (!vp.on) send(player.releaseChannel(vp.ch));
  } else if (name === 'ch') {
    var ch = U.clamp(v | 0, 1, 16);
    if (ch !== vp.ch) send(player.releaseChannel(vp.ch));
    vp.ch = ch;
  } else if (name === 'lo') vp.lo = U.clamp(v | 0, 0, 127);
  else if (name === 'hi') vp.hi = U.clamp(v | 0, 0, 127);
  else if (name === 'dens') vp.dens = U.clamp(v / 100, -0.5, 0.5);
  else if (name === 'mut') { vp.mut = U.clamp(v / 100, 0, 1); return; }
  else return;
  changed();
}

function doMutate(only) {
  if (params.evo === 'auto') { status('AUTO mode: switch to MANUAL or HYBRID to mutate by hand'); return; }
  if (params.frozen) { status('FROZEN: unfreeze to mutate'); return; }
  if (org.mutate(only)) { refresh(); save(); }
  status();
}

// live.text buttons send 1 on press (0 on release is ignored)
function btn(name, value) {
  if (value === 0 || !ready) return;
  if (name === 'mutate') { doMutate(); return; }
  if (name === 'revert') { if (org.revert()) { refresh(); save(); } else { status('Nothing to revert'); return; } }
  else if (name === 'reset') { org.reset(); refresh(); save(); }
  else if (name === 'capture') { capture(); return; }
  else if (name === 'export') { if (!org.captures.length) org.capture(); outlet(4, 'bang'); return; }
  status();
}

// ---- Harmony Library: user progressions --------------------------------

function custom() {
  var text = arrayfromargs(arguments).join(' ');
  var userCat = GO.Library.categoryNames().length - 1;
  try {
    var mode = params.sysCat === 0 ? GO.Scales.get(params.scale).id : 'ionian';
    org.setUserProg(params.prog, text, mode);
    if (params.lib !== userCat) setUI('Library', userCat);
    changed(); save();
    status('User progression ' + params.prog + ' stored');
  } catch (e) { show('harm', 'Cannot use "' + text + '": ' + (e.message || e)); }
}

// ---- CAPTURE ----------------------------------------------------------

function capture() {
  var cap = org.capture(), where = writeClip(cap);
  save();
  status(where >= 0 ? 'CAPTURE: clip "' + cap.name + '" in slot ' + (where + 1) : 'CAPTURE stored (' + org.captures.length + '); use EXPORT for a .mid file');
}

function writeClip(cap) {
  try {
    var track = new LiveAPI('this_device canonical_parent');
    var tp = track.unquotedpath, n = track.getcount('clip_slots'), slot = -1, i;
    for (i = 0; i < n; i++) {
      var cs = new LiveAPI(tp + ' clip_slots ' + i), has = cs.get('has_clip');
      if (!(has && has[0])) { slot = i; break; }
    }
    if (slot < 0) { new LiveAPI('live_set').call('create_scene', -1); slot = n; }
    new LiveAPI(tp + ' clip_slots ' + slot).call('create_clip', cap.beats);
    var clip = new LiveAPI(tp + ' clip_slots ' + slot + ' clip');
    clip.set('name', cap.name);
    var notes = GO.Capture.clipNotes(cap);
    try { clip.call('add_new_notes', { notes: notes }); }
    catch (e) {                                   // older note API
      clip.call('set_notes');
      clip.call('notes', notes.length);
      for (i = 0; i < notes.length; i++) clip.call('note', notes[i].pitch, notes[i].start_time.toFixed(4), notes[i].duration.toFixed(4), notes[i].velocity, 0);
      clip.call('done');
    }
    return slot;
  } catch (err) { post('GenerativeOrganism: clip not written: ' + err + '\n'); return -1; }
}

function exportmidi(path) {
  var cap = org.captures[org.captures.length - 1];
  if (!cap || !path) return;
  try {
    var tempo = 120;
    try { tempo = new LiveAPI('live_set').get('tempo')[0] || 120; } catch (e) { }
    var bytes = GO.Capture.smf(cap, tempo);
    var f = new File(String(path), 'write', 'Midi');
    if (!f.isopen) throw new Error('cannot open file');
    f.writebytes(bytes);
    f.eof = f.position;
    f.close();
    status('Exported ' + cap.name + ' (' + cap.notes.length + ' notes)');
  } catch (e) { status('EXPORT failed: ' + e); }
}

// ---- hardware: APC40 MK2 -----------------------------------------------

function setUI(name, value) {
  try {
    var o = self.patcher.getnamed(name);
    if (o) o.message('float', value);
  } catch (e) { }
}

var RANGES = {
  'Mutation Amount': [0, 100], 'Mutation Probability': [0, 100], 'Stability': [0, 100], 'Complexity': [0, 100],
  'Variation': [0, 100], 'Density': [0, 100], 'Speed': [0, 3], 'Evolution': [0, 2], 'Key': [0, 11],
  'Scale': [0, GO.Scales.LIST.length - 1], 'System': [0, GO.Systems.CATEGORIES.length - 1], 'Variant': [1, 12],
  'Library': [0, GO.Library.categoryNames().length - 1], 'Progression': [1, 12], 'Harmony Length': [0, 2], 'Length': [0, 3],
  'V1 Density': [-50, 50], 'V2 Density': [-50, 50], 'V3 Density': [-50, 50], 'V4 Density': [-50, 50],
  'V1 Mutation': [0, 100], 'V2 Mutation': [0, 100], 'V3 Mutation': [0, 100], 'V4 Mutation': [0, 100]
};

function scaled(name, v) {
  var r = RANGES[name] || [0, 127], x = r[0] + (v / 127) * (r[1] - r[0]);
  return (r[1] - r[0] <= 12) ? Math.round(x) : x;
}

function onControl(kind, index, value) {
  var map = GO.APC.MAP;
  if (kind === 'fader' || kind === 'deviceKnob' || kind === 'trackKnob') {
    var name = map[kind][index];
    if (name) setUI(name, scaled(name, value));
    return;
  }
  if (kind === 'crossfader') { morph(value / 127); return; }
  if (value === 0) return;                                   // buttons act on press
  if (kind === 'scene') { action(map.scene[index], 0); return; }
  if (kind === 'grid') action(map.grid[index.r][index.c], index.c);
}

function action(what, c) {
  if (what === 'mutate') doMutate();
  else if (what === 'freeze') setUI('Freeze', params.frozen ? 0 : 1);
  else if (what === 'revert') btn('revert', 1);
  else if (what === 'reset') btn('reset', 1);
  else if (what === 'capture') capture();
  else if (what === 'slot') {
    if (org.hasSlot(c)) { org.recallSlot(c); refresh(); save(); } else { org.storeSlot(c); save(); }
    leds(); status();
  } else if (what === 'store') { org.storeSlot(c); save(); leds(); status(); }
  else if (what === 'gen') setUI('Generator', c);
  else if (what === 'evo') setUI('Evolution', c - 4);
  else if (what === 'voice') setUI('Voice ' + (c + 1), params.voices[c].on ? 0 : 1);
  else if (what === 'lock') setUI('V' + (c - 3) + ' Mutation', params.voices[c - 4].mut > 0 ? 0 : 100);
  else if (what === 'mutatevoice') doMutate(c);
}

function morph(x) {
  var bucket = Math.min(4, Math.floor(x * 4 + 0.5));
  if (bucket === morphBucket) return;
  morphBucket = bucket;
  if (org.morph(x)) { refresh(); status('MORPH slot 1 -> 2: ' + bucket + '/4 voices from slot 2'); }
}

function leds() {
  var i;
  if (!apc) return;
  for (i = 0; i < 8; i++) apc.led(i, 0, org.hasSlot(i) ? GO.APC.LED.stored : GO.APC.LED.off);
}

function loadMap() {
  try {
    var f = new File('hardware_map.json', 'read');
    if (!f.isopen) return;
    var text = f.readstring(f.eof);
    f.close();
    var m = JSON.parse(text), k;
    for (k in m) {
      if (k === 'patterns') { var j; for (j in m.patterns) GO.APC.PATTERNS[j] = m.patterns[j]; }
      else GO.APC.MAP[k] = m[k];
    }
    post('GenerativeOrganism: hardware_map.json loaded\n');
  } catch (e) { post('GenerativeOrganism: hardware_map.json ignored: ' + e + '\n'); }
}

function hardware(on) {
  if (apc) { apc.release(); apc = null; }
  if (!on) { if (ready) status('APC40 released'); return; }
  if (!ready) return;
  loadMap();
  try {
    apc = new GO.APC.Surface({ LiveAPI: LiveAPI, onControl: onControl });
    var r = apc.connect();
    if (!r.ok) { apc = null; status(r.msg); return; }
    post('GenerativeOrganism: APC40 controls: ' + r.names.join(' ') + '\n');
    leds();
    status(r.msg);
  } catch (e) { apc = null; status('APC40: ' + e); }
}

// ---- state -------------------------------------------------------------

function restore() {
  var s = arrayfromargs(arguments).join('');
  try {
    if (org.restore(decodeURIComponent(s))) {
      if (ready) { refresh(); status(); info(); }
    }
  } catch (e) { post('GenerativeOrganism: could not restore state: ' + e + '\n'); }
}

function panic() {
  send(player.allOff());
  var ch;
  for (ch = 0; ch < 16; ch++) outlet(0, [0xB0 | ch, 123, 0]);
}

function notifydeleted() { send(player.allOff()); if (apc) apc.release(); }
