import bcrypt from 'bcryptjs';
import { createTeacher, getTeacherByEmail, initDb } from '../../lib/db';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email болон нууц үг шаардлагатай' });
  if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });
  await initDb();
  const existing = await getTeacherByEmail(email.toLowerCase());
  if (existing) return res.status(400).json({ error: 'Энэ email бүртгэлтэй байна' });
  const passwordHash = await bcrypt.hash(password, 10);
  const teacher = await createTeacher({ id: genId(), email: email.toLowerCase(), passwordHash, name: name||'' });

  // Notify admin via email
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'EYESH Checker <onboarding@resend.dev>',
        to: 'bymbaamedehgui@gmail.com',
        subject: 'EYESH Checker — Шинэ бүртгэлийн хүсэлт',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <h2 style="color:#dc2626;margin-bottom:4px">🎯 EYESH Checker</h2>
            <h3 style="color:#1e293b;margin-top:0">Шинэ бүртгэлийн хүсэлт</h3>
            <div style="background:white;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:4px 0"><b>Нэр:</b> ${name||'—'}</p>
              <p style="margin:4px 0"><b>Email:</b> ${email.toLowerCase()}</p>
              <p style="margin:4px 0"><b>Огноо:</b> ${new Date().toLocaleString('mn-MN')}</p>
            </div>
            <p style="color:#64748b;font-size:13px">Admin панелд орж зөвшөөрөх эсвэл татгалзана уу.</p>
          </div>
        `
      })
    });
  } catch(e) {
    // Email fail should not block registration
    console.error('Admin email failed:', e.message);
  }

  res.json({ ok: true, status: teacher.status, isAdmin: teacher.is_admin });
}
