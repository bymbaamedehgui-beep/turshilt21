import { requirePaid } from '../../lib/auth';
import { initDb, getTeacherById } from '../../lib/db';
import { ensurePapers, ocrTake, ocrRefund } from '../../lib/tpaper';
import { scanImage, solveItems, AiError } from '../../lib/aiPaper';
import { SUBJECTS } from '../../lib/plans';

// «Зургаас таних» ба «AI хариу» (components/PaperEditor.js, lib/aiPaper.js — Claude Opus 5.5). Env: ANTHROPIC_API_KEY (Vercel →
// Settings → Environment Variables) — байхгүй бол 503. Өдрийн хязгаар (Улаанбаатарын цагаар, дуудлага бүр 1): багш бүр
// OCR_DAILY_LIMIT (100), нийт OCR_GLOBAL_LIMIT (1500); алдаатай/татгалзсан дуудлага тоологдохгүй.
// GET → { enabled } — түлхүүр тавьсан эсэх; үгүй бол засварлагч AI товчнуудыг нууна
// POST { image:'data:image/jpeg;base64,…', w, h } → { kind:'problems'|'fragment'|'figure', fragment, problems:[{ number, stem, choices,
//   marked, fill, box }], fixed, left }
// POST { mode:'solve', subject, topics, items:[{ id, stem, choices, letters, img? }] } → { results:[{ id, answer, cells, topic, confidence, check }], left }
// maxDuration 60 — Vercel-ийн бүх багцад зөвшөөрөгдөнө (Hobby-гийн хуучин хязгаар); клиент бодлогыг 3-аар нь илгээнэ
export const config = { api: { bodyParser: { sizeLimit: '4mb' } }, maxDuration: 60 };

const DEMO_EMAIL = 'demo@eyeshcheck.com';
const IMG_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const limitOf = (v, d) => { const n = parseInt(v, 10); return n > 0 ? n : d; };
const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);

// Бодох хүсэлтийг шалгана → { subject, topics, items } | { error }
function solveInput(b) {
  const subject = SUBJECTS.includes(b.subject) ? b.subject : null;
  if (!subject) return { error: 'Хичээл буруу' };
  const topics = (Array.isArray(b.topics) ? b.topics : []).filter(t => typeof t === 'string' && t.trim() && t.length <= 60).slice(0, 40);
  const src = Array.isArray(b.items) ? b.items : [];
  if (!src.length || src.length > 8) return { error: 'Бодлогын тоо буруу (1–8)' };
  const items = [];
  for (const x of src) {
    const id = str(x?.id, 40), stem = str(x?.stem, 6000);
    if (!id || stem == null) return { error: 'Бодлого буруу' };
    const choices = (Array.isArray(x.choices) ? x.choices : []).slice(0, 5).map(c => (typeof c === 'string' ? c.slice(0, 800) : ''));
    const letters = (Array.isArray(x.letters) ? x.letters : []).filter(l => /^[a-h]$/.test(l)).slice(0, 8);
    let img = null;
    if (x.img) { const m = IMG_RE.exec(String(x.img)); if (!m || m[2].length > 1_000_000) return { error: 'Зураг буруу' }; img = { media: m[1], data: m[2] }; }
    if (!stem.trim() && !img) continue;
    items.push({ id, stem, choices, letters, img });
  }
  return items.length ? { subject, topics, items } : { error: 'Бодлого хоосон байна' };
}

export default requirePaid(async function handler(req, res) {
  if (req.method === 'GET') return res.json({ enabled: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Зургаас таних үйлчилгээ одоогоор тохируулагдаагүй байна.' });
  const b = req.body || {}, solve = b.mode === 'solve';
  let input;
  if (solve) {
    input = solveInput(b);
    if (input.error) return res.status(400).json({ error: input.error });
  } else {
    const m = IMG_RE.exec(String(b.image || ''));
    if (!m || m[2].length > 4_000_000) return res.status(400).json({ error: 'Зураг буруу эсвэл хэт том (JPEG/PNG/WEBP)' });
    const w = Math.round(Number(b.w)), h = Math.round(Number(b.h));
    if (!(w >= 20 && w <= 8000 && h >= 20 && h <= 8000)) return res.status(400).json({ error: 'Зургийн хэмжээ буруу' });
    input = { media: m[1], data: m[2], w, h };
  }

  await initDb();
  await ensurePapers();
  const t = await getTeacherById(req.teacherId);
  const limit = t?.email === DEMO_EMAIL ? 3 : limitOf(process.env.OCR_DAILY_LIMIT, 100);
  const used = await ocrTake(req.teacherId, limit);
  if (used == null) return res.status(429).json({ error: `Өнөөдрийн хязгаар (${limit}) дууслаа. Маргааш дахин оролдоно уу.` });
  if ((await ocrTake('*', limitOf(process.env.OCR_GLOBAL_LIMIT, 1500))) == null) {
    await ocrRefund(req.teacherId);
    return res.status(429).json({ error: 'Үйлчилгээ өнөөдөр ачаалал ихтэй байна. Маргааш дахин оролдоно уу.' });
  }
  try {
    const out = solve ? { results: await solveItems(input) } : await scanImage(input);
    res.json({ ...out, left: Math.max(0, limit - used) });
  } catch (e) {
    try { await ocrRefund(req.teacherId); await ocrRefund('*'); } catch (e2) {}
    if (e instanceof AiError) return res.status(e.status).json({ error: e.message });
    console.error('[paper-ocr]', e?.message);
    res.status(500).json({ error: 'Алдаа гарлаа. Дахин оролдоно уу.' });
  }
});
