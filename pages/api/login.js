import bcrypt from 'bcryptjs';
import { getTeacherByEmail, initDb, addSession } from '../../lib/db';
import { signToken } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password, deviceId } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email болон нууц үг шаардлагатай' });
  await initDb();
  const teacher = await getTeacherByEmail(email.toLowerCase());
  if (!teacher) return res.status(401).json({ error: 'Email эсвэл нууц үг буруу' });
  const ok = await bcrypt.compare(password, teacher.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email эсвэл нууц үг буруу' });
  if (teacher.status === 'pending') return res.status(403).json({ error: 'Таны хүсэлт admin-д хүлээгдэж байна. Зөвшөөрөл өгсний дараа нэвтэрч болно.' });
  if (teacher.status === 'disabled') return res.status(403).json({ error: 'Таны эрх хаагдсан байна. Admin-тай холбогдоно уу.' });

  // Admin-д device хязгаарлалт хэрэглэхгүй
  if (!teacher.is_admin && deviceId) {
    const session = await addSession(teacher.id, deviceId);
    if (!session.ok) return res.status(403).json({ error: session.error });
  }

  const token = signToken(teacher.id, teacher.email);
  res.json({
    token,
    teacher: { id: teacher.id, email: teacher.email, name: teacher.name, isAdmin: teacher.is_admin, status: teacher.status }
  });
}
