import { initDb, getTeacherById, getPromo, listPromos, createPromo, setPromoActive, deletePromo, promoUses } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { normCode, genCode, promoView } from '../../../lib/promo';

// Промо код удирдах (admin): GET → жагсаалт, GET ?code= → { promo, uses }, POST үүсгэх, PATCH {code, active}, DELETE {code}.
// Дасгалын төвийн админы «ЭЕШ шалгагч» цэс (pages/cm-admin.js) eyeshcheck-ийн admin дансаар энийг дууддаг.
export default requireAuth(async function handler(req, res) {
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });

  if (req.method === 'GET') {
    if (req.query.code) {
      const code = normCode(req.query.code);
      const p = code ? await getPromo(code) : null;
      if (!p) return res.status(404).json({ error: 'Код олдсонгүй' });
      const uses = (await promoUses(code)).map(u => ({ name: u.name || '', email: u.email || '', redeemedAt: u.redeemed_at, paid: !!u.payment_id }));
      return res.json({ promo: promoView(p), uses });
    }
    return res.json((await listPromos()).map(promoView));
  }
  if (req.method === 'POST') {
    const b = req.body || {};
    const kind = b.kind === 'percent' || b.kind === 'days' ? b.kind : null;
    if (!kind) return res.status(400).json({ error: 'Кодын төрөл буруу' });
    const value = Number(b.value);
    const top = kind === 'percent' ? 100 : 366;
    if (!Number.isInteger(value) || value < 1 || value > top)
      return res.status(400).json({ error: kind === 'percent' ? 'Хөнгөлөлт 1–100% байна' : 'Хоног 1–366 байна' });
    const maxUses = b.maxUses == null || b.maxUses === '' ? null : Number(b.maxUses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000))
      return res.status(400).json({ error: 'Хэрэглэх тоо 1–100000 байна (хоосон бол хязгааргүй)' });
    let expiresAt = null;
    if (b.expiresAt) {
      const s = String(b.expiresAt);
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T23:59:59+08:00' : s);   // огноо → тэр өдрийн төгсгөл (Улаанбаатар)
      if (isNaN(d) || d <= new Date()) return res.status(400).json({ error: 'Дуусах огноо ирээдүйд байх ёстой' });
      expiresAt = d.toISOString();
    }
    const raw = String(b.code || '').trim();
    const code = raw ? normCode(raw) : genCode();
    if (!code) return res.status(400).json({ error: 'Код 3–40 тэмдэгт: латин үсэг, тоо, зураас (-)' });
    const p = await createPromo({ code, kind, value, maxUses, expiresAt, note: String(b.note || '').trim().slice(0, 200) });
    return p ? res.status(201).json(promoView(p)) : res.status(409).json({ error: `«${code}» код аль хэдийн байна` });
  }
  if (req.method === 'PATCH') {
    const code = normCode(req.body?.code);
    const p = code ? await setPromoActive(code, !!req.body.active) : null;
    return p ? res.json(promoView(p)) : res.status(404).json({ error: 'Код олдсонгүй' });
  }
  if (req.method === 'DELETE') {
    const code = normCode(req.body?.code);
    const r = code ? await deletePromo(code) : false;
    if (r === 'used') return res.status(400).json({ error: 'Ашиглагдсан кодыг устгах боломжгүй — идэвхгүй болгоно уу' });
    return r ? res.json({ ok: true }) : res.status(404).json({ error: 'Код олдсонгүй' });
  }
  res.status(405).end();
});
