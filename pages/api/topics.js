import { initDb, getTeacherTopics, addTeacherTopic, removeTeacherTopic } from '../../lib/db';
import { requirePaid } from '../../lib/auth';

// Багшийн өөрөө нэмсэн агуулга (сэдэв): GET → { хичээл: [агуулга, ...] },
// POST { subject, name } нэмэх, DELETE ?subject=&name= хасах — хоёулаа шинэ жагсаалтаа буцаана
const MAX_TOPICS = 300;
const MAX_NAME = 60;

export default requirePaid(async function handler(req, res) {
  await initDb();
  if (req.method === 'GET') return res.json(await getTeacherTopics(req.teacherId));
  if (req.method === 'POST' || req.method === 'DELETE') {
    const src = req.method === 'POST' ? (req.body || {}) : req.query;
    const subject = String(src.subject || '').trim().slice(0, 100);
    const name = String(src.name || '').replace(/\s+/g, ' ').trim();
    if (!subject || !name) return res.status(400).json({ error: 'Агуулгын нэр оруулна уу' });
    if (name.length > MAX_NAME) return res.status(400).json({ error: `Агуулгын нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй` });
    if (req.method === 'POST') {
      const mine = await getTeacherTopics(req.teacherId);
      const total = Object.values(mine).reduce((n, list) => n + list.length, 0);
      if (total >= MAX_TOPICS) return res.status(400).json({ error: `Хамгийн ихдээ ${MAX_TOPICS} агуулга нэмэх боломжтой` });
      await addTeacherTopic(req.teacherId, subject, name);
      return res.status(201).json(await getTeacherTopics(req.teacherId));
    }
    await removeTeacherTopic(req.teacherId, subject, name);
    return res.json(await getTeacherTopics(req.teacherId));
  }
  res.status(405).end();
});
