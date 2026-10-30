// «Анализ Excel» — сургуулийн тайлангийн загвар: Хураангуй (хэсэг бүрийн оноо, түвшин I–VIII, гарын үсэг),
// 1-р хэсгийн дэлгэрэнгүй (асуулт бүрийн АВСАН ОНОО, ногоон/улаан/саарал), 2-р хэсгийн дэлгэрэнгүй, сэдвийн шинжилгээ.
// ExcelJS-ийг товч дарахад л ачаална. Томьёо бүр урьдчилан бодсон утгатай тул утасны preview-д ч тоо харагдана,
// Excel дээр оноо засвал дахин бодогдоно. Дүнг үргэлж шалгалтын ОДООГИЙН түлхүүрээр дахин бодож гаргана.
import { SEC2_SUBS, SEC2_ROWS, LEVELS, levelOf, rescoreSaved, examVariants, examForVersion, studentVariant } from './eyesh';

const FONT = 'Times New Roman';
const HEAD = 'FF00FFCC', SUB = 'FFCCFFFF', OK = 'FFB7F0B7', NG = 'FFF8B7B7', BL = 'FFE5E5E5';
const ST_FILL = { ok: OK, ng: NG, blank: BL };
const thin = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
const LEFT = { horizontal: 'left', vertical: 'middle' };
const r2 = x => Math.round(x * 100) / 100;

function col(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
const at = (c, r) => col(c) + r;
const levelF = ref => `IF(${ref}<=29,"I",IF(${ref}<=39,"II",IF(${ref}<=49,"III",IF(${ref}<=59,"IV",IF(${ref}<=69,"V",IF(${ref}<=79,"VI",IF(${ref}<=89,"VII","VIII")))))))`;
const F = (formula, result) => ({ formula, result });

function style(cell, s = {}) {
  cell.font = { name: FONT, size: s.size || 11, bold: !!s.bold };
  cell.alignment = s.align || CENTER;
  if (s.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.fill } };
  if (s.border !== false) cell.border = BORDER;
  if (s.numFmt) cell.numFmt = s.numFmt;
}
function put(ws, r, c, value, s) { const cell = ws.getCell(r, c); cell.value = value; style(cell, s); return cell; }
// нийлүүлсэн нүдний хүрээ бүх нүдэнд зурагдана
function merge(ws, r1, c1, r2, c2, value, s = {}) {
  ws.mergeCells(r1, c1, r2, c2);
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) style(ws.getCell(r, c), s);
  ws.getCell(r1, c1).value = value;
}

// ── толгойн бичвэрүүд ──
const SUBJECT_GEN = {
  'Математик': 'МАТЕМАТИКИЙН', 'Физик': 'ФИЗИКИЙН', 'Хими': 'ХИМИЙН', 'Биологи': 'БИОЛОГИЙН', 'Монгол хэл': 'МОНГОЛ ХЭЛНИЙ',
  'Түүх': 'ТҮҮХИЙН', 'Газарзүй': 'ГАЗАРЗҮЙН', 'Англи хэл': 'АНГЛИ ХЭЛНИЙ', 'Нийгмийн ухаан': 'НИЙГМИЙН УХААНЫ',
};
// «… сургууль» → «… СУРГУУЛИЙН» (аль хэдийн харьяалахын тийн ялгалтай бол хэвээр)
export function schoolLine(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  const rules = [[/сургууль$/i, 'сургуулийн'], [/цогцолбор$/i, 'цогцолборын'], [/лицей$/i, 'лицейн'], [/коллеж$/i, 'коллежийн'], [/академи$/i, 'академийн']];
  for (const [re, to] of rules) if (re.test(t)) return t.replace(re, to).toUpperCase();
  return t.toUpperCase();
}
const schoolYear = d => (d.getMonth() >= 8 ? `${d.getFullYear()}-${d.getFullYear() + 1}` : `${d.getFullYear() - 1}-${d.getFullYear()}`);
// 1 нэг, 4 дөрөв, 9 ес-ээр төгсвөл «-ний», бусад нь «-ны» (12-ны, 20-ны, 21-ний)
export const dateLine = d => `${d.getFullYear()} оны ${d.getMonth() + 1} сарын ${d.getDate()}-${[1, 4, 9].includes(d.getDate() % 10) ? 'ний' : 'ны'} өдөр`;
function gradeLine(students) {
  const classes = [...new Set(students.map(s => String(s.class || '').trim()).filter(Boolean))];
  if (classes.length === 1) return classes[0].toUpperCase() + ' АНГИЙН';
  const nums = [...new Set(classes.map(c => (c.match(/^\d+/) || [])[0]).filter(Boolean))];
  return nums.length === 1 ? nums[0] + '-Р АНГИЙН' : '';
}

// ── шалгалтын бүтэц ба сурагч бүрийн оноо (одоогийн түлхүүрээр) ──
export function examParts(exam) {
  const q = (exam.sec1Key || []).map((key, i) => ({ n: i + 1, key, pts: parseFloat(exam.sec1Scores?.[i]) || 1, topic: exam.topics?.[i] || 'Бусад' }));
  const subs = [];
  if (exam.useSec2) SEC2_SUBS.forEach(sub => {
    const cfg = exam.sec2Config?.[sub];
    if (!cfg?._enabled) return;
    const rows = [];
    SEC2_ROWS.forEach(row => {
      const v = cfg[row], ans = v && typeof v === 'object' ? v.ans : v;
      if (ans === undefined || ans === null || ans === '') return;
      const pts = v && typeof v === 'object' ? (v.score != null ? parseFloat(v.score) : 1) : (parseFloat(exam.sec2Score) || 1);
      rows.push({ row, key: String(ans), pts });
    });
    if (rows.length) subs.push({ sub, rows, max: rows.reduce((a, r) => a + r.pts, 0) });
  });
  const sec1Max = q.reduce((a, x) => a + x.pts, 0);
  return { q, subs, sec1Max, total: sec1Max + subs.reduce((a, s) => a + s.max, 0) };
}
export function studentParts(s, exam, P) {
  const fresh = rescoreSaved(s, exam);
  const byQ = {};
  fresh.sec1Results.forEach(r => { byQ[r.q] = r; });
  const q = P.q.map(x => { const r = byQ[x.n]; return { st: r ? r.st : 'blank', pts: r && r.st === 'ok' ? x.pts : 0 }; });
  const sub = P.subs.map(S => {
    const rows = S.rows.map(R => { const r = fresh.sec2Results?.[S.sub]?.[R.row]; return { st: r ? r.st : 'blank', pts: r && r.st === 'ok' ? R.pts : 0 }; });
    return { rows, pts: rows.reduce((a, r) => a + r.pts, 0) };
  });
  const sec1 = q.reduce((a, x) => a + x.pts, 0);
  const earned = sec1 + sub.reduce((a, x) => a + x.pts, 0);
  return { q, sub, sec1, earned, pct: P.total ? earned / P.total * 100 : 0 };
}

// ── 1. Хураангуй ──
// Олон хувилбартай шалгалтад: «Хувилбар» багана, 2-р хэсгийн багана нь бүх хувилбарын дэд хэсгүүд,
// авах оноо хувилбаруудад ижил бол тоо, өөр бол «A 30 · B 32»; сурагч бүрийн хувь өөрийн хувилбарын авах оноогоор.
function summarySheet(wb, exam, list, opts, { PV, shown, multi }) {
  const ws = wb.addWorksheet('Хураангуй', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const Ps = shown.map(L => PV[L]);
  const subNames = SEC2_SUBS.filter(sub => Ps.some(P => P.subs.some(S => S.sub === sub)));
  const subPts = (e, sub) => { const i = e.P.subs.findIndex(S => S.sub === sub); return i < 0 ? 0 : e.x.sub[i].pts; };
  const tasks = [{ label: '1-р хэсэг', maxOf: P => P.sec1Max, v: e => e.x.sec1 },
    ...subNames.map(sub => ({ label: sub, maxOf: P => P.subs.find(S => S.sub === sub)?.max || 0, v: e => subPts(e, sub) }))];
  const uni = f => { const vals = Ps.map(f); return vals.every(v => v === vals[0]) ? vals[0] : shown.map((L, i) => `${L} ${r2(vals[i])}`).join(' · '); };
  const hdr = tasks.map(t => uni(t.maxOf)), total = uni(P => P.total);
  const allNum = typeof total === 'number' && hdr.every(v => typeof v === 'number');
  const C1 = multi ? 4 : 3, CL = C1 + tasks.length - 1, CM = CL + 1, CE = CM + 1, CP = CE + 1, CV = CP + 1;
  ws.getColumn(1).width = 6; ws.getColumn(2).width = 24;
  if (multi) ws.getColumn(3).width = 10;
  for (let c = C1; c <= CE; c++) ws.getColumn(c).width = 12;
  ws.getColumn(CP).width = 10; ws.getColumn(CV).width = 10;

  const now = opts.date || new Date();
  const title = [schoolLine(opts.school), `${schoolYear(now)} ОНЫ ХИЧЭЭЛИЙН ЖИЛИЙН ${gradeLine(list.map(x => x.s))}`.trim(),
    `${SUBJECT_GEN[exam.subject] || String(exam.subject || '').toUpperCase() + ' ХИЧЭЭЛИЙН'} ЭЛСЭЛТИЙН ЕРӨНХИЙ ШАЛГАЛТЫН СОРИЛГО`,
    `«${exam.title}»${multi ? ` · ${shown.join(', ')} хувилбар` : ''}`].filter(Boolean).join('\n');
  merge(ws, 2, 1, 6, 2, '', { border: false });
  merge(ws, 2, 3, 6, CV, title, { bold: true, border: false });
  merge(ws, 7, 1, 7, CV, ' ' + dateLine(now) + ' ', { size: 10, border: false, align: { horizontal: 'right', vertical: 'middle' } });
  merge(ws, 8, 1, 8, CV, 'Даалгавар', { bold: true, fill: HEAD });

  const n = list.length, R0 = 11, RL = R0 + n - 1;
  merge(ws, 9, 1, 10, 1, '№', { bold: true, fill: HEAD });
  merge(ws, 9, 2, 10, 2, 'Сурагчийн нэр', { bold: true, fill: HEAD });
  if (multi) merge(ws, 9, 3, 10, 3, 'Хувилбар', { bold: true, fill: HEAD });
  tasks.forEach((t, i) => { put(ws, 9, C1 + i, t.label, { bold: true, fill: SUB }); put(ws, 10, C1 + i, hdr[i], { bold: true, fill: SUB }); });
  [['Авах оноо', total], ['Авсан оноо', allNum ? F(`SUM(${at(C1, 10)}:${at(CL, 10)})`, total) : total],
    ['Дүн', allNum ? F(`${at(CE, 10)}/${at(CM, 10)}*100`, 100) : 100], ['Түвшин', allNum ? F(levelF(at(CP, 10)), 'VIII') : 'VIII']].forEach(([label, v], i) => {
    put(ws, 9, CM + i, label, { bold: true, fill: SUB });
    put(ws, 10, CM + i, v, { bold: true, fill: SUB, numFmt: i === 2 ? '0.0' : undefined });
  });
  ws.getRow(10).height = 28;

  list.forEach((e, i) => {
    const r = R0 + i, { s, x, P } = e;
    put(ws, r, 1, i + 1, { fill: HEAD });
    put(ws, r, 2, s.name || s.code || '—', { size: 12, align: LEFT });
    if (multi) put(ws, r, 3, e.v, { bold: true });
    tasks.forEach((t, j) => put(ws, r, C1 + j, r2(t.v(e)), {}));
    put(ws, r, CM, P.total, { bold: true, fill: SUB });
    put(ws, r, CE, F(`SUM(${at(C1, r)}:${at(CL, r)})`, r2(x.earned)), { bold: true, fill: SUB });
    put(ws, r, CP, F(`${at(CE, r)}/${at(CM, r)}*100`, r2(x.pct)), { bold: true, fill: SUB, numFmt: '0.0' });
    put(ws, r, CV, F(levelF(at(CP, r)), levelOf(x.pct)), { bold: true, fill: SUB });
    ws.getRow(r).height = 22;
  });

  // анги нийт: авах / авсан / гүйцэтгэл, түвшний тархалт
  const S1 = RL + 1, S2 = RL + 2, S3 = RL + 3;
  merge(ws, S1, 1, S3 + LEVELS.length, 1, 'Түвшин', { bold: true, fill: HEAD });
  put(ws, S1, 2, 'Авах оноо', { bold: true }); put(ws, S2, 2, 'Авсан оноо', { bold: true }); put(ws, S3, 2, 'Гүйцэтгэл', { bold: true });
  if (multi) [S1, S2, S3].forEach(r => put(ws, r, 3, '', {}));
  const colMax = [...tasks.map(t => list.reduce((a, e) => a + t.maxOf(e.P), 0)), list.reduce((a, e) => a + e.P.total, 0)];
  const colSum = [...tasks.map(t => list.reduce((a, e) => a + t.v(e), 0)), colMax[tasks.length]];
  for (let c = C1; c <= CM; c++) {
    const k = c - C1, mx = colMax[k], sm = colSum[k], num = typeof (k < tasks.length ? hdr[k] : total) === 'number';
    put(ws, S1, c, num ? F(`${at(c, 10)}*${n}`, mx) : r2(mx), {});
    put(ws, S2, c, F(`SUM(${at(c, R0)}:${at(c, RL)})`, r2(sm)), {});
    put(ws, S3, c, F(`IFERROR(${at(c, S2)}/${at(c, S1)}*100,0)`, mx ? r2(sm / mx * 100) : 0), { bold: true, fill: HEAD, numFmt: '0.0' });
  }
  const earnedAll = list.reduce((a, { x }) => a + x.earned, 0), maxAll = colMax[tasks.length];
  put(ws, S2, CE, F(`SUM(${at(CE, R0)}:${at(CE, RL)})`, r2(earnedAll)), { bold: true, fill: HEAD });
  put(ws, S3, CP, F(`${at(CE, S2)}/${at(CM, S1)}*100`, maxAll ? r2(earnedAll / maxAll * 100) : 0), { bold: true, fill: HEAD, numFmt: '0.0' });
  [...LEVELS].reverse().forEach((lv, i) => {
    const r = S3 + 1 + i;
    merge(ws, r, 2, r, CL, lv, {});
    merge(ws, r, CM, r, CV, F(`COUNTIF($${col(CV)}$${R0}:$${col(CV)}$${RL},"${lv}")`, list.filter(({ x }) => levelOf(x.pct) === lv).length), { bold: true });
  });

  // гарын үсэг
  const SIG = S3 + LEVELS.length + 4, who = opts.teacherName || '';
  [['Сургалтын менежер: ', ''], ['Шалгалт авсан: ', who], ['Хянасан багш: ', who], ['Шалгалт зассан: ', who]].forEach(([label, name], i) => {
    put(ws, SIG + i, 4, label, { border: false, align: LEFT });
    if (name) put(ws, SIG + i, CM, name, { border: false, align: LEFT });
  });
}

// ── 2–3. Дэлгэрэнгүй (асуулт / мөр бүрийн авсан оноо) ──
function detailSheet(wb, { name, title, items, list, cellsOf, width = 4.5 }) {
  const ws = wb.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }] });
  const Q0 = 3, QL = Q0 + items.length - 1, CK = QL + 1, CE = CK + 1, CM = CE + 1, CP = CM + 1, CV = CP + 1;
  ws.getColumn(1).width = 5; ws.getColumn(2).width = 22;
  for (let c = Q0; c <= QL; c++) ws.getColumn(c).width = width;
  [CK, CE, CM, CP, CV].forEach(c => { ws.getColumn(c).width = 10; });
  merge(ws, 1, 1, 1, CV, title, { bold: true, size: 12, border: false });
  ws.getRow(1).height = 24;

  put(ws, 3, 1, '№', { bold: true, fill: HEAD }); put(ws, 3, 2, 'Сурагч', { bold: true, fill: HEAD });
  items.forEach((it, i) => put(ws, 3, Q0 + i, it.label, { bold: true, fill: HEAD, size: 10 }));
  ['Зөв', 'Авсан оноо', 'Авах оноо', '%', 'Түвшин'].forEach((t, i) => put(ws, 3, CK + i, t, { bold: true, fill: HEAD }));
  ws.getRow(3).height = 30;
  merge(ws, 4, 1, 4, 2, 'Зөв хариулт', { bold: true, fill: SUB });
  merge(ws, 5, 1, 5, 2, 'Оноо', { bold: true, fill: SUB });
  items.forEach((it, i) => { put(ws, 4, Q0 + i, it.key, { bold: true, fill: SUB }); put(ws, 5, Q0 + i, it.pts, { fill: SUB }); });
  const maxSum = items.reduce((a, it) => a + it.pts, 0);
  const qr = r => `${at(Q0, r)}:${at(QL, r)}`;

  const n = list.length, D0 = 6, DL = D0 + n - 1;
  const totals = { ok: 0, earned: 0 };
  list.forEach(({ s, x }, idx) => {
    const r = D0 + idx, cells = cellsOf(x);
    put(ws, r, 1, idx + 1, { fill: HEAD });
    put(ws, r, 2, s.name || s.code || '—', { size: 12, align: LEFT });
    cells.forEach((c, i) => put(ws, r, Q0 + i, c.pts, { fill: ST_FILL[c.st] || BL, size: 10 }));
    const ok = cells.filter(c => c.st === 'ok').length, earned = cells.reduce((a, c) => a + c.pts, 0), pct = maxSum ? earned / maxSum * 100 : 0;
    totals.ok += ok; totals.earned += earned;
    put(ws, r, CK, F(`COUNTIF(${qr(r)},">0")`, ok), { bold: true, fill: SUB });
    put(ws, r, CE, F(`SUM(${qr(r)})`, r2(earned)), { bold: true, fill: SUB });
    put(ws, r, CM, F(`SUM(${col(Q0)}$5:${col(QL)}$5)`, maxSum), { bold: true, fill: SUB });
    put(ws, r, CP, F(`IFERROR(${at(CE, r)}/${at(CM, r)}*100,0)`, r2(pct)), { bold: true, fill: SUB, numFmt: '0.0' });
    put(ws, r, CV, F(levelF(at(CP, r)), levelOf(pct)), { bold: true, fill: SUB });
  });

  // асуулт бүрээр: зөв хариулсан сурагч, хувь, дундаж оноо; анги нийт
  const T1 = DL + 1, T2 = DL + 2, T3 = DL + 3, T4 = DL + 4;
  [[T1, 'Зөв хариулсан'], [T2, 'Зөв %'], [T3, 'Дундаж оноо'], [T4, 'Анги нийт']].forEach(([r, t]) => merge(ws, r, 1, r, 2, t, { bold: true, fill: HEAD }));
  items.forEach((it, i) => {
    const c = Q0 + i, range = `${at(c, D0)}:${at(c, DL)}`;
    const okN = list.filter(({ x }) => cellsOf(x)[i].st === 'ok').length;
    put(ws, T1, c, F(`COUNTIF(${range},">0")`, okN), { bold: true, fill: HEAD, size: 10 });
    put(ws, T2, c, F(`IFERROR(COUNTIF(${range},">0")/${n}*100,0)`, n ? r2(okN / n * 100) : 0), { fill: SUB, size: 10, numFmt: '0' });
    put(ws, T3, c, F(`IFERROR(AVERAGE(${range}),0)`, n ? r2(okN * it.pts / n) : 0), { fill: SUB, size: 10, numFmt: '0.0' });
  });
  const allPct = n && maxSum ? totals.earned / (maxSum * n) * 100 : 0;
  put(ws, T4, CK, F(`SUM(${at(CK, D0)}:${at(CK, DL)})`, totals.ok), { bold: true, fill: HEAD });
  put(ws, T4, CE, F(`SUM(${at(CE, D0)}:${at(CE, DL)})`, r2(totals.earned)), { bold: true, fill: HEAD });
  put(ws, T4, CM, F(`SUM(${at(CM, D0)}:${at(CM, DL)})`, maxSum * n), { bold: true, fill: HEAD });
  put(ws, T4, CP, F(`IFERROR(${at(CE, T4)}/${at(CM, T4)}*100,0)`, r2(allPct)), { bold: true, fill: HEAD, numFmt: '0.0' });
  put(ws, T4, CV, F(levelF(at(CP, T4)), levelOf(allPct)), { bold: true, fill: HEAD });
}

// ── 4. Сэдвийн шинжилгээ ── (хувилбаруудыг нэгтгэнэ: сурагч бүрийг өөрийн хувилбарын асуултын сэдвээр)
function topicSheet(wb, exam, list, PV, shown) {
  const ws = wb.addWorksheet('Сэдвийн шинжилгээ', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  [24, 12, 14, 16, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  merge(ws, 1, 1, 1, 5, `${exam.title} — сэдэв бүрийн гүйцэтгэл (1-р хэсэг)`, { bold: true, size: 12, border: false });
  ['Сэдэв', 'Асуултын тоо', 'Авах оноо', 'Дундаж авсан оноо', 'Гүйцэтгэл %'].forEach((t, i) => put(ws, 3, i + 1, t, { bold: true, fill: HEAD }));
  ws.getRow(3).height = 30;
  const topics = [];
  const get = name => { let t = topics.find(x => x.name === name); if (!t) topics.push(t = { name, per: {}, maxAll: 0, earned: 0 }); return t; };
  shown.forEach(L => PV[L].q.forEach(q => { const p = get(q.topic).per; p[L] = p[L] || { count: 0, max: 0 }; p[L].count++; p[L].max += q.pts; }));
  list.forEach(({ x, P }) => P.q.forEach((q, i) => { const t = get(q.topic); t.maxAll += q.pts; t.earned += x.q[i].pts; }));
  const uni = (t, k) => { const vals = shown.map(L => t.per[L]?.[k] || 0); return vals.every(v => v === vals[0]) ? vals[0] : shown.map((L, i) => `${L} ${r2(vals[i])}`).join(' · '); };
  const n = list.length || 1;
  topics.forEach((t, i) => {
    const r = 4 + i, avg = t.earned / n;
    put(ws, r, 1, t.name, { align: LEFT, bold: true }); put(ws, r, 2, uni(t, 'count'), {}); put(ws, r, 3, uni(t, 'max'), {});
    put(ws, r, 4, r2(avg), { numFmt: '0.0' });
    put(ws, r, 5, t.maxAll ? r2(t.earned / t.maxAll * 100) : 0, { bold: true, fill: SUB, numFmt: '0.0' });
  });
}

export function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[\\/:*?"<>|]+/g, '_');
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// opts: { school, teacherName, label } — label: шүүсэн анги/хувилбар (файлын нэрэнд)
export async function buildAnalysisWorkbook(exam, students, opts = {}) {
  const mod = await import('exceljs');
  const ExcelJS = mod.Workbook ? mod : mod.default;
  // Хувилбар бүрийн бүтэц; сурагч бүр өөрийн хувилбарын түлхүүрээр
  const vers = examVariants(exam), multi = vers.length > 1;
  const PV = Object.fromEntries(vers.map(L => [L, examParts(examForVersion(exam, L))]));
  const list = [...students]
    .sort((a, b) => String(a.class || '').localeCompare(String(b.class || ''), 'mn', { numeric: true }) || String(a.name || '').localeCompare(String(b.name || ''), 'mn'))
    .map(s => { const v = studentVariant(exam, s.version); return { s, v, P: PV[v], x: studentParts(s, exam, PV[v]) }; });
  let shown = multi ? vers.filter(L => list.some(e => e.v === L)) : ['A'];
  if (!shown.length) shown = ['A'];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ЭЕШ шалгагч (eyeshcheck.com)';
  wb.created = opts.date || new Date();
  wb.calcProperties.fullCalcOnLoad = true;   // Excel нээхдээ бүх томьёог дахин бодно
  summarySheet(wb, exam, list, opts, { PV, shown, multi });
  shown.forEach(L => {
    const P = PV[L], sub = list.filter(e => e.v === L), tag = multi ? ' ' + L : '', tt = multi ? ` — ${L} хувилбар` : '';
    detailSheet(wb, {
      name: '1-р хэсэг дэлгэрэнгүй' + tag, list: sub,
      title: `${exam.title}${tt} — 1-р хэсэг: асуулт бүрийн авсан оноо (ногоон = зөв, улаан = буруу, саарал = хоосон)`,
      items: P.q.map(q => ({ label: q.n, key: q.key, pts: q.pts })), cellsOf: x => x.q,
    });
    if (P.subs.length) detailSheet(wb, {
      name: '2-р хэсэг дэлгэрэнгүй' + tag, list: sub, width: 5.5,
      title: `${exam.title}${tt} — 2-р хэсэг: мөр бүрийн авсан оноо (ногоон = зөв, улаан = буруу, саарал = хоосон)`,
      items: P.subs.flatMap(S => S.rows.map(R => ({ label: S.sub + R.row, key: R.key, pts: R.pts }))),
      cellsOf: x => x.sub.flatMap(s => s.rows),
    });
  });
  if (shown.some(L => PV[L].q.length)) topicSheet(wb, exam, list, PV, shown);
  return wb;
}
export async function exportAnalysisXlsx(exam, students, opts = {}) {
  const wb = await buildAnalysisWorkbook(exam, students, opts);
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${exam.title}${opts.label ? '_' + opts.label : ''}_анализ.xlsx`);
}
