import { getStudentsByTeacher, createStudent, initDb, getExam, getTeacherById, denySubject } from '../../../lib/db';
import { requirePaid } from '../../../lib/auth';

export default requirePaid(async function handler(req, res) {
  await initDb();
  if (req.method === 'GET') {
    const students = await getStudentsByTeacher(req.teacherId);
    return res.json(students);
  }
  if (req.method === 'POST') {
    // Уншуулсан хуудсыг хадгалах — шалгалтын хичээлийн эрх шаардана (lib/db.js canUseSubject)
    const exam = await getExam(String(req.body?.examId || ''), req.teacherId);
    if (!exam) return res.status(404).json({ error: 'Шалгалт олдсонгүй' });
    if (await denySubject(res, await getTeacherById(req.teacherId), exam.subject)) return;
    const student = await createStudent(req.body, req.teacherId);
    return student ? res.json(student) : res.status(404).json({ error: 'Шалгалт олдсонгүй' });
  }
  res.status(405).end();
});
