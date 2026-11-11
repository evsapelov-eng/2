#!/usr/bin/env node
// Checks docs/FEATURE_MATRIX.md against the code and tests (runs inside `npm test`).
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function rows() {
  const md = fs.readFileSync(path.join(ROOT, "docs", "FEATURE_MATRIX.md"), "utf8");
  return md.split("\n").filter((l) => /^\| [A-Z]\d+ \|/.test(l)).map((l) => {
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    return { id: c[0], beads: c[1], flock: c[2], test: c[3], status: c[4] };
  });
}
function testNames() {
  const dir = path.join(ROOT, "tests"), names = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".test.js"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/test\(\s*(["`'])((?:(?!\1).)+)\1/g)) names.push(m[2].replace(/\$\{[^}]*\}/g, ""));
    // case tables: [ ["name", …], … ] expanded into one test per row
    for (const m of src.matchAll(/^\s*\["([^"]+)",/gm)) names.push(m[1]);
  }
  return names;
}
function check() {
  const errs = [], R = rows(), T = testNames();
  if (R.length < 30) errs.push("matrix has only " + R.length + " rows");
  const ids = new Set();
  for (const r of R) {
    if (ids.has(r.id)) errs.push("duplicate id " + r.id);
    ids.add(r.id);
    if (!/^(DONE|PARTIAL|DEVIATION|N\/A|PLANNED v0\.\d)$/.test(r.status)) errs.push(`${r.id}: bad status '${r.status}'`);
    if (/^(DONE|PARTIAL|DEVIATION)$/.test(r.status)) {
      if (!r.test || r.test === "—") errs.push(`${r.id}: ${r.status} without a test`);
      else if (/^`?npm run \w+`?$/.test(r.test)) {
        const script = r.test.replace(/`/g, "").split(" ")[2], pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
        if (!pkg.scripts[script]) errs.push(`${r.id}: no npm script '${script}'`);
      }
      else if (!/^`?npm run/.test(r.test) && !T.some((t) => t.startsWith(r.test) || t.includes(r.test))) errs.push(`${r.id}: no test named like '${r.test}'`);
    }
  }
  // every Live parameter of the device is in the matrix
  const patch = JSON.parse(fs.readFileSync(path.join(ROOT, "max", "flock_main.maxpat"), "utf8")).patcher;
  const params = patch.boxes.map((b) => b.box).filter((b) => b.parameter_enable).map((b) => b.varname);
  const flockText = R.map((r) => r.flock).join(" ");
  for (const p of params) if (!flockText.includes("`" + p + "`")) errs.push(`Live parameter '${p}' is not in the matrix`);
  return { errs, rows: R };
}
module.exports = { check, rows };
if (require.main === module) {
  const { errs, rows: R } = check();
  const by = {}; R.forEach((r) => { const k = r.status.split(" ")[0]; by[k] = (by[k] || 0) + 1; });
  console.log("matrix:", R.length, "rows", JSON.stringify(by));
  if (errs.length) { console.log(errs.join("\n")); process.exit(1); }
  console.log("matrix OK");
}
