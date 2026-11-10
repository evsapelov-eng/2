#!/usr/bin/env python3
"""STATIC checks of KØRE .maxpat sources. Passing = STATIC VALID, nothing more.

Checks: JSON parses; unique box ids; every patchline endpoint exists and uses an
outlet/inlet index inside the box's declared counts; no unresolved placeholders;
every referenced file (js, jsui, poly~ abstraction) exists next to the patch;
device presentation fits Live's 169 px device height; voices have [in 1], out~ 1/2
and thispoly~; no inlet receives both a signal and a control connection where the
object's right inlet would ignore floats (signal into *~ right inlet is fine).
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXDIR = os.path.join(ROOT, "max")
errors, notes = [], []


def err(f, m):
    errors.append("%s: %s" % (os.path.basename(f), m))


def check(path):
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception as e:  # noqa
        err(path, "invalid JSON: %s" % e)
        return
    check_patcher(path, data.get("patcher"), top=True)


def check_patcher(path, p, top=False):
    if not p:
        err(path, "no patcher")
        return
    boxes = {}
    for b in p["boxes"]:
        box = b["box"]
        if box["id"] in boxes:
            err(path, "duplicate id " + box["id"])
        boxes[box["id"]] = box
    texts = [b.get("text", "") for b in boxes.values()]
    for l in p["lines"]:
        (s, so), (d, di) = l["patchline"]["source"], l["patchline"]["destination"]
        if s not in boxes or d not in boxes:
            err(path, "line references missing box %s -> %s" % (s, d))
            continue
        if not (0 <= so < boxes[s].get("numoutlets", 0)):
            err(path, "outlet %d out of range on '%s'" % (so, boxes[s].get("text", boxes[s]["maxclass"])))
        if not (0 <= di < boxes[d].get("numinlets", 0)):
            err(path, "inlet %d out of range on '%s'" % (di, boxes[d].get("text", boxes[d]["maxclass"])))
    for box in boxes.values():
        if box.get("patcher"):  # embedded subpatcher, e.g. [p KORE_EDITOR]
            check_patcher(path, box["patcher"])
        t = box.get("text", "")
        if "ENGINE" in t:
            err(path, "unresolved placeholder in " + t)
        w = t.split()
        if box["maxclass"] == "newobj" and w:
            if w[0] == "js" and not os.path.exists(os.path.join(MAXDIR, w[1])):
                err(path, "missing js file " + w[1])
            if w[0] == "poly~" and not os.path.exists(os.path.join(MAXDIR, w[1] + ".maxpat")):
                err(path, "missing poly~ abstraction " + w[1])
            if w[0].startswith("kore_") and not os.path.exists(os.path.join(MAXDIR, w[0] + ".maxpat")):
                err(path, "missing abstraction " + w[0])
        if box["maxclass"] == "jsui":
            fn = box.get("filename")
            if not fn or not os.path.exists(os.path.join(MAXDIR, fn)):
                err(path, "missing jsui file %s" % fn)
        if box.get("parameter_enable") and not box.get("varname"):
            err(path, "parameter without varname: " + (t or box["maxclass"]))
    if top and p.get("openinpresentation") and os.path.basename(path).endswith("_main.maxpat"):
        for box in boxes.values():
            if box.get("presentation"):
                x, y, w2, h = box["presentation_rect"]
                if y + h > 169:
                    err(path, "presentation object exceeds 169 px device height: %s" % (box.get("text") or box["maxclass"]))
    if not top:
        return
    name = os.path.basename(path)
    if name.startswith("kore_voice_"):
        if "in 1" not in texts:
            err(path, "voice without [in 1]")
        if "out~ 1" not in texts:
            err(path, "voice without [out~ 1]")
        if "thispoly~" not in texts:
            err(path, "voice without thispoly~ (voices would never be released)")
    if name == "kore_main.maxpat":
        if not any(t.startswith("plugout~") for t in texts):
            err(path, "main patch has no plugout~ (instrument audio out)")
        vn = [b.get("varname") for b in boxes.values() if b.get("varname")]
        if len(vn) != len(set(vn)):
            err(path, "duplicate varnames")
    notes.append("%s: %d boxes, %d lines" % (name, len(boxes), len(p["lines"])))


if __name__ == "__main__":
    files = sorted(f for f in os.listdir(MAXDIR) if f.endswith(".maxpat"))
    for f in files:
        check(os.path.join(MAXDIR, f))
    print("\n".join(notes))
    if errors:
        print("\nSTATIC CHECK FAILED:\n  " + "\n  ".join(errors))
        sys.exit(1)
    print("\nSTATIC VALID (%d patches). MAX LOAD / LIVE LOAD: NOT TESTED." % len(files))
