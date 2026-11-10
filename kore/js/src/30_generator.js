// KØRE core — genre-aware GENERATE / MUTATE (spec §11–§12 + user decisions D1–D4).
// All randomness from a seeded KoreRng. PUNCH keeps strict four-on-the-floor; its SOUND
// is regenerated. Other voices get new rhythm, length, sound and per-step lanes.

function koreScopeRhythm(s) { return s === "RHYTHM" || s === "ALL"; }
function koreScopeSound(s) { return s === "SOUND" || s === "ALL"; }
function koreScopePLocks(s) { return s === "PLOCKS" || s === "ALL"; }

// ---------- style recipes (spec §11 table) ----------
// lens: cycle lengths per voice [SUB, RUMBLE, TOM L, TOM H, HAT]
var KORE_STYLE = {
  FOUNDATION: { pickup: 0, sub: [1, 2], tomL: [1, 2], tomH: [0, 2], hat16: 0.08, hatOpen: [0, 1], fill: 0.1, poly: 0.1,
    lens: [[16, 32, 8], [16, 8, 32], [16, 8, 12, 32], [16, 12, 8, 32], [16, 8, 32]] },
  DRIVING: { pickup: 0.45, sub: [2, 4], tomL: [2, 3], tomH: [1, 3], hat16: 0.35, hatOpen: [1, 2], fill: 0.35, poly: 0.2,
    lens: [[16, 8, 12], [16, 8, 12], [16, 12, 14, 10], [16, 12, 14, 10], [16, 12, 8, 14]] },
  HYPNOTIC: { pickup: 0.1, sub: [2, 3], tomL: [2, 3], tomH: [2, 3], hat16: 0.15, hatOpen: [1, 1], fill: 0.05, poly: 0.45,
    lens: [[16, 12, 8], [16, 12, 6], [7, 11, 13, 5, 9], [5, 7, 11, 13, 10], [12, 15, 16, 14, 6]] },
  BROKEN: { pickup: 0.3, sub: [2, 4], tomL: [2, 4], tomH: [2, 4], hat16: 0.3, hatOpen: [1, 2], fill: 0.3, poly: 0.25,
    lens: [[16, 12, 10, 14], [16, 10, 14], [10, 12, 13, 14, 16], [10, 11, 13, 14, 16], [12, 13, 14, 15, 16]] }
};
var KORE_POLY_DIVS = [{ n: 3, m: 4 }, { n: 5, m: 4 }, { n: 7, m: 4 }];

// position weights by 16th position (mod 4: 0 beat, 1 e, 2 and, 3 a)
var KORE_PROFILE = [
  [1, 0.1, 0.2, 0.1],     // PUNCH (only pickups use this)
  [0.15, 0.6, 1, 0.7],    // SUB: responses between kicks
  [0.6, 0.3, 1, 0.3],     // RUMBLE gates
  [0.15, 0.6, 0.6, 1],    // TOM L: syncopated, off the kick
  [0.15, 0.9, 0.5, 1],    // TOM H
  [0.25, 0.6, 1, 0.6]     // HAT: offbeat
];
var KORE_MOTIFS_TOM = [[3, 11], [3, 7, 11], [5, 13], [6, 14], [7, 15], [3, 6, 11, 14], [10, 13], [2, 7, 13], [1, 9], [3, 10]];

function koreClearRhythm(track) {
  for (var i = 0; i < KORE_MAX_STEPS; i++) {
    var s = track.steps[i];
    s.on = false; s.velocity = 0.8; s.probability = 1; s.ratchet = 1; s.open = false;
  }
}
function koreSet(track, idx, vel, prob, ratchet, open) {
  if (idx < 0 || idx >= track.length) return;
  var s = track.steps[idx];
  s.on = true; s.velocity = koreRound(vel, 3); s.probability = prob === undefined ? 1 : koreRound(prob, 2);
  s.ratchet = ratchet || 1; s.open = !!open;
}
function koreHitAt(track, beatIdx16) { // is there a hit of a 1:1 track at 16th index?
  if (track.division.n !== 1 || track.division.m !== 1) return false;
  return track.steps[beatIdx16 % track.length].on;
}

// New length for a voice, different from its previous one (user request).
function korePickLength(rng, options, prev) {
  var opts = [];
  for (var i = 0; i < options.length; i++) if (options[i] !== prev) opts.push(options[i]);
  return opts.length ? rng.pick(opts) : (prev === 16 ? 12 : 16);
}

// PUNCH: a steady techno kick — exactly four equal hits (user D6: no ghost kicks,
// no per-hit variation). BROKEN may move one only when "unlock punch" is on.
function koreGenPunch(tr, rng, cfg, g) {
  koreClearRhythm(tr);
  tr.length = 16; tr.division = { n: 1, m: 1 };
  for (var i = 0; i < 4; i++) koreSet(tr, KORE_FOUR_ON_FLOOR[i], 1);
  if (g.style === "BROKEN" && g.unlockPunch && rng.chance(0.6)) {
    tr.steps[rng.pick([4, 8, 12])].on = false;          // selective omission, keep the downbeat
    koreSet(tr, rng.pick([3, 10, 11, 14]), rng.range(0.7, 0.9));
  }
}

function korePlaceWeighted(tr, rng, count, weightFn, velFn) {
  var w = [], i;
  for (i = 0; i < tr.length; i++) w.push(tr.steps[i].on ? 0 : weightFn(i));
  for (var c = 0; c < count; c++) {
    var j = rng.weighted(w);
    if (j < 0) break;
    w[j] = 0;
    var v = velFn(j);
    koreSet(tr, j, v[0], v[1]);
  }
}

function koreGenSub(tr, prev, rng, cfg, g, punch) {
  koreClearRhythm(tr);
  tr.length = korePickLength(rng, cfg.lens[0], prev.length); tr.division = { n: 1, m: 1 };
  var layer = g.kickInteraction === "LAYER" || (g.kickInteraction === "HYBRID" && rng.chance(0.25));
  var n = rng.int(cfg.sub[0], cfg.sub[1]) * Math.max(1, Math.round(tr.length / 16));
  korePlaceWeighted(tr, rng, n, function (i) {
    var w = KORE_PROFILE[1][i % 4] * (koreHitAt(punch, i) ? (g.kickInteraction === "ALTERNATE" ? 0 : 0.15) : 1);
    return w * rng.range(0.6, 1.4);
  }, function () { return [rng.range(0.6, 0.9), rng.chance(0.2) ? rng.range(0.6, 0.9) : 1]; });
  if (layer) koreSet(tr, 0, rng.range(0.45, 0.6)); // controlled layer under the downbeat
}

function koreGenRumble(tr, prev, rng, cfg, g) {
  koreClearRhythm(tr);
  tr.length = korePickLength(rng, cfg.lens[1], prev.length); tr.division = { n: 1, m: 1 };
  var mode = rng.pick(["offbeat", "kick", "sparse", "pulse"]);
  for (var i = 0; i < tr.length; i++) {
    var m = i % 4;
    if (mode === "offbeat" && m === 2) koreSet(tr, i, rng.range(0.75, 1));
    else if (mode === "kick" && m === 0) koreSet(tr, i, rng.range(0.7, 0.95));
    else if (mode === "sparse" && i % 8 === 2) koreSet(tr, i, rng.range(0.8, 1));
    else if (mode === "pulse" && i % 2 === 1 && rng.chance(0.6)) koreSet(tr, i, rng.range(0.5, 0.8), rng.chance(0.3) ? 0.7 : 1);
  }
  if (koreCountHits(tr) === 0) koreSet(tr, 2, 0.9);
}

function koreGenTom(tr, prev, rng, cfg, idx, others, punch) {
  koreClearRhythm(tr);
  tr.length = korePickLength(rng, cfg.lens[idx], prev.length);
  tr.division = rng.chance(cfg.poly) ? koreClone(rng.pick(KORE_POLY_DIVS)) : { n: 1, m: 1 };
  var range = idx === 2 ? cfg.tomL : cfg.tomH;
  var motif = rng.pick(KORE_MOTIFS_TOM), want = rng.int(Math.max(1, range[0]), Math.max(1, range[1]));
  var placed = 0;
  for (var i = 0; i < motif.length && placed < want; i++) {
    var p = motif[i] % tr.length;
    if (koreHitAt(punch, p) || others.some(function (o) { return koreHitAt(o, p); })) continue;
    koreSet(tr, p, rng.range(0.6, 0.9), rng.chance(0.2) ? rng.range(0.55, 0.85) : 1);
    placed++;
  }
  if (placed < want) korePlaceWeighted(tr, rng, want - placed, function (j) { return KORE_PROFILE[idx + 1][j % 4] * (koreHitAt(punch, j) ? 0.1 : 1); },
    function () { return [rng.range(0.55, 0.85), 1]; });
  if (rng.chance(cfg.fill) && tr.length >= 12) koreSet(tr, tr.length - 1, rng.range(0.6, 0.85), 1, rng.int(2, 3)); // short fill
  if (koreCountHits(tr) === 0) koreSet(tr, Math.min(3, tr.length - 1), 0.7);
}

function koreGenHat(tr, prev, rng, cfg) {
  koreClearRhythm(tr);
  tr.length = korePickLength(rng, cfg.lens[4], prev.length);
  tr.division = rng.chance(cfg.poly * 0.4) ? { n: 3, m: 4 } : { n: 1, m: 1 };
  var shift = (tr.length % 4 !== 0 && rng.chance(0.5)) ? 1 : 0; // cyclic displacement
  for (var i = 0; i < tr.length; i++) {
    if ((i + shift) % 4 === 2) koreSet(tr, i, rng.range(0.7, 0.95));
    else if (rng.chance(cfg.hat16) && (i % 2 === 1)) koreSet(tr, i, rng.range(0.35, 0.6), rng.chance(0.4) ? rng.range(0.5, 0.85) : 1, rng.chance(0.08) ? 2 : 1);
  }
  var opens = rng.int(cfg.hatOpen[0], cfg.hatOpen[1]), offs = [];
  for (var j = 0; j < tr.length; j++) if (tr.steps[j].on && tr.steps[j].velocity > 0.65) offs.push(j);
  for (var o = 0; o < opens && offs.length; o++) tr.steps[offs.splice(rng.int(0, offs.length - 1), 1)[0]].open = true;
  if (koreCountHits(tr) < 2) { koreSet(tr, 2 % tr.length, 0.8); koreSet(tr, 6 % tr.length, 0.8); }
}

// Validation (spec §11.7): anchors, low-end overlap, density. Returns "" if fine.
function koreValidateGroove(tracks, g) {
  var punch = tracks[KORE_PUNCH];
  if (!(g.style === "BROKEN" && g.unlockPunch)) {
    for (var i = 0; i < 4; i++) if (!punch.steps[KORE_FOUR_ON_FLOOR[i]].on) return "punch anchor missing";
  }
  var heavy = 0;
  for (var s = 0; s < 16; s++) {
    var lf = 0;
    if (koreHitAt(punch, s)) lf++;
    if (koreHitAt(tracks[KORE_SUB], s) && tracks[KORE_SUB].steps[s % tracks[KORE_SUB].length].velocity > 0.6) lf++;
    if (koreHitAt(tracks[KORE_TOML], s)) lf++;
    if (lf >= 3) heavy++;
  }
  if (heavy > 1) return "too many stacked low-end hits";
  for (var t = 1; t < tracks.length; t++) {
    var tr = tracks[t], h = koreCountHits(tr);
    if (h === 0) return tr.name + " silent";
    if (h >= tr.length) return tr.name + " full";
  }
  return "";
}

function koreGenerateRhythm(next, prev, rng, g) {
  var cfg = KORE_STYLE[g.style] || KORE_STYLE.FOUNDATION;
  for (var attempt = 0; attempt < 16; attempt++) {
    var cand = koreClone(next);
    if (!cand[KORE_PUNCH].locks.rhythm) koreGenPunch(cand[KORE_PUNCH], rng, cfg, g);
    var punch = cand[KORE_PUNCH];
    if (!cand[KORE_SUB].locks.rhythm) koreGenSub(cand[KORE_SUB], prev[KORE_SUB], rng, cfg, g, punch);
    if (!cand[KORE_RUMBLE].locks.rhythm) koreGenRumble(cand[KORE_RUMBLE], prev[KORE_RUMBLE], rng, cfg, g);
    if (!cand[KORE_TOML].locks.rhythm) koreGenTom(cand[KORE_TOML], prev[KORE_TOML], rng, cfg, 2, [], punch);
    if (!cand[KORE_TOMH].locks.rhythm) koreGenTom(cand[KORE_TOMH], prev[KORE_TOMH], rng, cfg, 3, [cand[KORE_TOML]], punch);
    if (!cand[KORE_HAT].locks.rhythm) koreGenHat(cand[KORE_HAT], prev[KORE_HAT], rng, cfg);
    if (!koreValidateGroove(cand, g)) return cand;
  }
  // bounded: conservative FOUNDATION for the unlocked voices
  var safe = koreClone(next), def = koreDefaultState().tracks;
  for (var t = 0; t < safe.length; t++) {
    if (safe[t].locks.rhythm) continue;
    for (var i = 0; i < KORE_MAX_STEPS; i++) {
      var p = safe[t].steps[i].pLocks;
      safe[t].steps[i] = koreClone(def[t].steps[i]);
      safe[t].steps[i].pLocks = p;
    }
    safe[t].length = 16; safe[t].division = { n: 1, m: 1 };
  }
  return safe;
}

// ---------- sound ----------
// Ranges per voice param (order = KORE_VOICE_PARAMS). PUNCH: club-ready techno kicks.
var KORE_ARCHETYPES = [
  [ // tune punch time body decay drive click clicktone
    { name: "TECHNO", r: [[0.3, 0.5], [0.45, 0.7], [0.4, 0.6], [0.25, 0.5], [0.4, 0.6], [0.3, 0.55], [0.25, 0.5], [0.4, 0.65]] },
    { name: "HARD", r: [[0.35, 0.55], [0.6, 0.9], [0.25, 0.45], [0.3, 0.6], [0.3, 0.5], [0.6, 0.9], [0.4, 0.7], [0.5, 0.8]] },
    { name: "DEEP", r: [[0.1, 0.3], [0.35, 0.55], [0.55, 0.8], [0.4, 0.7], [0.6, 0.85], [0.15, 0.35], [0.1, 0.3], [0.2, 0.45]] },
    { name: "ROLLING", r: [[0.25, 0.45], [0.4, 0.6], [0.5, 0.7], [0.15, 0.35], [0.55, 0.8], [0.35, 0.6], [0.15, 0.35], [0.3, 0.55]] },
    { name: "TIGHT", r: [[0.4, 0.65], [0.5, 0.8], [0.2, 0.4], [0.1, 0.3], [0.15, 0.35], [0.25, 0.5], [0.45, 0.75], [0.55, 0.85]] },
    { name: "DISTORTED", r: [[0.3, 0.5], [0.55, 0.85], [0.3, 0.55], [0.35, 0.65], [0.35, 0.6], [0.8, 1], [0.3, 0.6], [0.4, 0.7]] }
  ],
  [ // SUB: tune decay sweep drive
    { name: "LOW", r: [[0, 0.35], [0.3, 0.7], [0.05, 0.3], [0, 0.2]] }, { name: "MID", r: [[0.35, 0.7], [0.2, 0.5], [0.2, 0.5], [0.1, 0.4]] },
    { name: "LONG", r: [[0.1, 0.6], [0.6, 0.95], [0, 0.25], [0, 0.25]] }, { name: "GRIT", r: [[0.2, 0.6], [0.3, 0.6], [0.2, 0.6], [0.5, 0.9]] }
  ],
  [ // RUMBLE: amount tail duck tone drive
    { name: "SOFT", r: [[0.2, 0.4], [0.3, 0.6], [0.5, 0.8], [0.2, 0.5], [0, 0.25]] }, { name: "DEEP", r: [[0.35, 0.65], [0.55, 0.9], [0.4, 0.75], [0.1, 0.4], [0.1, 0.4]] },
    { name: "PULSE", r: [[0.3, 0.55], [0.1, 0.35], [0.6, 0.95], [0.3, 0.6], [0.2, 0.5]] }, { name: "DIRTY", r: [[0.3, 0.6], [0.4, 0.7], [0.5, 0.85], [0.4, 0.8], [0.6, 1]] }
  ],
  [ // TOM L: tune decay sweep tone snap
    { name: "LOW TOM", r: [[0.05, 0.4], [0.3, 0.7], [0.4, 0.8], [0.1, 0.4], [0.1, 0.4]] }, { name: "CONGA", r: [[0.35, 0.7], [0.15, 0.4], [0.2, 0.5], [0.3, 0.6], [0.3, 0.6]] },
    { name: "METAL TOM", r: [[0.3, 0.8], [0.2, 0.5], [0.3, 0.7], [0.6, 0.9], [0.4, 0.8]] }, { name: "ZAP", r: [[0.2, 0.6], [0.1, 0.35], [0.7, 1], [0.1, 0.4], [0.2, 0.5]] }
  ],
  [ // TOM H
    { name: "HIGH TOM", r: [[0.3, 0.7], [0.2, 0.55], [0.3, 0.6], [0.1, 0.4], [0.1, 0.4]] }, { name: "PERC", r: [[0.6, 1], [0.05, 0.3], [0.1, 0.4], [0.3, 0.7], [0.4, 0.8]] },
    { name: "WOOD", r: [[0.45, 0.85], [0.05, 0.25], [0.05, 0.3], [0.55, 0.9], [0.5, 0.9]] }, { name: "BLIP", r: [[0.4, 0.9], [0.05, 0.25], [0.6, 1], [0, 0.3], [0, 0.3]] }
  ],
  [ // HAT: tone decay reso open
    { name: "TIGHT", r: [[0.5, 0.9], [0.1, 0.35], [0.05, 0.3], [0.2, 0.5]] }, { name: "SOFT", r: [[0.2, 0.5], [0.3, 0.6], [0, 0.2], [0.3, 0.7]] },
    { name: "BRIGHT", r: [[0.75, 1], [0.2, 0.5], [0.2, 0.5], [0.3, 0.6]] }, { name: "DARK", r: [[0, 0.3], [0.2, 0.5], [0.1, 0.4], [0.4, 0.8]] },
    { name: "RINGING", r: [[0.4, 0.8], [0.2, 0.5], [0.55, 0.85], [0.3, 0.7]] }
  ]
];

// Moves v by a non-zero amount (at a range end it moves inwards).
function koreNudge(v, size, rng, minStep) {
  var d = (rng.chance(0.5) ? 1 : -1) * rng.range(0.4, 1) * size;
  var mn = minStep === undefined ? 0.01 : minStep;
  if (Math.abs(d) < mn) d = d < 0 ? -mn : mn;
  var nv = koreClamp01(v + d);
  if (Math.abs(nv - v) < mn * 0.5) nv = koreClamp01(v - d);
  return koreRound(nv, 3);
}

// New sound for a voice: archetype different from the last one, every param random
// inside it, every base value guaranteed to change.
// Params the user owns: never randomised by GENERATE (PUNCH HUM — user D8).
var KORE_KEEP_ON_GENERATE = { hum: true };
function koreGenerateSound(tr, rng) {
  var prev = koreClone(tr.params), list = KORE_ARCHETYPES[tr.id], keys = KORE_VOICE_PARAMS[tr.id];
  var idx = rng.int(0, list.length - 1);
  if (list[idx].name === tr.soundName && list.length > 1) idx = (idx + 1 + rng.int(0, list.length - 2)) % list.length;
  var a = list[idx];
  for (var i = 0; i < keys.length; i++) {
    if (KORE_KEEP_ON_GENERATE[keys[i]] || !a.r[i]) continue;
    var v = koreRound(rng.range(a.r[i][0], a.r[i][1]), 3);
    tr.params[keys[i]] = v === prev[keys[i]] ? koreNudge(v, 0.05, rng) : v;
  }
  tr.soundName = a.name;
}

// ---------- per-step lanes (P-Locks on every step, user D2) ----------
// Per-step lane depths. PUNCH has none: one steady kick sound on every hit (user D6).
var KORE_LANE_DEPTH = [
  {},
  { tune: [0.01, 0.04], decay: [0.05, 0.2], sweep: [0.05, 0.25], drive: [0.05, 0.2] },
  { amount: [0.1, 0.35], tail: [0.1, 0.3], duck: [0.05, 0.2], tone: [0.1, 0.3], drive: [0.05, 0.25] },
  { tune: [0.05, 0.25], decay: [0.1, 0.35], sweep: [0.1, 0.35], tone: [0.1, 0.4], snap: [0.1, 0.4] },
  { tune: [0.05, 0.25], decay: [0.1, 0.35], sweep: [0.1, 0.35], tone: [0.1, 0.4], snap: [0.1, 0.4] },
  { tone: [0.1, 0.35], decay: [0.1, 0.4], reso: [0.1, 0.3], open: [0.1, 0.3] }
];
var KORE_LANE_STYLES = ["random", "ramp", "alternate", "wave", "accent", "walk"];

function koreLaneShape(style, L, rng) {
  var out = [], i;
  if (style === "random") for (i = 0; i < L; i++) out.push(rng.range(-1, 1));
  else if (style === "ramp") { var dir = rng.chance(0.5) ? 1 : -1; for (i = 0; i < L; i++) out.push(dir * (L > 1 ? -1 + 2 * i / (L - 1) : 0)); }
  else if (style === "alternate") { var per = rng.pick([2, 2, 3, 4]), sg = rng.chance(0.5) ? 1 : -1; for (i = 0; i < L; i++) out.push(sg * ((i % per) < per / 2 ? 1 : -1) * rng.range(0.7, 1)); }
  else if (style === "wave") { var period = rng.pick([3, 4, 5, 6, 8, 12, 16]), ph = rng.range(0, Math.PI * 2); for (i = 0; i < L; i++) out.push(Math.sin(ph + 2 * Math.PI * i / period)); }
  else if (style === "accent") for (i = 0; i < L; i++) out.push(rng.chance(0.28) ? (rng.chance(0.7) ? 1 : -1) * rng.range(0.6, 1) : rng.range(-0.15, 0.15));
  else { var x = rng.range(-0.5, 0.5); for (i = 0; i < L; i++) { x = koreClamp(x + rng.range(-0.45, 0.45), -1, 1); out.push(x); } }
  return out;
}

function koreDrawLane(tr, key, rng, scale) {
  var dr = KORE_LANE_DEPTH[tr.id][key], depth = rng.range(dr[0], dr[1]) * scale;
  var room = Math.min(depth, 0.5), base = koreClamp(tr.params[key], room, 1 - room);
  var shape = koreLaneShape(rng.pick(KORE_LANE_STYLES), tr.length, rng);
  for (var i = 0; i < KORE_MAX_STEPS; i++) {
    if (i < tr.length) tr.steps[i].pLocks[key] = koreRound(koreClamp01(base + depth * shape[i]), 3);
    else delete tr.steps[i].pLocks[key];
  }
}

function koreGenerateLanes(tr, rng, density, amount) {
  for (var i = 0; i < KORE_MAX_STEPS; i++) tr.steps[i].pLocks = {};
  if (tr.id === KORE_PUNCH || density <= 0 || amount <= 0) return; // steady kick
  var keys = KORE_VOICE_PARAMS[tr.id], scale = Math.min(2, amount / 0.5);
  for (var k = 0; k < keys.length; k++) if (rng.chance(density)) koreDrawLane(tr, keys[k], rng, scale);
}

// GENERATE: new tracks (input untouched). Locked parts untouched.
function koreGenerate(tracks, scope, rng, g) {
  var next = koreClone(tracks);
  if (koreScopeRhythm(scope)) next = koreGenerateRhythm(next, tracks, rng, g);
  for (var t = 0; t < next.length; t++) {
    var tr = next[t];
    if (tr.locks.sound) continue;
    if (koreScopeSound(scope)) koreGenerateSound(tr, rng);
    if (koreScopePLocks(scope)) koreGenerateLanes(tr, rng, g.lockDensity, g.lockAmount);
  }
  return koreNormalizeTracks(next);
}

// ---------- MUTATE (from the Keep anchor) ----------
function koreMoveHit(tr, from, to) {
  var a = tr.steps[from], b = tr.steps[to];
  b.on = true; b.velocity = a.velocity; b.probability = a.probability; b.ratchet = a.ratchet; b.open = a.open;
  a.on = false; a.ratchet = 1; a.probability = 1; a.open = false;
}

function koreMutateRhythm(tr, amount, rng, g) {
  var i, s;
  if (tr.id === KORE_PUNCH) { // foundation preserved: only velocities, scaled by amount²
    for (i = 0; i < tr.length; i++) {
      s = tr.steps[i];
      if (s.on) s.velocity = koreRound(koreClamp(s.velocity + rng.range(-1, 1) * 0.15 * amount * amount, 0.5, 1), 3);
    }
    return;
  }
  var L = tr.length, changes = Math.max(1, Math.floor(amount * L * 0.6 + rng.next()));
  for (var c = 0; c < changes; c++) {
    var on = [], off = [];
    for (i = 0; i < L; i++) (tr.steps[i].on ? on : off).push(i);
    var kind = rng.weighted([0.5, on.length < 2 ? 0.4 : 0.18, on.length <= 1 ? 0 : 0.18, 0.08, 0.06]);
    if (kind === 0 && on.length) {
      var from = rng.pick(on), cands = [];
      for (var d = -2; d <= 2; d++) { var to = (from + d + L) % L; if (d && !tr.steps[to].on) cands.push(to); }
      if (cands.length) koreMoveHit(tr, from, rng.pick(cands));
    } else if (kind === 1 && off.length) {
      var w = [];
      for (i = 0; i < off.length; i++) w.push(KORE_PROFILE[tr.id][off[i] % 4]);
      koreSet(tr, off[rng.weighted(w)], rng.range(0.45, 0.75));
    } else if (kind === 2 && on.length) {
      s = tr.steps[rng.pick(on)]; s.on = false; s.ratchet = 1; s.open = false;
    } else if (kind === 3 && on.length && tr.id !== KORE_SUB) {
      s = tr.steps[rng.pick(on)]; s.ratchet = s.ratchet > 1 ? 1 : rng.int(2, 3);
    } else if (on.length) {
      s = tr.steps[rng.pick(on)];
      if (tr.id === KORE_HAT && rng.chance(0.5)) s.open = !s.open;
      else s.probability = s.probability < 1 ? 1 : koreRound(rng.range(0.5, 0.9), 2);
    }
  }
  for (i = 0; i < L; i++) {
    s = tr.steps[i];
    if (s.on && rng.chance(amount)) s.velocity = koreRound(koreClamp(s.velocity + rng.range(-1, 1) * 0.15 * amount, 0.25, 1), 3);
  }
  if (amount >= 0.6 && rng.chance((amount - 0.5) * 0.5)) {
    var cfg = KORE_STYLE[g.style] || KORE_STYLE.FOUNDATION;
    tr.length = korePickLength(rng, cfg.lens[tr.id - 1], tr.length);
  }
  if (koreCountHits(tr) === 0) koreSet(tr, Math.min(2, tr.length - 1), 0.8);
}

function koreMutateSound(tr, amount, rng) {
  var keys = KORE_VOICE_PARAMS[tr.id], kick = tr.id === KORE_PUNCH;
  var size = kick ? 0.3 * amount * amount : 0.3 * amount; // small AMOUNT barely touches the kick
  for (var i = 0; i < keys.length; i++) tr.params[keys[i]] = koreNudge(tr.params[keys[i]], size, rng, kick ? 0 : 0.01);
}

function koreMutateLanes(tr, amount, rng, density, lockAmount) {
  var keys = KORE_VOICE_PARAMS[tr.id], kick = tr.id === KORE_PUNCH, scale = Math.min(2, lockAmount / 0.5);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k], has = true, i;
    for (i = 0; i < tr.length; i++) if (!tr.steps[i].pLocks.hasOwnProperty(key)) has = false;
    if (!has || (!kick && rng.chance(Math.max(0, amount - 0.25) * 0.6))) {
      if (density > 0) koreDrawLane(tr, key, rng, scale * (has ? 1 : Math.max(amount, 0.4)));
      continue;
    }
    for (i = 0; i < tr.length; i++) {
      var pl = tr.steps[i].pLocks;
      pl[key] = koreNudge(pl[key], (kick ? 0.3 * amount * amount : 0.3 * amount) * scale, rng, kick ? 0 : 0.01);
    }
  }
}

function koreCopyRhythm(dst, src) {
  dst.length = src.length; dst.division = koreClone(src.division);
  for (var i = 0; i < KORE_MAX_STEPS; i++) {
    var d = dst.steps[i], s = src.steps[i];
    d.on = s.on; d.velocity = s.velocity; d.probability = s.probability; d.ratchet = s.ratchet; d.open = s.open;
  }
}

function koreMutateFromAnchor(current, anchor, amount, scope, rng, g) {
  var next = koreClone(current);
  if (amount <= 0) return next; // exact no-op (A28)
  for (var t = 1; t < next.length; t++) { // MUTATE never touches the kick (user D6): percussion only
    var tr = next[t], an = anchor[t], i;
    if (koreScopeRhythm(scope) && !tr.locks.rhythm) { koreCopyRhythm(tr, an); koreMutateRhythm(tr, amount, rng, g); }
    if (koreScopeSound(scope) && !tr.locks.sound) { tr.params = koreClone(an.params); koreMutateSound(tr, amount, rng); }
    if (koreScopePLocks(scope) && !tr.locks.sound) {
      for (i = 0; i < KORE_MAX_STEPS; i++) tr.steps[i].pLocks = koreClone(an.steps[i].pLocks);
      koreMutateLanes(tr, amount, rng, g.lockDensity, g.lockAmount);
    }
  }
  koreEnsureChanged(next, current, scope, rng, amount);
  var bad = koreValidateGroove(next, g);
  if (bad === "punch anchor missing") koreCopyRhythm(next[KORE_PUNCH], anchor[KORE_PUNCH]);
  return koreNormalizeTracks(next);
}

// Non-kick values must differ from what was playing before the press (user D3).
function koreEnsureChanged(next, current, scope, rng, amount) {
  for (var t = 1; t < next.length; t++) {
    var tr = next[t], cur = current[t], keys = KORE_VOICE_PARAMS[t], i, k, guard;
    if (tr.locks.sound) continue;
    if (koreScopeSound(scope)) for (i = 0; i < keys.length; i++) {
      k = keys[i];
      for (guard = 0; guard < 6 && tr.params[k] === cur.params[k]; guard++) tr.params[k] = koreNudge(tr.params[k], 0.02, rng);
    }
    if (koreScopePLocks(scope)) for (var s = 0; s < tr.length; s++) {
      var pl = tr.steps[s].pLocks, cp = cur.steps[s].pLocks;
      for (i = 0; i < keys.length; i++) {
        k = keys[i];
        if (!pl.hasOwnProperty(k)) continue;
        for (guard = 0; guard < 6 && cp.hasOwnProperty(k) && pl[k] === cp[k]; guard++) pl[k] = koreNudge(pl[k], 0.02, rng);
      }
    }
  }
}
