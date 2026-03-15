import { getExams, createExam, initDb, getTeacherById } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { neon } from '@neondatabase/serverless';

const DEMO_EMAIL = 'demo@eyeshcheck.com';

export default requireAuth(async function handler(req, res) {
  await initDb();
  if (req.method === 'GET') {
    const exams = await getExams(req.teacherId);
    return res.json(exams);
  }
  if (req.method === 'POST') {
    // Demo limit: max 1 exam
    const teacher = await getTeacherById(req.teacherId);
    if (teacher?.email === DEMO_EMAIL) {
      const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
      const cnt = await sql`SELECT COUNT(*) as c FROM exams WHERE teacher_id=${req.teacherId}`;
      if (parseInt(cnt[0].c) >= 1) {
        return res.status(403).json({ error: 'Demo хэрэглэгч зөвхөн 1 шалгалт үүсгэж болно' });
      }
    }
    const exam = await createExam(req.body, req.teacherId);
    return res.json(exam);
  }
  res.status(405).end();
});
