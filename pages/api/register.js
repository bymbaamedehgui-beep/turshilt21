import bcrypt from 'bcryptjs';
import { getTeacherByEmail, initDb } from '../../lib/db';
import { neon } from '@neondatabase/serverless';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password, name, phone } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email болон нууц үг шаардлагатай' });
  if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });

  await initDb();
  const sql = getDb();

  await sql`CREATE TABLE IF NOT EXISTS email_verifications (
    email VARCHAR(200) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(200),
    phone VARCHAR(50),
    password_hash VARCHAR(200),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  const existing = await getTeacherByEmail(email.toLowerCase());
  if (existing) return res.status(400).json({ error: 'Энэ email бүртгэлтэй байна' });

  const passwordHash = await bcrypt.hash(password, 10);
  const code = genCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await sql`INSERT INTO email_verifications (email, code, name, phone, password_hash, expires_at)
    VALUES (${email.toLowerCase()}, ${code}, ${name||''}, ${phone||''}, ${passwordHash}, ${expiresAt.toISOString()})
    ON CONFLICT (email) DO UPDATE SET code=${code}, name=${name||''}, phone=${phone||''}, password_hash=${passwordHash}, expires_at=${expiresAt.toISOString()}`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+process.env.RESEND_API_KEY},
      body: JSON.stringify({
        from: 'EYESH Checker <noreply@eyeshcheck.com>',
        to: email.toLowerCase(),
        subject: 'EYESH Checker — Email баталгаажуулах код',
        html: '<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px"><h2 style="color:#dc2626">EYESH Checker</h2><p>Таны баталгаажуулах код:</p><div style="font-size:40px;font-weight:900;letter-spacing:8px;color:#1e293b;background:#f1f5f9;padding:24px;border-radius:10px;text-align:center;margin:20px 0">'+code+'</div><p style="color:#64748b;font-size:13px">Код 10 минут хүчинтэй.</p></div>'
      })
    });
    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return res.status(500).json({ error: 'Email алдаа: ' + errText });
    }
  } catch(e) { return res.status(500).json({ error: 'Email илгээхэд алдаа: '+e.message }); }

  res.json({ ok: true, needsVerification: true });
}
