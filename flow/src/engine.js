// FLOW — transport engine (pure logic, no Max / Live dependencies).
//
// Inputs : onProp(name, value, t), onPos(beat, t), command(name, t), setDoc(doc)
// Output : tick(t) -> list of actions for the Live bridge:
//            {op:"set", prop, value} | {op:"call", fn} | {op:"cue", index}
//          status(t) -> plain object for the UI
//
// Design (docs/ARCHITECTURE.md): FLOW never relies on a JS timer to hit a bar line.
// Exact boundaries come from Live itself:
//   - Arrangement loop wrap   (HOLD, RELEASE, backward jumps)
//   - CuePoint.jump           (forward jumps to a locator; quantized by Live when playing)
// JS only "arms" those mechanisms at least safeLeadMs before the boundary.
// A forward jump without a locator needs a timed current_song_time write: that is
// EXPERIMENTAL and refused in SAFE mode (spec §22).
//
// State never changes on a command alone: HOLD_ACTIVE requires Live's confirmation.

var FlowEngine = (function () {
    var FS = (typeof FlowSections !== "undefined") ? FlowSections : require("./sections.js");
    var EPS = 1e-4;

    var ST = {
        UNINITIALIZED: "UNINITIALIZED", IDLE: "IDLE", PLAYING: "PLAYING",
        HOLD_ARMED: "HOLD_ARMED", HOLD_ACTIVE: "HOLD_ACTIVE", RELEASE_ARMED: "RELEASE_ARMED",
        JUMP_ARMED: "JUMP_ARMED", JUMPING: "JUMPING", MANUAL_OVERRIDE: "MANUAL_OVERRIDE", ERROR: "ERROR"
    };

    // clip_trigger_quantization index -> length in quarter-note beats (null = None)
    // (LOM: 0 None, 1 8 bars, 2 4 bars, 3 2 bars, 4 1 bar, 5 1/2, 6 1/2T, 7 1/4, 8 1/4T,
    //  9 1/8, 10 1/8T, 11 1/16, 12 1/16T, 13 1/32)
    function quantBeats(idx, bpb) {
        var table = [null, 8 * bpb, 4 * bpb, 2 * bpb, bpb, 2, 4 / 3, 1, 2 / 3, 0.5, 1 / 3, 0.25, 1 / 6, 0.125];
        return idx >= 0 && idx < table.length ? table[idx] : null;
    }

    function create(opts) {
        opts = opts || {};
        var log = opts.log || function () {};
        var cfg = {
            safeLeadMs: 150,          // replaced by SELF-TEST calibration
            seekLeadMs: 40,           // EXPERIMENTAL timed seek: send this early
            confirmTimeoutMs: 1500,   // Live must confirm loop writes within this
            debounceMs: 150,
            stopConfirmMs: 2000,
            autoArmMs: 2500,          // auto-follow arms this long before a section end
            cueJumpQuantized: true,   // DOC says so; SELF-TEST verifies
            readOnly: false
        };
        for (var k in (opts.config || {})) { cfg[k] = opts.config[k]; }

        var doc = FS.defaultDoc();
        var live = { pos: 0, posT: 0, playing: 0, loop: 0, loopStart: 0, loopLength: 0, tempo: 120,
            num: 4, den: 4, b2a: 0, quant: 4, cues: [], ready: false };
        var state = ST.UNINITIALIZED;
        var pend = null;          // current pending operation
        var queue = [];           // actions to hand to the bridge on next tick
        var expect = [];          // FLOW's own loop writes awaiting Live's echo
        var snapshot = null;      // loop state before FLOW took the loop
        var lastCmd = {};
        var stopArmedUntil = 0;
        var message = "";         // last user-facing message
        var messageT = 0;
        var warnings = {};
        var cur = { sectionId: null, orderIndex: -1 };
        var lastJump = null;      // {kind, prev, pos, t} last discontinuity seen
        var history = [];         // structured event log (for SELF-TEST and diagnostics)

        // ------------------------------------------------------------ helpers
        function bpb() { return live.num * 4 / live.den; }
        function bpms() { return live.tempo / 60000; }
        function estPos(t) {
            if (!live.playing) { return live.pos; }
            var p = live.pos + (t - live.posT) * bpms();
            var le = live.loopStart + live.loopLength;
            if (live.loop && live.pos < le && p >= le && live.loopLength > 0) { p = live.loopStart + (p - le); }
            return p;
        }
        function msUntil(beat, t) { return (beat - estPos(t)) / bpms(); }
        function say(text, t) { message = text; messageT = t; log("MSG " + text); }
        function event(type, data, t) {
            var e = { type: type, t: t };
            for (var k2 in data) { e[k2] = data[k2]; }
            history.push(e);
            if (history.length > 2000) { history.shift(); }
            log("EVT " + type + " " + JSON.stringify(data));
        }
        function setState(s, t, why) {
            if (s !== state) { event("state", { from: state, to: s, why: why || "" }, t); state = s; }
        }
        function emit(a) { queue.push(a); }
        function writeLoop(prop, value, t) {
            // Writing the value Live already has produces no notification, so it could
            // never be confirmed: skip it.
            var key = { loop: "loop", loop_start: "loopStart", loop_length: "loopLength" }[prop];
            if (key && Math.abs(Number(live[key]) - Number(value)) < EPS && !pendingWrite(prop)) { return; }
            emit({ op: "set", prop: prop, value: value });
            expect.push({ prop: prop, value: value, until: t + cfg.confirmTimeoutMs });
        }
        function pendingWrite(prop) {
            for (var i = 0; i < expect.length; i++) { if (expect[i].prop === prop) { return true; } }
            return false;
        }
        function owningLoop() {
            return state === ST.HOLD_ARMED || state === ST.HOLD_ACTIVE || state === ST.RELEASE_ARMED ||
                ((state === ST.JUMP_ARMED || state === ST.JUMPING) && pend && pend.ownsLoop);
        }
        function baseState() { return live.playing ? ST.PLAYING : ST.IDLE; }
        function takeSnapshot() { snapshot = { loop: live.loop, loopStart: live.loopStart, loopLength: live.loopLength }; }
        function sectionName(s) { return s ? s.name : "-"; }
        function fmtBar(beat) {
            var b = Math.floor(beat / bpb() + 1e-9) + 1;
            var inBar = beat - (b - 1) * bpb();
            return (b < 10 ? "00" : b < 100 ? "0" : "") + b + "." + (Math.floor(inBar + 1e-9) + 1);
        }
        function cueAt(beat) {
            for (var i = 0; i < live.cues.length; i++) { if (Math.abs(live.cues[i].time - beat) < EPS) { return i; } }
            return -1;
        }
        function order() { return doc.performanceOrder; }

        // ------------------------------------------------------------ inputs
        function onProp(name, v, t) {
            var map = { is_playing: "playing", loop: "loop", loop_start: "loopStart", loop_length: "loopLength",
                tempo: "tempo", signature_numerator: "num", signature_denominator: "den",
                back_to_arranger: "b2a", clip_trigger_quantization: "quant" };
            if (name === "cues") { live.cues = v; return; }
            if (!(name in map)) { return; }
            var key = map[name];
            var old = live[key];
            live[key] = v;
            if (name === "is_playing") {
                live.posT = t;
                if (!v) { onTransportStopped(t); }
                else if (state === ST.IDLE) { setState(ST.PLAYING, t, "transport started"); }
            }
            if (name === "loop" || name === "loop_start" || name === "loop_length") { checkExternalLoop(name, v, t); }
            if ((name === "signature_numerator" || name === "signature_denominator") && live.ready && old !== v) {
                warnings.signature = "TIME SIGNATURE CHANGED - section bars may be wrong (changes inside a set are not supported)";
            }
            if (name === "back_to_arranger") {
                if (v) { warnings.b2a = "BACK TO ARRANGEMENT: Session clips override the Arrangement"; }
                else { delete warnings.b2a; }
            }
        }

        function checkExternalLoop(name, v, t) {
            for (var i = 0; i < expect.length; i++) {
                var e = expect[i];
                if (e.prop === name && Math.abs(Number(e.value) - Number(v)) < EPS) { expect.splice(i, 1); return; }
            }
            if (owningLoop()) {
                event("override", { prop: name, value: v }, t);
                pend = null;
                expect = [];
                setState(ST.MANUAL_OVERRIDE, t, "loop changed outside FLOW");
                say("MANUAL OVERRIDE: loop changed outside FLOW - press CANCEL to resume", t);
            }
        }

        function onPos(v, t) {
            var prev = live.pos, prevT = live.posT;
            live.pos = v;
            live.posT = t;
            if (!live.playing || v === prev) { return; }
            var expected = prev + (t - prevT) * bpms();
            var kind = null;
            if (v < prev - 0.25) { kind = "back"; } else if (v > expected + 0.5) { kind = "fwd"; }
            if (kind) {
                lastJump = { kind: kind, prev: prev, pos: v, t: t };
                if (pend) { pend.jumps = (pend.jumps || []); pend.jumps.push(lastJump); }
            }
        }

        function onTransportStopped(t) {
            if (pend) { event("cancelled", { op: pend.kind, why: "transport stopped" }, t); }
            var owned = owningLoop();
            pend = null;
            if (owned) {
                if (doc.preferences.restoreLoopAfterStop && snapshot) {
                    writeLoop("loop_start", snapshot.loopStart, t);
                    writeLoop("loop_length", snapshot.loopLength, t);
                    writeLoop("loop", snapshot.loop, t);
                } else if (live.loop || pendingWrite("loop")) {
                    // Also when our loop=1 is still in flight: it would land after the stop.
                    writeLoop("loop", 0, t);
                }
            }
            if (state !== ST.ERROR && state !== ST.MANUAL_OVERRIDE) { setState(ST.IDLE, t, "transport stopped"); }
        }

        // ------------------------------------------------------------ targets
        function currentSection(t) { return FS.sectionAt(doc, estPos(t)); }

        function resolveTarget(dir, t) {
            var sec = currentSection(t);
            if (doc.preferences.navMode === "setlist") {
                var idx = cur.orderIndex;
                if (idx < 0 && sec) { idx = indexInOrder(sec.id, 0); }
                if (idx < 0) { return { error: "CURRENT POSITION IS NOT IN THE SETLIST" }; }
                var ni = idx + dir;
                if (ni < 0) { return { error: "START OF SETLIST" }; }
                if (ni >= order().length) { return { error: "END OF SETLIST" }; }
                return { section: FS.byId(doc, order()[ni]), orderIndex: ni };
            }
            var list = FS.sorted(doc), p = estPos(t);
            if (dir > 0) {
                for (var i = 0; i < list.length; i++) { if (list[i].startBeat > p + EPS) { return { section: list[i], orderIndex: -1 }; } }
                return { error: "NO SECTION AFTER PLAYHEAD" };
            }
            var base = sec ? sec.startBeat : p;
            for (var j = list.length - 1; j >= 0; j--) { if (list[j].startBeat < base - EPS) { return { section: list[j], orderIndex: -1 }; } }
            return { error: "NO SECTION BEFORE " + (sec ? sec.name : "PLAYHEAD") };
        }

        function indexInOrder(id, from) {
            var o = order();
            for (var i = Math.max(0, from); i < o.length; i++) { if (o[i] === id) { return i; } }
            for (var j = 0; j < Math.min(from, o.length); j++) { if (o[j] === id) { return j; } }
            return -1;
        }

        // Next boundary for a transition from linear playback.
        function nextBoundary(t) {
            var sec = currentSection(t), p = estPos(t), q = doc.preferences.quantizationBeats;
            var lead = cfg.safeLeadMs * bpms();
            if (!sec) {
                var gb = (Math.floor(p / bpb() + 1e-9) + 1) * bpb();
                while (gb - p <= lead) { gb += bpb(); }
                return gb;
            }
            var end = FS.endOf(sec);
            if (q > 0) {
                var b = sec.startBeat + (Math.floor((p - sec.startBeat) / q + 1e-9) + 1) * q;
                while (b < end - EPS) {
                    if (b - p > lead) { return b; }
                    b += q;
                }
            }
            if (end - p > lead) { return end; }
            var step = q > 0 ? q : bpb();
            var nb = end + step;
            while (nb - p <= lead) { nb += step; }
            return nb;
        }

        // Choose the most reliable mechanism to be at T exactly when the playhead reaches B.
        function mechanism(T, B) {
            if (Math.abs(T - B) < EPS) { return { kind: "linear", label: "LINEAR" }; }
            if (T < B) { return { kind: "wrap", label: "LOOP WRAP" }; }
            var ci = cueAt(T);
            var qb = quantBeats(live.quant, bpb());
            if (ci >= 0 && cfg.cueJumpQuantized && qb && Math.abs(B / qb - Math.round(B / qb)) < 1e-3 &&
                qb / bpms() > cfg.safeLeadMs + 60) {
                return { kind: "cue", label: "LOCATOR JUMP", cue: ci, q: qb };
            }
            if (doc.preferences.jumpMode === "experimental") {
                return { kind: "seek", label: "TIMED SEEK (EXPERIMENTAL)", cue: ci };
            }
            if (ci < 0) { return { error: "NO LOCATOR AT " + fmtBar(T) + ": add one there, or enable EXPERIMENTAL jumps" }; }
            return { error: "LOCATOR JUMP NOT POSSIBLE WITH CURRENT GLOBAL QUANTIZATION (set it to 1 Bar) - or enable EXPERIMENTAL" };
        }

        // ------------------------------------------------------------ commands
        function command(name, t) {
            if (cfg.readOnly && name !== "status") { say("READ-ONLY: another FLOW instance is the transport master", t); return false; }
            if (lastCmd[name] !== undefined && t - lastCmd[name] < cfg.debounceMs) { log("debounced " + name); return false; }
            lastCmd[name] = t;
            event("command", { name: name, state: state, pos: Math.round(estPos(t) * 1000) / 1000 }, t);
            if (!live.ready) { say("LIVE API NOT READY", t); return false; }
            switch (name) {
                case "stop": return cmdStop(t);
                case "cancel": return cmdCancel(t);
                case "release": return cmdRelease(t);
                case "next": return cmdJump(1, t);
                case "prev": return cmdJump(-1, t);
                case "hold": return cmdHold(t);
                case "backtoarr": emit({ op: "set", prop: "back_to_arranger", value: 0 }); return true;
            }
            say("UNKNOWN COMMAND " + name, t);
            return false;
        }

        function blockedByLive(t) {
            if (state === ST.ERROR) { say("ERROR STATE - press CANCEL", t); return true; }
            if (state === ST.MANUAL_OVERRIDE) { say("MANUAL OVERRIDE - press CANCEL first", t); return true; }
            if (live.b2a) { say("BACK TO ARRANGEMENT first (Session clips are playing)", t); return true; }
            if (!live.playing) { say("TRANSPORT STOPPED - start playback in Live", t); return true; }
            return false;
        }

        function cmdStop(t) {
            if (doc.preferences.stopMode === "confirm" && t > stopArmedUntil) {
                stopArmedUntil = t + cfg.stopConfirmMs;
                say("PRESS STOP AGAIN TO STOP THE TRANSPORT", t);
                return true;
            }
            stopArmedUntil = 0;
            pend = null;
            // Producer Pal: stopping an already stopped transport sends the playhead to the
            // start of the song, so only stop a running transport.
            if (live.playing) { emit({ op: "call", fn: "stop_playing" }); say("STOP", t); }
            else { say("ALREADY STOPPED", t); }
            return true;
        }

        function cmdCancel(t) {
            if (state === ST.MANUAL_OVERRIDE || state === ST.ERROR) {
                expect = [];
                pend = null;
                setState(baseState(), t, "cancel");
                say("RESUMED - FLOW does not touch the current loop", t);
                return true;
            }
            if (!pend) { say("NOTHING TO CANCEL", t); return false; }
            var p = pend;
            if (p.kind === "hold") {
                if (live.loop || p.sent) { writeLoop("loop", 0, t); }
                pend = null; setState(baseState(), t, "hold cancelled"); say("HOLD CANCELLED", t); return true;
            }
            if (p.kind === "release") {
                if (p.sent) {
                    if (msUntil(p.end, t) > cfg.safeLeadMs) {
                        writeLoop("loop", 1, t);
                        pend = { kind: "hold", L: p.L, E: p.end, confirmed: true, sent: true };
                        setState(ST.HOLD_ACTIVE, t, "release cancelled");
                        say("RELEASE CANCELLED - HOLD CONTINUES", t);
                        return true;
                    }
                    say("TOO LATE TO CANCEL RELEASE", t); return false;
                }
                pend = { kind: "hold", L: p.L, E: p.end, confirmed: true, sent: true };
                setState(ST.HOLD_ACTIVE, t, "release cancelled"); say("RELEASE CANCELLED - HOLD CONTINUES", t); return true;
            }
            if (p.kind === "jump") {
                // A loop-wrap jump is only "fired" in the sense that the loop is armed; it can
                // still be disarmed while there is enough time before the boundary.
                var wrapDisarmable = p.mech && p.mech.kind === "wrap" && msUntil(p.B, t) > cfg.safeLeadMs;
                if (p.fired && !wrapDisarmable) { say("TOO LATE TO CANCEL - JUMP IN PROGRESS", t); return false; }
                if (p.ownsLoop && p.fromHold) {
                    writeLoop("loop_start", p.holdL, t);
                    writeLoop("loop_length", p.B - p.holdL, t);
                    if (!live.loop) { writeLoop("loop", 1, t); }
                    pend = { kind: "hold", L: p.holdL, E: p.B, confirmed: true, sent: true };
                    setState(ST.HOLD_ACTIVE, t, "jump cancelled");
                } else {
                    if (p.ownsLoop && p.loopSent) { writeLoop("loop", 0, t); }
                    pend = null;
                    setState(baseState(), t, "jump cancelled");
                }
                say("JUMP CANCELLED", t);
                return true;
            }
            return false;
        }

        function holdRegion(sec) {
            var E = FS.endOf(sec), m = /^last(\d+)$/.exec(doc.preferences.holdMode);
            var L = sec.startBeat;
            if (m) { L = Math.max(sec.startBeat, E - parseInt(m[1], 10) * bpb()); }
            return { L: L, E: E };
        }

        function cmdHold(t) {
            if (state === ST.HOLD_ACTIVE || state === ST.HOLD_ARMED) { return cmdRelease(t); }
            if (blockedByLive(t)) { return false; }
            if (pend && pend.kind === "jump" && pend.auto && !(pend.fired && pend.mech && pend.mech.kind !== "wrap")) {
                // A manual HOLD beats an automatic setlist transition that has not happened yet.
                var msg0 = message;
                if (!cmdCancel(t)) { return false; }
                event("auto_jump_cancelled_by_hold", {}, t);
                message = msg0;
            }
            if (pend) { say(pend.kind.toUpperCase() + " PENDING - press CANCEL first", t); return false; }
            var sec = currentSection(t);
            if (!sec) { say("NO SECTION AT PLAYHEAD - nothing to hold", t); return false; }
            if (!sec.holdEligible) { say("HOLD DISABLED FOR " + sec.name, t); return false; }
            var r = holdRegion(sec);
            if (msUntil(r.E, t) <= cfg.safeLeadMs) {
                say("TOO LATE TO HOLD " + sec.name + " (" + Math.round(msUntil(r.E, t)) + " ms left)", t);
                event("rejected", { op: "hold", why: "too late", msLeft: msUntil(r.E, t) }, t);
                return false;
            }
            takeSnapshot();
            writeLoop("loop_start", r.L, t);
            writeLoop("loop_length", r.E - r.L, t);
            writeLoop("loop", 1, t);
            pend = { kind: "hold", section: sec.id, L: r.L, E: r.E, sent: true, sentT: t, confirmed: false, wraps: 0 };
            setState(ST.HOLD_ARMED, t, "hold " + sec.name);
            say("HOLD ARMED: " + sec.name + " " + fmtBar(r.L) + "-" + fmtBar(r.E), t);
            return true;
        }

        function cmdRelease(t) {
            if (state === ST.HOLD_ARMED && pend && !pend.confirmed) {
                return cmdCancel(t);
            }
            if (state !== ST.HOLD_ACTIVE || !pend) { say("NOTHING HELD", t); return false; }
            var L = pend.L, E = pend.E;
            var p = estPos(t);
            pend = { kind: "release", L: L, end: E, sent: false, sentT: 0, waitWrap: false, wrapsAfterSend: 0, jumps: [] };
            if (p < L - EPS) {
                // Loop is set ahead of the playhead and was never reached: just switch it off.
                writeLoop("loop", 0, t);
                pend.sent = true; pend.sentT = t;
            } else if (msUntil(E, t) > cfg.safeLeadMs) {
                writeLoop("loop", 0, t);
                pend.sent = true; pend.sentT = t;
                say("RELEASE: continuing after " + fmtBar(E), t);
            } else {
                pend.waitWrap = true;
                say("EXIT NEXT CYCLE (too close to the loop end)", t);
            }
            event("release", { msLeft: Math.round(msUntil(E, t)), waitWrap: pend.waitWrap }, t);
            setState(ST.RELEASE_ARMED, t, "release");
            return true;
        }

        function cmdJump(dir, t) {
            if (blockedByLive(t)) { return false; }
            if (state === ST.JUMP_ARMED || state === ST.JUMPING) { say("JUMP ALREADY ARMED - press CANCEL to change", t); return false; }
            if (state === ST.HOLD_ARMED || state === ST.RELEASE_ARMED) { say("WAIT: " + state.replace("_", " "), t); return false; }
            var tg = resolveTarget(dir, t);
            if (tg.error) { say(tg.error, t); return false; }
            return armJump(tg, t, false);
        }

        function armJump(tg, t, auto, forcedB) {
            var fromHold = state === ST.HOLD_ACTIVE && pend && pend.kind === "hold";
            var T = tg.section.startBeat, B, holdL = null, p = estPos(t);
            if (fromHold) {
                holdL = pend.L;
                B = pend.E;
                if (msUntil(B, t) <= cfg.safeLeadMs) {
                    // Too close to the loop end: Live will wrap first. Re-arm on the next cycle.
                    say("NEXT ON NEXT CYCLE (too close to the loop end)", t);
                    pend = { kind: "jump", target: tg, B: B, deferredUntilWrap: true, fromHold: true, holdL: holdL, auto: auto, jumps: [] };
                    setState(ST.JUMP_ARMED, t, "jump deferred");
                    return true;
                }
            } else {
                B = forcedB !== undefined ? forcedB : nextBoundary(t);
            }
            var m = mechanism(T, B);
            if (m.error) { say(m.error, t); event("rejected", { op: "jump", why: m.error }, t); return false; }
            if (fromHold && m.kind === "linear") {
                // Target follows the held region: that is exactly RELEASE.
                state = ST.HOLD_ACTIVE;
                var ok = cmdRelease(t);
                if (ok) { cur.pendingOrderIndex = tg.orderIndex; }
                return ok;
            }
            pend = { kind: "jump", target: tg, T: T, B: B, mech: m, fromHold: fromHold, holdL: holdL, auto: auto,
                ownsLoop: m.kind === "wrap" || fromHold, loopSent: false, fired: false, armT: t, jumps: [] };
            if (m.kind === "wrap") {
                // [T, B) with the playhead inside: Live wraps to T exactly at B.
                if (!fromHold) { takeSnapshot(); }
                writeLoop("loop_start", T, t);
                writeLoop("loop_length", B - T, t);
                if (!live.loop || !fromHold) { writeLoop("loop", 1, t); }
                pend.loopSent = true;
                pend.fired = true;
            } else if (fromHold) {
                // Forward jump out of a hold: stop looping now so playback runs into B linearly,
                // then the locator jump (quantized) or timed seek moves it to T at B.
                writeLoop("loop", 0, t);
                pend.loopSent = true;
            }
            setState(ST.JUMP_ARMED, t, (auto ? "auto " : "") + "jump to " + tg.section.name);
            say((auto ? "AUTO " : "") + "NEXT: " + tg.section.name + " @ " + fmtBar(B) + " [" + m.label + "]", t);
            event("jump_armed", { target: tg.section.name, T: T, B: B, mech: m.kind, msLeft: Math.round(msUntil(B, t)), fromHold: fromHold, auto: !!auto }, t);
            return true;
        }

        // ------------------------------------------------------------ tick
        function tick(t) {
            if (!live.ready) { return drain(); }
            var p = estPos(t);
            for (var i = expect.length - 1; i >= 0; i--) {
                if (t > expect[i].until) {
                    event("unconfirmed", { prop: expect[i].prop, value: expect[i].value }, t);
                    expect.splice(i, 1);
                    if (owningLoop()) {
                        pend = null;
                        setState(ST.ERROR, t, "Live did not confirm a loop write");
                        say("ERROR: Live did not confirm the loop change - FLOW stopped sending commands (CANCEL to reset)", t);
                    }
                }
            }
            if (stopArmedUntil && t > stopArmedUntil) { stopArmedUntil = 0; if (/PRESS STOP/.test(message)) { say("", t); } }
            if (pend) {
                if (pend.kind === "hold") { tickHold(t, p); }
                else if (pend.kind === "release") { tickRelease(t, pend); }
                else if (pend.kind === "jump") { tickJump(t, pend); }
            }
            trackSection(t, p);
            if (!pend && state === ST.PLAYING) { autoFollow(t, p); }
            return drain();
        }

        function drain() { var q = queue; queue = []; return q; }

        function tickHold(t, p) {
            var h = pend;
            if (!h.confirmed) {
                if (live.loop && Math.abs(live.loopStart - h.L) < EPS && Math.abs(live.loopLength - (h.E - h.L)) < EPS) {
                    h.confirmed = true;
                    setState(ST.HOLD_ACTIVE, t, "Live confirmed loop");
                    event("hold_active", { L: h.L, E: h.E, confirmMs: t - h.sentT }, t);
                    say("HOLD ACTIVE: " + sectionName(FS.byId(doc, h.section)), t);
                } else if (p > h.E + 0.25 && !(h.jumps && h.jumps.length)) {
                    event("hold_missed", { pos: p, E: h.E }, t);
                    writeLoop("loop", 0, t);
                    pend = null;
                    setState(baseState(), t, "hold missed");
                    say("HOLD MISSED: playhead passed the loop end before Live engaged the loop", t);
                }
                return;
            }
            if (h.jumps && h.jumps.length) {
                var j = h.jumps.shift();
                if (j.kind === "back" && Math.abs(j.pos - h.L) < 1) { h.wraps++; event("wrap", { pre: j.prev, post: j.pos }, t); }
                else { externalMove(j, t); }
            }
        }

        function externalMove(j, t) {
            event("external_move", { kind: j.kind, prev: j.prev, pos: j.pos }, t);
            if (owningLoop()) {
                pend = null;
                setState(ST.MANUAL_OVERRIDE, t, "playhead moved outside FLOW");
                say("MANUAL OVERRIDE: playhead was moved - press CANCEL to resume", t);
            }
        }

        function tickRelease(t, r) {
            var p = estPos(t);
            if (r.jumps.length) {
                var j = r.jumps.shift();
                if (j.kind === "back" && Math.abs(j.pos - r.L) < 1) {
                    if (r.sent) { r.wrapsAfterSend++; event("release_extra_cycle", { sentMsBefore: Math.round((r.end - j.prev) / bpms()) }, t); say("RELEASE LATE: one extra cycle", t); }
                    else if (r.waitWrap) {
                        writeLoop("loop", 0, t);
                        r.sent = true; r.sentT = t; r.waitWrap = false;
                        say("RELEASE: continuing after " + fmtBar(r.end), t);
                    }
                } else if (j.kind !== "back") { externalMove(j, t); return; }
            }
            if (r.sent && !live.loop && p >= r.end + 0.05) {
                event("released", { extraCycles: r.wrapsAfterSend, pos: p }, t);
                pend = null;
                setState(ST.PLAYING, t, "released");
                if (cur.pendingOrderIndex !== undefined && cur.pendingOrderIndex !== null) { cur.orderIndex = cur.pendingOrderIndex; cur.pendingOrderIndex = null; }
            }
        }

        function tickJump(t, j) {
            var p = estPos(t);
            if (j.deferredUntilWrap) {
                if (j.jumps.length && j.jumps[j.jumps.length - 1].kind === "back") {
                    j.jumps = [];
                    pend = { kind: "hold", L: j.holdL, E: j.B, confirmed: true, sent: true };
                    state = ST.HOLD_ACTIVE;
                    if (!armJump(j.target, t, j.auto)) { setState(ST.HOLD_ACTIVE, t, "deferred jump rejected"); }
                }
                return;
            }
            var m = j.mech;
            if (m.kind === "cue" && !j.fired) {
                var winStart = j.B - m.q + 0.02;
                if (p >= winStart && msUntil(j.B, t) > cfg.safeLeadMs * 0.5) {
                    emit({ op: "cue", index: m.cue });
                    j.fired = true; j.firedT = t; j.firedPos = p;
                    setState(ST.JUMPING, t, "locator jump sent");
                }
            } else if (m.kind === "seek" && !j.fired) {
                if (msUntil(j.B, t) <= cfg.seekLeadMs) {
                    emit({ op: "set", prop: "current_song_time", value: j.T });
                    j.fired = true; j.firedT = t; j.firedPos = p;
                    setState(ST.JUMPING, t, "seek sent");
                }
            } else if (m.kind === "wrap" && j.fired && state === ST.JUMP_ARMED) {
                setState(ST.JUMPING, t, "loop wrap armed");
            }
            // landing detection
            while (j.jumps.length) {
                var e = j.jumps.shift();
                if (Math.abs(e.pos - j.T) < 0.5 + (t - e.t) * bpms() + 0.25) {
                    landed(j, e, t);
                    return;
                }
                if (m.kind === "wrap" && e.kind === "back") { continue; }
                if (j.fromHold && e.kind === "back" && Math.abs(e.pos - j.holdL) < 1) {
                    event("release_extra_cycle", { during: "jump" }, t);
                    continue;
                }
                externalMove(e, t);
                return;
            }
            if (p > j.B + Math.max(1, 400 * bpms())) {
                event("jump_missed", { target: j.target.section.name, B: j.B, pos: p, mech: m.kind }, t);
                if (j.ownsLoop && live.loop) { writeLoop("loop", 0, t); }
                pend = null;
                setState(baseState(), t, "jump missed");
                say("JUMP MISSED - continuing linearly", t);
            }
        }

        function landed(j, e, t) {
            if (j.mech.kind === "wrap" || j.ownsLoop) {
                if (j.mech.kind === "wrap") { writeLoop("loop", 0, t); }
                if (snapshot && doc.preferences.restoreLoopAfterStop) { /* bounds restore is a studio option on stop only */ }
            }
            event("landed", { target: j.target.section.name, T: j.T, B: j.B, mech: j.mech.kind, preJump: e.prev, firstPos: e.pos,
                offsetBeats: Math.round((e.pos - j.T) * 1000) / 1000, auto: !!j.auto }, t);
            cur.orderIndex = j.target.orderIndex;
            cur.sectionId = j.target.section.id;
            pend = null;
            setState(ST.PLAYING, t, "landed");
            say("NOW: " + j.target.section.name, t);
        }

        function trackSection(t, p) {
            var sec = FS.sectionAt(doc, p);
            var id = sec ? sec.id : null;
            if (id === cur.sectionId) { return; }
            var prevId = cur.sectionId;
            cur.sectionId = id;
            if (!id) { return; }
            if (doc.preferences.navMode === "setlist") {
                var o = order();
                if (cur.orderIndex >= 0 && cur.orderIndex + 1 < o.length && o[cur.orderIndex + 1] === id) { cur.orderIndex++; }
                else if (cur.orderIndex < 0 || o[cur.orderIndex] !== id) { cur.orderIndex = indexInOrder(id, cur.orderIndex + 1); }
            }
            event("section", { from: prevId, to: id, orderIndex: cur.orderIndex }, t);
        }

        function autoFollow(t, p) {
            if (doc.preferences.navMode !== "setlist" || !doc.preferences.autoFollowSetlist) { return; }
            var sec = FS.sectionAt(doc, p);
            if (!sec || cur.orderIndex < 0 || order()[cur.orderIndex] !== sec.id) { return; }
            var ni = cur.orderIndex + 1;
            if (ni >= order().length) { return; }
            var nextSec = FS.byId(doc, order()[ni]);
            var end = FS.endOf(sec);
            if (Math.abs(nextSec.startBeat - end) < EPS) { return; }   // linear continuation
            var left = msUntil(end, t);
            if (left > cfg.autoArmMs || left <= cfg.safeLeadMs) { return; }
            if (cur.autoArmedFor === cur.orderIndex) { return; }
            cur.autoArmedFor = cur.orderIndex;
            var m = mechanism(nextSec.startBeat, end);
            if (m.error) { say("SETLIST: cannot reach " + nextSec.name + " - " + m.error, t); event("rejected", { op: "auto", why: m.error }, t); return; }
            armJump({ section: nextSec, orderIndex: ni }, t, true, end);
        }

        // ------------------------------------------------------------ status
        function status(t) {
            var p = estPos(t);
            var sec = FS.sectionAt(doc, p);
            var s = { state: state, pos: p, posText: fmtBar(p), playing: live.playing, loop: live.loop,
                message: message, warnings: [], readOnly: cfg.readOnly };
            for (var w in warnings) { s.warnings.push(warnings[w]); }
            if (sec) {
                var barsTotal = Math.round(sec.lengthBeats / bpb());
                var barIn = Math.floor((p - sec.startBeat) / bpb() + 1e-9) + 1;
                s.current = { name: sec.name, bar: barIn, bars: barsTotal, pattern: sec.digitone && sec.digitone.pattern };
            } else {
                s.current = null;
            }
            s.setIndex = cur.orderIndex;
            s.setCount = order().length;
            if (pend && pend.kind === "jump") {
                s.next = { name: pend.target.section.name, label: pend.mech ? pend.mech.label : "NEXT CYCLE", armed: true,
                    at: pend.B !== undefined ? fmtBar(pend.B) : "" };
            } else if (live.ready && doc.sections.length) {
                var tg = resolveTarget(1, t);
                s.next = tg.error ? { name: "-", label: tg.error, armed: false } : { name: tg.section.name, label: "", armed: false };
            }
            if (pend && pend.kind === "release" && pend.waitWrap) { s.pendingLabel = "EXIT NEXT CYCLE"; }
            else if (state === ST.HOLD_ARMED) { s.pendingLabel = "HOLD ARMED"; }
            else if (state === ST.HOLD_ACTIVE) { s.pendingLabel = "HOLD ACTIVE"; }
            else if (state === ST.RELEASE_ARMED) { s.pendingLabel = "RELEASING"; }
            else if (state === ST.JUMP_ARMED || state === ST.JUMPING) { s.pendingLabel = "NEXT ARMED"; }
            else { s.pendingLabel = ""; }
            return s;
        }

        return {
            ST: ST,
            cfg: cfg,
            live: live,
            history: history,
            setDoc: function (d) {
                // Keep the setlist position when only preferences/calibration changed.
                var same = JSON.stringify(d.performanceOrder) === JSON.stringify(doc.performanceOrder) &&
                    JSON.stringify(d.sections) === JSON.stringify(doc.sections);
                doc = d;
                if (!same) { cur = { sectionId: null, orderIndex: -1 }; }
            },
            getDoc: function () { return doc; },
            setConfig: function (c) { for (var key in c) { cfg[key] = c[key]; } },
            ready: function (t) { live.ready = true; live.posT = t; setState(baseState(), t, "Live API ready"); },
            onProp: onProp,
            onPos: onPos,
            command: command,
            tick: tick,
            status: status,
            state: function () { return state; },
            estPos: estPos
        };
    }

    return { create: create, ST: ST, quantBeats: quantBeats };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = FlowEngine; }
