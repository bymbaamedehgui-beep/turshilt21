import { initDb, getTeacherByEmail } from '../../../lib/db';
import { CM_ORIGINS, DEMO_EMAIL, isCode, originOk, redeem, normEmail, normExam, validDate, errPage, linkPage, finish,
  createCmTeacher, findCmTeacher, syncCm, pendingSave } from '../../../lib/cmsso';

// Дасгалын төвийн (cyber-math.com) ЭЕШ хуудсан дээрх «ЭЕШ шалгагч» товч → form POST {code} → энд.
// Нэвтрэлт + шалгалт үүсгэх дэлгэрэнгүй: lib/cmsso.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return errPage(res, 405, 'Энэ холбоосыг Дасгалын төвийн ЭЕШ хуудсан дээрх «ЭЕШ шалгагч» товчоор нээнэ.');
  if (!originOk(req, CM_ORIGINS)) return errPage(res, 403, 'Энэ холбоосыг зөвхөн Дасгалын төвөөс (cyber-math.com) нээнэ.');
  const code = String((req.body && req.body.code) || '');
  if (!isCode(code)) return errPage(res, 400, 'Холбоос буруу байна. Дасгалын төвөөс «ЭЕШ шалгагч» товчийг дахин дарна уу.');
  let r;
  try { r = await redeem(code); } catch (e) {
    console.error('[cm/sso] redeem', e.message);
    return errPage(res, 502, 'Дасгалын төвтэй холбогдож чадсангүй. Түр хүлээгээд дахин оролдоно уу.');
  }
  if (!r) return errPage(res, 400, 'Холбоосны хугацаа дууссан эсвэл аль хэдийн ашиглагдсан байна. Дасгалын төвөөс «ЭЕШ шалгагч» товчийг дахин дарна уу.');
  const email = normEmail(r.email);
  if (!email) return errPage(res, 400, 'Дасгалын төвийн бүртгэлийн имэйл буруу байна.');
  if (email === DEMO_EMAIL) return errPage(res, 403, 'Энэ бүртгэлээр нэвтрэх боломжгүй.');
  const exam = r.exam ? normExam(r.exam) : null;
  if (r.exam && !exam) console.error('[cm/sso] шалгалтын мэдээлэл буруу', email);
  const paidUntil = validDate(r.paidUntil);
  try {
    await initDb();
    // Энэ Дасгалын төвийн имэйлтэй холбосон данс (eyeshcheck-ийн имэйл нь өөр байж болно)
    let t = await findCmTeacher(email);
    if (!t) {
      const own = await getTeacherByEmail(email);
      if (own && own.status === 'disabled') return errPage(res, 403, 'Таны eyeshcheck эрх хаагдсан байна. Admin-тай холбогдоно уу.');
      // Өмнө нь өөрөө бүртгүүлсэн багш — нэг удаа холбоно (имэйлийн эзэмшлийг Дасгалын төв батлахгүй): /api/cm/link
      if (own) return linkPage(res, { email, token: await pendingSave({ email, name: r.name, paidUntil, exam }) });
      t = await createCmTeacher({ email, name: r.name, paidUntil });
      if (!t) {   // зэрэг хүсэлт үүсгэсэн
        t = await findCmTeacher(email);
        if (!t) return errPage(res, 409, 'Түр алдаа гарлаа. Дасгалын төвөөс дахин оролдоно уу.');
      }
    }
    if (t.status === 'disabled') return errPage(res, 403, 'Таны eyeshcheck эрх хаагдсан байна. Admin-тай холбогдоно уу.');
    t = await syncCm(t.id, paidUntil);
    if (!t) return errPage(res, 500, 'Түр алдаа гарлаа. Дахин оролдоно уу.');
    return await finish(res, t, exam);
  } catch (e) {
    console.error('[cm/sso]', e.message);
    return errPage(res, 500, 'Түр алдаа гарлаа. Дасгалын төвөөс дахин оролдоно уу.');
  }
}
