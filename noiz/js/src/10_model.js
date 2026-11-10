// NØIZ core — data model, defaults, validation, (de)serialization.
// Step indices are 0-based in code, 1-based in the UI.

var NOIZ_SCHEMA_VERSION = 1;
var NOIZ_MAX_STEPS = 32;
var NOIZ_TRACK_NAMES = ["HISS", "DUST", "METAL", "ATMOS"];
var NOIZ_MACROS = ["tone", "decay", "texture", "drive"];
var NOIZ_SCOPES = ["RHYTHM", "SOUND", "PLOCKS", "ALL"];
var NOIZ_VIEWS = ["SEQUENCE", "SOUND"];
var NOIZ_MAX_RATCHET = 8;
var NOIZ_MAX_DIV = 8;

// Spec §07 default table (the JSON example in §05 is illustrative only; see docs/DECISIONS.md D4).
var NOIZ_DEFAULT_SOUND = [
  { tone: 0.68, decay: 0.20, texture: 0.45, drive: 0.10 },
  { tone: 0.47, decay: 0.32, texture: 0.72, drive: 0.12 },
  { tone: 0.56, decay: 0.25, texture: 0.36, drive: 0.28 },
  { tone: 0.30, decay: 0.65, texture: 0.63, drive: 0.08 }
];
var NOIZ_DEFAULT_LEVEL_DB = [-12, -12, -14, -16];
// Generation target density per voice (fraction of active steps).
var NOIZ_DEFAULT_DENSITY = [0.5, 0.35, 0.2, 0.12];

// Musical first preset: sounds like a groove before the user touches anything.
// [stepIndex, velocity, probability, ratchet]
var NOIZ_DEFAULT_PATTERN = [
  [[0, 0.62, 1, 1], [2, 0.9, 1, 1], [4, 0.55, 1, 1], [6, 0.9, 1, 1], [7, 0.5, 0.7, 1],
   [10, 0.9, 1, 1], [12, 0.58, 1, 1], [14, 0.9, 1, 2], [15, 0.48, 0.6, 1]],
  [[1, 0.5, 1, 1], [5, 0.62, 1, 1], [9, 0.45, 0.8, 1], [11, 0.6, 1, 1], [13, 0.42, 0.75, 3]],
  [[3, 0.85, 1, 1], [11, 0.78, 1, 1], [14, 0.6, 0.5, 1]],
  [[0, 0.8, 1, 1], [8, 0.65, 1, 1]]
];

function noizDefaultStep() {
  return { on: false, velocity: 0.7, probability: 1.0, ratchet: 1, pLocks: {} };
}

function noizDefaultTrack(id) {
  var steps = [];
  for (var i = 0; i < NOIZ_MAX_STEPS; i++) steps.push(noizDefaultStep());
  var pat = NOIZ_DEFAULT_PATTERN[id];
  for (var j = 0; j < pat.length; j++) {
    var p = pat[j];
    steps[p[0]] = { on: true, velocity: p[1], probability: p[2], ratchet: p[3], pLocks: {} };
  }
  return {
    id: id,
    name: NOIZ_TRACK_NAMES[id],
    mute: false,
    locks: { rhythm: false, sound: false },
    length: 16,
    division: { n: 1, m: 1 },
    levelDb: NOIZ_DEFAULT_LEVEL_DB[id],
    density: NOIZ_DEFAULT_DENSITY[id],
    sound: noizClone(NOIZ_DEFAULT_SOUND[id]),
    steps: steps
  };
}

function noizDefaultGlobal() {
  return {
    seed: 482916,
    selectedTrack: 0,
    selectedStep: -1,        // -1 = BASE mode, otherwise STEP mode for that step
    selectedPage: 0,
    activeView: "SEQUENCE",
    mutationAmount: 0.25,
    randomScope: "RHYTHM",
    lockDensity: 0.35,
    lockAmount: 0.25,
    uiMotion: true
  };
}

function noizDefaultState() {
  var tracks = [];
  for (var i = 0; i < 4; i++) tracks.push(noizDefaultTrack(i));
  return { schemaVersion: NOIZ_SCHEMA_VERSION, name: "NØIZ", global: noizDefaultGlobal(), tracks: tracks };
}

// ---------- validation ----------

function noizNum(v, def, lo, hi) {
  if (!noizIsNum(v)) return def;
  return noizClamp(v, lo, hi);
}
function noizInt(v, def, lo, hi) {
  if (!noizIsNum(v)) return def;
  return noizClamp(Math.round(v), lo, hi);
}
function noizBool(v, def) { return typeof v === "boolean" ? v : def; }
function noizEnum(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }

function noizNormalizePLocks(raw) {
  var out = {};
  if (!raw || typeof raw !== "object") return out;
  for (var i = 0; i < NOIZ_MACROS.length; i++) {
    var k = NOIZ_MACROS[i];
    // Absence differs from 0: only finite numbers become locks.
    if (Object.prototype.hasOwnProperty.call(raw, k) && noizIsNum(raw[k])) out[k] = noizClamp01(raw[k]);
  }
  return out;
}

function noizNormalizeStep(raw) {
  var d = noizDefaultStep();
  if (!raw || typeof raw !== "object") return d;
  return {
    on: noizBool(raw.on, d.on),
    velocity: noizNum(raw.velocity, d.velocity, 0, 1),
    probability: noizNum(raw.probability, d.probability, 0, 1),
    ratchet: noizInt(raw.ratchet, d.ratchet, 1, NOIZ_MAX_RATCHET),
    pLocks: noizNormalizePLocks(raw.pLocks)
  };
}

function noizNormalizeSound(raw, def) {
  var out = {};
  for (var i = 0; i < NOIZ_MACROS.length; i++) {
    var k = NOIZ_MACROS[i];
    out[k] = noizNum(raw && raw[k], def[k], 0, 1);
  }
  return out;
}

function noizNormalizeTrack(raw, id) {
  var d = noizDefaultTrack(id);
  if (!raw || typeof raw !== "object") return d;
  var steps = [];
  var rs = (raw.steps && raw.steps.length) ? raw.steps : null;
  for (var i = 0; i < NOIZ_MAX_STEPS; i++) {
    steps.push(rs ? noizNormalizeStep(rs[i]) : d.steps[i]);
  }
  var div = raw.division || {};
  return {
    id: id,
    name: NOIZ_TRACK_NAMES[id],
    mute: noizBool(raw.mute, d.mute),
    locks: {
      rhythm: noizBool(raw.locks && raw.locks.rhythm, false),
      sound: noizBool(raw.locks && raw.locks.sound, false)
    },
    length: noizInt(raw.length, d.length, 1, NOIZ_MAX_STEPS),
    division: { n: noizInt(div.n, 1, 1, NOIZ_MAX_DIV), m: noizInt(div.m, 1, 1, NOIZ_MAX_DIV) },
    levelDb: noizNum(raw.levelDb, d.levelDb, -60, 6),
    density: noizNum(raw.density, d.density, 0.02, 0.9),
    sound: noizNormalizeSound(raw.sound, d.sound),
    steps: steps
  };
}

function noizNormalizeGlobal(raw) {
  var d = noizDefaultGlobal();
  if (!raw || typeof raw !== "object") return d;
  return {
    seed: noizIsNum(raw.seed) ? (Math.floor(Math.abs(raw.seed)) >>> 0) : d.seed,
    selectedTrack: noizInt(raw.selectedTrack, 0, 0, 3),
    selectedStep: noizInt(raw.selectedStep, -1, -1, NOIZ_MAX_STEPS - 1),
    selectedPage: noizInt(raw.selectedPage, 0, 0, 1),
    activeView: noizEnum(raw.activeView, NOIZ_VIEWS, d.activeView),
    mutationAmount: noizNum(raw.mutationAmount, d.mutationAmount, 0, 1),
    randomScope: noizEnum(raw.randomScope, NOIZ_SCOPES, d.randomScope),
    lockDensity: noizNum(raw.lockDensity, d.lockDensity, 0, 1),
    lockAmount: noizNum(raw.lockAmount, d.lockAmount, 0, 1),
    uiMotion: noizBool(raw.uiMotion, d.uiMotion)
  };
}

function noizNormalizeTracks(rawTracks) {
  var tracks = [];
  for (var i = 0; i < 4; i++) tracks.push(noizNormalizeTrack(rawTracks && rawTracks[i], i));
  return tracks;
}

// Returns a fully populated, clamped state. Never contains undefined/NaN.
function noizValidateAndNormalize(raw) {
  if (!raw || typeof raw !== "object") return noizDefaultState();
  return {
    schemaVersion: NOIZ_SCHEMA_VERSION,
    name: "NØIZ",
    global: noizNormalizeGlobal(raw.global),
    tracks: noizNormalizeTracks(raw.tracks)
  };
}

// Effective sound of an event: {...track.sound, ...step.pLocks}. Pure.
function noizEffectiveSound(track, step) {
  var out = {};
  for (var i = 0; i < NOIZ_MACROS.length; i++) {
    var k = NOIZ_MACROS[i];
    out[k] = (step && step.pLocks && Object.prototype.hasOwnProperty.call(step.pLocks, k))
      ? step.pLocks[k] : track.sound[k];
  }
  return out;
}

function noizCountHits(track) {
  var c = 0;
  for (var i = 0; i < track.length; i++) if (track.steps[i].on) c++;
  return c;
}

// ---------- persistence ----------
// Persisted: state + Keep anchor + generation counter.
// Not persisted: the undo stack (D8 in docs/DECISIONS.md) — it would multiply the
// Live Set blob by 16 and the spec allows "в пределах выбранной политики".

function noizRoundDeep(o) {
  if (typeof o === "number") return noizRound(o, 4);
  if (o && typeof o === "object") {
    if (Object.prototype.toString.call(o) === "[object Array]") { var a = []; for (var i = 0; i < o.length; i++) a.push(noizRoundDeep(o[i])); return a; }
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = noizRoundDeep(o[k]);
    return r;
  }
  return o;
}

function noizSerialize(state, anchorTracks, generationCounter) {
  return JSON.stringify(noizRoundDeep({
    format: "NOIZ",
    schemaVersion: NOIZ_SCHEMA_VERSION,
    name: "NØIZ",
    global: state.global,
    tracks: state.tracks,
    keepAnchor: { tracks: anchorTracks },
    generationCounter: generationCounter || 0
  }));
}

// Migration hook: schema 1 is the first; anything newer/foreign is rejected safely.
function noizMigrate(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.format !== undefined && raw.format !== "NOIZ") return null;
  var v = raw.schemaVersion;
  if (v === undefined) v = 1; // tolerate hand-written partial states
  if (v !== 1) return null;   // unknown future version: refuse, keep defaults
  return raw;
}

// Returns {ok, state, anchorTracks, generationCounter, error}
function noizDeserialize(text) {
  var raw;
  try { raw = (typeof text === "string") ? JSON.parse(text) : text; }
  catch (e) { return { ok: false, error: "invalid JSON", state: noizDefaultState(), anchorTracks: null, generationCounter: 0 }; }
  var m = noizMigrate(raw);
  if (!m) return { ok: false, error: "unsupported format/version", state: noizDefaultState(), anchorTracks: null, generationCounter: 0 };
  var state = noizValidateAndNormalize(m);
  var anchor = (m.keepAnchor && m.keepAnchor.tracks) ? noizNormalizeTracks(m.keepAnchor.tracks) : noizClone(state.tracks);
  return { ok: true, state: state, anchorTracks: anchor, generationCounter: noizInt(m.generationCounter, 0, 0, 2147483647), error: null };
}
