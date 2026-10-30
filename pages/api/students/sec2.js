// PATCH /api/students/sec2
// Body: { studentId, sec1?: ['A','B',...], sec2?: { '2.1': {a:'5',b:'4',...}, ... }, version?: 'B' }
// Сурагчийн хариуг (1 ба/эсвэл 2-р хэсэг) эсвэл хувилбарыг засаад шалгалтын одоогийн түлхүүрээр дахин дүгнэнэ.
// Дүгнэлт нь сканнерынхтай ижил (lib/eyesh.js regradeStudent → calcScore); өгөөгүй хэсэгт хадгалсан хариу хэвээр.

import { requirePaid } from '../../../lib/auth';
import { initDb } from '../../../lib/db';
import { examVariants, regradeStudent } from '../../../lib/eyesh';
import { neon } from '@neondatabase/serverless';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }

export default requirePaid(async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') return res.status(405).end();
  try {
    const { studentId, sec1, sec2, version } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'studentId шаардлагатай' });

    await initDb();
    const sql = getDb();

    // Fetch student + exam
    const sRows = await sql`
      SELECT s.*, e.sec1_key, e.sec1_count, e.sec1_scores, e.topics, e.sec2_config, e.sec2_score, e.use_sec2, e.variants, e.teacher_id
      FROM students s JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ${studentId}`;
    const row = sRows[0];
    if (!row) return res.status(404).json({ error: 'Сурагч олдсонгүй' });
    if (row.teacher_id !== req.teacherId) return res.status(403).json({ error: 'Энэ сурагчид эрхгүй' });

    const exam = {
      sec1Count: row.sec1_count, sec1Key: row.sec1_key || [], sec1Scores: row.sec1_scores || [], topics: row.topics || [],
      useSec2: row.use_sec2, sec2Config: row.sec2_config || {}, sec2Score: row.sec2_score, variants: row.variants || null,
    };
    let ver;
    if (version != null && version !== '') {
      ver = String(version).trim().toUpperCase();
      if (!examVariants(exam).includes(ver)) return res.status(400).json({ error: 'Энэ шалгалтад ийм хувилбар алга' });
    }
    const r = regradeStudent({ version: row.version, sec1Results: row.sec1_results || [], sec2Results: row.sec2_results || {} },
      exam, { sec1, sec2, version: ver });

    await sql`UPDATE students
      SET correct=${r.correct}, wrong=${r.wrong}, blank=${r.blank},
          raw_earned=${r.rawEarned}, raw_max=${r.rawMax}, scaled=${r.scaled},
          grade=${JSON.stringify(r.grade)}, version=${r.version},
          sec1_results=${JSON.stringify(r.sec1Results)},
          sec2_results=${JSON.stringify(r.sec2Results)}
      WHERE id=${studentId}`;

    res.json({ ok: true, correct: r.correct, wrong: r.wrong, blank: r.blank, rawEarned: r.rawEarned, rawMax: r.rawMax,
      scaled: r.scaled, grade: r.grade, version: r.version, sec1Results: r.sec1Results, sec2Results: r.sec2Results });
  } catch (e) {
    console.error('student edit error:', e);
    res.status(500).json({ error: e.message });
  }
});
