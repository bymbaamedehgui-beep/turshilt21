import { getAllTeachers, updateTeacherStatus, deleteTeacher, getTeacherById, initDb } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });

  if (req.method === 'GET') {
    const teachers = await getAllTeachers();
    return res.json(teachers);
  }
  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    if (!['active','disabled','pending'].includes(status)) return res.status(400).json({ error: 'Буруу статус' });
    if (id === req.teacherId) return res.status(400).json({ error: 'Өөрийнхөө эрхийг өөрчлөх боломжгүй' });
    await updateTeacherStatus(id, status);
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (id === req.teacherId) return res.status(400).json({ error: 'Өөрийгөө устгах боломжгүй' });
    await deleteTeacher(id);
    return res.json({ ok: true });
  }
  res.status(405).end();
});
