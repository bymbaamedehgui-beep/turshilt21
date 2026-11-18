// Онлайн шалгалтын бодлогын HTML-ийг (Дасгалын төвийн ЭЕШ хуудас, KaTeX) хөтөч дээр задлана (components/StudentPortal.js):
// DOMParser-ийн баримт — скрипт ажиллахгүй, зураг ачаалахгүй → бүтцээр нь бодлогуудыг олно → бодлого бүрийн зангилааг
// цэвэрлэнэ (зөвхөн зөвшөөрсөн таг/атрибут) → хуудсанд хуулбарыг нь шууд залгана (HTML мөр болгож дахин задлахгүй).
// Хуудасны бүтэц: 1-р хэсэг div.eYY-q[data-n] (.qh > .qm бодлого, .fig зураг, .eYY-opts > .eYY-o > .eYY-ov сонголт),
// 2-р хэсэг div.q[data-k] (.qm: .stmt, .fig, .sp > .sn + .st доторх .bx нүднүүд a, bc, …), томьёо div.eYY-fbox.
const TAGS = new Set(['span', 'div', 'b', 'i', 'em', 'strong', 'u', 's', 'sub', 'sup', 'br', 'p', 'small', 'table', 'thead', 'tbody',
  'tr', 'td', 'th', 'ul', 'ol', 'li', 'img', 'svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'text',
  'tspan', 'defs', 'marker', 'clippath']);
const ATTRS = new Set(['class', 'style', 'aria-hidden', 'role', 'aria-label', 'colspan', 'rowspan', 'viewbox', 'width', 'height',
  'preserveaspectratio', 'xmlns', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'fill', 'stroke',
  'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity', 'opacity', 'transform',
  'text-anchor', 'dominant-baseline', 'font-size', 'font-family', 'font-weight', 'font-style', 'refx', 'refy', 'markerwidth',
  'markerheight', 'orient', 'markerunits', 'id', 'marker-end', 'marker-start', 'marker-mid', 'clip-path', 'fill-rule', 'clip-rule',
  'vector-effect', 'letter-spacing', 'paint-order', 'dx', 'dy']);
const BAD_STYLE = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding|position\s*:\s*(fixed|sticky)/i;
const LOCAL_URL = /^url\(\s*#([\w-]{1,40})\s*\)$/;
const KATEX = /(^|\s)katex(-display)?(\s|$)/;

// el-ийг газар дээр нь цэвэрлэнэ (false → устгах). KaTeX-ийн доторх класс хэвээр (KaTeX CSS), бусад нь «pp-» угтвартай —
// бодлогын .sp, .grid, .q зэрэг апп-ын CSS-тэй давхцахгүй. id нь мөн «pp-», url(#id) лавлагааг дагуулж засна, өөр url(…) хориотой.
function cleanEl(el, inKatex) {
  const tag = el.localName.toLowerCase();
  if (!TAGS.has(tag)) return false;
  const kat = inKatex || KATEX.test(el.getAttribute('class') || '');
  for (const a of [...el.attributes]) {
    const n = a.name.toLowerCase(), v = a.value;
    let ok = ATTRS.has(n) || (tag === 'img' && n === 'src' && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v));
    if (ok && n === 'style' && BAD_STYLE.test(v)) ok = false;
    if (ok && n !== 'style' && /url\s*\(/i.test(v)) {
      const m = LOCAL_URL.exec(v.trim());
      if (m) el.setAttribute(a.name, `url(#pp-${m[1]})`); else ok = false;
    }
    if (ok && n === 'id') { if (/^[\w-]{1,40}$/.test(v)) el.setAttribute(a.name, 'pp-' + v); else ok = false; }
    if (ok && n === 'class' && !kat) el.setAttribute(a.name, v.split(/\s+/).filter(Boolean).map(c => 'pp-' + c).join(' '));
    if (!ok) el.removeAttribute(a.name);
  }
  for (const c of [...el.children]) if (!cleanEl(c, kat)) c.remove();
  return true;
}
export function cleanNode(node) { return node && cleanEl(node, false) ? node : null; }

const hasCls = (el, re) => (el.getAttribute('class') || '').split(/\s+/).some(c => re.test(c));
// docs: [{ part, html }] (/api/student/paper) → { p1: { [n]: { q, fig, opts:[5], pts } }, p2: { [k]: { q, letters } }, fbox, count }
// (2-р хэсгийн k нь 0-ээс: data-k=0 → «2.1»). Зангилаанууд цэвэрлэгдсэн, өөр баримтынх — хуудсанд importNode-оор залгана.
export function parsePaper(docs) {
  const p1 = {}, p2 = {};
  let fbox = null;
  for (const d of docs || []) {
    const doc = new DOMParser().parseFromString('<!doctype html><html><body></body></html>', 'text/html');
    doc.body.innerHTML = String(d.html || '');   // inert баримт — скрипт ажиллахгүй, юу ч ачаалахгүй
    // бүтцийг (data-n, data-k, анхны класс) цэвэрлэхээс ӨМНӨ уншина; гаднах div түрүүлж ирэх тул дотоод нь дахин тоологдохгүй
    for (const el of [...doc.body.getElementsByTagName('div')]) {
      if (el.hasAttribute('data-n') && hasCls(el, /^e\d\d-q$/)) {
        const n = parseInt(el.getAttribute('data-n'), 10);
        if (!(n > 0) || p1[n]) continue;
        const opts = [...el.getElementsByTagName('div')].filter(x => hasCls(x, /^e\d\d-o$/))
          .map(o => [...o.children].find(c => hasCls(c, /^e\d\d-ov$/)) || o);
        const ptsEl = [...el.getElementsByTagName('span')].find(x => hasCls(x, /^e\d\d-pts$/));
        const pts = ptsEl && (ptsEl.textContent.match(/\d+(?:[.,]\d+)?/) || [])[0];
        p1[n] = { q: cleanNode(el.querySelector('.qm')), fig: cleanNode(el.querySelector('.fig')), opts: opts.map(cleanNode),
          pts: pts ? Number(pts.replace(',', '.')) : null };
      } else if (el.hasAttribute('data-k') && hasCls(el, /^q$/)) {
        const k = parseInt(el.getAttribute('data-k'), 10), q = el.querySelector('.qm');
        if (!(k >= 0) || !q || p2[k]) continue;
        const letters = [...q.querySelectorAll('.bx')].flatMap(b => [...b.textContent.trim()]);
        p2[k] = { q: cleanNode(q), letters };
      } else if (!fbox && hasCls(el, /^e\d\d-fbox$/)) fbox = cleanNode(el);
    }
  }
  return { p1, p2, fbox, count: Object.keys(p1).length + Object.keys(p2).length };
}
