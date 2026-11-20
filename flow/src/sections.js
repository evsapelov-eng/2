// FLOW — section model (pure logic, no Max / Live dependencies).
// Positions are stored in beats (Live LOM beats). ES5 so it runs in Max classic [js].
// Works in Node via module.exports and in Max as the global FlowSections.

var FlowSections = (function () {
    var SCHEMA_VERSION = 1;
    var EPS = 1e-4;
    var BANKS = "ABCDEFGH";
    var HOLD_MODES = ["section", "last1", "last2", "last4", "last8"];
    var NAV_MODES = ["setlist", "source"];
    var JUMP_MODES = ["safe", "experimental"];
    var STOP_MODES = ["confirm", "immediate"];

    function isNum(x) { return typeof x === "number" && isFinite(x); }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function trim(s) { return String(s === undefined || s === null ? "" : s).replace(/^\s+|\s+$/g, ""); }

    function defaultPreferences() {
        return {
            quantizationBeats: 4,          // NEXT/PREV boundary grid from section start; 0 = section end
            navMode: "setlist",            // NEXT/PREV follow performanceOrder ("setlist") or startBeat ("source")
            autoFollowSetlist: true,       // at section end, go to the next setlist entry (PAUSE STRUCTURE = false)
            holdMode: "section",           // section | lastN bars of the section
            jumpMode: "safe",              // safe: native Live mechanisms only; experimental: timed seek allowed
            stopMode: "confirm",           // confirm: press twice within 2 s
            restoreLoopAfterStop: false,   // studio option (spec §6)
            digitoneControlEnabled: false, // Milestone 4
            externalLoopConflictPolicy: "warn-and-disarm"
        };
    }

    function defaultDoc() {
        return {
            schemaVersion: SCHEMA_VERSION,
            projectId: "flow-" + Math.floor(Math.random() * 1e9).toString(36),
            title: "LIVE SESSION",
            timeSignatureAssumption: "Live song signature",
            sections: [],
            performanceOrder: [],
            preferences: defaultPreferences(),
            calibration: {}
        };
    }

    // ---- Digitone II pattern <-> MIDI Program Change (spec §4: A01..H16 = 0..127)
    function patternToProgram(p) {
        var m = /^([A-H])(\d{2})$/.exec(trim(p).toUpperCase());
        if (!m) { return null; }
        var n = parseInt(m[2], 10);
        if (n < 1 || n > 16) { return null; }
        return BANKS.indexOf(m[1]) * 16 + (n - 1);
    }

    function programToPattern(pc) {
        if (!isNum(pc) || pc < 0 || pc > 127 || Math.floor(pc) !== pc) { return null; }
        var n = (pc % 16) + 1;
        return BANKS.charAt(Math.floor(pc / 16)) + (n < 10 ? "0" : "") + n;
    }

    // ---- ordering / lookup
    function sorted(doc) {
        return doc.sections.slice().sort(function (a, b) { return a.startBeat - b.startBeat; });
    }

    function byId(doc, id) {
        for (var i = 0; i < doc.sections.length; i++) { if (doc.sections[i].id === id) { return doc.sections[i]; } }
        return null;
    }

    function endOf(s) { return s.startBeat + s.lengthBeats; }

    function sectionAt(doc, beat) {
        for (var i = 0; i < doc.sections.length; i++) {
            var s = doc.sections[i];
            if (beat >= s.startBeat - EPS && beat < endOf(s) - EPS) { return s; }
        }
        return null;
    }

    function sectionStartingAt(doc, beat) {
        for (var i = 0; i < doc.sections.length; i++) {
            if (Math.abs(doc.sections[i].startBeat - beat) < EPS) { return doc.sections[i]; }
        }
        return null;
    }

    // ---- validation / normalisation (never throws; returns problems)
    function normalizeSection(raw, i, errors, warnings) {
        var s = {};
        var where = "section " + (i + 1);
        if (!raw || typeof raw !== "object") { errors.push(where + ": not an object"); return null; }
        s.id = trim(raw.id) || ("s-" + (i + 1));
        if (!trim(raw.id)) { warnings.push(where + ": missing id, assigned " + s.id); }
        s.name = trim(raw.name);
        if (!s.name) { errors.push(where + " (" + s.id + "): empty name"); }
        s.startBeat = Number(raw.startBeat);
        s.lengthBeats = Number(raw.lengthBeats);
        if (!isNum(s.startBeat) || s.startBeat < 0) { errors.push(where + " (" + s.name + "): startBeat must be a number >= 0"); }
        if (!isNum(s.lengthBeats) || s.lengthBeats <= 0) { errors.push(where + " (" + s.name + "): lengthBeats must be a number > 0"); }
        s.holdEligible = raw.holdEligible === undefined ? true : !!raw.holdEligible;
        if (raw.defaultHoldBeats !== undefined) {
            s.defaultHoldBeats = Number(raw.defaultHoldBeats);
            if (!isNum(s.defaultHoldBeats) || s.defaultHoldBeats <= 0) {
                warnings.push(where + " (" + s.name + "): invalid defaultHoldBeats ignored");
                delete s.defaultHoldBeats;
            }
        }
        s.notes = trim(raw.notes);
        var d = raw.digitone || {};
        s.digitone = { enabled: !!d.enabled, pattern: null, programNumber: null };
        if (d.pattern !== undefined && d.pattern !== null && trim(d.pattern) !== "") {
            var pc = patternToProgram(d.pattern);
            if (pc === null) {
                errors.push(where + " (" + s.name + "): Digitone pattern '" + d.pattern + "' is not A01..H16");
            } else {
                s.digitone.pattern = programToPattern(pc);
                s.digitone.programNumber = pc;
                if (d.programNumber !== undefined && Number(d.programNumber) !== pc) {
                    warnings.push(where + " (" + s.name + "): programNumber " + d.programNumber + " corrected to " + pc + " (" + s.digitone.pattern + ")");
                }
            }
        }
        return s;
    }

    function normalizeDoc(raw) {
        var errors = [], warnings = [];
        if (!raw || typeof raw !== "object") { return { doc: null, errors: ["document is not a JSON object"], warnings: warnings }; }
        var ver = raw.schemaVersion === undefined ? 1 : Number(raw.schemaVersion);
        if (!isNum(ver) || ver < 1) { errors.push("invalid schemaVersion"); }
        if (ver > SCHEMA_VERSION) { errors.push("schemaVersion " + ver + " is newer than this FLOW (" + SCHEMA_VERSION + ")"); }
        var doc = defaultDoc();
        if (raw.projectId) { doc.projectId = trim(raw.projectId); }
        if (raw.title) { doc.title = trim(raw.title); }
        if (!(raw.sections instanceof Array)) { errors.push("sections must be an array"); }
        var list = raw.sections instanceof Array ? raw.sections : [];
        var ids = {};
        for (var i = 0; i < list.length; i++) {
            var s = normalizeSection(list[i], i, errors, warnings);
            if (!s) { continue; }
            if (ids[s.id]) { errors.push("duplicate section id '" + s.id + "'"); }
            ids[s.id] = true;
            doc.sections.push(s);
        }
        var srt = sorted(doc);
        for (var k = 1; k < srt.length; k++) {
            if (srt[k].startBeat < endOf(srt[k - 1]) - EPS) {
                errors.push("sections overlap: '" + srt[k - 1].name + "' and '" + srt[k].name + "' (overlaps are not supported in this version)");
            }
        }
        var order = raw.performanceOrder instanceof Array ? raw.performanceOrder : null;
        if (order === null) {
            for (var j = 0; j < srt.length; j++) { doc.performanceOrder.push(srt[j].id); }
            if (raw.performanceOrder !== undefined) { errors.push("performanceOrder must be an array"); }
        } else {
            for (var m = 0; m < order.length; m++) {
                var id = trim(order[m]);
                if (!ids[id]) { errors.push("performanceOrder[" + m + "] references missing section '" + id + "'"); }
                else { doc.performanceOrder.push(id); }
            }
        }
        var p = raw.preferences || {};
        var dp = defaultPreferences();
        for (var key in dp) { if (dp.hasOwnProperty(key) && p[key] !== undefined) { dp[key] = p[key]; } }
        dp.quantizationBeats = Number(dp.quantizationBeats);
        if (!isNum(dp.quantizationBeats) || dp.quantizationBeats < 0) { warnings.push("invalid quantizationBeats, using 4"); dp.quantizationBeats = 4; }
        if (indexOf(NAV_MODES, dp.navMode) < 0) { warnings.push("invalid navMode, using setlist"); dp.navMode = "setlist"; }
        if (indexOf(HOLD_MODES, dp.holdMode) < 0) { warnings.push("invalid holdMode, using section"); dp.holdMode = "section"; }
        if (indexOf(JUMP_MODES, dp.jumpMode) < 0) { warnings.push("invalid jumpMode, using safe"); dp.jumpMode = "safe"; }
        if (indexOf(STOP_MODES, dp.stopMode) < 0) { warnings.push("invalid stopMode, using confirm"); dp.stopMode = "confirm"; }
        dp.autoFollowSetlist = !!dp.autoFollowSetlist;
        dp.restoreLoopAfterStop = !!dp.restoreLoopAfterStop;
        dp.digitoneControlEnabled = !!dp.digitoneControlEnabled;
        doc.preferences = dp;
        if (raw.calibration && typeof raw.calibration === "object") { doc.calibration = clone(raw.calibration); }
        return { doc: errors.length ? null : doc, errors: errors, warnings: warnings };
    }

    function indexOf(arr, v) { for (var i = 0; i < arr.length; i++) { if (arr[i] === v) { return i; } } return -1; }

    // Parse JSON text. On any problem returns errors and NO document: the caller keeps
    // its current sections untouched (spec T13).
    function importJson(text) {
        var raw;
        try { raw = JSON.parse(String(text)); }
        catch (e) { return { doc: null, errors: ["JSON syntax error: " + e.message], warnings: [] }; }
        return normalizeDoc(raw);
    }

    function exportJson(doc) { return JSON.stringify(doc, null, 2); }

    // Compact encoding for Live Set storage (no spaces/quotes: one Max symbol).
    function encodeForStorage(doc) { return "FLOW1:" + encodeURIComponent(JSON.stringify(doc)); }
    function decodeFromStorage(sym) {
        var s = String(sym);
        if (s.indexOf("FLOW1:") !== 0) { return { doc: null, errors: ["stored data has unknown format"], warnings: [] }; }
        var text;
        try { text = decodeURIComponent(s.substring(6)); }
        catch (e) { return { doc: null, errors: ["stored data is corrupt"], warnings: [] }; }
        return importJson(text);
    }

    // ---- locator import preview (spec §12): ranges between consecutive locators.
    // The final range needs an explicit end: a locator named END (case-insensitive).
    // Nothing is guessed; cue points are not the source of truth after import.
    function locatorPreview(cues) {
        var list = [], problems = [], endBeat = null;
        for (var i = 0; i < cues.length; i++) {
            var c = cues[i];
            if (!isNum(Number(c.time))) { problems.push("locator " + i + " has no time"); continue; }
            if (trim(c.name).toUpperCase() === "END") {
                if (endBeat === null || Number(c.time) < endBeat) { endBeat = Number(c.time); }
                continue;
            }
            list.push({ name: trim(c.name) || ("SECTION " + (list.length + 1)), time: Number(c.time) });
        }
        list.sort(function (a, b) { return a.time - b.time; });
        var sections = [];
        for (var k = 0; k < list.length; k++) {
            var start = list[k].time;
            var end = k + 1 < list.length ? list[k + 1].time : endBeat;
            if (k + 1 < list.length && endBeat !== null && endBeat < end && endBeat > start) { end = endBeat; }
            if (end === null) {
                problems.push("last section '" + list[k].name + "' has no end: add a locator named END after it");
                continue;
            }
            if (end - start <= EPS) { problems.push("'" + list[k].name + "' has zero length (duplicate locator time)"); continue; }
            if (endBeat !== null && start >= endBeat - EPS) { problems.push("'" + list[k].name + "' starts after the END locator: skipped"); continue; }
            sections.push({ id: "s-" + (k + 1), name: list[k].name, startBeat: start, lengthBeats: end - start,
                holdEligible: true, digitone: { enabled: false } });
        }
        if (!list.length) { problems.push("no locators found"); }
        return { sections: sections, problems: problems };
    }

    // ---- editing with undo (scope: section list, setlist order, preferences)
    function Store(doc) {
        this.doc = doc || defaultDoc();
        this.undoStack = [];
        this.redoStack = [];
    }
    Store.prototype.commit = function (mutator) {
        var before = JSON.stringify(this.doc);
        var draft = JSON.parse(before);
        var msg = mutator(draft);
        if (typeof msg === "string") { return { ok: false, errors: [msg] }; }
        var res = normalizeDoc(draft);
        if (!res.doc) { return { ok: false, errors: res.errors }; }
        this.undoStack.push(before);
        if (this.undoStack.length > 50) { this.undoStack.shift(); }
        this.redoStack = [];
        this.doc = res.doc;
        return { ok: true, warnings: res.warnings };
    };
    Store.prototype.replace = function (doc) { return this.commit(function (d) { for (var k in d) { delete d[k]; } var c = clone(doc); for (var j in c) { d[j] = c[j]; } }); };
    Store.prototype.undo = function () {
        if (!this.undoStack.length) { return false; }
        this.redoStack.push(JSON.stringify(this.doc));
        this.doc = JSON.parse(this.undoStack.pop());
        return true;
    };
    Store.prototype.redo = function () {
        if (!this.redoStack.length) { return false; }
        this.undoStack.push(JSON.stringify(this.doc));
        this.doc = JSON.parse(this.redoStack.pop());
        return true;
    };

    return {
        SCHEMA_VERSION: SCHEMA_VERSION,
        EPS: EPS,
        defaultDoc: defaultDoc,
        defaultPreferences: defaultPreferences,
        patternToProgram: patternToProgram,
        programToPattern: programToPattern,
        sorted: sorted,
        byId: byId,
        endOf: endOf,
        sectionAt: sectionAt,
        sectionStartingAt: sectionStartingAt,
        normalizeDoc: normalizeDoc,
        importJson: importJson,
        exportJson: exportJson,
        encodeForStorage: encodeForStorage,
        decodeFromStorage: decodeFromStorage,
        locatorPreview: locatorPreview,
        Store: Store
    };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = FlowSections; }
