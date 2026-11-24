// Google Drive холбоос (материал, сурах бичиг): файлын ID-г олж стандарт «…/file/d/<id>/view» хэлбэрт оруулна —
// «open?id=», «uc?id=…&export=download», «/view?usp=sharing» гэх мэт бүгд нэг хэлбэрт. Хавтас, Docs холбоосыг хөндөхгүй.
const host = url => { try { return new URL(String(url || '').trim()).hostname; } catch (e) { return ''; } };

export const isDriveUrl = url => /^(drive|docs)\.google\.com$/.test(host(url));

export function driveFileId(url) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch (e) { return null; }
  if (u.hostname !== 'drive.google.com' || /\/folders\//.test(u.pathname)) return null;
  const m = u.pathname.match(/\/file\/d\/([-\w]{20,})/);
  if (m) return m[1];
  const q = u.searchParams.get('id');
  return q && /^[-\w]{20,}$/.test(q) ? q : null;
}

// 2021 оноос өмнөх зарим файлын холбоос «resourcekey»-тэй — түүнгүйгээр нээгдэхгүй тул хадгална
export function driveResourceKey(url) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch (e) { return null; }
  const k = u.searchParams.get('resourcekey');
  return k && /^[-\w]{1,100}$/.test(k) ? k : null;
}

export function normalizeDriveUrl(url) {
  const id = driveFileId(url), rk = driveResourceKey(url);
  return id ? `https://drive.google.com/file/d/${id}/view` + (rk ? '?resourcekey=' + rk : '') : String(url || '').trim();
}
