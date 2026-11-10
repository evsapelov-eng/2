// ===== KØRE — Max [js] adapter =====
// Appended after the core sources by js/build.js → max/kore_engine.js. ES5, low priority:
// timing comes from the lookahead + [pipe] in the patch, not from JS.
//
// Inlet 0:
//   tick <bars> <beats> <units> <resolution> <tempo>    host position from [transport]
//   loopon <0|1>  loopstart <beats>  looplength <beats> Live loop (live.observer)
//   generate | mutate | keep | undo
//   amount <0..1>  style <FOUNDATION|DRIVING|HYPNOTIC|BROKEN>  interaction <HYBRID|ALTERNATE|LAYER>
//   unlockpunch <0|1>
//   select <track>  selstep <step|-1>  page <0|1>  view <SEQUENCE|SOUND|LANES>
//   toggle <track> <step>  stepset <track> <step> <on|velocity|probability|ratchet|open> <value>
//   tracklength <track> <n>  division <track> <n> <m>  level <track> <dB>  mute <track> <0|1>
//   hold <track> <0|1>
//   param <key> <0..1>  paramreset <key>        (BASE or STEP P-Lock of the selected voice)
//   lane <track> <step> <key> <0..1>  clearlock <track> <step> <key>  clearsteplocks
//   gesture <1|0>
//   meter <peak>  kickmeter <peak>                from [peakamp~] (UI telemetry only)
//
// Outlet 0 → DSP:  trig <track> <amp> <p0> <p1> <p2> <p3> <p4> <open> <delayMs>
//                  flush
// Outlet 1 → UI:   bind <globalName> · refresh · playhead <s0..s5>
// Outlet 2 → status: sync <0|1> <tempo> · pending <0|1> · error <text>

autowatch = 1;
inlets = 1;
outlets = 3;

var engine = new KoreEngine({ clock: { lookaheadMs: 40, lateWindowMs: 12 } });

var registry = new Global("kore_registry");
registry.count = (registry.count || 0) + 1;
var uiName = "kore_ui_" + registry.count;
var ui = new Global(uiName);
ui.version = 0;
ui.meter = 0; ui.kick = 0;

var lastPlayhead = [-1, -1, -1, -1, -1, -1];
var lastSync = -1, lastPending = -1, dirtyPersist = false;

function publishUi() {
  ui.state = JSON.stringify({
    global: engine.state.global,
    tracks: engine.state.tracks,
    canUndo: engine.canUndo(),
    pending: engine.pending,
    playing: engine.transportPlaying,
    tempo: engine.tempo,
    defaults: { levelDb: KORE_DEFAULT_LEVEL_DB, params: KORE_DEFAULT_PARAMS }
  });
  ui.version++;
  outlet(1, "refresh");
}

engine.onChange(function (what) {
  publishUi();
  if (what !== "global" && what !== "pending") dirtyPersist = true;
  sendStatus();
});

function sendStatus() {
  var s = engine.transportPlaying ? 1 : 0;
  if (s !== lastSync) { lastSync = s; outlet(2, "sync", s, engine.tempo); publishUi(); }
  var p = engine.pending ? 1 : 0;
  if (p !== lastPending) { lastPending = p; outlet(2, "pending", p); publishUi(); }
}

function loadbang() { outlet(1, "bind", uiName); publishUi(); }
function bang() { outlet(1, "bind", uiName); publishUi(); }

// ---------- clock ----------
function tick(bars, beats, units, resolution, tempo) {
  var res = resolution > 0 ? resolution : 480;
  var pos = (bars - 1) * KORE_BEATS_PER_BAR + (beats - 1) + units / res;
  if (!(pos >= 0)) pos = 0;
  var evs = engine.tick(pos, tempo);
  if (engine.flushRequested) outlet(0, "flush");
  for (var i = 0; i < evs.length; i++) {
    var m = koreEventToTrigger(evs[i]);
    outlet(0, "trig", m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], koreRound(evs[i].delayMs, 3));
  }
  var ph = [], changed = false;
  for (var t = 0; t < KORE_TRACK_NAMES.length; t++) {
    var s = engine.transportPlaying ? koreStepAt(engine.playState.tracks[t], pos) : -1;
    ph.push(s);
    if (s !== lastPlayhead[t]) changed = true;
  }
  if (changed) { lastPlayhead = ph; ui.playhead = ph; ui.pos = pos; outlet(1, "playhead", ph[0], ph[1], ph[2], ph[3], ph[4], ph[5]); }
  sendStatus();
}

var loopInfo = { on: 0, start: 0, length: 0 };
function loopon(v) { loopInfo.on = v; engine.setLoop(loopInfo.on, loopInfo.start, loopInfo.length); }
function loopstart(v) { loopInfo.start = v; engine.setLoop(loopInfo.on, loopInfo.start, loopInfo.length); }
function looplength(v) { loopInfo.length = v; engine.setLoop(loopInfo.on, loopInfo.start, loopInfo.length); }

// ---------- commands ----------
function generate() { engine.generate("ALL"); }
function mutate() { engine.mutate("ALL"); }
function keep() { engine.keep(); }
function undo() { engine.undo(); }
function amount(v) { engine.setGlobal("mutationAmount", v); }
function style(s) { engine.setGlobal("style", String(s)); }
function interaction(s) { engine.setGlobal("kickInteraction", String(s)); }
function unlockpunch(v) { engine.setGlobal("unlockPunch", v); }
function select(t) { engine.setGlobal("selectedTrack", t); }
function selstep(s) { engine.setGlobal("selectedStep", s); }
function page(p) { engine.setGlobal("selectedPage", p); }
function view(v) { engine.setGlobal("activeView", String(v)); }
function toggle(t, s) { engine.toggleStep(t, s); }
function stepset(t, s, field, v) { engine.setStep(t, s, String(field), v); }
function tracklength(t, n) { engine.setLength(t, n); }
function division(t, n, m) { engine.setDivision(t, n, m); }
function level(t, db) { engine.setLevel(t, db); }
function mute(t, v) { engine.setMute(t, v); }
function hold(t, v) { engine.setHold(t, v); }
function param(key, v) { engine.setParam(String(key), v); }
function paramreset(key) { engine.resetParam(String(key)); }
function lane(t, s, key, v) { engine.setPLock(t, s, String(key), v); }
function clearlock(t, s, key) { engine.clearLock(t, s, String(key)); }
function clearsteplocks() {
  var g = engine.state.global;
  if (g.selectedStep >= 0) engine.clearStepLocks(g.selectedTrack, g.selectedStep);
}
function gesture(on) { if (on) engine.beginGesture(); else engine.endGesture(); }
// telemetry from [peakamp~]: stored for the UI, never touches audio
function meter(v) { ui.meter = +v || 0; }
function kickmeter(v) { ui.kick = +v || 0; }
function dump() { post(engine.serialize() + "\n"); }

// ---------- persistence (pattr Blob parameter in the Live Set) ----------
function getvalueof() { dirtyPersist = false; return engine.serialize(); }
function setvalueof(v) {
  var r = engine.restore(arrayfromargs(arguments).join(" "));
  if (!r.ok) outlet(2, "error", "restore failed: " + r.error);
}
var persistTask = new Task(function () { if (dirtyPersist) { dirtyPersist = false; notifyclients(); } }, this);
persistTask.interval = 2000;
persistTask.repeat();
function notifydeleted() { persistTask.cancel(); }
