#!/usr/bin/env node
// Builds:
//   dist/organism_core.js           engine for Node tests and tools
//   device/organism.js              engine + Max glue for the [js] object
//   device/GenerativeOrganism.maxpat  the device patcher (open/paste in Max)
//   device/GenerativeOrganism.amxd    Max MIDI Effect for Ableton Live
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE = [
  'src/engine/util.js',
  'src/harmony/scale_library.js',
  'src/harmony/harmonic_engine.js',
  'src/engine/roles.js',
  'src/engine/melodic.js',
  'src/engine/rhythmic.js',
  'src/engine/generator.js',
  'src/evolution/similarity.js',
  'src/evolution/evolution.js',
  'src/midi/midi_engine.js',
  'src/midi/smf.js'
];
const VERSION = '0.1.0';

function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

function bundle(files, header, footer) {
  return header + files.map(f => '// ---- ' + f + ' ----\n' + read(f)).join('\n') + footer;
}

// ---------------------------------------------------------------- patcher --
const boxes = [];
const lines = [];
let nextId = 1;

function box(maxclass, rect, extra) {
  const id = 'obj-' + nextId++;
  boxes.push({ box: Object.assign({ id, maxclass, patching_rect: rect }, extra) });
  return id;
}
function obj(text, x, y, ins, outs, outlettype, extra) {
  return box('newobj', [x, y, Math.max(40, text.length * 6.5 + 10), 22],
    Object.assign({ text, numinlets: ins, numoutlets: outs, outlettype: outlettype || new Array(outs).fill('') }, extra));
}
function msg(text, x, y) {
  return box('message', [x, y, Math.max(30, text.length * 7 + 12), 22],
    { text, numinlets: 2, numoutlets: 1, outlettype: [''] });
}
function wire(a, ao, b, bi) { lines.push({ patchline: { source: [a, ao], destination: [b, bi] } }); }
function comment(text, prect, extra) {
  return box('comment', [prect[0] + 900, prect[1] + 600, prect[2], prect[3]],
    Object.assign({ text, numinlets: 1, numoutlets: 0, presentation: 1, presentation_rect: prect,
      fontsize: 9.5, textcolor: [0.6, 0.6, 0.6, 1] }, extra));
}

// Live parameter objects
let px = 20, py = 420;
function nextPatchPos(w) {
  const r = [px, py];
  px += Math.max(w, 60) + 20;
  if (px > 1100) { px = 20; py += 70; }
  return r;
}
function liveParam(maxclass, name, short, prect, valueof, extra, io) {
  const p = nextPatchPos(prect[2]);
  return box(maxclass, [p[0], p[1], prect[2], prect[3]], Object.assign({
    parameter_enable: 1, presentation: 1, presentation_rect: prect, varname: name,
    numinlets: io[0], numoutlets: io[1], outlettype: io[2],
    saved_attribute_attributes: { valueof: Object.assign({
      parameter_longname: name, parameter_shortname: short }, valueof) }
  }, extra || {}));
}
const IO = {
  dial: [1, 2, ['', 'float']],
  tab: [1, 3, ['', '', 'float']],
  menu: [1, 3, ['', '', 'float']],
  text: [1, 2, ['', '']],
  numbox: [1, 2, ['', 'float']]
};
function dial(name, short, prect, init, min, max, unit) {
  return liveParam('live.dial', name, short, prect, {
    parameter_type: 0, parameter_mmin: min, parameter_mmax: max, parameter_initial_enable: 1,
    parameter_initial: [init], parameter_unitstyle: unit
  }, { showname: 1, shownumber: 1 }, IO.dial);
}
function tab(name, short, prect, items, init, rows) {
  return liveParam('live.tab', name, short, prect, {
    parameter_type: 2, parameter_enum: items, parameter_mmax: items.length - 1,
    parameter_initial_enable: 1, parameter_initial: [init], parameter_unitstyle: 9
  }, { num_lines_patching: rows || 1, num_lines_presentation: rows || 1 }, IO.tab);
}
function menu(name, short, prect, items, init) {
  return liveParam('live.menu', name, short, prect, {
    parameter_type: 2, parameter_enum: items, parameter_mmax: items.length - 1,
    parameter_initial_enable: 1, parameter_initial: [init]
  }, {}, IO.menu);
}
function text(name, short, prect, label, toggle, init) {
  return liveParam('live.text', name, short, prect, {
    parameter_type: 2, parameter_enum: ['off', 'on'], parameter_mmax: 1,
    parameter_initial_enable: toggle ? 1 : 0, parameter_initial: [init || 0]
  }, { text: label, texton: label, mode: toggle ? 1 : 0 }, IO.text);
}
function numbox(name, short, prect, init, min, max, unit) {
  return liveParam('live.numbox', name, short, prect, {
    parameter_type: 1, parameter_mmin: min, parameter_mmax: max, parameter_initial_enable: 1,
    parameter_initial: [init], parameter_unitstyle: unit
  }, {}, IO.numbox);
}

function buildPatcher() {
  // ---- engine and timing
  const js = obj('js organism.js', 40, 300, 1, 4, ['', '', '', '']);
  const thisdev = obj('live.thisdevice', 40, 20, 1, 3, ['bang', 'int', 'int']);
  const initMsg = msg('init', 40, 60);
  wire(thisdev, 0, initMsg, 0);
  wire(initMsg, 0, js, 0);

  const metro = obj('metro 16n @quantize 16n @active 1', 200, 20, 2, 1, ['bang']);
  const transport = obj('transport', 200, 60, 2, 9, ['int', 'int', 'float', 'float', 'float', '', 'int', 'float', '']);
  const pack = obj('pack 0 0 0.', 200, 100, 3, 1, ['']);
  const prePos = obj('prepend pos', 200, 140, 1, 1, ['']);
  wire(metro, 0, transport, 0);
  wire(transport, 0, pack, 0);
  wire(transport, 1, pack, 1);
  wire(transport, 2, pack, 2);
  wire(pack, 0, prePos, 0);
  wire(prePos, 0, js, 0);

  // ---- MIDI: input passes through, generated notes are added
  const midiin = obj('midiin', 420, 20, 1, 1, ['int']);
  const midiout = obj('midiout', 420, 400, 1, 0, []);
  const iter = obj('iter', 420, 360, 1, 1, ['']);
  wire(midiin, 0, midiout, 0);
  wire(js, 0, iter, 0);
  wire(iter, 0, midiout, 0);

  // ---- persistence: DNA is stored with the Live Set in a hidden blob parameter
  const pattr = box('newobj', [520, 370, 120, 22], {
    text: 'pattr gostate @parameter_enable 1', numinlets: 1, numoutlets: 3, outlettype: ['', '', ''],
    parameter_enable: 1, varname: 'gostate',
    saved_attribute_attributes: { valueof: { parameter_longname: 'GO DNA State', parameter_shortname: 'DNA',
      parameter_type: 3, parameter_invisible: 1, parameter_initial_enable: 0 } }
  });
  const preRestore = obj('prepend restore', 520, 400, 1, 1, ['']);
  // js emits "set <chunks>"; a list starting with "set" sets pattr silently
  wire(js, 1, pattr, 0);
  wire(pattr, 0, preRestore, 0);
  wire(preRestore, 0, js, 0);

  // ---- self messages (AUTO evolution leaves the scheduler thread here)
  const defer = obj('deferlow', 300, 340, 1, 1, ['']);
  wire(js, 3, defer, 0);
  wire(defer, 0, js, 0);

  // ---- status line
  const status = box('comment', [700, 360, 400, 20], {
    text: 'GENERATIVE ORGANISM', numinlets: 1, numoutlets: 0, presentation: 1,
    presentation_rect: [6, 150, 500, 16], fontsize: 9.5, varname: 'status'
  });
  wire(js, 2, status, 0);   // js sends "set <text>"

  // ---- UI
  function toJs(id, prefix) {
    const p = obj('prepend ' + prefix, 0, 0, 1, 1, ['']);
    const b = boxes.find(x => x.box.id === id).box;
    boxes.find(x => x.box.id === p).box.patching_rect = [b.patching_rect[0], b.patching_rect[1] + 50, 110, 22];
    wire(id, 0, p, 0);
    wire(p, 0, js, 0);
  }

  comment('GENERATIVE ORGANISM', [6, 2, 200, 16], { fontsize: 10.5, fontface: 1, textcolor: [0.85, 0.85, 0.85, 1] });
  comment('GENERATOR', [6, 20, 96, 14]);
  comment('HARMONIC FOUNDATION', [112, 20, 130, 14]);
  comment('EVOLUTION', [252, 20, 120, 14]);
  comment('VOICES', [506, 20, 60, 14]);

  toJs(tab('Generator', 'Gen', [6, 34, 96, 34], ['MELODIC', 'RHYTHMIC'], 0, 2), 'param gen');

  comment('Key', [112, 34, 34, 14]);
  toJs(menu('Key', 'Key', [150, 34, 92, 15], GO.Scales.KEYS, 0), 'param key');
  comment('Mode', [112, 52, 34, 14]);
  toJs(menu('Scale', 'Scale', [150, 52, 92, 15], GO.Scales.names(), 1), 'param scale');
  comment('Bars', [112, 70, 34, 14]);
  toJs(tab('Length', 'Bars', [150, 70, 92, 15], ['1', '2', '4', '8'], 1), 'param bars');
  toJs(dial('Density', 'Density', [150, 92, 44, 48], 75, 0, 100, 5), 'param density');

  toJs(tab('Evolution', 'Evo', [252, 34, 150, 15], ['MANUAL', 'AUTO', 'HYBRID'], 0), 'param evo');
  comment('Every', [252, 52, 40, 14]);
  toJs(tab('Speed', 'Every', [292, 52, 110, 15], ['1 bar', '2', '4', '8'], 1), 'param every');
  const dials = [['Mutation Amount', 'Amount', 'amount'], ['Mutation Probability', 'Prob', 'prob'],
    ['Stability', 'Stability', 'stability'], ['Complexity', 'Complex', 'complexity'], ['Variation', 'Variation', 'variation']];
  dials.forEach((d, i) => toJs(dial(d[0], d[1], [252 + i * 50, 92, 46, 48], 50, 0, 100, 5), 'param ' + d[2]));

  // voices
  const cols = [['Ch', 566], ['Low', 600], ['High', 642], ['Dens', 684], ['Mut', 724]];
  cols.forEach(c => comment(c[0], [c[1], 34, 40, 14]));
  for (let i = 0; i < 4; i++) {
    const y = 50 + i * 20, r = GO.Roles[i], n = i + 1;
    toJs(text('Voice ' + n, 'V' + n, [506, y, 56, 16], n + ' ' + r.name, true, 1), 'voice ' + i + ' on');
    toJs(numbox('V' + n + ' Channel', 'Ch' + n, [566, y, 30, 16], n, 1, 16, 0), 'voice ' + i + ' ch');
    toJs(numbox('V' + n + ' Low', 'Lo' + n, [600, y, 38, 16], r.lo, 0, 127, 8), 'voice ' + i + ' lo');
    toJs(numbox('V' + n + ' High', 'Hi' + n, [642, y, 38, 16], r.hi, 0, 127, 8), 'voice ' + i + ' hi');
    toJs(numbox('V' + n + ' Density', 'Dn' + n, [684, y, 36, 16], 0, -50, 50, 5), 'voice ' + i + ' dens');
    toJs(numbox('V' + n + ' Mutation', 'Mu' + n, [724, y, 36, 16], 100, 0, 100, 5), 'voice ' + i + ' mut');
  }

  toJs(text('Mutate', 'Mutate', [770, 34, 74, 20], 'MUTATE', false), 'btn mutate');
  toJs(text('Freeze', 'Freeze', [770, 58, 74, 20], 'FREEZE', true, 0), 'param freeze');
  toJs(text('Revert', 'Revert', [770, 82, 74, 20], 'REVERT', false), 'btn revert');
  toJs(text('Reset DNA', 'Reset', [770, 106, 74, 20], 'RESET DNA', false), 'btn reset');

  return {
    patcher: {
      fileversion: 1,
      appversion: { major: 8, minor: 6, revision: 0, architecture: 'x64', modernui: 1 },
      classnamespace: 'box',
      rect: [100, 100, 1240, 760],
      openinpresentation: 1,
      default_fontsize: 10.0,
      default_fontname: 'Arial Bold',
      gridsize: [8, 8],
      boxes,
      lines,
      dependency_cache: [{ name: 'organism.js', bootpath: '.', type: 'TEXT', implicit: 1 }],
      latency: 0,
      is_mpe: 0,
      minimum_live_version: '',
      minimum_max_version: '',
      platform_compatibility: 0,
      project: { version: 1, creationdate: 3590052493, modificationdate: 3590052493,
                 viewrect: [0, 0, 300, 500], autoorganize: 1, hideprojectwindow: 1, showdependencies: 1,
                 autolocalize: 0, contents: { patchers: {}, code: {} }, layout: {}, searchpath: {},
                 detailsvisible: 0, amxdtype: 1835887981, readonly: 0, devpathtype: 0, devpath: '.',
                 sortmode: 0, viewmode: 0, includepackages: 0 },
      autosave: 0
    }
  };
}

// .amxd container: "ampf" header, device type "mmmm" (MIDI effect), meta, then the patcher JSON
function amxd(json) {
  const body = Buffer.from(json + '\n\0', 'utf8');
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
  return Buffer.concat([
    Buffer.from('ampf'), u32(4), Buffer.from('mmmm'),
    Buffer.from('meta'), u32(4), u32(0),
    Buffer.from('ptch'), u32(body.length), body
  ]);
}

function main() {
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'device'), { recursive: true });
  const header = '// Generative Organism ' + VERSION + ', generated by build/build.js; edit src/ instead.\nvar GO = {};\n';
  const core = bundle(CORE, header, '\nif (typeof module !== "undefined") module.exports = GO;\n');
  fs.writeFileSync(path.join(ROOT, 'dist/organism_core.js'), core);
  fs.writeFileSync(path.join(ROOT, 'device/organism.js'), bundle(CORE.concat(['src/max/main.js']), header, ''));

  global.GO = require(path.join(ROOT, 'dist/organism_core.js'));
  const patcher = buildPatcher();
  const json = JSON.stringify(patcher, null, '\t');
  fs.writeFileSync(path.join(ROOT, 'device/GenerativeOrganism.maxpat'), json);
  fs.writeFileSync(path.join(ROOT, 'device/GenerativeOrganism.amxd'), amxd(json));
  console.log('built: dist/organism_core.js, device/organism.js, device/GenerativeOrganism.maxpat, device/GenerativeOrganism.amxd');
  console.log('boxes:', boxes.length, 'lines:', lines.length);
}

if (require.main === module) main();
module.exports = { main };
