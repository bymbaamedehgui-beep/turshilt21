// ── «Эхлэх заавар»: шинэ багшийг алхам алхмаар хөтөлнө (pages/index.js) ─────────────
// Тавтай морил → 1 Шалгалт үүсгэх → 2 Сурагч нэмэх → 3 Хуудас хэвлэх → 4 Утсаар шалгах → Бэлэн.
// Алхам бүр дээр дарах газрыг тодруулж, сумаар заана; карт дээр тэр алхмын 5–10 секундийн бичлэг (public/tour/*.mp4) эргэлдэнэ.
// Дарах газар нь хуудаснаас хамаарна: элементүүд data-tour="…" тэмдэгтэй, эхний харагдаж буйг нь авна.
// Алхам дууссаныг өгөгдлөөс таньна: шалгалт бий, сурагчийн бүртгэл бий (eyesh:accounts үзэгдэл), хэвлэсэн (beforeprint),
// уншуулсан дүн бий. Хаасан, хэвлэсэн, алгассан алхам — localStorage-д багш бүрээр. Анх нэвтрэхэд (дүн хараахан алгаа үед)
// өөрөө нээгдэнэ; ☰ «Эхлэх заавар»-аас дахин нээнэ.
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/eyesh';

const STEPS = [
  { key: 'exam', title: 'Шалгалтаа үүсгэнэ', video: '/tour/1-exam.mp4', poster: '/tour/1-exam.jpg' },
  { key: 'students', title: 'Сурагчдаа нэмнэ', video: '/tour/2-students.mp4', poster: '/tour/2-students.jpg' },
  { key: 'print', title: 'Хариултын хуудсаа хэвлэнэ', video: '/tour/3-print.mp4', poster: '/tour/3-print.jpg' },
  { key: 'scan', title: 'Утсаараа шалгана', video: '/tour/4-scan.mp4', poster: '/tour/4-scan.jpg' },
];
const ARROW = 'M12 3v15M5 12l7 7 7-7';

// Алхам бүрийн заавар тухайн хуудсанд: аль элементийг заах (эхний харагдаж буй нь), юу хийх; alt — олдсон элементээс
// хамаарах өөр текст
function guide(step, page, menuOpen) {
  const viaMenu = (label, id) => menuOpen
    ? { targets: ['nav-' + id], text: `«${label}»-ыг сонгоно.` }
    : { targets: ['menu'], text: `☰ цэсийг нээгээд «${label}»-ыг сонгоно.` };
  const scanMenu = { menu: '☰ цэсийг нээгээд «Шалгах»-ыг сонгоно.' };
  switch (step) {
    case 'exam':
      if (page === 'create') return { targets: [], text: 'Шалгалтын нэр, хичээл, дасгалын тоог оруулаад тест бүрийн зөв хариултыг сонгоно. Дуусаад доод талын «Шалгалт хадгалах»-ыг дарна.' };
      if (page === 'home' && !menuOpen) return { targets: ['hero-create'], text: '«+ Шалгалт үүсгэх» дээр дарна.' };
      return viaMenu('Шалгалт үүсгэх', 'create');
    case 'students':
      if (page === 'students') return { targets: ['students-add'], text: 'Нэг нэгээр нь, эсвэл «Олноор нэмэх» хэсэгт мөр бүрт «Нэр, Анги» гэж бичээд «Бүгдийг нэмэх» дарна. Сурагч бүрт код автоматаар үүснэ.' };
      return viaMenu('Сурагчид', 'students');
    case 'print':
      if (page === 'sheets') return { targets: ['sheets-print'], text: '«Ангиар нэрлэсэн»-ийг сонговол сурагч бүрийн нэр, код хуудсан дээр хэвлэгдэнэ. «Хэвлэх» дарж A4 цаасан дээр 100%-иар хэвлэнэ.' };
      if (page === 'home' && !menuOpen) return { targets: ['card-sheets'], text: 'Шалгалтын карт дээрх «Хуудас хэвлэх»-ийг дарна.' };
      return viaMenu('Хуудас хэвлэх', 'sheets');
    case 'scan':
      if (page === 'scan') return { targets: ['scan-camera', 'scan-pick'], alt: { 'scan-pick': 'Шалгах шалгалтаа сонгоно.' },
        text: 'Сурагчид бөглөсний дараа «Камераар шалгах»-ыг дарж хуудсыг утсаараа харуулна. 6 хар дөрвөлжин дэлгэцэнд багтмагц өөрөө уншиж, оноог гаргана.' };
      if (page === 'home' && !menuOpen) return { targets: ['card-scan', 'tab-scan'], text: 'Шалгалтын карт дээрх «Шалгах»-ыг дарна.' };
      if (menuOpen) return { targets: ['nav-scan'], text: '«Шалгах»-ыг сонгоно.' };
      return { targets: ['sheets-scan', 'tab-scan', 'menu'], alt: scanMenu, text: '«Шалгах»-ыг дарна.' };
    default:
      return { targets: [], text: '' };
  }
}

function findTarget(keys) {
  for (const k of keys) {
    for (const el of document.querySelectorAll(`[data-tour="${k}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
    }
  }
  return null;
}
const load = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } };
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} };

export function Tour({ teacherId, ready, page, menuOpen, examCount, sheetCount, reopen }) {
  const KEY = 'eyesh_tour:' + (teacherId || '');
  const [st, setSt] = useState(null);           // { state:'welcome'|'on'|'off'|'done', printed, skip:[] }
  const [accounts, setAccounts] = useState(null);
  const [mini, setMini] = useState(false);       // карт эвхэгдсэн (сум, тодруулга үлдэнэ)
  const [geo, setGeo] = useState(null);          // { rect, vw, vh, hidden }
  const [reduce, setReduce] = useState(false);
  const scrolled = useRef('');

  // Эхлэх: хадгалсан төлөв, эсвэл дүн хараахан алга бол «Тавтай морил»
  useEffect(() => {
    if (!ready || !teacherId) return;
    const s = load(KEY);
    setSt(s || (sheetCount === 0 ? { state: 'welcome', printed: false, skip: [] } : { state: 'off', printed: false, skip: [] }));
  }, [ready, teacherId]);
  useEffect(() => { if (st) save(KEY, st); }, [st]);
  // ☰ «Эхлэх заавар»
  const firstReopen = useRef(reopen);
  useEffect(() => {
    if (reopen === firstReopen.current) return;
    setSt(s => ({ printed: false, skip: [], ...(s || {}), state: 'welcome' })); setMini(false);
  }, [reopen]);
  useEffect(() => {
    try { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); setReduce(m.matches); } catch (e) {}
  }, []);

  const active = !!st && (st.state === 'welcome' || st.state === 'on');
  // Сурагчийн бүртгэлийн тоо: идэвхтэй үед нэг удаа асууна, дараа нь хуудсууд eyesh:accounts-аар мэдэгдэнэ
  useEffect(() => {
    if (!active) return;
    const on = e => setAccounts(Number(e.detail?.count) || 0);
    window.addEventListener('eyesh:accounts', on);
    if (accounts === null) apiFetch('/api/student-accounts').then(a => setAccounts(Array.isArray(a) ? a.length : 0)).catch(() => {});
    return () => window.removeEventListener('eyesh:accounts', on);
  }, [active]);

  const done = {
    exam: examCount > 0,
    students: (accounts || 0) > 0,
    print: !!st?.printed || sheetCount > 0,
    scan: sheetCount > 0,
  };
  const skipped = k => !!st?.skip?.includes(k);
  const cur = STEPS.findIndex(s => !done[s.key] && !skipped(s.key));
  const step = cur >= 0 ? STEPS[cur] : null;

  // Хэвлэх цонх нээгдэв — 3-р алхам болсон
  useEffect(() => {
    if (!active || step?.key !== 'print') return;
    const on = () => setSt(s => ({ ...s, printed: true }));
    window.addEventListener('beforeprint', on);
    return () => window.removeEventListener('beforeprint', on);
  }, [active, step?.key]);
  // Шинэ алхам — картыг дахин дэлгэнэ
  useEffect(() => { setMini(false); }, [step?.key]);
  // Бүх алхам дууссан — «Бэлэн» карт
  const finished = st?.state === 'on' && !step;

  const g = active && st.state === 'on' && step ? guide(step.key, page, menuOpen) : { targets: [] };
  const tkey = g.targets.join('|');
  // Заах элементийн байрлалыг дагана (гүйлгэх, цэс нээгдэх, хэмжээ өөрчлөгдөх)
  useEffect(() => {
    if (!active) { setGeo(null); return; }
    let raf, last = '';
    const tick = () => {
      const el = tkey ? findTarget(g.targets) : null;
      const r = el && el.getBoundingClientRect();
      const hidden = document.body.classList.contains('qs-lock');
      const k = (r ? [r.left, r.top, r.width, r.height].map(Math.round).join(',') : '-') + (hidden ? 'h' : '') + innerWidth + 'x' + innerHeight;
      if (k !== last) {
        last = k;
        setGeo({ rect: r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null, key: el ? el.dataset.tour : '',
          side: !!(el && el.closest('.cm-drawer')), vw: innerWidth, vh: innerHeight, hidden });
        const sk = tkey + '@' + page;
        if (el && scrolled.current !== sk) {
          scrolled.current = sk;
          if (r.top < 70 || r.bottom > innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, tkey, page]);

  if (!active || !geo || geo.hidden) return null;
  const close = () => setSt(s => ({ ...s, state: 'off' }));
  const narrow = geo.vw <= 760;   // доод таб мөр гарах өргөн (styles/cm.css)

  // ── Тавтай морил ──
  if (st.state === 'welcome') return (
    <div className="tour-dim" role="presentation">
      <div className="tour-card tour-welcome" role="dialog" aria-modal="true" aria-labelledby="tour-wt">
        <img src="/chick.svg" alt="" width={56} height={56} />
        <h2 id="tour-wt">Тавтай морил!</h2>
        <p>Хариултын хуудсаа утсаараа шалгахын тулд 4 алхам хийнэ. Алхам бүрийг хаана дарахыг сумаар зааж, богино бичлэгээр үзүүлнэ.</p>
        <ol className="tour-list">
          {STEPS.map((s, i) => <li key={s.key} className={done[s.key] ? 'ok' : ''}><b>{done[s.key] ? '✓' : i + 1}</b>{s.title}</li>)}
        </ol>
        <div className="tour-btns">
          <button className="cm-btn ghost" onClick={close}>Дараа</button>
          <button className="cm-btn" onClick={() => setSt(s => ({ ...s, state: 'on' }))}>Эхлэх</button>
        </div>
      </div>
    </div>
  );

  // ── Бэлэн ──
  if (finished) return (
    <div className="tour-dim" role="presentation">
      <div className="tour-card tour-welcome" role="dialog" aria-modal="true" aria-labelledby="tour-dt">
        <div className="tour-big" aria-hidden="true">🎉</div>
        <h2 id="tour-dt">Бэлэн боллоо!</h2>
        <p>Уншуулсан хуудсуудын дүн «Жагсаалт», «Анализ», «Рейтинг» хэсэгт шууд гарна. Сурагчид <b>/student</b> хуудсаар кодоороо орж дүнгээ харна.</p>
        <div className="tour-btns"><button className="cm-btn" onClick={() => setSt(s => ({ ...s, state: 'done' }))}>Дуусгах</button></div>
      </div>
    </div>
  );

  // ── Алхам: тодруулга + сум + карт ──
  const R = geo.rect, pad = 6;
  const hole = R && { left: R.left - pad, top: R.top - pad, width: R.width + pad * 2, height: R.height + pad * 2 };
  // Сум: ☰ цэсний мөрийг зүүн талаас (дээд мөрийг дарахгүй), бусдыг доороос (дээш) эсвэл дээрээс (доош) заана
  const dir = !R ? '' : geo.side ? 'right' : R.top + R.height / 2 < geo.vh * 0.42 ? 'up' : 'down';
  const ax = !R ? 0 : dir === 'right' ? Math.max(24, R.left - pad - 26) : Math.min(geo.vw - 30, Math.max(30, R.left + R.width / 2));
  const ay = !R ? 0 : dir === 'right' ? R.top + R.height / 2 - 22 : dir === 'up' ? R.top + R.height + pad + 4 : R.top - pad - 50;
  // Карт: утсанд дээд/доод талд (заасан элементийн эсрэг тал), том дэлгэцэнд баруун доод буланд (давхцвал зүүн доод)
  const targetLow = R && R.top + R.height / 2 > geo.vh / 2;
  const cardSide = narrow ? (targetLow ? 'top' : 'bottom') : (R && R.left + R.width > geo.vw - 380 && R.top + R.height > geo.vh - 440 ? 'left' : 'right');
  return (
    <>
      {hole && <div className={'tour-hole' + (mini ? ' mini' : '')} style={hole} aria-hidden="true" />}
      {!hole && !mini && <div className="tour-dim soft" aria-hidden="true" />}
      {R && (
        <div className={'tour-arrow ' + dir} style={{ left: ax - 22, top: ay }} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="44" height="44" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={ARROW} stroke="#1c1f2a" strokeWidth="5.5" /><path d={ARROW} stroke="#FFC113" strokeWidth="3" />
          </svg>
        </div>
      )}
      {mini ? (
        <button className={'tour-pill ' + (narrow ? 'n' : '')} onClick={() => setMini(false)} aria-label="Зааврыг дэлгэх">
          <b>{cur + 1}/{STEPS.length}</b>{step.title}<i>▴</i>
        </button>
      ) : (
        <div className={`tour-card tour-step ${narrow ? 'n ' + cardSide : 'w ' + cardSide}`} role="dialog" aria-modal="false" aria-labelledby="tour-st">
          <div className="tour-h">
            <span className="tour-dots" aria-label={`Алхам ${cur + 1}/${STEPS.length}`}>
              {STEPS.map((s, i) => <i key={s.key} className={done[s.key] || skipped(s.key) ? 'ok' : i === cur ? 'on' : ''} />)}
            </span>
            <b id="tour-st">{cur + 1}. {step.title}</b>
            <button className="tour-x" onClick={close} aria-label="Зааврыг хаах" title="Хаах — ☰ «Эхлэх заавар»-аас дахин нээнэ">×</button>
          </div>
          <video key={step.video} className="tour-video" src={step.video} poster={step.poster} muted loop playsInline autoPlay={!reduce} controls={reduce}
            preload="auto" aria-label={step.title + ' — богино бичлэг'} onError={e => { e.currentTarget.style.display = 'none'; }} />
          <p className="tour-text">{(g.alt && g.alt[geo.key]) || g.text}</p>
          <div className="tour-btns">
            <button className="cm-link" onClick={() => setSt(s => {
              // үлдсэн алхамгүй болбол — дүн гарсан бол «Бэлэн», үгүй бол зүгээр хаана
              const skip = [...(s.skip || []), step.key];
              const left = STEPS.some(x => !done[x.key] && !skip.includes(x.key));
              return { ...s, skip, state: left ? 'on' : done.scan ? 'on' : 'off' };
            })}>Алгасах</button>
            <button className="cm-btn" onClick={() => setMini(true)}>Ойлголоо</button>
          </div>
        </div>
      )}
    </>
  );
}
