import zlib from 'zlib';
import { initDb, getExam, hasStudentResult, getExamPaperRows } from '../../../lib/db';
import { requireStudent } from '../../../lib/auth';
import { examVariants } from '../../../lib/eyesh';
import { paperDocs } from '../../../lib/paper';

// Онлайн шалгалтын бодлогууд — ХАРИУГҮЙ (lib/paper.js). Зөвхөн багш «Онлайн бодлого»-г нээсэн, сурагч хараахан өгөөгүй,
// өөрийн багшийн шалгалтад. GET ?examId=…&v=B → { docs: [{ part, html }] } (хувилбар бүр ~400KB HTML — шахаж өгнө)
export const config = { api: { responseLimit: false } };

export default requireStudent(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  await initDb();
  const s = req.student;
  const exam = await getExam(String(req.query.examId || ''), s.teacher_id);
  if (!exam || !exam.paperOpen) return res.status(404).json({ error: 'Бодлого олдсонгүй' });
  if (await hasStudentResult(s.code, exam.id)) return res.status(409).json({ error: 'Та энэ шалгалтыг өгсөн байна' });
  const vers = examVariants(exam);
  const L = vers.length > 1 ? String(req.query.v || '').trim().toUpperCase() : 'A';
  if (!vers.includes(L)) return res.status(400).json({ error: 'Хувилбараа сонгоно уу' });
  const docs = paperDocs(await getExamPaperRows(exam.id, s.teacher_id), L);
  if (!docs.length) return res.status(404).json({ error: 'Бодлого олдсонгүй' });
  const body = Buffer.from(JSON.stringify({ docs }), 'utf8');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Accept-Encoding');
  if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
    res.setHeader('Content-Encoding', 'gzip');
    return res.status(200).end(zlib.gzipSync(body));
  }
  return res.status(200).end(body);
});
