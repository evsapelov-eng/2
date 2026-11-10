// NØIZ core — musical Generate / Mutate / Random P-Locks.
// Probabilistic, archetype-based (not white-noise random). All randomness comes
// from a seeded NoizRng passed in by the caller.

// Metric weight profiles over a 16th grid, indexed by (stepIndex mod 4):
// 0 = downbeat, 1 = "e", 2 = "and", 3 = "a".
var NOIZ_PROFILE = [
  [0.55, 0.65, 1.00, 0.70],  // HISS: steady offbeat pulse with 16th fills
  [0.25, 0.85, 0.35, 0.95],  // DUST: asymmetric ghosts on e/a
  [0.60, 0.25, 0.55, 0.65],  // METAL: sparse accents, likes gaps
  [1.00, 0.08, 0.35, 0.08]   // ATMOS: rare, on downbeats/half bars
];
// Bar-level emphasis (position within a 16-step bar / 4) to avoid uniform patterns.
var NOIZ_BAR_EMPH = [
  [1.0, 0.9, 1.0, 0.95],
  [0.8, 1.0, 0.9, 1.1],
  [0.9, 1.0, 0.85, 1.15],
  [1.3, 0.7, 1.0, 0.7]
];
var NOIZ_RATCHET_CHANCE = [0.12, 0.09, 0.05, 0.0];
var NOIZ_RATCHET_MAX = [3, 4, 2, 1];
var NOIZ_GHOST_PROB_CHANCE = [0.12, 0.3, 0.2, 0.1];
var NOIZ_MIN_HITS = [3, 2, 1, 1];
var NOIZ_POLY_LENGTHS = [12, 13, 14, 15, 11, 7, 5];
var NOIZ_POLY_DIVS = [{ n: 3, m: 4 }, { n: 5, m: 4 }, { n: 7, m: 4 }, { n: 3, m: 2 }];

function noizScopeRhythm(scope) { return scope === "RHYTHM" || scope === "ALL" || scope === "PATTERN"; }
function noizScopeSound(scope) { return scope === "SOUND" || scope === "ALL"; }
function noizScopePLocks(scope) { return scope === "PLOCKS" || scope === "ALL" || scope === "PATTERN"; }

function noizStepWeight(trackId, idx) {
  return NOIZ_PROFILE[trackId][idx % 4] * NOIZ_BAR_EMPH[trackId][Math.floor(idx / 4) % 4];
}

// Weighted sampling of `count` distinct indices in [0,L) with extra per-index factor.
function noizSampleSteps(rng, L, count, weightFn) {
  var chosen = [], w = [], i;
  for (i = 0; i < L; i++) w.push(weightFn(i));
  for (var c = 0; c < count; c++) {
    var j = rng.weighted(w);
    if (j < 0) break;
    chosen.push(j);
    w[j] = 0;
  }
  return chosen;
}

// Is there a hit of track `t` at 16th-grid step `idx` (only meaningful for 1:1 tracks)?
function noizGridHit(track, idx) {
  if (track.division.n !== 1 || track.division.m !== 1) return false;
  var s = track.steps[idx % track.length];
  return s.on;
}

function noizClearRhythm(track) {
  for (var i = 0; i < NOIZ_MAX_STEPS; i++) {
    var s = track.steps[i];
    s.on = false; s.velocity = 0.7; s.probability = 1; s.ratchet = 1;
  }
}

// Rhythm of one track. `others` = tracks already generated (for complementarity).
function noizGenerateTrackRhythm(track, rng, others, allowPoly) {
  var id = track.id;
  noizClearRhythm(track);
  track.length = 16;
  track.division = { n: 1, m: 1 };
  if (allowPoly) {
    if (rng.chance(0.5)) track.length = rng.pick(NOIZ_POLY_LENGTHS);
    else track.division = noizClone(rng.pick(NOIZ_POLY_DIVS));
  }
  var L = track.length;
  var dens = noizClamp(track.density + rng.range(-0.08, 0.08), 0.04, 0.75);
  var count = Math.max(NOIZ_MIN_HITS[id], Math.round(dens * L));
  count = Math.min(count, Math.max(1, L - 2)); // never all steps
  var idxs = noizSampleSteps(rng, L, count, function (i) {
    var w = noizStepWeight(id, i) * rng.range(0.6, 1.4);
    for (var o = 0; o < others.length; o++) {
      if (noizGridHit(others[o], i)) w *= (id === 1 ? 0.45 : (id === 2 ? 0.55 : 0.8));
    }
    return w;
  });
  for (var j = 0; j < idxs.length; j++) {
    var s = track.steps[idxs[j]];
    var strong = noizStepWeight(id, idxs[j]) >= 0.85;
    s.on = true;
    s.velocity = noizRound(strong ? rng.range(0.78, 0.95) : rng.range(0.42, 0.66), 3);
    s.probability = (!strong && rng.chance(NOIZ_GHOST_PROB_CHANCE[id])) ? noizRound(rng.range(0.45, 0.85), 2) : 1;
    s.ratchet = (NOIZ_RATCHET_MAX[id] > 1 && rng.chance(NOIZ_RATCHET_CHANCE[id])) ? rng.int(2, NOIZ_RATCHET_MAX[id]) : 1;
  }
}

// Limit simultaneous strong transients across all four voices (spec §08.7).
function noizLimitStacking(tracks, rng, extreme) {
  if (extreme) return;
  var stacks = 0;
  for (var i = 0; i < 16; i++) {
    var n = 0;
    for (var t = 0; t < 4; t++) {
      var tr = tracks[t];
      if (noizGridHit(tr, i) && tr.steps[i % tr.length].velocity > 0.75) n++;
    }
    if (n >= 4) {
      stacks++;
      if (stacks > 1 || rng.chance(0.7)) {
        // soften DUST and METAL there instead of removing the groove
        for (var k = 1; k <= 2; k++) {
          var tr2 = tracks[k];
          if (!tr2.locks.rhythm && noizGridHit(tr2, i)) tr2.steps[i % tr2.length].velocity = 0.5;
        }
      }
    }
  }
}

var NOIZ_SOUND_RANGES = [
  { tone: [0.45, 0.9], decay: [0.06, 0.4], texture: [0.15, 0.85], drive: [0, 0.35], pan: [0.3, 0.7] },
  { tone: [0.25, 0.75], decay: [0.15, 0.5], texture: [0.4, 0.95], drive: [0, 0.35], pan: [0.25, 0.75] },
  { tone: [0.3, 0.85], decay: [0.1, 0.55], texture: [0.1, 0.7], drive: [0.05, 0.5], pan: [0.35, 0.65] },
  { tone: [0.1, 0.55], decay: [0.4, 0.9], texture: [0.3, 0.9], drive: [0, 0.25], pan: [0.4, 0.6] }
];
var NOIZ_SYNTH_RANGES = [
  { reso: [0.05, 0.55], attack: [0.0, 0.3], character: [0.0, 0.8], spread: [0.0, 0.6] },
  { reso: [0.3, 0.85], attack: [0.0, 0.35], character: [0.2, 0.9], spread: [0.15, 0.8] },
  { reso: [0.4, 0.9], attack: [0.0, 0.25], character: [0.15, 0.9], spread: [0.0, 0.45] },
  { reso: [0.05, 0.6], attack: [0.45, 0.9], character: [0.4, 1.0], spread: [0.1, 0.6] }
];

function noizGenerateTrackSound(track, rng) {
  var r = NOIZ_SOUND_RANGES[track.id];
  for (var i = 0; i < NOIZ_MACROS.length; i++) {
    var k = NOIZ_MACROS[i];
    track.sound[k] = noizRound(rng.range(r[k][0], r[k][1]), 3);
  }
  if (rng.chance(0.06)) track.sound.drive = noizRound(rng.range(0.5, 0.75), 3); // occasional dirt
  var sr = NOIZ_SYNTH_RANGES[track.id];
  for (var j = 0; j < NOIZ_SYNTH.length; j++) {
    var sk = NOIZ_SYNTH[j];
    track.synth[sk] = noizRound(rng.range(sr[sk][0], sr[sk][1]), 3);
  }
}

// Weights for which macros a random P-Lock touches (avoid DRIVE everywhere).
var NOIZ_LOCK_WEIGHTS = { tone: 0.3, decay: 0.27, texture: 0.16, drive: 0.07, pan: 0.2 };

function noizRandomLockFor(track, step, rng, lockAmount) {
  var locks = {};
  var nParams = rng.weighted([0.55, 0.3, 0.12, 0.03]) + 1;
  var keys = NOIZ_MACROS.slice();
  for (var n = 0; n < nParams; n++) {
    var w = [];
    for (var j = 0; j < keys.length; j++) w.push(NOIZ_LOCK_WEIGHTS[keys[j]]);
    var pick = rng.weighted(w);
    if (pick < 0) break;
    var k = keys[pick];
    keys.splice(pick, 1);
    var dev = rng.range(-lockAmount, lockAmount);
    if (k === "drive" && lockAmount < 0.8) dev = Math.min(dev, 0.35);
    if (k === "pan") dev = rng.range(-1, 1) * Math.min(0.5, lockAmount * 1.4); // audible placement
    locks[k] = noizRound(noizClamp01(track.sound[k] + dev), 3);
  }
  return locks;
}

// Random P-Locks for one track. Never touches on/length/base sound/ratios.
function noizGenerateTrackPLocks(track, rng, lockDensity, lockAmount) {
  for (var i = 0; i < NOIZ_MAX_STEPS; i++) {
    var s = track.steps[i];
    s.pLocks = {};
    if (i >= track.length || !s.on) continue;
    if (lockAmount > 0 && rng.chance(lockDensity)) s.pLocks = noizRandomLockFor(track, s, rng, lockAmount);
  }
}

// GENERATE: returns new tracks array (input untouched). Respects locks.
function noizGenerate(tracks, scope, rng, opts) {
  opts = opts || {};
  var next = noizClone(tracks);
  var done = [];
  // at most one or two polymetric tracks, and not in every pattern
  var polyBudget = rng.chance(0.35) ? (rng.chance(0.25) ? 2 : 1) : 0;
  var order = [0, 1, 2, 3];
  for (var oi = 0; oi < order.length; oi++) {
    var tr = next[order[oi]];
    if (noizScopeRhythm(scope) && !tr.locks.rhythm) {
      var allowPoly = false;
      if (polyBudget > 0 && tr.id !== 0 && rng.chance(0.5)) { allowPoly = true; polyBudget--; }
      noizGenerateTrackRhythm(tr, rng, done, allowPoly);
    }
    done.push(tr);
    if (noizScopeSound(scope) && !tr.locks.sound) noizGenerateTrackSound(tr, rng);
    if (noizScopePLocks(scope) && !tr.locks.sound) {
      noizGenerateTrackPLocks(tr, rng, noizIsNum(opts.lockDensity) ? opts.lockDensity : 0.35,
        noizIsNum(opts.lockAmount) ? opts.lockAmount : 0.25);
    }
  }
  if (noizScopeRhythm(scope)) noizLimitStacking(next, rng, false);
  return next;
}

// ---------- MUTATE ----------

function noizOnSteps(track) {
  var out = [];
  for (var i = 0; i < track.length; i++) if (track.steps[i].on) out.push(i);
  return out;
}
function noizOffSteps(track) {
  var out = [];
  for (var i = 0; i < track.length; i++) if (!track.steps[i].on) out.push(i);
  return out;
}

function noizMoveHit(track, from, to) {
  var a = track.steps[from], b = track.steps[to];
  // Rhythm operations never touch pLocks (they belong to the Sound lock, spec §08).
  b.on = true; b.velocity = a.velocity; b.probability = a.probability; b.ratchet = a.ratchet;
  a.on = false; a.ratchet = 1; a.probability = 1;
}

function noizMutateRhythm(track, amount, rng) {
  if (amount <= 0) return;
  var id = track.id, L = track.length;
  // Expected structural changes: ~1–3 on a 16-step track at 10%.
  var expected = amount * L * 0.9;   // 10% → ~1.4, 25% → ~3.6 on 16 steps
  var changes = Math.floor(expected + rng.next());
  if (changes < 1) changes = 1;
  var target = Math.round(track.density * L);
  for (var c = 0; c < changes; c++) {
    var on = noizOnSteps(track), off = noizOffSteps(track);
    var wMove = 0.5, wAdd = 0.18, wRemove = 0.18, wRatchet = 0.08, wProb = 0.06;
    if (on.length > target + 1) { wAdd *= 0.3; wRemove *= 2; }
    if (on.length < target - 1) { wAdd *= 2; wRemove *= 0.3; }
    if (on.length <= NOIZ_MIN_HITS[id]) wRemove = 0;
    if (off.length <= 1) wAdd = 0;
    var kind = rng.weighted([wMove, wAdd, wRemove, wRatchet, wProb]);
    if (kind === 0 && on.length) {
      var from = rng.pick(on);
      var cands = [];
      for (var d = -2; d <= 2; d++) {
        if (!d) continue;
        var to = (from + d + L) % L;
        if (!track.steps[to].on) cands.push(to);
      }
      if (cands.length) {
        var w = [];
        for (var q = 0; q < cands.length; q++) w.push(noizStepWeight(id, cands[q]));
        noizMoveHit(track, from, cands[rng.weighted(w)]);
      }
    } else if (kind === 1 && off.length) {
      var ws = [];
      for (var q2 = 0; q2 < off.length; q2++) ws.push(noizStepWeight(id, off[q2]));
      var s = track.steps[off[rng.weighted(ws)]];
      s.on = true; s.velocity = noizRound(rng.range(0.42, 0.7), 3); s.probability = 1; s.ratchet = 1;
    } else if (kind === 2 && on.length) {
      var r = track.steps[rng.pick(on)];
      r.on = false; r.ratchet = 1; r.probability = 1;
    } else if (kind === 3 && on.length) {
      var rs = track.steps[rng.pick(on)];
      rs.ratchet = (rs.ratchet > 1) ? 1 : rng.int(2, Math.max(2, NOIZ_RATCHET_MAX[id]));
    } else if (on.length) {
      var ps = track.steps[rng.pick(on)];
      ps.probability = (ps.probability < 1) ? 1 : noizRound(rng.range(0.5, 0.9), 2);
    }
  }
  // gentle velocity drift
  var on2 = noizOnSteps(track);
  for (var v = 0; v < on2.length; v++) {
    if (rng.chance(amount)) {
      var st = track.steps[on2[v]];
      st.velocity = noizRound(noizClamp(st.velocity + rng.gauss() * 0.12 * amount, 0.2, 1), 3);
    }
  }
  // structural (length/division) only at wide amounts
  if (amount >= 0.6 && rng.chance((amount - 0.5) * 0.4) && id !== 0) {
    if (rng.chance(0.5)) track.length = rng.pick(NOIZ_POLY_LENGTHS.concat([16, 16]));
    else track.division = noizClone(rng.pick(NOIZ_POLY_DIVS.concat([{ n: 1, m: 1 }])));
  }
  if (noizCountHits(track) === 0) {
    var any = noizSampleSteps(rng, track.length, 1, function (i) { return noizStepWeight(id, i); });
    track.steps[any[0]].on = true;
  }
}

function noizMutateSound(track, amount, rng) {
  if (amount <= 0) return;
  for (var i = 0; i < NOIZ_MACROS.length; i++) {
    var k = NOIZ_MACROS[i];
    var v = track.sound[k] + rng.gauss() * 0.18 * amount;
    if (k === "drive" && amount < 0.8) v = Math.min(v, Math.max(track.sound[k], 0.7));
    track.sound[k] = noizRound(noizClamp01(v), 3);
  }
  for (var j = 0; j < NOIZ_SYNTH.length; j++) {
    var sk = NOIZ_SYNTH[j];
    track.synth[sk] = noizRound(noizClamp01(track.synth[sk] + rng.gauss() * 0.14 * amount), 3);
  }
}

function noizMutatePLocks(track, amount, rng, lockDensity, lockAmount) {
  if (amount <= 0) return;
  for (var i = 0; i < track.length; i++) {
    var s = track.steps[i];
    if (!s.on) continue;
    var keys = noizShallowKeys(s.pLocks);
    if (keys.length) {
      if (rng.chance(amount * 0.25)) { s.pLocks = {}; continue; }  // dosed removal
      for (var j = 0; j < keys.length; j++) {
        s.pLocks[keys[j]] = noizRound(noizClamp01(s.pLocks[keys[j]] + rng.range(-1, 1) * amount * Math.max(lockAmount, 0.05)), 3);
      }
    } else if (lockAmount > 0 && rng.chance(amount * lockDensity * 0.5)) {
      s.pLocks = noizRandomLockFor(track, s, rng, lockAmount * Math.max(amount, 0.3));
    }
  }
}

function noizCopyRhythm(dst, src) {
  dst.length = src.length;
  dst.division = noizClone(src.division);
  for (var i = 0; i < NOIZ_MAX_STEPS; i++) {
    var d = dst.steps[i], s = src.steps[i];
    d.on = s.on; d.velocity = s.velocity; d.probability = s.probability; d.ratchet = s.ratchet;
  }
}
function noizCopyPLocks(dst, src) {
  for (var i = 0; i < NOIZ_MAX_STEPS; i++) dst.steps[i].pLocks = noizClone(src.steps[i].pLocks);
}

// MUTATE from the Keep anchor. Only scoped & unlocked parts are derived from the
// anchor; everything else stays as currently is. Never mutates its inputs.
function noizMutateFromAnchor(currentTracks, anchorTracks, amount, scope, rng, opts) {
  opts = opts || {};
  var next = noizClone(currentTracks);
  if (amount <= 0) return next; // A07: exact no-op
  var ld = noizIsNum(opts.lockDensity) ? opts.lockDensity : 0.35;
  var la = noizIsNum(opts.lockAmount) ? opts.lockAmount : 0.25;
  for (var t = 0; t < next.length; t++) {
    var tr = next[t], an = anchorTracks[t];
    if (noizScopeRhythm(scope) && !tr.locks.rhythm) {
      noizCopyRhythm(tr, an);
      noizMutateRhythm(tr, amount, rng);
    }
    if (noizScopeSound(scope) && !tr.locks.sound) {
      tr.sound = noizClone(an.sound);
      tr.synth = noizClone(an.synth);
      noizMutateSound(tr, amount, rng);
    }
    if (noizScopePLocks(scope) && !tr.locks.sound) {
      noizCopyPLocks(tr, an);
      noizMutatePLocks(tr, amount, rng, ld, la);
    }
  }
  return noizNormalizeTracks(next);
}
