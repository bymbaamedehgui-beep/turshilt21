// Сургуулийн нэгдсэн жагсаалт (components/SchoolPage.js) — зөвхөн сургуулийн эзэнд:
// { school, exams:[{id,title,subject,createdAt,teacherName,n,avg}], rows:[{examId,name,code,class,scaled}] }
import { requireAuth } from '../../../lib/auth';
import { initDb, getSchoolByOwner, schoolReport } from '../../../lib/db';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  await initDb();
  const school = await getSchoolByOwner(req.teacherId);
  if (!school) return res.status(403).json({ error: 'Зөвхөн сургуулийн эзэн харна' });
  res.json({ school: { id: school.id, name: school.name }, ...(await schoolReport(school.id)) });
});
