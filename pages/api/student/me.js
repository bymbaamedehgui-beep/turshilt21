import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

const SECRET = process.env.JWT_SECRET || 'eyesh-default-secret-2025';

function getDb() {
  return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const { studentId } = jwt.verify(auth.slice(7), SECRET);
    const sql = getDb();
    const rows = await sql`SELECT * FROM student_accounts WHERE id = ${studentId}`;
    if (!rows[0]) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: 'Token хүчингүй' });
  }
}
