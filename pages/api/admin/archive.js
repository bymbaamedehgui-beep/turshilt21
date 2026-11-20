import { initDb, getTeacherById } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { ensurePapers, adminPapers, adminPaper, adminMaterials, adminMaterialDoc, materialDoc } from '../../../lib/tpaper';
import { renderMaterial } from '../cm/material';

// Admin «Багш нарын материал» архив (components/ArchiveAdmin.js) — багш устгасан ч үлдсэн бүх зүйл:
// GET ?tab=papers|materials&q=&offset= → жагсаалт; GET ?paper=<id> | ?material=<id> → { html } (хариутай, iframe srcdoc-д).
export const config = { api: { responseLimit: false } };

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  await initDb();
  const me = await getTeacherById(req.teacherId);
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin эрх шаардлагатай' });
  await ensurePapers();
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.query.paper) {
    const r = await adminPaper(req.query.paper);
    if (!r) return res.status(404).json({ error: 'Олдсонгүй' });
    return res.json({ html: renderMaterial(materialDoc({ title: r.title, subject: r.subject, doc: r.doc })) });
  }
  if (req.query.material) {
    const d = await adminMaterialDoc(req.query.material);
    return d ? res.json({ html: renderMaterial(d) }) : res.status(404).json({ error: 'Олдсонгүй' });
  }
  const q = String(req.query.q || '').slice(0, 100), offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const list = req.query.tab === 'materials' ? await adminMaterials({ q, offset, limit: 100 }) : await adminPapers({ q, offset, limit: 100 });
  res.json(list);
});
