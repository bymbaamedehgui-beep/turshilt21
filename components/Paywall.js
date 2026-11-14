import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/eyesh';
import { PLANS, MONTH_PRICE, SUBJECTS, CM_SUBJECT, planPrice, fullPrice, perMonth, promoPrice, fmtMNT, fmtDay as fmtDate, subjectUntilOf } from '../lib/plans';

// ── Эрх авах / сунгах (QPay) ───────────────────────────────────────────────
// Багц НЭГ хичээлийнх (lib/plans.js): багш хичээлээ сонгоод төлнө. Олон хичээл — «Сургуулийн эрх» (components/SchoolPage.js).
const POLL_MS = 4000, POLL_MAX_MS = 10 * 60 * 1000;
const isMobileUA = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
export const fmtDot = d => { const x = new Date(d); return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`; };

// Хичээл сонгох: multi=false — нэг (багшийн эрх), true — олон (сургууль). badge(s) — товчны доорх жижиг бичиг (эрхийн огноо г.м.)
export function SubjectChips({ value, onChange, multi = false, badge }) {
  const sel = new Set(multi ? (value || []) : value ? [value] : []);
  function tap(s) {
    if (!multi) return onChange(s);
    const n = new Set(sel); if (n.has(s)) n.delete(s); else n.add(s);
    onChange(SUBJECTS.filter(x => n.has(x)));
  }
  return (
    <div className="pw-subs" role={multi ? 'group' : 'radiogroup'} aria-label="Хичээл">
      {SUBJECTS.map(s => {
        const on = sel.has(s), b = badge && badge(s);
        return (
          <button key={s} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={'pw-sub' + (on ? ' on' : '')} onClick={() => tap(s)}>
            <span>{s}</span>{b && <small>{b}</small>}
          </button>
        );
      })}
    </div>
  );
}

// QPay нэхэмжлэх: QR, банкны апп, төлбөрийг автоматаар шалгана. onPaid(r) — /api/pay/check-ийн хариу (paid:true)
export function QPayInvoice({ inv, title, sub, onPaid, onBack }) {
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState('');
  const start = useRef(Date.now()), paidRef = useRef(false);
  const isMobile = isMobileUA();
  async function check(manual) {
    if (paidRef.current) return;
    if (manual) { setChecking(true); setErr(''); }
    try {
      const r = await apiFetch('/api/pay/check', { method: 'POST', body: { id: inv.id } });
      if (r.paid && !paidRef.current) { paidRef.current = true; onPaid && onPaid(r); }
      else if (manual && !r.paid) setErr('Төлбөр хараахан орж ирээгүй байна. Төлсний дараа хэдэн секунд хүлээгээд дахин шалгана уу.');
    } catch (e) { if (manual) setErr(e.message); }
    if (manual) setChecking(false);
  }
  // Төлбөр орохыг автоматаар хүлээнэ (QPay callback-аас гадна)
  useEffect(() => {
    start.current = Date.now(); paidRef.current = false;
    const t = setInterval(() => { if (Date.now() - start.current < POLL_MAX_MS) check(false); }, POLL_MS);
    return () => clearInterval(t);
  }, [inv.id]);
  return (
    <div className="pw-card pw-inv">
      <div className="pw-inv-h">
        <div><b>{title}</b><span>{sub || 'QPay нэхэмжлэх'}</span></div>
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
      {onBack && <button className="cm-link" onClick={onBack}>← Буцах</button>}
    </div>
  );
}

// Одоогийн хүчинтэй эрхүүд: бүх хичээл (хуучин багц/туршилт), Дасгалын төв (математик), хичээл бүрийн (өөрийн, сургуулийн)
export function MyAccess({ me }) {
  const a = me?.access, now = new Date();
  if (!a) return null;
  const items = [];
  if (a.all && new Date(a.all) > now) items.push({ k: 'all', t: 'Бүх хичээл', u: a.all, n: 'өмнөх багц' });
  if (a.cm && new Date(a.cm) > now) items.push({ k: 'cm', t: CM_SUBJECT, u: a.cm, n: 'Дасгалын төв' });
  (a.licenses || []).filter(l => new Date(l.until) > now).forEach(l => items.push({ k: l.subject + (l.school?.id || ''), t: l.subject, u: l.until, n: l.school ? l.school.name : '' }));
  if (!items.length) return null;
  return (
    <div className="pw-mine">
      <b>Одоогийн эрх</b>
      {items.map(i => <span key={i.k}>{i.t} — {fmtDot(i.u)} хүртэл{i.n ? <i> · {i.n}</i> : null}</span>)}
    </div>
  );
}

export function Paywall({ me, renew, subject: subject0, onPaid, onClose, onLogout, onSchool }) {
  const own = (me?.access?.licenses || []).filter(l => !l.school).sort((a, b) => new Date(b.until) - new Date(a.until));
  const [subject, setSubject] = useState(() => subject0 || own[0]?.subject || SUBJECTS[0]);
  useEffect(() => { if (subject0) setSubject(subject0); }, [subject0]);
  const [months, setMonths] = useState(6);
  const [inv, setInv] = useState(null);           // QPay нэхэмжлэх
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);         // { paidUntil, days?, subject }
  const [err, setErr] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null);       // { code, kind:'percent'|'days', value } — /api/promo шалгасан
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoErr, setPromoErr] = useState('');

  const expired = !renew && me?.paidUntil && !me?.hasAccess;   // туршилт эсвэл төлсөн хугацаа дууссан
  const pct = promo?.kind === 'percent' ? promo.value : 0;
  const priceOf = m => pct ? promoPrice(m, pct) : planPrice(m);
  const until = subjectUntilOf(me, subject), active = !!(until && until > new Date());

  async function create() {
    setBusy(true); setErr('');
    try {
      const r = await apiFetch('/api/pay/create', { method: 'POST', body: { months, subject, ...(pct ? { promo: promo.code } : {}) } });
      if (r.free) { setDone({ paidUntil: r.paidUntil, subject }); onPaid && onPaid(r); }   // 100% хөнгөлөлт — QPay-гүйгээр
      else setInv(r);
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
      const r = await apiFetch('/api/promo', { method: 'POST', body: { action: 'redeem', code: promo.code, subject } });
      setDone({ paidUntil: r.paidUntil, days: r.days, subject }); onPaid && onPaid(r);
    }
    catch (e) { setPromoErr(e.message); }
    setPromoBusy(false);
  }

  if (done) return (
    <div className="pw">
      <div className="pw-card pw-done">
        <div className="pw-ok">✓</div>
        <h2>{done.days ? 'Промо код идэвхжлээ!' : 'Төлбөр амжилттай!'}</h2>
        <p>{done.days ? <>{done.days} хоног нэмэгдлээ. </> : null}«{done.subject}» хичээлийн эрх <b>{fmtDate(done.paidUntil)}</b> хүртэл нээгдлээ.</p>
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
          <p>{active
            ? <>«{subject}» хичээлийн эрх <b>{fmtDate(until)}</b> хүртэл. Сунгасан хугацаа үлдсэн дээр нэмэгдэнэ.</>
            : 'Багц нэг хичээлийнх — хичээлээ сонгоод хугацаагаа сонгоно уу.'}</p>
        </div>
      </div>

      {!inv ? (
        <>
          <div className="pw-sec">Хичээл</div>
          <SubjectChips value={subject} onChange={s => { setSubject(s); setErr(''); }}
            badge={s => { const u = subjectUntilOf(me, s); return u && u > new Date() ? fmtDot(u) + ' хүртэл' : null; }} />
          <MyAccess me={me} />

          <div className="pw-sec">Хугацаа</div>
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
            <div className="pw-promo-t">Промо код ашиглах</div>
            {!promo && (
              <form className="pw-promo-f" onSubmit={checkPromo}>
                <input value={promoInput} onChange={e => setPromoInput(e.target.value)} placeholder="Кодоо бичнэ үү" aria-label="Промо код"
                  autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={40} />
                <button className="cm-btn" disabled={promoBusy || !promoInput.trim()}>{promoBusy ? 'Шалгаж байна…' : 'Ашиглах'}</button>
              </form>
            )}
            {promo && (
              <div className="pw-promo-ok">
                <span>🎟️ <b>{promo.code}</b> — {promo.kind === 'percent' ? `${promo.value}% хөнгөлөлт` : `«${subject}»-д ${promo.value} хоногийн үнэгүй эрх`}</span>
                {promo.kind === 'days' && <button className="cm-btn" disabled={promoBusy} onClick={redeemDays}>{promoBusy ? 'Идэвхжүүлж байна…' : 'Идэвхжүүлэх'}</button>}
                <button className="cm-link" onClick={() => { setPromo(null); setPromoInput(''); setPromoErr(''); }}>Хасах</button>
              </div>
            )}
            {promoErr && <div className="cm-alert soft">{promoErr}</div>}
          </div>

          <ul className="pw-feats">
            <li>«{subject}» хичээлээр шалгалт үүсгэж, камераар хязгааргүй шалгах</li>
            <li>Хариултын хуудас хэвлэх, анализ, рейтинг, PDF/Excel</li>
            <li>Төлсөн даруй эрх нээгдэнэ — QPay, бүх банкны апп</li>
          </ul>
          {err && <div className="cm-alert">{err}</div>}
          <button className="cm-btn big pw-cta" disabled={busy} onClick={create}>
            {busy ? 'Нэхэмжлэх үүсгэж байна…' : priceOf(months) === 0 ? 'Промо кодоор үнэгүй идэвхжүүлэх' : <>QPay-ээр төлөх · {fmtMNT(priceOf(months))}</>}
          </button>
          {onSchool && <div className="pw-school">Олон хичээл, олон багштай бол <button onClick={onSchool}>Сургуулийн эрх →</button></div>}
        </>
      ) : (
        <QPayInvoice inv={inv} title={`${subject} · ${inv.months} сарын эрх`} sub={`QPay нэхэмжлэх${pct ? ` · ${promo.code}` : ''}`}
          onPaid={r => { setDone({ paidUntil: r.paidUntil, subject }); onPaid && onPaid(r); }} onBack={() => { setInv(null); setErr(''); }} />
      )}

      <div className="pw-foot">
        {renew && onClose && <button className="cm-link" onClick={onClose}>Буцах</button>}
        {!renew && onLogout && <button className="cm-link" onClick={onLogout}>Гарах</button>}
        <span>Асуулт байвал: 88449307</span>
      </div>
    </div>
  );
}
