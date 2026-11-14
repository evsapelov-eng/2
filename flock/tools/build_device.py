#!/usr/bin/env python3
"""Builds the FLØCK Max for Live AUDIO EFFECT from sources.

  gen/flock.genexpr  → embedded in a [gen~] codebox (no external .gendsp needed)
  js/flock_ui.js     → the panel ([jsui], copied next to the device)
Writes max/flock_main.maxpat and dist/FLOCK/FLØCK_<version>.amxd + flock_ui_<version>.js (+ zip).
The version is in the file names: Max/Live resolve a device or a jsui file by NAME, and an old
FLØCK.amxd / flock_ui.js elsewhere in the search path (or already loaded) can win over the new one.

HONEST STATUS: the .amxd is written by this script (container 'ampf', type 'aaaa' =
audio effect), NOT saved by Max inside Live, and NOT frozen. Test build: open it in Live,
then Freeze (see dist_README.txt). Object inlet/outlet counts are from memory of the Max
reference → docs/MAX_API_TO_VERIFY.md.
"""
import json
import os
import re
import shutil
import struct
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXDIR = os.path.join(ROOT, "max")
DIST = os.path.join(ROOT, "dist")
PKG = os.path.join(DIST, "FLOCK")
VERSION = json.load(open(os.path.join(ROOT, "package.json")))["version"]
# versioned file names (see the docstring)
JSNAME = "flock_ui_%s.js" % VERSION.replace(".", "_")
# ASCII only: the diagnostic devices (FLOCK_*.amxd) loaded and sounded in Live while the
# byte-identical FLØCK*.amxd did not → no "Ø" in file names
AMXDNAME = "FLOCK_%s.amxd" % VERSION.replace(".", "_")
CODE = open(os.path.join(ROOT, "gen", "flock.genexpr"), encoding="utf-8").read()


def embed_code(code):
    """The text that goes into the gen~ codebox: no // comments, no blank lines, ASCII only
    (smaller, and nothing for Max's parser to trip over; the commented source stays in gen/)."""
    out = []
    for line in code.split("\n"):
        line = re.sub(r"//.*$", "", line).rstrip()
        if line.strip():
            out.append(line)
    text = "\n".join(out) + "\n"
    bad = [c for c in text if ord(c) > 127]
    if bad:
        raise SystemExit("non-ASCII outside comments in the engine: " + "".join(sorted(set(bad))))
    return text


KEEP = set("""if else for return while Param History Data min max clamp abs floor ceil trunc fract sqrt exp log
pow sin cos tan atan tanh sign noise peek poke dim samplerate pi twopi""".split())


def compact_code(code):
    """The same program, short: internal names (locals, History, Data, functions) renamed to short
    ones, no indentation, no spaces. Param names (the device's interface) and in/out stay."""
    text = embed_code(code)
    params = set(re.findall(r"^Param (\w+)\(", text, re.M))
    ids = []
    for m in re.finditer(r"[A-Za-z_]\w*", text):
        t = m.group(0)
        if t in KEEP or t in params or re.match(r"^(in|out)\d+$", t) or t in ids:
            continue
        ids.append(t)
    used = set(re.findall(r"[A-Za-z_]\w*", text))
    names, n = {}, 0
    for t in sorted(ids, key=lambda t: -text.count(t)):
        while True:
            cand = "z" + _b36(n)
            n += 1
            if cand not in used:
                break
        names[t] = cand
    text = re.sub(r"[A-Za-z_]\w*", lambda m: names.get(m.group(0), m.group(0)), text)
    out = []
    for line in text.split("\n"):
        line = re.sub(r"\s*([=+\-*/<>!?:,;(){}&|])\s*", r"\1", line.strip())
        line = re.sub(r"^(Param|History|Data)(?=\w)", r"\1 ", line)
        line = re.sub(r"\breturn(?=\()", "return ", line)
        if line:
            out.append(line)
    return "\n".join(out) + "\n"


# what goes into the codebox: comment-free, original names (the form every working device used;
# compact_code is kept but not used)
EMBED = embed_code


def _b36(n):
    d = "0123456789abcdefghijklmnopqrstuvwxyz"
    s = ""
    while True:
        s = d[n % 36] + s
        n //= 36
        if not n:
            return s
W, H = 900, 169
SIG = "signal"

# (engine Param, Live long name, short, min, max, default, unitstyle, kind)
#  unitstyle: 1 float, 4 dB ; kind: dial / toggle ; engine None = handled specially
PARAMS = [
    ("time", "Time", "Time", 0, 1, 0.15, 1, "dial"),
    ("density", "Density", "Density", 0, 1, 0.12, 1, "dial"),
    ("pitch", "Pitch", "Pitch", 0, 1, 0.5, 1, "dial"),
    ("size", "Size", "Size", 0, 1, 0.6, 1, "dial"),
    ("shape", "Shape", "Shape", 0, 1, 0.6, 1, "dial"),
    ("time_amt", "Time Spread", "T Spread", 0, 1, 0.75, 1, "dial"),
    ("pitch_amt", "Pitch Spread", "P Spread", 0, 1, 0.5, 1, "dial"),
    ("size_amt", "Size Spread", "S Spread", 0, 1, 0.5, 1, "dial"),
    ("shape_amt", "Shape Spread", "Sh Spread", 0, 1, 0.5, 1, "dial"),
    ("feedback", "Feedback", "Feedback", 0, 1, 0.1, 1, "dial"),
    ("drywet", "Dry/Wet", "Dry/Wet", 0, 1, 0.7, 1, "dial"),
    ("reverb", "Reverb", "Reverb", 0, 1, 0.35, 1, "dial"),
    ("freeze", "Freeze", "Freeze", 0, 1, 0, 0, "toggle"),
    ("seed", "Trigger", "Trigger", 0, 1, 0, 0, "toggle"),
    ("seedlatch", "Auto Grains", "AutoGrains", 0, 1, 1, 0, "toggle"),
    ("input", "Input Gain", "Input", -12, 32, 0, 4, "dial"),
    ("output", "Output Gain", "Output", -24, 12, 0, 4, "dial"),
    ("agc", "Input Auto Gain", "Auto Gain", 0, 1, 0, 0, "toggle"),
    ("quality", "Quality", "Quality", 0, 3, 0, 0, ("enum", ["Pristine", "Cold digital", "Sunny tape", "Scorched cassette"])),
]
SOURCES = ["none", "LFO 1", "LFO 2", "Random", "Env", "Clock", "Seq"]
DIVS = ["8 bars", "4 bars", "2 bars", "1 bar", "1/2", "1/4D", "1/2T", "1/4", "1/8D", "1/4T", "1/8", "1/8T", "1/16", "1/16T", "1/32"]
for d, lab in [("freeze", "Freeze"), ("seed", "Trigger"), ("time", "Time"), ("pitch", "Pitch"), ("size", "Size"), ("shape", "Shape"),
               ("density", "Density"), ("feedback", "Feedback"), ("reverb", "Reverb"), ("drywet", "Dry/Wet")]:
    PARAMS.append(("dst_" + d, "Mod Source " + lab, "Src " + lab, 0, 6, 0, 0, ("enum", SOURCES)))
PARAMS += [
    ("fb_amt", "Mod Depth Feedback", "Depth FB", 0, 1, 1, 1, "dial"),
    ("dw_amt", "Mod Depth Dry/Wet", "Depth DW", 0, 1, 1, 1, "dial"),
    ("rv_amt", "Mod Depth Reverb", "Depth Rev", 0, 1, 1, 1, "dial"),
    ("dn_amt", "Mod Depth Density", "Depth Dens", 0, 1, 0.5, 1, "dial"),
]
for i, (rate, shp) in enumerate([(0.4, 0), (0.25, 1)]):
    n = str(i + 1)
    PARAMS += [
        ("l%s_rate" % n, "LFO %s Rate" % n, "LFO%s Rate" % n, 0, 1, rate, 1, "dial"),
        ("l%s_sync" % n, "LFO %s Sync" % n, "LFO%s Sync" % n, 0, 1, 0, 0, "toggle"),
        ("l%s_shape" % n, "LFO %s Shape" % n, "LFO%s Shape" % n, 0, 3, shp, 0, ("enum", ["sine", "tri", "saw", "square"])),
        ("l%s_reset" % n, "LFO %s Reset" % n, "LFO%s R" % n, 0, 1, 0, 0, "toggle"),
        ("l%s_amt" % n, "LFO %s Amount" % n, "LFO%s Amt" % n, 0, 1, 1, 1, "dial"),
    ]
PARAMS += [
    ("rn_rate", "Random Rate", "Rnd Rate", 0, 1, 0.4, 1, "dial"),
    ("rn_sync", "Random Sync", "Rnd Sync", 0, 1, 0, 0, "toggle"),
    ("rn_smooth", "Random Smooth", "Rnd Smth", 0, 1, 1, 0, "toggle"),
    ("rn_amt", "Random Amount", "Rnd Amt", 0, 1, 1, 1, "dial"),
    ("env_gain", "Env Gain", "Env Gain", 0, 1, 0.5, 1, "dial"),
    ("ck_rate", "Clock Rate", "Clk Rate", 0, 1, 0.857, 1, "dial"),
    ("ck_sync", "Clock Sync", "Clk Sync", 0, 1, 1, 0, "toggle"),
    ("sq_div", "Seq Rate", "Seq Rate", 0, 14, 12, 0, ("enum", DIVS)),
    ("sq_len", "Seq Length", "Seq Len", 1, 16, 16, 0, "int"),
]
for i, v in enumerate([1, -1, -1, -1, 0.25, -1, -1, -1, 0.5, -1, 0.75, -1, 0.625, -1, -1, -1]):
    PARAMS.append(("sq%d" % i, "Seq Step %d" % (i + 1), "Step %d" % (i + 1), -1, 1, v, 1, "dial"))
ENGINE_NAME = {"input": "ingain", "output": "outgain"}

# NATIVE device: Live's own controls on the SOUND page (they follow Live's theme and show their info
# in Live's info view). Positions in the 900×169 device; js/flock_ui.js paintNative* draws around them.
KX = [204, 288, 372, 456, 540]
NATIVE_LAYOUT = {}
for _n, _x in zip(["time", "density", "pitch", "size", "shape"], KX):
    NATIVE_LAYOUT[_n] = ("dial", [_x - 28, 10, 56, 64], {"shownumber": 0})
for _n, _x in zip(["time", "pitch", "size", "shape"], [KX[0], KX[2], KX[3], KX[4]]):
    NATIVE_LAYOUT[_n + "_amt"] = ("dial", [_x - 22, 100, 44, 44], {"shownumber": 0})
for _n, _x in zip(["feedback", "drywet", "reverb"], [626, 692, 758]):
    NATIVE_LAYOUT[_n] = ("dial", [_x - 26, 10, 52, 56], {"shownumber": 0})
NATIVE_LAYOUT["input"] = ("dial", [808, 10, 42, 52], {"shownumber": 1})
NATIVE_LAYOUT["output"] = ("dial", [852, 10, 42, 52], {"shownumber": 1})
NATIVE_LAYOUT["freeze"] = ("text", [14, 68, 60, 24], {"text": "FREEZE", "texton": "FREEZE"})
NATIVE_LAYOUT["seedlatch"] = ("text", [14, 98, 126, 16], {"text": "LATCH OFF  (hold SEED)", "texton": "LATCH ON  (continuous)"})
NATIVE_LAYOUT["agc"] = ("text", [808, 66, 42, 13], {"text": "AUTO", "texton": "AUTO"})
NATIVE_LAYOUT["quality"] = ("tab", [598, 88, 290, 13], {})
NATIVE = False   # set by --native


class Patcher:
    def __init__(self):
        self.boxes, self.lines, self.n = [], [], 0

    def add(self, box):
        self.n += 1
        box["id"] = "obj-%d" % self.n
        box.setdefault("patching_rect", [20, 20 * self.n, 120, 22])
        self.boxes.append({"box": box})
        return box["id"]

    def obj(self, text, ni, no, ot=None, x=20, y=20, w=None, **kw):
        b = {"maxclass": "newobj", "text": text, "numinlets": ni, "numoutlets": no,
             "outlettype": ot if ot is not None else [""] * no, "patching_rect": [x, y, w or max(40, 7 * len(text) + 14), 22]}
        b.update(kw)
        return self.add(b)

    def connect(self, s, so, d, di):
        self.lines.append({"patchline": {"source": [s, so], "destination": [d, di]}})


def gen_box(P, x, y):
    n_in = max(int(m) for m in re.findall(r"\bin(\d+)\b", CODE))
    n_out = max(int(m) for m in re.findall(r"\bout(\d+)\b", CODE))
    g = Patcher()
    ins = [g.obj("in %d" % (i + 1), 0, 1, [""], x=20 + 60 * i, y=20) for i in range(n_in)]
    cb = g.add({"maxclass": "codebox", "code": EMBED(CODE), "numinlets": n_in, "numoutlets": n_out,
                "outlettype": [""] * n_out, "fontface": 0, "fontname": "<Monospaced>", "fontsize": 12.0,
                "patching_rect": [20, 60, 700, 600]})
    outs = [g.obj("out %d" % (i + 1), 1, 0, [], x=20 + 60 * i, y=680) for i in range(n_out)]
    for i, b in enumerate(ins):
        g.connect(b, 0, cb, i)
    for i, b in enumerate(outs):
        g.connect(cb, i, b, 0)
    sub = {"fileversion": 1, "appversion": {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1},
           "classnamespace": "dsp.gen", "rect": [80, 80, 760, 760], "boxes": g.boxes, "lines": g.lines}
    return P.obj("gen~", n_in, n_out, [SIG] * n_out, x=x, y=y, w=200, patcher=sub), n_in, n_out


def param_box(P, spec, x, y):
    name, long, short, lo, hi, d, unit, kind = spec
    va = {"parameter_longname": long, "parameter_shortname": short, "parameter_mmin": lo, "parameter_mmax": hi,
          "parameter_initial": [d], "parameter_initial_enable": 1}
    if kind == "toggle":
        va.update({"parameter_type": 2, "parameter_enum": ["off", "on"]})
        b = {"maxclass": "live.toggle", "numinlets": 1, "numoutlets": 1, "outlettype": [""]}
    elif isinstance(kind, tuple):          # enum (menu items) on a live.dial
        va.update({"parameter_type": 2, "parameter_enum": kind[1]})
        b = {"maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["", "float"]}
    elif kind == "int":
        va.update({"parameter_type": 1, "parameter_unitstyle": 0})
        b = {"maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["", "float"]}
    else:
        va.update({"parameter_type": 0, "parameter_unitstyle": unit})
        b = {"maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["", "float"]}
    b.update({"varname": name, "parameter_enable": 1, "patching_rect": [x, y, 44, 48],
              "saved_attribute_attributes": {"valueof": va}})
    if NATIVE and name in NATIVE_LAYOUT:
        kind_n, rect, extra = NATIVE_LAYOUT[name]
        if kind_n == "text":
            b.update({"maxclass": "live.text", "numinlets": 1, "numoutlets": 2, "outlettype": ["", ""], "mode": 1})
        elif kind_n == "tab":
            b.update({"maxclass": "live.tab", "numinlets": 1, "numoutlets": 3, "outlettype": ["", "", "float"],
                      "num_lines_patching": 1, "num_lines_presentation": 1})
        else:
            b.update({"showname": 1})
        b.update(extra)
        b.update({"presentation": 1, "presentation_rect": rect, "patching_rect": [x, y, rect[2], rect[3]]})
    return P.add(b)


def native_tape(P, gen, lb, dsp):
    """Native device: the tape as Max's own waveform~ of a buffer~ that mirrors the recording
    (gen~ out12 = value written now, out13 = its index), with the record head as a selection."""
    TAPE = "---flock_tape"   # --- = unique per device instance in Max for Live
    buf = P.obj("buffer~ " + TAPE, 1, 2, ["float", "bang"], x=1300, y=600, w=160)
    size = P.add({"maxclass": "message", "text": "sizeinsamps 384004", "numinlets": 2, "numoutlets": 1, "outlettype": [""],
                  "patching_rect": [1300, 570, 120, 22]})
    P.connect(lb, 0, size, 0); P.connect(size, 0, buf, 0)
    pk = P.obj("poke~ " + TAPE, 3, 0, [], x=1300, y=640, w=160)
    P.connect(gen, 11, pk, 0); P.connect(gen, 12, pk, 1)
    wf = P.add({"maxclass": "waveform~", "numinlets": 5, "numoutlets": 6, "outlettype": ["float", "float", "float", "float", "list", ""],
                "buffername": TAPE, "presentation": 1, "presentation_rect": [598, 118, 290, 30], "patching_rect": [1300, 700, 290, 60],
                "bgcolor": [0.09, 0.09, 0.09, 1.0], "waveformcolor": [0.36, 0.82, 0.84, 1.0],
                "selectioncolor": [0.95, 0.50, 0.66, 0.9], "bordercolor": [0.30, 0.30, 0.30, 1.0], "varname": "tape_wave"})
    # length of the used part: MAXD of the quality / host rate (ms)
    qbox = next(b["box"]["id"] for b in P.boxes if b["box"].get("varname") == "quality")
    pakq = P.obj("pak 0 48000.", 2, 1, x=1300, y=780, w=90)
    P.connect(qbox, 0, pakq, 0); P.connect(dsp, 1, pakq, 1)
    ln = P.obj("expr (($i1==0)*192000.+($i1==1||$i1==2)*256000.+($i1==3)*384000.)/$f2*1000.", 2, 1, ["float"], x=1300, y=810, w=420)
    P.connect(pakq, 0, ln, 0)
    fl = P.obj("f", 2, 1, ["float"], x=1300, y=840)
    P.connect(ln, 0, fl, 1); P.connect(ln, 0, wf, 1)
    zero = P.add({"maxclass": "message", "text": "0", "numinlets": 2, "numoutlets": 1, "outlettype": [""], "patching_rect": [1400, 840, 30, 22]})
    P.connect(lb, 0, zero, 0); P.connect(zero, 0, wf, 0)
    # redraw: re-set the buffer every 150 ms, then the length again
    met = P.obj("metro 150", 2, 1, ["bang"], x=1500, y=570)
    P.connect(lb, 0, met, 0)
    tb = P.obj("t b b", 1, 2, ["bang", "bang"], x=1500, y=600)
    P.connect(met, 0, tb, 0)
    setm = P.add({"maxclass": "message", "text": "set " + TAPE, "numinlets": 2, "numoutlets": 1, "outlettype": [""],
                  "patching_rect": [1560, 630, 140, 22]})
    P.connect(tb, 1, setm, 0); P.connect(setm, 0, wf, 0)
    P.connect(tb, 0, fl, 0); P.connect(fl, 0, wf, 1)
    # record head: gen~ out5 (0..1 of the used part) → a narrow selection
    sh = P.obj("snapshot~ 50", 2, 1, ["float"], x=1500, y=700)
    P.connect(gen, 4, sh, 0)
    pakh = P.obj("pak 0. 1000.", 2, 1, x=1500, y=730, w=90)
    P.connect(sh, 0, pakh, 0); P.connect(ln, 0, pakh, 1)
    hm = P.obj("expr $f1*$f2", 1, 1, ["float"], x=1500, y=760)
    P.connect(pakh, 0, hm, 0)
    th = P.obj("t f f", 1, 2, ["float", "float"], x=1500, y=790)
    P.connect(hm, 0, th, 0)
    plus = P.obj("+ 25.", 2, 1, ["float"], x=1560, y=820)
    P.connect(th, 1, plus, 0); P.connect(plus, 0, wf, 3)
    P.connect(th, 0, wf, 2)


def build():
    P = Patcher()
    P.add({"maxclass": "comment", "text": "FLØCK — granular texture (port of the open Beads DSP, MIT). GENERATED by tools/build_device.py.",
           "numinlets": 1, "numoutlets": 0, "patching_rect": [20, 4, 700, 20]})
    pin = P.obj("plugin~", 1, 2, [SIG, SIG], x=20, y=40)
    gen, n_in, n_out = gen_box(P, 20, 900)
    # tempo: bar phase locked to Live's transport → gen~ in7 (stops when Live stops)
    bar = P.obj("phasor~ 1n @lock 1", 2, 1, [SIG], x=240, y=860, w=140)
    P.connect(bar, 0, gen, 6)
    pout = P.obj("plugout~", 2, 0, [], x=20, y=1000)
    P.connect(pin, 0, gen, 0); P.connect(pin, 1, gen, 1)
    P.connect(gen, 0, pout, 0); P.connect(gen, 1, pout, 1)
    ui = P.add({"maxclass": "jsui", "filename": JSNAME, "numinlets": 1, "numoutlets": 1, "outlettype": [""],
                "parameter_enable": 0, "border": 0, "patching_rect": [400, 600, W, H],
                "presentation": 1, "presentation_rect": [0, 0, W, H], "varname": "flock_ui",
                # native device: the panel sits on the background layer, Live's objects are drawn above it
                "background": 1 if NATIVE else 0})
    lb = P.obj("loadbang", 1, 1, ["bang"], x=900, y=40)
    if NATIVE:
        # tell the panel it is the native device; it hides / shows Live's objects through thispatcher
        nmsg = P.add({"maxclass": "message", "text": "native 1", "numinlets": 2, "numoutlets": 1, "outlettype": [""],
                      "patching_rect": [1000, 40, 60, 22]})
        P.connect(lb, 0, nmsg, 0); P.connect(nmsg, 0, ui, 0)
    names = [p[0] for p in PARAMS]
    rt = P.obj("route " + " ".join(names), 2, len(names) + 1, x=400, y=80, w=700)
    P.connect(ui, 0, rt, 0)
    # messages that are not Live parameters (LEARN = restart the auto gain) go straight to gen~
    rt2 = P.obj("route agc_restart ktrig knote kon", 5, 5, x=1200, y=110, w=240)
    P.connect(rt, len(names), rt2, 0)
    for k, nm in enumerate(["agc_restart", "ktrig", "knote", "kon"]):
        pp = P.obj("prepend " + nm, 1, 1, x=1200 + 110 * k, y=140, w=100)
        P.connect(rt2, k, pp, 0); P.connect(pp, 0, gen, 0)
    # MIDI keys from the FLØCK Keys device (a MIDI effect on any MIDI track): "note <pitch> <velocity>"
    rk = P.obj("receive flock_keys", 0, 1, x=1200, y=200, w=120)
    P.connect(rk, 0, ui, 0)
    if NATIVE:
        tp = P.obj("thispatcher", 1, 2, ["", ""], x=1200, y=170, w=90)
        P.connect(rt2, 4, tp, 0)   # "script sendbox <name> hidden 0/1" from the panel
    for i, spec in enumerate(PARAMS):
        name = spec[0]
        x = 20 + (i % 13) * 100
        y = 140 + (i // 13) * 140
        d = param_box(P, spec, x, y)
        P.connect(rt, i, d, 0)
        P.connect(lb, 0, d, 0)
        to_ui = P.obj("prepend p " + name, 1, 1, x=x, y=y + 56, w=90)
        P.connect(d, 0, to_ui, 0); P.connect(to_ui, 0, ui, 0)
        eng = ENGINE_NAME.get(name, name)
        src = d
        if spec[6] == 4:  # dB → amplitude
            src = P.obj("dbtoa", 1, 1, ["float"], x=x, y=y + 80)
            P.connect(d, 0, src, 0)
        to_gen = P.obj("prepend " + eng, 1, 1, x=x, y=y + 104, w=90)
        P.connect(src, 0, to_gen, 0); P.connect(to_gen, 0, gen, 0)
    # display: tape (write head, active grains) at 25 Hz; each grain start (position, speed)
    s_act = P.obj("snapshot~ 40", 2, 1, ["float"], x=300, y=480)
    s_wp = P.obj("snapshot~ 40", 2, 1, ["float"], x=400, y=480)
    P.connect(gen, 3, s_act, 0); P.connect(gen, 4, s_wp, 0)
    pk = P.obj("pack 0. 0.", 2, 1, x=360, y=510)
    P.connect(s_wp, 0, pk, 0); P.connect(s_act, 0, pk, 1)
    ptape = P.obj("prepend tape", 1, 1, x=360, y=540)
    P.connect(pk, 0, ptape, 0); P.connect(ptape, 0, ui, 0)
    edge = P.obj("edge~", 1, 2, ["bang", "bang"], x=520, y=480)
    P.connect(gen, 2, edge, 0)
    tb = P.obj("t b b", 1, 2, ["bang", "bang"], x=520, y=510)
    P.connect(edge, 0, tb, 0)
    s_pos = P.obj("snapshot~", 2, 1, ["float"], x=520, y=540)
    s_spd = P.obj("snapshot~", 2, 1, ["float"], x=620, y=540)
    P.connect(gen, 5, s_pos, 0); P.connect(gen, 6, s_spd, 0)
    P.connect(tb, 0, s_pos, 0); P.connect(tb, 1, s_spd, 0)
    pg = P.obj("pack 0. 0.", 2, 1, x=560, y=570)
    P.connect(s_pos, 0, pg, 0); P.connect(s_spd, 0, pg, 1)
    pgr = P.obj("prepend grain", 1, 1, x=560, y=600)
    P.connect(pg, 0, pgr, 0); P.connect(pgr, 0, ui, 0)
    dsp = P.obj("dspstate~", 1, 4, ["int", "float", "int", "int"], x=900, y=80)
    P.connect(lb, 0, dsp, 0)
    psr = P.obj("prepend sr", 1, 1, x=900, y=110)
    P.connect(dsp, 1, psr, 0); P.connect(psr, 0, ui, 0)
    # input gain (auto) + learning flag → panel
    s_g = P.obj("snapshot~ 100", 2, 1, ["float"], x=900, y=980)
    s_l = P.obj("snapshot~ 100", 2, 1, ["float"], x=1000, y=980)
    P.connect(gen, 9, s_g, 0); P.connect(gen, 10, s_l, 0)
    pag = P.obj("pack 0. 0", 2, 1, x=940, y=1010)
    P.connect(s_g, 0, pag, 0); P.connect(s_l, 0, pag, 1)
    pagi = P.obj("prepend agcinfo", 1, 1, x=940, y=1040)
    P.connect(pag, 0, pagi, 0); P.connect(pagi, 0, ui, 0)
    # output level meter (peaks every 50 ms) and how much of the buffer is recorded → panel
    pkl = P.obj("peakamp~ 50", 2, 1, ["float"], x=1100, y=980)
    pkr = P.obj("peakamp~ 50", 2, 1, ["float"], x=1200, y=980)
    P.connect(gen, 0, pkl, 0); P.connect(gen, 1, pkr, 0)
    plv = P.obj("pack 0. 0.", 2, 1, x=1140, y=1010)
    P.connect(pkl, 0, plv, 0); P.connect(pkr, 0, plv, 1)
    plev = P.obj("prepend level", 1, 1, x=1140, y=1040)
    P.connect(plv, 0, plev, 0); P.connect(plev, 0, ui, 0)
    sfill = P.obj("snapshot~ 100", 2, 1, ["float"], x=1300, y=980)
    P.connect(gen, 11, sfill, 0)
    pfill = P.obj("prepend fill", 1, 1, x=1300, y=1010)
    P.connect(sfill, 0, pfill, 0); P.connect(pfill, 0, ui, 0)
    # sequencer position + transport state → panel (MOD tab)
    s_sq = P.obj("snapshot~ 40", 2, 1, ["float"], x=700, y=980)
    s_run = P.obj("snapshot~ 40", 2, 1, ["float"], x=800, y=980)
    P.connect(gen, 7, s_sq, 0); P.connect(gen, 8, s_run, 0)
    psq = P.obj("pack 0 0", 2, 1, x=740, y=1010)
    P.connect(s_sq, 0, psq, 0); P.connect(s_run, 0, psq, 1)
    pseq = P.obj("prepend seq", 1, 1, x=740, y=1040)
    P.connect(psq, 0, pseq, 0); P.connect(pseq, 0, ui, 0)
    if NATIVE:
        native_tape(P, gen, lb, dsp)
    patcher = {"fileversion": 1, "appversion": {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1},
               "classnamespace": "box", "rect": [40, 40, 1400, 900], "openinpresentation": 1,
               "devicewidth": float(W), "boxes": P.boxes, "lines": P.lines}
    os.makedirs(MAXDIR, exist_ok=True)
    path = os.path.join(MAXDIR, "flock_main.maxpat")
    json.dump({"patcher": patcher}, open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return path, patcher


def amxd_bytes(patcher_json, device_type=b"aaaa"):
    payload = json.dumps(patcher_json, indent=1, ensure_ascii=False).encode("utf-8") + b"\n\x00"
    return (b"ampf" + struct.pack("<I", 4) + device_type + b"meta" + struct.pack("<I", 4) + b"\x00\x00\x00\x00" +
            b"ptch" + struct.pack("<I", len(payload)) + payload)


def keys_device():
    """FLØCK Keys: a tiny MIDI effect. Put it on any MIDI track: its notes play FLØCK (every FLØCK in the
    set listens) — a held key fires grains like TRIGGER, the note transposes from C3. MIDI passes through."""
    P = Patcher()
    mi = P.obj("midiin", 1, 1, ["int"], x=20, y=20)
    mp = P.obj("midiparse", 1, 8, ["", "", "", "int", "int", "", "int", ""], x=20, y=60)
    P.connect(mi, 0, mp, 0)
    pn = P.obj("prepend note", 1, 1, x=20, y=100)
    P.connect(mp, 0, pn, 0)
    sn = P.obj("send flock_keys", 1, 0, [], x=20, y=140, w=110)
    P.connect(pn, 0, sn, 0)
    mo = P.obj("midiout", 1, 0, [], x=200, y=60)
    P.connect(mi, 0, mo, 0)
    P.add({"maxclass": "comment", "text": "FLØCK KEYS", "numinlets": 1, "numoutlets": 0, "fontsize": 14.0, "fontface": 1,
           "patching_rect": [200, 120, 120, 22], "presentation": 1, "presentation_rect": [8, 10, 124, 22]})
    P.add({"maxclass": "comment", "text": "notes from this track play FLØCK: hold a key = grains, pitch from C3", "numinlets": 1, "numoutlets": 0,
           "fontsize": 10.0, "linecount": 4, "patching_rect": [200, 150, 120, 60], "presentation": 1, "presentation_rect": [8, 36, 124, 64]})
    return {"patcher": {"fileversion": 1, "appversion": {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1},
                        "classnamespace": "box", "rect": [40, 40, 600, 400], "openinpresentation": 1, "devicewidth": 140.0,
                        "boxes": P.boxes, "lines": P.lines, "autosave": 0}}


def _param_table(p):
    params = {}
    for b in p["boxes"]:
        box = b["box"]
        if box.get("parameter_enable"):
            va = box["saved_attribute_attributes"]["valueof"]
            params[box["id"]] = [va["parameter_longname"], va["parameter_shortname"], 0]
    params["inherited_shortname"] = 1
    return params


def package(path):
    pj = json.load(open(path, encoding="utf-8"))
    p = pj["patcher"]
    params = {}
    for b in p["boxes"]:
        box = b["box"]
        if box.get("parameter_enable"):
            va = box["saved_attribute_attributes"]["valueof"]
            params[box["id"]] = [va["parameter_longname"], va["parameter_shortname"], 0]
    params["inherited_shortname"] = 1
    p["parameters"] = params
    p["dependency_cache"] = [{"name": JSNAME, "type": "TEXT", "implicit": 1}]
    p["autosave"] = 0
    if os.path.exists(PKG):
        shutil.rmtree(PKG)
    os.makedirs(PKG)
    with open(os.path.join(PKG, AMXDNAME), "wb") as f:
        f.write(amxd_bytes(pj))
    # (the native variant — Live's own controls — is built only on request: python3 tools/build_device.py --native)
    with open(os.path.join(PKG, "FLOCK_Keys_%s.amxd" % VERSION.replace(".", "_")), "wb") as f:
        f.write(amxd_bytes(keys_device(), device_type=b"mmmm"))
    shutil.copy(os.path.join(ROOT, "js", "flock_ui.js"), os.path.join(PKG, JSNAME))
    shutil.copy(os.path.join(ROOT, "dist_README.txt"), os.path.join(PKG, "README_FIRST.txt"))
    shutil.copy(os.path.join(ROOT, "LICENSE-BEADS.txt"), os.path.join(PKG, "LICENSE-BEADS.txt"))
    zpath = os.path.join(DIST, "FLOCK_v%s_test_build.zip" % VERSION)
    for old in os.listdir(DIST):
        if old.endswith(".zip"):
            os.remove(os.path.join(DIST, old))
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(PKG)):
            z.write(os.path.join(PKG, f), "FLOCK/" + f)
    return zpath


def validate(p):
    errs = []
    boxes = {b["box"]["id"]: b["box"] for b in p["boxes"]}
    for l in p["lines"]:
        (s, so), (d, di) = l["patchline"]["source"], l["patchline"]["destination"]
        if s not in boxes or d not in boxes:
            errs.append("missing box")
            continue
        if not 0 <= so < boxes[s]["numoutlets"]:
            errs.append("outlet %d of %s" % (so, boxes[s].get("text", boxes[s]["maxclass"])))
        if not 0 <= di < boxes[d]["numinlets"]:
            errs.append("inlet %d of %s" % (di, boxes[d].get("text", boxes[d]["maxclass"])))
    for b in boxes.values():
        if b.get("presentation") and (b["presentation_rect"][3] > 169 or b["presentation_rect"][2] > W):
            errs.append("presentation too large")
        if b.get("patcher"):
            errs += validate(b["patcher"])
    return errs


if __name__ == "__main__":
    if "--native" in sys.argv:
        NATIVE = True
    path, patcher = build()
    errs = validate(patcher)
    if errs:
        print("\n".join(errs))
        sys.exit(1)
    print("STATIC VALID:", os.path.relpath(path, ROOT), "· MAX LOAD / LIVE LOAD: NOT TESTED")
    if "--dist" in sys.argv:
        print(os.path.relpath(package(path), ROOT))
