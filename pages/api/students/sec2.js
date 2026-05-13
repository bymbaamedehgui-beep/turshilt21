// PATCH /api/students/sec2
// Body: { studentId, sec1?: ['A','B',...], sec2?: { '2.1': {a:'5',b:'4',...}, ... } }
// Updates the student's answers (Sec1 and/or Sec2), recomputes total + grade, saves.

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
    const { studentId, sec1, sec2 } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'studentId шаардлагатай' });

    await initDb();
    const sql = getDb();

    // Fetch student + exam
    const sRows = await sql`
      SELECT s.*, e.sec1_key, e.sec1_count, e.sec1_scores, e.sec2_config, e.sec2_score, e.use_sec2, e.teacher_id
      FROM students s JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ${studentId}`;
    const stu = sRows[0];
    if (!stu) return res.status(404).json({ error: 'Сурагч олдсонгүй' });
    if (stu.teacher_id !== req.teacherId) return res.status(403).json({ error: 'Энэ сурагчид эрхгүй' });

    const cfg = stu.sec2_config || {};
    const sec1Key = stu.sec1_key || [];
    const sec1Scores = stu.sec1_scores || [];
    const N = sec1Key.length || stu.sec1_count || 0;

    let correct = 0, wrong = 0, blank = 0, earned = 0;

    // ── Section 1: re-grade if `sec1` provided, otherwise reuse existing ──
    let new_sec1;
    if (Array.isArray(sec1)) {
      new_sec1 = [];
      for (let i = 0; i < N; i++) {
        const key = sec1Key[i] || '';
        const pts = +sec1Scores[i] || 1;
        const sel = (sec1[i] || '').toString().trim().toUpperCase();
        if (!sel || sel === 'BLANK' || sel === '*' || sel === '-') {
          blank++;
          new_sec1.push({ q: i + 1, sel: 'BLANK', key, st: 'blank', pts: 0, max: pts });
        } else if (sel === key) {
          correct++; earned += pts;
          new_sec1.push({ q: i + 1, sel, key, st: 'ok', pts, max: pts });
        } else {
          wrong++;
          new_sec1.push({ q: i + 1, sel, key, st: 'ng', pts: 0, max: pts });
        }
      }
    } else {
      new_sec1 = stu.sec1_results || [];
      for (const r of new_sec1) {
        if (r.st === 'ok') { correct++; earned += +r.pts || 0; }
        else if (r.st === 'ng') wrong++;
        else blank++;
      }
    }

    // ── Section 2: re-grade if `sec2` provided, otherwise reuse existing ──
    let new_sec2;
    let sec2Max = 0;
    if (sec2 && typeof sec2 === 'object') {
      new_sec2 = {};
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
    } else {
      new_sec2 = stu.sec2_results || {};
      for (const sub of Object.keys(new_sec2)) {
        for (const rk of Object.keys(new_sec2[sub])) {
          const r = new_sec2[sub][rk];
          sec2Max += +r.max || 0;
          if (r.st === 'ok') { correct++; earned += +r.pts || 0; }
          else if (r.st === 'ng') wrong++;
          else blank++;
        }
      }
    }

    const sec1Max = sec1Scores.reduce((a, b) => a + (+b || 0), 0);
    const totalMax = sec1Max + sec2Max;
    const scaled = totalMax > 0 ? Math.round(earned / totalMax * 1000) / 10 : 0;
    const grade = eyeshGrade(scaled);

    await sql`UPDATE students
      SET correct=${correct}, wrong=${wrong}, blank=${blank},
          raw_earned=${earned}, raw_max=${totalMax}, scaled=${scaled},
          grade=${JSON.stringify(grade)},
          sec1_results=${JSON.stringify(new_sec1)},
          sec2_results=${JSON.stringify(new_sec2)}
      WHERE id=${studentId}`;

    res.json({ ok: true, correct, wrong, blank, rawEarned: earned, rawMax: totalMax, scaled, grade, sec1Results: new_sec1, sec2Results: new_sec2 });
  } catch (e) {
    console.error('student edit error:', e);
    res.status(500).json({ error: e.message });
  }
});
