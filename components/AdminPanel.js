import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/eyesh';
import { MaterialsPanel, EeshDateSetting } from './MaterialsPanel';

// ── Admin: багш нарын эрх, промо код, сурагчийн хэсэг ─────────────────────
// eyeshcheck-ийн ☰ «Admin» (pages/index.js) ба Дасгалын төвийн админы «ЭЕШ шалгагч» цэс (pages/cm-admin.js, embed) хоёулаа.
function Ico({d, size=20, color='currentColor', sw=1.5, fill='none'}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{display:'block',flexShrink:0}}>
      {Array.isArray(d)?d.map((p,i)=><path key={i} d={p}/>):<path d={d}/>}
    </svg>
  );
}
function Spinner() {
  return <div style={{width:20,height:20,border:'3px solid #e5e7eb',borderTopColor:'#7B52EE',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block'}} />;
}
const ymd = x => { const t = new Date(x); return isNaN(t) ? '—' : `${t.getFullYear()}.${String(t.getMonth()+1).padStart(2,'0')}.${String(t.getDate()).padStart(2,'0')}`; };

export function AdminPanel({dark:d=false, embed=false}) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  useEffect(()=>{ load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/teachers');
      setTeachers(data);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  async function updateStatus(id, status) {
    try {
      await apiFetch('/api/admin/teachers', { method:'PATCH', body:{ id, status } });
      setTeachers(ts => ts.map(t => t.id===id ? {...t, status} : t));
    } catch(e) { alert(e.message); }
  }

  async function extend(id, months) {
    try {
      const r = await apiFetch('/api/admin/teachers', { method:'PATCH', body:{ id, extendMonths: months } });
      setTeachers(ts => ts.map(t => t.id===id ? {...t, paid_until: r.paidUntil} : t));
    } catch(e) { alert(e.message); }
  }

  async function removeTeacher(id, email) {
    if (!confirm(`"${email}" устгах уу?`)) return;
    try {
      await apiFetch('/api/admin/teachers', { method:'DELETE', body:{ id } });
      setTeachers(ts => ts.filter(t => t.id!==id));
    } catch(e) { alert(e.message); }
  }

  const ql = q.trim().toLowerCase();
  const shown = ql ? teachers.filter(t => [t.name, t.email, t.phone].some(v => String(v||'').toLowerCase().includes(ql))) : teachers;
  const pending  = shown.filter(t => t.status==='pending');
  const active   = shown.filter(t => t.status==='active' && !t.is_admin);
  const disabled = shown.filter(t => t.status==='disabled');

  const bg   = d ? '#1c1f2a' : 'white';
  const text = d ? '#f3f4f6' : '#1c1f2a';
  const muted= d ? '#9ca3af' : '#6b7280';
  const border= d ? '#2a2e38' : '#e5e7eb';

  function TeacherRow({t, actions}) {
    return (
      <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:12,padding:'12px 16px',borderBottom:'1px solid '+border}}>
        <div style={{width:36,height:36,borderRadius:'50%',background:'#7B52EE',color:'white',fontWeight:900,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {(t.name||t.email||'?')[0].toUpperCase()}
        </div>
        <div style={{flex:'1 1 180px',minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:text}}>{t.name||'—'}</div>
          <div style={{fontSize:12,color:muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.email}</div>
          <div style={{fontSize:11,color:muted}}>{new Date(t.created_at).toLocaleDateString('mn-MN')}{t.phone ? ' · ' + t.phone : ''}{t.cm_linked ? ' · Дасгалын төв' : ''}</div>
          {!t.is_admin && <div style={{fontSize:12,fontWeight:800,marginTop:2,color:t.paid_until && new Date(t.paid_until) > new Date() ? '#16a34a' : '#b3261e'}}>
            {t.paid_until ? (new Date(t.paid_until) > new Date() ? 'Эрх: ' : 'Дууссан: ') + new Date(t.paid_until).toLocaleDateString('mn-MN') : 'Эрхгүй'}
          </div>}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:'auto'}}>
          {actions}
        </div>
      </div>
    );
  }

  const btnStyle = (bg2,c) => ({padding:'6px 14px',border:'none',borderRadius:7,fontWeight:700,fontSize:12,cursor:'pointer',background:bg2,color:c});

  return (
    <div style={{maxWidth:800,margin:'0 auto',padding:embed?'4px 2px 24px':'24px 20px'}}>
      {/* Header */}
      {!embed && <div style={{background:'linear-gradient(135deg,#1c1f2a,#2a2e38)',borderRadius:20,padding:'24px 28px',color:'white',marginBottom:20}}>
        <div style={{fontSize:11,letterSpacing:2,opacity:.7,marginBottom:4}}>CYBERMATH · ЭЕШ</div>
        <div style={{fontSize:26,fontWeight:900}}>Admin панель</div>
        <div style={{opacity:.8,fontSize:13,marginTop:4}}>Багш нарын хандалтыг удирдах</div>
      </div>}

      {err && <div style={{background:'#fdecec',color:'#b3261e',padding:'10px 14px',borderRadius:10,marginBottom:16,fontSize:13}}>{err}</div>}
      {loading && <div style={{textAlign:'center',padding:40,color:muted}}><Spinner/></div>}

      {!loading && teachers.length>0 && (
        <input className="adm-search" value={q} onChange={e=>setQ(e.target.value)} placeholder={`Багш хайх — нэр, имэйл, утас (${teachers.length})`}
          style={{width:'100%',boxSizing:'border-box',padding:'10px 14px',border:'1.5px solid '+border,borderRadius:12,fontSize:14,marginBottom:14,background:bg,color:text,outline:'none'}} />
      )}

      {/* Pending */}
      {pending.length>0 && (
        <div style={{background:bg,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(17,24,39,.06)',marginBottom:16}}>
          <div style={{padding:'12px 16px',background:'#fef9c3',borderBottom:'1px solid #fde68a',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16}}>⏳</span>
            <span style={{fontWeight:800,fontSize:14,color:'#92400e'}}>Хүлээгдэж буй хүсэлтүүд — {pending.length}</span>
          </div>
          {pending.map(t=>(
            <TeacherRow key={t.id} t={t} actions={<>
              <button style={btnStyle('#16a34a','white')} onClick={()=>updateStatus(t.id,'active')}><span style={{display:'flex',alignItems:'center',gap:4}}><Ico d='M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' size={14} color='white'/>Зөвшөөрөх</span></button>
              <button style={btnStyle('#fdecec','#b3261e')} onClick={()=>removeTeacher(t.id,t.email)}><span style={{display:'flex',alignItems:'center',gap:4}}><Ico d='M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z' size={14} color='#b3261e'/>Татгалзах</span></button>
            </>}/>
          ))}
        </div>
      )}

      {/* Active */}
      <div style={{background:bg,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(17,24,39,.06)',marginBottom:16}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid '+border,display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:16}}>✅</span>
          <span style={{fontWeight:800,fontSize:14,color:text}}>Идэвхтэй багш нар — {active.length}</span>
        </div>
        {active.length===0
          ? <div style={{padding:'24px',textAlign:'center',color:muted,fontSize:13}}>{ql ? 'Хайлтад тохирох багш алга' : 'Одоохондоо байхгүй'}</div>
          : active.map(t=>(
            <TeacherRow key={t.id} t={t} actions={<>
              <button style={btnStyle('#e1f4e9','#16a34a')} onClick={()=>extend(t.id,1)}>+1 сар</button>
              <button style={btnStyle('#f3f4f6','#374151')} onClick={()=>updateStatus(t.id,'disabled')}><span style={{display:'flex',alignItems:'center',gap:4}}><Ico d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' size={14} color='#374151'/>Хаах</span></button>
              <button style={btnStyle('#fdecec','#b3261e')} onClick={()=>removeTeacher(t.id,t.email)}><Ico d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0' size={14} color='#b3261e'/></button>
            </>}/>
          ))
        }
      </div>

      {/* Disabled */}
      {disabled.length>0 && (
        <div style={{background:bg,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid '+border,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16}}>🚫</span>
            <span style={{fontWeight:800,fontSize:14,color:muted}}>Хаагдсан — {disabled.length}</span>
          </div>
          {disabled.map(t=>(
            <TeacherRow key={t.id} t={t} actions={<>
              <button style={btnStyle('#dcfce7','#16a34a')} onClick={()=>updateStatus(t.id,'active')}><span style={{display:'flex',alignItems:'center',gap:4}}><Ico d='M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' size={14} color='#16a34a'/>Нээх</span></button>
              <button style={btnStyle('#fdecec','#b3261e')} onClick={()=>removeTeacher(t.id,t.email)}><Ico d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0' size={14} color='#b3261e'/></button>
            </>}/>
          ))}
        </div>
      )}

      <PromoAdmin d={d} />

      {/* Сурагчийн хэсэг: ЭЕШ-ийн огноо, 12-р ангийн сурах бичиг */}
      <div style={{marginTop:24}}>
        <div style={{fontSize:18,fontWeight:900,color:text,margin:'0 2px 10px'}}>Сурагчийн хэсэг</div>
        <EeshDateSetting />
        <MaterialsPanel kind="textbook" />
      </div>
    </div>
  );
}

// ── Промо код (lib/promo.js, pages/api/admin/promo.js) ──
const promoLabel = p => p.kind === 'percent' ? `−${p.value}%` : `+${p.value} хоног`;
const EMPTY = { kind:'percent', value:'20', maxUses:'', expiresAt:'', code:'', note:'' };

function PromoAdmin({d}) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);          // { text, err }
  const [open, setOpen] = useState(null);        // { code, uses|null }
  useEffect(()=>{ load(); }, []);

  async function load() {
    try { setList(await apiFetch('/api/admin/promo')); } catch(e) { setList([]); setMsg({ err:true, text:e.message }); }
  }
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  async function create(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const p = await apiFetch('/api/admin/promo', { method:'POST', body:{ ...form, value:Number(form.value), maxUses:form.maxUses===''?null:Number(form.maxUses), expiresAt:form.expiresAt||null } });
      setList(l => [p, ...(l||[])]);
      setForm(f => ({ ...f, code:'', note:'' }));
      setMsg({ text:`«${p.code}» код үүслээ — ${promoLabel(p)}` });
    } catch(e2) { setMsg({ err:true, text:e2.message }); }
    setBusy(false);
  }
  async function toggle(p) {
    try { const n = await apiFetch('/api/admin/promo', { method:'PATCH', body:{ code:p.code, active:!p.active } }); setList(l => l.map(x => x.code===p.code ? n : x)); }
    catch(e) { alert(e.message); }
  }
  async function remove(p) {
    if (!confirm(`«${p.code}» кодыг устгах уу?`)) return;
    try { await apiFetch('/api/admin/promo', { method:'DELETE', body:{ code:p.code } }); setList(l => l.filter(x => x.code!==p.code)); }
    catch(e) { alert(e.message); }
  }
  async function uses(p) {
    if (open?.code === p.code) return setOpen(null);
    setOpen({ code:p.code, uses:null });
    try { const r = await apiFetch('/api/admin/promo?code=' + encodeURIComponent(p.code)); setOpen({ code:p.code, uses:r.uses }); }
    catch(e) { setOpen({ code:p.code, uses:[] }); }
  }
  function copy(code) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(code).then(() => setMsg({ text:`«${code}» хуулагдлаа` }), () => {});
  }

  const bg = d ? '#1c1f2a' : 'white', text = d ? '#f3f4f6' : '#1c1f2a', muted = d ? '#9ca3af' : '#6b7280', border = d ? '#2a2e38' : '#e5e7eb';
  const field = { width:'100%', boxSizing:'border-box', padding:'9px 11px', border:'1.5px solid '+border, borderRadius:10, fontSize:14, background:d?'#0f1115':'white', color:text, outline:'none' };
  const lab = { display:'block', fontSize:12, fontWeight:800, color:muted, marginBottom:4 };
  const small = (b,c) => ({ padding:'6px 11px', border:'none', borderRadius:7, fontWeight:800, fontSize:12, cursor:'pointer', background:b, color:c });
  const now = new Date();

  return (
    <div className="adm-promo" style={{background:bg,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(17,24,39,.06)',marginTop:16}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid '+border,display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:16}}>🎟️</span>
        <span style={{fontWeight:800,fontSize:14,color:text}}>Промо код — {list ? list.length : '…'}</span>
      </div>
      <form onSubmit={create} style={{padding:'14px 16px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,borderBottom:'1px solid '+border}}>
        <label><span style={lab}>Төрөл</span>
          <select value={form.kind} onChange={e=>setForm(f=>({ ...f, kind:e.target.value, value:e.target.value==='percent'?'20':'7' }))} style={field}>
            <option value="percent">Хөнгөлөлт (%)</option>
            <option value="days">Үнэгүй хоног</option>
          </select></label>
        <label><span style={lab}>{form.kind==='percent' ? 'Хөнгөлөлт, %' : 'Хоног'}</span>
          <input type="number" min={1} max={form.kind==='percent'?100:366} required value={form.value} onChange={set('value')} style={field} /></label>
        <label><span style={lab}>Хэрэглэх тоо</span>
          <input type="number" min={1} value={form.maxUses} onChange={set('maxUses')} placeholder="Хязгааргүй" style={field} /></label>
        <label><span style={lab}>Дуусах өдөр</span>
          <input type="date" value={form.expiresAt} onChange={set('expiresAt')} style={field} /></label>
        <label><span style={lab}>Код</span>
          <input value={form.code} onChange={set('code')} placeholder="Автоматаар" maxLength={40} style={{...field,textTransform:'uppercase'}} /></label>
        <label><span style={lab}>Тайлбар</span>
          <input value={form.note} onChange={set('note')} placeholder="Жишээ: 9-р сарын сургалт" maxLength={200} style={field} /></label>
        <div style={{display:'flex',alignItems:'flex-end'}}>
          <button type="submit" disabled={busy} style={{...small('#7B52EE','white'),width:'100%',padding:'11px 12px',fontSize:13.5}}>{busy ? 'Үүсгэж байна…' : '+ Код үүсгэх'}</button>
        </div>
      </form>
      <div style={{padding:'8px 16px',fontSize:12,color:muted,borderBottom:'1px solid '+border}}>
        Хөнгөлөлтийн кодыг багш «Эрх сунгах» дэлгэц дээр оруулахад QPay-ийн үнэ буурна (100% бол шууд нээгдэнэ). Үнэгүй хоногийн код эрхийг шууд нэмнэ. Багш бүр нэг кодыг нэг удаа.
      </div>
      {msg && <div role="status" style={{padding:'9px 16px',fontSize:13,fontWeight:800,color:msg.err?'#b3261e':'#15803d',background:msg.err?'#fdecec':'#e9f8ef'}}>{msg.text}</div>}
      {list && list.length===0 && <div style={{padding:24,textAlign:'center',color:muted,fontSize:13}}>Код алга — дээрээс үүсгэнэ үү</div>}
      {(list||[]).map(p => {
        const expired = p.expiresAt && new Date(p.expiresAt) <= now, full = p.maxUses != null && p.usedCount >= p.maxUses;
        const st = !p.active ? ['Идэвхгүй', muted] : expired ? ['Хугацаа дууссан', '#b3261e'] : full ? ['Хязгаар дууссан', '#b45309'] : ['Идэвхтэй', '#16a34a'];
        return (
          <div key={p.code} className="adm-promo-row" style={{borderBottom:'1px solid '+border}}>
            <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,padding:'11px 16px'}}>
              <button onClick={()=>copy(p.code)} title="Хуулах" style={{border:'1px dashed '+border,background:'transparent',color:text,borderRadius:8,padding:'4px 9px',fontFamily:'ui-monospace,Consolas,monospace',fontWeight:900,fontSize:14,cursor:'pointer'}}>{p.code}</button>
              <span style={{fontWeight:900,fontSize:13,color:'#7B52EE'}}>{promoLabel(p)}</span>
              <span style={{fontSize:12,color:muted}}>Ашигласан <b style={{color:text}}>{p.usedCount}</b>{p.maxUses != null ? ` / ${p.maxUses}` : ' / ∞'}</span>
              <span style={{fontSize:12,color:muted}}>{p.expiresAt ? 'Дуусах: ' + ymd(p.expiresAt) : 'Хугацаагүй'}</span>
              <span style={{fontSize:12,fontWeight:800,color:st[1]}}>{st[0]}</span>
              {p.note && <span style={{fontSize:12,color:muted,flexBasis:'100%'}}>{p.note}</span>}
              <span style={{marginLeft:'auto',display:'flex',gap:6}}>
                <button onClick={()=>uses(p)} style={small(d?'#2a2e38':'#f3f4f6',text)}>{open?.code===p.code ? 'Хаах' : 'Хэн ашигласан'}</button>
                <button onClick={()=>toggle(p)} style={small(p.active?(d?'#2a2e38':'#f3f4f6'):'#dcfce7',p.active?text:'#16a34a')}>{p.active ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}</button>
                {p.usedCount===0 && <button onClick={()=>remove(p)} style={small('#fdecec','#b3261e')}>Устгах</button>}
              </span>
            </div>
            {open?.code===p.code && (
              <div style={{padding:'0 16px 12px'}}>
                {open.uses===null ? <Spinner/> : open.uses.length===0 ? <div style={{fontSize:12.5,color:muted}}>Одоохондоо хэн ч ашиглаагүй</div> :
                  open.uses.map((u,i)=>(
                    <div key={i} style={{display:'flex',gap:10,fontSize:12.5,color:text,padding:'4px 0',borderTop:i?'1px dashed '+border:'none'}}>
                      <b style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis'}}>{u.name||'—'}</b>
                      <span style={{color:muted,minWidth:0,overflow:'hidden',textOverflow:'ellipsis'}}>{u.email||'(устгагдсан багш)'}</span>
                      <span style={{marginLeft:'auto',color:muted,whiteSpace:'nowrap'}}>{ymd(u.redeemedAt)} · {u.paid ? 'төлсөн' : 'үнэгүй'}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
