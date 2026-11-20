#!/usr/bin/env python3
"""Generate the FLOW M0 spike Max patch (.maxpat) and an unfrozen Max MIDI Effect (.amxd).

Usage:  python3 tools/build_m0_spike.py            (from the flow/ directory)

Outputs
  device/m0-spike/flow-spike.maxpat   - source patch (open in Max / paste into a device)
  dist/FLOW-M0-Spike.amxd             - UNVERIFIED binary wrapper (see docs/M0_SPIKE_PROTOCOL.md)
  dist/flow_spike.js                  - copy of the script; must sit next to the .amxd

The .amxd container layout used here ('ampf' / 'mmmm' / 'meta' / 'ptch' chunks around
the patcher JSON) was reconstructed from public descriptions of the format, NOT from an
official specification, and has not been opened in Live from this environment. If Live
refuses it, use the manual route in the protocol (paste the .maxpat into a new
Max MIDI Effect and save it from the Max editor).
"""
import json
import os
import shutil
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "device", "m0-spike")
DIST = os.path.join(ROOT, "dist")
JS_NAME = "flow_spike.js"
DEVICE_WIDTH = 760

boxes = []
lines = []
_n = [0]


def box(maxclass, rect, text=None, pres=None, ins=1, outs=1, outtype=None, **extra):
    _n[0] += 1
    bid = "obj-%d" % _n[0]
    b = {
        "id": bid,
        "maxclass": maxclass,
        "numinlets": ins,
        "numoutlets": outs,
        "patching_rect": [float(v) for v in rect],
    }
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


# ---- core objects (patching view only)
thisdev = box("newobj", [20, 20, 100, 22], "live.thisdevice", ins=1, outs=3, outtype=["bang", "int", "int"])
defer = box("newobj", [20, 50, 60, 22], "deferlow")
initmsg = box("message", [20, 80, 40, 22], "init", ins=2)
js = box("newobj", [20, 420, 160, 22], "js " + JS_NAME, ins=1, outs=1,
         saved_object_attributes={"filename": JS_NAME, "parameter_enable": 0})
connect(thisdev, defer)
connect(defer, initmsg)
connect(initmsg, js)

# MIDI pass-through: a MIDI Effect must not swallow the track's MIDI.
midiin = box("newobj", [600, 20, 50, 22], "midiin", ins=1, outs=1, outtype=["int"])
midiout = box("newobj", [600, 60, 55, 22], "midiout", ins=1, outs=0)
connect(midiin, midiout)

# ---- status displays: js -> route -> prepend set -> message box (presentation)
keys = ["pos", "loop", "exp", "warn"]
route = box("newobj", [20, 460, 200, 22], "route " + " ".join(keys), ins=2, outs=len(keys) + 1)
connect(js, route)
for i, k in enumerate(keys):
    pre = box("newobj", [20 + i * 150, 500, 70, 22], "prepend set")
    disp = box("message", [20 + i * 150, 540, 140, 22], "-", ins=2,
               pres=[2, 2 + i * 18, 400, 17], ignoreclick=1, fontsize=10.0)
    connect(route, pre, outlet=i)
    connect(pre, disp)

box("comment", [400, 600, 300, 20], "FLOW M0 SPIKE - UNVERIFIED - not for stage use", ins=1, outs=0,
    pres=[2, 76, 400, 17], fontsize=10.0)

# ---- numeric inputs
num_specs = [("target bar", "target", 1), ("cue #", "cueindex", 0)]
for i, (label, cmd, minimum) in enumerate(num_specs):
    x = 2 + i * 110
    box("comment", [300 + i * 120, 20, 60, 20], label, ins=1, outs=0, pres=[x, 96, 58, 17], fontsize=10.0)
    nb = box("number", [300 + i * 120, 50, 50, 22], ins=1, outs=2, outtype=["", "bang"],
             pres=[x + 58, 96, 44, 17], minimum=minimum, parameter_enable=0, fontsize=10.0)
    pp = box("newobj", [300 + i * 120, 80, 90, 22], "prepend " + cmd)
    connect(nb, pp)
    connect(pp, js)

# ---- save log: button -> savedialog -> prepend savelog -> js
savebtn = box("message", [520, 20, 60, 22], "save log", ins=2, pres=[2, 118, 100, 17], fontsize=10.0)
sdlg = box("newobj", [520, 50, 70, 22], "savedialog", ins=1, outs=3)
spre = box("newobj", [520, 80, 100, 22], "prepend savelog")
connect(savebtn, sdlg)
connect(sdlg, spre)
connect(spre, js)

# ---- command buttons (message boxes are clickable in presentation mode)
commands = [
    "read", "cuelist", "play", "stop", "loopon",
    "loopoff", "restore", "backtoarr", "abort", "seek",
    "cuejump", "exp_rates 10", "exp_bars", "exp_hold 1", "exp_hold 4",
    "exp_release", "exp_release_sweep 1 3", "exp_hold_sweep 1 2", "exp_seek", "exp_cuejump",
    "exp_wrapjump", "exp_notifyset", "poll 1", "poll 0", "verbose 1",
    "verbose 0", "clearlog",
]
cols, bw, bh = 3, 116, 17
for i, cmd in enumerate(commands):
    col, row = i % cols, i // cols
    px, py = 408 + col * (bw + 2), 2 + row * (bh + 1)
    m = box("message", [700 + col * 130, 20 + row * 30, 120, 22], cmd, ins=2,
            pres=[px, py, bw, bh], fontsize=10.0)
    connect(m, js)

patcher = {
    "patcher": {
        "fileversion": 1,
        "appversion": {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1},
        "classnamespace": "box",
        "rect": [80.0, 80.0, 1200.0, 640.0],
        "openinpresentation": 1,
        "default_fontsize": 10.0,
        "default_fontface": 0,
        "default_fontname": "Arial",
        "gridonopen": 1,
        "gridsize": [8.0, 8.0],
        "devicewidth": float(DEVICE_WIDTH),
        "description": "FLOW Milestone 0 Live API spike (UNVERIFIED)",
        "boxes": boxes,
        "lines": lines,
        "dependency_cache": [],
        "autosave": 0,
    }
}


def amxd_bytes(patch_json: bytes, device_type: bytes = b"mmmm") -> bytes:
    payload = patch_json + b"\n\x00"
    return (b"ampf" + struct.pack("<I", 4) + device_type +
            b"meta" + struct.pack("<I", 4) + struct.pack("<I", 0) +
            b"ptch" + struct.pack("<I", len(payload)) + payload)


def main():
    os.makedirs(DIST, exist_ok=True)
    text = json.dumps(patcher, indent="\t", ensure_ascii=True)
    with open(os.path.join(SRC_DIR, "flow-spike.maxpat"), "w", newline="\n") as f:
        f.write(text + "\n")
    with open(os.path.join(DIST, "FLOW-M0-Spike.amxd"), "wb") as f:
        f.write(amxd_bytes(text.encode("utf-8")))
    shutil.copyfile(os.path.join(SRC_DIR, JS_NAME), os.path.join(DIST, JS_NAME))
    print("wrote %d boxes, %d lines" % (len(boxes), len(lines)))


if __name__ == "__main__":
    main()
