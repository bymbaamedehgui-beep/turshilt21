import crypto from 'crypto';
import zlib from 'zlib';
import { initDb, getExamMaterial } from '../../../lib/db';
import { cleanHtml } from '../../../lib/cmsso';

// Дасгалын төвөөс хадгалсан шалгалтын материал (хувилбаруудын хуудас, хариу) — GET ?id=…&k=… (k — мөрийн нууц түлхүүр).
// Холбоос нь «ЭЕШ материал» ба шалгалтын картад (зөвхөн багшид). Агуулга нь багшийн хөтчөөс ирсэн HTML тул:
// CSP sandbox (тусгай гарал — eyeshcheck-ийн localStorage/JWT-д хүрэхгүй), скрипт зөвхөн «Хэвлэх» товчных, гаднын нөөц зөвхөн KaTeX.
export const config = { api: { responseLimit: false } };

const KATEX_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
const PRINT_JS = "document.getElementById('mvp').addEventListener('click',function(){window.print()});";
const PRINT_HASH = "'sha256-" + crypto.createHash('sha256').update(PRINT_JS).digest('base64') + "'";
const CSP = "default-src 'none'; style-src 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; "
  + "font-src https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; img-src data:; script-src " + PRINT_HASH + "; "
  + "base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-scripts allow-modals";
const VIEW_CSS = 'html,body{background:#ece8f8}body{margin:0;padding:0}'
  + '.mv-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px 18px;background:#fff;border-bottom:1px solid #e4def7;'
  + 'font:600 14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#2a2346}'
  + '.mv-bar b{font-weight:800}.mv-bar small{color:#7a7390;font-weight:600;margin-left:6px}'
  + '.mv-bar button{margin-left:auto;border:0;border-radius:12px;padding:9px 16px;background:linear-gradient(135deg,#7B52EE,#A855F7);color:#fff;font:800 14px system-ui,sans-serif;cursor:pointer}'
  + '.mv-wrap{padding:18px 10px 40px}.mv-s{margin:0 auto 22px!important;box-shadow:0 8px 30px -18px rgba(60,30,150,.5)}'
  + '@media print{html,body{background:#fff}.mv-bar{display:none}.mv-wrap{padding:0}'
  + '.mv-s{margin:0!important;box-shadow:none!important;break-after:page;page-break-after:always}.mv-s:last-child{break-after:auto;page-break-after:auto}}';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Материалын HTML хуудас (тестэд ч)
export function renderMaterial(doc) {
  const cls = 'sheet mv-s' + (doc.cls ? ' ' + String(doc.cls).replace(/[^\w -]/g, '') : '');
  const sheets = (doc.sheets || []).map(s => '<div class="' + cls + '">' + cleanHtml(s.html) + '</div>').join('')
    + (doc.key ? '<div class="' + cls + '">' + cleanHtml(doc.key) + '</div>' : '');
  const css = String(doc.css || '').replace(/<\/style/gi, '<\\/style');
  return '<!doctype html><html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex"><title>' + esc(doc.title) + '</title>'
    + '<link rel="stylesheet" href="' + KATEX_CSS + '"><style>' + css + '</style><style>' + VIEW_CSS + '</style></head><body>'
    + '<div class="mv-bar"><b>' + esc(doc.title) + '</b><small>eyeshcheck · шалгалтын материал</small><button id="mvp" type="button">Хэвлэх</button></div>'
    + '<div class="mv-wrap">' + sheets + '</div><script>' + PRINT_JS + '</script></body></html>';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const id = String(req.query.id || ''), k = String(req.query.k || '');
  const notFound = () => res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8').end('Материал олдсонгүй.');
  if (!/^cm[a-z0-9]{8,40}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(k)) return notFound();
  try {
    await initDb();
    const m = await getExamMaterial(id);
    const a = Buffer.from(String(m && m.token || '')), b = Buffer.from(k);
    if (!m || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return notFound();
    const doc = JSON.parse(zlib.gunzipSync(Buffer.from(m.body, 'base64'), { maxOutputLength: 60 * 1024 * 1024 }).toString('utf8'));
    const html = Buffer.from(renderMaterial(doc), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('Vary', 'Accept-Encoding');
    // KaTeX-тэй хуудас том (хувилбар бүр ~1 MB) — шахаж өгнө
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
      res.setHeader('Content-Encoding', 'gzip');
      return res.status(200).end(zlib.gzipSync(html));
    }
    return res.status(200).end(html);
  } catch (e) {
    console.error('[cm/material]', e.message);
    return res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8').end('Түр алдаа гарлаа.');
  }
}
