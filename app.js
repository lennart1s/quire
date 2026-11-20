const PX = 96 / 25.4;
const PAPER = { A4: [297, 210], A3: [420, 297] };
const SPACING = { lines: 7, grid: 5, dots: 5, blank: 5 };
const DEF = { preset: '148x210', w: 148, h: 210, bleed: 3, margin: 5, gap: 0, pattern: 'dots', spacing: 5, rand: 0,
  color: '#9c9c9c', lw: 0.2, dot: 0.6, sheets: 10, duplex: true, marks: true, paperTh: 0.1, coverTh: 0.8,
  spine: 5, spineAuto: true, coverPaper: 'A4', fold: true, coverBg: '#ffffff', imgSrc: '', zoom: 1, offX: 0, offY: 0 };
const KEY = 'quire';
let S = { ...DEF };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const IMG = { ok: false, nw: 0, nh: 0 };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const f = n => +(+n).toFixed(3);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { try { localStorage.setItem(KEY, JSON.stringify({ ...S, imgSrc: '' })); } catch (e2) {} }
}

/* ---------- Geometry ---------- */
function layout() {
  const b = S.bleed, pw0 = S.fold ? 2 * S.w : S.w, cw = pw0 + 2 * b, ch = S.h + 2 * b, m = S.margin, g = S.gap;
  const uw = 210 - 2 * m, uh = 297 - 2 * m;
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
  const [pw, ph] = PAPER[S.coverPaper];
  const fits = Cw <= pw - 2 * S.margin && Ch <= ph - 2 * S.margin;
  const fitsA4 = Cw <= 297 - 2 * S.margin && Ch <= 210 - 2 * S.margin;
  return { sp, b, Cw, Ch, pw, ph, fits, fitsA4, leaves };
}
function imgGeom(C) {
  if (!IMG.ok) return null;
  const a = IMG.nw / IMG.nh;
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
function innerSheet(L) {
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
  return `<div class="sheet" style="width:210mm;height:297mm">${h}</div>`;
}

/* ---------- Cover ---------- */
function coverBox(C, overlay) {
  const g = imgGeom(C);
  let h = `<svg class="bgc" width="${f(C.Cw)}mm" height="${f(C.Ch)}mm"><rect width="100%" height="100%" fill="${S.coverBg}"/></svg>`;
  if (g) h += `<img class="cimg" alt="" src="${esc(S.imgSrc)}" style="${imgStyle(g)}">`;
  if (overlay) {
    const b = C.b, W = S.w, fs = overlay;
    h += `<div class="ov trim" style="left:${b}mm;top:${b}mm;width:${f(C.Cw - 2 * b)}mm;height:${f(C.Ch - 2 * b)}mm"></div>`;
    h += `<div class="ov spine" style="left:${f(b + W)}mm;top:0;width:${f(C.sp)}mm;height:${f(C.Ch)}mm"></div>`;
    const lab = (x, t, v) => `<div class="ov lab${v ? ' v' : ''}" style="left:${f(x)}mm;top:${f(b + 4)}mm;font-size:${fs}px">${t}</div>`;
    h += lab(b + W / 2, 'Back') + lab(b + W + C.sp / 2, `Spine ≈ ${C.sp} mm`, true) + lab(b + W + C.sp + W / 2, 'Front');
  }
  return `<div class="cov" style="width:${f(C.Cw)}mm;height:${f(C.Ch)}mm">${h}</div>`;
}
function imgStyle(g) { return `left:${f(g.x)}mm;top:${f(g.y)}mm;width:${f(g.w)}mm;height:${f(g.h)}mm`; }
function coverSheet(C, portrait) {
  const x0 = (C.pw - C.Cw) / 2, y0 = (C.ph - C.Ch) / 2, b = C.b;
  let h = `<div class="a" style="left:${f(x0)}mm;top:${f(y0)}mm">${coverBox(C, 0)}</div>`;
  let m = '';
  if (S.marks) m += marksSVG(C.pw, C.ph, [x0 + b, x0 + C.Cw - b], [y0 + b, y0 + C.Ch - b], y0, y0 + C.Ch, x0, x0 + C.Cw);
  // dashed fold marks above and below the spine
  const fx = [x0 + b + S.w, x0 + b + S.w + C.sp], yA = y0 - 1.5, yB = y0 + C.Ch + 1.5;
  let d = '';
  fx.forEach(x => { if (yA - 6 > 0.5) d += `M${f(x)} ${f(yA)}V${f(yA - 6)}`; if (yB + 6 < C.ph - 0.5) d += `M${f(x)} ${f(yB)}V${f(yB + 6)}`; });
  if (d) m += `<path d="${d}" stroke="#000" stroke-width="0.15" stroke-dasharray="1 0.8" fill="none"/>`;
  if (m) h += `<svg class="a" style="left:0;top:0" width="${C.pw}mm" height="${C.ph}mm" viewBox="0 0 ${C.pw} ${C.ph}">${m}</svg>`;
  if (portrait) // landscape cover rotated onto a portrait sheet so every PDF page has the same orientation
    return `<div class="sheet csheet" style="width:${C.ph}mm;height:${C.pw}mm"><div class="a" style="left:0;top:0;width:${C.pw}mm;height:${C.ph}mm;transform-origin:0 0;transform:rotate(90deg) translateY(-100%)">${h}</div></div>`;
  return `<div class="sheet csheet" style="width:${C.pw}mm;height:${C.ph}mm">${h}</div>`;
}

/* ---------- Screen ---------- */
let K = 1; // px per mm in the crop stage
function renderStage() {
  const st = $('stage'), C = cover();
  const wpx = st.clientWidth || 600;
  K = wpx / C.Cw;
  st.style.height = (C.Ch * K) + 'px';
  st.classList.toggle('empty', !IMG.ok);
  st.innerHTML = (IMG.ok ? '' : `<div class="ph"><span>Your cover image will appear here</span></div>`) +
    `<div class="scaled" style="transform:scale(${K / PX})">${coverBox(C, 13 * PX / K)}</div>`;
}
function updateImg() {
  const C = cover(), g = imgGeom(C), el = $('stage').querySelector('.cimg');
  if (el && g) el.setAttribute('style', imgStyle(g));
  $('zoom').value = Math.round(S.zoom * 100);
}
function preview(box, html, pw, ph, maxW) {
  const k = Math.min(maxW / pw, 340 / ph);
  box.style.width = pw * k + 'px'; box.style.height = ph * k + 'px';
  box.innerHTML = `<div class="scaled" style="transform:scale(${k / PX})">${html}</div>`;
}
function renderAll() {
  const L = layout(), C = cover();
  const pages = S.sheets * (S.duplex ? 2 : 1);
  const leaves = L.n * S.sheets * (S.fold ? 2 : 1);
  $('f-spacing').hidden = S.pattern === 'blank';
  $('f-lw').hidden = S.pattern !== 'lines' && S.pattern !== 'grid';
  $('f-dot').hidden = S.pattern !== 'dots';
  $('f-paperTh').hidden = $('f-coverTh').hidden = $('spineHint').hidden = !S.spineAuto;
  $('innerInfo').innerHTML = L.n
    ? `<b>${plural(L.n, S.fold ? 'spread' : 'page')} per A4 sheet</b> (${L.nx} × ${L.ny}${L.rot ? ', rotated' : ''}) · ${leaves} leaves = ${leaves * (S.duplex ? 2 : 1)} notebook pages · the PDF has ${pages} pages`
      + (S.fold ? ' · dashed marks show the fold' : '')
    : `<span class="warn">${S.fold
      ? 'A spread doesn’t fit on A4 with this bleed and print margin. Reduce them, pick a smaller size or switch to single pages.'
      : 'The page doesn’t fit on A4 with this bleed and print margin.'}</span>`;
  $('spine').disabled = S.spineAuto;
  if (S.spineAuto) $('spine').value = C.sp;
  let ci = `Cover: ${f(C.Cw)} × ${f(C.Ch)} mm incl. bleed · spine ≈ ${C.sp} mm (${C.leaves} leaves) · printed on ${S.coverPaper}`;
  if (!C.fits) ci += ` · <span class="warn">doesn’t fit on ${S.coverPaper}. Reduce size, bleed or print margin.</span>`;
  else if (S.coverPaper === 'A3' && C.fitsA4) ci += ` · also fits on A4`;
  $('coverInfo').innerHTML = ci;
  renderStage();
  const maxW = Math.max(180, ($('pvInner').parentElement.clientWidth || 260) - 10);
  const sheet = innerSheet(L);
  preview($('pvPage'), sheet, 210, 297, Math.max(180, $('pvPage').parentElement.clientWidth || 240));
  preview($('pvInner'), sheet, 210, 297, maxW);
  preview($('pvCover'), coverSheet(C), C.pw, C.ph, maxW);
  $('pvInnerLab').textContent = 'Pages · A4' + (S.fold ? ' · folded spreads' : '');
  $('pvCoverLab').textContent = `Cover · ${S.coverPaper}`;
  $('zoom').value = Math.round(S.zoom * 100);
}

/* ---------- Loading images ---------- */
function msg(t, bad) { $('msg').innerHTML = t; $('msg').className = 'msg' + (bad ? ' warn' : ''); }
function loadSrc(src, keep, onfail) {
  const im = new Image();
  im.onload = () => {
    IMG.ok = true; IMG.nw = im.naturalWidth; IMG.nh = im.naturalHeight; S.imgSrc = src;
    if (!keep) { S.zoom = 1; S.offX = 0; S.offY = 0; }
    msg(`Image loaded (${IMG.nw} × ${IMG.nh} px)`); save(); renderAll();
  };
  im.onerror = () => onfail ? onfail() : msg('Couldn’t load the image. Is it a direct image address?', true);
  im.src = src;
}
const PIN_SIZE = /\/(\d+x\d*|originals)\//;
async function fromUrl(u) {
  u = u.trim(); if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  msg('Loading …');
  if (/i\.pinimg\.com/.test(u)) {
    return loadSrc(u.replace(PIN_SIZE, '/originals/'), false,
      () => loadSrc(u.replace(PIN_SIZE, '/736x/'), false, () => loadSrc(u)));
  }
  if (/pinterest\.|pin\.it/i.test(u)) {
    let found = null;
    try {
      const r = await fetch('https://www.pinterest.com/oembed.json?url=' + encodeURIComponent(u));
      if (r.ok) found = (await r.json()).thumbnail_url;
    } catch (e) {}
    if (!found) try {
      const r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(u));
      if (r.ok) {
        const t = await r.text();
        const m = t.match(/https:\/\/i\.pinimg\.com\/(?:originals|736x|564x|474x)\/[^"'\s\\]+?\.(?:jpe?g|png|webp|gif)/i);
        if (m) found = m[0];
      }
    } catch (e) {}
    if (found) return fromUrl(found);
    return msg('Pinterest is blocking direct access right now. Open the pin, right-click the image (on a phone: long-press), choose “Copy image address” and paste the <i>i.pinimg.com</i> address here.', true);
  }
  loadSrc(u);
}

/* ---------- Crop interaction ---------- */
function setZoom(z) { S.zoom = Math.min(8, Math.max(0.05, z)); }
function fitPanel(px, pwid) {
  const C = cover(), g = imgGeom(C);
  if (!g) return;
  const s = Math.max(pwid / IMG.nw, C.Ch / IMG.nh);
  setZoom(IMG.nw * s / g.bw); S.offX = px - C.Cw / 2; S.offY = 0;
}
const ptrs = new Map();
const st = $('stage');
st.addEventListener('pointerdown', e => { if (!IMG.ok) return; st.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); st.style.cursor = 'grabbing'; });
st.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1) { S.offX += (e.clientX - p.x) / K; S.offY += (e.clientY - p.y) / K; }
  else if (ptrs.size === 2) {
    const o = [...ptrs.entries()].find(([k]) => k !== e.pointerId)[1];
    const d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y);
    if (d0 > 0) setZoom(S.zoom * d1 / d0);
  }
  p.x = e.clientX; p.y = e.clientY; updateImg();
});
const up = e => { if (ptrs.delete(e.pointerId) && !ptrs.size) { st.style.cursor = ''; save(); renderAll(); } };
st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
st.addEventListener('wheel', e => { if (!IMG.ok) return; e.preventDefault(); setZoom(S.zoom * Math.exp(-e.deltaY * 0.0015)); updateImg(); clearTimeout(st._t); st._t = setTimeout(() => { save(); renderAll(); }, 250); }, { passive: false });
$('zoom').addEventListener('input', e => { setZoom(e.target.value / 100); updateImg(); });
$('zoom').addEventListener('change', () => { save(); renderAll(); });
$('fitAll').onclick = () => { S.zoom = 1; S.offX = 0; S.offY = 0; save(); renderAll(); };
$('fitFront').onclick = () => { const C = cover(); fitPanel((C.b + S.w + C.sp + C.Cw) / 2, S.w + C.b); save(); renderAll(); };
$('fitContain').onclick = () => { const C = cover(), g = imgGeom(C); if (!g) return; const s = Math.min(C.Cw / IMG.nw, C.Ch / IMG.nh); setZoom(IMG.nw * s / g.bw); S.offX = 0; S.offY = 0; save(); renderAll(); };

/* ---------- Inputs ---------- */
const NUM = ['w', 'h', 'bleed', 'margin', 'gap', 'spacing', 'rand', 'lw', 'dot', 'sheets', 'paperTh', 'coverTh', 'spine'];
const BOOL = ['duplex', 'marks', 'spineAuto'];
const TXT = ['color', 'coverBg', 'coverPaper', 'preset'];
NUM.forEach(k => { $(k).value = S[k]; $(k).addEventListener('input', e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (!isNaN(v)) { S[k] = v; if (k === 'w' || k === 'h') { S.preset = 'custom'; $('preset').value = 'custom'; } save(); renderAll(); } }); });
BOOL.forEach(k => { $(k).checked = !!S[k]; $(k).addEventListener('change', e => { S[k] = e.target.checked; save(); renderAll(); }); });
TXT.forEach(k => { $(k).value = S[k]; $(k).addEventListener('input', e => {
  S[k] = e.target.value;
  if (k === 'preset' && S.preset !== 'custom') { const [w, h] = S.preset.split('x').map(Number); S.w = w; S.h = h; $('w').value = w; $('h').value = h; }
  save(); renderAll(); }); });
const segBtns = [...document.querySelectorAll('#pattern button')];
const markSeg = () => segBtns.forEach(b => b.classList.toggle('on', b.dataset.v === S.pattern));
segBtns.forEach(b => b.onclick = () => { S.pattern = b.dataset.v; S.spacing = SPACING[S.pattern]; $('spacing').value = S.spacing; markSeg(); save(); renderAll(); });
markSeg();
const modeBtns = [...document.querySelectorAll('#mode button')];
const markMode = () => modeBtns.forEach(b => b.classList.toggle('on', (b.dataset.v === 'fold') === !!S.fold));
modeBtns.forEach(b => b.onclick = () => { S.fold = b.dataset.v === 'fold'; markMode(); save(); renderAll(); });
markMode();
const readFile = file => { const r = new FileReader(); r.onload = () => loadSrc(r.result); r.readAsDataURL(file); };
$('file').addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); });
$('loadUrl').onclick = () => fromUrl($('url').value);
$('url').addEventListener('keydown', e => { if (e.key === 'Enter') fromUrl($('url').value); });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) return readFile(file);
  const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (u) { $('url').value = u; fromUrl(u); }
});

/* ---------- Printing ---------- */
function doPrint(what) {
  const L = layout(), C = cover();
  let html = '', css = '';
  if (what !== 'cover') {
    if (!L.n) return alert('The page size doesn’t fit on A4.');
    const one = innerSheet(L), pages = S.sheets * (S.duplex ? 2 : 1);
    for (let i = 0; i < pages; i++) html += one;
  }
  if (what !== 'inner') html += coverSheet(C, true);
  if (what === 'cover') css = `@page{size:${C.ph}mm ${C.pw}mm;margin:0}`;
  else css = `@page{size:210mm 297mm;margin:0}` + (what === 'all' && S.coverPaper !== 'A4' ? `@page cover{size:${C.ph}mm ${C.pw}mm;margin:0}.csheet{page:cover}` : '');
  $('pagestyle').textContent = css;
  $('print').innerHTML = html;
  const imgs = [...$('print').querySelectorAll('img')];
  Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 50));
}
window.addEventListener('afterprint', () => { $('print').innerHTML = ''; });
$('printInner').onclick = () => doPrint('inner');
$('printCover').onclick = () => doPrint('cover');
$('printAll').onclick = () => doPrint('all');

new ResizeObserver(() => renderAll()).observe($('stage').parentElement);
if (S.imgSrc) loadSrc(S.imgSrc, true, () => { S.imgSrc = ''; renderAll(); });
renderAll();
