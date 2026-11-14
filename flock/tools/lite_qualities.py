#!/usr/bin/env python3
"""The four recording qualities rebuilt on the engine that runs in Max (v0.2.x "C"), in small
cumulative steps, without the v0.3 codec / core block structure (Max did not run it).
Q0 = C + AUTO off / output compensation; Q1 + formats & feedback; Q2 + wow & flutter;
Q3 + caveman reverb, gain soft clip, band limit; Q4 + buffer lengths and clear on change."""
import re, subprocess, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = subprocess.check_output(["git", "show", "7c2551c:flock/gen/flock.genexpr"], cwd=ROOT).decode()
CUR = open(os.path.join(ROOT, "gen", "flock.genexpr"), encoding="utf-8").read()


def func(name):
    a = CUR.index("\n" + name + "(") + 1
    return CUR[a:CUR.index("\n}\n", a) + 3]


def rep(s, a, b, cnt=1):
    assert s.count(a) == cnt, (a[:70], s.count(a))
    return s.replace(a, b)


def q0(s):
    s = rep(s, "Param agc(1, min=0, max=1);", "Param agc(0, min=0, max=1);")
    s = rep(s, "out1 = ml * lg * outgain;\nout2 = mr * lg * outgain;",
            "ocomp = agc > 0.5 ? 1 / ggain : 1;\nout1 = ml * lg * outgain * ocomp;\nout2 = mr * lg * outgain * ocomp;")
    return s.rstrip("\n") + "\nout12 = 0;\nout13 = -1;\n"


def q1(s):
    fs = "".join(func(n) + "\n" for n in ["q12", "mulaw", "soft_limit", "sclip"])
    s = rep(s, "\nParam time(", "\n" + fs + "Param time(")
    s = rep(s, "Param agc(0, min=0, max=1);", "Param agc(0, min=0, max=1);\nParam quality(0, min=0, max=3);")
    s = rep(s, "MAXD = 192000;", "MAXD = 192000;\nqi = clamp(floor(quality + 0.5), 0, 3);")
    s = rep(s, "sl = inl + prev_l * fbk * fbk * 3;\nsr = inr + prev_r * fbk * fbk * 3;",
            "slg = qi < 0.5 ? 0 : qi > 2.5 ? 1.75 : 1.3;\n"
            "sl = slg > 0 ? inl + prev_l * fbk * (3 / slg) : inl + prev_l * fbk * fbk * 3;\n"
            "sr = slg > 0 ? inr + prev_r * fbk * (3 / slg) : inr + prev_r * fbk * fbk * 3;")
    s = rep(s, "sl = sl * lg;\nsr = sr * lg;",
            "sl = sl * lg;\nsr = sr * lg;\nif (slg > 0) {\n\tsl = inl + fbk * (sclip(sl * slg) - inl);\n\tsr = inr + fbk * (sclip(sr * slg) - inr);\n}")
    s = rep(s, "\tql = q16(sl);\n\tqr = q16(sr);",
            "\tql = qi < 0.5 ? q16(sl) : qi < 2.5 ? q12(sl) : mulaw(sl);\n\tqr = qi < 0.5 ? q16(sr) : qi < 2.5 ? q12(sr) : mulaw(sr);")
    s = rep(s, "n_prev_l = prev_l + 0.999 * (hpl - prev_l);\nn_prev_r = prev_r + 0.999 * (hpr - prev_r);",
            "fblp = qi < 0.5 ? 0.999 : qi < 2.5 ? 0.9 : 0.75;\nn_prev_l = prev_l + fblp * (hpl - prev_l);\nn_prev_r = prev_r + fblp * (hpr - prev_r);")
    s = rep(s, "ml = dry * inl + wet * outl;\nmr = dry * inr + wet * outr;",
            "dryl = qi > 0.5 && qi < 1.5 ? trunc(inl * 4096) / 4096 : qi > 2.5 ? mulaw(inl) : inl;\n"
            "dryr = qi > 0.5 && qi < 1.5 ? trunc(inr * 4096) / 4096 : qi > 2.5 ? mulaw(inr) : inr;\n"
            "ml = dry * dryl + wet * outl;\nmr = dry * dryr + wet * outr;")
    return s


def q2(s):   # wow & flutter at the host rate: the module's 24 kHz times and depths, converted
    s = rep(s, "\nParam time(", "\n" + func("lsin") + "\nParam time(")
    s = rep(s, "Data sdl(1024, 1);", "Data wfl(1024, 2);\nData sdl(1024, 1);")
    s = rep(s, "History lastspd(1);", "History lastspd(1);\nHistory wf_rph(0);\nHistory wf_rf(0.0000052083333);\nHistory wf_wph(0);\nHistory wf_fph(0);\nHistory wf_del(0);\nHistory wf_inc(0);\nHistory wf_lpl(0);\nHistory wf_lpr(0);\nHistory wf_w(0);\nHistory wf_pend(0);")
    wow = '''// ---- wow & flutter (Scorched cassette): WowAndFlutter (24 kHz) converted to the host rate
wrph = wf_rph;
wrf = init < 0.5 ? 0.125 / FS : wf_rf;
wwph = wf_wph;
wfph = wf_fph;
wdel = wf_del;
winc = wf_inc;
wpend = wf_pend;
wlpl = wf_lpl;
wlpr = wf_lpr;
wwp = wf_w;
if (qi > 2.5) {
	if (newblk) {
		pph = wrph;
		wrph = wrph + wrf * BLK;
		wrph = wrph >= 1 ? wrph - 1 : wrph;
		wrm = 0.5 + 0.5 * lsin(wrph);
		wpend = wrph >= 0.25 && pph < 0.25;
		wfm = 0.5 + 1.5 * wrm * wrm;
		wam = 1 - 0.4 * wrm;
		wwph = wwph + (1 / FS) * 0.23 * BLK * wfm;
		wwph = wwph >= 1 ? wwph - 1 : wwph;
		wfph = wfph + (1 / FS) * 1.99 * BLK;
		wfph = wfph >= 1 ? wfph - 1 : wfph;
		wdt = (1 + (105 * (0.5 + 0.5 * lsin(wwph)) + 17 * (0.5 + 0.5 * lsin(wfph))) * wam) * FS / 24000;
		winc = (wdt - wdel) / BLK;
	}
	wdel = wdel + winc;
	poke(wfl, ml, wwp, 0);
	poke(wfl, mr, wwp, 1);
	wwp = wrapi(wwp - 1, 1024);
	wdi = trunc(wdel);
	wdf = wdel - wdi;
	wlc = 1 - pow(0.05, 24000 / FS);
	wa = peek(wfl, wrapi(wwp + wdi, 1024), 0);
	wlpl = wlpl + wlc * (wa + (peek(wfl, wrapi(wwp + wdi + 1, 1024), 0) - wa) * wdf - wlpl);
	wa = peek(wfl, wrapi(wwp + wdi, 1024), 1);
	wlpr = wlpr + wlc * (wa + (peek(wfl, wrapi(wwp + wdi + 1, 1024), 1) - wa) * wdf - wlpr);
	ml = wlpl;
	mr = wlpr;
	if (blk > BLK - 1.5 && wpend) {
		wrf = (1 / 24000) * (0.05 + rnd() * 0.2) * 24000 / FS;
		wpend = 0;
	}
}

'''
    s = rep(s, "// ---- pre-reverb limiter", wow + "// ---- pre-reverb limiter")
    s = s.rstrip("\n") + "\nwf_rph = wrph;\nwf_rf = wrf;\nwf_wph = wwph;\nwf_fph = wfph;\nwf_del = wdel;\nwf_inc = winc;\nwf_lpl = wlpl;\nwf_lpr = wlpr;\nwf_w = wwp;\nwf_pend = wpend;\n"
    return s


def q3(s):
    s = rep(s, "rtime = 0.3 + 0.6 * rva * rva * rva;\nrlp = 0.6;",
            "rtime = qi > 0.5 ? 0.45 + 0.5 * rva * rva * rva : 0.3 + 0.6 * rva * rva * rva;\nrlp = qi > 0.5 ? 0.4 : 0.6;")
    s = rep(s, "History lastspd(1);", "History lastspd(1);\nHistory s_sca(0);\nHistory i_sca(0);\nHistory bl1(0);\nHistory bl2(0);\nHistory br1(0);\nHistory br2(0);")
    s = rep(s, "\tgtarget = agc > 0.5 ? min(0.9 / min(gagc, 0.9), 40) : ingain;",
            "\tgopt = min(0.9 / min(gagc, 0.9), 40);\n\tgtarget = agc > 0.5 ? gopt : ingain;\n"
            "\tisca = ((qi > 2.5 ? 1 : qi > 1.5 ? clamp(2 * (ingain / gopt - 0.75), 0, 1) : 0) - s_sca) / BLK;")
    s = rep(s, "ginc = g_inc;", "ginc = g_inc;\nisca = i_sca;")
    s = rep(s, "inl = agc > 0.5 ? in1 * ggain : clamp(in1 * ggain, -1, 1);\ninr = agc > 0.5 ? in2 * ggain : clamp(in2 * ggain, -1, 1);",
            "sca = (agc < 0.5 && qi > 1.5) ? s_sca + isca : s_sca;\n"
            "// the codec's bandwidth: Cold digital 32 kHz (≈14 kHz), Scorched cassette 24 kHz (≈10 kHz): two one-poles\n"
            "bfc = qi > 0.5 && qi < 1.5 ? 14000 : 10000;\nbc = 1 - exp(-twopi * bfc / FS);\nbon = (qi > 0.5 && qi < 1.5) || qi > 2.5;\n"
            "nbl1 = bl1 + bc * (in1 - bl1);\nnbl2 = bl2 + bc * (nbl1 - bl2);\nnbr1 = br1 + bc * (in2 - br1);\nnbr2 = br2 + bc * (nbr1 - br2);\n"
            "xl = (bon ? nbl2 : in1) * ggain;\nxr = (bon ? nbr2 : in2) * ggain;\ncll = clamp(xl, -1, 1);\nclr = clamp(xr, -1, 1);\n"
            "inl = agc > 0.5 ? xl : (qi > 1.5 ? cll + ((1 - 0.05) * sclip(xl + 0.05) - 0.05 - cll) * sca : cll);\n"
            "inr = agc > 0.5 ? xr : (qi > 1.5 ? clr + ((1 - 0.05) * sclip(xr + 0.05) - 0.05 - clr) * sca : clr);")
    s = s.rstrip("\n") + "\ns_sca = sca;\ni_sca = isca;\nbl1 = nbl1;\nbl2 = nbl2;\nbr1 = nbr1;\nbr2 = nbr2;\n"
    return s


def q4(s):   # buffer length per quality (seconds of the module), clear on change by counting
    s = rep(s, "\nParam time(", "\n" + func("bvalid") + "\nParam time(")
    s = rep(s, "Data buf(192004, 2);", "Data buf(768004, 2);")
    s = rep(s, "MAXD = 192000;\nqi = clamp(floor(quality + 0.5), 0, 3);",
            "qr0 = clamp(floor(quality + 0.5), 0, 3);\n"
            "qi = (init > 0.5 && (freeze > 0.5 || was_frozen > 0.5)) ? qc : qr0;\n"
            "qchg = init > 0.5 && qi != qc;\n"
            "MAXD = qi < 0.5 ? 192000 : min(768000, floor((qi < 1.5 ? 8 : qi < 2.5 ? 10.6666667 : 16) * samplerate));")
    s = rep(s, "History lastspd(1);", "History lastspd(1);\nHistory qc(0);\nHistory nwr(0);")
    s = rep(s, "if (init < 0.5) {\n\tfor (k = 0; k < 32; k += 1) {", "if (init < 0.5 || qchg) {\n\tfor (k = 0; k < 32; k += 1) {")
    s = rep(s, "w = wp;\ntwp = tail_wp;\ntxf = tail_xf;", "w = qchg ? 0 : wp;\ntwp = qchg ? 0 : tail_wp;\ntxf = qchg ? 0 : tail_xf;\nwfz = qchg ? 0 : was_frozen;\nnwr0 = qchg ? 0 : nwr;\nnwr1 = nwr0;")
    s = rep(s, "\tif (was_frozen < 0.5) {", "\tif (wfz < 0.5) {")
    s = rep(s, "\tif (was_frozen > 0.5 && twp > 0) {", "\tif (wfz > 0.5 && twp > 0) {")
    s = rep(s, "\tw = w == 0 ? MAXD - 1 : w - 1;\n}", "\tw = w == 0 ? MAXD - 1 : w - 1;\n\tnwr1 = min(nwr0 + 1, MAXD + 1);\n}")
    for ch, c in (("l", 0), ("r", 1)):
        for t in range(4):
            off = "" if t == 0 else " + %d" % t
            s = rep(s, "x%s%d = peek(buf, idx%s, %d);" % (ch, t, off, c), "x%s%d = bvalid(idx%s, nwr1, MAXD) > 0.5 ? peek(buf, idx%s, %d) : 0;" % (ch, t, off, off, c))
    s = s.rstrip("\n") + "\nqc = qi;\nnwr = nwr1;\n"
    return s


STEPS = [("Q0", q0), ("Q1", q1), ("Q2", q2), ("Q3", q3), ("Q4", q4)]


def variants():
    out, s = [], C
    for name, f in STEPS:
        s = f(s)
        out.append((name, s))
    return out


if __name__ == "__main__":
    for name, s in variants():
        open(os.path.join(os.environ.get("OUTDIR", "/tmp"), name + ".genexpr"), "w").write(s)
        print(name, len(s))
