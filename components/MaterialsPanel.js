// ── Сурах бичиг (admin) ба ЭЕШ материал (багш) ─────────────────────────────
// PDF байршуулах (Vercel Blob руу хөтчөөс шууд) эсвэл холбоос оруулах; жагсаалт, устгах.
// kind 'textbook' — бүх сурагчид харна; 'material' — зөвхөн тухайн багшийн сурагчид (анги сонгож болно).
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/eyesh';
import { uploadPdf, uploadReady, NOT_CONFIGURED } from '../lib/uploadClient';
import { isDriveUrl, driveFileId, driveResourceKey, normalizeDriveUrl } from '../lib/drive';

const SUBJECTS = ['Математик', 'Физик', 'Хими', 'Биологи', 'Монгол хэл', 'Уран зохиол', 'Англи хэл', 'Орос хэл', 'Түүх', 'Газарзүй', 'Нийгмийн ухаан', 'Мэдээллийн технологи'];
const fmtSize = n => (!n ? '' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

export function MaterialsPanel({ kind, classes = [] }) {
  const isBook = kind === 'textbook';
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState('link');          // 'link' (Google Drive холбоос — үнэгүй, анхдагч) | 'file'
  const [warn, setWarn] = useState(null);            // { id, status: 'private'|'missing' } — Drive файл нээлттэй биш
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [cls, setCls] = useState('');
  const [file, setFile] = useState(null);
  const [link, setLink] = useState('');
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { apiFetch('/api/materials?kind=' + kind).then(setItems).catch(e => setErr(e.message)); }, [kind]);
  // Файл хадгалах сан холбогдоогүй бол PDF байршуулахыг хааж холбоос руу шилжинэ (ойлгомжгүй алдаа гаргахгүй)
  const [canUpload, setCanUpload] = useState(true);
  useEffect(() => { uploadReady().then(ok => { setCanUpload(ok); if (!ok) setMode('link'); }); }, []);

  // force — «Тэгсэн ч нэмэх»: Drive файл хаалттай/олдоогүй гэсэн анхааруулгыг үл тоон хадгална
  async function save(force = false) {
    setErr('');
    if (!title.trim()) return setErr('Гарчиг оруулна уу');
    if (mode === 'file' && !file) return setErr('PDF файл сонгоно уу');
    if (mode === 'link' && !/^https:\/\//i.test(link.trim())) return setErr('https:// -ээр эхэлсэн холбоос оруулна уу');
    setBusy(true);
    try {
      let url = mode === 'link' && isDriveUrl(link) ? normalizeDriveUrl(link) : link.trim(), size = null;
      // Drive файл «Холбоостой хэн ч» нээлттэй эсэх — үгүй бол сурагчид «Хандах эрх хүсэх» л харна
      const id = mode === 'link' ? driveFileId(url) : null;
      if (id && !force) {
        const rk = driveResourceKey(url);
        const c = await apiFetch('/api/drive-check?id=' + encodeURIComponent(id) + (rk ? '&rk=' + encodeURIComponent(rk) : '')).catch(() => ({ status: 'unknown' }));
        if (c.status === 'private' || c.status === 'missing') { setWarn({ id, status: c.status }); setBusy(false); return; }
      }
      setWarn(null);
      if (mode === 'file') { setProgress(0); ({ url, size } = await uploadPdf(file, kind, setProgress)); }
      const m = await apiFetch('/api/materials', { method: 'POST', body: { kind, title: title.trim(), subject, class: cls, url, size } });
      setItems(x => [m, ...x]);
      setTitle(''); setFile(null); setLink(''); setProgress(null);
      const inp = document.getElementById('mp-file-' + kind); if (inp) inp.value = '';
    } catch (e) { setErr(e.message || 'Хадгалж чадсангүй'); setProgress(null); }
    setBusy(false);
  }
  async function remove(m) {
    if (!window.confirm(`«${m.title}»-ийг устгах уу?`)) return;
    try { await apiFetch('/api/materials?id=' + encodeURIComponent(m.id) + '&kind=' + kind, { method: 'DELETE' }); setItems(x => x.filter(y => y.id !== m.id)); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="mp">
      <div className="mp-card">
        <div className="mp-h">{isBook ? 'Сурах бичиг нэмэх' : 'Материал нэмэх'}</div>
        <p className="mp-note">{isBook ? 'Бүх сурагч харна. Хичээл бүрээр бүлэглэгдэнэ.' : 'Зөвхөн таны сурагчид харна.'}</p>
        <input className="mp-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={isBook ? 'Нэр (жишээ нь: Математик 12)' : 'Гарчиг (жишээ нь: 2024 оны ЭЕШ-ийн хувилбар)'} maxLength={300} />
        <div className="mp-row">
          <input className="mp-input" list={'mp-subj-' + kind} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Хичээл" maxLength={100} />
          <datalist id={'mp-subj-' + kind}>{SUBJECTS.map(s => <option key={s} value={s} />)}</datalist>
          {!isBook && (
            <select className="mp-input" value={cls} onChange={e => setCls(e.target.value)}>
              <option value="">Бүх анги</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <div className="mp-seg">
          <button className={mode === 'link' ? 'on' : ''} onClick={() => { setMode('link'); setWarn(null); }}>Google Drive холбоос</button>
          <button className={mode === 'file' ? 'on' : ''} onClick={() => { setMode('file'); setWarn(null); }} disabled={!canUpload} title={canUpload ? '' : NOT_CONFIGURED}>PDF байршуулах</button>
        </div>
        {mode === 'file'
          ? <input id={'mp-file-' + kind} className="mp-input" type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          : <>
            <input className="mp-input" value={link} onChange={e => { setLink(e.target.value); setWarn(null); }} placeholder="https://drive.google.com/file/d/…" inputMode="url" />
            <p className="mp-note">Google Drive-д PDF-ээ байршуулаад <b>Хуваалцах → Ерөнхий хандалт: «Холбоостой хэн ч»</b> болгож, холбоосыг хуулж энд буулгана. Үнэгүй, том PDF ч болно.</p>
          </>}
        {warn && (
          <div className="cm-alert soft mp-warn">
            <span>{warn.status === 'private'
              ? <>Энэ Drive файл нийтэд нээгдээгүй байна — сурагчид «Хандах эрх хүсэх» гэж харна. Drive дээр <b>Хуваалцах → «Холбоостой хэн ч»</b> болгоод дахин «Нэмэх» дарна уу.</>
              : <>Энэ холбоосоор Drive файл олдсонгүй — холбоосоо шалгана уу.</>}</span>
            <button className="cm-link" onClick={() => save(true)} disabled={busy}>Тэгсэн ч нэмэх</button>
          </div>
        )}
        {progress !== null && <div className="mp-bar"><i style={{ width: progress + '%' }} /><span>{progress}%</span></div>}
        {err && <div className="cm-alert">{err}</div>}
        <button className="cm-btn big" disabled={busy} onClick={() => save(false)}>{busy ? (progress !== null ? 'Байршуулж байна…' : 'Шалгаж байна…') : 'Нэмэх'}</button>
      </div>

      <div className="mp-h mp-list-h">{isBook ? 'Сурах бичгүүд' : 'Миний материал'} <span>{items.length}</span></div>
      {items.length === 0 && <div className="mp-empty">Одоогоор алга.</div>}
      {items.map(m => (
        <div key={m.id} className="mp-item">
          <a href={m.url} target="_blank" rel="noopener noreferrer"><b>{m.title}</b>
            <span>{[m.examId ? 'Шалгалтын материал · зөвхөн танд' : '', isDriveUrl(m.url) ? 'Google Drive' : '', m.subject, m.class, fmtSize(m.size), new Date(m.createdAt).toLocaleDateString('en-CA')].filter(Boolean).join(' · ')}</span></a>
          <button onClick={() => remove(m)} aria-label="Устгах">Устгах</button>
        </div>
      ))}
    </div>
  );
}

// Admin: ЭЕШ-ийн огноо (сурагчийн тоолуурт)
export function EeshDateSetting() {
  const [date, setDate] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { apiFetch('/api/admin/settings').then(d => setDate(d.eeshDate || '')).catch(() => {}); }, []);
  async function save() {
    setMsg('');
    try { const d = await apiFetch('/api/admin/settings', { method: 'PUT', body: { eeshDate: date } }); setDate(d.eeshDate || ''); setMsg('Хадгаллаа ✓'); }
    catch (e) { setMsg(e.message); }
  }
  return (
    <div className="mp-card">
      <div className="mp-h">ЭЕШ-ийн огноо</div>
      <p className="mp-note">Сурагчдад «ЭЕШ хүртэл N өдөр» гэж харагдана.</p>
      <div className="mp-row">
        <input className="mp-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button className="cm-btn" onClick={save}>Хадгалах</button>
      </div>
      {msg && <div className={msg.endsWith('✓') ? 'mp-ok' : 'cm-alert'}>{msg}</div>}
    </div>
  );
}
