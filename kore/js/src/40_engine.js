// KØRE core — engine: single source of truth + commands + history + playback.
// UI (compact and full) only sends commands; both read the same KoreEngine.

var KORE_UNDO_LIMIT = 16;
var KORE_BEATS_PER_BAR = 4; // v1 assumes 4/4 for "apply at next bar" (docs/DECISIONS.md D9)

function KoreEngine(opts) {
  opts = opts || {};
  this.state = koreDefaultState();
  this.anchorTracks = koreClone(this.state.tracks);  // Keep anchor
  this.undoStack = [];
  this.generationCounter = 0;
  this.playState = this.state;   // what the scheduler plays; differs only while a change is pending
  this.pending = false;
  this.transportPlaying = false;
  this.clock = new KoreClock(opts.clock);
  this.minSpacingMs = koreIsNum(opts.minSpacingMs) ? opts.minSpacingMs : 12;
  this.gesture = null;
  this.lastPos = 0;
  this.tempo = 120;
  this.listeners = [];
}

KoreEngine.prototype.onChange = function (fn) { this.listeners.push(fn); };
KoreEngine.prototype._changed = function (what) {
  for (var i = 0; i < this.listeners.length; i++) this.listeners[i](what);
};

// ---------- history ----------
KoreEngine.prototype._snapshot = function () {
  return {
    tracks: koreClone(this.state.tracks),
    anchorTracks: koreClone(this.anchorTracks),
    seed: this.state.global.seed,
    generationCounter: this.generationCounter
  };
};
KoreEngine.prototype._pushUndo = function (snap) {
  this.undoStack.push(snap || this._snapshot());
  while (this.undoStack.length > KORE_UNDO_LIMIT) this.undoStack.shift();
};
KoreEngine.prototype.canUndo = function () { return this.undoStack.length > 0; };

// Audio-affecting structural changes go through here: while the transport runs they
// are applied at the next bar (pending); when stopped, immediately.
KoreEngine.prototype._beginStructural = function () {
  if (this.transportPlaying && !this.pending) {
    this.playState = koreClone(this.state);
    this.pending = true;
  }
};
KoreEngine.prototype._applyPending = function () {
  this.playState = this.state;
  this.pending = false;
  this._changed("pending");
};

KoreEngine.prototype._nextSeed = function () {
  this.generationCounter++;
  this.state.global.seed = koreHashInts([this.state.global.seed, this.generationCounter, 0x4e30]) >>> 0;
  return this.state.global.seed;
};

// Scope follows the screen: SEQ → PATTERN (rhythm + P-Locks), SYNTH → SOUND.
// v0.3: GENERATE / MUTATE change everything (rhythm, sound, synth, per-step locks)
// on every screen; the L switch protects a voice.
KoreEngine.prototype.contextScope = function () { return "ALL"; };



// ---------- main commands ----------
KoreEngine.prototype.generate = function (scope) {
  scope = koreEnum(scope, KORE_SCOPES, "ALL");
  this._pushUndo();
  this._beginStructural();
  var rng = new KoreRng(this._nextSeed());
  this.state.tracks = koreGenerate(this.state.tracks, scope, rng, this.state.global);
  // D5: Generate makes the new result the anchor for following Mutates.
  this.anchorTracks = koreClone(this.state.tracks);
  if (!this.transportPlaying) this._applyPending();
  this._changed("generate");
};

KoreEngine.prototype.mutate = function (scope, amount) {
  scope = koreEnum(scope, KORE_SCOPES, "ALL");
  amount = koreIsNum(amount) ? koreClamp01(amount) : this.state.global.mutationAmount;
  if (amount <= 0) return false; // A07: nothing changes, no history entry
  this._pushUndo();
  this._beginStructural();
  var rng = new KoreRng(this._nextSeed()); // new unique seed every press
  this.state.tracks = koreMutateFromAnchor(this.state.tracks, this.anchorTracks, amount, scope, rng, this.state.global);
  if (!this.transportPlaying) this._applyPending();
  this._changed("mutate");
  return true;
};

KoreEngine.prototype.keep = function () {
  this._pushUndo();
  this.anchorTracks = koreClone(this.state.tracks);
  this._changed("keep");
};

KoreEngine.prototype.undo = function () {
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
KoreEngine.prototype.beginGesture = function () {
  if (!this.gesture) this.gesture = this._snapshot();
};
KoreEngine.prototype.endGesture = function () {
  if (!this.gesture) return;
  var before = this.gesture;
  this.gesture = null;
  if (JSON.stringify(before.tracks) !== JSON.stringify(this.state.tracks)) this._pushUndo(before);
};
// Discrete edit = its own one-entry gesture unless a gesture is already open.
KoreEngine.prototype._edit = function (fn, what) {
  var own = !this.gesture;
  if (own) this.beginGesture();
  fn.call(this);
  if (own) this.endGesture();
  this._changed(what || "edit");
};

KoreEngine.prototype._track = function (t) { return this.state.tracks[koreClamp(t | 0, 0, KORE_TRACK_NAMES.length - 1)]; };
KoreEngine.prototype._step = function (t, s) { return this._track(t).steps[koreClamp(s | 0, 0, KORE_MAX_STEPS - 1)]; };
KoreEngine.prototype._isParam = function (t, key) { return KORE_VOICE_PARAMS[this._track(t).id].indexOf(key) >= 0; };

KoreEngine.prototype.toggleStep = function (t, s) {
  this._edit(function () { var st = this._step(t, s); st.on = !st.on; }, "step");
};
KoreEngine.prototype.setStep = function (t, s, field, value) {
  this._edit(function () {
    var st = this._step(t, s);
    if (field === "on") st.on = !!value;
    else if (field === "velocity") st.velocity = koreClamp01(+value);
    else if (field === "probability") st.probability = koreClamp01(+value);
    else if (field === "ratchet") st.ratchet = koreClamp(Math.round(+value), 1, KORE_MAX_RATCHET);
    else if (field === "open") st.open = !!value;          // HAT articulation (choked)
  }, "step");
};
KoreEngine.prototype.setLength = function (t, n) {
  this._edit(function () { this._track(t).length = koreClamp(Math.round(+n), 1, KORE_MAX_STEPS); }, "track");
};
KoreEngine.prototype.setDivision = function (t, n, m) {
  this._edit(function () {
    this._track(t).division = { n: koreClamp(Math.round(+n), 1, KORE_MAX_DIV), m: koreClamp(Math.round(+m), 1, KORE_MAX_DIV) };
  }, "track");
};
// One "protect this voice" switch (L): rhythm + sound + P-Locks.
KoreEngine.prototype.setHold = function (t, on) {
  this._edit(function () { var tr = this._track(t); tr.locks.rhythm = !!on; tr.locks.sound = !!on; }, "lock");
};
KoreEngine.prototype.setLevel = function (t, db) { this._track(t).levelDb = koreClamp(+db, -60, 6); this._changed("mix"); };
KoreEngine.prototype.setMute = function (t, on) { this._track(t).mute = !!on; this._changed("mix"); };

// Turning a voice knob moves the whole per-step lane of that parameter (shape kept).
function koreShiftLane(track, key, delta) {
  if (!delta) return;
  for (var i = 0; i < KORE_MAX_STEPS; i++) {
    var pl = track.steps[i].pLocks;
    if (pl.hasOwnProperty(key)) pl[key] = koreRound(koreClamp01(pl[key] + delta), 4);
  }
}
KoreEngine.prototype.setBase = function (t, key, v) {
  if (!this._isParam(t, key)) return;
  this._edit(function () {
    var tr = this._track(t), nv = koreClamp01(+v);
    koreShiftLane(tr, key, nv - tr.params[key]);
    tr.params[key] = nv;
  }, "sound");
};
KoreEngine.prototype.setPLock = function (t, s, key, v) {
  if (!this._isParam(t, key)) return; // only ids of that voice (no leakage)
  this._edit(function () { this._step(t, s).pLocks[key] = koreClamp01(+v); }, "plock");
};
KoreEngine.prototype.clearLock = function (t, s, key) {
  this._edit(function () { delete this._step(t, s).pLocks[key]; }, "plock");
};
KoreEngine.prototype.clearStepLocks = function (t, s) {
  this._edit(function () { this._step(t, s).pLocks = {}; }, "plock");
};
// BASE or STEP P-Lock depending on the selected step — the call the UI uses.
KoreEngine.prototype.setParam = function (key, v) {
  var g = this.state.global;
  if (g.selectedStep >= 0) this.setPLock(g.selectedTrack, g.selectedStep, key, v);
  else this.setBase(g.selectedTrack, key, v);
};
KoreEngine.prototype.resetParam = function (key) {
  var g = this.state.global;
  if (!this._isParam(g.selectedTrack, key)) return;
  if (g.selectedStep >= 0) this.clearLock(g.selectedTrack, g.selectedStep, key);
  else this.setBase(g.selectedTrack, key, KORE_DEFAULT_PARAMS[g.selectedTrack][key]);
};

// ---------- global settings (UI state; no undo) ----------
KoreEngine.prototype.setGlobal = function (key, v) {
  var g = this.state.global;
  if (key === "mutationAmount" || key === "lockDensity" || key === "lockAmount") g[key] = koreClamp01(+v);
  else if (key === "style") g.style = koreEnum(String(v), KORE_STYLES, g.style);
  else if (key === "kickInteraction") g.kickInteraction = koreEnum(String(v), KORE_INTERACTIONS, g.kickInteraction);
  else if (key === "unlockPunch") g.unlockPunch = !!v;
  else if (key === "activeView") g.activeView = koreEnum(String(v), KORE_VIEWS, g.activeView);
  else if (key === "selectedTrack") { g.selectedTrack = koreClamp(v | 0, 0, 5); g.selectedStep = -1; }
  else if (key === "selectedStep") g.selectedStep = koreClamp(v | 0, -1, KORE_MAX_STEPS - 1);
  else if (key === "selectedPage") g.selectedPage = koreClamp(v | 0, 0, 1);
  else return;
  this._changed("global");
};

// ---------- playback ----------
// Called from the host clock bridge with the current host position (beats) and tempo.
// Returns events, each with `delayMs` (time from now until it must sound).
// Sets this.flushRequested when previously queued events must be dropped.
KoreEngine.prototype.tick = function (pos, tempo) {
  if (koreIsNum(tempo) && tempo > 0) this.tempo = tempo;
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
      var bar = Math.ceil(seg.a / KORE_BEATS_PER_BAR - KORE_EPS) * KORE_BEATS_PER_BAR;
      if (bar < seg.b) {
        parts = koreEventsInRange(this.playState, seg.a, bar, opt);
        this._applyPending();
        parts = parts.concat(koreEventsInRange(this.state, bar, seg.b, opt));
      } else {
        parts = koreEventsInRange(this.playState, seg.a, seg.b, opt);
      }
    } else {
      parts = koreEventsInRange(this.state, seg.a, seg.b, opt);
    }
    for (var j = 0; j < parts.length; j++) {
      var ev = parts[j];
      ev.delayMs = Math.max(0, (seg.offset + (ev.beat - seg.a)) * msPerBeat);
      out.push(ev);
    }
  }
  return out;
};

KoreEngine.prototype.setLoop = function (on, start, length) { this.clock.setLoop(on, start, length); };

// ---------- persistence ----------
KoreEngine.prototype.serialize = function () {
  return koreSerialize(this.state, this.anchorTracks, this.generationCounter);
};
KoreEngine.prototype.restore = function (text) {
  var r = koreDeserialize(text);
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
// Trigger for the DSP (8 values): track amp p0 p1 p2 p3 p4 open
// p0..p4 = the voice's params in KORE_VOICE_PARAMS order (unused slots 0).
function koreEventToTrigger(ev) {
  var amp = Math.pow(koreClamp01(ev.velocity), 1.5) * koreDbToAmp(ev.levelDb);
  var keys = KORE_VOICE_PARAMS[ev.trackId], out = [ev.trackId, koreRound(amp, 5)];
  for (var i = 0; i < 5; i++) out.push(i < keys.length ? koreRound(ev.params[keys[i]], 4) : 0);
  out.push(ev.open ? 1 : 0);
  return out;
}
