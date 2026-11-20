import { requirePaid } from '../../lib/auth';
import { initDb, getTeacherById, denySubject } from '../../lib/db';
import { ensurePapers, normPaper, listPapers, getPaper, savePaper, deletePaper, countPapers } from '../../lib/tpaper';

// Багшийн зохиосон онлайн шалгалт (lib/tpaper.js, components/PaperEditor.js):
// GET → жагсаалт; GET ?id= → бүтэн эх; POST { id?, title, subject, doc, open? } → { id, examId, open }; DELETE ?id= → архивт.
// Хадгалахад тухайн хичээлийн эрх хэрэгтэй (шалгалт үүсгэхтэй ижил). Зурагтай тул хүсэлт 4MB хүртэл (Vercel 4.5MB).
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };
const DEMO_EMAIL = 'demo@eyeshcheck.com';

export default requirePaid(async function handler(req, res) {
  await initDb();
  await ensurePapers();
  if (req.method === 'GET') {
    if (req.query.id) {
      const p = await getPaper(req.teacherId, req.query.id);
      return p ? res.json(p) : res.status(404).json({ error: 'Олдсонгүй' });
    }
    return res.json(await listPapers(req.teacherId));
  }
  if (req.method === 'POST') {
    const t = await getTeacherById(req.teacherId);
    const p = normPaper(req.body);
    if (p.error) return res.status(400).json({ error: p.error });
    if (await denySubject(res, t, p.subject)) return;
    const id = req.body?.id ? String(req.body.id) : null;
    if (!id && t?.email === DEMO_EMAIL && (await countPapers(t.id)) >= 1) return res.status(403).json({ error: 'Demo хэрэглэгч 1 онлайн шалгалт зохионо' });
    const open = typeof req.body?.open === 'boolean' ? req.body.open : undefined;
    const r = await savePaper(req.teacherId, id, p, { open });
    return r ? res.json(r) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  if (req.method === 'DELETE') {
    return (await deletePaper(req.teacherId, req.query.id)) ? res.json({ ok: true }) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  res.status(405).end();
});
