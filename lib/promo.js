// Промо код. Багш төлбөрийн дэлгэц (components/Paywall.js) дээр оруулна; админ (☰ Admin, эсвэл Дасгалын төвийн админы
// «ЭЕШ шалгагч» цэс) үүсгэнэ — pages/api/admin/promo.js.
//   percent — QPay нэхэмжлэхийг % хямдруулна (pages/api/pay/create.js); төлбөр орсны дараа «ашигласан» тоологдоно.
//             100% (эсвэл 100₮-өөс бага) бол QPay-гүйгээр сонгосон сараар шууд сунгана.
//   days    — үнэгүй хоног: «Идэвхжүүлэх» дармагц эрх шууд нэмэгдэнэ (pages/api/promo.js).
// Багш бүр нэг кодыг нэг л удаа. Буруу кодыг өдөрт FAIL_MAX удаа оролдоно (таамаглахаас сэргийлнэ).
// Хамрах эрх (promo_codes.scopes, таслалаар): teacher — багшийн нэг хичээлийн багц (Paywall), school — сургуулийн эрх
// (SchoolPage), bank — «ЭЕШ сан» (EeshBank). Хуучин код = teacher. Үнэгүй хоногийн (days) код зөвхөн багшийн эрхэд.
import crypto from 'crypto';
import { getPromo, promoUsedBy, promoFailCount, bumpPromoFail, usedWelcome } from './db';
import { PROMO_SCOPES as SCOPES, PROMO_SCOPE_LABEL as SCOPE_LABEL } from './plans';

export const FAIL_MAX = 20;
export { SCOPES, SCOPE_LABEL };
// ['school','bank'] | 'school,bank' → SCOPES-ийн дарааллаар, давхардалгүй
export function normScopes(list) {
  const want = new Set((Array.isArray(list) ? list : String(list || '').split(',')).map(s => String(s || '').trim()));
  return SCOPES.filter(s => want.has(s));
}
export function promoScopes(p) { const s = normScopes(p?.scopes); return s.length ? s : ['teacher']; }
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
const GEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 32 тэмдэгт — андуурагдах O/0, I/1 байхгүй

export function normCode(c) {
  const s = String(c || '').toUpperCase().replace(/\s+/g, '');
  return CODE_RE.test(s) ? s : null;
}
export function genCode() {
  const b = crypto.randomBytes(8);
  let s = 'EY-';
  for (let i = 0; i < 8; i++) s += GEN[b[i] % GEN.length];
  return s;
}
export function promoView(p) {
  return { code: p.code, kind: p.kind, value: p.value, scopes: promoScopes(p), maxUses: p.max_uses, usedCount: p.used_count,
    expiresAt: p.expires_at, active: p.active, note: p.note || '', createdAt: p.created_at, noWelcome: p.no_welcome !== false };
}

// Энэ багш кодыг одоо хэрэглэж болох эсэх → { ok:true, promo } | { ok:false, status?, error }
// scope ('teacher'|'school'|'bank') өгвөл тэр эрхэд хамаарах эсэхийг шалгана (хамаарахгүй нь буруу оролдлогод тоологдохгүй)
export async function checkPromo(teacherId, raw, scope = null) {
  if (await promoFailCount(teacherId) >= FAIL_MAX) return { ok: false, status: 429, error: 'Хэт олон буруу оролдлого. Маргааш дахин оролдоно уу.' };
  const code = normCode(raw);
  const p = code ? await getPromo(code) : null;
  if (!p || !p.active) { await bumpPromoFail(teacherId); return { ok: false, error: 'Промо код буруу байна' }; }
  if (p.expires_at && new Date(p.expires_at) <= new Date()) return { ok: false, error: 'Промо кодын хугацаа дууссан байна' };
  if (p.max_uses != null && p.used_count >= p.max_uses) return { ok: false, error: 'Промо кодын хэрэглэх хязгаар дууссан байна' };
  if (scope && !promoScopes(p).includes(scope))
    return { ok: false, error: 'Энэ промо код зөвхөн дараах эрхэд хэрэглэгдэнэ: ' + promoScopes(p).map(s => SCOPE_LABEL[s]).join(', ') };
  if (await promoUsedBy(p.code, teacherId)) return { ok: false, error: 'Та энэ кодыг аль хэдийн ашигласан байна' };
  // Шинэ хэрэглэгчийн 50% урамшуулал авсан багшид давхар хөнгөлөлт өгөхгүй (кодын no_welcome, анхдагч) — сургуулийн эрх нь
  // сургуулийн худалдан авалт тул хамаарахгүй
  if (p.no_welcome !== false && scope !== 'school' && await usedWelcome(teacherId))
    return { ok: false, error: 'Та шинэ хэрэглэгчийн 50% урамшууллыг авсан тул энэ промо код танд хэрэглэгдэхгүй (хөнгөлөлт давхцахгүй).' };
  return { ok: true, promo: p };
}
