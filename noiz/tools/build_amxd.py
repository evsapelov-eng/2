#!/usr/bin/env python3
"""Packs the generated patches into ready-to-drop Max for Live INSTRUMENT files.

Output: dist/NOIZ/ — NØIZ.amxd, NØIZ P1 hello.amxd and every dependency next to
them (Max finds abstractions/js files in the device's own folder), plus a zip.

HONEST STATUS: these .amxd files are written by this script (container 'ampf',
device type 'iiii' = Max Instrument, 'ptch' = the patcher JSON), NOT saved
natively by Max inside Live, and NOT frozen. Spec §16.1 forbids presenting such a
file as a verified plugin — it is a test build. If Live refuses it, use the
native route in docs/HOST_TEST_GUIDE.md (same patches, saved by Live).
"""
import json
import os
import shutil
import struct
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXDIR = os.path.join(ROOT, "max")
DIST = os.path.join(ROOT, "dist")
PKG = os.path.join(DIST, "NOIZ")
VERSION = json.load(open(os.path.join(ROOT, "package.json")))["version"]

DEPENDENCIES = ["noiz_engine.js", "noiz_ui.js", "noiz_voice_hiss.maxpat", "noiz_voice_dust.maxpat",
                "noiz_voice_metal.maxpat", "noiz_voice_atmos.maxpat"]


def amxd_bytes(patcher_json, device_type=b"iiii"):
    """ampf container: 'ampf' u32(4) <type> 'meta' u32(4) 00000000 'ptch' u32(len) <json>\\n\\0"""
    payload = json.dumps(patcher_json, indent=1, ensure_ascii=False).encode("utf-8") + b"\n\x00"
    return (b"ampf" + struct.pack("<I", 4) + device_type +
            b"meta" + struct.pack("<I", 4) + b"\x00\x00\x00\x00" +
            b"ptch" + struct.pack("<I", len(payload)) + payload)


def read_amxd(data):
    assert data[:4] == b"ampf", "not an ampf container"
    dtype = data[8:12]
    assert data[12:16] == b"meta"
    mlen = struct.unpack("<I", data[16:20])[0]
    off = 20 + mlen
    assert data[off:off + 4] == b"ptch"
    plen = struct.unpack("<I", data[off + 4:off + 8])[0]
    payload = data[off + 8:off + 8 + plen]
    assert len(payload) == plen and payload.endswith(b"\x00")
    return dtype, json.loads(payload[:-1].decode("utf-8"))


def as_device(path, deps):
    pj = json.load(open(path, encoding="utf-8"))
    p = pj["patcher"]
    p["openinpresentation"] = 1
    params = {}
    for b in p["boxes"]:
        box = b["box"]
        if box.get("parameter_enable"):
            va = box.get("saved_attribute_attributes", {}).get("valueof", {})
            params[box["id"]] = [va.get("parameter_longname", box.get("varname")),
                                 va.get("parameter_shortname", box.get("varname")), 0]
    if params:
        params["inherited_shortname"] = 1
        p["parameters"] = params
    p["dependency_cache"] = [{"name": d, "type": "TEXT" if d.endswith(".js") else "JSON", "implicit": 1}
                             for d in deps]
    p["autosave"] = 0
    return pj


def main():
    if os.path.exists(PKG):
        shutil.rmtree(PKG)
    os.makedirs(PKG)
    devices = [
        ("NØIZ.amxd", "noiz_main.maxpat", DEPENDENCIES),
        ("NØIZ P1 hello.amxd", "p1_hello_hiss.maxpat", []),
    ]
    for out_name, src, deps in devices:
        data = amxd_bytes(as_device(os.path.join(MAXDIR, src), deps))
        with open(os.path.join(PKG, out_name), "wb") as f:
            f.write(data)
        dtype, back = read_amxd(data)  # self-check: container round-trips
        assert dtype == b"iiii" and back["patcher"]["boxes"]
    for d in DEPENDENCIES:
        shutil.copy(os.path.join(MAXDIR, d), os.path.join(PKG, d))
    shutil.copy(os.path.join(ROOT, "dist_README.txt"), os.path.join(PKG, "README_FIRST.txt"))
    zpath = os.path.join(DIST, "NOIZ_v%s_test_build.zip" % VERSION)
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(PKG)):
            z.write(os.path.join(PKG, f), "NOIZ/" + f)
    for f in sorted(os.listdir(PKG)):
        print("dist/NOIZ/" + f)
    print(os.path.relpath(zpath, ROOT))


if __name__ == "__main__":
    main()
