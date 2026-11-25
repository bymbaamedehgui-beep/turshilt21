import crypto from 'crypto';
import { initDb, getExam, getTeacherById, denySubject, getExamQr, saveExamQr, hasExamPaper, getExamPdfLinks } from '../../lib/db';
import { requirePaid } from '../../lib/auth';
import { examVariants } from '../../lib/eyesh';
import { normalizeDriveUrl } from '../../lib/drive';

// Шалгалтын QR (components/ExamQr.js): сурагч QR уншуулж бодлогоо утсаараа харна (pages/api/q.js) — бодлого хэвлэх шаардлагагүй.
// GET ?examId= → { token, open, pdfs, variants, hasPaper, suggest }; PUT { examId, open, pdfs: { A: url, … } } → мөн адил.
// Эх сурвалж: хувилбар бүрийн PDF холбоос (Google Drive) эсвэл Дасгалын төвийн бодлого (hasPaper). Нээхэд тухайн хичээлийн
// эрх хэрэгтэй (онлайн бодлоготой адил), хаах нь үргэлж болно.
const cleanPdf = u => {
  let x;
  try { x = new URL(normalizeDriveUrl(u)); } catch (e) { return null; }
  return x.protocol === 'https:' && x.toString().length <= 1000 ? x.toString() : null;
};

export default requirePaid(async function handler(req, res) {
  await initDb();
  const examId = String((req.method === 'GET' ? req.query.examId : req.body?.examId) || '');
  const exam = await getExam(examId, req.teacherId);
  if (!exam) return res.status(404).json({ error: 'Шалгалт олдсонгүй' });
  const variants = examVariants(exam), hasPaper = await hasExamPaper(exam.id, req.teacherId);
  const reply = async qr => res.json({
    token: qr?.token || null, open: qr ? qr.open : true, pdfs: qr?.pdfs || {}, variants, hasPaper,
    suggest: (await getExamPdfLinks(exam.id, req.teacherId)).map(m => ({ title: m.title, url: m.url })),
  });
  if (req.method === 'GET') return reply(await getExamQr(exam.id, req.teacherId));
  if (req.method !== 'PUT') return res.status(405).end();

  const b = req.body || {}, pdfs = {};
  for (const L of variants) {
    const raw = String(b.pdfs?.[L] || '').trim();
    if (!raw) continue;
    const u = cleanPdf(raw);
    if (!u) return res.status(400).json({ error: `${variants.length > 1 ? L + ' хувилбарын ' : ''}PDF холбоос буруу байна (https://… байх ёстой)` });
    pdfs[L] = u;
  }
  const open = b.open !== false;
  if (open && !hasPaper && !Object.keys(pdfs).length) return res.status(400).json({ error: 'Шалгалтын PDF-ийн Google Drive холбоосоо оруулна уу' });
  if (open && await denySubject(res, await getTeacherById(req.teacherId), exam.subject)) return;
  const prev = await getExamQr(exam.id, req.teacherId);
  return reply(await saveExamQr(exam.id, req.teacherId, prev?.token || crypto.randomBytes(16).toString('base64url'), open, pdfs));
});
