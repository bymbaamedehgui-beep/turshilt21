import { initDb, getExam, createStudent, hasStudentResult } from '../../../lib/db';
import { requireStudent } from '../../../lib/auth';
import { calcScore, SEC1_CHOICES, hideAnswers } from '../../../lib/eyesh';

// Онлайнаар өгсөн шалгалт: зөвхөн сонгосон хариултыг хүлээж аваад оноог СЕРВЕР түлхүүрээр бодно
// (өмнө нь клиентийн тооцсон оноог шууд хадгалдаг байсан — сурагч дураараа оноо илгээж болох байв)
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export default requireStudent(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDb();
  const s = req.student;
  const exam = await getExam(String(req.body?.examId || ''), s.teacher_id);
  if (!exam) return res.status(404).json({ error: 'Шалгалт олдсонгүй' });
  // Багш онлайнаар нээгээгүй (цаасаар авах) шалгалт
  if (!exam.onlineOpen) return res.status(403).json({ error: 'Багш энэ шалгалтыг онлайнаар нээгээгүй байна' });
  if (await hasStudentResult(s.code, exam.id)) return res.status(409).json({ error: 'Та энэ шалгалтыг өгсөн байна' });

  const sec1 = Array.isArray(req.body?.sec1) ? req.body.sec1 : [];
  const sec2 = req.body?.sec2 && typeof req.body.sec2 === 'object' ? req.body.sec2 : {};
  const det = {
    section1: (exam.sec1Key || []).map((_, i) => ({ q: i + 1, selected: SEC1_CHOICES.includes(sec1[i]) ? sec1[i] : 'BLANK', confidence: 100 })),
    section2: {},
  };
  Object.entries(sec2).forEach(([sub, rows]) => {
    if (!rows || typeof rows !== 'object') return;
    det.section2[sub] = {};
    Object.entries(rows).forEach(([row, v]) => { const d = String(v ?? ''); if (/^[0-9.\-]$/.test(d)) det.section2[sub][row] = { digit: d, confidence: 100 }; });
  });
  const sc = calcScore(det, exam);
  const row = await createStudent({
    id: genId(), examId: exam.id, name: s.name || s.code, code: s.code, class: s.class || '', version: 'онлайн',
    correct: sc.correct, wrong: sc.wrong, blank: sc.blank, rawEarned: sc.rawEarned, rawMax: sc.rawMax,
    scaled: sc.scaled, grade: sc.grade, sec1Results: sc.sec1Results, sec2Results: sc.sec2Results, needsReview: false,
    submittedAt: new Date().toISOString(),
  }, s.teacher_id);
  if (!row) return res.status(404).json({ error: 'Шалгалт олдсонгүй' });
  // Бусад нь өгч дуусаагүй байж болно — хариуг багш нээх хүртэл зөвхөн оноо
  res.status(201).json(exam.answersOpen ? row : hideAnswers(row));
});
