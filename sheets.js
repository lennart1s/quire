/* Layout and HTML of the printed sheets */
/* ---------- Geometry ---------- */
function layout() {
  const b = S.bleed, pw0 = S.fold ? 2 * S.w : S.w, cw = pw0 + 2 * b, ch = S.h + 2 * b, g = S.gap;
  const { sx, sy, tx, ty } = correction(S.duplex), uw = printable(210, sx, tx), uh = printable(297, sy, ty);
  const fit = (a, c) => ({ nx: Math.max(0, Math.floor((uw + g) / (a + g))), ny: Math.max(0, Math.floor((uh + g) / (c + g))) });
  const A = fit(cw, ch), B = fit(ch, cw);
  const rot = B.nx * B.ny > A.nx * A.ny;
  const L = rot ? B : A, sw = rot ? ch : cw, sh = rot ? cw : ch;
  const gw = L.nx * sw + (L.nx - 1) * g, gh = L.ny * sh + (L.ny - 1) * g;
  return { cw, ch, rot, nx: L.nx, ny: L.ny, n: L.nx * L.ny, sw, sh, gw, gh, x0: (210 - gw) / 2, y0: (297 - gh) / 2,
    tw: rot ? S.h : pw0, th: rot ? pw0 : S.h };
}
function cover() {
  const L = layout(), leaves = L.n * S.sheets * (S.fold ? 2 : 1);
  const sp = S.spineAuto ? f(leaves * S.paperTh + S.coverTh) : +S.spine;
  const b = S.bleed, Cw = 2 * S.w + sp + 2 * b, Ch = S.h + 2 * b;
  const { sx, sy } = correction(false), pw = printable(210, sx, 0), ph = printable(297, sy, 0);
  // normally the cover's width runs along the height of the portrait sheet, upright along its width like pages that aren't rotated
  const upright = S.coverDir && !L.rot && Cw <= pw && Ch <= ph;
  return { sp, b, Cw, Ch, leaves, upright, likePages: upright !== L.rot, fits: upright || Cw <= ph && Ch <= pw };
}
const imgSize = () => S.turn % 2 ? [IMG.nh, IMG.nw] : [IMG.nw, IMG.nh];
function imgGeom(C) {
  if (!IMG.ok) return null;
  const [nw, nh] = imgSize(), a = nw / nh;
  const bw = a > C.Cw / C.Ch ? C.Ch * a : C.Cw, bh = bw / a;
  const w = bw * S.zoom, h = bh * S.zoom;
  return { w, h, x: C.Cw / 2 + S.offX - w / 2, y: C.Ch / 2 + S.offY - h / 2, bw };
}

/* ---------- Pages ---------- */
function patternSVG(L) {
  const { cw, ch } = L, b = S.bleed, W = S.w, H = S.h, s = Math.max(1, +S.spacing), r = +S.rand;
  const halves = S.fold ? 2 : 1, cy = b + H / 2;
  const y1 = r > 0 ? b + r : 0, y2 = r > 0 ? b + H - r : ch;
  const pos = (c, a, z) => { const o = []; for (let v = c + Math.ceil((a - c) / s - 1e-9) * s; v <= z + 1e-6; v += s) o.push(f(v)); return o; };
  const ys = pos(cy, y1, y2);
  let d = '', sw = S.lw, cap = 'butt';
  for (let k = 0; k < halves; k++) {
    const o = b + k * W, cx = o + W / 2;
    const x1 = r > 0 ? o + r : (k === 0 ? 0 : o), x2 = r > 0 ? o + W - r : (k === halves - 1 ? cw : o + W);
    const xs = pos(cx, x1, x2);
    if (S.pattern === 'lines') d += ys.map(y => `M${f(x1)} ${y}H${f(x2)}`).join('');
    if (S.pattern === 'grid' && xs.length && ys.length) {
      const gx1 = r > 0 ? xs[0] : x1, gx2 = r > 0 ? xs[xs.length - 1] : x2, gy1 = r > 0 ? ys[0] : 0, gy2 = r > 0 ? ys[ys.length - 1] : ch;
      d += ys.map(y => `M${f(gx1)} ${y}H${f(gx2)}`).join('') + xs.map(x => `M${x} ${f(gy1)}V${f(gy2)}`).join('');
    }
    if (S.pattern === 'dots') { d += ys.map(y => xs.map(x => `M${x} ${y}h0.001`).join('')).join(''); sw = S.dot; cap = 'round'; }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(cw)}mm" height="${f(ch)}mm" viewBox="0 0 ${f(cw)} ${f(ch)}"` +
    (L.rot ? ` style="transform-origin:0 0;transform:rotate(90deg) translateY(-100%)"` : '') + `>` +
    (d ? `<path d="${d}" fill="none" stroke="${S.color}" stroke-width="${sw}" stroke-linecap="${cap}"/>` : '') + `</svg>`;
}
function marksSVG(pw, ph, xsT, ysT, top, bottom, left, right) {
  let d = '';
  const seg = (a, z) => Math.abs(z - a) > 1;
  const yA = top - 1.5, yAe = Math.max(0.5, yA - 6), yB = bottom + 1.5, yBe = Math.min(ph - 0.5, yB + 6);
  const xA = left - 1.5, xAe = Math.max(0.5, xA - 6), xB = right + 1.5, xBe = Math.min(pw - 0.5, xB + 6);
  xsT.forEach(x => { if (seg(yA, yAe)) d += `M${f(x)} ${f(yA)}V${f(yAe)}`; if (seg(yB, yBe)) d += `M${f(x)} ${f(yB)}V${f(yBe)}`; });
  ysT.forEach(y => { if (seg(xA, xAe)) d += `M${f(xA)} ${f(y)}H${f(xAe)}`; if (seg(xB, xBe)) d += `M${f(xB)} ${f(y)}H${f(xBe)}`; });
  return d ? `<path d="${d}" stroke="#000" stroke-width="0.15" fill="none"/>` : '';
}
// small note in the waste strip beside or above the content, between its first two marks, if it fits; ex, ey: unprintable edge
function calNote(x0, y0, ex, ey, segX, segY) {
  const at = (x, y, r) => `<text x="${f(x)}" y="${f(y)}" transform="rotate(${r} ${f(x)} ${f(y)})" font-family="Helvetica,Arial,sans-serif" font-size="2" text-anchor="middle" fill="#777">Calibrated for one printer · print at 100 %</text>`;
  if (x0 - ex >= 3 && segY >= 50) return at(ex + 2, y0 + S.bleed + segY / 2, -90);
  if (y0 - ey >= 3 && segX >= 50) return at(x0 + S.bleed + segX / 2, ey + 2, 0);
  return '';
}
function sheetHTML(w, h, html, tf) {
  return `<div class="sheet" style="width:${w}mm;height:${h}mm"><div class="a" style="inset:0;transform:${tf}">${html}</div></div>`;
}
function innerSheet(L, tf = 'none', back) {
  const b = S.bleed, pat = patternSVG(L);
  let h = '';
  for (let j = 0; j < L.ny; j++) for (let i = 0; i < L.nx; i++)
    h += `<div class="a" style="left:${f(L.x0 + i * (L.sw + S.gap))}mm;top:${f(L.y0 + j * (L.sh + S.gap))}mm;width:${f(L.sw)}mm;height:${f(L.sh)}mm;overflow:hidden">${pat}</div>`;
  if (S.marks && L.n) {
    const xs = [], ys = [];
    for (let i = 0; i < L.nx; i++) { const x = L.x0 + i * (L.sw + S.gap) + b; xs.push(x, x + L.tw); }
    for (let j = 0; j < L.ny; j++) { const y = L.y0 + j * (L.sh + S.gap) + b; ys.push(y, y + L.th); }
    let fm = '';
    if (S.fold) {
      const dash = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) > 1 ? `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}` : '';
      if (!L.rot) for (let i = 0; i < L.nx; i++) { const x = L.x0 + i * (L.sw + S.gap) + b + S.w; fm += dash(x, L.y0 - 1.5, x, Math.max(0.5, L.y0 - 7.5)) + dash(x, L.y0 + L.gh + 1.5, x, Math.min(296.5, L.y0 + L.gh + 7.5)); }
      else for (let j = 0; j < L.ny; j++) { const y = L.y0 + j * (L.sh + S.gap) + b + S.w; fm += dash(L.x0 - 1.5, y, Math.max(0.5, L.x0 - 7.5), y) + dash(L.x0 + L.gw + 1.5, y, Math.min(209.5, L.x0 + L.gw + 7.5), y); }
      if (fm) fm = `<path d="${fm}" stroke="#000" stroke-width="0.15" stroke-dasharray="1 0.8" fill="none"/>`;
    }
    h += `<svg class="a" style="left:0;top:0" width="210mm" height="297mm" viewBox="0 0 210 297">${marksSVG(210, 297, xs, ys, L.y0, L.y0 + L.gh, L.x0, L.x0 + L.gw)}${fm}</svg>`;
  }
  const c = correction(S.duplex);
  if (L.n && !back && isCorrected(c)) {
    const ex = (210 - printable(210, c.sx, c.tx)) / 2, ey = (297 - printable(297, c.sy, c.ty)) / 2;
    h += `<svg class="a" style="left:0;top:0" width="210mm" height="297mm" viewBox="0 0 210 297">${calNote(L.x0, L.y0, ex, ey, L.rot ? S.h : S.w, L.rot ? S.w : S.h)}</svg>`;
  }
  return sheetHTML(210, 297, h, tf);
}

/* ---------- Cover ---------- */
function coverBox(C, overlay) {
  const g = imgGeom(C);
  let h = `<svg class="bgc" width="${f(C.Cw)}mm" height="${f(C.Ch)}mm"><rect width="100%" height="100%" fill="${S.coverBg}"/></svg>`;
  if (g) h += `<img class="cimg" alt="" src="${esc(S.imgSrc)}" style="${imgStyle(g)}">`;
  h += `<div class="texts">${textsHTML(C)}</div>`;
  if (overlay) {
    const b = C.b, W = S.w, fs = overlay;
    h += `<div class="ov trim" style="left:${b}mm;top:${b}mm;width:${f(C.Cw - 2 * b)}mm;height:${f(C.Ch - 2 * b)}mm"></div>`;
    h += `<div class="ov spine" style="left:${f(b + W)}mm;top:0;width:${f(C.sp)}mm;height:${f(C.Ch)}mm"></div>`;
    const lab = (x, t, v) => `<div class="ov lab${v ? ' v' : ''}" style="left:${f(x)}mm;top:${f(b + 4)}mm;font-size:${fs}px">${t}</div>`;
    h += lab(b + W / 2, 'Back') + lab(b + W + C.sp / 2, `Spine ≈ ${C.sp} mm`, true) + lab(b + W + C.sp + W / 2, 'Front');
    h += `<div class="guide v" hidden></div><div class="guide h" hidden></div>`;
  }
  return `<div class="cov" style="width:${f(C.Cw)}mm;height:${f(C.Ch)}mm">${h}</div>`;
}
function imgStyle(g) {
  // the CSS box is the unrotated image around the same center
  const [w, h] = S.turn % 2 ? [g.h, g.w] : [g.w, g.h];
  return `left:${f(g.x + (g.w - w) / 2)}mm;top:${f(g.y + (g.h - h) / 2)}mm;width:${f(w)}mm;height:${f(h)}mm;transform:scaleX(${S.mirror ? -1 : 1}) rotate(${S.turn * 90}deg)`;
}
const coverPaper = C => C.upright ? [210, 297] : [297, 210];
function coverSheet(C, portrait, tf = 'none') {
  const [pw, ph] = coverPaper(C), x0 = (pw - C.Cw) / 2, y0 = (ph - C.Ch) / 2, b = C.b;
  let h = `<div class="a" style="left:${f(x0)}mm;top:${f(y0)}mm">${coverBox(C, 0)}</div>`;
  let m = '';
  if (S.marks) m += marksSVG(pw, ph, [x0 + b, x0 + C.Cw - b], [y0 + b, y0 + C.Ch - b], y0, y0 + C.Ch, x0, x0 + C.Cw);
  // dashed fold marks above and below the spine
  const fx = [x0 + b + S.w, x0 + b + S.w + C.sp], yA = y0 - 1.5, yB = y0 + C.Ch + 1.5;
  let d = '';
  fx.forEach(x => { if (yA - 6 > 0.5) d += `M${f(x)} ${f(yA)}V${f(yA - 6)}`; if (yB + 6 < ph - 0.5) d += `M${f(x)} ${f(yB)}V${f(yB + 6)}`; });
  if (d) m += `<path d="${d}" stroke="#000" stroke-width="0.15" stroke-dasharray="1 0.8" fill="none"/>`;
  const c = correction(false);
  const [cx, cy] = C.upright ? [c.sx, c.sy] : [c.sy, c.sx];
  if (isCorrected(c)) m += calNote(x0, y0, (pw - printable(pw, cx, 0)) / 2, (ph - printable(ph, cy, 0)) / 2, S.w, S.h);
  if (m) h += `<svg class="a" style="left:0;top:0" width="${pw}mm" height="${ph}mm" viewBox="0 0 ${pw} ${ph}">${m}</svg>`;
  if (portrait && !C.upright) // landscape cover rotated onto a portrait sheet so every PDF page has the same orientation
    return sheetHTML(ph, pw, `<div class="a" style="left:0;top:0;width:${pw}mm;height:${ph}mm;transform-origin:0 0;transform:rotate(90deg) translateY(-100%)">${h}</div>`, tf);
  return sheetHTML(pw, ph, h, tf);
}
