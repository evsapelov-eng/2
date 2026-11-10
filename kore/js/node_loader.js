// Loads the exact ES5 sources that are concatenated into max/noiz_engine.js,
// in a fresh VM context, so Node tests run the same code Max runs.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "src");

function sourceFiles() {
  return fs.readdirSync(SRC).filter((f) => f.endsWith(".js")).sort().map((f) => path.join(SRC, f));
}

function loadCore() {
  const ctx = vm.createContext({});
  // same order as js/build.js: DSP map, shared voice model, then the core sources
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "spec", "dsp_map.json"), "utf8"));
  vm.runInContext("var KORE_DSP_MAP = " + JSON.stringify(map) + ";", ctx);
  const shared = path.join(__dirname, "shared", "kore_dsp_model.js");
  vm.runInContext(fs.readFileSync(shared, "utf8"), ctx, { filename: shared });
  for (const f of sourceFiles()) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  return ctx;
}

module.exports = { loadCore, sourceFiles };
