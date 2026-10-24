// PDF-ийг хөтчөөс Vercel Blob руу шууд байршуулна (серверийн 4.5MB хязгаар хамаарахгүй, том сурах бичиг ч болно).
// /api/upload нь зөвхөн нэвтэрсэн багшид (сурах бичигт admin) түр токен олгоно.
import { upload } from '@vercel/blob/client';
import { getToken } from './eyesh';

export async function uploadPdf(file, kind, onProgress) {
  const name = String(file.name || 'file.pdf').replace(/[^\w.\-]+/g, '_').slice(-80);
  const b = await upload(`${kind}/${name}`, file, {
    access: 'public', handleUploadUrl: '/api/upload', contentType: 'application/pdf',
    clientPayload: JSON.stringify({ token: getToken(), kind }),
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: e => onProgress && onProgress(Math.round(e.percentage)),
  });
  return { url: b.url, size: file.size };
}
