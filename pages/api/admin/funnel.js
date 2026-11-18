// Admin: «Хувиргалт» — сүүлийн N хоногт бүртгүүлсэн багш нар аль шатанд хүрсэн (lib/db.js getFunnel).
// GET ?days=7|30|90|0 (0 — бүх хугацаа) → { days, steps:[{ key, label, count, day1? }], teachers:[…] }
// day1 — бүртгүүлснээс хойш 24 цагийн дотор (одоогийн 1 хоногийн туршилтын дотор) тэр шатанд хүрсэн багш
import { requireAuth } from '../../../lib/auth';
import { initDb, getTeacherById, getFunnel } from '../../../lib/db';

const DAY = 86400000;
const iso = v => (v ? new Date(v).toISOString() : null);
const inDay = (from, to) => !!(from && to && new Date(to) - new Date(from) <= DAY);

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });
  const days = [7, 30, 90, 0].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const since = days ? new Date(Date.now() - days * DAY).toISOString() : '1970-01-01T00:00:00.000Z';
  const teachers = (await getFunnel(since)).map(r => ({
    id: r.id, name: r.name || '', email: r.email, phone: r.phone || '', cm: !!r.cm_linked, createdAt: iso(r.created_at),
    exams: r.exams, accounts: r.accounts, sheets: r.sheets,
    firstExamAt: iso(r.first_exam_at), firstSheetAt: iso(r.first_sheet_at), paidAt: iso(r.first_paid_at),
  }));
  const count = f => teachers.filter(f).length;
  const steps = [
    { key: 'signup', label: 'Бүртгүүлсэн', count: teachers.length },
    { key: 'exam', label: 'Шалгалт үүсгэсэн', count: count(t => t.exams > 0), day1: count(t => inDay(t.createdAt, t.firstExamAt)) },
    { key: 'accounts', label: 'Сурагч нэмсэн', count: count(t => t.accounts > 0) },
    { key: 'sheets', label: 'Дүн гарсан', count: count(t => t.sheets > 0), day1: count(t => inDay(t.createdAt, t.firstSheetAt)) },
    { key: 'paid', label: 'Төлсөн', count: count(t => !!t.paidAt) },
  ];
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ days, steps, teachers });
});
