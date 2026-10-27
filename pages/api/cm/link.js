import bcrypt from 'bcryptjs';
import { initDb, getTeacherByEmail, getTeacherById } from '../../../lib/db';
import { verifyToken } from '../../../lib/auth';
import { LINK_MAX_TRIES, LINK_CODE_COOLDOWN_SEC, LINK_CODE_DAY, LINK_FAIL_DAY, isCode, originOk, selfOrigins, normEmail, errPage, linkPage,
  finish, createCmTeacher, linkTeacher, pendingGet, pendingFail, pendingDel, pendingSetCode, codeOk, newLinkCode, sendLinkCode, linkLog,
  linkCount } from '../../../lib/cmsso';

// Өмнө нь бүртгэлтэй багшийг Дасгалын төвийн бүртгэлтэй нь холбох: /api/cm/sso-ийн маягт → энд (lib/cmsso.js)
//   act=session  — энэ хөтөч дээр eyeshcheck-д нэвтэрсэн (localStorage eyesh_token) дансанд холбоно (ямар ч имэйлтэй)
//   act=code     — Дасгалын төвийн имэйл рүү 6 оронтой код (тэр имэйлтэй eyeshcheck дансанд); act=verify — кодыг шалгах
//   act=password — eyeshcheck-д нэвтэрдэг имэйл (lemail, анхдагч нь Дасгалын төвийнх) + нууц үг;  act=pwform — эхний хуудас
// Буруу нууц үг/код: токен тутам LINK_MAX_TRIES, имэйл тутам 24 цагт LINK_FAIL_DAY; код илгээх: 1 минутын завсар, өдөрт LINK_CODE_DAY.
export default async function handler(req, res) {
  if (req.method !== 'POST') return errPage(res, 405, 'Дасгалын төвөөс «ЭЕШ шалгагч» товчийг дахин дарна уу.');
  if (!originOk(req, selfOrigins(req))) return errPage(res, 403, 'Хүсэлт буруу байна. Дасгалын төвөөс дахин оролдоно уу.');
  const b = req.body || {};
  const token = String(b.token || ''), password = String(b.password || ''), act = String(b.act || 'password');
  if (!isCode(token)) return errPage(res, 400, 'Хүсэлт буруу байна. Дасгалын төвөөс дахин оролдоно уу.');
  try {
    await initDb();
    const p = await pendingGet(token);
    if (!p) return errPage(res, 400, 'Хугацаа дууссан эсвэл хэт олон буруу оролдлого хийсэн байна. Дасгалын төвөөс «ЭЕШ шалгагч» товчийг дахин дарна уу.');
    const exam = p.exam || null, paidUntil = p.cm_paid_until ? new Date(p.cm_paid_until).toISOString() : null, email = p.email;
    // Холбогдсон данс → нэвтрэлтийг дуусгана (токеныг зарцуулна)
    const done = async (teacher) => {
      if (!(await pendingDel(token))) return errPage(res, 409, 'Энэ холбоос аль хэдийн ашиглагдсан байна.');
      const t2 = await linkTeacher(teacher.id, email, paidUntil);
      if (!t2) return errPage(res, 500, 'Түр алдаа гарлаа. Дахин оролдоно уу.');
      return finish(res, t2, exam);
    };
    let t = await getTeacherByEmail(email);
    if (!t) {   // хооронд нь данс устгагдсан — шинээр үүсгэнэ
      await pendingDel(token);
      t = await createCmTeacher({ email, name: p.name, paidUntil });
      if (!t) return errPage(res, 409, 'Түр алдаа гарлаа. Дасгалын төвөөс дахин оролдоно уу.');
      return await finish(res, t, exam);
    }
    if (act === 'pwform') return linkPage(res, { email, token });
    if (await linkCount(email, 'fail') >= LINK_FAIL_DAY)
      return errPage(res, 429, 'Энэ бүртгэлд өнөөдөр хэт олон буруу оролдлого хийгдлээ. 24 цагийн дараа дахин оролдоно уу.');

    if (act === 'session') {
      const s = verifyToken(String(b.jwt || ''));
      const st = s && s.teacherId && !s.studentId ? await getTeacherById(s.teacherId) : null;
      if (!st) return linkPage(res, { email, token, error: 'eyeshcheck-ийн нэвтрэлт хүчингүй болсон байна. Имэйл эсвэл нууц үгээр холбоно уу.' });
      if (st.status === 'disabled') return errPage(res, 403, 'Таны eyeshcheck эрх хаагдсан байна. Admin-тай холбогдоно уу.');
      return await done(st);
    }
    if (t.status === 'disabled') { await pendingDel(token); return errPage(res, 403, 'Таны eyeshcheck эрх хаагдсан байна. Admin-тай холбогдоно уу.'); }
    if (act === 'code') {
      if (p.code_sent_at && Date.now() - new Date(p.code_sent_at).getTime() < LINK_CODE_COOLDOWN_SEC * 1000)
        return linkPage(res, { email, token, mode: 'code', error: 'Код саяхан илгээгдсэн. 1 минутын дараа дахин илгээж болно.' });
      if (await linkCount(email, 'send') >= LINK_CODE_DAY)
        return linkPage(res, { email, token, mode: p.code_hash ? 'code' : undefined, error: 'Өнөөдөр хэт олон код илгээлээ. Маргааш дахин оролдоно уу эсвэл нууц үгээр холбоно уу.' });
      const code = newLinkCode();
      if (!(await sendLinkCode(email, code)))
        return linkPage(res, { email, token, error: 'Имэйл илгээж чадсангүй. eyeshcheck.com-д нэвтэрдэг имэйл, нууц үгээрээ холбоно уу.' });
      await pendingSetCode(token, code);
      await linkLog(email, 'send');
      return linkPage(res, { email, token, mode: 'code', info: 'Код илгээлээ.' });
    }
    if (act === 'verify') {
      if (codeOk(p, b.code)) return await done(t);
    } else {
      // eyeshcheck-д нэвтэрдэг имэйл (Дасгалын төвийнхөөс өөр байж болно) + нууц үг — login-тэй ижил шалгалт
      const lt = normEmail(b.lemail) && normEmail(b.lemail) !== email ? await getTeacherByEmail(normEmail(b.lemail)) : t;
      if (lt && lt.status !== 'disabled' && password.length > 0 && password.length <= 200 && await bcrypt.compare(password, lt.password_hash))
        return await done(lt);
    }
    await linkLog(email, 'fail');
    const n = await pendingFail(token);
    if (n >= LINK_MAX_TRIES) return errPage(res, 403, 'Хэт олон буруу оролдлого. Дасгалын төвөөс «ЭЕШ шалгагч» товчийг дахин дарна уу.');
    return act === 'verify'
      ? linkPage(res, { email, token, mode: 'code', error: 'Код буруу эсвэл хугацаа нь дууссан.', left: LINK_MAX_TRIES - n })
      : linkPage(res, { email, token, error: 'Имэйл эсвэл нууц үг буруу байна (eyeshcheck.com-д нэвтэрдэг имэйл, нууц үгээ оруулна уу).', left: LINK_MAX_TRIES - n });
  } catch (e) {
    console.error('[cm/link]', e.message);
    return errPage(res, 500, 'Түр алдаа гарлаа. Дасгалын төвөөс дахин оролдоно уу.');
  }
}
