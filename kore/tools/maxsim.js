// Minimal interpreter for the subset of Max/MSP objects used by KØRE patches.
// Purpose: prove the WIRING of generated .maxpat files (every parameter reaches the
// sound, right inlets, right order). It is NOT Max: svf~/noise~/pink~ are modelled
// like tools/render_voices.js, message semantics follow the documented basics
// (right-to-left outlet order, hot left inlet, floats into signal inlets).
"use strict";

const SR = 48000;

function rngFactory(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function compileExpr(src) {
  const body = src.replace(/\\,/g, ",").replace(/\$[fi](\d+)/g, (_, n) => `a[${n - 1}]`)
    .replace(/\b(pow|sqrt|cos|sin|exp|log|abs|tanh|max|min)\(/g, "Math.$1(");
  return new Function("a", "return (" + body + ");");
}

class Patch {
  constructor(json, seed = 1) {
    const p = json.patcher;
    this.boxes = {};
    this.buffers = {};
    this.rng = rngFactory(seed);
    for (const b of p.boxes) this.boxes[b.box.id] = { ...b.box, out: [], state: {} };
    for (const l of p.lines) {
      const [s, so] = l.patchline.source, [d, di] = l.patchline.destination;
      const sb = this.boxes[s];
      (sb.out[so] = sb.out[so] || []).push({ id: d, inlet: di });
    }
    this.signalBoxes = [];
    for (const l of p.lines) { // an [outlet] fed by a signal object is a signal outlet
      const src = this.boxes[l.patchline.source[0]], dst = this.boxes[l.patchline.destination[0]];
      if (dst.maxclass === "outlet" && /~/.test((src.text || "").split(" ")[0])) dst.__sigOut = true;
    }
    for (const id of Object.keys(this.boxes)) this._init(this.boxes[id]);
    this._order();
    // like Max: [loadbang] fires once when the patch loads
    for (const b of Object.values(this.boxes)) if (b.cls === "loadbang") this._emit(b, 0, ["bang"]);
  }

  _words(b) { return (b.text || "").split(/\s+/).filter(Boolean); }
  _cls(b) {
    if (b.maxclass === "message") return "message";
    if (b.maxclass === "inlet" || b.maxclass === "outlet" || b.maxclass === "comment") return b.maxclass;
    return this._words(b)[0];
  }
  _isSig(b) { const c = this._cls(b) || ""; if (c === "buffer~" || c === "dspstate~") return false; return /~$/.test(c) || (c === "inlet" && b.outlettype && b.outlettype[0] === "signal") || (c === "outlet" && b.__sigOut); }

  _init(b) {
    const w = this._words(b), c = this._cls(b), st = b.state;
    b.cls = c;
    if (c === "unpack" || c === "pack") st.vals = w.slice(1).map(Number);
    if (c === "expr") { st.fn = compileExpr(w.slice(1).join(" ")); st.args = []; }
    if (c === "*") st.r = Number(w[1] || 0);
    if (c === "f") st.v = Number(w[1] || 0);
    if (c === "index~") st.buf = w[1];
    if (c === "route") st.sel = w.slice(1);
    if (c === "prepend") st.pre = w.slice(1);
    if (c === "clip~") { st.lo = +w[1]; st.hi = +w[2]; }
    if (c === "sah~") { st.th = +(w[1] || 0); st.held = 0; st.prev = 0; }
    if (c === "change~") st.prev = null;
    if (c === "slide~") { st.up = Math.max(1, +(w[1] || 1)); st.down = Math.max(1, +(w[2] || 1)); st.z = 0; }
    if (c === "tapin~") { st.buf = new Float64Array(Math.ceil((+w[1] || 1000) / 1000 * SR) + 2); st.w = 0; }
    if (c === "tapout~") st.delays = w.slice(1).map(Number);
    if (this._isSig(b)) {
      st.inF = [0, 0, 0].map((_, i) => (w[i + 1] !== undefined && !isNaN(+w[i + 1]) ? +w[i + 1] : (c === "*~" && i === 1 && w.length === 1 ? 0 : 0)));
      if ((c === "*~" || c === "+~" || c === ">~" || c === "==~" || c === "-~" || c === "!-~" || c === "%~") && w[1] !== undefined) st.inF[1] = +w[1];
      if (c === "svf~") { st.inF[1] = +(w[1] || 1000); st.inF[2] = +(w[2] || 0.5); st.ic1 = 0; st.ic2 = 0; }
      if (c === "cycle~") { st.inF[0] = +(w[1] || 0); st.ph = 0; }
      if (c === "line~") { st.v = 0; st.segs = []; }
      if (c === "pink~") st.b = [0, 0, 0, 0, 0, 0, 0];
      st.y = [0, 0, 0, 0];
      st.sigIn = [false, false, false];
      this.signalBoxes.push(b);
    }
    if (c === "out~") { st.buf = []; this.outs = this.outs || {}; this.outs[+w[1]] = b; }
    if (c === "outlet") { st.buf = []; this.outs = this.outs || {}; this.outs[Object.keys(this.outs).length + 1] = b; }
  }

  _order() { // signal graph topological order + which inlets carry signals
    const sig = new Set(this.signalBoxes.map((b) => b.id));
    const indeg = {}, edges = {};
    for (const b of this.signalBoxes) { indeg[b.id] = 0; edges[b.id] = []; }
    for (const b of this.signalBoxes) {
      b.out.forEach((conns, o) => (conns || []).forEach((c) => {
        if (!sig.has(c.id)) return;
        if (b.cls === "line~" && o === 1) return; // bang outlet
        if (b.cls === "tapin~") { this.boxes[c.id].state.tap = b; return; } // delay line: no ordering edge
        edges[b.id].push(c);
        indeg[c.id]++;
        this.boxes[c.id].state.sigIn[c.inlet] = true;
      }));
    }
    const q = Object.keys(indeg).filter((k) => indeg[k] === 0), order = [];
    while (q.length) {
      const id = q.shift(); order.push(this.boxes[id]);
      for (const c of edges[id]) if (--indeg[c.id] === 0) q.push(c.id);
    }
    if (order.length !== this.signalBoxes.length) throw new Error("signal graph has a cycle");
    this.order = order;
  }

  // ---------- messages ----------
  _emit(b, outlet, msg) {
    const conns = (b.out[outlet] || []).slice().sort((x, y) => this.boxes[y.id].patching_rect[0] - this.boxes[x.id].patching_rect[0]);
    for (const c of conns) this.send(c.id, c.inlet, msg);
  }

  send(id, inlet, msg) {
    const b = this.boxes[id], st = b.state, c = b.cls;
    const nums = msg.filter((x) => typeof x === "number");
    switch (c) {
      case "in": this._emit(b, 0, msg); break;
      case "t": {
        const w = this._words(b).slice(1);
        for (let i = w.length - 1; i >= 0; i--) this._emit(b, i, w[i] === "f" ? [nums[0]] : w[i] === "b" ? ["bang"] : msg);
        break;
      }
      case "unpack":
        for (let i = Math.min(st.vals.length, nums.length) - 1; i >= 0; i--) this._emit(b, i, [nums[i]]);
        break;
      case "pack":
        if (inlet === 0 && nums.length > 1) { nums.forEach((v, i) => { st.vals[i] = v; }); }
        else st.vals[inlet] = nums[0];
        if (inlet === 0) this._emit(b, 0, st.vals.slice());
        break;
      case "expr":
        st.args[inlet] = nums[0];
        if (inlet === 0) {
          const v = st.fn(st.args);
          if (!Number.isFinite(v)) throw new Error(`expr '${b.text}' gave ${v} for ${st.args}`);
          this._emit(b, 0, [v]);
        }
        break;
      case "*": if (inlet === 1) st.r = nums[0]; else this._emit(b, 0, [nums[0] * st.r]); break;
      case "f":
        if (inlet === 1) st.v = nums[0];
        else { if (nums.length) st.v = nums[0]; this._emit(b, 0, [st.v]); }
        break;
      case "inlet": this._emit(b, 0, msg); break;
      case "route": {
        const i = st.sel.indexOf(String(msg[0]));
        if (i >= 0) this._emit(b, i, msg.slice(1)); else this._emit(b, st.sel.length, msg);
        break;
      }
      case "prepend": this._emit(b, 0, st.pre.concat(msg)); break;
      case "buffer~": case "dspstate~": break;
      case "loadbang": this._emit(b, 0, ["bang"]); break;
      case "sqrt": this._emit(b, 0, [Math.sqrt(Math.max(0, nums[0]))]); break;
      case "message": {
        if (inlet !== 0) break;
        for (const part of b.text.split(",")) { // comma = separate messages, in order
          const out = part.trim().split(/\s+/).map((t) => (/^\$\d$/.test(t) ? nums[+t[1] - 1] : (isNaN(+t) ? t : +t)));
          this._emit(b, 0, out);
        }
        break;
      }
      case "line~": {
        if (nums.length === 1) { st.v = nums[0]; st.segs = []; break; }
        st.segs = [];
        for (let i = 0; i + 1 < nums.length; i += 2) st.segs.push({ to: nums[i], n: Math.max(1, Math.round((nums[i + 1] / 1000) * SR)) });
        st.cur = null;
        break;
      }
      default:
        if (b.cls === "cycle~" && inlet === 1) { st.ph = nums[0] || 0; break; } // phase reset
        if (b.cls === "index~" && msg[0] === "set") { st.buf = String(msg[1]); break; }
        if (b.cls === "cycle~" && inlet === 0) { st.inF[0] = nums[0]; break; }
        if (this._isSig(b)) { st.inF[inlet] = nums[0]; break; }
        if (c === "thispoly~" || c === "out~") break;
        throw new Error("maxsim: unsupported object " + c);
    }
  }

  // ---------- signals ----------
  _in(b, inlet, vals) {
    return b.state.sigIn[inlet] ? (vals[inlet] || 0) : b.state.inF[inlet];
  }

  tick() {
    const acc = new Map();
    const add = (id, inlet, v) => { const a = acc.get(id) || [0, 0, 0]; a[inlet] += v; acc.set(id, a); };
    for (const b of this.order) {
      const st = b.state, v = acc.get(b.id) || [0, 0, 0];
      const x0 = this._in(b, 0, v), x1 = this._in(b, 1, v), x2 = this._in(b, 2, v);
      let y = st.y;
      switch (b.cls) {
        case "noise~": y[0] = this.rng() * 2 - 1; break;
        case "pink~": {
          const w = this.rng() * 2 - 1, k = st.b;
          k[0] = 0.99886 * k[0] + w * 0.0555179; k[1] = 0.99332 * k[1] + w * 0.0750759; k[2] = 0.969 * k[2] + w * 0.153852;
          k[3] = 0.8665 * k[3] + w * 0.3104856; k[4] = 0.55 * k[4] + w * 0.5329522; k[5] = -0.7616 * k[5] - w * 0.016898;
          y[0] = (k[0] + k[1] + k[2] + k[3] + k[4] + k[5] + k[6] + w * 0.5362) * 0.11; k[6] = w * 0.115926;
          break;
        }
        case "cycle~": st.ph += x0 / SR; y[0] = Math.cos(2 * Math.PI * st.ph); break;
        case "*~": y[0] = x0 * x1; break;
        case "+~": y[0] = x0 + x1; break;
        case ">~": y[0] = x0 > x1 ? 1 : 0; break;
        case "==~": y[0] = x0 === x1 ? 1 : 0; break;
        case "abs~": y[0] = Math.abs(x0); break;
        case "tanh~": y[0] = Math.tanh(x0); break;
        case "dbtoa~": y[0] = Math.pow(10, x0 / 20); break;
        case "phasor~": y[0] = st.ext ? (st.ext[st.i++] || 0) : (st.ph = ((st.ph || 0) + x0 / SR) % 1); break;
        case "trunc~": y[0] = Math.trunc(x0); break;
        case "slide~": st.z += (x0 - st.z) / (x0 > st.z ? st.up : st.down); y[0] = st.z; break;
        case "-~": y[0] = x0 - x1; break;
        case "!-~": y[0] = x1 - x0; break;
        case "%~": y[0] = x0 % x1; break;
        case "clip~": y[0] = Math.min(st.hi, Math.max(st.lo, x0)); break;
        case "change~": y[0] = st.prev === null ? 0 : Math.sign(x0 - st.prev); st.prev = x0; break;
        case "sah~": if (st.prev <= st.th && x1 > st.th) st.held = x0; st.prev = x1; y[0] = st.held; break;
        case "index~": { const data = this.buffers[st.buf] || []; const i = Math.max(0, Math.min(data.length - 1, Math.floor(x0))); y[0] = data.length ? data[i] : 0; break; }
        case "inlet": y[0] = st.ext ? (st.ext[st.i++] || 0) : 0; break;
        case "outlet": st.buf.push(x0); break;
        case "tapin~": st.buf[st.w] = x0; st.w = (st.w + 1) % st.buf.length; break;
        case "tapout~": {
          const t = st.tap.state;
          st.delays.forEach((d, k) => {
            const n = Math.round(d / 1000 * SR);
            y[k] = t.buf[((t.w - 1 - n) % t.buf.length + t.buf.length) % t.buf.length];
          });
          break;
        }
        case "line~": {
          if (!st.cur && st.segs.length) { const s = st.segs.shift(); st.cur = { to: s.to, step: (s.to - st.v) / s.n, n: s.n }; }
          if (st.cur) { st.v += st.cur.step; if (--st.cur.n <= 0) { st.v = st.cur.to; st.cur = null; } }
          y[0] = st.v; break;
        }
        case "svf~": {
          const g = Math.tan(Math.PI * Math.min(Math.max(x1, 1), SR * 0.45) / SR), k = 2 * (1 - Math.min(x2, 0.98));
          const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
          const v3 = x0 - st.ic2, v1 = a1 * st.ic1 + a2 * v3, v2 = st.ic2 + a2 * st.ic1 + a3 * v3;
          st.ic1 = 2 * v1 - st.ic1; st.ic2 = 2 * v2 - st.ic2;
          y[0] = v2; y[1] = x0 - k * v1 - v2; y[2] = v1; y[3] = x0 - k * v1; break;
        }
        case "out~": st.buf.push(x0); break;
        case "thispoly~": case "peakamp~": case "buffer~": case "dspstate~": break;
        default: throw new Error("maxsim: unsupported signal object " + b.cls);
      }
      b.out.forEach((conns, o) => (conns || []).forEach((c) => {
        if (b.cls === "line~" && o === 1) return;
        if (this.boxes[c.id].state.sigIn) add(c.id, c.inlet, y[o]);
      }));
    }
  }

  run(samples) {
    for (let i = 0; i < samples; i++) this.tick();
    return Object.fromEntries(Object.entries(this.outs).map(([k, b]) => [k, Float64Array.from(b.state.buf)]));
  }

  inletBox() { return Object.values(this.boxes).find((b) => b.cls === "in"); }
  inlets() { return Object.values(this.boxes).filter((b) => b.cls === "inlet").sort((a, b) => a.patching_rect[0] - b.patching_rect[0]); }
  feed(inletBox, samples) { inletBox.state.ext = samples; inletBox.state.i = 0; }
}

module.exports = { Patch, SR };
