import { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch, uid, calcScore, SEC2_SUBS } from '../lib/eyesh';
import { sheetLayout, readSheet, readKey, toDet, toGray, S1_CHOICES, S2_OPTS, S1_MAX } from '../lib/omr';

// ── ZipGrade маягийн хурдан шалгалт ────────────────────────────────────────
// Камер → хуудсыг таних → 2 дараалсан кадр ижил уншигдвал автоматаар авна →
// оноо + зөв/буруу давхарлага → эргэлзээтэйг багш баталгаажуулна → хадгалаад дараагийн.

const PROC_LONG = 1600;       // боловсруулах кадрын урт тал (px)
const FLAG_LABEL = { multi:'Олон будсан', weak:'Бүдэг', mixed:'Арилгасан?' };

function grab(src, sw, sh, long) {
  const k = Math.min(1, long / Math.max(sw, sh));
  const w = Math.round(sw * k), h = Math.round(sh * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, w, h);
  return { canvas: c, w, h, k, gray: toGray(x.getImageData(0, 0, w, h).data, w * h) };
}

// Хоёр уншилтыг нэгтгэнэ: зөрсөн мөрийг эргэлзээтэй болгоно (нэг зургаас уншихад)
function mergeReads(a, b) {
  const groups = {};
  for (const id of Object.keys(a.groups)) {
    const x = a.groups[id], y = b.groups[id];
    groups[id] = (x.sel !== y.sel || x.flag || y.flag)
      ? { ...x, flag: x.flag || y.flag || 'weak', cand: [...new Set([...(x.cand || []), ...(y.cand || []), x.sel, y.sel].filter(Boolean))] }
      : x;
  }
  return { ...a, groups, codeFlag: a.codeFlag || b.codeFlag || a.code !== b.code };
}

function beep() {
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    const ac = beep.ac || (beep.ac = new A()), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.09);
  } catch (e) {}
}

const STATUS = {
  markers: 'Хуудасны булангийн 6 хар дөрвөлжинг дэлгэцэнд багтаана уу',
  far: 'Ойртуулна уу — хуудас дэлгэцийн ихэнхийг эзлэх ёстой',
  orient: 'Хуудсыг босоо, гарчгийг нь дээш нь барина уу',
  reading: 'Уншиж байна… хөдөлгөөнгүй барина уу',
  saved: 'Энэ хуудас хадгалагдсан — дараагийн хуудсаа тавина уу',
  dim: 'Тод бус байна — гэрэлтэй газар, сүүдэргүй барина уу',
  start: 'Камер асааж байна…',
  pick: 'Эхлээд дээрээс сурагчаа сонгоно уу',
};
const CLASS_KEY = 'eyesh_scan_class';      // сүүлд сонгосон анги — дараагийн сурагчид хадгалагдана
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// ── Сурагч сонгох (анги → нэр) ─────────────────────────────────────────────
function StudentPicker({ roster, cls, onClass, scanned, onPick, onClose }) {
  const [q, setQ] = useState('');
  const classes = useMemo(() => [...new Set(roster.map(a => a.class || '—'))]
    .sort((a, b) => a.localeCompare(b, 'mn', { numeric: true })), [roster]);
  const inCls = roster.filter(a => (a.class || '—') === cls);
  const done = inCls.filter(a => scanned[a.code]).length;
  const needle = q.trim().toLowerCase();
  const list = inCls
    .filter(a => !needle || (a.name || '').toLowerCase().includes(needle) || String(a.code || '').includes(needle))
    .sort((a, b) => (!!scanned[a.code] - !!scanned[b.code]) || (a.name || '').localeCompare(b.name || '', 'mn'));
  return (
    <div className="qs-pick-bg" onClick={onClose}>
      <div className="qs-pick" onClick={e => e.stopPropagation()}>
        <div className="qs-pick-h">
          <div><b>Сурагч сонгох</b><span>{cls} · шалгасан {done}/{inCls.length}</span></div>
          <button className="qs-round light" onClick={onClose} aria-label="Хаах">✕</button>
        </div>
        <div className="qs-pick-cls">
          {classes.map(c => <button key={c} className={c === cls ? 'on' : ''} onClick={() => onClass(c)}>{c}</button>)}
        </div>
        <input className="qs-pick-q" type="search" placeholder="Нэр эсвэл кодоор хайх…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="qs-pick-list">
          {list.map(a => (
            <button key={a.id} className={scanned[a.code] ? 'done' : ''} onClick={() => onPick(a)}>
              <span><b>{a.name || '—'}</b><i>{a.code}</i></span>
              {scanned[a.code] && <em>✓ {scanned[a.code].scaled}</em>}
            </button>
          ))}
          {!list.length && <div className="qs-pick-empty">{inCls.length ? 'Хайлтад тохирох сурагч алга' : 'Энэ ангид сурагч алга'}</div>}
        </div>
        <button className="qs-pick-manual" onClick={() => onPick('manual')}>Жагсаалтад байхгүй сурагч — нэрийг дараа бичнэ</button>
      </div>
    </div>
  );
}

// ── Камер ──────────────────────────────────────────────────────────────────
function Scanner({ layout, paused, lastKey, examTitle, savedCount, recent, student, needStudent, onPick, onCapture, onClose }) {
  const videoRef = useRef(), overlayRef = useRef(), streamRef = useRef(), lastOk = useRef(null);
  const [status, setStatus] = useState('start');
  const [found, setFound] = useState(false);
  const [err, setErr] = useState('');
  const [torch, setTorch] = useState(null);       // null = дэмжихгүй
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const lastKeyRef = useRef(lastKey); lastKeyRef.current = lastKey;

  useEffect(() => {
    let stop = false, timer = null, streak = { key: '', n: 0 };
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (stop) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        const v = videoRef.current; v.srcObject = s; await v.play().catch(() => {});
        const tr = s.getVideoTracks()[0], caps = tr.getCapabilities?.() || {};
        if (caps.torch) setTorch(false);
        try { await tr.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
      } catch (e) {
        setErr(location.protocol === 'https:' || location.hostname === 'localhost'
          ? 'Камер ашиглах зөвшөөрөл олгоно уу (хөтчийн тохиргоо → Камер).' : 'Камер зөвхөн https хаягаар ажиллана.');
        return;
      }
      const tick = () => {
        if (stop) return;
        const v = videoRef.current;
        if (!pausedRef.current && v && v.videoWidth) {
          const g = grab(v, v.videoWidth, v.videoHeight, PROC_LONG);
          const r = readSheet(g.gray, g.w, g.h, layout);
          draw(r, g.k);
          if (!r.ok) { streak = { key: '', n: 0 }; setStatus(r.reason); setFound(false); }
          else {
            setFound(true);
            lastOk.current = { read: r, frame: g.canvas };
            const key = readKey(r);
            if (key === lastKeyRef.current) { setStatus('saved'); streak = { key, n: 0 }; }
            else {
              streak = key === streak.key ? { key, n: streak.n + 1 } : { key, n: 1 };
              const total = layout.groups.filter(x => x.kind === 's1' || x.kind === 's2').length || 1;
              const clean = r.flagged / total <= 0.3;
              setStatus(clean ? 'reading' : 'dim');
              if ((streak.n >= 2 && clean) || streak.n >= 6) {
                streak = { key: '', n: 0 };
                try { navigator.vibrate?.(70); } catch (e) {}
                beep();
                onCapture({ read: r, frame: g.canvas });
              }
            }
          }
        }
        timer = setTimeout(tick, 90);
      };
      tick();
    })();
    return () => { stop = true; clearTimeout(timer); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [layout]);

  function draw(r, k) {
    const c = overlayRef.current, v = videoRef.current; if (!c || !v) return;
    const dw = c.clientWidth, dh = c.clientHeight;
    if (c.width !== dw) c.width = dw; if (c.height !== dh) c.height = dh;
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, dw, dh);
    const s = Math.max(dw / v.videoWidth, dh / v.videoHeight);
    const ox = (dw - v.videoWidth * s) / 2, oy = (dh - v.videoHeight * s) / 2;
    const P = ([x, y]) => [ox + x / k * s, oy + y / k * s];
    if (r.ok) {
      const q = r.corners.map(P);
      ctx.fillStyle = 'rgba(34,197,94,.14)'; ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath(); q.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#22c55e'; q.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); });
    } else {
      const gw = Math.min(dw * 0.86, (dh * 0.78) / 1.414), gh = gw * 1.414, gx = (dw - gw) / 2, gy = (dh - gh) / 2 - 10, L = 34;
      ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      [[gx, gy, 1, 1], [gx + gw, gy, -1, 1], [gx + gw, gy + gh, -1, -1], [gx, gy + gh, 1, -1]].forEach(([x, y, a, b]) => {
        ctx.beginPath(); ctx.moveTo(x + a * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + b * L); ctx.stroke();
      });
    }
  }

  async function toggleTorch() {
    const tr = streamRef.current?.getVideoTracks()[0]; if (!tr) return;
    try { await tr.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch); } catch (e) {}
  }
  function manual() {
    if (lastOk.current && !pausedRef.current) { beep(); onCapture(lastOk.current); }
  }

  return (
    <div className="qs-cam">
      <video ref={videoRef} playsInline muted autoPlay className="qs-video" />
      <canvas ref={overlayRef} className="qs-overlay" />
      <div className="qs-top">
        <button className="qs-round" onClick={onClose} aria-label="Хаах">✕</button>
        <div className="qs-title"><b>{examTitle}</b><span>Шалгасан: {savedCount}</span></div>
        {torch !== null
          ? <button className={'qs-round' + (torch ? ' on' : '')} onClick={toggleTorch} aria-label="Гэрэл">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6l-1 7h4l-8 13 1-9H7z"/></svg>
            </button>
          : <span style={{ width: 44 }} />}
      </div>
      {onPick && (
        <button className={'qs-who' + (needStudent ? ' need' : '')} onClick={onPick}>
          {student === 'manual'
            ? <span><b>Жагсаалтгүй сурагч</b><i>Нэрийг үр дүн дээр бичнэ</i></span>
            : student
              ? <span><b>{student.name}</b><i>{student.class ? student.class + ' · ' : ''}{student.code}</i></span>
              : <span><b>Сурагч сонгох</b><i>Анги, нэрийг сонгоод уншуулна</i></span>}
          <em>{student ? 'Солих' : 'Сонгох'}</em>
        </button>
      )}
      {recent.length > 0 && (
        <div className={'qs-recent' + (onPick ? ' low' : '')}>
          {recent.slice(0, 3).map((s, i) => <span key={i}><b>{s.name}</b> {s.scaled}</span>)}
        </div>
      )}
      <div className="qs-bottom">
        {err ? <div className="qs-status err">{err}</div>
          : needStudent ? <div className="qs-status">{STATUS.pick}</div>
          : <div className={'qs-status' + (found ? ' ok' : '')}>{STATUS[status] || STATUS.markers}</div>}
        <button className="qs-shutter" onClick={manual} disabled={!found || needStudent} aria-label="Одоо унших"><span /></button>
        <div className="qs-hint">Автоматаар уншина · дарвал шууд авна</div>
      </div>
    </div>
  );
}

// ── Үр дүн / баталгаажуулалт ───────────────────────────────────────────────
function Review({ exam, layout, result, roster, existing, chosen, onChangeStudent, onSave, onRetake, onClose }) {
  const { read, frame } = result;
  const groups = layout.groups;
  const [ans, setAns] = useState(() => Object.fromEntries(groups.map(g => [g.id, read.groups[g.id]?.sel || ''])));
  const [pending, setPending] = useState(() => new Set(groups.filter(g => g.kind !== 'id' && read.groups[g.id]?.flag).map(g => g.id)));
  const [editing, setEditing] = useState(null);
  const [tagAck, setTagAck] = useState(read.tagOk);
  const picked = chosen && chosen !== 'manual' ? chosen : null;   // багш урьдчилан сонгосон сурагч
  const match = picked || roster.find(a => a.code && a.code === read.code);
  const [code, setCode] = useState(match?.code || read.code || '');
  const [name, setName] = useState(match?.name || '');
  const [cls, setCls] = useState(match?.class || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const canvasRef = useRef();

  // Сонгосон сурагч ба хуудсан дээр будсан код зөрвөл — хэнийх болохыг багш шийднэ
  const sheetOwner = read.code ? roster.find(a => a.code === read.code) : null;
  const codeClash = !!(picked && read.code && read.code !== picked.code);
  const [clashOk, setClashOk] = useState(!codeClash);

  useEffect(() => {
    if (picked) { setCode(picked.code || ''); setName(picked.name || ''); setCls(picked.class || ''); setClashOk(!(read.code && read.code !== picked.code)); }
  }, [picked && picked.id]);
  useEffect(() => {
    if (picked) return;
    const m = roster.find(a => a.code && a.code === code);
    if (m) { setName(m.name || ''); setCls(m.class || ''); }
  }, [code, roster]);

  const vExam = useMemo(() => {
    const sec2Enabled = {}; SEC2_SUBS.forEach(s => { sec2Enabled[s] = exam.sec2Config?.[s]?._enabled || false; });
    return { ...exam, sec2Config: exam.sec2Config || {}, sec2Enabled };
  }, [exam]);
  const scored = useMemo(() => {
    const r = { ...read, groups: Object.fromEntries(groups.map(g => [g.id, { sel: ans[g.id], flag: pending.has(g.id) ? 'p' : null }])) };
    return calcScore(toDet(r, layout), vExam);
  }, [ans, pending]);

  const keyOf = g => g.kind === 's1' ? exam.sec1Key?.[g.q - 1]
    : g.kind === 's2' ? (v => (v && typeof v === 'object' ? v.ans : v))(exam.sec2Config?.[g.sub]?.[g.row]) : null;

  // Зураг + давхарлага
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.width = frame.width; c.height = frame.height;
    const x = c.getContext('2d'); x.drawImage(frame, 0, 0);
    const sc = (() => { const [a, b] = read.map(100, 150), [p, q] = read.map(101, 150); return Math.hypot(p - a, q - b); })();
    for (const g of groups) {
      if (g.kind !== 's1' && g.kind !== 's2') continue;
      const sel = ans[g.id], key = String(keyOf(g) ?? '');
      g.options.forEach(o => {
        const [px, py] = read.map(o.x, o.y), r = g.r * sc;
        if (pending.has(g.id) && (read.groups[g.id].cand || []).includes(o.v)) {
          x.strokeStyle = '#f59e0b'; x.lineWidth = Math.max(2, r * 0.45); x.beginPath(); x.arc(px, py, r * 1.35, 0, 7); x.stroke();
        }
        if (o.v === sel) {
          x.fillStyle = sel === key ? 'rgba(22,163,74,.55)' : 'rgba(220,38,38,.55)';
          x.beginPath(); x.arc(px, py, r * 1.15, 0, 7); x.fill();
        } else if (o.v === key && sel !== key) {
          x.strokeStyle = '#16a34a'; x.lineWidth = Math.max(2, r * 0.35); x.beginPath(); x.arc(px, py, r * 1.15, 0, 7); x.stroke();
        }
      });
    }
  }, [ans, pending]);

  function choose(id, v) {
    setAns(a => ({ ...a, [id]: v }));
    setPending(p => { const n = new Set(p); n.delete(id); return n; });
    setEditing(null);
  }
  const dup = existing.find(s => (code && s.code === code) || (!code && name && s.name === name));
  const ready = pending.size === 0 && tagAck && clashOk && !saving;

  async function save() {
    if (!ready) return;
    setSaving(true); setErr('');
    const student = {
      id: uid(), examId: exam.id, name: name.trim() || `Хуудас ${existing.length + 1}`, code: code.trim(), class: cls,
      version: ans.ver || '—', ...scored, needsReview: false, submittedAt: new Date().toISOString(),
    };
    try { await onSave(student, readKey(read)); }
    catch (e) { setErr(e.message || 'Хадгалж чадсангүй'); setSaving(false); }
  }

  const s1 = groups.filter(g => g.kind === 's1'), s2 = groups.filter(g => g.kind === 's2');
  const ed = editing && groups.find(g => g.id === editing);
  const grade = scored.grade || {};
  const chip = g => {
    const sel = ans[g.id], key = String(keyOf(g) ?? '');
    const st = pending.has(g.id) ? 'pend' : !sel ? 'blank' : sel === key ? 'ok' : 'ng';
    return { st, sel };
  };

  return (
    <div className="qs-review">
      <div className="qs-rtop">
        <button className="qs-round light" onClick={onClose} aria-label="Хаах">✕</button>
        <div className="qs-rtitle">Үр дүн</div>
        <button className="qs-link" onClick={onRetake}>Дахин унших</button>
      </div>
      <div className="qs-rbody">
        <div className="qs-score">
          <div className="qs-ring" style={{ '--c': grade.c || '#7B52EE', '--p': Math.min(100, scored.scaled || 0) }}>
            <b>{scored.scaled}</b><span>ЭЕШ оноо</span>
          </div>
          <div className="qs-sinfo">
            <div className="qs-grade" style={{ color: grade.c }}>{grade.g} · {grade.l}</div>
            <div className="qs-raw">{scored.rawEarned}/{scored.rawMax} оноо</div>
            <div className="qs-cnt">
              <span className="ok">✓ {scored.correct}</span>
              <span className="ng">✗ {scored.wrong - scored.blank}</span>
              <span className="bl">○ {scored.blank}</span>
            </div>
          </div>
        </div>

        {!tagAck && (
          <div className="qs-warn red">
            <span>Энэ хуудас «{exam.title}» шалгалтынх биш байж магадгүй (хуудасны код таарахгүй).
              {/^ws:/.test(exam.cmRef || '') && ' Өөр хувилбарын хуудас байж болно — хуудасны баруун дээд буланд хэвлэсэн «Хувилбарын код»-ыг шалгалтын нэр дэх кодтой тулгана уу.'}</span>
            <button onClick={() => setTagAck(true)}>Энэ шалгалтынх мөн</button>
          </div>
        )}
        {pending.size > 0 && (
          <div className="qs-warn">
            <span><b>{pending.size}</b> мөр эргэлзээтэй (шар). Дугуйг нь зургаас харж зөвийг сонгоно уу.</span>
            <button onClick={() => setPending(new Set())}>Санал болгосноор батлах</button>
          </div>
        )}

        {codeClash && !clashOk && (
          <div className="qs-warn red">
            <span>Хуудсан дээрх код <b>{read.code}</b>{sheetOwner ? ` (${sheetOwner.name})` : ''} сонгосон <b>{picked.name}</b>-ийн кодтой таарахгүй байна.</span>
            {sheetOwner && <button onClick={() => onChangeStudent(sheetOwner)}>{sheetOwner.name} гэж солих</button>}
            <button onClick={() => setClashOk(true)}>{picked.name}-д хадгалах</button>
          </div>
        )}
        <div className="qs-stu">
          {match && match.code === code ? (
            <div className="qs-match">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              <div><b>{name}</b><span>{cls ? cls + ' · ' : ''}код {code}</span></div>
              {onChangeStudent && <button className="qs-link" onClick={() => onChangeStudent(null)}>Солих</button>}
            </div>
          ) : (
            <div className="qs-fields">
              <label>Сурагчийн нэр
                <input value={name} onChange={e => setName(e.target.value)} placeholder={`Хуудас ${existing.length + 1}`} list="qs-roster" />
              </label>
              <label>Код {read.codeFlag && <em>шалгана уу</em>}
                <input value={code} onChange={e => setCode(e.target.value.replace(/\s/g, ''))} inputMode="numeric" placeholder="—" />
              </label>
              <datalist id="qs-roster">{roster.map(a => <option key={a.id} value={a.name}>{a.code}</option>)}</datalist>
            </div>
          )}
          {dup && <div className="qs-dup">Энэ сурагч өмнө нь шалгагдсан ({dup.scaled}) — хадгалбал шинэ мөр нэмэгдэнэ.</div>}
        </div>

        <canvas ref={canvasRef} className="qs-img" />

        <div className="qs-sec">1-р хэсэг</div>
        <div className="qs-grid">
          {s1.map(g => { const { st, sel } = chip(g); return (
            <button key={g.id} className={'qs-q ' + st + (editing === g.id ? ' sel' : '')} onClick={() => setEditing(editing === g.id ? null : g.id)}>
              <i>{g.q}</i><b>{sel || '—'}</b>
            </button>
          ); })}
        </div>
        {s2.length > 0 && <>
          <div className="qs-sec">2-р хэсэг</div>
          <div className="qs-grid s2">
            {s2.map(g => { const { st, sel } = chip(g); return (
              <button key={g.id} className={'qs-q ' + st + (editing === g.id ? ' sel' : '')} onClick={() => setEditing(editing === g.id ? null : g.id)}>
                <i>{g.sub}{g.row}</i><b>{sel || '—'}</b>
              </button>
            ); })}
          </div>
        </>}
        {err && <div className="qs-warn red">{err}</div>}
        <div style={{ height: 16 }} />
      </div>

      {ed && (
        <div className="qs-chooser">
          <div className="qs-ch-h">
            {ed.kind === 's1' ? ed.q + '-р асуулт' : ed.sub + ' · ' + ed.row}
            {read.groups[ed.id]?.flag && <em>{FLAG_LABEL[read.groups[ed.id].flag]}</em>}
            <span>Зөв: <b>{String(keyOf(ed) ?? '')}</b></span>
          </div>
          <div className="qs-ch-o">
            {(ed.kind === 's1' ? S1_CHOICES : S2_OPTS).map(v => (
              <button key={v} className={ans[ed.id] === v ? 'on' : ''} onClick={() => choose(ed.id, v)}>{v}</button>
            ))}
            <button className={'blank' + (!ans[ed.id] ? ' on' : '')} onClick={() => choose(ed.id, '')}>Хоосон</button>
          </div>
        </div>
      )}
      <div className="qs-bar">
        <button className="cm-btn big" disabled={!ready} onClick={save}>
          {saving ? 'Хадгалж байна…' : pending.size ? `${pending.size} эргэлзээтэйг шийднэ үү` : !clashOk ? 'Кодын зөрүүг шийднэ үү' : !tagAck ? 'Шалгалтын кодыг батална уу' : 'Хадгалаад дараагийн →'}
        </button>
      </div>
    </div>
  );
}

// ── Хуудас ─────────────────────────────────────────────────────────────────
export function ScanPage({ exam, exams, students, onSelectExam, onAddStudent, onNavigate }) {
  const layout = useMemo(() => exam ? sheetLayout(exam) : null, [exam]);
  const [roster, setRoster] = useState([]);
  const [camera, setCamera] = useState(false);
  const [review, setReview] = useState(null);       // { read, frame, fromCamera }
  const [lastKey, setLastKey] = useState('');
  const [session, setSession] = useState([]);
  const [msg, setMsg] = useState('');
  const [cls, setCls] = useState(() => lsGet(CLASS_KEY));   // анги нэг сонгоход дараагийн сурагчид хэвээр
  const [pick, setPick] = useState(null);                    // сонгосон сурагч | 'manual' | null
  const [picker, setPicker] = useState(false);
  const fileRef = useRef();

  useEffect(() => { apiFetch('/api/student-accounts').then(setRoster).catch(() => {}); }, []);
  useEffect(() => {
    document.body.classList.toggle('qs-lock', camera || !!review);
    return () => document.body.classList.remove('qs-lock');
  }, [camera, review]);
  // Хадгалсан анги энэ багшийн жагсаалтад байхгүй бол эхний ангийг сонгоно
  useEffect(() => {
    if (!roster.length) return;
    const classes = [...new Set(roster.map(a => a.class || '—'))].sort((a, b) => a.localeCompare(b, 'mn', { numeric: true }));
    if (!classes.includes(cls)) setCls(classes[0]);
  }, [roster]);

  const hasRoster = roster.length > 0;
  const scanned = useMemo(() => {
    const m = {};
    students.forEach(s => {   // сурагч бүрийн хамгийн сүүлийн үр дүн
      if (s.code && (!m[s.code] || String(s.submittedAt) > String(m[s.code].submittedAt))) m[s.code] = s;
    });
    return m;
  }, [students]);
  function chooseClass(c) { setCls(c); lsSet(CLASS_KEY, c); }
  function choose(a) { setPick(a); setPicker(false); }
  function openCamera() { setCamera(true); if (hasRoster && !pick) setPicker(true); }

  if (!exam) return (
    <div className="cm-page">
      <div className="cm-h2">Аль шалгалтыг шалгах вэ?</div>
      <div className="cm-list">
        {exams.length === 0 && <div className="cm-card cm-empty"><div className="cm-empty-t">Шалгалт алга</div>
          <button className="cm-btn" onClick={() => onNavigate('create')}>+ Шалгалт үүсгэх</button></div>}
        {exams.map(e => (
          <button key={e.id} className="cm-card cm-row" onClick={() => onSelectExam(e)}>
            <div><b>{e.title}</b><span>{e.subject} · {e.sec1Count} дасгал</span></div><i>›</i>
          </button>
        ))}
      </div>
    </div>
  );

  async function fromFile(file) {
    if (!file) return;
    setMsg('Уншиж байна…');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const a = grab(img, img.naturalWidth, img.naturalHeight, 1800);
      const b = grab(img, img.naturalWidth, img.naturalHeight, 1400);
      const ra = readSheet(a.gray, a.w, a.h, layout), rb = readSheet(b.gray, b.w, b.h, layout);
      if (!ra.ok || !rb.ok) { setMsg(STATUS[(ra.ok ? rb : ra).reason] || STATUS.markers); return; }
      setMsg(''); setReview({ read: mergeReads(ra, rb), frame: a.canvas, fromCamera: false });
    } catch (e) { setMsg('Зургийг нээж чадсангүй'); }
    finally { URL.revokeObjectURL(url); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function save(student, key) {
    await onAddStudent(student);
    setSession(s => [{ name: student.name, scaled: student.scaled }, ...s]);
    setLastKey(key);
    setReview(null);
    setPick(null);                                   // дараагийн сурагч — анги хэвээр, нэрийг л сонгоно
    if (camera && hasRoster) setPicker(true);
  }

  const recent = students.slice().sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt))).slice(0, 8);
  const tooMany = (exam.sec1Count || 0) > S1_MAX;

  return (
    <div className="cm-page">
      <div className="cm-hero">
        <div className="cm-hero-t">
          <span className="cm-eyebrow">Шалгах</span>
          <h1>{exam.title}</h1>
          <p>{exam.sec1Count} дасгал{exam.useSec2 ? ' · 2-р хэсэгтэй' : ''} · шалгасан {students.length}</p>
        </div>
        <button className="cm-btn amber big" disabled={tooMany} onClick={openCamera}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
          Камераар шалгах
        </button>
        <button className="cm-link light" onClick={() => onSelectExam(null)}>Шалгалт солих</button>
      </div>
      {tooMany && <div className="cm-alert">Хуудас 1-р хэсгийн {S1_MAX} хүртэлх дасгалыг уншина. Энэ шалгалт {exam.sec1Count} дасгалтай.</div>}
      {msg && <div className="cm-alert soft">{msg}</div>}

      <div className="cm-tiles">
        <button className="cm-tile" onClick={() => fileRef.current?.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
          <b>Зургаас унших</b><span>Утасны камераар авсан зураг</span>
        </button>
        <button className="cm-tile" onClick={() => onNavigate('sheets')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          <b>Хуудас хэвлэх</b><span>Хоосон эсвэл ангиар нэрлэсэн</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => fromFile(e.target.files[0])} />

      <div className="cm-card">
        <div className="cm-h3">Хэрхэн ажилладаг вэ?</div>
        <ol className="cm-steps">
          <li><b>Хуудас хэвлэ.</b> «Хуудас хэвлэх» — энэ шалгалтын CyberMath хариултын хуудас.</li>
          <li><b>Сурагчид бөглөнө.</b> Харандаа эсвэл хар үзгээр дугуйг бүрэн будна.</li>
          <li><b>Камераар уншуул.</b> 6 хар дөрвөлжин дэлгэцэнд багтмагц автоматаар уншиж, оноог шууд гаргана.</li>
        </ol>
        <div className="cm-note">AI ашиглахгүй — хуудсыг пикселээр нь уншдаг тул интернэтгүй ч, хэдэн мянган хуудас ч үнэгүй. Эргэлзээтэй мөрийг (олон будсан, бүдэг, арилгасан) таньж танаас асууна.</div>
      </div>

      {recent.length > 0 && (
        <div className="cm-card">
          <div className="cm-h3">Сүүлд шалгасан</div>
          {recent.map(s => (
            <div key={s.id} className="cm-res">
              <div><b>{s.name}</b><span>{s.class ? s.class + ' · ' : ''}{s.code || '—'}</span></div>
              <em style={{ color: s.grade?.c }}>{s.scaled}</em>
            </div>
          ))}
          <button className="cm-link" onClick={() => onNavigate('board')}>Бүх жагсаалт →</button>
        </div>
      )}

      {camera && (
        <Scanner layout={layout} paused={!!review || picker || (hasRoster && !pick)} lastKey={lastKey} examTitle={exam.title}
          savedCount={session.length} recent={session}
          student={pick} needStudent={hasRoster && !pick} onPick={hasRoster ? () => setPicker(true) : null}
          onCapture={r => setReview({ ...r, fromCamera: true })} onClose={() => { setCamera(false); setPicker(false); }} />
      )}
      {review && (
        <Review key={readKey(review.read)} exam={exam} layout={layout} result={review} roster={roster} existing={students}
          chosen={pick} onChangeStudent={hasRoster ? (a => a ? setPick(a) : setPicker(true)) : null}
          onSave={save} onRetake={() => setReview(null)} onClose={() => { setReview(null); if (!review.fromCamera) setCamera(false); }} />
      )}
      {picker && hasRoster && (
        <StudentPicker roster={roster} cls={cls} onClass={chooseClass} scanned={scanned} onPick={choose} onClose={() => setPicker(false)} />
      )}
    </div>
  );
}
