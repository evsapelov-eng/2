#!/usr/bin/env python3
"""Generates the NØIZ Max patch SOURCES (.maxpat) from spec/dsp_map.json.

Status of the output: STATIC VALID at best (JSON, wiring, inlet/outlet indices,
file references — see tools/validate_maxpat.py). Not MAX LOAD VALID until opened
in Max, not a device until pasted into a native Max Instrument in Live and saved
there (docs/HOST_TEST_GUIDE.md). The .amxd is never produced by this script.

Inlet/outlet counts below are from memory of the Max 8/9 reference; every object
we rely on is listed in docs/MAX_API_TO_VERIFY.md.
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = json.load(open(os.path.join(ROOT, "spec", "dsp_map.json")))
OUT = os.path.join(ROOT, "max")

# name -> (inlets, outlets, outlettype) ; outlettype "signal" or "" per outlet
SIG = "signal"
KNOWN = {
    "noise~": (1, 1, [SIG]), "pink~": (1, 1, [SIG]), "cycle~": (2, 1, [SIG]),
    "svf~": (3, 4, [SIG] * 4), "line~": (2, 2, [SIG, "bang"]), "*~": (2, 1, [SIG]),
    "+~": (2, 1, [SIG]), "tanh~": (1, 1, [SIG]), "abs~": (1, 1, [SIG]), ">~": (2, 1, [SIG]),
    "in": (0, 1, [""]), "out~": (1, 0, []), "thispoly~": (1, 2, ["int", "int"]),
    "unpack": None, "pack": None, "pipe": None, "expr": None, "t": None, "route": None,
    "prepend": (1, 1, [""]), "sqrt": (1, 1, ["float"]), "*": (2, 1, ["float"]),
    "poly~": None, "plugout~": (2, 0, []), "js": (1, 3, ["", "", ""]), "qmetro": (2, 1, ["bang"]),
    "transport": (2, 9, ["int", "int", "float", "int", "float", "", "int", "float", "float"]),
    "loadbang": (1, 1, ["bang"]), "live.thisdevice": (1, 3, ["bang", "int", "int"]),
    "live.path": (2, 3, ["", "", ""]), "live.observer": (2, 2, ["", ""]),
    "deferlow": (1, 1, [""]), "print": (1, 0, []), "pattr": (1, 3, ["", "", ""]),
    "dac~": (2, 0, []), "button": (1, 1, ["bang"]),
}


def io_for(text):
    words = text.split()
    name = words[0]
    args = [w for w in words[1:] if not w.startswith("@")]
    if "@" in text:
        args = words[1:words.index(next(w for w in words if w.startswith("@")))]
    k = KNOWN.get(name, "unknown")
    if k == "unknown":
        raise ValueError("unknown object (add to KNOWN + MAX_API_TO_VERIFY): " + name)
    if k is not None:
        return k
    if name == "unpack":
        n = max(1, len(args))
        return 1, n, ["float" if "." in a or a == "f" else "int" for a in args] or ["int"]
    if name == "pack":
        n = max(1, len(args))
        return n, 1, [""]
    if name == "pipe":  # N values + delay as last arg
        n = len(args) - 1
        return n + 1, n, ["float" if "." in a else "int" for a in args[:-1]]
    if name == "expr":
        import re
        idx = [int(x) for x in re.findall(r"\$[fis](\d+)", text)]
        return max(idx) if idx else 1, 1, [""]
    if name == "t":
        return 1, len(args), [{"b": "bang", "f": "float", "i": "int", "l": "", "s": ""}[a] for a in args]
    if name == "route":
        return 2, len(args) + 1, [""] * (len(args) + 1)
    if name == "poly~":  # 1 [in 1], 2 [out~ 1/2] in every NØIZ voice
        return 1, 2, [SIG, SIG]
    raise ValueError(name)


class Patcher:
    def __init__(self, rect=(80, 80, 900, 700)):
        self.boxes, self.lines, self.n = [], [], 0
        self.rect = list(rect)
        self.extra = {}

    def _add(self, box):
        self.n += 1
        box["id"] = "obj-%d" % self.n
        self.boxes.append({"box": box})
        return box["id"]

    def obj(self, text, x, y, w=None, **kw):
        ni, no, ot = io_for(text)
        box = {"maxclass": "newobj", "text": text, "numinlets": ni, "numoutlets": no,
               "outlettype": ot, "patching_rect": [x, y, w or max(40, 7 * len(text) + 14), 22]}
        box.update(kw)
        return self._add(box)

    def msg(self, text, x, y, **kw):
        box = {"maxclass": "message", "text": text, "numinlets": 2, "numoutlets": 1,
               "outlettype": [""], "patching_rect": [x, y, max(40, 7 * len(text) + 14), 22]}
        box.update(kw)
        return self._add(box)

    def comment(self, text, x, y, w=420, h=None, **kw):
        lines = text.count("\n") + 1 + len(text) // 70
        box = {"maxclass": "comment", "text": text, "numinlets": 1, "numoutlets": 0,
               "patching_rect": [x, y, w, h or 14 * lines + 6]}
        box.update(kw)
        return self._add(box)

    def raw(self, box):
        return self._add(box)

    def connect(self, src, so, dst, di):
        self.lines.append({"patchline": {"source": [src, so], "destination": [dst, di]}})

    def chain(self, *ids):
        for a, b in zip(ids, ids[1:]):
            self.connect(a, 0, b, 0)

    def dump(self, path, **patcher_attrs):
        p = {"fileversion": 1,
             "appversion": {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1},
             "classnamespace": "box", "rect": self.rect, "bglocked": 0, "openinpresentation": 0,
             "default_fontsize": 12.0, "default_fontface": 0, "default_fontname": "Arial",
             "gridonopen": 1, "gridsize": [8.0, 8.0], "gridsnaponopen": 1, "toolbarvisible": 1,
             "boxes": self.boxes, "lines": self.lines}
        p.update(patcher_attrs)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"patcher": p}, f, indent=1, ensure_ascii=False)
        return path


def fmt(v):
    return ("%.6g" % v) if isinstance(v, float) else str(v)


# ---------------------------------------------------------------- P1 hello
def build_p1():
    P = Patcher((60, 60, 760, 520))
    P.comment("NØIZ — P1 host gate. Paste into a NATIVE Max Instrument created in Live 12 "
              "(see docs/HOST_TEST_GUIDE.md). No external JS. Click TRIG: you must hear a short hiss.",
              20, 12, 700)
    btn = P.raw({"maxclass": "live.button", "numinlets": 1, "numoutlets": 1, "outlettype": [""],
                 "parameter_enable": 1, "patching_rect": [20, 60, 30, 30], "presentation": 1,
                 "presentation_rect": [10, 10, 30, 30], "varname": "p1_trig",
                 "saved_attribute_attributes": {"valueof": {
                     "parameter_longname": "P1 Trigger", "parameter_shortname": "TRIG",
                     "parameter_type": 2, "parameter_enum": ["off", "on"], "parameter_mmax": 1}}})
    env_msg = P.msg("1 0.7 0 120", 20, 110)
    line = P.obj("line~", 20, 150)
    sq = P.obj("*~", 20, 190)
    noise = P.obj("noise~", 200, 110)
    svf = P.obj("svf~ 6000 0.2", 200, 150)
    vca = P.obj("*~", 200, 230)
    gain = P.obj("*~ 0.3", 200, 270)
    out = P.obj("plugout~", 200, 320)
    P.comment("line~ ramps to 1 in 0.7 ms, back to 0 in 120 ms; squared = smooth exponential-like decay",
              300, 190, 380)
    P.connect(btn, 0, env_msg, 0)
    P.connect(env_msg, 0, line, 0)
    P.connect(line, 0, sq, 0); P.connect(line, 0, sq, 1)
    P.connect(noise, 0, svf, 0)
    P.connect(svf, 1, vca, 0)          # svf~ outlet 1 = highpass (VERIFY)
    P.connect(sq, 0, vca, 1)
    P.connect(vca, 0, gain, 0)
    P.connect(gain, 0, out, 0); P.connect(gain, 0, out, 1)
    return P.dump(os.path.join(OUT, "p1_hello_hiss.maxpat"), openinpresentation=1, devicewidth=120.0)


# ---------------------------------------------------------------- voices
def voice_chain(P, name, v, x0, tone_hz_id, tex_ids, drive_ids, env_id, outlet_index):
    """One noise→filter→env→drive chain; returns final signal id. tex_ids = (white_gain, pink_gain, thr)."""
    T = MAP["texture"]
    white = P.obj("noise~", x0, 300)
    pink = P.obj("pink~", x0 + 70, 300)
    wg = P.obj("*~ 1.", x0, 340)
    pg = P.obj("*~ 0.", x0 + 70, 340)
    P.connect(white, 0, wg, 0); P.connect(pink, 0, pg, 0)
    P.connect(tex_ids[0], 0, wg, 1); P.connect(tex_ids[1], 0, pg, 1)
    s1 = P.obj("+~", x0, 380)
    P.connect(wg, 0, s1, 0); P.connect(pg, 0, s1, 1)
    src = s1
    if v["crackleGain"] > 0:
        cn = P.obj("noise~", x0 + 150, 300)
        ab = P.obj("abs~", x0 + 150, 340)
        gt = P.obj(">~ 1.", x0 + 150, 380)
        ca = P.obj("noise~", x0 + 230, 340)
        cm = P.obj("*~", x0 + 150, 420)
        cg = P.obj("*~ %s" % fmt(float(v["crackleGain"])), x0 + 150, 460)
        P.chain(cn, ab, gt)
        P.connect(tex_ids[2], 0, gt, 1)
        P.connect(gt, 0, cm, 0); P.connect(ca, 0, cm, 1)
        P.connect(cm, 0, cg, 0)
        s2 = P.obj("+~", x0, 500)
        P.connect(s1, 0, s2, 0); P.connect(cg, 0, s2, 1)
        src = s2
    filt = P.obj("svf~ 1000 %s" % fmt(float(v["q"])), x0, 540)
    P.connect(src, 0, filt, 0)
    P.connect(tone_hz_id, 0, filt, 1)
    out_idx = {"lp": 0, "hp": 1, "bp": 2}[v["filter"]]
    sig = (filt, out_idx)
    if name == "METAL":
        # partials (sine) crossfaded with band-passed noise by texture
        psum = None
        for i, (r, g) in enumerate(zip(v["partialRatios"], v["partialGains"])):
            fr = P.obj("* %s" % fmt(float(r)), x0 + 300 + i * 90, 500)
            P.connect(tone_hz_id, 0, fr, 0)
            osc = P.obj("cycle~", x0 + 300 + i * 90, 540)
            P.connect(fr, 0, osc, 0)
            pg2 = P.obj("*~ %s" % fmt(float(g)), x0 + 300 + i * 90, 580)
            P.connect(osc, 0, pg2, 0)
            if psum is None:
                psum = pg2
            else:
                a = P.obj("+~", x0 + 300 + i * 90, 620)
                P.connect(psum, 0, a, 0); P.connect(pg2, 0, a, 1)
                psum = a
        pmix = P.obj("*~ 1.", x0 + 300, 660)       # × (1 - texture)
        nmix = P.obj("*~ 0.", x0, 600)             # × texture * 2.5
        P.connect(psum, 0, pmix, 0)
        P.connect(tex_ids[3], 0, pmix, 1)
        P.connect(filt, out_idx, nmix, 0)
        P.connect(tex_ids[4], 0, nmix, 1)
        mix = P.obj("+~", x0, 700)
        P.connect(nmix, 0, mix, 0); P.connect(pmix, 0, mix, 1)
        sig = (mix, 0)
    vca = P.obj("*~", x0, 740)
    P.connect(sig[0], sig[1], vca, 0)
    P.connect(env_id, 0, vca, 1)
    og = P.obj("*~ %s" % fmt(float(v["outGain"])), x0, 780)
    pre = P.obj("*~ 1.", x0, 820)
    th = P.obj("tanh~", x0, 860)
    comp = P.obj("*~ 1.", x0, 900)
    P.chain(vca, og, pre, th, comp)
    P.connect(drive_ids[0], 0, pre, 1)
    P.connect(drive_ids[1], 0, comp, 1)
    o = P.obj("out~ %d" % outlet_index, x0, 950)
    P.connect(comp, 0, o, 0)
    return comp


def build_voice(name):
    v = MAP["voices"][name]
    T = MAP["texture"]
    D = MAP["drive"]
    P = Patcher((40, 40, 1300, 1050))
    P.comment("NØIZ voice %s — poly~ instance. GENERATED by tools/build_patches.py from spec/dsp_map.json. "
              "Input list: amp tone decay texture drive (all 0..1, amp already includes velocity curve and level)." % name,
              20, 8, 900)
    inp = P.obj("in 1", 20, 50)
    trig = P.obj("t l l", 20, 80)
    P.connect(inp, 0, trig, 0)
    # --- params (right outlet fires first): set filter / mix / drive BEFORE the envelope starts
    up = P.obj("unpack 0. 0. 0. 0. 0.", 300, 120, 200)
    P.connect(trig, 1, up, 0)
    lo, hi = v["toneHz"]
    tone = P.obj("expr %s*pow(%s/%s\\,$f1)" % (fmt(float(lo)), fmt(float(hi)), fmt(float(lo))), 300, 160, 200)
    P.connect(up, 1, tone, 0)
    tex_t = P.obj("t f f f f f", 520, 160, 120)
    P.connect(up, 3, tex_t, 0)
    wgain = P.obj("expr (1-$f1)*%s" % fmt(float(T["whiteGain"])), 520, 200, 140)
    pgain = P.obj("expr $f1*%s" % fmt(float(T["pinkGain"])), 660, 200, 120)
    thr = P.obj("expr 1-%s*$f1" % fmt(float(T["crackleMaxDensity"])), 790, 200, 140)
    mpart = P.obj("expr 1-$f1", 940, 200, 90)
    mnoise = P.obj("expr $f1*2.5", 1040, 200, 100)
    for i, d in enumerate([wgain, pgain, thr, mpart, mnoise]):
        P.connect(tex_t, 4 - i, d, 0)
    drv_t = P.obj("t f f", 1150, 160, 60)
    P.connect(up, 4, drv_t, 0)
    drv_pre = P.obj("expr 1+$f1*%s" % fmt(float(D["gainMax"])), 1150, 200, 120)
    drv_comp = P.obj("expr pow(1+$f1*%s\\,-%s)" % (fmt(float(D["gainMax"])), fmt(float(D["compExp"]))), 1150, 240, 150)
    P.connect(drv_t, 1, drv_pre, 0); P.connect(drv_t, 0, drv_comp, 0)
    # --- envelope (left outlet fires second)
    ue = P.obj("unpack 0. 0. 0. 0. 0.", 20, 120, 200)
    P.connect(trig, 0, ue, 0)
    dlo, dhi = v["decayMs"]
    dec = P.obj("expr %s*pow(%s/%s\\,$f1)" % (fmt(float(dlo)), fmt(float(dhi)), fmt(float(dlo))), 100, 160, 180)
    P.connect(ue, 2, dec, 0)
    amp = P.obj("sqrt", 20, 160)
    P.connect(ue, 0, amp, 0)
    if "attackMs" in v:
        alo, ahi = v["attackMs"]
        dt = P.obj("t f f", 100, 190, 50)
        P.connect(ue, 2, dt, 0)
        P.lines[:] = [l for l in P.lines if not (l["patchline"]["source"] == [ue, 2] and l["patchline"]["destination"] == [dec, 0])]
        P.connect(dt, 1, dec, 0)
        att = P.obj("expr %s+%s*$f1" % (fmt(float(alo)), fmt(float(ahi - alo))), 160, 220, 120)
        P.connect(dt, 0, att, 0)
        pk = P.obj("pack 0. 0. 0.", 20, 250, 120)
        P.connect(amp, 0, pk, 0); P.connect(dec, 0, pk, 1); P.connect(att, 0, pk, 2)
        em = P.msg("$1 $3 0 $2", 20, 280)
    else:
        pk = P.obj("pack 0. 0.", 20, 250, 100)
        P.connect(amp, 0, pk, 0); P.connect(dec, 0, pk, 1)
        em = P.msg("$1 %s 0 $2" % fmt(float(MAP["envelope"]["attackMs"])), 20, 280)
    P.connect(pk, 0, em, 0)
    line = P.obj("line~", 20, 310, 60)
    P.connect(em, 0, line, 0)
    sq = P.obj("*~", 20, 340, 40)
    P.connect(line, 0, sq, 0); P.connect(line, 0, sq, 1)
    busy = P.obj("thispoly~", 20, 380)
    P.connect(sq, 0, busy, 0)
    tex_ids = (wgain, pgain, thr, mpart, mnoise)
    chans = 2 if v["stereo"].startswith("decorrelated") else 1
    last = voice_chain(P, name, v, 300, tone, tex_ids, (drv_pre, drv_comp), sq, 1)
    if chans == 2:
        voice_chain(P, name, v, 700, tone, tex_ids, (drv_pre, drv_comp), sq, 2)
    else:
        o2 = P.obj("out~ 2", 300 + 80, 950)
        P.connect(last, 0, o2, 0)
    return P.dump(os.path.join(OUT, "noiz_voice_%s.maxpat" % name.lower()))


# ---------------------------------------------------------------- main
UI_W, UI_H = 760, 169


def build_main():
    P = Patcher((40, 40, 1400, 900))
    P.comment("NØIZ — main device patch (source). GENERATED by tools/build_patches.py. "
              "Paste into a native Max Instrument (docs/HOST_TEST_GUIDE.md). Status: STATIC VALID only.",
              20, 8, 900)
    # start-up
    dev = P.obj("live.thisdevice", 20, 40)
    lb = P.obj("loadbang", 160, 40)
    start = P.msg("1", 20, 80)
    P.connect(dev, 0, start, 0); P.connect(lb, 0, start, 0)
    # clock bridge: low-priority poll so the position is fresh when JS runs
    qm = P.obj("qmetro 10", 20, 120)
    P.connect(start, 0, qm, 0)
    tr = P.obj("transport", 20, 160, 160)
    P.connect(qm, 0, tr, 0)
    pk = P.obj("pack 0 0 0. 0 0.", 20, 200, 160)
    for i in range(5):
        P.connect(tr, i, pk, i)  # bars beats units resolution tempo (VERIFY outlet order)
    tick = P.obj("prepend tick", 20, 240)
    P.connect(pk, 0, tick, 0)
    P.comment("transport outlets 0-4 = bars, beats, units, resolution, tempo — VERIFY (MAX_API_TO_VERIFY #1)",
              200, 200, 420)
    # loop info from Live
    path = P.msg("path live_set", 420, 40)
    P.connect(dev, 0, path, 0)
    lp = P.obj("live.path", 420, 80)
    P.connect(path, 0, lp, 0)
    for i, (prop, pre) in enumerate([("loop", "loopon"), ("loop_start", "loopstart"), ("loop_length", "looplength")]):
        x = 420 + i * 170
        pm = P.msg("property %s" % prop, x, 120)
        P.connect(dev, 0, pm, 0)
        ob = P.obj("live.observer", x, 160)
        P.connect(pm, 0, ob, 0)
        P.connect(lp, 0, ob, 1)
        pp = P.obj("prepend %s" % pre, x, 200)
        P.connect(ob, 0, pp, 0)
        P.connect(pp, 0, "ENGINE", 0)
    # engine
    eng = P.obj("js noiz_engine.js", 20, 300, 200, varname="engine")
    P.lines[:] = [{"patchline": {"source": l["patchline"]["source"],
                                 "destination": [eng if l["patchline"]["destination"][0] == "ENGINE" else l["patchline"]["destination"][0],
                                                 l["patchline"]["destination"][1]]}} for l in P.lines]
    P.connect(tick, 0, eng, 0)
    P.connect(dev, 0, eng, 0)   # bang → bind UI
    state = P.obj("pattr noiz_state @bindto engine", 260, 300, 220, varname="noiz_state", parameter_enable=1,
                  saved_attribute_attributes={"valueof": {
                      "parameter_longname": "noiz_state", "parameter_shortname": "state",
                      "parameter_type": 3, "parameter_invisible": 1, "parameter_initial_enable": 0}})
    P.comment("pattr = Live 'Blob' parameter, Stored Only → saved in the Live Set (VERIFY #6, A20)",
              490, 300, 420)
    # DSP routing: trig list → unpack → pipe (high-priority delay) → pack → route voice → poly~
    rt = P.obj("route trig flush", 20, 360, 140)
    P.connect(eng, 0, rt, 0)
    up = P.obj("unpack 0 0. 0. 0. 0. 0. 0.", 20, 400, 220)
    P.connect(rt, 0, up, 0)
    pipe = P.obj("pipe 0 0. 0. 0. 0. 0. 0", 20, 440, 220)
    for i in range(7):
        P.connect(up, i, pipe, i)   # outlet 6 = delay → pipe's delay inlet (last)
    clr = P.msg("clear", 260, 400)
    P.connect(rt, 1, clr, 0)
    P.connect(clr, 0, pipe, 0)
    pk2 = P.obj("pack 0 0. 0. 0. 0. 0.", 20, 480, 220)
    for i in range(6):
        P.connect(pipe, i, pk2, i)
    rv = P.obj("route 0 1 2 3", 20, 520, 160)
    P.connect(pk2, 0, rv, 0)
    sums = []
    for i, name in enumerate(["hiss", "dust", "metal", "atmos"]):
        x = 20 + i * 200
        pn = P.obj("prepend note", x, 560)
        P.connect(rv, i, pn, 0)
        poly = P.obj("poly~ noiz_voice_%s 8 @steal 1" % name, x, 600, 190)
        P.connect(pn, 0, poly, 0)
        sums.append(poly)
    P.comment("poly~: one instance per hit → ratchets/overlaps keep their own envelope and P-Lock values",
              820, 600, 420)
    # master: sum L/R → fixed soft safety → plugout~
    out = []
    for ch in range(2):
        acc = None
        for j, poly in enumerate(sums):
            if acc is None:
                acc = (poly, ch)
                continue
            a = P.obj("+~", 20 + ch * 300 + j * 60, 650 + j * 30, 40)
            P.connect(acc[0], acc[1], a, 0)
            P.connect(poly, ch, a, 1)
            acc = (a, 0)
        md = P.obj("*~ %s" % fmt(float(MAP["master"]["drive"])), 20 + ch * 300, 770)
        th = P.obj("tanh~", 20 + ch * 300, 800)
        ce = P.obj("*~ %s" % fmt(float(MAP["master"]["ceiling"])), 20 + ch * 300, 830)
        P.connect(acc[0], acc[1], md, 0)
        P.chain(md, th, ce)
        out.append(ce)
    po = P.obj("plugout~", 20, 870)
    P.connect(out[0], 0, po, 0); P.connect(out[1], 0, po, 1)
    # UI
    ui = P.raw({"maxclass": "jsui", "filename": "noiz_ui.js", "numinlets": 1, "numoutlets": 1,
                "outlettype": [""], "parameter_enable": 0, "border": 0,
                "patching_rect": [700, 360, UI_W, UI_H], "presentation": 1,
                "presentation_rect": [0, 0, UI_W, UI_H], "varname": "noiz_ui"})
    dl = P.obj("deferlow", 700, 330)
    P.connect(eng, 1, dl, 0)
    P.connect(dl, 0, ui, 0)
    P.connect(ui, 0, eng, 0)
    st = P.obj("route sync pending error", 260, 360, 180)
    P.connect(eng, 2, st, 0)
    pr = P.obj("print NØIZ", 400, 400)
    P.connect(st, 2, pr, 0)
    return P.dump(os.path.join(OUT, "noiz_main.maxpat"), openinpresentation=1, devicewidth=float(UI_W))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for f in [build_p1()] + [build_voice(n) for n in ["HISS", "DUST", "METAL", "ATMOS"]] + [build_main()]:
        print("wrote", os.path.relpath(f, ROOT))
