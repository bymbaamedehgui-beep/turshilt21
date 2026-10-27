import bcrypt from 'bcryptjs';
import { initDb, getTeacherByEmail } from '../../../lib/db';
import { LINK_MAX_TRIES, isCode, originOk, selfOrigins, errPage, linkPage, finish, createCmTeacher, syncCm,
  pendingGet, pendingFail, pendingDel } from '../../../lib/cmsso';

// Өмнө нь бүртгэлтэй багшийг Дасгалын төвийн бүртгэлтэй нь холбох: /api/cm/sso-ийн нууц үгийн маягт → энд (lib/cmsso.js)
export default async function handler(req, res) {
  if (req.method !== 'POST') return errPage(res, 405, 'Дасгалын төвөөс «ЭЕШ шалгагч» товчийг дахин дарна уу.');
  if (!originOk(req, selfOrigins(req))) return errPage(res, 403, 'Хүсэлт буруу байна. Дасгалын төвөөс дахин оролдоно уу.');
  const token = String((req.body && req.body.token) || ''), password = String((req.body && req.body.password) || '');
  if (!isCode(token)) return errPage(res, 400, 'Хүсэлт буруу байна. Дасгалын төвөөс дахин оролдоно уу.');
  try {
    await initDb();
    const p = await pendingGet(token);
    if (!p) return errPage(res, 400, 'Хугацаа дууссан эсвэл хэт олон буруу оролдлого хийсэн байна. Дасгалын төвөөс «ЭЕШ шалгагч» товчийг дахин дарна уу.');
    const exam = p.exam || null, paidUntil = p.cm_paid_until ? new Date(p.cm_paid_until).toISOString() : null;
    let t = await getTeacherByEmail(p.email);
    if (!t) {   // хооронд нь данс устгагдсан — шинээр үүсгэнэ
      await pendingDel(token);
      t = await createCmTeacher({ email: p.email, name: p.name, paidUntil });
      if (!t) return errPage(res, 409, 'Түр алдаа гарлаа. Дасгалын төвөөс дахин оролдоно уу.');
      return await finish(res, t, exam);
    }
    if (t.status === 'disabled') { await pendingDel(token); return errPage(res, 403, 'Таны eyeshcheck эрх хаагдсан байна. Admin-тай холбогдоно уу.'); }
    const ok = password.length > 0 && password.length <= 200 && await bcrypt.compare(password, t.password_hash);
    if (!ok) {
      const n = await pendingFail(token);
      if (n >= LINK_MAX_TRIES) return errPage(res, 403, 'Хэт олон буруу оролдлого. Дасгалын төвөөс «ЭЕШ шалгагч» товчийг дахин дарна уу.');
      return linkPage(res, { email: p.email, token, error: 'Нууц үг буруу байна.', left: LINK_MAX_TRIES - n });
    }
    if (!(await pendingDel(token))) return errPage(res, 409, 'Энэ холбоос аль хэдийн ашиглагдсан байна.');
    t = await syncCm(t.id, paidUntil, true);
    if (!t) return errPage(res, 500, 'Түр алдаа гарлаа. Дахин оролдоно уу.');
    return await finish(res, t, exam);
  } catch (e) {
    console.error('[cm/link]', e.message);
    return errPage(res, 500, 'Түр алдаа гарлаа. Дасгалын төвөөс дахин оролдоно уу.');
  }
}
