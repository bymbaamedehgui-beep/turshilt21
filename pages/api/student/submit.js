import jwt from 'jsonwebtoken';
import { createStudent, initDb } from '../../../lib/db';
import { neon } from '@neondatabase/serverless';

const SECRET = process.env.JWT_SECRET || 'eyesh-default-secret-2025';
function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const { studentId, code } = jwt.verify(auth.slice(7), SECRET);
    await initDb();
    const sql = getDb();
    
    // Check already submitted
    const existing = await sql`SELECT id FROM students WHERE code = ${code} AND exam_id = ${req.body.examId}`;
    if (existing[0]) return res.status(409).json({ error: 'Та энэ шалгалтыг өгсөн байна' });
    
    const student = await createStudent({ ...req.body, code, name: req.body.name || code });
    res.status(201).json(student);
  } catch(e) {
    res.status(401).json({ error: e.message });
  }
}
