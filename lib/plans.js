// Эрхийн багцууд — нүүр хуудас, төлбөрийн дэлгэц, сервер (QPay нэхэмжлэх) бүгд ЭНЭ файлыг ашиглана.
export const MONTH_PRICE = 19900;  // 1 сар, нэг хичээл
export const TRIAL_DAYS = 1;       // шинэ бүртгэлийн үнэгүй туршилт
// Шинэ бүртгэлийн урамшуулал: бүртгүүлснээс хойш WELCOME_HOURS цагийн дотор, QPay-ээр хараахан төлөөгүй багшийн өөрийн
// (сургуулийн биш) багц ~50% хямд — сард 9,900₮ (1/3/6 сар: 9,900 / 29,700 / 59,400₮). Эрхийг сервер шийднэ (lib/db.js welcomeOffer).
export const WELCOME_HOURS = 24;
export const WELCOME_MONTH_PRICE = 9900;
// 3, 6 сарынх сарын үнээр (59,700 / 119,400₮) — олон сарын хөнгөлөлтгүй (off: 0)
export const PLANS = [
  { months: 1, off: 0 },
  { months: 3, off: 0 },
  { months: 6, off: 0 },
];

export function planOf(months) {
  return PLANS.find(p => p.months === Number(months)) || null;
}
export function fullPrice(months) { return MONTH_PRICE * months; }
// Хямдралтай үнэ — 10₮ хүртэл бүхэлчилнэ; welcome — шинэ бүртгэлийн урамшууллын үнэ
export function planPrice(months, welcome = false) {
  const p = planOf(months);
  if (!p) return null;
  return Math.round((welcome ? WELCOME_MONTH_PRICE : MONTH_PRICE) * p.months * (100 - p.off) / 1000) * 10;
}
export function perMonth(months, welcome = false) { return Math.round(planPrice(months, welcome) / months / 10) * 10; }
// Үлдсэн хугацаа (ms) → «23:05:09»
export const fmtLeft = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, '0')).join(':'); };

// Эрх хичээл бүрээр: багцын үнэ нэг хичээлийнх. Багш нэг хичээл, сургууль хэд ч хичээл (хичээл бүр ижил үнэ) авна.
// 2026.11-ээс өмнө төлсөн / туршилтын эрх (teachers.paid_until) бүх хичээлд хугацаа дуустлаа хүчинтэй.
export const SUBJECTS = ['Математик','Физик','Хими','Биологи','Монгол хэл','Түүх','Газарзүй','Англи хэл','Нийгмийн ухаан'];
export const CM_SUBJECT = 'Математик';   // Дасгалын төв (cyber-math.com) дээр төлсөн эрх — зөвхөн математик
// «ЭЕШ сан» (lib/eeshbank.js, components/EeshBank.js): хичээл бүрийн ЭЕШ-ийн албан ёсны материал (он × хувилбар) → хариутай
// шалгалт + хэвлэх материал + онлайн. Багц сард 29,900₮ = БҮХ хичээлийн эрх + ЭЕШ сан (эзэмшигч 2026-11-20). Эрх нь ey_licenses-ийн
// BANK «хичээл» (normSubjects-д орохгүй — хичээлийн сонголтод харагдахгүй).
export const BANK = 'ЭЕШ сан';
export const BANK_MONTH_PRICE = 29900;
export const BANK_SUBJECTS = ['Математик', 'Физик', 'Англи хэл', 'Монгол хэл', 'Нийгмийн ухаан'];
export function bankPrice(months) { const p = planOf(months); return p ? BANK_MONTH_PRICE * p.months : null; }
// Клиент: /api/me-ийн access-аас ЭЕШ сангийн эрхийн дуусах огноо (Date | null) — зөвхөн BANK эрх (хуучин бүх хичээлийн эрх биш)
export function bankUntilOf(me) {
  const ds = (me?.access?.licenses || []).filter(l => l.subject === BANK).map(l => new Date(l.until)).filter(d => !isNaN(d));
  return ds.length ? new Date(Math.max(...ds)) : null;
}
export function schoolPrice(months, n) { const p = planPrice(months); return p == null ? null : p * Math.max(0, n | 0); }
// Хичээлийн жагсаалтыг цэгцэлнэ: зөвхөн SUBJECTS-д байгаа, давхардалгүй, SUBJECTS-ийн дарааллаар
export function normSubjects(list) {
  const want = new Set((Array.isArray(list) ? list : []).map(s => String(s || '').trim()));
  return SUBJECTS.filter(s => want.has(s));
}
// Клиент: /api/me-ийн access-аас тухайн хичээлийн эрхийн хамгийн хожуу дуусах огноо (Date | null) — серверийн subjectUntil-тэй ижил
export function subjectUntilOf(me, subject) {
  const a = me?.access;
  if (!a) return null;
  const ds = [a.all, subject === CM_SUBJECT ? a.cm : null, ...(a.licenses || []).filter(l => l.subject === subject).map(l => l.until)]
    .filter(Boolean).map(x => new Date(x));
  return ds.length ? new Date(Math.max(...ds)) : null;
}
export function canUseSubjectOf(me, subject) {
  if (!me) return false;
  if (me.unlimited) return true;
  if (!me.access) return !!me.hasAccess;   // access ирээгүй (сүлжээ) — серверийн шалгалт л шийднэ
  const u = subjectUntilOf(me, String(subject || '').trim());
  return !!(u && u > new Date());
}
// Промо кодын % хөнгөлөлттэй үнэ (lib/promo.js) — 10₮ хүртэл бүхэлчилнэ; 100₮-өөс бага бол 0 (QPay-гүйгээр шууд)
export function promoPrice(months, pct) {
  const p = planPrice(months);
  if (p == null) return null;
  const v = Math.round(p * (100 - pct) / 1000) * 10;
  return v < 100 ? 0 : v;
}
export const fmtMNT = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '₮';
// Хөтөч бүр mn-MN огноо дэмждэггүй тул гараар: «2027 оны 1-р сарын 23»
export function fmtDay(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()} оны ${x.getMonth() + 1}-р сарын ${x.getDate()}`;
}
