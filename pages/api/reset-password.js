import { initDb } from '../../lib/db';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, code, password } = req.body || {};
  if (!email || !code || !password) return res.status(400).json({ error: 'Мэдээлэл дутуу' });
  if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });

  await initDb();
  const sql = getDb();

  const rows = await sql`SELECT * FROM password_resets WHERE email=${email.toLowerCase()} AND code=${code.trim()} AND expires_at > NOW()`;
  if (!rows[0]) return res.status(400).json({ error: 'Код буруу эсвэл хугацаа дууссан' });

  const passwordHash = await bcrypt.hash(password, 10);
  // Имэйлээр баталгаажсан шинэ нууц үг — Дасгалын төвийн холбоосыг тасална (lib/cmsso.js: дахин холбохдоо нууц үг асууна)
  await sql`UPDATE teachers SET password_hash=${passwordHash}, cm_linked=false WHERE email=${email.toLowerCase()}`;
  await sql`DELETE FROM password_resets WHERE email=${email.toLowerCase()}`;

  res.json({ ok: true });
}
