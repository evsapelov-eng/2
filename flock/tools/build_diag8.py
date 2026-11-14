#!/usr/bin/env python3
"""Diagnostic kit 8: the qualities rebuilt on the working engine in cumulative steps (tools/lite_qualities.py)."""
import json, os, shutil, subprocess, sys, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import build_device as bd
import lite_qualities as lq

ROOT = bd.ROOT
OUT = os.path.join(ROOT, "dist", "FLOCK_DIAG")
B = subprocess.check_output(["git", "show", "e4c01d4:flock/gen/flock.genexpr"], cwd=ROOT).decode() + "\nout10 = 1;\nout11 = 0;\nout12 = 0;\nout13 = -1;\n"
VARIANTS = [("B_engine_v020", B)] + [(n + ["_C_plus_auto_fix", "_formats_feedback", "_wow_flutter", "_reverb_clip_bandwidth", "_buffer_lengths"][i], s)
                                     for i, (n, s) in enumerate(lq.variants())]
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
bd.CODE = good
bd.EMBED = bd.compact_code
bd.build()
shutil.copy(os.path.join(ROOT, "js", "flock_ui.js"), os.path.join(OUT, bd.JSNAME))
open(os.path.join(OUT, "README_DIAG.txt"), "w", encoding="utf-8").write(
    "Положите на дорожки со звуком B, Q0, Q1, Q2, Q3, Q4 и напишите, какие звучат.\n"
    "Q1-Q4: попробуйте кнопки качества над лентой (PRISTINE / COLD DIGITAL / SUNNY TAPE / SCORCHED).\n")
zp = os.path.join(ROOT, "dist", "FLOCK_DIAG.zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(OUT)):
        z.write(os.path.join(OUT, f), "FLOCK_DIAG/" + f)
print(os.path.relpath(zp, ROOT))
