#!/usr/bin/env python3
"""Diagnostic kit 5: the working engine C (v0.2.x) + ONE construct of the v0.3 engine each, to find
the construct Max does not accept. Writes dist/FLOCK_DIAG.zip (the kit of build_diag.py is replaced)."""
import json, os, re, shutil, subprocess, sys, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import build_device as bd

ROOT = bd.ROOT
OUT = os.path.join(ROOT, "dist", "FLOCK_DIAG")
C = subprocess.check_output(["git", "show", "7c2551c:flock/gen/flock.genexpr"], cwd=ROOT).decode()
CUR = open(os.path.join(ROOT, "gen", "flock.genexpr"), encoding="utf-8").read()


def func_text(name):
    a = CUR.index("\n" + name + "(") + 1
    b = CUR.index("\n}\n", a) + 3
    return CUR[a:b]


def k1_data(code):       # all new Data blocks (+ the big buffer), not used
    code = code.replace("Data buf(192004, 2);", "Data buf(384004, 2);")
    extra = "".join(l + "\n" for l in re.findall(r"^Data (?:ck|hin|eo|srcf|gdn|gup|wfl|acs|cx)\(.*?;", CUR, re.M))
    return code.replace("Data sdl(1024, 1);", extra + "Data sdl(1024, 1);")


def k2_outputs(code):    # outputs written into a Data and read back at the end
    code = code.replace("Data sdl(1024, 1);", "Data cx(16, 1);\nData sdl(1024, 1);")
    for n in range(1, 12):
        code = re.sub(r"^out%d = (.*);$" % n, r"poke(cx, \1, %d, 0);" % n, code, flags=re.M)
    return code.rstrip("\n") + "\n" + "".join("out%d = peek(cx, %d, 0);\n" % (n, n) for n in range(1, 12))


def k3_block(code):      # the whole per-sample body inside if (ctk) { }, History via nh_*, outputs via Data
    code = k2_outputs(code)
    a = code.index("j = 0;\n") + len("j = 0;\n")
    b = code.index("\nout1 = peek(cx, 1, 0);")
    hs = set(re.findall(r"^History (\w+)\(", code, re.M))
    block = code[a:b]
    written = []

    def sub(m):
        if m.group(2) in hs:
            if m.group(2) not in written:
                written.append(m.group(2))
            return m.group(1) + "nh_" + m.group(2) + " = "
        return m.group(0)
    block = re.sub(r"(^[ \t]*)(\w+) = ", sub, block, flags=re.M)
    pre = "ctk = samplerate > 0;\n" + "".join("nh_%s = %s;\n" % (n, n) for n in written) + "if (ctk) {\n"
    post = "\n}\n" + "".join("%s = nh_%s;\n" % (n, n) for n in written)
    return code[:a] + pre + block + post + code[b:]


def k4_host(code):       # host stage: input ring + kernel table + converter loop (runs only for qtest = 1)
    code = k1_data(code)
    code = code.replace("Param agc(1, min=0, max=1);", "Param agc(1, min=0, max=1);\nParam qtest(0, min=0, max=1);")
    code = code.replace("History lastspd(1);", "History lastspd(1);\nHistory hinit(0);\nHistory hw(0);")
    for f in ["bessel_i0", "csinc"]:
        code = code.replace("\nParam time(", "\n" + func_text(f) + "Param time(", 1)
    a = code.index("j = 0;\n") + len("j = 0;\n")
    host = """if (hinit < 0.5) {
	for (k = 0; k < 4097; k += 1) {
		poke(ck, csinc(k / 256), k, 0);
	}
}
poke(hin, in1, hw, 0);
poke(hin, in2, hw, 1);
ein1 = in1;
if (qtest > 0.5) {
	poke(acs, 0, 0, 0);
	poke(acs, 0, 2, 0);
	for (k = 0; k < 66; k += 1) {
		ka = abs(0.5 * k - 16) * 256;
		ki = floor(ka);
		if (ki < 4096) {
			wk = peek(ck, ki, 0) + (peek(ck, ki + 1, 0) - peek(ck, ki, 0)) * (ka - ki);
			poke(acs, peek(acs, 0, 0) + peek(hin, wrapi(hw - k, 512), 0) * wk, 0, 0);
			poke(acs, peek(acs, 2, 0) + wk, 2, 0);
		}
	}
	ein1 = peek(acs, 0, 0) / peek(acs, 2, 0);
}
nhw = wrapi(hw + 1, 512);
"""
    code = code[:a] + host + code[a:]
    code = code.replace("gpk = max(abs(in1), abs(in2));", "gpk = max(abs(ein1), abs(in2));")
    return code.rstrip("\n") + "\nhinit = 1;\nhw = nhw;\n"


def k5_functions(code):  # the new sample-format helpers, used in the buffer write
    for f in ["q12", "mulaw", "soft_limit", "sclip", "lsin"]:
        code = code.replace("\nParam time(", "\n" + func_text(f) + "Param time(", 1)
    code = code.replace("Param agc(1, min=0, max=1);", "Param agc(1, min=0, max=1);\nParam qtest(0, min=0, max=3);")
    code = code.replace("ql = q16(sl);", "ql = qtest < 0.5 ? q16(sl) : qtest < 1.5 ? q12(sl) : mulaw(sl);")
    code = code.replace("qr = q16(sr);", "qr = qtest < 0.5 ? q16(sr) : qtest < 1.5 ? q12(sr) : mulaw(sr) + sclip(0) + lsin(0);")
    return code


def k4a_input_ring(code):   # only: the inputs written into a Data ring every sample (index = History)
    code = code.replace("Data sdl(1024, 1);", "Data hin(512, 2);\nData sdl(1024, 1);")
    code = code.replace("History lastspd(1);", "History lastspd(1);\nHistory hw(0);")
    a = code.index("j = 0;\n") + len("j = 0;\n")
    code = code[:a] + "poke(hin, in1, hw, 0);\npoke(hin, in2, hw, 1);\nnhw = wrapi(hw + 1, 512);\n" + code[a:]
    return code.rstrip("\n") + "\nhw = nhw;\n"


def k4b_loop(code):         # only: the converter loop (never runs: qtest = 0), Data reads with a History index
    code = code.replace("Data sdl(1024, 1);", "Data hin(512, 2);\nData ck(4100, 1);\nData acs(8, 1);\nData sdl(1024, 1);")
    code = code.replace("Param agc(1, min=0, max=1);", "Param agc(1, min=0, max=1);\nParam qtest(0, min=0, max=1);")
    code = code.replace("History lastspd(1);", "History lastspd(1);\nHistory hw(0);")
    a = code.index("j = 0;\n") + len("j = 0;\n")
    loop = """ein1 = in1;
if (qtest > 0.5) {
	poke(acs, 0, 0, 0);
	poke(acs, 0, 2, 0);
	for (k = 0; k < 66; k += 1) {
		ka = abs(0.5 * k - 16) * 256;
		ki = floor(ka);
		if (ki < 4096) {
			wk = peek(ck, ki, 0) + (peek(ck, ki + 1, 0) - peek(ck, ki, 0)) * (ka - ki);
			poke(acs, peek(acs, 0, 0) + peek(hin, wrapi(hw - k, 512), 0) * wk, 0, 0);
			poke(acs, peek(acs, 2, 0) + wk, 2, 0);
		}
	}
	ein1 = peek(acs, 0, 0) / peek(acs, 2, 0);
}
"""
    code = code[:a] + loop + code[a:]
    return code.replace("gpk = max(abs(in1), abs(in2));", "gpk = max(abs(ein1), abs(in2));")


def k4c_init(code):         # only: the kernel table filled on the first sample (functions called in a loop)
    code = code.replace("Data sdl(1024, 1);", "Data ck(4100, 1);\nData sdl(1024, 1);")
    code = code.replace("History lastspd(1);", "History lastspd(1);\nHistory hinit(0);")
    for f in ["bessel_i0", "csinc"]:
        code = code.replace("\nParam time(", "\n" + func_text(f) + "Param time(", 1)
    a = code.index("j = 0;\n") + len("j = 0;\n")
    code = code[:a] + "if (hinit < 0.5) {\n\tfor (k = 0; k < 4097; k += 1) {\n\t\tpoke(ck, csinc(k / 256), k, 0);\n\t}\n}\n" + code[a:]
    return code.rstrip("\n") + "\nhinit = 1;\n"


def k4d_functions_only(code):   # only: the two functions defined and called once per sample (no loop)
    for f in ["bessel_i0", "csinc"]:
        code = code.replace("\nParam time(", "\n" + func_text(f) + "Param time(", 1)
    return code.replace("gpk = max(abs(in1), abs(in2));", "gpk = max(abs(in1), abs(in2)) + csinc(16);")


VARIANTS = [("C_engine_v02x", C), ("K4_host_stage", k4_host(C)), ("K4a_input_ring", k4a_input_ring(C)),
            ("K4b_converter_loop", k4b_loop(C)), ("K4c_table_init", k4c_init(C)), ("K4d_functions_only", k4d_functions_only(C))]

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
    open(os.path.join(OUT, "..", "_diag_%s.gen" % name), "w", encoding="utf-8").write(bd.embed_code(code))
bd.CODE = good
bd.EMBED = bd.compact_code
bd.build()
shutil.copy(os.path.join(ROOT, "js", "flock_ui.js"), os.path.join(OUT, bd.JSNAME))
open(os.path.join(OUT, "README_DIAG.txt"), "w", encoding="utf-8").write(
    "Положите на дорожки со звуком C, K4, K4a, K4b, K4c, K4d и напишите, какие звучат.\n")
zp = os.path.join(ROOT, "dist", "FLOCK_DIAG.zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(OUT)):
        z.write(os.path.join(OUT, f), "FLOCK_DIAG/" + f)
print(os.path.relpath(zp, ROOT))
