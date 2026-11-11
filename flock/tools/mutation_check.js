#!/usr/bin/env node
// CONTROL OF THE TESTS: breaks the gen~ code on purpose in places the matrix relies on and
// checks that the test suite FAILS for every mutation. A surviving mutation = a blind test.
// Run: npm run verify   (slow; not part of npm test)
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "gen", "flock.genexpr");
const MUTATIONS = [
  ["divider: last division 16 → 15", "q < 6.5 ? 12 : 16;", "q < 6.5 ? 12 : 15;"],
  ["divider: probability slope 2.15 → 2.2", "max((dens - 0.52) * 2.15, 0)", "max((dens - 0.52) * 2.2, 0)"],
  ["density CV: expo band 0.225 → 0.23", "(abs(st_dens - 0.5) - 0.225)", "(abs(st_dens - 0.5) - 0.23)"],
  ["assign CV low-pass 0.1 → 0.12", "k1 = init < 0.5 ? 1 : newblk ? 0.1 : 0;", "k1 = init < 0.5 ? 1 : newblk ? 0.12 : 0;"],
  ["grain pan law", "poke(gr, (1 - pn) * (1 + pn) * amp, g0, 11);", "poke(gr, (1 - pn) * (1.01 + pn) * amp, g0, 11);"],
  ["envelope smoothness", "at < 0.5 ? 2 * at : 2 - 2 * at", "at < 0.5 ? 2.1 * at : 2 - 2 * at"],
  ["fixed point speed", "trunc(speed * 1024) / 1024", "speed"],
  ["feedback gain 3 → 2.9", "prev_l * fbk * fbk * 3", "prev_l * fbk * fbk * 2.9"],
  ["reverb diffuser coefficient", "kap = 0.625;", "kap = 0.62;"],
  ["random pan spread", "min(0.5 * nact * spread * v, 1)", "min(0.45 * nact * spread * v, 1)"],
  ["trigger max frequency (C3)", "maxf = 130.81278 / FS;", "maxf = 131 / FS;"],
  ["voice stealing fade", "inst = trunc(FS * 0.005);", "inst = trunc(FS * 0.006);"],
  ["freeze tail crossfade", "g = sstep(twp / txf);", "g = twp / txf;"],
  ["pitch notch table", "n < 4.5 ? 7 : n < 5.5 ? 12", "n < 4.5 ? 7 : n < 5.5 ? 11"],
  ["TIME hysteresis 0.001 → 0.002", "th_err > 0.001 ? st_time - 0.001", "th_err > 0.002 ? st_time - 0.002"],
  ["SEED input delay 10 → 9 blocks", "peek(sdl, wrapi(sdw - BLK * 10, 1024), 0)", "peek(sdl, wrapi(sdw - BLK * 9, 1024), 0)"],
  ["block size sr/4000 → sr/3000", "BLK = floor(FS / 4000 + 0.5);", "BLK = floor(FS / 3000 + 0.5);"],
  ["synced sources not ahead of the SEED delay", "dph * floor(FS / 4000 + 0.5) * 10", "dph * floor(FS / 4000 + 0.5) * 9"],
  ["ENV release 0.15 → 0.2 s", "1 - exp(-1 / (0.15 * FS))", "1 - exp(-1 / (0.2 * FS))"],
  ["LFO free rate law", "l1f = fract(l1_ph + 0.02 * pow(1000, l1_rate) / FS);", "l1f = fract(l1_ph + 0.021 * pow(1000, l1_rate) / FS);"],
];
const good = fs.readFileSync(FILE, "utf8");
let survived = 0;
try {
  for (const [name, a, b] of MUTATIONS) {
    if (!good.includes(a)) { console.log("NOT FOUND (update the list): " + name); survived++; continue; }
    fs.writeFileSync(FILE, good.replace(a, b));
    let failed = false;
    try { execSync("node --test tests/engine.test.js tests/reference.test.js", { cwd: ROOT, stdio: "pipe" }); } catch (e) { failed = true; }
    console.log((failed ? "caught    " : "SURVIVED  ") + name);
    if (!failed) survived++;
  }
} finally { fs.writeFileSync(FILE, good); }
console.log(survived ? `${survived} mutation(s) survived — the tests are blind there` : "all mutations caught");
process.exit(survived ? 1 : 0);
