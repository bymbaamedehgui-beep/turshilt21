import { getStudentsByTeacher, createStudent, initDb } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  if (req.method === 'GET') {
    const students = await getStudentsByTeacher(req.teacherId);
    return res.json(students);
  }
  if (req.method === 'POST') {
    const student = await createStudent(req.body);
    return res.json(student);
  }
  res.status(405).end();
});
