import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/eyesh';
import { sheetLayout, MARKERS, MARK, ORIENT, TAG, PAGE_W, PAGE_H, S1_MAX, S1_ROWS, S1_POS, S2_POS, S2_OPTS,
  S2_ROWS, ID_POS, VER_POS, s1RowY } from '../lib/omr';

// ── Хэвлэх хариултын хуудас (A4, мм нэгжтэй SVG) ───────────────────────────
// ЭЕШ-ийн хуудасны загвар. Улаан/ягаан өнгө нь уншигчийн улаан сувагт алга болдог («dropout»),
// хар-цагаан хэвлэхэд ч дугуйн доторх үсэг (HINT) хангалттай цайвар тул будалт гэж уншигдахгүй.
// lib/omr.js-ийн sheetLayout-ыг уншигчтай хуваалцдаг — байрлал нь яг таарна.
const INK = '#111';
const RED = '#E53935';     // гарчиг, дугаар, хүрээ (дугуйн гадна)
const RING = '#EC6F73';    // дугуйн хүрээ
const HINT = '#F4A3A5';    // дугуйн доторх үсэг — цайвар байх ёстой
const SHADE = '#FDE7E7';
const FONT = "'Segoe UI', Arial, sans-serif";

function Bubble({ x, y, r, label, filled }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={filled ? INK : '#fff'} stroke={filled ? INK : RING} strokeWidth={0.28} />
      {!filled && <text x={x} y={y + r*0.4} textAnchor="middle" fontSize={r*1.1} fontWeight={700} fill={HINT}>{label}</text>}
    </g>
  );
}

// САНАМЖ-ийн жишээ дугуй (уншигдахгүй хэсэг)
function Mini({ x, y, r = 1.2, label, mark }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={mark === 'fill' ? '#333' : '#fff'} stroke={mark === 'ring' ? '#333' : RING} strokeWidth={mark === 'ring' ? 0.45 : 0.22} />
      {mark !== 'fill' && <text x={x} y={y + r*0.4} textAnchor="middle" fontSize={r*1.05} fontWeight={700} fill={HINT}>{label}</text>}
      {mark === 'x' && <path d={`M${x-r} ${y-r}L${x+r} ${y+r}M${x+r} ${y-r}L${x-r} ${y+r}`} stroke="#333" strokeWidth={0.4} />}
      {mark === 'dot' && <circle cx={x} cy={y} r={r*0.35} fill="#333" />}
      {mark === 'tick' && <path d={`M${x-r} ${y}L${x-r*0.2} ${y+r*0.9}L${x+r*1.4} ${y-r*1.2}`} stroke="#333" strokeWidth={0.45} fill="none" />}
      {mark === 'scrib' && <path d={`M${x-r*0.9} ${y+r*0.2}q${r*0.5} ${-r} ${r} 0t${r} 0`} stroke="#333" strokeWidth={0.7} fill="none" />}
      {mark === 'half' && <path d={`M${x} ${y-r}A${r} ${r} 0 0 1 ${x} ${y+r}Z`} fill="#333" />}
    </g>
  );
}

function Box({ x, y, w, h, title, titleH = 5, fs = titleH * 0.62 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="#fff" stroke={RED} strokeWidth={0.4} />
      {title && <>
        <path d={`M${x} ${y+titleH}V${y+2}a2 2 0 0 1 2 -2H${x+w-2}a2 2 0 0 1 2 2V${y+titleH}Z`} fill={RED} />
        <text x={x + w/2} y={y + titleH - 1.5} textAnchor="middle" fontSize={fs} fontWeight={900} fill="#fff">{title}</text>
      </>}
    </g>
  );
}

export function AnswerSheetSVG({ exam, student, className, style }) {
  const L = useMemo(() => sheetLayout(exam), [exam]);
  const code = student && /^\d{1,10}$/.test(String(student.code || '')) ? String(student.code) : '';
  const byKind = k => L.groups.filter(g => g.kind === k);
  const s1 = byKind('s1');
  const title = (exam?.title || '').slice(0, 64);
  const wrong = [['x', 3], ['dot', 2], ['ring', 1], ['tick', 2], ['scrib', 3], ['two', 0], ['half', 3]];
  return (
    <svg className={className} style={style} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} width={PAGE_W + 'mm'} height={PAGE_H + 'mm'}
      xmlns="http://www.w3.org/2000/svg" fontFamily={FONT}>
      <rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill="#fff" />
      {Object.values(MARKERS).map(([cx, cy], i) => (
        <rect key={i} x={cx - MARK/2} y={cy - MARK/2} width={MARK} height={MARK} fill={INK} />
      ))}
      <rect x={ORIENT.x} y={ORIENT.y} width={ORIENT.s} height={ORIENT.s} fill={INK} />
      {Array.from({ length: TAG.n }, (_, i) => (L.tag >> i) & 1
        ? <rect key={i} x={TAG.x0 + i*TAG.step} y={TAG.y} width={TAG.s} height={TAG.s} fill={INK} /> : null)}

      {/* Гарчиг + нэр */}
      <text x={105} y={20.5} textAnchor="middle" fontSize={6.6} fontWeight={900} fill={RED}>ХАРИУЛТЫН ХУУДАС</text>
      <text x={20} y={26} fontSize={2.6} fontWeight={700} fill={RED}>Овог нэр:</text>
      <line x1={33} y1={26.4} x2={118} y2={26.4} stroke={RED} strokeWidth={0.2} />
      {student?.name && <text x={35} y={25.6} fontSize={3.3} fontWeight={800} fill={INK}>{student.name}</text>}
      <text x={121} y={26} fontSize={2.6} fontWeight={700} fill={RED}>Анги:</text>
      <line x1={129} y1={26.4} x2={152} y2={26.4} stroke={RED} strokeWidth={0.2} />
      {student?.class && <text x={131} y={25.6} fontSize={3.1} fontWeight={800} fill={INK}>{student.class}</text>}
      <text x={155} y={26} fontSize={2.6} fontWeight={700} fill={RED}>Огноо:</text>
      <line x1={164} y1={26.4} x2={190} y2={26.4} stroke={RED} strokeWidth={0.2} />

      {/* САНАМЖ */}
      <Box x={20} y={29} w={72} h={56} title="САНАМЖ" titleH={6} />
      {[['1. Хариултын хуудсыг нугалж, гэмтээж болохгүй', 40],
        ['2. Шалгалтын хувилбар хариултын хуудасны', 45], ['    хувилбартай таарч буй эсэхийг шалгана уу', 48.4],
        ['3. Зөвхөн харандаа эсвэл хар үзгээр тод,', 53.4], ['    засваргүй дараах байдлаар бөглөнө үү', 56.8],
      ].map(([t, y]) => <text key={y} x={23} y={y} fontSize={2.35} fontWeight={700} fill={RED}>{t}</text>)}
      <text x={23} y={62.4} fontSize={2.35} fontWeight={700} fill={RED}>1-р хэсгийн зөв хариулт:</text>
      <text x={62} y={63.2} textAnchor="end" fontSize={2.4} fontWeight={800} fill={RED}>1</text>
      {['A','B','C','D','E'].map((v, j) => <Mini key={v} x={65 + j*4.6} y={62.4} r={1.5} label={v} mark={v === 'B' ? 'fill' : null} />)}
      <text x={23} y={68.2} fontSize={2.35} fontWeight={700} fill={RED}>2-р хэсэг: 2.1-ийн хариулт a=2, b=7 бол</text>
      <rect x={23} y={70.2} width={66} height={12.4} rx={1.6} fill={SHADE} stroke={RED} strokeWidth={0.25} />
      {[['a', '2', 73.4], ['b', '7', 79.4]].map(([row, val, y]) => (
        <g key={row}>
          <text x={25.6} y={y + 0.9} textAnchor="middle" fontSize={2.4} fontWeight={800} fill={RED}>{row}</text>
          {S2_OPTS.map((v, k) => <Mini key={v} x={30 + k*5.0} y={y} r={1.3} label={v} mark={v === val ? 'fill' : null} />)}
        </g>
      ))}

      {/* Анхаарах зүйлс */}
      <text x={110} y={33} textAnchor="middle" fontSize={2.6} fontWeight={900} fill={RED}>Хариултын</text>
      <text x={110} y={36.2} textAnchor="middle" fontSize={2.6} fontWeight={900} fill={RED}>хуудас бөглөхөд</text>
      <text x={110} y={39.4} textAnchor="middle" fontSize={2.6} fontWeight={900} fill={RED}>анхаарах зүйлс</text>
      {[...wrong, ['ok', 0]].map(([m, at], i) => {
        const y = 44.6 + i*5.1;
        return (
          <g key={i}>
            <rect x={94} y={y - 2.1} width={31} height={4.2} rx={1} fill={SHADE} />
            <text x={95} y={y + 0.8} fontSize={2.2} fontWeight={800} fill={m === 'ok' ? INK : RED}>{m === 'ok' ? 'Зөв' : 'Буруу'}</text>
            {['A','B','C','D','E'].map((v, j) => {
              const mk = m === 'ok' ? (j === 0 ? 'fill' : null) : m === 'two' ? (j === 1 || j === 2 ? 'fill' : null) : (j === at ? m : null);
              return <Mini key={v} x={106 + j*3.6} y={y} r={1.25} label={v} mark={mk} />;
            })}
          </g>
        );
      })}

      {/* Хувилбар */}
      <Box x={128} y={29} w={12} h={56} title="ХУВИЛБАР" titleH={5} fs={1.75} />
      {byKind('ver')[0].options.map(o => <Bubble key={o.v} x={o.x} y={o.y} r={VER_POS.r} label={o.v} />)}

      {/* Хяналтын хэсэг = сурагчийн код */}
      <Box x={142} y={29} w={48} h={56} title="ХЯНАЛТЫН ХЭСЭГ" titleH={5} />
      {Array.from({ length: 10 }, (_, k) => k % 2 === 1 &&
        <rect key={k} x={ID_POS.x + k*ID_POS.dx - 2.3} y={34.6} width={4.6} height={46.4} fill={SHADE} />)}
      {byKind('id').map(g => g.options.map(o => (
        <Bubble key={g.id + o.v} x={o.x} y={o.y} r={g.r} label={o.v} filled={code[g.col] === o.v} />
      )))}
      <text x={166} y={83.6} textAnchor="middle" fontSize={2} fontWeight={700} fill={RED}>сурагчийн код (зүүнээс эхэлж бөглөнө)</text>

      {/* 1-р хэсэг */}
      <text x={20} y={92} fontSize={3.8} fontWeight={900} fill={RED}>1-Р ХЭСЭГ</text>
      {title && <text x={46} y={92} fontSize={2.4} fontWeight={700} fill="#9a5a5a">{title}</text>}
      {L.s1Count === 0 && <text x={20} y={100} fontSize={2.8} fill={RED}>Энэ шалгалтад 1-р хэсэг байхгүй</text>}
      {[0, 1].map(c => Array.from({ length: S1_ROWS / 2 }, (_, p) => {
        const first = c * S1_ROWS + p * 2;
        if (first >= L.s1Count || p % 2) return null;
        const y1 = s1RowY(p*2), y2 = s1RowY(Math.min(p*2 + 1, S1_ROWS - 1));
        const x0 = S1_POS.x0 + c * S1_POS.colW;
        return <rect key={c + '-' + p} x={x0 + 7.6} y={y1 - 2.5} width={28.4} height={(first + 1 < L.s1Count ? y2 : y1) - y1 + 5} rx={1.4} fill={SHADE} />;
      }))}
      {s1.map(g => (
        <g key={g.id}>
          <text x={g.labelX} y={g.y + 1} textAnchor="end" fontSize={2.7} fontWeight={800} fill={RED}>{g.q}</text>
          {g.options.map(o => <Bubble key={o.v} x={o.x} y={o.y} r={g.r} label={o.v} />)}
        </g>
      ))}

      {/* 2-р хэсэг */}
      {L.s2.length > 0 && <text x={S2_POS.x} y={92} fontSize={3.8} fontWeight={900} fill={RED}>2-Р ХЭСЭГ</text>}
      {L.s2.map(b => {
        const last = S2_ROWS.indexOf(b.rows[b.rows.length - 1]);
        const top = b.y0 + 4.6, bottom = b.y0 + S2_POS.rowY + last * S2_POS.pitch + 3;
        return (
          <g key={b.sub}>
            <text x={S2_POS.x} y={b.y0 + 3.4} fontSize={3.2} fontWeight={900} fill={RED}>{b.sub}</text>
            <rect x={S2_POS.x} y={top} width={S2_POS.w} height={bottom - top} rx={2} fill="#fff" stroke={RED} strokeWidth={0.4} />
            {S2_OPTS.map((_, k) => k % 2 === 0 &&
              <rect key={k} x={S2_POS.ox + k*S2_POS.dx - 2.6} y={top + 0.6} width={5.2} height={bottom - top - 1.2} fill={SHADE} />)}
          </g>
        );
      })}
      {byKind('s2').map(g => (
        <g key={g.id}>
          <text x={g.labelX} y={g.y + 0.9} textAnchor="middle" fontSize={2.7} fontWeight={800} fill={RED}>{g.row}</text>
          {g.options.map(o => <Bubble key={o.v} x={o.x} y={o.y} r={g.r} label={o.v} />)}
        </g>
      ))}

      <text x={20} y={270.5} fontSize={3.4} fontWeight={900} fill="#7B52EE">CyberMath</text>
      <text x={20} y={274.6} fontSize={2.2} fontWeight={700} fill="#6b7280">ЭЕШ шалгагч · eyeshcheck.com · Дасгалын төв</text>
    </svg>
  );
}

// ── Хуудас хэвлэх хуудас ────────────────────────────────────────────────────
export function SheetsPage({ exam, onNavigate, dark: d = false }) {
  const [mode, setMode] = useState('blank');     // 'blank' | 'class'
  const [copies, setCopies] = useState(30);
  const [accounts, setAccounts] = useState([]);
  const [cls, setCls] = useState('');

  useEffect(() => { apiFetch('/api/student-accounts').then(setAccounts).catch(() => {}); }, []);
  const classes = [...new Set(accounts.map(a => a.class || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'mn', { numeric: true }));
  useEffect(() => { if (!cls && classes.length) setCls(classes[0]); }, [classes.length]);

  if (!exam) return (
    <div className="cm-page"><div className="cm-card cm-empty">
      <div className="cm-empty-t">Эхлээд шалгалт сонгоно уу</div>
      <button className="cm-btn" onClick={() => onNavigate('home')}>Шалгалтууд руу</button>
    </div></div>
  );
  const tooMany = (exam.sec1Count || 0) > S1_MAX;
  const students = mode === 'class'
    ? accounts.filter(a => (a.class || '') === cls).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'mn'))
    : Array.from({ length: Math.max(1, Math.min(200, +copies || 1)) }, () => null);

  return (
    <div className="cm-page">
      <div className="cm-card no-print">
        <div className="cm-h2">Хариултын хуудас хэвлэх</div>
        <div className="cm-sub">«{exam.title}» — {exam.sec1Count} дасгал{exam.useSec2 ? ' · 2-р хэсэгтэй' : ''}. A4 цаасан дээр 100% хэмжээгээр хэвлэнэ.</div>
        {tooMany && <div className="cm-alert">Энэ хуудас 1-р хэсгийн {S1_MAX} хүртэлх дасгалыг багтаана. Энэ шалгалт {exam.sec1Count} дасгалтай.</div>}
        <div className="cm-seg" style={{ marginTop: 14 }}>
          <button className={mode === 'blank' ? 'on' : ''} onClick={() => setMode('blank')}>Хоосон хуудас</button>
          <button className={mode === 'class' ? 'on' : ''} onClick={() => setMode('class')}>Ангиар нэрлэсэн</button>
        </div>
        {mode === 'blank' ? (
          <label className="cm-field">Хэдэн хувь
            <input type="number" min={1} max={200} value={copies} onChange={e => setCopies(e.target.value)} />
          </label>
        ) : classes.length ? (
          <label className="cm-field">Анги
            <select value={cls} onChange={e => setCls(e.target.value)}>
              {classes.map(c => <option key={c} value={c}>{c} ({accounts.filter(a => a.class === c).length})</option>)}
            </select>
            <span className="cm-hint">Сурагч бүрийн нэр ба код хуудсан дээр урьдчилан хэвлэгдэнэ — уншихад хэн болохыг автоматаар таньна.</span>
          </label>
        ) : (
          <div className="cm-hint" style={{ marginTop: 10 }}>Сурагчийн бүртгэл алга. «Сурагчид» хэсэгт ангиар нэмбэл нэрлэсэн хуудас хэвлэж болно.</div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="cm-btn" disabled={!students.length} onClick={() => window.print()}>Хэвлэх · {students.length} хуудас</button>
          <button className="cm-btn ghost" onClick={() => onNavigate('scan')}>Шалгах руу</button>
        </div>
        <div className="cm-tips">
          <b>Анхаарах:</b> Хэвлэх цонхонд «Fit to page/Хуудсанд тааруулах»-ыг унтрааж, цаасыг A4 сонгоно. Өнгөт болон хар-цагаан принтерт аль алинд нь ажиллана. Булан ба хажуугийн 6 хар дөрвөлжин бүтэн гарсан байх ёстой.
        </div>
      </div>
      <div className="print-area">
        {students.map((s, i) => (
          <div className="sheet-wrap" key={i}>
            <AnswerSheetSVG exam={exam} student={s} className="sheet-svg" />
          </div>
        ))}
      </div>
    </div>
  );
}
