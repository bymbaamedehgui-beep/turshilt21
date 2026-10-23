import bcrypt from 'bcryptjs';
import { getTeacherByEmail, initDb, phoneTaken, getVerification, saveVerification } from '../../lib/db';
import { normalizePhone, maskPhone, genCode, hashCode, sendSms, smsConfigured } from '../../lib/sms';

const RESEND_SEC = 60;      // дахин код хүсэх хамгийн бага хугацаа
const MAX_SENDS_DAY = 5;    // нэг имэйлд өдөрт илгээх SMS

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email: rawEmail, password, name, phone } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !password) return res.status(400).json({ error: 'Email болон нууц үг шаардлагатай' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email буруу байна' });
  if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });
  const ph = normalizePhone(phone);
  if (!ph) return res.status(400).json({ error: 'Утасны дугаараа зөв оруулна уу (8 оронтой гар утас)' });
  if (!smsConfigured()) return res.status(503).json({ error: 'SMS илгээх үйлчилгээ түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.' });

  await initDb();
  if (await getTeacherByEmail(email)) return res.status(400).json({ error: 'Энэ email бүртгэлтэй байна. Нэвтэрнэ үү.' });
  // Нэг дугаар — нэг бүртгэл (үнэгүй туршилтыг давтан авахаас сэргийлнэ)
  if (await phoneTaken(ph.local)) return res.status(400).json({ error: 'Энэ утасны дугаараар бүртгэл үүссэн байна' });

  const prev = await getVerification(email);
  if (prev?.sent_at) {
    const ago = (Date.now() - new Date(prev.sent_at).getTime()) / 1000;
    if (ago < RESEND_SEC) return res.status(429).json({ error: `${Math.ceil(RESEND_SEC - ago)} секундын дараа дахин код авна уу`, wait: Math.ceil(RESEND_SEC - ago) });
    if (ago < 86400 && (prev.sends || 0) >= MAX_SENDS_DAY) return res.status(429).json({ error: 'Өнөөдөр хэт олон код хүслээ. Маргааш дахин оролдоно уу.' });
  }

  const code = genCode();
  const sent = await sendSms(ph.e164, `ЭЕШ шалгагч бүртгэлийн код: ${code}. Хэнд ч бүү хэл. 10 мин.`);
  if (!sent.ok) {
    console.error('[register] sms', sent.cls);
    return res.status(503).json({ error: 'SMS илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу.' });
  }
  await saveVerification({ email, codeHash: hashCode(code, email), name, phone: ph.local, passwordHash: await bcrypt.hash(password, 10) });
  res.json({ ok: true, needsVerification: true, masked: maskPhone(ph.local) });
}
