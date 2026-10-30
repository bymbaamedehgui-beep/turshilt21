import { initDb, getStudentResults, getExams, getMaterials, getGoals, getSetting } from '../../../lib/db';
import { requireStudent } from '../../../lib/auth';
import { SEC2_SUBS, SEC2_ROWS, examVariants, examForVersion } from '../../../lib/eyesh';

// Сурагчийн хэсгийн бүх мэдээлэл нэг дор: дүнгийн түүх, онлайнаар өгөх шалгалт (хариугүй),
// сурах бичиг, багшийн материал, зорилго, ЭЕШ-ийн огноо
function sec2Rows(e) {
  const sec2 = {};
  if (e.useSec2) SEC2_SUBS.forEach(sub => {
    const cfg = e.sec2Config?.[sub];
    if (!cfg?._enabled) return;
    const rows = SEC2_ROWS.filter(r => { const v = cfg[r]; const kv = v && typeof v === 'object' ? v.ans : v; return kv !== undefined && kv !== null && kv !== ''; });
    if (rows.length) sec2[sub] = rows;
  });
  return sec2;
}
function examOutline(e) {
  const out = { id: e.id, title: e.title, subject: e.subject, sec1Count: e.sec1Count, sec2: sec2Rows(e), createdAt: e.createdAt };   // түлхүүр явуулахгүй
  // олон хувилбартай: сурагч өөрийн хувилбарыг сонгоно — хувилбар бүрийн 2-р хэсгийн мөрүүд (түлхүүргүй)
  const vers = examVariants(e);
  if (vers.length > 1) out.variants = Object.fromEntries(vers.map(L => [L, sec2Rows(examForVersion(e, L))]));
  return out;
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
  res.json({
    student: { id: s.id, name: s.name, code: s.code, class: s.class },
    results,
    exams: exams.filter(e => !taken.has(e.id)).map(examOutline),
    textbooks,
    // Дасгалын төвөөс хадгалсан шалгалтын материал (examId) — зөвхөн багшид
    materials: materials.filter(m => !m.examId && (!m.class || m.class === s.class)),
    goals,
    eeshDate,
  });
});
