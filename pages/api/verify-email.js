import { initDb, getTeacherByEmail, createTeacher, getVerificationByPoll, consumeVerification, phoneTaken, hasAccess } from '../../lib/db';
import { signToken } from '../../lib/auth';
import { pollHash, sessionStatus } from '../../lib/verifymn';
import { TRIAL_DAYS } from '../../lib/plans';

// Бүртгэлийн төлөв: клиент pollToken-оор 3 сек тутам асууна. verify.mn «VERIFIED» гэвэл
// багшийг 1 хоногийн туршилттай үүсгээд нэвтрүүлнэ (замын нэр хуучин клиенттэй нийцүүлэхийн тулд verify-email хэвээр)
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const tok = String(req.body?.pollToken || '');
  if (!/^[a-f0-9]{48}$/.test(tok)) return res.status(400).json({ error: 'Баталгаажуулалт олдсонгүй. Дахин эхлүүлнэ үү.' });

  await initDb();
  const ph = pollHash(tok);
  const v = await getVerificationByPoll(ph);
  if (!v) return res.status(400).json({ error: 'Баталгаажуулалт олдсонгүй. Дахин эхлүүлнэ үү.' });
  if (new Date(v.expires_at) < new Date()) return res.json({ status: 'EXPIRED' });
  const st = await sessionStatus(v.session_id);
  if (!st.ok) { console.error('[verify] verify.mn', st.cls, st.http || ''); return res.json({ status: 'PENDING' }); }   // түр алдаа — дараагийн асуултаар
  if (st.status === 'EXPIRED') return res.json({ status: 'EXPIRED' });
  if (st.status !== 'VERIFIED') return res.json({ status: 'PENDING' });

  // Нэг баталгаажуулалт — нэг бүртгэл: мөрийг устгасан хүсэлт л үргэлжлүүлнэ
  const row = await consumeVerification(ph);
  if (!row) return res.status(400).json({ error: 'Баталгаажуулалт аль хэдийн ашиглагдсан. Нэвтэрнэ үү.' });
  // Хүлээх зуур өөр хэн нэгэн энэ имэйл / дугаараар бүртгүүлсэн бол токен өгөхгүй
  if (await getTeacherByEmail(row.email)) return res.status(400).json({ error: 'Энэ email бүртгэлтэй байна. Нэвтэрнэ үү.' });
  if (await phoneTaken(row.phone)) return res.status(400).json({ error: 'Энэ утасны дугаараар бүртгэл үүссэн байна' });
  const teacher = await createTeacher({ id: genId(), email: row.email, passwordHash: row.password_hash, name: row.name || '', phone: row.phone || '', trialDays: TRIAL_DAYS, phoneVerified: true });

  try {
    const msg = `🎯 ЭЕШ шалгагч\n\n🆕 Шинэ бүртгэл (${TRIAL_DAYS} хоног туршилт)\n\n👤 ${row.name || '—'}\n📧 ${row.email}\n📱 ${row.phone || '—'} ✅ verify.mn`;
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: msg }),
      });
    }
  } catch (e) {}

  res.json({
    ok: true, status: 'VERIFIED',
    token: signToken(teacher.id, teacher.email),
    teacher: { id: teacher.id, email: teacher.email, name: teacher.name, isAdmin: teacher.is_admin, status: teacher.status,
      paidUntil: teacher.paid_until, hasAccess: hasAccess(teacher) },
  });
}
