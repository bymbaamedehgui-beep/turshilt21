// «ЭЕШ сан» (эзэмшигч 2026-11-20): хичээл бүрийн ЭЕШ-ийн албан ёсны даалгавар (он × хувилбар) + зөв хариу.
// Багш сангаас сонгоход хариутай шалгалт үүсэж (exams.cm_ref = 'bank:<id>' — нэг багшид давхардахгүй), хэвлэх материал
// (PDF — Vercel Blob, эсвэл Дасгалын төвийн HTML — lib/cmsso.js parseMaterial хэлбэр) шалгалтад хавсарна. HTML материалтай
// (математик) бол онлайн шалгалт (exams.paper_open, lib/paper.js) шууд ажиллана.
// Эрх: ey_licenses-ийн BANK «хичээл» (lib/plans.js) — «ЭЕШ сан» багц сард 29,900₮ (бүх хичээлийн эрхтэй хамт, pay/create.js).
// Зөвхөн сервер. Сан руу зөвхөн admin нэмнэ (pages/api/admin/eesh.js).
import crypto from 'crypto';
import zlib from 'zlib';
import { neon } from '@neondatabase/serverless';
import { addExamMaterials, setExamPaperOpen } from './db';
import { parseMaterial } from './cmsso';
import { BANK, BANK_SUBJECTS } from './plans';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
const rid = p => p + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
const randToken = () => crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let ready = null;
export function ensureBank() {
  if (!ready) {
    ready = (async function () {
      const sql = getDb();
      await sql`CREATE TABLE IF NOT EXISTS eesh_bank (
        id VARCHAR(50) PRIMARY KEY,
        subject VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        variant VARCHAR(10) NOT NULL DEFAULT 'A',
        title VARCHAR(200) NOT NULL,
        exam JSONB NOT NULL,
        pdf_url TEXT,
        pdf_size BIGINT,
        material TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (subject, year, variant)
      )`;
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}

// ── Шалгалтын загвар (сангийн exam JSON) ─────────────────────────────────────
// { sec1Count, sec1Key:[A–E], sec1Scores:[0–10], topics:[текст], useSec2, sec2Config:{ '2.1':{ _enabled, a:{ans,score} … } … } }
const SUBS = ['2.1', '2.2', '2.3', '2.4'], ROWS = 'abcdefgh'.split('');
const num = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
function normSec2(c) {
  if (!c || typeof c !== 'object') return null;
  const out = {};
  for (const s of SUBS) {
    const cs = c[s];
    if (!cs || typeof cs !== 'object') return null;
    const o = { _enabled: cs._enabled === true };
    for (const r of ROWS) {
      const v = cs[r];
      if (!v || typeof v !== 'object' || !/^[0-9.\-]?$/.test(String(v.ans)) || !num(v.score, 0, 10)) return null;
      o[r] = { ans: String(v.ans), score: v.score };
    }
    out[s] = o;
  }
  return out;
}
export function normBankExam(x) {
  if (!x || typeof x !== 'object') return null;
  const n = x.sec1Count;
  if (!Number.isInteger(n) || n < 1 || n > 60) return null;
  if (!Array.isArray(x.sec1Key) || x.sec1Key.length !== n || !x.sec1Key.every(k => /^[A-E]$/.test(k))) return null;
  const sc = Array.isArray(x.sec1Scores) ? x.sec1Scores : x.sec1Key.map(() => 1);
  if (sc.length !== n || !sc.every(s => num(s, 0, 10))) return null;
  const tp = Array.isArray(x.topics) ? x.topics : x.sec1Key.map(() => 'Бусад');
  if (tp.length !== n || !tp.every(t => typeof t === 'string' && t.trim() && t.length <= 60)) return null;
  const useSec2 = x.useSec2 === true;
  const sec2Config = useSec2 ? normSec2(x.sec2Config) : {};
  if (!sec2Config) return null;
  return { sec1Count: n, sec1Key: x.sec1Key.slice(), sec1Scores: sc.slice(), topics: tp.map(t => t.trim()), useSec2, sec2Config, sec2Score: 1 };
}
// Админы оруулга → хадгалах мөр | { error }
export function normBankItem(b) {
  b = b || {};
  const subject = String(b.subject || '').trim();
  if (BANK_SUBJECTS.indexOf(subject) < 0) return { error: 'Хичээл буруу' };
  const year = parseInt(b.year, 10);
  if (!(year >= 2006 && year <= 2100)) return { error: 'Он буруу' };
  const variant = String(b.variant || 'A').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,4}$/.test(variant)) return { error: 'Хувилбар буруу (A, B, C …)' };
  const exam = normBankExam(b.exam);
  if (!exam) return { error: 'Зөв хариу (exam) буруу' };
  const title = String(b.title || `${subject} ЭЕШ ${year} · хувилбар ${variant}`).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  let pdfUrl = null;
  if (b.pdfUrl) {
    try { const u = new URL(String(b.pdfUrl)); if (u.protocol === 'https:') pdfUrl = u.toString(); } catch (e) {}
    if (!pdfUrl) return { error: 'PDF холбоос буруу' };
  }
  let material = null;
  if (b.material) {
    if (!parseMaterial(b.material)) return { error: 'HTML материал буруу' };
    material = String(b.material);
  }
  if (!pdfUrl && !material) return { error: 'Хэвлэх материал (PDF эсвэл HTML) байх ёстой' };
  return { subject, year, variant, title, exam, pdfUrl, pdfSize: Number(b.pdfSize) > 0 ? Math.round(Number(b.pdfSize)) : null, material };
}

// ── Сан ──────────────────────────────────────────────────────────────────
const META = row => ({ id: row.id, subject: row.subject, year: row.year, variant: row.variant, title: row.title,
  sec1Count: row.exam?.sec1Count || 0, useSec2: !!row.exam?.useSec2, pdf: !!row.has_pdf, html: !!row.has_html,
  active: row.active, updatedAt: row.updated_at });
// all — admin (идэвхгүй мөр ч)
export async function listBank({ all = false } = {}) {
  const sql = getDb();
  const rows = all
    ? await sql`SELECT id, subject, year, variant, title, exam, pdf_url IS NOT NULL AS has_pdf, material IS NOT NULL AS has_html, active, updated_at
        FROM eesh_bank ORDER BY subject, year DESC, variant`
    : await sql`SELECT id, subject, year, variant, title, exam, pdf_url IS NOT NULL AS has_pdf, material IS NOT NULL AS has_html, active, updated_at
        FROM eesh_bank WHERE active ORDER BY subject, year DESC, variant`;
  return rows.map(META);
}
export async function getBankItem(id) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM eesh_bank WHERE id=${String(id || '')} LIMIT 1`;
  return rows[0] || null;
}
// (хичээл, он, хувилбар)-аар нэмэх эсвэл шинэчлэх → мөр
export async function upsertBankItem(it) {
  const sql = getDb();
  const rows = await sql`INSERT INTO eesh_bank (id, subject, year, variant, title, exam, pdf_url, pdf_size, material)
    VALUES (${rid('b')}, ${it.subject}, ${it.year}, ${it.variant}, ${it.title}, ${JSON.stringify(it.exam)}, ${it.pdfUrl}, ${it.pdfSize}, ${it.material})
    ON CONFLICT (subject, year, variant) DO UPDATE SET title=EXCLUDED.title, exam=EXCLUDED.exam,
      pdf_url=COALESCE(EXCLUDED.pdf_url, eesh_bank.pdf_url), pdf_size=COALESCE(EXCLUDED.pdf_size, eesh_bank.pdf_size),
      material=COALESCE(EXCLUDED.material, eesh_bank.material), active=true, updated_at=NOW()
    RETURNING id, subject, year, variant, title, exam, pdf_url IS NOT NULL AS has_pdf, material IS NOT NULL AS has_html, active, updated_at`;
  return META(rows[0]);
}
export async function setBankActive(id, active) {
  const sql = getDb();
  const rows = await sql`UPDATE eesh_bank SET active=${!!active}, updated_at=NOW() WHERE id=${String(id || '')} RETURNING id`;
  return rows.length > 0;
}
export async function deleteBankItem(id) {
  const sql = getDb();
  const rows = await sql`DELETE FROM eesh_bank WHERE id=${String(id || '')} RETURNING pdf_url`;
  return rows[0] || null;
}

// ── Эрх ──────────────────────────────────────────────────────────────────
// ЭЕШ сангийн эрхийн дуусах огноо (Date | null). ey_licenses-ийг lib/db.js initDb үүсгэнэ (дуудагч initDb-г түрүүлж дуудна).
export async function bankUntil(teacherId) {
  const sql = getDb();
  const r = await sql`SELECT MAX(until) AS u FROM ey_licenses WHERE owner=${'t:' + teacherId} AND subject=${BANK}`;
  return r[0] && r[0].u ? new Date(r[0].u) : null;
}

// ── Сангаас шалгалт үүсгэх ──────────────────────────────────────────────────
// → { examId, created, online } — ижил сангийн мөрөөр өмнө үүсгэсэн бол тэр шалгалтыг буцаана (давхардуулахгүй).
// online — HTML материалтай бол сурагчдад онлайн бодлогыг нээнэ (PDF-тэйд одоогоор хэвлэх л).
export async function createBankExam(teacherId, item, { online = false } = {}) {
  const sql = getDb();
  const ex = normBankExam(item.exam);
  if (!ex) throw new Error('Сангийн шалгалт буруу');
  const ref = 'bank:' + item.id, id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ins = await sql`
    INSERT INTO exams (id, teacher_id, title, subject, sec1_count, sec1_key, sec1_scores, topics, use_sec2, sec2_config, sec2_score, created_at, cm_ref)
    VALUES (${id}, ${teacherId}, ${item.title}, ${item.subject}, ${ex.sec1Count}, ${JSON.stringify(ex.sec1Key)}, ${JSON.stringify(ex.sec1Scores)},
      ${JSON.stringify(ex.topics)}, ${ex.useSec2}, ${JSON.stringify(ex.sec2Config)}, ${ex.sec2Score}, ${new Date().toISOString()}, ${ref})
    ON CONFLICT (teacher_id, cm_ref) WHERE cm_ref IS NOT NULL DO NOTHING RETURNING id`;
  const examId = ins[0] ? ins[0].id : ((await sql`SELECT id FROM exams WHERE teacher_id=${teacherId} AND cm_ref=${ref} LIMIT 1`)[0] || {}).id;
  if (!examId) throw new Error('Шалгалт үүсгэж чадсангүй');
  // Хэвлэх материал: PDF ба/эсвэл HTML — шалгалт бүрд нэг удаа (addExamMaterials давхардуулахгүй)
  const docs = [];
  if (item.pdf_url) docs.push({ id: rid('bk'), title: item.title + ' — даалгавар (PDF)', subject: item.subject, size: item.pdf_size || null,
    url: item.pdf_url, body: null, token: null });
  const html = item.material ? parseMaterial(item.material) : null;
  if (html) html.forEach(d => {
    const mid = rid('cm'), token = randToken(), raw = JSON.stringify(d);   // 'cm…' — /api/cm/material-ийн id шалгалт
    docs.push({ id: mid, token, title: d.title, subject: item.subject, size: Buffer.byteLength(raw),
      body: zlib.gzipSync(raw).toString('base64'), url: '/api/cm/material?id=' + mid + '&k=' + token });
  });
  if (docs.length) await addExamMaterials(teacherId, examId, docs);
  let open = false;
  if (online && html) open = !!(await setExamPaperOpen(examId, teacherId, true));
  return { examId, created: !!ins[0], online: open };
}
