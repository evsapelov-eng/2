// NØIZ core — rhythmic scheduler.
// Pure function of (state, musical window). Time unit = quarter-note beats derived
// from the host position; never from UI frame rate or a free-running metro.
//
// Base step = 1/16 = 0.25 beat (= 120 ticks at 480 PPQ).
// Division n:m = n step intervals in the time of m base intervals:
//   stepBeats = 0.25 * m / n.
// Step k of a track (k = 0,1,2,... from song position 0) starts at k * stepBeats.
// stepIndex = k mod length, cycleIndex = floor(k / length) — so a 13-step track
// never resets at bar lines (polymeter), and loops/seek are handled by recomputing
// from absolute position.

var NOIZ_BASE_STEP_BEATS = 0.25;
var NOIZ_EPS = 1e-9;

function noizStepBeats(track) {
  return NOIZ_BASE_STEP_BEATS * track.division.m / track.division.n;
}

// Position of global step k of a track, in beats. Same formula everywhere so that
// window boundaries partition events exactly (no doubles, no gaps).
function noizStepPos(track, k) {
  return (k * track.division.m) / (4 * track.division.n);
}

// Deterministic probability roll: f(seed, trackId, cycleIndex, stepIndex, eventKind).
// Independent of window size and UI rate.
var NOIZ_EVENT_KIND_PROB = 1;
function noizProbabilityPasses(seed, trackId, cycleIndex, stepIndex, probability) {
  if (probability >= 1) return true;
  if (probability <= 0) return false;
  return noizHash01([seed, trackId, cycleIndex, stepIndex, NOIZ_EVENT_KIND_PROB]) < probability;
}

// Stereo position of one hit, 0..1. Base = effective pan (track pan or its P-Lock).
// spread > 0 moves each hit deterministically around the base:
//  - single hit: f(seed, track, cycle, step) in [-spread, +spread]
//  - ratchet: sub-hits sweep across the field (direction chosen per step) → fast pans
var NOIZ_EVENT_KIND_PAN = 3;
function noizHitPan(seed, track, cycleIndex, stepIndex, ratchetIndex, ratchetCount, basePan, spread) {
  var p = basePan * 2 - 1;
  var sp = spread || 0;
  if (sp > 0) {
    var h = noizHash01([seed, track.id, cycleIndex, stepIndex, NOIZ_EVENT_KIND_PAN]);
    if (ratchetCount > 1) {
      var dir = h < 0.5 ? -1 : 1;
      p += sp * dir * (-1 + (2 * ratchetIndex) / (ratchetCount - 1));
    } else {
      p += sp * (h * 2 - 1);
    }
  }
  return (noizClamp(p, -1, 1) + 1) / 2;
}

// Effective ratchet count given a minimum spacing between sub-hits (in beats).
// Fallback (documented): if the step is too short for r sub-hits, reduce r to the
// largest count that respects the spacing (minimum 1). Spacing never collapses.
function noizEffectiveRatchet(ratchet, stepBeats, minSpacingBeats) {
  var r = Math.max(1, Math.min(NOIZ_MAX_RATCHET, ratchet | 0));
  if (minSpacingBeats > 0) {
    var maxR = Math.max(1, Math.floor(stepBeats / minSpacingBeats + NOIZ_EPS));
    if (r > maxR) r = maxR;
  }
  return r;
}

// Events with start position in [a, b). opts: {minSpacingBeats, seed}.
// Event: {trackId, beat, stepIndex, cycleIndex, ratchetIndex, ratchetCount,
//         velocity, sound:{tone,decay,texture,drive}, levelDb}
function noizEventsInRange(state, a, b, opts) {
  var events = [];
  if (!(b > a)) return events;
  opts = opts || {};
  var seed = noizIsNum(opts.seed) ? opts.seed : state.global.seed;
  var minSpacing = noizIsNum(opts.minSpacingBeats) ? opts.minSpacingBeats : 0;
  for (var t = 0; t < state.tracks.length; t++) {
    var tr = state.tracks[t];
    if (tr.mute) continue;
    var sb = noizStepBeats(tr);
    var kFirst = Math.max(0, Math.floor(a / sb) - 1);
    var kLast = Math.ceil(b / sb) + 1;
    for (var k = kFirst; k <= kLast; k++) {
      var start = noizStepPos(tr, k);
      if (start >= b) break;
      var idx = k % tr.length;
      var cyc = Math.floor(k / tr.length);
      var st = tr.steps[idx];
      if (!st.on) continue;
      var r = noizEffectiveRatchet(st.ratchet, sb, minSpacing);
      // Fast reject: whole step (incl. ratchets) before window.
      if (start + sb <= a && r === 1) continue;
      var passed = null; // roll lazily, once per step (covers all its ratchets)
      for (var i = 0; i < r; i++) {
        var pos = (i === 0) ? start : start + (sb * i) / r;
        if (pos < a || pos >= b) continue;
        if (passed === null) passed = noizProbabilityPasses(seed, tr.id, cyc, idx, st.probability);
        if (!passed) break;
        var snd = noizEffectiveSound(tr, st);  // P-Locks apply to the whole ratchet cluster
        events.push({
          trackId: tr.id,
          beat: pos,
          stepIndex: idx,
          cycleIndex: cyc,
          ratchetIndex: i,
          ratchetCount: r,
          velocity: st.velocity,
          sound: snd,
          pan: noizHitPan(seed, tr, cyc, idx, i, r, snd.pan, snd.spread),
          levelDb: tr.levelDb
        });
      }
    }
  }
  events.sort(function (x, y) { return (x.beat - y.beat) || (x.trackId - y.trackId) || (x.ratchetIndex - y.ratchetIndex); });
  return events;
}

// Current step index of a track at a position (for the playhead).
function noizStepAt(track, beat) {
  var sb = noizStepBeats(track);
  var k = Math.floor(beat / sb + NOIZ_EPS);
  if (k < 0) k = 0;
  return k % track.length;
}

// ---------- host-clock follower with lookahead ----------
// [js] runs at low priority in Max, so it must not fire triggers "now". Instead each
// poll schedules every event up to `lookaheadMs` ahead of the host position and
// returns it with a delay; a high-priority [pipe] in the patch releases it on time.
// Jitter of the JS thread is absorbed as long as it stays below the lookahead.
//
// Song positions are host beats. With Live's loop on (and the playhead inside the
// loop) the scheduled range wraps at loop end, so nothing past loop end is queued.
// On stop/seek/unexpected jump, `flush` asks the patch to drop queued events.

function NoizClock(opts) {
  opts = opts || {};
  this.lookaheadMs = noizIsNum(opts.lookaheadMs) ? opts.lookaheadMs : 40;
  this.lateWindowMs = noizIsNum(opts.lateWindowMs) ? opts.lateWindowMs : 12;
  this.maxForwardJumpBeats = noizIsNum(opts.maxForwardJumpBeats) ? opts.maxForwardJumpBeats : 1.0;
  this.loop = { on: false, start: 0, end: 4 };
  this.lastPos = null;
  this.stillTicks = 0;
  this.playing = false;
  this.schedUntil = null;   // song position up to which events are already queued
  this.wrappedAhead = false; // schedUntil already wrapped to loop start, playhead not yet
}

NoizClock.prototype.setLoop = function (on, start, length) {
  this.loop = { on: !!on && length > 0, start: Math.max(0, +start || 0), end: Math.max(0, +start || 0) + Math.max(0, +length || 0) };
};

NoizClock.prototype._inLoop = function (pos) {
  return this.loop.on && pos < this.loop.end - NOIZ_EPS && pos >= this.loop.start - NOIZ_EPS;
};

// Returns null (nothing to do) or {segments:[{a,b,offset}], flush, playing}.
// offset = playback distance (beats) from the current position to segment start;
// may be negative when the JS thread is late (events then fire immediately).
NoizClock.prototype.advance = function (pos, tempo) {
  var bpm = tempo > 0 ? tempo : 120;
  var look = (this.lookaheadMs / 60000) * bpm;
  var late = (this.lateWindowMs / 60000) * bpm;
  var flush = false;
  if (this.lastPos === null) { this.lastPos = pos; return null; }
  var d = pos - this.lastPos;
  if (Math.abs(d) < NOIZ_EPS) {
    this.stillTicks++;
    if (this.stillTicks > 3 && this.playing) {
      this.playing = false;
      this.schedUntil = null;
      this.wrappedAhead = false;
      return { segments: [], flush: true, playing: false }; // stop: drop queued events
    }
    return null;
  }
  this.stillTicks = 0;
  var expectedWrap = this.loop.on && d < 0 && this.wrappedAhead &&
    this.lastPos >= this.loop.end - look - late - NOIZ_EPS && pos <= this.loop.start + look + late + NOIZ_EPS;
  if (!this.playing || this.schedUntil === null) {
    // start or resume
    this.wrappedAhead = false;
    if (this.playing === false && d > 0 && d <= this.maxForwardJumpBeats && this.schedUntil === null && this._resumeOk) {
      this.schedUntil = this.lastPos;
    } else {
      this.schedUntil = Math.max(0, pos - late);
    }
  } else if (expectedWrap) {
    this.wrappedAhead = false; // the playhead caught up with the wrapped schedule
  } else if (d < 0 || d > this.maxForwardJumpBeats) {
    flush = true;                // seek / unexpected jump
    this.wrappedAhead = false;
    this.schedUntil = Math.max(0, pos - late);
  }
  this._resumeOk = true;
  this.playing = true;
  this.lastPos = pos;

  var looping = this._inLoop(pos);
  var ahead = this.wrappedAhead ? (this.loop.end - pos) + (this.schedUntil - this.loop.start) : (this.schedUntil - pos);
  var remaining = look - ahead;
  var cur = this.schedUntil, off = ahead;
  var segments = [];
  var guard = 0;
  while (remaining > NOIZ_EPS && guard++ < 64) {
    var end = cur + remaining;
    if (looping && cur < this.loop.end - NOIZ_EPS && end > this.loop.end) end = this.loop.end;
    segments.push({ a: cur, b: end, offset: off });
    remaining -= (end - cur);
    off += (end - cur);
    cur = end;
    if (looping && cur >= this.loop.end - NOIZ_EPS && remaining > NOIZ_EPS) {
      cur = this.loop.start;
      this.wrappedAhead = true;
    }
  }
  this.schedUntil = cur;
  return { segments: segments, flush: flush, playing: true };
};
