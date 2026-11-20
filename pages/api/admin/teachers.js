import bcrypt from 'bcryptjs';
import { getAllTeachers, updateTeacherStatus, deleteTeacher, getTeacherById, initDb, extendTeacher, setTeacherPhone, getTeacherByEmail, createTeacher, phoneTaken } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { normalizePhone, maskPhone } from '../../../lib/verifymn';
import { normSubjects, TRIAL_DAYS } from '../../../lib/plans';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export default requireAuth(async function handler(req, res) {
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });

  if (req.method === 'GET') {
    const teachers = await getAllTeachers();
    return res.json(teachers);
  }
  if (req.method === 'POST') {
    // Admin багш нэмэх (чатаар асуусан хүнд): SMS баталгаажуулалтгүй — admin тухайн хүнтэй ярьж баталгаажуулсан.
    // Энгийн бүртгэлтэй адил TRIAL_DAYS туршилт, 24 цагийн урамшуулалтай. Нууц үг хоосон бол утасны дугаар.
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim().slice(0, 200);
    const ph = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || '') || (ph ? ph.local : '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return res.status(400).json({ error: 'Имэйл буруу байна' });
    if (!ph) return res.status(400).json({ error: 'Утасны дугаар буруу байна — 8 оронтой гар утас' });
    if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });
    if (await getTeacherByEmail(email)) return res.status(409).json({ error: 'Энэ имэйл бүртгэлтэй байна' });
    if (await phoneTaken(ph.local)) return res.status(409).json({ error: 'Энэ утасны дугаараар бүртгэл үүссэн байна' });
    const t = await createTeacher({ id: genId(), email, passwordHash: await bcrypt.hash(password, 10), name, phone: ph.local, trialDays: TRIAL_DAYS, phoneVerified: true });
    try {
      const msg = `🆕 Admin бүртгэл үүсгэв (${TRIAL_DAYS} хоног туршилт)\n\n👤 ${name || '—'}\n📧 ${email}\n📱 ${maskPhone(ph.local)}`;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({chat_id: process.env.TELEGRAM_CHAT_ID, text: msg})
      });
    } catch(e) {}
    return res.status(201).json({ ok: true, teacher: { id: t.id, email: t.email, name: t.name, phone: t.phone } });
  }
  if (req.method === 'PATCH' && req.body?.extendMonths) {
    // Гараар эрх сунгах (бэлэн мөнгө, дансаар гэх мэт): subject — тэр хичээлийн эрх; '*' — бүх хичээл (хуучин багц шиг)
    const months = parseInt(req.body.extendMonths, 10);
    if (![1, 3, 6, 12].includes(months)) return res.status(400).json({ error: 'Сар буруу' });
    const all = req.body.subject === '*';
    const [subject] = all ? [null] : normSubjects([req.body.subject]);
    if (!all && !subject) return res.status(400).json({ error: 'Хичээл сонгоно уу' });
    const paidUntil = await extendTeacher(req.body.id, months, subject);
    return paidUntil ? res.json({ ok: true, paidUntil, subject: subject || '*' }) : res.status(404).json({ error: 'Багш олдсонгүй' });
  }
  if (req.method === 'PATCH' && req.body && 'phone' in req.body) {
    // Утас солих/арилгах — admin тухайн хүнтэй тэр дугаараар ярьж баталгаажуулсны дараа (баталгаажсан гэж тэмдэглэнэ).
    // «Нууц үгээ мартсан»-ы SMS код энэ дугаар руу очно. Өөрийн (admin) дансных ч болно.
    const raw = String(req.body.phone || '').trim();
    const ph = raw ? normalizePhone(raw) : { local: '' };
    if (!ph) return res.status(400).json({ error: 'Утасны дугаар буруу байна — 8 оронтой гар утас' });
    const r = await setTeacherPhone(req.body.id, ph.local);
    if (!r) return res.status(404).json({ error: 'Багш олдсонгүй' });
    if (r.taken) return res.status(409).json({ error: 'Энэ дугаар өөр багшийн бүртгэлд байна' });
    try {
      const t = r.teacher;
      const msg = `📱 Утас ${t.phone ? 'солигдлоо' : 'арилгагдлаа'} (admin)\n\n👤 ${t.name||'—'}\n📧 ${t.email}\n📱 ${t.phone ? maskPhone(t.phone) : '—'}`;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({chat_id: process.env.TELEGRAM_CHAT_ID, text: msg})
      });
    } catch(e) {}
    return res.json({ ok: true, phone: r.teacher.phone, phoneVerified: r.teacher.phone_verified });
  }
  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    if (!['active','disabled','pending'].includes(status)) return res.status(400).json({ error: 'Буруу статус' });
    if (id === req.teacherId) return res.status(400).json({ error: 'Өөрийнхөө эрхийг өөрчлөх боломжгүй' });
    await updateTeacherStatus(id, status);

    // Эрх нээгдвэл админд Telegram-аар мэдэгдэнэ (багшид имэйл илгээхгүй — Resend ашиглахаа больсон)
    if (status === 'active') {
      const teacher = await getTeacherById(id);
      if (teacher) {
        try {
          const msg = `✅ Эрх нээгдлээ\n\n👤 ${teacher.name||'—'}\n📧 ${teacher.email}\n📱 ${teacher.phone||'—'}`;
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({chat_id: process.env.TELEGRAM_CHAT_ID, text: msg})
          });
        } catch(e) {}
      }
    }

    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (id === req.teacherId) return res.status(400).json({ error: 'Өөрийгөө устгах боломжгүй' });
    await deleteTeacher(id);
    return res.json({ ok: true });
  }
  res.status(405).end();
});
