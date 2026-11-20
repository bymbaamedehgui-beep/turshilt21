import { initDb, getTeacherById } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { ensureBank, listBank, normBankItem, upsertBankItem, setBankActive, deleteBankItem } from '../../../lib/eeshbank';

// Admin «ЭЕШ сан» (components/EeshBankAdmin.js): GET → бүх мөр; POST { subject, year, variant, title?, exam, pdfUrl?, pdfSize?, material? }
// → нэмэх/шинэчлэх (хичээл+он+хувилбараар); PATCH { id, active } → нуух/харуулах; DELETE ?id= → мөрийг устгана — PDF файлыг
// УСТГАХГҮЙ (сангаас үүсгэсэн багш нарын шалгалтын материал тэр холбоосыг ашигладаг).
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default requireAuth(async function handler(req, res) {
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });
  await ensureBank();
  if (req.method === 'GET') return res.json(await listBank({ all: true }));
  if (req.method === 'POST') {
    const it = normBankItem(req.body);
    if (it.error) return res.status(400).json({ error: it.error });
    return res.json(await upsertBankItem(it));
  }
  if (req.method === 'PATCH') {
    return (await setBankActive(req.body?.id, req.body?.active === true)) ? res.json({ ok: true }) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  if (req.method === 'DELETE') {
    return (await deleteBankItem(req.query.id)) ? res.json({ ok: true }) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  res.status(405).end();
});
