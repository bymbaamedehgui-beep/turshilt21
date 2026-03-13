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
    sec2_score INTEGER DEFAULT 5,
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
  return await sql`SELECT id,email,name,status,is_admin,created_at FROM teachers ORDER BY created_at DESC`;
}
export async function createTeacher({ id, email, passwordHash, name }) {
  const sql = getDb();
  // First teacher ever becomes admin + active automatically
  const count = await sql`SELECT COUNT(*) as c FROM teachers`;
  const isFirst = parseInt(count[0].c) === 0;
  const rows = await sql`
    INSERT INTO teachers (id, email, password_hash, name, status, is_admin)
    VALUES (${id}, ${email}, ${passwordHash}, ${name||''}, ${isFirst?'active':'pending'}, ${isFirst})
    RETURNING *`;
  return rows[0];
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
      ${JSON.stringify(exam.sec2Config||{})},${exam.sec2Score||5},
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
      sec2_config=${JSON.stringify(exam.sec2Config||{})},sec2_score=${exam.sec2Score||5}
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
export async function createStudent(s) {
  const sql = getDb();
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
export async function deleteStudent(id) {
  const sql = getDb();
  await sql`DELETE FROM students WHERE id=${id}`;
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
export async function deleteStudentAccount(id) {
  const sql = getDb();
  await sql`DELETE FROM student_accounts WHERE id=${id}`;
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
