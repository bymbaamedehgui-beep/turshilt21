import { getExam, updateExam, deleteExam, initDb } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  const { id } = req.query;
  if (req.method === 'GET') {
    const exam = await getExam(id, req.teacherId);
    return exam ? res.json(exam) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  if (req.method === 'PUT') {
    const exam = await updateExam(id, req.body, req.teacherId);
    return exam ? res.json(exam) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  if (req.method === 'DELETE') {
    await deleteExam(id, req.teacherId);
    return res.json({ ok: true });
  }
  res.status(405).end();
});
