import { initDb, getGoals, saveGoals } from '../../../lib/db';
import { requireStudent } from '../../../lib/auth';

// «Миний зорилго»: хичээл бүрийн зорилтот оноо (1–100, аппын ЭЕШ оноотой ижил хэмжээ), элсэх сургууль, мэргэжил
const clean = (v, n) => String(v || '').trim().slice(0, n);

export default requireStudent(async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();
  await initDb();
  const b = req.body || {};
  const targets = {};
  Object.entries(b.targets && typeof b.targets === 'object' ? b.targets : {}).slice(0, 20).forEach(([k, v]) => {
    const n = Math.round(Number(v));
    const subject = clean(k, 60);
    if (subject && Number.isFinite(n) && n >= 1 && n <= 100) targets[subject] = n;
  });
  await saveGoals(req.student.id, { targets, university: clean(b.university, 200), major: clean(b.major, 200) });
  res.json(await getGoals(req.student.id));
});
