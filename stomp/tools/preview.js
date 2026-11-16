// Renders the panel to SVG (node, mgraphics shim) — for screenshots and the UI tests. NOT Max.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const { makeShim } = require("../tests/shim");
function boot(setup) {
  const mg = makeShim(1100, 169), out = [];
  const ctx = vm.createContext({ mgraphics: mg, outlet(...a) { out.push(a); }, post() {}, Task: function () { this.repeat = () => {}; this.cancel = () => {}; } });
  // Max's [jsui] is ES5: remove what it does not have, so the tests fail where Max would
  vm.runInContext("['tanh','sinh','cosh','log10','log2','sign','cbrt','hypot','trunc','fround','expm1','log1p'].forEach(function (k) { delete Math[k]; });" +
    "delete Array.prototype.includes; delete Array.prototype.find; delete Array.prototype.fill; delete Array.prototype.findIndex; delete String.prototype.includes;" +
    "delete String.prototype.padStart; delete String.prototype.repeat; delete Object.assign; delete Object.entries; delete Object.values;", ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "stomp_ui.js"), "utf8"), ctx);
  if (setup) vm.runInContext(setup, ctx);
  return { ctx, mg, out, svg() { mg.reset(); ctx.paint(); return mg.svg(); } };
}
module.exports = { boot };
if (require.main === module) {
  const dir = process.argv[2] || ".";
  const a = boot("note(36, 120); hitT = now() - 90;");
  fs.writeFileSync(path.join(dir, "stomp_main.svg"), a.svg());
  const b = boot("patchMode = true; selSrc = 0;");
  fs.writeFileSync(path.join(dir, "stomp_patch.svg"), b.svg());
}
