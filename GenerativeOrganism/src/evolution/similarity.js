// similarity.js: how close two renderings of a voice are (0..1).
// Used by STABILITY: a mutation is only accepted if the new material stays
// recognisably close to the lineage's original idea.

GO.Similarity = (function () {
  function index(ev) {
    var m = {}, i;
    for (i = 0; i < ev.length; i++) { (m[ev[i].t] = m[ev[i].t] || []).push(ev[i].p); }
    return m;
  }
  function pitchScore(a, b) {
    var best = 0, i, j;
    for (i = 0; i < a.length; i++) for (j = 0; j < b.length; j++) {
      var d = Math.abs(a[i] - b[j]), s = d === 0 ? 1 : (d % 12 === 0 ? 0.7 : (d <= 2 ? 0.4 : 0));
      if (s > best) best = s;
    }
    return best;
  }
  function voice(A, B) {
    if (!A.length && !B.length) return 1;
    var ia = index(A), ib = index(B), t, common = 0, union = 0, pitch = 0;
    for (t in ia) { union++; if (ib[t]) { common++; pitch += pitchScore(ia[t], ib[t]); } }
    for (t in ib) if (!ia[t]) union++;
    if (!union) return 1;
    return 0.45 * (common / union) + 0.55 * (pitch / union);
  }
  // mean over voices that sound in either rendering
  function organism(RA, RB) {
    var s = 0, c = 0, i;
    for (i = 0; i < RA.length; i++) {
      if (!RA[i].length && !RB[i].length) continue;
      s += voice(RA[i], RB[i]); c++;
    }
    return c ? s / c : 1;
  }
  return { voice: voice, organism: organism };
})();
