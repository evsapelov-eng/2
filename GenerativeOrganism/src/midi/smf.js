// smf.js: Standard MIDI File (format 1) writer, pure JS byte arrays.
// Used now by the offline renderer (tools/render.js); Stage E (CAPTURE) will
// use it as the fallback export when writing into a Live clip is not possible.

GO.SMF = (function () {
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function u16(n) { return [(n >>> 8) & 255, n & 255]; }
  function vlq(n) {
    var bytes = [n & 0x7f];
    n = n >>> 7;
    while (n > 0) { bytes.unshift((n & 0x7f) | 0x80); n = n >>> 7; }
    return bytes;
  }
  function str(s) { var a = [], i; for (i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0x7f); return a; }

  // tracks: [{ name, events: [{ tick, msg: [status, d1, d2] }] }]; bpm for the tempo map
  function write(tracks, ppq, bpm) {
    var out = str('MThd').concat(u32(6), u16(1), u16(tracks.length + 1), u16(ppq)), i, j;
    var tempo = Math.round(60000000 / (bpm || 120));
    var t0 = [0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255,
              0, 0xff, 0x58, 4, 4, 2, 24, 8, 0, 0xff, 0x2f, 0];
    out = out.concat(str('MTrk'), u32(t0.length), t0);
    for (i = 0; i < tracks.length; i++) {
      var ev = tracks[i].events.slice();
      // stable sort by tick; note-offs before note-ons on the same tick
      ev.sort(function (a, b) { return a.tick - b.tick || ((a.msg[0] & 0xf0) - (b.msg[0] & 0xf0)); });
      var name = str(tracks[i].name || ('Voice ' + (i + 1)));
      var body = [0, 0xff, 0x03].concat(vlq(name.length), name), last = 0;
      for (j = 0; j < ev.length; j++) {
        body = body.concat(vlq(ev[j].tick - last), ev[j].msg);
        last = ev[j].tick;
      }
      body = body.concat([0, 0xff, 0x2f, 0]);
      out = out.concat(str('MTrk'), u32(body.length), body);
    }
    return out;
  }

  return { write: write, vlq: vlq };
})();
