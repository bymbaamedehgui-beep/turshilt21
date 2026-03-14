import { initDb } from '../../../lib/db';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'eyesh-default-secret-2025';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  // Verify student token
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  try { jwt.verify(auth, SECRET); } catch { return res.status(401).json({ error: 'Token хүчингүй' }); }

  await initDb();
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  // Return all exams (all teachers) for students to choose
  const exams = await sql`SELECT id,title,subject,sec1_count,sec1_key,sec1_scores,topics,use_sec2,sec2_config,sec2_score,created_at FROM exams ORDER BY created_at DESC`;
  res.json(exams.map(r=>({
    id:r.id, title:r.title, subject:r.subject, sec1Count:r.sec1_count,
    sec1Key:r.sec1_key, sec1Scores:r.sec1_scores, topics:r.topics,
    useSec2:r.use_sec2, sec2Config:r.sec2_config, sec2Score:r.sec2_score,
    createdAt:r.created_at
  })));
}
