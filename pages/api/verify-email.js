import { initDb, getTeacherByEmail, updateTeacherStatus } from '../../lib/db';
import { neon } from '@neondatabase/serverless';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'Мэдээлэл дутуу' });
  await initDb();
  const sql = getDb();
  const rows = await sql`SELECT * FROM email_verifications WHERE email=${email.toLowerCase()} AND code=${code} AND expires_at > NOW()`;
  if (!rows[0]) return res.status(400).json({ error: 'Код буруу эсвэл хугацаа дууссан' });
  // Mark as verified — set status to pending (awaiting admin approval)
  await sql`UPDATE teachers SET status='pending' WHERE email=${email.toLowerCase()} AND status='verify'`;
  await sql`DELETE FROM email_verifications WHERE email=${email.toLowerCase()}`;
  res.json({ ok: true });
}
