import { getExams, createExam, initDb } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  if (req.method === 'GET') {
    const exams = await getExams(req.teacherId);
    return res.json(exams);
  }
  if (req.method === 'POST') {
    const exam = await createExam(req.body, req.teacherId);
    return res.json(exam);
  }
  res.status(405).end();
});
