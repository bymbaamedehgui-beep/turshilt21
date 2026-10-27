import { getExam, updateExam, deleteExam, getStudents, updateStudentScores, initDb } from '../../../lib/db';
import { requirePaid } from '../../../lib/auth';
import { rescoreSaved } from '../../../lib/eyesh';

export default requirePaid(async function handler(req, res) {
  await initDb();
  const { id } = req.query;
  if (req.method === 'GET') {
    const exam = await getExam(id, req.teacherId);
    return exam ? res.json(exam) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  if (req.method === 'PUT') {
    const exam = await updateExam(id, req.body, req.teacherId);
    if (!exam) return res.status(404).json({ error: 'Олдсонгүй' });
    // Зөв хариулт, оноо засагдвал энэ шалгалтын уншуулсан бүх хуудасны дүнг шинэ тохиргоогоор дахин бодно
    try {
      // асуулт бүрийн хариу хадгалагдаагүй (зөвхөн нийт оноотой) мөрийг хөндөхгүй — тэглэхээс сэргийлнэ
      const students = (await getStudents(exam.id))
        .filter(s => (s.sec1Results && s.sec1Results.length) || (s.sec2Results && Object.keys(s.sec2Results).length));
      const rescored = await updateStudentScores(exam.id, students.map(s => ({ id: s.id, ...rescoreSaved(s, exam) })));
      return res.json({ ...exam, rescored });
    } catch (e) {
      console.error('rescore error:', e);
      return res.json({ ...exam, rescored: 0, rescoreError: 'Шалгалт хадгалагдсан ч сурагчдын дүнг дахин бодож чадсангүй. Дахин хадгалж үзнэ үү.' });
    }
  }
  if (req.method === 'DELETE') {
    await deleteExam(id, req.teacherId);
    return res.json({ ok: true });
  }
  res.status(405).end();
});
