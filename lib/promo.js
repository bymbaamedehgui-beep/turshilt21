// Промо код. Багш төлбөрийн дэлгэц (components/Paywall.js) дээр оруулна; админ (☰ Admin, эсвэл Дасгалын төвийн админы
// «ЭЕШ шалгагч» цэс) үүсгэнэ — pages/api/admin/promo.js.
//   percent — QPay нэхэмжлэхийг % хямдруулна (pages/api/pay/create.js); төлбөр орсны дараа «ашигласан» тоологдоно.
//             100% (эсвэл 100₮-өөс бага) бол QPay-гүйгээр сонгосон сараар шууд сунгана.
//   days    — үнэгүй хоног: «Идэвхжүүлэх» дармагц эрх шууд нэмэгдэнэ (pages/api/promo.js).
// Багш бүр нэг кодыг нэг л удаа. Буруу кодыг өдөрт FAIL_MAX удаа оролдоно (таамаглахаас сэргийлнэ).
import crypto from 'crypto';
import { getPromo, promoUsedBy, promoFailCount, bumpPromoFail } from './db';

export const FAIL_MAX = 20;
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
  return { code: p.code, kind: p.kind, value: p.value, maxUses: p.max_uses, usedCount: p.used_count,
    expiresAt: p.expires_at, active: p.active, note: p.note || '', createdAt: p.created_at };
}

// Энэ багш кодыг одоо хэрэглэж болох эсэх → { ok:true, promo } | { ok:false, status?, error }
export async function checkPromo(teacherId, raw) {
  if (await promoFailCount(teacherId) >= FAIL_MAX) return { ok: false, status: 429, error: 'Хэт олон буруу оролдлого. Маргааш дахин оролдоно уу.' };
  const code = normCode(raw);
  const p = code ? await getPromo(code) : null;
  if (!p || !p.active) { await bumpPromoFail(teacherId); return { ok: false, error: 'Промо код буруу байна' }; }
  if (p.expires_at && new Date(p.expires_at) <= new Date()) return { ok: false, error: 'Промо кодын хугацаа дууссан байна' };
  if (p.max_uses != null && p.used_count >= p.max_uses) return { ok: false, error: 'Промо кодын хэрэглэх хязгаар дууссан байна' };
  if (await promoUsedBy(p.code, teacherId)) return { ok: false, error: 'Та энэ кодыг аль хэдийн ашигласан байна' };
  return { ok: true, promo: p };
}
