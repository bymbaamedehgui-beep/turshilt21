import { handleUpload } from '@vercel/blob/client';
import { verifyToken } from '../../lib/auth';
import { initDb, getTeacherById, hasAccess } from '../../lib/db';
import { blobConfigured } from '../../lib/blobstore';

// Vercel Blob client upload: хөтөч файлаа шууд Blob руу илгээнэ, энд зөвхөн түр токен олгоно.
// Багш эрхтэй байх ёстой; сурах бичиг (kind 'textbook') зөвхөн admin. Зөвхөн PDF, 300MB хүртэл.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!blobConfigured()) return res.status(503).json({ error: 'Файл хадгалах сан тохируулагдаагүй байна. Одоохондоо холбоосоор нэмнэ үү.' });
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let p = {};
        try { p = JSON.parse(clientPayload || '{}'); } catch (e) {}
        const auth = verifyToken(String(p.token || ''));
        if (!auth?.teacherId || auth.studentId) throw new Error('Нэвтрэх шаардлагатай');
        await initDb();
        const t = await getTeacherById(auth.teacherId);
        if (!t || !hasAccess(t)) throw new Error('Эрхийн хугацаа дууссан');
        if (p.kind === 'textbook' && !t.is_admin) throw new Error('Сурах бичгийг зөвхөн admin нэмнэ');
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 300 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ teacherId: t.id }),
        };
      },
      onUploadCompleted: async () => {},   // бичлэгийг клиент /api/materials-аар хадгална
    });
    res.json(json);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Байршуулж чадсангүй' });
  }
}
