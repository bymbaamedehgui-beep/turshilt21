// Сурагчийн онлайн шалгалтын бодлогууд (pages/api/student/paper.js): Дасгалын төвөөс хадгалсан шалгалтын материал
// (lib/cmsso.js saveCmMaterial) — хувилбар бүрийн хуудасны HTML (KaTeX). Тэр хуудасны төгсгөлд «Хариу ба бодолт»
// (div.ans-page#answers) нуугдмал байдаг тул түүнээс хойшхыг СЕРВЕР дээр таслана; түлхүүр (doc.key)-ийг огт илгээхгүй.
import zlib from 'zlib';

// Хариу, бодолт эхлэх хамгийн эхний <div …> (ans-page, #answers, хариун хүснэгт) — түүнээс хойшхыг хаяна
const ANS_RE = /<div\b[^>]*(?:\bclass\s*=\s*["'][^"']*\b(?:ans-page|ans-grid|e\d\d-akey|e\d\d-res)\b[^"']*["']|\bid\s*=\s*["']answers["'])/i;
export function stripAnswers(html) {
  const s = String(html || ''), i = s.search(ANS_RE);
  return i >= 0 ? s.slice(0, i) : s;
}

// materials-ийн мөрүүд [{ body }] → тухайн хувилбарын (L) хуудсууд [{ part, html, css, cls }] (1-р, 2-р хэсгийн дарааллаар)
function variantSheets(rows, L) {
  const want = String(L || 'A').toUpperCase(), out = [];
  for (const r of rows || []) {
    let doc;
    try { doc = JSON.parse(zlib.gunzipSync(Buffer.from(String(r.body || ''), 'base64'), { maxOutputLength: 60 * 1024 * 1024 }).toString('utf8')); }
    catch (e) { continue; }
    const sheets = Array.isArray(doc.sheets) ? doc.sheets : [];
    const sh = sheets.find(s => String(s.L || '').toUpperCase() === want) || (sheets.length === 1 ? sheets[0] : null);
    if (sh) out.push({ part: Number(doc.part) || 0, html: stripAnswers(sh.html), css: String(doc.css || ''), cls: String(doc.cls || '') });
  }
  return out.sort((a, b) => a.part - b.part);
}
export function paperDocs(rows, L) {
  return variantSheets(rows, L).map(({ part, html }) => ({ part, html }));
}
// QR-аар харуулах хуудас (pages/api/q.js → cm/material renderMaterial): хуудас бүр өөрийн материалын class-тай, CSS нийлнэ
export function paperSheets(rows, L) {
  const v = variantSheets(rows, L);
  return { css: [...new Set(v.map(x => x.css).filter(Boolean))].join('\n'), sheets: v.map(({ html, cls }) => ({ html, cls })) };
}
