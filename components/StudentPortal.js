// ── Сурагчийн хэсэг ─────────────────────────────────────────────────────────
// Кодоороо нэвтэрсэн сурагч: Нүүр (ЭЕШ хүртэлх тоолуур, зорилгын ахиц), Шалгалт (бүх өгсөн шалгалт + онлайнаар өгөх),
// Сурах бичиг (admin-ий оруулсан 12-р ангийн PDF), Материал (багшийн ЭЕШ материал), Миний зорилго.
import { useState, useEffect } from 'react';
import { SEC1_CHOICES } from '../lib/eyesh';

const TOKEN_KEY = 'student_token';
const SUBJECTS = ['Математик', 'Физик', 'Хими', 'Биологи', 'Монгол хэл', 'Англи хэл', 'Орос хэл', 'Түүх', 'Газарзүй', 'Нийгмийн ухаан'];
const S2_OPTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '.'];
const ICON = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  exams: ['M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', 'M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z', 'M9 14l2 2 4-4'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  back: 'M15 18l-6-6 6-6',
  pdf: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 13h6', 'M9 17h4'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
  calendar: ['M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  plus: ['M12 5v14', 'M5 12h14'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
};
const TABS = [['home', 'Нүүр', ICON.home], ['exams', 'Шалгалт', ICON.exams], ['books', 'Сурах бичиг', ICON.book], ['materials', 'Материал', ICON.folder], ['goal', 'Зорилго', ICON.target]];

function Ico({ d, size = 22, sw = 2 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>;
}
function stoken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
async function sapi(path, opts = {}) {
  const r = await fetch(path, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + stoken() }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { const e = new Error(d.error || 'Кодоороо дахин нэвтэрнэ үү'); e.auth = true; throw e; }
  if (!r.ok) throw new Error(d.error || 'Алдаа гарлаа');
  return d;
}
const fmtDate = d => { const x = new Date(d); return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`; };
const daysTo = d => (d ? Math.ceil((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000) : null);
const fmtSize = n => (!n ? '' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const gradeColor = r => r?.grade?.c || 'var(--purple)';

// ── Нэвтрэх (зөвхөн /student хуудсанд; үндсэн апп өөрийн нэвтрэх дэлгэцтэй) ──
export function StudentLogin({ onLogin }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!code.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Код олдсонгүй');
      localStorage.setItem(TOKEN_KEY, d.token);
      localStorage.setItem('student_info', JSON.stringify(d.student));
      onLogin(d.student);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div className="sp-login">
      <div className="sp-card sp-login-card">
        <img src="/chick.svg" alt="" width={72} height={72} />
        <h1>Сурагчийн хэсэг</h1>
        <p>Багшийн өгсөн кодоороо нэвтэрнэ үү</p>
        {err && <div className="cm-alert">{err}</div>}
        <input className="sp-input sp-code" value={code} onChange={e => setCode(e.target.value.replace(/\s/g, ''))} onKeyDown={e => e.key === 'Enter' && go()}
          placeholder="Сурагчийн код" inputMode="numeric" autoFocus />
        <button className="cm-btn big" disabled={busy || !code.trim()} onClick={go}>{busy ? 'Нэвтэрч байна…' : 'Нэвтрэх'}</button>
      </div>
    </div>
  );
}

// ── Үндсэн хэсэг ──
export function StudentPortal({ onLogout }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('home');
  const [open, setOpen] = useState(null);      // дүнгийн дэлгэрэнгүй
  const [taking, setTaking] = useState(null);  // онлайнаар өгч буй шалгалт

  async function load() {
    try { setData(await sapi('/api/student/portal')); setErr(''); }
    catch (e) { if (e.auth) onLogout(); else setErr(e.message); }
  }
  useEffect(() => { load(); }, []);
  function go(t) { setTab(t); if (typeof window !== 'undefined') window.scrollTo(0, 0); }

  if (!data) return (
    <div className="sp-login">
      {err ? <div className="sp-card sp-login-card"><div className="cm-alert">{err}</div><button className="cm-btn big" onClick={load}>Дахин оролдох</button></div>
        : <div className="sp-spin" />}
    </div>
  );
  if (taking) return <TakeExam exam={taking} onBack={() => setTaking(null)} onDone={r => { setTaking(null); setOpen(r); load(); }} />;
  if (open) return <ResultDetail r={open} onBack={() => setOpen(null)} />;

  const s = data.student;
  return (
    <div className="sp">
      <header className="sp-top">
        <img src="/chick.svg" alt="" width={40} height={40} />
        <div className="sp-who"><b>{s.name || s.code}</b><span>{s.class ? s.class + ' · ' : ''}код {s.code}</span></div>
        <button className="sp-icon-btn" onClick={onLogout} aria-label="Гарах" title="Гарах"><Ico d={ICON.logout} size={20} /></button>
      </header>
      <main className="sp-main">
        {err && <div className="cm-alert">{err}</div>}
        {tab === 'home' && <Home data={data} onOpen={setOpen} go={go} />}
        {tab === 'exams' && <Exams data={data} onOpen={setOpen} onTake={setTaking} />}
        {tab === 'books' && <Files items={data.textbooks} title="12-р ангийн сурах бичиг" empty="Сурах бичиг хараахан нэмэгдээгүй байна." grouped />}
        {tab === 'materials' && <Files items={data.materials} title="ЭЕШ-ийн материал" empty="Багш тань материал хараахан оруулаагүй байна." />}
        {tab === 'goal' && <Goal data={data} onSaved={goals => setData(d => ({ ...d, goals }))} />}
      </main>
      <nav className="sp-tabbar">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={'sp-tab' + (tab === id ? ' on' : '')} onClick={() => go(id)}>
            <Ico d={icon} size={23} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Countdown({ date, big }) {
  const n = daysTo(date);
  if (n === null) return null;
  return (
    <div className={'sp-card sp-count' + (big ? ' big' : '')}>
      <span className="sp-count-ic"><Ico d={ICON.calendar} size={big ? 30 : 24} /></span>
      <div>
        {n > 0 ? <><b>{n}</b> өдөр</> : n === 0 ? <b>Өнөөдөр!</b> : <b>Дууссан</b>}
        <span>ЭЕШ хүртэл · {fmtDate(date + 'T00:00:00')}</span>
      </div>
    </div>
  );
}

function ResultRow({ r, onOpen }) {
  return (
    <button className="sp-card sp-res" onClick={() => onOpen(r)}>
      <div className="sp-res-sc" style={{ color: gradeColor(r) }}><b>{r.scaled}</b><span>{r.grade?.g || ''}</span></div>
      <div className="sp-res-t">
        <b>{r.examTitle}</b>
        <span>{r.examSubject || '—'} · {fmtDate(r.submittedAt)}{/онлайн/.test(r.version || '') ? ' · онлайн' : ''}</span>
        <i><em className="ok">✓ {r.correct}</em><em className="ng">✗ {r.wrong - r.blank}</em><em className="bl">○ {r.blank}</em></i>
      </div>
    </button>
  );
}

// Хичээл бүрийн хамгийн сүүлийн оноо ба зорилго
function latestBySubject(results) {
  const m = {};
  results.forEach(r => { const k = r.examSubject || '—'; if (!m[k] || new Date(r.submittedAt) > new Date(m[k].submittedAt)) m[k] = r; });
  return m;
}

function Home({ data, onOpen, go }) {
  const { results, exams, goals, eeshDate } = data;
  const latest = latestBySubject(results);
  const targets = Object.entries(goals.targets || {});
  return (
    <>
      <div className="sp-hello">
        <h1>Сайн уу, {data.student.name || data.student.code}! 👋</h1>
        <p>{results.length ? `Та нийт ${results.length} шалгалт өгсөн байна.` : 'Шалгалт өгмөгц дүн тань энд харагдана.'}</p>
      </div>
      <Countdown date={eeshDate} />
      {(goals.university || targets.length > 0) ? (
        <button className="sp-card sp-goalcard" onClick={() => go('goal')}>
          <div className="sp-sec-h"><b>Миний зорилго</b><span>Засах →</span></div>
          {goals.university && <div className="sp-uni">🎓 {goals.university}{goals.major ? ' · ' + goals.major : ''}</div>}
          {targets.map(([subj, target]) => <Progress key={subj} subject={subj} target={target} score={latest[subj]?.scaled} />)}
        </button>
      ) : (
        <button className="sp-card sp-cta" onClick={() => go('goal')}>
          <span className="sp-count-ic"><Ico d={ICON.target} /></span>
          <div><b>Зорилгоо тавь</b><span>Хичээл бүрийн зорилтот оноо, элсэх сургуулиа бичээрэй</span></div>
        </button>
      )}
      {exams.length > 0 && (
        <button className="sp-card sp-cta amber" onClick={() => go('exams')}>
          <span className="sp-count-ic"><Ico d={ICON.exams} /></span>
          <div><b>Өгөх шалгалт: {exams.length}</b><span>Онлайнаар хариултаа бөглөж өгнө</span></div>
        </button>
      )}
      {results.length > 0 && <>
        <div className="sp-sec-h"><b>Сүүлийн дүн</b><button onClick={() => go('exams')}>Бүгд →</button></div>
        {results.slice(0, 3).map(r => <ResultRow key={r.id} r={r} onOpen={onOpen} />)}
      </>}
    </>
  );
}

function Progress({ subject, target, score }) {
  const pct = score != null ? Math.min(100, Math.round(score / target * 100)) : 0;
  const done = score != null && score >= target;
  return (
    <div className="sp-prog">
      <div className="sp-prog-h"><b>{subject}</b><span>{score != null ? <><b style={{ color: done ? 'var(--green)' : 'var(--ink)' }}>{score}</b> / {target}</> : <>— / {target}</>}</span></div>
      <div className="sp-bar"><i style={{ width: pct + '%', background: done ? 'var(--green)' : 'var(--purple)' }} /></div>
    </div>
  );
}

function Exams({ data, onOpen, onTake }) {
  const subjects = [...new Set(data.results.map(r => r.examSubject).filter(Boolean))];
  const [subj, setSubj] = useState('');
  const list = data.results.filter(r => !subj || r.examSubject === subj);
  return (
    <>
      {data.exams.length > 0 && <>
        <div className="sp-sec-h"><b>Онлайнаар өгөх</b></div>
        {data.exams.map(e => (
          <div key={e.id} className="sp-card sp-exam">
            <div><b>{e.title}</b><span>{e.subject || '—'} · {e.sec1Count} тест{Object.keys(e.sec2).length ? ' · 2-р хэсэг' : ''}{e.variants ? ` · ${Object.keys(e.variants).join('/')} хувилбар` : ''}</span></div>
            <button className="cm-btn" onClick={() => onTake(e)}>Эхлэх</button>
          </div>
        ))}
      </>}
      <div className="sp-sec-h"><b>Өгсөн шалгалтууд</b><span>{data.results.length}</span></div>
      {subjects.length > 1 && (
        <div className="sp-chips">
          <button className={!subj ? 'on' : ''} onClick={() => setSubj('')}>Бүгд</button>
          {subjects.map(x => <button key={x} className={subj === x ? 'on' : ''} onClick={() => setSubj(x)}>{x}</button>)}
        </div>
      )}
      {list.length === 0 ? <div className="sp-empty">Одоогоор өгсөн шалгалт алга.</div> : list.map(r => <ResultRow key={r.id} r={r} onOpen={onOpen} />)}
    </>
  );
}

function ResultDetail({ r, onBack }) {
  const sec2 = Object.entries(r.sec2Results || {});
  return (
    <div className="sp">
      <header className="sp-top">
        <button className="sp-icon-btn" onClick={onBack} aria-label="Буцах"><Ico d={ICON.back} /></button>
        <div className="sp-who"><b>{r.examTitle}</b><span>{r.examSubject || '—'} · {fmtDate(r.submittedAt)}</span></div>
      </header>
      <main className="sp-main">
        <div className="sp-card sp-score">
          <div className="sp-ring" style={{ '--c': gradeColor(r), '--p': Math.min(100, r.scaled || 0) }}><b>{r.scaled}</b><span>ЭЕШ оноо</span></div>
          <div>
            <div className="sp-grade" style={{ color: gradeColor(r) }}>{r.grade?.g} · {r.grade?.l}</div>
            <div className="sp-raw">{r.rawEarned}/{r.rawMax} оноо</div>
            <i className="sp-cnt"><em className="ok">✓ {r.correct}</em><em className="ng">✗ {r.wrong - r.blank}</em><em className="bl">○ {r.blank}</em></i>
          </div>
        </div>
        <div className="sp-sec-h"><b>1-р хэсэг</b><span>зөв хариулт нь доор</span></div>
        <div className="sp-grid">
          {(r.sec1Results || []).map(q => (
            <div key={q.q} className={'sp-q ' + q.st}>
              <i>{q.q}</i><b>{q.sel === 'BLANK' ? '—' : q.sel}</b>{q.st !== 'ok' && q.key && q.key !== '?' && <s>{q.key}</s>}
            </div>
          ))}
        </div>
        {sec2.length > 0 && <>
          <div className="sp-sec-h"><b>2-р хэсэг</b></div>
          <div className="sp-grid">
            {sec2.flatMap(([sub, rows]) => Object.entries(rows || {}).map(([row, v]) => (
              <div key={sub + row} className={'sp-q ' + v.st}>
                <i>{sub}{row}</i><b>{v.sel === 'BLANK' ? '—' : v.sel}</b>{v.st !== 'ok' && v.key != null && <s>{v.key}</s>}
              </div>
            )))}
          </div>
        </>}
      </main>
    </div>
  );
}

function TakeExam({ exam, onBack, onDone }) {
  const [sec1, setSec1] = useState(() => Array(exam.sec1Count).fill(''));
  const [sec2, setSec2] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Олон хувилбартай шалгалт: сурагч материал дээрх хувилбараа сонгоно — тэр хувилбарын түлхүүрээр шалгагдана
  const vers = exam.variants ? Object.keys(exam.variants) : [];
  const [ver, setVer] = useState('');
  const rows2 = vers.length ? (exam.variants[ver] || {}) : exam.sec2;
  const filled = sec1.filter(Boolean).length;
  async function submit() {
    if (vers.length && !ver) { setErr('Эхлээд хувилбараа сонгоно уу'); window.scrollTo(0, 0); return; }
    const blank = exam.sec1Count - filled;
    if (!window.confirm(blank > 0 ? `${blank} асуулт хоосон байна. Илгээх үү? Дахин өгөх боломжгүй.` : 'Хариултаа илгээх үү? Дахин өгөх боломжгүй.')) return;
    setBusy(true); setErr('');
    try {
      const row = await sapi('/api/student/submit', { method: 'POST', body: { examId: exam.id, sec1, sec2, ...(vers.length ? { version: ver } : {}) } });
      onDone({ ...row, examTitle: exam.title, examSubject: exam.subject });
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <div className="sp">
      <header className="sp-top">
        <button className="sp-icon-btn" onClick={onBack} aria-label="Буцах"><Ico d={ICON.back} /></button>
        <div className="sp-who"><b>{exam.title}</b><span>{exam.subject || '—'} · бөглөсөн {filled}/{exam.sec1Count}</span></div>
      </header>
      <main className="sp-main">
        {vers.length > 0 && <>
          <div className="sp-sec-h"><b>Хувилбар</b>{!ver && <span>Материал дээрх хувилбараа сонгоно уу</span>}</div>
          <div className="sp-card sp-take">
            <div className="sp-take-row">
              {vers.map(L => <button key={L} className={ver === L ? 'on' : ''} onClick={() => { setVer(L); setErr(''); }}>{L}</button>)}
            </div>
          </div>
        </>}
        <div className="sp-sec-h"><b>1-р хэсэг</b></div>
        <div className="sp-card sp-take">
          {sec1.map((v, i) => (
            <div key={i} className="sp-take-row">
              <i>{i + 1}</i>
              {SEC1_CHOICES.map(c => (
                <button key={c} className={v === c ? 'on' : ''} onClick={() => setSec1(s => { const n = [...s]; n[i] = n[i] === c ? '' : c; return n; })}>{c}</button>
              ))}
            </div>
          ))}
        </div>
        {Object.entries(rows2).map(([sub, rows]) => (
          <div key={sub}>
            <div className="sp-sec-h"><b>{sub}</b></div>
            <div className="sp-card sp-take">
              {rows.map(row => (
                <div key={row} className="sp-take-row s2">
                  <i>{row}</i>
                  {S2_OPTS.map(o => (
                    <button key={o} className={sec2[sub]?.[row] === o ? 'on' : ''}
                      onClick={() => setSec2(s => ({ ...s, [sub]: { ...(s[sub] || {}), [row]: s[sub]?.[row] === o ? '' : o } }))}>{o}</button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        {err && <div className="cm-alert">{err}</div>}
        <button className="cm-btn big sp-submit" disabled={busy} onClick={submit}>{busy ? 'Илгээж байна…' : 'Хариултаа илгээх'}</button>
      </main>
    </div>
  );
}

function Files({ items, title, empty, grouped }) {
  const groups = {};
  items.forEach(m => { const k = grouped ? (m.subject || 'Бусад') : ''; (groups[k] = groups[k] || []).push(m); });
  return (
    <>
      <div className="sp-hello"><h1>{title}</h1></div>
      {items.length === 0 && <div className="sp-empty">{empty}</div>}
      {Object.entries(groups).map(([g, list]) => (
        <div key={g}>
          {g && <div className="sp-sec-h"><b>{g}</b><span>{list.length}</span></div>}
          {list.map(m => {
            const isPdf = /\.pdf($|\?)/i.test(m.url) || /vercel-storage\.com|\/uploads\//.test(m.url);
            return (
              <a key={m.id} className="sp-card sp-file" href={m.url} target="_blank" rel="noopener noreferrer">
                <span className={'sp-file-ic' + (isPdf ? '' : ' link')}><Ico d={isPdf ? ICON.pdf : ICON.link} /></span>
                <div><b>{m.title}</b><span>{[!grouped && m.subject, fmtSize(m.size), fmtDate(m.createdAt)].filter(Boolean).join(' · ')}</span></div>
                <em>Нээх</em>
              </a>
            );
          })}
        </div>
      ))}
    </>
  );
}

// Тухайн хичээлийн оноо цаг хугацаагаар + зорилтот шугам
function Trend({ points, target }) {
  if (points.length < 2) return null;
  const W = 300, H = 70, max = 100;
  const x = i => 6 + i * (W - 12) / (points.length - 1);
  const y = v => H - 6 - (v / max) * (H - 12);
  return (
    <svg className="sp-trend" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {target && <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="var(--green)" strokeDasharray="5 5" strokeWidth="1.5" />}
      <polyline fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinejoin="round" points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      {points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--purple)" />)}
    </svg>
  );
}

function Goal({ data, onSaved }) {
  const [targets, setTargets] = useState(() => ({ ...(data.goals.targets || {}) }));
  const [university, setUniversity] = useState(data.goals.university || '');
  const [major, setMajor] = useState(data.goals.major || '');
  const [add, setAdd] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const latest = latestBySubject(data.results);
  const available = [...new Set([...SUBJECTS, ...data.results.map(r => r.examSubject).filter(Boolean)])].filter(x => !(x in targets));
  async function save() {
    setBusy(true); setMsg('');
    try { onSaved(await sapi('/api/student/goals', { method: 'PUT', body: { targets, university, major } })); setMsg('Хадгаллаа ✓'); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  return (
    <>
      <div className="sp-hello"><h1>Миний зорилго</h1><p>Зорилтот оноо нь шалгалтын ЭЕШ оноотой ижил (100 хүртэл).</p></div>
      {data.eeshDate ? <Countdown date={data.eeshDate} big /> : <div className="sp-empty small">ЭЕШ-ийн огноо хараахан оруулаагүй байна.</div>}
      <div className="sp-card sp-form">
        <label>Элсэх сургууль<input className="sp-input" value={university} onChange={e => setUniversity(e.target.value)} placeholder="Жишээ нь: МУИС" maxLength={200} /></label>
        <label>Мэргэжил<input className="sp-input" value={major} onChange={e => setMajor(e.target.value)} placeholder="Жишээ нь: Программ хангамж" maxLength={200} /></label>
      </div>
      <div className="sp-sec-h"><b>Хичээлийн зорилтот оноо</b></div>
      {Object.entries(targets).map(([subj, t]) => {
        const pts = data.results.filter(r => r.examSubject === subj).sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)).map(r => r.scaled);
        return (
          <div key={subj} className="sp-card sp-target">
            <div className="sp-target-h">
              <b>{subj}</b>
              <input className="sp-input sp-num" type="number" min={1} max={100} value={t}
                onChange={e => setTargets(x => ({ ...x, [subj]: e.target.value === '' ? '' : Math.max(1, Math.min(100, Number(e.target.value))) }))} />
              <button className="sp-icon-btn" onClick={() => setTargets(x => { const n = { ...x }; delete n[subj]; return n; })} aria-label="Хасах"><Ico d={ICON.x} size={18} /></button>
            </div>
            <Progress subject="Сүүлийн дүн" target={Number(t) || 100} score={latest[subj]?.scaled} />
            <Trend points={pts} target={Number(t) || null} />
          </div>
        );
      })}
      <div className="sp-add">
        <select className="sp-input" value={add} onChange={e => setAdd(e.target.value)}>
          <option value="">Хичээл сонгох…</option>
          {available.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <button className="cm-btn" disabled={!add} onClick={() => { setTargets(x => ({ ...x, [add]: 80 })); setAdd(''); }}><Ico d={ICON.plus} size={18} /> Нэмэх</button>
      </div>
      {msg && <div className={msg.endsWith('✓') ? 'sp-ok' : 'cm-alert'}>{msg}</div>}
      <button className="cm-btn big sp-submit" disabled={busy} onClick={save}>{busy ? 'Хадгалж байна…' : 'Хадгалах'}</button>
    </>
  );
}

// /student хуудас: нэвтрээгүй бол кодоор нэвтрэнэ
export default function StudentApp() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => { setAuthed(!!stoken()); setReady(true); }, []);
  function logout() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('student_info'); } catch (e) {} setAuthed(false); }
  if (!ready) return null;
  return authed ? <StudentPortal onLogout={logout} /> : <StudentLogin onLogin={() => setAuthed(true)} />;
}
