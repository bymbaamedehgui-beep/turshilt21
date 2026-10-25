import bcrypt from 'bcryptjs';
import { getTeacherByEmail, initDb, phoneTaken, getVerification, saveVerification, bumpPhoneQuota } from '../../lib/db';
import { normalizePhone, maskPhone, genCode, newPollToken, pollHash, createSession, verifyConfigured, TTL_SEC } from '../../lib/verifymn';

// Бүртгэл: утсыг verify.mn-ээр баталгаажуулна — хэрэглэгч дэлгэц дээрх кодыг өөрийн утаснаас 144773 руу илгээнэ.
// Код нь нууц биш (дэлгэцэнд гарна): баталгаа нь «тэр дугаараас ирсэн» гэсэн verify.mn-ийн хариу.
const RESEND_SEC = 20;      // шинэ код хүсэх хамгийн бага завсар
const MAX_PER_DAY = 10;     // нэг имэйл, нэг дугаарт өдөрт
const UNAVAILABLE = 'Утас баталгаажуулах үйлчилгээ түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email: rawEmail, password, name, phone } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !password) return res.status(400).json({ error: 'Email болон нууц үг шаардлагатай' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email буруу байна' });
  if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });
  const ph = normalizePhone(phone);
  if (!ph) return res.status(400).json({ error: 'Утасны дугаараа зөв оруулна уу (8 оронтой гар утас)' });
  if (!verifyConfigured()) return res.status(503).json({ error: UNAVAILABLE });

  await initDb();
  if (await getTeacherByEmail(email)) return res.status(400).json({ error: 'Энэ email бүртгэлтэй байна. Нэвтэрнэ үү.' });
  // Нэг дугаар — нэг бүртгэл (үнэгүй туршилтыг давтан авахаас сэргийлнэ)
  if (await phoneTaken(ph.local)) return res.status(400).json({ error: 'Энэ утасны дугаараар бүртгэл үүссэн байна' });

  const prev = await getVerification(email);
  if (prev?.sent_at) {
    const ago = (Date.now() - new Date(prev.sent_at).getTime()) / 1000;
    if (ago < RESEND_SEC) return res.status(429).json({ error: `${Math.ceil(RESEND_SEC - ago)} секундын дараа дахин оролдоно уу`, wait: Math.ceil(RESEND_SEC - ago) });
    if (ago < 86400 && (prev.sends || 0) >= MAX_PER_DAY) return res.status(429).json({ error: 'Өнөөдөр хэт олон оролдлого хийлээ. Маргааш дахин оролдоно уу.' });
  }
  if (await bumpPhoneQuota(ph.local) > MAX_PER_DAY) return res.status(429).json({ error: 'Энэ дугаараар өнөөдөр хэт олон оролдлого хийлээ. Маргааш дахин оролдоно уу.' });

  const code = genCode();
  const s = await createSession(ph.local, code);
  if (!s.ok) {
    console.error('[register] verify.mn', s.cls, s.http || '');
    return res.status(503).json({ error: UNAVAILABLE });
  }
  const token = newPollToken();
  const exp = s.expiresAt ? Date.parse(s.expiresAt) : NaN;
  const expiresAt = new Date(Number.isFinite(exp) ? exp : Date.now() + TTL_SEC * 1000).toISOString();
  await saveVerification({ email, name, phone: ph.local, passwordHash: await bcrypt.hash(password, 10), sessionId: s.sessionId, pollHash: pollHash(token), expiresAt });
  res.json({ ok: true, moText: code, shortcode: s.shortcode, pollToken: token, expiresAt, masked: maskPhone(ph.local) });
}
