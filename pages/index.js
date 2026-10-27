import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { SEC1_CHOICES, SEC2_ROWS, SEC2_SUBS, uid, pf, eyeshGrade, toScaled, getToken, apiFetch, calcScore } from '../lib/eyesh';
import { ScanPage } from '../components/QuickScan';
import { SheetsPage } from '../components/AnswerSheet';
import { Paywall } from '../components/Paywall';
import { PLANS, planPrice, fullPrice, perMonth, fmtMNT, fmtDay, TRIAL_DAYS } from '../lib/plans';
import { StudentPortal } from '../components/StudentPortal';
import { MaterialsPanel, EeshDateSetting } from '../components/MaterialsPanel';
import { exportAnalysisXlsx } from '../lib/report-xlsx';
import { downloadResultsPdf } from '../lib/report-pdf';

const PRACTICE_URL = 'https://cyber-math.com/worksheets.html';

// ── Global SVG Icon ───────────────────────────────────────
function Ico({d, size=20, color='currentColor', sw=1.5, fill='none'}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{display:'block',flexShrink:0}}>
      {Array.isArray(d)?d.map((p,i)=><path key={i} d={p}/>):<path d={d}/>}
    </svg>
  );
}

const SUBJECTS = ['Математик','Физик','Хими','Биологи','Монгол хэл','Түүх','Газарзүй','Англи хэл','Нийгмийн ухаан'];

const TOPICS_BY_SUBJECT = {
  'Математик':  ['Алгебр','Геометр','Тригонометр','Статистик','Тооны онол','Анализ','Функц','Бусад'],
  'Физик':      ['Механик','Термодинамик','Цахилгаан','Соронзон','Оптик','Атомын физик','Долгион','Бусад'],
  'Хими':       ['Атом, молекул','Химийн урвал','Хүчил, суурь','Органик хими','Электрохими','Коллоид','Хийн хими','Бусад'],
  'Биологи':    ['Эс','Генетик','Ургамал','Амьтан','Хүний бие','Экологи','Биохими','Бусад'],
  'Монгол хэл': ['Үгийн сан','Дүрэм','Уран зохиол','Найруулга','Зохиол шинжилгээ','Яруу найраг','Өгүүлбэр зүй','Бусад'],
  'Түүх':       ['Эртний үе','Дундад зуун','Монголын түүх','Орчин үе','Дэлхийн түүх','Соёл иргэншил','Улс төр','Бусад'],
  'Газарзүй':   ['Физик газарзүй','Цаг уур','Хүн ам','Эдийн засаг','Байгаль','Тив далай','Монгол орон','Бусад'],
  'Англи хэл':  ['Grammar','Vocabulary','Reading','Writing','Listening','Speaking','Literature','Other'],
  'Нийгмийн ухаан': ['Нийгэм судлал','Эдийн засаг','Улс төр судлал','Философи','Эрх зүй','Социологи','Ёс зүй','Бусад'],
};
function getTopics(subject) {
  return TOPICS_BY_SUBJECT[subject] || TOPICS_BY_SUBJECT['Математик'];
}
const TOPIC_COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#06b6d4','#10b981','#ef4444','#f97316','#6366f1'];
const PAGE_IDS = ['home','scan','board','analytics','rating','create','sheets','students','materials','admin'];   // ☰ цэсний дараалал
const NAV_ICON = {
  home:'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  board:['M8 6h13','M8 12h13','M8 18h13','M3.5 6h.01','M3.5 12h.01','M3.5 18h.01'],
  analytics:['M4 20V10','M10 20V4','M16 20v-7','M22 20H2'],
  more:['M4 4h6v6H4z','M14 4h6v6h-6z','M4 14h6v6H4z','M14 14h6v6h-6z'],
  scan:['M3 7V5a2 2 0 0 1 2-2h2','M17 3h2a2 2 0 0 1 2 2v2','M21 17v2a2 2 0 0 1-2 2h-2','M7 21H5a2 2 0 0 1-2-2v-2','M7 12h10'],
  create:['M12 5v14','M5 12h14'],
  sheets:['M6 9V2h12v7','M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2','M6 14h12v8H6z'],
  menu:['M4 6h16','M4 12h16','M4 18h16'],
  close:['M6 6l12 12','M18 6 6 18'],
  rating:['M8 21h8','M12 17v4','M7 4h10v5a5 5 0 0 1-10 0z','M17 5h3v2a3 3 0 0 1-3 3','M7 5H4v2a3 3 0 0 0 3 3'],
  students:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M22 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'],
  materials:'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  admin:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun:['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z','M12 1v2','M12 21v2','M4.2 4.2l1.4 1.4','M18.4 18.4l1.4 1.4','M1 12h2','M21 12h2','M4.2 19.8l1.4-1.4','M18.4 5.6l1.4-1.4'],
  logout:['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4','M16 17l5-5-5-5','M21 12H9'],
  book:['M4 19.5A2.5 2.5 0 0 1 6.5 17H20','M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
};


// ── Translations ─────────────────────────────────────────
const T = {
  mn: {
    appName:'EYESH Checker',
    teacher:'Багш', student:'Сурагч',
    loginWithPass:'Нэвтрэх нэр, нууц үгээр', loginWithCode:'Кодоор нэвтрэх',
    username:'Нэвтрэх нэр', password:'Нууц үг', code:'Таны код',
    login:'Нэвтрэх', back:'← Буцах', logout:'Гарах',
    selectRole:'Нэвтрэх төрөл сонгоно уу',
    teacherCode:'Багшаас авсан кодоо оруулна уу',
    selectExam:'Шалгалт сонгоно уу',
    noExams:'Одоогоор шалгалт байхгүй байна',
    submit:'Илгээх', submitting:'Илгээж байна...',
    submitted:'Амжилттай илгээгдлээ!',
    performance:'Гүйцэтгэл', correct:'Зөв', wrong:'Буруу',
    timeLeft:'Үлдсэн хугацаа',
    timeUp:'Хугацаа дууссан! Хариулт автоматаар илгээгдлээ.',
    section1:'1-р хэсэг', section2:'2-р хэсэг',
    hello:'Сайн байна уу,',
    nav:{billing:'Эрх сунгах',materials:'ЭЕШ материал',home:'Нүүр',scan:'Шалгах',sheets:'Хуудас хэвлэх',create:'Шалгалт үүсгэх',edit:'Шалгалт засах',board:'Жагсаалт',analytics:'Анализ',rating:'Рейтинг',students:'Сурагчид',admin:'Admin'},
    more:'Цэс',
  },
  en: {
    appName:'EYESH Checker',
    teacher:'Teacher', student:'Student',
    loginWithPass:'Login with username & password', loginWithCode:'Login with code',
    username:'Username', password:'Password', code:'Your code',
    login:'Login', back:'← Back', logout:'Logout',
    selectRole:'Select login type',
    teacherCode:'Enter the code given by your teacher',
    selectExam:'Select an exam',
    noExams:'No exams available yet',
    submit:'Submit', submitting:'Submitting...',
    submitted:'Successfully submitted!',
    performance:'Score', correct:'Correct', wrong:'Wrong',
    timeLeft:'Time remaining',
    timeUp:'Time is up! Your answers have been submitted.',
    section1:'Section 1', section2:'Section 2',
    hello:'Hello,',
    nav:{billing:'Renew',materials:'Materials',home:'Home',scan:'Scan',sheets:'Print sheets',create:'Create Exam',edit:'Edit Exam',board:'Results',analytics:'Analytics',rating:'Ranking',students:'Students',admin:'Admin'},
    more:'More',
  }
};

function useLang() {
  const [lang, setLang] = useState(()=>{
    if(typeof window==='undefined') return 'mn';
    return localStorage.getItem('eyesh_lang')||'mn';
  });
  function toggleLang() {
    const next = lang==='mn'?'en':'mn';
    setLang(next);
    if(typeof window!=='undefined') localStorage.setItem('eyesh_lang', next);
  }
  return [lang, toggleLang, T[lang]];
}

function useDark() {
  const [dark, setDark] = useState(()=>{
    if(typeof window==='undefined') return false;
    return localStorage.getItem('eyesh_dark')==='1';
  });
  function toggleDark() {
    const next = !dark;
    setDark(next);
    if(typeof window!=='undefined') localStorage.setItem('eyesh_dark', next?'1':'0');
  }
  return [dark, toggleDark];
}

function hexToRgb(hex) {
  const h=(hex||'#888').replace('#','');
  if(h.length<6) return [128,128,128];
  const n=parseInt(h.slice(0,6),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}

// ── Excel Export ──────────────────────────────────────────
function exportExcel(exam, students) {
  import('xlsx').then(XLSX => {
    const wb = XLSX.utils.book_new();
    const n = students.length;
    const ss = students.map(s=>s.scaled);
    const avg = n?(ss.reduce((a,b)=>a+b,0)/n).toFixed(1):0;
    const pass = students.filter(s=>s.scaled>=60).length;
    const rm = (exam.sec1Scores||[]).reduce((a,b)=>a+(b||1),0) || exam.sec1Count||0;
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['EYESH Шалгалтын Тайлан'],[],
      ['Шалгалтын нэр:',exam.title],['Хичээл:',exam.subject],
      ['1-р хэсэг дасгал:',exam.sec1Count],['Raw дээд оноо:',rm],
      ['Оролцогч:',n],['Дундаж ЭЕШ:',avg],
      ['Тэнцсэн >=60:',(pass+'/'+n+' ('+n?(Math.round(pass/n*100))+'%':'0%')+')'],
      ['Хамгийн өндөр:',n?Math.max(...ss):'—'],['Хамгийн бага:',n?Math.min(...ss):'—'],
      [],[' Огноо:',new Date().toLocaleString('mn-MN')]
    ]),'Тойм');
    // All students sheet
    const sortedAll = [...students].sort((a,b)=>b.scaled-a.scaled);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['#','Нэр','Код','Анги','Хув.','Зөв','Буруу','Хоосон','Raw','ЭЕШ','Зэрэглэл'],
      ...sortedAll.map((s,i)=>[
        i+1,s.name,s.code,s.class||'—',s.version||'—',s.correct,s.wrong,s.blank,
        s.rawEarned+'/'+s.rawMax,s.scaled,(s.grade?.g+' '+s.grade?.l)
      ])
    ]),'Бүгд');
    // Per-class sheets
    const classes = [...new Set(students.map(s=>s.class||'').filter(Boolean))].sort();
    classes.forEach(cls=>{
      const clsStudents = [...students.filter(s=>s.class===cls)].sort((a,b)=>b.scaled-a.scaled);
      const clsAvg = clsStudents.length?(clsStudents.reduce((s,x)=>s+x.scaled,0)/clsStudents.length).toFixed(1):0;
      const clsPass = clsStudents.filter(s=>s.scaled>=60).length;
      const sheetName = cls.slice(0,31); // Excel sheet name max 31 chars
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
        [cls+' — '+exam.title],[],
        ['Нийт сурагч:',clsStudents.length],['Дундаж:',clsAvg],['Тэнцсэн:',clsPass+'/'+clsStudents.length],[],
        ['#','Нэр','Код','Зөв','Буруу','Хоосон','ЭЕШ','Зэрэглэл'],
        ...clsStudents.map((s,i)=>[i+1,s.name,s.code,s.correct,s.wrong,s.blank,s.scaled,s.grade?.g+' '+s.grade?.l])
      ]),sheetName);
    });
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['Нэр','Код',...Array.from({length:exam.sec1Count},(_,i)=>'D'+(i+1)),'Raw','ЭЕШ','Зэрэглэл'],
      ...students.map(s=>[s.name,s.code,
        ...s.sec1Results.map(r=>r.pts||0),
        s.rawEarned+'/'+s.rawMax,s.scaled,s.grade?.l
      ])
    ]),'Хариулт 1-р хэсэг');
    if(exam.useSec2){
      const sec2Cols=[];
      SEC2_SUBS.forEach(sub=>{if(exam.sec2Config?.[sub]?._enabled) SEC2_ROWS.forEach(row=>{const kv=exam.sec2Config[sub][row];if(kv!==undefined&&kv!==null&&(typeof kv==='object'?kv.ans:kv)!=='') sec2Cols.push({sub,row});});});
      if(sec2Cols.length>0){
        XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
          ['Нэр','Код',...sec2Cols.map(c=>c.sub+c.row),'2-р хэсэг оноо'],
          ...students.map(s=>[s.name,s.code,
            ...sec2Cols.map(c=>s.sec2Results?.[c.sub]?.[c.row]?.pts||0),
            sec2Cols.reduce((sum,c)=>sum+(s.sec2Results?.[c.sub]?.[c.row]?.pts||0),0)
          ])
        ]),'Хариулт 2-р хэсэг');
      }
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['Дасгал','Зөв хариулт','Оноо','Сэдэв','Зөв','Буруу','Хоосон','Амжилт %'],
      ...exam.sec1Key.map((key,i)=>{
        const c=students.filter(s=>s.sec1Results[i]?.st==='ok').length;
        const bl=students.filter(s=>s.sec1Results[i]?.st==='blank').length;
        return['D'+(i+1),key,exam.sec1Scores?.[i]||1,exam.topics?.[i]||'—',c,n-c-bl,bl,n?(c/n*100).toFixed(1)+'%':'0%'];
      })
    ]),'Дасгал шинжилгээ');
    XLSX.writeFile(wb, exam.title+'_тайлан.xlsx');
  });
}

// ─────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────

function Spinner() {
  return <div style={{width:20,height:20,border:'3px solid #e5e7eb',borderTopColor:'#7B52EE',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block'}} />;
}

function Badge({children, color='#7B52EE'}) {
  return <span style={{fontSize:11,fontWeight:700,color:'white',background:color,padding:'2px 8px',borderRadius:20}}>{children}</span>;
}



// ── Landing Page ──────────────────────────────────────────
function LandingPage({onEnter}) {
  // Хуучин (улаан) загварыг харуулдаг тул шинэ видео бичих хүртэл нуув. Буцаах: 'aUggJeMlQ8E'
  const YOUTUBE_ID = '';

  const features = [
    { icon: ['M3 7V5a2 2 0 0 1 2-2h2','M17 3h2a2 2 0 0 1 2 2v2','M21 17v2a2 2 0 0 1-2 2h-2','M7 21H5a2 2 0 0 1-2-2v-2','M7 12h10'], title:'Камераар шуурхай шалгах', desc:'Хуудсаа утасны камерт барихад автоматаар уншиж, оноог шууд гаргана. Дараагийн хуудас руу шууд шилжинэ.' },
    { icon: 'M20 6 9 17l-5-5', title:'AI-гүй, давтагдах уншилт', desc:'Хуудасны тэмдгээр байрлалыг тогтоож пикселээр уншдаг. Эргэлзээтэй мөрийг танаас асууна.' },
    { icon: ['M6 9V2h12v7','M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2','M6 14h12v8H6z'], title:'ЭЕШ загварын хуудас', desc:'Шалгалт бүрийн хуудсыг хэвлэнэ. Ангиар нэрлэж хэвлэвэл сурагчийг автоматаар таньна.' },
    { icon: ['M4 20V10','M10 20V4','M16 20v-7','M22 20H2'], title:'Дэлгэрэнгүй анализ', desc:'Дасгал бүрийн амжилт, сурагчийн гүйцэтгэл, ангийн рейтинг.' },
    { icon: ['M12 16V4','M7 9l5-5 5 5','M4 20h16'], title:'PDF & Excel экспорт', desc:'Сурагч бүрийн PDF тайлан, ангийн Excel жагсаалт нэг товчоор.' },
    { icon: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M22 21v-2a4 4 0 0 0-3-3.87'], title:'Сурагчийн портал', desc:'Сурагч кодоороо нэвтэрч өөрийн үр дүнг харна.' },
  ];
  const steps = [
    { n:'1', title:'Шалгалт үүсгэх', desc:'Дасгалын тоо, зөв хариулт, оноог тохируулна.' },
    { n:'2', title:'Хуудас хэвлэх', desc:'ЭЕШ загварын хариултын хуудсыг хэвлэнэ.' },
    { n:'3', title:'Камераар уншуулах', desc:'Хуудас бүрийг камерт барихад оноо шууд гарна.' },
    { n:'4', title:'Үр дүн', desc:'Тайлан, рейтинг, анализаа экспортлоно.' },
  ];
  const sec = {margin:'44px 0'};
  const h2 = {fontSize:22,fontWeight:900,marginBottom:4,textAlign:'center',letterSpacing:'-.3px'};
  const sub = {fontSize:14,color:'var(--soft)',marginBottom:22,textAlign:'center'};

  return (
    <div style={{minHeight:'100vh'}}>
      <div className="cm-top">
        <div className="cm-top-in">
          <div className="cm-brand"><img src="/chick.svg" alt="" className="cm-chick" /><span><b>ЭЕШ шалгагч</b><small>CyberMath</small></span></div>
          <div className="cm-actions">
            <a className="cm-back cm-xs-hide" href={PRACTICE_URL}>← Дасгалын төв</a>
            <button className="cm-btn" style={{padding:'.5rem 1rem',fontSize:13}} onClick={onEnter}>Нэвтрэх</button>
          </div>
        </div>
      </div>
      <div style={{maxWidth:980,margin:'0 auto',padding:'18px 16px 40px'}}>
        <div className="cm-hero" style={{padding:'30px 22px',textAlign:'center'}}>
          <img src="/chick.svg" alt="" style={{width:104,height:104,filter:'drop-shadow(0 10px 16px rgba(0,0,0,.25))',animation:'bob 3.4s ease-in-out infinite',position:'relative',zIndex:1}} />
          <div className="cm-hero-t" style={{marginTop:10}}>
            <span className="cm-eyebrow">CyberMath · Дасгалын төвийн хэрэгсэл</span>
            <h1 style={{fontSize:30}}>ЭЕШ хариултын хуудас шалгагч</h1>
            <p style={{maxWidth:520,margin:'8px auto 0',fontSize:15}}>Хариултын хуудсыг утасны камераар уншуулж, оноо, анализ, рейтингийг хэдхэн секундэд гаргана.</p>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap',position:'relative',zIndex:1}}>
            <button className="cm-btn amber" style={{padding:'.85rem 1.6rem',fontSize:16}} onClick={onEnter}>Нэвтрэх / Бүртгүүлэх →</button>
            <button className="cm-btn ghost" style={{padding:'.85rem 1.6rem',fontSize:16}} onClick={()=>document.getElementById('demo-section').scrollIntoView({behavior:'smooth'})}>Demo үзэх</button>
          </div>
        </div>

        <div style={sec}>
          <div style={h2}>Боломжууд</div>
          <div style={sub}>Багшийн цагийг хэмнэх гол онцлогууд</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:12}}>
            {features.map(f=>(
              <div key={f.title} className="cm-card" style={{marginBottom:0}}>
                <div style={{width:42,height:42,borderRadius:12,background:'var(--chip)',color:'var(--purple-d)',display:'grid',placeItems:'center',marginBottom:10}}>
                  <Ico d={f.icon} size={22} sw={2}/>
                </div>
                <div style={{fontWeight:900,fontSize:15,marginBottom:4}}>{f.title}</div>
                <div style={{fontSize:13,color:'var(--soft)',lineHeight:1.55}}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={sec}>
          <div style={h2}>Хэрхэн ашиглах вэ?</div>
          <div style={sub}>4 алхамд шалгалтаа дуусгана</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
            {steps.map(s=>(
              <div key={s.n} className="cm-card" style={{marginBottom:0,textAlign:'center'}}>
                <div style={{width:42,height:42,borderRadius:999,background:'linear-gradient(135deg,var(--purple),var(--purple2))',color:'#fff',fontWeight:900,fontSize:18,display:'grid',placeItems:'center',margin:'0 auto 10px'}}>{s.n}</div>
                <div style={{fontWeight:900,fontSize:14,marginBottom:4}}>{s.title}</div>
                <div style={{fontSize:12.5,color:'var(--soft)',lineHeight:1.55}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {YOUTUBE_ID && (
          <div style={sec}>
            <div style={h2}>Танилцуулга видео</div>
            <div style={sub}>Системийг хэрхэн ашиглах тайлбар</div>
            <div style={{position:'relative',paddingBottom:'56.25%',borderRadius:18,overflow:'hidden',boxShadow:'0 20px 50px -24px rgba(60,30,120,.6)'}}>
              <iframe src={`https://www.youtube.com/embed/${YOUTUBE_ID}`} title="Танилцуулга"
                style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        )}

        <div style={sec}>
          <div style={h2}>Үнэ</div>
          <div style={sub}>Бүртгүүлээд {TRIAL_DAYS} хоног үнэгүй туршина · дараа нь QPay-ээр төлнө</div>
          <div className="pw-plans">
            {PLANS.map(p => (
              <div key={p.months} className={'pw-plan' + (p.best ? ' best on' : '')} style={{cursor:'default'}}>
                {p.best && <span className="pw-ribbon">Хамгийн ашигтай</span>}
                <span className="pw-plan-m"><b>{p.months} сар</b>{p.off > 0 && <em>−{p.off}%</em>}</span>
                <span className="pw-plan-p"><b>{fmtMNT(planPrice(p.months))}</b>{p.off > 0 && <s>{fmtMNT(fullPrice(p.months))}</s>}</span>
                <span className="pw-plan-n">{p.off > 0 ? <>сард <b>{fmtMNT(perMonth(p.months))}</b> · <i>{fmtMNT(fullPrice(p.months) - planPrice(p.months))} хэмнэнэ</i></> : <>хязгааргүй шалгалт</>}</span>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:6}}>
            <button className="cm-btn amber" style={{padding:'.85rem 1.6rem',fontSize:16}} onClick={onEnter}>{TRIAL_DAYS} хоног үнэгүй турших →</button>
          </div>
        </div>

        <div id="demo-section" style={sec}>
          <div style={h2}>Live Demo</div>
          <div style={sub}>Бүртгэлгүйгээр системийг туршиж үзэх</div>
          <div className="cm-card" style={{textAlign:'center',padding:26}}>
            <div style={{fontSize:15,marginBottom:6}}>Demo хэрэглэгчээр нэвтэрч системийг туршина уу.</div>
            <div style={{color:'var(--soft)',fontSize:13,marginBottom:16}}>Email: demo@eyeshcheck.com · Нууц үг: demo1234</div>
            <button className="cm-btn" onClick={onEnter}>Demo-оор нэвтрэх →</button>
          </div>
        </div>

        <div style={sec}>
          <div style={h2}>Түгээмэл асуулт</div>
          <div style={sub}>Хамгийн их асуудаг асуултууд</div>
          {[
            {q:'Ямар төхөөрөмжид ажилладаг вэ?', a:'Утас, таблет, компьютерийн хөтөч дээр ажиллана. Суулгах шаардлагагүй — утсан дээрээ «Нүүр дэлгэцэнд нэмэх»-ээр апп шиг ашиглаж болно.'},
            {q:'Камераар уншихад хэр найдвартай вэ?', a:'CyberMath-ийн хэвлэсэн хуудсыг AI-гүй, тэмдгээр нь байрлалыг тогтоож пикселээр уншдаг тул нэг хуудсыг хэдэн удаа уншуулсан ч ижил үр дүн гарна. Олон будсан, бүдэг, арилгасан мөрийг таньж танаас баталгаажуулалт авна.'},
            {q:'Үнэгүй туршиж болох уу?', a:'Тийм. Бүртгүүлэхдээ утасны дугаараа SMS-ээр баталгаажуулмагц ' + TRIAL_DAYS + ' хоног бүх боломжийг үнэгүй ашиглана.'},
            {q:'Үнэ хэд вэ?', a:'1 сар 9,900₮. 3 сараар авбал 20%, 6 сараар авбал 30% хямд. Аль ч багцад шалгалт хязгааргүй.'},
            {q:'Өгөгдөл хаана хадгалагддаг вэ?', a:'Бүх өгөгдөл Neon cloud database-д хадгалагдана. Өгөгдлийг гуравдагч этгээдэд дамжуулахгүй.'},
            {q:'Олон багш нэг платформ ашиглаж болох уу?', a:'Тийм. Багш бүр өөрийн бүртгэлтэй бөгөөд зөвхөн өөрийн шалгалт, сурагчдаа харна.'},
            {q:'Төлбөрийг хэрхэн төлөх вэ?', a:'Нэвтэрсний дараа багцаа сонгоод QPay-ээр төлнө: банкны аппаараа QR уншуулах эсвэл утсан дээрээ банкны апп руу шууд орно. Төлсөн даруй эрх нээгдэнэ. Хугацаа дуусахаас өмнө сунгавал үлдсэн хоног дээр нэмэгдэнэ.'},
          ].map((item,i)=>(
            <FAQItem key={i} q={item.q} a={item.a} />
          ))}
        </div>

        <div style={{...sec,textAlign:'center'}}>
          <div style={h2}>Холбоо барих</div>
          <div style={sub}>Асуулт байвал холбогдоорой</div>
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            {[['tel:+97688449307','Утас','88449307','M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z'],
              ['mailto:bymbaamedehgui@gmail.com','Email','bymbaamedehgui@gmail.com','M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75'],
              [PRACTICE_URL,'CyberMath','Дасгалын төв','M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
            ].map(([href,label,val,icon])=>(
              <a key={label} href={href} className="cm-card" style={{textDecoration:'none',color:'var(--ink)',minWidth:170,marginBottom:0,textAlign:'center'}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:8,color:'var(--purple)'}}><Ico d={icon} size={26} sw={1.8}/></div>
                <div style={{fontWeight:900,fontSize:14}}>{label}</div>
                <div style={{fontSize:12.5,color:'var(--soft)'}}>{val}</div>
              </a>
            ))}
          </div>
        </div>

        <div style={{textAlign:'center',padding:'24px 0 0',color:'var(--soft)',fontSize:12.5}}>
          CyberMath · ЭЕШ шалгагч © 2026 · eyeshcheck.com
        </div>
      </div>
    </div>
  );
}

function FAQItem({q, a}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cm-card" style={{padding:0,marginBottom:8,overflow:'hidden'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:'100%',padding:'15px 18px',background:'none',border:'none',color:'var(--ink)',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14,fontWeight:800}}>
        {q}
        <span style={{flexShrink:0,marginLeft:12,fontSize:20,color:'var(--purple)'}}>{open?'−':'+'}</span>
      </button>
      {open&&(
        <div style={{padding:'0 18px 15px',fontSize:13.5,color:'var(--soft)',lineHeight:1.65}}>
          {a}
        </div>
      )}
    </div>
  );
}

// ── Login Page ────────────────────────────────────────────
function LoginPage({onLogin, onStudentLogin, onBack}) {
  const [lang, toggleLang, t] = useLang();
  const [role, setRole] = useState(null); // null | 'teacher' | 'student'
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const [registered, setRegistered] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotStep, setForgotStep] = useState(1);     // 1 — имэйл, 2 — бүртгэлтэй утаснаас SMS (verify.mn), 3 — шинэ нууц үг
  const [forgotErr, setForgotErr] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotMo, setForgotMo] = useState(null);      // { moText, shortcode, pollToken, expiresAt, masked }
  const [forgotExpired, setForgotExpired] = useState(false);
  const [verifyErr, setVerifyErr] = useState('');
  const [verifyMasked, setVerifyMasked] = useState('');
  const [mo, setMo] = useState(null);              // verify.mn: { moText, shortcode, pollToken, expiresAt }
  const [moExpired, setMoExpired] = useState(false);
  const [now, setNow] = useState(Date.now());
  const ticking = verifying || (forgotMode && forgotStep === 2);
  useEffect(() => { if (!ticking) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [ticking]);
  const moLeft = mo ? Math.max(0, Math.round((Date.parse(mo.expiresAt) - now) / 1000)) : 0;
  // Хэрэглэгч 144773 руу илгээхийг хүлээнэ: 3 сек тутам дараалан асууна (давхар хүсэлтгүй)
  useEffect(() => {
    if (!verifying || !mo || moExpired) return;
    let stop = false, timer = null;
    async function poll() {
      if (Date.now() > Date.parse(mo.expiresAt)) { setMoExpired(true); return; }
      try {
        const r = await fetch('/api/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pollToken: mo.pollToken }) });
        const d = await r.json();
        if (stop) return;
        if (r.ok && d.status === 'VERIFIED') {
          localStorage.setItem('eyesh_token', d.token);
          localStorage.setItem('eyesh_teacher', JSON.stringify(d.teacher));
          onLogin(d.teacher);
          return;
        }
        if (d.status === 'EXPIRED') { setMoExpired(true); return; }
        if (!r.ok) { setVerifyErr(d.error || 'Алдаа'); return; }
      } catch (e) {}                                // сүлжээ тасарвал дараагийн удаа
      if (!stop) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 2500);
    return () => { stop = true; clearTimeout(timer); };
  }, [verifying, mo, moExpired]);
  // Нууц үг сэргээх: бүртгэлтэй утаснаас 144773 руу илгээхийг хүлээнэ (3 сек тутам) → баталгаажвал шинэ нууц үгийн алхам
  const forgotLeft = forgotMo ? Math.max(0, Math.round((Date.parse(forgotMo.expiresAt) - now) / 1000)) : 0;
  useEffect(() => {
    if (!forgotMode || forgotStep !== 2 || !forgotMo || forgotExpired) return;
    let stop = false, timer = null;
    async function poll() {
      if (Date.now() > Date.parse(forgotMo.expiresAt)) { setForgotExpired(true); return; }
      try {
        const r = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pollToken: forgotMo.pollToken }) });
        const d = await r.json();
        if (stop) return;
        if (r.ok && d.status === 'VERIFIED') { setForgotStep(3); setForgotErr(''); return; }
        if (d.status === 'EXPIRED') { setForgotExpired(true); return; }
        if (!r.ok) { setForgotErr(d.error || 'Алдаа'); return; }
      } catch (e) {}                                // сүлжээ тасарвал дараагийн удаа
      if (!stop) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 2500);
    return () => { stop = true; clearTimeout(timer); };
  }, [forgotMode, forgotStep, forgotMo, forgotExpired]);
  const isPhone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  // iOS нь sms:NUM&body=..., Android нь sms:NUM?body=... гэж ойлгодог
  const smsHref = (sc, text) => 'sms:' + sc + (/iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?') + 'body=' + encodeURIComponent(text);

  // Имэйл илгээхгүй: бүртгэлтэй утаснаасаа дэлгэц дээрх кодыг 144773 руу SMS-ээр илгээж баталгаажуулна (verify.mn)
  async function handleForgotSend() {
    if (!forgotEmail) return;
    setForgotLoading(true); setForgotErr('');
    try {
      const d = await fetch('/api/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:forgotEmail})}).then(async r=>{
        const d=await r.json(); if(!r.ok) throw new Error(d.error||'Алдаа'); return d;
      });
      setForgotMo({ moText: d.moText, shortcode: d.shortcode || '144773', pollToken: d.pollToken, expiresAt: d.expiresAt, masked: d.masked || '' });
      setForgotExpired(false);
      setNow(Date.now());
      setForgotStep(2);
    } catch(e) { setForgotErr(e.message); }
    setForgotLoading(false);
  }

  async function handleForgotReset() {
    if (!forgotMo||!forgotNewPass) return;
    setForgotLoading(true); setForgotErr('');
    try {
      await fetch('/api/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pollToken:forgotMo.pollToken,password:forgotNewPass})}).then(async r=>{
        const d=await r.json(); if(!r.ok||!d.ok) throw new Error(d.error||(d.status==='EXPIRED'?'Хугацаа дууссан. Дахин эхлүүлнэ үү.':'Алдаа')); return d;
      });
      setForgotDone(true);
    } catch(e) { setForgotErr(e.message); }
    setForgotLoading(false);
  }
  function resetForgot() { setForgotStep(1); setForgotDone(false); setForgotErr(''); setForgotNewPass(''); setForgotMo(null); setForgotExpired(false); }

  async function handleTeacherLogin() {
    if (!email||!pass) return;
    setLoading(true); setErr('');
    try {
      const d = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})}).then(async r=>{
        const d=await r.json(); if(!r.ok) throw new Error(d.error||'Алдаа'); return d;
      });
      // Clear any leftover demo session data for non-demo users
      if (d.teacher?.email !== 'demo@eyeshcheck.com') {
        localStorage.removeItem('demo_login_time');
        localStorage.removeItem('demo_device_fingerprint');
      } else {
        // Demo device check
        const newId = navigator.userAgent + screen.width + screen.height;
        const storedId = localStorage.getItem('demo_device_fingerprint');
        if (storedId && storedId !== btoa(newId).slice(0,20)) {
          setErr('Demo бүртгэл өөр төхөөрөмжөөс нэвтэрсэн байна.');
          setLoading(false); return;
        }
        localStorage.setItem('demo_device_fingerprint', btoa(newId).slice(0,20));
        localStorage.setItem('demo_login_time', Date.now().toString());
      }
      localStorage.setItem('eyesh_token', d.token);
      localStorage.setItem('eyesh_teacher', JSON.stringify(d.teacher));
      onLogin(d.teacher);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

    async function handleRegister() {
    if (!email||!pass) return;
    setLoading(true); setErr('');
    try {
      const d = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,name,phone})}).then(async r=>{
        const d=await r.json(); if(!r.ok) throw new Error(d.error||'Алдаа'); return d;
      });
      setVerifyMasked(d.masked || '');
      setMo({ moText: d.moText, shortcode: d.shortcode || '144773', pollToken: d.pollToken, expiresAt: d.expiresAt });
      setMoExpired(false);
      setVerifyErr('');
      setNow(Date.now());
      setVerifying(true);
    } catch(e) { if (verifying) setVerifyErr(e.message); else setErr(e.message); }
    setLoading(false);
  }

  async function handleStudentLogin() {
    if (!code.trim()) return;
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/student/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code.trim()})});
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||'Код олдсонгүй');
      localStorage.setItem('student_token', d.token);
      localStorage.setItem('student_info', JSON.stringify(d.student));
      onStudentLogin(d.student);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  const inp = {width:'100%',padding:'12px 14px',border:'1.6px solid #e5e7eb',borderRadius:12,fontSize:16,outline:'none',marginBottom:10,boxSizing:'border-box',background:'#fff',color:'#1c1f2a'};

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'radial-gradient(900px 420px at 100% -10%,#fff2cf 0,rgba(255,242,207,0) 60%),#f5f6f8',padding:'20px 16px'}}>
      <div style={{background:'white',borderRadius:24,padding:'26px 22px',width:'100%',maxWidth:420,border:'1px solid #e5e7eb',boxShadow:'0 24px 60px -30px rgba(17,24,39,.35)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          {onBack
            ? <button onClick={onBack} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:13,padding:0}}>← Буцах</button>
            : <span/>
          }
          <button onClick={toggleLang} style={{padding:'4px 12px',background:'#f3f4f6',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',color:'#374151'}}>
            {lang==='mn'?'EN':'МН'}
          </button>
        </div>
        <div style={{textAlign:'center',marginBottom:24}}>
          <img src="/chick.svg" alt="" style={{width:76,height:76,display:'block',margin:'0 auto 8px',animation:'bob 3.4s ease-in-out infinite'}} />
          <div style={{fontSize:22,fontWeight:900,color:'#1c1f2a',letterSpacing:'-.3px'}}>ЭЕШ шалгагч</div>
          <div style={{fontSize:12,fontWeight:800,color:'#7B52EE'}}>CyberMath</div>
          <div style={{fontSize:13,color:'#9ca3af',marginTop:4}}>{t.selectRole}</div>
        </div>

        {!role&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <button onClick={()=>{setRole('teacher');setErr('');setTab('login');}}
              style={{padding:'24px 16px',background:'#f9fafb',border:'2px solid #e5e7eb',borderRadius:14,cursor:'pointer',textAlign:'center'}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:8}}><div style={{background:'#f3eeff',borderRadius:12,padding:10}}><Ico d={['M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z']} size={32} color='#7B52EE'/></div></div>
              <div style={{fontWeight:800,fontSize:15,color:'#1c1f2a'}}>Багш</div>
              <div style={{fontSize:11,color:'#9ca3af',marginTop:4}}>Нэвтрэх / Бүртгүүлэх</div>
            </button>
            <button onClick={()=>{setRole('student');setErr('');}}
              style={{padding:'24px 16px',background:'#f9fafb',border:'2px solid #e5e7eb',borderRadius:14,cursor:'pointer',textAlign:'center'}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:8}}><div style={{background:'#f3eeff',borderRadius:12,padding:10}}><Ico d='M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5' size={32} color='#7B52EE'/></div></div>
              <div style={{fontWeight:800,fontSize:15,color:'#1c1f2a'}}>Сурагч</div>
              <div style={{fontSize:11,color:'#9ca3af',marginTop:4}}>Кодоор нэвтрэх</div>
            </button>
          </div>
        )}

        {role==='teacher'&&(
          <>
            <button onClick={()=>{setRole(null);setErr('');setRegistered(false);}} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:13,marginBottom:14,padding:0}}>← Буцах</button>
            {verifying && mo ? (
              <div style={{textAlign:'center',padding:'4px 0'}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>
                  <div style={{background:'#f3eeff',borderRadius:14,padding:12}}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7B52EE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </div>
                </div>
                <div style={{fontWeight:800,fontSize:16,color:'#1c1f2a',marginBottom:4}}>Утаснаасаа SMS илгээж баталгаажуулна уу</div>
                <div style={{fontSize:13,color:'#6b7280',marginBottom:14}}>Доорх кодыг <b>{mo.shortcode}</b> дугаарт SMS-ээр илгээнэ үү</div>
                <div style={{border:'2px dashed #d9ccfb',borderRadius:14,background:'#faf8ff',padding:'12px 10px',marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:800,color:'#8b7fae',letterSpacing:.5}}>ИЛГЭЭХ КОД</div>
                  <div style={{fontSize:32,fontWeight:900,color:'#4c23c4',letterSpacing:8,fontFamily:'ui-monospace,Menlo,Consolas,monospace',lineHeight:1.3}}>{mo.moText}</div>
                  <div style={{fontSize:12,color:'#8b7fae',fontWeight:700}}>{mo.shortcode} дугаарт</div>
                </div>
                {isPhone && !moExpired && (
                  <a href={smsHref(mo.shortcode, mo.moText)} style={{display:'block',textDecoration:'none',padding:13,background:'#7B52EE',color:'white',borderRadius:10,fontSize:15,fontWeight:800,marginBottom:10}}>SMS бичих</a>
                )}
                <div style={{fontSize:12,color:'#9ca3af',lineHeight:1.5,marginBottom:12}}>
                  Өөрийн <b style={{color:'#6b7280'}}>{verifyMasked}</b> дугаараасаа илгээнэ үү. 2 SIM-тэй бол зөв SIM-ээ сонгоорой. SMS-ийн төлбөр энгийн тарифаар.
                </div>
                {verifyErr && <div style={{color:'#b3261e',fontSize:12,background:'#fdecec',padding:'6px 10px',borderRadius:6,marginBottom:10,textAlign:'center'}}>{verifyErr}</div>}
                {moExpired ? (
                  <>
                    <div style={{fontSize:13,fontWeight:800,color:'#b3261e',marginBottom:8}}>Хугацаа дууслаа — шинэ код аваад дахин илгээнэ үү</div>
                    <button onClick={handleRegister} disabled={loading}
                      style={{width:'100%',padding:12,background:'#7B52EE',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:8}}>
                      {loading&&<Spinner/>} Шинэ код авах
                    </button>
                  </>
                ) : (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:13,fontWeight:800,color:'#7B52EE'}}>
                    <span className="pw-dot" style={{background:'#7B52EE'}} />Илгээхийг хүлээж байна…
                    <span style={{color:'#9ca3af'}}>{Math.floor(moLeft/60)}:{String(moLeft%60).padStart(2,'0')}</span>
                  </div>
                )}
                <div style={{marginTop:12}}><button onClick={()=>{setVerifying(false);setMo(null);setVerifyErr('');}} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:12}}>← Дугаараа засах</button></div>
              </div>
            ) : (
              <>
              <div style={{display:'flex',background:'#f3f4f6',borderRadius:10,padding:3,marginBottom:18}}>
              {['login','register'].map(tb=>(
                <button key={tb} onClick={()=>{setTab(tb);setErr('');setForgotMode(false);}}
                  style={{flex:1,padding:'8px',border:'none',borderRadius:8,fontWeight:700,fontSize:13,cursor:'pointer',
                    background:tab===tb?'white':'transparent',color:tab===tb?'#1c1f2a':'#9ca3af',
                    boxShadow:tab===tb?'0 1px 4px rgba(0,0,0,.1)':'none'}}>
                  {tb==='login'?'Нэвтрэх':'Бүртгүүлэх'}
                </button>
              ))}
            </div>
            {forgotMode ? (
              <div>
                {forgotDone ? (
                  <div style={{textAlign:'center',padding:'8px 0'}}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block',margin:'0 auto 12px'}}><path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>Нууц үг амжилттай солигдлоо!</div>
                    <button onClick={()=>{setForgotMode(false);resetForgot();setForgotEmail('');setTab('login');}}
                      style={{width:'100%',padding:12,background:'#7B52EE',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',marginTop:8}}>
                      Нэвтрэх
                    </button>
                  </div>
                ) : forgotStep===1 ? (
                  <div>
                    <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>Нууц үг сэргээх</div>
                    <div style={{fontSize:12,color:'#6b7280',marginBottom:12}}>Email хаягаа оруулна уу — бүртгэлтэй утаснаасаа SMS илгээж баталгаажуулна</div>
                    {forgotErr&&<div style={{color:'#b3261e',fontSize:12,background:'#fdecec',padding:'6px 10px',borderRadius:6,marginBottom:8}}>{forgotErr}</div>}
                    <input value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="Email хаяг" type="email" style={inp}/>
                    <button onClick={handleForgotSend} disabled={forgotLoading||!forgotEmail}
                      style={{width:'100%',padding:12,background:'#7B52EE',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                      {forgotLoading&&<Spinner/>} Үргэлжлүүлэх
                    </button>
                    <button onClick={()=>{setForgotMode(false);setForgotErr('');}} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:12,width:'100%'}}>← Буцах</button>
                  </div>
                ) : forgotStep===2 && forgotMo ? (
                  <div style={{textAlign:'center',padding:'4px 0'}}>
                    <div style={{fontWeight:800,fontSize:16,color:'#1c1f2a',marginBottom:4}}>Утаснаасаа SMS илгээж баталгаажуулна уу</div>
                    <div style={{fontSize:13,color:'#6b7280',marginBottom:14}}>Доорх кодыг <b>{forgotMo.shortcode}</b> дугаарт SMS-ээр илгээнэ үү</div>
                    <div style={{border:'2px dashed #d9ccfb',borderRadius:14,background:'#faf8ff',padding:'12px 10px',marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:800,color:'#8b7fae',letterSpacing:.5}}>ИЛГЭЭХ КОД</div>
                      <div style={{fontSize:32,fontWeight:900,color:'#4c23c4',letterSpacing:8,fontFamily:'ui-monospace,Menlo,Consolas,monospace',lineHeight:1.3}}>{forgotMo.moText}</div>
                      <div style={{fontSize:12,color:'#8b7fae',fontWeight:700}}>{forgotMo.shortcode} дугаарт</div>
                    </div>
                    {isPhone && !forgotExpired && (
                      <a href={smsHref(forgotMo.shortcode, forgotMo.moText)} style={{display:'block',textDecoration:'none',padding:13,background:'#7B52EE',color:'white',borderRadius:10,fontSize:15,fontWeight:800,marginBottom:10}}>SMS бичих</a>
                    )}
                    <div style={{fontSize:12,color:'#9ca3af',lineHeight:1.5,marginBottom:12}}>
                      Бүртгэлтэй <b style={{color:'#6b7280'}}>{forgotMo.masked}</b> дугаараасаа илгээнэ үү. 2 SIM-тэй бол зөв SIM-ээ сонгоорой. SMS-ийн төлбөр энгийн тарифаар.
                    </div>
                    {forgotErr && <div style={{color:'#b3261e',fontSize:12,background:'#fdecec',padding:'6px 10px',borderRadius:6,marginBottom:10}}>{forgotErr}</div>}
                    {forgotExpired ? (
                      <>
                        <div style={{fontSize:13,fontWeight:800,color:'#b3261e',marginBottom:8}}>Хугацаа дууслаа — шинэ код аваад дахин илгээнэ үү</div>
                        <button onClick={handleForgotSend} disabled={forgotLoading}
                          style={{width:'100%',padding:12,background:'#7B52EE',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:8}}>
                          {forgotLoading&&<Spinner/>} Шинэ код авах
                        </button>
                      </>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:13,fontWeight:800,color:'#7B52EE'}}>
                        <span className="pw-dot" style={{background:'#7B52EE'}} />Илгээхийг хүлээж байна…
                        <span style={{color:'#9ca3af'}}>{Math.floor(forgotLeft/60)}:{String(forgotLeft%60).padStart(2,'0')}</span>
                      </div>
                    )}
                    <div style={{marginTop:12}}><button onClick={resetForgot} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:12}}>← Буцах</button></div>
                  </div>
                ) : (
                  <div>
                    <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>Шинэ нууц үг тохируулах</div>
                    <div style={{fontSize:12,color:'#16a34a',fontWeight:700,marginBottom:12}}>Утас баталгаажлаа. Шинэ нууц үгээ оруулна уу (10 минутын дотор).</div>
                    {forgotErr&&<div style={{color:'#b3261e',fontSize:12,background:'#fdecec',padding:'6px 10px',borderRadius:6,marginBottom:8}}>{forgotErr}</div>}
                    <input value={forgotNewPass} onChange={e=>setForgotNewPass(e.target.value)} placeholder="Шинэ нууц үг (6+ тэмдэгт)" type="password" autoComplete="new-password" style={inp}/>
                    <button onClick={handleForgotReset} disabled={forgotLoading||forgotNewPass.length<6}
                      style={{width:'100%',padding:12,background:'#7B52EE',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:8,opacity:forgotNewPass.length<6?0.6:1}}>
                      {forgotLoading?'Солиж байна...':'Нууц үг солих'}
                    </button>
                    <button onClick={resetForgot} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:12,width:'100%'}}>← Буцах</button>
                  </div>
                )}
              </div>
            ) : null}
            {!forgotMode && err && <div style={{color:'#b3261e',fontSize:13,background:'#fdecec',padding:'8px 12px',borderRadius:8,border:'1px solid #f6c9c9',marginBottom:12,textAlign:'center'}}>{err}</div>}
            {!forgotMode&&tab==='login'&&(
              <button onClick={()=>{setForgotMode(true);setForgotEmail(email);resetForgot();}}
                style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:12,width:'100%',marginTop:4,textDecoration:'underline'}}>
                Нууц үгээ мартсан?
              </button>
            )}
            {tab==='register'&&(
              <>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Таны нэр (заавал биш)"
                style={inp} />
              <input value={phone} onChange={e=>setPhone(e.target.value.replace(/[^0-9+ ]/g,''))} placeholder="Утасны дугаар — SMS-ээр баталгаажуулна" type="tel" inputMode="numeric" maxLength={13}
                style={inp} />
              </>
            )}
            {!forgotMode&&(<>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email хаяг" type="email"
              style={inp} />
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Нууц үг" onKeyDown={e=>e.key==='Enter'&&(tab==='login'?handleTeacherLogin():handleRegister())}
              style={{...inp,marginBottom:16}} />
            <button onClick={tab==='login'?handleTeacherLogin:handleRegister} disabled={loading}
              style={{width:'100%',padding:13,background:'#7B52EE',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {loading&&<Spinner/>} {tab==='login'?'Нэвтрэх':'Үргэлжлүүлэх'}
            </button>
            </>)}
            {tab==='register'&&(
              <div style={{fontSize:11,color:'#9ca3af',textAlign:'center',marginTop:10}}>
                SMS-ээр баталгаажуулмагц 1 хоног үнэгүй туршина
              </div>
            )}
            </>
            )}
          </>
        )}

        {/* Student login */}
        {role==='student'&&(
          <>
            <button onClick={()=>{setRole(null);setErr('');}} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:13,marginBottom:16,padding:0}}>← Буцах</button>
            {err && <div style={{color:'#b3261e',fontSize:13,background:'#fdecec',padding:'8px 12px',borderRadius:8,border:'1px solid #f6c9c9',marginBottom:14,textAlign:'center'}}>{err}</div>}
            <div style={{fontSize:13,color:'#6b7280',marginBottom:12,textAlign:'center'}}>Багшаас авсан кодоо оруулна уу</div>
            <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Кодоо оруулах" onKeyDown={e=>e.key==='Enter'&&handleStudentLogin()}
              style={{...inp,fontSize:20,textAlign:'center',letterSpacing:4,fontWeight:700,marginBottom:16}} />
            <button onClick={handleStudentLogin} disabled={loading}
              style={{width:'100%',padding:13,background:'#7B52EE',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {loading&&<Spinner/>} Нэвтрэх
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Admin Page ────────────────────────────────────────────
function AdminPage({dark:d=false}) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

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

  const pending  = teachers.filter(t => t.status==='pending');
  const active   = teachers.filter(t => t.status==='active' && !t.is_admin);
  const disabled = teachers.filter(t => t.status==='disabled');

  const bg   = d ? '#1c1f2a' : 'white';
  const text = d ? '#f3f4f6' : '#1c1f2a';
  const muted= d ? '#9ca3af' : '#6b7280';
  const border= d ? '#2a2e38' : '#e5e7eb';

  function TeacherRow({t, actions}) {
    return (
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid '+border}}>
        <div style={{width:36,height:36,borderRadius:'50%',background:'#7B52EE',color:'white',fontWeight:900,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {(t.name||t.email||'?')[0].toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:text}}>{t.name||'—'}</div>
          <div style={{fontSize:12,color:muted}}>{t.email}</div>
          <div style={{fontSize:11,color:muted}}>{new Date(t.created_at).toLocaleDateString('mn-MN')}{t.phone ? ' · ' + t.phone : ''}{t.cm_linked ? ' · Дасгалын төв' : ''}</div>
          {!t.is_admin && <div style={{fontSize:12,fontWeight:800,marginTop:2,color:t.paid_until && new Date(t.paid_until) > new Date() ? '#16a34a' : '#b3261e'}}>
            {t.paid_until ? (new Date(t.paid_until) > new Date() ? 'Эрх: ' : 'Дууссан: ') + new Date(t.paid_until).toLocaleDateString('mn-MN') : 'Эрхгүй'}
          </div>}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          {actions}
        </div>
      </div>
    );
  }

  const btnStyle = (bg2,c) => ({padding:'6px 14px',border:'none',borderRadius:7,fontWeight:700,fontSize:12,cursor:'pointer',background:bg2,color:c});

  return (
    <div style={{maxWidth:800,margin:'0 auto',padding:'24px 20px'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1c1f2a,#2a2e38)',borderRadius:20,padding:'24px 28px',color:'white',marginBottom:20}}>
        <div style={{fontSize:11,letterSpacing:2,opacity:.7,marginBottom:4}}>CYBERMATH · ЭЕШ</div>
        <div style={{fontSize:26,fontWeight:900}}>Admin панель</div>
        <div style={{opacity:.8,fontSize:13,marginTop:4}}>Багш нарын хандалтыг удирдах</div>
      </div>

      {err && <div style={{background:'#fdecec',color:'#b3261e',padding:'10px 14px',borderRadius:10,marginBottom:16,fontSize:13}}>{err}</div>}
      {loading && <div style={{textAlign:'center',padding:40,color:muted}}><Spinner/></div>}

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
          ? <div style={{padding:'24px',textAlign:'center',color:muted,fontSize:13}}>Одоохондоо байхгүй</div>
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

      {/* Сурагчийн хэсэг: ЭЕШ-ийн огноо, 12-р ангийн сурах бичиг */}
      <div style={{marginTop:24}}>
        <div style={{fontSize:18,fontWeight:900,color:text,margin:'0 2px 10px'}}>Сурагчийн хэсэг</div>
        <EeshDateSetting />
        <MaterialsPanel kind="textbook" />
      </div>
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────
function HomePage({exams, students, onSelectExam, currentExam, onDeleteExam, onNavigate, onEditExam, dark:d=false}) {
  // Subject filter — group exams by subject
  const [filterSubject, setFilterSubject] = useState('all');
  const examSubjects = [...new Set(exams.map(e=>e.subject||'Бусад').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'mn'));
  const subjectCounts = examSubjects.reduce((m,s)=>{m[s]=exams.filter(e=>(e.subject||'Бусад')===s).length;return m;},{});
  const filteredExams = filterSubject==='all' ? exams : exams.filter(e=>(e.subject||'Бусад')===filterSubject);

  // Stats for currently selected exam (or all if none selected)
  const examStudents = currentExam ? students.filter(s=>s.examId===currentExam.id) : students;
  const avgScaled = examStudents.length ? (examStudents.reduce((a,b)=>a+b.scaled,0)/examStudents.length).toFixed(1) : '—';
  const passCount = examStudents.filter(s=>s.scaled>=60).length;

  const bg = d?'#1c1f2a':'white';
  const muted = d?'#9ca3af':'#6b7280';

  const stats = currentExam
    ? [
        ['Сурагч',examStudents.length,'#8b5cf6'],
        ['Дундаж ЭЕШ',avgScaled,'#22c55e'],
        ['Тэнцсэн',passCount,'#16a34a'],
        ['Тэнцэх %', examStudents.length ? (passCount/examStudents.length*100).toFixed(0)+'%' : '—', '#f97316'],
      ]
    : [
        ['Нийт шалгалт',exams.length,'#7B52EE'],
        ['Нийт сурагч',students.length,'#8b5cf6'],
        ['Дундаж ЭЕШ',avgScaled,'#22c55e'],
        ['Шалгагдсан',students.length,'#f97316'],
      ];

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 20px'}}>
      <div className="cm-hero" style={{display:'flex',alignItems:'center',gap:18,marginBottom:20}}>
        <img src="/chick.svg" alt="" style={{width:86,height:86,flexShrink:0,filter:'drop-shadow(0 8px 14px rgba(0,0,0,.25))',animation:'bob 3.4s ease-in-out infinite',position:'relative',zIndex:1}} />
        <div className="cm-hero-t" style={{marginBottom:0,flex:1,minWidth:0}}>
          <span className="cm-eyebrow">CyberMath · ЭЕШ</span>
          <h1>Хариултын хуудас шалгагч</h1>
          <p>Хуудсаа хэвлээд утасны камераар уншуул — оноо, анализ, рейтинг шууд гарна.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
            <button className="cm-btn amber" onClick={()=>onNavigate('scan')}>Камераар шалгах</button>
            <button className="cm-btn ghost" onClick={()=>onNavigate('create')}>+ Шалгалт үүсгэх</button>
          </div>
        </div>
      </div>
      <div className="cm-stats" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:24}}>
        {currentExam && (
          <div style={{gridColumn:'1/-1',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:10,padding:'8px 16px',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:'#7B52EE'}}>{currentExam.title}</span>
            <span style={{fontSize:12,color:muted}}>{currentExam.subject}</span>
            <button onClick={()=>onSelectExam(null)} style={{marginLeft:'auto',background:'none',border:'none',color:muted,cursor:'pointer',fontSize:12}}>✕ Бүгдийг харах</button>
          </div>
        )}
        {stats.map(([label,val,c])=>(
          <div key={label} style={{background:bg,borderRadius:12,padding:'16px 20px',boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
            <div style={{fontSize:28,fontWeight:900,color:c}}>{val}</div>
            <div style={{fontSize:12,color:muted,marginTop:4}}>{label}</div>
          </div>
        ))}
      </div>
      {exams.length===0?(
        <div style={{background:'white',borderRadius:12,padding:'44px',textAlign:'center',color:'#9ca3af'}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Шалгалт байхгүй байна</div>
          <button onClick={()=>onNavigate('create')} style={{marginTop:12,padding:'10px 22px',background:'#7B52EE',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>+ Шалгалт Үүсгэх</button>
        </div>
      ):(<>
        {/* Subject filter tabs */}
        {examSubjects.length > 1 && (
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14,padding:'8px 4px',borderBottom:'1px solid '+(d?'#2a2e38':'#e5e7eb')}}>
            <button onClick={()=>setFilterSubject('all')}
              style={{padding:'8px 14px',background:filterSubject==='all'?'#7B52EE':(d?'#2a2e38':'#f3f4f6'),color:filterSubject==='all'?'white':(d?'#d1d5db':'#4b5563'),border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>
              Бүгд ({exams.length})
            </button>
            {examSubjects.map(sub=>(
              <button key={sub} onClick={()=>setFilterSubject(sub)}
                style={{padding:'8px 14px',background:filterSubject===sub?'#7B52EE':(d?'#2a2e38':'#f3f4f6'),color:filterSubject===sub?'white':(d?'#d1d5db':'#4b5563'),border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {sub} ({subjectCounts[sub]})
              </button>
            ))}
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:12}}>
          {filteredExams.map(exam=>{
            const es=students.filter(s=>s.examId===exam.id);
            const avgS=es.length?(es.reduce((a,b)=>a+b.scaled,0)/es.length).toFixed(1):null;
            const act=currentExam?.id===exam.id;
            const rm=exam.sec1Scores?.reduce((a,b)=>a+b,0)||0;
            return (
              <div key={exam.id} onClick={()=>onSelectExam(exam)}
                style={{background:'white',borderRadius:12,padding:18,cursor:'pointer',border:`2px solid ${act?'#7B52EE':'#e5e7eb'}`,boxShadow:act?'0 0 0 4px #e5e7eb':'0 1px 4px rgba(17,24,39,.06)',transition:'all .2s'}}>
                <div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',gap:8,marginBottom:10}}>
                  <div style={{flex:'1 1 100%',minWidth:0}}>
                    <div style={{fontSize:15.5,fontWeight:900,color:'#1c1f2a',lineHeight:1.3}}>{exam.title}</div>
                    <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{exam.subject} · {exam.sec1Count} дасгал · Raw max: {rm}</div>
                    {exam.useSec2&&<div style={{fontSize:11,color:'#059669',marginTop:1}}>2-р хэсэг</div>}
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    {act&&<Badge>Идэвхтэй</Badge>}
                    <button onClick={e=>{e.stopPropagation();onEditExam(exam);}}
                      style={{padding:'4px 8px',background:'#dbeafe',border:'none',borderRadius:6,fontSize:11,color:'#1d4ed8',cursor:'pointer',fontWeight:700}}>Засах</button>
                    <button onClick={e=>{e.stopPropagation();const code=prompt('"'+exam.title+'" устгахын тулд УСТГАХ гэж бичнэ үү:');if(code==='УСТГАХ'){ onDeleteExam(exam.id);}}}
                      style={{padding:'4px 8px',background:'#fdecec',border:'none',borderRadius:6,fontSize:11,color:'#b3261e',cursor:'pointer'}}>Устгах</button>
                  </div>
                </div>
                <div style={{display:'flex',gap:14,alignItems:'flex-end'}}>
                  <div><div style={{fontSize:20,fontWeight:800,color:'#7B52EE'}}>{es.length}</div><div style={{fontSize:11,color:'#9ca3af'}}>Сурагч</div></div>
                  {avgS&&<div><div style={{fontSize:20,fontWeight:800,color:eyeshGrade(pf(avgS)).c}}>{avgS}</div><div style={{fontSize:11,color:'#9ca3af'}}>Дундаж ЭЕШ</div></div>}
                  <div style={{flex:1,textAlign:'right',fontSize:11,color:'#9ca3af'}}>{new Date(exam.createdAt).toLocaleDateString('mn-MN')}</div>
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button className="cm-btn" style={{flex:1,padding:'.6rem .8rem',fontSize:13.5}} onClick={e=>{e.stopPropagation();onSelectExam(exam);onNavigate('scan');}}>Шалгах</button>
                  <button className="cm-btn ghost" style={{flex:1,padding:'.6rem .8rem',fontSize:13.5}} onClick={e=>{e.stopPropagation();onSelectExam(exam);onNavigate('sheets');}}>Хуудас хэвлэх</button>
                </div>
              </div>
            );
          })}
        </div>
      </>)}
    </div>
  );
}

// ── Create Page ───────────────────────────────────────────
function CreatePage({onCreated, prefill, isEdit, dark:d=false}) {
  const cnt0 = prefill?.sec1Count||36;
  const [title,setTitle]=useState(prefill?.title||'');
  const [subject,setSubject]=useState(prefill?.subject||SUBJECTS[0]);
  const [cnt,setCnt]=useState(cnt0);
  const [useSec2,setUseSec2]=useState(prefill?.useSec2||false);
  const [keys,setKeys]=useState(()=>Array.from({length:cnt0},(_,i)=>prefill?.sec1Key?.[i]||'A'));
  const [scores,setScores]=useState(()=>Array.from({length:cnt0},(_,i)=>prefill?.sec1Scores?.[i]||2));
  const [topics,setTopics]=useState(()=>Array.from({length:cnt0},(_,i)=>prefill?.topics?.[i]||getTopics(prefill?.subject||SUBJECTS[0])[0]));
  const [sec2Score,setSec2Score]=useState(prefill?.sec2Score||1);
  const [sec2EnabledSubs,setSec2EnabledSubs]=useState(()=>SEC2_SUBS.map(s=>prefill?.sec2Config?.[s]?._enabled??true));
  const [sec2Keys,setSec2Keys]=useState(()=>{const o={};SEC2_SUBS.forEach(s=>{o[s]={};SEC2_ROWS.forEach(r=>{o[s][r]=prefill?.sec2Config?.[s]?.[r]||'';});});return o;});
  const [bulkScore,setBulkScore]=useState(2);
  const [bulkTopic,setBulkTopic]=useState(()=>getTopics(prefill?.subject||SUBJECTS[0])[0]);

  function handleCntChange(v) {
    const n=Math.max(1,parseInt(v)||1);
    setCnt(n);
    setKeys(k=>Array.from({length:n},(_,i)=>k[i]||'A'));
    setScores(s=>Array.from({length:n},(_,i)=>s[i]||2));
    setTopics(t=>Array.from({length:n},(_,i)=>t[i]||getTopics(subject)[0]));
  }

  function handleSave() {
    if(!title.trim()) return alert('Шалгалтын нэр оруулна уу');
    const sec2Config={};
    SEC2_SUBS.forEach((sub,si)=>{
      sec2Config[sub]={_enabled:sec2EnabledSubs[si]};
      SEC2_ROWS.forEach(row=>{
        const v=sec2Keys[sub]?.[row];
        sec2Config[sub][row]=typeof v==='object'?v:{ans:v||'',score:1};
      });
    });
    const exam = {
      id: isEdit&&prefill?.id ? prefill.id : uid(),
      title:title.trim(), subject, sec1Count:cnt,
      sec1Key:keys, sec1Scores:scores, topics, useSec2,
      sec2Score, sec2Config, createdAt:prefill?.createdAt||new Date().toISOString()
    };
    onCreated(exam);
  }

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'24px 20px'}}>
      <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(17,24,39,.06)',marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1c1f2a',marginBottom:16}}>1. Шалгалтын тохиргоо</div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Шалгалтын нэр</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Жишээ: Математик 2024 Дадлага 1"
            style={{width:'100%',padding:'10px 14px',border:'2px solid #e5e7eb',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box'}} />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
          <div>
            <label style={{fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Хичээл</label>
            <select value={subject} onChange={e=>setSubject(e.target.value)}
              style={{width:'100%',padding:'10px 14px',border:'2px solid #e5e7eb',borderRadius:10,fontSize:14,outline:'none'}}>
              {SUBJECTS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>1-р хэсэг дасгал (1-36)</label>
            <input type="number" min={1} max={200} value={cnt} onChange={e=>handleCntChange(e.target.value)}
              style={{width:'100%',padding:'10px 14px',border:'2px solid #e5e7eb',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box'}} />
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:24}}>
            <input type="checkbox" checked={useSec2} onChange={e=>setUseSec2(e.target.checked)} id="us2" style={{width:18,height:18}} />
            <label htmlFor="us2" style={{fontSize:14,fontWeight:600,color:'#374151',cursor:'pointer'}}>2-р хэсэг оролцуулах</label>
          </div>
        </div>
        {useSec2&&(
          <div style={{marginBottom:8,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {SEC2_SUBS.map((sub,si)=>(
                <label key={sub} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,fontWeight:600,padding:'6px 10px',background:sec2EnabledSubs[si]?'#dcfce7':'#f3f4f6',borderRadius:8,border:'1px solid '+(sec2EnabledSubs[si]?'#86efac':'#e5e7eb')}}>
                  <input type="checkbox" checked={!!sec2EnabledSubs[si]} onChange={e=>{const n=[...sec2EnabledSubs];n[si]=e.target.checked;setSec2EnabledSubs(n);}} style={{width:14,height:14}} />
                  {sub}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(17,24,39,.06)',marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1c1f2a',marginBottom:12}}>2. Зөв хариулт, оноо, сэдэв</div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:6}}>
          {Array.from({length:cnt},(_,i)=>(
            <div key={i} className="cm-keyrow" style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',background:'#f9fafb',borderRadius:8,border:'1px solid #e5e7eb'}}>
              <span className="cm-keyno" style={{fontSize:11,fontWeight:700,color:'#9ca3af',minWidth:26,textAlign:'right'}}>D{i+1}</span>
              <div className="cm-keych" style={{display:'flex',gap:2}}>
                {SEC1_CHOICES.map(c=>(
                  <button key={c} onClick={()=>setKeys(k=>{const n=[...k];n[i]=c;return n;})}
                    style={{width:28,height:28,borderRadius:6,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',background:keys[i]===c?'#7B52EE':'#e5e7eb',color:keys[i]===c?'white':'#6b7280'}}>{c}</button>
                ))}
              </div>
              <div className="cm-keyst" style={{display:'flex',alignItems:'center',gap:2}}>
                <button onClick={()=>setScores(s=>{const n=[...s];n[i]=Math.max(1,n[i]-1);return n;})}
                  style={{width:20,height:20,border:'1px solid #e5e7eb',borderRadius:4,fontSize:12,cursor:'pointer',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#6b7280'}}>−</button>
                <span style={{minWidth:20,textAlign:'center',fontSize:12,fontWeight:700,color:'#374151'}}>{scores[i]}</span>
                <button onClick={()=>setScores(s=>{const n=[...s];n[i]=Math.min(10,n[i]+1);return n;})}
                  style={{width:20,height:20,border:'1px solid #e5e7eb',borderRadius:4,fontSize:12,cursor:'pointer',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#6b7280'}}>+</button>
              </div>
              <select className="cm-keytp" value={topics[i]} onChange={e=>setTopics(t=>{const n=[...t];n[i]=e.target.value;return n;})}
                style={{flex:1,padding:'4px 8px',border:'none',borderRadius:8,fontWeight:700,fontSize:11,cursor:'pointer',background:TOPIC_COLORS[getTopics(subject).indexOf(topics[i])%8]+'22',color:TOPIC_COLORS[getTopics(subject).indexOf(topics[i])%8],outline:'none',minWidth:0}}>
                {getTopics(subject).map(tp=>(
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      {useSec2&&(
        <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(17,24,39,.06)',marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16,color:'#1c1f2a',marginBottom:12}}>3. 2-р хэсгийн зөв хариулт, оноо</div>
          {SEC2_SUBS.filter((_,i)=>sec2EnabledSubs[i]).map(sub=>(
            <div key={sub} style={{marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:14,color:'#7B52EE',marginBottom:8}}>Дэд хэсэг {sub}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:6}}>
                {SEC2_ROWS.map(row=>(
                  <div key={row} className="cm-s2key" style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',background:'#f9fafb',borderRadius:8,border:'1px solid #e5e7eb'}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#9ca3af',minWidth:14}}>{row}</span>
                    <input type="text" maxLength={1} value={typeof sec2Keys[sub]?.[row]==='object'?(sec2Keys[sub][row].ans||''):(sec2Keys[sub]?.[row]||'')} 
                      onChange={e=>{const v=e.target.value.replace(/[^0-9.-]/g,'');setSec2Keys(k=>({...k,[sub]:{...k[sub],[row]:{...(typeof k[sub]?.[row]==='object'?k[sub][row]:{ans:k[sub]?.[row]||''}),ans:v}}}));}}
                      placeholder="0-9" style={{width:44,padding:'5px 6px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,outline:'none',textAlign:'center'}} />
                    <span style={{fontSize:11,color:'#9ca3af'}}>оноо:</span>
                    <div style={{display:'flex',alignItems:'center',gap:2}}>
                      <button onClick={()=>setSec2Keys(k=>{const cur=typeof k[sub]?.[row]==='object'?k[sub][row]:{ans:k[sub]?.[row]||''};const sc=Math.max(0.5,Math.round(((cur.score||1)-0.5)*10)/10);return{...k,[sub]:{...k[sub],[row]:{...cur,score:sc}}};} )}
                        style={{width:20,height:20,border:'1px solid #e5e7eb',borderRadius:4,fontSize:12,cursor:'pointer',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#6b7280'}}>−</button>
                      <span style={{minWidth:28,textAlign:'center',fontSize:12,fontWeight:700}}>
                        {(typeof sec2Keys[sub]?.[row]==='object'?sec2Keys[sub][row].score:null)||1}
                      </span>
                      <button onClick={()=>setSec2Keys(k=>{const cur=typeof k[sub]?.[row]==='object'?k[sub][row]:{ans:k[sub]?.[row]||''};const sc=Math.min(20,Math.round(((cur.score||1)+0.5)*10)/10);return{...k,[sub]:{...k[sub],[row]:{...cur,score:sc}}};} )}
                        style={{width:20,height:20,border:'1px solid #e5e7eb',borderRadius:4,fontSize:12,cursor:'pointer',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#6b7280'}}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {isEdit && (
        <div style={{background:'#fff7e0',border:'1px solid #fde68a',color:'#7a4b00',borderRadius:12,padding:'10px 14px',marginBottom:12,fontSize:13.5,fontWeight:700,lineHeight:1.45}}>
          Хадгалахад энэ шалгалтын уншуулсан бүх хуудасны оноо, хувь шинэ зөв хариулт, оноогоор дахин бодогдоно.
        </div>
      )}
      <button onClick={handleSave} style={{width:'100%',padding:'14px',background:'#7B52EE',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:800,cursor:'pointer'}}>
        {isEdit ? 'Шалгалт Хадгалах (Засвар)' : 'Шалгалт Хадгалах'}
      </button>
    </div>
  );
}

// ── Rating Page ───────────────────────────────────────────
function RatingPage({exams, students, dark:d=false}) {
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterClass, setFilterClass]   = useState('all');
  const [openClass, setOpenClass]        = useState(null); // accordion

  // All unique subjects from exams
  const allSubjects = [...new Set(exams.map(e=>e.subject).filter(Boolean))].sort();

  // All unique classes from student codes
  // Code format: 202612100 → class is first 6 digits (202612) = year+month+classNum?
  // From image: classes look like full codes (202612100 etc.) grouped by prefix
  // Use student.class field if available, else derive from code prefix (first 6 chars)
  function getClass(s) { return s.class || (s.code||'').slice(0,6) || '—'; }
  // Natural sort: 10А, 10Б, 11А, 12А, 12Б etc
  function naturalSort(a, b) {
    const na = a.match(/^(\d+)(.*)/), nb = b.match(/^(\d+)(.*)/);
    if (na && nb) {
      const nd = parseInt(na[1]) - parseInt(nb[1]);
      if (nd !== 0) return nd;
      return na[2].localeCompare(nb[2], 'mn');
    }
    return a.localeCompare(b, 'mn');
  }
  const allClasses = [...new Set(students.map(getClass).filter(c=>c&&c!=='—'))].sort(naturalSort);

  // Build per-subject per-student average scores
  // Group exams by subject
  const examsBySubject = {};
  exams.forEach(e=>{
    if(!examsBySubject[e.subject]) examsBySubject[e.subject] = [];
    examsBySubject[e.subject].push(e);
  });

  // For each student, compute average per subject
  const studentMap = {}; // code -> {code, class, subjects:{subj: {avg, count, exams:[]}}}
  students.forEach(s=>{
    const key = s.code||s.id;
    if(!studentMap[key]) studentMap[key]={code:s.code,cls:getClass(s),subjects:{}};
    const subj = exams.find(e=>e.id===s.examId)?.subject;
    if(!subj) return;
    if(!studentMap[key].subjects[subj]) studentMap[key].subjects[subj]={scores:[],avg:0};
    studentMap[key].subjects[subj].scores.push(s.scaled);
  });
  // Compute averages
  Object.values(studentMap).forEach(st=>{
    Object.keys(st.subjects).forEach(subj=>{
      const sc = st.subjects[subj].scores;
      st.subjects[subj].avg = sc.length ? Math.round(sc.reduce((a,b)=>a+b,0)/sc.length*10)/10 : 0;
    });
  });

  // Filter by subject — show that subject's avg; if 'all' show overall avg across all subjects
  const visibleSubjects = filterSubject==='all' ? allSubjects : [filterSubject];

  // Build ranked list
  let ranked = Object.values(studentMap)
    .filter(st => filterClass==='all' || st.cls===filterClass)
    .map(st=>{
      const scores = visibleSubjects.flatMap(subj=>st.subjects[subj]?.scores||[]);
      const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10 : null;
      const subjectAvgs = visibleSubjects.map(subj=>({
        subj,
        avg: st.subjects[subj]?.avg??null,
        count: st.subjects[subj]?.scores?.length||0
      })).filter(x=>x.avg!==null);
      return {...st, avg, subjectAvgs};
    })
    .filter(st=>st.avg!==null)
    .sort((a,b)=>b.avg-a.avg);

  // Class accordion data — per class, ranked list
  const classGroups = allClasses.map(cls=>{
    const members = ranked.filter(st=>st.cls===cls);
    const clsAvg = members.length ? Math.round(members.reduce((a,b)=>a+b.avg,0)/members.length*10)/10 : 0;
    return {cls, members, clsAvg, count:members.length};
  }).filter(g=>g.count>0).sort((a,b)=>b.clsAvg-a.clsAvg);

  const bg = d?'#1c1f2a':'white';
  const borderC = d?'#2a2e38':'#e5e7eb';
  const textC = d?'#f3f4f6':'#1c1f2a';
  const mutedC = d?'#9ca3af':'#6b7280';
  const rowBg = d?'#0f1115':'#f9fafb';

  return (
    <div style={{maxWidth:1000,margin:'0 auto',padding:'24px 20px'}}>
      {/* Header */}
      <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:20,padding:'20px 22px',color:'#1c1f2a',marginBottom:20}}>
        <div style={{fontSize:11,letterSpacing:2,opacity:.7,marginBottom:4}}>CYBERMATH · ЭЕШ</div>
        <div style={{fontSize:26,fontWeight:900}}>Рейтинг</div>
        <div style={{opacity:.8,fontSize:13,marginTop:4}}>Судлагдахуунаар, кодоор эрэмбэлсэн</div>
      </div>

      {/* Subject filter */}
      <div style={{background:bg,borderRadius:14,padding:'14px 16px',marginBottom:12,boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
        <div style={{fontSize:11,fontWeight:700,color:mutedC,marginBottom:8,letterSpacing:1}}>СУДЛАГДАХУУН</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button onClick={()=>setFilterSubject('all')}
            style={{padding:'6px 14px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',
              background:filterSubject==='all'?'#7B52EE':(d?'#2a2e38':'#f3f4f6'),
              color:filterSubject==='all'?'white':(d?'#e5e7eb':'#374151')}}>
            Бүгд
          </button>
          {allSubjects.map(s=>(
            <button key={s} onClick={()=>setFilterSubject(s)}
              style={{padding:'6px 14px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',
                background:filterSubject===s?'#7B52EE':(d?'#2a2e38':'#f3f4f6'),
                color:filterSubject===s?'white':(d?'#e5e7eb':'#374151')}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Class accordion filter */}
      {allClasses.length>0&&(
        <div style={{background:bg,borderRadius:14,padding:'14px 16px',marginBottom:16,boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
          <div style={{fontSize:11,fontWeight:700,color:mutedC,marginBottom:8,letterSpacing:1}}>АНГИ</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={()=>{setFilterClass('all');setOpenClass(null);}}
              style={{padding:'6px 14px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',
                background:filterClass==='all'?'#7B52EE':(d?'#2a2e38':'#f3f4f6'),
                color:filterClass==='all'?'white':(d?'#e5e7eb':'#374151')}}>
              Бүгд
            </button>
            {allClasses.map(cls=>(
              <button key={cls}
                onClick={()=>{
                  setFilterClass(cls);
                  setOpenClass(o=>o===cls?null:cls);
                }}
                style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(openClass===cls?'#7B52EE':borderC),fontWeight:700,fontSize:12,cursor:'pointer',
                  background:filterClass===cls?'#7B52EE':(d?'#2a2e38':'#f3f4f6'),
                  color:filterClass===cls?'white':(d?'#e5e7eb':'#374151')}}>
                {cls} {openClass===cls?'▲':'▼'}
              </button>
            ))}
          </div>
          {/* Accordion — show members of openClass */}
          {openClass&&(()=>{
            const grp = classGroups.find(g=>g.cls===openClass);
            if(!grp||!grp.members.length) return null;
            return (
              <div style={{marginTop:12,borderTop:'1px solid '+borderC,paddingTop:12}}>
                <div style={{fontSize:12,fontWeight:700,color:mutedC,marginBottom:8}}>{openClass} — {grp.count} сурагч · дундаж {grp.clsAvg}%</div>
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  {grp.members.map((st,i)=>{
                    const g=eyeshGrade(st.avg);
                    return (
                      <div key={st.code} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,background:i%2===0?(d?'#1c1f2a':rowBg):(d?'#0f1115':'white')}}>
                        <span style={{minWidth:24,fontSize:12,fontWeight:800,color:mutedC}}>{i+1}</span>
                        <span style={{flex:1,fontSize:13,fontWeight:700,color:textC,fontFamily:'monospace'}}>{st.code}</span>
                        {st.subjectAvgs.map(sa=>(
                          <span key={sa.subj} style={{fontSize:11,color:mutedC}}>
                            {filterSubject==='all'?sa.subj+': ':''}<span style={{fontWeight:700,color:eyeshGrade(sa.avg).c}}>{sa.avg}%</span>
                            {sa.count>1&&<span style={{fontSize:10,color:mutedC}}> ×{sa.count}</span>}
                          </span>
                        ))}
                        <span style={{fontSize:15,fontWeight:900,color:g.c,minWidth:46,textAlign:'right'}}>{st.avg}%</span>
                        <div style={{width:30,height:30,borderRadius:'50%',background:g.c,color:'white',fontWeight:900,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>{g.g}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Main ranked list */}
      <div style={{background:bg,borderRadius:14,boxShadow:'0 1px 4px rgba(17,24,39,.06)',overflow:'hidden'}}>
        {ranked.length===0
          ? <div style={{textAlign:'center',padding:60,color:mutedC}}>Өгөгдөл байхгүй</div>
          : ranked.map((st,i)=>{
              const g = eyeshGrade(st.avg);
              const isMedal = i<3;
              return (
                <div key={st.code} style={{
                  display:'flex',alignItems:'center',gap:12,padding:'11px 18px',
                  borderBottom:'1px solid '+borderC,
                  background:i===0?(d?'#2d1f00':'#fffbeb'):i===1?(d?'#1a2030':'#f9fafb'):i===2?(d?'#271a0a':'#fef3e2'):bg
                }}>
                  <div style={{minWidth:32,textAlign:'center'}}>
                    {isMedal
                      ? <span style={{fontSize:20}}>{['🥇','🥈','🥉'][i]}</span>
                      : <span style={{fontSize:13,fontWeight:800,color:mutedC}}>{i+1}</span>}
                  </div>
                  {/* Code only */}
                  <div style={{flex:1,fontFamily:'monospace',fontSize:15,fontWeight:800,color:textC}}>{st.code}</div>
                  {/* Per-subject averages */}
                  {filterSubject==='all'
                    ? <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {st.subjectAvgs.map(sa=>(
                          <span key={sa.subj} style={{fontSize:11,background:eyeshGrade(sa.avg).c+'18',color:eyeshGrade(sa.avg).c,padding:'2px 8px',borderRadius:5,fontWeight:700}}>
                            {sa.subj}: {sa.avg}%{sa.count>1?` ×${sa.count}`:''}
                          </span>
                        ))}
                      </div>
                    : <div style={{fontSize:11,color:mutedC}}>
                        {st.subjectAvgs[0]?.count>1?`${st.subjectAvgs[0].count} шалгалтын дундаж`:''}
                      </div>
                  }
                  <div style={{textAlign:'right',minWidth:60}}>
                    <div style={{fontSize:18,fontWeight:900,color:g.c}}>{st.avg}%</div>
                    <div style={{fontSize:10,color:g.c,background:g.c+'18',padding:'1px 6px',borderRadius:4,display:'inline-block',fontWeight:700}}>{g.l}</div>
                  </div>
                  <div style={{width:32,height:32,borderRadius:'50%',background:g.c,color:'white',fontWeight:900,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{g.g}</div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── Board Page ────────────────────────────────────────────
function BoardPage({exam, students, onDeleteStudent, onExportExcel, onReload, dark:d=false}) {
  if (!exam) return <div style={{textAlign:'center',padding:80,color:'#9ca3af',fontWeight:600}}>Шалгалт сонгоно уу</div>;
  const sorted=[...students].sort((a,b)=>b.scaled-a.scaled);
  const [pdfOpen, setPdfOpen] = useState(false);
  // ── ZipGrade CSV import ──
  const [zipOpen, setZipOpen] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipResult, setZipResult] = useState(null);
  const [zipErr, setZipErr] = useState('');
  async function handleZipImport(file) {
    if (!file) return;
    setZipBusy(true); setZipErr(''); setZipResult(null);
    try {
      const csvText = await file.text();
      const r = await apiFetch('/api/exams/import-zipgrade', {
        method:'POST', body:{ examId: exam.id, csvText }
      });
      setZipResult(r);
      if (onReload) await onReload();
    } catch(e) { setZipErr(e.message||'CSV импортлоход алдаа'); }
    setZipBusy(false);
  }
  // ── Student edit modal (Sec1 + Sec2) ──
  const [editStu, setEditStu] = useState(null); // student object or null
  const [sec1Vals, setSec1Vals] = useState([]);
  const [sec2Vals, setSec2Vals] = useState({});
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [editTab, setEditTab] = useState('sec1');
  function openEdit(student, defaultTab='sec1') {
    // Sec1 — seed from existing answers
    const N = exam.sec1Count || (exam.sec1Key||[]).length || 36;
    const byQ = {};
    (student.sec1Results||[]).forEach(r=>{ if (r?.q) byQ[r.q] = r.sel; });
    const s1 = [];
    for (let i = 0; i < N; i++) {
      const v = byQ[i+1];
      s1.push((v && v !== 'BLANK') ? String(v) : '');
    }
    // Sec2 — seed from existing answers
    const s2 = {};
    const cfg = exam.sec2Config || {};
    ['2.1','2.2','2.3','2.4'].forEach(sub=>{
      if (!cfg[sub]?._enabled) return;
      s2[sub] = {};
      ['a','b','c','d','e','f','g','h'].forEach(rk=>{
        const item = cfg[sub][rk];
        if (!item) return;
        const ans = typeof item==='object'?item.ans:item;
        if (ans===undefined||ans===null||ans==='') return;
        const cur = student.sec2Results?.[sub]?.[rk]?.sel;
        s2[sub][rk] = (cur && cur!=='BLANK') ? String(cur) : '';
      });
    });
    setSec1Vals(s1); setSec2Vals(s2); setEditErr(''); setEditTab(defaultTab); setEditStu(student);
  }
  async function saveEdit() {
    if (!editStu) return;
    setEditBusy(true); setEditErr('');
    try {
      await apiFetch('/api/students/sec2', {
        method:'PATCH',
        body: { studentId: editStu.id, sec1: sec1Vals, sec2: sec2Vals }
      });
      if (onReload) await onReload();
      setEditStu(null);
    } catch(e) { setEditErr(e.message||'Хадгалахад алдаа'); }
    setEditBusy(false);
  }

  // Сурагчийн дүнгийн PDF (нэг сурагч эсвэл анги бүхэлдээ) — монгол үсэгтэй (lib/report-pdf.js)
  function exportStudentPDF(student) {
    downloadResultsPdf(exam, [student], (student.name||student.code||'сурагч')+'_'+exam.title+'.pdf').catch(e=>alert('PDF үүсгэж чадсангүй: '+(e.message||e)));
  }
  function exportClassPDFs(classname) {
    const list = classname === '__all__' ? sorted : sorted.filter(s => (s.class||'') === classname);
    if (!list.length) return;
    downloadResultsPdf(exam, list, exam.title+'_'+(classname === '__all__' ? 'бүгд' : classname)+'.pdf').catch(e=>alert('PDF үүсгэж чадсангүй: '+(e.message||e)));
  }

  const classes = [...new Set(sorted.map(s => s.class||'').filter(Boolean))].sort();

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:d?'#f3f4f6':'#1c1f2a'}}>{exam.title} — Жагсаалт</h1>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>setZipOpen(true)} style={{padding:'10px 16px',background:'linear-gradient(135deg,#0369a1,#0284c7)',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
            📥 ZipGrade CSV
          </button>
          <button onClick={()=>onExportExcel(exam,students)} style={{padding:'10px 16px',background:'linear-gradient(135deg,#16a34a,#22c55e)',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
            Excel татах
          </button>
          {/* Bulk PDF buttons */}
          <div style={{position:'relative',display:'inline-block'}}>
            <button
              onClick={()=>setPdfOpen(o=>!o)}
              style={{padding:'10px 16px',background:'#7B52EE',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              PDF бөөнөөр {pdfOpen?'↑':'↓'}
            </button>
            {pdfOpen&&(
              <div style={{position:'absolute',right:0,top:'100%',marginTop:4,background:d?'#1c1f2a':'white',border:'1px solid '+(d?'#2a2e38':'#e5e7eb'),borderRadius:10,boxShadow:'0 4px 20px rgba(0,0,0,.12)',zIndex:50,minWidth:200,overflow:'hidden'}}>
                <div style={{padding:'8px 16px',fontSize:11,color:'#9ca3af',fontWeight:700,borderBottom:'1px solid '+(d?'#2a2e38':'#f3f4f6'),letterSpacing:1}}>АНГИ СОНГОХ</div>
                <button onClick={()=>{exportClassPDFs('__all__');setPdfOpen(false);}}
                  style={{display:'block',width:'100%',padding:'10px 16px',background:'none',border:'none',textAlign:'left',cursor:'pointer',fontSize:13,fontWeight:700,color:d?'#f3f4f6':'#1c1f2a',borderBottom:'1px solid '+(d?'#2a2e38':'#f3f4f6')}}>
                  Бүгд ({sorted.length} сурагч)
                </button>
                {classes.map(cls=>(
                  <button key={cls} onClick={()=>{exportClassPDFs(cls);setPdfOpen(false);}}
                    style={{display:'block',width:'100%',padding:'10px 16px',background:'none',border:'none',textAlign:'left',cursor:'pointer',fontSize:13,color:d?'#e5e7eb':'#374151',borderBottom:'1px solid '+(d?'#2a2e38':'#f3f4f6')}}>
                    {cls} ({sorted.filter(s=>(s.class||'')===cls).length} сурагч)
                  </button>
                ))}
                <button onClick={()=>setPdfOpen(false)}
                  style={{display:'block',width:'100%',padding:'8px 16px',background:'none',border:'none',textAlign:'center',cursor:'pointer',fontSize:12,color:'#9ca3af'}}>
                  Хаах
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {sorted.length===0?(
        <div style={{background:d?'#1c1f2a':'white',borderRadius:12,padding:'44px',textAlign:'center',color:'#9ca3af'}}>Одоохондоо сурагч байхгүй</div>
      ):(
        <>
        <div className="cm-card cm-only-phone" style={{padding:0,overflow:'hidden'}}>
          {sorted.map((s,i)=>{
            const g=eyeshGrade(s.scaled);
            return (
              <div key={s.id} className="cm-srow">
                <div className="cm-srow-top">
                  <span className="cm-srank">{i+1}</span>
                  <div className="cm-sinfo"><b>{s.name}</b><span>{[s.class,s.code,s.version&&s.version!=='—'?'Хув. '+s.version:''].filter(Boolean).join(' · ')||'—'}</span></div>
                  <div className="cm-sscore" style={{color:g.c}}><b>{s.scaled}</b><span>{g.g} · {g.l}</span></div>
                </div>
                <div className="cm-schips"><i className="ok">✓ {s.correct} зөв</i><i className="ng">✗ {s.wrong} буруу</i><i>○ {s.blank} хоосон</i></div>
                <div className="cm-sacts">
                  <button className="e" onClick={()=>openEdit(s,'sec1')}>✏️ Засах</button>
                  <button className="p" onClick={()=>exportStudentPDF(s)}>PDF</button>
                  <button className="x" onClick={()=>{const c=prompt(s.name+' устгахын тулд УСТГАХ гэж бичнэ үү:');if(c==='УСТГАХ')onDeleteStudent(s.id);}}>Устгах</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="cm-only-desk" style={{background:d?'#1c1f2a':'white',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:d?'#0f1115':'#f9fafb',borderBottom:'2px solid '+(d?'#2a2e38':'#e5e7eb')}}>
                {['#','Нэр','Код','Хув.','Зөв','Буруу','Хоосон','Гүйцэтгэл','Засах','PDF',''].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:12,fontWeight:700,color:'#6b7280'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s,i)=>{
                const g=eyeshGrade(s.scaled);
                return (
                  <tr key={s.id} style={{borderBottom:'1px solid '+(d?'#1c1f2a':'#f3f4f6'),background:d?'#1c1f2a':'white'}}>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#9ca3af'}}>{i+1}</td>
                    <td style={{padding:'10px 14px',fontSize:14,fontWeight:700,color:d?'#f3f4f6':'#1c1f2a'}}>{s.name}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#6b7280'}}>{s.code}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:d?'#9ca3af':'#6b7280'}}>{s.version}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#16a34a',fontWeight:600}}>{s.correct}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#dc2626',fontWeight:600}}>{s.wrong}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#9ca3af'}}>{s.blank}</td>
                    <td style={{padding:'10px 14px',fontSize:16,fontWeight:800,color:g.c}}>{s.scaled}%</td>
                    <td style={{padding:'10px 14px'}}>
                      <button onClick={()=>openEdit(s,'sec1')}
                        style={{padding:'3px 8px',background:'#dbeafe',border:'none',borderRadius:6,fontSize:11,color:'#1e40af',cursor:'pointer',fontWeight:700}}>✏️ Засах</button>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <button onClick={()=>exportStudentPDF(s)}
                        style={{padding:'3px 8px',background:'#fef3c7',border:'none',borderRadius:6,fontSize:11,color:'#92400e',cursor:'pointer',fontWeight:700}}>PDF</button>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <button onClick={()=>{const c=prompt(s.name+' устгахын тулд УСТГАХ гэж бичнэ үү:');if(c==='УСТГАХ')onDeleteStudent(s.id);}}
                        style={{padding:'3px 8px',background:'#fdecec',border:'none',borderRadius:6,fontSize:11,color:'#b3261e',cursor:'pointer'}}>Устгах</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* ── ZipGrade CSV import modal ── */}
      {zipOpen && (
        <div onClick={()=>!zipBusy&&setZipOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:d?'#1c1f2a':'white',borderRadius:14,padding:24,maxWidth:560,width:'100%',maxHeight:'90vh',overflow:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:800,color:d?'#f3f4f6':'#1c1f2a'}}>📥 ZipGrade CSV оруулах</h2>
              <button onClick={()=>!zipBusy&&setZipOpen(false)} style={{border:'none',background:'none',fontSize:22,cursor:'pointer',color:'#9ca3af'}}>×</button>
            </div>
            <div style={{fontSize:13,color:d?'#d1d5db':'#6b7280',marginBottom:16,lineHeight:1.6}}>
              ZipGrade-н <b>"Quiz Results CSV"</b> файлыг оруулна уу. Зөвхөн <b>1-р хэсэг (A–E)</b> автоматаар тооцогдоно. <b>2-р хэсгийг</b> сурагч бүрд "Sec2" товчоор гар оруулна.
              <ul style={{marginTop:8,paddingLeft:18,fontSize:12}}>
                <li>Шаардлагатай багана: <code>Stu1, Stu2, ..., Stu{exam.sec1Count||36}</code></li>
                <li>Сурагчийн код: <code>ExternalId</code> баганаас (эсвэл FirstName)</li>
                <li>Давхардсан кодтой сурагч <b>солигдоно</b></li>
              </ul>
            </div>
            {!zipResult && !zipBusy && (
              <label style={{display:'block',padding:30,border:'2px dashed '+(d?'#4b5563':'#d1d5db'),borderRadius:10,textAlign:'center',cursor:'pointer',background:d?'#0f1115':'#f9fafb'}}>
                <div style={{fontSize:32,marginBottom:6}}>📄</div>
                <div style={{fontSize:14,fontWeight:700,color:d?'#f3f4f6':'#1c1f2a'}}>CSV файл сонгох</div>
                <div style={{fontSize:12,color:'#9ca3af',marginTop:4}}>.csv файлыг энд дарж оруулна уу</div>
                <input type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={e=>handleZipImport(e.target.files?.[0])} />
              </label>
            )}
            {zipBusy && <div style={{textAlign:'center',padding:30,color:'#9ca3af'}}>Импортлож байна...</div>}
            {zipErr && <div style={{padding:12,background:'#fdecec',color:'#b3261e',borderRadius:8,marginTop:10,fontSize:13}}>{zipErr}</div>}
            {zipResult && (
              <div style={{marginTop:16}}>
                <div style={{padding:14,background:'#dcfce7',color:'#166534',borderRadius:8,fontSize:14,fontWeight:700}}>
                  ✅ Амжилттай: {zipResult.imported} нэмэгдсэн · {zipResult.replaced} шинэчилсэн · {zipResult.skipped} алгассан
                </div>
                <div style={{fontSize:12,color:d?'#d1d5db':'#6b7280',marginTop:8}}>
                  Нийт оноо: {zipResult.totalMax} (Sec1: {zipResult.sec1Max} + Sec2: {zipResult.sec2Max})
                </div>
                {zipResult.errors?.length>0 && (
                  <div style={{marginTop:8,padding:10,background:'#fef3c7',color:'#92400e',borderRadius:8,fontSize:12,maxHeight:120,overflow:'auto'}}>
                    <b>Алдаа:</b>
                    {zipResult.errors.map((e,i)=>(<div key={i}>· {e}</div>))}
                  </div>
                )}
                <button onClick={()=>{setZipOpen(false);setZipResult(null);}} style={{marginTop:14,padding:'10px 18px',background:'#16a34a',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',width:'100%'}}>
                  Хаах
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Student edit modal (Sec1 + Sec2) ── */}
      {editStu && (
        <div onClick={()=>!editBusy&&setEditStu(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:d?'#1c1f2a':'white',borderRadius:14,padding:24,maxWidth:820,width:'100%',maxHeight:'90vh',overflow:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:800,color:d?'#f3f4f6':'#1c1f2a'}}>
                ✏️ {editStu.name} <span style={{fontSize:12,color:'#9ca3af',fontWeight:500}}>({editStu.code})</span>
              </h2>
              <button onClick={()=>!editBusy&&setEditStu(null)} style={{border:'none',background:'none',fontSize:22,cursor:'pointer',color:'#9ca3af'}}>×</button>
            </div>
            {/* Tabs */}
            <div style={{display:'flex',gap:4,marginBottom:14,borderBottom:'1px solid '+(d?'#2a2e38':'#e5e7eb')}}>
              <button onClick={()=>setEditTab('sec1')}
                style={{padding:'8px 16px',background:editTab==='sec1'?(d?'#1e40af':'#dbeafe'):'transparent',color:editTab==='sec1'?(d?'#dbeafe':'#1e40af'):(d?'#9ca3af':'#6b7280'),border:'none',borderBottom:editTab==='sec1'?'2px solid #1e40af':'2px solid transparent',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                1-р хэсэг (A–E)
              </button>
              {exam.useSec2 && (
                <button onClick={()=>setEditTab('sec2')}
                  style={{padding:'8px 16px',background:editTab==='sec2'?(d?'#1e40af':'#dbeafe'):'transparent',color:editTab==='sec2'?(d?'#dbeafe':'#1e40af'):(d?'#9ca3af':'#6b7280'),border:'none',borderBottom:editTab==='sec2'?'2px solid #1e40af':'2px solid transparent',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                  2-р хэсэг (0–9)
                </button>
              )}
            </div>

            {/* Section 1 */}
            {editTab==='sec1' && (
              <div>
                <div style={{fontSize:12,color:d?'#d1d5db':'#6b7280',marginBottom:10}}>
                  Асуулт бүрд A/B/C/D/E эсвэл хоосон сонго.
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
                  {sec1Vals.map((val,i)=>{
                    const key = exam.sec1Key?.[i] || '';
                    const pts = exam.sec1Scores?.[i] || 1;
                    return (
                      <div key={i} style={{padding:8,border:'1px solid '+(d?'#2a2e38':'#e5e7eb'),borderRadius:8,background:d?'#0f1115':'#f9fafb',display:'flex',alignItems:'center',gap:6}}>
                        <div style={{fontSize:11,fontWeight:700,color:d?'#d1d5db':'#6b7280',width:32}}>Q{i+1}</div>
                        <div style={{display:'flex',gap:2,flex:1}}>
                          {['A','B','C','D','E'].map(c=>(
                            <button key={c} onClick={()=>setSec1Vals(p=>{const n=[...p];n[i]=n[i]===c?'':c;return n;})}
                              style={{padding:'4px 6px',minWidth:24,border:'1px solid '+(d?'#4b5563':'#d1d5db'),borderRadius:4,background:val===c?(c===key?'#16a34a':'#dc2626'):(d?'#1c1f2a':'white'),color:val===c?'white':(d?'#f3f4f6':'#1c1f2a'),fontSize:11,fontWeight:700,cursor:'pointer'}}>
                              {c}
                            </button>
                          ))}
                        </div>
                        <div style={{fontSize:10,color:'#9ca3af',whiteSpace:'nowrap'}}>{key}·{pts}о</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2 */}
            {editTab==='sec2' && (
              <div>
                <div style={{fontSize:12,color:d?'#d1d5db':'#6b7280',marginBottom:10}}>
                  Сурагчийн оруулсан 0–9 цифрийг бичнэ үү. Хоосон үлдээвэл "blank".
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
                  {Object.keys(sec2Vals).sort().map(sub=>(
                    <div key={sub} style={{padding:12,border:'1px solid '+(d?'#2a2e38':'#e5e7eb'),borderRadius:10,background:d?'#0f1115':'#f9fafb'}}>
                      <div style={{fontWeight:800,fontSize:14,color:d?'#f3f4f6':'#1c1f2a',marginBottom:8}}>{sub}</div>
                      <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto',gap:6,alignItems:'center'}}>
                        {Object.keys(sec2Vals[sub]).map(rk=>{
                          const cfg = exam.sec2Config?.[sub]?.[rk];
                          const ans = typeof cfg==='object'?cfg.ans:cfg;
                          const pts = typeof cfg==='object'?(cfg.score!=null?cfg.score:1):(exam.sec2Score||1);
                          return (
                            <div key={rk} style={{display:'contents'}}>
                              <div style={{fontSize:12,fontWeight:700,color:d?'#d1d5db':'#6b7280',width:18}}>{rk})</div>
                              <input
                                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1}
                                value={sec2Vals[sub][rk]}
                                onChange={e=>{
                                  const v = e.target.value.replace(/[^0-9]/g,'').slice(0,1);
                                  setSec2Vals(prev=>({...prev,[sub]:{...prev[sub],[rk]:v}}));
                                }}
                                style={{width:42,padding:'6px 8px',border:'1px solid '+(d?'#4b5563':'#d1d5db'),borderRadius:6,textAlign:'center',fontWeight:700,fontSize:14,background:d?'#1c1f2a':'white',color:d?'#f3f4f6':'#1c1f2a'}}
                              />
                              <div style={{fontSize:11,color:'#9ca3af',whiteSpace:'nowrap'}}>зөв={ans} ({pts}о)</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editErr && <div style={{marginTop:10,padding:10,background:'#fdecec',color:'#b3261e',borderRadius:8,fontSize:13}}>{editErr}</div>}
            <div style={{display:'flex',gap:8,marginTop:18,position:'sticky',bottom:0,background:d?'#1c1f2a':'white',padding:'10px 0 0'}}>
              <button onClick={saveEdit} disabled={editBusy} style={{flex:1,padding:'12px 18px',background:'#16a34a',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:editBusy?'wait':'pointer',opacity:editBusy?0.6:1}}>
                {editBusy?'Хадгалж байна...':'Хадгалах'}
              </button>
              <button onClick={()=>setEditStu(null)} disabled={editBusy} style={{padding:'12px 18px',background:'#e5e7eb',color:'#4b5563',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
                Цуцлах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics Page ────────────────────────────────────────
function AnalyticsPage({exam, students, teacherName, dark:d=false}) {
  const [filterClass, setFilterClass] = useState('');
  const [school, setSchool] = useState(() => { try { return localStorage.getItem('eyesh_report_school') || ''; } catch(e) { return ''; } });
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const allClasses = [...new Set(students.map(s=>s.class||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'mn'));
  const filtered = filterClass ? students.filter(s=>(s.class||'')===filterClass) : students;
  if (!exam||!students.length) return <div style={{textAlign:'center',padding:80,color:'#9ca3af',fontWeight:600}}>Дүн шинжилгээнд хангалттай өгөгдөл байхгүй</div>;
  async function exportXlsx() {
    setXlsxBusy(true);
    try { localStorage.setItem('eyesh_report_school', school.trim()); } catch(e) {}
    try { await exportAnalysisXlsx(exam, filtered, { school: school.trim(), teacherName, label: filterClass }); }
    catch(e) { alert('Excel үүсгэж чадсангүй: '+(e.message||e)); }
    setXlsxBusy(false);
  }
  const n=filtered.length||1, ss=filtered.map(s=>s.scaled);
  const avg=(ss.reduce((a,b)=>a+b,0)/n).toFixed(1);
  const pass=filtered.filter(s=>s.scaled>=60).length;
  const sorted=[...ss].sort((a,b)=>a-b);
  const median=sorted[Math.floor(filtered.length/2)]||0;
  const grades=['A','B','C','D','E','F'];
  const gradeLabels=['Онц','Сайн','Дунд сайн','Хангалттай','Хангалтгүй','Тэнцээгүй'];
  const gradeColors=['#15803d','#1d4ed8','#0369a1','#d97706','#ea580c','#dc2626'];
  const gradeCounts=grades.map(g=>filtered.filter(s=>s.grade?.g===g).length);

  // Topic analysis
  const topicMap={};
  exam.sec1Key?.forEach((_,i)=>{
    const t=exam.topics?.[i]||'Бусад';
    if(!topicMap[t]) topicMap[t]={total:0,correct:0};
    topicMap[t].total+=filtered.length;
    filtered.forEach(s=>{if(s.sec1Results?.[i]?.st==='ok') topicMap[t].correct++;});
  });

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:800}}>Дүн Шинжилгээ</h1>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            <button onClick={()=>setFilterClass('')} style={{padding:'6px 12px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',background:filterClass===''?'#7B52EE':'#f3f4f6',color:filterClass===''?'white':'#374151'}}>Бүгд</button>
            {allClasses.map(c=>(
              <button key={c} onClick={()=>setFilterClass(c)} style={{padding:'6px 12px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',background:filterClass===c?'#7B52EE':'#f3f4f6',color:filterClass===c?'white':'#374151'}}>{c}</button>
            ))}
          </div>
          <input value={school} onChange={e=>setSchool(e.target.value)} placeholder="Сургуулийн нэр (тайлангийн толгойд)" title="Excel тайлангийн толгойд гарна"
            style={{padding:'9px 12px',border:'1.6px solid #e5e7eb',borderRadius:8,fontSize:13,minWidth:230,outline:'none',background:'#fff',color:'#1c1f2a'}} />
          <button onClick={exportXlsx} disabled={xlsxBusy} style={{padding:'10px 14px',background:'linear-gradient(135deg,#16a34a,#22c55e)',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',opacity:xlsxBusy?.7:1}}>
            {xlsxBusy ? 'Үүсгэж байна…' : 'Анализ Excel татах'}
          </button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:20}}>
        {[['Нийт сурагч',filtered.length,'#7B52EE'],['Дундаж ЭЕШ',avg,eyeshGrade(pf(avg)).c],['Медиан',median,'#7B52EE'],['Тэнцсэн',pass+'/'+filtered.length,'#16a34a'],['Тэнцэх %',filtered.length?+(pass/filtered.length*100).toFixed(1):0,'#f97316']].map(([l,v,c])=>(
          <div key={l} style={{background:'white',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
            <div style={{fontSize:26,fontWeight:900,color:c}}>{v}</div>
            <div style={{fontSize:12,color:'#9ca3af',marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>
      <div className="cm-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div style={{background:'white',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Зэрэглэлийн тархалт</div>
          {grades.map((g,i)=>{
            const cnt=gradeCounts[i];
            const pct=n?+(cnt/n*100).toFixed(1):0;
            return (
              <div key={g} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{fontWeight:600}}>{g} — {gradeLabels[i]}</span>
                  <span style={{color:'#6b7280'}}>{cnt} ({pct}%)</span>
                </div>
                <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',background:gradeColors[i],width:pct+'%',borderRadius:4,transition:'width .3s'}} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{background:'white',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Сэдвийн амжилт</div>
          {Object.entries(topicMap).map(([t,d])=>{
            const pct=d.total?+(d.correct/d.total*100).toFixed(1):0;
            const subjectTopics=getTopics(exam.subject);const ci=subjectTopics.indexOf(t);
            return (
              <div key={t} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{fontWeight:600}}>{t}</span>
                  <span style={{color:'#6b7280'}}>{pct}%</span>
                </div>
                <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',background:TOPIC_COLORS[ci>=0?ci%8:7],width:pct+'%',borderRadius:4}} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Student Accounts Page ─────────────────────────────────
function StudentAccountsPage({dark:d=false}) {
  const [accounts, setAccounts] = useState([]);
  const [filterCls, setFilterCls] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkText, setBulkText] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [singleCode, setSingleCode] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singleClass, setSingleClass] = useState('');

  useEffect(()=>{ loadAccounts(); },[]);

  async function loadAccounts() {
    setLoading(true);
    try { setAccounts(await apiFetch('/api/student-accounts')); } catch(e) {}
    setLoading(false);
  }

  function genStudentCode(existing=new Set()) {
    let code;
    do { code = '202612' + String(Math.floor(1000 + Math.random() * 9000)); }
    while (existing.has(code));
    return code;
  }

  async function handleBulkAdd() {
    const lines = bulkText.trim().split('\n').map(l=>l.trim()).filter(Boolean);
    if (!lines.length) return;
    setAdding(true); setMsg('');
    const existingCodes = new Set(accounts.map(a=>a.code));
    const usedCodes = new Set();
    const items = lines.map(l=>{
      const parts = l.split(/[,\t]+/);
      // Format: нэр, анги (код хоосон бол автоматаар үүснэ)
      const name = parts[0]?.trim()||'';
      const cls  = parts[1]?.trim()||'';
      const all  = new Set([...existingCodes, ...usedCodes]);
      const code = genStudentCode(all);
      usedCodes.add(code);
      return { id:uid(), code, name, class:cls, createdAt:new Date().toISOString() };
    });
    const newItems = items.filter(i => !existingCodes.has(i.code));
    const skipped = items.length - newItems.length;
    if (!newItems.length) { setMsg('Бүгд давхардсан код байна'); setAdding(false); return; }
    try {
      await apiFetch('/api/student-accounts', {method:'POST', body:newItems});
      setMsg(newItems.length+' сурагч нэмэгдлээ'+(skipped>0?' ('+skipped+' давхардсан алгасав)':''));
      setBulkText('');
      loadAccounts();
    } catch(e) { setMsg('Алдаа: '+e.message); }
    setAdding(false);
  }

  async function handleSingleAdd() {
    const existingCodes = new Set(accounts.map(a=>a.code));
    const code = genStudentCode(existingCodes);
    setAdding(true);
    try {
      await apiFetch('/api/student-accounts', {method:'POST', body:{id:uid(), code, name:singleName.trim(), class:singleClass.trim(), createdAt:new Date().toISOString()}});
      setSingleName(''); setSingleClass('');
      loadAccounts();
    } catch(e) { setMsg('Алдаа: '+e.message); }
    setAdding(false);
  }

  async function handleDelete(id) {
    const dc=prompt('Устгахын тулд УСТГАХ гэж бичнэ үү:');
    if(dc!=='УСТГАХ') return;
    await apiFetch('/api/student-accounts/'+id, {method:'DELETE'});
    setAccounts(a=>a.filter(x=>x.id!==id));
  }

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'24px 20px'}}>
      <div style={{fontWeight:800,fontSize:20,color:'#1c1f2a',marginBottom:20}}>Сурагчийн бүртгэл</div>
      <div style={{background:'#dbeafe',border:'1px solid #93c5fd',borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#1d4ed8'}}>
        Сурагчид <strong>/student</strong> хуудсаар орж кодоороо нэвтэрч шалгалтаа өгнө.
      </div>

      <div className="cm-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div style={{background:'white',borderRadius:16,padding:20,boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Нэг сурагч нэмэх</div>
          <input value={singleName} onChange={e=>setSingleName(e.target.value)} placeholder="Нэр (заавал биш)"
            style={{width:'100%',padding:'9px 12px',border:'2px solid #e5e7eb',borderRadius:8,fontSize:14,outline:'none',marginBottom:8,boxSizing:'border-box'}} />
          <input value={singleClass} onChange={e=>setSingleClass(e.target.value)} placeholder="Анги (заавал биш)"
            style={{width:'100%',padding:'9px 12px',border:'2px solid #e5e7eb',borderRadius:8,fontSize:14,outline:'none',marginBottom:10,boxSizing:'border-box'}} />
          <button onClick={handleSingleAdd} disabled={adding}
            style={{width:'100%',padding:'10px',background:'#7B52EE',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
            Нэмэх
          </button>
        </div>

        <div style={{background:'white',borderRadius:16,padding:20,boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Олноор нэмэх</div>
          <div style={{fontSize:12,color:'#9ca3af',marginBottom:8}}>Нэг мөрт нэг сурагч: нэр, анги (код хоосон бол автоматаар үүснэ)</div>
          <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)}
            placeholder={"Болд, 12А\nНомун, 12Б\nДорж, 12А"}
            style={{width:'100%',height:100,padding:'9px 12px',border:'2px solid #e5e7eb',borderRadius:8,fontSize:13,outline:'none',resize:'vertical',marginBottom:10,boxSizing:'border-box'}} />
          <button onClick={handleBulkAdd} disabled={adding}
            style={{width:'100%',padding:'10px',background:'#7B52EE',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
            {adding?'Нэмж байна...':'Бүгдийг нэмэх'}
          </button>
        </div>
      </div>

      {msg && <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:13,color:'#15803d'}}>{msg}</div>}

      <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(17,24,39,.06)'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid #f3f4f6',fontWeight:700,fontSize:14,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8,alignItems:'center'}}>
          <span>Нийт: {accounts.length} сурагч</span>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[...new Set(accounts.map(a=>a.class||'').filter(Boolean))].sort().map(cls=>(
              <button key={cls} onClick={()=>setFilterCls(f=>f===cls?'':cls)}
                style={{padding:'4px 10px',borderRadius:6,border:'none',fontWeight:700,fontSize:11,cursor:'pointer',
                  background:filterCls===cls?'#7B52EE':'#f3f4f6',color:filterCls===cls?'white':'#374151'}}>{cls}</button>
            ))}
            {filterCls&&<button onClick={()=>setFilterCls('')} style={{padding:'4px 10px',borderRadius:6,border:'none',fontWeight:700,fontSize:11,cursor:'pointer',background:'#f3f4f6',color:'#6b7280'}}>× Цэвэрлэх</button>}
          </div>
        </div>
        {loading ? <div style={{padding:40,textAlign:'center'}}><Spinner/></div> :
        accounts.length===0 ? <div style={{padding:40,textAlign:'center',color:'#9ca3af'}}>Бүртгэлтэй сурагч байхгүй</div> : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f9fafb'}}>
                {['#','Код','Нэр','Анги',''].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:12,fontWeight:700,color:'#6b7280'}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {accounts.filter(a=>!filterCls||a.class===filterCls).map((a,i)=>(
                <tr key={a.id} style={{borderTop:'1px solid #f3f4f6'}}>
                  <td style={{padding:'10px 14px',fontSize:13,color:'#9ca3af'}}>{i+1}</td>
                  <td style={{padding:'10px 14px',fontWeight:800,fontSize:14,color:'#7B52EE'}}>{a.code}</td>
                  <td style={{padding:'10px 14px',fontSize:14}}>{a.name||'—'}</td>
                  <td style={{padding:'10px 14px',fontSize:13,color:'#6b7280'}}>{a.class||'—'}</td>
                  <td style={{padding:'10px 14px'}}>
                    <button onClick={()=>handleDelete(a.id)}
                      style={{padding:'3px 10px',background:'#fdecec',border:'none',borderRadius:6,fontSize:11,color:'#b3261e',cursor:'pointer'}}>Устгах</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


// ── Student Portal (built into main app) ─────────────────
// ─────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────


export default function App() {
  const [lang, toggleLang, t] = useLang();
  const [dark, toggleDark] = useDark();
  const d = dark; // shorthand for dark mode checks
  const [authed, setAuthed] = useState(false);
  const [teacher, setTeacher] = useState(null);
  const [studentMode, setStudentMode] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [studentExam, setStudentExam] = useState(null);
  const [page, setPage] = useState('home');
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [currentExam, setCurrentExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingExam, setEditingExam] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState(null);             // { hasAccess, paidUntil, … } — /api/me
  const [notice, setNotice] = useState(null);     // { text, err } — дээд талын түр мэдэгдэл
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 8000); return () => clearTimeout(t); }, [notice]);

  // Ямар нэг API 402 (эрх дууссан) буцаавал эрхийн мэдээллийг шинэчилж төлбөрийн дэлгэц гаргана
  useEffect(() => {
    const onPaywall = () => { apiFetch('/api/me').then(setMe).catch(() => {}); };
    window.addEventListener('eyesh:paywall', onPaywall);
    return () => window.removeEventListener('eyesh:paywall', onPaywall);
  }, []);

  // ☰ цэс нээлттэй үед: Esc-ээр хаах, ард нь гүйлгэхгүй
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('cm-lock');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('cm-lock'); };
  }, [menuOpen]);

  useEffect(() => { document.body.classList.toggle('dark', dark); }, [dark]);

  useEffect(() => {
    const token = getToken();
    const stoken = typeof window!=='undefined'&&localStorage.getItem('student_token');
    const sinfo = typeof window!=='undefined'&&localStorage.getItem('student_info');
    const savedTeacher = typeof window!=='undefined'&&localStorage.getItem('eyesh_teacher');
    if (token) {
      // Check demo session expiry (10 min)
      const teacherData = savedTeacher ? JSON.parse(savedTeacher) : null;
      if (teacherData?.email === 'demo@eyeshcheck.com') {
        const loginTime = parseInt(localStorage.getItem('demo_login_time')||'0');
        const elapsed = Date.now() - loginTime;
        if (loginTime && elapsed > 10 * 60 * 1000) {
          // Demo expired
          localStorage.removeItem('eyesh_token');
          localStorage.removeItem('eyesh_teacher');
          localStorage.removeItem('demo_login_time');
          localStorage.removeItem('demo_device_id');
          setLoading(false);
          return;
        }
        // Set auto-logout timer for remaining time
        const remaining = 10 * 60 * 1000 - elapsed;
        const timer = setTimeout(()=>{
          localStorage.removeItem('eyesh_token');
          localStorage.removeItem('eyesh_teacher');
          localStorage.removeItem('demo_login_time');
          localStorage.removeItem('demo_device_id');
          alert('Demo хугацаа (10 минут) дууслаа. Дахин нэвтрэнэ үү.');
          window.location.reload();
        }, remaining);
        return ()=>clearTimeout(timer);
      }
      setAuthed(true);
      if (savedTeacher) setTeacher(JSON.parse(savedTeacher));
      loadData();
    }
    else if (stoken && sinfo) { setStudentMode(true); setStudentInfo(JSON.parse(sinfo)); setLoading(false); }
    else setLoading(false);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const m = await apiFetch('/api/me');
      setMe(m);
      if (!m.hasAccess) { setLoading(false); return; }
      const [ex, st] = await Promise.all([apiFetch('/api/exams'), apiFetch('/api/students')]);
      setExams(ex);
      setStudents(st);
      // Дасгалын төвөөс шууд үүсгэсэн шалгалт (/api/cm/sso → /?exam=<id>) — тэр шалгалтыг нээнэ
      const want = new URLSearchParams(window.location.search).get('exam');
      if (want) { try { window.history.replaceState(null, '', window.location.pathname); } catch(e) {} }
      if (ex.length) setCurrentExam(cur => (want && ex.find(e=>e.id===want)) || (cur ? ex.find(e=>e.id===cur.id)||ex[0] : ex[0]));
    } catch(e) { console.error('loadData error:', e); }
    setLoading(false);
  }

  async function handleAddExam(exam) {
    const created = await apiFetch('/api/exams', {method:'POST', body:exam});
    setExams(ex=>[created,...ex]);
    setCurrentExam(created);
    setPage('home');
  }

  async function handleUpdateExam(exam) {
    const { rescored, rescoreError, ...updated } = await apiFetch('/api/exams/'+exam.id, {method:'PUT', body:exam});
    setExams(ex=>ex.map(e=>e.id===exam.id?updated:e));
    setCurrentExam(updated);
    setEditingExam(null);
    setPage('home');
    // Сервер уншуулсан хуудсуудын дүнг шинэ түлхүүрээр дахин бодсон — жагсаалт, анализыг шинэчилнэ
    if (rescored) { try { setStudents(await apiFetch('/api/students')); } catch(e) {} }
    setNotice(rescoreError ? { err:true, text:rescoreError }
      : rescored ? { text: rescored+' сурагчийн оноо, хувийг шинэ зөв хариултаар дахин бодлоо.' } : null);
  }

  async function handleDeleteExam(id) {
    await apiFetch('/api/exams/'+id, {method:'DELETE'});
    setExams(ex=>ex.filter(e=>e.id!==id));
    setStudents(st=>st.filter(s=>s.examId!==id));
    setCurrentExam(cur=>cur?.id===id?null:cur);
  }

  async function handleAddStudent(student) {
    const created = await apiFetch('/api/students', {method:'POST', body:student});
    setStudents(st=>[...st, created]);
  }

  async function handleDeleteStudent(id) {
    await apiFetch('/api/students/'+id, {method:'DELETE'});
    setStudents(st=>st.filter(s=>s.id!==id));
  }

  const [demoSecsLeft, setDemoSecsLeft] = useState(null);

  useEffect(()=>{
    if (!teacher || teacher.email !== 'demo@eyeshcheck.com' || teacher.isAdmin) return;
    const loginTime = parseInt(localStorage.getItem('demo_login_time')||'0');
    if (!loginTime) return;
    const interval = setInterval(()=>{
      const elapsed = Date.now() - loginTime;
      const left = Math.max(0, 600 - Math.floor(elapsed/1000));
      setDemoSecsLeft(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return ()=>clearInterval(interval);
  }, [teacher]);

  const [showLanding, setShowLanding] = useState(()=>{
    if (typeof window==='undefined') return true;
    return !localStorage.getItem('eyesh_token') && !localStorage.getItem('student_token');
  });

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><Spinner/></div>;
  if (!authed && !studentMode && showLanding) return (
    <LandingPage onEnter={()=>setShowLanding(false)} />
  );
  if (!authed && !studentMode) return (
    <LoginPage
      onLogin={(t)=>{setAuthed(true);setTeacher(t);loadData();}}
      onStudentLogin={s=>{setStudentMode(true);setStudentInfo(s);}}
      onBack={()=>setShowLanding(true)}
    />
  );
  if (studentMode) return (
    <StudentPortal
      student={studentInfo}
      onLogout={()=>{localStorage.removeItem('student_token');localStorage.removeItem('student_info');setStudentMode(false);setStudentInfo(null);setStudentExam(null);}}
    />
  );

  const examStudents = students.filter(s=>s.examId===currentExam?.id);
  const navIds = PAGE_IDS.filter(id => id!=='admin' || teacher?.isAdmin);
  function go(id) { setPage(id); setMenuOpen(false); if (typeof window!=='undefined') window.scrollTo(0,0); }
  function logout() { localStorage.removeItem('eyesh_token');localStorage.removeItem('eyesh_teacher');setAuthed(false);setTeacher(null);setMe(null);setMenuOpen(false); }
  const daysLeft = me?.paidUntil ? (new Date(me.paidUntil) - Date.now()) / 86400000 : null;
  const showRenew = me && me.hasAccess && !me.isAdmin && daysLeft !== null;
  function paid(r) { setMe(m => ({ ...m, hasAccess: true, paidUntil: r.paidUntil })); }

  // Эрх дууссан: зөвхөн төлбөрийн дэлгэц
  if (me && !me.hasAccess) return (
    <>
      <Head><title>Эрх идэвхжүүлэх · ЭЕШ шалгагч</title></Head>
      <header className="cm-top"><div className="cm-top-in">
        <div className="cm-brand"><img src="/chick.svg" alt="" className="cm-chick" /><span><b>ЭЕШ шалгагч</b><small>CyberMath</small></span></div>
      </div></header>
      <Paywall me={me} onClose={() => { setPage('home'); loadData(); }} onLogout={logout} />
    </>
  );
  const tab = (id, label) => (
    <button key={id} className={'cm-tab'+(page===id?' on':'')} onClick={()=>go(id)}>
      <Ico d={NAV_ICON[id]} size={23} sw={2}/>{label}
    </button>
  );

  return (
    <>
      <Head>
        <title>{(t.nav[page]||t.nav.home)+' · ЭЕШ шалгагч'}</title>
      </Head>
      <header className="cm-top no-print">
        <div className="cm-top-in">
          <button className="cm-brand" onClick={()=>go('home')}>
            <img src="/chick.svg" alt="" className="cm-chick" />
            <span><b>ЭЕШ шалгагч</b><small>CyberMath</small></span>
          </button>
          <div className="cm-actions">
            {demoSecsLeft!==null && teacher?.email==='demo@eyeshcheck.com' &&(
              <span className="cm-timer">⏱ {Math.floor(demoSecsLeft/60)}:{String(demoSecsLeft%60).padStart(2,'0')}</span>
            )}
            {currentExam&&<button className="cm-exam" onClick={()=>go('home')} title="Идэвхтэй шалгалт">{currentExam.title}</button>}
            <button className="cm-burger" onClick={()=>setMenuOpen(true)} aria-label={t.more} aria-expanded={menuOpen}>
              <Ico d={NAV_ICON.menu} size={22} sw={2.2}/>
            </button>
          </div>
        </div>
      </header>
      <main className="cm-main">
        {notice && (
          <div className="no-print" role="status" style={{maxWidth:1160,margin:'12px auto 0',padding:'11px 16px',borderRadius:12,fontSize:14,fontWeight:800,
            display:'flex',alignItems:'center',gap:10,background:notice.err?'#fdecec':'#e9f8ef',color:notice.err?'#b3261e':'#15803d',border:'1px solid '+(notice.err?'#f6c9c9':'#b7e4c7')}}>
            <span style={{flex:1}}>{notice.text}</span>
            <button onClick={()=>setNotice(null)} aria-label="Хаах" style={{border:0,background:'none',color:'inherit',fontSize:18,fontWeight:900,cursor:'pointer'}}>×</button>
          </div>
        )}
        {showRenew && daysLeft < 3 && page !== 'billing' && (
          <div className="cm-billbar no-print">
            <span>{daysLeft < 1 ? `Эрх ${Math.max(1, Math.ceil(daysLeft * 24))} цагийн дараа дуусна` : `Эрх ${Math.ceil(daysLeft)} хоногийн дараа дуусна`}</span>
            <button onClick={()=>go('billing')}>Сунгах</button>
          </div>
        )}
        {page==='billing'&&<Paywall me={me} renew onPaid={paid} onClose={()=>go('home')} />}
        {page==='home'&&<HomePage exams={exams} students={students} onSelectExam={e=>{setCurrentExam(e);}} currentExam={currentExam} onDeleteExam={handleDeleteExam} onNavigate={go} onEditExam={e=>{setEditingExam(e);go('edit');}} dark={d} />}
        {page==='scan'&&<ScanPage exam={currentExam} exams={exams} students={examStudents} onSelectExam={setCurrentExam} onAddStudent={handleAddStudent} onNavigate={go} />}
        {page==='sheets'&&<SheetsPage exam={currentExam} onNavigate={go} dark={d} />}
        {page==='create'&&<CreatePage onCreated={handleAddExam} dark={d} />}
        {page==='edit'&&<CreatePage onCreated={handleUpdateExam} prefill={editingExam} isEdit={true} dark={d} />}
        {page==='board'&&<BoardPage exam={currentExam} students={examStudents} onDeleteStudent={handleDeleteStudent} onExportExcel={exportExcel} onReload={loadData} dark={d} />}
        {page==='analytics'&&<AnalyticsPage exam={currentExam} students={examStudents} teacherName={teacher?.name||''} dark={d} />}
        {page==='rating'&&<RatingPage exams={exams} students={students} dark={d} />}
        {page==='students'&&<StudentAccountsPage dark={d} />}
        {page==='materials'&&<div className="mp-page"><h1 className="mp-title">ЭЕШ материал</h1><MaterialsPanel kind="material" classes={[...new Set(students.map(s=>s.class).filter(Boolean))].sort()} /></div>}
        {page==='admin'&&teacher?.isAdmin&&<AdminPage dark={d} />}
      </main>
      <footer className="cm-foot no-print">
        CyberMath · ЭЕШ шалгагч · <a href={PRACTICE_URL}>Дасгалын төв →</a>
      </footer>
      <nav className="cm-tabbar no-print">
        {tab('home', t.nav.home)}
        {tab('board', t.nav.board)}
        <button className="cm-fab" onClick={()=>go('scan')}><span><Ico d={NAV_ICON.scan} size={26} sw={2.2}/></span>{t.nav.scan}</button>
        {tab('analytics', t.nav.analytics)}
        {tab('rating', t.nav.rating)}
      </nav>
      {menuOpen&&(
        <div className="cm-drawer-bg no-print" onClick={()=>setMenuOpen(false)}>
          <aside className="cm-drawer" role="dialog" aria-label={t.more} onClick={e=>e.stopPropagation()}>
            <div className="cm-drawer-h">
              <div className="cm-brand"><img src="/chick.svg" alt="" className="cm-chick" /><span><b>ЭЕШ шалгагч</b><small>CyberMath</small></span></div>
              <button className="cm-ibtn" onClick={()=>setMenuOpen(false)} aria-label="Хаах"><Ico d={NAV_ICON.close} size={20} sw={2.2}/></button>
            </div>
            {teacher&&<div className="cm-drawer-user"><b>{teacher.name||'Багш'}</b><span>{teacher.email}</span></div>}
            {showRenew&&(
              <div className="cm-drawer-plan">
                <span>Эрх<b>{fmtDay(me.paidUntil)} хүртэл</b></span>
                <button onClick={()=>go('billing')}>Сунгах</button>
              </div>
            )}
            <nav className="cm-drawer-nav">
              {navIds.map(id=>(
                <button key={id} className={page===id||(id==='create'&&page==='edit')?'on':''} onClick={()=>go(id)}>
                  <Ico d={NAV_ICON[id]} size={21} sw={2}/>{t.nav[id]}
                </button>
              ))}
              <a href={PRACTICE_URL}><Ico d={NAV_ICON.book} size={21} sw={2}/>Дасгалын төв<i>↗</i></a>
            </nav>
            <div className="cm-drawer-foot">
              <button onClick={toggleDark}><Ico d={d?NAV_ICON.sun:NAV_ICON.moon} size={19} sw={2}/>{d?'Цайвар горим':'Бараан горим'}</button>
              <button onClick={toggleLang}><span className="cm-lang">{lang==='mn'?'EN':'МН'}</span>{lang==='mn'?'English':'Монгол'}</button>
              <button className="danger" onClick={logout}><Ico d={NAV_ICON.logout} size={19} sw={2}/>{t.logout}</button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
