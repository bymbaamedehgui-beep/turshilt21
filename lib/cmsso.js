// Дасгалын төв (cyber-math.com)-ийн бүртгэлээр нэвтэрч, ЭЕШ-ийн хувилбарын шалгалтыг шууд үүсгэх.
// pages/api/cm/sso.js ба pages/api/cm/link.js хуваалцана.
// Урсгал: cyber-math.com-ийн ЭЕШ хуудас («ЭЕШ шалгагч» товч, eyesh-link.js) → form POST {code} → /api/cm/sso →
//   cyber-math.com/api/eyesh?action=redeem (сервер-сервер; код нэг удаа, 2 минут) → { email, name, paidUntil, exam } →
//   багш олох/үүсгэх → шалгалт (cm_ref-ээр давхардуулахгүй) → JWT → localStorage → /?exam=<id>.
// Аюулгүй байдал: Дасгалын төвийн бүртгэл имэйлийн эзэмшлийг батлахгүй (SMS) тул энэ имэйлтэй, өмнө нь бүртгэлтэй багшийн
// данс руу (cm_linked биш) ЗӨВХӨН түүний нууц үгээр нэг удаа холбоно. Нууц үгээ имэйлээр сэргээвэл (reset-password) холбоос тасарна.
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { signToken } from './auth';
import { hasAccess, accessUntil } from './db';

const CM_API = process.env.CM_API_URL || 'https://cyber-math.com/api/eyesh';
export const CM_ORIGINS = (process.env.CM_ORIGINS || 'https://cyber-math.com,https://www.cyber-math.com')
  .split(',').map(s => s.trim()).filter(Boolean);
export const DEMO_EMAIL = 'demo@eyeshcheck.com';
export const LINK_MAX_TRIES = 5;
const LINK_TTL_MIN = 15;
const CODE_RE = /^[A-Za-z0-9_-]{43}$/;

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
function randToken() { return crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
export function isCode(c) { return typeof c === 'string' && CODE_RE.test(c); }
export function normEmail(e) {
  const s = String(e || '').trim().toLowerCase();
  return s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}
export function validDate(d) { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toISOString() : null; }

// Хүсэлт зөвшөөрөгдсөн эх сурвалжаас ирсэн эсэх (Origin, байхгүй бол Referer). Өөр сайт кодоо хөтчөөр
// илгээж хүнийг өөрийн данс руу нэвтрүүлэхээс (login CSRF) сэргийлнэ.
export function originOk(req, allowed) {
  const o = req.headers.origin;
  if (o && o !== 'null') return allowed.indexOf(o) >= 0;
  const r = String(req.headers.referer || '');
  return allowed.some(a => r === a || r.indexOf(a + '/') === 0);
}
export function selfOrigins(req) {
  const h = String(req.headers.host || '');
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h) ? ['http://' + h] : ['https://' + h];
}

// cyber-math.com-оос кодыг зарцуулна → { email, name, paidUntil, exam } | null (код хүчингүй). Сүлжээ/сервер алдаа → throw.
export async function redeem(code) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(CM_API + '?action=redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), signal: ac.signal,
    });
    if (r.status === 404) return null;
    const d = await r.json().catch(() => null);
    if (!r.ok || !d || !d.ok) throw new Error('redeem HTTP ' + r.status);
    return d;
  } finally { clearTimeout(timer); }
}

// cyber-math.com-ийн шалгалтыг дахин шалгана (api/_eyesh.js normExam-ийн гаралт). Буруу бол null.
const SUBS = ['2.1', '2.2', '2.3', '2.4'], ROWS = 'abcdefgh'.split('');
const TOPICS = ['Алгебр', 'Геометр', 'Тригонометр', 'Статистик', 'Тооны онол', 'Анализ', 'Функц', 'Бусад'];
const num = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
export function normExam(x) {
  if (!x || typeof x !== 'object') return null;
  const ref = String(x.ref || ''), n = x.sec1Count;
  if (!/^eesh\d{4}:[0-9a-f]{20}$/.test(ref) || !Number.isInteger(n) || n < 1 || n > 60) return null;
  const key = x.sec1Key, sc = x.sec1Scores, tp = x.topics;
  if (!Array.isArray(key) || key.length !== n || !key.every(k => /^[A-E]$/.test(k))) return null;
  if (!Array.isArray(sc) || sc.length !== n || !sc.every(s => num(s, 0, 10))) return null;
  if (!Array.isArray(tp) || tp.length !== n || !tp.every(t => TOPICS.indexOf(t) >= 0)) return null;
  const title = String(x.title || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  if (!title) return null;
  const useSec2 = x.useSec2 === true, sec2Config = {};
  if (useSec2) {
    const c = x.sec2Config;
    if (!c || typeof c !== 'object') return null;
    for (const s of SUBS) {
      const cs = c[s];
      if (!cs || typeof cs !== 'object') return null;
      const o = { _enabled: cs._enabled === true };
      for (const r of ROWS) {
        const v = cs[r];
        if (!v || typeof v !== 'object' || !/^[0-9.\-]?$/.test(String(v.ans)) || !num(v.score, 0, 10)) return null;
        o[r] = { ans: String(v.ans), score: v.score };
      }
      sec2Config[s] = o;
    }
  }
  return { ref, title, subject: 'Математик', sec1Count: n, sec1Key: key.slice(), sec1Scores: sc.slice(), topics: tp.slice(),
           useSec2, sec2Config, sec2Score: 1 };
}

// ── Багш ──────────────────────────────────────────────────
// Шинэ багш (энэ имэйлтэй бүртгэл байхгүй): нууц үг нь санамсаргүй (ашиглагдахгүй) — шууд нэвтрэхийг хүсвэл «Нууц үг мартсан»-аар
// имэйлээ баталгаажуулж тавина. Admin биш, туршилтгүй; эрх нь Дасгалын төвийн төлбөрөөс (cm_paid_until).
// paid_until = NOW() (дууссан), NULL БИШ: initDb хүсэлт бүрт paid_until IS NULL идэвхтэй багшид 30 хоног өгдөг (хуучин багш нарын шилжүүлэг).
export async function createCmTeacher({ email, name, paidUntil }) {
  const sql = getDb();
  const id = 'cm' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
  const hash = await bcrypt.hash(randToken(), 10);
  try {
    const rows = await sql`
      INSERT INTO teachers (id, email, password_hash, name, phone, status, is_admin, paid_until, phone_verified, cm_linked, cm_paid_until)
      VALUES (${id}, ${email}, ${hash}, ${String(name || '').slice(0, 200) || email.split('@')[0]}, '', 'active', false, NOW(), false, true, ${paidUntil})
      RETURNING *`;
    return rows[0];
  } catch (e) {
    if (e && e.code === '23505') return null;   // зэрэг хүсэлт аль хэдийн үүсгэсэн — дуудагч дахин уншина
    throw e;
  }
}
// Нэвтрэх бүрт Дасгалын төвийн эрхийг шинэчилнэ; link=true — нууц үгээр холбосон
export async function syncCm(id, paidUntil, link) {
  const sql = getDb();
  const rows = link
    ? await sql`UPDATE teachers SET cm_paid_until=${paidUntil}, cm_linked=true WHERE id=${id} RETURNING *`
    : await sql`UPDATE teachers SET cm_paid_until=${paidUntil} WHERE id=${id} RETURNING *`;
  return rows[0] || null;
}

// ── Шалгалт (ижил хариутай шалгалтыг дахин үүсгэхгүй — exams_cm_ref индекс) ──
export async function upsertCmExam(teacherId, ex) {
  const sql = getDb();
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await sql`
    INSERT INTO exams (id, teacher_id, title, subject, sec1_count, sec1_key, sec1_scores, topics, use_sec2, sec2_config, sec2_score, created_at, cm_ref)
    VALUES (${id}, ${teacherId}, ${ex.title}, ${ex.subject}, ${ex.sec1Count}, ${JSON.stringify(ex.sec1Key)}, ${JSON.stringify(ex.sec1Scores)},
      ${JSON.stringify(ex.topics)}, ${ex.useSec2}, ${JSON.stringify(ex.sec2Config)}, ${ex.sec2Score}, ${new Date().toISOString()}, ${ex.ref})
    ON CONFLICT (teacher_id, cm_ref) WHERE cm_ref IS NOT NULL DO NOTHING`;
  const rows = await sql`SELECT id FROM exams WHERE teacher_id=${teacherId} AND cm_ref=${ex.ref} LIMIT 1`;
  return rows[0] ? rows[0].id : null;
}

// ── Нууц үгээр холбохыг хүлээж буй нэвтрэлт (redeem хийсэн кодын мэдээлэл LINK_TTL_MIN минут) ──
async function ensurePending(sql) {
  await sql`CREATE TABLE IF NOT EXISTS cm_link_pending (
    token_hash VARCHAR(64) PRIMARY KEY,
    email VARCHAR(200) NOT NULL,
    name VARCHAR(200),
    cm_paid_until TIMESTAMPTZ,
    exam JSONB,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
  )`;
  // Имэйлээр баталгаажуулах код (нууц үгээ санахгүй багш): code_hash = sha256(token_hash|код), LINK_CODE_TTL_MIN
  await sql`ALTER TABLE cm_link_pending ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64), ADD COLUMN IF NOT EXISTS code_sent_at TIMESTAMPTZ`;
  // Имэйл тутмын хязгаар (24 цаг): 'send' — код илгээсэн, 'fail' — буруу нууц үг/код
  await sql`CREATE TABLE IF NOT EXISTS cm_link_log (email VARCHAR(200) NOT NULL, kind VARCHAR(10) NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE INDEX IF NOT EXISTS cm_link_log_email ON cm_link_log (email, at)`;
}
export const LINK_CODE_TTL_MIN = 15, LINK_CODE_COOLDOWN_SEC = 60, LINK_CODE_DAY = 5, LINK_FAIL_DAY = 20;
export async function linkLog(email, kind) {
  const sql = getDb();
  await sql`INSERT INTO cm_link_log (email, kind) VALUES (${email}, ${kind})`;
}
export async function linkCount(email, kind) {
  const sql = getDb();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM cm_link_log WHERE email=${email} AND kind=${kind} AND at > NOW() - interval '1 day'`;
  return rows[0] ? rows[0].n : 0;
}
function codeHash(tokenHash, code) { return sha256(tokenHash + '|' + code); }
export async function pendingSetCode(token, code) {
  const sql = getDb(), th = sha256(token);
  await sql`UPDATE cm_link_pending SET code_hash=${codeHash(th, code)}, code_sent_at=NOW() WHERE token_hash=${th}`;
}
// p — pendingGet-ийн мөр. 6 оронтой, хугацаандаа, хэш таарвал true (тогтмол хугацаат харьцуулалт)
export function codeOk(p, code) {
  const c = String(code || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(c) || !p || !p.code_hash || !p.code_sent_at) return false;
  if (Date.now() - new Date(p.code_sent_at).getTime() > LINK_CODE_TTL_MIN * 60000) return false;
  const a = Buffer.from(codeHash(p.token_hash, c)), b = Buffer.from(String(p.code_hash));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function newLinkCode() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
// Код имэйлээр (Resend — forgot-password-тэй ижил илгээгч). Амжилттай бол true
export async function sendLinkCode(email, code) {
  if (!process.env.RESEND_API_KEY) { console.error('[cm/link] RESEND_API_KEY тохируулаагүй'); return false; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({
        from: 'EYESH Checker <noreply@eyeshcheck.com>',
        to: email,
        subject: 'ЭЕШ шалгагч — Дасгалын төвтэй холбох код',
        html: '<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#faf8ff;border-radius:12px">'
          + '<h2 style="color:#7B52EE">ЭЕШ шалгагч</h2><p>Дасгалын төв (cyber-math.com)-ийн бүртгэлтэйгээ холбох код:</p>'
          + '<div style="font-size:40px;font-weight:900;letter-spacing:8px;color:#1a1030;background:white;padding:24px;border-radius:10px;text-align:center;margin:20px 0;border:2px solid #e7ddff">' + code + '</div>'
          + '<p style="color:#7c7596;font-size:13px">Код ' + LINK_CODE_TTL_MIN + ' минут хүчинтэй. Хэрэв та хүсэлт илгээгээгүй бол үл тооно уу — кодгүйгээр таны бүртгэлд хэн ч нэвтрэхгүй.</p></div>',
      }),
    });
    if (!r.ok) console.error('[cm/link] email HTTP', r.status);
    return r.ok;
  } catch (e) { console.error('[cm/link] email', e.message); return false; }
}
export async function pendingSave({ email, name, paidUntil, exam }) {
  const sql = getDb();
  await ensurePending(sql);
  await sql`DELETE FROM cm_link_pending WHERE expires_at < NOW()`;
  await sql`DELETE FROM cm_link_log WHERE at < NOW() - interval '2 days'`;
  const token = randToken();
  await sql`INSERT INTO cm_link_pending (token_hash, email, name, cm_paid_until, exam, expires_at)
    VALUES (${sha256(token)}, ${email}, ${String(name || '').slice(0, 200)}, ${paidUntil}, ${exam ? JSON.stringify(exam) : null},
      NOW() + make_interval(mins => ${LINK_TTL_MIN}::int))`;
  return token;
}
export async function pendingGet(token) {
  const sql = getDb();
  await ensurePending(sql);
  const rows = await sql`SELECT * FROM cm_link_pending WHERE token_hash=${sha256(token)} AND expires_at > NOW()
    AND attempts < ${LINK_MAX_TRIES}`;
  return rows[0] || null;
}
// Буруу нууц үг → оролдлогын тоо (LINK_MAX_TRIES хүрвэл мөр устна)
export async function pendingFail(token) {
  const sql = getDb();
  const rows = await sql`UPDATE cm_link_pending SET attempts = attempts + 1 WHERE token_hash=${sha256(token)} RETURNING attempts`;
  const n = rows[0] ? rows[0].attempts : LINK_MAX_TRIES;
  if (n >= LINK_MAX_TRIES) await sql`DELETE FROM cm_link_pending WHERE token_hash=${sha256(token)}`;
  return n;
}
export async function pendingDel(token) {
  const sql = getDb();
  const rows = await sql`DELETE FROM cm_link_pending WHERE token_hash=${sha256(token)} RETURNING token_hash`;
  return rows.length > 0;
}

// ── HTML хуудсууд ─────────────────────────────────────────
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = `*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:18px;
background:#f6f4fd;font-family:Nunito,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1c1f2a}
.c{width:100%;max-width:420px;background:#fff;border-radius:20px;padding:26px 22px;box-shadow:0 20px 50px -25px rgba(60,30,150,.45);text-align:center}
.lg{width:52px;height:52px;margin:0 auto 12px;border-radius:15px;background:linear-gradient(135deg,#7B52EE,#A855F7);display:grid;place-items:center;color:#fff}
h1{font-size:19px;margin:0 0 8px}p{font-size:14.5px;line-height:1.55;color:#4a4466;margin:0 0 14px}
.b{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;border:0;border-radius:14px;cursor:pointer;
background:linear-gradient(135deg,#7B52EE,#A855F7);color:#fff;font:inherit;font-weight:800;font-size:15px;text-decoration:none;margin-top:6px}
.b.s{background:#f1edff;color:#5B3BD9}
input[type=password],input[type=text]{width:100%;height:46px;border:2px solid #e5e7eb;border-radius:12px;padding:0 14px;font:inherit;font-size:15px;margin:0 0 8px}
input[type=password]:focus,input[type=text]:focus{outline:none;border-color:#A78BFA}.er{color:#b91c1c;font-weight:700;font-size:13.5px;margin:0 0 10px}
input.code{height:54px;text-align:center;letter-spacing:10px;font-size:24px;font-weight:800}
.ok{color:#15803d;font-weight:700;font-size:13.5px;margin:0 0 10px}.or{font-size:13px;color:#7c7596;margin:18px 0 8px}
.lnk{background:none;border:0;color:#5B3BD9;font:inherit;font-weight:800;font-size:13px;cursor:pointer;text-decoration:underline;margin-top:12px}
.sm{font-size:13px;color:#7c7596;margin-top:12px}.sm a{color:#5B3BD9;font-weight:800}
.sp{width:34px;height:34px;margin:6px auto 14px;border:4px solid #e7ddff;border-top-color:#7B52EE;border-radius:50%;animation:r .8s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}`;
const LOGO = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="18" rx="2.5"/><path d="M9 3.5h6v3H9z"/><path d="m9 13.5 2 2 4-4.5"/></svg>';
function send(res, status, inner, nonce) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  // same-origin (no-referrer БИШ): no-referrer үед хөтөч нууц үгийн маягтын POST-д «Origin: null» илгээж /api/cm/link-ийн
  // Origin шалгалт унана. same-origin нь өөр сайт руу referrer явуулахгүй хэвээр.
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
    + (nonce ? "; script-src 'nonce-" + nonce + "'" : ''));
  res.status(status).send('<!doctype html><html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex"><title>ЭЕШ шалгагч</title><style>' + CSS + '</style></head><body><div class="c"><div class="lg">' + LOGO + '</div>'
    + inner + '</div></body></html>');
}
export function errPage(res, status, msg) {
  send(res, status, '<h1>Нэвтэрч чадсангүй</h1><p>' + esc(msg) + '</p><a class="b" href="https://cyber-math.com/worksheets">Дасгалын төв рүү буцах</a>'
    + '<a class="b s" href="/">eyeshcheck.com нээх</a>');
}
function mask(email) {
  const [u, d] = String(email).split('@');
  return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '*'.repeat(Math.min(6, u.length - 2))) + '@' + d;
}
// mode 'code' — имэйлээр ирсэн кодыг оруулах; бусад үед эхний хуудас (имэйл рүү код авах эсвэл eyeshcheck-ийн нууц үг)
export function linkPage(res, { email, token, error, left, mode, info }) {
  const tok = '<input type="hidden" name="token" value="' + esc(token) + '">';
  const act = (a) => '<input type="hidden" name="act" value="' + a + '">';
  const msgs = (info ? '<div class="ok">' + esc(info) + '</div>' : '')
    + (error ? '<div class="er">' + esc(error) + (left != null ? ' (' + left + ' оролдлого үлдлээ)' : '') + '</div>' : '');
  if (mode === 'code') {
    return send(res, error ? 401 : 200,
      '<h1>Имэйлээ баталгаажуулах</h1>'
      + '<p><b>' + esc(mask(email)) + '</b> хаяг руу 6 оронтой код илгээлээ. Кодоо оруулаад холбоно уу (' + LINK_CODE_TTL_MIN + ' минут; «Spam» хавтсаа ч шалгаарай).</p>'
      + msgs
      + '<form method="POST" action="/api/cm/link">' + tok + act('verify')
      + '<input type="text" name="code" class="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="······" autocomplete="one-time-code" required autofocus>'
      + '<button class="b" type="submit">Баталгаажуулж нэвтрэх</button></form>'
      + '<form method="POST" action="/api/cm/link">' + tok + act('code') + '<button class="b s" type="submit">Код дахин илгээх</button></form>'
      + '<form method="POST" action="/api/cm/link">' + tok + act('pwform') + '<button class="lnk" type="submit">eyeshcheck-ийн нууц үгээр холбох</button></form>');
  }
  send(res, error ? 401 : 200,
    '<h1>eyeshcheck бүртгэлээ холбох</h1>'
    + '<p><b>' + esc(mask(email)) + '</b> имэйлээр eyeshcheck.com-д бүртгэл байна. Дасгалын төвийн бүртгэлтэйгээ <b>нэг удаа</b> холбоно — дараа нь шууд нэвтэрнэ.</p>'
    + msgs
    + '<form method="POST" action="/api/cm/link">' + tok + act('code') + '<button class="b" type="submit">Имэйл рүү код авах</button></form>'
    + '<div class="or">эсвэл <b>eyeshcheck.com-ийн</b> нууц үгээр (Дасгалын төвийнх биш):</div>'
    + '<form method="POST" action="/api/cm/link" autocomplete="on">' + tok + act('password')
    + '<input type="email" name="username" value="' + esc(email) + '" autocomplete="username" hidden>'
    + '<input type="password" name="password" placeholder="eyeshcheck-ийн нууц үг" autocomplete="current-password" required>'
    + '<button class="b s" type="submit">Нууц үгээр холбох</button></form>');
}
// Нэвтрэлтийг дуусгана: шалгалт (байвал) → JWT → localStorage (pages/index.js-тэй ижил түлхүүрүүд) → /?exam=<id>
export async function finish(res, teacher, exam) {
  // Эрхгүй ч шалгалтыг хадгална — апп төлбөрийн дэлгэц гаргана, төлмөгц шалгалт бэлэн байна
  const examId = exam ? await upsertCmExam(teacher.id, exam) : null;
  const data = {
    token: signToken(teacher.id, teacher.email),
    teacher: { id: teacher.id, email: teacher.email, name: teacher.name, isAdmin: teacher.is_admin, status: teacher.status,
               paidUntil: accessUntil(teacher), hasAccess: hasAccess(teacher) },
    next: examId ? '/?exam=' + encodeURIComponent(examId) : '/',
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const nonce = crypto.randomBytes(16).toString('base64');
  send(res, 200, '<div class="sp"></div><h1>Нэвтэрч байна…</h1><p>' + (examId ? 'Шалгалт үүслээ. ' : '') + 'eyeshcheck.com нээгдэж байна.</p>'
    + '<script nonce="' + nonce + '">(function(){try{window.opener=null}catch(e){}var d=' + json + ';try{'
    + "localStorage.setItem('eyesh_token',d.token);localStorage.setItem('eyesh_teacher',JSON.stringify(d.teacher));"
    + "['student_token','student_info','demo_login_time','demo_device_fingerprint','demo_device_id'].forEach(function(k){localStorage.removeItem(k)})"
    + '}catch(e){}location.replace(d.next)})();</script>', nonce);
}
