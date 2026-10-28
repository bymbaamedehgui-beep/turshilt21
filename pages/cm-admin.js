import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { setTokenOverride } from '../lib/eyesh';
import { AdminPanel } from '../components/AdminPanel';

// Дасгалын төвийн (cyber-math.com) админ хэсгийн «ЭЕШ шалгагч» цэс энэ хуудсыг iframe-ээр нээнэ.
// 1. Энэ хуудас эх цонх руу 'eyesh-admin-ready' илгээнэ.  2. Эх цонх (admin.html) Дасгалын төвийн админ эрхээр нэг удаагийн
// код авч 'eyesh-admin-code'-оор өгнө.  3. /api/cm/admin-session → eyeshcheck-ийн admin токен (2 цаг) — зөвхөн санах ойд.
// Мессежийг ЗӨВХӨН CM_ORIGINS-ээс хүлээж авна; next.config.js нь энэ хуудсыг өөр сайт iframe-д оруулахыг хориглоно.
const ORIGINS = (process.env.NEXT_PUBLIC_CM_ORIGINS || 'https://cyber-math.com,https://www.cyber-math.com').split(',').map(s => s.trim()).filter(Boolean);

export default function CmAdmin() {
  const [state, setState] = useState('wait');   // wait | ready | error | direct
  const [dark, setDark] = useState(false);
  const [err, setErr] = useState('');
  const parent = useRef(null);                  // эх цонхны origin (кодыг өгсөн)

  function ask() { ORIGINS.forEach(o => { try { window.parent.postMessage({ type: 'eyesh-admin-ready' }, o); } catch (e) {} }); }
  async function exchange(code) {
    setState('wait'); setErr('');
    try {
      const r = await fetch('/api/cm/admin-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token) throw new Error(d.error || 'Нэвтэрч чадсангүй');
      setTokenOverride(d.token);
      setState('ready');
    } catch (e) { setTokenOverride(null); setErr(e.message); setState('error'); }
  }

  useEffect(() => {
    if (window.parent === window) { setState('direct'); return; }
    function onMsg(e) {
      if (ORIGINS.indexOf(e.origin) < 0 || e.source !== window.parent) return;
      const d = e.data || {};
      parent.current = e.origin;
      if (typeof d.dark === 'boolean') setDark(d.dark);
      if (d.type === 'eyesh-admin-code' && typeof d.code === 'string') exchange(d.code);
    }
    function onExpired() { setTokenOverride(null); setState('wait'); ask(); }   // 2 цаг өнгөрсөн — шинэ код асууна
    window.addEventListener('message', onMsg);
    window.addEventListener('eyesh:auth-expired', onExpired);
    ask();
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('eyesh:auth-expired', onExpired); };
  }, []);

  useEffect(() => { document.body.classList.toggle('dark', dark); }, [dark]);

  // Эх цонх iframe-ийн өндрийг агуулгад тааруулна (дотор нь тусдаа гүйлгэхгүй)
  useEffect(() => {
    if (state === 'direct') return;
    const send = () => { if (parent.current) window.parent.postMessage({ type: 'eyesh-admin-height', h: document.documentElement.scrollHeight }, parent.current); };
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    send();
    return () => ro.disconnect();
  }, [state]);

  return (
    <>
      <Head><title>ЭЕШ шалгагч · Admin</title><meta name="robots" content="noindex" /></Head>
      <div style={{ padding: '6px 4px', background: dark ? '#0f1115' : 'transparent', minHeight: 200 }}>
        {state === 'ready' && <AdminPanel dark={dark} embed />}
        {state === 'wait' && <div className="cm-note" style={{ textAlign: 'center', padding: 40 }}>ЭЕШ шалгагчид нэвтэрч байна…</div>}
        {state === 'error' && (
          <div style={{ maxWidth: 520, margin: '24px auto', textAlign: 'center' }}>
            <div className="cm-alert">{err}</div>
            <button className="cm-btn" style={{ marginTop: 12 }} onClick={() => { setState('wait'); ask(); }}>Дахин оролдох</button>
          </div>
        )}
        {state === 'direct' && (
          <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 16px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 900 }}>Дасгалын төвийн админ хэсгээс нээнэ</h1>
            <p className="cm-note">Энэ хуудас cyber-math.com-ийн админ хэсгийн «ЭЕШ шалгагч» цэсэнд ажиллана.</p>
            <a className="cm-btn" href="/">eyeshcheck.com руу</a>
          </div>
        )}
      </div>
    </>
  );
}
