import { initDb, getStudentAccountsByCode } from '../../../lib/db';
import { signStudentToken } from '../../../lib/auth';

// Сурагч багшийн өгсөн кодоороо нэвтэрнэ
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const code = String(req.body?.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Код оруулна уу' });
  await initDb();
  const rows = await getStudentAccountsByCode(code);
  if (!rows[0]) return res.status(401).json({ error: 'Код олдсонгүй' });
  // Ижил код олон байвал багштай нь (хамгийн сүүлд үүссэн)
  const student = rows.find(r => r.teacher_id) || rows[0];
  res.json({
    token: signStudentToken(student),
    student: { id: student.id, code: student.code, name: student.name, class: student.class },
  });
}
