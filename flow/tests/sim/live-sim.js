'use strict';
// Deterministic simulator of the parts of Ableton Live + Max [js] that the FLOW
// spike touches. It exists to test FLOW's own logic (scheduling, detection,
// classification). It is NOT a model of verified Live behaviour: the switches
// below (seekQuantized, lateLoopJumpsBack, setLatency, observer rate) are the very
// unknowns that the M0 spike must measure on real hardware.

const fs = require('fs');
const vm = require('vm');

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

class LiveSim {
  constructor(opts = {}) {
    this.t = 1000;
    this.tempo = opts.tempo || 120;
    this.num = opts.num || 4;
    this.den = opts.den || 4;
    this.pos = opts.pos || 0;
    this.playing = opts.playing ? 1 : 0;
    this.loop = 0;
    this.loopStart = 0;
    this.loopLength = 16;
    this.b2a = 0;
    this.quant = 4; // 1 bar
    this.cues = opts.cues || [{ name: 'INTRO', time: 0 }, { name: 'GROOVE', time: 32 }];
    this.obsInterval = opts.obsInterval ?? 50;
    this.obsJitter = opts.obsJitter ?? 10;
    this.setLatency = opts.setLatency ?? 3;
    this.taskJitter = opts.taskJitter ?? 2;
    this.seekQuantized = !!opts.seekQuantized;
    this.lateLoopJumpsBack = !!opts.lateLoopJumpsBack;
    this.random = rng(opts.seed || 7);
    this.observers = [];
    this.tasks = [];
    this.pending = [];
    this.pendingJump = null;
    this.inCallback = false;
    this.loaded = false;
    this.posts = [];
    this.outlets = [];
    this.violations = [];
    this.nextObsT = this.t;
    this.lastNotifiedPos = null;
    this.wraps = 0;
    this.files = {};
    this.globals = {};
    this.songLength = opts.songLength ?? 400;
    this.filePath = opts.filePath ?? '/Users/test/Music/FLOW Test Project/FLOW Test.als';
    this.dropWrites = new Set(opts.dropWrites || []); // props whose writes Live "ignores"
    this.calls = [];
    this.setLog = [];
  }

  bpb() { return this.num * 4 / this.den; }

  // ---- property model
  getProp(path, prop) {
    const cue = /^live_set cue_points (\d+)$/.exec(path);
    if (cue) {
      const c = this.cues[+cue[1]];
      return prop === 'name' ? c.name : c.time;
    }
    const map = {
      current_song_time: this.pos, is_playing: this.playing, loop: this.loop,
      loop_start: this.loopStart, loop_length: this.loopLength, tempo: this.tempo,
      signature_numerator: this.num, signature_denominator: this.den,
      back_to_arranger: this.b2a, clip_trigger_quantization: this.quant,
      start_time: 0, song_length: this.songLength, file_path: this.filePath,
      cue_points: this.cues.map((c, i) => 'id ' + (100 + i)).join(' '),
    };
    if (!(prop in map)) throw new Error('sim: unknown property ' + prop);
    return map[prop];
  }

  setProp(path, prop, value) {
    if (this.inCallback) {
      this.violations.push('set ' + prop + ' inside notification');
      throw new Error('Changes cannot be triggered by notifications');
    }
    // Producer Pal (adamjmurray/producer-pal) observed: loop_start / loop_length /
    // start_time read back inside the same request; `loop`, `is_playing` and
    // `current_song_time` update asynchronously (~25 ms for `loop`).
    this.setLog.push({ t: this.t, prop, value: Number(value) });
    if (this.dropWrites.has(prop)) return;
    if (prop === 'loop_start' || prop === 'loop_length') {
      this.applySet(prop, Number(value));
      return;
    }
    this.pending.push({ due: this.t + this.setLatency, fn: () => this.applySet(prop, Number(value)) });
  }

  applySet(prop, v) {
    switch (prop) {
      case 'current_song_time':
        if (this.playing && this.seekQuantized) {
          const bpb = this.bpb();
          const at = (Math.floor(this.pos / bpb + 1e-9) + 1) * bpb;
          this.pendingJump = { at, target: v };
        } else {
          this.pos = v;
          this.notify('current_song_time', v);
        }
        return;
      case 'loop':
        this.loop = v ? 1 : 0;
        if (this.loop && this.lateLoopJumpsBack && this.pos >= this.loopStart + this.loopLength) {
          this.pos = this.loopStart;
        }
        this.notify('loop', this.loop);
        return;
      case 'loop_start': this.loopStart = v; this.notify('loop_start', v); return;
      case 'loop_length': this.loopLength = v; this.notify('loop_length', v); return;
      case 'is_playing': this.playing = v ? 1 : 0; this.notify('is_playing', this.playing); return;
      case 'back_to_arranger': this.b2a = v ? 1 : 0; this.notify('back_to_arranger', this.b2a); return;
      case 'tempo': this.tempo = v; this.notify('tempo', v); return;
      default: throw new Error('sim: cannot set ' + prop);
    }
  }

  call(path, fn) {
    if (this.inCallback) {
      this.violations.push('call ' + fn + ' inside notification');
      throw new Error('Changes cannot be triggered by notifications');
    }
    this.calls.push({ t: this.t, path, fn });
    const cue = /^live_set cue_points (\d+)$/.exec(path);
    if (cue && fn === 'jump') {
      const target = this.cues[+cue[1]].time;
      if (this.playing) {
        const bpb = this.bpb();
        this.pendingJump = { at: (Math.floor(this.pos / bpb + 1e-9) + 1) * bpb, target };
      } else {
        this.pos = target;
        this.notify('current_song_time', target);
      }
      return 0;
    }
    switch (fn) {
      case 'continue_playing': this.pending.push({ due: this.t + this.setLatency, fn: () => this.applySet('is_playing', 1) }); return 0;
      case 'stop_playing': this.pending.push({ due: this.t + this.setLatency, fn: () => this.applySet('is_playing', 0) }); return 0;
      case 'get_current_beats_song_time': return this.bbst(this.pos);
      case 'get_beats_loop_start': return this.bbst(this.loopStart);
      default: throw new Error('sim: unknown call ' + fn);
    }
  }

  bbst(beat) {
    const bpb = this.bpb();
    const bar = Math.floor(beat / bpb + 1e-9) + 1;
    const inBar = beat - (bar - 1) * bpb;
    const b = Math.floor(inBar) + 1;
    const six = Math.floor((inBar - (b - 1)) * 4) + 1;
    return `${bar}.${b}.${six}.0`;
  }

  notify(prop, value) {
    for (const o of this.observers) {
      if (o._prop === prop) this.fire(o, [prop, value]);
    }
  }

  fire(o, args) {
    this.inCallback = true;
    try { o._cb && o._cb(args); } finally { this.inCallback = false; }
  }

  // ---- time
  step() {
    this.t += 1;
    if (this.playing) {
      let np = this.pos + this.tempo / 60000;
      const pj = this.pendingJump;
      if (pj && this.pos < pj.at && np >= pj.at) {
        np = pj.target + (np - pj.at);
        this.pendingJump = null;
      }
      const le = this.loopStart + this.loopLength;
      if (this.loop && this.pos < le && np >= le) {
        np = this.loopStart + (np - le);
        this.wraps++;
      }
      this.pos = np;
    }
    const due = this.pending.filter(p => p.due <= this.t);
    this.pending = this.pending.filter(p => p.due > this.t);
    for (const p of due) p.fn();
    if (this.t >= this.nextObsT) {
      this.nextObsT = this.t + this.obsInterval + Math.round((this.random() * 2 - 1) * this.obsJitter);
      if (this.pos !== this.lastNotifiedPos) {
        this.lastNotifiedPos = this.pos;
        this.notify('current_song_time', this.pos);
      }
    }
    for (const task of this.tasks.slice()) {
      if (task._active && this.t >= task._next) {
        task._next = this.t + task.interval + Math.round(this.random() * this.taskJitter);
        task._fn.call(task._obj);
      }
    }
  }

  run(ms) { for (let i = 0; i < ms; i++) this.step(); }

  runUntil(pred, maxMs) {
    for (let i = 0; i < maxMs; i++) {
      if (pred()) return true;
      this.step();
    }
    return pred();
  }

  // ---- Max [js] environment
  loadScript(file) {
    const sim = this;
    function LiveAPI(cb, path) {
      if (!sim.loaded) throw new Error('LiveAPI cannot be used in global code / before live.thisdevice');
      this._cb = cb;
      this.path = path;
      this.id = 1;
      this._prop = null;
    }
    Object.defineProperty(LiveAPI.prototype, 'property', {
      get() { return this._prop; },
      set(p) {
        this._prop = p;
        sim.observers.push(this);
        const path = this.path;
        sim.fire(this, [p, sim.getProp(path, p)]);
      },
    });
    LiveAPI.prototype.get = function (prop) { return [sim.getProp(this.path, prop)]; };
    LiveAPI.prototype.set = function (prop, v) { return sim.setProp(this.path, prop, v); };
    LiveAPI.prototype.call = function (fn) { return sim.call(this.path, fn); };
    LiveAPI.prototype.getcount = function (child) {
      if (child !== 'cue_points') throw new Error('sim: getcount ' + child);
      return sim.cues.length;
    };

    function Task(fn, obj) { this._fn = fn; this._obj = obj; this.interval = 1; this._active = false; }
    Task.prototype.repeat = function () { this._active = true; this._next = sim.t + this.interval; sim.tasks.push(this); };
    Task.prototype.cancel = function () { this._active = false; };

    function File(path, mode) {
      this.path = path; this.isopen = true; this.position = 0;
      if (mode === 'read') {
        if (!(path in sim.files)) { this.isopen = false; this.eof = 0; return; }
        this._lines = sim.files[path].slice(); this.eof = this._lines.length;
      } else { this.eof = 0; sim.files[path] = []; }
    }
    File.prototype.writeline = function (s) { sim.files[this.path].push(String(s)); this.position += 1; };
    File.prototype.readline = function () { if (this.position >= this._lines.length) return null; return this._lines[this.position++]; };
    File.prototype.close = function () { this.isopen = false; };

    class FakeDate {
      getTime() { return sim.t; } static now() { return sim.t; }
      getFullYear() { return 2026; } getMonth() { return 10; } getDate() { return 20; }
      getHours() { return 12; } getMinutes() { return 0; } toString() { return 'Fri Nov 20 2026 12:00 (sim)'; }
    }
    function Global(name) {
      if (!sim.globals[name]) sim.globals[name] = {};
      return sim.globals[name];
    }

    const ctx = {
      LiveAPI, Task, File, Global, Date: FakeDate,
      post: (...a) => sim.posts.push(a.join(' ')),
      outlet: (...a) => sim.outlets.push(a),
      arrayfromargs: (args) => Array.prototype.slice.call(args),
      messagename: '',
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
    this.ctx = ctx;
    return ctx;
  }

  // Equivalent of live.thisdevice firing.
  deviceReady(ctx) { this.loaded = true; (ctx || this.ctx).init(); }

  logs(re) { return this.posts.filter(p => re.test(p)); }
}

module.exports = { LiveSim };
