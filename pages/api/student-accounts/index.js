import { getStudentAccounts, createStudentAccount, initDb } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { neon } from '@neondatabase/serverless';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }

export default requireAuth(async function handler(req, res) {
  await initDb();
  if (req.method === 'GET') {
    const accounts = await getStudentAccounts(req.teacherId);
    return res.json(accounts);
  }
  if (req.method === 'POST') {
    const sql = getDb();
    // Get ALL existing codes across all teachers to ensure global uniqueness
    const existing = await sql`SELECT code FROM student_accounts`;
    const existingCodes = new Set(existing.map(r => r.code));

    if (Array.isArray(req.body)) {
      const results = [];
      for (const acc of req.body) {
        if (existingCodes.has(acc.code)) continue; // skip duplicates
        existingCodes.add(acc.code);
        const r = await createStudentAccount(acc, req.teacherId);
        results.push(r);
      }
      return res.json(results);
    }
    if (existingCodes.has(req.body.code)) {
      return res.status(400).json({ error: 'Энэ код аль хэдийн бүртгэлтэй байна' });
    }
    const acc = await createStudentAccount(req.body, req.teacherId);
    return res.json(acc);
  }
  res.status(405).end();
});
