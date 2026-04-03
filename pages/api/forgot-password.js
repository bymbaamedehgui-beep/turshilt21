import { getTeacherByEmail, initDb } from '../../lib/db';
import { neon } from '@neondatabase/serverless';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email шаардлагатай' });

  await initDb();
  const sql = getDb();

  const teacher = await getTeacherByEmail(email.toLowerCase());
  if (!teacher) return res.status(400).json({ error: 'Энэ email бүртгэлгүй байна' });

  await sql`CREATE TABLE IF NOT EXISTS password_resets (
    email VARCHAR(200) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  const code = genCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await sql`INSERT INTO password_resets (email, code, expires_at)
    VALUES (${email.toLowerCase()}, ${code}, ${expiresAt.toISOString()})
    ON CONFLICT (email) DO UPDATE SET code=${code}, expires_at=${expiresAt.toISOString()}`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+process.env.RESEND_API_KEY},
      body: JSON.stringify({
        from: 'EYESH Checker <noreply@eyeshcheck.com>',
        to: email.toLowerCase(),
        subject: 'EYESH Checker — Нууц үг сэргээх код',
        html: '<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px"><h2 style="color:#dc2626">EYESH Checker</h2><p>Нууц үг сэргээх код:</p><div style="font-size:40px;font-weight:900;letter-spacing:8px;color:#1e293b;background:white;padding:24px;border-radius:10px;text-align:center;margin:20px 0;border:2px solid #e2e8f0">'+code+'</div><p style="color:#64748b;font-size:13px">Код 10 минут хүчинтэй. Хэрэв та хүсэлт илгээгээгүй бол үл тооно уу.</p></div>'
      })
    });
    if (!r.ok) return res.status(500).json({ error: 'Email илгээхэд алдаа гарлаа' });
  } catch(e) { return res.status(500).json({ error: 'Email илгээхэд алдаа: '+e.message }); }

  res.json({ ok: true });
}
