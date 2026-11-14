#!/usr/bin/env python3
"""Diagnostic kit 7: what else, besides the 4097-step loop, keeps the v0.3+/0.4 engine silent in Max.
Variants of the CURRENT engine, each with one suspect removed."""
import json, os, re, shutil, subprocess, sys, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import build_device as bd

ROOT = bd.ROOT
OUT = os.path.join(ROOT, "dist", "FLOCK_DIAG")
CUR = open(os.path.join(ROOT, "gen", "flock.genexpr"), encoding="utf-8").read()
B = subprocess.check_output(["git", "show", "e4c01d4:flock/gen/flock.genexpr"], cwd=ROOT).decode() + "\nout10 = 1;\nout11 = 0;\nout12 = 0;\nout13 = -1;\n"


def block_end(code, i):
    j, depth = code.index("{", i) + 1, 1
    while depth:
        depth += {"{": 1, "}": -1}.get(code[j], 0)
        j += 1
    return j


def runtime_bounds(code):      # R: every loop bound read from a History (the compiler cannot unroll it)
    code = code.replace("History hinit(0);", "History hinit(0);\nHistory lone(1);")
    code = re.sub(r"for \(k = 0; k < (\d+); k \+= 1\)", r"for (k = 0; k < \1 * lone; k += 1)", code)
    code = re.sub(r"for \(j = k \+ 1; j < (\d+); j \+= 1\)", r"for (j = k + 1; j < \1 * lone; j += 1)", code)
    return code.rstrip("\n") + "\nlone = 1;\n"


def no_converters(code):       # V: no converter / Sunny tape loops (codec qualities silent, Sunny tape wrong)
    for head in ["for (k = 0; k < nj; k += 1) {", "for (k = 0; k < 33; k += 1) {", "for (k = 0; k < 24; k += 1) {", "for (k = 0; k < 48; k += 1) {"]:
        while head in code:
            i = code.index(head)
            code = code[:i] + code[block_end(code, i):]
    return code


def no_tape_fx(code):          # F: no wow & flutter block, no µ-law / 12-bit / soft clip / sine helpers
    i = code.index("if (qi > 2.5) {\n\tif (newblk) {\n\t\tpph = wrph;")
    code = code[:i] + code[block_end(code, i):]
    for name in ["q12", "mulaw", "soft_limit", "sclip", "lsin"]:
        a = code.index("\n" + name + "(")
        b = code.index("\n}\n", a) + 3
        code = code[:a + 1] + code[b:]
    for a, b in [("q12(", "q16("), ("mulaw(", "q16("), ("sclip(", "tanh(")]:
        code = re.sub(r"\b" + re.escape(a), b, code)
    return code


def no_gating(code):           # G: no bvalid gating of the buffer reads
    code = re.sub(r"bvalid\(idx( \+ \d)?, nwr1, MAXD\) > 0\.5 \? (peek\(buf, idx(?: \+ \d)?, \d\)) : 0", r"\2", code)
    a = code.index("\nbvalid(")
    b = code.index("\n}\n", a) + 3
    return code[:a + 1] + code[b:]


VARIANTS = [("B_engine_v020", B), ("V0_current", CUR), ("V1_runtime_loop_bounds", runtime_bounds(CUR)),
            ("V2_no_converter_loops", no_converters(CUR)), ("V3_no_tape_effects", no_tape_fx(CUR)),
            ("V4_no_buffer_gating", no_gating(CUR)),
            ("V5_all", runtime_bounds(no_gating(no_tape_fx(no_converters(CUR)))))]

if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
good = bd.CODE
for name, code in VARIANTS:
    bd.CODE = code
    bd.EMBED = bd.embed_code
    path, patcher = bd.build()
    pj = json.load(open(path, encoding="utf-8"))
    p = pj["patcher"]
    p["parameters"] = bd._param_table(p)
    p["dependency_cache"] = [{"name": bd.JSNAME, "type": "TEXT", "implicit": 1}]
    p["autosave"] = 0
    with open(os.path.join(OUT, "FLOCK_%s.amxd" % name), "wb") as f:
        f.write(bd.amxd_bytes(pj))
    open(os.path.join(OUT, "..", "_diag_%s.gen" % name), "w", encoding="utf-8").write(bd.embed_code(code))
# native layout test with the working engine B: are Live's own controls visible above the panel?
bd.CODE = B
bd.EMBED = bd.embed_code
bd.NATIVE = True
path, patcher = bd.build()
pj = json.load(open(path, encoding="utf-8"))
p = pj["patcher"]
p["parameters"] = bd._param_table(p)
p["dependency_cache"] = [{"name": bd.JSNAME, "type": "TEXT", "implicit": 1}]
p["autosave"] = 0
with open(os.path.join(OUT, "FLOCK_N_native_controls_test.amxd"), "wb") as f:
    f.write(bd.amxd_bytes(pj))
bd.NATIVE = False
bd.CODE = good
bd.EMBED = bd.compact_code
bd.build()
shutil.copy(os.path.join(ROOT, "js", "flock_ui.js"), os.path.join(OUT, bd.JSNAME))
open(os.path.join(OUT, "README_DIAG.txt"), "w", encoding="utf-8").write(
    "Положите на дорожки со звуком B, V0, V1, V2, V3, V4, V5 и напишите, какие звучат.\nN — отдельно: видны ли на нём ручки Live (звук у него должен быть).\n")
zp = os.path.join(ROOT, "dist", "FLOCK_DIAG.zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(OUT)):
        z.write(os.path.join(OUT, f), "FLOCK_DIAG/" + f)
print(os.path.relpath(zp, ROOT))
