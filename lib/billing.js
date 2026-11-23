// QPay төлбөрийг баталгаажуулж эрх сунгах (pay/check ба pay/callback хуваалцана). Зөвхөн сервер.
import { markPaidAndExtend } from './db';
import { qpayInvoicePaid } from './qpay';
import { fmtMNT } from './plans';

async function notify(text) {
  const tok = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!tok || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch (e) {}
}

// → { paid:boolean, until? } — until: энэ төлбөрөөр сунгасан эрхийн дуусах огноо
export async function settlePayment(p) {
  if (!p) return { paid: false };
  if (p.status === 'paid') return { paid: true };
  if (!(await qpayInvoicePaid(p.invoice_id, p.amount))) return { paid: false };
  const r = await markPaidAndExtend(p.id);
  if (!r) return { paid: true };   // зэрэг ирсэн callback аль хэдийн сунгасан
  const until = r.until ? new Date(r.until).toISOString().slice(0, 10) : '—';
  const subs = Array.isArray(r.payment?.subjects) ? r.payment.subjects : null;
  const what = subs ? (r.school ? `🏫 ${r.school.name} — ${subs.join(', ')}` : `📚 ${subs.join(', ')}`) : '📚 Бүх хичээл';
  const wd = r.welcomeDays ? `\n⚠️ Урамшуулал давхардсан — ${r.welcomeDays} хоног олгосон` : '';
  await notify(`💳 ЭЕШ шалгагч — QPay төлбөр\n\n👤 ${r.teacher?.name || '—'}\n📧 ${r.teacher?.email || '—'}\n${what}\n📦 ${p.months} сар · ${fmtMNT(p.amount)}\n📅 ${until} хүртэл${wd}`);
  return { paid: true, until: r.until || null, welcomeDays: r.welcomeDays || null };
}
