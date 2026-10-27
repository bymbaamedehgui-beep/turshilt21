import { neon } from '@neondatabase/serverless';

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
  await sql`CREATE TABLE IF NOT EXISTS student_goals (
    student_id VARCHAR(50) PRIMARY KEY REFERENCES student_accounts(id) ON DELETE CASCADE,
    targets JSONB DEFAULT '{}',
    university VARCHAR(300),
    major VARCHAR(300),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(50) PRIMARY KEY, value JSONB)`;
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
}

// ── Teachers ──────────────────────────────────────────────
export async function getTeacherByEmail(email) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM teachers WHERE email = ${email}`;
  return rows[0] || null;
}
export async function getTeacherById(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM teachers WHERE id = ${id}`;
  return rows[0] || null;
}
export async function getAllTeachers() {
  const sql = getDb();
  // paid_until — eyeshcheck-ийн төлбөр ба Дасгалын төвийн эрхийн аль хожуу нь (accessUntil-тэй ижил; GREATEST нь NULL-ийг алгасна)
  return await sql`SELECT id,email,name,phone,status,is_admin,
      GREATEST(CASE WHEN paid_until > created_at THEN paid_until END, cm_paid_until) AS paid_until,cm_linked,created_at
    FROM teachers ORDER BY created_at DESC`;
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
// Эрхийн дуусах огноо: eyeshcheck-ийн төлбөр (paid_until) ба Дасгалын төв дээр төлсөн эрхийн (cm_paid_until) аль хожуу нь.
// paid_until <= created_at — Дасгалын төвөөр үүсгэсэн, eyeshcheck-д төлөөгүй багшийн тэмдэг (lib/cmsso.js createCmTeacher), огноо биш.
export function accessUntil(t) {
  if (!t) return null;
  const a = t.paid_until && !(t.created_at && new Date(t.paid_until) <= new Date(t.created_at)) ? new Date(t.paid_until) : null;
  const b = t.cm_paid_until ? new Date(t.cm_paid_until) : null;
  return a && b ? (a > b ? a : b) : (a || b);
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
export async function createPayment(p) {
  const sql = getDb();
  await sql`INSERT INTO teacher_payments (id, teacher_id, invoice_id, months, amount, status, qr)
    VALUES (${p.id}, ${p.teacherId}, ${p.invoiceId}, ${p.months}, ${p.amount}, 'pending', ${JSON.stringify(p.qr || {})})`;
}
export async function getPayment(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM teacher_payments WHERE id=${id}`;
  return rows[0] || null;
}
// Сүүлийн 30 минутад үүсгэсэн, төлөгдөөгүй ижил багцын нэхэмжлэх (давхар нэхэмжлэхээс сэргийлнэ)
export async function findOpenPayment(teacherId, months) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM teacher_payments WHERE teacher_id=${teacherId} AND months=${months} AND status='pending'
    AND created_at > NOW() - interval '30 minutes' ORDER BY created_at DESC LIMIT 1`;
  return rows[0] || null;
}
// Нэг нэхэмжлэхийг ЗӨВХӨН нэг удаа «төлсөн» болгоно; амжилттай бол багшийн эрхийг сунгана
export async function markPaidAndExtend(paymentId) {
  const sql = getDb();
  const done = await sql`UPDATE teacher_payments SET status='paid', paid_at=NOW() WHERE id=${paymentId} AND status='pending' RETURNING *`;
  if (!done[0]) return null;
  const p = done[0];
  // Дасгалын төвийн эрх (cm_paid_until) үлдсэн бол түүний дараагаас сунгана — хоёр төлбөр давхцахгүй
  const rows = await sql`UPDATE teachers SET status = CASE WHEN status='disabled' THEN status ELSE 'active' END,
      paid_until = GREATEST(COALESCE(paid_until, NOW()), COALESCE(cm_paid_until, NOW()), NOW()) + make_interval(months => ${p.months}::int)
    WHERE id=${p.teacher_id} RETURNING id, email, name, paid_until`;
  return { payment: p, teacher: rows[0] || null };
}
export async function extendTeacher(id, months) {
  const sql = getDb();
  const rows = await sql`UPDATE teachers SET paid_until = GREATEST(COALESCE(paid_until, NOW()), COALESCE(cm_paid_until, NOW()), NOW()) + make_interval(months => ${months}::int)
    WHERE id=${id} RETURNING paid_until`;
  return rows[0]?.paid_until || null;
}
export async function updateTeacherStatus(id, status) {
  const sql = getDb();
  await sql`UPDATE teachers SET status=${status} WHERE id=${id}`;
}
export async function deleteTeacher(id) {
  const sql = getDb();
  await sql`DELETE FROM teachers WHERE id=${id}`;
}

// ── Exams ─────────────────────────────────────────────────
export async function getExams(teacherId) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM exams WHERE teacher_id=${teacherId} ORDER BY created_at DESC`;
  return rows.map(dbToExam);
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
    INSERT INTO exams (id,teacher_id,title,subject,sec1_count,sec1_key,sec1_scores,topics,use_sec2,sec2_config,sec2_score,created_at)
    VALUES (${exam.id},${teacherId},${exam.title},${exam.subject},${exam.sec1Count},
      ${JSON.stringify(exam.sec1Key)},${JSON.stringify(exam.sec1Scores)},
      ${JSON.stringify(exam.topics)},${exam.useSec2},
      ${JSON.stringify(exam.sec2Config||{})},${exam.sec2Score||1},
      ${exam.createdAt||new Date().toISOString()})
    RETURNING *`;
  return dbToExam(rows[0]);
}
export async function updateExam(id, exam, teacherId) {
  const sql = getDb();
  const rows = await sql`
    UPDATE exams SET title=${exam.title},subject=${exam.subject},sec1_count=${exam.sec1Count},
      sec1_key=${JSON.stringify(exam.sec1Key)},sec1_scores=${JSON.stringify(exam.sec1Scores)},
      topics=${JSON.stringify(exam.topics)},use_sec2=${exam.useSec2},
      sec2_config=${JSON.stringify(exam.sec2Config||{})},sec2_score=${exam.sec2Score||1}
    WHERE id=${id} AND teacher_id=${teacherId} RETURNING *`;
  return rows[0] ? dbToExam(rows[0]) : null;
}
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
    ? await sql`SELECT * FROM materials WHERE kind='textbook' ORDER BY subject, created_at DESC`
    : await sql`SELECT * FROM materials WHERE kind='material' AND teacher_id=${teacherId} ORDER BY created_at DESC`;
  return rows.map(dbToMaterial);
}
export async function createMaterial(m) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO materials (id,teacher_id,kind,subject,title,url,size,class)
    VALUES (${m.id},${m.teacherId||null},${m.kind},${m.subject||''},${m.title},${m.url},${m.size||null},${m.class||''})
    RETURNING *`;
  return dbToMaterial(rows[0]);
}
// Багш өөрийн материалыг, admin сурах бичгийг устгана → устгасан мөр (файлыг нь устгахад)
export async function deleteMaterial(id, teacherId, isAdmin) {
  const sql = getDb();
  const rows = isAdmin
    ? await sql`DELETE FROM materials WHERE id=${id} AND (teacher_id=${teacherId} OR kind='textbook') RETURNING *`
    : await sql`DELETE FROM materials WHERE id=${id} AND teacher_id=${teacherId} AND kind='material' RETURNING *`;
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
    useSec2:r.use_sec2,sec2Config:r.sec2_config,sec2Score:r.sec2_score,createdAt:r.created_at };
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
    size:r.size!=null?Number(r.size):null,class:r.class,createdAt:r.created_at };
}
