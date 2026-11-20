// Багшийн бичсэн бодлогын текст → аюулгүй HTML (сервер ба хөтөч хоёуланд ижил): $…$ — мөр доторх томьёо, $$…$$ — тусдаа
// мөрөнд, KaTeX 0.16.9 (components/StudentPortal.js-ийн KATEX_CSS-тэй ижил хувилбар), output 'html' — MathML-гүй (онлайн
// шалгалтын цэвэрлэгч lib/paperClient.js MathML тагийг зөвшөөрдөггүй). **тод**, мөр шилжилт; бусад нь escape. \$ — жирийн $.
// 2-р хэсгийн нүд (ЭЕШ-ийн a, bc …): [[a]], [[bc]], бутархай [[a/bc]] — текстэд ч, томьёонд ч; lib/paperClient.js .bx-ээс үсгийг уншина.
// trust — зөвхөн \htmlClass{bx} (нүд), \href/\url хаалттай; maxSize/maxExpand — хэт том/давталттай томьёогоор ачааллахгүй;
// macros-ыг дуудлага бүрт шинээр — \gdef нэг багшийн томьёоноос нөгөөд үлдэхгүй.
import katex from 'katex';

const OPTS = { throwOnError: false, output: 'html', strict: 'ignore', maxSize: 30, maxExpand: 300,
  trust: c => c.command === '\\htmlClass' && c.class === 'bx' };
const BOX = /\[\[([a-h]{1,8})(?:\/([a-h]{1,8}))?\]\]/g;
export const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const texBox = l => '\\htmlClass{bx}{\\boxed{' + l + '}}';
const boxTex = s => s.replace(BOX, (_, a, b) => b ? '\\frac{' + texBox(a) + '}{' + texBox(b) + '}' : texBox(a));
function tex(src, display, strict) {
  const o = { ...OPTS, macros: {}, displayMode: display, throwOnError: !!strict };
  return katex.renderToString(boxTex(src), o);
}
const htmlBox = l => '<span class="bx">' + l + '</span>';
function plain(t) {
  return esc(t).replace(BOX, (_, a, b) => b ? '<span class="bf"><span class="n">' + htmlBox(a) + '</span><span class="d">' + htmlBox(b) + '</span></span>' : htmlBox(a))
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

// Текстийг [{ t:'text'|'math', s, display }] хэсгүүдэд хуваана. Хаагдаагүй $ — жирийн тэмдэгт.
export function splitMath(src) {
  src = String(src == null ? '' : src);
  const out = [];
  let buf = '', i = 0;
  const flush = () => { if (buf) { out.push({ t: 'text', s: buf }); buf = ''; } };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && src[i + 1] === '$') { buf += '$'; i += 2; continue; }
    if (ch === '$') {
      const disp = src[i + 1] === '$', w = disp ? 2 : 1;
      let j = i + w, close = -1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (disp ? src.startsWith('$$', j) : (src[j] === '$' && src[j + 1] !== '$')) { close = j; break; }
        if (!disp && src[j] === '$') break;            // «$…$$» — буруу хаалт
        j++;
      }
      const body = close > 0 ? src.slice(i + w, close) : '';
      if (close > 0 && body.trim()) { flush(); out.push({ t: 'math', s: body, display: disp }); i = close + w; continue; }
    }
    buf += ch; i++;
  }
  flush();
  return out;
}

export function mathHtml(src) {
  return splitMath(src).map(p => {
    if (p.t !== 'math') return plain(p.s);
    let h;
    try { h = tex(p.s, p.display); } catch (e) { h = '<span class="mt-err">' + esc(p.s) + '</span>'; }
    return p.display ? '<div class="mt-d">' + h + '</div>' : h;
  }).join('');
}

// LaTeX-ийн алдаанууд (засварлагчид анхааруулна): [{ tex, msg }]
export function mathErrors(src) {
  const out = [];
  for (const p of splitMath(src)) {
    if (p.t !== 'math') continue;
    try { tex(p.s, p.display, true); }
    catch (e) { out.push({ tex: p.s, msg: String(e && e.message || e).replace(/^KaTeX parse error:\s*/, '').slice(0, 200) }); }
  }
  return out;
}

// 2-р хэсгийн нүдний үсгүүд гарсан дарааллаар (давхардсан ч) — [[a]] [[bc]] [[d/ef]] → a b c d e f
export function boxLetters(src) {
  const out = [];
  String(src == null ? '' : src).replace(BOX, (_, a, b) => { out.push(...a, ...(b || '')); return ''; });
  return out;
}
// Курсор томьёон ($…$) дотор байгаа эсэх (засварлагчийн тэмдэгтийн самбар — $-ыг давхар нэмэхгүй)
export function insideMath(src, pos) {
  const head = String(src == null ? '' : src).slice(0, pos);
  let n = 0;
  for (let i = 0; i < head.length; i++) {
    if (head[i] === '\\') { i++; continue; }
    if (head[i] === '$') { if (head[i + 1] === '$') i++; n++; }
  }
  return n % 2 === 1;
}
