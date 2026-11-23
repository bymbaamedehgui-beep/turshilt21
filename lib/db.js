import { neon } from '@neondatabase/serverless';
import { normVariants } from './eyesh';
import { CM_SUBJECT, WELCOME_HOURS, BANK, MONTH_PRICE } from './plans';

function getDb() {
  return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

export async function initDb() {
  const sql = getDb();
  // status: 'pending' | 'active' | 'disabled'
  await sql`CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    name VARCHAR(200),
    status VARCHAR(20) DEFAULT 'pending',
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // Migrate old columns if they exist
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`;
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT ''`;
  // Эрхийн хугацаа (QPay): paid_until хүртэл ашиглана. Шинэ бүртгэл = 1 хоногийн туршилт.
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ`;
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false`;
  // Activate all existing teachers (migrated from old system)
  await sql`UPDATE teachers SET status='active' WHERE status IS NULL OR status=''`;
  // Дансаар төлж admin-аар нээлгэсэн (хугацаагүй) багш нарт 1 сарын эрх — дараа нь QPay-ээр сунгана
  await sql`UPDATE teachers SET paid_until = NOW() + interval '30 days' WHERE paid_until IS NULL AND status='active' AND NOT is_admin`;
  await sql`CREATE TABLE IF NOT EXISTS teacher_payments (
    id VARCHAR(50) PRIMARY KEY,
    teacher_id VARCHAR(50) REFERENCES teachers(id) ON DELETE CASCADE,
    invoice_id VARCHAR(100),
    months INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    qr JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
  )`;
  await sql`ALTER TABLE teacher_payments ADD COLUMN IF NOT EXISTS promo_code VARCHAR(40)`;
  // Шинэ бүртгэлийн урамшууллын (50%) үнээр үүсгэсэн нэхэмжлэх — markPaidLicenses давхар урамшууллыг шалгана
  await sql`ALTER TABLE teacher_payments ADD COLUMN IF NOT EXISTS welcome BOOLEAN NOT NULL DEFAULT false`;
  // Бүртгэлийн утас баталгаажуулалт (имэйлээр түлхүүрлэнэ): verify.mn session нь сервер талд, клиентэд pollToken-ийн хэш
  await sql`CREATE TABLE IF NOT EXISTS email_verifications (
    email VARCHAR(200) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(200),
    phone VARCHAR(50),
    password_hash VARCHAR(200),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64)`;
  await sql`ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0`;
  await sql`ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS sends INTEGER DEFAULT 0`;
  await sql`ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS session_id VARCHAR(80)`;
  await sql`ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS poll_hash VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS email_verifications_poll ON email_verifications (poll_hash)`;
  // Нэг дугаарт өдөрт үүсгэх verify.mn session-ий тоо (спамаас)
  await sql`CREATE TABLE IF NOT EXISTS phone_quota (phone VARCHAR(20) PRIMARY KEY, day DATE NOT NULL, count INTEGER NOT NULL DEFAULT 0)`;
  // Make first teacher admin if no admin exists
  await sql`UPDATE teachers SET is_admin=true WHERE id=(SELECT id FROM teachers ORDER BY created_at LIMIT 1) AND NOT EXISTS (SELECT 1 FROM teachers WHERE is_admin=true)`;
  await sql`CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(50) PRIMARY KEY,
    teacher_id VARCHAR(50) REFERENCES teachers(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    subject VARCHAR(100),
    sec1_count INTEGER DEFAULT 36,
    sec1_key JSONB,
    sec1_scores JSONB,
    topics JSONB,
    use_sec2 BOOLEAN DEFAULT false,
    sec2_config JSONB,
    sec2_score INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // Олон хувилбартай шалгалт: { B:{sec1Key,sec1Scores,topics,sec2Config}, … } — A нь үндсэн мөр (lib/eyesh.js examForVersion)
  await sql`ALTER TABLE exams ADD COLUMN IF NOT EXISTS variants JSONB`;
  await sql`CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(50) PRIMARY KEY,
    exam_id VARCHAR(50) REFERENCES exams(id) ON DELETE CASCADE,
    name VARCHAR(200),
    code VARCHAR(100),
    class VARCHAR(100),
    version VARCHAR(10),
    correct INTEGER DEFAULT 0,
    wrong INTEGER DEFAULT 0,
    blank INTEGER DEFAULT 0,
    raw_earned NUMERIC DEFAULT 0,
    raw_max NUMERIC DEFAULT 0,
    scaled NUMERIC DEFAULT 0,
    grade JSONB,
    sec1_results JSONB,
    sec2_results JSONB,
    needs_review BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS student_accounts (
    id VARCHAR(50) PRIMARY KEY,
    teacher_id VARCHAR(50) REFERENCES teachers(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(200),
    class VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // Сурагчийн хэсэг: сурах бичиг (admin, teacher_id NULL) ба багшийн ЭЕШ материал (PDF эсвэл холбоос)
  await sql`CREATE TABLE IF NOT EXISTS materials (
    id VARCHAR(50) PRIMARY KEY,
    teacher_id VARCHAR(50) REFERENCES teachers(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL,
    subject VARCHAR(100),
    title VARCHAR(300) NOT NULL,
    url TEXT NOT NULL,
    size BIGINT,
    class VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // Дасгалын төвөөс үүсгэсэн шалгалтын материал (хувилбаруудын хуудас, lib/cmsso.js): exam_id-тай мөр — зөвхөн багшид
  // (сурагчид харахгүй). body — gzip+base64 JSON, token — /api/cm/material холбоосны түлхүүр.
  // deleted_at — багш устгасан материал (kind 'material'): багш, сурагчаас нуугдана, админы архивт үлдэнэ (lib/tpaper.js)
  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS exam_id VARCHAR(50), ADD COLUMN IF NOT EXISTS body TEXT, ADD COLUMN IF NOT EXISTS token VARCHAR(64),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  await sql`CREATE TABLE IF NOT EXISTS student_goals (
    student_id VARCHAR(50) PRIMARY KEY REFERENCES student_accounts(id) ON DELETE CASCADE,
    targets JSONB DEFAULT '{}',
    university VARCHAR(300),
    major VARCHAR(300),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(50) PRIMARY KEY, value JSONB)`;
  // Багшийн өөрөө нэмсэн агуулга (сэдэв) хичээл бүрээр — дараагийн шалгалтуудын жагсаалтад ч гарна
  await sql`CREATE TABLE IF NOT EXISTS teacher_topics (
    teacher_id VARCHAR(50) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (teacher_id, subject, name)
  )`;
  // Промо код (lib/promo.js): percent — QPay нэхэмжлэхийн хөнгөлөлт %, days — үнэгүй хоног. Багш бүр нэг кодыг нэг удаа.
  await sql`CREATE TABLE IF NOT EXISTS promo_codes (
    code VARCHAR(40) PRIMARY KEY,
    kind VARCHAR(10) NOT NULL,
    value INTEGER NOT NULL,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT true,
    note VARCHAR(200) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS promo_redemptions (
    code VARCHAR(40) NOT NULL,
    teacher_id VARCHAR(50) NOT NULL,
    payment_id VARCHAR(50),
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (code, teacher_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS promo_fails (teacher_id VARCHAR(50) NOT NULL, day DATE NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (teacher_id, day))`;
  // Хамрах эрх (lib/promo.js SCOPES, таслалаар) — хуучин код зөвхөн багшийн эрхэд; redemptions.scope — аль эрхэд ашигласан
  await sql`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS scopes VARCHAR(40) NOT NULL DEFAULT 'teacher'`;
  await sql`ALTER TABLE promo_redemptions ADD COLUMN IF NOT EXISTS scope VARCHAR(10)`;
  // Дасгалын төв (cyber-math.com)-ийн бүртгэлээр нэвтрэх (lib/cmsso.js): cm_email — энэ данстай холбосон Дасгалын төвийн имэйл
  // (eyeshcheck-ийн имэйлээс өөр байж болно; нэг Дасгалын төвийн имэйл — нэг данс), cm_linked — холбогдсон эсэх (админы тэмдэг);
  // cm_paid_until — Дасгалын төв дээр төлсөн ЭЕШ шалгагчийн эрх (тэндээс нэвтрэх бүрт шинэчлэгдэнэ). cm_ref — тэндээс үүссэн
  // шалгалтын хариуны хэш: ижил хувилбарыг дахин дарахад шинэ шалгалт үүсгэхгүй.
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS cm_linked BOOLEAN DEFAULT false, ADD COLUMN IF NOT EXISTS cm_paid_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cm_email VARCHAR(200)`;
  await sql`ALTER TABLE exams ADD COLUMN IF NOT EXISTS cm_ref VARCHAR(80)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS exams_cm_ref ON exams (teacher_id, cm_ref) WHERE cm_ref IS NOT NULL`;
  try {
    // cm_email-ээс өмнө холбогдсон (cm_linked) данс — өөрийн имэйлээр холбогдсон гэж үзнэ
    await sql`UPDATE teachers t SET cm_email = t.email WHERE t.cm_linked AND t.cm_email IS NULL
      AND NOT EXISTS (SELECT 1 FROM teachers o WHERE o.cm_email = t.email)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS teachers_cm_email ON teachers (cm_email) WHERE cm_email IS NOT NULL`;
  } catch (e) { console.error('[initDb cm_email]', e.message); }   // бусад хүсэлтийг унагахгүй
  // Хичээл бүрийн эрх (lib/plans.js SUBJECTS) ба сургууль — нэг дуудлагаар (DO блок). ey_licenses.owner: 't:<багш>' | 's:<сургууль>';
  // last_grant — сүүлд сунгасан хугацаа (ON CONFLICT-д хэрэглэнэ). Сургууль хичээлээ төлж багш нараа урина; урилгыг багш
  // зөвшөөрсний дараа л (status 'active') сургуулийн эрхийг ашиглаж, сургууль түүний шалгалтыг нэгдсэн жагсаалтад харна.
  try {
    await sql`DO $$ BEGIN
      CREATE TABLE IF NOT EXISTS ey_licenses (owner VARCHAR(60) NOT NULL, subject VARCHAR(100) NOT NULL,
        until TIMESTAMPTZ NOT NULL, last_grant INTERVAL, PRIMARY KEY (owner, subject));
      CREATE TABLE IF NOT EXISTS ey_schools (id VARCHAR(50) PRIMARY KEY, name VARCHAR(200) NOT NULL,
        owner_id VARCHAR(50) NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE UNIQUE INDEX IF NOT EXISTS ey_schools_owner ON ey_schools (owner_id);
      CREATE TABLE IF NOT EXISTS ey_school_members (id VARCHAR(50) PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL REFERENCES ey_schools(id) ON DELETE CASCADE,
        teacher_id VARCHAR(50) REFERENCES teachers(id) ON DELETE CASCADE,
        contact VARCHAR(200) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'invited',
        created_at TIMESTAMPTZ DEFAULT NOW(), joined_at TIMESTAMPTZ);
      CREATE UNIQUE INDEX IF NOT EXISTS ey_school_members_contact ON ey_school_members (school_id, contact);
      CREATE UNIQUE INDEX IF NOT EXISTS ey_school_members_teacher ON ey_school_members (school_id, teacher_id) WHERE teacher_id IS NOT NULL;
      ALTER TABLE teacher_payments ADD COLUMN IF NOT EXISTS subjects JSONB, ADD COLUMN IF NOT EXISTS school_id VARCHAR(50);
      -- Онлайн шалгалтад бодлогуудыг (шалгалтын материал) сурагчдад харуулах эсэх — багш нээнэ (lib/paper.js)
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS paper_open BOOLEAN DEFAULT false;
    END $$`;
  } catch (e) { console.error('[initDb licenses]', e.message); }
}

// ── Teachers ──────────────────────────────────────────────
export async function getTeacherByEmail(email) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM teachers WHERE email = ${email}`;
  return rows[0] || null;
}
// lic_until — хичээлийн эрхийн (өөрийн, өөрийн сургуулийн, нэгдсэн сургуулийн) хамгийн хожуу дуусах огноо (hasAccess, accessUntil).
// ey_licenses хараахан үүсээгүй (deploy-ийн дараах анхны хүсэлт) бол энгийн мөр.
export async function getTeacherById(id) {
  const sql = getDb();
  try {
    const rows = await sql`SELECT t.*, (SELECT MAX(l.until) FROM ey_licenses l WHERE l.owner = 't:' || t.id
        OR l.owner IN (SELECT 's:' || s.id FROM ey_schools s WHERE s.owner_id = t.id)
        OR l.owner IN (SELECT 's:' || m.school_id FROM ey_school_members m WHERE m.teacher_id = t.id AND m.status = 'active')) AS lic_until
      FROM teachers t WHERE t.id = ${id}`;
    return rows[0] || null;
  } catch (e) {
    const rows = await sql`SELECT * FROM teachers WHERE id = ${id}`;
    return rows[0] || null;
  }
}
export async function getAllTeachers() {
  const sql = getDb();
  // paid_until — бүх эрхийн аль хожуу нь (accessUntil-тэй ижил; GREATEST нь NULL-ийг алгасна); all_until — бүх хичээлийн (хуучин
  // багц, туршилт) эрх; licenses — өөрийн хичээлийн эрх [{subject, until}]; school_names — эзэмшдэг ба нэгдсэн сургуулиуд
  return await sql`SELECT id,email,name,phone,status,is_admin,cm_linked,created_at,cm_paid_until,
      CASE WHEN paid_until > created_at THEN paid_until END AS all_until,
      (SELECT COALESCE(json_agg(json_build_object('subject', l.subject, 'until', l.until) ORDER BY l.subject), '[]'::json)
        FROM ey_licenses l WHERE l.owner = 't:' || teachers.id) AS licenses,
      (SELECT string_agg(s.name, ', ' ORDER BY s.name) FROM ey_schools s WHERE s.owner_id = teachers.id
        OR s.id IN (SELECT m.school_id FROM ey_school_members m WHERE m.teacher_id = teachers.id AND m.status = 'active')) AS school_names,
      GREATEST(CASE WHEN paid_until > created_at THEN paid_until END, cm_paid_until,
        (SELECT MAX(l2.until) FROM ey_licenses l2 WHERE l2.owner = 't:' || teachers.id
          OR l2.owner IN (SELECT 's:' || s2.id FROM ey_schools s2 WHERE s2.owner_id = teachers.id)
          OR l2.owner IN (SELECT 's:' || m2.school_id FROM ey_school_members m2 WHERE m2.teacher_id = teachers.id AND m2.status = 'active'))) AS paid_until
    FROM teachers ORDER BY created_at DESC`;
}
// Admin «Хувиргалт» (pages/api/admin/funnel.js): since-ээс хойш бүртгүүлсэн багш бүр аль шатанд хүрснийг одоо байгаа
// өгөгдлөөс — шалгалт үүсгэсэн, сурагч нэмсэн, дүн гарсан (уншуулсан/онлайн), QPay-ээр төлсөн (0₮-ийн промо тооцохгүй)
export async function getFunnel(since) {
  const sql = getDb();
  return await sql`SELECT t.id, t.name, t.email, t.phone, t.created_at, t.cm_linked,
      (SELECT COUNT(*) FROM exams e WHERE e.teacher_id = t.id)::int AS exams,
      (SELECT MIN(e.created_at) FROM exams e WHERE e.teacher_id = t.id) AS first_exam_at,
      (SELECT COUNT(*) FROM student_accounts a WHERE a.teacher_id = t.id)::int AS accounts,
      (SELECT COUNT(*) FROM students s JOIN exams e ON e.id = s.exam_id WHERE e.teacher_id = t.id)::int AS sheets,
      (SELECT MIN(s.submitted_at) FROM students s JOIN exams e ON e.id = s.exam_id WHERE e.teacher_id = t.id) AS first_sheet_at,
      (SELECT MIN(p.paid_at) FROM teacher_payments p WHERE p.teacher_id = t.id AND p.status = 'paid' AND p.amount > 0) AS first_paid_at
    FROM teachers t
    WHERE t.created_at >= ${since} AND COALESCE(t.is_admin, false) = false AND t.email <> ${DEMO_EMAIL}
    ORDER BY t.created_at DESC LIMIT 3000`;
}
export async function createTeacher({ id, email, passwordHash, name, phone, trialDays = 0, phoneVerified = false }) {
  const sql = getDb();
  const count = await sql`SELECT COUNT(*) as c FROM teachers`;
  const isFirst = parseInt(count[0].c) === 0;
  const paidUntil = trialDays ? new Date(Date.now() + trialDays * 86400000).toISOString() : null;
  const rows = await sql`
    INSERT INTO teachers (id, email, password_hash, name, phone, status, is_admin, paid_until, phone_verified)
    VALUES (${id}, ${email}, ${passwordHash}, ${name||''}, ${phone||''}, 'active', ${isFirst}, ${paidUntil}, ${phoneVerified})
    RETURNING *`;
  return rows[0];
}

// ── Эрх ба төлбөр ─────────────────────────────────────────
const DEMO_EMAIL = 'demo@eyeshcheck.com';
// Шинэ бүртгэлийн урамшуулал (lib/plans.js WELCOME_*): бүртгүүлснээс хойш WELCOME_HOURS цаг, QPay-ээр мөнгө төлж
// байгаагүй, промо код ашиглаагүй багшид → { until } | null. Үнийг клиент биш энэ шийднэ (pages/api/pay/create.js).
// Хөнгөлөлт давхцахгүй: промо (үнэгүй хоног, 100%, хөнгөлөлттэй төлбөр) ашигласан бол урамшуулал дуусна.
export async function welcomeOffer(t) {
  if (!t || t.is_admin || t.email === DEMO_EMAIL || t.status === 'disabled' || !t.created_at) return null;
  const until = new Date(new Date(t.created_at).getTime() + WELCOME_HOURS * 3600000);
  if (!(until > new Date())) return null;
  const sql = getDb();
  const used = await sql`SELECT 1 FROM teacher_payments WHERE teacher_id = ${t.id} AND status = 'paid' AND amount > 0
    UNION ALL SELECT 1 FROM promo_redemptions WHERE teacher_id = ${t.id} LIMIT 1`;
  return used.length ? null : { until: until.toISOString() };
}
// Бүх хичээлийн эрх (paid_until): хуучин багц (хичээлээр ялгахаас өмнө төлсөн), туршилт, admin-ы «бүх хичээл» сунгалт.
// paid_until <= created_at — Дасгалын төвөөр үүсгэсэн, eyeshcheck-д төлөөгүй багшийн тэмдэг (lib/cmsso.js createCmTeacher), огноо биш.
export function legacyUntil(t) {
  return t?.paid_until && !(t.created_at && new Date(t.paid_until) <= new Date(t.created_at)) ? new Date(t.paid_until) : null;
}
const latest = ds => ds.filter(Boolean).reduce((m, x) => (!m || x > m ? x : m), null);
// Эрхийн хамгийн хожуу дуусах огноо: бүх хичээлийн эрх, Дасгалын төвийн (математик) эрх, хичээлийн эрх (getTeacherById-ийн lic_until)
export function accessUntil(t) {
  if (!t) return null;
  return latest([legacyUntil(t), t.cm_paid_until && new Date(t.cm_paid_until), t.lic_until && new Date(t.lic_until)]);
}
// Admin, demo — үргэлж; бусад нь хаагдаагүй бөгөөд эрхийн хугацаа ирээгүй бол
export function hasAccess(t) {
  if (!t || t.status === 'disabled') return false;
  if (t.is_admin || t.email === DEMO_EMAIL) return true;
  const until = accessUntil(t);
  return !!(until && until > new Date());
}
export const isTeacherActive = hasAccess;
export async function phoneTaken(local) {
  const sql = getDb();
  const rows = await sql`SELECT id FROM teachers WHERE right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 8) = ${local} LIMIT 1`;
  return !!rows[0];
}
export async function getVerification(email) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM email_verifications WHERE email=${email}`;
  return rows[0] || null;
}
export async function saveVerification({ email, name, phone, passwordHash, sessionId, pollHash, expiresAt }) {
  const sql = getDb();
  await sql`INSERT INTO email_verifications (email, code, code_hash, name, phone, password_hash, expires_at, attempts, sent_at, sends, session_id, poll_hash)
    VALUES (${email}, '', NULL, ${name||''}, ${phone||''}, ${passwordHash}, ${expiresAt}, 0, NOW(), 1, ${sessionId}, ${pollHash})
    ON CONFLICT (email) DO UPDATE SET code='', code_hash=NULL, name=${name||''}, phone=${phone||''}, password_hash=${passwordHash},
      expires_at=${expiresAt}, attempts=0, sent_at=NOW(), session_id=${sessionId}, poll_hash=${pollHash},
      sends = CASE WHEN email_verifications.sent_at > NOW() - interval '1 day' THEN email_verifications.sends + 1 ELSE 1 END`;
}
export async function getVerificationByPoll(pollHash) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM email_verifications WHERE poll_hash=${pollHash}`;
  return rows[0] || null;
}
// Нэг баталгаажуулалтыг нэг л удаа ашиглана: мөрийг устгасан хүсэлт л авна
export async function consumeVerification(pollHash) {
  const sql = getDb();
  const rows = await sql`DELETE FROM email_verifications WHERE poll_hash=${pollHash} RETURNING *`;
  return rows[0] || null;
}
// → энэ дугаарт өнөөдөр үүсгэсэн session-ий тоо (энэ удааг оролцуулаад)
export async function bumpPhoneQuota(phone) {
  const sql = getDb();
  const rows = await sql`INSERT INTO phone_quota (phone, day, count) VALUES (${phone}, CURRENT_DATE, 1)
    ON CONFLICT (phone) DO UPDATE SET count = CASE WHEN phone_quota.day = CURRENT_DATE THEN phone_quota.count + 1 ELSE 1 END, day = CURRENT_DATE
    RETURNING count`;
  return rows[0]?.count || 1;
}
// ── Нууц үг сэргээх (бүртгэлтэй утсаар — verify.mn; имэйл илгээхгүй): pages/api/forgot-password.js, reset-password.js ──
export async function ensurePasswordResets() {
  const sql = getDb();
  await sql`CREATE TABLE IF NOT EXISTS password_resets (
    email VARCHAR(200) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS session_id VARCHAR(80), ADD COLUMN IF NOT EXISTS poll_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS sends INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false`;
  await sql`CREATE INDEX IF NOT EXISTS password_resets_poll ON password_resets (poll_hash)`;
}
export async function getPasswordReset(email) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM password_resets WHERE email=${email}`;
  return rows[0] || null;
}
export async function savePasswordReset({ email, sessionId, pollHash, expiresAt }) {
  const sql = getDb();
  await sql`INSERT INTO password_resets (email, code, expires_at, session_id, poll_hash, sent_at, sends, verified)
    VALUES (${email}, '', ${expiresAt}, ${sessionId}, ${pollHash}, NOW(), 1, false)
    ON CONFLICT (email) DO UPDATE SET code='', expires_at=${expiresAt}, session_id=${sessionId}, poll_hash=${pollHash}, verified=false,
      sends = CASE WHEN password_resets.sent_at > NOW() - interval '1 day' THEN COALESCE(password_resets.sends, 0) + 1 ELSE 1 END,
      sent_at = NOW()`;
}
export async function getPasswordResetByPoll(pollHash) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM password_resets WHERE poll_hash=${pollHash}`;
  return rows[0] || null;
}
// Утас баталгаажсан → шинэ нууц үг тавих 10 минут
export async function markPasswordResetVerified(pollHash) {
  const sql = getDb();
  await sql`UPDATE password_resets SET verified=true, expires_at = NOW() + interval '10 minutes' WHERE poll_hash=${pollHash} AND verified=false`;
}
// Нэг сэргээлт — нэг удаа: баталгаажсан, хугацаандаа мөрийг устгасан хүсэлт л нууц үгийг солино
export async function consumePasswordReset(pollHash) {
  const sql = getDb();
  const rows = await sql`DELETE FROM password_resets WHERE poll_hash=${pollHash} AND verified=true AND expires_at > NOW() RETURNING email`;
  return rows[0] || null;
}
export async function setTeacherPassword(email, passwordHash) {
  const sql = getDb();
  // Шинэ нууц үг — Дасгалын төвийн холбоосыг тасална (lib/cmsso.js: дахин нэг удаа холбоно)
  await sql`UPDATE teachers SET password_hash=${passwordHash}, cm_linked=false, cm_email=NULL WHERE email=${email}`;
}
// subjects — хичээлийн эрхийн нэхэмжлэх (['Физик'] багш, олон хичээл сургууль); schoolId — сургуулийн нэхэмжлэх.
// subjects-гүй (хуучин) нэхэмжлэх төлөгдвөл бүх хичээлийн paid_until сунгагдана.
export async function createPayment(p) {
  const sql = getDb();
  await sql`INSERT INTO teacher_payments (id, teacher_id, invoice_id, months, amount, status, qr, promo_code, subjects, school_id, welcome)
    VALUES (${p.id}, ${p.teacherId}, ${p.invoiceId}, ${p.months}, ${p.amount}, 'pending', ${JSON.stringify(p.qr || {})}, ${p.promoCode || null},
      ${p.subjects ? JSON.stringify(p.subjects) : null}, ${p.schoolId || null}, ${!!p.welcome})`;
}
export async function getPayment(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM teacher_payments WHERE id=${id}`;
  return rows[0] || null;
}
// Сүүлийн 30 минутад үүсгэсэн, төлөгдөөгүй ИЖИЛ нэхэмжлэх — багц, хичээлүүд, сургууль (давхар нэхэмжлэхээс сэргийлнэ)
export async function findOpenPayment(teacherId, months, { subjects = null, schoolId = null } = {}) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM teacher_payments WHERE teacher_id=${teacherId} AND months=${months} AND status='pending'
    AND created_at > NOW() - interval '30 minutes' ORDER BY created_at DESC LIMIT 10`;
  const want = JSON.stringify(subjects || null);
  return rows.find(r => JSON.stringify(r.subjects || null) === want && (r.school_id || null) === (schoolId || null)) || null;
}
// Нэг нэхэмжлэхийг ЗӨВХӨН нэг удаа «төлсөн» болгоно; амжилттай бол эрхийг сунгана → { payment, teacher, until, school } | null
export async function markPaidAndExtend(paymentId) {
  const sql = getDb();
  const cur = (await sql`SELECT subjects FROM teacher_payments WHERE id=${paymentId}`)[0];
  if (cur && Array.isArray(cur.subjects) && cur.subjects.length) return markPaidLicenses(paymentId);
  const done = await sql`UPDATE teacher_payments SET status='paid', paid_at=NOW() WHERE id=${paymentId} AND status='pending' RETURNING *`;
  if (!done[0]) return null;
  const p = done[0];
  // Хуучин (хичээлгүй) нэхэмжлэх — бүх хичээлийн эрх. Дасгалын төвийн эрх (cm_paid_until) үлдсэн бол түүний дараагаас сунгана.
  const rows = await sql`UPDATE teachers SET status = CASE WHEN status='disabled' THEN status ELSE 'active' END,
      paid_until = GREATEST(COALESCE(paid_until, NOW()), COALESCE(cm_paid_until, NOW()), NOW()) + make_interval(months => ${p.months}::int)
    WHERE id=${p.teacher_id} RETURNING id, email, name, paid_until`;
  await countPromoUse(sql, p);
  return { payment: p, teacher: rows[0] || null, until: rows[0]?.paid_until || null, school: null };
}
// Хичээлийн эрхийн нэхэмжлэх: «төлсөн» болгох ба эрх сунгахыг НЭГ SQL-ээр (хагас дутуу үлдэхгүй). Багшийн эрх бүх хичээлийн
// эрх (paid_until), математикт Дасгалын төвийн эрх дууссаны дараагаас эхэлнэ — давхар төлөхгүй.
// Урамшууллын (50%) нэхэмжлэх зөвхөн ЭХНИЙ төлбөрт: өмнө нь өөр төлбөр төлсөн эсвэл промо ашигласан (жишээ нь урамшууллын
// хоёр нэхэмжлэхийг хоёуланг нь төлсөн) бол төлсөн дүнг ердийн үнээр (MONTH_PRICE = 30 хоног) хоног болгож олгоно → welcomeDays.
async function markPaidLicenses(paymentId) {
  const sql = getDb();
  const rows = await sql`WITH p AS (UPDATE teacher_payments SET status='paid', paid_at=NOW()
        WHERE id=${paymentId} AND status='pending' AND subjects IS NOT NULL RETURNING *),
      g AS (SELECT p.*, CASE WHEN p.welcome AND (
          EXISTS (SELECT 1 FROM teacher_payments q WHERE q.teacher_id = p.teacher_id AND q.id <> p.id AND q.status = 'paid' AND q.amount > 0)
          OR EXISTS (SELECT 1 FROM promo_redemptions r WHERE r.teacher_id = p.teacher_id))
        THEN GREATEST(1, ROUND(p.amount * 30.0 / (${MONTH_PRICE} * GREATEST(1, jsonb_array_length(p.subjects)))))::int END AS wdays FROM p),
      ins AS (INSERT INTO ey_licenses (owner, subject, until, last_grant)
        SELECT CASE WHEN g.school_id IS NOT NULL THEN 's:' || g.school_id ELSE 't:' || g.teacher_id END, s.subject,
          GREATEST(NOW(),
            CASE WHEN g.school_id IS NULL AND t.paid_until > t.created_at AND s.subject <> ${BANK} THEN t.paid_until END,
            CASE WHEN g.school_id IS NULL AND s.subject = ${CM_SUBJECT} THEN t.cm_paid_until END)
            + COALESCE(make_interval(days => g.wdays), make_interval(months => g.months)),
          COALESCE(make_interval(days => g.wdays), make_interval(months => g.months))
        FROM g JOIN teachers t ON t.id = g.teacher_id CROSS JOIN LATERAL jsonb_array_elements_text(g.subjects) AS s(subject)
        ON CONFLICT (owner, subject) DO UPDATE SET until = GREATEST(ey_licenses.until + EXCLUDED.last_grant, EXCLUDED.until), last_grant = EXCLUDED.last_grant
        RETURNING subject, until)
    SELECT ins.subject, ins.until, (SELECT wdays FROM g) AS wdays FROM ins`;
  if (!rows.length) return null;   // аль хэдийн төлөгдсөн (зэрэг ирсэн callback)
  const welcomeDays = rows[0].wdays || null;
  const p = (await sql`SELECT * FROM teacher_payments WHERE id=${paymentId}`)[0];
  const t = await sql`UPDATE teachers SET status = CASE WHEN status='disabled' THEN status ELSE 'active' END
    WHERE id=${p.teacher_id} RETURNING id, email, name, paid_until`;
  const school = p.school_id ? (await sql`SELECT id, name FROM ey_schools WHERE id=${p.school_id}`)[0] || null : null;
  await countPromoUse(sql, p);
  return { payment: p, teacher: t[0] || null, until: latest(rows.map(r => new Date(r.until))), school, welcomeDays };
}
async function countPromoUse(sql, p) {
  if (p.promo_code) {   // хөнгөлөлтийн код төлбөр орсны дараа л «ашигласан» тоологдоно; алдаа нь эрх сунгалтыг унагахгүй
    const scope = p.school_id ? 'school' : Array.isArray(p.subjects) && p.subjects.includes(BANK) ? 'bank' : 'teacher';
    try {
      await sql`WITH r AS (INSERT INTO promo_redemptions (code, teacher_id, payment_id, scope) VALUES (${p.promo_code}, ${p.teacher_id}, ${p.id}, ${scope})
          ON CONFLICT DO NOTHING RETURNING code)
        UPDATE promo_codes SET used_count = used_count + 1 WHERE code IN (SELECT code FROM r)`;
    } catch (e) { console.error('[markPaidAndExtend promo]', e.message); }
  }
}
// Admin-ы гар сунгалт (бэлэн мөнгө, дансаар): subject өгвөл тэр хичээлийн эрх, үгүй бол бүх хичээлийн (paid_until) эрх
export async function extendTeacher(id, months, subject = null) {
  const sql = getDb();
  if (subject) {
    const t = (await sql`SELECT id, paid_until, created_at, cm_paid_until FROM teachers WHERE id=${id}`)[0];
    if (!t) return null;
    const r = await grantLicenses('t:' + id, [subject], { months, floors: teacherFloors(t) });
    return r.until;
  }
  const rows = await sql`UPDATE teachers SET paid_until = GREATEST(COALESCE(paid_until, NOW()), COALESCE(cm_paid_until, NOW()), NOW()) + make_interval(months => ${months}::int)
    WHERE id=${id} RETURNING paid_until`;
  return rows[0]?.paid_until || null;
}
export async function updateTeacherStatus(id, status) {
  const sql = getDb();
  await sql`UPDATE teachers SET status=${status} WHERE id=${id}`;
}
// Admin утас солих/арилгах (pages/api/admin/teachers.js): local '' → арилгана. Өөр багшийн дугаар бол { taken }
export async function setTeacherPhone(id, local) {
  const sql = getDb();
  if (local) {
    const other = await sql`SELECT id FROM teachers WHERE id <> ${id}
      AND right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 8) = ${local} LIMIT 1`;
    if (other[0]) return { taken: true };
  }
  const rows = await sql`UPDATE teachers SET phone=${local}, phone_verified=${!!local} WHERE id=${id}
    RETURNING id, name, email, phone, phone_verified`;
  return rows[0] ? { teacher: rows[0] } : null;
}
export async function deleteTeacher(id) {
  const sql = getDb();
  await sql`DELETE FROM teacher_topics WHERE teacher_id=${id}`;
  await sql`DELETE FROM promo_fails WHERE teacher_id=${id}`;
  await sql`DELETE FROM teachers WHERE id=${id}`;
}
// Дасгалын төвийн админы «ЭЕШ шалгагч» цэс (pages/api/cm/admin-session.js) нэвтрэх eyeshcheck-ийн admin данс:
// CM_ADMIN_EMAIL заасан бол тэр, эс бөгөөс хамгийн анхны (хаагдаагүй) admin
export async function getCmAdminTeacher() {
  const sql = getDb();
  const email = String(process.env.CM_ADMIN_EMAIL || '').trim().toLowerCase();
  const rows = email
    ? await sql`SELECT * FROM teachers WHERE lower(email)=${email} AND is_admin AND status <> 'disabled' LIMIT 1`
    : await sql`SELECT * FROM teachers WHERE is_admin AND status <> 'disabled' ORDER BY created_at LIMIT 1`;
  return rows[0] || null;
}

// ── Промо код (lib/promo.js шалгана) ──────────────────────
export async function getPromo(code) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM promo_codes WHERE code=${code}`;
  return rows[0] || null;
}
export async function listPromos() {
  const sql = getDb();
  return await sql`SELECT * FROM promo_codes ORDER BY created_at DESC`;
}
export async function createPromo({ code, kind, value, maxUses, expiresAt, note, scopes = 'teacher' }) {
  const sql = getDb();
  const rows = await sql`INSERT INTO promo_codes (code, kind, value, max_uses, expires_at, note, scopes)
    VALUES (${code}, ${kind}, ${value}, ${maxUses}, ${expiresAt}, ${note || ''}, ${scopes}) ON CONFLICT DO NOTHING RETURNING *`;
  return rows[0] || null;
}
export async function setPromoActive(code, active) {
  const sql = getDb();
  const rows = await sql`UPDATE promo_codes SET active=${active} WHERE code=${code} RETURNING *`;
  return rows[0] || null;
}
// true | 'used' (ашиглагдсан — идэвхгүй болгоно) | false (олдсонгүй)
export async function deletePromo(code) {
  const sql = getDb();
  const rows = await sql`DELETE FROM promo_codes WHERE code=${code} AND used_count=0
    AND NOT EXISTS (SELECT 1 FROM promo_redemptions WHERE code=${code}) RETURNING code`;
  if (rows[0]) return true;
  return (await getPromo(code)) ? 'used' : false;
}
export async function promoUses(code) {
  const sql = getDb();
  return await sql`SELECT r.redeemed_at, r.payment_id, r.scope, t.name, t.email, s.name AS school_name FROM promo_redemptions r
    LEFT JOIN teachers t ON t.id = r.teacher_id LEFT JOIN ey_schools s ON s.owner_id = r.teacher_id AND r.scope = 'school'
    WHERE r.code=${code} ORDER BY r.redeemed_at DESC`;
}
export async function promoUsedBy(code, teacherId) {
  const sql = getDb();
  const rows = await sql`SELECT 1 FROM promo_redemptions WHERE code=${code} AND teacher_id=${teacherId}`;
  return !!rows[0];
}
export async function promoFailCount(teacherId) {
  const sql = getDb();
  const rows = await sql`SELECT count FROM promo_fails WHERE teacher_id=${teacherId} AND day=CURRENT_DATE`;
  return rows[0]?.count || 0;
}
export async function bumpPromoFail(teacherId) {
  const sql = getDb();
  await sql`INSERT INTO promo_fails (teacher_id, day, count) VALUES (${teacherId}, CURRENT_DATE, 1)
    ON CONFLICT (teacher_id, day) DO UPDATE SET count = promo_fails.count + 1`;
}
// Кодоор эрхийг ШУУД сунгана (days код, эсвэл 100%-ийн хөнгөлөлтөөр сонгосон сар). Багш бүр нэг удаа, хязгаар/хугацааг
// UPDATE дотор дахин шалгана (зэрэг хүсэлт хязгаараас хэтрэхгүй). → { paidUntil } | { error }
// subject — хичээлийн эрх сунгана (одоогийн багц); өгөөгүй бол бүх хичээлийн paid_until (хуучин зан).
export async function grantPromo(teacherId, code, { days = 0, months = 0, subject = null }) {
  const sql = getDb();
  const ins = await sql`INSERT INTO promo_redemptions (code, teacher_id, scope) VALUES (${code}, ${teacherId}, 'teacher') ON CONFLICT DO NOTHING RETURNING code`;
  if (!ins[0]) return { error: 'Та энэ кодыг аль хэдийн ашигласан байна' };
  if (subject) {
    const f = teacherFloors((await sql`SELECT paid_until, created_at, cm_paid_until FROM teachers WHERE id=${teacherId}`)[0]);
    const lic = await sql`WITH c AS (
        UPDATE promo_codes SET used_count = used_count + 1
        WHERE code=${code} AND active AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)
        RETURNING code)
      INSERT INTO ey_licenses (owner, subject, until, last_grant)
      SELECT ${'t:' + teacherId}, ${subject},
        GREATEST(NOW(), ${f.all}::timestamptz, ${subject === CM_SUBJECT ? f.cm : null}::timestamptz) + make_interval(months => ${months}::int, days => ${days}::int),
        make_interval(months => ${months}::int, days => ${days}::int)
      FROM c
      ON CONFLICT (owner, subject) DO UPDATE SET until = GREATEST(ey_licenses.until + EXCLUDED.last_grant, EXCLUDED.until), last_grant = EXCLUDED.last_grant
      RETURNING until`;
    if (!lic[0]) {
      await sql`DELETE FROM promo_redemptions WHERE code=${code} AND teacher_id=${teacherId}`;
      return { error: 'Промо кодын хэрэглэх хязгаар дууссан байна' };
    }
    await sql`UPDATE teachers SET status = CASE WHEN status='disabled' THEN status ELSE 'active' END WHERE id=${teacherId}`;
    return { paidUntil: lic[0].until };
  }
  const rows = await sql`WITH c AS (
      UPDATE promo_codes SET used_count = used_count + 1
      WHERE code=${code} AND active AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)
      RETURNING code)
    UPDATE teachers SET status = CASE WHEN status='disabled' THEN status ELSE 'active' END,
      paid_until = GREATEST(COALESCE(paid_until, NOW()), COALESCE(cm_paid_until, NOW()), NOW())
        + make_interval(months => ${months}::int, days => ${days}::int)
    FROM c WHERE teachers.id=${teacherId} RETURNING teachers.paid_until`;
  if (!rows[0]) {
    await sql`DELETE FROM promo_redemptions WHERE code=${code} AND teacher_id=${teacherId}`;
    return { error: 'Промо кодын хэрэглэх хязгаар дууссан байна' };
  }
  return { paidUntil: rows[0].paid_until };
}
// 100%-ийн промо кодоор сургуулийн эрх / ЭЕШ сан (pages/api/pay/create.js) — QPay-гүйгээр сонгосон сараар. grantPromo шиг: багш бүр
// нэг удаа, хязгаар/хугацааг UPDATE дотор дахин шалгана. owner 's:<сургууль>' | 't:<багш>'; floors — багшийн эрхийн доод хязгаар
// (teacherFloors; ЭЕШ сангийн «хичээлд» хамаарахгүй — markPaidLicenses-тэй ижил). → { paidUntil } | { error }
export async function grantPromoLicenses(teacherId, code, { owner, subjects, months, scope, floors = {} }) {
  const sql = getDb();
  const ins = await sql`INSERT INTO promo_redemptions (code, teacher_id, scope) VALUES (${code}, ${teacherId}, ${scope}) ON CONFLICT DO NOTHING RETURNING code`;
  if (!ins[0]) return { error: 'Та энэ кодыг аль хэдийн ашигласан байна' };
  const rows = await sql`WITH c AS (
      UPDATE promo_codes SET used_count = used_count + 1
      WHERE code=${code} AND active AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)
      RETURNING code)
    INSERT INTO ey_licenses (owner, subject, until, last_grant)
    SELECT ${owner}, s.subject,
      GREATEST(NOW(), CASE WHEN s.subject <> ${BANK} THEN ${floors.all || null}::timestamptz END,
        CASE WHEN s.subject = ${CM_SUBJECT} THEN ${floors.cm || null}::timestamptz END) + make_interval(months => ${months}::int),
      make_interval(months => ${months}::int)
    FROM c CROSS JOIN jsonb_array_elements_text(${JSON.stringify(subjects)}::jsonb) AS s(subject)
    ON CONFLICT (owner, subject) DO UPDATE SET until = GREATEST(ey_licenses.until + EXCLUDED.last_grant, EXCLUDED.until), last_grant = EXCLUDED.last_grant
    RETURNING until`;
  if (!rows.length) {
    await sql`DELETE FROM promo_redemptions WHERE code=${code} AND teacher_id=${teacherId}`;
    return { error: 'Промо кодын хэрэглэх хязгаар дууссан байна' };
  }
  await sql`UPDATE teachers SET status = CASE WHEN status='disabled' THEN status ELSE 'active' END WHERE id=${teacherId}`;
  return { paidUntil: latest(rows.map(r => new Date(r.until))) };
}

// ── Хичээлийн эрх ба сургууль ─────────────────────────────
// Багшийн шинэ хичээлийн эрх эхлэх доод хязгаар: бүх хичээлийн эрх (paid_until), математикт Дасгалын төвийн эрх
export function teacherFloors(t) {
  const a = legacyUntil(t);
  return { all: a ? a.toISOString() : null, cm: t?.cm_paid_until ? new Date(t.cm_paid_until).toISOString() : null };
}
// owner ('t:…' | 's:…')-ийн хичээлүүдийн эрхийг сунгана (admin-ы гар сунгалт). Хугацаа нь одоогийн эрх эсвэл доод хязгаараас үргэлжилнэ.
export async function grantLicenses(owner, subjects, { months = 0, days = 0, floors = {} } = {}) {
  const sql = getDb();
  const rows = await sql`INSERT INTO ey_licenses (owner, subject, until, last_grant)
    SELECT ${owner}, s.subject,
      GREATEST(NOW(), ${floors.all || null}::timestamptz, CASE WHEN s.subject = ${CM_SUBJECT} THEN ${floors.cm || null}::timestamptz END)
        + make_interval(months => ${months}::int, days => ${days}::int),
      make_interval(months => ${months}::int, days => ${days}::int)
    FROM jsonb_array_elements_text(${JSON.stringify(subjects)}::jsonb) AS s(subject)
    ON CONFLICT (owner, subject) DO UPDATE SET until = GREATEST(ey_licenses.until + EXCLUDED.last_grant, EXCLUDED.until), last_grant = EXCLUDED.last_grant
    RETURNING subject, until`;
  return { until: latest(rows.map(r => new Date(r.until))), rows };
}
const digits8 = p => String(p || '').replace(/\D/g, '').slice(-8);
// Багшид хамаарах хичээлийн эрхүүд: өөрийн ('t:'), өөрийн сургуулийн, нэгдсэн (active) сургуулийн
async function licenseRows(sql, id, subject = null) {
  return subject == null
    ? sql`SELECT l.owner, l.subject, l.until, s.id AS school_id, s.name AS school_name FROM ey_licenses l
        LEFT JOIN ey_schools s ON l.owner = 's:' || s.id
        WHERE l.owner = ${'t:' + id}
          OR l.owner IN (SELECT 's:' || s2.id FROM ey_schools s2 WHERE s2.owner_id = ${id})
          OR l.owner IN (SELECT 's:' || m.school_id FROM ey_school_members m WHERE m.teacher_id = ${id} AND m.status = 'active')
        ORDER BY l.subject`
    : sql`SELECT MAX(l.until) AS until FROM ey_licenses l WHERE l.subject = ${subject} AND (l.owner = ${'t:' + id}
          OR l.owner IN (SELECT 's:' || s2.id FROM ey_schools s2 WHERE s2.owner_id = ${id})
          OR l.owner IN (SELECT 's:' || m.school_id FROM ey_school_members m WHERE m.teacher_id = ${id} AND m.status = 'active'))`;
}
// Тухайн хичээлийн эрхийн хамгийн хожуу дуусах огноо (Date | null)
export async function subjectUntil(t, subject) {
  if (!t) return null;
  const sql = getDb();
  const r = (await licenseRows(sql, t.id, subject))[0];
  return latest([legacyUntil(t), subject === CM_SUBJECT && t.cm_paid_until && new Date(t.cm_paid_until), r?.until && new Date(r.until)]);
}
// Шалгалт үүсгэх/засах, хуудас уншуулах эрх. Admin, demo — үргэлж.
export async function canUseSubject(t, subject) {
  if (!t || t.status === 'disabled') return false;
  if (t.is_admin || t.email === DEMO_EMAIL) return true;
  const u = await subjectUntil(t, String(subject || '').trim());
  return !!(u && u > new Date());
}
// API: хичээлийн эрхгүй бол 402 SUBJECT_REQUIRED (клиент тэр хичээлээр төлбөрийн дэлгэц нээнэ) — true бол хариу илгээсэн
export async function denySubject(res, t, subject) {
  if (await canUseSubject(t, subject)) return false;
  const s = String(subject || '').trim();
  res.status(402).json({ error: `«${s || 'Энэ'}» хичээлийн эрх алга. Эрхээ сунгана уу.`, code: 'SUBJECT_REQUIRED', subject: s });
  return true;
}
// /api/me: { all, cm, licenses:[{subject, until, school}], owned:{id,name}|null, memberOf:[{id,name,ownerName}], invites:[…] }
export async function getAccessInfo(t) {
  const sql = getDb();
  const [lic, owned, memberOf, invites] = await Promise.all([
    licenseRows(sql, t.id),
    sql`SELECT id, name FROM ey_schools WHERE owner_id = ${t.id}`,
    sql`SELECT s.id, s.name, o.name AS owner_name FROM ey_school_members m JOIN ey_schools s ON s.id = m.school_id
      LEFT JOIN teachers o ON o.id = s.owner_id WHERE m.teacher_id = ${t.id} AND m.status = 'active' ORDER BY s.name`,
    myInvites(t),
  ]);
  const all = legacyUntil(t);
  return {
    all: all ? all.toISOString() : null,
    cm: t.cm_paid_until ? new Date(t.cm_paid_until).toISOString() : null,
    licenses: lic.map(l => ({ subject: l.subject, until: l.until, school: l.school_id ? { id: l.school_id, name: l.school_name } : null })),
    owned: owned[0] ? { id: owned[0].id, name: owned[0].name } : null,
    memberOf: memberOf.map(s => ({ id: s.id, name: s.name, ownerName: s.owner_name || '' })),
    invites,
  };
}
// Энэ багшид ирсэн урилга: урьсан имэйл эсвэл (баталгаажсан) утас таарсан, зөвшөөрөөгүй мөр
export async function myInvites(t) {
  const sql = getDb();
  const email = String(t.email || '').trim().toLowerCase(), phone = t.phone_verified ? digits8(t.phone) : '';
  const rows = await sql`SELECT m.id, s.id AS school_id, s.name AS school_name, o.name AS owner_name FROM ey_school_members m
    JOIN ey_schools s ON s.id = m.school_id LEFT JOIN teachers o ON o.id = s.owner_id
    WHERE m.status = 'invited' AND s.owner_id <> ${t.id} AND (m.contact = ${email} OR (${phone} <> '' AND m.contact = ${phone}))
    ORDER BY m.created_at`;
  return rows.map(r => ({ id: r.id, schoolId: r.school_id, schoolName: r.school_name, ownerName: r.owner_name || '' }));
}
export async function getSchoolByOwner(ownerId) {
  const sql = getDb();
  return (await sql`SELECT * FROM ey_schools WHERE owner_id = ${ownerId}`)[0] || null;
}
export async function createSchool({ id, name, ownerId }) {
  const sql = getDb();
  const rows = await sql`INSERT INTO ey_schools (id, name, owner_id) VALUES (${id}, ${name}, ${ownerId}) ON CONFLICT (owner_id) DO NOTHING RETURNING *`;
  return rows[0] || null;
}
export async function renameSchool(id, name) {
  const sql = getDb();
  return (await sql`UPDATE ey_schools SET name = ${name} WHERE id = ${id} RETURNING *`)[0] || null;
}
export async function schoolLicenses(schoolId) {
  const sql = getDb();
  return await sql`SELECT subject, until FROM ey_licenses WHERE owner = ${'s:' + schoolId} ORDER BY subject`;
}
export async function schoolMembers(schoolId) {
  const sql = getDb();
  return await sql`SELECT m.id, m.contact, m.status, m.created_at, m.joined_at, t.id AS teacher_id, t.name, t.email, t.phone
    FROM ey_school_members m LEFT JOIN teachers t ON t.id = m.teacher_id WHERE m.school_id = ${schoolId} ORDER BY m.created_at`;
}
export async function inviteMember(schoolId, { id, contact }) {
  const sql = getDb();
  const rows = await sql`INSERT INTO ey_school_members (id, school_id, contact) VALUES (${id}, ${schoolId}, ${contact})
    ON CONFLICT (school_id, contact) DO NOTHING RETURNING *`;
  return rows[0] || null;
}
export async function removeMember(schoolId, memberId) {
  const sql = getDb();
  return !!(await sql`DELETE FROM ey_school_members WHERE id = ${memberId} AND school_id = ${schoolId} RETURNING id`)[0];
}
// Урилгыг зөвхөн тухайн хүн (имэйл эсвэл баталгаажсан утас таарсан) зөвшөөрнө. Аль хэдийн гишүүн бол давхар урилгыг устгана.
export async function acceptInvite(t, memberId) {
  const sql = getDb();
  const mine = (await myInvites(t)).find(i => i.id === memberId);
  if (!mine) return null;
  const already = (await sql`SELECT id FROM ey_school_members WHERE school_id = ${mine.schoolId} AND teacher_id = ${t.id}`)[0];
  if (already) { await sql`DELETE FROM ey_school_members WHERE id = ${memberId} AND status = 'invited'`; return mine; }
  const rows = await sql`UPDATE ey_school_members SET teacher_id = ${t.id}, status = 'active', joined_at = NOW()
    WHERE id = ${memberId} AND status = 'invited' RETURNING id`;
  return rows[0] ? mine : null;
}
export async function declineInvite(t, memberId) {
  const sql = getDb();
  if (!(await myInvites(t)).some(i => i.id === memberId)) return false;
  return !!(await sql`DELETE FROM ey_school_members WHERE id = ${memberId} AND status = 'invited' RETURNING id`)[0];
}
export async function leaveSchool(teacherId, schoolId) {
  const sql = getDb();
  return !!(await sql`DELETE FROM ey_school_members WHERE school_id = ${schoolId} AND teacher_id = ${teacherId} RETURNING id`)[0];
}
// Сургуулийн нэгдсэн жагсаалт: эзэн ба нэгдсэн багш нарын, сургуулийн хичээлүүдийн (хэзээ нэгэн цагт эрх авсан) шалгалтууд
// ба тэдгээрийн дүн (асуулт бүрийн хариугүй — хөнгөн). Сүүлийн 300 шалгалт.
export async function schoolReport(schoolId) {
  const sql = getDb();
  const exams = await sql`WITH tids AS (
        SELECT owner_id AS tid FROM ey_schools WHERE id = ${schoolId}
        UNION SELECT teacher_id FROM ey_school_members WHERE school_id = ${schoolId} AND status = 'active' AND teacher_id IS NOT NULL),
      subs AS (SELECT subject FROM ey_licenses WHERE owner = ${'s:' + schoolId})
    SELECT e.id, e.title, e.subject, e.created_at, e.sec1_count, e.teacher_id, t.name AS teacher_name,
      COUNT(st.id)::int AS n, ROUND(AVG(st.scaled)::numeric, 1)::float AS avg
    FROM exams e JOIN teachers t ON t.id = e.teacher_id LEFT JOIN students st ON st.exam_id = e.id
    WHERE e.teacher_id IN (SELECT tid FROM tids) AND e.subject IN (SELECT subject FROM subs)
    GROUP BY e.id, t.name ORDER BY e.created_at DESC LIMIT 300`;
  const rows = exams.length ? await sql`SELECT exam_id, name, code, class, scaled, submitted_at FROM students
    WHERE exam_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(exams.map(e => e.id))}::jsonb))` : [];
  return {
    exams: exams.map(e => ({ id: e.id, title: e.title, subject: e.subject, createdAt: e.created_at, sec1Count: e.sec1_count,
      teacherId: e.teacher_id, teacherName: e.teacher_name || '', n: e.n, avg: e.avg })),
    rows: rows.map(r => ({ examId: r.exam_id, name: r.name || '', code: r.code || '', class: r.class || '', scaled: Number(r.scaled) || 0, submittedAt: r.submitted_at })),
  };
}
// Admin: бүх сургууль — эзэн, гишүүд, хичээлийн эрх
export async function getAllSchools() {
  const sql = getDb();
  return await sql`SELECT s.id, s.name, s.created_at, o.name AS owner_name, o.email AS owner_email, o.phone AS owner_phone,
      (SELECT COUNT(*)::int FROM ey_school_members m WHERE m.school_id = s.id AND m.status = 'active') AS members,
      (SELECT COUNT(*)::int FROM ey_school_members m WHERE m.school_id = s.id AND m.status = 'invited') AS invited,
      (SELECT COALESCE(json_agg(json_build_object('subject', l.subject, 'until', l.until) ORDER BY l.subject), '[]'::json)
        FROM ey_licenses l WHERE l.owner = 's:' || s.id) AS licenses
    FROM ey_schools s LEFT JOIN teachers o ON o.id = s.owner_id ORDER BY s.created_at DESC`;
}

// ── Багшийн агуулга (сэдэв) ───────────────────────────────
// { "Математик": ["Тэгшитгэл", ...] } — нэмсэн дарааллаар
export async function getTeacherTopics(teacherId) {
  const sql = getDb();
  const rows = await sql`SELECT subject, name FROM teacher_topics WHERE teacher_id=${teacherId} ORDER BY created_at, name`;
  const out = {};
  rows.forEach(r => { (out[r.subject] = out[r.subject] || []).push(r.name); });
  return out;
}
export async function addTeacherTopic(teacherId, subject, name) {
  const sql = getDb();
  await sql`INSERT INTO teacher_topics (teacher_id, subject, name) VALUES (${teacherId}, ${subject}, ${name}) ON CONFLICT DO NOTHING`;
}
export async function removeTeacherTopic(teacherId, subject, name) {
  const sql = getDb();
  await sql`DELETE FROM teacher_topics WHERE teacher_id=${teacherId} AND subject=${subject} AND name=${name}`;
}

// ── Exams ─────────────────────────────────────────────────
export async function getExams(teacherId) {
  const sql = getDb();
  const [rows, mats] = await Promise.all([
    sql`SELECT * FROM exams WHERE teacher_id=${teacherId} ORDER BY created_at DESC`,
    sql`SELECT exam_id, title, url FROM materials WHERE teacher_id=${teacherId} AND exam_id IS NOT NULL AND deleted_at IS NULL ORDER BY title`,
  ]);
  // Дасгалын төвөөс хадгалсан шалгалтын материал → exam.materials [{ title, url }]
  const byExam = {};
  mats.forEach(m => { (byExam[m.exam_id] = byExam[m.exam_id] || []).push({ title: m.title, url: m.url }); });
  return rows.map(r => { const e = dbToExam(r); if (byExam[e.id]) e.materials = byExam[e.id]; return e; });
}
export async function getExam(id, teacherId) {
  const sql = getDb();
  const rows = teacherId
    ? await sql`SELECT * FROM exams WHERE id=${id} AND teacher_id=${teacherId}`
    : await sql`SELECT * FROM exams WHERE id=${id}`;
  return rows[0] ? dbToExam(rows[0]) : null;
}
export async function createExam(exam, teacherId) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO exams (id,teacher_id,title,subject,sec1_count,sec1_key,sec1_scores,topics,use_sec2,sec2_config,sec2_score,created_at,variants)
    VALUES (${exam.id},${teacherId},${exam.title},${exam.subject},${exam.sec1Count},
      ${JSON.stringify(exam.sec1Key)},${JSON.stringify(exam.sec1Scores)},
      ${JSON.stringify(exam.topics)},${exam.useSec2},
      ${JSON.stringify(exam.sec2Config||{})},${exam.sec2Score||1},
      ${exam.createdAt||new Date().toISOString()},${jsonOrNull(normVariants(exam))})
    RETURNING *`;
  return dbToExam(rows[0]);
}
export async function updateExam(id, exam, teacherId) {
  const sql = getDb();
  const rows = await sql`
    UPDATE exams SET title=${exam.title},subject=${exam.subject},sec1_count=${exam.sec1Count},
      sec1_key=${JSON.stringify(exam.sec1Key)},sec1_scores=${JSON.stringify(exam.sec1Scores)},
      topics=${JSON.stringify(exam.topics)},use_sec2=${exam.useSec2},
      sec2_config=${JSON.stringify(exam.sec2Config||{})},sec2_score=${exam.sec2Score||1},
      variants=CASE WHEN ${exam.variants === undefined} THEN variants ELSE ${jsonOrNull(normVariants(exam))}::jsonb END
    WHERE id=${id} AND teacher_id=${teacherId} RETURNING *`;   // variants талбаргүй (хуучин хуудаснаас) засвар хувилбарыг арилгахгүй
  return rows[0] ? dbToExam(rows[0]) : null;
}
const jsonOrNull = v => v == null ? null : JSON.stringify(v);
export async function deleteExam(id, teacherId) {
  const sql = getDb();
  await sql`DELETE FROM exams WHERE id=${id} AND teacher_id=${teacherId}`;
}

// ── Students ──────────────────────────────────────────────
export async function getStudents(examId) {
  const sql = getDb();
  const rows = examId
    ? await sql`SELECT * FROM students WHERE exam_id=${examId} ORDER BY submitted_at DESC`
    : await sql`SELECT * FROM students ORDER BY submitted_at DESC`;
  return rows.map(dbToStudent);
}
export async function getStudentsByTeacher(teacherId) {
  const sql = getDb();
  const rows = await sql`
    SELECT s.* FROM students s JOIN exams e ON s.exam_id=e.id
    WHERE e.teacher_id=${teacherId} ORDER BY s.submitted_at DESC`;
  return rows.map(dbToStudent);
}
// teacherId өгвөл зөвхөн тухайн багшийн шалгалтад нэмнэ; биш бол null
export async function createStudent(s, teacherId) {
  const sql = getDb();
  if (teacherId && !(await getExam(s.examId, teacherId))) return null;
  const rows = await sql`
    INSERT INTO students (id,exam_id,name,code,class,version,correct,wrong,blank,
      raw_earned,raw_max,scaled,grade,sec1_results,sec2_results,needs_review,submitted_at)
    VALUES (${s.id},${s.examId},${s.name},${s.code},${s.class||''},${s.version||''},
      ${s.correct},${s.wrong},${s.blank},${s.rawEarned},${s.rawMax},${s.scaled},
      ${JSON.stringify(s.grade)},${JSON.stringify(s.sec1Results)},
      ${JSON.stringify(s.sec2Results||{})},${s.needsReview||false},
      ${s.submittedAt||new Date().toISOString()})
    RETURNING *`;
  return dbToStudent(rows[0]);
}
// Шалгалт засагдсаны дараа дахин бодсон дүнг нэг query-гээр хадгална (зөвхөн тухайн шалгалтын мөрүүд)
export async function updateStudentScores(examId, rows) {
  if (!rows.length) return 0;
  const sql = getDb();
  const data = JSON.stringify(rows.map(r => ({
    id: r.id, correct: r.correct, wrong: r.wrong, blank: r.blank, raw_earned: r.rawEarned, raw_max: r.rawMax,
    scaled: r.scaled, grade: r.grade, sec1_results: r.sec1Results, sec2_results: r.sec2Results || {},
  })));
  const res = await sql`
    UPDATE students AS s SET correct=x.correct, wrong=x.wrong, blank=x.blank, raw_earned=x.raw_earned,
      raw_max=x.raw_max, scaled=x.scaled, grade=x.grade, sec1_results=x.sec1_results, sec2_results=x.sec2_results
    FROM json_to_recordset(${data}::json) AS x(id text, correct int, wrong int, blank int, raw_earned numeric,
      raw_max numeric, scaled numeric, grade jsonb, sec1_results jsonb, sec2_results jsonb)
    WHERE s.id = x.id AND s.exam_id = ${examId}
    RETURNING s.id`;
  return res.length;
}
// Зөвхөн тухайн багшийн шалгалтын сурагчийг устгана; устгасан эсэхийг буцаана
export async function deleteStudent(id, teacherId) {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM students WHERE id=${id}
      AND exam_id IN (SELECT id FROM exams WHERE teacher_id=${teacherId})
    RETURNING id`;
  return rows.length > 0;
}

// ── Student Accounts ──────────────────────────────────────
export async function getStudentAccounts(teacherId) {
  const sql = getDb();
  return teacherId
    ? await sql`SELECT * FROM student_accounts WHERE teacher_id=${teacherId} ORDER BY created_at DESC`
    : await sql`SELECT * FROM student_accounts ORDER BY created_at DESC`;
}
export async function getStudentAccountByCode(code) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM student_accounts WHERE code=${code}`;
  return rows[0] || null;
}
export async function createStudentAccount(acc, teacherId) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO student_accounts (id,teacher_id,code,name,class,created_at)
    VALUES (${acc.id},${teacherId},${acc.code},${acc.name||''},${acc.class||''},${acc.createdAt||new Date().toISOString()})
    RETURNING *`;
  return rows[0];
}
export async function deleteStudentAccount(id, teacherId) {
  const sql = getDb();
  const rows = await sql`DELETE FROM student_accounts WHERE id=${id} AND teacher_id=${teacherId} RETURNING id`;
  return rows.length > 0;
}
export async function getStudentAccountsByCode(code) {
  const sql = getDb();
  return await sql`SELECT * FROM student_accounts WHERE code=${code} ORDER BY created_at DESC`;
}
export async function getStudentAccountById(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM student_accounts WHERE id=${id}`;
  return rows[0] || null;
}

// ── Сурагчийн хэсэг ───────────────────────────────────────
// Сурагчийн бүх дүн: зөвхөн өөрийн багшийн шалгалтаас, өөрийн кодоор
export async function getStudentResults(code, teacherId) {
  const sql = getDb();
  const rows = await sql`
    SELECT s.*, e.title AS exam_title, e.subject AS exam_subject, e.created_at AS exam_created
    FROM students s JOIN exams e ON s.exam_id=e.id
    WHERE s.code=${code} AND e.teacher_id=${teacherId} ORDER BY s.submitted_at DESC`;
  return rows.map(r => ({ ...dbToStudent(r), examTitle: r.exam_title, examSubject: r.exam_subject, examCreated: r.exam_created }));
}
export async function hasStudentResult(code, examId) {
  const sql = getDb();
  const rows = await sql`SELECT id FROM students WHERE code=${code} AND exam_id=${examId} LIMIT 1`;
  return !!rows[0];
}
// kind 'textbook' — бүх сурагчид (admin); 'material' — тухайн багшийн сурагчид
export async function getMaterials({ kind, teacherId }) {
  const sql = getDb();
  const rows = kind === 'textbook'
    ? await sql`SELECT id,teacher_id,kind,subject,title,url,size,class,created_at,exam_id FROM materials WHERE kind='textbook' ORDER BY subject, created_at DESC`
    : await sql`SELECT id,teacher_id,kind,subject,title,url,size,class,created_at,exam_id FROM materials WHERE kind='material' AND teacher_id=${teacherId} AND deleted_at IS NULL ORDER BY created_at DESC`;
  return rows.map(dbToMaterial);
}
// Дасгалын төвийн шалгалтын материал (lib/cmsso.js): шалгалт бүрд нэг удаа — ижил шалгалтыг дахин үүсгэхэд давхардуулахгүй.
// docs: [{ id, title, subject, size, body, token, url }] → нэмсэн тоо
export async function addExamMaterials(teacherId, examId, docs) {
  const sql = getDb();
  const has = await sql`SELECT 1 FROM materials WHERE teacher_id=${teacherId} AND exam_id=${examId} LIMIT 1`;
  if (has.length) return 0;
  for (const m of docs) {
    await sql`INSERT INTO materials (id,teacher_id,kind,subject,title,url,size,class,exam_id,body,token)
      VALUES (${m.id},${teacherId},'material',${m.subject||''},${m.title},${m.url},${m.size||null},'',${examId},${m.body},${m.token})`;
  }
  return docs.length;
}
// Онлайн шалгалтын бодлого (lib/paper.js): тухайн шалгалтын материалын бүх хэсэг (gzip JSON)
export async function getExamPaperRows(examId, teacherId) {
  const sql = getDb();
  return await sql`SELECT body FROM materials WHERE exam_id=${examId} AND teacher_id=${teacherId} AND body IS NOT NULL AND deleted_at IS NULL ORDER BY title`;
}
// Багш онлайн бодлогыг нээх/хаах → шинэ утга | null (шалгалт олдохгүй)
export async function setExamPaperOpen(id, teacherId, open) {
  const sql = getDb();
  const rows = await sql`UPDATE exams SET paper_open=${!!open} WHERE id=${id} AND teacher_id=${teacherId} RETURNING paper_open`;
  return rows[0] ? !!rows[0].paper_open : null;
}
export async function getExamMaterial(id) {
  const sql = getDb();
  const rows = await sql`SELECT title, body, token FROM materials WHERE id=${id} AND exam_id IS NOT NULL AND body IS NOT NULL AND deleted_at IS NULL LIMIT 1`;
  return rows[0] || null;
}
export async function createMaterial(m) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO materials (id,teacher_id,kind,subject,title,url,size,class)
    VALUES (${m.id},${m.teacherId||null},${m.kind},${m.subject||''},${m.title},${m.url},${m.size||null},${m.class||''})
    RETURNING *`;
  return dbToMaterial(rows[0]);
}
// Багш өөрийн материалыг «устгавал» нуугдана (deleted_at, файл нь хэвээр — админы архив, lib/tpaper.js); admin сурах бичгийг
// бүр мөсөн устгана → { …мөр, archived } (archived биш бол дуудагч файлыг нь устгана)
export async function deleteMaterial(id, teacherId, isAdmin) {
  const sql = getDb();
  const soft = await sql`UPDATE materials SET deleted_at=NOW() WHERE id=${id} AND teacher_id=${teacherId} AND kind='material' AND deleted_at IS NULL
    RETURNING id,teacher_id,kind,subject,title,url,size,class,created_at,exam_id`;
  if (soft[0]) return { ...dbToMaterial(soft[0]), archived: true };
  if (!isAdmin) return null;
  const rows = await sql`DELETE FROM materials WHERE id=${id} AND kind='textbook' RETURNING id,teacher_id,kind,subject,title,url,size,class,created_at,exam_id`;
  return rows[0] ? dbToMaterial(rows[0]) : null;
}
export async function getGoals(studentId) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM student_goals WHERE student_id=${studentId}`;
  const r = rows[0];
  return { targets: r?.targets || {}, university: r?.university || '', major: r?.major || '' };
}
export async function saveGoals(studentId, g) {
  const sql = getDb();
  await sql`
    INSERT INTO student_goals (student_id,targets,university,major,updated_at)
    VALUES (${studentId},${JSON.stringify(g.targets||{})},${g.university||''},${g.major||''},NOW())
    ON CONFLICT (student_id) DO UPDATE SET targets=${JSON.stringify(g.targets||{})}, university=${g.university||''}, major=${g.major||''}, updated_at=NOW()`;
}
export async function getSetting(key) {
  const sql = getDb();
  const rows = await sql`SELECT value FROM app_settings WHERE key=${key}`;
  return rows[0] ? rows[0].value : null;
}
export async function setSetting(key, value) {
  const sql = getDb();
  await sql`INSERT INTO app_settings (key,value) VALUES (${key},${JSON.stringify(value)})
    ON CONFLICT (key) DO UPDATE SET value=${JSON.stringify(value)}`;
}

// ── Mappers ───────────────────────────────────────────────
function dbToExam(r) {
  return { id:r.id,teacherId:r.teacher_id,title:r.title,subject:r.subject,
    sec1Count:r.sec1_count,sec1Key:r.sec1_key,sec1Scores:r.sec1_scores,topics:r.topics,
    useSec2:r.use_sec2,sec2Config:r.sec2_config,sec2Score:r.sec2_score,createdAt:r.created_at,cmRef:r.cm_ref||null,
    variants:r.variants||null, paperOpen:!!r.paper_open };
}
function dbToStudent(r) {
  return { id:r.id,examId:r.exam_id,name:r.name,code:r.code,class:r.class,
    version:r.version,correct:r.correct,wrong:r.wrong,blank:r.blank,
    rawEarned:parseFloat(r.raw_earned),rawMax:parseFloat(r.raw_max),scaled:parseFloat(r.scaled),
    grade:r.grade,sec1Results:r.sec1_results,sec2Results:r.sec2_results,
    needsReview:r.needs_review,submittedAt:r.submitted_at };
}
function dbToMaterial(r) {
  return { id:r.id,teacherId:r.teacher_id,kind:r.kind,subject:r.subject,title:r.title,url:r.url,
    size:r.size!=null?Number(r.size):null,class:r.class,createdAt:r.created_at,examId:r.exam_id||null };
}
