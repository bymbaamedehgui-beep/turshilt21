import crypto from 'crypto';
import { requireAuth } from '../../../lib/auth';
import { initDb, getTeacherById, createPayment, findOpenPayment } from '../../../lib/db';
import { qpayConfigured, qpayCreateInvoice } from '../../../lib/qpay';
import { planOf, planPrice } from '../../../lib/plans';

const SITE = process.env.SITE_URL || 'https://eyeshcheck.com';
const view = p => ({ id: p.id, months: p.months, amount: p.amount, ...(p.qr || {}) });

// Сонгосон багцаар QPay нэхэмжлэх үүсгэнэ (эрх дууссан багш ч дуудна — тиймээс requirePaid биш)
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const plan = planOf(req.body?.months);
  if (!plan) return res.status(400).json({ error: 'Багц буруу байна' });
  if (!qpayConfigured()) return res.status(503).json({ error: 'Төлбөрийн систем түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.' });

  await initDb();
  const t = await getTeacherById(req.teacherId);
  if (!t) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  if (t.status === 'disabled') return res.status(403).json({ error: 'Таны эрх хаагдсан байна. Admin-тай холбогдоно уу.' });

  const amount = planPrice(plan.months);
  const open = await findOpenPayment(t.id, plan.months);
  if (open && open.amount === amount && open.qr?.qr_image) return res.json(view(open));

  const id = 'P' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  try {
    const inv = await qpayCreateInvoice({
      senderNo: `EY${id}`.slice(0, 45),
      receiver: `ey_${t.id}`.slice(0, 45),
      description: `ЭЕШ шалгагч — ${plan.months} сар`,
      amount,
      callbackUrl: `${SITE}/api/pay/callback?pid=${id}`,
    });
    const qr = {
      qr_image: inv.qr_image || '', qr_text: inv.qr_text || '', short: inv.qPay_shortUrl || '',
      urls: (Array.isArray(inv.urls) ? inv.urls : []).map(u => ({ name: u.name, description: u.description, logo: u.logo, link: u.link })),
    };
    const p = { id, teacherId: t.id, invoiceId: inv.invoice_id, months: plan.months, amount, qr };
    await createPayment(p);
    res.json(view({ ...p, qr }));
  } catch (e) {
    console.error('[pay/create]', e.message);
    res.status(502).json({ error: 'QPay нэхэмжлэх үүсгэж чадсангүй. Дахин оролдоно уу.' });
  }
});
