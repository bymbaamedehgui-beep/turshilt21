import { getTeacherByEmail, initDb, bumpPhoneQuota, ensurePasswordResets, getPasswordReset, savePasswordReset } from '../../lib/db';
import { normalizePhone, maskPhone, genCode, newPollToken, pollHash, createSession, verifyConfigured, TTL_SEC } from '../../lib/verifymn';

// Нууц үг сэргээх — бүртгэлтэй утсаар (verify.mn, имэйл илгээхгүй): хэрэглэгч дэлгэц дээрх кодыг бүртгэлтэй утаснаасаа
// 144773 руу SMS-ээр илгээнэ. Дараа нь /api/reset-password {pollToken} — төлөв, {pollToken, password} — нууц үг солих.
const RESEND_SEC = 20;      // шинэ код хүсэх хамгийн бага завсар
const MAX_PER_DAY = 10;     // нэг имэйл, нэг дугаарт өдөрт
const UNAVAILABLE = 'Утас баталгаажуулах үйлчилгээ түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email шаардлагатай' });
  if (!verifyConfigured()) return res.status(503).json({ error: UNAVAILABLE });

  await initDb();
  await ensurePasswordResets();
  const teacher = await getTeacherByEmail(email);
  if (!teacher) return res.status(400).json({ error: 'Энэ email бүртгэлгүй байна' });
  if (teacher.status === 'disabled') return res.status(403).json({ error: 'Таны эрх хаагдсан байна. Admin-тай холбогдоно уу.' });
  const ph = normalizePhone(teacher.phone);
  if (!ph) return res.status(400).json({ error: 'Энэ бүртгэлд утасны дугаар бүртгэгдээгүй тул нууц үгийг сэргээх боломжгүй. Admin-тай холбогдоно уу: 88449307' });

  const prev = await getPasswordReset(email);
  if (prev?.sent_at) {
    const ago = (Date.now() - new Date(prev.sent_at).getTime()) / 1000;
    if (ago < RESEND_SEC) return res.status(429).json({ error: `${Math.ceil(RESEND_SEC - ago)} секундын дараа дахин оролдоно уу`, wait: Math.ceil(RESEND_SEC - ago) });
    if (ago < 86400 && (prev.sends || 0) >= MAX_PER_DAY) return res.status(429).json({ error: 'Өнөөдөр хэт олон оролдлого хийлээ. Маргааш дахин оролдоно уу.' });
  }
  if (await bumpPhoneQuota(ph.local) > MAX_PER_DAY) return res.status(429).json({ error: 'Энэ дугаараар өнөөдөр хэт олон оролдлого хийлээ. Маргааш дахин оролдоно уу.' });

  const code = genCode();
  const s = await createSession(ph.local, code);
  if (!s.ok) {
    console.error('[forgot] verify.mn', s.cls, s.http || '');
    return res.status(503).json({ error: UNAVAILABLE });
  }
  const token = newPollToken();
  const exp = s.expiresAt ? Date.parse(s.expiresAt) : NaN;
  const expiresAt = new Date(Number.isFinite(exp) ? exp : Date.now() + TTL_SEC * 1000).toISOString();
  await savePasswordReset({ email, sessionId: s.sessionId, pollHash: pollHash(token), expiresAt });
  res.json({ ok: true, moText: code, shortcode: s.shortcode, pollToken: token, expiresAt, masked: maskPhone(ph.local) });
}
