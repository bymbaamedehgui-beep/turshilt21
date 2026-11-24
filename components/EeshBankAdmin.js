import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/eyesh';
import { isDriveUrl, normalizeDriveUrl, driveStatus } from '../lib/drive';
import { BANK_SUBJECTS } from '../lib/plans';

// Admin «ЭЕШ сан» (components/AdminPanel.js): хичээл × он × хувилбар бүрийн даалгавар (PDF — Google Drive холбоос, эсвэл Дасгалын төвийн
// HTML материал) + зөв хариу. JSON импорт — cyber-math-ийн scripts/eesh-bank-export.js-ийн гаралт [{ subject, year, variant, title,
// exam, material }]. Сервер: pages/api/admin/eesh.js (хичээл+он+хувилбараар нэмэх/шинэчлэх).
const EMPTY = { subject: BANK_SUBJECTS[0], year: '', variant: 'A', title: '', key: '', scores: '', sec2: '' };

// «ABCDE…» → { sec1Count, sec1Key, sec1Scores, topics, useSec2, sec2Config } | { error }
// 2-р хэсэг: мөр бүр «2.1 a=3 b=- c=5 @2» (@ — нүд бүрийн оноо, анхдагч 1)
function examFromForm(f) {
  const key = String(f.key || '').toUpperCase().replace(/[^A-E]/g, '').split('');
  if (!key.length || key.length > 60) return { error: '1-р хэсгийн түлхүүр (A–E үсгүүд, 60 хүртэл) оруулна уу' };
  const sc = String(f.scores || '').trim() ? String(f.scores).split(/[\s,;]+/).filter(Boolean).map(Number) : key.map(() => 1);
  if (sc.length !== key.length || sc.some(x => !(x >= 0 && x <= 10))) return { error: `Оноо ${key.length} ширхэг тоо байх ёстой (хоосон бол бүгд 1)` };
  const sec2Config = {};
  const lines = String(f.sec2 || '').split('\n').map(s => s.trim()).filter(Boolean);
  for (const ln of lines) {
    const m = /^(2\.[1-4])\s*[:.]?\s*(.*)$/.exec(ln);
    if (!m) return { error: `2-р хэсгийн мөр буруу: «${ln}»` };
    const at = /@\s*(\d+(?:[.,]\d+)?)/.exec(m[2]), score = at ? Number(at[1].replace(',', '.')) : 1;
    const cfg = { _enabled: true };
    'abcdefgh'.split('').forEach(r => { cfg[r] = { ans: '', score }; });
    for (const c of m[2].replace(/@\s*\S+/, '').split(/[\s,;]+/).filter(Boolean)) {
      const x = /^([a-h])\s*=\s*([0-9.\-])$/.exec(c);
      if (!x) return { error: `2-р хэсэг «${c}» буруу (жишээ: a=3 b=- c=5)` };
      cfg[x[1]] = { ans: x[2], score };
    }
    sec2Config[m[1]] = cfg;
  }
  const useSec2 = Object.keys(sec2Config).length > 0;
  if (useSec2) ['2.1', '2.2', '2.3', '2.4'].forEach(s => {
    if (!sec2Config[s]) { const c = { _enabled: false }; 'abcdefgh'.split('').forEach(r => { c[r] = { ans: '', score: 1 }; }); sec2Config[s] = c; }
  });
  return { sec1Count: key.length, sec1Key: key, sec1Scores: sc, topics: key.map(() => 'Бусад'), useSec2, sec2Config };
}

export function EeshBankAdmin({ d = false }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(false);
  const bg = d ? '#1c1f2a' : 'white', text = d ? '#f3f4f6' : '#1c1f2a', muted = d ? '#9ca3af' : '#6b7280', border = d ? '#2a2e38' : '#e5e7eb';
  const inp = { padding: '8px 10px', border: '1.5px solid ' + border, borderRadius: 9, fontSize: 13, background: bg, color: text, boxSizing: 'border-box', minWidth: 0 };
  const btn = (b, c) => ({ padding: '7px 14px', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: b, color: c });

  async function load() { try { setList(await apiFetch('/api/admin/eesh')); } catch (e) { setMsg({ text: e.message, err: true }); } }
  useEffect(() => { if (open && !list) load(); }, [open]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function addOne(e) {
    e.preventDefault();
    const exam = examFromForm(form);
    if (exam.error) return setMsg({ text: exam.error, err: true });
    if (!/^https:\/\//i.test(link.trim())) return setMsg({ text: 'Даалгаврын PDF-ийн холбоосыг (Google Drive, https://…) оруулна уу', err: true });
    const pdfUrl = isDriveUrl(link) ? normalizeDriveUrl(link) : link.trim();
    setBusy('Шалгаж байна…'); setMsg(null);
    // Drive файл «Холбоостой хэн ч» нээлттэй биш бол багш, сурагчид нээж чадахгүй — анхааруулна
    const st = await driveStatus(pdfUrl);
    if ((st === 'private' || st === 'missing') && !confirm(st === 'private'
      ? 'Энэ Drive файл нийтэд нээгдээгүй байна — багш, сурагчид нээж чадахгүй. Drive дээр Хуваалцах → «Холбоостой хэн ч» болгоно уу.\n\nТэгсэн ч нэмэх үү?'
      : 'Энэ холбоосоор Drive файл олдсонгүй.\n\nТэгсэн ч нэмэх үү?')) { setBusy(''); return; }
    try {
      setBusy('Хадгалж байна…');
      await apiFetch('/api/admin/eesh', { method: 'POST', body: { subject: form.subject, year: form.year, variant: form.variant, title: form.title || undefined, exam, pdfUrl } });
      setMsg({ text: 'Нэмэгдлээ' }); setForm(f => ({ ...EMPTY, subject: f.subject, year: f.year })); setLink(''); load();
    } catch (e2) { setMsg({ text: e2.message, err: true }); }
    setBusy('');
  }
  // JSON импорт: мөр бүрийг тусад нь (хүсэлт бүр 4MB-аас бага)
  async function importJson(file) {
    setMsg(null);
    let arr;
    try { arr = JSON.parse(await file.text()); } catch (e) { return setMsg({ text: 'JSON файл буруу', err: true }); }
    if (!Array.isArray(arr) || !arr.length) return setMsg({ text: 'Хоосон эсвэл буруу бүтэцтэй JSON', err: true });
    let ok = 0; const bad = [];
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i] || {};
      setBusy(`Импортлож байна… ${i + 1}/${arr.length}`);
      try { await apiFetch('/api/admin/eesh', { method: 'POST', body: it }); ok++; }
      catch (e) { bad.push(`${it.subject || '?'} ${it.year || '?'} ${it.variant || ''}: ${e.message}`); }
    }
    setBusy('');
    setMsg({ text: `${ok}/${arr.length} импортлогдлоо` + (bad.length ? ' · ' + bad.join(' · ') : ''), err: bad.length > 0 });
    load();
  }
  async function toggle(it) {
    try { await apiFetch('/api/admin/eesh', { method: 'PATCH', body: { id: it.id, active: !it.active } }); load(); } catch (e) { alert(e.message); }
  }
  async function remove(it) {
    if (!confirm(`«${it.title}»-г сангаас хасах уу? (Өмнө нь үүсгэсэн багш нарын шалгалт хэвээр үлдэнэ)`)) return;
    try { await apiFetch('/api/admin/eesh?id=' + encodeURIComponent(it.id), { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  }

  const groups = {};
  (list || []).forEach(it => { (groups[it.subject] = groups[it.subject] || []).push(it); });
  return (
    <div style={{ background: bg, borderRadius: 14, boxShadow: '0 1px 4px rgba(17,24,39,.06)', marginTop: 16, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', border: 0, background: 'none', color: text, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>ЭЕШ сан{list ? ` — ${list.length}` : ''}</span>
        <span style={{ fontSize: 12, color: muted, fontWeight: 700 }}>{open ? 'Хураах' : 'Нээх'}</span>
      </button>
      {open && <div style={{ padding: '0 16px 16px', borderTop: '1px solid ' + border }}>
        {msg && <div style={{ margin: '12px 0 0', padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: msg.err ? '#fdecec' : '#e9f8ef', color: msg.err ? '#b3261e' : '#15803d', wordBreak: 'break-word' }}>{msg.text}</div>}
        <form onSubmit={addOne} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .6fr', gap: 8 }}>
            <select value={form.subject} onChange={e => set('subject', e.target.value)} style={inp}>{BANK_SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
            <input value={form.year} onChange={e => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Он (2024)" style={inp} />
            <input value={form.variant} onChange={e => set('variant', e.target.value.toUpperCase().slice(0, 4))} placeholder="Хувилбар" style={inp} />
          </div>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Гарчиг (хоосон бол «Физик ЭЕШ 2024 · хувилбар A»)" style={inp} />
          <input value={form.key} onChange={e => set('key', e.target.value)} placeholder="1-р хэсгийн түлхүүр: ABDCE EDCBA …" style={{ ...inp, fontFamily: 'monospace' }} />
          <input value={form.scores} onChange={e => set('scores', e.target.value)} placeholder="Оноо (хоосон бол бүгд 1): 1 1 2 2 3 …" style={{ ...inp, fontFamily: 'monospace' }} />
          <textarea value={form.sec2} onChange={e => set('sec2', e.target.value)} rows={3} placeholder={'2-р хэсэг (сонголттой):\n2.1 a=3 b=- c=5 @1\n2.2 a=1 b=2'} style={{ ...inp, fontFamily: 'monospace', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="Даалгаврын PDF — Drive холбоос" inputMode="url" style={{ ...inp, flex: '1 1 260px' }} />
            <button type="submit" disabled={!!busy} style={{ ...btn('#7B52EE', 'white'), marginLeft: 'auto' }}>{busy || 'Санд нэмэх'}</button>
          </div>
        </form>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px dashed ' + border }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: muted, flex: 1 }}>JSON импорт (Дасгалын төвийн ЭЕШ математик — HTML, онлайн шалгалттай)</span>
          <label style={{ ...btn(d ? '#2a2440' : '#eef2ff', d ? '#c4b1ff' : '#4338ca'), display: 'inline-block' }}>
            JSON сонгох<input type="file" accept="application/json,.json" hidden disabled={!!busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importJson(f); }} />
          </label>
        </div>
        {!list && <div style={{ padding: 14, fontSize: 13, color: muted }}>Ачаалж байна…</div>}
        {list && list.length === 0 && <div style={{ padding: 14, fontSize: 13, color: muted }}>Сан хоосон байна.</div>}
        {Object.entries(groups).map(([s, items]) => (
          <div key={s} style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: text, marginBottom: 6 }}>{s} — {items.length}</div>
            {items.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid ' + border, opacity: it.active ? 1 : .55 }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: text }}>{it.year} · {it.variant} — {it.title}</div>
                  <div style={{ fontSize: 12, color: muted }}>{it.sec1Count} тест{it.useSec2 ? ' + 2-р хэсэг' : ''}{it.pdf ? ' · PDF' : ''}{it.html ? ' · HTML (онлайн)' : ''}{it.active ? '' : ' · нуусан'}</div>
                </div>
                <button onClick={() => toggle(it)} style={btn(d ? '#2a2e38' : '#f3f4f6', text)}>{it.active ? 'Нуух' : 'Харуулах'}</button>
                <button onClick={() => remove(it)} style={btn('#fdecec', '#b3261e')}>Хасах</button>
              </div>
            ))}
          </div>
        ))}
      </div>}
    </div>
  );
}
