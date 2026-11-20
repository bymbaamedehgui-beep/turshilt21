import { useState, useEffect, useRef, useMemo, memo } from 'react';
import Head from 'next/head';
import { apiFetch } from '../lib/eyesh';
import { SUBJECTS, fmtDay } from '../lib/plans';
import { mathHtml, mathErrors, boxLetters, insideMath } from '../lib/mathText';

// «Онлайн шалгалт зохиох» (☰ цэс, pages/index.js 'author'): багш бодлогоо текст + LaTeX томьёогоор ($…$) бичих эсвэл зургаас
// таниулна (pages/api/paper-ocr.js, lib/aiPaper.js — Mathpix шиг: Ctrl+V-ээр дэлгэцийн зураг, чирж оруулах, PDF-ийн хуудас бүр;
// бодлогыг бүтцээр нь, ганц томьёог курсорт, зургийн хэсгийг тайрч; LaTeX-ийг KaTeX-ээр шалгаж засна). AI зөв хариу, агуулгыг
// санал болгож, багшийн түлхүүртэй зөрвөл анхааруулна — багш баталгаажуулна. Хадгалахад хариутай шалгалт + онлайн/хэвлэх
// материал үүснэ (lib/tpaper.js). Ноорог хөтөчид автоматаар хадгалагдана. Томьёо — lib/mathText.js (сурагч, хэвлэлттэй ижил).
// Серверт ANTHROPIC_API_KEY байхгүй бол (GET /api/paper-ocr → enabled:false) AI товчнууд нуугдаж, буулгасан/чирсэн зураг бодлогод хавсаргагдана.
const KATEX_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const LET = ['A', 'B', 'C', 'D', 'E'];
const MAX1 = 60, MAX2 = 4, PDF_PAGES = 15, SOLVE_BATCH = 3;   // AI хариу 3-аар — серверийн 60 секундэд багтана
const OCR_EDGE = 2576, OCR_AREA = 3700000;   // Opus 5.5-ын өндөр нягтрал — координат 1:1
let seq = 0;
const nk = () => 'k' + (++seq) + Math.random().toString(36).slice(2, 6);
const blank1 = () => ({ k: nk(), q: '', img: null, o: ['', '', '', '', ''], a: '', s: 1, t: '' });
const blank2 = () => ({ k: nk(), q: '', img: null, ans: {}, s: 1 });
const empty1 = x => !x.q.trim() && !x.img && !x.o.some(v => v.trim());
const empty2 = x => !x.q.trim() && !x.img;
const uniq = a => [...new Set(a)];
const DRAFT = id => 'eyesh_pe_draft_' + (id || 'new');
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
// Серверийн хугацаа хэтэрсэн (504 — JSON-гүй хариу) эсвэл сүлжээ тасарсан
const errText = e => (/^(Network error|API error|Failed to fetch)$/.test(e?.message || '') ? 'Хариу ирсэнгүй (хэт удаан эсвэл сүлжээ тасарсан) — зургийг цөөн бодлоготой хэсгээр тайрч дахин оролдоно уу.' : e?.message || 'Алдаа гарлаа');

function Ico({ d, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
      {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
const I = {
  back: 'M15 18l-6-6 6-6', plus: ['M12 5v14', 'M5 12h14'], up: 'M18 15l-6-6-6 6', down: 'M6 9l6 6 6-6',
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'], cam: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  img: ['M3 5h18v14H3z', 'M3 16l5-5 4 4 3-3 6 6', 'M15.5 9.5h.01'], print: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'], ok: 'M20 6 9 17l-5-5', globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
  spark: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z'],
  doc: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5'],
};

// ── Зураг ────────────────────────────────────────────────────────────────
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Зургийг нээж чадсангүй (JPEG, PNG зураг оруулна уу)')); };
    im.src = url;
  });
}
// Цагаан дэвсгэртэй, урт тал ≤ edge, талбай ≤ area болгож багасгана (томруулахгүй)
function fitCanvas(src, edge, area, sx = 0, sy = 0, sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height) {
  const s = Math.min(1, edge / Math.max(sw, sh), Math.sqrt(area / (sw * sh)));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * s)); c.height = Math.max(1, Math.round(sh * s));
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
function jpeg(c) {
  let d = c.toDataURL('image/jpeg', 0.86);
  if (d.length > 650000) d = c.toDataURL('image/jpeg', 0.7);
  return d.length > 690000 ? null : d;
}
async function figureFrom(src) {
  const d = jpeg(fitCanvas(src instanceof HTMLCanvasElement ? src : await loadImage(src), 1200, 1400000));
  if (!d) throw new Error('Зураг хэт том байна');
  return d;
}
// Танигдсан бодлогын зургийн хэсгийг (сервер өгсөн хүрээ) тайрч авна
function cropBox(c, b) {
  const pad = Math.round(Math.max(c.width, c.height) * 0.012);
  const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(c.width, b.x1 + pad), y1 = Math.min(c.height, b.y1 + pad);
  if (x1 - x0 < 12 || y1 - y0 < 12) return null;
  return jpeg(fitCanvas(c, 1000, 1000000, x0, y0, x1 - x0, y1 - y0));
}
// Танихад илгээх зураг (хүсэлт 4MB-аас бага)
function ocrJpeg(c) {
  for (const q of [0.9, 0.8, 0.7]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 3500000) return { c, d }; }
  const s = fitCanvas(c, Math.round(Math.max(c.width, c.height) * 0.7), OCR_AREA);
  return { c: s, d: s.toDataURL('image/jpeg', 0.8) };
}
// PDF (pdf.js, зөвхөн хэрэгтэй үед ачаална) → хуудас бүрийг canvas болгоно
let pdfjsP = null;
function loadPdfJs() {
  if (typeof window !== 'undefined' && window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsP) pdfjsP = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => { const L = window.pdfjsLib; if (!L) return reject(new Error('PDF уншигч ачаалсангүй')); L.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; resolve(L); };
    s.onerror = () => { pdfjsP = null; reject(new Error('PDF уншигчийг ачаалж чадсангүй — сүлжээгээ шалгана уу')); };
    document.head.appendChild(s);
  });
  return pdfjsP;
}
async function openPdf(file) {
  const L = await loadPdfJs();
  let doc;
  try { doc = await L.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch (e) { throw new Error('PDF файлыг нээж чадсангүй (нууц үгтэй эсвэл гэмтсэн байж болно)'); }
  return {
    n: Math.min(doc.numPages, PDF_PAGES), total: doc.numPages,
    page: async i => {
      const p = await doc.getPage(i), v1 = p.getViewport({ scale: 1 });
      const v = p.getViewport({ scale: Math.min(OCR_EDGE / Math.max(v1.width, v1.height), Math.sqrt(OCR_AREA / (v1.width * v1.height))) });
      const c = document.createElement('canvas');
      c.width = Math.floor(v.width); c.height = Math.floor(v.height);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: g, viewport: v }).promise;
      return c;
    },
  };
}

// ── Томьёоны самбар ──────────────────────────────────────────────────────
// [харагдах LaTeX, оруулах LaTeX] — «#» нь курсорын байрлал (сонгосон текст тэнд орно); томьёоноос гадна бол $…$-д ороож оруулна
const SNIPS = [
  ['\\frac{a}{b}', '\\frac{#}{}'], ['x^{n}', '^{#}'], ['x_{n}', '_{#}'], ['\\sqrt{x}', '\\sqrt{#}'], ['\\sqrt[n]{x}', '\\sqrt[#]{}'],
  ['\\cdot', '\\cdot '], ['\\times', '\\times '], ['\\div', '\\div '], ['\\pm', '\\pm '], ['\\le', '\\le '], ['\\ge', '\\ge '],
  ['\\ne', '\\ne '], ['\\approx', '\\approx '], ['\\infty', '\\infty '], ['\\pi', '\\pi '], ['\\alpha', '\\alpha '], ['\\beta', '\\beta '],
  ['\\Delta', '\\Delta '], ['\\varphi', '\\varphi '], ['x^\\circ', '^\\circ '], ['\\angle', '\\angle '], ['\\triangle', '\\triangle '],
  ['\\parallel', '\\parallel '], ['\\perp', '\\perp '], ['\\overrightarrow{AB}', '\\overrightarrow{#}'], ['\\overline{AB}', '\\overline{#}'],
  ['|x|', '|#|'], ['\\log_a', '\\log_{#}'], ['\\lg', '\\lg '], ['\\ln', '\\ln '], ['\\sin', '\\sin '], ['\\cos', '\\cos '],
  ['\\tg', '\\tg '], ['\\ctg', '\\ctg '], ['\\lim', '\\lim_{x\\to #}'], ['\\int', '\\int_{#}^{}'], ['\\sum', '\\sum_{#}^{}'],
  ['\\begin{cases}\\cdot\\\\\\cdot\\end{cases}', '\\begin{cases}#\\\\ \\end{cases}'], ['\\in', '\\in '], ['\\cup', '\\cup '], ['\\cap', '\\cap '],
  ['\\varnothing', '\\varnothing '], ['\\mathbb{R}', '\\mathbb{R}'], ['\\Rightarrow', '\\Rightarrow '], ['\\Leftrightarrow', '\\Leftrightarrow '],
];
const alive = f => !!(f && f.el && document.body.contains(f.el));
function insertAt(f, mode, tex) {
  if (!alive(f)) return false;
  const el = f.el, v = el.value, a = el.selectionStart == null ? v.length : el.selectionStart, b = el.selectionEnd == null ? a : el.selectionEnd, sel = v.slice(a, b);
  let ins, caret;
  if (mode === 'box') {
    const used = new Set(boxLetters(v)), l = 'abcdefgh'.split('').find(x => !used.has(x)) || 'a';
    ins = '[[' + l + ']]'; caret = ins.length;
  } else if (mode === 'bold') { ins = '**' + (sel || '') + '**'; caret = sel ? ins.length : 2; }
  else if (mode === 'math') { ins = '$' + sel + '$'; caret = sel ? ins.length : 1; }
  else if (mode === 'raw') {   // танигдсан хэсэг (өөрөө $…$-тэй): томьёон дотор бол гадна $-ыг авна
    ins = tex; const m = /^\$([^$]+)\$$/.exec(ins.trim());
    if (m && insideMath(v, a)) ins = m[1]; else if (/^\$/.test(ins.trim())) mode = 'math';
    caret = ins.length;
  } else {
    const i = tex.indexOf('#');
    ins = i >= 0 ? tex.slice(0, i) + sel + tex.slice(i + 1) : tex + sel;
    caret = i >= 0 ? i + sel.length : ins.length;
    if (!insideMath(v, a)) { ins = '$' + ins + '$'; caret += 1; mode = 'math'; }
  }
  // шинэ $…$ хөрш томьёотой «$$» болж наалдахгүй
  if (mode === 'math') {
    if (v[a - 1] === '$') { ins = ' ' + ins; caret += 1; }
    if (v[b] === '$') ins += ' ';
  }
  f.set(v.slice(0, a) + ins + v.slice(b));
  requestAnimationFrame(() => { try { el.focus(); el.setSelectionRange(a + caret, a + caret); } catch (e) {} });
  return true;
}
function Toolbar({ fieldRef }) {
  const labels = useMemo(() => SNIPS.map(([v]) => mathHtml('$' + v + '$')), []);
  const keep = e => e.preventDefault();   // талбарын курсорыг хадгална
  const go = (mode, tex) => { if (!insertAt(fieldRef.current, mode, tex)) alert('Эхлээд бодлого эсвэл сонголтын талбар дээр дарна уу.'); };
  return (
    <div className="pe-tb" role="toolbar" aria-label="Томьёо оруулах">
      <button type="button" className="txt" onMouseDown={keep} onClick={() => go('math')} title="Томьёо: $…$">$ $</button>
      {SNIPS.map(([v, t], i) => (
        <button type="button" key={v} onMouseDown={keep} onClick={() => go('tex', t)} title={t.replace('#', '…')} dangerouslySetInnerHTML={{ __html: labels[i] }} />
      ))}
      <button type="button" className="txt" onMouseDown={keep} onClick={() => go('box')} title="2-р хэсгийн хариултын нүд: [[a]]">Нүд</button>
      <button type="button" className="txt" onMouseDown={keep} onClick={() => go('bold')} title="Тод: **…**"><b>Тод</b></button>
    </div>
  );
}

// Текст + томьёоны талбар: доор нь шууд харагдац, LaTeX-ийн алдаа
const showPv = v => /[$*\n]|\[\[/.test(v || '');
const MathArea = memo(function MathArea({ value, onChange, onField, placeholder, single, rows = 2 }) {
  const ref = useRef(null);
  const html = useMemo(() => (showPv(value) ? mathHtml(value) : ''), [value]);
  const errs = useMemo(() => (/\$/.test(value || '') ? mathErrors(value) : []), [value]);
  useEffect(() => {
    const el = ref.current;
    if (el && !single) { el.style.height = 'auto'; el.style.height = Math.min(520, el.scrollHeight + 2) + 'px'; }
  }, [value, single]);
  const props = { ref, value: value || '', placeholder, spellCheck: false, onChange: e => onChange(e.target.value), onFocus: () => onField({ el: ref.current, set: onChange }) };
  return (
    <div className={'pe-ma' + (single ? ' one' : '')}>
      {single ? <input {...props} /> : <textarea rows={rows} {...props} />}
      {html && <div className="pe-pv" dangerouslySetInnerHTML={{ __html: html }} />}
      {errs.length > 0 && <div className="pe-err">Томьёоны алдаа: {errs[0].msg}</div>}
    </div>
  );
});

// AI-ийн санал (сонгох бодлого): sug — багш баталгаажуулаагүй санал, same/diff — багшийн хариутай таарсан/зөрсөн
function AiNote({ q, onOk }) {
  const ai = q.ai;
  if (!ai || !ai.a) return null;
  const st = ai.a !== q.a ? 'diff' : q.aiA ? 'sug' : 'same';
  const who = ai.src === 'marked' ? 'Зураг дээр тэмдэглэсэн хариу' : ai.src === 'both' ? 'Зураг дээрх хариу ба AI' : 'AI';
  return (
    <div className={'pe-ai ' + st}>
      <Ico d={I.spark} size={14} />
      <span>{st === 'diff' ? <>AI <b>{ai.a}</b> гэж бодсон, сонгосон хариу <b>{q.a || '—'}</b> — шалгана уу</>
        : st === 'sug' ? <>{who}: <b>{ai.a}</b> — шалгаад «Зөв» дарна уу</> : <>AI ч мөн <b>{ai.a}</b> гэж бодсон</>}
        {ai.conf === 'low' && <em> · итгэл бага</em>}{ai.check && <i> · {ai.check}</i>}</span>
      {st === 'sug' && <button type="button" onClick={onOk}>Зөв</button>}
    </div>
  );
}

const Q1 = memo(function Q1({ q, i, n, topics, warn, h }) {
  const fld = role => f => h.field({ ...f, k: q.k, part: 1, role });
  return (
    <div className={'pe-q' + (warn ? ' warn' : '')} id={'pe-' + q.k} data-k={q.k} data-part="1">
      <div className="pe-qh">
        <b className="pe-no">{i + 1}.</b>
        <label className="pe-s">Оноо<input type="number" min="0.5" max="10" step="0.5" value={q.s} onChange={e => h.upd(q.k, { s: e.target.value })} /></label>
        <select className="pe-t" value={q.t} onChange={e => h.upd(q.k, { t: e.target.value })} aria-label="Агуулга">
          <option value="">Агуулга</option>
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="pe-sp" />
        <button type="button" className="pe-ib" title="Дээш" disabled={i === 0} onClick={() => h.move(q.k, -1)}><Ico d={I.up} /></button>
        <button type="button" className="pe-ib" title="Доош" disabled={i === n - 1} onClick={() => h.move(q.k, 1)}><Ico d={I.down} /></button>
        <button type="button" className="pe-ib del" title="Устгах" onClick={() => h.del(q.k)}><Ico d={I.trash} /></button>
      </div>
      <MathArea value={q.q} onChange={v => h.upd(q.k, { q: v })} onField={fld('stem')} rows={3}
        placeholder={'Бодлогын өгүүлбэр. Томьёог $…$ дотор: $x^2-5x+6=0$, $\\frac{1}{2}$.' + (h.ai ? ' Эсвэл бодлогын зургийг энд Ctrl+V-ээр буулгана' : '')} />
      <div className="pe-qt">
        {h.ai && <button type="button" onClick={() => h.ocr(q.k, 1)} disabled={h.busy}><Ico d={I.cam} />Зургаас таних</button>}
        <button type="button" onClick={() => h.pick(q.k, 1)}><Ico d={I.img} />{q.img ? 'Зураг солих' : 'Зураг хавсаргах'}</button>
      </div>
      {q.img && <div className="pe-fig"><img src={q.img} alt="" /><button type="button" className="cm-link" onClick={() => h.upd(q.k, { img: null })}>Зургийг хасах</button></div>}
      <div className="pe-opts">
        {LET.map((L, j) => (
          <div key={L} className={'pe-opt' + (q.a === L ? ' on' : '') + (q.a === L && q.aiA ? ' ai' : '')}>
            <button type="button" className="pe-ans" aria-pressed={q.a === L} title="Зөв хариу болгох" onClick={() => h.upd(q.k, { a: L, aiA: false })}>{L}</button>
            <MathArea single value={q.o[j]} onChange={v => h.opt(q.k, j, v)} onField={fld('opt')} placeholder={L + ' сонголт'} />
          </div>
        ))}
      </div>
      <AiNote q={q} onOk={() => h.upd(q.k, { aiA: false })} />
      {!q.a && <div className="pe-need">Зөв хариуг A–E үсэг дээр дарж сонгоно уу</div>}
    </div>
  );
});

const Q2 = memo(function Q2({ q, i, h }) {
  const ls = boxLetters(q.q), dup = ls.find((l, k) => ls.indexOf(l) !== k), ai = q.ai && q.ai.cells;
  const aiStr = ai ? Object.keys(ai).map(l => l + '=' + ai[l]).join(', ') : '';
  const diff = ai ? ls.filter(l => ai[l] != null && (q.ans[l] || '') !== '' && q.ans[l] !== ai[l]) : [];
  return (
    <div className="pe-q" id={'pe-' + q.k} data-k={q.k} data-part="2">
      <div className="pe-qh">
        <b className="pe-no">2.{i + 1}.</b>
        <label className="pe-s">Нүд бүр<input type="number" min="0.5" max="10" step="0.5" value={q.s} onChange={e => h.upd2(q.k, { s: e.target.value })} />оноо</label>
        <span className="pe-sp" />
        <button type="button" className="pe-ib del" title="Устгах" onClick={() => h.del2(q.k)}><Ico d={I.trash} /></button>
      </div>
      <MathArea value={q.q} onChange={v => h.upd2(q.k, { q: v })} onField={f => h.field({ ...f, k: q.k, part: 2, role: 'stem' })} rows={3}
        placeholder="Бодлого. Хариултын нүд: [[a]], [[bc]], бутархай [[a/bc]]. Жишээ: $x_1=$ [[a]], $x_2=-$[[b]]" />
      <div className="pe-qt">
        {h.ai && <button type="button" onClick={() => h.ocr(q.k, 2)} disabled={h.busy}><Ico d={I.cam} />Зургаас таних</button>}
        <button type="button" onClick={() => h.pick(q.k, 2)}><Ico d={I.img} />{q.img ? 'Зураг солих' : 'Зураг хавсаргах'}</button>
      </div>
      {q.img && <div className="pe-fig"><img src={q.img} alt="" /><button type="button" className="cm-link" onClick={() => h.upd2(q.k, { img: null })}>Зургийг хасах</button></div>}
      {ls.length > 0 ? (
        <div className="pe-cells">
          <span>Хариу:</span>
          {ls.map((l, k) => (
            <label key={l + k} className={((q.ans[l] || '') === '' ? 'need' : '') + (diff.includes(l) ? ' diff' : '')}><i>{l}</i>
              <input value={q.ans[l] || ''} inputMode="decimal" maxLength={2} aria-label={'«' + l + '» нүдний хариу'}
                onChange={e => h.upd2(q.k, { ans: { ...q.ans, [l]: e.target.value.replace(/[^0-9.\-]/g, '').slice(-1) } })} />
            </label>
          ))}
        </div>
      ) : <div className="pe-need">Хариултын нүдийг [[a]] гэж бичнэ (самбарын «Нүд» товч)</div>}
      {dup && <div className="pe-err">«{dup}» нүд давхацсан — нүд бүр өөр үсэгтэй байна</div>}
      {ai && aiStr && (
        <div className={'pe-ai ' + (diff.length ? 'diff' : q.aiA ? 'sug' : 'same')}>
          <Ico d={I.spark} size={14} />
          <span>AI: <b>{aiStr}</b>{diff.length ? ` — ${diff.join(', ')} нүд зөрж байна, шалгана уу` : q.aiA ? ' — бөглөсөн, шалгаад «Зөв» дарна уу' : ' — таарав'}
            {q.ai.conf === 'low' && <em> · итгэл бага</em>}{q.ai.check && <i> · {q.ai.check}</i>}</span>
          {q.aiA && <button type="button" onClick={() => h.upd2(q.k, { aiA: false })}>Зөв</button>}
        </div>
      )}
    </div>
  );
});

// Хадгалах доц (сервер lib/tpaper.js normPaper дахин шалгана)
const toDoc = (p1, p2) => ({
  p1: p1.map(x => ({ q: x.q, img: x.img || null, o: x.o, a: x.a, s: Number(x.s) || 1, t: x.t })),
  p2: p2.map(x => ({ q: x.q, img: x.img || null, ans: x.ans, s: Number(x.s) || 1 })),
});
const fromDoc = d => ({
  p1: (d?.p1 || []).map(x => ({ ...blank1(), ...x, o: [0, 1, 2, 3, 4].map(j => (x.o || [])[j] || '') })),
  p2: (d?.p2 || []).map(x => ({ ...blank2(), ...x, ans: x.ans || {} })),
});

export function PaperEditor({ openId, topics, canUse, onBuy, onSaved, onOpened }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [ed, setEd] = useState(null);           // { id, title, subject, open, url, updatedAt }
  const [p1, setP1] = useState([]);
  const [p2, setP2] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);         // { text, err, buy }
  const [ocr, setOcr] = useState(null);         // { busy, text, err, alt, pdf }
  const [solve, setSolve] = useState(null);     // { busy, text, err }
  const [draft, setDraft] = useState(null);     // сэргээх боломжтой ноорог
  const [warnK, setWarnK] = useState(null);
  const [drag, setDrag] = useState(false);
  const [ai, setAi] = useState(false);          // зургаас таних, AI хариу — серверт ANTHROPIC_API_KEY байвал л
  const fieldRef = useRef(null), fileRef = useRef(null), target = useRef(null), ocrCtl = useRef(null), pdfStop = useRef(null);
  const p1Ref = useRef(p1), p2Ref = useRef(p2), edRef = useRef(ed), topsRef = useRef([]);
  p1Ref.current = p1; p2Ref.current = p2; edRef.current = ed;

  async function loadList() {
    try { setList(await apiFetch('/api/papers')); return true; } catch (e) { setErr(e.message); return false; }
  }
  // AI-ийн төлөвийг жагсаалт ачаалсны дараа (эрхгүй бол төлбөрийн цонхыг давхар өдөөхгүй)
  useEffect(() => { loadList().then(ok => { if (ok) apiFetch('/api/paper-ocr').then(r => setAi(!!r?.enabled), () => {}); }); }, []);
  useEffect(() => { if (openId) { open(openId); onOpened && onOpened(); } }, [openId]);

  // restore — ноорог байвал шууд сэргээнэ (жагсаалтын «Үргэлжлүүлэх»)
  function start(meta, doc, restore) {
    let dr = null;
    try { dr = JSON.parse(lsGet(DRAFT(meta.id)) || 'null'); } catch (e) { dr = null; }
    if (!(dr && dr.at && dr.doc && (!meta.updatedAt || dr.at > new Date(meta.updatedAt).getTime()))) dr = null;
    const use = restore && dr, d = fromDoc(use ? dr.doc : doc);
    setEd(use ? { ...meta, title: dr.title || meta.title, subject: dr.subject || meta.subject } : meta);
    setP1(d.p1.length ? d.p1 : [blank1()]); setP2(d.p2); setDirty(!!use); setMsg(null); setOcr(null); setSolve(null); setWarnK(null);
    setDraft(use ? null : dr);
    window.scrollTo(0, 0);
  }
  async function open(id) {
    setErr('');
    try {
      const p = await apiFetch('/api/papers?id=' + encodeURIComponent(id));
      start({ id: p.id, title: p.title, subject: p.subject, open: p.open, url: p.url, updatedAt: p.updatedAt }, p.doc);
    } catch (e) { setErr(e.message); }
  }
  function create(restore) { start({ id: null, title: '', subject: SUBJECTS[0], open: true, url: null, updatedAt: null }, null, restore === true); }
  function back() {
    if (dirty && !window.confirm('Хадгалаагүй өөрчлөлт байна (ноорог энэ төхөөрөмжид хадгалагдсан). Гарах уу?')) return;
    if (pdfStop.current) pdfStop.current.v = true;
    setEd(null); loadList();
  }

  // Ноорог: өөрчлөлт бүрээс 1 секундын дараа (зураг багтахгүй бол зураггүйгээр)
  useEffect(() => {
    if (!ed || !dirty) return;
    const t = setTimeout(() => {
      const base = { at: Date.now(), title: ed.title, subject: ed.subject };
      if (!lsSet(DRAFT(ed.id), JSON.stringify({ ...base, doc: toDoc(p1, p2) }))) {
        const d = toDoc(p1, p2); d.p1.forEach(x => { x.img = null; }); d.p2.forEach(x => { x.img = null; });
        lsSet(DRAFT(ed.id), JSON.stringify({ ...base, doc: d, noImg: true }));
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [ed, p1, p2, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const f = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);
  function restoreDraft() {
    const d = fromDoc(draft.doc);
    setEd(e => ({ ...e, title: draft.title || e.title, subject: draft.subject || e.subject }));
    setP1(d.p1.length ? d.p1 : [blank1()]); setP2(d.p2); setDirty(true); setDraft(null);
  }
  function dropDraft() { lsDel(DRAFT(ed.id)); setDraft(null); }

  const touch = () => setDirty(true);
  const meta = patch => { setEd(e => ({ ...e, ...patch })); touch(); };
  // Бодлогын үйлдлүүд — тогтвортой (memo-д), state-ийг функцээр шинэчилнэ
  const h = useMemo(() => ({
    field: f => { fieldRef.current = f; },
    upd: (k, patch) => { setP1(l => l.map(x => (x.k === k ? { ...x, ...patch } : x))); touch(); },
    opt: (k, j, v) => { setP1(l => l.map(x => (x.k === k ? { ...x, o: x.o.map((y, i) => (i === j ? v : y)) } : x))); touch(); },
    move: (k, d) => { setP1(l => { const i = l.findIndex(x => x.k === k), j = i + d; if (i < 0 || j < 0 || j >= l.length) return l; const n = l.slice(); [n[i], n[j]] = [n[j], n[i]]; return n; }); touch(); },
    del: k => { if (!window.confirm('Энэ бодлогыг устгах уу?')) return; setP1(l => (l.length > 1 ? l.filter(x => x.k !== k) : [blank1()])); touch(); },
    upd2: (k, patch) => { setP2(l => l.map(x => (x.k === k ? { ...x, ...patch } : x))); touch(); },
    del2: k => { if (!window.confirm('Энэ бодлогыг устгах уу?')) return; setP2(l => l.filter(x => x.k !== k)); touch(); },
    pick: (k, part) => { target.current = { k, part, mode: 'img' }; fileRef.current.accept = 'image/*'; fileRef.current.click(); },
    ocr: (k, part) => {
      const x = (part === 2 ? p2Ref.current : p1Ref.current).find(y => y.k === k);
      if (x && !(part === 2 ? empty2(x) : empty1(x)) && !window.confirm('Энэ бодлогын текстийг зурагнаас танисан зүйлээр солих уу?')) return;
      target.current = { k, part, mode: 'card' }; fileRef.current.accept = 'image/*'; fileRef.current.click();
    },
  }), []);
  const hb = useMemo(() => ({ ...h, busy: !!ocr?.busy, ai }), [h, ocr?.busy, ai]);

  async function attachImg(t, src) {
    try {
      const img = await figureFrom(src);
      if (t.k) (t.part === 2 ? setP2 : setP1)(l => l.map(x => (x.k === t.k ? { ...x, img } : x)));
      else setP1(l => [...l, { ...blank1(), img }]);
      touch();
    } catch (e) { setMsg({ text: e.message, err: true }); }
  }
  function onFile(e) {
    const file = e.target.files && e.target.files[0], t = target.current;
    e.target.value = '';
    if (!file || !t) return;
    if (t.mode === 'img') return attachImg(t, file);
    take(file, t);
  }
  // Файл (зураг/PDF) → таних; t = { mode:'card'|'paste'|'new', k, part, field }
  function take(file, t) {
    const pdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name || '');
    if (!ai) {   // AI-гүй: зургийг бодлогод хавсаргана
      if (pdf || !/^image\//.test(file.type)) { setMsg({ text: 'Бодлогын зургийг (JPEG, PNG) оруулна уу.', err: true }); return; }
      return attachImg(t.k ? t : { k: null, part: 1 }, file);
    }
    if (pdf) return runPdf(file);
    if (!/^image\//.test(file.type)) { setOcr({ text: 'Зураг (JPEG, PNG) эсвэл PDF файл оруулна уу.', err: true }); return; }
    runOcr(file, t);
  }

  // ── Таних ──
  async function scan(c) {
    const { c: cc, d } = ocrJpeg(c);
    const ac = new AbortController(); ocrCtl.current = ac;
    const r = await apiFetch('/api/paper-ocr', { method: 'POST', body: { image: d, w: cc.width, h: cc.height }, signal: ac.signal });
    return { r, c: cc };
  }
  // Танигдсаныг засварлагчид байршуулна (хамгийн сүүлийн төлвөөс) → { keys, text } — keys: шинэ/бөглөсөн картууд (AI-д)
  function place(r, c, t) {
    let n1 = p1Ref.current, n2 = p2Ref.current;
    const keys = [];
    const tgt = t.k ? (t.part === 2 ? n2 : n1).find(x => x.k === t.k) : null;
    const tgtEmpty = tgt && (t.part === 2 ? empty2(tgt) : empty1(tgt));
    const after = (list, items, k) => { const at = k ? list.findIndex(x => x.k === k) + 1 : 0; return k && at > 0 ? [...list.slice(0, at), ...items, ...list.slice(at)] : [...list, ...items]; };
    if (r.kind === 'fragment') {
      // Ганц томьёо/хэсэг: курсор байгаа талбарт, эсвэл шинэ бодлого
      if (t.field && alive(t.field) && insertAt(t.field, 'raw', r.fragment)) return { keys, text: 'Томьёог курсорын байрлалд орууллаа.' };
      const x = { ...blank1(), q: r.fragment };
      n1 = n1.length === 1 && empty1(n1[0]) ? [x] : after(n1, [x], tgt && t.part === 1 ? tgt.k : null);
      setP1(n1); p1Ref.current = n1; touch();
      return { keys: [x.k], text: 'Томьёог шинэ бодлого болгож нэмлээ.' };
    }
    const got = r.problems.map(p => ({ ...p, img: p.box ? cropBox(c, p.box) : null }));
    if (!got.length) return { keys, text: null };
    const replace = tgt && (t.mode === 'card' || tgtEmpty);
    const first = replace ? got[0] : null, rest = replace ? got.slice(1) : got;
    const pad5 = cs => [0, 1, 2, 3, 4].map(j => cs[j] || '');
    const mark = p => (p.marked ? { a: p.marked, aiA: true, ai: { a: p.marked, src: 'marked' } } : {});
    const mk1 = p => ({ ...blank1(), q: p.stem, img: p.img, o: pad5(p.choices), ...mark(p) });
    const mk2 = p => ({ ...blank2(), q: p.stem, img: p.img });
    if (first && t.part === 2) n2 = n2.map(x => (x.k === t.k ? { ...x, q: first.stem, img: first.img || x.img } : x));
    if (first && t.part === 1) n1 = n1.map(x => (x.k === t.k ? { ...x, q: first.stem, img: first.img || x.img, o: first.choices.length ? pad5(first.choices) : x.o, ...mark(first) } : x));
    if (first) keys.push(t.k);
    const fills = rest.filter(p => p.fill), room2 = Math.max(0, MAX2 - n2.length);
    const add2 = fills.slice(0, room2).map(mk2);
    n2 = [...n2, ...add2];
    const add1 = [...rest.filter(p => !p.fill), ...fills.slice(room2)].slice(0, Math.max(0, MAX1 - n1.length)).map(mk1);
    if (add1.length) n1 = !tgt && n1.length === 1 && empty1(n1[0]) ? add1 : after(n1, add1, tgt && t.part === 1 ? tgt.k : null);
    keys.push(...add1.map(x => x.k), ...add2.map(x => x.k));
    // ref-ийг шууд — дараагийн PDF хуудас, AI хариу дахин зурахыг хүлээхгүй
    setP1(n1); setP2(n2); p1Ref.current = n1; p2Ref.current = n2; touch();
    const lost = got.length - (first ? 1 : 0) - add1.length - add2.length;
    return { keys, text: `${got.length} бодлого танилаа${lost > 0 ? ` (${lost} нь багтсангүй)` : ''} — текст, томьёог шалгана уу.` };
  }
  async function runOcr(file, t) {
    if (ocr?.busy) return;
    // Буулгасан зураг томьёо биш, бодлогын зураг байж болно — «Зураг болгож хавсаргах»-аар зогсооно
    setOcr({ busy: true, text: 'Зургийг таньж байна… (10–40 секунд)', alt: t.mode === 'paste' ? { t, file } : null });
    try {
      const { r, c } = await scan(fitCanvas(await loadImage(file), OCR_EDGE, OCR_AREA));
      if (r.kind === 'figure') { await attachImg(t.k ? t : { k: null, part: 1 }, file); setOcr({ text: 'Зурагт текст алга — бодлогын зураг болгож хавсаргалаа.' }); return; }
      const res = place(r, c, t);
      if (!res.text) { setOcr({ text: 'Зурагнаас бодлого олдсонгүй. Тод, ойроос авсан зураг оруулна уу.', err: true }); return; }
      setOcr({ text: res.text + (r.fixed ? ` LaTeX ${r.fixed} газар автоматаар засагдлаа.` : '') + left(r) });
      if (res.keys.length) aiSolve(res.keys, false);
    } catch (e) {
      if (e.name === 'AbortError') return;
      setOcr({ text: errText(e), err: true });
    }
  }
  const left = r => (r.left != null && r.left < 15 ? ` Өнөөдөр ${r.left} удаа үлдлээ.` : '');
  function asFigure() {
    const a = ocr?.alt;
    if (!a) return;
    if (ocrCtl.current) ocrCtl.current.abort();
    setOcr(null);
    attachImg(a.t.k ? a.t : { k: null, part: 1 }, a.file);
  }
  async function runPdf(file) {
    if (ocr?.busy) return;
    const stop = { v: false }; pdfStop.current = stop;
    setOcr({ busy: true, pdf: true, text: 'PDF-ийг нээж байна…' });
    let added = 0, pages = 0;
    const keys = [];
    try {
      const P = await openPdf(file);
      for (let i = 1; i <= P.n && !stop.v; i++) {
        setOcr({ busy: true, pdf: true, text: `PDF: ${i}/${P.n} хуудсыг таньж байна… (${added} бодлого)` });
        const { r, c } = await scan(await P.page(i));
        pages++;
        if (r.kind !== 'problems') continue;
        const res = place(r, c, { mode: 'new' });
        added += res.keys.length; keys.push(...res.keys);
        if (p1Ref.current.length >= MAX1) break;
      }
      setOcr({ text: `PDF-ийн ${pages} хуудаснаас ${added} бодлого нэмэгдлээ${P.total > P.n ? ` (эхний ${P.n} хуудас)` : ''} — шалгана уу.` });
      if (keys.length) aiSolve(keys, false);
    } catch (e) {
      if (e.name !== 'AbortError') setOcr({ text: errText(e) + (added ? ` (${added} бодлого нэмэгдсэн)` : ''), err: true });
    }
    pdfStop.current = null;
  }

  // ── AI хариу: шинэ бодлогод автоматаар, «Хариуг AI-аар шалгах»-аар бүгдэд ──
  async function aiSolve(keys, manual) {
    const want = new Set(keys);
    const cards = [...p1Ref.current.filter(x => want.has(x.k)).map(x => ({ x, part: 1 })), ...p2Ref.current.filter(x => want.has(x.k)).map(x => ({ x, part: 2 }))]
      .filter(({ x }) => x.q.trim() || x.img);
    if (!cards.length) { if (manual) setSolve({ text: 'Шалгах бодлого алга.', err: true }); return; }
    const subject = edRef.current?.subject, topics = topsRef.current;
    let done = 0, n = 0;
    setSolve({ busy: true, text: `AI зөв хариуг бодож байна… (${cards.length} бодлого)` });
    try {
      for (let i = 0; i < cards.length; i += SOLVE_BATCH) {
        let budget = 2600000;
        const items = cards.slice(i, i + SOLVE_BATCH).map(({ x, part }) => {
          let img = null;
          if (x.img && x.img.length < budget) { img = x.img; budget -= x.img.length; }
          return { id: x.k, stem: x.q, choices: part === 1 ? x.o : [], letters: part === 2 ? uniq(boxLetters(x.q)) : [], img };
        });
        const r = await apiFetch('/api/paper-ocr', { method: 'POST', body: { mode: 'solve', subject, topics, items } });
        const byK = Object.fromEntries((r.results || []).map(x => [x.id, x]));
        setP1(l => l.map(x => {
          const s = byK[x.k];
          if (!s || !s.answer) return x;
          const both = x.ai?.src === 'marked' && x.ai.a === s.answer;
          const patch = { ai: { a: s.answer, conf: s.confidence, check: s.check, src: both ? 'both' : 'ai' } };
          if (!x.a) { patch.a = s.answer; patch.aiA = true; }
          if (!x.t && s.topic) patch.t = s.topic;
          return { ...x, ...patch };
        }));
        setP2(l => l.map(x => {
          const s = byK[x.k];
          if (!s || !Object.keys(s.cells || {}).length) return x;
          const ans = { ...x.ans }; let filled = false;
          Object.entries(s.cells).forEach(([c, v]) => { if (!ans[c]) { ans[c] = v; filled = true; } });
          return { ...x, ai: { cells: s.cells, conf: s.confidence, check: s.check }, ans, aiA: x.aiA || filled };
        }));
        touch();
        done += items.length; n += (r.results || []).length;
        setSolve({ busy: i + SOLVE_BATCH < cards.length, text: `AI ${n}/${done} бодлогын хариуг бодлоо — шалгана уу.${left(r)}` });
      }
    } catch (e) { setSolve({ text: 'AI хариу: ' + errText(e), err: true }); }
  }

  // Ctrl+V — дэлгэцийн зураг (Win+Shift+S) буулгахад шууд таньна (Mathpix Snip шиг)
  useEffect(() => {
    if (!ed) return;
    const onPaste = e => {
      const f = [...(e.clipboardData?.files || [])].find(x => /^image\//.test(x.type));
      if (!f) return;
      e.preventDefault();
      const fld = fieldRef.current && document.activeElement === fieldRef.current.el ? fieldRef.current : null;
      if (!ai) { attachImg({ k: fld ? fld.k : null, part: fld ? fld.part : 1 }, f); return; }
      runOcr(f, { mode: 'paste', k: fld ? fld.k : null, part: fld ? fld.part : 1, field: fld });
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });
  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    const card = e.target.closest && e.target.closest('.pe-q');
    take(f, card ? { mode: 'paste', k: card.dataset.k, part: Number(card.dataset.part) || 1 } : { mode: 'new' });
  }
  const onDragOver = e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); if (!drag) setDrag(true); } };

  async function save() {
    if (saving || !ed) return;
    setMsg(null);
    if (!ed.title.trim()) { setMsg({ text: 'Шалгалтын нэрээ бичнэ үү', err: true }); return; }
    const miss = p1.find(x => !x.a);
    if (miss) { setWarnK(miss.k); document.getElementById('pe-' + miss.k)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMsg({ text: `${p1.indexOf(miss) + 1}-р бодлогын зөв хариуг сонгоно уу`, err: true }); return; }
    // Томьёо алдаатай бол хадгалахгүй — сурагчид эвдэрсэн бичиглэл харагдахгүй
    const broken = [...p1.map((x, i) => ({ x, n: String(i + 1), ts: [x.q, ...x.o] })), ...p2.map((x, i) => ({ x, n: '2.' + (i + 1), ts: [x.q] }))].find(c => c.ts.some(t => /\$/.test(t) && mathErrors(t).length));
    if (broken) { setWarnK(broken.x.k); document.getElementById('pe-' + broken.x.k)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMsg({ text: `${broken.n}-р бодлогын томьёонд алдаа байна — улаанаар заасныг засна уу`, err: true }); return; }
    if (canUse && !canUse(ed.subject)) { setMsg({ text: `«${ed.subject}» хичээлийн эрх алга — эрх авсны дараа хадгална (ноорог хадгалагдсан).`, err: true, buy: true }); return; }
    const unconf = p1.filter(x => x.aiA).length + p2.filter(x => x.aiA).length;
    if (unconf && !window.confirm(`${unconf} бодлогын хариуг AI санал болгосон, та хараахан баталгаажуулаагүй байна. Шалгасан бол хадгална уу. Хадгалах уу?`)) return;
    setSaving(true); setWarnK(null);
    try {
      const r = await apiFetch('/api/papers', { method: 'POST', body: { id: ed.id, title: ed.title, subject: ed.subject, doc: toDoc(p1, p2), open: !!ed.open } });
      lsDel(DRAFT(ed.id)); if (!ed.id) lsDel(DRAFT(null));
      setEd(e => ({ ...e, id: r.id, url: r.url || e.url, open: r.open == null ? e.open : r.open, updatedAt: new Date().toISOString() }));
      setDirty(false); setDraft(null);
      setMsg({ text: ed.id ? 'Хадгалагдлаа — шалгалт шинэчлэгдлээ' : 'Хадгалагдлаа — шалгалт үүслээ. Нүүр хуудасны шалгалтуудад харагдана.' });
      onSaved && onSaved(r);
    } catch (e) { setMsg({ text: errText(e), err: true }); }
    setSaving(false);
  }
  useEffect(() => {
    if (!ed) return;
    const f = e => { if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); } };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });
  async function remove(p) {
    if (!window.confirm(`«${p.title}» онлайн шалгалтыг устгах уу? Шалгалт ба дүн нь нүүр хуудсанд хэвээр үлдэнэ, онлайн бодлого хаагдана.`)) return;
    try { await apiFetch('/api/papers?id=' + encodeURIComponent(p.id), { method: 'DELETE' }); lsDel(DRAFT(p.id)); loadList(); onSaved && onSaved(null); }
    catch (e) { alert(e.message); }
  }

  const tops = useMemo(() => (ed ? (topics ? topics(ed.subject) : []) : []), [ed?.subject, topics]);
  topsRef.current = tops.filter(t => t !== 'Бусад' && t !== 'Other');
  const newDraft = useMemo(() => { try { return JSON.parse(lsGet(DRAFT(null)) || 'null'); } catch (e) { return null; } }, [list, ed]);

  const css = <style jsx global>{`
    .pe{max-width:900px;margin:0 auto;padding:16px 16px 120px;position:relative}
    .pe.drag::after{content:'Зураг эсвэл PDF-ийг энд тавина уу';position:fixed;inset:12px;z-index:200;display:grid;place-items:center;border:3px dashed var(--purple);border-radius:24px;background:rgba(123,82,238,.10);color:var(--purple-d);font-weight:900;font-size:20px;pointer-events:none}
    .pe.drag.noai::after{content:'Зургийг бодлого дээр тавина уу'}
    .pe-lh{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:4px 2px 6px}.pe-lh h1{font-size:23px;font-weight:900;margin:0;flex:1}
    .pe-intro{color:var(--soft);font-size:14.5px;margin:0 2px 16px}
    .pe-card{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--line);background:var(--card);border-radius:16px;padding:14px 16px;margin-bottom:10px}
    .pe-card-t{flex:1 1 240px;min-width:0}.pe-card-t b{display:block;font-size:16px;font-weight:900}.pe-card-t span{color:var(--soft);font-size:13px}
    .pe-card .pe-act{display:flex;gap:6px;flex-wrap:wrap}
    .pe-pill{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;padding:2px 8px;border-radius:8px;background:#e7f8ef;color:#047857;margin-left:6px}
    .pe-btn{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:.45rem .85rem;font-weight:800;font-size:13.5px;cursor:pointer;text-decoration:none}
    .pe-btn:disabled{opacity:.55}.pe-btn.del{color:#b3261e}.pe-btn.ai{color:var(--purple-d);border-color:#d8ccfb}
    .pe-top{display:flex;align-items:center;gap:10px;margin:2px 0 12px}
    .pe-meta{display:grid;grid-template-columns:1fr 200px;gap:10px;margin-bottom:10px}
    .pe-meta input,.pe-meta select{border:1.6px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:.7rem .9rem;font-size:16px;font-weight:800;outline:none;min-width:0}
    .pe-meta input:focus,.pe-meta select:focus{border-color:var(--purple)}
    .pe-help{font-size:13.5px;color:var(--soft);margin:0 2px 10px;line-height:1.55}.pe-help code,.pe-help kbd{background:var(--chip);padding:0 5px;border-radius:5px;color:var(--ink);font-family:inherit;font-weight:800}
    .pe-note{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:14px;padding:10px 14px;font-size:14px;font-weight:700;margin-bottom:12px;border:1px solid var(--line);background:var(--card)}
    .pe-note.err{background:#fdecec;color:#b3261e;border-color:#f6c9c9}.pe-note.ok{background:#e9f8ef;color:#15803d;border-color:#b7e4c7}
    .pe-note.busy::before{content:'';width:16px;height:16px;border:2.5px solid var(--line);border-top-color:var(--purple);border-radius:50%;animation:pe-spin .8s linear infinite;flex:none}
    @keyframes pe-spin{to{transform:rotate(360deg)}}
    .pe-note span{flex:1;min-width:200px}.pe-note .pe-btn{padding:.3rem .7rem;font-size:13px}
    .pe-tb{position:sticky;top:60px;z-index:40;display:flex;gap:4px;overflow-x:auto;padding:7px;margin:0 -4px 12px;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 20px -18px rgba(17,24,39,.5);scrollbar-width:thin}
    .pe-tb button{flex:none;min-width:38px;height:36px;padding:0 7px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink);cursor:pointer;display:grid;place-items:center;font-size:13px}
    .pe-tb button:hover{border-color:var(--purple);background:var(--purple-l)}
    .pe-tb button.txt{font-weight:900;font-size:13px;padding:0 10px}
    .pe-tb .katex{font-size:1em}
    .pe-sec{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:900;color:var(--soft);text-transform:uppercase;letter-spacing:.4px;margin:18px 2px 8px}
    .pe-q{border:1.5px solid var(--line);background:var(--card);border-radius:18px;padding:12px 14px 14px;margin-bottom:12px}
    .pe-q.warn{border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.12)}
    .pe-qh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
    .pe-no{font-size:18px;font-weight:900;min-width:30px}
    .pe-s{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:var(--soft)}
    .pe-s input{width:62px;border:1.4px solid var(--line);background:var(--bg);color:var(--ink);border-radius:9px;padding:5px 7px;font-weight:800;font-size:14px}
    .pe-t{border:1.4px solid var(--line);background:var(--bg);color:var(--ink);border-radius:9px;padding:5px 8px;font-weight:700;font-size:13px;max-width:180px}
    .pe-sp{flex:1}
    .pe-ib{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--soft);cursor:pointer}
    .pe-ib:disabled{opacity:.35}.pe-ib.del:hover{color:#b3261e;border-color:#f6c9c9}
    .pe-ma textarea,.pe-ma input{width:100%;box-sizing:border-box;border:1.4px solid var(--line);background:var(--bg);color:var(--ink);border-radius:12px;padding:9px 11px;
      font:600 15px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none;resize:vertical}
    .pe-ma textarea:focus,.pe-ma input:focus{border-color:var(--purple);background:var(--card)}
    .pe-ma.one input{padding:7px 10px;font-size:14px}
    .pe-pv{margin-top:6px;padding:8px 11px;border-radius:10px;background:var(--purple-l);font:500 16px/1.65 'Times New Roman',Times,serif;color:var(--ink);overflow-x:auto}
    .pe-ma.one .pe-pv{padding:4px 9px;font-size:15px;margin-top:4px}
    .pe-pv .mt-d{text-align:center}.pe-pv .mt-err{color:#b3261e}
    .pe-pv .bx{display:inline-block;min-width:1.25em;padding:0 .2em;margin:0 .08em;border:1.4px solid currentColor;border-radius:4px;text-align:center;font-style:italic}
    .pe-pv .bf{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 .2em;line-height:1.2}
    .pe-pv .bf>.n{border-bottom:1px solid currentColor;padding:0 .15em 2px}.pe-pv .bf>.d{padding:2px .15em 0}
    .pe-err{margin-top:4px;font-size:12.5px;font-weight:800;color:#b3261e}
    .pe-need{margin-top:8px;font-size:12.5px;font-weight:800;color:#b45309}
    .pe-qt{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
    .pe-qt button{display:inline-flex;align-items:center;gap:6px;border:1.4px dashed var(--line);background:none;color:var(--purple-d);border-radius:999px;padding:.35rem .8rem;font-weight:800;font-size:13px;cursor:pointer}
    .pe-qt button:hover{border-color:var(--purple);background:var(--purple-l)}.pe-qt button:disabled{opacity:.5}
    .pe-fig{display:flex;align-items:flex-end;gap:10px;margin:4px 0 8px}
    .pe-fig img{max-width:min(100%,420px);max-height:260px;border:1px solid var(--line);border-radius:10px;background:#fff}
    .pe-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
    .pe-opt{display:flex;align-items:flex-start;gap:6px;min-width:0}.pe-opt .pe-ma{flex:1;min-width:0}
    .pe-ans{flex:none;width:34px;height:34px;border-radius:999px;border:1.6px solid var(--line);background:var(--card);color:var(--ink);font-weight:900;cursor:pointer}
    .pe-opt.on .pe-ans{background:#16a34a;border-color:#16a34a;color:#fff}
    .pe-opt.on.ai .pe-ans{background:var(--purple);border-color:var(--purple);box-shadow:0 0 0 3px rgba(123,82,238,.2)}
    .pe-opt.on .pe-ma input{border-color:#86d3a3}
    .pe-ai{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px;padding:7px 10px;border-radius:10px;font-size:13px;font-weight:700;color:var(--ink);border-left:3px solid var(--purple);background:var(--purple-l)}
    .pe-ai svg{color:var(--purple-d)}.pe-ai span{flex:1;min-width:180px}.pe-ai i{font-style:normal;color:var(--soft);font-weight:600}.pe-ai em{font-style:normal;color:#b45309}
    .pe-ai.same{border-left-color:#16a34a;background:transparent}.pe-ai.diff{border-left-color:#ef4444;background:#fff4f4;color:#7f1d1d}
    body.dark .pe-ai.diff{background:#3a1d22;color:#fecaca}
    .pe-ai button{border:0;border-radius:999px;padding:.3rem .8rem;background:var(--purple);color:#fff;font-weight:900;font-size:12.5px;cursor:pointer}
    .pe-cells{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:13px;font-weight:800;color:var(--soft)}
    .pe-cells label{display:inline-flex;align-items:center;gap:4px}.pe-cells i{font-style:italic;font-weight:900;color:var(--ink);font-family:'Times New Roman',serif;font-size:16px}
    .pe-cells input{width:40px;height:36px;text-align:center;border:1.6px solid var(--line);background:var(--bg);color:var(--ink);border-radius:9px;font-weight:900;font-size:16px}
    .pe-cells label.need input{border-color:#f59e0b}.pe-cells label.diff input{border-color:#ef4444;background:#fff4f4}
    .pe-add{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 6px}
    .pe-bar{position:sticky;bottom:0;z-index:45;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px -4px 0;padding:10px 12px;background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 -10px 24px -20px rgba(17,24,39,.5)}
    .pe-bar label{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;cursor:pointer}
    .pe-bar label input{width:18px;height:18px;accent-color:var(--purple)}
    .pe-bar .cm-btn{margin-left:auto}
    .pe-st{font-size:12.5px;font-weight:700;color:var(--soft)}
    @media (max-width:760px){
      .pe-meta{grid-template-columns:1fr}.pe-tb{top:56px}
      .pe-bar{bottom:calc(var(--tab-h) + env(safe-area-inset-bottom))}
      .pe-opts{grid-template-columns:1fr}
    }
  `}</style>;

  // ── Жагсаалт ──
  if (!ed) return (
    <div className="pe">
      {css}
      <div className="pe-lh"><h1>Онлайн шалгалт зохиох</h1><button className="cm-btn" onClick={() => create(false)}><Ico d={I.plus} />Шинэ шалгалт</button></div>
      <p className="pe-intro">{ai ? 'Бодлогоо бичих эсвэл зураг, дэлгэцийн зураг (Ctrl+V), PDF-ээс таниулна — текст, томьёо, сонголт, зургийг автоматаар бичиж, AI зөв хариуг санал болгоно.'
        : 'Бодлогоо текст, LaTeX томьёогоор бичиж, зураг хавсаргана.'} Хадгалахад шалгалт үүсч, сурагчид кодоороо нэвтэрч онлайнаар өгнө — хэвлэж, хариултын хуудсаар шалгаж ч болно.</p>
      {err && <div className="cm-alert">{err}</div>}
      {newDraft && newDraft.doc && <div className="pe-note"><span>Хадгалаагүй шинэ шалгалтын ноорог байна{newDraft.title ? ` — «${newDraft.title}»` : ''}.</span>
        <button className="pe-btn" onClick={() => create(true)}>Үргэлжлүүлэх</button></div>}
      {!list && !err && <div className="pe-intro">Ачаалж байна…</div>}
      {list && list.length === 0 && <div className="pe-intro">Одоогоор онлайн шалгалт алга. «Шинэ шалгалт» дээр дарж эхлээрэй.</div>}
      {list && list.map(p => (
        <div key={p.id} className="pe-card">
          <div className="pe-card-t">
            <b>{p.title}{p.open && <span className="pe-pill"><Ico d={I.globe} size={12} />Онлайн</span>}</b>
            <span>{p.subject} · {p.n1 + p.n2} бодлого · {fmtDay(p.updatedAt)}{!p.hasExam ? ' · шалгалт устсан (хадгалахад дахин үүснэ)' : ''}</span>
          </div>
          <div className="pe-act">
            <button className="pe-btn" onClick={() => open(p.id)}><Ico d={I.edit} />Засах</button>
            {p.url && <a className="pe-btn" href={p.url} target="_blank" rel="noopener noreferrer"><Ico d={I.print} />Хэвлэх</a>}
            <button className="pe-btn del" onClick={() => remove(p)}><Ico d={I.trash} /></button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Засварлагч ──
  return (
    <div className={'pe' + (drag ? ' drag' : '') + (ai ? '' : ' noai')} onDragOver={onDragOver} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false); }} onDrop={onDrop}>
      {css}
      <Head><link rel="stylesheet" href={KATEX_CSS} /></Head>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <div className="pe-top">
        <button className="pe-btn" onClick={back}><Ico d={I.back} />Миний шалгалтууд</button>
        <span className="pe-st">{ed.id ? 'Засах' : 'Шинэ шалгалт'}{dirty ? ' · хадгалаагүй' : ''}</span>
      </div>
      {draft && <div className="pe-note"><span>Хадгалаагүй ноорог олдлоо ({new Date(draft.at).toLocaleString('mn-MN')}){draft.noImg ? ' — зураггүй' : ''}.</span>
        <button className="pe-btn" onClick={restoreDraft}>Сэргээх</button><button className="pe-btn" onClick={dropDraft}>Хаях</button></div>}
      <div className="pe-meta">
        <input value={ed.title} onChange={e => meta({ title: e.target.value })} placeholder="Шалгалтын нэр (ж: 10-р анги · Квадрат тэгшитгэл)" maxLength={200} aria-label="Шалгалтын нэр" />
        <select value={ed.subject} onChange={e => meta({ subject: e.target.value })} aria-label="Хичээл">
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <p className="pe-help">Томьёог <code>$…$</code> дотор LaTeX-ээр бичнэ (тусдаа мөрөнд <code>$$…$$</code>) — доорх самбараас дарж оруулж болно.{' '}
        {ai ? <>Бодлогоо <kbd>Win+Shift+S</kbd>-ээр тайрч аваад <kbd>Ctrl+V</kbd> дарвал шууд таньж бичнэ (ганц томьёо бол курсорт орно); зураг, PDF-ийг чирж оруулж ч болно.
          AI-ийн хариуг заавал шалгаарай.</>
          : <>Бодлогын зургийг <kbd>Ctrl+V</kbd>-ээр буулгах эсвэл бодлого дээр чирж тавибал тэр бодлогод хавсаргагдана.</>}</p>
      <Toolbar fieldRef={fieldRef} />
      {ocr && <div className={'pe-note' + (ocr.err ? ' err' : ocr.busy ? ' busy' : ' ok')} role="status"><span>{ocr.text}</span>
        {ocr.busy && ocr.alt && <button className="pe-btn" onClick={asFigure}>Зураг болгож хавсаргах</button>}
        {ocr.busy && ocr.pdf && <button className="pe-btn" onClick={() => { if (pdfStop.current) pdfStop.current.v = true; }}>Зогсоох</button>}
        {!ocr.busy && <button className="pe-btn" onClick={() => setOcr(null)}>Хаах</button>}</div>}
      {solve && <div className={'pe-note' + (solve.err ? ' err' : solve.busy ? ' busy' : '')} role="status"><span>{solve.text}</span>
        {!solve.busy && <button className="pe-btn" onClick={() => setSolve(null)}>Хаах</button>}</div>}

      <div className="pe-sec">1-р хэсэг · {p1.length} бодлого</div>
      {p1.map((q, i) => <Q1 key={q.k} q={q} i={i} n={p1.length} topics={tops} warn={warnK === q.k} h={hb} />)}
      <div className="pe-add">
        <button className="pe-btn" disabled={p1.length >= MAX1} onClick={() => { setP1(l => [...l, blank1()]); touch(); }}><Ico d={I.plus} />Бодлого нэмэх</button>
        {ai && <button className="pe-btn" disabled={!!ocr?.busy || p1.length >= MAX1} onClick={() => { target.current = { mode: 'new' }; fileRef.current.accept = 'image/*,application/pdf'; fileRef.current.click(); }}>
          <Ico d={I.doc} />Зураг, PDF-ээс бодлогууд</button>}
        {ai && <button className="pe-btn ai" disabled={!!solve?.busy} onClick={() => aiSolve([...p1, ...p2].map(x => x.k), true)}><Ico d={I.spark} />Хариуг AI-аар шалгах</button>}
      </div>

      <div className="pe-sec">2-р хэсэг (нөхөх) · {p2.length}/{MAX2}</div>
      {p2.map((q, i) => <Q2 key={q.k} q={q} i={i} h={hb} />)}
      {p2.length < MAX2 && <div className="pe-add"><button className="pe-btn" onClick={() => { setP2(l => [...l, blank2()]); touch(); }}><Ico d={I.plus} />2-р хэсгийн бодлого</button></div>}

      <div className="pe-bar">
        <label title="Сурагчид кодоороо нэвтэрч бодлогыг харж, онлайнаар өгнө"><input type="checkbox" checked={!!ed.open} onChange={e => meta({ open: e.target.checked })} />Сурагчдад онлайнаар нээх</label>
        {ed.url && !dirty && <a className="pe-btn" href={ed.url} target="_blank" rel="noopener noreferrer"><Ico d={I.print} />Хэвлэх</a>}
        {msg && <span className="pe-st" style={{ color: msg.err ? '#b3261e' : '#15803d' }} role="status">{msg.text}</span>}
        {msg?.buy && onBuy && <button className="pe-btn" onClick={() => onBuy(ed.subject)}>Эрх авах</button>}
        <button className="cm-btn" disabled={saving} onClick={save}><Ico d={I.ok} />{saving ? 'Хадгалж байна…' : 'Хадгалах'}</button>
      </div>
    </div>
  );
}
