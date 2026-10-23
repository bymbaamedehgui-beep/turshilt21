import { requireAuth } from '../../../lib/auth';
import { initDb, getPayment, getTeacherById, hasAccess } from '../../../lib/db';
import { settlePayment } from '../../../lib/billing';

// Клиент «Төлсөн, шалгах» / автомат шалгалт — төлөгдсөн бол эрх сунгагдана
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDb();
  const p = await getPayment(String(req.body?.id || ''));
  if (!p || p.teacher_id !== req.teacherId) return res.status(404).json({ error: 'Нэхэмжлэх олдсонгүй' });
  try {
    const r = await settlePayment(p);
    const t = await getTeacherById(req.teacherId);
    res.json({ paid: r.paid, paidUntil: t?.paid_until || null, hasAccess: hasAccess(t) });
  } catch (e) {
    console.error('[pay/check]', e.message);
    res.status(502).json({ error: 'Төлбөр шалгаж чадсангүй. Дахин оролдоно уу.' });
  }
});
