// PATCH /api/students/sec2
// Body: { studentId, sec2: { '2.1': {a:'5',b:'4',...}, ... } }
// Updates the student's Section 2 answers, recomputes total score, saves.

import { requireAuth } from '../../../lib/auth';
import { initDb } from '../../../lib/db';
import { neon } from '@neondatabase/serverless';

const SEC2_ROWS = ['a','b','c','d','e','f','g','h'];
const SEC2_SUBS = ['2.1','2.2','2.3','2.4'];

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }

function eyeshGrade(p) {
  if (p>=90) return {g:'A',l:'Маш сайн',c:'#22c55e'};
  if (p>=80) return {g:'B',l:'Сайн',c:'#84cc16'};
  if (p>=70) return {g:'C',l:'Дунджаас дээгүүр',c:'#eab308'};
  if (p>=60) return {g:'D',l:'Дунд',c:'#f59e0b'};
  if (p>=50) return {g:'E',l:'Дунджаас доогуур',c:'#ea580c'};
  return {g:'F',l:'Тэнцээгүй',c:'#dc2626'};
}

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') return res.status(405).end();
  try {
    const { studentId, sec2 } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'studentId шаардлагатай' });

    await initDb();
    const sql = getDb();

    // Fetch student + exam
    const sRows = await sql`
      SELECT s.*, e.sec2_config, e.sec2_score, e.sec1_scores, e.use_sec2, e.teacher_id
      FROM students s JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ${studentId}`;
    const stu = sRows[0];
    if (!stu) return res.status(404).json({ error: 'Сурагч олдсонгүй' });
    if (stu.teacher_id !== req.teacherId) return res.status(403).json({ error: 'Энэ сурагчид эрхгүй' });

    const cfg = stu.sec2_config || {};
    const sec1_results = stu.sec1_results || [];

    // Recompute Sec1 totals from existing sec1_results
    let correct = 0, wrong = 0, blank = 0, earned = 0;
    for (const r of sec1_results) {
      if (r.st === 'ok') { correct++; earned += +r.pts || 0; }
      else if (r.st === 'ng') wrong++;
      else blank++;
    }

    // Build new sec2_results from input
    const new_sec2 = {};
    let sec2Max = 0;
    for (const sub of SEC2_SUBS) {
      if (!cfg[sub]?._enabled) continue;
      new_sec2[sub] = {};
      for (const rk of SEC2_ROWS) {
        const item = cfg[sub][rk];
        if (!item) continue;
        const isObj = typeof item === 'object';
        const ans = isObj ? item.ans : item;
        if (ans === undefined || ans === null || ans === '') continue;
        const pts = isObj ? (item.score != null ? +item.score : 1) : (+stu.sec2_score || 1);
        sec2Max += pts;

        const userVal = sec2?.[sub]?.[rk];
        const sel = (userVal === undefined || userVal === null || userVal === '') ? 'BLANK' : String(userVal).trim();

        if (sel === 'BLANK') {
          blank++;
          new_sec2[sub][rk] = { sel: 'BLANK', key: String(ans), st: 'blank', pts: 0, max: pts };
        } else if (sel === String(ans)) {
          correct++; earned += pts;
          new_sec2[sub][rk] = { sel, key: String(ans), st: 'ok', pts, max: pts };
        } else {
          wrong++;
          new_sec2[sub][rk] = { sel, key: String(ans), st: 'ng', pts: 0, max: pts };
        }
      }
    }

    const sec1Max = (stu.sec1_scores || []).reduce((a, b) => a + (+b || 0), 0);
    const totalMax = sec1Max + sec2Max;
    const scaled = totalMax > 0 ? Math.round(earned / totalMax * 1000) / 10 : 0;
    const grade = eyeshGrade(scaled);

    await sql`UPDATE students
      SET correct=${correct}, wrong=${wrong}, blank=${blank},
          raw_earned=${earned}, raw_max=${totalMax}, scaled=${scaled},
          grade=${JSON.stringify(grade)},
          sec2_results=${JSON.stringify(new_sec2)}
      WHERE id=${studentId}`;

    res.json({ ok: true, correct, wrong, blank, rawEarned: earned, rawMax: totalMax, scaled, grade, sec2Results: new_sec2 });
  } catch (e) {
    console.error('sec2 update error:', e);
    res.status(500).json({ error: e.message });
  }
});
