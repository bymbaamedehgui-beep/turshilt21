import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/eyesh';
import { fmtMNT, fmtDay, BANK_MONTH_PRICE } from '../lib/plans';
import { QPayInvoice } from './Paywall';

// «ЭЕШ сан» (☰ цэс, pages/index.js 'bank'): хичээл → он → хувилбар сонгоод нэг товчоор хариутай шалгалт + хэвлэх материал
// (+ боломжтой бол онлайн шалгалт). Эрх — «ЭЕШ сан» багц (сард 29,900₮ — бүх хичээлийн шалгагчтай хамт, pages/api/pay/create.js).
// Жагсаалтыг эрхгүй багш ч харна. Сервер: pages/api/eesh/bank.js, lib/eeshbank.js.
function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
      {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
const I = {
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  ok: 'M20 6 9 17l-5-5',
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  pdf: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
};

export function EeshBank({ me, onCreated, onPaid, onHome }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [subject, setSubject] = useState(null);
  const [year, setYear] = useState(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(null);       // үүсгэж буй мөрийн id
  const [made, setMade] = useState({});         // id → { examId, online }
  const [months, setMonths] = useState(1);
  const [inv, setInv] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState('');
  const [paid, setPaid] = useState(null);

  async function load() {
    try {
      const d = await apiFetch('/api/eesh/bank');
      setData(d); setErr('');
      setSubject(s => s || d.subjects.find(x => d.items.some(i => i.subject === x)) || d.subjects[0]);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  const items = (data?.items || []).filter(i => i.subject === subject);
  const years = [...new Set(items.map(i => i.year))].sort((a, b) => b - a);
  const shown = year && years.includes(year) ? items.filter(i => i.year === year) : items;
  const count = s => (data?.items || []).filter(i => i.subject === s).length;

  async function use(it) {
    setBusy(it.id); setErr('');
    try {
      const r = await apiFetch('/api/eesh/bank', { method: 'POST', body: { id: it.id, online: online && it.html } });
      setMade(m => ({ ...m, [it.id]: r }));
      onCreated && onCreated(r);
    } catch (e) { setErr(e.message); }
    setBusy(null);
  }
  async function buy() {
    setPayBusy(true); setPayErr('');
    try { setInv(await apiFetch('/api/pay/create', { method: 'POST', body: { months, bank: true } })); }
    catch (e) { setPayErr(e.message); }
    setPayBusy(false);
  }
  function onInvPaid(r) { setInv(null); setPaid(r); load(); onPaid && onPaid(r); }

  if (!data) return <div className="eb"><h1 className="mp-title">ЭЕШ сан</h1>{err ? <div className="cm-alert">{err}</div> : <div className="eb-empty">Ачаалж байна…</div>}</div>;
  const access = data.access, price = data.price || BANK_MONTH_PRICE;

  return (
    <div className="eb">
      <div className="eb-head">
        <span className="eb-ic"><Ico d={I.book} size={26} /></span>
        <div>
          <h1>ЭЕШ сан</h1>
          <p>Хичээл бүрийн ЭЕШ-ийн даалгавар он, хувилбараар — нэг товчоор хариутай шалгалт, хэвлэх материал, онлайн шалгалт.</p>
          {access && data.until && <div className="eb-until"><Ico d={I.ok} size={15} />Эрх {fmtDay(data.until)} хүртэл</div>}
        </div>
      </div>

      {paid && <div className="eb-note ok"><Ico d={I.ok} />Төлбөр амжилттай — ЭЕШ сан болон бүх хичээлийн эрх нээгдлээ.</div>}
      {err && <div className="cm-alert">{err}</div>}

      <div className="pw-sec">Хичээл</div>
      <div className="eb-chips" role="tablist" aria-label="Хичээл">
        {data.subjects.map(s => (
          <button key={s} role="tab" aria-selected={subject === s} className={subject === s ? 'on' : ''} onClick={() => { setSubject(s); setYear(null); }}>
            {s}<i>{count(s)}</i>
          </button>
        ))}
      </div>
      {years.length > 1 && <>
        <div className="pw-sec">Он</div>
        <div className="eb-chips sm">
          <button className={!year ? 'on' : ''} onClick={() => setYear(null)}>Бүгд</button>
          {years.map(y => <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>)}
        </div>
      </>}

      {access && items.some(i => i.html) && (
        <label className="eb-online"><input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} />
          Онлайн шалгалт: сурагчид бодлогыг утсаараа харж, хариултаа сонгоно</label>
      )}

      {shown.length === 0 && <div className="eb-empty">«{subject}» хичээлийн материал удахгүй нэмэгдэнэ.</div>}
      <div className="eb-list">
        {shown.map(it => {
          const m = made[it.id];
          return (
            <div key={it.id} className="eb-item">
              <div className="eb-item-t">
                <b>{it.year} · хувилбар {it.variant}</b>
                <span>{it.title}</span>
                <div className="eb-tags">
                  <em>{it.sec1Count} тест{it.useSec2 ? ' + 2-р хэсэг' : ''}</em>
                  {it.pdf && <em><Ico d={I.pdf} size={13} />PDF</em>}
                  {it.html && <em><Ico d={I.globe} size={13} />Онлайн</em>}
                </div>
              </div>
              {m ? (
                <div className="eb-made"><span><Ico d={I.ok} size={15} />{m.created ? 'Шалгалт үүслээ' : 'Шалгалт өмнө үүссэн'}{m.online ? ' · онлайн нээлттэй' : ''}</span>
                  {onHome && <button className="cm-link" onClick={onHome}>Шалгалтууд руу →</button>}</div>
              ) : access ? (
                <button className="cm-btn" disabled={busy === it.id} onClick={() => use(it)}>{busy === it.id ? 'Үүсгэж байна…' : 'Шалгалт үүсгэх'}</button>
              ) : (
                <span className="eb-lock"><Ico d={I.lock} size={15} />Эрх авсны дараа</span>
              )}
            </div>
          );
        })}
      </div>

      {!access && (
        <div className="eb-buy" id="eb-buy">
          {inv ? <QPayInvoice inv={inv} title={`ЭЕШ сан · ${inv.months} сар`} sub="Бүх хичээлийн шалгагч + ЭЕШ сан" onPaid={onInvPaid} onBack={() => setInv(null)} /> : <>
            <div className="eb-buy-h"><b>ЭЕШ сан + бүх хичээлийн шалгагч</b><span>Сард {fmtMNT(price)} — ЭЕШ-ийн бүх хичээлийн материал, шалгагчийн бүх хичээлийн эрх нэг багцад.</span></div>
            <div className="pw-plans" role="radiogroup" aria-label="Хугацаа">
              {data.months.map(mo => (
                <button key={mo} role="radio" aria-checked={months === mo} className={'pw-plan' + (months === mo ? ' on' : '')} onClick={() => setMonths(mo)}>
                  <span className="pw-radio" />
                  <span className="pw-plan-m"><b>{mo} сар</b></span>
                  <span className="pw-plan-p"><b>{fmtMNT(price * mo)}</b></span>
                  <span className="pw-plan-n">сард {fmtMNT(price)}</span>
                </button>
              ))}
            </div>
            {payErr && <div className="cm-alert">{payErr}</div>}
            <button className="cm-btn big" disabled={payBusy} onClick={buy}>{payBusy ? 'Нэхэмжлэх үүсгэж байна…' : `QPay-ээр төлөх — ${fmtMNT(price * months)}`}</button>
          </>}
        </div>
      )}

      <style jsx global>{`
        .eb{max-width:860px;margin:0 auto;padding:16px 16px 40px}
        .eb-head{display:flex;gap:14px;align-items:flex-start;margin:4px 2px 16px}
        .eb-ic{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--purple-l);color:var(--purple-d);flex-shrink:0}
        .eb-head h1{font-size:23px;font-weight:900;margin:0 0 2px}
        .eb-head p{color:var(--soft);font-size:14.5px;margin:0}
        .eb-until{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;font-weight:900;color:#047857}
        .eb-note{display:flex;align-items:center;gap:8px;border-radius:14px;padding:11px 14px;font-size:14px;font-weight:800;margin-bottom:14px}
        .eb-note.ok{background:#e9f8ef;color:#15803d;border:1px solid #b7e4c7}
        .eb-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
        .eb-chips button{display:inline-flex;align-items:center;gap:7px;border:1.6px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:.5rem .95rem;font-weight:800;font-size:14px;cursor:pointer}
        .eb-chips button i{font-style:normal;font-size:12px;font-weight:900;min-width:20px;padding:1px 6px;border-radius:999px;background:var(--chip);color:var(--soft)}
        .eb-chips button.on{border-color:var(--purple);background:var(--purple-l);color:var(--purple-d)}
        .eb-chips button.on i{background:var(--purple);color:#fff}
        .eb-chips.sm button{padding:.35rem .8rem;font-size:13px}
        .eb-online{display:flex;align-items:center;gap:9px;margin:0 2px 12px;font-size:14px;font-weight:700;color:var(--ink);cursor:pointer}
        .eb-online input{width:18px;height:18px;accent-color:var(--purple)}
        .eb-empty{color:var(--soft);font-size:14px;padding:18px 4px}
        .eb-list{display:grid;gap:10px;margin-bottom:18px}
        .eb-item{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--line);background:var(--card);border-radius:16px;padding:14px 16px}
        .eb-item-t{flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:2px}
        .eb-item-t b{font-size:16px;font-weight:900}
        .eb-item-t>span{color:var(--soft);font-size:13px;overflow:hidden;text-overflow:ellipsis}
        .eb-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
        .eb-tags em{display:inline-flex;align-items:center;gap:4px;font-style:normal;font-size:12px;font-weight:800;padding:2px 8px;border-radius:8px;background:var(--chip);color:var(--soft)}
        .eb-made{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
        .eb-made span{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:900;color:#047857}
        .eb-made .cm-link{padding:2px}
        .eb-lock{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:var(--soft)}
        .eb-buy{border:1.5px solid var(--purple);border-radius:20px;padding:18px;background:var(--card)}
        .eb-buy-h{display:flex;flex-direction:column;gap:3px;margin-bottom:14px}
        .eb-buy-h b{font-size:17px;font-weight:900}
        .eb-buy-h span{color:var(--soft);font-size:14px}
      `}</style>
    </div>
  );
}
