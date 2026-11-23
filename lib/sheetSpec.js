// Хичээл бүрийн ЭЕШ-ийн хариултын хуудас (БҮТ-ийн 2024–2026 оны албан ёсны материалаар шалгасан, eec.mn). Клиент ба сервер.
// 1-р хэсэг бүх хичээлд A–E (5 сонголт). 2-р хэсэг хичээлээс хамаарна:
//   нөхөх (Математик, Физик, Хими, Биологи, Газарзүй) — a, b, c … нүд бүрд нэг цифр 0–9. Хасах тэмдэг, цэг, таслал даалгаврын
//     загварт хэвлэгдсэн байдаг ([a.bc], −[d]) — будахгүй. Математикийн хуудас «−», «.» баганатай хэвээр (өмнөх шалгалтууд).
//   харгалзуулах (Англи хэл, Монгол хэл, Нийгмийн ухаан, Түүх, Орос хэл) — a, b, c … мөр бүрд тохирох хариултын ДУГААР (1, 2, 3 …).
// Сонголт бүр хуудсан дээр ТОГТМОЛ байрлалтай (lib/omr.js: S2_POS.ox + S2_ALL дахь индекс × dx) — загвар өөрчлөгдсөн ч өмнө
// хэвлэсэн хуудас зөв уншигдана. Шалгалтын түлхүүрт байгаа тэмдэг (жишээ нь хуучин шалгалтын «−») хуудсанд үргэлж гарна.
export const S2_ALL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '.'];
export const MATCH_SUBJECTS = ['Англи хэл', 'Монгол хэл', 'Нийгмийн ухаан', 'Түүх', 'Орос хэл'];
const DIGIT_SUBJECTS = ['Физик', 'Хими', 'Биологи', 'Газарзүй'];
const DIGITS = S2_ALL.slice(0, 10), NUMBERS = S2_ALL.slice(1, 10);

// 'match' — харгалзуулах (дугаар будна), 'num' — нөхөх (цифр будна)
export const s2Kind = subject => (MATCH_SUBJECTS.includes(subject) ? 'match' : 'num');

// Шалгалтын (бүх хувилбарын) 2-р хэсгийн түлхүүрт орсон тэмдгүүд
function usedChars(exam) {
  const out = new Set();
  const take = cfg => Object.values(cfg || {}).forEach(sub => sub && typeof sub === 'object' && Object.entries(sub).forEach(([k, v]) => {
    if (k === '_enabled') return;
    const a = v && typeof v === 'object' ? v.ans : v;
    if (a !== undefined && a !== null && a !== '') out.add(String(a));
  }));
  take(exam?.sec2Config);
  Object.values(exam?.variants || {}).forEach(v => take(v?.sec2Config));
  return out;
}

// 2-р хэсгийн мөр бүрийн будах сонголтууд (S2_ALL-ийн дарааллаар). exam.s2Opts — сурагчийн порталд сервер тооцож өгнө (түлхүүргүй).
export function s2Options(exam) {
  if (Array.isArray(exam?.s2Opts) && exam.s2Opts.length) return S2_ALL.filter(v => exam.s2Opts.includes(v));
  const subj = exam?.subject;
  const base = MATCH_SUBJECTS.includes(subj) ? NUMBERS : DIGIT_SUBJECTS.includes(subj) ? DIGITS : S2_ALL;
  const used = usedChars(exam);
  return S2_ALL.filter(v => base.includes(v) || used.has(v));
}

// ЭЕШ 2026 (хувилбар A): 1-р хэсгийн даалгавар ба оноо, 2-р хэсгийн даалгаврын тоо ба оноо — шалгалт үүсгэхэд санал болгоно.
export const EESH_SPEC = {
  'Математик': { s1: 36, p1: 72, s2: 4, p2: 28 },
  'Физик': { s1: 46, p1: 76, s2: 4, p2: 24 },
  'Хими': { s1: 40, p1: 68, s2: 4, p2: 32 },
  'Биологи': { s1: 46, p1: 76, s2: 4, p2: 24 },
  'Газарзүй': { s1: 50, p1: 76, s2: 4, p2: 24 },
  'Англи хэл': { s1: 47, p1: 80, s2: 3, p2: 20 },
  'Монгол хэл': { s1: 40, p1: 80, s2: 4, p2: 20 },
  'Нийгмийн ухаан': { s1: 56, p1: 80, s2: 4, p2: 20 },
  'Түүх': { s1: 56, p1: 76, s2: 4, p2: 24 },
  'Орос хэл': { s1: 41, p1: 80, s2: 4, p2: 20 },
};
// «ЭЕШ 2026: 1-р хэсэг 47 даалгавар (80 оноо) · 2-р хэсэг 2.1–2.3 (20 оноо) — мөр бүрд тохирох дугаар»
export function specNote(subject) {
  const s = EESH_SPEC[subject];
  if (!s) return '';
  return `ЭЕШ 2026: 1-р хэсэг ${s.s1} даалгавар (${s.p1} оноо) · 2-р хэсэг 2.1–2.${s.s2} (${s.p2} оноо) — `
    + (s2Kind(subject) === 'match' ? 'харгалзуулах, мөр бүрд тохирох хариултын дугаар (1, 2, 3 …)' : 'нөхөх, нүд бүрд нэг цифр');
}
