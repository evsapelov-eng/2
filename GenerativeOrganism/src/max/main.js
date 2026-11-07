// main.js: glue between the Max patch and the engine (Max [js] only).
//
// inlet 0 messages:
//   pos <bars> <beats> <units>  from [metro 16n] -> [transport]; high priority
//   init                         from [live.thisdevice]; Live API ready
//   param <name> <value>         device controls
//   voice <index> <name> <value> per-voice controls
//   btn <name> [value]           MUTATE / REVERT / RESET buttons
//   restore <chunks...>          saved state from the hidden [pattr]
//   evolve                       AUTO evolution request (comes back via [deferlow])
//   panic                        all notes off
// outlets: 0 MIDI bytes [status d1 d2] -> [iter] -> [midiout]
//          1 state for [pattr] ("set <chunks>")
//          2 status text (-> [prepend set] -> comment)
//          3 self messages (-> [deferlow] -> inlet)

inlets = 1;
outlets = 4;
autowatch = 0;

var U = GO.util;
var params = GO.Organism.defaultParams();
var org = new GO.Organism.Organism(params, (new Date().getTime() % 2147483646) + 1);
var player = new GO.Player();
var ready = false, playing = false, lastReq = -1;
var spBeat = 4;
var apiPlay = null, apiSig = null;
var GEN = GO.Generator.MODES, EVO = ['manual', 'auto', 'hybrid'], BARS = [1, 2, 4, 8];

function send(msgs) { var i; for (i = 0; i < msgs.length; i++) outlet(0, msgs[i]); }

function status(text) {
  var p = params;
  var s = text || ('GEN ' + org.generation + '  ' + p.gen.toUpperCase() + '  ' +
          GO.Scales.KEYS[p.key] + ' ' + GO.Scales.get(p.scale).name + '  ' + p.evo.toUpperCase() +
          (p.frozen ? '  FROZEN' : ''));
  outlet(2, 'set', s);
}

function save() {
  if (!ready) return;
  var s = encodeURIComponent(org.serialize()), chunks = ['set'], i;
  for (i = 0; i < s.length; i += 2000) chunks.push(s.substr(i, 2000));
  outlet(1, chunks);
}

// hand the current material to the MIDI engine; while playing it changes on the next bar
function refresh() { player.load(org.pattern(), !playing); }

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
}

// Called on every 16th note from the scheduler thread.
function pos(bars, beats, units) {
  var spb = params.spb;
  var abs = (bars - 1) * spb + (beats - 1) * spBeat + Math.round(units / 120);
  send(player.tick(abs));
  if (params.evo !== 'manual' && !params.frozen) {
    var every = params.every * spb;
    // ask for the next generation two 16ths early so it is ready on the boundary
    if (U.mod(abs + 2, every) === 0 && abs !== lastReq) { lastReq = abs; outlet(3, 'evolve'); }
  }
}
pos.immediate = 1;

function evolve() {
  if (params.evo === 'manual' || params.frozen) return;
  if (org.mutate()) { refresh(); save(); }
  status();
}

function changed() { org.invalidate(); if (ready) { refresh(); status(); } }

function param(name, value) {
  var v = Number(value);
  if (name === 'gen') {
    var g = GEN[U.clamp(v | 0, 0, GEN.length - 1)];
    if (g === params.gen) return;
    params.gen = g;
    if (ready) { org.reset(); refresh(); save(); status(); }
    return;
  }
  if (name === 'key') params.key = U.clamp(v | 0, 0, 11);
  else if (name === 'scale') params.scale = U.clamp(v | 0, 0, GO.Scales.LIST.length - 1);
  else if (name === 'bars') params.bars = BARS[U.clamp(v | 0, 0, 3)];
  else if (name === 'density') params.density = U.clamp(v / 100, 0, 1);
  else if (name === 'evo') { params.evo = EVO[U.clamp(v | 0, 0, 2)]; if (ready) status(); return; }
  else if (name === 'every') { params.every = BARS[U.clamp(v | 0, 0, 3)]; return; }
  else if (name === 'freeze') { params.frozen = v ? true : false; if (ready) status(); return; }
  else if (name === 'amount' || name === 'prob' || name === 'stability' ||
           name === 'complexity' || name === 'variation') { params[name] = U.clamp(v / 100, 0, 1); return; }
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

// live.text buttons send 1 on press (0 on release is ignored)
function btn(name, value) {
  if (value === 0) return;
  if (!ready) return;
  if (name === 'mutate') {
    if (params.evo === 'auto') { status('AUTO mode: switch to MANUAL or HYBRID to mutate by hand'); return; }
    if (params.frozen) { status('FROZEN: unfreeze to mutate'); return; }
    if (org.mutate()) { refresh(); save(); }
  } else if (name === 'revert') {
    if (org.revert()) { refresh(); save(); } else { status('Nothing to revert'); return; }
  } else if (name === 'reset') {
    org.reset(); refresh(); save();
  }
  status();
}

function restore() {
  var s = arrayfromargs(arguments).join('');
  try {
    if (org.restore(decodeURIComponent(s))) {
      if (ready) { refresh(); status(); }
    }
  } catch (e) { post('GenerativeOrganism: could not restore state: ' + e + '\n'); }
}

function panic() {
  send(player.allOff());
  var ch;
  for (ch = 0; ch < 16; ch++) outlet(0, [0xB0 | ch, 123, 0]);
}

function notifydeleted() { send(player.allOff()); }
