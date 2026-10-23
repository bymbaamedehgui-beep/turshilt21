import { requirePaid } from '../../../lib/auth';
import { deleteStudentAccount, initDb } from '../../../lib/db';

async function handler(req, res) {
  await initDb();
  if (req.method === 'DELETE') {
    const ok = await deleteStudentAccount(req.query.id, req.teacherId);
    return ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  res.status(405).end();
}
export default requirePaid(handler);
