#!/usr/bin/env python3
"""Builds the FLØCK Max for Live AUDIO EFFECT from sources.

  gen/flock.genexpr  → embedded in a [gen~] codebox (no external .gendsp needed)
  js/flock_ui.js     → the panel ([jsui], copied next to the device)
Writes max/flock_main.maxpat and dist/FLOCK/FLØCK.amxd (+ zip).

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
CODE = open(os.path.join(ROOT, "gen", "flock.genexpr"), encoding="utf-8").read()
W, H = 900, 169
SIG = "signal"

# (engine Param, Live long name, short, min, max, default, unitstyle, kind)
#  unitstyle: 1 float, 4 dB ; kind: dial / toggle ; engine None = handled specially
PARAMS = [
    ("time", "Time", "Time", 0, 1, 0.5, 1, "dial"),
    ("density", "Density", "Density", 0, 1, 0.3, 1, "dial"),
    ("pitch", "Pitch", "Pitch", 0, 1, 0.5, 1, "dial"),
    ("size", "Size", "Size", 0, 1, 0.45, 1, "dial"),
    ("shape", "Shape", "Shape", 0, 1, 0.5, 1, "dial"),
    ("time_amt", "Time Random", "T Rnd", 0, 1, 0.5, 1, "dial"),
    ("pitch_amt", "Pitch Random", "P Rnd", 0, 1, 0.5, 1, "dial"),
    ("size_amt", "Size Random", "S Rnd", 0, 1, 0.5, 1, "dial"),
    ("shape_amt", "Shape Random", "Sh Rnd", 0, 1, 0.5, 1, "dial"),
    ("feedback", "Feedback", "Feedback", 0, 1, 0.0, 1, "dial"),
    ("drywet", "Dry/Wet", "Dry/Wet", 0, 1, 0.5, 1, "dial"),
    ("reverb", "Reverb", "Reverb", 0, 1, 0.2, 1, "dial"),
    ("freeze", "Freeze", "Freeze", 0, 1, 0, 0, "toggle"),
    ("seed", "Seed", "Seed", 0, 1, 0, 0, "toggle"),
    ("seedlatch", "Latch", "Latch", 0, 1, 1, 0, "toggle"),
    ("input", "Input Gain", "Input", -12, 32, 0, 4, "dial"),
    ("output", "Output Gain", "Output", -24, 12, 0, 4, "dial"),
]
ENGINE_NAME = {"input": "ingain", "output": "outgain"}


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
    cb = g.add({"maxclass": "codebox", "code": CODE, "numinlets": n_in, "numoutlets": n_out,
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
    else:
        va.update({"parameter_type": 0, "parameter_unitstyle": unit})
        b = {"maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["", "float"]}
    b.update({"varname": name, "parameter_enable": 1, "patching_rect": [x, y, 44, 48],
              "saved_attribute_attributes": {"valueof": va}})
    return P.add(b)


def build():
    P = Patcher()
    P.add({"maxclass": "comment", "text": "FLØCK — granular texture (port of the open Beads DSP, MIT). GENERATED by tools/build_device.py.",
           "numinlets": 1, "numoutlets": 0, "patching_rect": [20, 4, 700, 20]})
    pin = P.obj("plugin~", 1, 2, [SIG, SIG], x=20, y=40)
    gen, n_in, n_out = gen_box(P, 20, 420)
    pout = P.obj("plugout~", 2, 0, [], x=20, y=520)
    P.connect(pin, 0, gen, 0); P.connect(pin, 1, gen, 1)
    P.connect(gen, 0, pout, 0); P.connect(gen, 1, pout, 1)
    ui = P.add({"maxclass": "jsui", "filename": "flock_ui.js", "numinlets": 1, "numoutlets": 1, "outlettype": [""],
                "parameter_enable": 0, "border": 0, "patching_rect": [400, 600, W, H],
                "presentation": 1, "presentation_rect": [0, 0, W, H], "varname": "flock_ui"})
    lb = P.obj("loadbang", 1, 1, ["bang"], x=900, y=40)
    names = [p[0] for p in PARAMS]
    rt = P.obj("route " + " ".join(names), 2, len(names) + 1, x=400, y=80, w=700)
    P.connect(ui, 0, rt, 0)
    for i, spec in enumerate(PARAMS):
        name = spec[0]
        x = 20 + (i % 9) * 100
        y = 140 + (i // 9) * 130
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
    p["dependency_cache"] = [{"name": "flock_ui.js", "type": "TEXT", "implicit": 1}]
    p["autosave"] = 0
    if os.path.exists(PKG):
        shutil.rmtree(PKG)
    os.makedirs(PKG)
    with open(os.path.join(PKG, "FLØCK.amxd"), "wb") as f:
        f.write(amxd_bytes(pj))
    shutil.copy(os.path.join(ROOT, "js", "flock_ui.js"), os.path.join(PKG, "flock_ui.js"))
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
    path, patcher = build()
    errs = validate(patcher)
    if errs:
        print("\n".join(errs))
        sys.exit(1)
    print("STATIC VALID:", os.path.relpath(path, ROOT), "· MAX LOAD / LIVE LOAD: NOT TESTED")
    if "--dist" in sys.argv:
        print(os.path.relpath(package(path), ROOT))
