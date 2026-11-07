// midi_capture.js: CAPTURE: an independent copy of the current generation.
//
// A capture stores the rendered cycle of all voices in musical time (beats,
// quarter notes): pitch, cents (microtones), velocity, MIDI channel, start and
// duration. It is a deep copy; later mutations never touch it. It is kept in
// the device state (saved with the Live Set) and can be
//   - written into a new MIDI clip on this track (Live Object Model, done by
//     the Max glue), all voices in one clip, or
//   - exported as a Standard MIDI File with one track per voice and channel,
//     microtones as pitch bend (the fallback that keeps the full structure).

GO.Capture = (function () {
  var U = GO.util;

  function make(org) {
    var R = org.render(), p = org.params, notes = [], i, j;
    for (i = 0; i < 4; i++) {
      if (!p.voices[i].on) continue;
      for (j = 0; j < R[i].length; j++) {
        var e = R[i][j];
        notes.push({ voice: i, ch: p.voices[i].ch, p: e.p, c: e.c || 0, v: e.v, start: e.t / 4, dur: e.d / 4 });
      }
    }
    notes.sort(function (a, b) { return a.start - b.start || a.p - b.p; });
    return { name: 'GO ' + p.gen + ' gen ' + org.generation, gen: p.gen, generation: org.generation,
             beats: R.len / 4, key: p.key, notes: notes };
  }

  // notes for Clip.add_new_notes (times in beats)
  function clipNotes(cap) {
    var out = [], i;
    for (i = 0; i < cap.notes.length; i++) {
      var n = cap.notes[i];
      out.push({ pitch: n.p, start_time: n.start, duration: n.dur, velocity: n.v, mute: 0 });
    }
    return out;
  }

  // Standard MIDI File bytes: one track per voice on its own channel
  function smf(cap, bpm) {
    var tracks = [], byVoice = {}, i, ppq = 480;
    for (i = 0; i < cap.notes.length; i++) (byVoice[cap.notes[i].voice] = byVoice[cap.notes[i].voice] || []).push(cap.notes[i]);
    for (i = 0; i < 4; i++) {
      if (!byVoice[i]) continue;
      var ev = [], bend = 0, j;
      for (j = 0; j < byVoice[i].length; j++) {
        var n = byVoice[i][j], ch = U.clamp(n.ch, 1, 16) - 1;
        var on = Math.round(n.start * ppq), off = Math.round((n.start + n.dur) * ppq);
        if (n.c !== bend) {
          var v = U.clamp(Math.round(8192 + n.c / 200 * 8192), 0, 16383);
          ev.push({ tick: on, msg: [0xE0 | ch, v & 127, (v >> 7) & 127] });
          bend = n.c;
        }
        ev.push({ tick: on, msg: [0x90 | ch, n.p, n.v] });
        ev.push({ tick: off, msg: [0x80 | ch, n.p, 0] });
      }
      tracks.push({ name: 'Voice ' + (i + 1) + ' ' + GO.Roles[i].name, events: ev });
    }
    return GO.SMF.write(tracks, ppq, bpm || 120);
  }

  return { make: make, clipNotes: clipNotes, smf: smf };
})();
