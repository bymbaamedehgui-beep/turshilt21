import { initDb, getTeacherByEmail, createTeacher, getVerification, bumpVerificationAttempt, deleteVerification, phoneTaken, hasAccess } from '../../lib/db';
import { signToken } from '../../lib/auth';
import { hashCode } from '../../lib/sms';
import { TRIAL_DAYS } from '../../lib/plans';

// Бүртгэлийн SMS кодыг шалгаж, багшийг 1 хоногийн туршилттай үүсгээд шууд нэвтрүүлнэ
// (замын нэр хуучин клиентүүдтэй нийцүүлэхийн тулд verify-email хэвээр)
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
const MAX_ATTEMPTS = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').replace(/\D/g, '');
  if (!email || code.length !== 6) return res.status(400).json({ error: '6 оронтой кодоо оруулна уу' });

  await initDb();
  const v = await getVerification(email);
  if (!v || !v.code_hash || new Date(v.expires_at) < new Date()) return res.status(400).json({ error: 'Кодын хугацаа дууссан. Дахин код авна уу.' });
  if ((v.attempts || 0) >= MAX_ATTEMPTS) return res.status(429).json({ error: 'Хэт олон буруу оролдлого. Дахин код авна уу.' });
  if (hashCode(code, email) !== v.code_hash) {
    const left = MAX_ATTEMPTS - (v.attempts || 0) - 1;
    await bumpVerificationAttempt(email);
    return res.status(400).json({ error: left > 0 ? `Код буруу байна (${left} оролдлого үлдлээ)` : 'Код буруу байна. Дахин код авна уу.' });
  }

  let teacher = await getTeacherByEmail(email);
  if (!teacher) {
    if (await phoneTaken(v.phone)) { await deleteVerification(email); return res.status(400).json({ error: 'Энэ утасны дугаараар бүртгэл үүссэн байна' }); }
    teacher = await createTeacher({ id: genId(), email, passwordHash: v.password_hash, name: v.name || '', phone: v.phone || '', trialDays: TRIAL_DAYS, phoneVerified: true });
  }
  await deleteVerification(email);

  try {
    const msg = `🎯 ЭЕШ шалгагч\n\n🆕 Шинэ бүртгэл (${TRIAL_DAYS} хоног туршилт)\n\n👤 ${v.name || '—'}\n📧 ${email}\n📱 ${v.phone || '—'} ✅ SMS`;
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: msg }),
      });
    }
  } catch (e) {}

  res.json({
    ok: true,
    token: signToken(teacher.id, teacher.email),
    teacher: { id: teacher.id, email: teacher.email, name: teacher.name, isAdmin: teacher.is_admin, status: teacher.status,
      paidUntil: teacher.paid_until, hasAccess: hasAccess(teacher) },
  });
}
