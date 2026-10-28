// Интернэтгүй уншуулах: уншуулсан хуудсыг утсанд (IndexedDB) хадгалж, интернэт орж ирэхэд POST /api/students-ээр илгээнэ.
// Мөн сүүлд татсан өгөгдлийг (шалгалт, дүн, сурагчдын жагсаалт) хадгалж апп интернэтгүй нээгдэхэд ашиглана.
// Нэг утсанд хэд хэдэн багш нэвтэрч болох тул бүгдийг багш бүрээр (teacherId) нь тусад нь хадгална.
import { getToken } from './eyesh';

let dbp = null;
function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Энэ хөтөч утсанд хадгалж чадахгүй байна')); return; }
    const r = indexedDB.open('eyesh-offline', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}
async function read(store, fn) {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const r = fn(d.transaction(store, 'readonly').objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
// Бичилт: transaction бүрэн хадгалагдтал хүлээнэ (утсан дээр л байгаа дүнг алдахгүйн тулд)
async function write(store, fn) {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, 'readwrite');
    fn(t.objectStore(store));
    t.oncomplete = () => resolve();
    t.onerror = t.onabort = () => reject(t.error || new Error('Утсанд хадгалж чадсангүй'));
  });
}

// Токены payload дахь teacherId — шалгахгүй, зөвхөн утсан дээрх өгөгдлийг багшаар нь ялгахад
export function currentTeacherId() {
  try {
    const t = getToken();
    if (!t) return '';
    const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return p && p.teacherId && !p.studentId ? String(p.teacherId) : '';
  } catch (e) { return ''; }
}

// fetch нь сүлжээгүй, хугацаа хэтэрсэн үед TypeError / AbortError шиддэг (apiFetch ч мөн)
export function isNetworkError(e) {
  return !!e && (e.name === 'TypeError' || e.name === 'AbortError');
}

// ── Сүүлд татсан өгөгдөл: data:<багш> = { me, exams, students }, roster:<багш> = сурагчдын жагсаалт ──
export async function cacheGet(name) {
  const tid = currentTeacherId();
  if (!tid) return undefined;
  try { return await read('kv', s => s.get(name + ':' + tid)); } catch (e) { return undefined; }
}
export async function cacheSet(name, value) {
  const tid = currentTeacherId();
  if (!tid) return;
  try { await write('kv', s => s.put(value, name + ':' + tid)); } catch (e) {}
}
export async function cacheClear() {
  const tid = currentTeacherId();
  if (!tid) return;
  try { await write('kv', s => { s.delete('data:' + tid); s.delete('roster:' + tid); }); } catch (e) {}
}

// ── Илгээх дараалал: { id (= дүнгийн id), teacherId, body, createdAt, error? } ──
export async function queueList() {
  const tid = currentTeacherId();
  if (!tid) return [];
  try {
    return (await read('queue', s => s.getAll())).filter(x => x.teacherId === tid)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  } catch (e) { return []; }
}
export async function queueAdd(body) {
  const tid = currentTeacherId();
  if (!tid) throw new Error('Дахин нэвтэрнэ үү');
  await write('queue', s => s.put({ id: body.id, teacherId: tid, body, createdAt: new Date().toISOString() }));
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
}
export async function queueRemove(ids) {
  await write('queue', s => [].concat(ids).forEach(id => s.delete(id)));
}
async function queueSetError(item, error) {
  await write('queue', s => s.put({ ...item, error }));
}
// Илгээж чадаагүй гэж тэмдэглэснийг дахин оролдохоор цэвэрлэнэ
export async function queueRetry() {
  const items = (await queueList()).filter(x => x.error);
  if (items.length) await write('queue', s => items.forEach(({ error, ...x }) => s.put(x)));
}

// Нэг дүнг илгээнэ; ms хугацаанд хариу ирэхгүй бол AbortError (сул сүлжээнд хүлээлгэхгүй)
export async function postStudent(body, ms = 5000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), ms) : null;
  try {
    return await fetch('/api/students', {
      method: 'POST', signal: ctl ? ctl.signal : undefined,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
      body: JSON.stringify(body),
    });
  } finally { if (timer) clearTimeout(timer); }
}

// Дарааллыг хуучнаас нь эхлэн илгээнэ. Нэг зэрэг нэг л илгээлт явна.
// stopped: 'offline' | 'auth' (401) | 'paywall' (402) | 'server' (5xx) — үлдсэнийг дараа дахин оролдоно.
// 400/403/404 (жишээ нь шалгалт устсан) бол тэр хуудсыг error-той тэмдэглэж алгасна — багш шийднэ.
let sending = null;
export function sendQueued(handlers = {}) {
  if (!sending) sending = doSend(handlers).finally(() => { sending = null; });
  return sending;
}
async function doSend({ onSent, onFailed }) {
  const out = { sent: 0, failed: 0, stopped: null };
  if (!getToken() || !currentTeacherId()) return out;
  for (const item of await queueList()) {
    if (item.error) continue;
    if (!(await queueList()).some(x => x.id === item.id)) continue;   // энэ хооронд багш устгасан
    let res;
    try { res = await postStudent(item.body, 15000); }
    catch (e) { out.stopped = 'offline'; break; }
    if (res.ok) {
      const saved = await res.json().catch(() => null);
      await queueRemove(item.id);
      out.sent++;
      if (onSent) onSent(item, saved || item.body);
      continue;
    }
    if (res.status === 401) { out.stopped = 'auth'; break; }
    if (res.status === 402) { out.stopped = 'paywall'; break; }
    if (res.status >= 500 || res.status === 408 || res.status === 429) { out.stopped = 'server'; break; }
    const msg = (await res.json().catch(() => ({}))).error || ('Алдаа ' + res.status);
    await queueSetError(item, msg);
    out.failed++;
    if (onFailed) onFailed(item, msg);
  }
  return out;
}
