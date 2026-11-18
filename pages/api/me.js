import { getTeacherById, hasAccess, accessUntil, getAccessInfo, initDb, welcomeOffer } from '../../lib/db';
import { requireAuth } from '../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  const teacher = await getTeacherById(req.teacherId);
  if (!teacher) return res.status(404).json({ error: 'Олдсонгүй' });
  let access = null;   // хичээл бүрийн эрх, сургууль, урилга (lib/db.js getAccessInfo)
  try { access = await getAccessInfo(teacher); } catch (e) { console.error('[me access]', e.message); }
  let welcome = null;  // шинэ бүртгэлийн 24 цагийн урамшуулал { until } (lib/db.js welcomeOffer)
  try { welcome = await welcomeOffer(teacher); } catch (e) { console.error('[me welcome]', e.message); }
  res.json({
    id: teacher.id,
    email: teacher.email,
    name: teacher.name,
    isAdmin: teacher.is_admin,
    status: teacher.status,
    paidUntil: accessUntil(teacher),
    hasAccess: hasAccess(teacher),
    unlimited: !!teacher.is_admin || teacher.email === 'demo@eyeshcheck.com',   // бүх хичээл хугацаагүй
    access,
    welcome,
  });
});
