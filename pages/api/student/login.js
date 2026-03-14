import { initDb } from '../../../lib/db';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'eyesh-default-secret-2025';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDb();
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Код оруулна уу' });

  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  // Get all matching accounts — pick the one with teacher_id if multiple
  const rows = await sql`SELECT * FROM student_accounts WHERE code = ${code.trim()} ORDER BY created_at DESC`;
  if (!rows[0]) return res.status(401).json({ error: 'Код олдсонгүй' });

  // If multiple accounts with same code, prefer one with teacher_id
  const student = rows.find(r => r.teacher_id) || rows[0];

  const token = jwt.sign({ studentId: student.id, code: student.code, teacherId: student.teacher_id }, SECRET, { expiresIn: '7d' });
  res.json({ token, student });
}
