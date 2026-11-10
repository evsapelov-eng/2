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
    """Max [expr] does INTEGER arithmetic on integer literals (9000/700 == 12):
    floats are always written with a decimal point."""
    if isinstance(v, float):
        t = "%.6g" % v
        if "e" in t:
            t = repr(v)
        return t if "." in t else t + "."
    return str(v)


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
# Voice input list (9 values, 0..1): amp tone decay texture drive pan reso attack character
VOICE_FIELDS = ["amp", "tone", "decay", "texture", "drive", "pan", "reso", "attack", "character"]


def F(i):
    return VOICE_FIELDS.index(i)


def expmap_expr(rng):
    lo, hi = float(rng[0]), float(rng[1])
    return "expr %s*pow(%s/%s\\,$f1)" % (fmt(lo), fmt(hi), fmt(lo))


def voice_chain(P, name, v, x0, ctl):
    """One noise→filter→(METAL partials/colour)→env→drive chain. Returns the final signal box id."""
    T = MAP["texture"]
    y = 420
    white = P.obj("noise~", x0, y)
    pink = P.obj("pink~", x0 + 70, y)
    wg = P.obj("*~ 1.", x0, y + 40)
    pg = P.obj("*~ 0.", x0 + 70, y + 40)
    P.connect(white, 0, wg, 0); P.connect(pink, 0, pg, 0)
    P.connect(ctl["wgain"], 0, wg, 1); P.connect(ctl["pgain"], 0, pg, 1)
    src = P.obj("+~", x0, y + 80)
    P.connect(wg, 0, src, 0); P.connect(pg, 0, src, 1)
    if name == "DUST":  # GRAIN: less noise body, more grains
        ng = P.obj("*~ 1.", x0, y + 110)
        P.connect(src, 0, ng, 0); P.connect(ctl["noisegain"], 0, ng, 1)
        src = ng
    if v["crackleGain"] > 0:
        cn = P.obj("noise~", x0 + 150, y)
        ab = P.obj("abs~", x0 + 150, y + 40)
        gt = P.obj(">~ 1.", x0 + 150, y + 80)
        ca = P.obj("noise~", x0 + 230, y + 40)
        cm = P.obj("*~", x0 + 150, y + 120)
        cg = P.obj("*~ %s" % fmt(float(v["crackleGain"])), x0 + 150, y + 150)
        P.chain(cn, ab, gt)
        P.connect(ctl["thr"], 0, gt, 1)
        P.connect(gt, 0, cm, 0); P.connect(ca, 0, cm, 1)
        P.connect(cm, 0, cg, 0)
        s2 = P.obj("+~", x0, y + 180)
        P.connect(src, 0, s2, 0); P.connect(cg, 0, s2, 1)
        src = s2
    # METAL's noise exciter keeps a fixed q (its RESO acts on the colour filter below)
    filt = P.obj("svf~ 1000. %s" % ("0.7" if name == "METAL" else "0.5"), x0, y + 220)
    P.connect(src, 0, filt, 0)
    P.connect(ctl["filtfreq"], 0, filt, 1)
    if name != "METAL":
        P.connect(ctl["q"], 0, filt, 2)
    if name == "HISS":  # BODY: highpass → bandpass crossfade
        hg = P.obj("*~ 1.", x0, y + 260)
        bg = P.obj("*~ 0.", x0 + 70, y + 260)
        P.connect(filt, 1, hg, 0); P.connect(filt, 2, bg, 0)
        P.connect(ctl["hpgain"], 0, hg, 0 + 1); P.connect(ctl["bpgain"], 0, bg, 1)
        sig = P.obj("+~", x0, y + 290)
        P.connect(hg, 0, sig, 0); P.connect(bg, 0, sig, 1)
        sig = (sig, 0)
    else:
        sig = (filt, {"lp": 0, "hp": 1, "bp": 2}[v["filter"]])
    if name == "METAL":
        psum = None
        for i, g in enumerate(v["partialGains"]):
            fr = ctl["partials"][i]
            osc = P.obj("cycle~", x0 + 320 + i * 90, y + 260)
            P.connect(fr, 0, osc, 0)
            pg2 = P.obj("*~ %s" % fmt(float(g)), x0 + 320 + i * 90, y + 290)
            P.connect(osc, 0, pg2, 0)
            if psum is None:
                psum = pg2
            else:
                ad = P.obj("+~", x0 + 320 + i * 90, y + 320)
                P.connect(psum, 0, ad, 0); P.connect(pg2, 0, ad, 1)
                psum = ad
        pmix = P.obj("*~ 1.", x0 + 320, y + 360)
        nmix = P.obj("*~ 0.", x0, y + 300)
        P.connect(psum, 0, pmix, 0); P.connect(ctl["mpart"], 0, pmix, 1)
        P.connect(sig[0], sig[1], nmix, 0); P.connect(ctl["mnoise"], 0, nmix, 1)
        mix = P.obj("+~", x0, y + 400)
        P.connect(nmix, 0, mix, 0); P.connect(pmix, 0, mix, 1)
        # resonant colour of the whole mix, level-normalised
        col = P.obj("svf~ 1000. 0.5", x0 + 120, y + 430)
        P.connect(mix, 0, col, 0)
        P.connect(ctl["filtfreq"], 0, col, 1)
        P.connect(ctl["q"], 0, col, 2)
        cgain = P.obj("*~ 0.", x0 + 120, y + 460)
        P.connect(col, 2, cgain, 0); P.connect(ctl["colorgain"], 0, cgain, 1)
        csum = P.obj("+~", x0, y + 490)
        P.connect(mix, 0, csum, 0); P.connect(cgain, 0, csum, 1)
        cnorm = P.obj("*~ 1.", x0, y + 520)
        P.connect(csum, 0, cnorm, 0); P.connect(ctl["colornorm"], 0, cnorm, 1)
        sig = (cnorm, 0)
    yy = y + 560
    vca = P.obj("*~", x0, yy)
    P.connect(sig[0], sig[1], vca, 0)
    P.connect(ctl["env"], 0, vca, 1)
    og = P.obj("*~ %s" % fmt(float(v["outGain"])), x0, yy + 30)
    pre = P.obj("*~ 1.", x0, yy + 60)
    th = P.obj("tanh~", x0, yy + 90)
    comp = P.obj("*~ 1.", x0, yy + 120)
    P.chain(vca, og, pre, th, comp)
    P.connect(ctl["drvpre"], 0, pre, 1)
    P.connect(ctl["drvcomp"], 0, comp, 1)
    return comp


def build_voice(name):
    v = MAP["voices"][name]
    T, D, E, R = MAP["texture"], MAP["drive"], MAP["envelope"], MAP["reso"]
    CH = MAP["character"][name]
    P = Patcher((40, 40, 1500, 1350))
    P.comment("NØIZ voice %s — poly~ instance. GENERATED by tools/build_patches.py from spec/dsp_map.json. "
              "Input list (0..1): %s." % (name, " ".join(VOICE_FIELDS)), 20, 8, 1000)
    inp = P.obj("in 1", 20, 50)
    trig = P.obj("t l l", 20, 80)
    P.connect(inp, 0, trig, 0)
    unp = "unpack " + " ".join(["0."] * len(VOICE_FIELDS))
    # ---- parameters first (right outlet of [t l l] fires first)
    up = P.obj(unp, 300, 110, 260)
    P.connect(trig, 1, up, 0)
    ctl = {}
    tone = P.obj(expmap_expr(v["toneHz"]), 300, 150, 200)
    P.connect(up, F("tone"), tone, 0)
    if name == "METAL":
        ff = P.obj("* %s" % fmt(float(v["noiseBpRatio"])), 300, 180)
        P.connect(tone, 0, ff, 0)
        ctl["filtfreq"] = ff
        lo, hi = CH["range"]
        kexp = P.obj("expr %s+%s*$f1" % (fmt(float(lo)), fmt(float(hi - lo))), 1300, 150, 140)
        P.connect(up, F("character"), kexp, 0)
        ctl["partials"] = []
        for i, r in enumerate(v["partialRatios"]):
            pe = P.obj("expr $f1*(1.+%s*$f2)" % fmt(float(r) - 1.0), 300 + i * 140, 210, 130)
            P.connect(tone, 0, pe, 0)
            P.connect(kexp, 0, pe, 1)  # character arrives first (unpack fires right to left)
            ctl["partials"].append(pe)
    else:
        ctl["filtfreq"] = tone
    tex_t = P.obj("t f f f f f", 560, 150, 120)
    P.connect(up, F("texture"), tex_t, 0)
    ctl["wgain"] = P.obj("expr (1.-$f1)*%s" % fmt(float(T["whiteGain"])), 560, 190, 140)
    ctl["pgain"] = P.obj("expr $f1*%s" % fmt(float(T["pinkGain"])), 700, 190, 120)
    ctl["mpart"] = P.obj("expr 1.-$f1", 830, 190, 90)
    ctl["mnoise"] = P.obj("expr $f1*2.5", 930, 190, 100)
    for i, k in enumerate(["wgain", "pgain", "mpart", "mnoise"]):
        P.connect(tex_t, i, ctl[k], 0)
    if name == "DUST":
        ch_t = P.obj("t f f", 1040, 150, 60)
        P.connect(up, F("character"), ch_t, 0)
        d0, d1 = CH["dens"]
        ctl["thr"] = P.obj("expr 1.-(%s+%s*$f1)" % (fmt(float(d0)), fmt(float(d1 - d0))), 1040, 190, 160)
        ctl["noisegain"] = P.obj("expr 1.-%s*$f1" % fmt(float(CH["noiseCut"])), 1210, 190, 120)
        P.connect(ch_t, 0, ctl["thr"], 0); P.connect(ch_t, 1, ctl["noisegain"], 0)
    else:
        ctl["thr"] = P.obj("expr 1.-%s*$f1" % fmt(float(T["crackleMaxDensity"])), 1040, 190, 140)
        P.connect(tex_t, 4, ctl["thr"], 0)
    if name == "HISS":
        ch_t = P.obj("t f f", 1040, 230, 60)
        P.connect(up, F("character"), ch_t, 0)
        ctl["hpgain"] = P.obj("expr 1.-$f1", 1040, 260, 90)
        ctl["bpgain"] = P.obj("expr $f1*%s" % fmt(float(CH["bpGain"])), 1140, 260, 110)
        P.connect(ch_t, 0, ctl["hpgain"], 0); P.connect(ch_t, 1, ctl["bpgain"], 0)
    drv_t = P.obj("t f f", 1300, 300, 60)
    P.connect(up, F("drive"), drv_t, 0)
    ctl["drvpre"] = P.obj("expr 1.+$f1*%s" % fmt(float(D["gainMax"])), 1300, 330, 120)
    ctl["drvcomp"] = P.obj("expr pow(1.+$f1*%s\\,-%s)" % (fmt(float(D["gainMax"])), fmt(float(D["compExp"]))), 1300, 360, 170)
    P.connect(drv_t, 1, ctl["drvpre"], 0); P.connect(drv_t, 0, ctl["drvcomp"], 0)
    res_t = P.obj("t f f", 560, 230, 60)
    P.connect(up, F("reso"), res_t, 0)
    ctl["q"] = P.obj("expr %s+%s*$f1" % (fmt(float(R["q"][0])), fmt(float(R["q"][1] - R["q"][0]))), 560, 260, 140)
    P.connect(res_t, 1, ctl["q"], 0)
    if name == "METAL":
        g, nrm = float(MAP["metalColor"]["gain"]), float(MAP["metalColor"]["norm"])
        ctl["colorgain"] = P.obj("expr $f1*%s" % fmt(g), 710, 260, 100)
        ctl["colornorm"] = P.obj("expr 1./(1.+%s*$f1)" % fmt(g * nrm), 820, 260, 140)
        P.connect(res_t, 0, ctl["colorgain"], 0)
        P.connect(res_t, 0, ctl["colornorm"], 0)
    pan_t = P.obj("t f f", 300, 300, 60)
    P.connect(up, F("pan"), pan_t, 0)
    gl = P.obj("expr 1.41421*cos($f1*1.570796)", 300, 330, 200)
    gr = P.obj("expr 1.41421*sin($f1*1.570796)", 300, 360, 200)
    P.connect(pan_t, 1, gl, 0); P.connect(pan_t, 0, gr, 0)
    # ---- envelope (left outlet of [t l l] fires second)
    ue = P.obj(unp, 20, 110, 260)
    P.connect(trig, 0, ue, 0)
    dec = P.obj(expmap_expr(v["decayMs"]), 100, 150, 180)
    P.connect(ue, F("decay"), dec, 0)
    att = P.obj(expmap_expr(E["attackMs"]), 100, 180, 180)
    P.connect(ue, F("attack"), att, 0)
    amp = P.obj("sqrt", 20, 150)
    P.connect(ue, F("amp"), amp, 0)
    pk = P.obj("pack 0. 0. 0.", 20, 220, 120)
    P.connect(amp, 0, pk, 0); P.connect(dec, 0, pk, 1); P.connect(att, 0, pk, 2)
    em = P.msg("$1 $3 0 $2", 20, 250)
    P.connect(pk, 0, em, 0)
    line = P.obj("line~", 20, 280, 60)
    P.connect(em, 0, line, 0)
    sq = P.obj("*~", 20, 310, 40)
    P.connect(line, 0, sq, 0); P.connect(line, 0, sq, 1)
    busy = P.obj("thispoly~", 20, 350)
    P.connect(sq, 0, busy, 0)
    ctl["env"] = sq
    # ---- channels
    left = voice_chain(P, name, v, 20, ctl)
    if v["stereo"].startswith("decorrelated"):  # ATMOS: WIDTH mixes a decorrelated right chain
        right_raw = voice_chain(P, name, v, 760, ctl)
        w_t = P.obj("t f f", 1300, 400, 60)
        P.connect(up, F("character"), w_t, 0)
        wl = P.obj("expr 1.-$f1", 1300, 430, 90)
        P.connect(w_t, 1, wl, 0)
        a = P.obj("*~ 0.", 760, 1220)
        b = P.obj("*~ 1.", 860, 1220)
        P.connect(left, 0, a, 0); P.connect(wl, 0, a, 1)
        P.connect(right_raw, 0, b, 0); P.connect(w_t, 0, b, 1)
        right = P.obj("+~", 760, 1250)
        P.connect(a, 0, right, 0); P.connect(b, 0, right, 1)
    else:
        right = left
    pl = P.obj("*~ 1.", 20, 1290)
    pr = P.obj("*~ 1.", 200, 1290)
    P.connect(left, 0, pl, 0); P.connect(gl, 0, pl, 1)
    P.connect(right, 0, pr, 0); P.connect(gr, 0, pr, 1)
    o1 = P.obj("out~ 1", 20, 1320)
    o2 = P.obj("out~ 2", 200, 1320)
    P.connect(pl, 0, o1, 0); P.connect(pr, 0, o2, 0)
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
    nvals = 10  # track amp tone decay texture drive pan reso attack character
    up = P.obj("unpack 0" + " 0." * (nvals - 1) + " 0.", 20, 400, 300)
    P.connect(rt, 0, up, 0)
    pipe = P.obj("pipe 0" + " 0." * (nvals - 1) + " 0", 20, 440, 300)
    for i in range(nvals + 1):
        P.connect(up, i, pipe, i)   # last outlet = delay → pipe's delay inlet (last)
    clr = P.msg("clear", 260, 400)
    P.connect(rt, 1, clr, 0)
    P.connect(clr, 0, pipe, 0)
    pk2 = P.obj("pack 0" + " 0." * (nvals - 1), 20, 480, 300)
    for i in range(nvals):
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
