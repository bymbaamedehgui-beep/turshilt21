import bcrypt from 'bcryptjs';
import { createTeacher, getTeacherByEmail, initDb } from '../../lib/db';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email болон нууц үг шаардлагатай' });
  if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });
  await initDb();
  const existing = await getTeacherByEmail(email.toLowerCase());
  if (existing) return res.status(400).json({ error: 'Энэ email бүртгэлтэй байна' });
  const passwordHash = await bcrypt.hash(password, 10);
  const teacher = await createTeacher({ id: genId(), email: email.toLowerCase(), passwordHash, name: name||'' });
  res.json({ ok: true, status: teacher.status, isAdmin: teacher.is_admin });
}
