#!/usr/bin/env python3
"""Builds the STØMP Max for Live INSTRUMENT (put it on a MIDI track; the notes play the kick).

  gen/stomp.genexpr → embedded in a [gen~] codebox
  js/stomp_ui.js    → the panel ([jsui], copied next to the device under a versioned name)
Writes max/stomp_main.maxpat and dist/STOMP/STOMP_<version>.amxd (+ zip).

The patch structure is the one FLØCK proved in Live: one gen~ codebox, Params set by messages,
every knob a hidden live.dial, the panel a jsui. HONEST STATUS: the .amxd is written by this script
(container 'ampf', type 'iiii' = instrument), not saved by Max, not frozen.
"""
import json
import os
import re
import shutil
import struct
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import KNOBS, SOURCES, SWITCHES, DEPTH_DEFAULTS, depth_names  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXDIR = os.path.join(ROOT, "max")
DIST = os.path.join(ROOT, "dist")
PKG = os.path.join(DIST, "STOMP")
VERSION = json.load(open(os.path.join(ROOT, "package.json")))["version"]
VU = VERSION.replace(".", "_")
JSNAME = "stomp_ui_%s.js" % VU          # versioned: Max finds files by name
AMXDNAME = "STOMP_%s.amxd" % VU          # ASCII only (FLØCK: the Ø in a file name kept a device silent)
CODE = open(os.path.join(ROOT, "gen", "stomp.genexpr"), encoding="utf-8").read()
# the panel computes its own width from its columns (js/stomp_ui.js W0): ask it
import subprocess  # noqa: E402
W = int(subprocess.check_output(["node", "-e", "process.stdout.write(String(require('./tools/preview').boot().ctx.W0))"], cwd=ROOT))
H = 169
SIG = "signal"


def embed_code(code):
    """Codebox text: no // comments, no blank lines, ASCII only."""
    out = []
    for line in code.split("\n"):
        line = re.sub(r"//.*$", "", line).rstrip()
        if line.strip():
            out.append(line)
    text = "\n".join(out) + "\n"
    bad = sorted(set(c for c in text if ord(c) > 127))
    if bad:
        raise SystemExit("non-ASCII outside comments in the engine: " + "".join(bad))
    return text


def short(s):
    return s[:12]


# (engine Param = Live name of the control, Live long name, short name, min, max, default, toggle?)
PARAMS = [(n, ln, short(ln), 0, 1, d, False) for n, _s, _l, ln, d in KNOBS]
PARAMS += [(n, ln, short(ln), 0, 1, d, True) for n, _s, _l, ln, d in SWITCHES]
PARAMS += [(n, ln, short(ln), 0, 1, d, False) for n, _l, ln, d, _pre in SOURCES]
LONG = {n: ln for n, _s, _l, ln, _d in KNOBS}
SRCNAME = {"v_": "Vel", "k_": "Note", "r_": "Rnd"}
for dn in depth_names():
    src = SRCNAME[dn[:2]]
    PARAMS.append((dn, "%s > %s" % (src, LONG[dn[2:]]), short("%s>%s" % (src[0], LONG[dn[2:]])), -1, 1, DEPTH_DEFAULTS.get(dn, 0), False))


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

    def msg(self, text, x, y):
        return self.add({"maxclass": "message", "text": text, "numinlets": 2, "numoutlets": 1, "outlettype": [""],
                         "patching_rect": [x, y, max(40, 7 * len(text) + 14), 22]})

    def connect(self, s, so, d, di):
        self.lines.append({"patchline": {"source": [s, so], "destination": [d, di]}})


APPV = {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1}


def gen_box(P, x, y):
    n_in = max([1] + [int(m) for m in re.findall(r"\bin(\d+)\b", CODE)])
    n_out = max(int(m) for m in re.findall(r"\bout(\d+)\b", CODE))
    g = Patcher()
    ins = [g.obj("in %d" % (i + 1), 0, 1, [""], x=20 + 60 * i, y=20) for i in range(n_in)]
    cb = g.add({"maxclass": "codebox", "code": embed_code(CODE), "numinlets": n_in, "numoutlets": n_out,
                "outlettype": [""] * n_out, "fontface": 0, "fontname": "<Monospaced>", "fontsize": 12.0,
                "patching_rect": [20, 60, 700, 600]})
    outs = [g.obj("out %d" % (i + 1), 1, 0, [], x=20 + 60 * i, y=680) for i in range(n_out)]
    for i, b in enumerate(ins):
        g.connect(b, 0, cb, i)
    for i, b in enumerate(outs):
        g.connect(cb, i, b, 0)
    sub = {"fileversion": 1, "appversion": APPV, "classnamespace": "dsp.gen", "rect": [80, 80, 760, 760],
           "boxes": g.boxes, "lines": g.lines}
    return P.obj("gen~", n_in, n_out, [SIG] * n_out, x=x, y=y, w=200, patcher=sub), n_in, n_out


def param_box(P, spec, x, y):
    name, long, sh, lo, hi, d, toggle = spec
    va = {"parameter_longname": long, "parameter_shortname": sh, "parameter_mmin": lo, "parameter_mmax": hi,
          "parameter_initial": [d], "parameter_initial_enable": 1, "parameter_type": 0, "parameter_unitstyle": 1}
    if toggle:
        va.update({"parameter_type": 2, "parameter_enum": ["off", "on"]})
        b = {"maxclass": "live.toggle", "numinlets": 1, "numoutlets": 1, "outlettype": [""]}
    else:
        b = {"maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["", "float"]}
    b.update({"varname": name, "parameter_enable": 1, "patching_rect": [x, y, 44, 48], "saved_attribute_attributes": {"valueof": va}})
    return P.add(b)


def build():
    P = Patcher()
    P.add({"maxclass": "comment", "text": "STØMP — kick drum synthesizer. GENERATED by tools/build_device.py.",
           "numinlets": 1, "numoutlets": 0, "patching_rect": [20, 4, 700, 20]})
    gen, n_in, n_out = gen_box(P, 20, 900)
    pout = P.obj("plugout~", 2, 0, [], x=20, y=1000)
    P.connect(gen, 0, pout, 0)
    P.connect(gen, 1, pout, 1)
    ui = P.add({"maxclass": "jsui", "filename": JSNAME, "numinlets": 1, "numoutlets": 1, "outlettype": [""],
                "parameter_enable": 0, "border": 0, "patching_rect": [400, 600, W, H],
                "presentation": 1, "presentation_rect": [0, 0, W, H], "varname": "stomp_ui"})
    lb = P.obj("loadbang", 1, 1, ["bang"], x=900, y=40)

    # ---- hits: every new value of ktrig is a hit. [i] x [+ 1] counts 1, 2, 3 ... ----
    cnt = P.obj("i", 2, 1, ["int"], x=1200, y=300)
    inc = P.obj("+ 1", 2, 1, ["int"], x=1200, y=330)
    P.connect(cnt, 0, inc, 0)
    P.connect(inc, 0, cnt, 1)
    pk = P.obj("prepend ktrig", 1, 1, x=1200, y=360, w=100)
    P.connect(inc, 0, pk, 0)
    P.connect(pk, 0, gen, 0)
    phn = P.obj("prepend hitno", 1, 1, x=1310, y=360, w=100)   # the panel computes the same per-hit random values
    P.connect(inc, 0, phn, 0)
    P.connect(phn, 0, ui, 0)

    # ---- MIDI from the track: note-ons only (a kick is one-shot); velocity, then pitch, then the hit ----
    mi = P.obj("midiin", 1, 1, ["int"], x=1200, y=40)
    mp = P.obj("midiparse", 1, 8, ["", "", "", "int", "int", "", "int", ""], x=1200, y=70)
    P.connect(mi, 0, mp, 0)
    sn = P.obj("stripnote", 2, 2, ["int", "int"], x=1200, y=110)
    P.connect(mp, 0, sn, 0)
    vdiv = P.obj("/ 127.", 2, 1, ["float"], x=1300, y=140)
    P.connect(sn, 1, vdiv, 0)
    pv = P.obj("prepend kvel", 1, 1, x=1300, y=170, w=90)
    P.connect(vdiv, 0, pv, 0)
    P.connect(pv, 0, gen, 0)
    tbi = P.obj("t b i", 1, 2, ["bang", "int"], x=1200, y=140)
    P.connect(sn, 0, tbi, 0)
    pn = P.obj("prepend knote", 1, 1, x=1200, y=200, w=100)
    P.connect(tbi, 1, pn, 0)
    P.connect(pn, 0, gen, 0)
    P.connect(tbi, 0, cnt, 0)
    pnu = P.obj("prepend note", 1, 1, x=1420, y=110, w=90)     # display on the panel
    P.connect(mp, 0, pnu, 0)
    P.connect(pnu, 0, ui, 0)

    # ---- panel → parameters; the rest (PLAY pad) straight to gen~ ----
    names = [p[0] for p in PARAMS]
    rt = P.obj("route " + " ".join(names), 2, len(names) + 1, x=400, y=80, w=700)
    P.connect(ui, 0, rt, 0)
    rt2 = P.obj("route knote kvel hit slotdata", 5, 5, x=1200, y=240, w=200)
    P.connect(rt, len(names), rt2, 0)
    pn2 = P.obj("prepend knote", 1, 1, x=1360, y=270, w=100)
    pv2 = P.obj("prepend kvel", 1, 1, x=1470, y=270, w=90)
    P.connect(rt2, 0, pn2, 0); P.connect(pn2, 0, gen, 0)
    P.connect(rt2, 1, pv2, 0); P.connect(pv2, 0, gen, 0)
    P.connect(rt2, 2, cnt, 0)
    for i, spec in enumerate(PARAMS):
        name = spec[0]
        x = 20 + (i % 14) * 100
        y = 140 + (i // 14) * 120
        d = param_box(P, spec, x, y)
        P.connect(rt, i, d, 0)
        P.connect(lb, 0, d, 0)
        to_ui = P.obj("prepend p " + name, 1, 1, x=x, y=y + 56, w=90)
        P.connect(d, 0, to_ui, 0); P.connect(to_ui, 0, ui, 0)
        to_gen = P.obj("prepend " + name, 1, 1, x=x, y=y + 82, w=90)
        P.connect(d, 0, to_gen, 0); P.connect(to_gen, 0, gen, 0)

    # ---- USER SLOTS: kept by a [pattr] that is a Live parameter of type blob ("stored only"): saved with the
    # Live set and in device presets. The panel sends "slotdata <s>", the pattr stores and returns "slots <s>".
    pslot = P.add({"maxclass": "newobj", "text": "pattr stomp_slots", "numinlets": 1, "numoutlets": 3,
                   "outlettype": ["", "", ""], "patching_rect": [1200, 420, 120, 22], "varname": "stomp_slots",
                   "parameter_enable": 1,
                   "saved_attribute_attributes": {"valueof": {"parameter_longname": "User Slots", "parameter_shortname": "Slots",
                                                              "parameter_type": 3, "parameter_invisible": 1}}})
    pss = P.obj("prepend slots", 1, 1, x=1200, y=390, w=100)
    P.connect(rt2, 3, pss, 0)
    P.connect(pss, 0, pslot, 0)
    P.connect(pslot, 0, ui, 0)
    lbs = P.obj("deferlow", 1, 1, x=1330, y=390, w=70)      # after loading: send the stored slots to the panel
    P.connect(lb, 0, lbs, 0)
    bng = P.msg("bang", 1330, 420)
    P.connect(lbs, 0, bng, 0)
    P.connect(bng, 0, pslot, 0)

    # ---- output meter (peaks every 50 ms) and the sample rate → panel ----
    pkl = P.obj("peakamp~ 50", 2, 1, ["float"], x=300, y=1000)
    pkr = P.obj("peakamp~ 50", 2, 1, ["float"], x=400, y=1000)
    P.connect(gen, 0, pkl, 0); P.connect(gen, 1, pkr, 0)
    plv = P.obj("pack 0. 0.", 2, 1, x=340, y=1030)
    P.connect(pkl, 0, plv, 0); P.connect(pkr, 0, plv, 1)
    plev = P.obj("prepend level", 1, 1, x=340, y=1060)
    P.connect(plv, 0, plev, 0); P.connect(plev, 0, ui, 0)
    slfo = P.obj("snapshot~ 33", 2, 1, ["float"], x=500, y=1000)   # the noise LFO, live on the panel
    P.connect(gen, 3, slfo, 0)
    plfo = P.obj("prepend nlfo", 1, 1, x=500, y=1030, w=90)
    P.connect(slfo, 0, plfo, 0); P.connect(plfo, 0, ui, 0)
    stun = P.obj("snapshot~ 50", 2, 1, ["float"], x=600, y=1000)   # the tuner (Hz of the last hit)
    P.connect(gen, 4, stun, 0)
    ptun = P.obj("prepend tuner", 1, 1, x=600, y=1030, w=90)
    P.connect(stun, 0, ptun, 0); P.connect(ptun, 0, ui, 0)
    dsp = P.obj("dspstate~", 1, 4, ["int", "float", "int", "int"], x=900, y=80)
    P.connect(lb, 0, dsp, 0)
    psr = P.obj("prepend sr", 1, 1, x=900, y=110)
    P.connect(dsp, 1, psr, 0); P.connect(psr, 0, ui, 0)

    patcher = {"fileversion": 1, "appversion": APPV, "classnamespace": "box", "rect": [40, 40, 1400, 900],
               "openinpresentation": 1, "devicewidth": float(W), "boxes": P.boxes, "lines": P.lines}
    os.makedirs(MAXDIR, exist_ok=True)
    path = os.path.join(MAXDIR, "stomp_main.maxpat")
    json.dump({"patcher": patcher}, open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return path, patcher


def amxd_bytes(patcher_json, device_type=b"iiii"):
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
    p["dependency_cache"] = [{"name": JSNAME, "type": "TEXT", "implicit": 1}]
    p["autosave"] = 0
    if os.path.exists(PKG):
        shutil.rmtree(PKG)
    os.makedirs(PKG)
    with open(os.path.join(PKG, AMXDNAME), "wb") as f:
        f.write(amxd_bytes(pj))
    shutil.copy(os.path.join(ROOT, "js", "stomp_ui.js"), os.path.join(PKG, JSNAME))
    shutil.copy(os.path.join(ROOT, "dist_README.txt"), os.path.join(PKG, "README_FIRST.txt"))
    zpath = os.path.join(DIST, "STOMP_v%s_test_build.zip" % VERSION)
    for old in os.listdir(DIST):
        if old.endswith(".zip"):
            os.remove(os.path.join(DIST, old))
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(PKG)):
            z.write(os.path.join(PKG, f), "STOMP/" + f)
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
        if b.get("presentation") and (b["presentation_rect"][3] > H or b["presentation_rect"][2] > W):
            errs.append("presentation too large")
        if b.get("patcher"):
            errs += validate(b["patcher"])
    longs = [s[1] for s in PARAMS]
    if len(set(longs)) != len(longs):
        errs.append("duplicate Live parameter names")
    return errs


if __name__ == "__main__":
    path, patcher = build()
    errs = validate(patcher)
    if errs:
        print("\n".join(errs))
        sys.exit(1)
    print("STATIC VALID:", os.path.relpath(path, ROOT), "· %d Live parameters · MAX LOAD / LIVE LOAD: NOT TESTED" % len(PARAMS))
    if "--dist" in sys.argv:
        print(os.path.relpath(package(path), ROOT))
