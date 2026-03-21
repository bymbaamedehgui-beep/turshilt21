import { initDb, getTeacherByEmail, createTeacher } from '../../lib/db';
import { neon } from '@neondatabase/serverless';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'Мэдээлэл дутуу' });

  await initDb();
  const sql = getDb();

  const rows = await sql`SELECT * FROM email_verifications WHERE email=${email.toLowerCase()} AND code=${code.trim()} AND expires_at > NOW()`;
  if (!rows[0]) return res.status(400).json({ error: 'Код буруу эсвэл хугацаа дууссан' });

  const v = rows[0];

  // Check if teacher already exists
  const existing = await getTeacherByEmail(email.toLowerCase());
  if (!existing) {
    // Check if first user
    const count = await sql`SELECT COUNT(*) as c FROM teachers`;
    const isFirst = parseInt(count[0].c) === 0;
    await createTeacher({
      id: genId(),
      email: email.toLowerCase(),
      passwordHash: v.password_hash,
      name: v.name||'',
      phone: v.phone||''
    });
    if (isFirst) {
      await sql`DELETE FROM email_verifications WHERE email=${email.toLowerCase()}`;
      return res.json({ ok: true, isAdmin: true });
    }
  }

  await sql`DELETE FROM email_verifications WHERE email=${email.toLowerCase()}`;

  // Notify admin
  try {
    const msg = `🎯 EYESH Checker\n\n📋 Шинэ бүртгэлийн хүсэлт\n\n👤 Нэр: ${v.name||'—'}\n📧 Email: ${email.toLowerCase()}\n📱 Утас: ${v.phone||'—'}\n✅ Email баталгаажсан`;
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({chat_id: process.env.TELEGRAM_CHAT_ID, text: msg})
    });
  } catch(e) {}

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':`Bearer ${process.env.RESEND_API_KEY}`},
      body: JSON.stringify({
        from: 'EYESH Checker <noreply@eyeshcheck.com>',
        to: 'bymbaamedehgui@gmail.com',
        subject: 'EYESH Checker — Шинэ бүртгэлийн хүсэлт (email баталгаажсан)',
        html: `<div style="font-family:Arial,sans-serif;padding:24px">
          <h2 style="color:#dc2626">🎯 EYESH Checker</h2>
          <p><b>Нэр:</b> ${v.name||'—'}</p>
          <p><b>Email:</b> ${email.toLowerCase()}</p>
          <p><b>Утас:</b> ${v.phone||'—'}</p>
          <p style="color:#16a34a">✅ Email баталгаажсан</p>
        </div>`
      })
    });
  } catch(e) {}

  res.json({ ok: true, isAdmin: false });
}
