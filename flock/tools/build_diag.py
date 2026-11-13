#!/usr/bin/env python3
"""Diagnostic kit: the same device (patch + panel) with four different gen~ engines, to find out in
Live which change stops the sound when Max's error text is not available.
  A  pass-through (in → out): checks the patch, the panel and Live's audio routing
  B  engine v0.2.0 (the last version confirmed to sound in Live)
  C  engine v0.2.x (auto gain, DICE, …; never tried in Live)
  D  engine v0.3.1 (recording qualities)
Writes dist/FLOCK_DIAG/*.amxd + flock_ui.js and dist/FLOCK_DIAG.zip."""
import json, os, re, shutil, subprocess, sys, zipfile
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


def cut(code, start, end):
    i = code.index(start)
    j = code.index(end, i)
    return code[:i] + code[j:]


def small_buffer(code):          # Y1: the recording buffer back to the v0.2 size
    return code.replace("Data buf(384004, 2);", "Data buf(192004, 2);").replace("qi > 2.5 ? 384000 : 256000", "qi > 2.5 ? 192000 : 192000")


def no_init(code):               # Y2: no table init on the first sample (no function calls inside a loop)
    return cut(code, "if (hinit < 0.5) {\n\tfor (k = 0; k < 4097; k += 1) {", "poke(hin, in1, hw, 0);")


def no_new_functions(code):      # Y3: no new helper functions (calls replaced by simple expressions)
    for name in ["q12", "mulaw", "soft_limit", "sclip", "lsin", "bessel_i0", "csinc"]:
        code = cut(code, "\n" + name + "(", "\n}\n") .replace("\n\n}\n", "\n", 1) if False else code
    out, i = [], 0
    for name in ["q12", "mulaw", "soft_limit", "sclip", "lsin", "bessel_i0", "csinc"]:
        a = code.index("\n" + name + "(")
        b = code.index("\n}\n", a) + 3
        code = code[:a + 1] + code[b:]
    for a, b in [("q12(", "q16("), ("mulaw(", "q16("), ("sclip(", "tanh("), ("lsin(", "sin(twopi * ")]:
        code = re.sub(r"\b" + re.escape(a), b, code)
    code = code.replace("poke(ck, csinc(k / 256), k, 0);", "poke(ck, 0, k, 0);")
    return code


def padded(code, size=43000):     # Z: the working v0.2.0 engine made as long as the new one (harmless lines)
    body = bd.embed_code(code)
    pad = "".join("zpad%d = 0;\n" % i for i in range((size - len(body)) // 12 + 1))
    return code + "\n" + pad


def minified(code):              # M2: the new engine without indentation and spaces (same program)
    out = []
    for line in bd.embed_code(code).split("\n"):
        line = line.strip()
        line = re.sub(r"\s*([=+\-*/<>!?:,;(){}&|])\s*", r"\1", line)
        line = line.replace("Param", "Param ").replace("History", "History ").replace("Data", "Data ")
        out.append(line)
    return "\n".join(out)


def no_loops(code):              # N1: no init loop, no clearing loops, constant converter bound
    code = no_init(code)
    i = code.index("\nif (qchg) {\n\tfor (k = 0; k < MAXD + 4; k += 1) {")
    j, depth = code.index("{", i) + 1, 1
    while depth:
        depth += {"{": 1, "}": -1}.get(code[j], 0)
        j += 1
    code = code[:i + 1] + code[j:]
    return code.replace("for (k = 0; k < nj; k += 1) {", "for (k = 0; k < 66; k += 1) {")


def param_and_buffer(code):      # N3: Param "quality" renamed, recording buffer at the v0.2 size
    code = small_buffer(code)
    return code.replace("Param quality(0, min=0, max=3);", "Param qmode(0, min=0, max=3);").replace("floor(quality + 0.5)", "floor(qmode + 0.5)")


VARIANTS = [("B_engine_v020", v020), ("C_engine_v02x", git_show("7c2551c")),
            ("N1_no_loops", no_loops(CUR)), ("N2_no_new_functions", no_new_functions(CUR)),
            ("N3_param_and_buffer", param_and_buffer(CUR)),
            ("N4_all_three", param_and_buffer(no_new_functions(no_loops(CUR))))]

if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
good = bd.CODE
for name, code in VARIANTS:
    bd.CODE = code
    bd.EMBED = bd.embed_code if name.startswith(("B_", "C_")) else bd.compact_code
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
    p["dependency_cache"] = [{"name": bd.JSNAME, "type": "TEXT", "implicit": 1}]
    p["autosave"] = 0
    with open(os.path.join(OUT, "FLOCK_%s.amxd" % name), "wb") as f:
        f.write(bd.amxd_bytes(pj))
bd.CODE = good
bd.EMBED = bd.compact_code
bd.build()   # restore max/flock_main.maxpat
shutil.copy(os.path.join(ROOT, "js", "flock_ui.js"), os.path.join(OUT, bd.JSNAME))   # the name the patch asks for
open(os.path.join(OUT, "README_DIAG.txt"), "w", encoding="utf-8").write(
    "Положите на дорожки со звуком B, C, N1, N2, N3, N4 и напишите, какие звучат.\n")
zp = os.path.join(ROOT, "dist", "FLOCK_DIAG.zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(OUT)):
        z.write(os.path.join(OUT, f), "FLOCK_DIAG/" + f)
print(os.path.relpath(zp, ROOT))
