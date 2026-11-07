// midi_engine.js: plays rendered patterns against Live's transport.
//
// tick(absStep) is called once per 16th note with the absolute step position
// derived from Live's transport (bars/beats/ticks). It returns raw MIDI
// messages [status, data1, data2]. The engine:
//  - remembers every sounding note with its absolute end step, so note-offs
//    are sent on time even if the pattern is replaced while a note sounds;
//  - swaps in a new pattern only on a bar boundary (or at once when stopped);
//  - ignores a repeated step (no duplicated events) and treats any jump in
//    position (relocation, loop brace) by releasing all notes first;
//  - retriggers a note that is still held by sending its note-off first;
//  - stop()/allOff() release everything that is held (no hanging notes).
// Four voices share one MIDI output, separated by MIDI channel.

GO.Player = (function () {
  var U = GO.util;

  function Player() { this.cur = null; this.pending = null; this.held = {}; this.last = null; }

  function compile(pattern) {
    var by = {}, i, j;
    for (i = 0; i < pattern.voices.length; i++) {
      var v = pattern.voices[i];
      if (!v.on) continue;
      var ch = U.clamp(v.ch | 0, 1, 16) - 1;
      for (j = 0; j < v.ev.length; j++) {
        var e = v.ev[j];
        (by[e.t] = by[e.t] || []).push({ ch: ch, p: U.clamp(e.p, 0, 127), v: U.clamp(e.v, 1, 127), d: Math.max(1, e.d) });
      }
    }
    return { len: pattern.len, spb: pattern.spb, by: by };
  }

  // now = true: replace immediately (transport stopped); else on the next bar
  Player.prototype.load = function (pattern, now) {
    var c = compile(pattern);
    if (now || !this.cur) { this.cur = c; this.pending = null; } else this.pending = c;
  };

  Player.prototype.hasPending = function () { return !!this.pending; };

  Player.prototype.tick = function (abs) {
    var out = [], k;
    if (this.last !== null && abs === this.last) return out;
    if (this.last !== null && abs !== this.last + 1) out = this.allOff();
    this.last = abs;
    for (k in this.held) {
      if (this.held[k].end <= abs) { out.push([0x80 | this.held[k].ch, this.held[k].p, 0]); delete this.held[k]; }
    }
    if (this.pending && U.mod(abs, this.pending.spb) === 0) { this.cur = this.pending; this.pending = null; }
    if (!this.cur) return out;
    var list = this.cur.by[U.mod(abs, this.cur.len)], i;
    if (!list) return out;
    for (i = 0; i < list.length; i++) {
      var e = list[i], key = e.ch * 128 + e.p;
      if (this.held[key]) out.push([0x80 | e.ch, e.p, 0]);
      out.push([0x90 | e.ch, e.p, e.v]);
      this.held[key] = { ch: e.ch, p: e.p, end: abs + e.d };
    }
    return out;
  };

  Player.prototype.allOff = function () {
    var out = [], k;
    for (k in this.held) out.push([0x80 | this.held[k].ch, this.held[k].p, 0]);
    this.held = {};
    return out;
  };

  Player.prototype.stop = function () {
    var out = this.allOff();
    this.last = null;
    if (this.pending) { this.cur = this.pending; this.pending = null; }
    return out;
  };

  // release notes of one MIDI channel (1-16), e.g. when a voice is switched off
  Player.prototype.releaseChannel = function (ch) {
    var out = [], k;
    for (k in this.held) if (this.held[k].ch === ch - 1) { out.push([0x80 | this.held[k].ch, this.held[k].p, 0]); delete this.held[k]; }
    return out;
  };

  return Player;
})();
