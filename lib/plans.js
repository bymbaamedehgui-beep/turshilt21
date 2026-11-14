// Эрхийн багцууд — нүүр хуудас, төлбөрийн дэлгэц, сервер (QPay нэхэмжлэх) бүгд ЭНЭ файлыг ашиглана.
export const MONTH_PRICE = 9900;   // 1 сар
export const TRIAL_DAYS = 1;       // шинэ бүртгэлийн үнэгүй туршилт
export const PLANS = [
  { months: 1, off: 0 },
  { months: 3, off: 20 },
  { months: 6, off: 30, best: true },
];

export function planOf(months) {
  return PLANS.find(p => p.months === Number(months)) || null;
}
export function fullPrice(months) { return MONTH_PRICE * months; }
// Хямдралтай үнэ — 10₮ хүртэл бүхэлчилнэ
export function planPrice(months) {
  const p = planOf(months);
  if (!p) return null;
  return Math.round(fullPrice(p.months) * (100 - p.off) / 1000) * 10;
}
export function perMonth(months) { return Math.round(planPrice(months) / months / 10) * 10; }

// Эрх хичээл бүрээр: багцын үнэ нэг хичээлийнх. Багш нэг хичээл, сургууль хэд ч хичээл (хичээл бүр ижил үнэ) авна.
// 2026.11-ээс өмнө төлсөн / туршилтын эрх (teachers.paid_until) бүх хичээлд хугацаа дуустлаа хүчинтэй.
export const SUBJECTS = ['Математик','Физик','Хими','Биологи','Монгол хэл','Түүх','Газарзүй','Англи хэл','Нийгмийн ухаан'];
export const CM_SUBJECT = 'Математик';   // Дасгалын төв (cyber-math.com) дээр төлсөн эрх — зөвхөн математик
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
