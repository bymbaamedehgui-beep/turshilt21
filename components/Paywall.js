import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/eyesh';
import { PLANS, MONTH_PRICE, planPrice, fullPrice, perMonth, promoPrice, fmtMNT, fmtDay as fmtDate } from '../lib/plans';

// ── Эрх авах / сунгах (QPay) ───────────────────────────────────────────────
const POLL_MS = 4000, POLL_MAX_MS = 10 * 60 * 1000;

export function Paywall({ me, renew, onPaid, onClose, onLogout }) {
  const [months, setMonths] = useState(6);
  const [inv, setInv] = useState(null);           // QPay нэхэмжлэх
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(null);         // { paidUntil, days? }
  const [err, setErr] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null);       // { code, kind:'percent'|'days', value } — /api/promo шалгасан
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoErr, setPromoErr] = useState('');
  const pollStart = useRef(0);

  const expired = !renew && me?.paidUntil && !me?.hasAccess;   // туршилт эсвэл төлсөн хугацаа дууссан
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const pct = promo?.kind === 'percent' ? promo.value : 0;
  const priceOf = m => pct ? promoPrice(m, pct) : planPrice(m);

  async function create() {
    setBusy(true); setErr('');
    try {
      const r = await apiFetch('/api/pay/create', { method: 'POST', body: { months, ...(pct ? { promo: promo.code } : {}) } });
      if (r.free) { setDone({ paidUntil: r.paidUntil }); onPaid && onPaid(r); }   // 100% хөнгөлөлт — QPay-гүйгээр
      else { setInv(r); pollStart.current = Date.now(); }
    }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  async function checkPromo(e) {
    e.preventDefault();
    setPromoBusy(true); setPromoErr('');
    try { const r = await apiFetch('/api/promo', { method: 'POST', body: { action: 'check', code: promoInput } }); setPromo(r); }
    catch (e2) { setPromoErr(e2.message); }
    setPromoBusy(false);
  }
  async function redeemDays() {
    setPromoBusy(true); setPromoErr('');
    try {
      const r = await apiFetch('/api/promo', { method: 'POST', body: { action: 'redeem', code: promo.code } });
      setDone({ paidUntil: r.paidUntil, days: r.days }); onPaid && onPaid(r);
    }
    catch (e) { setPromoErr(e.message); }
    setPromoBusy(false);
  }
  async function check(manual) {
    if (!inv || done) return;
    if (manual) setChecking(true);
    try {
      const r = await apiFetch('/api/pay/check', { method: 'POST', body: { id: inv.id } });
      if (r.paid) { setDone({ paidUntil: r.paidUntil }); onPaid && onPaid(r); }
      else if (manual) setErr('Төлбөр хараахан орж ирээгүй байна. Төлсний дараа хэдэн секунд хүлээгээд дахин шалгана уу.');
    } catch (e) { if (manual) setErr(e.message); }
    if (manual) setChecking(false);
  }
  // Төлбөр орохыг автоматаар хүлээнэ (QPay callback-аас гадна)
  useEffect(() => {
    if (!inv || done) return;
    const t = setInterval(() => { if (Date.now() - pollStart.current < POLL_MAX_MS) check(false); }, POLL_MS);
    return () => clearInterval(t);
  }, [inv, done]);

  if (done) return (
    <div className="pw">
      <div className="pw-card pw-done">
        <div className="pw-ok">✓</div>
        <h2>{done.days ? 'Промо код идэвхжлээ!' : 'Төлбөр амжилттай!'}</h2>
        <p>{done.days ? <>{done.days} хоног нэмэгдлээ. </> : null}Таны эрх <b>{fmtDate(done.paidUntil)}</b> хүртэл нээгдлээ.</p>
        <button className="cm-btn big" onClick={onClose}>Үргэлжлүүлэх →</button>
      </div>
    </div>
  );

  return (
    <div className="pw">
      <div className="pw-head">
        <img src="/chick.svg" alt="" />
        <div>
          <h1>{renew ? 'Эрх сунгах' : expired ? 'Эрхийн хугацаа дууслаа' : 'Эрх идэвхжүүлэх'}</h1>
          <p>{renew
            ? <>Одоогийн эрх <b>{fmtDate(me?.paidUntil)}</b> хүртэл. Сунгасан хугацаа үлдсэн хугацаан дээр нэмэгдэнэ.</>
            : 'Шалгалт, үр дүн, камераар шалгах бүх боломжийг үргэлжлүүлэн ашиглахын тулд багцаа сонгоно уу.'}</p>
        </div>
      </div>

      {!inv ? (
        <>
          <div className="pw-plans" role="radiogroup" aria-label="Багц">
            {PLANS.map(p => {
              const price = priceOf(p.months), full = fullPrice(p.months), off = pct ? Math.round((1 - price / full) * 100) : p.off;
              return (
                <button key={p.months} role="radio" aria-checked={months === p.months}
                  className={'pw-plan' + (months === p.months ? ' on' : '') + (p.best ? ' best' : '')} onClick={() => setMonths(p.months)}>
                  {p.best && <span className="pw-ribbon">Хамгийн ашигтай</span>}
                  <span className="pw-radio" />
                  <span className="pw-plan-m"><b>{p.months} сар</b>{off > 0 && <em>−{off}%</em>}</span>
                  <span className="pw-plan-p">
                    <b>{price === 0 ? 'Үнэгүй' : fmtMNT(price)}</b>
                    {off > 0 && <s>{fmtMNT(full)}</s>}
                  </span>
                  <span className="pw-plan-n">
                    {pct ? <>промо кодоор <i>{fmtMNT(full - price)} хэмнэнэ</i></>
                      : p.off > 0 ? <>сард <b>{fmtMNT(perMonth(p.months))}</b> · <i>{fmtMNT(full - price)} хэмнэнэ</i></> : <>сард {fmtMNT(MONTH_PRICE)}</>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pw-promo">
            {!promo && !promoOpen && <button className="cm-link" onClick={() => setPromoOpen(true)}>Промо код байна уу?</button>}
            {!promo && promoOpen && (
              <form className="pw-promo-f" onSubmit={checkPromo}>
                <input value={promoInput} onChange={e => setPromoInput(e.target.value)} placeholder="Промо код" aria-label="Промо код"
                  autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={40} autoFocus />
                <button className="cm-btn" disabled={promoBusy || !promoInput.trim()}>{promoBusy ? 'Шалгаж байна…' : 'Шалгах'}</button>
              </form>
            )}
            {promo && (
              <div className="pw-promo-ok">
                <span>🎟️ <b>{promo.code}</b> — {promo.kind === 'percent' ? `${promo.value}% хөнгөлөлт` : `${promo.value} хоногийн үнэгүй эрх`}</span>
                {promo.kind === 'days' && <button className="cm-btn" disabled={promoBusy} onClick={redeemDays}>{promoBusy ? 'Идэвхжүүлж байна…' : 'Идэвхжүүлэх'}</button>}
                <button className="cm-link" onClick={() => { setPromo(null); setPromoInput(''); setPromoErr(''); }}>Хасах</button>
              </div>
            )}
            {promoErr && <div className="cm-alert soft">{promoErr}</div>}
          </div>

          <ul className="pw-feats">
            <li>Камераар хязгааргүй шалгалт шалгах</li>
            <li>Хариултын хуудас хэвлэх, анализ, рейтинг, PDF/Excel</li>
            <li>Төлсөн даруй эрх нээгдэнэ — QPay, бүх банкны апп</li>
          </ul>
          {err && <div className="cm-alert">{err}</div>}
          <button className="cm-btn big pw-cta" disabled={busy} onClick={create}>
            {busy ? 'Нэхэмжлэх үүсгэж байна…' : priceOf(months) === 0 ? 'Промо кодоор үнэгүй идэвхжүүлэх' : <>QPay-ээр төлөх · {fmtMNT(priceOf(months))}</>}
          </button>
        </>
      ) : (
        <div className="pw-card pw-inv">
          <div className="pw-inv-h">
            <div><b>{inv.months} сарын эрх</b><span>QPay нэхэмжлэх{pct ? ` · ${promo.code}` : ''}</span></div>
            <strong>{fmtMNT(inv.amount)}</strong>
          </div>
          {inv.qr_image && <img className="pw-qr" src={`data:image/png;base64,${inv.qr_image}`} alt="QPay QR код" />}
          <div className="pw-wait"><span className="pw-dot" />Төлбөр хүлээж байна — төлмөгц автоматаар нээгдэнэ</div>
          {isMobile && inv.urls?.length > 0 && <>
            <div className="pw-banks-t">Банкны аппаар төлөх</div>
            <div className="pw-banks">
              {inv.urls.map(u => (
                <a key={u.name + u.link} href={u.link} className="pw-bank">
                  {u.logo && <img src={u.logo} alt="" />}<span>{u.description || u.name}</span>
                </a>
              ))}
            </div>
          </>}
          {!isMobile && <p className="pw-hint">Утасныхаа банкны аппаар QR кодыг уншуулж төлнө үү.</p>}
          {err && <div className="cm-alert soft">{err}</div>}
          <button className="cm-btn big" disabled={checking} onClick={() => check(true)}>{checking ? 'Шалгаж байна…' : 'Төлсөн — шалгах'}</button>
          <button className="cm-link" onClick={() => { setInv(null); setErr(''); }}>← Багц солих</button>
        </div>
      )}

      <div className="pw-foot">
        {renew && onClose && <button className="cm-link" onClick={onClose}>Буцах</button>}
        {!renew && onLogout && <button className="cm-link" onClick={onLogout}>Гарах</button>}
        <span>Асуулт байвал: 88449307</span>
      </div>
    </div>
  );
}
