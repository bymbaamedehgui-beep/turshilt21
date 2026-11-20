import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/eyesh';

// Admin «Багш нарын материал» (components/AdminPanel.js): багш бүрийн зохиосон онлайн шалгалт (lib/tpaper.js ey_papers) ба
// оруулсан материал (PDF, холбоос, шалгалтын материал) — багш устгасан ч энд үлдэнэ. Сервер: pages/api/admin/archive.js.
const ymd = x => { const t = new Date(x); return isNaN(t) ? '—' : `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`; };

export function ArchiveAdmin({ d = false }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('papers');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');
  const [view, setView] = useState(null);       // { title, html }
  const bg = d ? '#1c1f2a' : 'white', text = d ? '#f3f4f6' : '#1c1f2a', muted = d ? '#9ca3af' : '#6b7280', border = d ? '#2a2e38' : '#e5e7eb';
  const btn = (b, c) => ({ padding: '6px 12px', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', background: b, color: c, textDecoration: 'none', whiteSpace: 'nowrap' });

  async function load(reset = true) {
    setErr('');
    try {
      const off = reset ? 0 : (rows || []).length;
      const r = await apiFetch(`/api/admin/archive?tab=${tab}&q=${encodeURIComponent(q.trim())}&offset=${off}`);
      setRows(reset ? r : [...(rows || []), ...r]); setMore(r.length >= 100);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { if (open) { setRows(null); load(true); } }, [open, tab]);
  async function show(kind, it) {
    try { const r = await apiFetch(`/api/admin/archive?${kind}=${encodeURIComponent(it.id)}`); setView({ title: it.title, html: r.html }); }
    catch (e) { alert(e.message); }
  }

  return (
    <div style={{ background: bg, borderRadius: 14, boxShadow: '0 1px 4px rgba(17,24,39,.06)', marginTop: 16, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', border: 0, background: 'none', color: text, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>Багш нарын материал (архив)</span>
        <span style={{ fontSize: 12, color: muted, fontWeight: 700 }}>{open ? 'Хураах' : 'Нээх'}</span>
      </button>
      {open && <div style={{ padding: '0 16px 16px', borderTop: '1px solid ' + border }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' }}>
          {[['papers', 'Онлайн шалгалт'], ['materials', 'Оруулсан материал']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={btn(tab === k ? '#7B52EE' : (d ? '#2a2e38' : '#f3f4f6'), tab === k ? 'white' : text)}>{l}</button>
          ))}
          <form onSubmit={e => { e.preventDefault(); load(true); }} style={{ display: 'flex', gap: 6, flex: '1 1 220px' }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Хайх — гарчиг, багшийн нэр, имэйл"
              style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: '1.5px solid ' + border, borderRadius: 9, fontSize: 13, background: bg, color: text }} />
            <button style={btn('#7B52EE', 'white')}>Хайх</button>
          </form>
        </div>
        {err && <div style={{ background: '#fdecec', color: '#b3261e', padding: '8px 12px', borderRadius: 9, fontSize: 13 }}>{err}</div>}
        {!rows && !err && <div style={{ padding: 12, fontSize: 13, color: muted }}>Ачаалж байна…</div>}
        {rows && rows.length === 0 && <div style={{ padding: 12, fontSize: 13, color: muted }}>Олдсонгүй.</div>}
        {rows && rows.map(it => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '9px 0', borderBottom: '1px solid ' + border }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.title}{it.deletedAt && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: '#b3261e' }}>устгасан {ymd(it.deletedAt)}</span>}
              </div>
              <div style={{ fontSize: 12, color: muted }}>
                {[it.teacherName || '—', it.teacherEmail, it.subject, tab === 'papers' ? `${it.n1 + it.n2} бодлого` : it.class && `анги ${it.class}`,
                  ymd(tab === 'papers' ? it.updatedAt : it.createdAt)].filter(Boolean).join(' · ')}
              </div>
            </div>
            {tab === 'papers' ? <button onClick={() => show('paper', it)} style={btn(d ? '#2a2440' : '#eef2ff', d ? '#c4b1ff' : '#4338ca')}>Харах</button>
              : it.html ? <button onClick={() => show('material', it)} style={btn(d ? '#2a2440' : '#eef2ff', d ? '#c4b1ff' : '#4338ca')}>Харах</button>
              : it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer" style={btn(d ? '#2a2440' : '#eef2ff', d ? '#c4b1ff' : '#4338ca')}>Нээх</a> : null}
          </div>
        ))}
        {more && <button onClick={() => load(false)} style={{ ...btn(d ? '#2a2e38' : '#f3f4f6', text), marginTop: 10 }}>Цааш үзэх</button>}
      </div>}
      {view && (
        <div role="dialog" aria-modal="true" onClick={() => setView(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(17,12,40,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(980px,100%)', height: 'min(92vh,1200px)', background: bg, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid ' + border }}>
              <b style={{ flex: 1, fontSize: 14, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{view.title}</b>
              <button onClick={() => setView(null)} style={btn(d ? '#2a2e38' : '#f3f4f6', text)}>Хаах</button>
            </div>
            {/* скриптгүй sandbox — хариутай материал админд л */}
            <iframe title={view.title} sandbox="" srcDoc={view.html} style={{ flex: 1, border: 0, width: '100%', background: '#ece8f8' }} />
          </div>
        </div>
      )}
    </div>
  );
}
