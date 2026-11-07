// util.js: shared helpers and the seeded random generator.
// ES5 only: this code runs inside Max's classic [js] object.

GO.util = (function () {
  function mod(a, n) { return ((a % n) + n) % n; }
  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function sign(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // 32-bit integer multiply (Math.imul is not available in older Max js).
  function imul(a, b) {
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
    var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  }

  // Seeded PRNG (mulberry32). Its state is one integer, so it is saved with the DNA.
  function Rng(seed) { this.s = (seed >>> 0) || 1; }
  Rng.prototype.next = function () {
    var t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = imul(t ^ (t >>> 15), t | 1);
    t ^= t + imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  Rng.prototype.sign = function () { return this.next() < 0.5 ? -1 : 1; };
  // weights: array of numbers, returns index
  Rng.prototype.weighted = function (weights) {
    var sum = 0, i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var r = this.next() * sum;
    for (i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  };
  // table: [[value, weight], ...]
  Rng.prototype.table = function (table) {
    var w = [], i;
    for (i = 0; i < table.length; i++) w.push(table[i][1]);
    return table[this.weighted(w)][0];
  };

  return { mod: mod, clamp: clamp, sign: sign, clone: clone, Rng: Rng };
})();
