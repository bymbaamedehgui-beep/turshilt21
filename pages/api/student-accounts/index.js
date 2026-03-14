import { getStudentAccounts, createStudentAccount, initDb } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  if (req.method === 'GET') {
    const accounts = await getStudentAccounts(req.teacherId);
    return res.json(accounts);
  }
  if (req.method === 'POST') {
    if (Array.isArray(req.body)) {
      const results = [];
      for (const acc of req.body) {
        const r = await createStudentAccount(acc, req.teacherId);
        results.push(r);
      }
      return res.json(results);
    }
    const acc = await createStudentAccount(req.body, req.teacherId);
    return res.json(acc);
  }
  res.status(405).end();
});
