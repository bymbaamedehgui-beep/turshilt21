// Admin: сургуулиуд — GET жагсаалт (эзэн, гишүүд, хичээлийн эрх); PATCH {id, subject, months} — гараар сунгах (дансаар төлсөн г.м.)
import { requireAuth } from '../../../lib/auth';
import { initDb, getTeacherById, getAllSchools, grantLicenses } from '../../../lib/db';
import { normSubjects } from '../../../lib/plans';

export default requireAuth(async function handler(req, res) {
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });
  if (req.method === 'GET') return res.json(await getAllSchools());
  if (req.method === 'PATCH') {
    const months = parseInt(req.body?.months, 10);
    if (![1, 3, 6, 12].includes(months)) return res.status(400).json({ error: 'Сар буруу' });
    const [subject] = normSubjects([req.body?.subject]);
    if (!subject) return res.status(400).json({ error: 'Хичээл буруу' });
    const id = String(req.body?.id || '');
    if (!(await getAllSchools()).some(s => s.id === id)) return res.status(404).json({ error: 'Сургууль олдсонгүй' });
    const r = await grantLicenses('s:' + id, [subject], { months });
    return res.json({ ok: true, subject, until: r.until });
  }
  res.status(405).end();
});
