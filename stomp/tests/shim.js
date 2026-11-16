"use strict";
function makeShim(w, h) {
  const els = [];
  let rgba = [1, 1, 1, 1], lw = 1, font = 10, bold = false, d = "", tx = [0, 0], gid = 0, pattern = null;
  const defs = [];
  const color = () => `rgba(${Math.round(rgba[0] * 255)},${Math.round(rgba[1] * 255)},${Math.round(rgba[2] * 255)},${rgba[3]})`;
  const g = {
    size: [w, h], init() {}, redraw() {}, scale() {},
    set_source_rgba(r, gg, b, a) { rgba = [r, gg, b, a]; pattern = null; }, set_line_width(v) { lw = v; },
    rectangle(x, y, ww, hh) { d += `M${x},${y}h${ww}v${hh}h${-ww}Z`; },
    ellipse(x, y, ww, hh) { const rx = ww / 2, ry = hh / 2; d += `M${x},${y + ry}a${rx},${ry} 0 1,0 ${ww},0a${rx},${ry} 0 1,0 ${-ww},0`; },
    move_to(x, y) { d += `M${x},${y}`; tx = [x, y]; }, line_to(x, y) { d += `L${x},${y}`; },
    curve_to(a, b, c, e, x, y) { d += `C${a},${b} ${c},${e} ${x},${y}`; },
    pattern_create_radial(x1, y1, r1, x2, y2, r2) {
      const id = "g" + (gid++), stops = [];
      return { id, add_color_stop_rgba(o, r, gg, b, al) { stops.push(`<stop offset="${o}" stop-color="rgb(${Math.round(r * 255)},${Math.round(gg * 255)},${Math.round(b * 255)})" stop-opacity="${al}"/>`); },
        def() { return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${x2}" cy="${y2}" r="${r2}" fx="${x1}" fy="${y1}">${stops.join("")}</radialGradient>`; } };
    },
    set_source(pt) { pattern = pt; },
    fill() { if (pattern) { defs.push(pattern.def()); els.push(`<path d="${d}" fill="url(#${pattern.id})"/>`); pattern = null; } else els.push(`<path d="${d}" fill="${color()}"/>`); d = ""; },
    stroke() { els.push(`<path d="${d}" fill="none" stroke="${color()}" stroke-width="${lw}" stroke-linecap="round"/>`); d = ""; },
    select_font_face(n) { bold = /Bold/.test(n || ""); }, set_font_size(s) { font = s; },
    text_measure(s) { return [s.length * font * 0.58, font]; },
    show_text(s) { els.push(`<text x="${tx[0]}" y="${tx[1]}" font-family="Arial,Helvetica,sans-serif" font-size="${font}" font-weight="${bold ? 700 : 400}" fill="${color()}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`); d = ""; },
  };
  g.svg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join("")}</defs>${els.join("")}</svg>`;
  g.reset = () => { els.length = 0; defs.length = 0; };
  return g;
}
module.exports = { makeShim };
