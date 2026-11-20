#!/usr/bin/env python3
"""Build the FLOW Max for Live MIDI Effect.

  python3 tools/build_flow.py        (from flow/)

Outputs
  device/flow/flow.js          bundle of src/sections.js, engine.js, selftest.js, main.js
  device/flow/FLOW.maxpat      device patch
  dist/FLOW.amxd + dist/flow.js  unfrozen device; keep both files in the same folder

Object formats (live.text, live.menu, pattr blob parameter, savedialog/opendialog,
top-level patcher fields) follow devices saved by Max itself: Ableton/maxdevtools test
files, LFO-lab/SIGNe and michalhorcic/looper-dash (pattr @parameter_enable 1, type blob).
Opening in Live is still UNVERIFIED from this environment.
"""
import json
import os
import shutil
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "device", "flow")
DIST = os.path.join(ROOT, "dist")
MODULES = ["sections.js", "engine.js", "selftest.js", "main.js"]
JS = "flow.js"
WIDTH = 640
HEIGHT = 169

BG = [0.047, 0.055, 0.063, 1.0]       # #0C0E10
PANEL = [0.075, 0.086, 0.098, 1.0]    # #131619
TEXT = [0.851, 0.878, 0.875, 1.0]     # #D9E0DF
MUTED = [0.490, 0.541, 0.549, 1.0]    # #7D8A8C
ACTIVE = [0.722, 0.886, 0.541, 1.0]   # #B8E28A
WARN = [0.847, 0.549, 0.467, 1.0]     # #D88C77

boxes, lines, params = [], [], {}
_n = [0]


def box(maxclass, rect, text=None, pres=None, ins=1, outs=1, outtype=None, **extra):
    _n[0] += 1
    bid = "obj-%d" % _n[0]
    b = {"id": bid, "maxclass": maxclass, "numinlets": ins, "numoutlets": outs,
         "patching_rect": [float(v) for v in rect]}
    if outs:
        b["outlettype"] = outtype if outtype is not None else [""] * outs
    if text is not None:
        b["text"] = text
    if pres is not None:
        b["presentation"] = 1
        b["presentation_rect"] = [float(v) for v in pres]
    b.update(extra)
    boxes.append({"box": b})
    return bid


def connect(src, dst, outlet=0, inlet=0):
    lines.append({"patchline": {"source": [src, outlet], "destination": [dst, inlet]}})


def obj(text, x, y, ins=1, outs=1, outtype=None, w=None, **extra):
    return box("newobj", [x, y, w or max(40, 7 * len(text)), 22], text, ins=ins, outs=outs, outtype=outtype, **extra)


def msg(text, x, y, pres=None, **extra):
    return box("message", [x, y, max(40, 7 * len(text)), 22], text, pres=pres, ins=2, **extra)


# ------------------------------------------------------------------ core
thisdev = obj("live.thisdevice", 20, 20, outs=3, outtype=["bang", "int", "int"])
defer = obj("deferlow", 20, 50)
init = msg("init", 20, 80)
js = obj("js " + JS, 20, 600, outs=2, w=200, saved_object_attributes={"filename": JS, "parameter_enable": 0})
connect(thisdev, defer)
connect(defer, init)
connect(init, js)

mi = obj("midiin", 900, 20, outs=1, outtype=["int"])
mo = obj("midiout", 900, 60, outs=0)
connect(mi, mo)

# Persistence: hidden blob parameter stored in the Live Set.
pattr = obj("pattr flowdoc", 400, 660, outs=3, varname="flowdoc",
            saved_attribute_attributes={"valueof": {"parameter_invisible": 1, "parameter_longname": "FLOW Document",
                                                    "parameter_shortname": "FLOW Doc", "parameter_type": 3}},
            saved_object_attributes={"parameter_enable": 1, "parameter_mappable": 0})
params[pattr] = ["FLOW Document", "FLOW Doc", 0]
restore = obj("prepend restoredoc", 400, 700)
connect(js, pattr, outlet=1)
connect(pattr, restore)
connect(restore, js)

# ------------------------------------------------------------------ displays
display_keys = ["state", "current", "bar", "next", "msg", "set", "test"]
menu_keys = ["ui_nav", "ui_quant", "ui_hold", "ui_jump", "ui_stop", "ui_follow"]
route = obj("route " + " ".join(display_keys + menu_keys), 20, 640, ins=2, outs=len(display_keys) + len(menu_keys) + 1, w=600)
connect(js, route)

display_layout = {
    #          x,  y,   w,   h, font, color
    "state":   (4, 2, 300, 16, 11.0, ACTIVE),
    "current": (4, 20, 300, 28, 20.0, TEXT),
    "bar":     (4, 50, 300, 16, 11.0, TEXT),
    "next":    (4, 68, 300, 16, 11.0, TEXT),
    "msg":     (4, 86, 300, 16, 10.0, WARN),
    "set":     (4, 104, 300, 16, 10.0, MUTED),
    "test":    (4, 122, 300, 16, 10.0, MUTED),
}
for i, k in enumerate(display_keys):
    x, y, w, h, fs, col = display_layout[k]
    pre = obj("prepend set", 20 + i * 120, 680)
    d = box("message", [20 + i * 120, 720, 110, 22], "-", pres=[x, y, w, h], ins=2, ignoreclick=1,
            fontsize=fs, fontface=1 if k in ("state", "current") else 0,
            bgcolor=PANEL, bgcolor2=PANEL, bgfillcolor_color=PANEL, textcolor=col)
    connect(route, pre, outlet=i)
    connect(pre, d)

# ------------------------------------------------------------------ performance buttons
# live.text parameters: mappable with Live's MIDI Map (spec §11, option A).
buttons = [("HOLD", "hold", 0, 0), ("RELEASE", "release", 1, 0), ("PREV", "prev", 0, 1),
           ("NEXT", "next", 1, 1), ("STOP", "stop", 0, 2), ("CANCEL", "cancel", 1, 2)]
for i, (label, cmd, col, row) in enumerate(buttons):
    px, py = 310 + col * 82, 2 + row * 40
    lt = box("live.text", [300 + i * 100, 120, 80, 36], pres=[px, py, 80, 37], ins=1, outs=2, outtype=["", ""],
             parameter_enable=1, mode=0, text=label, texton=label, varname="FLOW " + label, fontsize=13.0, fontface=1,
             saved_attribute_attributes={"valueof": {"parameter_button_mode": "Momentary",
                                                     "parameter_enum": ["val1", "val2"],
                                                     "parameter_longname": "FLOW " + label,
                                                     "parameter_mmax": 1, "parameter_modmode": 0,
                                                     "parameter_shortname": label, "parameter_type": 2}})
    params[lt] = ["FLOW " + label, label, 0]
    # Accept either a bang or a 1 from live.text (release values 0 are ignored).
    rb = obj("route bang", 300 + i * 100, 170, ins=2, outs=2)
    s1 = obj("sel 1", 300 + i * 100, 200, ins=2, outs=2, outtype=["bang", ""])
    m = msg(cmd, 300 + i * 100, 240)
    connect(lt, rb)
    connect(rb, m, outlet=0)
    connect(rb, s1, outlet=1)
    connect(s1, m)
    connect(m, js)

# ------------------------------------------------------------------ option menus (doc is the source of truth;
# menus are hidden parameters, js pushes "set N" into them after loading the doc)
menus = [("NAV", "navmode", "ui_nav", ["SETLIST", "SOURCE"]),
         ("NEXT AT", "quant", "ui_quant", ["1 BAR", "2 BARS", "4 BARS", "8 BARS", "SECTION"]),
         ("HOLD", "holdlen", "ui_hold", ["SECTION", "LAST 1", "LAST 2", "LAST 4", "LAST 8"]),
         ("JUMPS", "jumpmode", "ui_jump", ["SAFE", "EXPERIMENTAL"]),
         ("STOP", "stopmode", "ui_stop", ["CONFIRM", "IMMEDIATE"]),
         ("SETLIST", "follow", "ui_follow", ["FOLLOW", "PAUSE"])]
for i, (label, cmd, key, items) in enumerate(menus):
    py = 2 + i * 19
    box("comment", [700, 300 + i * 30, 60, 20], label, pres=[476, py, 58, 17], ins=1, outs=0, fontsize=9.0, textcolor=MUTED)
    mn = box("live.menu", [770, 300 + i * 30, 100, 18], pres=[534, py + 1, 102, 16], ins=1, outs=3,
             outtype=["", "", "float"], parameter_enable=1, varname="FLOW " + label.title(),
             saved_attribute_attributes={"valueof": {"parameter_enum": items, "parameter_invisible": 2,
                                                     "parameter_longname": "FLOW " + label.title(),
                                                     "parameter_mmax": len(items) - 1, "parameter_modmode": 0,
                                                     "parameter_shortname": label.title(), "parameter_type": 2}})
    params[mn] = ["FLOW " + label.title(), label.title(), 0]
    pp = obj("prepend " + cmd, 880, 300 + i * 30)
    connect(mn, pp)
    connect(pp, js)
    connect(route, mn, outlet=len(display_keys) + menu_keys.index(key))

# ------------------------------------------------------------------ utility buttons
util = [  # label (= js message), dialog, presentation rect
    ("import_locators", None, [4, 142, 76, 13]),
    ("confirm_import", None, [82, 142, 76, 13]),
    ("undo", None, [160, 142, 70, 13]),
    ("back_to_arr", None, [232, 142, 72, 13]),
    ("self_test", None, [310, 124, 80, 16]),
    ("save_report", "report", [392, 124, 80, 16]),
    ("export_json", "save", [310, 144, 80, 16]),
    ("import_json", "open", [392, 144, 80, 16]),
    ("take_over", None, [476, 124, 160, 16]),
]
for i, (label, dialog, pres) in enumerate(util):
    m = msg(label, 20 + i * 110, 800, pres=pres, fontsize=9.0)
    if dialog is None:
        connect(m, js)
        continue
    tb = obj("t b", 20 + i * 110, 830, outs=1, outtype=["bang"])
    if dialog == "open":
        dl = obj("opendialog", 20 + i * 110, 860, outs=2, outtype=["", "bang"])
    else:
        dl = obj("savedialog TEXT", 20 + i * 110, 860, outs=3, outtype=["", "", "bang"])
    pp = obj("prepend " + {"save": "exportjson", "open": "importjson", "report": "savereport"}[dialog], 20 + i * 110, 890)
    connect(m, tb)
    connect(tb, dl)
    connect(dl, pp)
    connect(pp, js)

params["inherited_shortname"] = 1

patcher = {
    "patcher": {
        "fileversion": 1,
        "appversion": {"major": 8, "minor": 6, "revision": 4, "architecture": "x64", "modernui": 1},
        "classnamespace": "box",
        "rect": [60.0, 60.0, 1300.0, 960.0],
        "openrect": [0.0, 0.0, float(WIDTH), float(HEIGHT)],
        "bglocked": 0,
        "openinpresentation": 1,
        "default_fontsize": 10.0,
        "default_fontface": 0,
        "default_fontname": "Arial Bold",
        "gridonopen": 1,
        "gridsize": [8.0, 8.0],
        "boxanimatetime": 500,
        "devicewidth": 0.0,
        "description": "FLOW Performance Arranger (Milestone 1, UNVERIFIED)",
        "digest": "", "tags": "", "style": "",
        "boxes": boxes,
        "lines": lines,
        "parameters": params,
        "dependency_cache": [],
        "latency": 0, "is_mpe": 0, "external_mpe_tuning_enabled": 0,
        "minimum_live_version": "", "minimum_max_version": "", "platform_compatibility": 0,
        "project": {
            "version": 1, "creationdate": 3590052493, "modificationdate": 3590052493,
            "viewrect": [0.0, 0.0, 300.0, 500.0], "autoorganize": 1, "hideprojectwindow": 1,
            "showdependencies": 1, "autolocalize": 0, "contents": {"patchers": {}}, "layout": {},
            "searchpath": {}, "detailsvisible": 0, "amxdtype": int.from_bytes(b"mmmm", "big"),
            "readonly": 0, "devpathtype": 0, "devpath": ".", "sortmode": 0, "viewmode": 0, "includepackages": 0,
        },
        "autosave": 0,
    }
}


def amxd_bytes(patch_json: bytes, device_type: bytes = b"mmmm") -> bytes:
    payload = patch_json + b"\n\x00"
    return (b"ampf" + struct.pack("<I", 4) + device_type +
            b"meta" + struct.pack("<I", 4) + struct.pack("<I", 0) +
            b"ptch" + struct.pack("<I", len(payload)) + payload)


def bundle() -> str:
    parts = ["// FLOW bundle - GENERATED by tools/build_flow.py from flow/src/*.js. Do not edit here.\n"]
    for m in MODULES:
        with open(os.path.join(SRC, m), encoding="utf-8") as f:
            parts.append("\n// ===== src/%s =====\n" % m)
            parts.append(f.read())
    return "".join(parts)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(DIST, exist_ok=True)
    with open(os.path.join(OUT, JS), "w", encoding="utf-8", newline="\n") as f:
        f.write(bundle())
    text = json.dumps(patcher, indent="\t", ensure_ascii=True)
    with open(os.path.join(OUT, "FLOW.maxpat"), "w", newline="\n") as f:
        f.write(text + "\n")
    with open(os.path.join(DIST, "FLOW.amxd"), "wb") as f:
        f.write(amxd_bytes(text.encode("utf-8")))
    shutil.copyfile(os.path.join(OUT, JS), os.path.join(DIST, JS))
    print("FLOW: %d boxes, %d lines, %d parameters" % (len(boxes), len(lines), len(params) - 1))


if __name__ == "__main__":
    main()
