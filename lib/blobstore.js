// Байршуулсан PDF (Vercel Blob). Материал устгахад файлыг нь хамт устгана. Зөвхөн сервер.
// Env: BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob store-ийг төсөлд холбоход автоматаар нэмэгдэнэ)
import { del } from '@vercel/blob';

export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const isBlobUrl = url => /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i.test(String(url || ''));

export async function deleteBlob(url) {
  if (!blobConfigured() || !isBlobUrl(url)) return;   // гаднын холбоосыг хөндөхгүй
  try { await del(url); } catch (e) { console.error('[blob] delete', e?.message); }
}
