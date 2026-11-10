// NØIZ core — utilities.
// ES5 only: this code runs inside Max's legacy [js]/[jsui] engine and in Node tests.
// No let/const/arrow functions/classes/Math.imul (missing in the legacy engine).

var NOIZ_VERSION = "0.1.0";

function noizImul(a, b) {
  var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
  var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
  return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
}

// 32-bit integer mix (murmur3 finalizer).
function noizMix32(h) {
  h = h | 0;
  h ^= h >>> 16; h = noizImul(h, 0x85ebca6b);
  h ^= h >>> 13; h = noizImul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Deterministic hash of a list of integers -> uint32.
function noizHashInts(list) {
  var h = 0x9e3779b9;
  for (var i = 0; i < list.length; i++) {
    h = noizMix32((h ^ (list[i] | 0)) + noizImul(i + 1, 0x27d4eb2d));
  }
  return h >>> 0;
}

// Deterministic uniform [0,1) from integers.
function noizHash01(list) {
  return noizHashInts(list) / 4294967296;
}

// Seeded PRNG (mulberry32). The only random source of the engine:
// no Math.random() anywhere in the core.
function NoizRng(seed) {
  this.s = (seed >>> 0) || 1;
}
NoizRng.prototype.next = function () {
  this.s = (this.s + 0x6d2b79f5) >>> 0;
  var t = this.s;
  t = noizImul(t ^ (t >>> 15), t | 1);
  t ^= t + noizImul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
NoizRng.prototype.range = function (lo, hi) { return lo + (hi - lo) * this.next(); };
NoizRng.prototype.int = function (lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }; // inclusive
NoizRng.prototype.chance = function (p) { return this.next() < p; };
NoizRng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
// Approximately normal, mean 0, sd 1 (Irwin–Hall, 4 terms).
NoizRng.prototype.gauss = function () {
  return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508;
};
NoizRng.prototype.weighted = function (weights) {
  var total = 0, i;
  for (i = 0; i < weights.length; i++) total += Math.max(0, weights[i]);
  if (total <= 0) return -1;
  var r = this.next() * total;
  for (i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return i;
  }
  return weights.length - 1;
};

function noizClamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function noizClamp01(v) { return noizClamp(v, 0, 1); }
function noizRound(v, digits) { var p = Math.pow(10, digits); return Math.round(v * p) / p; }
function noizIsNum(v) { return typeof v === "number" && isFinite(v); }
function noizClone(o) { return JSON.parse(JSON.stringify(o)); }
function noizDbToAmp(db) { return Math.pow(10, db / 20); }

function noizShallowKeys(o) {
  var out = [];
  for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out.push(k);
  return out;
}
