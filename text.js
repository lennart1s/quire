/* Text on the cover: fonts, HTML and editing */
// the first entry of each group is the browser's default and always there, the others are offered if installed
const FONTS = {
  serif: ['Serif', 'Baskerville', 'Bodoni MT', 'Book Antiqua', 'C059', 'Cambria', 'Constantia', 'DejaVu Serif', 'Didot', 'Garamond', 'Georgia', 'Hoefler Text', 'Liberation Serif', 'Noto Serif', 'P052', 'Palatino', 'Palatino Linotype', 'Rockwell', 'Times New Roman', 'URW Bookman'],
  'sans-serif': ['Sans', 'Arial', 'Avenir Next', 'Calibri', 'Candara', 'Century Gothic', 'Corbel', 'DejaVu Sans', 'Franklin Gothic Medium', 'Futura', 'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', 'Liberation Sans', 'Noto Sans', 'Optima', 'Roboto', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Ubuntu', 'URW Gothic', 'Verdana'],
  monospace: ['Typewriter', 'American Typewriter', 'Consolas', 'Courier New', 'DejaVu Sans Mono', 'Liberation Mono', 'Menlo', 'Nimbus Mono PS', 'Noto Sans Mono', 'Ubuntu Mono'],
  cursive: ['Handwriting', 'Apple Chancery', 'Bradley Hand', 'Brush Script MT', 'Chalkboard', 'Comic Sans MS', 'Ink Free', 'Lucida Handwriting', 'Marker Felt', 'Noteworthy', 'Savoye LET', 'Segoe Print', 'Segoe Script', 'Snell Roundhand', 'Z003', 'Zapfino'],
  fantasy: ['Display', 'Arial Black', 'Arial Narrow', 'Copperplate', 'Haettenschweiler', 'Impact', 'Liberation Sans Narrow', 'Nimbus Sans Narrow', 'Papyrus', 'Phosphate', 'Rosewood Std', 'Stencil'],
};
const isInstalled = (() => {
  const ctx = document.createElement('canvas').getContext('2d');
  const width = family => { ctx.font = `72px ${family}`; return ctx.measureText('mmwwiillWQ@&gy123').width; };
  const base = ['serif', 'monospace'].map(g => [g, width(g)]);
  return font => base.some(([g, w]) => width(`'${font}', ${g}`) !== w);
})();
function fontFamily(font) {
  const g = Object.keys(FONTS).find(g => FONTS[g].includes(font));
  return font === FONTS[g][0] ? g : `'${font}', ${g}`;
}

/* ---------- HTML ---------- */
// left edge and width of a cover part; texts are stored relative to it, so they stay put when the spine grows
const part = (C, name) => ({ back: [C.b, S.w], spine: [C.b + S.w, C.sp], front: [C.b + S.w + C.sp, S.w] })[name];
const center = (C, t) => { const [x, w] = part(C, t.part); return [x + t.x * w, C.b + t.y * S.h]; };
function textStyle(C, t) {
  const [x, y] = center(C, t);
  return `left:${f(x)}mm;top:${f(y)}mm;font:${t.italic ? 'italic' : 'normal'} ${t.bold ? 700 : 400} ${f(t.size * 25.4 / 72)}mm/1.2 ${fontFamily(t.font)};` +
    `color:${t.color};text-align:${t.align};text-decoration:${t.underline ? 'underline' : 'none'};transform:translate(-50%,-50%) rotate(${t.turn * 90}deg)`;
}
const textsHTML = C => S.texts.map((t, i) => `<div class="ctext${t === sel ? ' sel' : ''}" data-i="${i}" style="${textStyle(C, t)}">${esc(t.text)}</div>`).join('');

/* ---------- Editing ---------- */
let sel = null; // selected text, one of S.texts
const dropEmpty = () => S.texts = S.texts.filter(t => t === sel || t.text.trim());
dropEmpty(); // the page may have been closed while a text was empty
function renderTexts() {
  const html = textsHTML(cover());
  document.querySelectorAll('.texts').forEach(el => el.innerHTML = html);
}
function selectText(t) {
  if (t === sel) return;
  sel = t; dropEmpty();
  if (t) { setLock(true); syncText(); }
  $('stagebox').classList.toggle('editing', !!t);
  $('imgTools').hidden = !!t; $('txtTools').hidden = !t;
  save(); renderAll();
}
function changeText(patch) { Object.assign(sel, patch); save(); renderTexts(); }
function syncText() {
  if (![...$('tFont').options].some(o => o.value === sel.font)) $('tFont').add(new Option(tr('{0} (not on this device)', sel.font), sel.font));
  $('tText').value = sel.text; $('tFont').value = sel.font; $('tSize').value = sel.size; $('tColor').value = sel.color;
  document.querySelectorAll('#tStyle button').forEach(b => b.classList.toggle('on', sel[b.dataset.v]));
  document.querySelectorAll('#tAlign button').forEach(b => b.classList.toggle('on', sel.align === b.dataset.v));
}
$('tFont').innerHTML = Object.entries(FONTS).map(([g, [def, ...more]]) => `<optgroup label="${tr(def)}">` +
  [def, ...more.filter(isInstalled)].map(n => `<option value="${n}" style="font-family:${fontFamily(n)}">${n === def ? tr('{0} (default)', tr(n)) : n}</option>`).join('') + '</optgroup>').join('');
$('addText').onclick = () => {
  const t = { text: tr('Title'), font: 'Serif', size: 24, color: IMG.ok ? '#ffffff' : '#000000', bold: false, italic: false, underline: false, align: 'center', turn: 0, part: 'front', x: 0.5, y: 0.3 };
  S.texts = [...S.texts, t];
  $('stagebox').scrollIntoView({ block: 'nearest' }); // before it turns sticky on phones, or it would cover the text field
  selectText(t); $('tText').focus(); $('tText').select(); $('tText').scrollIntoView({ block: 'nearest' }); // WebKit doesn't reveal it on focus
};
$('tText').oninput = e => changeText({ text: e.target.value });
$('tFont').onchange = e => changeText({ font: e.target.value });
$('tSize').oninput = e => { const size = +e.target.value; if (size > 0) changeText({ size }); };
$('tColor').oninput = e => changeText({ color: e.target.value });
document.querySelectorAll('#tStyle button').forEach(b => b.onclick = () => { changeText({ [b.dataset.v]: !sel[b.dataset.v] }); syncText(); });
document.querySelectorAll('#tAlign button').forEach(b => b.onclick = () => { changeText({ align: b.dataset.v }); syncText(); });
$('tCenterX').onclick = () => changeText({ x: 0.5 });
$('tCenterY').onclick = () => changeText({ y: 0.5 });
$('tTurn').onclick = () => changeText({ turn: (sel.turn + 1) % 4 });
$('tDel').onclick = () => { S.texts = S.texts.filter(t => t !== sel); selectText(null); };
$('tDone').onclick = () => selectText(null);

/* Tap selects, only the selected text can be dragged */
{
  const stage = $('stage');
  let press = null, moved = false, grab = null;
  const toMM = e => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / K, (e.clientY - r.top) / K]; };
  stage.addEventListener('pointerdown', e => {
    if (!e.isPrimary) return void (moved = true); // a second finger: not a tap
    if (e.button) return;
    press = e; moved = false;
    if (!e.target.closest('.ctext.sel')) return;
    const [x, y] = toMM(e), [cx, cy] = center(cover(), sel);
    grab = [cx - x, cy - y];
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!press || e.pointerId !== press.pointerId) return;
    moved ||= Math.hypot(e.clientX - press.clientX, e.clientY - press.clientY) > 4;
    if (!grab || !moved) return;
    const C = cover(), [mx, my] = toMM(e), clamp = (v, a, z) => Math.min(z, Math.max(a, v));
    const x = clamp(mx + grab[0], C.b, C.Cw - C.b), y = clamp(my + grab[1], C.b, C.Ch - C.b);
    const name = x < C.b + S.w ? 'back' : x < C.b + S.w + C.sp ? 'spine' : 'front', [x0, w] = part(C, name);
    const snap = (v, len) => Math.abs(v - len / 2) * K < 7 ? 0.5 : v / len;
    Object.assign(sel, { part: name, x: snap(x - x0, w), y: snap(y - C.b, S.h) });
    document.querySelectorAll(`.ctext[data-i="${S.texts.indexOf(sel)}"]`).forEach(el => el.setAttribute('style', textStyle(C, sel)));
    const [gx, gy] = center(C, sel), [v, h] = stage.querySelectorAll('.guide');
    v.hidden = sel.x !== 0.5; v.style.left = gx + 'mm';
    h.hidden = sel.y !== 0.5; h.style.top = gy + 'mm';
  });
  const release = e => {
    if (e.pointerId !== press?.pointerId) return;
    if (e.type === 'pointerup' && !moved) {
      const el = document.elementFromPoint(e.clientX, e.clientY).closest('.ctext'); // e.target is the stage while the pointer is captured
      selectText(el ? S.texts[el.dataset.i] : null);
    }
    if (grab) { stage.querySelectorAll('.guide').forEach(g => g.hidden = true); save(); }
    press = grab = null;
  };
  stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release);
}
