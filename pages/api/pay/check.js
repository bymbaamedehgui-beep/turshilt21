import { requireAuth } from '../../../lib/auth';
import { initDb, getPayment, getTeacherById, hasAccess, accessUntil } from '../../../lib/db';
import { settlePayment } from '../../../lib/billing';

// Клиент «Төлсөн, шалгах» / автомат шалгалт — төлөгдсөн бол эрх сунгагдана.
// paidUntil — энэ нэхэмжлэхээр сунгасан эрхийн (хичээлийн) дуусах огноо; аль хэдийн сунгасан бол багшийн хамгийн хожуу эрх.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDb();
  const p = await getPayment(String(req.body?.id || ''));
  if (!p || p.teacher_id !== req.teacherId) return res.status(404).json({ error: 'Нэхэмжлэх олдсонгүй' });
  try {
    const r = await settlePayment(p);
    const t = await getTeacherById(req.teacherId);
    res.json({ paid: r.paid, paidUntil: r.until || accessUntil(t), hasAccess: hasAccess(t), subjects: p.subjects || null, school: !!p.school_id });
  } catch (e) {
    console.error('[pay/check]', e.message);
    res.status(502).json({ error: 'Төлбөр шалгаж чадсангүй. Дахин оролдоно уу.' });
  }
});
