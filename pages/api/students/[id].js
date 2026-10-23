import { requirePaid } from '../../../lib/auth';
import { deleteStudent, initDb } from '../../../lib/db';

async function handler(req, res) {
  await initDb();
  const { id } = req.query;
  if (req.method === 'DELETE') {
    const ok = await deleteStudent(id, req.teacherId);
    return ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  res.status(405).end();
}

export default requirePaid(handler);
