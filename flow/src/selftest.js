// FLOW — SELF-TEST: one button that measures Live's real behaviour on this computer,
// runs the FLOW engine through HOLD / RELEASE / setlist repeat / PREV / NEXT-from-HOLD
// on a temporary section map, calibrates timing, and writes a report.
//
// The test MOVES THE PLAYHEAD AND THE ARRANGEMENT LOOP. It is meant for a test set.
// It never creates or edits clips, locators or automation. The previous loop state is
// restored at the end.
//
// Pure logic: everything Live-related goes through ctx (see create()).

var FlowSelfTest = (function () {
    var FE = (typeof FlowEngine !== "undefined") ? FlowEngine : require("./engine.js");
    var EPS = 1e-4;

    function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
    function f3(x) { return (Math.round(x * 1000) / 1000).toFixed(3); }
    function median(a) { if (!a.length) { return null; } var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
    function p95(a) { if (!a.length) { return null; } var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(0.95 * (s.length - 1) + 0.5))]; }
    function intervals(ts) { var o = []; for (var i = 1; i < ts.length; i++) { o.push(ts[i] - ts[i - 1]); } return o; }

    // ctx: now(), live{pos,posT,playing,loop,loopStart,loopLength,tempo,num,den,quant,songLength},
    //      estPos(t), set(prop,v), call(fn), get(prop), cueJump(i), cues(), log(line),
    //      newEngine(doc, cfg), execute(actions)
    function create(ctx) {
        var L = ctx.live;
        function bpb() { return L.num * 4 / L.den; }
        function bpms() { return L.tempo / 60000; }
        function est(t) { return ctx.estPos(t); }
        function msUntil(b, t) { return (b - est(t)) / bpms(); }
        function barStart(beat) { return Math.floor(beat / bpb() + 1e-9) * bpb(); }
        function jumpKind(pos, t, prev, prevT) {
            if (pos < prev - 0.25) { return "back"; }
            if (pos > prev + (t - prevT) * bpms() + 0.5) { return "fwd"; }
            return null;
        }

        var results = [], running = false, cur = null, idx = 0, snapshot = null, startT = 0, calib = {}, onDone = null;
        var steps = [];

        function result(id, title, status, summary, data) {
            var r = { id: id, title: title, status: status, summary: summary, data: data || {} };
            results.push(r);
            ctx.log("SELFTEST " + id + " " + status + " - " + summary);
            return r;
        }

        function finishStep(status, summary, data) {
            if (!cur) { return; }
            var s = cur;
            cur = null;
            if (s.cleanup) { s.cleanup(); }
            result(s.id, s.title, status, summary, data);
            idx++;
            pendingStart = true;
        }
        var pendingStart = false;

        function startNext(t) {
            pendingStart = false;
            if (idx >= steps.length) { return finish(t); }
            cur = steps[idx](t);
            cur.t0 = t;
            cur.finish = finishStep;
            ctx.log("SELFTEST start " + cur.id + " " + cur.title);
            if (cur.start) { cur.start(t); }
        }

        function finish(t) {
            running = false;
            if (snapshot) {
                ctx.set("loop", 0);
                ctx.set("loop_start", snapshot.loopStart);
                ctx.set("loop_length", snapshot.loopLength);
                if (snapshot.loop) { ctx.set("loop", 1); }
            }
            ctx.log("SELFTEST finished in " + Math.round((t - startT) / 1000) + " s");
            if (onDone) { onDone(results, calib); }
        }

        // ---------------------------------------------------------------- steps
        function stepPreflight(t) {
            var waitPlay = false, seekSent = false;
            return {
                id: "S0", title: "Preflight: transport, room for the test", timeoutMs: 8000,
                start: function () {
                    if (L.b2a) { return this.finish("FAIL", "Back to Arrangement is lit: press it in Live first"); }
                    if (!L.playing) { ctx.call("continue_playing"); waitPlay = true; }
                },
                tick: function (t2) {
                    if (!L.playing) { return; }
                    var need = 40 * bpb();
                    if (L.songLength && est(t2) + need > L.songLength && est(t2) > 4 * bpb()) {
                        if (!seekSent) { seekSent = true; ctx.set("current_song_time", 0); }
                        return;
                    }
                    this.finish("PASS", "playing at " + f2(L.tempo) + " BPM " + L.num + "/" + L.den +
                        (waitPlay ? " (started by SELF-TEST)" : "") + (seekSent ? ", moved to bar 1 for room" : "") +
                        (L.songLength && L.songLength < need ? " - WARNING: set is shorter than 40 bars" : ""),
                        { tempo: L.tempo, num: L.num, den: L.den });
                }
            };
        }

        function stepRates() {
            var obsT = [], first = null, last = null, jumps = 0;
            return {
                id: "S1", title: "Position updates from Live (rate, tempo consistency)", timeoutMs: 6000,
                onPos: function (pos, t, prev, prevT) {
                    obsT.push(t);
                    if (jumpKind(pos, t, prev, prevT)) { jumps++; first = null; }
                    if (first === null) { first = [t, pos]; }
                    last = [t, pos];
                },
                tick: function (t) {
                    if (t - this.t0 < 4000) { return; }
                    var iv = intervals(obsT);
                    calib.observerMedianMs = median(iv);
                    calib.observerP95Ms = p95(iv);
                    var derived = first && last && last[0] > first[0] ? (last[1] - first[1]) / (last[0] - first[0]) * 60000 : null;
                    var ok = iv.length >= 10 && derived !== null && Math.abs(derived - L.tempo) < 2;
                    this.finish(ok ? "PASS" : "FAIL", "updates every ~" + calib.observerMedianMs + " ms (p95 " + calib.observerP95Ms +
                        " ms), derived tempo " + (derived === null ? "n/a" : f2(derived)) + " vs " + f2(L.tempo),
                        { intervals: iv.length, derivedTempo: derived });
                }
            };
        }

        function stepBars() {
            return {
                id: "S2", title: "Bar arithmetic vs Live (beats -> bars)", timeoutMs: 3000,
                start: function () {
                    var match = 0, tries = [];
                    for (var i = 0; i < 3; i++) {
                        var pos = ctx.get("current_song_time");
                        var s = String(ctx.call("get_current_beats_song_time"));
                        var m = /(-?\d+)/.exec(s);
                        var ours = Math.floor(pos / bpb() + 1e-9) + 1;
                        if (m && parseInt(m[1], 10) === ours) { match++; }
                        tries.push(s + "=" + ours);
                    }
                    this.finish(match >= 2 ? "PASS" : "FAIL", "Live " + tries.join(", ") + " (" + match + "/3 match)", {});
                }
            };
        }

        function stepHoldRelease() {
            var R, len, phase = "hold", wraps = 0, loopOkT = 0, sentT = 0, relRem = 0, extra = false;
            return {
                id: "S3", title: "HOLD 1 bar (2 cycles) then RELEASE (raw Live API)", timeoutMs: 20000,
                start: function (t) {
                    len = bpb();
                    var p = est(t);
                    R = barStart(p);
                    if (msUntil(R + len, t) < 600) { R += len; }
                    sentT = t;
                    ctx.set("loop_start", R); ctx.set("loop_length", len); ctx.set("loop", 1);
                },
                onProp: function (n, v, t) { if (n === "loop" && v === 1 && !loopOkT) { loopOkT = t; } },
                onPos: function (pos, t, prev, prevT) {
                    var k = jumpKind(pos, t, prev, prevT);
                    if (k === "back" && Math.abs(pos - R) < 1) { if (phase === "hold") { wraps++; } else { extra = true; } }
                    if (phase === "release" && pos >= R + len + 0.1) { phase = "passed"; }
                },
                tick: function (t) {
                    if (phase === "hold" && wraps >= 2) {
                        phase = "release"; relRem = msUntil(R + len, t);
                        if (relRem < 300) { return; }
                        ctx.set("loop", 0);
                    }
                    if (phase === "passed") {
                        calib.loopConfirmMs = loopOkT ? loopOkT - sentT : null;
                        this.finish(extra ? "FAIL" : "PASS", "looped 2x; loop confirmed in " + calib.loopConfirmMs + " ms; release with " +
                            Math.round(relRem) + " ms left -> " + (extra ? "EXTRA CYCLE" : "clean exit"), {});
                    }
                },
                cleanup: function () { ctx.set("loop", 0); }
            };
        }

        function stepReleaseSweep() {
            var leads = [500, 250, 150, 100, 60, 30], reps = 2, trials = [], i;
            for (i = 0; i < leads.length; i++) { for (var r = 0; r < reps; r++) { trials.push({ lead: leads[i] }); } }
            var R, E, len, k = 0, phase = "", phaseT = 0, seek = false, needWrap = false, wrapSeen = false, wrapped = false, passed = false;
            function setPhase(p, t) { phase = p; phaseT = t; }
            return {
                id: "S4", title: "RELEASE lead-time sweep (how late may RELEASE be?)", timeoutMs: 120000,
                start: function (t) {
                    len = bpb(); R = barStart(est(t)); E = R + len;
                    ctx.set("loop_start", R); ctx.set("loop_length", len); ctx.set("loop", 1);
                    setPhase("enter", t);
                },
                onPos: function (pos, t, prev, prevT) {
                    var kd = jumpKind(pos, t, prev, prevT);
                    if (phase === "wait" && kd === "back") { wrapSeen = true; }
                    if (phase === "observe") { if (kd === "back") { wrapped = true; } else if (pos >= E + 0.1) { passed = true; } }
                },
                tick: function (t) {
                    var tr = trials[k], p = est(t);
                    if (t - phaseT > len / bpms() * 3 + 3000) { tr.result = "TIMEOUT"; return this.next(t); }
                    if (phase === "enter") {
                        if (!L.loop) { return; }
                        if (p < R || p >= E) { if (!seek) { seek = true; ctx.set("current_song_time", R); } return; }
                        needWrap = msUntil(E, t) <= tr.lead + 20; wrapSeen = false; setPhase("wait", t);
                    } else if (phase === "wait") {
                        if (needWrap) { if (wrapSeen) { needWrap = false; } return; }
                        if (msUntil(E, t) <= tr.lead) { tr.rem = msUntil(E, t); wrapped = passed = false; ctx.set("loop", 0); setPhase("observe", t); }
                    } else if (phase === "observe" && (wrapped || passed)) {
                        tr.result = wrapped ? "WRAPPED" : "CLEAN";
                        ctx.log("SELFTEST S4 lead=" + tr.lead + "ms rem=" + f2(tr.rem) + "ms " + tr.result);
                        this.next(t);
                    }
                },
                next: function (t) {
                    k++;
                    if (k >= trials.length) { return this.report(); }
                    seek = false; ctx.set("loop", 1); setPhase("enter", t);
                },
                report: function () {
                    var by = {}, safe = null, lines = [];
                    for (var j = 0; j < trials.length; j++) {
                        var b = by[trials[j].lead] || (by[trials[j].lead] = { n: 0, clean: 0 });
                        b.n++; if (trials[j].result === "CLEAN") { b.clean++; }
                    }
                    for (var q = 0; q < leads.length; q++) {
                        var bb = by[leads[q]];
                        lines.push(leads[q] + "ms " + bb.clean + "/" + bb.n);
                        if (bb.clean === bb.n && (q === 0 || safe === leads[q - 1])) { safe = leads[q]; }
                    }
                    calib.releaseCleanLeadMs = safe;
                    calib.safeLeadMs = safe === null ? null : Math.max(80, safe * 2);
                    if (safe === null) { return this.finish("FAIL", "no lead time was reliably clean: " + lines.join(", ")); }
                    this.finish("PASS", "clean: " + lines.join(", ") + " -> safe lead set to " + calib.safeLeadMs + " ms");
                },
                cleanup: function () { ctx.set("loop", 0); }
            };
        }

        function stepLateHold() {
            var leads = [100, -150], k = 0, len, B, phase = "", phaseT = 0, back = false, setPos = 0, out = [];
            return {
                id: "S5", title: "Loop switched on late (near/after the loop end)", timeoutMs: 40000,
                start: function (t) { len = bpb(); ctx.set("loop", 0); this.prepare(t); },
                prepare: function (t) {
                    var lead = leads[k], p = est(t);
                    B = barStart(p) + len;
                    while (msUntil(B, t) < Math.max(lead, 0) + 300) { B += len; }
                    ctx.set("loop_start", B - len); ctx.set("loop_length", len);
                    back = false; phase = "wait"; phaseT = t;
                },
                onPos: function (pos, t, prev, prevT) { if (phase === "observe" && jumpKind(pos, t, prev, prevT) === "back") { back = true; } },
                tick: function (t) {
                    var lead = leads[k], p = est(t), res = null;
                    if (t - phaseT > len / bpms() * 3 + 3000) { res = "TIMEOUT"; }
                    else if (phase === "wait") {
                        var fire = lead >= 0 ? msUntil(B, t) <= lead : (p - B) / bpms() >= -lead;
                        if (fire) { setPos = p; ctx.set("loop", 1); phase = "observe"; phaseT = t; }
                        return;
                    } else if (back) { res = lead >= 0 ? "HELD" : "JUMPED_BACK"; }
                    else if (p > Math.max(B, setPos) + Math.max(1, 300 * bpms())) { res = lead >= 0 ? "MISSED" : "NO_JUMP"; }
                    if (!res) { return; }
                    out.push(lead + "ms:" + res);
                    if (lead < 0) { calib.lateLoopJumpsBack = res === "JUMPED_BACK"; }
                    ctx.set("loop", 0);
                    k++;
                    if (k >= leads.length) {
                        return this.finish("INFO", out.join(", ") + (calib.lateLoopJumpsBack ? " - Live jumps back when the loop is enabled late: FLOW rejects late HOLD (correct policy)" : ""));
                    }
                    this.prepare(t);
                },
                cleanup: function () { ctx.set("loop", 0); }
            };
        }

        function measureJump(id, title, targetFn, fire, onRes) {
            var setT = 0, target = 0, res = null;
            return {
                id: id, title: title, timeoutMs: 12000,
                start: function (t) {
                    target = targetFn(t);
                    if (target === null) { return this.finish("NOT RUN", "no locator in this set (add one to test locator jumps)"); }
                    setT = t; fire(target);
                },
                onPos: function (pos, t, prev, prevT) {
                    if (res || !setT || !jumpKind(pos, t, prev, prevT)) { return; }
                    var lat = t - setT, toBar = Math.ceil(prev / bpb() - 1e-9) * bpb() - prev, win = (t - prevT) * bpms();
                    var quantized = toBar <= win + 0.05 && lat > 150;
                    res = { quantized: quantized, lat: lat, prev: prev, pos: pos };
                },
                tick: function () {
                    if (!res) { return; }
                    if (onRes) { onRes(res); }
                    this.finish("INFO", (res.quantized ? "QUANTIZED (jumped at the bar line)" : "IMMEDIATE") + ", " + res.lat +
                        " ms after the command, from " + f3(res.prev) + " to " + f3(res.pos) + " (target " + f3(target) + ")", res);
                }
            };
        }

        function stepSeek() {
            return measureJump("S6", "current_song_time write while playing (timed seek)",
                function (t) { return Math.max(0, barStart(est(t)) - 2 * bpb()); },
                function (tg) { ctx.set("current_song_time", tg); },
                function (r) { calib.seekQuantized = r.quantized; calib.seekLatencyMs = r.lat; });
        }

        function stepCue() {
            var cueIndex = -1;
            return measureJump("S7", "CuePoint.jump while playing (locator jump)",
                function (t) {
                    var cs = ctx.cues(), p = est(t), best = null;
                    for (var i = 0; i < cs.length; i++) {
                        if (Math.abs(cs[i].time - p) > 2 * bpb() && (best === null || Math.abs(cs[i].time - p) < Math.abs(cs[best].time - p))) { best = i; }
                    }
                    if (best === null) { return null; }
                    cueIndex = best;
                    return cs[best].time;
                },
                function () { ctx.cueJump(cueIndex); },
                function (r) { calib.cueJumpQuantized = r.quantized; });
        }

        // Engine scenario on a temporary section map ahead of the playhead.
        function stepEngine() {
            var eng, doc, script, si = 0, waitT = 0, log = [], S = [], fails = 0, checks = 0;
            function check(name, ok, detail) {
                checks++; if (!ok) { fails++; }
                log.push((ok ? "PASS " : "FAIL ") + name + (detail ? " (" + detail + ")" : ""));
                ctx.log("SELFTEST S8 " + (ok ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : ""));
            }
            function lastEvent(type, since) {
                for (var i = eng.history.length - 1; i >= 0; i--) { var e = eng.history[i]; if (e.t < since) { break; } if (e.type === type) { return e; } }
                return null;
            }
            function inSec(n, t) { var p = eng.estPos(t); return p >= S[n].startBeat + 0.25 && p < S[n].startBeat + S[n].lengthBeats - 0.25; }
            return {
                id: "S8", title: "FLOW engine scenario (T05-T09 on a temporary 4-section map)", timeoutMs: 180000,
                start: function (t) {
                    var two = 2 * bpb(), p = est(t);
                    var B0 = (Math.floor(p / two + 1e-9) + 1) * two;
                    if (B0 - p < bpb()) { B0 += two; }
                    var names = ["ST-A", "ST-B", "ST-C", "ST-D"];
                    var secs = [];
                    for (var i = 0; i < 4; i++) { secs.push({ id: "st" + i, name: names[i], startBeat: B0 + i * two, lengthBeats: two, holdEligible: true }); }
                    doc = { schemaVersion: 1, sections: secs, performanceOrder: ["st0", "st1", "st0", "st2", "st1", "st0"],
                        preferences: { quantizationBeats: bpb(), navMode: "setlist", autoFollowSetlist: true, holdMode: "section", jumpMode: "safe", stopMode: "confirm" } };
                    eng = ctx.newEngine(doc, { safeLeadMs: calib.safeLeadMs || 150, cueJumpQuantized: calib.cueJumpQuantized !== false });
                    S = eng.getDoc().sections;
                    ctx.log("SELFTEST S8 sections from beat " + B0 + ": A,B,C,D x 2 bars; setlist A B A C B A");
                    script = [
                        { name: "reach A", until: function (t2) { return inSec(0, t2); } },
                        { name: "HOLD A", act: function (t2) { eng.command("hold", t2); },
                            until: function () { return eng.state() === "HOLD_ACTIVE"; },
                            then: function (t2) { var e = lastEvent("hold_active", 0); check("T05 HOLD becomes ACTIVE only after Live confirms", !!e, e ? "confirmed in " + e.confirmMs + " ms" : ""); } },
                        { name: "2 wraps", until: function () { var n = 0; for (var i = 0; i < eng.history.length; i++) { if (eng.history[i].type === "wrap") { n++; } } return n >= 2; },
                            then: function () { check("T05 Live repeats the held section", true, "2 wraps"); } },
                        { name: "RELEASE", act: function (t2) { eng.command("release", t2); waitT = t2; },
                            until: function () { return eng.state() === "PLAYING"; },
                            then: function (t2) { var e = lastEvent("released", waitT); check("T06 RELEASE exits without an extra cycle", e && e.extraCycles === 0, e ? "extra cycles " + e.extraCycles : "no release event"); } },
                        { name: "PREV (B -> A, earlier in the arrangement)", act: function (t2) { waitT = t2; eng.command("prev", t2); },
                            until: function () { return !!lastEvent("landed", waitT) || !!lastEvent("rejected", waitT); }, timeoutBars: 4,
                            then: function () { var e = lastEvent("landed", waitT); check("T09 PREV goes to the previous setlist entry", e && e.mech === "wrap" && e.target === "ST-A", e ? e.target + " offset " + e.offsetBeats + " b" : "no landing"); if (e) { waitT = e.t; } } },
                        { name: "auto setlist A after B", until: function () { var e = lastEvent("landed", waitT + 1); return !!(e && e.auto); }, timeoutBars: 8,
                            then: function () { var e = lastEvent("landed", waitT + 1); check("T07 setlist repeat B->A by loop wrap (automatic)", e && e.mech === "wrap" && Math.abs(e.offsetBeats) < 1, e ? "landed offset " + e.offsetBeats + " b" : ""); waitT = e ? e.t : waitT; } },
                        { name: "SAFE refuses forward jump without locator (A->C)", until: function () { return !!lastEvent("rejected", waitT) || !!lastEvent("section", waitT + 1); }, timeoutBars: 6,
                            then: function () { var e = lastEvent("rejected", waitT); check("SAFE mode refuses a forward jump without a locator", !!e, e ? e.why : "not refused"); } },
                        { name: "reach B linearly", until: function (t2) { return inSec(1, t2); }, timeoutBars: 6 },
                        { name: "reach A/B for HOLD+NEXT", until: function (t2) { return (inSec(0, t2) || inSec(1, t2)) && eng.state() === "PLAYING" && eng.status(t2).current; }, timeoutBars: 6 },
                        { name: "HOLD", act: function (t2) { waitT = t2; eng.command("hold", t2); }, until: function () { return eng.state() === "HOLD_ACTIVE"; } },
                        { name: "NEXT from HOLD", act: function (t2) { waitT = t2; eng.command("next", t2); },
                            until: function () { return !!lastEvent("landed", waitT) || !!lastEvent("released", waitT) || !!lastEvent("rejected", waitT); }, timeoutBars: 6,
                            then: function () {
                                var e = lastEvent("landed", waitT) || lastEvent("released", waitT), r = lastEvent("rejected", waitT);
                                check("T08 NEXT from HOLD finishes the cycle and moves on (no double jump)", !!e && !r, e ? e.type + (e.mech ? " " + e.mech : "") : (r ? "rejected: " + r.why : "nothing"));
                            } }
                    ];
                    si = 0; this.stepT = t; this.begun = false;
                },
                onPos: function (pos, t) { eng.onPos(pos, t); },
                onProp: function (n, v, t) { eng.onProp(n, v, t); },
                tick: function (t) {
                    ctx.execute(eng.tick(t));
                    if (si >= script.length) {
                        return this.finish(fails ? "FAIL" : "PASS", (checks - fails) + "/" + checks + " checks passed: " + log.join("; "));
                    }
                    var st = script[si];
                    if (!this.begun) { this.begun = true; this.stepT = t; if (st.act) { st.act(t); ctx.execute(eng.tick(t)); } }
                    if (st.until(t)) {
                        if (st.then) { st.then(t); }
                        si++; this.begun = false; return;
                    }
                    var limit = (st.timeoutBars || 8) * bpb() / bpms() + 2000;
                    if (t - this.stepT > limit) { check(st.name, false, "timed out in state " + eng.state()); si++; this.begun = false; }
                },
                cleanup: function () { ctx.set("loop", 0); }
            };
        }

        steps = [stepPreflight, stepRates, stepBars, stepHoldRelease, stepReleaseSweep, stepLateHold, stepSeek, stepCue, stepEngine];

        return {
            run: function (t, done) {
                if (running) { return false; }
                running = true; results = []; calib = {}; idx = 0; startT = t; onDone = done;
                snapshot = { loop: L.loop, loopStart: L.loopStart, loopLength: L.loopLength };
                startNext(t);
                return true;
            },
            abort: function (t) {
                if (!running) { return; }
                if (cur) { finishStep("ABORTED", "aborted by user"); }
                idx = steps.length; pendingStart = false; finish(t);
            },
            running: function () { return running; },
            onPos: function (pos, t, prev, prevT) { if (cur && cur.onPos) { cur.onPos(pos, t, prev, prevT); } },
            onProp: function (n, v, t) { if (cur && cur.onProp) { cur.onProp(n, v, t); } },
            tick: function (t) {
                if (!running) { return; }
                if (pendingStart) { return startNext(t); }
                if (!cur) { return; }
                if (cur.timeoutMs && t - cur.t0 > cur.timeoutMs) { return finishStep("FAIL", "timed out"); }
                if (cur.tick) { cur.tick(t); }
            },
            progress: function () { return running ? (cur ? cur.id + " " + cur.title : "...") + " (" + (idx + 1) + "/" + steps.length + ")" : ""; },
            results: function () { return results; },
            calibration: function () { return calib; }
        };
    }

    // Plain-text report, readable by a person and by the next development session.
    function report(meta, results, calib) {
        var lines = [];
        lines.push("FLOW SELF-TEST REPORT");
        lines.push("version: " + meta.version + "   date: " + meta.date);
        lines.push("Live set: tempo " + meta.tempo + " BPM, " + meta.num + "/" + meta.den + ", global quantization index " + meta.quant);
        lines.push("");
        lines.push("RESULTS");
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            lines.push("  " + r.id + "  " + (r.status + "       ").substring(0, 8) + r.title);
            lines.push("        " + r.summary);
        }
        lines.push("");
        lines.push("CALIBRATION (applied to this FLOW and saved with the Live Set)");
        for (var k in calib) { if (calib.hasOwnProperty(k)) { lines.push("  " + k + " = " + calib[k]); } }
        lines.push("");
        lines.push("NOTE: PASS here means the behaviour was measured on this computer. Listening checks");
        lines.push("(clicks, cut reverb tails, audio retrigger after jumps) still need a human ear.");
        return lines.join("\n");
    }

    return { create: create, report: report };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = FlowSelfTest; }
