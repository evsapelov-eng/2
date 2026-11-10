#!/usr/bin/env python3
"""Generates the KØRE Max patch SOURCES (.maxpat) from spec/dsp_map.json.

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
    "dbtoa~": (1, 1, [SIG]), "tapin~": (2, 1, ["tapconnect"]), "peakamp~": (2, 1, ["float"]),
    "tapout~": None, "f": (2, 1, ["float"]),
    "phasor~": (2, 1, [SIG]), "slide~": (3, 1, [SIG]), "maximum~": (2, 1, [SIG]), "==~": (2, 1, [SIG]), "trunc~": (1, 1, [SIG]), "change~": (1, 1, [SIG]), "sah~": (2, 1, [SIG]),
    "index~": (2, 1, [SIG]), "%~": (2, 1, [SIG]), "-~": (2, 1, [SIG]), "!-~": (2, 1, [SIG]), "clip~": (3, 1, [SIG]),
    "buffer~": (1, 2, ["float", "bang"]), "dspstate~": (1, 4, ["int", "float", "int", "int"]), "pcontrol": (1, 1, [""]), "inlet": (0, 1, [""]), "outlet": (1, 0, []),
}


def io_for(text):
    words = text.split()
    name = words[0]
    args = [w for w in words[1:] if not w.startswith("@")]
    if "@" in text:
        args = words[1:words.index(next(w for w in words if w.startswith("@")))]
    if name.startswith("kore_"):  # own abstraction (counts patched by the caller)
        return 1, 1, [""]
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
    if name == "poly~":  # 1 [in 1], 1 [out~ 1] in every KØRE voice (mono low end)
        return 1, 1, [SIG]
    if name == "tapout~":
        return 1, max(1, len(args)), [SIG] * max(1, len(args))
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


