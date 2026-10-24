// Утас баталгаажуулалт — verify.mn (MO): хэрэглэгч дэлгэц дээрх кодыг өөрийн утаснаас 144773 руу SMS-ээр илгээнэ,
// verify.mn «тэр дугаараас тэр текст ирлээ» гэж батална. CyberMath-ийн api/_verifymn.js-тэй ижил API. Зөвхөн сервер.
// Env: VERIFYMN_API_KEY. Түлхүүр, sessionId, бүтэн дугаарыг лог / хариу руу гаргахгүй.
import crypto from 'crypto';

export const SHORTCODE = '144773';
export const TTL_SEC = 300;           // verify.mn session 5 минут
const BASE = 'https://api.verify.mn';
const MN_MOBILE = /^[689]\d{7}$/;

export function verifyConfigured() { return !!process.env.VERIFYMN_API_KEY; }

// '9911 2233', '+976 99112233' → { local:'99112233' } | null
export function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('976')) d = d.slice(3);
  return MN_MOBILE.test(d) ? { local: d } : null;
}
export const maskPhone = local => '**** **' + String(local).slice(-2);
export const genCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
// pollToken: клиентэд түүхий утга, DB-д зөвхөн хэш (sessionId клиент рүү гарахгүй)
export const newPollToken = () => crypto.randomBytes(24).toString('hex');
export const pollHash = tok => crypto.createHash('sha256').update('eyesh-vfm|' + String(tok)).digest('hex');

// → { ok:true, body } | { ok:false, cls:'CONFIG'|'AUTH'|'LIMIT'|'DOWN'|'TIMEOUT'|'FAIL', http? }
async function call(path, { method = 'GET', body } = {}) {
  const key = process.env.VERIFYMN_API_KEY;
  if (!key) return { ok: false, cls: 'CONFIG' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(BASE + path, {
      method, signal: ac.signal,
      headers: { Authorization: 'Bearer ' + key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => null);
    if (r.status < 200 || r.status >= 300) {
      return { ok: false, http: r.status, cls: r.status === 401 || r.status === 403 ? 'AUTH' : r.status === 429 ? 'LIMIT' : r.status >= 500 ? 'DOWN' : 'FAIL' };
    }
    return { ok: true, body: d || {} };
  } catch (e) {
    return { ok: false, cls: ac.signal.aborted ? 'TIMEOUT' : 'DOWN' };
  } finally { clearTimeout(timer); }
}

// Session үүсгэнэ: phoneLocal-аас text ирэхийг хүлээнэ → { ok, sessionId, shortcode, expiresAt } | { ok:false, cls }
export async function createSession(phoneLocal, text) {
  if (!MN_MOBILE.test(String(phoneLocal)) || !/^[A-Za-z0-9]{4,16}$/.test(String(text))) return { ok: false, cls: 'INPUT' };
  const r = await call('/sessions', { method: 'POST', body: { phone: phoneLocal, text } });
  if (!r.ok) return r;
  const sid = typeof r.body.sessionId === 'string' ? r.body.sessionId : null;
  if (!sid) return { ok: false, cls: 'FAIL' };
  return {
    ok: true, sessionId: sid,
    shortcode: typeof r.body.shortcode === 'string' ? r.body.shortcode : SHORTCODE,
    expiresAt: typeof r.body.expiresAt === 'string' ? r.body.expiresAt : null,
  };
}

// Албан ёсны төлөв → { ok, status:'VERIFIED'|'PENDING'|'EXPIRED'|'UNKNOWN' } | { ok:false, cls }
export async function sessionStatus(sessionId) {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(sessionId || ''))) return { ok: false, cls: 'FAIL' };
  const r = await call('/sessions/' + encodeURIComponent(sessionId));
  if (!r.ok) return r;
  const raw = String(r.body.sessionStatus || r.body.status || '').toUpperCase();
  return { ok: true, status: ['VERIFIED', 'PENDING', 'EXPIRED'].includes(raw) ? raw : 'UNKNOWN' };
}
