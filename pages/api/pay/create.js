import crypto from 'crypto';
import { requireAuth } from '../../../lib/auth';
import { initDb, getTeacherById, createPayment, findOpenPayment, grantPromo, grantPromoLicenses, teacherFloors, getSchoolByOwner, welcomeOffer } from '../../../lib/db';
import { qpayConfigured, qpayCreateInvoice } from '../../../lib/qpay';
import { planOf, planPrice, promoPrice, pctPrice, schoolPrice, normSubjects, SUBJECTS, BANK, bankPrice } from '../../../lib/plans';
import { checkPromo } from '../../../lib/promo';

const SITE = process.env.SITE_URL || 'https://eyeshcheck.com';
const view = p => ({ id: p.id, months: p.months, amount: p.amount, subjects: p.subjects || null, school: !!(p.school_id || p.schoolId), ...(p.qr || {}) });

// Сонгосон багцаар QPay нэхэмжлэх үүсгэнэ (эрх дууссан багш ч дуудна — тиймээс requirePaid биш).
// Багш: {months, subject, promo?} — НЭГ хичээлийн эрх (lib/plans.js); 100%-ийн промо код бол QPay-гүйгээр шууд → { free, months, paidUntil }.
// Шинэ бүртгэлийн 24 цагийн урамшуулалтай бол урамшууллын үнэ; промо код түүнээс хямд үед л промо хэрэглэгдэнэ (давхцахгүй).
// Урамшуулал зөвхөн эхний нэг төлбөрт: промо ашигласан бол дуусна (welcomeOffer), давхар нэхэмжлэхийг markPaidLicenses хоногоор олгоно.
// Сургууль: {months, school:true, subjects:[…], promo?} — сургуулийн эзэн; хичээл бүр нэг хичээлийн үнээр (урамшуулалгүй).
// ЭЕШ сан: {months, bank:true, promo?} — бүх хичээл + ЭЕШ сан (lib/plans.js BANK_MONTH_PRICE).
// Сургууль, ЭЕШ санд зөвхөн тэр эрхэд хамаарах (promo_codes.scopes) хөнгөлөлтийн (%) код; 100% бол QPay-гүйгээр шууд олгоно.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const plan = planOf(req.body?.months);
  if (!plan) return res.status(400).json({ error: 'Багц буруу байна' });

  await initDb();
  const t = await getTeacherById(req.teacherId);
  if (!t) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  if (t.status === 'disabled') return res.status(403).json({ error: 'Таны эрх хаагдсан байна. Admin-тай холбогдоно уу.' });

  let subjects, school = null, amount, promo = null, label, welcome = null;
  if (req.body?.bank || req.body?.school) {
    if (req.body?.bank) {
      // «ЭЕШ сан» багц {months, bank:true} (components/EeshBank.js): БҮХ хичээлийн эрх + ЭЕШ сан, сард 29,900₮ — урамшуулалгүй
      subjects = [...SUBJECTS, BANK];
      amount = bankPrice(plan.months);
      label = 'ЭЕШ сан + бүх хичээл';
    } else {
      school = await getSchoolByOwner(t.id);
      if (!school) return res.status(400).json({ error: 'Эхлээд сургуулийн нэрээ оруулж сургуулиа үүсгэнэ үү.' });
      subjects = normSubjects(req.body?.subjects);
      if (!subjects.length) return res.status(400).json({ error: 'Хичээлээ сонгоно уу.' });
      amount = schoolPrice(plan.months, subjects.length);
      label = `${school.name}: ${subjects.join(', ')}`;
    }
    if (req.body?.promo) {
      const scope = school ? 'school' : 'bank';
      const c = await checkPromo(t.id, req.body.promo, scope);
      if (!c.ok) return res.status(c.status || 400).json({ error: c.error });
      if (c.promo.kind !== 'percent') return res.status(400).json({ error: 'Үнэгүй хоногийн код зөвхөн багшийн нэг хичээлийн эрхэд хэрэглэгдэнэ.' });
      promo = c.promo;
      amount = pctPrice(amount, promo.value);
      if (amount === 0) {
        const g = await grantPromoLicenses(t.id, promo.code, { owner: school ? 's:' + school.id : 't:' + t.id, subjects, months: plan.months,
          scope, floors: school ? {} : teacherFloors(t) });
        return g.error ? res.status(409).json({ error: g.error })
          : res.json({ free: true, months: plan.months, subjects, school: !!school, paidUntil: g.paidUntil });
      }
    }
  } else {
    subjects = normSubjects([req.body?.subject]);
    if (subjects.length !== 1) return res.status(400).json({ error: 'Хичээлээ сонгоно уу (хуудсаа дахин ачаалж үзнэ үү).' });
    welcome = await welcomeOffer(t);
    amount = planPrice(plan.months, !!welcome);
    label = subjects[0];
    if (req.body?.promo) {
      const c = await checkPromo(t.id, req.body.promo, 'teacher');
      if (!c.ok) return res.status(c.status || 400).json({ error: c.error });
      if (c.promo.kind !== 'percent') return res.status(400).json({ error: 'Энэ бол үнэгүй хоногийн код — «Идэвхжүүлэх» товчийг дарна уу.' });
      const pa = promoPrice(plan.months, c.promo.value);
      if (!welcome || pa < amount) { promo = c.promo; amount = pa; welcome = null; }   // урамшууллаас хямд бол л промо
    }
    if (promo && amount === 0) {
      const g = await grantPromo(t.id, promo.code, { months: plan.months, subject: subjects[0] });
      return g.error ? res.status(409).json({ error: g.error }) : res.json({ free: true, months: plan.months, subject: subjects[0], paidUntil: g.paidUntil });
    }
  }
  if (!qpayConfigured()) return res.status(503).json({ error: 'Төлбөрийн систем түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.' });

  const promoCode = promo ? promo.code : null, schoolId = school ? school.id : null;
  const open = await findOpenPayment(t.id, plan.months, { subjects, schoolId });
  if (open && open.amount === amount && (open.promo_code || null) === promoCode && open.qr?.qr_image) return res.json(view(open));

  const id = 'P' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  try {
    const inv = await qpayCreateInvoice({
      senderNo: `EY${id}`.slice(0, 45),
      receiver: `ey_${t.id}`.slice(0, 45),
      description: `ЭЕШ шалгагч — ${label} · ${plan.months} сар${promo ? ` (${promo.code} −${promo.value}%)` : welcome ? ' (шинэ хэрэглэгчийн урамшуулал)' : ''}`.slice(0, 250),
      amount,
      callbackUrl: `${SITE}/api/pay/callback?pid=${id}`,
    });
    const qr = {
      qr_image: inv.qr_image || '', qr_text: inv.qr_text || '', short: inv.qPay_shortUrl || '',
      urls: (Array.isArray(inv.urls) ? inv.urls : []).map(u => ({ name: u.name, description: u.description, logo: u.logo, link: u.link })),
    };
    // welcome — урамшууллын үнээр (промо хэрэглээгүй); төлөгдөхдөө эхний төлбөр эсэхийг дахин шалгана (lib/db.js markPaidLicenses)
    const p = { id, teacherId: t.id, invoiceId: inv.invoice_id, months: plan.months, amount, qr, promoCode, subjects, schoolId, welcome: !!welcome && !promo };
    await createPayment(p);
    res.json(view({ ...p, qr }));
  } catch (e) {
    console.error('[pay/create]', e.message);
    res.status(502).json({ error: 'QPay нэхэмжлэх үүсгэж чадсангүй. Дахин оролдоно уу.' });
  }
});
