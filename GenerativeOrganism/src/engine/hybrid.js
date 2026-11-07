// hybrid.js: HYBRID generator: an ensemble of interdependent parts.
//
// Unlike MELODIC (four independent lines) the four voices are composed
// around each other:
//   Voice 3 melody   melodic DNA (motif + phrase plan, see melodic.js)
//   Voice 1 bass     follows the harmonic segments: root / root-fifth /
//                    walking line with a stepwise approach (below/above) to the
//                    next root / pedal; leaves space where the melody moves
//   Voice 2 harmony  chord voicings with voice leading (each chord is voiced
//                    as close as possible to the previous one), comping on a
//                    groove that avoids the melody's attacks. Traditions
//                    without Western chords get their own accompaniment
//                    instead: parallel organum, Byzantine ison, heterophony,
//                    tanpura-like drone.
//   Voice 4 texture  counterpoint against the melody: consonant intervals on
//                    strong beats, passing notes on weak beats (2nd species),
//                    contrary motion, no parallel fifths or octaves.
// Render order is melody, bass, harmony, texture: later parts read earlier ones.

GO.Hybrid = (function () {
  var U = GO.util, H = GO.Harmony, M = GO.Melodic, R = GO.Rhythmic;
  var ORDER = [2, 0, 1, 3];

  function weights(rng, n) { var a = [], i; for (i = 0; i < n; i++) a.push(rng.next()); return a; }

  function generate(rng, role, P, frame) {
    var g = { type: 'hybrid', role: role };
    if (role === 'melody') g.mel = M.generate(rng, 'melody', P, frame);
    else if (role === 'bass') {
      g.style = rng.table([['root', 0.3], ['fifths', 0.3], ['walk', 0.25 + 0.3 * P.complexity], ['pedal', 0.1]]);
      g.groove = { k: rng.pick([2, 3, 4, 5]), rot: rng.pick([0, 0, 2, 3]) };
      g.approach = rng.next(); g.space = rng.next() * 0.6; g.legato = 0.6 + rng.next() * 0.35; g.w = weights(rng, 16);
    } else if (role === 'harmony') {
      g.size = P.complexity > 0.5 ? rng.pick([3, 4, 4]) : 3;
      g.comp = { k: rng.pick([2, 3, 4, 5]), rot: rng.int(0, 3) };
      g.sustain = rng.chance(0.4); g.avoid = rng.next(); g.legato = 0.5 + rng.next() * 0.45;
      g.orn = rng.next(); g.w = weights(rng, 16);
    } else {
      g.species = rng.table([[1, 0.4], [2, 0.45 + 0.3 * P.complexity], [3, 0.15 * P.complexity]]);
      g.above = rng.chance(0.5); g.contrary = 0.5 + rng.next(); g.leap = rng.next(); g.seed = rng.int(1, 99999);
      g.legato = 0.7 + rng.next() * 0.3;
    }
    return g;
  }

  function hash(a, b) { var x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); }

  function soundingAt(ev, t) {
    var i, best = null;
    for (i = 0; i < ev.length; i++) if (ev[i].t <= t && ev[i].t + ev[i].d > t) best = ev[i];
    if (!best) for (i = ev.length - 1; i >= 0; i--) if (ev[i].t <= t) { best = ev[i]; break; }
    return best;
  }
  function onsetSet(ev) { var s = {}, i; for (i = 0; i < ev.length; i++) s[ev[i].t] = true; return s; }

  // ---- bass -------------------------------------------------------------
  function renderBass(g, ctx, mel) {
    var F = ctx.frame, n = F.n, segs = F.segments(), ev = [], melOn = onsetSet(mel), s, i;
    var style = g.style;
    if (F.kind === 'static' && (style === 'walk' || style === 'root')) style = style === 'walk' ? 'fifths' : 'pedal';
    var baseD = F.tonicBelow(ctx.lo + 5);
    var lastD = null;
    for (s = 0; s < segs.length; s++) {
      var seg = segs[s], ch = seg.chord, next = segs[(s + 1) % segs.length].chord;
      var onsets = [seg.t];
      if (style === 'walk') { for (i = seg.t + 4; i < seg.t + seg.d; i += 4) onsets.push(i); }
      else {
        for (i = seg.t + 1; i < seg.t + seg.d; i++) {
          if (!R.hit(i % 16, g.groove.k, 16, g.groove.rot)) continue;
          if (melOn[i] && g.w[i % 16] < g.space) continue;           // leave room for the melody
          if (ctx.density < 0.75 && g.w[(i + 7) % 16] > ctx.density / 0.75) continue;
          onsets.push(i);
        }
      }
      var rootD = style === 'pedal' ? baseD : H.nearestClass(lastD === null ? baseD : lastD, ch.root, n);
      if (style !== 'pedal') rootD = F.fold(rootD, seg.t, ctx.lo, ctx.hi);
      var nextRoot = H.nearestClass(rootD, next.root, n);
      for (i = 0; i < onsets.length; i++) {
        var t = onsets[i], D = rootD, alt = 0;
        var end = i + 1 < onsets.length ? onsets[i + 1] : seg.t + seg.d;
        if (style === 'fifths' && i % 2 === 1) D = rootD + (F.kind === 'static' ? U.mod(F.drone()[1] || 4, n) : 4);
        else if (style === 'pedal' && i % 2 === 1) D = rootD + n;
        else if (style === 'walk' && i > 0) {
          var m = onsets.length;
          if (i === m - 1 && nextRoot !== rootD) {
            // approach the next root by step: from below or, with the approach gene, from above
            D = nextRoot + (g.approach > 0.55 ? 1 : -1);
          } else D = rootD + Math.round(i * (nextRoot - rootD) / m) + (i === 1 && nextRoot === rootD ? 2 : 0);
        }
        D = F.fold(D, t, ctx.lo, ctx.hi);
        var dur = Math.max(1, Math.round((end - t) * g.legato));
        ev.push(F.event(t, Math.min(dur, ctx.len - t), F.pitch(D, t, alt), ctx.vel + (t === seg.t ? 8 : 0)));
        lastD = D;
      }
    }
    return ev;
  }

  // ---- harmony ----------------------------------------------------------
  function voicings(F, ch, size, t, lo, hi) {
    var n = F.n, tones = ch.tones.slice(0, Math.max(1, Math.min(size, ch.tones.length))), out = [], r, o;
    while (tones.length < size) tones.push(tones[0]);
    var base = F.tonicBelow(lo) - n;
    for (o = 0; o < 4; o++) for (r = 0; r < tones.length; r++) {
      var v = [], D = base + o * n + tones[r], k;
      for (k = 0; k < tones.length; k++) {
        var cls = tones[(r + k) % tones.length];
        if (k > 0) { D = D + 1; while (U.mod(D, n) !== cls) D++; }   // next tone above, close position
        v.push(D);
      }
      var ok = true;
      for (k = 0; k < v.length; k++) { var p = F.pitch(v[k], t); if (p < lo || p > hi) ok = false; }
      if (ok) out.push(v);
    }
    return out;
  }

  function lead(prev, cands, F, t, center) {
    var best = cands[0], bc = 1e9, i, k;
    for (i = 0; i < cands.length; i++) {
      var c = 0;
      for (k = 0; k < cands[i].length; k++) {
        var p = F.pitch(cands[i][k], t);
        c += prev ? Math.abs(p - prev[Math.min(k, prev.length - 1)]) : Math.abs(p - center);
      }
      if (c < bc) { bc = c; best = cands[i]; }
    }
    return best;
  }

  function renderHarmony(g, ctx, mel) {
    var F = ctx.frame, mode = F.rules.harmony;
    if (F.kind !== 'static') return renderChords(g, ctx, mel);
    if (mode === 'organum') return renderOrganum(g, ctx, mel);
    if (mode === 'ison') return renderIson(g, ctx, mel);
    if (mode === 'heterophony') return renderHeterophony(g, ctx, mel);
    return renderDrone(g, ctx);
  }

  function renderChords(g, ctx, mel) {
    var F = ctx.frame, segs = F.segments(), ev = [], melOn = onsetSet(mel), prev = null, s, i, k;
    var center = (ctx.lo + ctx.hi) / 2;
    for (s = 0; s < segs.length; s++) {
      var seg = segs[s], hits = [seg.t];
      if (!g.sustain) {
        for (i = seg.t + 1; i < seg.t + seg.d; i++) {
          if (!R.hit(i % 16, g.comp.k, 16, g.comp.rot)) continue;
          if (melOn[i] && g.w[i % 16] < g.avoid) continue;            // comp between melody attacks
          if (g.w[(i + 3) % 16] > ctx.density / 0.75) continue;
          hits.push(i);
        }
      }
      var cands = voicings(F, seg.chord, g.size, seg.t, ctx.lo, ctx.hi);
      if (!cands.length) continue;
      var v = lead(prev, cands, F, seg.t, center), pitches = [];
      for (k = 0; k < v.length; k++) pitches.push(F.pitch(v[k], seg.t));
      prev = pitches;
      for (i = 0; i < hits.length; i++) {
        var end = i + 1 < hits.length ? hits[i + 1] : seg.t + seg.d;
        var dur = Math.max(1, Math.round((end - hits[i]) * (g.sustain ? 1 : g.legato)));
        for (k = 0; k < pitches.length; k++) ev.push(F.event(hits[i], Math.min(dur, ctx.len - hits[i]), pitches[k], ctx.vel - 6 + (i === 0 ? 6 : 0)));
      }
    }
    return ev;
  }

  // parallel organum: vox organalis a fourth below the chant, fifth where the
  // fourth would be a tritone
  function renderOrganum(g, ctx, mel) {
    var F = ctx.frame, ev = [], i;
    for (i = 0; i < mel.length; i++) {
      var e = mel[i], D = F.degreeOf(GO.Frame.fpitch(e), e.t), p = F.pitch(D - 3, e.t);
      if (Math.abs((GO.Frame.fpitch(e) - p) - 6) < 0.3) p = F.pitch(D - 4, e.t);
      var fD = F.fold(F.degreeOf(p, e.t), e.t, ctx.lo, ctx.hi);
      ev.push(F.event(e.t, e.d, F.pitch(fD, e.t), e.v - 8));
    }
    return ev;
  }

  // Byzantine ison: held final, moving to the dominant while the chant dwells there
  function renderIson(g, ctx, mel) {
    var F = ctx.frame, n = F.n, ev = [], t, base = F.fold(F.tonicBelow(ctx.lo + 7), 0, ctx.lo, ctx.hi);
    var span = ctx.spb, half = U.mod(F.rules.half, n);
    for (t = 0; t < ctx.len; t += span) {
      var m = soundingAt(mel, t), D = base;
      if (m && U.mod(F.degreeOf(GO.Frame.fpitch(m), t), n) === half && g.orn > 0.4) D = F.fold(base + half, t, ctx.lo, ctx.hi);
      ev.push(F.event(t, Math.min(span, ctx.len - t), F.pitch(D, t), ctx.vel - 10));
    }
    return ev;
  }

  // heterophony: the melody line ornamented and simplified an octave lower
  function renderHeterophony(g, ctx, mel) {
    var F = ctx.frame, ev = [], i;
    for (i = 0; i < mel.length; i++) {
      var e = mel[i], D = F.fold(F.degreeOf(GO.Frame.fpitch(e), e.t), e.t, ctx.lo, ctx.hi);
      if (g.w[i % 16] > ctx.density / 0.75 && i > 0) continue;
      if (e.d >= 4 && g.w[(i + 5) % 16] < g.orn) {                  // upper-neighbour ornament
        var nb = F.pitch(D + 1, e.t) <= ctx.hi ? D + 1 : D - 1;     // lower neighbour at the top of the range
        ev.push(F.event(e.t, 1, F.pitch(nb, e.t), e.v - 14));
        ev.push(F.event(e.t + 1, e.d - 1, F.pitch(D, e.t), e.v - 10));
      } else ev.push(F.event(e.t, e.d, F.pitch(D, e.t), e.v - 10));
    }
    return ev;
  }

  // tanpura-like drone: fifth (or the raga's drone tone), upper final twice, lower final
  function renderDrone(g, ctx) {
    var F = ctx.frame, n = F.n, dr = F.drone(), ev = [], t, i = 0;
    var base = F.fold(F.tonicBelow(ctx.lo + 7), 0, ctx.lo, ctx.hi);
    var pat = [base + U.mod(dr[1] === undefined ? 0 : dr[1], n), base + n, base + n, base];
    for (t = 0; t < ctx.len; t += 4) {
      var D = F.fold(pat[i % 4], t, ctx.lo, ctx.hi);
      ev.push(F.event(t, Math.min(4, ctx.len - t), F.pitch(D, t), ctx.vel - 12 + (i % 4 === 0 ? 6 : 0)));
      i++;
    }
    return ev;
  }

  // ---- counterpoint -----------------------------------------------------
  function consonance(iv) {
    var c = U.mod(Math.round(iv), 12);
    if (c === 3 || c === 4 || c === 8 || c === 9) return 3;      // imperfect consonances
    if (c === 7 || c === 0) return 2;                            // perfect
    return -6;                                                   // seconds, fourths, tritone, sevenths
  }

  function renderCounterpoint(g, ctx, mel) {
    var F = ctx.frame, n = F.n, pts = [], i, j;
    if (!mel.length) return [];
    for (i = 0; i < mel.length; i++) {
      var e = mel[i];
      pts.push({ t: e.t, strong: true });
      if (g.species >= 2 && e.d >= 2) pts.push({ t: e.t + Math.floor(e.d / 2), strong: false });
      if (g.species >= 3 && e.d >= 4) { pts.push({ t: e.t + Math.floor(e.d / 4), strong: false }); pts.push({ t: e.t + Math.floor(3 * e.d / 4), strong: false }); }
    }
    pts.sort(function (a, b) { return a.t - b.t; });
    var ev = [], prevC = null, prevM = null, lastT = -1;
    var lo = F.degreeOf(ctx.lo, 0), hi = F.degreeOf(ctx.hi, 0);
    for (i = 0; i < pts.length; i++) {
      var pt = pts[i];
      if (pt.t === lastT || pt.t >= ctx.len) continue;
      lastT = pt.t;
      var m = soundingAt(mel, pt.t), mp = GO.Frame.fpitch(m), best = null, bs = -1e9;
      var ch = F.chordAt(pt.t);
      for (j = lo; j <= hi; j++) {
        var c = F.pitch(j, pt.t);
        if (c < ctx.lo || c > ctx.hi) continue;
        var iv = Math.abs(c - mp), sc = consonance(iv);
        if (pt.strong && sc < 0) sc -= 20;
        if (!pt.strong && sc < 0 && prevC !== null && Math.abs(c - prevC) <= 2.1) sc += 5;   // passing tone
        if (g.above ? c <= mp : c >= mp) sc -= 8;
        if (prevC !== null) {
          var dc = c - prevC, dm = prevM === null ? 0 : mp - prevM;
          var pc = U.mod(Math.round(Math.abs(prevC - prevM)), 12), cc = U.mod(Math.round(iv), 12);
          if ((pc === 7 || pc === 0) && pc === cc && U.sign(dc) === U.sign(dm) && dc !== 0) sc -= 15;  // parallel 5ths/8ves
          if (U.sign(dc) !== U.sign(dm) && dc !== 0 && dm !== 0) sc += 2 * g.contrary;
          if (Math.abs(dc) <= 2.1 && dc !== 0) sc += 2;
          if (Math.abs(dc) > 7) sc -= 3 * (1 - g.leap * 0.5);
          if (dc === 0) sc -= 1;
        }
        if (H.isChordTone(j, ch, n)) sc += 1;
        sc += hash(g.seed + i, j) * 0.8;
        if (sc > bs) { bs = sc; best = c; }
      }
      if (best === null) continue;
      ev.push({ t: pt.t, p: best, v: ctx.vel - (pt.strong ? 0 : 8), strong: pt.strong });
      prevC = best; prevM = mp;
    }
    var out = [];
    for (i = 0; i < ev.length; i++) {
      var end = i + 1 < ev.length ? ev[i + 1].t : ctx.len;
      if (!ev[i].strong && hash(g.seed, i) > ctx.density / 0.75) continue;   // density thins weak beats
      out.push(F.event(ev[i].t, Math.max(1, Math.round((end - ev[i].t) * g.legato)), ev[i].p, ev[i].v));
    }
    return out;
  }

  function render(g, ctx, others) {
    var mel = (others && others[2]) || [];
    if (g.role === 'melody') return M.render(g.mel, ctx, null);
    if (g.role === 'bass') return renderBass(g, ctx, mel);
    if (g.role === 'harmony') return renderHarmony(g, ctx, mel);
    return renderCounterpoint(g, ctx, mel);
  }

  // ---- mutation ----------------------------------------------------------
  function mutate(g0, rng, P, frame) {
    var g = U.clone(g0), count = 1 + Math.floor(P.amount * 2 + rng.next() * P.amount), k;
    if (g.role === 'melody') { g.mel = M.mutate(g.mel, rng, P, frame); return g; }
    for (k = 0; k < count; k++) {
      var r = rng.next();
      if (g.role === 'bass') {
        if (r < 0.3) g.groove.k = U.clamp(g.groove.k + rng.sign(), 1, 8);
        else if (r < 0.5) g.groove.rot = U.mod(g.groove.rot + rng.sign(), 16);
        else if (r < 0.65 && P.amount > 0.4) g.style = rng.pick(['root', 'fifths', 'walk', 'pedal']);
        else if (r < 0.8) g.approach = U.clamp(g.approach + rng.sign() * 0.3, 0, 1);
        else g.space = U.clamp(g.space + rng.sign() * 0.2, 0, 1);
      } else if (g.role === 'harmony') {
        if (r < 0.3) g.comp.k = U.clamp(g.comp.k + rng.sign(), 1, 8);
        else if (r < 0.5) g.comp.rot = U.mod(g.comp.rot + rng.sign(), 16);
        else if (r < 0.62) g.sustain = !g.sustain;
        else if (r < 0.75) g.size = U.clamp(g.size + rng.sign(), 2, 4);
        else if (r < 0.88) g.avoid = U.clamp(g.avoid + rng.sign() * 0.25, 0, 1);
        else g.orn = U.clamp(g.orn + rng.sign() * 0.3, 0, 1);
      } else {
        if (r < 0.3) g.species = U.clamp(g.species + rng.sign(), 1, 3);
        else if (r < 0.45 && P.amount > 0.5) g.above = !g.above;
        else if (r < 0.75) g.seed = rng.int(1, 99999);
        else if (r < 0.88) g.contrary = U.clamp(g.contrary + rng.sign() * 0.3, 0.3, 1.6);
        else g.leap = U.clamp(g.leap + rng.sign() * 0.3, 0, 1);
      }
    }
    return g;
  }

  return { ORDER: ORDER, generate: generate, render: render, mutate: mutate, consonance: consonance };
})();
