import bcrypt from 'bcryptjs';
import { createTeacher, getTeacherByEmail, initDb } from '../../lib/db';
import { neon } from '@neondatabase/serverless';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email болон нууц үг шаардлагатай' });
  if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });

  await initDb();
  const sql = getDb();

  // Create verifications table if not exists
  await sql`CREATE TABLE IF NOT EXISTS email_verifications (
    email VARCHAR(200) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  const existing = await getTeacherByEmail(email.toLowerCase());
  if (existing && existing.status !== 'verify') {
    return res.status(400).json({ error: 'Энэ email бүртгэлтэй байна' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const code = genCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Upsert teacher with 'verify' status
  if (!existing) {
    await createTeacher({ id: genId(), email: email.toLowerCase(), passwordHash, name: name||'' });
    await sql`UPDATE teachers SET status='verify', password_hash=${passwordHash} WHERE email=${email.toLowerCase()}`;
  } else {
    await sql`UPDATE teachers SET password_hash=${passwordHash}, name=${name||''}, status='verify' WHERE email=${email.toLowerCase()}`;
  }

  // Save verification code
  await sql`INSERT INTO email_verifications (email, code, expires_at) VALUES (${email.toLowerCase()}, ${code}, ${expiresAt.toISOString()})
    ON CONFLICT (email) DO UPDATE SET code=${code}, expires_at=${expiresAt.toISOString()}`;

  // Send email via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'EYESH Checker <onboarding@resend.dev>',
      to: email.toLowerCase(),
      subject: 'EYESH Checker — Email баталгаажуулах код',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
          <h2 style="color:#dc2626;margin-bottom:8px">🎯 EYESH Checker</h2>
          <p style="color:#374151">Таны баталгаажуулах код:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#1e293b;background:white;padding:20px;border-radius:8px;text-align:center;margin:16px 0">${code}</div>
          <p style="color:#64748b;font-size:13px">Код 10 минутын дотор хүчинтэй.<br>Хэрэв та бүртгүүлээгүй бол энэ имэйлийг үл тооно уу.</p>
        </div>
      `
    })
  });

  if (!emailRes.ok) {
    const err = await emailRes.json();
    return res.status(500).json({ error: 'Email илгээхэд алдаа гарлаа: ' + (err.message||'') });
  }

  res.json({ ok: true, needsVerification: true });
}
