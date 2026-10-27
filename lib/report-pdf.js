// Сурагчийн дүнгийн PDF — нэг сурагч эсвэл анги бүхэлдээ (сурагч бүр нэг хуудас).
// jsPDF-ийн үндсэн фонт кирилл үсэггүй тул Nunito (public/fonts, OFL) суулгана — Ө, Ү бүгд гарна.
// Дүнг шалгалтын ОДООГИЙН түлхүүрээр дахин бодож гаргана (lib/report-xlsx.js-тэй ижил).
import { eyeshGrade, levelOf } from './eyesh';
import { examParts, studentParts, saveBlob } from './report-xlsx';

const C = {
  purple: [123, 82, 238], purpleL: [243, 238, 255], ink: [28, 31, 42], soft: [107, 114, 128], line: [229, 231, 235], card: [249, 250, 251],
  ok: [22, 163, 74], okBg: [221, 245, 230], ng: [220, 38, 38], ngBg: [253, 230, 230], bl: [120, 126, 138], blBg: [238, 239, 242],
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const fmt = x => String(Math.round(x * 10) / 10);
const day = d => { const x = new Date(d); return isNaN(x) ? '' : `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`; };

let fontsP = null;
function loadFonts() {
  if (!fontsP) fontsP = Promise.all(['/fonts/Nunito-Regular.ttf', '/fonts/Nunito-ExtraBold.ttf'].map(async url => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Фонт ачаалж чадсангүй');
    const b = new Uint8Array(await r.arrayBuffer());
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  })).catch(e => { fontsP = null; throw e; });
  return fontsP;
}
async function newDoc() {
  const [{ jsPDF }, [regular, bold]] = await Promise.all([import('jspdf'), loadFonts()]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Nunito-Regular.ttf', regular); doc.addFont('Nunito-Regular.ttf', 'Nunito', 'normal');
  doc.addFileToVFS('Nunito-ExtraBold.ttf', bold); doc.addFont('Nunito-ExtraBold.ttf', 'Nunito', 'bold');
  return doc;
}

const X0 = 14, X1 = 196, WIDTH = X1 - X0, BOTTOM = 284;
function pen(doc) {
  const f = (size, bold, color) => { doc.setFont('Nunito', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...(color || C.ink)); };
  const text = (t, x, y, size, bold, color, opt) => { f(size, bold, color); doc.text(String(t), x, y, opt); };
  const box = (x, y, w, h, color, r = 2.5) => { doc.setFillColor(...color); doc.roundedRect(x, y, w, h, r, r, 'F'); };
  return { f, text, box };
}

function drawStudent(doc, exam, P, s, x, page) {
  const { text, box } = pen(doc);
  const grade = eyeshGrade(x.pct), gc = hex(grade.c), level = levelOf(x.pct);
  let y = 12;
  const title = (t, sub) => {
    text(t, X0, y + 5, 12, true);
    if (sub) text(sub, X1, y + 5, 8.5, false, C.soft, { align: 'right' });
    y += 8.5;
  };
  const ensure = h => {
    if (y + h <= BOTTOM) return;
    doc.addPage(); y = 14;
    text(`${s.name || s.code || ''} — үргэлжлэл`, X0, y + 4, 9, true, C.soft); y += 10;
  };

  // толгой
  box(X0, y, WIDTH, 24, C.purpleL, 4);
  text('ЭЕШ шалгагч', X0 + 6, y + 10, 15, true, C.purple);
  text('Сурагчийн дүнгийн хуудас', X0 + 6, y + 17, 9.5, false, C.soft);
  text(exam.title || '', X1 - 6, y + 10, 11, true, C.ink, { align: 'right', maxWidth: 110 });
  text([exam.subject, day(s.submittedAt)].filter(Boolean).join(' · '), X1 - 6, y + 17, 9, false, C.soft, { align: 'right' });
  if (page) text(page, X1, 8, 7.5, false, C.soft, { align: 'right' });
  y += 30;

  // сурагч
  text(s.name || s.code || '—', X0, y + 6, 20, true);
  text([s.class && `Анги ${s.class}`, s.code && `Код ${s.code}`, s.version && s.version !== '—' && (s.version === 'онлайн' ? 'Онлайнаар өгсөн' : `Хувилбар ${s.version}`)]
    .filter(Boolean).join('   ·   '), X0, y + 13, 10, false, C.soft);
  y += 18;

  // гурван карт: хувь, зэрэглэл/түвшин, оноо
  const cw = (WIDTH - 12) / 3, ch = 30;
  box(X0, y, cw, ch, C.card); box(X0 + cw + 6, y, cw, ch, C.card); box(X0 + 2 * (cw + 6), y, cw, ch, C.card);
  text(fmt(x.pct) + '%', X0 + 6, y + 15, 26, true, gc);
  text('ЭЕШ оноо (хувиар)', X0 + 6, y + 24, 9, false, C.soft);
  const c2 = X0 + cw + 12;
  text(`${grade.g} · ${grade.l}`, c2, y + 12, 16, true, gc);
  text(`Түвшин ${level}`, c2, y + 20, 11, true, C.ink);
  text('Зэрэглэл · түвшин (I–VIII)', c2, y + 26, 8, false, C.soft);
  const c3 = X0 + 2 * (cw + 6) + 6;
  text(`${fmt(x.earned)} / ${fmt(P.total)}`, c3, y + 12, 16, true, C.ink);
  text('авсан / авах оноо', c3, y + 18.5, 8.5, false, C.soft);
  const okN = x.q.filter(q => q.st === 'ok').length + x.sub.reduce((a, S) => a + S.rows.filter(r => r.st === 'ok').length, 0);
  const allN = x.q.length + x.sub.reduce((a, S) => a + S.rows.length, 0);
  const blN = x.q.filter(q => q.st === 'blank').length + x.sub.reduce((a, S) => a + S.rows.filter(r => r.st === 'blank').length, 0);
  text(`Зөв ${okN} · Буруу ${allN - okN - blN} · Хоосон ${blN}`, c3, y + 25, 8.5, true, C.ink);
  y += ch + 8;

  // хэсэг бүрээр
  title('Хэсэг бүрээр');
  const rows = [['1-р хэсэг', P.sec1Max, x.sec1], ...P.subs.map((S, i) => [`2-р хэсэг · ${S.sub}`, S.max, x.sub[i].pts])];
  if (P.subs.length) rows.push(['Нийт', P.total, x.earned]);
  const cx = [X0 + 2, X0 + 72, X0 + 102, X0 + 130];
  box(X0, y, WIDTH, 7, C.line, 1.5);
  ['Хэсэг', 'Авах оноо', 'Авсан оноо', 'Гүйцэтгэл'].forEach((t, i) => text(t, cx[i], y + 4.8, 8.5, true, C.soft));
  y += 8;
  rows.forEach(([label, mx, got], i) => {
    const last = P.subs.length && i === rows.length - 1, p = mx ? got / mx * 100 : 0;
    text(label, cx[0], y + 4.6, 10, last); text(fmt(mx), cx[1], y + 4.6, 10, last); text(fmt(got), cx[2], y + 4.6, 10, true);
    box(cx[3], y + 1.6, 34, 3.6, C.line, 1.8);
    if (p > 0) box(cx[3], y + 1.6, Math.max(2, 34 * Math.min(1, p / 100)), 3.6, hex(eyeshGrade(p).c), 1.8);
    text(fmt(p) + '%', X1 - 1, y + 4.6, 9.5, true, hex(eyeshGrade(p).c), { align: 'right' });
    doc.setDrawColor(...C.line); doc.setLineWidth(0.2); doc.line(X0, y + 7, X1, y + 7);
    y += 7;
  });
  y += 6;

  // 1-р хэсэг: асуулт бүрийн авсан оноо
  const per = 12, gw = WIDTH / per, gh = 11, rowsN = Math.ceil(x.q.length / per);
  ensure(9 + rowsN * gh + 12);
  title('1-р хэсэг — асуулт бүрийн авсан оноо', 'нүдэнд: дугаар · оноо · сонгосон/зөв (алдсан бол)');
  const byQ = {};
  (s.sec1Results || []).forEach(r => { if (r && r.q) byQ[r.q] = r; });
  x.q.forEach((q, i) => {
    const gx = X0 + (i % per) * gw, gy = y + Math.floor(i / per) * gh, key = P.q[i];
    const [bg, fg] = q.st === 'ok' ? [C.okBg, C.ok] : q.st === 'ng' ? [C.ngBg, C.ng] : [C.blBg, C.bl];
    box(gx + 0.6, gy + 0.6, gw - 1.2, gh - 1.2, bg, 1.8);
    text(key.n, gx + 2, gy + 3.9, 6.5, false, C.soft);
    text(fmt(q.pts), gx + gw / 2, gy + 6.9, 11, true, fg, { align: 'center' });
    if (q.st !== 'ok') {
      const sel = byQ[key.n] && byQ[key.n].sel && byQ[key.n].sel !== 'BLANK' ? String(byQ[key.n].sel) : '–';
      text(`${sel}/${key.key}`, gx + gw / 2, gy + 9.7, 6, false, fg, { align: 'center' });
    }
  });
  y += rowsN * gh + 3;
  [['Зөв', C.okBg, C.ok], ['Буруу', C.ngBg, C.ng], ['Хоосон', C.blBg, C.bl]].forEach(([t, bg, fg], i) => {
    box(X0 + i * 26, y, 4, 4, bg, 1); text(t, X0 + i * 26 + 5.5, y + 3.3, 8.5, true, fg);
  });
  y += 9;

  // 2-р хэсэг
  if (P.subs.length) {
    ensure(9 + P.subs.length * 11 + 4);
    title('2-р хэсэг — мөр бүрийн авсан оноо');
    P.subs.forEach((S, si) => {
      text(`${S.sub}`, X0 + 1, y + 6.4, 10.5, true);
      text(`${fmt(x.sub[si].pts)}/${fmt(S.max)}`, X0 + 12, y + 6.4, 9, false, C.soft);
      const w = 14;
      S.rows.forEach((R, ri) => {
        const r = x.sub[si].rows[ri], bx = X0 + 30 + ri * (w + 1.5);
        const [bg, fg] = r.st === 'ok' ? [C.okBg, C.ok] : r.st === 'ng' ? [C.ngBg, C.ng] : [C.blBg, C.bl];
        box(bx, y + 0.8, w, 9, bg, 1.8);
        text(R.row, bx + 1.8, y + 4.2, 6.5, false, C.soft);
        text(fmt(r.pts), bx + w / 2 + 1.5, y + 7.4, 10.5, true, fg, { align: 'center' });
      });
      y += 10;
    });
    y += 4;
  }

  // сэдэв бүрийн гүйцэтгэл (1-р хэсэг)
  const topics = [];
  P.q.forEach((q, i) => {
    let t = topics.find(t => t.name === q.topic);
    if (!t) topics.push(t = { name: q.topic, max: 0, got: 0 });
    t.max += q.pts; t.got += x.q[i].pts;
  });
  if (topics.length > 1 || (topics[0] && topics[0].name !== 'Бусад')) {
    ensure(9 + topics.length * 6.5 + 4);
    title('Сэдэв бүрийн гүйцэтгэл');
    topics.forEach(t => {
      const p = t.max ? t.got / t.max * 100 : 0, col = hex(eyeshGrade(p).c);
      text(t.name, X0 + 1, y + 4.2, 9.5, true);
      box(X0 + 46, y + 1.4, 100, 3.6, C.line, 1.8);
      if (p > 0) box(X0 + 46, y + 1.4, Math.max(2, p), 3.6, col, 1.8);
      text(`${fmt(t.got)}/${fmt(t.max)} · ${fmt(p)}%`, X0 + 150, y + 4.2, 9, true, col);
      y += 6.5;
    });
  }

  // хөл
  text('ЭЕШ шалгагч · eyeshcheck.com', X0, 290, 8, false, C.soft);
  text('Зэрэглэл: A ≥90 · B ≥80 · C ≥70 · D ≥60 · E ≥50 · F <50   Түвшин: I ≤29 … VIII ≥90', X1, 290, 8, false, C.soft, { align: 'right' });
}

export async function buildResultsPdf(exam, students) {
  const doc = await newDoc();
  const P = examParts(exam);
  students.forEach((s, i) => {
    if (i > 0) doc.addPage();
    drawStudent(doc, exam, P, s, studentParts(s, exam, P), students.length > 1 ? `${i + 1} / ${students.length}` : '');
  });
  return doc;
}
export async function downloadResultsPdf(exam, students, filename) {
  const doc = await buildResultsPdf(exam, students);
  saveBlob(doc.output('blob'), filename);
}
