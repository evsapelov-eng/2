#!/usr/bin/env python3
"""Diagnostic kit: the same device (patch + panel) with four different gen~ engines, to find out in
Live which change stops the sound when Max's error text is not available.
  A  pass-through (in → out): checks the patch, the panel and Live's audio routing
  B  engine v0.2.0 (the last version confirmed to sound in Live)
  C  engine v0.2.x (auto gain, DICE, …; never tried in Live)
  D  engine v0.3.1 (recording qualities)
Writes dist/FLOCK_DIAG/*.amxd + flock_ui.js and dist/FLOCK_DIAG.zip."""
import json, os, shutil, subprocess, sys, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import build_device as bd

ROOT = bd.ROOT
OUT = os.path.join(ROOT, "dist", "FLOCK_DIAG")


def git_show(rev):
    return subprocess.check_output(["git", "show", rev + ":flock/gen/flock.genexpr"], cwd=ROOT).decode("utf-8")


PASS = "out1 = in1;\nout2 = in2;\n" + "".join("out%d = 0;\n" % i for i in range(3, 12)) + "x = in3 + in4 + in5 + in6 + in7 + in8 + in9 + in10 + in11;\n"
v020 = git_show("e4c01d4") + "\nout10 = 1;\nout11 = 0;\n"
CUR = open(os.path.join(ROOT, "gen", "flock.genexpr"), encoding="utf-8").read()


def flatten(code):
    """X: the same engine with the two big conditional blocks opened (codec / core stage run on
    every sample: Cold digital / Scorched lose their rate, Sunny tape its half rate) — tells whether
    the large if-blocks themselves are the problem."""
    for head in ("if (ctk) {", "if (gtick) {"):
        i = code.index("\n" + head + "\n") + 1
        j, depth = i + len(head), 1
        while depth:
            depth += {"{": 1, "}": -1}.get(code[j], 0)
            j += 1
        code = code[:i] + "// (opened)\n" + code[i + len(head) + 1:j - 1] + code[j:]
    return code


VARIANTS = [("A_passthrough", PASS), ("B_engine_v020", v020), ("M_main_v%s" % bd.VERSION.replace(".", "_"), CUR),
            ("X_main_without_blocks", flatten(CUR))]

if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
good = bd.CODE
for name, code in VARIANTS:
    bd.CODE = code
    path, patcher = bd.build()
    errs = bd.validate(patcher)
    if errs:
        sys.exit(name + ": " + "; ".join(errs))
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
    with open(os.path.join(OUT, "FLOCK_%s.amxd" % name), "wb") as f:
        f.write(bd.amxd_bytes(pj))
bd.CODE = good
bd.build()   # restore max/flock_main.maxpat
shutil.copy(os.path.join(ROOT, "js", "flock_ui.js"), os.path.join(OUT, "flock_ui.js"))
open(os.path.join(OUT, "README_DIAG.txt"), "w", encoding="utf-8").write(
    "ДИАГНОСТИКА FLØCK — четыре одинаковых устройства с разными звуковыми движками.\n"
    "Положите каждое на свою аудиодорожку со звуком (или по очереди на одну), DRY/WET поверните влево.\n"
    "Напишите, какие из A / B / M / X звучат:\n"
    "  A — просто пропускает звук (проверка самого устройства и Live)\n"
    "  B — движок v0.2.0 (у вас звучал)\n"
    "  M — новая версия (все записи состояния перенесены в конец кода)\n"
    "  X — то же, но без больших условных блоков (качества записи работают неправильно, только проверка)\n"
    "Если можно — Max Console (Edit → Window → Max Console): текст красных строк.\n")
zp = os.path.join(ROOT, "dist", "FLOCK_DIAG.zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(OUT)):
        z.write(os.path.join(OUT, f), "FLOCK_DIAG/" + f)
print(os.path.relpath(zp, ROOT))
