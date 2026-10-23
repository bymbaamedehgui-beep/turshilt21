// QPay merchant v2 — нэхэмжлэх үүсгэх ба төлөгдсөн эсэхийг шалгах (зөвхөн сервер).
// Нэвтрэх мэдээлэл ЗӨВХӨН Vercel env-ээс: QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE (репо нээлттэй тул кодонд бичихгүй).
const QPAY_URL = 'https://merchant.qpay.mn/v2';

export function qpayConfigured() {
  return !!(process.env.QPAY_USERNAME && process.env.QPAY_PASSWORD && process.env.QPAY_INVOICE_CODE);
}

let token = null, tokenExp = 0;
async function getToken() {
  if (token && Date.now() < tokenExp) return token;
  const auth = Buffer.from(`${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`).toString('base64');
  const r = await fetch(`${QPAY_URL}/auth/token`, { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (!d.access_token) throw new Error('QPay нэвтрэлт амжилтгүй');
  token = d.access_token;
  tokenExp = Date.now() + (d.expires_in ? d.expires_in * 1000 : 3600000) - 60000;
  return token;
}

// → { invoice_id, qr_image (base64 png), qr_text, qPay_shortUrl, urls:[{name, description, logo, link}] }
export async function qpayCreateInvoice({ senderNo, receiver, description, amount, callbackUrl }) {
  const t = await getToken();
  const r = await fetch(`${QPAY_URL}/invoice`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice_code: process.env.QPAY_INVOICE_CODE,
      sender_invoice_no: senderNo,
      invoice_receiver_code: receiver,
      invoice_description: description,
      amount,
      callback_url: callbackUrl,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.invoice_id) throw new Error('QPay нэхэмжлэх үүсгэж чадсангүй');
  return d;
}

// Төлөгдсөн бөгөөд төлсөн дүн хүрэлцэх эсэх (callback-д итгэхгүй — үргэлж QPay-ээс шалгана)
export async function qpayInvoicePaid(invoiceId, needAmount) {
  const t = await getToken();
  const r = await fetch(`${QPAY_URL}/payment/check`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ object_type: 'INVOICE', object_id: invoiceId, offset: { page_number: 1, page_limit: 100 } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!(Number(d.count) > 0)) return false;
  let sum = 0;
  (Array.isArray(d.rows) ? d.rows : []).forEach(x => {
    if (String(x?.payment_status || 'PAID').toUpperCase() === 'PAID') sum += Number(x.payment_amount) || 0;
  });
  return Math.max(sum, Number(d.paid_amount) || 0) >= Number(needAmount || 0);
}
