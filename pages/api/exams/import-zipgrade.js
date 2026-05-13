// POST /api/exams/import-zipgrade
// Body: { examId, csvText }
// Parses ZipGrade-style CSV, scores Section 1 against the exam key,
// leaves Section 2 blank (teacher fills in via separate endpoint), and
// inserts (or replaces) student records in the DB.

import { requireAuth } from '../../../lib/auth';
import { getExam, initDb } from '../../../lib/db';
import { neon } from '@neondatabase/serverless';

const SEC2_ROWS = ['a','b','c','d','e','f','g','h'];
const SEC2_SUBS = ['2.1','2.2','2.3','2.4'];

function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }

// ── Minimal CSV parser (RFC4180-ish) ────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = false; }
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { row.push(cur); cur = ''; rows.push(row); row = []; }
      else cur += ch;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => (c || '').trim() !== ''));
}

function eyeshGrade(p) {
  if (p>=90) return {g:'A',l:'Маш сайн',c:'#22c55e'};
  if (p>=80) return {g:'B',l:'Сайн',c:'#84cc16'};
  if (p>=70) return {g:'C',l:'Дунджаас дээгүүр',c:'#eab308'};
  if (p>=60) return {g:'D',l:'Дунд',c:'#f59e0b'};
  if (p>=50) return {g:'E',l:'Дунджаас доогуур',c:'#ea580c'};
  return {g:'F',l:'Тэнцээгүй',c:'#dc2626'};
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { examId, csvText } = req.body || {};
    if (!examId || !csvText) return res.status(400).json({ error: 'examId болон csvText шаардлагатай' });

    await initDb();
    const exam = await getExam(examId, req.teacherId);
    if (!exam) return res.status(404).json({ error: 'Шалгалт олдсонгүй' });

    const rows = parseCSV(csvText);
    if (rows.length < 2) return res.status(400).json({ error: 'CSV хоосон эсвэл толгойгүй' });

    // Detect columns
    const header = rows[0].map(h => (h || '').trim());
    const findCol = (names) => {
      for (const n of names) {
        const idx = header.findIndex(h => h.toLowerCase() === n.toLowerCase());
        if (idx >= 0) return idx;
      }
      return -1;
    };
    const colExt   = findCol(['ExternalId','External Id','External ID','externalid','SID','StudentID','Student ID']);
    const colFirst = findCol(['FirstName','First Name','firstname','Given Name']);
    const colLast  = findCol(['LastName','Last Name','lastname','Surname','Family Name']);
    const colName  = findCol(['Name','FullName','Full Name','StudentName']);
    const colZipId = findCol(['ZipGradeID','Quiz Id','ZipGrade ID']);

    // Find Stu1, Stu2, ... StuN (student answer columns)
    const stuCols = [];
    for (let i = 0; i < header.length; i++) {
      const m = header[i].match(/^Stu\s*(\d+)$/i) || header[i].match(/^Q\s*(\d+)$/i) || header[i].match(/^Answer\s*(\d+)$/i);
      if (m) stuCols.push({ idx: i, q: parseInt(m[1], 10) });
    }
    if (stuCols.length === 0) {
      return res.status(400).json({ error: 'Stu1, Stu2, ... баганууд CSV-д олдсонгүй. ZipGrade-н "Quiz Results" CSV-ийг шалгана уу.' });
    }
    stuCols.sort((a, b) => a.q - b.q);

    // Build empty Sec2 results (all blank)
    function emptySec2() {
      const out = {};
      const cfg = exam.sec2Config || {};
      for (const sub of SEC2_SUBS) {
        if (!cfg[sub]?._enabled) continue;
        out[sub] = {};
        for (const r of SEC2_ROWS) {
          const item = cfg[sub][r];
          if (!item) continue;
          const isObj = typeof item === 'object';
          const ans = isObj ? item.ans : item;
          if (ans === undefined || ans === null || ans === '') continue;
          const pts = isObj ? (item.score != null ? +item.score : 1) : (+exam.sec2Score || 1);
          out[sub][r] = { sel: 'BLANK', key: String(ans), st: 'blank', pts: 0, max: pts };
        }
      }
      return out;
    }

    // Sec2 max for this exam
    let sec2Max = 0;
    {
      const cfg = exam.sec2Config || {};
      for (const sub of SEC2_SUBS) {
        if (!cfg[sub]?._enabled) continue;
        for (const r of SEC2_ROWS) {
          const item = cfg[sub][r];
          if (!item) continue;
          const isObj = typeof item === 'object';
          const ans = isObj ? item.ans : item;
          if (ans === undefined || ans === null || ans === '') continue;
          sec2Max += isObj ? (item.score != null ? +item.score : 1) : (+exam.sec2Score || 1);
        }
      }
    }
    const sec1Max = (exam.sec1Scores || []).reduce((a, b) => a + (+b || 0), 0);
    const totalMax = sec1Max + sec2Max;

    const sql = getDb();

    let imported = 0, replaced = 0, skipped = 0;
    const errors = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const ext  = colExt  >= 0 ? (row[colExt]  || '').trim() : '';
      const fn   = colFirst>= 0 ? (row[colFirst]|| '').trim() : '';
      const ln   = colLast >= 0 ? (row[colLast] || '').trim() : '';
      const fullName = colName >= 0 ? (row[colName] || '').trim() : (`${fn} ${ln}`).trim();
      const zid  = colZipId>= 0 ? (row[colZipId]|| '').trim() : '';

      const code = ext || zid || fullName;  // best identifier we have
      const name = fullName || code;

      if (!code) {
        skipped++;
        errors.push(`Мөр ${r + 1}: код/нэр хоосон`);
        continue;
      }

      // Score Sec1
      const sec1Results = [];
      let correct = 0, wrong = 0, blank = 0, sec1Earned = 0;
      const N = (exam.sec1Key || []).length || (exam.sec1Count || 0);
      for (let i = 0; i < N; i++) {
        const stu = stuCols.find(sc => sc.q === i + 1);
        const sel = stu ? (row[stu.idx] || '').trim().toUpperCase() : '';
        const key = exam.sec1Key?.[i] || '';
        const pts = +exam.sec1Scores?.[i] || 1;
        if (!sel || sel === '*' || sel === '-') {
          blank++;
          sec1Results.push({ q: i + 1, sel: 'BLANK', key, st: 'blank', pts: 0, max: pts });
        } else if (sel === key) {
          correct++; sec1Earned += pts;
          sec1Results.push({ q: i + 1, sel, key, st: 'ok', pts, max: pts });
        } else {
          wrong++;
          sec1Results.push({ q: i + 1, sel, key, st: 'ng', pts: 0, max: pts });
        }
      }

      // Sec2 = blank
      const sec2Results = emptySec2();
      // Count Sec2 blanks
      for (const sub of Object.keys(sec2Results)) {
        for (const rk of Object.keys(sec2Results[sub])) blank++;
      }

      const earned = sec1Earned;
      const scaled = totalMax > 0 ? Math.round(earned / totalMax * 1000) / 10 : 0;
      const grade = eyeshGrade(scaled);

      // Replace if exists (same exam_id + code)
      const existing = await sql`SELECT id FROM students WHERE exam_id=${examId} AND code=${code}`;
      if (existing[0]) {
        await sql`UPDATE students
          SET name=${name}, version='ZG', correct=${correct}, wrong=${wrong}, blank=${blank},
              raw_earned=${earned}, raw_max=${totalMax}, scaled=${scaled},
              grade=${JSON.stringify(grade)},
              sec1_results=${JSON.stringify(sec1Results)},
              sec2_results=${JSON.stringify(sec2Results)},
              needs_review=false,
              submitted_at=NOW()
          WHERE id=${existing[0].id}`;
        replaced++;
      } else {
        await sql`INSERT INTO students
          (id, exam_id, name, code, class, version, correct, wrong, blank,
           raw_earned, raw_max, scaled, grade, sec1_results, sec2_results, needs_review, submitted_at)
          VALUES
          (${uid()}, ${examId}, ${name}, ${code}, '', 'ZG',
           ${correct}, ${wrong}, ${blank},
           ${earned}, ${totalMax}, ${scaled},
           ${JSON.stringify(grade)},
           ${JSON.stringify(sec1Results)}, ${JSON.stringify(sec2Results)}, false, NOW())`;
        imported++;
      }
    }

    res.json({ imported, replaced, skipped, errors, totalMax, sec1Max, sec2Max });
  } catch (e) {
    console.error('import-zipgrade error:', e);
    res.status(500).json({ error: e.message });
  }
});
