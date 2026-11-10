// NØIZ core — engine: single source of truth + commands + history + playback.
// UI (compact and full) only sends commands; both read the same NoizEngine.

var NOIZ_UNDO_LIMIT = 16;
var NOIZ_BEATS_PER_BAR = 4; // v1 assumes 4/4 for "apply at next bar" (docs/DECISIONS.md D9)

function NoizEngine(opts) {
  opts = opts || {};
  this.state = noizDefaultState();
  this.anchorTracks = noizClone(this.state.tracks);  // Keep anchor
  this.undoStack = [];
  this.generationCounter = 0;
  this.playState = this.state;   // what the scheduler plays; differs only while a change is pending
  this.pending = false;
  this.transportPlaying = false;
  this.clock = new NoizClock(opts.clock);
  this.minSpacingMs = noizIsNum(opts.minSpacingMs) ? opts.minSpacingMs : 12;
  this.gesture = null;
  this.lastPos = 0;
  this.tempo = 120;
  this.listeners = [];
}

NoizEngine.prototype.onChange = function (fn) { this.listeners.push(fn); };
NoizEngine.prototype._changed = function (what) {
  for (var i = 0; i < this.listeners.length; i++) this.listeners[i](what);
};

// ---------- history ----------
NoizEngine.prototype._snapshot = function () {
  return {
    tracks: noizClone(this.state.tracks),
    anchorTracks: noizClone(this.anchorTracks),
    seed: this.state.global.seed,
    generationCounter: this.generationCounter
  };
};
NoizEngine.prototype._pushUndo = function (snap) {
  this.undoStack.push(snap || this._snapshot());
  while (this.undoStack.length > NOIZ_UNDO_LIMIT) this.undoStack.shift();
};
NoizEngine.prototype.canUndo = function () { return this.undoStack.length > 0; };

// Audio-affecting structural changes go through here: while the transport runs they
// are applied at the next bar (pending); when stopped, immediately.
NoizEngine.prototype._beginStructural = function () {
  if (this.transportPlaying && !this.pending) {
    this.playState = noizClone(this.state);
    this.pending = true;
  }
};
NoizEngine.prototype._applyPending = function () {
  this.playState = this.state;
  this.pending = false;
  this._changed("pending");
};

NoizEngine.prototype._nextSeed = function () {
  this.generationCounter++;
  this.state.global.seed = noizHashInts([this.state.global.seed, this.generationCounter, 0x4e30]) >>> 0;
  return this.state.global.seed;
};

NoizEngine.prototype._opts = function () {
  return { lockDensity: this.state.global.lockDensity, lockAmount: this.state.global.lockAmount };
};

// ---------- main commands ----------
NoizEngine.prototype.generate = function (scope) {
  scope = noizEnum(scope, NOIZ_SCOPES, this.state.global.randomScope);
  this._pushUndo();
  this._beginStructural();
  var rng = new NoizRng(this._nextSeed());
  this.state.tracks = noizNormalizeTracks(noizGenerate(this.state.tracks, scope, rng, this._opts()));
  // D5: Generate makes the new result the anchor for following Mutates.
  this.anchorTracks = noizClone(this.state.tracks);
  if (!this.transportPlaying) this._applyPending();
  this._changed("generate");
};

NoizEngine.prototype.mutate = function (scope, amount) {
  scope = noizEnum(scope, NOIZ_SCOPES, this.state.global.randomScope);
  amount = noizIsNum(amount) ? noizClamp01(amount) : this.state.global.mutationAmount;
  if (amount <= 0) return false; // A07: nothing changes, no history entry
  this._pushUndo();
  this._beginStructural();
  var rng = new NoizRng(this._nextSeed()); // new unique seed every press
  this.state.tracks = noizMutateFromAnchor(this.state.tracks, this.anchorTracks, amount, scope, rng, this._opts());
  if (!this.transportPlaying) this._applyPending();
  this._changed("mutate");
  return true;
};

NoizEngine.prototype.keep = function () {
  this._pushUndo();
  this.anchorTracks = noizClone(this.state.tracks);
  this._changed("keep");
};

NoizEngine.prototype.undo = function () {
  if (!this.undoStack.length) return false;
  var snap = this.undoStack.pop();
  this._beginStructural();
  this.state.tracks = snap.tracks;
  this.anchorTracks = snap.anchorTracks;
  this.state.global.seed = snap.seed;
  this.generationCounter = snap.generationCounter;
  if (!this.transportPlaying) this._applyPending();
  this._changed("undo");
  return true;
};

// ---------- edits ----------
// A gesture (mouse down → drag → mouse up) records exactly one undo entry.
NoizEngine.prototype.beginGesture = function () {
  if (!this.gesture) this.gesture = this._snapshot();
};
NoizEngine.prototype.endGesture = function () {
  if (!this.gesture) return;
  var before = this.gesture;
  this.gesture = null;
  if (JSON.stringify(before.tracks) !== JSON.stringify(this.state.tracks)) this._pushUndo(before);
};
// Discrete edit = its own one-entry gesture unless a gesture is already open.
NoizEngine.prototype._edit = function (fn, what) {
  var own = !this.gesture;
  if (own) this.beginGesture();
  fn.call(this);
  if (own) this.endGesture();
  this._changed(what || "edit");
};

NoizEngine.prototype._track = function (t) { return this.state.tracks[noizClamp(t | 0, 0, 3)]; };
NoizEngine.prototype._step = function (t, s) { return this._track(t).steps[noizClamp(s | 0, 0, NOIZ_MAX_STEPS - 1)]; };

NoizEngine.prototype.toggleStep = function (t, s) {
  this._edit(function () { var st = this._step(t, s); st.on = !st.on; }, "step");
};
NoizEngine.prototype.setStep = function (t, s, field, value) {
  this._edit(function () {
    var st = this._step(t, s);
    if (field === "on") st.on = !!value;
    else if (field === "velocity") st.velocity = noizClamp01(+value);
    else if (field === "probability") st.probability = noizClamp01(+value);
    else if (field === "ratchet") st.ratchet = noizClamp(Math.round(+value), 1, NOIZ_MAX_RATCHET);
  }, "step");
};
NoizEngine.prototype.setLength = function (t, n) {
  this._edit(function () { this._track(t).length = noizClamp(Math.round(+n), 1, NOIZ_MAX_STEPS); }, "track");
};
NoizEngine.prototype.setDivision = function (t, n, m) {
  this._edit(function () {
    this._track(t).division = { n: noizClamp(Math.round(+n), 1, NOIZ_MAX_DIV), m: noizClamp(Math.round(+m), 1, NOIZ_MAX_DIV) };
  }, "track");
};
NoizEngine.prototype.setDensity = function (t, d) {
  this._edit(function () { this._track(t).density = noizClamp(+d, 0.02, 0.9); }, "track");
};
NoizEngine.prototype.setLock = function (t, which, on) {
  this._edit(function () {
    var tr = this._track(t);
    if (which === "rhythm") tr.locks.rhythm = !!on;
    else if (which === "sound") tr.locks.sound = !!on;
  }, "lock");
};
// Level/mute: mixer settings, not pattern edits — they bypass the undo history
// (Live's own undo covers mapped parameters).
NoizEngine.prototype.setLevel = function (t, db) { this._track(t).levelDb = noizClamp(+db, -60, 6); this._changed("mix"); };
NoizEngine.prototype.setMute = function (t, on) { this._track(t).mute = !!on; this._changed("mix"); };

// Base macro (BASE mode) — changes the track sound.
NoizEngine.prototype.setSound = function (t, key, v) {
  if (NOIZ_MACROS.indexOf(key) < 0) return;
  this._edit(function () { this._track(t).sound[key] = noizClamp01(+v); }, "sound");
};
// P-Lock (STEP mode) — only the selected step.
NoizEngine.prototype.setPLock = function (t, s, key, v) {
  if (NOIZ_MACROS.indexOf(key) < 0) return;
  this._edit(function () { this._step(t, s).pLocks[key] = noizClamp01(+v); }, "plock");
};
NoizEngine.prototype.clearStepLocks = function (t, s) {
  this._edit(function () { this._step(t, s).pLocks = {}; }, "plock");
};
NoizEngine.prototype.clearTrackLocks = function (t) {
  this._edit(function () {
    var tr = this._track(t);
    for (var i = 0; i < NOIZ_MAX_STEPS; i++) tr.steps[i].pLocks = {};
  }, "plock");
};
// Macro edit routed by the current BASE/STEP mode — the one place the UI calls.
NoizEngine.prototype.setMacro = function (key, v) {
  var g = this.state.global;
  if (g.selectedStep >= 0) this.setPLock(g.selectedTrack, g.selectedStep, key, v);
  else this.setSound(g.selectedTrack, key, v);
};
NoizEngine.prototype.resetMacro = function (key) {
  var g = this.state.global;
  if (g.selectedStep >= 0) {
    var self = this;
    this._edit(function () { delete self._step(g.selectedTrack, g.selectedStep).pLocks[key]; }, "plock");
  } else {
    this.setSound(g.selectedTrack, key, NOIZ_DEFAULT_SOUND[g.selectedTrack][key]);
  }
};

// ---------- global settings (UI state; no undo) ----------
NoizEngine.prototype.setGlobal = function (key, v) {
  var g = this.state.global;
  if (key === "mutationAmount" || key === "lockDensity" || key === "lockAmount") g[key] = noizClamp01(+v);
  else if (key === "randomScope") g.randomScope = noizEnum(v, NOIZ_SCOPES, g.randomScope);
  else if (key === "activeView") g.activeView = noizEnum(v, NOIZ_VIEWS, g.activeView);
  else if (key === "selectedTrack") { g.selectedTrack = noizClamp(v | 0, 0, 3); g.selectedStep = -1; }
  else if (key === "selectedStep") g.selectedStep = noizClamp(v | 0, -1, NOIZ_MAX_STEPS - 1);
  else if (key === "selectedPage") g.selectedPage = noizClamp(v | 0, 0, 1);
  else if (key === "uiMotion") g.uiMotion = !!v;
  else return;
  this._changed("global");
};

// ---------- playback ----------
// Called from the host clock bridge with the current host position (beats) and tempo.
// Returns events, each with `delayMs` (time from now until it must sound).
// Sets this.flushRequested when previously queued events must be dropped.
NoizEngine.prototype.tick = function (pos, tempo) {
  if (noizIsNum(tempo) && tempo > 0) this.tempo = tempo;
  this.flushRequested = false;
  var w = this.clock.advance(pos, this.tempo);
  var wasPlaying = this.transportPlaying;
  this.transportPlaying = this.clock.playing;
  if (wasPlaying && !this.transportPlaying && this.pending) this._applyPending();
  this.lastPos = pos;
  if (!w) return [];
  if (w.flush) {
    this.flushRequested = true;
    if (this.pending) this._applyPending(); // after a jump, apply right away
  }
  var msPerBeat = 60000 / this.tempo;
  var opt = { minSpacingBeats: (this.minSpacingMs / 60000) * this.tempo };
  var out = [];
  for (var i = 0; i < w.segments.length; i++) {
    var seg = w.segments[i];
    var parts = [];
    if (this.pending) {
      var bar = Math.ceil(seg.a / NOIZ_BEATS_PER_BAR - NOIZ_EPS) * NOIZ_BEATS_PER_BAR;
      if (bar < seg.b) {
        parts = noizEventsInRange(this.playState, seg.a, bar, opt);
        this._applyPending();
        parts = parts.concat(noizEventsInRange(this.state, bar, seg.b, opt));
      } else {
        parts = noizEventsInRange(this.playState, seg.a, seg.b, opt);
      }
    } else {
      parts = noizEventsInRange(this.state, seg.a, seg.b, opt);
    }
    for (var j = 0; j < parts.length; j++) {
      var ev = parts[j];
      ev.delayMs = Math.max(0, (seg.offset + (ev.beat - seg.a)) * msPerBeat);
      out.push(ev);
    }
  }
  return out;
};

NoizEngine.prototype.setLoop = function (on, start, length) { this.clock.setLoop(on, start, length); };

// ---------- persistence ----------
NoizEngine.prototype.serialize = function () {
  return noizSerialize(this.state, this.anchorTracks, this.generationCounter);
};
NoizEngine.prototype.restore = function (text) {
  var r = noizDeserialize(text);
  if (!r.ok) return r;
  this.state = r.state;
  this.anchorTracks = r.anchorTracks;
  this.generationCounter = r.generationCounter;
  this.playState = this.state;
  this.pending = false;
  this.undoStack = [];
  this._changed("restore");
  return r;
};

// Trigger message for the DSP: amplitude already includes velocity curve and level.
function noizEventToTrigger(ev) {
  var amp = Math.pow(noizClamp01(ev.velocity), 1.5) * noizDbToAmp(ev.levelDb);
  return [ev.trackId, noizRound(amp, 5), noizRound(ev.sound.tone, 4), noizRound(ev.sound.decay, 4),
    noizRound(ev.sound.texture, 4), noizRound(ev.sound.drive, 4)];
}
