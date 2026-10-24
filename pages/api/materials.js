import { initDb, getTeacherById, getMaterials, createMaterial, deleteMaterial } from '../../lib/db';
import { requirePaid } from '../../lib/auth';
import { deleteBlob } from '../../lib/blobstore';

// Багшийн ЭЕШ материал ба admin-ий 12-р ангийн сурах бичиг: жагсаах, нэмэх (байршуулсан PDF эсвэл холбоос), устгах
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
// https холбоос (хөгжүүлэлтэд localhost) л хүлээж авна
function cleanUrl(u) {
  try {
    const x = new URL(String(u || ''));
    return x.protocol === 'https:' || (x.protocol === 'http:' && x.hostname === 'localhost') ? x.toString() : null;
  } catch (e) { return null; }
}

export default requirePaid(async function handler(req, res) {
  await initDb();
  const t = await getTeacherById(req.teacherId);
  const kind = (req.query.kind || req.body?.kind) === 'textbook' ? 'textbook' : 'material';
  if (kind === 'textbook' && req.method !== 'GET' && !t?.is_admin) return res.status(403).json({ error: 'Сурах бичгийг зөвхөн admin нэмнэ' });

  if (req.method === 'GET') return res.json(await getMaterials({ kind, teacherId: req.teacherId }));
  if (req.method === 'POST') {
    const b = req.body || {};
    const url = cleanUrl(b.url);
    const title = String(b.title || '').trim().slice(0, 300);
    if (!title) return res.status(400).json({ error: 'Гарчиг оруулна уу' });
    if (!url) return res.status(400).json({ error: 'PDF файл эсвэл https:// холбоос оруулна уу' });
    const m = await createMaterial({
      id: genId(), teacherId: req.teacherId, kind, title, url,
      subject: String(b.subject || '').trim().slice(0, 100),
      size: Number(b.size) > 0 ? Math.round(Number(b.size)) : null,
      class: kind === 'material' ? String(b.class || '').trim().slice(0, 100) : '',
    });
    return res.status(201).json(m);
  }
  if (req.method === 'DELETE') {
    const m = await deleteMaterial(String(req.query.id || ''), req.teacherId, !!t?.is_admin);
    if (!m) return res.status(404).json({ error: 'Олдсонгүй' });
    await deleteBlob(m.url);
    return res.json({ ok: true });
  }
  res.status(405).end();
});
