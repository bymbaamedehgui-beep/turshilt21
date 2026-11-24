// Google Drive файл «Холбоостой хэн ч» нээлттэй эсэх — материал нэмэхэд багшид анхааруулна (components/MaterialsPanel.js).
// GET ?id=<Drive файлын ID>[&rk=<resourcekey>] → { status: 'public' | 'private' | 'missing' | 'unknown' }. Зөвхөн нэвтэрсэн
// багш, зөвхөн drive.google.com. Нэвтрэлтгүй хандахад: нээлттэй файл 200, хаалттай нь 401 «Нэвтэрнэ үү» (эсвэл нэвтрэх
// хуудас руу чиглүүлнэ), байхгүй нь 404.
import { requireAuth } from '../../lib/auth';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const id = String(req.query.id || ''), rk = String(req.query.rk || '');
  if (!/^[-\w]{20,100}$/.test(id) || (rk && !/^[-\w]{1,100}$/.test(rk))) return res.status(400).json({ error: 'Drive файлын холбоос буруу байна' });
  let status = 'unknown';
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`https://drive.google.com/file/d/${id}/view` + (rk ? '?resourcekey=' + rk : ''), { redirect: 'manual', signal: ctl.signal });
    const loc = r.headers.get('location') || '';
    if (r.status === 200) status = 'public';
    else if (r.status === 404) status = 'missing';
    else if (r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400 && /accounts\.google\.com|ServiceLogin/i.test(loc))) status = 'private';
  } catch (e) { /* хугацаа хэтэрсэн/сүлжээ — шалгахгүйгээр хадгалуулна */ }
  clearTimeout(t);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ status });
});
