// KØRE core — rhythmic scheduler.
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

var KORE_BASE_STEP_BEATS = 0.25;
var KORE_EPS = 1e-9;

function koreStepBeats(track) {
  return KORE_BASE_STEP_BEATS * track.division.m / track.division.n;
}

// Position of global step k of a track, in beats. Same formula everywhere so that
// window boundaries partition events exactly (no doubles, no gaps).
function koreStepPos(track, k) {
  return (k * track.division.m) / (4 * track.division.n);
}

// Deterministic probability roll: f(seed, trackId, cycleIndex, stepIndex, eventKind).
// Independent of window size and UI rate.
var KORE_EVENT_KIND_PROB = 1;
function koreProbabilityPasses(seed, trackId, cycleIndex, stepIndex, probability) {
  if (probability >= 1) return true;
  if (probability <= 0) return false;
  return koreHash01([seed, trackId, cycleIndex, stepIndex, KORE_EVENT_KIND_PROB]) < probability;
}

// Effective ratchet count given a minimum spacing between sub-hits (in beats).
// Fallback (documented): if the step is too short for r sub-hits, reduce r to the
// largest count that respects the spacing (minimum 1). Spacing never collapses.
function koreEffectiveRatchet(ratchet, stepBeats, minSpacingBeats) {
  var r = Math.max(1, Math.min(KORE_MAX_RATCHET, ratchet | 0));
  if (minSpacingBeats > 0) {
    var maxR = Math.max(1, Math.floor(stepBeats / minSpacingBeats + KORE_EPS));
    if (r > maxR) r = maxR;
  }
  return r;
}

// Events with start position in [a, b). opts: {minSpacingBeats, seed}.
// Event: {trackId, beat, stepIndex, cycleIndex, ratchetIndex, ratchetCount,
//         velocity, params:{voice params}, open, levelDb}
function koreEventsInRange(state, a, b, opts) {
  var events = [];
  if (!(b > a)) return events;
  opts = opts || {};
  var seed = koreIsNum(opts.seed) ? opts.seed : state.global.seed;
  var minSpacing = koreIsNum(opts.minSpacingBeats) ? opts.minSpacingBeats : 0;
  for (var t = 0; t < state.tracks.length; t++) {
    var tr = state.tracks[t];
    if (tr.mute) continue;
    var sb = koreStepBeats(tr);
    var kFirst = Math.max(0, Math.floor(a / sb) - 1);
    var kLast = Math.ceil(b / sb) + 1;
    for (var k = kFirst; k <= kLast; k++) {
      var start = koreStepPos(tr, k);
      if (start >= b) break;
      var idx = k % tr.length;
      var cyc = Math.floor(k / tr.length);
      var st = tr.steps[idx];
      if (!st.on) continue;
      var r = koreEffectiveRatchet(st.ratchet, sb, minSpacing);
      // Fast reject: whole step (incl. ratchets) before window.
      if (start + sb <= a && r === 1) continue;
      var passed = null; // roll lazily, once per step (covers all its ratchets)
      for (var i = 0; i < r; i++) {
        var pos = (i === 0) ? start : start + (sb * i) / r;
        if (pos < a || pos >= b) continue;
        if (passed === null) passed = koreProbabilityPasses(seed, tr.id, cyc, idx, st.probability);
        if (!passed) break;
        events.push({
          trackId: tr.id,
          beat: pos,
          stepIndex: idx,
          cycleIndex: cyc,
          ratchetIndex: i,
          ratchetCount: r,
          velocity: st.velocity,
          params: koreEffectiveParams(tr, st),  // P-Locks apply to the whole ratchet cluster
          open: !!st.open,
          levelDb: tr.levelDb
        });
      }
    }
  }
  events.sort(function (x, y) { return (x.beat - y.beat) || (x.trackId - y.trackId) || (x.ratchetIndex - y.ratchetIndex); });
  return events;
}

// Current step index of a track at a position (for the playhead).
function koreStepAt(track, beat) {
  var sb = koreStepBeats(track);
  var k = Math.floor(beat / sb + KORE_EPS);
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

function KoreClock(opts) {
  opts = opts || {};
  this.lookaheadMs = koreIsNum(opts.lookaheadMs) ? opts.lookaheadMs : 40;
  this.lateWindowMs = koreIsNum(opts.lateWindowMs) ? opts.lateWindowMs : 12;
  this.maxForwardJumpBeats = koreIsNum(opts.maxForwardJumpBeats) ? opts.maxForwardJumpBeats : 1.0;
  this.loop = { on: false, start: 0, end: 4 };
  this.lastPos = null;
  this.stillTicks = 0;
  this.playing = false;
  this.schedUntil = null;   // song position up to which events are already queued
  this.wrappedAhead = false; // schedUntil already wrapped to loop start, playhead not yet
}

KoreClock.prototype.setLoop = function (on, start, length) {
  this.loop = { on: !!on && length > 0, start: Math.max(0, +start || 0), end: Math.max(0, +start || 0) + Math.max(0, +length || 0) };
};

KoreClock.prototype._inLoop = function (pos) {
  return this.loop.on && pos < this.loop.end - KORE_EPS && pos >= this.loop.start - KORE_EPS;
};

// Returns null (nothing to do) or {segments:[{a,b,offset}], flush, playing}.
// offset = playback distance (beats) from the current position to segment start;
// may be negative when the JS thread is late (events then fire immediately).
KoreClock.prototype.advance = function (pos, tempo) {
  var bpm = tempo > 0 ? tempo : 120;
  var look = (this.lookaheadMs / 60000) * bpm;
  var late = (this.lateWindowMs / 60000) * bpm;
  var flush = false;
  if (this.lastPos === null) { this.lastPos = pos; return null; }
  var d = pos - this.lastPos;
  if (Math.abs(d) < KORE_EPS) {
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
    this.lastPos >= this.loop.end - look - late - KORE_EPS && pos <= this.loop.start + look + late + KORE_EPS;
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
  while (remaining > KORE_EPS && guard++ < 64) {
    var end = cur + remaining;
    if (looping && cur < this.loop.end - KORE_EPS && end > this.loop.end) end = this.loop.end;
    segments.push({ a: cur, b: end, offset: off });
    remaining -= (end - cur);
    off += (end - cur);
    cur = end;
    if (looping && cur >= this.loop.end - KORE_EPS && remaining > KORE_EPS) {
      cur = this.loop.start;
      this.wrappedAhead = true;
    }
  }
  this.schedUntil = cur;
  return { segments: segments, flush: flush, playing: true };
};
