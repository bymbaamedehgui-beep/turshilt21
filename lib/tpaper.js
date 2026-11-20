// Багшийн зохиосон онлайн шалгалт («Онлайн шалгалт зохиох», components/PaperEditor.js; эзэмшигч 2026-11-20).
// ey_papers.doc — бодлогын эх: текст + LaTeX томьёо (lib/mathText.js), зураг (data URL), 5 сонголт, зөв хариу, оноо, агуулга;
// 2-р хэсэг — нүдтэй ([[a]], [[bc]]) бодлого. Багш устгасан ч мөр deleted_at-тай ҮЛДЭНЭ — админы архив (pages/api/admin/archive.js).
// Хадгалах бүрт: хариутай шалгалт (exams.cm_ref 'paper:<id>' — уншуулах, дүн, анализ хуучнаараа) + онлайн/хэвлэх материал
// (materials 'cmtp…' — lib/paper.js, lib/paperClient.js-ийн бүтэцтэй HTML: div.e00-q[data-n] 1-р хэсэг, div.q[data-k] 2-р хэсэг).
// Зөвхөн сервер.
import crypto from 'crypto';
import zlib from 'zlib';
import { neon } from '@neondatabase/serverless';
import { mathHtml, mathErrors, boxLetters, esc } from './mathText';
import { SUBJECTS } from './plans';
import { setExamPaperOpen } from './db';

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
const rid = p => p + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
const randToken = () => crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let ready = null;
export function ensurePapers() {
  if (!ready) {
    ready = (async function () {
      const sql = getDb();
      // teacher_id-д FK байхгүй — багшийн данс устсан ч архив үлдэнэ
      await sql`CREATE TABLE IF NOT EXISTS ey_papers (
        id VARCHAR(50) PRIMARY KEY,
        teacher_id VARCHAR(50) NOT NULL,
        title VARCHAR(300) NOT NULL,
        subject VARCHAR(100) NOT NULL,
        doc JSONB NOT NULL,
        exam_id VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`;
      await sql`CREATE INDEX IF NOT EXISTS ey_papers_teacher ON ey_papers (teacher_id, updated_at DESC)`;
      // Зургаас таних (pages/api/paper-ocr.js) өдрийн тоо: багш бүр + нийт ('*')
      await sql`CREATE TABLE IF NOT EXISTS ey_ocr_use (teacher_id VARCHAR(50) NOT NULL, day DATE NOT NULL, n INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (teacher_id, day))`;
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}

// ── Шалгах ──────────────────────────────────────────────────────────────
// doc = { v:1, p1:[{ q, img, o:[5], a:'A'–'E', s, t }], p2:[{ q, img, ans:{ a:'3', … }, s }] } — s нь оноо (2-р хэсэгт нүд бүрийн)
export const LIMITS = { p1: 60, p2: 4, q: 6000, o: 800, img: 700000, total: 3800000 };
const IMG_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const clean = (s, max) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
const score = v => { const x = Number(v); return isFinite(x) && x >= 0.5 && x <= 10 ? Math.round(x * 100) / 100 : 1; };
function image(v) {
  if (v == null || v === '') return null;
  const s = String(v);
  return s.length <= LIMITS.img && IMG_RE.test(s) ? s : undefined;   // undefined — буруу
}
// Клиентийн оруулга → { title, subject, doc } | { error }
export function normPaper(b) {
  b = b || {};
  const title = clean(b.title, 400).replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!title) return { error: 'Шалгалтын нэрээ бичнэ үү' };
  const subject = String(b.subject || '').trim();
  if (SUBJECTS.indexOf(subject) < 0) return { error: 'Хичээлээ сонгоно уу' };
  const d = b.doc && typeof b.doc === 'object' ? b.doc : {};
  const p1in = Array.isArray(d.p1) ? d.p1 : [], p2in = Array.isArray(d.p2) ? d.p2 : [];
  if (!p1in.length) return { error: '1-р хэсэгт дор хаяж нэг бодлого нэмнэ үү' };
  if (p1in.length > LIMITS.p1) return { error: `1-р хэсэгт ${LIMITS.p1} хүртэл бодлого оруулна` };
  if (p2in.length > LIMITS.p2) return { error: `2-р хэсэгт ${LIMITS.p2} хүртэл бодлого оруулна` };
  const p1 = [], p2 = [];
  for (let i = 0; i < p1in.length; i++) {
    const x = p1in[i] && typeof p1in[i] === 'object' ? p1in[i] : {}, n = i + 1;
    const q = clean(x.q, LIMITS.q + 1);
    if (q.length > LIMITS.q) return { error: `${n}-р бодлогын текст хэт урт` };
    const img = image(x.img);
    if (img === undefined) return { error: `${n}-р бодлогын зураг буруу эсвэл хэт том` };
    if (!q.trim() && !img) return { error: `${n}-р бодлого хоосон байна` };
    const o = [];
    for (let j = 0; j < 5; j++) {
      const v = clean(Array.isArray(x.o) ? x.o[j] : '', LIMITS.o + 1);
      if (v.length > LIMITS.o) return { error: `${n}-р бодлогын ${'ABCDE'[j]} сонголт хэт урт` };
      o.push(v);
    }
    const a = String(x.a || '').trim().toUpperCase();
    if (!/^[A-E]$/.test(a)) return { error: `${n}-р бодлогын зөв хариуг сонгоно уу` };
    const t = clean(x.t, 200).replace(/\s+/g, ' ').trim().slice(0, 60) || 'Бусад';
    p1.push({ q, img, o, a, s: score(x.s), t });
  }
  for (let i = 0; i < p2in.length; i++) {
    const x = p2in[i] && typeof p2in[i] === 'object' ? p2in[i] : {}, sub = '2.' + (i + 1);
    const q = clean(x.q, LIMITS.q + 1);
    if (q.length > LIMITS.q) return { error: `${sub} бодлогын текст хэт урт` };
    const img = image(x.img);
    if (img === undefined) return { error: `${sub} бодлогын зураг буруу эсвэл хэт том` };
    const ls = boxLetters(q);
    if (!ls.length) return { error: `${sub}: хариултын нүд алга — нүдийг [[a]], [[bc]] гэж бичнэ` };
    const dup = ls.find((l, k) => ls.indexOf(l) !== k);
    if (dup) return { error: `${sub}: «${dup}» нүд давхацсан` };
    const ans = {}, src = x.ans && typeof x.ans === 'object' ? x.ans : {};
    for (const l of ls) {
      const v = String(src[l] == null ? '' : src[l]).trim();
      if (!/^[0-9.\-]$/.test(v)) return { error: `${sub}: «${l}» нүдний хариуг (0–9, «-», «.») оруулна уу` };
      ans[l] = v;
    }
    p2.push({ q, img, ans, s: score(x.s) });
  }
  // Томьёо бүр KaTeX-ээр алдаагүй (сурагчийн дэлгэц, хэвлэлт эвдрэхгүй)
  const bad = (t, where) => { const e = mathErrors(t); return e.length ? { error: `${where} томьёо алдаатай: ${e[0].msg}` } : null; };
  for (let i = 0; i < p1.length; i++) {
    const e = bad(p1[i].q, `${i + 1}-р бодлогын`) || p1[i].o.reduce((r, v, j) => r || bad(v, `${i + 1}-р бодлогын ${'ABCDE'[j]} сонголтын`), null);
    if (e) return e;
  }
  for (let i = 0; i < p2.length; i++) { const e = bad(p2[i].q, `2.${i + 1} бодлогын`); if (e) return e; }
  const doc = { v: 1, p1, p2 };
  if (JSON.stringify(doc).length > LIMITS.total) return { error: 'Зураг хэт их байна — цөөлөх эсвэл жижигрүүлнэ үү' };
  return { title, subject, doc };
}

// ── Шалгалт ба материал ──────────────────────────────────────────────────
const SUBS = ['2.1', '2.2', '2.3', '2.4'], ROWS = 'abcdefgh'.split(''), LET = 'ABCDE';
export function examFields(p) {
  const { p1, p2 } = p.doc, sec2Config = {};
  if (p2.length) SUBS.forEach((sub, i) => {
    const x = p2[i], c = { _enabled: !!x };
    ROWS.forEach(r => { c[r] = { ans: x && x.ans[r] != null ? x.ans[r] : '', score: x ? x.s : 1 }; });
    sec2Config[sub] = c;
  });
  return { title: p.title, subject: p.subject, sec1Count: p1.length, sec1Key: p1.map(x => x.a), sec1Scores: p1.map(x => x.s),
    topics: p1.map(x => x.t), useSec2: p2.length > 0, sec2Config, sec2Score: 1 };
}
const fmtNum = n => String(Math.round(n * 100) / 100);
const fig = src => src ? '<div class="fig"><img src="' + src + '" alt="" style="max-width:100%;height:auto"></div>' : '';
// Сонголтын баганын тоо: богино — 5 багана, дунд — 2, урт/томьёо мөртэй — 1
function optCls(o) {
  if (o.some(v => /\$\$|\n/.test(v))) return ' w';
  const m = Math.max(...o.map(v => v.replace(/\\[a-zA-Z]+/g, '').replace(/[{}$^_\\]/g, '').length));
  return m <= 14 ? '' : m <= 40 ? ' l' : ' w';
}
export function paperSheetHtml(p) {
  const { p1, p2 } = p.doc;
  const total = p1.reduce((a, x) => a + x.s, 0) + p2.reduce((a, x) => a + x.s * Object.keys(x.ans).length, 0);
  let h = '<div class="tp-head"><h1>' + esc(p.title) + '</h1><div class="tp-meta">' + esc(p.subject) + ' · ' + (p1.length + p2.length)
    + ' бодлого · ' + fmtNum(total) + ' оноо</div><div class="tp-who"><span>Нэр: <i></i></span><span>Анги: <i></i></span><span>Код: <i></i></span></div></div>';
  if (p2.length) h += '<div class="tp-sec">1-р хэсэг</div>';
  p1.forEach((x, i) => {
    h += '<div class="e00-q" data-n="' + (i + 1) + '"><div class="qh"><b class="qn">' + (i + 1) + '.</b><div class="qm">' + mathHtml(x.q) + '</div>'
      + '<span class="e00-pts">' + fmtNum(x.s) + ' оноо</span></div>' + fig(x.img)
      + (x.o.some(v => v.trim()) ? '<div class="e00-opts' + optCls(x.o) + '">'
        + x.o.map((v, j) => '<div class="e00-o"><b>' + LET[j] + '.</b> <span class="e00-ov">' + mathHtml(v) + '</span></div>').join('') + '</div>' : '')
      + '</div>';
  });
  if (p2.length) {
    h += '<div class="tp-sec">2-р хэсэг</div>';
    p2.forEach((x, k) => {
      h += '<div class="q" data-k="' + k + '"><div class="qh"><b class="qn">2.' + (k + 1) + '.</b><div class="qm"><div class="stmt">' + mathHtml(x.q) + '</div>'
        + fig(x.img) + '</div><span class="e00-pts">' + fmtNum(x.s * Object.keys(x.ans).length) + ' оноо</span></div></div>';
    });
  }
  return h;
}
export function paperKeyHtml(p) {
  const { p1, p2 } = p.doc;
  let rows = '';
  for (let i = 0; i < p1.length; i += 10) rows += '<tr>' + p1.slice(i, i + 10).map((x, j) => '<td><b>' + (i + j + 1) + '.</b> ' + x.a + '</td>').join('') + '</tr>';
  const s2 = p2.map((x, k) => '<div><b>2.' + (k + 1) + '</b> ' + Object.keys(x.ans).map(l => l + ' = ' + esc(x.ans[l])).join(', ') + '</div>').join('');
  return '<div class="tp-head"><h1>Хариуны түлхүүр — ' + esc(p.title) + '</h1></div><table class="tp-kt">' + rows + '</table>'
    + (s2 ? '<div class="tp-k2">' + s2 + '</div>' : '');
}
const TP_CSS = '@page{size:A4;margin:12mm}'
  + '.sheet.tp{box-sizing:border-box;width:210mm;min-height:297mm;margin:0 auto;padding:13mm 14mm;background:#fff;color:#111;font:12pt/1.5 "Times New Roman",Times,serif}'
  + '.tp .tp-head{border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:10px}'
  + '.tp h1{font:700 15pt/1.25 Arial,sans-serif;margin:0}.tp .tp-meta{font:10pt Arial,sans-serif;color:#444;margin-top:2px}'
  + '.tp .tp-who{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:8px;font:10.5pt Arial,sans-serif}'
  + '.tp .tp-who i{display:inline-block;width:42mm;border-bottom:1px solid #555;vertical-align:bottom}'
  + '.tp .tp-who span:nth-child(n+2) i{width:20mm}'
  + '.tp .tp-sec{font:700 11.5pt Arial,sans-serif;margin:12px 0 6px;padding:3px 8px;background:#f0eefa;border-left:4px solid #6d4fd8}'
  + '.tp .e00-q,.tp .q{break-inside:avoid;page-break-inside:avoid;margin:0 0 11px}'
  + '.tp .qh{display:flex;gap:6px;align-items:baseline}.tp .qn{flex:none;min-width:1.7em}.tp .qm{flex:1;min-width:0}'
  + '.tp .e00-pts{flex:none;font:9pt Arial,sans-serif;color:#666;margin-left:8px;white-space:nowrap}'
  + '.tp .fig{text-align:center;margin:5px 0}.tp .fig img{max-height:75mm}'
  + '.tp .e00-opts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px 12px;margin:5px 0 0 1.7em}'
  + '.tp .e00-opts.l{grid-template-columns:repeat(2,minmax(0,1fr))}.tp .e00-opts.w{grid-template-columns:1fr}'
  + '.tp .e00-o{display:flex;gap:5px;align-items:baseline;min-width:0}.tp .e00-ov{min-width:0}'
  + '.tp .bx{display:inline-block;min-width:1.25em;padding:0 .2em;margin:0 .08em;border:1.3px solid #333;border-radius:3px;text-align:center;font-style:italic;line-height:1.2}'
  + '.tp .bf{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 .2em;line-height:1.2}'
  + '.tp .bf>.n{border-bottom:1px solid #333;padding:0 .15em 2px}.tp .bf>.d{padding:2px .15em 0}'
  + '.tp .mt-d{margin:4px 0}.tp .mt-err{color:#b3261e;font-family:monospace}'
  + '.tp .katex{font-size:1.08em}'
  + '.tp .tp-kt{border-collapse:collapse;width:100%;font:11pt Arial,sans-serif}.tp .tp-kt td{border:1px solid #bbb;padding:5px 8px}'
  + '.tp .tp-k2{margin-top:12px;font:11pt/1.7 Arial,sans-serif}'
  + '@media print{.sheet.tp{width:auto;min-height:0;padding:0}}';
// /api/cm/material ба онлайн шалгалтын (lib/paper.js paperDocs) нэг баримт
export function materialDoc(p) {
  return { part: 0, n: 1, title: p.title, cls: 'tp', css: TP_CSS, sheets: [{ L: 'A', label: '', html: paperSheetHtml(p) }], key: paperKeyHtml(p) };
}

async function upsertExam(sql, teacherId, pid, examId, f) {
  if (examId) {
    const r = await sql`UPDATE exams SET title=${f.title}, subject=${f.subject}, sec1_count=${f.sec1Count}, sec1_key=${JSON.stringify(f.sec1Key)},
        sec1_scores=${JSON.stringify(f.sec1Scores)}, topics=${JSON.stringify(f.topics)}, use_sec2=${f.useSec2},
        sec2_config=${JSON.stringify(f.sec2Config)}, sec2_score=${f.sec2Score}
      WHERE id=${examId} AND teacher_id=${teacherId} RETURNING id`;
    if (r[0]) return r[0].id;
  }
  // шалгалтыг багш устгасан бол шинээр (ижил cm_ref-тэй мөр байвал түүнийг шинэчилнэ)
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36), ref = 'paper:' + pid;
  const r = await sql`INSERT INTO exams (id, teacher_id, title, subject, sec1_count, sec1_key, sec1_scores, topics, use_sec2, sec2_config, sec2_score, created_at, cm_ref)
    VALUES (${id}, ${teacherId}, ${f.title}, ${f.subject}, ${f.sec1Count}, ${JSON.stringify(f.sec1Key)}, ${JSON.stringify(f.sec1Scores)},
      ${JSON.stringify(f.topics)}, ${f.useSec2}, ${JSON.stringify(f.sec2Config)}, ${f.sec2Score}, ${new Date().toISOString()}, ${ref})
    ON CONFLICT (teacher_id, cm_ref) WHERE cm_ref IS NOT NULL DO UPDATE SET title=EXCLUDED.title, subject=EXCLUDED.subject,
      sec1_count=EXCLUDED.sec1_count, sec1_key=EXCLUDED.sec1_key, sec1_scores=EXCLUDED.sec1_scores, topics=EXCLUDED.topics,
      use_sec2=EXCLUDED.use_sec2, sec2_config=EXCLUDED.sec2_config
    RETURNING id`;
  return r[0].id;
}
// Шалгалтын «cmtp…» материал: байвал шинэчилнэ (холбоос нь хэвээр), үгүй бол нэмнэ → хэвлэх холбоос
async function upsertMaterial(sql, teacherId, examId, p) {
  const raw = JSON.stringify(materialDoc(p)), body = zlib.gzipSync(raw).toString('base64'), size = Buffer.byteLength(raw), title = p.title + ' — бодлого';
  const old = (await sql`SELECT id, url FROM materials WHERE exam_id=${examId} AND teacher_id=${teacherId} AND id LIKE 'cmtp%' LIMIT 1`)[0];
  if (old) {
    await sql`UPDATE materials SET title=${title}, subject=${p.subject}, size=${size}, body=${body}, deleted_at=NULL WHERE id=${old.id}`;
    return old.url;
  }
  const id = rid('cmtp'), token = randToken(), url = '/api/cm/material?id=' + id + '&k=' + token;
  await sql`INSERT INTO materials (id, teacher_id, kind, subject, title, url, size, class, exam_id, body, token)
    VALUES (${id}, ${teacherId}, 'material', ${p.subject}, ${title}, ${url}, ${size}, '', ${examId}, ${body}, ${token})`;
  return url;
}

// ── Багшийн жагсаалт, хадгалах, устгах ──────────────────────────────────────
const META = r => ({ id: r.id, title: r.title, subject: r.subject, examId: r.exam_id || null, n1: Number(r.n1) || 0, n2: Number(r.n2) || 0,
  createdAt: r.created_at, updatedAt: r.updated_at });
// open — онлайн бодлого нээлттэй, hasExam — шалгалт нь устаагүй, url — хэвлэх материал (/api/cm/material)
const STATE = r => ({ open: !!r.open, hasExam: !!r.has_exam, url: r.mat_url || null });
export async function listPapers(teacherId) {
  const sql = getDb();
  const rows = await sql`SELECT p.id, p.title, p.subject, p.exam_id, p.created_at, p.updated_at,
      jsonb_array_length(p.doc->'p1') AS n1, jsonb_array_length(p.doc->'p2') AS n2, COALESCE(e.paper_open, false) AS open, e.id IS NOT NULL AS has_exam,
      (SELECT m.url FROM materials m WHERE m.exam_id = p.exam_id AND m.teacher_id = p.teacher_id AND m.id LIKE 'cmtp%' AND m.deleted_at IS NULL LIMIT 1) AS mat_url
    FROM ey_papers p LEFT JOIN exams e ON e.id = p.exam_id AND e.teacher_id = p.teacher_id
    WHERE p.teacher_id=${teacherId} AND p.deleted_at IS NULL ORDER BY p.updated_at DESC LIMIT 300`;
  return rows.map(r => ({ ...META(r), ...STATE(r) }));
}
export async function getPaper(teacherId, id) {
  const sql = getDb();
  const r = (await sql`SELECT p.*, COALESCE(e.paper_open, false) AS open, e.id IS NOT NULL AS has_exam,
      jsonb_array_length(p.doc->'p1') AS n1, jsonb_array_length(p.doc->'p2') AS n2,
      (SELECT m.url FROM materials m WHERE m.exam_id = p.exam_id AND m.teacher_id = p.teacher_id AND m.id LIKE 'cmtp%' AND m.deleted_at IS NULL LIMIT 1) AS mat_url
    FROM ey_papers p LEFT JOIN exams e ON e.id = p.exam_id AND e.teacher_id = p.teacher_id
    WHERE p.id=${String(id || '')} AND p.teacher_id=${teacherId} AND p.deleted_at IS NULL`)[0];
  return r ? { ...META(r), ...STATE(r), doc: r.doc } : null;
}
export async function countPapers(teacherId) {
  const sql = getDb();
  const r = await sql`SELECT COUNT(*)::int AS c FROM ey_papers WHERE teacher_id=${teacherId} AND deleted_at IS NULL`;
  return r[0] ? r[0].c : 0;
}
// id — засвар (өөрийн, устгаагүй); open — онлайн бодлогыг нээх/хаах (өгөөгүй бол хэвээр) → { id, examId, open, url } | null.
// Эхийг ТҮРҮҮЛЖ хадгална: шалгалт/материал үүсгэхэд алдаа гарвал багшийн бичсэн нь алдагдахгүй (дахин хадгалахад гүйцнэ).
export async function savePaper(teacherId, id, p, { open } = {}) {
  const sql = getDb(), doc = JSON.stringify(p.doc);
  let cur = null;
  if (id) {
    cur = (await sql`UPDATE ey_papers SET title=${p.title}, subject=${p.subject}, doc=${doc}, updated_at=NOW()
      WHERE id=${String(id)} AND teacher_id=${teacherId} AND deleted_at IS NULL RETURNING id, exam_id`)[0];
    if (!cur) return null;
  } else {
    cur = (await sql`INSERT INTO ey_papers (id, teacher_id, title, subject, doc) VALUES (${rid('tp')}, ${teacherId}, ${p.title}, ${p.subject}, ${doc})
      RETURNING id, exam_id`)[0];
  }
  const examId = await upsertExam(sql, teacherId, cur.id, cur.exam_id, examFields(p));
  if (examId !== cur.exam_id) await sql`UPDATE ey_papers SET exam_id=${examId} WHERE id=${cur.id}`;
  const url = await upsertMaterial(sql, teacherId, examId, p);
  const isOpen = open === undefined ? null : await setExamPaperOpen(examId, teacherId, !!open);
  return { id: cur.id, examId, open: isOpen, url };
}
// Багшаас нуугдана (архивт үлдэнэ); онлайн бодлогыг хаана. Шалгалт (дүнтэй) хэвээр үлдэнэ.
export async function deletePaper(teacherId, id) {
  const sql = getDb();
  const r = (await sql`UPDATE ey_papers SET deleted_at=NOW() WHERE id=${String(id || '')} AND teacher_id=${teacherId} AND deleted_at IS NULL
    RETURNING exam_id`)[0];
  if (!r) return false;
  if (r.exam_id) {
    await sql`UPDATE materials SET deleted_at=NOW() WHERE exam_id=${r.exam_id} AND teacher_id=${teacherId} AND id LIKE 'cmtp%' AND deleted_at IS NULL`;
    await sql`UPDATE exams SET paper_open=false WHERE id=${r.exam_id} AND teacher_id=${teacherId}`;
  }
  return true;
}

// ── Зургаас таних хязгаар ─────────────────────────────────────────────────
// Өдрийн (Улаанбаатарын цагаар) тоог нэмнэ → шинэ тоо | null (хязгаарт хүрсэн)
export async function ocrTake(key, limit) {
  const sql = getDb();
  const r = await sql`INSERT INTO ey_ocr_use (teacher_id, day, n) VALUES (${key}, (NOW() AT TIME ZONE 'Asia/Ulaanbaatar')::date, 1)
    ON CONFLICT (teacher_id, day) DO UPDATE SET n = ey_ocr_use.n + 1 WHERE ey_ocr_use.n < ${limit} RETURNING n`;
  return r[0] ? r[0].n : null;
}
// API алдаа (таних боломжгүй байсан) — тоог буцаана
export async function ocrRefund(key) {
  const sql = getDb();
  await sql`UPDATE ey_ocr_use SET n = GREATEST(n - 1, 0) WHERE teacher_id=${key} AND day=(NOW() AT TIME ZONE 'Asia/Ulaanbaatar')::date`;
}

// ── Админы архив ─────────────────────────────────────────────────────────
const likeOf = q => '%' + String(q || '').toLowerCase().replace(/[%_\\]/g, m => '\\' + m) + '%';
export async function adminPapers({ q = '', limit = 100, offset = 0 } = {}) {
  const sql = getDb(), s = String(q || '').trim(), like = likeOf(s);
  const rows = await sql`SELECT p.id, p.title, p.subject, p.exam_id, p.created_at, p.updated_at, p.deleted_at, p.teacher_id,
      jsonb_array_length(p.doc->'p1') AS n1, jsonb_array_length(p.doc->'p2') AS n2, octet_length(p.doc::text) AS bytes,
      t.name AS teacher_name, t.email AS teacher_email
    FROM ey_papers p LEFT JOIN teachers t ON t.id = p.teacher_id
    WHERE ${s} = '' OR lower(p.title) LIKE ${like} OR lower(COALESCE(t.name, '')) LIKE ${like} OR lower(COALESCE(t.email, '')) LIKE ${like}
    ORDER BY p.updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rows.map(r => ({ ...META(r), deletedAt: r.deleted_at, teacherId: r.teacher_id, teacherName: r.teacher_name || '', teacherEmail: r.teacher_email || '',
    bytes: Number(r.bytes) || 0 }));
}
export async function adminPaper(id) {
  const sql = getDb();
  const r = (await sql`SELECT p.*, t.name AS teacher_name, t.email AS teacher_email FROM ey_papers p LEFT JOIN teachers t ON t.id = p.teacher_id
    WHERE p.id=${String(id || '')}`)[0];
  return r || null;
}
// Багш нарын материал (PDF, холбоос, шалгалтын материал) — устгасан нь ч
export async function adminMaterials({ q = '', limit = 100, offset = 0 } = {}) {
  const sql = getDb(), s = String(q || '').trim(), like = likeOf(s);
  const rows = await sql`SELECT m.id, m.title, m.subject, m.url, m.size, m.class, m.created_at, m.deleted_at, m.exam_id, m.body IS NOT NULL AS has_body,
      m.teacher_id, t.name AS teacher_name, t.email AS teacher_email
    FROM materials m LEFT JOIN teachers t ON t.id = m.teacher_id
    WHERE m.kind = 'material' AND (${s} = '' OR lower(m.title) LIKE ${like} OR lower(COALESCE(t.name, '')) LIKE ${like} OR lower(COALESCE(t.email, '')) LIKE ${like})
    ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rows.map(r => ({ id: r.id, title: r.title, subject: r.subject || '', url: r.has_body ? null : r.url, size: r.size ? Number(r.size) : null,
    class: r.class || '', createdAt: r.created_at, deletedAt: r.deleted_at, examId: r.exam_id || null, html: !!r.has_body,
    teacherId: r.teacher_id, teacherName: r.teacher_name || '', teacherEmail: r.teacher_email || '' }));
}
export async function adminMaterialDoc(id) {
  const sql = getDb();
  const r = (await sql`SELECT body FROM materials WHERE id=${String(id || '')} AND body IS NOT NULL`)[0];
  if (!r) return null;
  try { return JSON.parse(zlib.gunzipSync(Buffer.from(r.body, 'base64'), { maxOutputLength: 60 * 1024 * 1024 }).toString('utf8')); }
  catch (e) { return null; }
}
