// KØRE core — utilities.
// ES5 only: this code runs inside Max's legacy [js]/[jsui] engine and in Node tests.
// No let/const/arrow functions/classes/Math.imul (missing in the legacy engine).

var KORE_VERSION = "0.1.0";

function koreImul(a, b) {
  var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
  var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
  return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
}

// 32-bit integer mix (murmur3 finalizer).
function koreMix32(h) {
  h = h | 0;
  h ^= h >>> 16; h = koreImul(h, 0x85ebca6b);
  h ^= h >>> 13; h = koreImul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Deterministic hash of a list of integers -> uint32.
function koreHashInts(list) {
  var h = 0x9e3779b9;
  for (var i = 0; i < list.length; i++) {
    h = koreMix32((h ^ (list[i] | 0)) + koreImul(i + 1, 0x27d4eb2d));
  }
  return h >>> 0;
}

// Deterministic uniform [0,1) from integers.
function koreHash01(list) {
  return koreHashInts(list) / 4294967296;
}

// Seeded PRNG (mulberry32). The only random source of the engine:
// no Math.random() anywhere in the core.
function KoreRng(seed) {
  this.s = (seed >>> 0) || 1;
}
KoreRng.prototype.next = function () {
  this.s = (this.s + 0x6d2b79f5) >>> 0;
  var t = this.s;
  t = koreImul(t ^ (t >>> 15), t | 1);
  t ^= t + koreImul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
KoreRng.prototype.range = function (lo, hi) { return lo + (hi - lo) * this.next(); };
KoreRng.prototype.int = function (lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }; // inclusive
KoreRng.prototype.chance = function (p) { return this.next() < p; };
KoreRng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
// Approximately normal, mean 0, sd 1 (Irwin–Hall, 4 terms).
KoreRng.prototype.gauss = function () {
  return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508;
};
KoreRng.prototype.weighted = function (weights) {
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

function koreClamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function koreClamp01(v) { return koreClamp(v, 0, 1); }
function koreRound(v, digits) { var p = Math.pow(10, digits); return Math.round(v * p) / p; }
function koreIsNum(v) { return typeof v === "number" && isFinite(v); }
function koreClone(o) { return JSON.parse(JSON.stringify(o)); }
function koreDbToAmp(db) { return Math.pow(10, db / 20); }

function koreShallowKeys(o) {
  var out = [];
  for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out.push(k);
  return out;
}
