import { getStudentAccounts, createStudentAccount, initDb } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  if (req.method === 'GET') {
    const accounts = await getStudentAccounts(req.teacherId);
    return res.json(accounts);
  }
  if (req.method === 'POST') {
    const acc = await createStudentAccount(req.body, req.teacherId);
    return res.json(acc);
  }
  res.status(405).end();
});
