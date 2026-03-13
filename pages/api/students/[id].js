import { requireAuth } from '../../../lib/auth';
import { deleteStudent, initDb } from '../../../lib/db';

async function handler(req, res) {
  await initDb();
  const { id } = req.query;
  if (req.method === 'DELETE') {
    await deleteStudent(id);
    return res.json({ ok: true });
  }
  res.status(405).end();
}

export default requireAuth(handler);
