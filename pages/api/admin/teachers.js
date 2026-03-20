import { getAllTeachers, updateTeacherStatus, deleteTeacher, getTeacherById, initDb } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });

  if (req.method === 'GET') {
    const teachers = await getAllTeachers();
    return res.json(teachers);
  }
  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    if (!['active','disabled','pending'].includes(status)) return res.status(400).json({ error: 'Буруу статус' });
    if (id === req.teacherId) return res.status(400).json({ error: 'Өөрийнхөө эрхийг өөрчлөх боломжгүй' });
    await updateTeacherStatus(id, status);

    // Notify teacher if approved
    if (status === 'active') {
      const teacher = await getTeacherById(id);
      if (teacher) {
        // Send email notification
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization':`Bearer ${process.env.RESEND_API_KEY}`},
            body: JSON.stringify({
              from: 'EYESH Checker <noreply@eyeshcheck.com>',
              to: teacher.email,
              subject: 'EYESH Checker — Таны эрх нээгдлээ!',
              html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
                  <h2 style="color:#dc2626;margin-bottom:4px">🎯 EYESH Checker</h2>
                  <h3 style="color:#1e293b;margin-top:0">Таны эрх нээгдлээ!</h3>
                  <div style="background:white;border-radius:8px;padding:16px;margin:16px 0">
                    <p style="margin:4px 0">Сайн байна уу, <b>${teacher.name||teacher.email}</b>!</p>
                    <p style="margin:8px 0">Таны бүртгэлийн хүсэлт зөвшөөрөгдлөө. Одоо нэвтэрч болно.</p>
                    <p style="margin:8px 0"><a href="https://eyeshcheck.com" style="color:#dc2626;font-weight:bold">eyeshcheck.com</a> руу орж нэвтрэнэ үү.</p>
                  </div>
                  <p style="color:#64748b;font-size:13px">Асуулт байвал 88449307 дугаарт холбогдоорой.</p>
                </div>
              `
            })
          });
        } catch(e) { console.error('Teacher email failed:', e.message); }

        // Send Telegram to admin with info
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
