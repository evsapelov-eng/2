// FLOW — Max for Live glue: LiveAPI bridge, Task tick, UI, persistence, SELF-TEST.
// Concatenated after sections.js, engine.js, selftest.js into device/flow/flow.js
// by tools/build_flow.py. Max classic [js], ES5.
//
// Rules (Cycling '74 docs + Max forum + producer-pal findings, see docs/API_VERIFICATION.md):
//  * LiveAPI only after live.thisdevice -> deferlow -> "init" (never in global code).
//  * Observer callbacks only record; every Live write happens in the Task tick.
//  * Nothing touches the transport or the loop on load.

autowatch = 0;
inlets = 1;
outlets = 2;   // 0: UI (route), 1: persistence (pattr "set <symbol>")

var VERSION = "FLOW 0.2.0-m1 (UNVERIFIED)";
var TICK_MS = 10;
var UI_MS = 100;
var CUE_REFRESH_MS = 2000;

var M = {
    ready: false, song: null, obs: {}, task: null, t0: new Date().getTime(),
    lastUi: 0, lastCueRead: 0, cueDirty: true, cues: [],
    logLines: [], verbose: 0,
    preview: null, selftestArmedUntil: 0, report: "", reportMeta: null,
    id: "flow-" + Math.floor(Math.random() * 1e9).toString(36), master: false, registry: null
};
// Live state mirror used by SELF-TEST (the engine keeps its own copy).
var L = { pos: 0, posT: 0, playing: 0, loop: 0, loopStart: 0, loopLength: 0, tempo: 120, num: 4, den: 4,
    b2a: 0, quant: 4, songLength: 0 };

var store = new FlowSections.Store();
var engine = FlowEngine.create({ log: logv });
engine.setDoc(store.doc);
var selftest = null;

// ------------------------------------------------------------------ utils
function now() { return new Date().getTime(); }
function num(v) { if (v !== null && typeof v === "object" && v.length !== undefined) { v = v[0]; } return Number(v); }
function str(v) {
    if (v !== null && typeof v === "object" && v.length !== undefined) { var a = []; for (var i = 0; i < v.length; i++) { a.push(String(v[i])); } return a.join(" "); }
    return String(v);
}
function log(msg) {
    var line = "[" + (now() - M.t0) + "ms] " + msg;
    M.logLines.push(line);
    if (M.logLines.length > 5000) { M.logLines.shift(); }
    post("FLOW " + line + "\n");
}
function logv(msg) { if (M.verbose) { log(msg); } else { M.logLines.push("[" + (now() - M.t0) + "ms] " + msg); if (M.logLines.length > 5000) { M.logLines.shift(); } } }
function ui(key, text) {
    var atoms = String(text).replace(/[;,]/g, " /").split(" ");
    var out = [key];
    for (var i = 0; i < atoms.length; i++) { if (atoms[i] !== "") { out.push(atoms[i]); } }
    if (out.length === 1) { out.push("-"); }
    outlet(0, out);
}
function bpb() { return L.num * 4 / L.den; }
function estPos(t) {
    if (!L.playing) { return L.pos; }
    var p = L.pos + (t - L.posT) * L.tempo / 60000;
    var le = L.loopStart + L.loopLength;
    if (L.loop && L.pos < le && p >= le && L.loopLength > 0) { p = L.loopStart + (p - le); }
    return p;
}

// ------------------------------------------------------------------ Live bridge
function apiGet(prop) { return num(M.song.get(prop)); }
function apiSet(prop, val) {
    try { M.song.set(prop, val); logv("SET " + prop + "=" + val); return true; }
    catch (e) { log("ERROR set " + prop + "=" + val + ": " + e); return false; }
}
function apiCall(fn) {
    try { return M.song.call(fn); } catch (e) { log("ERROR call " + fn + ": " + e); return null; }
}
function cueJump(i) {
    try { new LiveAPI(null, "live_set cue_points " + i).call("jump"); logv("CUE JUMP " + i); }
    catch (e) { log("ERROR cue jump " + i + ": " + e); }
}
function execute(actions) {
    for (var i = 0; i < actions.length; i++) {
        var a = actions[i];
        if (a.op === "set") { apiSet(a.prop, a.value); }
        else if (a.op === "call") { apiCall(a.fn); }
        else if (a.op === "cue") { cueJump(a.index); }
    }
}

var PROPS = {
    is_playing: "playing", loop: "loop", loop_start: "loopStart", loop_length: "loopLength", tempo: "tempo",
    signature_numerator: "num", signature_denominator: "den", back_to_arranger: "b2a",
    clip_trigger_quantization: "quant", song_length: "songLength"
};

function observe(prop) {
    var o = new LiveAPI(function (args) {
        if (!args || args[0] !== prop) { return; }
        var v = Number(args[1]), t = now();
        if (prop === "current_song_time") {
            var prev = L.pos, prevT = L.posT;
            if (v === prev) { return; }
            L.pos = v; L.posT = t;
            engine.onPos(v, t);
            if (selftest && selftest.running()) { selftest.onPos(v, t, prev, prevT); }
            return;
        }
        if (prop === "cue_points") { M.cueDirty = true; return; }
        L[PROPS[prop]] = v;
        if (prop === "is_playing") { L.posT = t; }
        engine.onProp(prop, v, t);
        if (selftest && selftest.running()) { selftest.onProp(prop, v, t); }
    }, "live_set");
    o.property = prop;
    M.obs[prop] = o;
}

function readCues() {
    var n = M.song.getcount("cue_points"), list = [];
    for (var i = 0; i < n; i++) {
        var c = new LiveAPI(null, "live_set cue_points " + i);
        list.push({ name: str(c.get("name")), time: num(c.get("time")) });
    }
    M.cues = list;
    engine.onProp("cues", list, now());
}

// ------------------------------------------------------------------ lifecycle
function init() {
    if (M.ready) { return; }
    try {
        M.song = new LiveAPI(null, "live_set");
        if (!M.song || Number(M.song.id) === 0) { throw new Error("live_set not reachable"); }
        observe("current_song_time");
        for (var p in PROPS) { observe(p); }
        observe("cue_points");
        readCues();
    } catch (e) {
        log("ERROR init: " + e);
        ui("state", "ERROR: LIVE API NOT AVAILABLE (read-only)");
        return;
    }
    var t = now();
    L.posT = t;
    engine.ready(t);
    M.ready = true;
    M.readyT = t;
    claimMaster(false);
    M.task = new Task(tick, this);
    M.task.interval = TICK_MS;
    M.task.repeat();
    log(VERSION + " ready. " + store.doc.sections.length + " sections. Transport untouched on load.");
    pushPrefsToUi();
}

function notifydeleted() {
    if (M.task) { M.task.cancel(); }
    if (M.registry && M.registry.master === M.id) { M.registry.master = null; }
}

// One transport master per Max/Live session (spec §16). Others are read-only.
function claimMaster(force) {
    M.registry = new Global("flow_transport_master");
    var r = M.registry, t = now();
    if (force || !r.master || r.master === M.id || !r.beat || t - r.beat > 3000) {
        r.master = M.id; r.beat = t; M.master = true;
    } else {
        M.master = false;
    }
    engine.setConfig({ readOnly: !M.master });
    if (!M.master) { log("another FLOW instance is the transport master: this one is READ-ONLY (TAKE OVER to switch)"); }
}
function takeover() { claimMaster(true); log("this FLOW is now the transport master"); }

function tick() {
    var t = now();
    if (M.master) {
        if (M.registry.master !== M.id) { M.master = false; engine.setConfig({ readOnly: true }); }
        else { M.registry.beat = t; }
    }
    if (M.cueDirty || t - M.lastCueRead > CUE_REFRESH_MS) { M.cueDirty = false; M.lastCueRead = t; readCues(); }
    if (selftest && selftest.running()) { selftest.tick(t); }
    else { execute(engine.tick(t)); }
    if (M.selftestArmedUntil && t > M.selftestArmedUntil) { M.selftestArmedUntil = 0; }
    if (t - M.lastUi >= UI_MS) { M.lastUi = t; refreshUi(t); }
}

// ------------------------------------------------------------------ UI
function pad3(n) { return (n < 10 ? "00" : n < 100 ? "0" : "") + n; }

function refreshUi(t) {
    var s = engine.status(t), p = store.doc.preferences;
    ui("state", s.state.replace(/_/g, " ") + (s.pendingLabel && s.pendingLabel !== s.state.replace(/_/g, " ") ? "  " + s.pendingLabel : "") +
        (s.readOnly ? "  READ-ONLY" : "") + (selftest && selftest.running() ? "  SELF-TEST RUNNING" : ""));
    ui("current", s.current ? s.current.name : (store.doc.sections.length ? "(no section here)" : "NO SECTIONS - IMPORT LOCATORS"));
    ui("bar", (s.current ? "BAR " + pad3(s.current.bar) + " / " + pad3(s.current.bars) + "   " : "") + "POS " + s.posText +
        (s.current && s.current.pattern ? "   DT " + s.current.pattern : ""));
    ui("next", s.next ? "NEXT " + s.next.name + (s.next.label ? "  [" + s.next.label + "]" : "") + (s.next.at ? " @ " + s.next.at : "") : "NEXT -");
    var msg = s.warnings.length ? "! " + s.warnings.join(" / ") : (s.message || "");
    if (M.selftestArmedUntil) { msg = "SELF-TEST MOVES THE PLAYHEAD AND LOOP. Use a test set. Press SELF-TEST again to start."; }
    if (M.preview) { msg = "IMPORT PREVIEW: " + M.preview.sections.length + " sections" + (M.preview.problems.length ? " / " + M.preview.problems.join(" / ") : "") + " -> CONFIRM or CANCEL IMPORT"; }
    ui("msg", msg);
    ui("set", "SET " + (s.setIndex >= 0 ? pad3(s.setIndex + 1) : "---") + "/" + pad3(s.setCount) + "  " + p.navMode.toUpperCase() +
        (p.autoFollowSetlist ? "" : " PAUSED") + "  " + (p.jumpMode === "safe" ? "SAFE" : "EXPERIMENTAL") +
        "  LEAD " + engine.cfg.safeLeadMs + "ms" + (store.doc.calibration && store.doc.calibration.safeLeadMs ? "" : " (uncalibrated)"));
    ui("test", selftest && selftest.running() ? "SELF-TEST " + selftest.progress() : (M.report ? M.reportStatus : "SELF-TEST: not run in this set"));
}

var QUANT_BARS = [1, 2, 4, 8, 0];
var HOLD_MODES = ["section", "last1", "last2", "last4", "last8"];
function pushPrefsToUi() {
    var p = store.doc.preferences, q = p.quantizationBeats / bpb(), qi = 4;
    for (var i = 0; i < 4; i++) { if (Math.abs(QUANT_BARS[i] - q) < 1e-6) { qi = i; } }
    if (p.quantizationBeats === 0) { qi = 4; }
    ui("ui_nav", "set " + (p.navMode === "source" ? 1 : 0));
    ui("ui_quant", "set " + qi);
    ui("ui_hold", "set " + Math.max(0, HOLD_MODES.indexOf(p.holdMode)));
    ui("ui_jump", "set " + (p.jumpMode === "experimental" ? 1 : 0));
    ui("ui_stop", "set " + (p.stopMode === "immediate" ? 1 : 0));
    ui("ui_follow", "set " + (p.autoFollowSetlist ? 0 : 1));
}

// ------------------------------------------------------------------ persistence
function persist() {
    outlet(1, "set", FlowSections.encodeForStorage(store.doc));
    engine.setDoc(store.doc);
    applyCalibration();
}
function applyCalibration() {
    var c = store.doc.calibration || {};
    engine.setConfig({
        safeLeadMs: c.safeLeadMs ? c.safeLeadMs : 150,
        cueJumpQuantized: c.cueJumpQuantized !== false,
        seekLeadMs: c.seekLatencyMs && !c.seekQuantized ? Math.min(150, Math.max(20, c.seekLatencyMs)) : 40
    });
}
function commit(mutator, what) {
    var r = store.commit(mutator);
    if (!r.ok) { log("REFUSED " + what + ": " + r.errors.join("; ")); ui("msg", "REFUSED: " + r.errors[0]); return false; }
    if (r.warnings && r.warnings.length) { log("WARN " + r.warnings.join("; ")); }
    persist();
    pushPrefsToUi();
    return true;
}

// Stored data from the Live Set (pattr, hidden parameter). Arrives on load.
function restoredoc() {
    // pattr may deliver "symbol <blob>" / "list <blob>" (same handling as michalhorcic/looper-dash).
    var a = arrayfromargs(arguments);
    if (a.length === 2 && (a[0] === "symbol" || a[0] === "list")) { a.shift(); }
    if (a.length !== 1 || String(a[0]) === "0" || String(a[0]) === "") { log("no stored FLOW data in this set"); return; }
    if (String(a[0]) === FlowSections.encodeForStorage(store.doc)) { return; }
    var res = FlowSections.decodeFromStorage(a[0]);
    if (!res.doc) { log("stored FLOW data could not be read (" + res.errors.join("; ") + ") - starting empty, nothing overwritten until you edit"); return; }
    store = new FlowSections.Store(res.doc);
    engine.setDoc(store.doc);
    applyCalibration();
    pushPrefsToUi();
    log("restored " + store.doc.sections.length + " sections, setlist of " + store.doc.performanceOrder.length);
}

// ------------------------------------------------------------------ commands
function hold() { cmd("hold"); }
function release() { cmd("release"); }
function next() { cmd("next"); }
function prev() { cmd("prev"); }
function stop() { cmd("stop"); }
function cancel() {
    if (M.preview) { M.preview = null; log("import cancelled"); return; }
    if (selftest && selftest.running()) { selftest.abort(now()); return; }
    cmd("cancel");
}
function backtoarr() { cmd("backtoarr"); }
function cmd(name) {
    if (selftest && selftest.running()) { ui("msg", "SELF-TEST RUNNING - CANCEL aborts it"); return; }
    engine.command(name, now());
}

// Preferences (from live.menu indices). Menus are hidden parameters that only mirror
// the document; values arriving before/just after init are load-time noise, not clicks.
function prefsAllowed() { return M.ready && now() - M.readyT > 1000; }
function navmode(i) { if (!prefsAllowed()) { return; } commit(function (d) { d.preferences.navMode = i ? "source" : "setlist"; }, "nav mode"); }
function quant(i) { if (!prefsAllowed()) { return; } commit(function (d) { d.preferences.quantizationBeats = QUANT_BARS[i] === 0 ? 0 : QUANT_BARS[i] * bpb(); }, "quantization"); }
function holdlen(i) { if (!prefsAllowed()) { return; } commit(function (d) { d.preferences.holdMode = HOLD_MODES[i] || "section"; }, "hold mode"); }
function jumpmode(i) { if (!prefsAllowed()) { return; } commit(function (d) { d.preferences.jumpMode = i ? "experimental" : "safe"; }, "jump mode"); }
function stopmode(i) { if (!prefsAllowed()) { return; } commit(function (d) { d.preferences.stopMode = i ? "immediate" : "confirm"; }, "stop mode"); }
function follow(i) { if (!prefsAllowed()) { return; } commit(function (d) { d.preferences.autoFollowSetlist = !i; }, "auto follow"); }
function undo() { if (store.undo()) { persist(); pushPrefsToUi(); log("undo"); } }
function redo() { if (store.redo()) { persist(); pushPrefsToUi(); log("redo"); } }
function verbose(on) { M.verbose = on ? 1 : 0; }

// ---- locators -> sections (preview, then explicit confirmation)
function importlocators() {
    if (!M.ready) { return; }
    readCues();
    M.preview = FlowSections.locatorPreview(M.cues);
    log("IMPORT PREVIEW " + JSON.stringify(M.preview));
}
function confirmimport() {
    if (!M.preview) { return; }
    var pv = M.preview;
    M.preview = null;
    if (!pv.sections.length) { log("nothing to import"); return; }
    commit(function (d) {
        d.sections = pv.sections;
        d.performanceOrder = [];
        for (var i = 0; i < pv.sections.length; i++) { d.performanceOrder.push(pv.sections[i].id); }
    }, "import locators");
    log("imported " + pv.sections.length + " sections from locators (locators untouched)");
}

// ---- JSON files
function exportjson(path) {
    try {
        var f = new File(path, "write", "TEXT");
        if (!f.isopen) { throw new Error("cannot open"); }
        var text = FlowSections.exportJson(store.doc).split("\n");
        for (var i = 0; i < text.length; i++) { f.writeline(text[i]); }
        f.eof = f.position; f.close();
        log("exported " + path);
    } catch (e) { log("ERROR export: " + e); ui("msg", "EXPORT FAILED"); }
}
function importjson(path) {
    var text = "";
    try {
        var f = new File(path, "read");
        if (!f.isopen) { throw new Error("cannot open"); }
        while (f.position < f.eof) { var l = f.readline(65536); if (l === null) { break; } text += l + "\n"; }
        f.close();
    } catch (e) { log("ERROR import: " + e); ui("msg", "IMPORT FAILED: cannot read file"); return; }
    var res = FlowSections.importJson(text);
    if (!res.doc) {
        log("IMPORT REJECTED (current sections kept): " + res.errors.join("; "));
        ui("msg", "IMPORT REJECTED: " + res.errors[0] + " - current sections kept");
        return;
    }
    commit(function (d) { var c = res.doc; for (var k in c) { d[k] = c[k]; } }, "import json");
    log("imported " + path + (res.warnings.length ? " with warnings: " + res.warnings.join("; ") : ""));
}
function dump() { post(FlowSections.exportJson(store.doc) + "\n"); }

// ------------------------------------------------------------------ SELF-TEST
function selftestbutton() {
    if (!M.ready || !M.master) { ui("msg", "SELF-TEST needs Live API and transport-master role"); return; }
    if (selftest && selftest.running()) { return; }
    var st = engine.state();
    if (st !== "PLAYING" && st !== "IDLE") { ui("msg", "SELF-TEST: finish or CANCEL the current action first"); return; }
    var t = now();
    if (!M.selftestArmedUntil) { M.selftestArmedUntil = t + 4000; return; }
    M.selftestArmedUntil = 0;
    selftest = FlowSelfTest.create({
        now: now, live: L, estPos: estPos,
        set: function (p, v) { apiSet(p, v); }, call: apiCall, get: apiGet, cueJump: cueJump,
        cues: function () { return M.cues; }, log: log, execute: execute,
        newEngine: function (doc, cfg) {
            var e = FlowEngine.create({ log: logv, config: cfg });
            var res = FlowSections.normalizeDoc(doc);
            e.setDoc(res.doc);
            var tt = now();
            for (var p in PROPS) { e.onProp(p, L[PROPS[p]], tt); }
            e.onProp("cues", M.cues, tt);
            e.onPos(L.pos, L.posT);
            e.ready(tt);
            return e;
        }
    });
    M.reportMeta = { version: VERSION, date: new Date().toString(), tempo: L.tempo, num: L.num, den: L.den, quant: L.quant };
    log("SELF-TEST started");
    selftest.run(t, function (results, calib) {
        M.report = FlowSelfTest.report(M.reportMeta, results, calib) + "\n\nLOG (last 400 lines)\n" + M.logLines.slice(-400).join("\n");
        var fails = 0;
        for (var i = 0; i < results.length; i++) { if (results[i].status === "FAIL") { fails++; } }
        commit(function (d) { d.calibration = d.calibration || {}; for (var k in calib) { if (calib[k] !== null && calib[k] !== undefined) { d.calibration[k] = calib[k]; } } d.calibration.date = M.reportMeta.date; }, "calibration");
        post(M.report + "\n");
        var saved = autoSaveReport();
        M.reportStatus = "SELF-TEST DONE: " + (fails ? fails + " FAIL" : "ALL PASS/INFO") + (saved ? " - report saved next to the set" : " - press SAVE REPORT");
        log(M.reportStatus);
    });
}

function autoSaveReport() {
    var fp = "";
    try { fp = str(M.song.get("file_path")); } catch (e) { fp = ""; }
    if (!fp || fp === "0") { return false; }
    var dir = fp.replace(/[\\\/][^\\\/]*$/, "");
    var d = new Date(), stamp = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "-" + pad2(d.getHours()) + pad2(d.getMinutes());
    return savereport(dir + "/FLOW-SelfTest-" + stamp + ".txt");
}
function pad2(n) { return (n < 10 ? "0" : "") + n; }

function savereport(path) {
    if (!M.report) { ui("msg", "no SELF-TEST report yet"); return false; }
    try {
        var f = new File(path, "write", "TEXT");
        if (!f.isopen) { throw new Error("cannot open " + path); }
        var lines = M.report.split("\n");
        for (var i = 0; i < lines.length; i++) { f.writeline(lines[i]); }
        f.eof = f.position; f.close();
        log("report saved: " + path);
        return true;
    } catch (e) { log("ERROR saving report: " + e); return false; }
}

// Names used by the device's utility buttons.
function import_locators() { importlocators(); }
function confirm_import() { confirmimport(); }
function back_to_arr() { backtoarr(); }
function self_test() { selftestbutton(); }
function take_over() { takeover(); }

function anything() { log("unknown message: " + messagename); }
