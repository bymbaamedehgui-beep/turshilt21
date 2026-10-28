import { initDb, getTeacherById, grantPromo } from '../../lib/db';
import { requireAuth } from '../../lib/auth';
import { checkPromo } from '../../lib/promo';

// Багшийн промо код (lib/promo.js): POST {action:'check', code} → { ok, code, kind, value };
// POST {action:'redeem', code} — үнэгүй хоногийн кодыг идэвхжүүлнэ → { ok, paidUntil, days }.
// Эрх дууссан багш ч дуудна (тиймээс requirePaid биш). Хөнгөлөлтийн кодыг /api/pay/create {months, promo} хэрэглэнэ.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDb();
  const t = await getTeacherById(req.teacherId);
  if (!t) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  if (t.status === 'disabled') return res.status(403).json({ error: 'Таны эрх хаагдсан байна. Admin-тай холбогдоно уу.' });
  const c = await checkPromo(t.id, req.body?.code);
  if (!c.ok) return res.status(c.status || 400).json({ error: c.error });
  const p = c.promo;
  if (req.body?.action === 'redeem') {
    if (p.kind !== 'days') return res.status(400).json({ error: 'Энэ бол хөнгөлөлтийн код — багцаа сонгоод «QPay-ээр төлөх» дарахад хэрэглэгдэнэ.' });
    const g = await grantPromo(t.id, p.code, { days: p.value });
    return g.error ? res.status(409).json({ error: g.error }) : res.json({ ok: true, paidUntil: g.paidUntil, days: p.value });
  }
  return res.json({ ok: true, code: p.code, kind: p.kind, value: p.value });
});
