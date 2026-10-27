import { initDb, getStudentResults, getExams, getMaterials, getGoals, getSetting } from '../../../lib/db';
import { requireStudent } from '../../../lib/auth';
import { SEC2_SUBS, SEC2_ROWS, hideAnswers } from '../../../lib/eyesh';

// Сурагчийн хэсгийн бүх мэдээлэл нэг дор: дүнгийн түүх, багшийн онлайнаар нээсэн шалгалт (хариугүй),
// сурах бичиг, багшийн материал, зорилго, ЭЕШ-ийн огноо
function examOutline(e) {
  const sec2 = {};
  if (e.useSec2) SEC2_SUBS.forEach(sub => {
    const cfg = e.sec2Config?.[sub];
    if (!cfg?._enabled) return;
    const rows = SEC2_ROWS.filter(r => { const v = cfg[r]; const kv = v && typeof v === 'object' ? v.ans : v; return kv !== undefined && kv !== null && kv !== ''; });
    if (rows.length) sec2[sub] = rows;
  });
  return { id: e.id, title: e.title, subject: e.subject, sec1Count: e.sec1Count, sec2, createdAt: e.createdAt };   // түлхүүр явуулахгүй
}

export default requireStudent(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  await initDb();
  const s = req.student;
  const [results, exams, textbooks, materials, goals, eeshDate] = await Promise.all([
    getStudentResults(s.code, s.teacher_id),
    getExams(s.teacher_id),
    getMaterials({ kind: 'textbook' }),
    getMaterials({ kind: 'material', teacherId: s.teacher_id }),
    getGoals(s.id),
    getSetting('eesh_date'),
  ]);
  const taken = new Set(results.map(r => r.examId));
  // Хариу нь нээгдээгүй (эсвэл олдохгүй) шалгалтын дүнд асуулт бүрийн мөр явахгүй
  const answersOpen = new Set(exams.filter(e => e.answersOpen).map(e => e.id));
  res.json({
    student: { id: s.id, name: s.name, code: s.code, class: s.class },
    results: results.map(r => (answersOpen.has(r.examId) ? r : hideAnswers(r))),
    exams: exams.filter(e => e.onlineOpen && !taken.has(e.id)).map(examOutline),
    textbooks,
    materials: materials.filter(m => !m.class || m.class === s.class),
    goals,
    eeshDate,
  });
});
