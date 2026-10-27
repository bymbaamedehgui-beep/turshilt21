import bcrypt from 'bcryptjs';
import { initDb, ensurePasswordResets, getPasswordResetByPoll, markPasswordResetVerified, consumePasswordReset, setTeacherPassword } from '../../lib/db';
import { pollHash, sessionStatus } from '../../lib/verifymn';

// Нууц үг сэргээх (forgot-password-ийн дараа, verify.mn):
//   {pollToken}           → { status: 'PENDING' | 'VERIFIED' | 'EXPIRED' } — клиент 3 сек тутам асууна
//   {pollToken, password} → утас баталгаажсан бол (10 минутын дотор) нууц үгийг солино, нэг удаа
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const tok = String(req.body?.pollToken || '');
  if (!/^[a-f0-9]{48}$/.test(tok)) return res.status(400).json({ error: 'Сэргээх хүсэлт олдсонгүй. Дахин эхлүүлнэ үү.' });
  const password = req.body?.password;

  await initDb();
  await ensurePasswordResets();
  const ph = pollHash(tok);
  const row = await getPasswordResetByPoll(ph);
  if (!row) return res.status(400).json({ error: 'Сэргээх хүсэлт олдсонгүй. Дахин эхлүүлнэ үү.' });
  if (new Date(row.expires_at) < new Date()) return res.json({ status: 'EXPIRED' });
  if (!row.verified) {
    const st = await sessionStatus(row.session_id);
    if (!st.ok) { console.error('[reset] verify.mn', st.cls, st.http || ''); return res.json({ status: 'PENDING' }); }   // түр алдаа — дараагийн асуултаар
    if (st.status === 'EXPIRED') return res.json({ status: 'EXPIRED' });
    if (st.status !== 'VERIFIED') return res.json({ status: 'PENDING' });
    await markPasswordResetVerified(ph);
  }
  if (password == null || password === '') return res.json({ status: 'VERIFIED' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });
  if (String(password).length > 200) return res.status(400).json({ error: 'Нууц үг хэт урт байна' });
  const done = await consumePasswordReset(ph);
  if (!done) return res.status(400).json({ error: 'Хугацаа дууссан эсвэл аль хэдийн ашиглагдсан. Дахин эхлүүлнэ үү.' });
  await setTeacherPassword(done.email, await bcrypt.hash(String(password), 10));
  res.json({ ok: true });
}
