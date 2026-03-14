import { initDb } from '../../../lib/db';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'eyesh-default-secret-2025';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  let payload;
  try { payload = jwt.verify(auth, SECRET); } catch { return res.status(401).json({ error: 'Token хүчингүй' }); }

  await initDb();
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

  // Find student account to get teacher_id
  const accounts = await sql`SELECT teacher_id FROM student_accounts WHERE id=${payload.studentId} OR code=${payload.code} LIMIT 1`;
  const teacherId = accounts[0]?.teacher_id;

  // Return only exams from that teacher
  const exams = teacherId
    ? await sql`SELECT id,title,subject,sec1_count,sec1_key,sec1_scores,topics,use_sec2,sec2_config,sec2_score,created_at FROM exams WHERE teacher_id=${teacherId} ORDER BY created_at DESC`
    : [];

  res.json(exams.map(r=>({
    id:r.id, title:r.title, subject:r.subject, sec1Count:r.sec1_count,
    sec1Key:r.sec1_key, sec1Scores:r.sec1_scores, topics:r.topics,
    useSec2:r.use_sec2, sec2Config:r.sec2_config, sec2Score:r.sec2_score,
    createdAt:r.created_at
  })));
}
