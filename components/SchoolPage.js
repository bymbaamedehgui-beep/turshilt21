import { useState, useEffect, useMemo } from 'react';
import { apiFetch, scaleScore } from '../lib/eyesh';
import { PLANS, MONTH_PRICE, planPrice, perMonth, schoolPrice, pctPrice, fmtMNT } from '../lib/plans';
import { SubjectChips, QPayInvoice, fmtDot } from './Paywall';
import { PromoField } from './PromoField';

// ── Сургуулийн эрх ─────────────────────────────────────────────────────────
// Сургууль хичээлээ сонгоод төлнө (хичээл бүр нэг хичээлийн үнээр), багш нараа утас/имэйлээр урина. Урилгыг багш зөвшөөрсний
// дараа тэр сургуулийн хичээлүүдийг ашиглаж, сургууль түүний шалгалтыг «Нэгдсэн жагсаалт»-д харна (pages/api/school/*).
const isPhone = c => /^\d{8}$/.test(c || '');
const active = u => !!u && new Date(u) > new Date();

export function SchoolPage({ me, onChanged }) {
  const [st, setSt] = useState(null);       // GET /api/school
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  async function load() { try { setSt(await apiFetch('/api/school')); setErr(''); } catch (e) { setErr(e.message); } }
  useEffect(() => { load(); }, []);
  async function act(body) {
    setBusy(body.action); setErr('');
    try { const r = await apiFetch('/api/school', { method: 'POST', body }); setSt(r); onChanged && onChanged(); return r; }
    catch (e) { setErr(e.message); return null; }
    finally { setBusy(''); }
  }
  if (!st) return <div className="sc-page">{err ? <div className="cm-alert">{err}</div> : <div className="sc-load">Ачаалж байна…</div>}</div>;
  const { school } = st;
  return (
    <div className="sc-page">
      <div className="sc-hero">
        <span className="cm-eyebrow">Сургуулийн эрх</span>
        <h1>{school ? school.name : 'Сургуулийн эрх'}</h1>
        <p>Хичээл бүр сард {fmtMNT(MONTH_PRICE)}. Сургуулийн багш нар өөрсдийн дансаар тухайн хичээлүүдийг ашиглана; та бүх шалгалт,
          сурагчийн нэгдсэн дүн, хичээл ба ангийн харьцуулалтыг нэг дор харна.</p>
        {school && <button className="cm-link" onClick={() => { const n = window.prompt('Сургуулийн нэр', school.name); if (n && n.trim()) act({ action: 'rename', name: n }); }}>Нэр засах</button>}
      </div>
      {err && <div className="cm-alert">{err}</div>}

      {st.invites.map(i => (
        <div key={i.id} className="sc-card sc-invite-card">
          <div><b>«{i.schoolName}»</b> сургууль{i.ownerName ? ` (${i.ownerName})` : ''} таныг багшаар урьж байна.</div>
          <p className="sc-note">Нэгдвэл сургуулийн төлсөн хичээлүүдийг ашиглана, харин сургууль таны тэдгээр хичээлийн шалгалт, дүнг нэгдсэн жагсаалтад харна.</p>
          <div className="sc-actions">
            <button className="cm-btn" disabled={!!busy} onClick={() => act({ action: 'accept', memberId: i.id })}>Нэгдэх</button>
            <button className="cm-link" disabled={!!busy} onClick={() => act({ action: 'decline', memberId: i.id })}>Татгалзах</button>
          </div>
        </div>
      ))}
      {st.memberOf.map(s => (
        <div key={s.id} className="sc-card">
          <div className="sc-h"><b>Та «{s.name}» сургуулийн багш</b>{s.ownerName && <span>{s.ownerName}</span>}</div>
          <div className="sc-lics">
            {s.licenses.length ? s.licenses.map(l => <span key={l.subject} className={active(l.until) ? 'on' : 'off'}>{l.subject}<i>{active(l.until) ? fmtDot(l.until) + ' хүртэл' : 'дууссан'}</i></span>)
              : <span className="off">Сургууль хичээлийн эрх аваагүй байна</span>}
          </div>
          <button className="cm-link" disabled={!!busy} onClick={() => { if (window.confirm(`«${s.name}» сургуулиас гарах уу? Сургуулийн хичээлүүдийн эрх хаагдана.`)) act({ action: 'leave', schoolId: s.id }); }}>Сургуулиас гарах</button>
        </div>
      ))}

      {school && <Licenses licenses={st.licenses} />}
      <BuyLicenses school={school} licenses={st.licenses} onCreate={name => act({ action: 'create', name })} onPaid={() => { load(); onChanged && onChanged(); }} />
      {school && <Teachers members={st.members} act={act} busy={busy} />}
      {school && <Combined key={st.licenses.length + ':' + st.members.filter(m => m.status === 'active').length} />}
    </div>
  );
}

function Licenses({ licenses }) {
  return (
    <div className="sc-card">
      <div className="sc-h"><b>Хичээлүүд</b><span>{licenses.filter(l => active(l.until)).length} идэвхтэй</span></div>
      {licenses.length ? (
        <div className="sc-lics">
          {licenses.map(l => <span key={l.subject} className={active(l.until) ? 'on' : 'off'}>{l.subject}<i>{active(l.until) ? fmtDot(l.until) + ' хүртэл' : 'дууссан ' + fmtDot(l.until)}</i></span>)}
        </div>
      ) : <p className="sc-note">Одоогоор хичээлийн эрх алга — доороос хичээлээ сонгоод төлнө үү.</p>}
    </div>
  );
}

// Хичээл сонгож төлөх. Сургуульгүй бол нэрийг нь авч эхлээд сургуулийг үүсгэнэ.
function BuyLicenses({ school, licenses, onCreate, onPaid }) {
  const [name, setName] = useState('');
  const [subs, setSubs] = useState([]);
  const [months, setMonths] = useState(6);
  const [inv, setInv] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(() => !licenses.some(l => active(l.until)));   // эрхтэй сургуульд хураангуй
  const [promo, setPromo] = useState(null);       // сургуулийн эрхэд хамаарах хөнгөлөлтийн код (components/PromoField.js)
  const full = schoolPrice(months, subs.length), total = promo ? pctPrice(full, promo.value) : full;
  const untilOf = s => licenses.find(l => l.subject === s)?.until;
  async function pay() {
    if (!school && name.trim().length < 2) return setErr('Сургуулийн нэрээ оруулна уу');
    if (!subs.length) return setErr('Хичээлээ сонгоно уу');
    setBusy(true); setErr('');
    try {
      if (!school && !(await onCreate(name.trim()))) { setBusy(false); return; }
      const r = await apiFetch('/api/pay/create', { method: 'POST', body: { months, school: true, subjects: subs, ...(promo ? { promo: promo.code } : {}) } });
      if (r.free) { setDone(r); setPromo(null); onPaid && onPaid(); }   // 100%-ийн промо код — QPay-гүйгээр шууд
      else setInv(r);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  if (done) return (
    <div className="pw-card pw-done sc-done">
      <div className="pw-ok">✓</div>
      <h2>{done.free ? 'Промо кодоор нээгдлээ!' : 'Төлбөр амжилттай!'}</h2>
      <p>{(done.subjects || subs).join(', ')} — сургуулийн эрх <b>{fmtDot(done.paidUntil)}</b> хүртэл нээгдлээ.</p>
      <button className="cm-btn" onClick={() => { setDone(null); setSubs([]); }}>Болсон</button>
    </div>
  );
  if (inv) return (
    <QPayInvoice inv={inv} title={`${(inv.subjects || subs).join(', ')} · ${inv.months} сар`} sub={`${school?.name || name} — сургуулийн эрх${promo ? ` · ${promo.code} −${promo.value}%` : ''}`}
      onPaid={r => { setDone(r); setInv(null); setPromo(null); onPaid && onPaid(); }} onBack={() => setInv(null)} />
  );
  if (school && !open) return (
    <div className="sc-card">
      <div className="sc-h sc-buy-closed"><b>Хичээл нэмэх, сунгах</b><button className="cm-btn" onClick={() => setOpen(true)}>Нээх</button></div>
    </div>
  );
  return (
    <div className="sc-card">
      <div className="sc-h"><b>{school ? 'Хичээл нэмэх, сунгах' : 'Сургуулийн эрх авах'}</b></div>
      {!school && (
        <label className="sc-field">Сургуулийн нэр
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Жишээ: 1-р сургууль" maxLength={120} />
        </label>
      )}
      <div className="pw-sec">Хичээлүүд</div>
      <SubjectChips multi value={subs} onChange={s => { setSubs(s); setErr(''); }}
        badge={s => { const u = untilOf(s); return active(u) ? fmtDot(u) + ' хүртэл' : null; }} />
      <div className="pw-sec">Хугацаа</div>
      <div className="pw-plans" role="radiogroup" aria-label="Хугацаа">
        {PLANS.map(p => (
          <button key={p.months} role="radio" aria-checked={months === p.months}
            className={'pw-plan' + (months === p.months ? ' on' : '') + (p.best ? ' best' : '')} onClick={() => setMonths(p.months)}>
            {p.best && <span className="pw-ribbon">Хамгийн ашигтай</span>}
            <span className="pw-radio" />
            <span className="pw-plan-m"><b>{p.months} сар</b>{p.off > 0 && <em>−{p.off}%</em>}</span>
            <span className="pw-plan-p"><b>{fmtMNT(planPrice(p.months))}</b></span>
            <span className="pw-plan-n">хичээл бүр · сард {fmtMNT(perMonth(p.months))}</span>
          </button>
        ))}
      </div>
      <PromoField scope="school" promo={promo} onChange={p => { setPromo(p); setErr(''); }} disabled={busy} />
      <div className="sc-total">
        {!subs.length ? 'Хичээлээ сонгоно уу'
          : promo ? <>{subs.length} хичээл × {fmtMNT(planPrice(months))} = <s>{fmtMNT(full)}</s> → −{promo.value}% = <b>{total === 0 ? 'Үнэгүй' : fmtMNT(total)}</b></>
          : <>{subs.length} хичээл × {fmtMNT(planPrice(months))} = <b>{fmtMNT(total)}</b></>}
      </div>
      {err && <div className="cm-alert">{err}</div>}
      <button className="cm-btn big pw-cta" disabled={busy || !subs.length} onClick={pay}>
        {busy ? 'Нэхэмжлэх үүсгэж байна…' : subs.length && total === 0 ? 'Промо кодоор үнэгүй идэвхжүүлэх'
          : <>QPay-ээр төлөх{subs.length ? ` · ${fmtMNT(total)}` : ''}</>}
      </button>
    </div>
  );
}

function Teachers({ members, act, busy }) {
  const [contact, setContact] = useState('');
  async function invite(e) { e.preventDefault(); if (await act({ action: 'invite', contact })) setContact(''); }
  const joined = members.filter(m => m.status === 'active').length;
  return (
    <div className="sc-card">
      <div className="sc-h"><b>Багш нар</b><span>{joined} нэгдсэн · {members.length - joined} урилга хүлээж буй</span></div>
      <p className="sc-note">Багшийг eyeshcheck.com-д бүртгэлтэй утас (8 орон) эсвэл имэйлээр нь урина. Багш дансандаа орж урилгыг зөвшөөрсний
        дараа сургуулийн хичээлүүдийг ашиглаж, та түүний шалгалтуудыг нэгдсэн жагсаалтад харна.</p>
      <form className="sc-invite" onSubmit={invite}>
        <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Утас эсвэл имэйл" aria-label="Багшийн утас эсвэл имэйл" maxLength={200} />
        <button className="cm-btn" disabled={busy === 'invite' || !contact.trim()}>{busy === 'invite' ? 'Урьж байна…' : 'Урих'}</button>
      </form>
      {members.length > 0 && (
        <div className="sc-list">
          {members.map(m => (
            <div key={m.id} className="sc-row">
              <div><b>{m.teacher?.name || (isPhone(m.contact) ? 'Утас ' + m.contact : m.contact)}</b>
                <span>{m.teacher ? m.teacher.email : 'Урилгаа хараахан зөвшөөрөөгүй'}</span></div>
              <em className={m.status === 'active' ? 'ok' : 'wait'}>{m.status === 'active' ? 'Нэгдсэн' : 'Хүлээж буй'}</em>
              <button className="cm-link" disabled={!!busy}
                onClick={() => { if (window.confirm(`${m.teacher?.name || m.contact}-ийг сургуулиас хасах уу?`)) act({ action: 'remove', memberId: m.id }); }}>Хасах</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Нэгдсэн жагсаалт: бүх шалгалт · сурагчийн нэгдсэн дүн · хичээл ба ангийн харьцуулалт ──
const pctFmt = x => (Math.round(x * 10) / 10).toFixed(1);
function Combined() {
  const [rep, setRep] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('exams');
  const [pick, setPick] = useState({});      // { хичээл: examId | '' }
  const [cls, setCls] = useState('');
  const [subj, setSubj] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try { setRep(await apiFetch('/api/school/report')); setErr(''); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  useEffect(() => { load(); }, []);

  const subjects = useMemo(() => rep ? [...new Set(rep.exams.map(e => e.subject))] : [], [rep]);
  // хичээл бүрээр сонгосон шалгалт — анхдагч нь хамгийн сүүлийнх
  const chosen = useMemo(() => {
    if (!rep) return {};
    const o = {};
    subjects.forEach(s => { const v = pick[s]; o[s] = v === '' ? null : v || rep.exams.find(e => e.subject === s)?.id || null; });
    return o;
  }, [rep, pick, subjects]);
  // сурагч бүрийн мөр: код, эсвэл нэр+анги; давхар уншуулсан бол сүүлийнх
  const table = useMemo(() => {
    if (!rep) return { rows: [], subs: [] };
    const subs = subjects.filter(s => chosen[s]);
    const byKey = {};
    subs.forEach(s => {
      const latest = {};
      rep.rows.filter(r => r.examId === chosen[s]).forEach(r => {
        const k = r.code ? 'c:' + r.code : 'n:' + r.name.trim().toLowerCase() + '|' + r.class;
        if (!latest[k] || String(r.submittedAt) > String(latest[k].submittedAt)) latest[k] = r;
      });
      Object.entries(latest).forEach(([k, r]) => {
        const row = byKey[k] || (byKey[k] = { key: k, name: r.name, code: r.code, class: r.class, scores: {} });
        if (!row.class && r.class) row.class = r.class;
        row.scores[s] = { pct: r.scaled, dim: scaleScore(r.scaled, s) };
      });
    });
    const rows = Object.values(byKey).map(r => {
      const vals = subs.map(s => r.scores[s]).filter(Boolean);
      const dims = vals.map(v => v.dim).filter(v => v != null);
      return { ...r, n: vals.length, total: dims.reduce((a, b) => a + b, 0), avg: vals.length ? vals.reduce((a, v) => a + v.pct, 0) / vals.length : 0 };
    }).sort((a, b) => b.total - a.total || b.avg - a.avg || a.name.localeCompare(b.name, 'mn'));
    return { rows, subs };
  }, [rep, chosen, subjects]);
  const classes = useMemo(() => [...new Set(table.rows.map(r => r.class).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'mn', { numeric: true })), [table]);

  if (err) return <div className="sc-card"><div className="cm-alert">{err}</div></div>;
  if (!rep) return <div className="sc-card"><div className="sc-load">Нэгдсэн жагсаалтыг ачаалж байна…</div></div>;
  const shownRows = cls ? table.rows.filter(r => r.class === cls) : table.rows;
  const exams = subj ? rep.exams.filter(e => e.subject === subj) : rep.exams;

  function exportXlsx() {
    import('xlsx').then(XLSX => {
      const head = ['№', 'Сурагч', 'Код', 'Анги', ...table.subs.flatMap(s => [s + ' %', s + ' (200–800)']), 'Нийт (200–800)', 'Дундаж %'];
      const body = shownRows.map((r, i) => [i + 1, r.name, r.code, r.class,
        ...table.subs.flatMap(s => r.scores[s] ? [r.scores[s].pct, r.scores[s].dim ?? ''] : ['', '']), r.total || '', Number(pctFmt(r.avg))]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...body]), 'Нэгдсэн дүн');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Огноо', 'Шалгалт', 'Хичээл', 'Багш', 'Сурагч', 'Дундаж %'],
        ...rep.exams.map(e => [fmtDot(e.createdAt), e.title, e.subject, e.teacherName, e.n, e.avg ?? ''])]), 'Шалгалтууд');
      XLSX.writeFile(wb, `${rep.school.name}_нэгдсэн_дүн${cls ? '_' + cls : ''}.xlsx`);
    });
  }

  return (
    <div className="sc-card sc-combined">
      <div className="sc-h"><b>Нэгдсэн жагсаалт</b><span>{rep.exams.length} шалгалт · <button className="cm-link sc-reload" disabled={busy} onClick={load}>{busy ? 'Ачаалж байна…' : 'Шинэчлэх'}</button></span></div>
      <div className="sc-tabs" role="tablist">
        {[['exams', 'Шалгалтууд'], ['students', 'Сурагчийн нэгдсэн дүн'], ['compare', 'Хичээл, анги']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {!rep.exams.length && <p className="sc-note">Сургуулийн хичээлүүдээр шалгалт хараахан алга. Багш нар урилгаа зөвшөөрч шалгалт уншуулахад энд гарна.</p>}

      {tab === 'exams' && rep.exams.length > 0 && <>
        <div className="sc-filter">
          <select value={subj} onChange={e => setSubj(e.target.value)} aria-label="Хичээл">
            <option value="">Бүх хичээл</option>{subjects.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="sc-scroll"><table className="sc-table">
          <thead><tr><th>Огноо</th><th>Шалгалт</th><th>Хичээл</th><th>Багш</th><th>Сурагч</th><th>Дундаж</th></tr></thead>
          <tbody>{exams.map(e => (
            <tr key={e.id}><td>{fmtDot(e.createdAt)}</td><td><b>{e.title}</b></td><td>{e.subject}</td><td>{e.teacherName || '—'}</td>
              <td>{e.n}</td><td>{e.n ? pctFmt(e.avg) + '%' : '—'}</td></tr>
          ))}</tbody>
        </table></div>
      </>}

      {tab !== 'exams' && rep.exams.length > 0 && (
        <div className="sc-pick">
          {subjects.map(s => (
            <label key={s}>{s}
              <select value={chosen[s] || ''} onChange={e => setPick(p => ({ ...p, [s]: e.target.value }))}>
                <option value="">— оруулахгүй</option>
                {rep.exams.filter(e => e.subject === s).map(e => <option key={e.id} value={e.id}>{fmtDot(e.createdAt)} · {e.title}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}

      {tab === 'students' && rep.exams.length > 0 && <>
        <div className="sc-filter">
          <select value={cls} onChange={e => setCls(e.target.value)} aria-label="Анги">
            <option value="">Бүх анги</option>{classes.map(c => <option key={c}>{c}</option>)}
          </select>
          <button className="cm-btn" onClick={exportXlsx} disabled={!shownRows.length}>Excel татах</button>
        </div>
        <p className="sc-note">Хичээл бүрт хувь ба ЭЕШ-ийн хэмжээст оноо (200–800, 2026 оны улсын тархалтаар). «Нийт» нь хэмжээст оноонуудын нийлбэр.</p>
        <div className="sc-scroll"><table className="sc-table">
          <thead><tr><th>№</th><th>Сурагч</th><th>Анги</th>{table.subs.map(s => <th key={s}>{s}</th>)}<th>Нийт</th><th>Дундаж</th></tr></thead>
          <tbody>{shownRows.map((r, i) => (
            <tr key={r.key}><td>{i + 1}</td><td><b>{r.name || '—'}</b>{r.code && <small>{r.code}</small>}</td><td>{r.class || '—'}</td>
              {table.subs.map(s => <td key={s}>{r.scores[s] ? <>{r.scores[s].dim ?? '—'}<small>{pctFmt(r.scores[s].pct)}%</small></> : '—'}</td>)}
              <td><b>{r.total || '—'}</b></td><td>{pctFmt(r.avg)}%</td></tr>
          ))}</tbody>
        </table></div>
      </>}

      {tab === 'compare' && rep.exams.length > 0 && (
        <div className="sc-scroll"><table className="sc-table">
          <thead><tr><th>Анги</th>{table.subs.map(s => <th key={s}>{s}</th>)}</tr></thead>
          <tbody>{[...classes, ''].map(c => {
            const rs = c ? table.rows.filter(r => r.class === c) : table.rows;
            return (
              <tr key={c || 'all'} className={c ? '' : 'sum'}><td><b>{c || 'Бүгд'}</b></td>
                {table.subs.map(s => {
                  const v = rs.map(r => r.scores[s]).filter(Boolean);
                  if (!v.length) return <td key={s}>—</td>;
                  const avg = v.reduce((a, x) => a + x.pct, 0) / v.length, pass = v.filter(x => x.pct >= 60).length;
                  return <td key={s}>{pctFmt(avg)}%<small>тэнцсэн {Math.round(pass / v.length * 100)}% · {v.length}</small></td>;
                })}
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}
