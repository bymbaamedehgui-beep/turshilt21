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
export const fmtMNT = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '₮';
// Хөтөч бүр mn-MN огноо дэмждэггүй тул гараар: «2027 оны 1-р сарын 23»
export function fmtDay(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()} оны ${x.getMonth() + 1}-р сарын ${x.getDate()}`;
}
