// KØRE core — data model, defaults, validation, (de)serialization.
// Step indices are 0-based in code, 1-based in the UI.

var KORE_SCHEMA_VERSION = 3;
var KORE_MAX_STEPS = 32;
var KORE_TRACK_NAMES = ["PUNCH", "SUB", "RUMBLE", "TOM L", "TOM H", "HAT"];
var KORE_PUNCH = 0, KORE_SUB = 1, KORE_RUMBLE = 2, KORE_TOML = 3, KORE_TOMH = 4, KORE_HAT = 5;

// Voice-specific parameters (normalized 0..1; units in spec/dsp_map.json). A P-Lock may
// only use the ids of its own voice (spec §13). Kept identical to dsp_map.json (tested).
var KORE_VOICE_PARAMS = [
  ["tune", "punch", "time", "body", "decay", "drive", "click", "clicktone", "hum", "humpitch"],
  ["tune", "decay", "sweep", "drive"],
  ["amount", "tail", "duck", "tone", "drive"],
  ["tune", "decay", "sweep", "drive", "snap", "pan"],
  ["tune", "decay", "sweep", "drive", "snap", "pan"],
  ["tone", "decay", "reso", "open", "pan"]
];
var KORE_DEFAULT_PARAMS = [
  {tune:  0.4594,  punch:  0.5,  time:  0.5155,  body:  0.35,  decay:  0.5241,  drive:  0.35,  click:  0.35,  clicktone:  0.5,  hum:  0.4,  humpitch:  0.5},
  {tune:  0.3297,  decay:  0.4804,  sweep:  0.25,  drive:  0.1},
  {amount:  0.35,  tail:  0.4466,  duck:  0.6,  tone:  0.5212,  drive:  0.2},
  {tune:  0.4,  decay:  0.35,  sweep:  0.55,  drive:  0.45,  snap:  0.45,  pan:  0.4},
  {tune:  0.45,  decay:  0.3,  sweep:  0.5,  drive:  0.45,  snap:  0.45,  pan:  0.62},
  {tone:  0.55,  decay:  0.35,  reso:  0.2,  open:  0.45,  pan:  0.58}
];
var KORE_DEFAULT_LEVEL_DB = [-6, -10, -6, -12, -13, -14];
var KORE_STYLES = ["FOUNDATION", "DRIVING", "HYPNOTIC", "BROKEN"];
var KORE_VIEWS = ["SEQUENCE", "SOUND", "LANES"];
var KORE_SCOPES = ["RHYTHM", "SOUND", "PLOCKS", "ALL"];
var KORE_INTERACTIONS = ["HYBRID", "ALTERNATE", "LAYER"];
var KORE_MAX_RATCHET = 8;
var KORE_MAX_DIV = 8;
var KORE_FOUR_ON_FLOOR = [0, 4, 8, 12];

// Starter groove: a usable FOUNDATION pattern before the first GENERATE.
// [step, velocity, probability, ratchet, open]
var KORE_DEFAULT_PATTERN = [
  [[0, 1, 1, 1, 0], [4, 1, 1, 1, 0], [8, 1, 1, 1, 0], [12, 1, 1, 1, 0]], // PUNCH: steady 4/4
  [[6, 0.8, 1, 1, 0], [14, 0.7, 1, 1, 0]],
  [[2, 0.9, 1, 1, 0], [10, 0.9, 1, 1, 0]],
  [[3, 0.7, 1, 1, 0], [11, 0.65, 1, 1, 0]],
  [[7, 0.6, 1, 1, 0], [15, 0.55, 0.7, 1, 0]],
  [[2, 0.8, 1, 1, 0], [6, 0.8, 1, 1, 0], [10, 0.8, 1, 1, 1], [14, 0.8, 1, 1, 0], [15, 0.45, 0.6, 1, 0]]
];

function koreDefaultStep() { return { on: false, velocity: 0.8, probability: 1, ratchet: 1, open: false, pLocks: {} }; }

function koreDefaultTrack(id) {
  var steps = [], i;
  for (i = 0; i < KORE_MAX_STEPS; i++) steps.push(koreDefaultStep());
  var pat = KORE_DEFAULT_PATTERN[id];
  for (i = 0; i < pat.length; i++) {
    var p = pat[i];
    steps[p[0]] = { on: true, velocity: p[1], probability: p[2], ratchet: p[3], open: !!p[4], pLocks: {} };
  }
  return {
    id: id, name: KORE_TRACK_NAMES[id], mute: false,
    locks: { rhythm: false, sound: false },
    length: 16, division: { n: 1, m: 1 },
    levelDb: KORE_DEFAULT_LEVEL_DB[id],
    params: koreClone(KORE_DEFAULT_PARAMS[id]),
    soundName: "",
    steps: steps
  };
}

function koreDefaultGlobal() {
  return {
    seed: 148219, selectedTrack: 0, selectedStep: -1, selectedPage: 0,
    activeView: "SEQUENCE", mutationAmount: 0.25, style: "FOUNDATION",
    kickInteraction: "HYBRID",
    lockDensity: 1.0,   // every voice parameter gets a per-step lane on GENERATE (user request)
    lockAmount: 0.5,    // lane depth scale
    unlockPunch: false  // BROKEN may move the four-on-the-floor only if true
  };
}

function koreDefaultState() {
  var tracks = [];
  for (var i = 0; i < KORE_TRACK_NAMES.length; i++) tracks.push(koreDefaultTrack(i));
  return { schemaVersion: KORE_SCHEMA_VERSION, name: "KØRE", global: koreDefaultGlobal(), tracks: tracks };
}

// ---------- validation ----------
function koreNum(v, def, lo, hi) { return koreIsNum(v) ? koreClamp(v, lo, hi) : def; }
function koreInt(v, def, lo, hi) { return koreIsNum(v) ? koreClamp(Math.round(v), lo, hi) : def; }
function koreBool(v, def) { return typeof v === "boolean" ? v : def; }
function koreEnum(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }

function koreNormalizeLocks(raw, id) {
  var out = {}, keys = KORE_VOICE_PARAMS[id];
  if (!raw || typeof raw !== "object") return out;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (Object.prototype.hasOwnProperty.call(raw, k) && koreIsNum(raw[k])) out[k] = koreClamp01(raw[k]);
  }
  return out; // ids of other voices are dropped: no leakage between voices
}

function koreNormalizeStep(raw, id) {
  var d = koreDefaultStep();
  if (!raw || typeof raw !== "object") return d;
  return {
    on: koreBool(raw.on, d.on),
    velocity: koreNum(raw.velocity, d.velocity, 0, 1),
    probability: koreNum(raw.probability, d.probability, 0, 1),
    ratchet: koreInt(raw.ratchet, 1, 1, KORE_MAX_RATCHET),
    open: koreBool(raw.open, false),
    pLocks: koreNormalizeLocks(raw.pLocks, id)
  };
}

function koreNormalizeParams(raw, id) {
  var out = {}, keys = KORE_VOICE_PARAMS[id], def = KORE_DEFAULT_PARAMS[id];
  for (var i = 0; i < keys.length; i++) out[keys[i]] = koreNum(raw && raw[keys[i]], def[keys[i]], 0, 1);
  return out;
}

function koreNormalizeTrack(raw, id) {
  var d = koreDefaultTrack(id);
  if (!raw || typeof raw !== "object") return d;
  var steps = [], rs = (raw.steps && raw.steps.length) ? raw.steps : null;
  for (var i = 0; i < KORE_MAX_STEPS; i++) steps.push(rs ? koreNormalizeStep(rs[i], id) : d.steps[i]);
  var div = raw.division || {};
  return {
    id: id, name: KORE_TRACK_NAMES[id],
    mute: koreBool(raw.mute, false),
    locks: { rhythm: koreBool(raw.locks && raw.locks.rhythm, false), sound: koreBool(raw.locks && raw.locks.sound, false) },
    length: koreInt(raw.length, d.length, 1, KORE_MAX_STEPS),
    division: { n: koreInt(div.n, 1, 1, KORE_MAX_DIV), m: koreInt(div.m, 1, 1, KORE_MAX_DIV) },
    levelDb: koreNum(raw.levelDb, d.levelDb, -60, 6),
    params: koreNormalizeParams(raw.params, id),
    soundName: (typeof raw.soundName === "string" && raw.soundName.length <= 24) ? raw.soundName : "",
    steps: steps
  };
}

function koreNormalizeGlobal(raw) {
  var d = koreDefaultGlobal();
  if (!raw || typeof raw !== "object") return d;
  return {
    seed: koreIsNum(raw.seed) ? (Math.floor(Math.abs(raw.seed)) >>> 0) : d.seed,
    selectedTrack: koreInt(raw.selectedTrack, 0, 0, 5),
    selectedStep: koreInt(raw.selectedStep, -1, -1, KORE_MAX_STEPS - 1),
    selectedPage: koreInt(raw.selectedPage, 0, 0, 1),
    activeView: koreEnum(raw.activeView, KORE_VIEWS, d.activeView),
    mutationAmount: koreNum(raw.mutationAmount, d.mutationAmount, 0, 1),
    style: koreEnum(raw.style, KORE_STYLES, d.style),
    kickInteraction: koreEnum(raw.kickInteraction, KORE_INTERACTIONS, d.kickInteraction),
    lockDensity: koreNum(raw.lockDensity, d.lockDensity, 0, 1),
    lockAmount: koreNum(raw.lockAmount, d.lockAmount, 0, 1),
    unlockPunch: koreBool(raw.unlockPunch, false)
  };
}

function koreNormalizeTracks(raw) {
  var tracks = [];
  for (var i = 0; i < KORE_TRACK_NAMES.length; i++) tracks.push(koreNormalizeTrack(raw && raw[i], i));
  return tracks;
}

function koreValidateAndNormalize(raw) {
  if (!raw || typeof raw !== "object") return koreDefaultState();
  return { schemaVersion: KORE_SCHEMA_VERSION, name: "KØRE", global: koreNormalizeGlobal(raw.global), tracks: koreNormalizeTracks(raw.tracks) };
}

// Effective params of one event: {...track.params, ...step.pLocks} — pure, no leakage.
function koreEffectiveParams(track, step) {
  var out = {}, keys = KORE_VOICE_PARAMS[track.id];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    out[k] = (step && step.pLocks && Object.prototype.hasOwnProperty.call(step.pLocks, k)) ? step.pLocks[k] : track.params[k];
  }
  return out;
}

function koreCountHits(track) {
  var c = 0;
  for (var i = 0; i < track.length; i++) if (track.steps[i].on) c++;
  return c;
}

// ---------- persistence ----------
function koreRoundDeep(o) {
  if (typeof o === "number") return koreRound(o, 4);
  if (o && typeof o === "object") {
    if (Object.prototype.toString.call(o) === "[object Array]") { var a = []; for (var i = 0; i < o.length; i++) a.push(koreRoundDeep(o[i])); return a; }
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = koreRoundDeep(o[k]);
    return r;
  }
  return o;
}

function koreSerialize(state, anchorTracks, generationCounter) {
  return JSON.stringify(koreRoundDeep({
    format: "KORE", schemaVersion: KORE_SCHEMA_VERSION, name: "KØRE",
    global: state.global, tracks: state.tracks,
    keepAnchor: { tracks: anchorTracks }, generationCounter: generationCounter || 0
  }));
}

function koreMigrate(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.format !== undefined && raw.format !== "KORE") return null;
  var v = raw.schemaVersion === undefined ? 1 : raw.schemaVersion;
  if (v !== 1 && v !== 2 && v !== 3) return null;
  if (v < 3 && raw.tracks) {
    // v3: toms are kick-like (TONE → DRIVE): old tom sounds do not map, start from the new defaults
    for (var ti = 3; ti <= 4; ti++) {
      if (raw.tracks[ti]) raw.tracks[ti].params = null;
      if (raw.keepAnchor && raw.keepAnchor.tracks && raw.keepAnchor.tracks[ti]) raw.keepAnchor.tracks[ti].params = null;
    }
  }
  if (v === 1 && raw.tracks && raw.tracks[0]) {
    // v2: new rendered kick — its old parameters do not map 1:1, start from the new defaults
    raw.tracks[0].params = null;
    if (raw.keepAnchor && raw.keepAnchor.tracks && raw.keepAnchor.tracks[0]) raw.keepAnchor.tracks[0].params = null;
  }
  return raw;
}

function koreDeserialize(text) {
  var raw;
  try { raw = (typeof text === "string") ? JSON.parse(text) : text; }
  catch (e) { return { ok: false, error: "invalid JSON", state: koreDefaultState(), anchorTracks: null, generationCounter: 0 }; }
  var m = koreMigrate(raw);
  if (!m) return { ok: false, error: "unsupported format/version", state: koreDefaultState(), anchorTracks: null, generationCounter: 0 };
  var state = koreValidateAndNormalize(m);
  var anchor = (m.keepAnchor && m.keepAnchor.tracks) ? koreNormalizeTracks(m.keepAnchor.tracks) : koreClone(state.tracks);
  return { ok: true, state: state, anchorTracks: anchor, generationCounter: koreInt(m.generationCounter, 0, 0, 2147483647), error: null };
}
