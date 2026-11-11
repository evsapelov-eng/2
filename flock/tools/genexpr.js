// FLØCK — runs gen~ codebox (GenExpr) code in node for tests. NOT Max.
//
// The engine (gen/flock.genexpr) is written in a deliberately small GenExpr subset so that
// this translator can execute the very same text:
//   - top-level declarations:  Param n(default[, min=..][, max=..]);  History n(v);  Data n(len, ch);
//   - helper functions before the body:  name(a, b) { ...; return x; }   (pure math, no state)
//   - body statements: assignments, if/else, for (i = a; i < b; i += 1), ternary, C operators
//   - builtins: in1..inN, out1..outN, samplerate, noise(), peek(d, i, ch), poke(d, v, i, ch), dim(d),
//     min max clamp abs floor ceil trunc fract sqrt exp log pow sin cos tan atan tanh sign
// It also LINTS the rules we rely on for portability to real gen~:
//   - a History is never read after it was written in the same pass (write-at-end discipline),
//   - a local first assigned inside a block is not used outside that block,
//   - no ++/--, no JS-only syntax.
"use strict";

const BUILTINS = new Set(["min", "max", "clamp", "abs", "floor", "ceil", "trunc", "fract", "sqrt", "exp", "log",
  "pow", "sin", "cos", "tan", "atan", "tanh", "sign", "noise", "peek", "poke", "dim", "samplerate", "pi", "twopi"]);
const KEYWORDS = new Set(["if", "else", "for", "return", "while"]);
// gen~ operator / constant names that must not be reused for Params, Histories, Data, locals or functions
const RESERVED = new Set(("gate latch delay elapsed e E mix smoothstep step rate wrap fold phasor history counter accum " +
  "plusequals change delta sah scale clip round int bool sample lookup wave interp dcblock slide train triangle cycle " +
  "selector switch not and or xor neg pass in out param data buffer ln log2 log10 exp2 mstosamps sampstoms t60 t60time " +
  "fixnan fixdenorm isnan isdenorm mean minimum maximum degrees radians atodb dbtoa ftom mtof cartopol poltocar " +
  "halfpi invpi ln2 ln10 log2e log10e sqrt2 sqrt1_2 degtorad radtodeg PI TWOPI vectorsize voice channels splat " +
  "absdiff hypot round floor ceil trunc fract sqrt exp log pow sin cos tan atan atan2 tanh sign min max clamp abs noise " +
  "peek poke dim samplerate pi twopi gt lt gte lte eq neq mod div mul add sub").split(" "));

function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""); }

// split top level into declarations, functions and body
function parse(src) {
  const s = stripComments(src);
  const decl = { params: {}, history: {}, data: {} }, funcs = [];
  let body = "", i = 0;
  const declRe = /^\s*(Param|History|Data)\s+(\w+)\s*\(([^)]*)\)\s*;/;
  const funcRe = /^\s*(\w+)\s*\(([^)]*)\)\s*\{/;
  while (i < s.length) {
    const rest = s.slice(i);
    let m = rest.match(declRe);
    if (m) {
      const args = m[3].split(",").map((x) => x.trim()).filter(Boolean);
      if (m[1] === "Param") {
        const p = { def: +args[0] || 0 };
        for (const a of args.slice(1)) { const kv = a.split("="); p[kv[0].trim()] = +kv[1]; }
        decl.params[m[2]] = p;
      } else if (m[1] === "History") decl.history[m[2]] = +args[0] || 0;
      else decl.data[m[2]] = { len: Math.round(evalConst(args[0])), ch: Math.round(evalConst(args[1] || "1")) };
      i += m[0].length; continue;
    }
    m = rest.match(funcRe);
    if (m && !KEYWORDS.has(m[1]) && body.trim() === "") {
      // function definition: find the matching brace
      let depth = 0, j = rest.indexOf("{");
      for (; j < rest.length; j++) { if (rest[j] === "{") depth++; else if (rest[j] === "}") { depth--; if (depth === 0) break; } }
      funcs.push({ name: m[1], args: m[2].split(",").map((x) => x.trim()).filter(Boolean), body: rest.slice(rest.indexOf("{") + 1, j) });
      i += j + 1; continue;
    }
    body = rest; break;
  }
  return { decl, funcs, body };
}
function evalConst(x) { return Function("return (" + x + ");")(); }

// --- lint: scope of locals and History read-after-write -------------------------------
function lint(body, decl, where) {
  const errors = [];
  if (/\+\+|--/.test(body)) errors.push(where + ": ++/-- are not allowed");
  if (/\b(let|var|const|function|=>|===|!==)\b|=>|===|!==/.test(body)) errors.push(where + ": JS-only syntax");
  // tokens with block depth
  const toks = body.match(/[A-Za-z_]\w*|[{}]|[+\-*/]?=(?!=)|==|;|\S/g) || [];
  const written = new Set();
  let depth = 0;
  const hist = decl.history;
  const scopes = [new Set()];  // block scopes: an assignment to an invisible name declares it here
  const visible = (t) => scopes.some((sc) => sc.has(t));
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t === "{") { depth++; scopes.push(new Set()); continue; }
    if (t === "}") { scopes.pop(); depth--; continue; }
    if (!/^[A-Za-z_]/.test(t)) continue;
    const next = toks[k + 1] || "";
    const isAssign = /^[+\-*/]?=$/.test(next);
    const isCall = next === "(";
    if (KEYWORDS.has(t) || BUILTINS.has(t) || isCall || decl.params[t] || decl.data[t] || /^(in|out)\d+$/.test(t)) continue;
    if (hist.hasOwnProperty(t)) {
      if (isAssign && next === "=") written.add(t);
      else if (written.has(t)) errors.push(`${where}: History '${t}' read after it was written in the same pass`);
      continue;
    }
    if (isAssign && next === "=" && !visible(t)) { scopes[scopes.length - 1].add(t); continue; }
    if (!visible(t)) errors.push(`${where}: local '${t}' used outside the block where it was assigned`);
  }
  return errors;
}

// --- translation ------------------------------------------------------------------------
function translateBody(body, decl, locals) {
  let out = body;
  // identifiers → state references (word boundary, not after '.')
  out = out.replace(/(^|[^.\w])([A-Za-z_]\w*)\b/g, (m0, pre, id) => {
    if (decl.params[id]) return pre + "P." + id;
    if (decl.history.hasOwnProperty(id)) return pre + "H." + id;
    if (decl.data[id]) return pre + "D." + id;
    let mm = id.match(/^in(\d+)$/); if (mm) return pre + "I[" + (mm[1] - 1) + "]";
    mm = id.match(/^out(\d+)$/); if (mm) return pre + "O[" + (mm[1] - 1) + "]";
    if (id === "samplerate") return pre + "SR";
    if (id === "pi") return pre + "Math.PI";
    if (id === "twopi") return pre + "(2*Math.PI)";
    return pre + id;
  });
  const assigned = new Set();
  (body.match(/([A-Za-z_]\w*)\s*[+\-*/]?=(?!=)/g) || []).forEach((m) => {
    const id = m.match(/[A-Za-z_]\w*/)[0];
    if (!decl.params[id] && !decl.history.hasOwnProperty(id) && !decl.data[id] && !/^out\d+$/.test(id)) assigned.add(id);
  });
  (locals || []).forEach((x) => assigned.delete(x));
  return (assigned.size ? "var " + Array.from(assigned).join(",") + ";\n" : "") + out;
}

function compile(src, opts = {}) {
  const { decl, funcs, body } = parse(src);
  const errors = lint(body, decl, "body");
  for (const f of funcs) {
    const fl = lint(f.body.replace(/\breturn\b/g, ""), { params: {}, history: {}, data: {} }, "function " + f.name);
    // function args count as assigned
    errors.push(...fl.filter((e) => !f.args.some((a) => e.includes(`'${a}'`))));
  }
  const names = [].concat(Object.keys(decl.params), Object.keys(decl.history), Object.keys(decl.data), funcs.map((f) => f.name));
  const localRe = /([A-Za-z_]\w*)\s*=(?!=)/g;
  for (const src of [body].concat(funcs.map((f) => f.body + " " + f.args.map((a) => a + " = 0").join(" ")))) {
    let m; while ((m = localRe.exec(src))) names.push(m[1]);
  }
  for (const n of new Set(names)) if (RESERVED.has(n)) errors.push(`name '${n}' is a gen~ operator/constant — rename it`);
  if (errors.length) throw new Error("GenExpr lint:\n  " + errors.join("\n  "));
  const helpers = funcs.map((f) => `function ${f.name}(${f.args.join(",")}){${translateBody(f.body, { params: {}, history: {}, data: {} }, f.args)}}`).join("\n");
  const code = `
    "use strict";
    const {min, max, abs, floor, ceil, trunc, sqrt, exp, log, pow, sin, cos, tan, atan, tanh, sign} = Math;
    const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
    const fract = (x) => x - Math.floor(x);
    const noise = () => RNG() * 2 - 1;
    const dim = (d) => d.len;
    const peek = (d, i, c) => { i = Math.floor(i); return i >= 0 && i < d.len ? d.a[(c || 0) * d.len + i] : 0; };
    const poke = (d, v, i, c) => { i = Math.floor(i); if (i >= 0 && i < d.len) d.a[(c || 0) * d.len + i] = v; };
    ${helpers}
    return function (I, O) {
      ${translateBody(body, decl)}
    };`;
  return { decl, funcs, body, code };
}

class GenPatch {
  constructor(src, { sr = 48000, seed = 1 } = {}) {
    const c = compile(src);
    this.decl = c.decl;
    this.P = {}; this.H = {}; this.D = {};
    for (const [k, p] of Object.entries(c.decl.params)) this.P[k] = p.def;
    for (const [k, v] of Object.entries(c.decl.history)) this.H[k] = v;
    for (const [k, d] of Object.entries(c.decl.data)) this.D[k] = { len: d.len, ch: d.ch, a: new Float64Array(d.len * d.ch) };
    let s = seed >>> 0 || 1;
    this.RNG = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    this.SR = sr;
    this.fn = Function("P", "H", "D", "SR", "RNG", c.code)(this.P, this.H, this.D, sr, this.RNG);
    this.nOut = Math.max(0, ...(c.body.match(/\bout(\d+)\b/g) || []).map((x) => +x.slice(3)));
  }
  set(name, v) {
    const p = this.decl.params[name];
    if (!p) throw new Error("no Param " + name);
    if (p.min !== undefined) v = Math.max(p.min, v);
    if (p.max !== undefined) v = Math.min(p.max, v);
    this.P[name] = v;
  }
  // inputs: array of Float64Array (per inlet) ; returns array of Float64Array
  run(n, inputs = []) {
    const outs = []; for (let k = 0; k < this.nOut; k++) outs.push(new Float64Array(n));
    const I = new Array(Math.max(8, inputs.length)).fill(0), O = new Array(this.nOut).fill(0);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < inputs.length; k++) I[k] = inputs[k] ? inputs[k][i] || 0 : 0;
      this.fn(I, O);
      for (let k = 0; k < this.nOut; k++) outs[k][i] = O[k];
    }
    return outs;
  }
}

module.exports = { compile, GenPatch, lint, parse };
