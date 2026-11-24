// PDF-ийг хөтчөөс Vercel Blob руу шууд байршуулна (серверийн 4.5MB хязгаар хамаарахгүй, том сурах бичиг ч болно).
// /api/upload нь зөвхөн нэвтэрсэн багшид (сурах бичигт admin) түр токен олгоно.
import { upload } from '@vercel/blob/client';
import { getToken } from './eyesh';

export const NOT_CONFIGURED = 'PDF байршуулах түр боломжгүй байна (файл хадгалах сан холбогдоогүй). Google Drive зэрэг холбоосоор нэмнэ үү.';

// Файл хадгалах сан холбогдсон эсэх (GET /api/upload) — үгүй бол «PDF байршуулах»-ыг хааж «Холбоос»-оор нэмүүлнэ
export async function uploadReady() {
  try { const r = await fetch('/api/upload'); return r.ok ? !!(await r.json()).configured : true; } catch (e) { return true; }
}

export async function uploadPdf(file, kind, onProgress) {
  const name = String(file.name || 'file.pdf').replace(/[^\w.\-]+/g, '_').slice(-80);
  const clientPayload = JSON.stringify({ token: getToken(), kind });
  try {
    const b = await upload(`${kind}/${name}`, file, {
      access: 'public', handleUploadUrl: '/api/upload', contentType: 'application/pdf', clientPayload,
      multipart: file.size > 20 * 1024 * 1024,
      onUploadProgress: e => onProgress && onProgress(Math.round(e.percentage)),
    });
    return { url: b.url, size: file.size };
  } catch (e) {
    // @vercel/blob серверийн хариуг «Failed to retrieve the client token» болгож нуудаг — бодит шалтгааныг дахин асууна
    if (!/client token/i.test(String(e?.message || ''))) throw e;
    let msg = '';
    try {
      const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: `${kind}/${name}`, clientPayload, multipart: false } }) });
      if (r.status === 503) msg = NOT_CONFIGURED;
      else if (!r.ok) msg = (await r.json().catch(() => ({}))).error || '';
    } catch (e2) {}
    throw new Error(msg || 'PDF байршуулж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу, эсвэл холбоосоор нэмнэ үү.');
  }
}
