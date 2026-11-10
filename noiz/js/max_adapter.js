// ===== NØIZ — Max [js] adapter =====
// Appended after the core sources by js/build.js → max/noiz_engine.js.
// Runs in Max's legacy JS engine (ES5). Default (low) priority on purpose:
// timing accuracy comes from the lookahead + [pipe] in the patch, not from JS.
//
// Inlet 0 messages (from clock bridge, UI and live.* controls):
//   tick <bars> <beats> <units> <resolution> <tempo>   host position from [transport]
//   loopon <0|1>  loopstart <beats>  looplength <beats> Live loop (from live.observer)
//   generate | mutate | keep | undo
//   scope <RHYTHM|SOUND|PLOCKS|ALL>  amount <0..1>  lockdensity <0..1>  lockamount <0..1>
//   select <track>  selstep <step|-1>  page <0|1>  view <SEQUENCE|SOUND>
//   toggle <track> <step>  stepset <track> <step> <field> <value>
//   tracklength <track> <n>  division <track> <n> <m>  density <track> <0..1>
//   level <track> <dB>  mute <track> <0|1>  lockr <track> <0|1>  locks <track> <0|1>
//   macro <tone|decay|texture|drive|pan> <0..1>   macroreset <key>   (BASE or STEP P-Lock)
//   synth <reso|attack|character|spread> <0..1>   synthreset <key>  (selected voice)
//   hold <track> <0|1>  (lock rhythm + sound together)
//   param <key> <0..1>  paramreset <key>   any of tone decay texture drive pan reso attack character spread
//   lane <track> <step> <key> <0..1>   clearlock <track> <step> <key>
//   gesture <1|0>   clearsteplocks   cleartracklocks   motion <0|1>
//   bang (re-send UI state)   dump (post state JSON to the Max Console)
//
// Outlet 0 → DSP:   trig <track> <amp> <tone> <decay> <texture> <drive> <pan> <reso> <attack> <character> <delayMs>
//                   (delay last: the patch unpacks right-to-left into [pipe], track triggers)
//                   flush                          (drop queued events: stop/seek)
// Outlet 1 → UI:    bind <globalName>   refresh    playhead <s0> <s1> <s2> <s3>
// Outlet 2 → status: sync <0|1> <tempo>  pending <0|1>  error <text>

autowatch = 1;
inlets = 1;
outlets = 3;

var engine = new NoizEngine({ clock: { lookaheadMs: 40, lateWindowMs: 12 } });

// Shared memory for the UI: a Global with a per-instance name so two NØIZ devices
// never see each other's state. Strings in a Global are plain JS values (no Max
// symbol interning per update, which would leak memory).
var registry = new Global("noiz_registry");
registry.count = (registry.count || 0) + 1;
var uiName = "noiz_ui_" + registry.count;
var ui = new Global(uiName);
ui.version = 0;

var lastPlayhead = [-1, -1, -1, -1];
var lastSync = -1;
var lastPending = -1;
var dirtyPersist = false;

function publishUi() {
  var g = engine.state.global;
  ui.state = JSON.stringify({
    global: g,
    tracks: engine.state.tracks,
    canUndo: engine.canUndo(),
    pending: engine.pending,
    playing: engine.transportPlaying,
    tempo: engine.tempo,
    defaults: { levelDb: NOIZ_DEFAULT_LEVEL_DB }
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
  if (s !== lastSync) { lastSync = s; outlet(2, "sync", s, engine.tempo); }
  var p = engine.pending ? 1 : 0;
  if (p !== lastPending) { lastPending = p; outlet(2, "pending", p); publishUi(); }
}

function loadbang() { outlet(1, "bind", uiName); publishUi(); }
function bang() { outlet(1, "bind", uiName); publishUi(); }

// ---------- clock ----------
// [transport] reports bars/beats starting at 1; units are ticks within the beat.
// v1 assumes 4/4 (see docs/DECISIONS.md D9).
function tick(bars, beats, units, resolution, tempo) {
  var res = resolution > 0 ? resolution : 480;
  var pos = (bars - 1) * NOIZ_BEATS_PER_BAR + (beats - 1) + units / res;
  if (!(pos >= 0)) pos = 0;
  var evs = engine.tick(pos, tempo);
  if (engine.flushRequested) outlet(0, "flush");
  for (var i = 0; i < evs.length; i++) {
    var m = noizEventToTrigger(evs[i]);
    outlet(0, "trig", m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], noizRound(evs[i].delayMs, 3));
  }
  // playhead (only on change)
  var ph = [];
  var changed = false;
  for (var t = 0; t < 4; t++) {
    var s = engine.transportPlaying ? noizStepAt(engine.playState.tracks[t], pos) : -1;
    ph.push(s);
    if (s !== lastPlayhead[t]) changed = true;
  }
  if (changed) { lastPlayhead = ph; ui.playhead = ph; ui.pos = pos; outlet(1, "playhead", ph[0], ph[1], ph[2], ph[3]); }
  sendStatus();
}

// Live loop from three live.observer objects (loop, loop_start, loop_length).
var loopInfo = { on: 0, start: 0, length: 0 };
function loop(on, start, len) { loopInfo = { on: on, start: start, length: len }; engine.setLoop(on, start, len); }
function loopon(v) { loopInfo.on = v; engine.setLoop(loopInfo.on, loopInfo.start, loopInfo.length); }
function loopstart(v) { loopInfo.start = v; engine.setLoop(loopInfo.on, loopInfo.start, loopInfo.length); }
function looplength(v) { loopInfo.length = v; engine.setLoop(loopInfo.on, loopInfo.start, loopInfo.length); }

// ---------- commands ----------
// Scope follows the visible screen: SEQ → rhythm + P-Locks, SYNTH → voice sound.
function generate() { engine.generate(engine.contextScope()); }
function mutate() { engine.mutate(engine.contextScope()); }
function keep() { engine.keep(); }
function undo() { engine.undo(); }
function scope(s) { engine.setGlobal("randomScope", String(s)); }
function amount(v) { engine.setGlobal("mutationAmount", v); }
function lockdensity(v) { engine.setGlobal("lockDensity", v); }
function lockamount(v) { engine.setGlobal("lockAmount", v); }
function select(t) { engine.setGlobal("selectedTrack", t); }
function selstep(s) { engine.setGlobal("selectedStep", s); }
function page(p) { engine.setGlobal("selectedPage", p); }
function view(v) { engine.setGlobal("activeView", String(v)); }
function motion(v) { engine.setGlobal("uiMotion", v); }
function toggle(t, s) { engine.toggleStep(t, s); }
function stepset(t, s, field, v) { engine.setStep(t, s, String(field), v); }
function tracklength(t, n) { engine.setLength(t, n); }
function division(t, n, m) { engine.setDivision(t, n, m); }
function density(t, v) { engine.setDensity(t, v); }
function level(t, db) { engine.setLevel(t, db); }
function mute(t, v) { engine.setMute(t, v); }
function hold(t, v) { engine.setHold(t, v); }
// any lockable parameter, BASE or STEP P-Lock depending on the selected step
function param(key, v) { engine.setParam(String(key), v); }
function paramreset(key) { engine.resetParam(String(key)); }
// LANE screen: draw / clear one parameter on a given step
function lane(t, s, key, v) { engine.setLane(t, s, String(key), v); }
function clearlock(t, s, key) { engine.clearLock(t, s, String(key)); }
function synth(key, v) { engine.setSynth(engine.state.global.selectedTrack, String(key), v); }
function synthreset(key) { engine.resetSynth(engine.state.global.selectedTrack, String(key)); }
function lockr(t, v) { engine.setLock(t, "rhythm", v); }
function locks(t, v) { engine.setLock(t, "sound", v); }
function macro(key, v) { engine.setMacro(String(key), v); }
function macroreset(key) { engine.resetMacro(String(key)); }
function gesture(on) { if (on) engine.beginGesture(); else engine.endGesture(); }
function clearsteplocks() {
  var g = engine.state.global;
  if (g.selectedStep >= 0) engine.clearStepLocks(g.selectedTrack, g.selectedStep);
}
function cleartracklocks() { engine.clearTrackLocks(engine.state.global.selectedTrack); }
function dump() { post(engine.serialize() + "\n"); }

// ---------- persistence (pattr / Live Set) ----------
// A [pattr] bound to this object (varname "engine") stores the value as a Live
// "Blob" parameter (Stored Only), so it is saved inside the Live Set.
// Not trusted until A20 is host-verified; global JS memory is NOT persistence.
function getvalueof() {
  dirtyPersist = false;
  return engine.serialize();
}
function setvalueof(v) {
  var text = arrayfromargs(arguments).join(" ");
  var r = engine.restore(text);
  if (!r.ok) outlet(2, "error", "restore failed: " + r.error);
}
// Tell pattr/Live the value changed — throttled (each call materialises the blob).
var persistTask = new Task(function () {
  if (dirtyPersist) { dirtyPersist = false; notifyclients(); }
}, this);
persistTask.interval = 2000;
persistTask.repeat();

function notifydeleted() { persistTask.cancel(); }
