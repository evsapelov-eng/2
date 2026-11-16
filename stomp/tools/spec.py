"""STØMP — the one table of sound parameters.

tools/make_engine.py writes from it: the Params + modulation block of gen/stomp.genexpr and the
SPEC block of js/stomp_ui.js. tools/build_device.py makes the Live parameters from it.
Every sound knob is 0..1 inside the engine; the maps to ms / Hz / dB are in the engine
(gen/voice.part.genexpr) and, the same formulas, in the panel (js/stomp_ui.js valueText / model).
"""

# (name, section, panel label, Live long name, default)
KNOBS = [
    ("amp_len", "AMP", "LENGTH", "Length", 0.52),
    ("amp_att", "AMP", "ATTACK", "Attack", 0.0),
    ("amp_crv", "AMP", "CURVE", "Amp Curve", 0.38),
    ("pit_swp", "PITCH", "SWEEP", "Sweep", 0.55),
    ("pit_time", "PITCH", "TIME", "Sweep Time", 0.42),
    ("pit_crv", "PITCH", "CURVE", "Sweep Curve", 0.62),
    ("clk_amt", "CLICK", "CLICK", "Click", 0.35),
    ("clk_tone", "CLICK", "TONE", "Click Tone", 0.45),
    ("nz_amt", "NOISE", "NOISE", "Noise", 0.12),
    ("nz_col", "NOISE", "COLOR", "Noise Color", 0.55),
    ("nz_dec", "NOISE", "DECAY", "Noise Decay", 0.25),
    ("hm_amt", "HARM", "PARTIALS", "Partials", 0.15),
    ("hm_spr", "HARM", "SPREAD", "Spread", 0.0),
    ("dr_amt", "DRIVE", "DRIVE", "Drive", 0.35),
    ("dr_knee", "DRIVE", "HARD", "Drive Hard", 0.25),
    ("fm_amt", "FM", "FM", "FM", 0.08),
    ("fm_rat", "FM", "RATIO", "FM Ratio", 0.2),
    ("fm_dec", "FM", "DECAY", "FM Decay", 0.35),
    ("wd_amt", "STEREO", "WIDTH", "Width", 0.0),
    ("sp_amt", "STEREO", "SPACE", "Space", 0.0),
    ("sp_time", "STEREO", "SIZE", "Space Size", 0.35),
    ("level", "OUT", "LEVEL", "Level", 0.75),
    ("tune", "OUT", "TUNE", "Tune", 0.5),
]
NAMES = [k[0] for k in KNOBS]

# modulation sources: global amount knobs (not modulation destinations themselves)
SOURCES = [("vel_amt", "VELOCITY", "Velocity Amount", 0.5), ("rnd_amt", "RANDOM", "Random Amount", 0.5)]

# default cables: depth −1..1 per destination (v_ = velocity, r_ = random)
DEPTH_DEFAULTS = {"v_level": 1.0, "v_clk_amt": 0.6, "v_dr_amt": 0.3, "r_clk_tone": 0.3, "r_nz_col": 0.3, "r_pit_swp": 0.1}


def depth_names():
    out = []
    for pre in ("v_", "r_"):
        for n in NAMES:
            out.append(pre + n)
    return out
