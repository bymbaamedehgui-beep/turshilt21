// Шалгалтын QR (pages/index.js шалгалтын карт): сурагчид утасныхаа камераар уншуулж бодлогоо харна — бодлого хэвлэх
// шаардлагагүй, хариугаа хуудсандаа будна. Эх сурвалж: хувилбар бүрийн Google Drive PDF эсвэл Дасгалын төвийн бодлого (хариугүй).
// QR-ыг дэлгэц/проектороор харуулах эсвэл нэг хуудас хэвлээд самбарт наана. API: pages/api/exam-qr.js; сурагчийн хуудас: pages/api/q.js.
import { useState, useEffect } from 'react';
import qrcode from 'qrcode-generator';
import { apiFetch } from '../lib/eyesh';
import { isDriveUrl, normalizeDriveUrl, driveStatus } from '../lib/drive';

// QR → SVG path: модуль бүр 1×1, эргэн тойронд 4 модулийн цагаан зай
function qrPath(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), m = 4;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return { d, s: n + 2 * m };
}
function Qr({ text, size }) {
  const { d, s } = qrPath(text);
  return (
    <svg className="eq-qr" viewBox={`0 0 ${s} ${s}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="QR код">
      <rect width={s} height={s} fill="#fff" /><path d={d} fill="#000" />
    </svg>
  );
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ЭЕШ сангийн «… хувилбар B — даалгавар (PDF)» → 'B'
const sugLetter = title => (/хувилбар\s*([A-J])\b/i.exec(title || '') || [])[1]?.toUpperCase() || '';

export function ExamQr({ exam, onClose }) {
  const [st, setSt] = useState(null);        // { token, open, pdfs, variants, hasPaper, suggest } — хадгалсан төлөв
  const [pdfs, setPdfs] = useState({});
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState(null);    // [{ L, s: 'private'|'missing' }] — Drive файл нээлттэй биш
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch('/api/exam-qr?examId=' + encodeURIComponent(exam.id))
      .then(d => { setSt(d); setPdfs(d.pdfs || {}); setOpen(d.token ? d.open : true); })
      .catch(e => setErr(e.message));
  }, [exam.id]);
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') (full ? setFull(false) : onClose()); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [full, onClose]);

  const vers = st?.variants || ['A'], multi = vers.length > 1;
  const link = st?.token ? window.location.origin + '/q/' + st.token : '';
  // Шалгалтын материал дахь PDF (ЭЕШ сан) — хоосон талбарт санал болгоно
  const sug = (st?.suggest || []).map(x => ({ ...x, L: sugLetter(x.title) || (multi ? '' : 'A') })).filter(x => vers.includes(x.L) && !pdfs[x.L]);

  // force — «Тэгсэн ч хадгалах» эсвэл нээх/хаах: Drive шалгалтыг алгасна
  async function save(force = false, nextOpen = open) {
    setErr(''); setWarn(null);
    const body = {};
    for (const L of vers) { const v = String(pdfs[L] || '').trim(); if (v) body[L] = isDriveUrl(v) ? normalizeDriveUrl(v) : v; }
    for (const L in body) if (!/^https:\/\//i.test(body[L])) return setErr(`${multi ? L + ' хувилбарын ' : ''}холбоос https://-ээр эхлэх ёстой`);
    if (nextOpen && !st.hasPaper && !Object.keys(body).length) return setErr('Шалгалтын PDF-ийн Google Drive холбоосоо оруулна уу');
    setBusy(true);
    if (!force) {
      // өмнө хадгалсан холбоосыг дахин шалгахгүй
      const bad = [];
      for (const L in body) {
        if (body[L] === st.pdfs?.[L]) continue;
        const s = await driveStatus(body[L]);
        if (s === 'private' || s === 'missing') bad.push({ L, s });
      }
      if (bad.length) { setWarn(bad); setBusy(false); return; }
    }
    try {
      const d = await apiFetch('/api/exam-qr', { method: 'PUT', body: { examId: exam.id, open: nextOpen, pdfs: body } });
      setSt(d); setPdfs(d.pdfs || {}); setOpen(d.open);
    } catch (e) { setErr(e.message); setOpen(st.token ? st.open : true); }
    setBusy(false);
  }
  function copy() {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  }
  // Самбарт наах нэг хуудас: том QR + шалгалтын нэр + заавар
  function printQr() {
    const { d, s } = qrPath(link);
    const w = window.open('', '_blank');
    if (!w) return setErr('Хэвлэх цонх нээгдсэнгүй — хөтөч дээр popup-ыг зөвшөөрнө үү');
    w.document.write('<!doctype html><html lang="mn"><head><meta charset="utf-8"><title>' + esc(exam.title) + ' — QR</title><style>'
      + '@page{size:A4;margin:0}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111;text-align:center}'
      + '.p{padding:16mm 14mm}.t{font-size:26pt;font-weight:900;margin:0 0 3mm}.s{font-size:15pt;color:#444;margin:0 0 8mm}'
      + 'svg{width:150mm;height:150mm}.i{font-size:17pt;font-weight:700;margin:8mm 0 3mm}.u{font-size:12pt;color:#555;word-break:break-all}'
      + '</style></head><body><div class="p"><p class="t">' + esc(exam.title) + '</p><p class="s">' + esc(exam.subject || '') + '</p>'
      + '<svg viewBox="0 0 ' + s + ' ' + s + '" shape-rendering="crispEdges"><rect width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>'
      + '<p class="i">Утасныхаа камераар QR-ыг уншуулж бодлогоо харна уу.' + (multi ? ' Багшийн хэлсэн хувилбараа сонгоно.' : '') + '</p>'
      + '<p class="u">' + esc(link) + '</p></div><script>window.onload=function(){window.print()}</script></body></html>');
    w.document.close();
  }

  return (
    <div className="eq-back" onClick={onClose}>
      <div className="eq" role="dialog" aria-label="Шалгалтын QR" onClick={e => e.stopPropagation()}>
        <div className="eq-h"><b>QR — бодлогоо утсаараа харах</b><button className="eq-x" onClick={onClose} aria-label="Хаах">×</button></div>
        <div className="eq-t">{exam.title}</div>
        <p className="mp-note">Сурагчид утасныхаа камераар уншуулж бодлогоо харна — бодлого хэвлэх шаардлагагүй, хариугаа хуудсандаа будна.{multi ? ' Хувилбараа утсан дээрээ сонгоно.' : ''}</p>
        {!st && !err && <div className="eq-load">Ачаалж байна…</div>}
        {st && <>
          {st.hasPaper && <div className="eq-src">Дасгалын төвийн бодлого хариугүйгээр харагдана — PDF оруулах шаардлагагүй.</div>}
          {vers.map(L => (
            <label key={L} className="eq-pdf">
              <span>{multi ? `${L} хувилбарын PDF` : 'Шалгалтын PDF'}{st.hasPaper ? ' (заавал биш)' : ''}</span>
              <input className="mp-input" value={pdfs[L] || ''} placeholder="https://drive.google.com/file/d/…" inputMode="url"
                onChange={e => { const v = e.target.value; setPdfs(p => ({ ...p, [L]: v })); setWarn(null); }} />
            </label>
          ))}
          {sug.length > 0 && (
            <button className="cm-link eq-sug" onClick={() => setPdfs(p => { const n = { ...p }; sug.forEach(x => { if (!n[x.L]) n[x.L] = x.url; }); return n; })}>
              Шалгалтын материалын PDF-ийг ашиглах
            </button>
          )}
          <p className="mp-note">Google Drive-д PDF-ээ байршуулаад <b>Хуваалцах → «Холбоостой хэн ч»</b> болгосон холбоос.{multi ? ' Бүх хувилбар нэг PDF-д байвал бүгдэд нь ижил холбоос тавина.' : ''}</p>
          {warn && (
            <div className="cm-alert soft mp-warn">
              <span>{warn.map(w => `${multi ? w.L + ' хувилбарын ' : ''}Drive файл ${w.s === 'private' ? 'нийтэд нээгдээгүй байна — сурагчид нээж чадахгүй. Drive дээр Хуваалцах → «Холбоостой хэн ч» болгоно уу.' : 'олдсонгүй — холбоосоо шалгана уу.'}`).join(' ')}</span>
              <button className="cm-link" onClick={() => save(true)} disabled={busy}>Тэгсэн ч хадгалах</button>
            </div>
          )}
          {err && <div className="cm-alert">{err}</div>}
          <div className="eq-row">
            <label className="eq-sw">
              <input type="checkbox" checked={open} disabled={busy} onChange={e => { const v = e.target.checked; setOpen(v); if (st.token) save(true, v); }} />
              <span>{open ? 'Сурагчдад нээлттэй' : 'Хаалттай'}</span>
            </label>
            <button className="cm-btn" disabled={busy} onClick={() => save(false)}>{busy ? 'Хадгалж байна…' : st.token ? 'Хадгалах' : 'QR үүсгэх'}</button>
          </div>
          {st.token && (
            <div className="eq-show">
              <Qr text={link} size={200} />
              <div className="eq-side">
                <div className="eq-link">{link}</div>
                {!st.open && <div className="eq-closed">Хаалттай — сурагчид уншуулахад бодлого харагдахгүй.</div>}
                <button className="cm-btn ghost" onClick={() => setFull(true)}>Том дэлгэцээр</button>
                <button className="cm-btn ghost" onClick={printQr}>Хэвлэх</button>
                <button className="cm-link" onClick={copy}>{copied ? 'Хуулсан ✓' : 'Холбоос хуулах'}</button>
              </div>
            </div>
          )}
          <p className="mp-note eq-foot">Шалгалт дууссаны дараа «Сурагчдад нээлттэй»-г унтраавал бодлого дахин харагдахгүй.</p>
        </>}
      </div>
      {full && (
        <div className="eq-full" onClick={e => { e.stopPropagation(); setFull(false); }}>
          <b>{exam.title}</b>
          <Qr text={link} />
          <p>Утасныхаа камераар уншуулж бодлогоо харна уу{multi ? ' · хувилбараа сонгоно' : ''}</p>
          <span>Хаахын тулд дэлгэц дээр дарна уу</span>
        </div>
      )}
    </div>
  );
}
