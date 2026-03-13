import { requireAuth } from '../../../lib/auth';
import { deleteStudentAccount, initDb } from '../../../lib/db';

async function handler(req, res) {
  await initDb();
  if (req.method === 'DELETE') {
    await deleteStudentAccount(req.query.id);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
export default requireAuth(handler);
