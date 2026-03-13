import { getTeacherById, isTeacherActive, initDb } from '../../lib/db';
import { requireAuth } from '../../lib/auth';

export default requireAuth(async function handler(req, res) {
  await initDb();
  const teacher = await getTeacherById(req.teacherId);
  if (!teacher) return res.status(404).json({ error: 'Олдсонгүй' });
  res.json({
    id: teacher.id,
    email: teacher.email,
    name: teacher.name,
    subscriptionStatus: teacher.subscription_status,
    trialEndsAt: teacher.trial_ends_at,
    isActive: isTeacherActive(teacher),
  });
});
