/* The page itself: previews, inputs, cover editing, saved notebooks, printing */
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
  armLock();
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
      ? 'A spread doesn’t fit on A4 with this bleed and your printer’s margin. Reduce the bleed, pick a smaller size or switch to single pages.'
      : 'The page doesn’t fit on A4 with this bleed and your printer’s margin.'}</span>`;
  $('spine').disabled = S.spineAuto;
  if (S.spineAuto) $('spine').value = C.sp;
  let ci = `Cover: ${f(C.Cw)} × ${f(C.Ch)} mm incl. bleed · spine ≈ ${C.sp} mm (${C.leaves} leaves) · printed on A4`;
  if (!C.fits) ci += ` · <span class="warn">doesn’t fit on A4. Reduce size or bleed.</span>`;
  $('coverInfo').innerHTML = ci;
  renderCal();
  renderStage();
  const maxW = Math.max(180, ($('pvInner').parentElement.clientWidth || 260) - 10);
  const sheet = innerSheet(L);
  preview($('pvPage'), sheet, 210, 297, Math.max(180, $('pvPage').parentElement.clientWidth || 240));
  preview($('pvInner'), sheet, 210, 297, maxW);
  preview($('pvCover'), coverSheet(C), 297, 210, maxW);
  $('pvInnerLab').textContent = 'Pages · A4' + (S.fold ? ' · folded spreads' : '');
  $('zoom').value = Math.round(S.zoom * 100);
}

/* ---------- Loading images ---------- */
function msg(t, bad) { $('msg').innerHTML = t; $('msg').className = 'msg' + (bad ? ' warn' : ''); }
function loadSrc(src, keep, onfail) {
  const im = new Image();
  im.onload = () => {
    IMG.ok = true; IMG.nw = im.naturalWidth; IMG.nh = im.naturalHeight; S.imgSrc = src;
    if (!keep) { S.zoom = 1; S.offX = 0; S.offY = 0; S.turn = 0; S.mirror = false; setLock(false); }
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
  const [nw, nh] = imgSize(), s = Math.max(pwid / nw, C.Ch / nh);
  setZoom(nw * s / g.bw); S.offX = px - C.Cw / 2; S.offY = 0;
}
const ptrs = new Map();
const st = $('stage');
let locked = true, lockT;
function setLock(on) {
  clearTimeout(lockT);
  locked = on;
  st.classList.toggle('unlocked', !on);
  $('lock').lastChild.textContent = on ? 'Unlock' : 'Lock';
}
function armLock() {
  clearTimeout(lockT);
  lockT = setTimeout(() => ptrs.size ? armLock() : setLock(true), 3000);
}
$('lock').onclick = () => { setLock(!locked); if (!locked) armLock(); };
['fitAll', 'fitFront', 'fitContain', 'rotL', 'rotR', 'flipH', 'flipV'].forEach(id => $(id).addEventListener('click', armLock));
st.addEventListener('pointerdown', e => { if (locked) return; st.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); st.style.cursor = 'grabbing'; });
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
st.addEventListener('wheel', e => { if (locked) return; e.preventDefault(); setZoom(S.zoom * Math.exp(-e.deltaY * 0.0015)); updateImg(); clearTimeout(st._t); st._t = setTimeout(() => { save(); renderAll(); }, 250); }, { passive: false });
$('zoom').addEventListener('input', e => { setZoom(e.target.value / 100); updateImg(); });
$('zoom').addEventListener('change', () => { save(); renderAll(); });
$('fitAll').onclick = () => { S.zoom = 1; S.offX = 0; S.offY = 0; save(); renderAll(); };
$('fitFront').onclick = () => { const C = cover(); fitPanel((C.b + S.w + C.sp + C.Cw) / 2, S.w + C.b); save(); renderAll(); };
$('fitContain').onclick = () => { const C = cover(), g = imgGeom(C); if (!g) return; const [nw, nh] = imgSize(), s = Math.min(C.Cw / nw, C.Ch / nh); setZoom(nw * s / g.bw); S.offX = 0; S.offY = 0; save(); renderAll(); };
function turnImg(q) { S.turn = (S.turn + q + 4) % 4; save(); renderAll(); }
// mirroring is applied after the turn, so on a mirrored image the turn runs the other way
$('rotL').onclick = () => turnImg(S.mirror ? 1 : -1);
$('rotR').onclick = () => turnImg(S.mirror ? -1 : 1);
$('flipH').onclick = () => { S.mirror = !S.mirror; turnImg(0); };
$('flipV').onclick = () => { S.mirror = !S.mirror; turnImg(2); };

/* ---------- Inputs ---------- */
const NUM = ['w', 'h', 'bleed', 'gap', 'spacing', 'rand', 'lw', 'dot', 'sheets', 'paperTh', 'coverTh', 'spine'];
const BOOL = ['duplex', 'marks', 'spineAuto'];
const TXT = ['color', 'coverBg', 'preset'];
NUM.forEach(k => { $(k).addEventListener('input', e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (!isNaN(v)) { S[k] = v; if (k === 'w' || k === 'h') { S.preset = 'custom'; $('preset').value = 'custom'; } save(); renderAll(); } }); });
BOOL.forEach(k => { $(k).addEventListener('change', e => { S[k] = e.target.checked; save(); renderAll(); }); });
TXT.forEach(k => { $(k).addEventListener('input', e => {
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
function syncInputs() {
  NUM.forEach(k => $(k).value = S[k]);
  BOOL.forEach(k => $(k).checked = !!S[k]);
  TXT.forEach(k => $(k).value = S[k]);
  if (!$('preset').value) $('preset').value = S.preset = 'custom'; // saved with a preset that no longer exists
  markSeg(); markMode();
}
syncInputs();
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

/* ---------- Saved notebooks (IndexedDB, so full-size cover images fit) ---------- */
const db = new Promise((res, rej) => {
  const r = indexedDB.open('quire', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('configs', { keyPath: 'name' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function idb(mode, fn) {
  const d = await db;
  return new Promise((res, rej) => { const t = d.transaction('configs', mode), q = fn(t.objectStore('configs')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); });
}
let names = [];
function cfgMsg(t, bad) { $('cfgMsg').textContent = t; $('cfgMsg').className = 'msg' + (bad ? ' warn' : ''); }
async function refreshList(sel) {
  names = (await idb('readonly', s => s.getAllKeys())).sort((a, b) => a.localeCompare(b));
  $('cfg').innerHTML = `<option value="">${names.length ? 'Load a saved notebook…' : 'No saved notebooks yet'}</option>` +
    names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  $('cfg').value = sel;
  $('cfgDel').disabled = !sel;
}
async function loadConfig(name) {
  const c = await idb('readonly', s => s.get(name));
  if (!c) return;
  S = { ...DEF, ...c.S }; IMG.ok = false; setLock(true);
  $('cfgName').value = name; msg(''); syncInputs(); save(); renderAll();
  if (S.imgSrc) loadSrc(S.imgSrc, true, () => { S.imgSrc = ''; renderAll(); });
  cfgMsg(`Loaded “${name}”.`);
}
$('cfg').onchange = () => { $('cfgDel').disabled = !$('cfg').value; if ($('cfg').value) loadConfig($('cfg').value); };
$('cfgName').addEventListener('keydown', e => { if (e.key === 'Enter') $('cfgSave').click(); });
$('cfgSave').onclick = async () => {
  const name = $('cfgName').value.trim();
  if (!name) return $('cfgName').focus();
  if (name !== $('cfg').value && names.includes(name) && !confirm(`Replace the saved notebook “${name}”?`)) return;
  try {
    await idb('readwrite', s => s.put({ name, S: { ...S }, savedAt: new Date().toISOString() }));
    await refreshList(name); cfgMsg(`Saved “${name}”.`);
  } catch (e) { cfgMsg('Couldn’t save: ' + e.message, true); }
};
$('cfgDel').onclick = async () => {
  const name = $('cfg').value;
  if (!name || !confirm(`Delete the saved notebook “${name}”?`)) return;
  await idb('readwrite', s => s.delete(name));
  $('cfgName').value = ''; await refreshList(''); cfgMsg(`Deleted “${name}”.`);
};
refreshList('');

/* ---------- Printing ---------- */
function doPrint(what) {
  const L = layout(), C = cover();
  let html = '';
  if (what !== 'cover') {
    if (!L.n) return alert('The page size doesn’t fit on A4.');
    const c = correction(S.duplex), one = innerSheet(L, corrCSS(c)) + (S.duplex ? innerSheet(L, corrCSS(c, -1), true) : '');
    html += one.repeat(S.sheets);
  }
  if (what !== 'inner') {
    if (!C.fits) return alert('The cover doesn’t fit on A4.');
    html += coverSheet(C, true, corrCSS(correction(false)));
  }
  printHTML(html);
}
function printHTML(html) {
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
