import zlib from 'zlib';
import { initDb, getExamByQrToken, getExamPaperRows } from '../../lib/db';
import { examVariants } from '../../lib/eyesh';
import { driveFileId, driveResourceKey } from '../../lib/drive';
import { paperSheets } from '../../lib/paper';
import { renderMaterial, CSP as SHEET_CSP } from './cm/material';

// Сурагч шалгалтын QR-ыг уншуулахад нээгдэнэ (/q/<token> → энд, next.config.js) — нэвтрэлтгүй. Хувилбартай бол эхлээд
// хувилбараа сонгоно (?v=B). Багшийн PDF (Google Drive-д байвал хуудсан дотор) эсвэл Дасгалын төвийн бодлого — ХАРИУГҮЙ
// (lib/paper.js; түлхүүрийг огт илгээхгүй). Багш хаасан бол бодлого харагдахгүй. Багшийн тохиргоо: pages/api/exam-qr.js.
export const config = { api: { responseLimit: false } };

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-src https://drive.google.com; "
  + "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const CSS = 'html,body{margin:0;background:#f4f2fb;color:#1c1f2a;font:600 16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}'
  + '.q-top{padding:14px 18px;background:#fff;border-bottom:1px solid #e6e1f5}.q-top b{display:block;font-size:18px;font-weight:900}'
  + '.q-top span{display:block;margin-top:2px;color:#6b6880;font-size:14px}.q-body{padding:18px}.q-body p{margin:0 0 14px}'
  + '.q-v{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:12px}'
  + '.q-v a{display:block;padding:24px 0;border-radius:16px;background:#7B52EE;color:#fff;text-align:center;font-size:26px;font-weight:900;text-decoration:none}'
  + '.q-bar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 18px}.q-link{color:#5b3fd4;font-weight:800}'
  + '.q-btn{display:inline-block;padding:11px 18px;border-radius:12px;background:#7B52EE;color:#fff;font-weight:800;text-decoration:none}'
  + '.q-pdf{display:block;width:100%;height:calc(100vh - 130px);min-height:420px;border:0;background:#fff}'
  + '.q-msg{margin:28px 18px;padding:22px;border-radius:16px;background:#fff;text-align:center}';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const msg = html => '<div class="q-msg">' + html + '</div>';

function page(title, sub, body) {
  return '<!doctype html><html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body>'
    + '<div class="q-top"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' + body + '</body></html>';
}
function send(req, res, status, html, csp = CSP) {
  const buf = Buffer.from(html, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Cache-Control', 'no-store');   // багш хаахад шууд үйлчилнэ
  res.setHeader('Vary', 'Accept-Encoding');
  // KaTeX-тэй бодлогын хуудас том (хувилбар бүр ~400KB) — шахаж өгнө
  if (buf.length > 20000 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
    res.setHeader('Content-Encoding', 'gzip');
    return res.status(status).end(zlib.gzipSync(buf));
  }
  return res.status(status).end(buf);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const t = String(req.query.t || '');
  if (!/^[A-Za-z0-9_-]{22}$/.test(t)) return send(req, res, 404, page('QR олдсонгүй', '', msg('Холбоос буруу байна. QR-аа дахин уншуулна уу.')));
  await initDb();
  const q = await getExamByQrToken(t);
  if (!q) return send(req, res, 404, page('QR олдсонгүй', '', msg('Энэ QR-ын шалгалт олдсонгүй. Багшаасаа асууна уу.')));
  const { exam } = q, vers = examVariants(exam), sub = exam.subject || '';
  if (!q.open) return send(req, res, 200, page(exam.title, sub, msg('Бодлого одоогоор <b>хаалттай</b> байна. Багшаасаа асууна уу.')));

  const L = vers.length > 1 ? String(req.query.v || '').trim().toUpperCase() : 'A';
  if (!vers.includes(L)) {
    return send(req, res, 200, page(exam.title, sub, '<div class="q-body"><p>Хувилбараа сонгоно уу. Хариултын хуудсандаа ч мөн энэ хувилбарыг будна.</p>'
      + '<div class="q-v">' + vers.map(x => '<a href="?v=' + x + '">' + x + '</a>').join('') + '</div></div>'));
  }
  const title = exam.title + (vers.length > 1 ? ' · ' + L + ' хувилбар' : '');
  const change = vers.length > 1 ? '<a class="q-link" href="?">Хувилбар солих</a>' : '';
  const pdf = q.pdfs[L];
  if (pdf) {
    const id = driveFileId(pdf), rk = driveResourceKey(pdf);
    return send(req, res, 200, page(title, sub, '<div class="q-bar"><a class="q-btn" href="' + esc(pdf) + '" target="_blank" rel="noopener noreferrer">PDF-ийг нээх</a>'
      + change + '</div>' + (id
        ? '<iframe class="q-pdf" src="https://drive.google.com/file/d/' + id + '/preview' + (rk ? '?resourcekey=' + rk : '') + '" allow="fullscreen" title="' + esc(title) + '"></iframe>'
        : msg('Дээрх товчоор бодлогоо нээнэ үү.'))));
  }
  const doc = paperSheets(await getExamPaperRows(exam.id, exam.teacherId), L);
  if (!doc.sheets.length) return send(req, res, 200, page(title, sub, msg('Энэ хувилбарын бодлого оруулаагүй байна. Багшаасаа асууна уу.' + (change ? '<br><br>' + change : ''))));
  // A4 хуудсыг утасны дэлгэцэнд өргөнөөр нь багтаана (width=840), томруулж уншина
  return send(req, res, 200, renderMaterial({ title, css: doc.css, sheets: doc.sheets }, { print: false, viewport: 'width=840', note: 'бодлого (хариугүй)' }), SHEET_CSP);
}
