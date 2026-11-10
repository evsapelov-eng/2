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
// Cycle lengths GENERATE picks from (weights): mostly 5..16, sometimes longer cycles.
var NOIZ_GEN_LENGTHS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 24, 32];
var NOIZ_GEN_LENGTH_W = [1, 2, 3, 3, 2, 3, 3, 4, 3, 3, 3, 4, 1, 1, 1];

// A new cycle length for a voice: never the same as its previous one, never equal to
// all lengths already chosen in this GENERATE (`taken`) so the voices drift apart.
function noizPickLength(rng, prev, taken) {
  for (var tries = 0; tries < 20; tries++) {
    var L = NOIZ_GEN_LENGTHS[rng.weighted(NOIZ_GEN_LENGTH_W)];
    if (L === prev) continue;
    if (taken.length >= 3 && taken[0] === L && taken[1] === L && taken[2] === L) continue;
    return L;
  }
  return prev === 16 ? 12 : 16;
}

function noizGenerateTrackRhythm(track, rng, others, allowPoly, taken) {
  var id = track.id;
  var prevLen = track.length;
  noizClearRhythm(track);
  track.length = noizPickLength(rng, prevLen, taken || []);
  track.division = { n: 1, m: 1 };
  if (allowPoly) track.division = noizClone(rng.pick(NOIZ_POLY_DIVS));
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

// ---------- sound archetypes (GENERATE picks a different kind of sound each time) ----------
// Ranges for: tone, decay, texture, drive, reso, attack, character, spread.
var NOIZ_ARCH_KEYS = ["tone", "decay", "texture", "drive", "reso", "attack", "character", "spread"];
var NOIZ_ARCHETYPES = [
  [ // HISS
    { name: "CLOSED HAT", r: [[0.6, 0.9], [0.04, 0.2], [0.2, 0.6], [0, 0.2], [0.05, 0.3], [0, 0.1], [0, 0.3], [0, 0.4]] },
    { name: "OPEN HAT", r: [[0.5, 0.8], [0.45, 0.75], [0.3, 0.7], [0.05, 0.3], [0.1, 0.45], [0, 0.15], [0.1, 0.5], [0.1, 0.5]] },
    { name: "SHAKER", r: [[0.4, 0.7], [0.2, 0.45], [0.5, 0.9], [0, 0.2], [0.05, 0.3], [0.35, 0.6], [0, 0.3], [0.3, 0.8]] },
    { name: "TICK", r: [[0.7, 1], [0, 0.1], [0, 0.3], [0.2, 0.6], [0.4, 0.85], [0, 0.05], [0.5, 1], [0, 0.5]] },
    { name: "AIR", r: [[0.15, 0.5], [0.3, 0.65], [0.5, 1], [0, 0.1], [0, 0.2], [0.25, 0.55], [0.6, 1], [0.3, 0.9]] }
  ],
  [ // DUST
    { name: "GRAIN SHAKER", r: [[0.4, 0.75], [0.15, 0.4], [0.5, 0.95], [0, 0.25], [0.3, 0.7], [0.1, 0.4], [0.5, 0.9], [0.3, 0.8]] },
    { name: "CRACKLE", r: [[0.3, 0.9], [0.2, 0.5], [0.6, 1], [0, 0.3], [0.2, 0.6], [0, 0.2], [0.8, 1], [0.4, 1]] },
    { name: "SNARE NOISE", r: [[0.2, 0.45], [0.3, 0.55], [0.3, 0.7], [0.3, 0.6], [0.3, 0.6], [0, 0.1], [0, 0.35], [0, 0.3]] },
    { name: "RIM", r: [[0.45, 0.8], [0, 0.15], [0, 0.3], [0.2, 0.5], [0.7, 0.95], [0, 0.05], [0, 0.3], [0, 0.4]] },
    { name: "BRUSH", r: [[0.3, 0.6], [0.35, 0.65], [0.4, 0.8], [0, 0.15], [0.1, 0.4], [0.4, 0.75], [0.2, 0.6], [0.2, 0.7]] }
  ],
  [ // METAL
    { name: "COWBELL", r: [[0.3, 0.55], [0.15, 0.4], [0.05, 0.3], [0.1, 0.4], [0.5, 0.9], [0, 0.05], [0.35, 0.6], [0, 0.3]] },
    { name: "BELL", r: [[0.45, 0.8], [0.6, 0.95], [0, 0.2], [0, 0.2], [0.3, 0.7], [0, 0.1], [0.6, 1], [0, 0.4]] },
    { name: "CLANK", r: [[0.2, 0.6], [0.05, 0.3], [0.4, 0.8], [0.4, 0.8], [0.3, 0.7], [0, 0.05], [0.2, 0.8], [0.1, 0.5]] },
    { name: "TINE", r: [[0.7, 1], [0.25, 0.6], [0, 0.25], [0, 0.25], [0.6, 1], [0, 0.05], [0, 0.4], [0, 0.6]] },
    { name: "GONG", r: [[0, 0.3], [0.7, 1], [0.1, 0.4], [0.1, 0.4], [0.2, 0.6], [0.05, 0.3], [0.7, 1], [0, 0.3]] }
  ],
  [ // ATMOS
    { name: "SWELL", r: [[0.2, 0.6], [0.7, 1], [0.4, 0.8], [0, 0.2], [0, 0.4], [0.75, 1], [0.6, 1], [0.1, 0.5]] },
    { name: "GHOST TOM", r: [[0.15, 0.4], [0.3, 0.55], [0.1, 0.4], [0.1, 0.4], [0.6, 0.92], [0.05, 0.3], [0.2, 0.6], [0, 0.4]] },
    { name: "WIND", r: [[0.35, 0.75], [0.55, 0.9], [0.7, 1], [0, 0.15], [0, 0.3], [0.5, 0.85], [0.8, 1], [0.3, 0.9]] },
    { name: "SUB THUMP", r: [[0, 0.2], [0.2, 0.45], [0.3, 0.7], [0.2, 0.55], [0.2, 0.6], [0, 0.2], [0, 0.4], [0, 0.2]] },
    { name: "WASH", r: [[0.5, 0.9], [0.6, 1], [0.2, 0.7], [0, 0.25], [0.1, 0.5], [0.3, 0.7], [0.5, 1], [0.4, 1]] }
  ]
];
var NOIZ_WILD_CHANCE = 0.2;

// New sound for one voice: a random archetype (different from the last one) with every
// parameter randomised inside it, or a WILD sound over almost the full range. Every
// base value is guaranteed to differ from the previous sound.
function noizGenerateTrackSound(track, rng) {
  var prevS = noizClone(track.sound), prevY = noizClone(track.synth);
  var list = NOIZ_ARCHETYPES[track.id], arch = null, name;
  if (rng.chance(NOIZ_WILD_CHANCE)) {
    name = "WILD";
  } else {
    var idx = rng.int(0, list.length - 1);
    if (list[idx].name === track.soundName) idx = (idx + 1 + rng.int(0, list.length - 2)) % list.length;
    arch = list[idx];
    name = arch.name;
  }
  for (var i = 0; i < NOIZ_ARCH_KEYS.length; i++) {
    var k = NOIZ_ARCH_KEYS[i];
    var r = arch ? arch.r[i] : (k === "drive" ? [0, 0.8] : (k === "attack" ? [0, 0.9] : [0, 1]));
    var v = noizRound(rng.range(r[0], r[1]), 3);
    if (NOIZ_SYNTH.indexOf(k) >= 0) track.synth[k] = v; else track.sound[k] = v;
  }
  var panW = track.id === 3 ? 0.18 : 0.32;
  track.sound.pan = noizRound(rng.range(0.5 - panW, 0.5 + panW), 3);
  track.soundName = name;
  for (var j = 0; j < NOIZ_MACROS.length; j++) {
    var mk = NOIZ_MACROS[j];
    if (track.sound[mk] === prevS[mk]) track.sound[mk] = noizNudge(track.sound[mk], 0.05, rng);
  }
  for (var q = 0; q < NOIZ_SYNTH.length; q++) {
    var sk = NOIZ_SYNTH[q];
    if (track.synth[sk] === prevY[sk]) track.synth[sk] = noizNudge(track.synth[sk], 0.05, rng);
  }
}

// Weights for which macros a random P-Lock touches (avoid DRIVE everywhere).
var NOIZ_LOCK_WEIGHTS = { tone: 0.2, decay: 0.18, texture: 0.11, drive: 0.05, pan: 0.15,
  reso: 0.1, attack: 0.07, character: 0.09, spread: 0.05 };


// ---------- per-step parameter lanes ----------
// GENERATE gives most parameters of every voice its own per-step "lane" (P-Locks on
// every step of the cycle), with a random shape and depth, so each press draws a new
// picture for tone, decay, texture, drive, pan, reso, attack, character and spread.
// lockDensity = probability that a parameter gets a lane; lockAmount scales the depth.

// depth range (fraction of the 0..1 range, ± around the voice value) per parameter
var NOIZ_LANE_DEPTH = {
  tone: [0.12, 0.4], decay: [0.15, 0.5], texture: [0.15, 0.5], drive: [0.05, 0.22], pan: [0.35, 1.0],
  reso: [0.15, 0.55], attack: [0.1, 0.45], character: [0.15, 0.5], spread: [0.15, 0.5]
};
var NOIZ_LANE_STYLES = ["random", "ramp", "alternate", "wave", "accent", "walk"];
// style weights per parameter (same order as NOIZ_LANE_STYLES)
var NOIZ_LANE_STYLE_W = {
  tone: [3, 2, 1, 2, 2, 3], decay: [3, 1, 2, 2, 3, 2], texture: [3, 1, 1, 2, 2, 3], drive: [2, 1, 1, 1, 3, 1],
  pan: [3, 1, 4, 3, 1, 2], reso: [2, 2, 1, 3, 3, 2], attack: [2, 2, 2, 2, 3, 1], character: [3, 2, 1, 2, 2, 3],
  spread: [3, 1, 2, 2, 2, 2]
};

// Shape value in [-1, 1] for each of L steps.
function noizLaneShape(style, L, rng) {
  var out = [], i;
  if (style === "random") {
    for (i = 0; i < L; i++) out.push(rng.range(-1, 1));
  } else if (style === "ramp") {
    var dir = rng.chance(0.5) ? 1 : -1;
    for (i = 0; i < L; i++) out.push(dir * (L > 1 ? -1 + (2 * i) / (L - 1) : 0));
  } else if (style === "alternate") {
    var per = rng.pick([2, 2, 3, 4]), sg = rng.chance(0.5) ? 1 : -1;
    for (i = 0; i < L; i++) out.push(sg * ((i % per) < per / 2 ? 1 : -1) * rng.range(0.7, 1));
  } else if (style === "wave") {
    var period = rng.pick([3, 4, 5, 6, 8, 12, 16]), phase = rng.range(0, Math.PI * 2);
    for (i = 0; i < L; i++) out.push(Math.sin(phase + (2 * Math.PI * i) / period));
  } else if (style === "accent") {
    for (i = 0; i < L; i++) out.push(rng.chance(0.28) ? (rng.chance(0.7) ? 1 : -1) * rng.range(0.6, 1) : rng.range(-0.15, 0.15));
  } else { // walk
    var x = rng.range(-0.5, 0.5);
    for (i = 0; i < L; i++) { x = noizClamp(x + rng.range(-0.45, 0.45), -1, 1); out.push(x); }
  }
  return out;
}

// Draws one lane of `key` on a track: values for every step of the cycle.
function noizDrawLane(track, key, rng, depthScale) {
  var L = track.length;
  var w = NOIZ_LANE_STYLE_W[key] || [1, 1, 1, 1, 1, 1];
  var style = NOIZ_LANE_STYLES[rng.weighted(w)];
  var dr = NOIZ_LANE_DEPTH[key];
  var depth = rng.range(dr[0], dr[1]) * depthScale;
  var base = key === "pan" ? 0.5 + (noizBaseParam(track, key) - 0.5) * 0.5 : noizBaseParam(track, key);
  // keep the whole shape inside 0..1 (a voice value near 0 or 1 would flatten half of it)
  var room = Math.min(depth, 0.5);
  base = noizClamp(base, room, 1 - room);
  var shape = noizLaneShape(style, L, rng);
  for (var i = 0; i < NOIZ_MAX_STEPS; i++) {
    var st = track.steps[i];
    if (i < L) st.pLocks[key] = noizRound(noizClamp01(base + depth * shape[i]), 3);
    else delete st.pLocks[key];
  }
  return style;
}

// Random per-step lanes for one track. Never touches on/length/base sound/ratios.
function noizGenerateTrackPLocks(track, rng, lockDensity, lockAmount) {
  for (var i = 0; i < NOIZ_MAX_STEPS; i++) track.steps[i].pLocks = {};
  if (lockAmount <= 0 || lockDensity <= 0) return;
  var depthScale = Math.min(2, lockAmount / 0.5); // lockAmount 0.5 = nominal depth
  for (var k = 0; k < NOIZ_LOCKABLE.length; k++) {
    if (rng.chance(lockDensity)) noizDrawLane(track, NOIZ_LOCKABLE[k], rng, depthScale);
  }
}

// Single-step random lock (used by MUTATE to add a few new values).
function noizRandomLockFor(track, step, rng, lockAmount) {
  var locks = {};
  var nParams = rng.weighted([0.4, 0.32, 0.18, 0.1]) + 1;
  var keys = NOIZ_LOCKABLE.slice();
  for (var n = 0; n < nParams; n++) {
    var w = [];
    for (var j = 0; j < keys.length; j++) w.push(NOIZ_LOCK_WEIGHTS[keys[j]]);
    var pick = rng.weighted(w);
    if (pick < 0) break;
    var k = keys[pick];
    keys.splice(pick, 1);
    var dev = rng.range(-lockAmount, lockAmount);
    if (k === "drive" && lockAmount < 0.8) dev = Math.min(dev, 0.35);
    if (k === "pan") dev = rng.range(-1, 1) * Math.min(0.5, lockAmount * 1.4);
    locks[k] = noizRound(noizClamp01(noizBaseParam(track, k) + dev), 3);
  }
  return locks;
}

// GENERATE: returns new tracks array (input untouched). Respects locks.
function noizGenerate(tracks, scope, rng, opts) {
  opts = opts || {};
  var next = noizClone(tracks);
  var done = [];
  // at most one or two polymetric tracks, and not in every pattern
  var polyBudget = rng.chance(0.3) ? 1 : 0; // an extra n:m ratio now and then (lengths always vary)
  var taken = [];
  var order = [0, 1, 2, 3];
  for (var oi = 0; oi < order.length; oi++) {
    var tr = next[order[oi]];
    if (noizScopeRhythm(scope) && !tr.locks.rhythm) {
      var allowPoly = false;
      if (polyBudget > 0 && tr.id !== 0 && rng.chance(0.5)) { allowPoly = true; polyBudget--; }
      noizGenerateTrackRhythm(tr, rng, done, allowPoly, taken);
      taken.push(tr.length);
    }
    done.push(tr);
    if (noizScopeSound(scope) && !tr.locks.sound) noizGenerateTrackSound(tr, rng);
    if (noizScopePLocks(scope) && !tr.locks.sound) {
      noizGenerateTrackPLocks(tr, rng, noizIsNum(opts.lockDensity) ? opts.lockDensity : 1.0,
        noizIsNum(opts.lockAmount) ? opts.lockAmount : 0.5);
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

// Moves v by a random amount that is never ~zero (every value really changes);
// at a range end it moves inwards.
function noizNudge(v, size, rng) {
  var d = (rng.chance(0.5) ? 1 : -1) * rng.range(0.4, 1) * size;
  if (Math.abs(d) < 0.01) d = d < 0 ? -0.01 : 0.01;
  var nv = noizClamp01(v + d);
  if (Math.abs(nv - v) < 0.005) nv = noizClamp01(v - d);
  return noizRound(nv, 3);
}

// MUTATE sound: every base sound and synth value of the voice changes.
function noizMutateSound(track, amount, rng) {
  if (amount <= 0) return;
  for (var i = 0; i < NOIZ_MACROS.length; i++) {
    var k = NOIZ_MACROS[i];
    var nv = noizNudge(track.sound[k], 0.3 * amount, rng);
    // no runaway distortion at moderate amounts: mirror the step downwards instead
    if (k === "drive" && amount < 0.8 && nv > 0.7 && nv > track.sound[k]) nv = noizRound(Math.max(0, 2 * track.sound[k] - nv), 3);
    track.sound[k] = nv;
  }
  for (var j = 0; j < NOIZ_SYNTH.length; j++) {
    var sk = NOIZ_SYNTH[j];
    track.synth[sk] = noizNudge(track.synth[sk], 0.25 * amount, rng);
  }
}

// MUTATE per-step values: every parameter has a lane afterwards and every value of
// every lane changes; at larger amounts some lanes are redrawn with a new shape.
function noizMutatePLocks(track, amount, rng, lockDensity, lockAmount) {
  if (amount <= 0) return;
  var depthScale = Math.min(2, lockAmount / 0.5);
  for (var k = 0; k < NOIZ_LOCKABLE.length; k++) {
    var key = NOIZ_LOCKABLE[k], has = true, i;
    for (i = 0; i < track.length; i++) if (!track.steps[i].pLocks.hasOwnProperty(key)) has = false;
    if (!has || rng.chance(Math.max(0, amount - 0.25) * 0.6)) {
      noizDrawLane(track, key, rng, depthScale * (has ? 1 : Math.max(amount, 0.4)));
      continue;
    }
    for (i = 0; i < track.length; i++) {
      var pl = track.steps[i].pLocks;
      pl[key] = noizNudge(pl[key], amount * 0.3 * depthScale, rng);
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
  noizEnsureChanged(next, currentTracks, scope, rng);
  return noizNormalizeTracks(next);
}

// Every MUTATE must audibly move every value of every unlocked voice compared with
// what was playing right before the press (not only compared with the Keep anchor).
function noizEnsureChanged(next, current, scope, rng) {
  for (var t = 0; t < next.length; t++) {
    var tr = next[t], cur = current[t], i, k, guard;
    if (tr.locks.sound) continue;
    if (noizScopeSound(scope)) {
      for (i = 0; i < NOIZ_MACROS.length; i++) {
        k = NOIZ_MACROS[i];
        for (guard = 0; guard < 6 && tr.sound[k] === cur.sound[k]; guard++) tr.sound[k] = noizNudge(tr.sound[k], 0.02, rng);
      }
      for (i = 0; i < NOIZ_SYNTH.length; i++) {
        k = NOIZ_SYNTH[i];
        for (guard = 0; guard < 6 && tr.synth[k] === cur.synth[k]; guard++) tr.synth[k] = noizNudge(tr.synth[k], 0.02, rng);
      }
    }
    if (noizScopePLocks(scope)) {
      for (var s = 0; s < tr.length; s++) {
        var pl = tr.steps[s].pLocks, cp = cur.steps[s].pLocks;
        for (i = 0; i < NOIZ_LOCKABLE.length; i++) {
          k = NOIZ_LOCKABLE[i];
          if (!pl.hasOwnProperty(k)) continue;
          for (guard = 0; guard < 6 && cp.hasOwnProperty(k) && pl[k] === cp[k]; guard++) pl[k] = noizNudge(pl[k], 0.02, rng);
        }
      }
    }
  }
}
