import { requireAuth } from '../../../lib/auth';
import { initDb, getTeacherById } from '../../../lib/db';
import { ensureBank, listBank, getBankItem, bankUntil, createBankExam } from '../../../lib/eeshbank';
import { BANK_MONTH_PRICE, BANK_SUBJECTS, PLANS } from '../../../lib/plans';

// «ЭЕШ сан» — багш (components/EeshBank.js): GET → { items, until, price, months, subjects } — жагсаалтыг эрхгүй багш ч харна
// (худалдан авахын өмнө юу байгааг); POST { id, online } → сангаас хариутай шалгалт + материал (эрхтэй багш) → { examId, created, online }.
export default requireAuth(async function handler(req, res) {
  await initDb();
  await ensureBank();
  const t = await getTeacherById(req.teacherId);
  if (!t) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  const until = await bankUntil(t.id);
  const ok = !!t.is_admin || !!(until && until > new Date());
  if (req.method === 'GET') {
    return res.json({ items: await listBank(), until, access: ok, price: BANK_MONTH_PRICE, months: PLANS.map(p => p.months), subjects: BANK_SUBJECTS });
  }
  if (req.method === 'POST') {
    if (t.status === 'disabled') return res.status(403).json({ error: 'Таны эрх хаагдсан байна. Admin-тай холбогдоно уу.' });
    // 402 биш — apiFetch 402-оор нэг хичээлийн төлбөрийн дэлгэц рүү шилждэг (lib/eyesh.js)
    if (!ok) return res.status(403).json({ error: '«ЭЕШ сан»-гийн эрх алга. Доорх багцыг авна уу.', code: 'BANK_REQUIRED' });
    const item = await getBankItem(req.body?.id);
    if (!item || !item.active) return res.status(404).json({ error: 'Материал олдсонгүй' });
    try {
      return res.json(await createBankExam(t.id, item, { online: req.body?.online === true }));
    } catch (e) {
      console.error('[eesh/bank]', e.message);
      return res.status(500).json({ error: 'Шалгалт үүсгэж чадсангүй. Дахин оролдоно уу.' });
    }
  }
  res.status(405).end();
});
