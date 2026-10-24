import { initDb, getTeacherById, getSetting, setSetting } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

// Admin тохиргоо: ЭЕШ-ийн огноо (сурагчийн «ЭЕШ хүртэл N өдөр» тоолуурт)
export default requireAuth(async function handler(req, res) {
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });
  if (req.method === 'GET') return res.json({ eeshDate: await getSetting('eesh_date') });
  if (req.method === 'PUT') {
    const d = String(req.body?.eeshDate || '').trim();
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return res.status(400).json({ error: 'Огноо буруу (жишээ нь 2027-06-07)' });
    await setSetting('eesh_date', d || null);
    return res.json({ eeshDate: d || null });
  }
  res.status(405).end();
});
