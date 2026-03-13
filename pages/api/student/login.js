import { initDb } from '../../../lib/db';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'eyesh-default-secret-2025';

function getDb() {
  return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDb();
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Код оруулна уу' });

  const sql = getDb();
  const rows = await sql`SELECT * FROM student_accounts WHERE code = ${code.trim()}`;
  if (!rows[0]) return res.status(401).json({ error: 'Код олдсонгүй' });

  const token = jwt.sign({ studentId: rows[0].id, code: rows[0].code }, SECRET, { expiresIn: '7d' });
  res.json({ token, student: rows[0] });
}
