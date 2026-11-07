// apc40.js: APC40 MK2 integration through the Live Object Model.
//
// With APC40 switched on in the device, the APC40 MK2 control surface script
// is found among Live's control surfaces, the controls listed below are taken
// over with grab_control (the script gets them back on release), and their
// values are observed. Nothing is sent to the controller except LED values for
// the variation slots. Live's own MIDI mapping keeps working for everything.
//
// The assignment is a table (MAP); a file hardware_map.json next to the
// device can replace any part of it (see README). Control names are matched
// with regular expressions (PATTERNS), so other scripts' naming can be
// covered by editing the same file.
//
// Default layout:
//   faders 1-8         Mutation Amount, Probability, Stability, Complexity,
//                      Variation, Density, Speed, Evolution
//   device knobs 1-8   V1-V4 Density, V1-V4 Mutation
//   track knobs 1-8    Key, Scale, System, Variant, Library, Progression,
//                      Harmony Length, Length
//   scene buttons 1-5  MUTATE, FREEZE, REVERT, RESET DNA, CAPTURE
//   grid row 1         variation slots 1-8 (press: recall, or store if empty)
//   grid row 2         store current DNA into slot 1-8
//   grid row 3         generator 1-4, evolution MANUAL/AUTO/HYBRID, FREEZE
//   grid row 4         voices 1-4 on/off, voices 1-4 lock (Mutation 0/100%)
//   grid row 5         mutate voice 1-4 alone, MUTATE, REVERT, RESET, CAPTURE
//   crossfader         morph from slot 1 (A) to slot 2 (B), voice by voice

GO.APC = (function () {
  var MAP = {
    fader: ['Mutation Amount', 'Mutation Probability', 'Stability', 'Complexity', 'Variation', 'Density', 'Speed', 'Evolution'],
    deviceKnob: ['V1 Density', 'V2 Density', 'V3 Density', 'V4 Density', 'V1 Mutation', 'V2 Mutation', 'V3 Mutation', 'V4 Mutation'],
    trackKnob: ['Key', 'Scale', 'System', 'Variant', 'Library', 'Progression', 'Harmony Length', 'Length'],
    scene: ['mutate', 'freeze', 'revert', 'reset', 'capture'],
    grid: [
      ['slot', 'slot', 'slot', 'slot', 'slot', 'slot', 'slot', 'slot'],
      ['store', 'store', 'store', 'store', 'store', 'store', 'store', 'store'],
      ['gen', 'gen', 'gen', 'gen', 'evo', 'evo', 'evo', 'freeze'],
      ['voice', 'voice', 'voice', 'voice', 'lock', 'lock', 'lock', 'lock'],
      ['mutatevoice', 'mutatevoice', 'mutatevoice', 'mutatevoice', 'mutate', 'revert', 'reset', 'capture']
    ]
  };
  var PATTERNS = {
    fader: ['^(\\d+)_Volume$', '^Track_Volume_(\\d+)$', '^Volume_Slider_(\\d+)$', '^Fader_(\\d+)$'],
    deviceKnob: ['^Device_Control_(\\d+)$', '^Device_Knob_(\\d+)$', '^Device_Encoder_(\\d+)$'],
    trackKnob: ['^Track_Control_(\\d+)$', '^Track_Knob_(\\d+)$', '^Pan_Knob_(\\d+)$'],
    scene: ['^Scene_(\\d+)_Launch_Button$', '^(\\d+)_Scene_Launch_Button$', '^Scene_Launch_Button_(\\d+)$'],
    grid: ['^(\\d+)_Clip_(\\d+)_Button$', '^Clip_Launch_Button_(\\d+)_(\\d+)$'],
    crossfader: ['^Crossfader$', '^Cross_Fader$']
  };
  var LED = { off: 0, stored: 21, active: 5 };

  // names -> { fader: [name by index], ..., grid: { 'col,row': name }, crossfader: name }
  function classify(names, patterns) {
    var out = { fader: [], deviceKnob: [], trackKnob: [], scene: [], grid: {}, crossfader: null };
    var raw = { fader: [], deviceKnob: [], trackKnob: [], scene: [], grid: [] }, i, k;
    function match(nm) {
      var kk, jj;
      for (kk in patterns) for (jj = 0; jj < patterns[kk].length; jj++) {
        var m = new RegExp(patterns[kk][jj]).exec(nm);
        if (m) return { kind: kk, m: m };
      }
      return null;
    }
    for (i = 0; i < names.length; i++) {
      var nm = String(names[i]), hit = match(nm);
      if (!hit) continue;
      if (hit.kind === 'crossfader') out.crossfader = nm;
      else if (hit.kind === 'grid') raw.grid.push({ c: +hit.m[1], r: +hit.m[2], name: nm });
      else raw[hit.kind].push({ i: +hit.m[1], name: nm });
    }
    for (k in raw) {
      if (k === 'grid') continue;
      var minI = 1e9;
      for (i = 0; i < raw[k].length; i++) minI = Math.min(minI, raw[k][i].i);
      for (i = 0; i < raw[k].length; i++) out[k][raw[k][i].i - minI] = raw[k][i].name;
    }
    var minC = 1e9, minR = 1e9;
    for (i = 0; i < raw.grid.length; i++) { minC = Math.min(minC, raw.grid[i].c); minR = Math.min(minR, raw.grid[i].r); }
    for (i = 0; i < raw.grid.length; i++) out.grid[(raw.grid[i].c - minC) + ',' + (raw.grid[i].r - minR)] = raw.grid[i].name;
    return out;
  }

  // env: { LiveAPI, onControl(kind, index, value) with index a number or {c, r}, log }
  function Surface(env, map, patterns) {
    this.env = env; this.map = map || MAP; this.patterns = patterns || PATTERNS;
    this.api = null; this.ids = []; this.gridIds = {}; this.observers = [];
  }

  function idOf(res) {
    if (!res) return 0;
    if (res.length >= 2 && res[0] === 'id') return +res[1];
    if (typeof res === 'number') return res;
    return +res[res.length - 1] || 0;
  }

  Surface.prototype.find = function () {
    var i;
    for (i = 0; i < 8; i++) {
      var a = new this.env.LiveAPI(null, 'control_surfaces ' + i);
      if (!a || !a.id || +a.id === 0) continue;
      var desc = String(a.type) + ' ' + String(a.info || '');
      if (/APC40/i.test(desc)) return a;
    }
    return null;
  };

  Surface.prototype.connect = function () {
    var api = this.find(), self = this, found = 0, k, i;
    if (!api) return { ok: false, msg: 'APC40 MK2 not found among Live control surfaces' };
    this.api = api;
    var names = api.call('get_control_names') || [];
    var cls = classify(names, this.patterns);
    function grab(name, kind, index) {
      var id = idOf(api.call('get_control', name));
      if (!id) return 0;
      api.call('grab_control', 'id', id);
      self.ids.push(id);
      var obs = new self.env.LiveAPI(function (args) {
        if (args && args[0] === 'value') self.env.onControl(kind, index, +args[1]);
      }, 'id ' + id);
      obs.property = 'value';
      self.observers.push(obs);
      found++;
      return id;
    }
    var kinds = ['fader', 'deviceKnob', 'trackKnob', 'scene'];
    for (k = 0; k < kinds.length; k++) {
      var list = cls[kinds[k]], want = this.map[kinds[k]] || [];
      for (i = 0; i < list.length && i < want.length; i++) if (list[i]) grab(list[i], kinds[k], i);
    }
    for (k in cls.grid) {
      var cr = k.split(','), c = +cr[0], r = +cr[1];
      if (this.map.grid[r] && this.map.grid[r][c]) this.gridIds[k] = grab(cls.grid[k], 'grid', { c: c, r: r });
    }
    if (cls.crossfader) grab(cls.crossfader, 'crossfader', 0);
    return { ok: found > 0, msg: 'APC40 MK2: ' + found + ' controls taken over', count: found, names: names };
  };

  Surface.prototype.led = function (c, r, value) {
    var id = this.gridIds[c + ',' + r];
    if (!id) return;
    try { new this.env.LiveAPI(null, 'id ' + id).call('send_value', value); } catch (e) { }
  };

  Surface.prototype.release = function () {
    var i;
    for (i = 0; i < this.observers.length; i++) this.observers[i].property = '';
    if (this.api) for (i = 0; i < this.ids.length; i++) { try { this.api.call('release_control', 'id', this.ids[i]); } catch (e) { } }
    this.ids = []; this.gridIds = {}; this.observers = []; this.api = null;
  };

  return { MAP: MAP, PATTERNS: PATTERNS, LED: LED, classify: classify, Surface: Surface };
})();
