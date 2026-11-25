/* Settings, storage and small helpers shared by the other scripts */
const PX = 96 / 25.4;
const SPACING = { lines: 7, grid: 5, dots: 5, blank: 5 };
const DEF = { preset: '85x135', w: 85, h: 135, bleed: 3, gap: 0, pattern: 'dots', spacing: 5, rand: 0,
  color: '#9c9c9c', lw: 0.2, dot: 0.5, sheets: 10, duplex: true, marks: true, paperTh: 0.1, coverTh: 0.8,
  spine: 5, spineAuto: true, fold: true, coverBg: '#ffffff', imgSrc: '', zoom: 1, offX: 0, offY: 0, turn: 0, mirror: false, texts: [], coverDir: true };
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
