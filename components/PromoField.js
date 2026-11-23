import { useState } from 'react';
import { apiFetch } from '../lib/eyesh';

// Промо код оруулах талбар — сургуулийн эрх (SchoolPage), «ЭЕШ сан» (EeshBank). /api/promo {action:'check', code, scope} —
// тэр эрхэд хамаарахгүй, хугацаа/хязгаар дууссан кодыг сервер татгалзана. Хөнгөлөлтийн (%) код л: үнийг эцэг компонент pctPrice-ээр
// тооцож /api/pay/create-д {promo: code} илгээнэ (сервер дахин шалгана). promo — { code, kind, value } | null.
export function PromoField({ scope, promo, onChange, disabled = false }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function check(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await apiFetch('/api/promo', { method: 'POST', body: { action: 'check', code: input, scope } });
      if (r.kind !== 'percent') setErr('Үнэгүй хоногийн код зөвхөн багшийн нэг хичээлийн эрхэд хэрэглэгдэнэ.');
      else onChange(r);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }
  function clear() { onChange(null); setInput(''); setErr(''); }

  return (
    <div className="pw-promo">
      <div className="pw-promo-t">Промо код ашиглах</div>
      {promo ? (
        <div className="pw-promo-ok">
          <span><b>{promo.code}</b> — {promo.value}% хөнгөлөлт</span>
          <button type="button" className="cm-link" disabled={disabled} onClick={clear}>Хасах</button>
        </div>
      ) : (
        <form className="pw-promo-f" onSubmit={check}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Кодоо бичнэ үү" aria-label="Промо код"
            autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={40} disabled={disabled} />
          <button className="cm-btn" disabled={disabled || busy || !input.trim()}>{busy ? 'Шалгаж байна…' : 'Ашиглах'}</button>
        </form>
      )}
      {err && <div className="cm-alert soft">{err}</div>}
    </div>
  );
}
