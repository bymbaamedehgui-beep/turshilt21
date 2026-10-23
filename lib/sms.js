// SMS баталгаажуулалт — textbee.dev (CyberMath-тай ижил төхөөрөмж). Зөвхөн сервер.
// Env: TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID. Код, бүтэн дугаар, түлхүүрийг лог руу бичихгүй.
import crypto from 'crypto';

const SEND_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms';
const MN_MOBILE = /^[689]\d{7}$/;

export function smsConfigured() { return !!process.env.TEXTBEE_API_KEY; }

// '9911 2233', '+976 99112233' → { local:'99112233', e164:'+97699112233' } | null
export function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('976')) d = d.slice(3);
  return MN_MOBILE.test(d) ? { local: d, e164: '+976' + d } : null;
}
export const maskPhone = local => '**** **' + String(local).slice(-2);

export function genCode() { return String(crypto.randomInt(100000, 1000000)); }
export function hashCode(code, salt) {
  return crypto.createHash('sha256').update(`eyesh-sms|${process.env.JWT_SECRET || ''}|${salt}|${code}`).digest('hex');
}

// → { ok:true } | { ok:false, cls:'CONFIG'|'AUTH'|'DEVICE'|'QUOTA'|'DOWN'|'TIMEOUT'|'FAIL' }
export async function sendSms(e164, message) {
  const key = process.env.TEXTBEE_API_KEY;
  if (!key) return { ok: false, cls: 'CONFIG' };
  const body = { recipients: [e164], message };
  if (process.env.TEXTBEE_DEVICE_ID) body.deviceId = process.env.TEXTBEE_DEVICE_ID;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(SEND_URL, { method: 'POST', headers: { 'x-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal });
    if (r.status >= 200 && r.status < 300) {
      const d = await r.json().catch(() => null);
      if (d && (d.success === false || d.data?.success === false)) return { ok: false, cls: 'FAIL' };
      return { ok: true };
    }
    return { ok: false, cls: r.status === 401 || r.status === 403 ? 'AUTH' : r.status === 404 ? 'DEVICE' : r.status === 429 ? 'QUOTA' : r.status >= 500 ? 'DOWN' : 'FAIL' };
  } catch (e) {
    return { ok: false, cls: ac.signal.aborted ? 'TIMEOUT' : 'DOWN' };
  } finally { clearTimeout(timer); }
}
