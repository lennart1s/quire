/* Printer calibration: values and correction, test sheet, dialog */
// shared by all notebooks: lengths measured on the test sheet, print margin, front to back offset as read from the sheet's scales
const CAL_KEY = 'quire-cal', CAL_LEN = 160;
const CAL = { calW: CAL_LEN, calH: CAL_LEN, margin: S.margin ?? 5, backX: 0, backY: 0 };
try { Object.assign(CAL, JSON.parse(localStorage.getItem(CAL_KEY) || '{}')); } catch (e) {}
function saveCal() { try { localStorage.setItem(CAL_KEY, JSON.stringify(CAL)); } catch (e) {} }
saveCal(); // the margin used to be a notebook setting: keep it before an old notebook changes S.margin

// a larger error comes from scaling in the print dialog, not from the printer
const badLen = v => Math.abs(v - CAL_LEN) > 0.015 * CAL_LEN;
const scale = v => badLen(v) ? 1 : CAL_LEN / v;
// on double-sided sheets front and back each move half of the offset towards each other
const correction = duplex => ({ sx: scale(CAL.calW), sy: scale(CAL.calH), tx: duplex ? CAL.backX / 2 : 0, ty: duplex ? CAL.backY / 2 : 0 });
const isCorrected = c => c.sx !== 1 || c.sy !== 1 || c.tx !== 0 || c.ty !== 0;
// side: 1 front, -1 back. Seen from the back, left and right are mirrored, so across both sides move the same way
const corrCSS = (c, side = 1) => `translate(${c.tx}mm,${side * c.ty}mm) scale(${c.sx},${c.sy})`;
// printable length of a sheet side, in layout coordinates
const printable = (size, s, t) => (size - 2 * CAL.margin - 2 * Math.abs(t)) / s;

/* ---------- Test sheet ---------- */
const txt = (x, y, s, size = 3.6, attr = '') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" ${attr}>${s}</text>`;
const stroke = (d, w, color = '#000') => `<path d="${d}" stroke="${color}" stroke-width="${w}" fill="none"/>`;
const badge = (x, y, n) => `<circle cx="${x}" cy="${y}" r="4.2"/>` + txt(x, y + 2.1, n, 6, 'fill="#fff" font-weight="700"');
const TARGETS = [[105, 148.5], [68, 87], [142, 210]]; // the first one counts, the others reveal skew
// numbered lines parallel to each edge, the numbers always inside the printable area
function edgeLines() {
  const dist = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  let d = '', t = '';
  dist.forEach((v, i) => {
    const x = 105 + (i - 10) * 6, y = 148.5 + (i - 10) * 8;
    d += `M${x - 2.6} ${v}h5.2M${x - 2.6} ${297 - v}h5.2M${v} ${y - 3.6}v7.2M${210 - v} ${y - 3.6}v7.2`;
    t += txt(x, 19, v, 2.5) + txt(x, 279.8, v, 2.5) + txt(18.5, y + 0.9, v, 2.5) + txt(191.5, y + 0.9, v, 2.5);
  });
  return stroke(d, 0.2) + t;
}
function scales(x, y) {
  let d = `M${x - 12} ${y - 15}h24M${x - 15} ${y - 12}v24`, t = '';
  for (let k = -24; k <= 24; k++) {
    const l = k % 10 ? k % 2 ? 1.2 : 2.4 : 3.6;
    d += `M${x + k / 2} ${y - 15}v${-l}M${x - 15} ${y + k / 2}h${-l}`;
  }
  [['−10', -10], ['−5', -5], ['0', 0], ['+5', 5], ['+10', 10]].forEach(([s, v]) => t += txt(x + v, y - 19.2, s, 2.2) + txt(x - 20.8, y + v + 0.8, s, 2.2));
  return stroke(d, 0.1) + t;
}
const cross = (x, y) => stroke(`M${x - 31} ${y}h62M${x} ${y - 31}v62`, 0.12, '#d00');
const testTitle = (side, corrected) => txt(105, 34, `Quire test sheet · ${side} ↑`, 5, 'font-weight="700"')
  + (corrected ? '<rect x="55" y="37" width="100" height="8.5" rx="1.5"/>' + txt(105, 43, 'WITH CORRECTION · only for checking', 5, 'fill="#fff" font-weight="700"') : '');
function testFront(corrected) {
  const x = 25, y = 68.5, n = CAL_LEN;
  return edgeLines() + testTitle('FRONT', corrected)
    + stroke(`M${x} 58h${n}M${x} 54v8M${x + n} 54v8M30 ${y}v${n}M26 ${y}h8M26 ${y + n}h8`, 0.2)
    + badge(62, 51.5, 1) + txt(109, 52.8, `Width: measure this line. It should be ${n} mm.`)
    + badge(37, 190, 1) + txt(38.3, 143, `Height: measure this line. It should be ${n} mm.`, 3.6, 'transform="rotate(-90 38.3 143)"')
    + TARGETS.map(([x, y]) => scales(x, y)).join('') + txt(68, 92, 'skew check', 2.6) + txt(142, 215, 'skew check', 2.6)
    + badge(105, 168, 3) + txt(105, 178, 'Hold against the light. Read where the red back') + txt(105, 182.5, 'lines cross the two scales (1 tick = 0.5 mm).')
    + badge(105, 247, 2) + txt(105, 257, 'Edges: on all four sides and both pages, find the smallest number whose line is printed.') + txt(105, 261.5, 'Remember the largest of these eight numbers.');
}
function testBack(corrected) {
  return edgeLines() + testTitle('BACK', corrected)
    + TARGETS.map(([x, y]) => cross(210 - x, y)).join('')
    + txt(105, 257, 'If this arrow points the other way than on the front, print again and flip on the long edge.');
}
const sheetSVG = (w, h, box, html) => `<svg width="${w}" height="${h}" viewBox="${box}" font-family="Helvetica,Arial,sans-serif">${html}</svg>`;

/* ---------- Dialog ---------- */
function renderCal() {
  const c = correction(true), sign = v => v < 0 ? '−' : '+';
  const mm = v => `${v ? sign(v) : ''}${Math.abs(v)} mm`, pct = s => `${sign(s - 1)}${Math.abs((s - 1) * 100).toFixed(1)} %`;
  $('calInfo').innerHTML = (isCorrected(c)
    ? `<b>Corrected for your printer:</b> width ${pct(c.sx)}, height ${pct(c.sy)}, front to back offset ${mm(CAL.backX)} across, ${mm(CAL.backY)} down. A PDF saved now includes this, so it only fits this printer.`
    : 'No size or front to back correction for your printer.') + ` Print margin: ${CAL.margin} mm.`;
  $('calWarn').hidden = !badLen(CAL.calW) && !badLen(CAL.calH);
}
Object.keys(CAL).forEach(k => {
  $(k).value = CAL[k];
  $(k).addEventListener('input', e => { const v = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(v)) { CAL[k] = v; saveCal(); renderAll(); } });
});
function printTest(corrected) {
  const page = (html, side) => sheetHTML(210, 297, sheetSVG('210mm', '297mm', '0 0 210 297', html), corrected ? corrCSS(correction(true), side) : 'none');
  printHTML(page(testFront(corrected), 1) + page(testBack(corrected), -1));
}
$('printTest').onclick = () => printTest(false);
$('printCheck').onclick = () => printTest(true);
$('calOpen').onclick = () => $('cal').showModal();
// the illustrations are crops of the sheet itself
const ART = [
  ['16 42 178 24', testFront()],
  ['40 -1 70 24', testFront() + '<rect x="0" y="-1" width="210" height="4.2" fill="#e7dccb"/>'],
  ['78 122 41 41', testFront() + cross(106.5, 147.5)]
];
ART.forEach(([box, html], i) => $('art' + (i + 1)).innerHTML = sheetSVG('100%', '100%', box, html));
