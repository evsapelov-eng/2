// FLOW — Milestone 0 API feasibility spike.
// Max classic [js] object, ES5 only (works in the js engine of Max 8.6 / Max 9).
//
// Purpose: prove (or disprove) on a real Live 12 set that Max for Live can
// read/write Song.loop*, current_song_time, cue_points, is_playing, and MEASURE
// the timing properties that the FLOW engine design depends on.
//
// Threading rules followed here (Cycling '74 LiveAPI / Task docs):
//  * LiveAPI is never created in global code; only after live.thisdevice -> "init".
//  * js runs in the low-priority thread; LiveAPI is never used from high priority.
//  * Observer callbacks ONLY record data. Every set/call happens from the Task tick
//    (G.inCallback guard), because Live rejects changes triggered by notifications.
//
// Status of this file: UNVERIFIED in Ableton Live. Logic is tested in Node against
// a transport simulator (flow/tests), which is NOT evidence of Live behaviour.

autowatch = 0;
inlets = 1;
outlets = 1;

var VERSION = "FLOW m0-spike 0.1.0";
var TICK_MS = 5;
var UI_MS = 100;

var G = {
    ready: false,
    t0: 0,
    song: null,
    obs: {},
    st: {
        pos: 0, posT: 0, playing: 0,
        loop: 0, loopStart: 0, loopLength: 0,
        tempo: 120, num: 4, den: 4, b2a: 0
    },
    snapshot: null,
    inCallback: false,
    exp: null,
    task: null,
    lastUi: 0,
    poll: 0,
    lastPoll: null,
    logLines: [],
    verbose: 0,
    target: 1,
    cueIndex: 0
};

// ---------------------------------------------------------------- utilities

function now() { return new Date().getTime(); }

function num(v) {
    if (v !== null && typeof v === "object" && v.length !== undefined) { v = v[0]; }
    return Number(v);
}

function str(v) {
    if (v !== null && typeof v === "object" && v.length !== undefined) {
        var a = [];
        for (var i = 0; i < v.length; i++) { a.push(String(v[i])); }
        return a.join(" ");
    }
    return String(v);
}

// Live stores 32-bit floats (Producer Pal: 0.123456789 reads back 0.12345699965953827),
// so beat comparisons need a tolerance far above 1e-6 but far below a tick (~0.002 b).
var BEAT_EPS = 1e-4;
function sameBeat(a, b) { return Math.abs(a - b) < BEAT_EPS; }

function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
function f3(x) { return (Math.round(x * 1000) / 1000).toFixed(3); }

function beatsPerBar() {
    // ASSUMPTION to verify with exp_bars: LOM beats are quarter notes.
    return G.st.num * 4 / G.st.den;
}

function bpms() { return G.st.tempo / 60000; } // beats per millisecond

function barOf(beat) { return Math.floor(beat / beatsPerBar() + 1e-9) + 1; }

function barStart(bar) { return (bar - 1) * beatsPerBar(); }

function fmtPos(beat) {
    var bpb = beatsPerBar();
    var bar = barOf(beat);
    var inBar = beat - (bar - 1) * bpb;
    return bar + "." + (Math.floor(inBar + 1e-9) + 1) + " (" + f3(beat) + "b)";
}

// Estimated playhead at time t, extrapolated from the last observed position.
function estPos(t) {
    var st = G.st;
    if (!st.playing) { return st.pos; }
    var p = st.pos + (t - st.posT) * bpms();
    var le = st.loopStart + st.loopLength;
    if (st.loop && st.pos < le && p >= le && st.loopLength > 0) {
        p = st.loopStart + (p - le);
    }
    return p;
}

function msUntil(beat, t) { return (beat - estPos(t)) / bpms(); }

function stats(arr) {
    if (!arr.length) { return "n=0"; }
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var sum = 0;
    for (var i = 0; i < s.length; i++) { sum += s[i]; }
    var pick = function (q) { return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
    return "n=" + s.length + " min=" + f2(s[0]) + " med=" + f2(pick(0.5)) +
        " p95=" + f2(pick(0.95)) + " max=" + f2(s[s.length - 1]) + " mean=" + f2(sum / s.length);
}

function intervals(ts) {
    var out = [];
    for (var i = 1; i < ts.length; i++) { out.push(ts[i] - ts[i - 1]); }
    return out;
}

// ------------------------------------------------------------------ logging

function log(msg) {
    var line = "[" + (now() - G.t0) + "ms] " + msg;
    G.logLines.push(line);
    if (G.logLines.length > 20000) { G.logLines.shift(); }
    post("FLOW " + line + "\n");
}

function logv(msg) { if (G.verbose) { log(msg); } }

// Sends "key atom atom ..." so a [route] -> [prepend set] -> message box shows plain
// text. ';' and ',' are message separators in Max message boxes, so strip them.
function ui(key, text) {
    var atoms = String(text).replace(/[;,]/g, " /").split(" ");
    var out = [key];
    for (var i = 0; i < atoms.length; i++) { if (atoms[i] !== "") { out.push(atoms[i]); } }
    outlet(0, out);
}

// --------------------------------------------------------------- API layer

function requireReady() {
    if (!G.ready) { log("ERROR not initialised (waiting for live.thisdevice)"); return false; }
    return true;
}

function apiGet(prop) { return num(G.song.get(prop)); }

function apiSet(prop, val) {
    if (G.inCallback) {
        log("ERROR refused set " + prop + " inside observer callback (design rule)");
        return false;
    }
    try {
        G.song.set(prop, val);
        logv("SET " + prop + "=" + val + " est=" + f3(estPos(now())));
        return true;
    } catch (e) {
        log("ERROR set " + prop + "=" + val + ": " + e);
        return false;
    }
}

function apiCall(fn) {
    if (G.inCallback) { log("ERROR refused call " + fn + " inside observer callback"); return null; }
    try {
        var r = G.song.call(fn);
        logv("CALL " + fn);
        return r;
    } catch (e) {
        log("ERROR call " + fn + ": " + e);
        return null;
    }
}

function takeSnapshot() {
    G.snapshot = { loop: apiGet("loop"), loopStart: apiGet("loop_start"), loopLength: apiGet("loop_length") };
    log("SNAPSHOT loop=" + G.snapshot.loop + " start=" + f3(G.snapshot.loopStart) +
        " length=" + f3(G.snapshot.loopLength));
}

// ------------------------------------------------------------ observation

function observe(prop, handler) {
    var o = new LiveAPI(function (args) {
        if (!args || args[0] !== prop) { return; } // initial "id N" message etc.
        G.inCallback = true;
        try { handler(args[1], now()); } catch (e) { post("FLOW observer error " + prop + ": " + e + "\n"); }
        G.inCallback = false;
    }, "live_set");
    o.property = prop;
    G.obs[prop] = o;
}

function onPos(v, t) {
    var st = G.st;
    var prev = st.pos, prevT = st.posT;
    if (v === prev) { return; }
    st.pos = v;
    st.posT = t;
    if (G.exp && G.exp.onPos) { G.exp.onPos(v, t, prev, prevT); }
}

function onProp(name, key) {
    return function (v, t) {
        G.st[key] = v;
        logv("OBS " + name + "=" + v);
        if (G.exp && G.exp.onProp) { G.exp.onProp(name, v, t); }
        if (name === "back_to_arranger" && v) { log("WARN back_to_arranger=1: Session clips override Arrangement (BACK TO ARRANGEMENT)"); }
    };
}

// Classification of a position update: wrap/backward jump or forward jump.
function jumpKind(pos, t, prev, prevT) {
    var expected = prev + (t - prevT) * bpms();
    if (pos < prev - 0.25) { return "back"; }
    if (pos > expected + 0.5) { return "fwd"; }
    return null;
}

// --------------------------------------------------------------- lifecycle

function init() {
    if (G.ready) { log("init: already initialised"); return; }
    G.t0 = now();
    try {
        G.song = new LiveAPI(null, "live_set");
        if (!G.song || Number(G.song.id) === 0) { throw new Error("live_set not reachable"); }
        observe("current_song_time", onPos);
        observe("is_playing", onProp("is_playing", "playing"));
        observe("loop", onProp("loop", "loop"));
        observe("loop_start", onProp("loop_start", "loopStart"));
        observe("loop_length", onProp("loop_length", "loopLength"));
        observe("tempo", onProp("tempo", "tempo"));
        observe("signature_numerator", onProp("signature_numerator", "num"));
        observe("signature_denominator", onProp("signature_denominator", "den"));
        observe("back_to_arranger", onProp("back_to_arranger", "b2a"));
    } catch (e) {
        log("ERROR init failed: " + e);
        ui("warn", "LIVE API NOT AVAILABLE");
        return;
    }
    G.st.posT = now();
    G.ready = true;
    G.task = new Task(tick, this);
    G.task.interval = TICK_MS;
    G.task.repeat();
    log(VERSION + " initialised. Transport untouched on load.");
    ui("warn", "READY");
    takeSnapshot();
    read();
}

function notifydeleted() {
    if (G.task) { G.task.cancel(); }
    G.exp = null;
}

function tick() {
    var t = now();
    if (G.poll && G.ready) {
        var v = apiGet("current_song_time");
        if (v !== G.lastPoll) { G.lastPoll = v; onPos(v, t); }
    }
    var e = G.exp;
    if (e) {
        if (e.timeoutMs && t - e.startT > e.timeoutMs) {
            endExp("TIMEOUT after " + e.timeoutMs + "ms", true);
        } else if (e.tick) {
            e.tick(t);
        }
    }
    if (t - G.lastUi >= UI_MS) {
        G.lastUi = t;
        var st = G.st;
        ui("pos", (st.playing ? "PLAY " : "STOP ") + "BAR " + fmtPos(estPos(t)) + "  " + f2(st.tempo) + " BPM " + st.num + "/" + st.den);
        ui("loop", "LOOP " + (st.loop ? "ON " : "OFF ") + fmtPos(st.loopStart) + " len " + f3(st.loopLength) + "b" +
            (st.b2a ? "  BACK TO ARRANGEMENT!" : ""));
    }
}

// ---------------------------------------------------------- experiments

function startExp(e) {
    if (!requireReady()) { return false; }
    if (G.exp) { log("BUSY: " + G.exp.name + " running (send abort)"); return false; }
    e.startT = now();
    G.exp = e;
    log("EXP " + e.name + " START " + (e.desc || ""));
    ui("exp", e.name + ": running");
    if (e.start) { e.start(e.startT); }
    return true;
}

function endExp(result, failed) {
    var e = G.exp;
    if (!e) { return; }
    G.exp = null;
    if (e.cleanup) { e.cleanup(); }
    log("EXP " + e.name + " RESULT " + (failed ? "FAIL " : "") + result);
    ui("exp", e.name + ": " + (failed ? "FAIL " : "") + result);
}

function abort() {
    if (G.exp) { endExp("ABORTED by user", true); } else { log("abort: nothing running"); }
}

function requirePlaying() {
    if (!G.st.playing) { endExp("transport is stopped - start Live playback first", true); return false; }
    return true;
}

// E1: observer / poll / Task rates and tempo consistency.
function exp_rates(sec) {
    sec = sec > 0 ? sec : 10;
    var obsT = [], pollT = [], tickT = [], first = null, last = null, lastPoll = null, jumps = 0;
    startExp({
        name: "rates", desc: sec + "s", timeoutMs: sec * 1000 + 3000,
        start: function () { requirePlaying(); },
        onPos: function (pos, t, prev, prevT) {
            obsT.push(t);
            if (jumpKind(pos, t, prev, prevT)) { jumps++; first = null; }
            if (first === null) { first = [t, pos]; }
            last = [t, pos];
        },
        tick: function (t) {
            tickT.push(t);
            var v = apiGet("current_song_time");
            if (v !== lastPoll) { pollT.push(t); lastPoll = v; }
            if (t - this.startT >= sec * 1000) {
                log("RATES observer_interval_ms " + stats(intervals(obsT)));
                log("RATES poll_change_interval_ms " + stats(intervals(pollT)));
                log("RATES task_tick_interval_ms " + stats(intervals(tickT)) + " (requested " + TICK_MS + ")");
                if (first && last && last[0] > first[0]) {
                    var derived = (last[1] - first[1]) / (last[0] - first[0]) * 60000;
                    log("RATES derived_tempo " + f2(derived) + " vs live tempo " + f2(G.st.tempo) + " (jumps/wraps seen " + jumps + ")");
                }
                endExp("observer med interval " + stats(intervals(obsT)).split(" ")[2]);
            }
        }
    });
}

// E2: bar arithmetic vs Live's own bars.beats.sixteenths.ticks.
function exp_bars() {
    startExp({
        name: "bars",
        start: function () {
            var pos = apiGet("current_song_time");
            var live = str(apiCall("get_current_beats_song_time"));
            var m = /(-?\d+)/.exec(live);
            var liveBar = m ? parseInt(m[1], 10) : NaN;
            var ours = barOf(pos);
            log("BARS signature " + G.st.num + "/" + G.st.den + " beatsPerBar(assumed num*4/den)=" + beatsPerBar());
            log("BARS pos=" + f3(pos) + " live=" + live + " computed_bar=" + ours);
            var ls = str(apiCall("get_beats_loop_start"));
            log("BARS loop_start=" + f3(G.st.loopStart) + " live=" + ls + " computed_bar=" + barOf(G.st.loopStart));
            if (liveBar === ours) { endExp("PASS bar math matches Live (stop transport for an exact check)"); }
            else { endExp("MISMATCH live bar " + liveBar + " vs computed " + ours, true); }
        }
    });
}

// E3: HOLD — loop the N-bar aligned region containing the playhead, verify wraps.
function exp_hold(bars, cycles) {
    bars = bars > 0 ? bars : 1;
    cycles = cycles > 0 ? cycles : 2;
    var L, E, len, wraps = [], missed = false, setT = 0, loopObsT = 0;
    startExp({
        name: "hold", desc: bars + " bar(s), " + cycles + " cycles",
        timeoutMs: 0,
        start: function (t) {
            if (!requirePlaying()) { return; }
            takeSnapshot();
            len = bars * beatsPerBar();
            var p = estPos(t);
            L = Math.floor(p / len + 1e-9) * len;
            E = L + len;
            this.timeoutMs = (len / bpms()) * (cycles + 2) + 3000;
            log("HOLD region " + fmtPos(L) + " -> " + fmtPos(E) + " est=" + f3(p) + " remaining_ms=" + f2(msUntil(E, t)));
            setT = now();
            apiSet("loop_start", L);
            apiSet("loop_length", len);
            apiSet("loop", 1);
            // Producer Pal (adamjmurray/producer-pal) reports that loop_start/loop_length
            // read back inside the same request, but `loop` itself reads stale for ~25 ms.
            // So: bounds are checked now, `loop` is confirmed later by its observer.
            var rb = [apiGet("loop"), apiGet("loop_start"), apiGet("loop_length")];
            var ok = sameBeat(rb[1], L) && sameBeat(rb[2], len);
            log("HOLD immediate readback start=" + f3(rb[1]) + " length=" + f3(rb[2]) + (ok ? " OK" : " MISMATCH") +
                " loop=" + rb[0] + (rb[0] === 1 ? " (already on)" : " (not yet on - expected to be stale)"));
        },
        onProp: function (name, v, t) { if (name === "loop" && v === 1 && !loopObsT) { loopObsT = t; } },
        onPos: function (pos, t, prev, prevT) {
            if (jumpKind(pos, t, prev, prevT) === "back") {
                wraps.push("pre=" + f3(prev) + " post=" + f3(pos) + " at+" + (t - setT) + "ms");
            } else if (!wraps.length && pos > E + 0.25) {
                missed = true;
            }
        },
        tick: function () {
            if (missed) { endExp("MISSED: playhead passed loop end before the loop engaged", true); return; }
            if (wraps.length >= cycles) {
                log("HOLD loop=1 confirmed by observer after " + (loopObsT ? (loopObsT - setT) + "ms" : "n/a (no notification seen)"));
                for (var i = 0; i < wraps.length; i++) { log("HOLD wrap " + (i + 1) + " " + wraps[i]); }
                endExp("PASS " + wraps.length + " wraps observed; loop stays ON (use exp_release or loopoff)");
            }
        }
    });
}

// E4: RELEASE — loop=0 now; expect playhead to pass loop end with no extra wrap.
function exp_release() {
    var E, wrapped = false, passed = false, rem = 0;
    startExp({
        name: "release",
        start: function (t) {
            if (!requirePlaying()) { return; }
            var st = G.st;
            var p = estPos(t);
            E = st.loopStart + st.loopLength;
            if (!st.loop || p < st.loopStart || p >= E) {
                endExp("needs an active loop with the playhead inside it (run exp_hold first)", true);
                return;
            }
            rem = msUntil(E, t);
            this.timeoutMs = st.loopLength / bpms() * 2 + 3000;
            apiSet("loop", 0);
            log("RELEASE loop=0 sent, remaining_to_end_ms=" + f2(rem) + " est=" + f3(p));
        },
        onPos: function (pos, t, prev, prevT) {
            if (jumpKind(pos, t, prev, prevT) === "back") { wrapped = true; }
            else if (pos >= E + 0.1) { passed = true; }
        },
        tick: function () {
            if (wrapped) { endExp("EXTRA CYCLE: wrap happened after loop=0 (remaining was " + f2(rem) + "ms)", true); }
            else if (passed) { endExp("PASS clean exit past " + fmtPos(E) + " (remaining was " + f2(rem) + "ms)"); }
        }
    });
}

// E5: RELEASE lead-time sweep. Finds the minimum safe lead before loop end.
function exp_release_sweep() {
    var a = arrayfromargs(arguments);
    var bars = a.length && a[0] > 0 ? a[0] : 1;
    var reps = a.length > 1 && a[1] > 0 ? a[1] : 3;
    var leads = a.length > 2 ? a.slice(2) : [1000, 500, 250, 150, 100, 60, 30, 15];
    var trials = [];
    for (var i = 0; i < leads.length; i++) { for (var r = 0; r < reps; r++) { trials.push({ lead: leads[i] }); } }
    var L, E, len, idx = 0, phase = "", phaseT = 0, seekIssued = false, needWrap = false, wrapSeen = false,
        wrapped = false, passed = false;
    function setPhase(p) { phase = p; phaseT = now(); }
    startExp({
        name: "release_sweep", desc: bars + " bar(s) x" + reps + " leads=" + leads.join(","),
        timeoutMs: 0,
        start: function (t) {
            if (!requirePlaying()) { return; }
            takeSnapshot();
            len = bars * beatsPerBar();
            L = Math.floor(estPos(t) / len + 1e-9) * len;
            E = L + len;
            apiSet("loop_start", L);
            apiSet("loop_length", len);
            apiSet("loop", 1);
            log("SWEEP region " + fmtPos(L) + " -> " + fmtPos(E) + ", " + trials.length + " trials");
            setPhase("enter");
        },
        onPos: function (pos, t, prev, prevT) {
            var k = jumpKind(pos, t, prev, prevT);
            if (phase === "wait" && k === "back") { wrapSeen = true; }
            if (phase === "observe") {
                if (k === "back") { wrapped = true; } else if (pos >= E + 0.1) { passed = true; }
            }
        },
        tick: function (t) {
            var tr = trials[idx];
            var trialBudget = len / bpms() * 3 + 3000;
            if (t - phaseT > trialBudget) {
                tr.result = "TIMEOUT(" + phase + ")";
                log("SWEEP trial " + (idx + 1) + " lead=" + tr.lead + " " + tr.result);
                return this.next();
            }
            var p = estPos(t);
            if (phase === "enter") {
                if (!G.st.loop) { return; }
                if (p < L || p >= E) {
                    if (!seekIssued) { seekIssued = true; apiSet("current_song_time", L); }
                    return;
                }
                needWrap = msUntil(E, t) <= tr.lead + 20;
                wrapSeen = false;
                setPhase("wait");
            } else if (phase === "wait") {
                if (needWrap) { if (wrapSeen) { needWrap = false; } return; }
                if (msUntil(E, t) <= tr.lead) {
                    tr.rem = msUntil(E, t);
                    wrapped = false; passed = false;
                    apiSet("loop", 0);
                    setPhase("observe");
                }
            } else if (phase === "observe") {
                if (wrapped || passed) {
                    tr.result = wrapped ? "WRAPPED" : "CLEAN";
                    log("SWEEP trial " + (idx + 1) + " lead=" + tr.lead + "ms rem_at_set=" + f2(tr.rem) + "ms -> " + tr.result);
                    this.next();
                }
            }
        },
        next: function () {
            idx++;
            if (idx >= trials.length) { return this.report(); }
            seekIssued = false;
            apiSet("loop", 1);
            setPhase("enter");
        },
        report: function () {
            var byLead = {}, order = [], safe = null;
            for (var j = 0; j < trials.length; j++) {
                var k = trials[j].lead;
                if (!byLead[k]) { byLead[k] = { n: 0, clean: 0, other: 0 }; order.push(k); }
                byLead[k].n++;
                if (trials[j].result === "CLEAN") { byLead[k].clean++; } else { byLead[k].other++; }
            }
            order.sort(function (x, y) { return y - x; });
            for (var q = 0; q < order.length; q++) {
                var b = byLead[order[q]];
                log("SWEEP SUMMARY lead=" + order[q] + "ms clean=" + b.clean + "/" + b.n);
                if (b.clean === b.n && (safe === null || safe === order[q - 1])) { safe = order[q]; }
            }
            apiSet("loop", 0);
            if (safe === null) { endExp("no lead time was reliably clean", true); return; }
            log("SWEEP RECOMMENDED_RELEASE_LEAD_MS " + (safe * 2) + " (2x smallest all-clean lead " + safe + "ms)");
            endExp("smallest all-clean lead " + safe + "ms; loop left OFF");
        }
    });
}

// E6: late HOLD — pre-set loop brace, enable loop at <lead> ms before the boundary.
// Negative leads enable the loop AFTER the playhead passed the loop end (answers:
// does Live jump back, or keep playing?).
function exp_hold_sweep() {
    var a = arrayfromargs(arguments);
    var bars = a.length && a[0] > 0 ? a[0] : 1;
    var reps = a.length > 1 && a[1] > 0 ? a[1] : 2;
    var leads = a.length > 2 ? a.slice(2) : [500, 250, 100, 50, 20, -50, -150];
    var trials = [];
    for (var i = 0; i < leads.length; i++) { for (var r = 0; r < reps; r++) { trials.push({ lead: leads[i] }); } }
    var len, B, idx = 0, phase = "", phaseT = 0, back = false, setPos = 0;
    function setPhase(p) { phase = p; phaseT = now(); }
    startExp({
        name: "hold_sweep", desc: bars + " bar(s) x" + reps + " leads=" + leads.join(","),
        timeoutMs: 0,
        start: function () {
            if (!requirePlaying()) { return; }
            takeSnapshot();
            len = bars * beatsPerBar();
            apiSet("loop", 0);
            this.prepare(now());
        },
        prepare: function (t) {
            var tr = trials[idx];
            var p = estPos(t);
            B = (Math.floor(p / len + 1e-9) + 1) * len;
            while (msUntil(B, t) < Math.max(tr.lead, 0) + 200) { B += len; }
            apiSet("loop_start", B - len);
            apiSet("loop_length", len);
            back = false;
            setPhase("wait");
        },
        onPos: function (pos, t, prev, prevT) {
            if (phase === "observe" && jumpKind(pos, t, prev, prevT) === "back") { back = true; }
        },
        tick: function (t) {
            var tr = trials[idx];
            if (t - phaseT > len / bpms() * 3 + 3000) {
                tr.result = "TIMEOUT(" + phase + ")";
                return this.next(t);
            }
            var p = estPos(t);
            if (phase === "wait") {
                var fire = tr.lead >= 0 ? msUntil(B, t) <= tr.lead : (p - B) / bpms() >= -tr.lead;
                if (fire) {
                    tr.rem = msUntil(B, t);
                    setPos = p;
                    apiSet("loop", 1);
                    setPhase("observe");
                }
            } else if (phase === "observe") {
                var limit = Math.max(B, setPos) + Math.max(1, 300 * bpms());
                if (back) { tr.result = tr.lead >= 0 ? "HELD" : "JUMPED_BACK"; }
                else if (p > limit) { tr.result = tr.lead >= 0 ? "MISSED" : "NO_JUMP"; }
                if (tr.result) {
                    log("HOLDSWEEP trial " + (idx + 1) + " lead=" + tr.lead + "ms rem_at_set=" + f2(tr.rem) + "ms -> " + tr.result);
                    this.next(t);
                }
            }
        },
        next: function (t) {
            apiSet("loop", 0);
            idx++;
            if (idx >= trials.length) { return this.report(); }
            this.prepare(t);
        },
        report: function () {
            var acc = {}, order = [];
            for (var j = 0; j < trials.length; j++) {
                var k = trials[j].lead;
                if (!acc[k]) { acc[k] = {}; order.push(k); }
                acc[k][trials[j].result] = (acc[k][trials[j].result] || 0) + 1;
            }
            for (var q = 0; q < order.length; q++) {
                var parts = [];
                for (var key in acc[order[q]]) { parts.push(key + "=" + acc[order[q]][key]); }
                log("HOLDSWEEP SUMMARY lead=" + order[q] + "ms " + parts.join(" "));
            }
            endExp("done; loop left OFF (see summary)");
        }
    });
}

// Shared jump measurement for exp_seek / exp_cuejump.
function measureJump(name, target, fire) {
    var setT = 0, preEst = 0, done = false, result = null;
    startExp({
        name: name, desc: "target " + fmtPos(target),
        timeoutMs: 0,
        start: function (t) {
            this.timeoutMs = (G.st.playing ? 8 * beatsPerBar() / bpms() : 0) + 3000;
            var q = apiGet("clip_trigger_quantization");
            preEst = estPos(t);
            log(name.toUpperCase() + " from est=" + f3(preEst) + " to " + f3(target) + " playing=" + G.st.playing + " global_quantization_index=" + q);
            setT = now();
            fire();
        },
        onPos: function (pos, t, prev, prevT) {
            if (done) { return; }
            var k = G.st.playing ? jumpKind(pos, t, prev, prevT) : (sameBeat(pos, target) ? "set" : null);
            if (!k) { return; }
            done = true;
            var lat = t - setT;
            var bpb = beatsPerBar();
            var toBar = Math.ceil(prev / bpb - 1e-9) * bpb - prev;
            var win = (t - prevT) * bpms();
            var nearBar = toBar <= win + 0.05;
            var cls = !G.st.playing ? "STOPPED_SET" : (nearBar && lat > 150 ? "LIKELY_QUANTIZED" : "LIKELY_IMMEDIATE");
            result = cls + " latency=" + lat + "ms last_pre=" + f3(prev) + " first_post=" + f3(pos) +
                " landing_offset=" + f3(pos - target) + "b obs_window=" + f3(win) + "b";
        },
        tick: function () { if (result) { endExp(result); } }
    });
}

// E7: does setting current_song_time while playing jump immediately or quantized?
function exp_seek() {
    if (!requireReady()) { return; }
    var target = barStart(G.target);
    measureJump("seek", target, function () { apiSet("current_song_time", target); });
}

// E8: CuePoint.jump (docs: quantized if song is playing) — measure it.
function exp_cuejump() {
    if (!requireReady()) { return; }
    var cue = cueApi(G.cueIndex);
    if (!cue) { return; }
    var target = num(cue.get("time"));
    measureJump("cuejump", target, function () {
        try { cue.call("jump"); } catch (e) { log("ERROR cue jump: " + e); }
    });
}

// E9: native backward jump via loop wrap: loop [targetBar, nextBar) -> Live wraps to target.
function exp_wrapjump() {
    var T, B, pre = null, post = null, setT = 0;
    startExp({
        name: "wrapjump", desc: "to bar " + G.target,
        timeoutMs: 0,
        start: function (t) {
            if (!requirePlaying()) { return; }
            var p = estPos(t);
            T = barStart(G.target);
            var bpb = beatsPerBar();
            B = (Math.floor(p / bpb + 1e-9) + 1) * bpb;
            if (msUntil(B, t) < 300) { B += bpb; }
            if (T >= p) { endExp("target bar must be before the playhead (backward jump only)", true); return; }
            this.timeoutMs = msUntil(B, t) + 4000;
            takeSnapshot();
            setT = now();
            apiSet("loop_start", T);
            apiSet("loop_length", B - T);
            apiSet("loop", 1);
            log("WRAPJUMP loop " + fmtPos(T) + " -> " + fmtPos(B) + " remaining_ms=" + f2(msUntil(B, t)));
        },
        onPos: function (pos, t, prev, prevT) {
            if (pre === null && jumpKind(pos, t, prev, prevT) === "back") { pre = prev; post = pos; }
        },
        tick: function () {
            if (pre === null) { return; }
            apiSet("loop", 0); // outside the callback; leaves playback linear from T
            apiSet("loop_start", G.snapshot.loopStart);
            apiSet("loop_length", G.snapshot.loopLength);
            endExp("PASS jumped at ~" + f3(pre) + " (boundary " + f3(B) + ") landed " + f3(post) +
                " (target " + f3(T) + ", +" + f3(post - T) + "b observation delay); loop OFF, brace restored");
        }
    });
}

// E10: can a set be issued from inside an observer callback? (expected: NO)
function exp_notifyset() {
    if (!requireReady()) { return; }
    var fired = false;
    var o = new LiveAPI(function (args) {
        if (fired || !args || args[0] !== "loop") { return; }
        fired = true;
        try {
            G.song.set("loop", args[1]); // same value: harmless if it is accepted
            log("NOTIFYSET set inside callback did not throw (check Max console for Live errors)");
        } catch (e) {
            log("NOTIFYSET set inside callback threw: " + e);
        }
    }, "live_set");
    o.property = "loop";
    G.obs.notifyset = o;
}

// ------------------------------------------------------ manual commands

function read() {
    if (!requireReady()) { return; }
    var props = ["current_song_time", "is_playing", "loop", "loop_start", "loop_length", "tempo",
        "signature_numerator", "signature_denominator", "back_to_arranger", "clip_trigger_quantization",
        "start_time", "song_length"];
    for (var i = 0; i < props.length; i++) {
        var v;
        try { v = str(G.song.get(props[i])); } catch (e) { v = "ERROR " + e; }
        log("READ " + props[i] + " = " + v);
    }
    cuelist();
}

function cuelist() {
    if (!requireReady()) { return; }
    var n = G.song.getcount("cue_points");
    log("CUES count=" + n);
    for (var i = 0; i < n; i++) {
        var c = new LiveAPI(null, "live_set cue_points " + i);
        log("CUE " + i + " name=\"" + str(c.get("name")) + "\" time=" + f3(num(c.get("time"))) + " bar=" + fmtPos(num(c.get("time"))));
    }
}

function cueApi(i) {
    var n = G.song.getcount("cue_points");
    if (i < 0 || i >= n) { log("ERROR cue index " + i + " out of range (count " + n + ")"); return null; }
    return new LiveAPI(null, "live_set cue_points " + i);
}

function loopon() { if (requireReady()) { apiSet("loop", 1); } }
function loopoff() { if (requireReady()) { apiSet("loop", 0); } }

function setloop(bar, bars) {
    if (!requireReady()) { return; }
    bar = bar > 0 ? bar : 1;
    bars = bars > 0 ? bars : 1;
    apiSet("loop_start", barStart(bar));
    apiSet("loop_length", bars * beatsPerBar());
    log("SETLOOP bar " + bar + " x " + bars + " bars (loop state unchanged)");
}

function seek() { if (requireReady()) { apiSet("current_song_time", barStart(G.target)); } }
function cuejump() { if (requireReady()) { var c = cueApi(G.cueIndex); if (c) { c.call("jump"); } } }
function play() { if (requireReady()) { apiCall("continue_playing"); } }
function stop() { if (requireReady()) { apiCall("stop_playing"); } }
function backtoarr() { if (requireReady()) { apiSet("back_to_arranger", 0); } }

function restore() {
    if (!requireReady() || !G.snapshot) { return; }
    apiSet("loop_start", G.snapshot.loopStart);
    apiSet("loop_length", G.snapshot.loopLength);
    apiSet("loop", G.snapshot.loop);
    log("RESTORE loop state from last snapshot");
}

function target(bar) { G.target = bar > 0 ? Math.floor(bar) : 1; log("target bar = " + G.target); }
function cueindex(i) { G.cueIndex = i >= 0 ? Math.floor(i) : 0; log("cue index = " + G.cueIndex); }
function poll(on) { G.poll = on ? 1 : 0; log("poll current_song_time each tick = " + G.poll); }
function verbose(on) { G.verbose = on ? 1 : 0; log("verbose = " + G.verbose); }
function clearlog() { G.logLines = []; log("log cleared"); }

function savelog(path) {
    try {
        var f = new File(path, "write", "TEXT");
        if (!f.isopen) { log("ERROR cannot open " + path); return; }
        f.writeline(VERSION);
        for (var i = 0; i < G.logLines.length; i++) { f.writeline(G.logLines[i]); }
        f.eof = f.position;
        f.close();
        log("log saved: " + path + " (" + G.logLines.length + " lines)");
    } catch (e) {
        log("ERROR savelog: " + e);
    }
}

function anything() {
    log("unknown message: " + messagename);
}
