import { getAllTeachers, updateTeacherStatus, deleteTeacher, getTeacherById, initDb, extendTeacher, setTeacherPhone } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { normalizePhone, maskPhone } from '../../../lib/verifymn';

export default requireAuth(async function handler(req, res) {
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });

  if (req.method === 'GET') {
    const teachers = await getAllTeachers();
    return res.json(teachers);
  }
  if (req.method === 'PATCH' && req.body?.extendMonths) {
    // Гараар эрх сунгах (бэлэн мөнгө, дансаар гэх мэт)
    const months = parseInt(req.body.extendMonths, 10);
    if (![1, 3, 6, 12].includes(months)) return res.status(400).json({ error: 'Сар буруу' });
    const paidUntil = await extendTeacher(req.body.id, months);
    return paidUntil ? res.json({ ok: true, paidUntil }) : res.status(404).json({ error: 'Багш олдсонгүй' });
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
