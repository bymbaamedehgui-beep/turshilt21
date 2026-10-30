import { initDb, getCmAdminTeacher } from '../../../lib/db';
import { signCmAdminToken } from '../../../lib/auth';
import { isCode, redeem, originOk, selfOrigins } from '../../../lib/cmsso';

// Дасгалын төвийн (cyber-math.com) админ хэсгийн «ЭЕШ шалгагч» цэс → pages/cm-admin.js (iframe) → POST {code} → энд.
// Кодыг cyber-math.com/api/eyesh?action=redeem-ээр (сервер-сервер, нэг удаа, 2 минут) шалгаж { kind:'admin' } ирвэл
// eyeshcheck-ийн admin дансаар 2 цагийн токен өгнө (iframe санах ойд л хадгална). Шинэ нууц түлхүүр шаардахгүй —
// багшийн SSO-той (lib/cmsso.js) ижил итгэлцэл: кодыг зөвхөн Дасгалын төвийн админ үүсгэнэ.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST хүсэлт шаардлагатай' });
  if (!originOk(req, selfOrigins(req))) return res.status(403).json({ error: 'Зөвшөөрөгдөөгүй эх сурвалж' });
  const code = String(req.body?.code || '');
  if (!isCode(code)) return res.status(400).json({ error: 'Код буруу байна' });
  let r;
  try { r = await redeem(code); } catch (e) {
    console.error('[cm/admin-session] redeem', e.message);
    return res.status(502).json({ error: 'Дасгалын төвтэй холбогдож чадсангүй. Дахин оролдоно уу.' });
  }
  if (!r || r.kind !== 'admin') return res.status(401).json({ error: 'Кодын хугацаа дууссан. «ЭЕШ шалгагч» цэсийг дахин нээнэ үү.' });
  try {
    await initDb();
    const t = await getCmAdminTeacher();
    if (!t) return res.status(404).json({ error: 'eyeshcheck-д admin данс алга байна' });
    return res.json({ token: signCmAdminToken(t.id, t.email), teacher: { id: t.id, name: t.name || '', email: t.email, isAdmin: true } });
  } catch (e) {
    console.error('[cm/admin-session]', e.message);
    return res.status(500).json({ error: 'Түр алдаа гарлаа. Дахин оролдоно уу.' });
  }
}
