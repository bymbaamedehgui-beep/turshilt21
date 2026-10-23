import { initDb, getPayment } from '../../../lib/db';
import { settlePayment } from '../../../lib/billing';

// QPay төлбөр орсны дараа дууддаг. Callback-ийн агуулгад итгэхгүй — settlePayment QPay-ээс өөрөөс нь шалгана.
export default async function handler(req, res) {
  try {
    await initDb();
    const p = await getPayment(String(req.query.pid || ''));
    if (p) await settlePayment(p);
  } catch (e) {
    console.error('[pay/callback]', e.message);
  }
  res.status(200).send('SUCCESS');
}
