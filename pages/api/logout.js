import { removeSession, initDb } from '../../lib/db';
import { requireAuth } from '../../lib/auth';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDb();
  const { deviceId } = req.body || {};
  if (deviceId) await removeSession(req.teacherId, deviceId);
  res.json({ ok: true });
});
