import { initDb, getTeacherById, grantPromo } from '../../lib/db';
import { requireAuth } from '../../lib/auth';
import { checkPromo, normScopes, promoScopes } from '../../lib/promo';
import { normSubjects } from '../../lib/plans';

// Багшийн промо код (lib/promo.js): POST {action:'check', code, scope?} → { ok, code, kind, value, scopes } — scope ('teacher' |
// 'school' | 'bank') өгвөл тэр эрхэд хамаарахгүй кодыг татгалзана; POST {action:'redeem', code, subject} — үнэгүй хоногийн кодоор
// тэр хичээлийн эрхийг сунгана → { ok, paidUntil, days, subject }.
// Эрх дууссан багш ч дуудна (тиймээс requirePaid биш). Хөнгөлөлтийн кодыг /api/pay/create {months, promo} хэрэглэнэ.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDb();
  const t = await getTeacherById(req.teacherId);
  if (!t) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  if (t.status === 'disabled') return res.status(403).json({ error: 'Таны эрх хаагдсан байна. Admin-тай холбогдоно уу.' });
  const redeem = req.body?.action === 'redeem';
  const c = await checkPromo(t.id, req.body?.code, redeem ? 'teacher' : normScopes([req.body?.scope])[0] || null);
  if (!c.ok) return res.status(c.status || 400).json({ error: c.error });
  const p = c.promo;
  if (redeem) {
    if (p.kind !== 'days') return res.status(400).json({ error: 'Энэ бол хөнгөлөлтийн код — багцаа сонгоод «QPay-ээр төлөх» дарахад хэрэглэгдэнэ.' });
    const [subject] = normSubjects([req.body?.subject]);
    if (!subject) return res.status(400).json({ error: 'Хичээлээ сонгоно уу.' });
    const g = await grantPromo(t.id, p.code, { days: p.value, subject });
    return g.error ? res.status(409).json({ error: g.error }) : res.json({ ok: true, paidUntil: g.paidUntil, days: p.value, subject });
  }
  return res.json({ ok: true, code: p.code, kind: p.kind, value: p.value, scopes: promoScopes(p) });
});
