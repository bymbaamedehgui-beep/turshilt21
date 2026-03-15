import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

// ── Constants ────────────────────────────────────────────
const SEC1_CHOICES = ['A','B','C','D','E'];
const SEC2_ROWS = ['a','b','c','d','e','f','g','h'];
const SEC2_SUBS = ['2.1','2.2','2.3','2.4'];
const SUBJECTS = ['Математик','Физик','Хими','Биологи','Монгол хэл','Түүх','Газарзүй','Англи хэл','Нийгмийн ухаан'];

const SUBJECT_EN = {
  'Математик':'Mathematics','Физик':'Physics','Хими':'Chemistry',
  'Биологи':'Biology','Монгол хэл':'Mongolian','Түүх':'History',
  'Газарзүй':'Geography','Англи хэл':'English','Нийгмийн ухаан':'Social Studies'
};
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
// Legacy fallback
const TOPICS = TOPICS_BY_SUBJECT['Математик'];
const PAGE_IDS = ['home','create','material','upload','board','analytics','rating','students','admin'];


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
    nav:{home:'Нүүр',create:'Шалгалт үүсгэх',material:'Материал',upload:'Зураг оруулах',board:'Жагсаалт',analytics:'Анализ',rating:'Рейтинг',students:'Сурагчид',admin:'Admin'},
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
    nav:{home:'Home',create:'Create Exam',material:'Material',upload:'Upload',board:'Results',analytics:'Analytics',rating:'Ranking',students:'Students',admin:'Admin'},
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

function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function pf(v) { const n=parseFloat(v); return isNaN(n)?0:n; }
function hexToRgb(hex) {
  const h=(hex||'#888').replace('#','');
  if(h.length<6) return [128,128,128];
  const n=parseInt(h.slice(0,6),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function eyeshGrade(sc) {
  if(sc>=90) return {g:'A',l:'Онц',c:'#15803d'};
  if(sc>=80) return {g:'B',l:'Сайн',c:'#1d4ed8'};
  if(sc>=70) return {g:'C',l:'Дунд сайн',c:'#0369a1'};
  if(sc>=60) return {g:'D',l:'Хангалттай',c:'#d97706'};
  if(sc>=50) return {g:'E',l:'Хангалтгүй',c:'#ea580c'};
  return {g:'F',l:'Тэнцээгүй',c:'#dc2626'};
}
function toScaled(earned,max){ return max>0?Math.round(earned/max*1000)/10:0; }

// ── API helpers ───────────────────────────────────────────
function getToken() { return typeof window!=='undefined'?localStorage.getItem('eyesh_token'):null; }

async function apiFetch(path, opts={}) {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type':'application/json',
      ...(token?{Authorization:`Bearer ${token}`}:{}),
      ...(opts.headers||{}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status===401) { localStorage.removeItem('eyesh_token'); window.location.reload(); }
  if (!res.ok) { const e=await res.json().catch(()=>({error:'Network error'})); throw new Error(e.error||'API error'); }
  return res.json();
}

// ── Anthropic API (direct from browser) ──────────────────
async function callAI(payload) {
  // Backend proxy ашиглана — API key сервер талд хадгалагдана
  const r = await fetch('/api/ai', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      ...(getToken()?{Authorization:'Bearer '+getToken()}:{}),
    },
    body: JSON.stringify(payload),
  });
  const rawBody = await r.text();
  if (!r.ok) throw new Error('AI API '+r.status+': '+rawBody.slice(0,300));
  const d = JSON.parse(rawBody);
  if (d.error) throw new Error(d.error.message+' ('+d.error.type+')');
  if (d.stop_reason==='max_tokens') throw new Error('max_tokens хэтэрлээ');
  const txt = (d.content||[]).find(b=>b.type==='text')?.text||'';
  if (!txt) throw new Error('AI хоосон хариулт');
  return txt;
}

async function analyzeSheet(b64, mime, cfg) {
  const {n, useSec2, enabledSubs=[]} = cfg;
  const sec2Part = useSec2 && enabledSubs.length > 0
    ? `- 2-Р ХЭСЭГ (right side): ${enabledSubs.length} sub-sections labeled ${enabledSubs.join(', ')}. Each sub-section has rows a,b,c,d,e,f,g,h. Each row has digit bubbles 0-9. Detect which digit is filled for each row.`
    : `- 2-Р ХЭСЭГ: NOT used in this exam, skip it.`;
  const prompt = `You are an expert OMR (Optical Mark Recognition) system for Mongolian EYESH exam answer sheets.

SHEET LAYOUT:
- Top right corner: ХУВИЛБАР (version) column — one bubble A through J is filled = exam version
- Left side — 1-Р ХЭСЭГ: questions 1 to ${n}. Each row = one question. Bubbles: A B C D E. Detect which bubble is filled (darkened).
${sec2Part}
- Far right — ХЯНАЛТЫН ХЭСЭГ: ignore completely.

IMPORTANT RULES:
- A filled bubble = darkened/shaded circle. Empty = light/unfilled.
- If no bubble filled for a question → "BLANK"
- For version: Mongolian letters А=A, Б=B, В=C, Г=D, Д=E, Е=F, Ж=G etc.
${useSec2 ? `- For section 2 digits: look carefully at each row in each sub-section. Report digit 0-9 or "BLANK".` : ''}

Return ONLY valid JSON, no extra text:
{
  "version": "A",
  "section1": [{"q":1,"selected":"A","confidence":95}, ...for all ${n} questions],
  "section2": ${useSec2 ? `{"${enabledSubs[0]||'2.1'}":{"a":{"digit":"3","confidence":90},"b":{"digit":"BLANK","confidence":85},...},...for all enabled subs}` : '{}'}
}`;
  const txt = await callAI({
    model:'claude-sonnet-4-20250514',
    max_tokens: useSec2 ? 6000 : 4000,
    messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:mime,data:b64}},
      {type:'text',text:prompt}
    ]}]
  });
  try {
    const cleaned = txt.replace(/```json|```/g,'').trim();
    const fi=cleaned.indexOf('{'), li=cleaned.lastIndexOf('}');
    return JSON.parse(cleaned.slice(fi,li+1));
  } catch { throw new Error('Parse алдаа: '+txt.slice(0,300)); }
}

async function analyzeMaterial(fileData, fileType, cfg) {
  const isPdf = fileType==='application/pdf';
  const contentBlock = isPdf
    ? {type:'document',source:{type:'base64',media_type:'application/pdf',data:fileData}}
    : {type:'image',source:{type:'base64',media_type:fileType,data:fileData}};
  const {n,subject,useSec2,sec2subs,sec2rows} = cfg;
  const enabledSubs = SEC2_SUBS.filter((_,i)=>sec2subs?.[i]);
  const prompt = `You are an expert in Mongolian EYESH exam materials. Analyze the provided exam material.
Subject: ${subject}, Section 1 questions: ${n}, Section 2: ${useSec2?'enabled ('+enabledSubs.join(',')+')':'disabled'}

PART A — Extract from the document:
1. versions_found: list of exam versions (e.g. ["А","Б","В","Г"])
2. scores: per-question score AND topic: [{"q":1,"score":2,"topic":"Алгебр"},...]
   - Topics MUST be one of: ${TOPICS.join(', ')}
3. sec2_score_per_row: score per row in section 2 (usually 5)

PART B — Solve ALL questions for ALL versions:
- section1: {"А":[{"q":1,"answer":"B","confidence":90,"reasoning":"brief"},...],...}
- section2: {"А":{"2.1":{"a":{"digit":"3","confidence":90},...},...},...}

Return ONLY valid JSON:
{"versions_found":["А","Б"],"subject":"${subject}","scores":[{"q":1,"score":2,"topic":"Алгебр"}],"sec2_score_per_row":5,"section1":{"А":[{"q":1,"answer":"B","confidence":90,"reasoning":""}]},"section2":{},"notes":""}`;
  const rawTxt = await callAI({model:'claude-sonnet-4-20250514',max_tokens:16000,messages:[{role:'user',content:[contentBlock,{type:'text',text:prompt}]}]});
  const cleaned = rawTxt.replace(/```json/g,'').replace(/```/g,'').trim();
  const fb=cleaned.indexOf('{'), lb=cleaned.lastIndexOf('}');
  if(fb===-1||lb===-1) throw new Error('JSON олдсонгүй: '+rawTxt.slice(0,200));
  try { return JSON.parse(cleaned.slice(fb,lb+1)); }
  catch(e) { throw new Error('JSON parse: '+e.message+' | '+rawTxt.slice(0,200)); }
}

// ── Scoring ───────────────────────────────────────────────
function calcScore(det, exam) {
  const {sec1Key,sec1Scores,sec2Config,sec2Enabled,sec2Score,useSec2} = exam;
  let correct=0,wrong=0,blank=0,rawEarned=0,rawMax=0;
  const sec1Results=[];
  sec1Key.forEach((key,i)=>{
    const a=det.section1?.[i];
    const sel=a?.selected||'BLANK';
    const pts=sec1Scores?.[i]||1;
    rawMax+=pts;
    if(sel==='BLANK'){wrong++;blank++;sec1Results.push({q:i+1,sel,key,st:'blank',pts:0,max:pts,conf:a?.confidence||0});}
    else if(sel===key){correct++;rawEarned+=pts;sec1Results.push({q:i+1,sel,key,st:'ok',pts,max:pts,conf:a?.confidence||0});}
    else{wrong++;sec1Results.push({q:i+1,sel,key,st:'ng',pts:0,max:pts,conf:a?.confidence||0});}
  });
  const sec2Results={};
  if(useSec2&&sec2Config){
    SEC2_SUBS.forEach(sub=>{
      const isEnabled = sec2Enabled?.[sub] ?? sec2Config?.[sub]?._enabled;
      if(!isEnabled) return;
      sec2Results[sub]={};
      SEC2_ROWS.forEach(row=>{
        const rowData=sec2Config?.[sub]?.[row];
      const kv=typeof rowData==='object'?rowData.ans:rowData;
        if(kv===undefined||kv===null||kv==='') return;
        const pts=sec2Score||5;
        rawMax+=pts;
        const dv=det.section2?.[sub]?.[row]?.digit||'BLANK';
        const conf=det.section2?.[sub]?.[row]?.confidence||0;
        if(dv==='BLANK'){wrong++;blank++;sec2Results[sub][row]={sel:dv,key:kv,st:'blank',pts:0,max:pts,conf};}
        else if(String(dv)===String(kv)){correct++;rawEarned+=pts;sec2Results[sub][row]={sel:dv,key:kv,st:'ok',pts,max:pts,conf};}
        else{wrong++;sec2Results[sub][row]={sel:dv,key:kv,st:'ng',pts:0,max:pts,conf};}
      });
    });
  }
  const scaled=toScaled(rawEarned,rawMax);
  const grade=eyeshGrade(scaled);
  const needsReview=(det.section1||[]).some(a=>(a.confidence??100)<70);
  return{correct,wrong,blank,rawEarned,rawMax,scaled,grade,sec1Results,sec2Results,needsReview};
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

function exportAnalytics(exam, students) {
  import('xlsx').then(XLSX => {
    const wb = XLSX.utils.book_new();
    const n = students.length;
    const ss = students.map(s=>s.scaled);
    const avg = n?(ss.reduce((a,b)=>a+b,0)/n).toFixed(1):0;
    const pass = students.filter(s=>s.scaled>=60).length;
    const grades=['A','B','C','D','E','F'];
    const gradeCounts=grades.map(g=>students.filter(s=>s.grade?.g===g).length);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['EYESH Дүн Шинжилгээ — '+exam.title],[],
      ['Шалгалт:',exam.title],['Хичээл:',exam.subject],['Огноо:',new Date().toLocaleString('mn-MN')],[],
      ['--- Ерөнхий ---'],
      ['Нийт сурагч:',n],['Дундаж ЭЕШ:',+avg],
      ['Хамгийн өндөр:',n?Math.max(...ss):'—'],['Хамгийн бага:',n?Math.min(...ss):'—'],
      ['Медиан:',[...ss].sort((a,b)=>a-b)[Math.floor(n/2)]||'—'],
      ['Тэнцсэн (>=60):',pass],['Тэнцэх хувь:',n?+(pass/n*100).toFixed(1):0],[],
      ['--- Зэрэглэл ---'],['Зэрэглэл','Тоо','Хувь %'],
      ...grades.map((g,i)=>[g+' ('+['Онц','Сайн','Дунд сайн','Хангалттай','Хангалтгүй','Тэнцээгүй'][i]+')',gradeCounts[i],n?+(gradeCounts[i]/n*100).toFixed(1):0])
    ]),'Ерөнхий статистик');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['#','Нэр','Код','Хувилбар','Зөв','Буруу','Хоосон','Raw','ЭЕШ оноо','Зэрэглэл'],
      ...[...students].sort((a,b)=>b.scaled-a.scaled).map((s,i)=>[
        i+1,s.name,s.code,s.version||'—',s.correct,s.wrong,s.blank,
        s.rawEarned+'/'+s.rawMax,s.scaled,s.grade?.g+' — '+s.grade?.l
      ])
    ]),'Сурагчдын жагсаалт');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['Дасгал','Зөв хариулт','Оноо','Сэдэв','Зөв тоо','Буруу','Хоосон','Амжилт %','Хүнд байдал'],
      ...exam.sec1Key.map((key,i)=>{
        const c=students.filter(s=>s.sec1Results[i]?.st==='ok').length;
        const bl=students.filter(s=>s.sec1Results[i]?.st==='blank').length;
        const pct=n?+(c/n*100).toFixed(1):0;
        return['D'+(i+1),key,exam.sec1Scores?.[i]||1,exam.topics?.[i]||'—',c,n-c-bl,bl,pct,pct>=80?'Хялбар':pct>=50?'Дунд':'Хэцүү'];
      })
    ]),'Дасгал шинжилгээ');
    const topicMap={};
    exam.sec1Key.forEach((_,i)=>{
      const t=exam.topics?.[i]||'Бусад';
      if(!topicMap[t]) topicMap[t]={total:0,correct:0,score:0,maxScore:0};
      topicMap[t].total+=n;topicMap[t].maxScore+=(exam.sec1Scores?.[i]||1)*n;
      students.forEach(s=>{if(s.sec1Results[i]?.st==='ok'){topicMap[t].correct++;topicMap[t].score+=(exam.sec1Scores?.[i]||1);}});
    });
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['Сэдэв','Нийт асуулт','Зөв хариулт','Амжилт %'],
      ...Object.entries(topicMap).map(([t,d])=>[t,d.total/n,d.correct/n,n?+(d.correct/d.total*100).toFixed(1):0])
    ]),'Сэдвийн шинжилгээ');
    const ranges=[[0,10],[10,20],[20,30],[30,40],[40,50],[50,60],[60,70],[70,80],[80,90],[90,100]];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['Онооны интервал','Сурагч тоо','Хувь %'],
      ...ranges.map(([lo,hi])=>{const cnt=students.filter(s=>s.scaled>=lo&&s.scaled<(hi===100?101:hi)).length;return[lo+'-'+hi,cnt,n?+(cnt/n*100).toFixed(1):0];})
    ]),'Оноо тархалт');
    XLSX.writeFile(wb, exam.title+'_анализ.xlsx');
  });
}

// ─────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────

function Spinner() {
  return <div style={{width:20,height:20,border:'3px solid #e2e8f0',borderTopColor:'#dc2626',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block'}} />;
}

function Badge({children, color='#dc2626'}) {
  return <span style={{fontSize:11,fontWeight:700,color:'white',background:color,padding:'2px 8px',borderRadius:20}}>{children}</span>;
}



// ── Scored Panel (editable results) ──────────────────────
function ScoredPanel({scored, exam, onSave, onUpdateScored, onReset}) {
  const [editIdx, setEditIdx] = useState(null); // which sec1 question editing
  const [editSec2, setEditSec2] = useState(null); // {sub, row}

  function pct() {
    if (!scored.rawMax) return 0;
    return Math.round(scored.rawEarned / scored.rawMax * 1000) / 10;
  }

  function updateSel(qIdx, newSel) {
    const results = [...(scored.sec1Results||[])];
    const r = {...results[qIdx]};
    const key = exam?.sec1Key?.[qIdx]||'';
    const pts = exam?.sec1Scores?.[qIdx]||1;
    const oldPts = r.st==='ok'?pts:0;
    r.sel = newSel;
    if (newSel==='BLANK') r.st='blank';
    else if (newSel===key) r.st='ok';
    else r.st='ng';
    const newPts = r.st==='ok'?pts:0;
    results[qIdx] = r;
    // recalc totals
    let correct=0,wrong=0,blank=0,rawEarned=scored.rawEarned - oldPts + newPts;
    results.forEach(x=>{ if(x.st==='ok')correct++; else if(x.st==='blank')blank++; else wrong++; });
    const sec2earned = Object.values(scored.sec2Results||{}).flatMap(rows=>Object.values(rows)).reduce((s,x)=>s+(x.pts||0),0);
    const totalEarned = results.reduce((s,x)=>s+(x.pts||0),0) + sec2earned;
    const scaled = scored.rawMax>0?Math.round(totalEarned/scored.rawMax*1000)/10:0;
    onUpdateScored({...scored, sec1Results:results, correct, wrong, blank, rawEarned:totalEarned, scaled, grade:eyeshGrade(scaled)});
    setEditIdx(null);
  }

  function updateSec2(sub, row, newDigit) {
    const sec2Results = JSON.parse(JSON.stringify(scored.sec2Results||{}));
    const r = sec2Results[sub]?.[row];
    if (!r) return;
    const key = r.key;
    const pts = r.max;
    const oldPts = r.pts||0;
    r.sel = newDigit;
    if (newDigit==='BLANK') { r.st='blank'; r.pts=0; }
    else if (String(newDigit)===String(key)) { r.st='ok'; r.pts=pts; }
    else { r.st='ng'; r.pts=0; }
    const newPts = r.pts;
    const sec1earned = (scored.sec1Results||[]).reduce((s,x)=>s+(x.pts||0),0);
    const sec2earned = Object.values(sec2Results).flatMap(rows=>Object.values(rows)).reduce((s,x)=>s+(x.pts||0),0);
    const totalEarned = sec1earned + sec2earned;
    const scaled = scored.rawMax>0?Math.round(totalEarned/scored.rawMax*1000)/10:0;
    let correct=0,wrong=0,blank=0;
    [...(scored.sec1Results||[]),...Object.values(sec2Results).flatMap(rows=>Object.values(rows))].forEach(x=>{ if(x.st==='ok')correct++; else if(x.st==='blank')blank++; else wrong++; });
    onUpdateScored({...scored, sec2Results, correct, wrong, blank, rawEarned:totalEarned, scaled, grade:eyeshGrade(scaled)});
    setEditSec2(null);
  }

  const p = pct();
  const grade = eyeshGrade(p);

  return (
    <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
      <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:16}}>Дүн</div>

      {/* Summary stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:20}}>
        {[
          ['Гүйцэтгэл',p+'%',grade.c],
          ['Зөв',scored.correct,'#16a34a'],
          ['Буруу (хоосон орно)',scored.wrong,'#dc2626'],
          ['Хоосон',scored.blank,'#94a3b8'],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:'#f8fafc',borderRadius:10,padding:'12px 16px'}}>
            <div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>
            <div style={{fontSize:11,color:'#94a3b8'}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Section 1 — editable */}
      <div style={{marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:14,color:'#374151',marginBottom:6}}>1-р хэсэг — дасгал бүрийн хариулт <span style={{fontSize:11,color:'#94a3b8',fontWeight:400}}>(дарж засварлах)</span></div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
          {(scored.sec1Results||[]).map((r,i)=>{
            const bg = r.st==='ok'?'#16a34a':r.st==='blank'?'#94a3b8':'#dc2626';
            const key = exam?.sec1Key?.[i]||'?';
            const isEditing = editIdx===i;
            return (
              <div key={i} style={{position:'relative'}}>
                <div onClick={()=>setEditIdx(isEditing?null:i)}
                  style={{width:38,height:46,borderRadius:6,background:bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:isEditing?'0 0 0 2px #f59e0b':'0 1px 3px rgba(0,0,0,.15)',transition:'box-shadow .15s'}}>
                  <div style={{fontSize:8,color:'rgba(255,255,255,.7)',lineHeight:1}}>D{i+1}</div>
                  <div style={{fontSize:14,fontWeight:900,color:'white',lineHeight:1.2}}>{r.sel==='BLANK'?'—':r.sel}</div>
                  {r.st==='ng'&&<div style={{fontSize:8,color:'rgba(255,255,255,.85)',lineHeight:1}}>{key}</div>}
                </div>
                {isEditing&&(
                  <div style={{position:'absolute',top:50,left:0,zIndex:50,background:'white',borderRadius:8,boxShadow:'0 4px 20px rgba(0,0,0,.2)',padding:6,display:'flex',gap:4,flexWrap:'nowrap'}}>
                    {['A','B','C','D','E','BLANK'].map(ch=>(
                      <button key={ch} onClick={()=>updateSel(i,ch)}
                        style={{padding:'4px 7px',border:'none',borderRadius:5,fontWeight:700,fontSize:12,cursor:'pointer',
                          background:ch===r.sel?'#1e293b':ch===key?'#dcfce7':'#f1f5f9',
                          color:ch===r.sel?'white':ch===key?'#16a34a':'#374151'}}>
                        {ch==='BLANK'?'—':ch}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{display:'flex',gap:16,marginTop:8,fontSize:11,color:'#64748b',flexWrap:'wrap'}}>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'#16a34a',display:'inline-block'}}></span>Зөв</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'#dc2626',display:'inline-block'}}></span>Буруу (жижигээр=зөв)</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'#94a3b8',display:'inline-block'}}></span>Хоосон</span>
        </div>
      </div>

      {/* Section 2 — editable */}
      {exam?.useSec2&&scored.sec2Results&&Object.keys(scored.sec2Results).length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,color:'#374151',marginBottom:8}}>2-р хэсэг <span style={{fontSize:11,color:'#94a3b8',fontWeight:400}}>(дарж засварлах)</span></div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {Object.entries(scored.sec2Results).map(([sub,rows])=>(
              <div key={sub} style={{background:'#f8fafc',borderRadius:10,padding:'10px 14px'}}>
                <div style={{fontWeight:700,fontSize:12,color:'#7c3aed',marginBottom:6}}>{sub}</div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {Object.entries(rows).map(([row,r])=>{
                    const isEd = editSec2?.sub===sub&&editSec2?.row===row;
                    return (
                      <div key={row} style={{position:'relative',display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:11,color:'#94a3b8',minWidth:12}}>{row}</span>
                        <div onClick={()=>setEditSec2(isEd?null:{sub,row})}
                          style={{padding:'3px 10px',borderRadius:5,fontSize:13,fontWeight:700,cursor:'pointer',
                            background:r.st==='ok'?'#16a34a':r.st==='blank'?'#94a3b8':'#dc2626',
                            color:'white',minWidth:30,textAlign:'center',
                            boxShadow:isEd?'0 0 0 2px #f59e0b':'none'}}>
                          {r.sel==='BLANK'?'—':r.sel}
                        </div>
                        {r.st==='ng'&&<span style={{fontSize:10,color:'#dc2626'}}>→{r.key}</span>}
                        {isEd&&(
                          <div style={{position:'absolute',left:60,top:0,zIndex:50,background:'white',borderRadius:8,boxShadow:'0 4px 20px rgba(0,0,0,.2)',padding:6,display:'flex',gap:3,flexWrap:'nowrap'}}>
                            {['0','1','2','3','4','5','6','7','8','9','BLANK'].map(d=>(
                              <button key={d} onClick={()=>updateSec2(sub,row,d==='BLANK'?'BLANK':d)}
                                style={{padding:'4px 7px',border:'none',borderRadius:5,fontWeight:700,fontSize:12,cursor:'pointer',
                                  background:d===String(r.sel)?'#1e293b':d===String(r.key)?'#dcfce7':'#f1f5f9',
                                  color:d===String(r.sel)?'white':d===String(r.key)?'#16a34a':'#374151'}}>
                                {d==='BLANK'?'—':d}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:8}}>
        {onReset&&<button onClick={onReset}
          style={{padding:'14px 20px',background:'#f1f5f9',color:'#64748b',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer'}}>
          ← Дахин
        </button>}
        <button onClick={onSave} style={{flex:1,padding:14,background:'linear-gradient(135deg,#16a34a,#22c55e)',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:800,cursor:'pointer'}}>
          Хадгалах
        </button>
      </div>
    </div>
  );
}

// ── Camera Component ──────────────────────────────────────
function CameraCapture({onCapture, onClose}) {
  const videoRef = useRef();
  const [camStream, setCamStream] = useState(null);
  const [camErr, setCamErr] = useState('');

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
      .then(s=>{setCamStream(s);if(videoRef.current)videoRef.current.srcObject=s;})
      .catch(()=>setCamErr('Camera нэвтрэх боломжгүй'));
    return ()=>{ };
  }, []);

  function capture() {
    const canvas=document.createElement('canvas');
    canvas.width=videoRef.current.videoWidth;
    canvas.height=videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current,0,0);
    canvas.toBlob(blob=>{
      const reader=new FileReader();
      reader.onload=e=>onCapture(e.target.result.split(',')[1],'image/jpeg');
      reader.readAsDataURL(blob);
      camStream?.getTracks().forEach(t=>t.stop());
    },'image/jpeg',0.95);
  }

  function close() { camStream?.getTracks().forEach(t=>t.stop()); onClose(); }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.95)',zIndex:1000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16}}>
      {camErr ? (
        <div style={{color:'white',textAlign:'center'}}>
          <div style={{fontSize:16,marginBottom:12}}>{camErr}</div>
          <button onClick={close} style={{padding:'10px 24px',background:'#dc2626',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Буцах</button>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline style={{width:'100%',maxWidth:500,borderRadius:12,marginBottom:16}} />
          <div style={{display:'flex',gap:12}}>
            <button onClick={capture} style={{padding:'14px 32px',background:'#dc2626',color:'white',border:'none',borderRadius:12,fontWeight:800,fontSize:16,cursor:'pointer'}}>Зураг авах</button>
            <button onClick={close} style={{padding:'14px 24px',background:'#374151',color:'white',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer'}}>Болих</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────
function LandingPage({onEnter}) {
  const YOUTUBE_ID = 'aUggJeMlQ8E';

  const features = [
    { icon:'🎯', title:'AI Bubble Detection', desc:'Сурагчдын хариулт хуудсыг зураг авч, AI автоматаар уншина.' },
    { icon:'📊', title:'Дэлгэрэнгүй анализ', desc:'Дасгал бүрийн амжилт, сурагч бүрийн гүйцэтгэл, ангийн рейтинг.' },
    { icon:'📄', title:'PDF & Excel экспорт', desc:'Сурагч бүрийн PDF тайлан, ангийн Excel жагсаалт нэг товчлуураар.' },
    { icon:'🏆', title:'ЭЕШ хэмжээст оноо', desc:'Raw оноог ЭЕШ-ийн 100 оноот системд автоматаар хөрвүүлнэ.' },
    { icon:'👨‍🏫', title:'Олон багш', desc:'Багш бүр өөрийн шалгалт, сурагчдаа тусдаа удирдана.' },
    { icon:'📱', title:'Сурагчийн портал', desc:'Сурагч кодоороо нэвтэрч өөрийн үр дүнг харна.' },
  ];

  const steps = [
    { n:'1', title:'Шалгалт үүсгэх', desc:'Хичээл, дасгалын тоо, зөв хариулт, оноог тохируулна.' },
    { n:'2', title:'Зураг оруулах', desc:'Сурагчдын хариулт хуудсыг зураглаж system-д оруулна.' },
    { n:'3', title:'AI шалгана', desc:'Хиймэл оюун bubble-уудыг таньж оноо тооцоолно.' },
    { n:'4', title:'Үр дүн харах', desc:'Тайлан, рейтинг, анализыг шууд харж экспортлоно.' },
  ];

  return (
    <div style={{minHeight:'100vh',background:'#0f172a',color:'white',fontFamily:'system-ui,sans-serif'}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#7f1d1d,#dc2626)',padding:'60px 20px 80px',textAlign:'center'}}>
        <div style={{fontSize:56,marginBottom:12}}>🎯</div>
        <div style={{fontSize:42,fontWeight:900,marginBottom:12,lineHeight:1.1}}>EYESH Checker</div>
        <div style={{fontSize:18,opacity:.85,maxWidth:560,margin:'0 auto 32px',lineHeight:1.6}}>
          ЭЕШ-ийн хариулт хуудас шалгах, оноо тооцоолох, анализ хийх бүрэн системийн шийдэл
        </div>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={onEnter}
            style={{padding:'14px 36px',background:'white',color:'#dc2626',border:'none',borderRadius:12,fontSize:17,fontWeight:900,cursor:'pointer'}}>
            Нэвтрэх / Бүртгүүлэх →
          </button>
          <button onClick={()=>document.getElementById('demo-section').scrollIntoView({behavior:'smooth'})}
            style={{padding:'14px 36px',background:'rgba(255,255,255,0.15)',color:'white',border:'2px solid rgba(255,255,255,0.4)',borderRadius:12,fontSize:17,fontWeight:700,cursor:'pointer'}}>
            🔴 Live Demo үзэх
          </button>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'0 20px'}}>

        {/* Video */}
        <div style={{margin:'60px 0',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:800,marginBottom:6}}>Танилцуулга видео</div>
          <div style={{fontSize:14,color:'#94a3b8',marginBottom:20}}>Системийг хэрхэн ашиглах тайлбар</div>
          {YOUTUBE_ID ? (
            <div style={{position:'relative',paddingBottom:'56.25%',borderRadius:16,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.5)'}}>
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_ID}`}
                style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div style={{background:'#1e293b',borderRadius:16,padding:'60px 20px',border:'2px dashed #334155',color:'#64748b'}}>
              <div style={{fontSize:40,marginBottom:8}}>▶️</div>
              <div style={{fontSize:14}}>Видео удахгүй нэмэгдэнэ</div>
            </div>
          )}
        </div>

        {/* Features */}
        <div style={{margin:'60px 0'}}>
          <div style={{fontSize:22,fontWeight:800,marginBottom:6,textAlign:'center'}}>Боломжууд</div>
          <div style={{fontSize:14,color:'#94a3b8',marginBottom:28,textAlign:'center'}}>Системийн гол онцлогууд</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
            {features.map(f=>(
              <div key={f.title} style={{background:'#1e293b',borderRadius:14,padding:'20px',border:'1px solid #334155'}}>
                <div style={{fontSize:28,marginBottom:10}}>{f.icon}</div>
                <div style={{fontWeight:800,fontSize:15,marginBottom:6}}>{f.title}</div>
                <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.6}}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{margin:'60px 0'}}>
          <div style={{fontSize:22,fontWeight:800,marginBottom:6,textAlign:'center'}}>Хэрхэн ашиглах вэ?</div>
          <div style={{fontSize:14,color:'#94a3b8',marginBottom:28,textAlign:'center'}}>4 алхамд шалгалтаа шалгаарай</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16}}>
            {steps.map(s=>(
              <div key={s.n} style={{background:'#1e293b',borderRadius:14,padding:'20px',border:'1px solid #334155',textAlign:'center'}}>
                <div style={{width:40,height:40,borderRadius:'50%',background:'#dc2626',color:'white',fontWeight:900,fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                  {s.n}
                </div>
                <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>{s.title}</div>
                <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.6}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div style={{margin:'60px 0',textAlign:'center'}}>
          <div style={{background:'linear-gradient(135deg,#7f1d1d,#dc2626)',borderRadius:20,padding:'40px 32px',display:'inline-block',minWidth:300}}>
            <div style={{fontSize:14,opacity:.8,marginBottom:8,letterSpacing:2}}>ҮНЭ</div>
            <div style={{fontSize:48,fontWeight:900,marginBottom:4}}>25,000₮</div>
            <div style={{fontSize:15,opacity:.8,marginBottom:20}}>нэг сарын хязгааргүй ашиглалт</div>
            <button onClick={onEnter}
              style={{padding:'12px 32px',background:'white',color:'#dc2626',border:'none',borderRadius:10,fontSize:15,fontWeight:800,cursor:'pointer'}}>
              Бүртгүүлэх →
            </button>
          </div>
        </div>

        {/* Live Demo */}
        <div id="demo-section" style={{margin:'60px 0'}}>
          <div style={{fontSize:22,fontWeight:800,marginBottom:6,textAlign:'center'}}>🔴 Live Demo</div>
          <div style={{fontSize:14,color:'#94a3b8',marginBottom:24,textAlign:'center'}}>Нэвтрэлтгүйгээр системийг туршиж үзэх</div>
          <div style={{background:'#1e293b',borderRadius:16,padding:'32px',border:'1px solid #334155',textAlign:'center'}}>
            <div style={{fontSize:16,color:'#e2e8f0',marginBottom:20,lineHeight:1.7}}>
              Demo хэрэглэгчээр нэвтэрч системийг туршиж үзнэ үү.<br/>
              <span style={{color:'#94a3b8',fontSize:13}}>Email: demo@eyeshcheck.com · Нууц үг: demo1234</span>
            </div>
            <button onClick={onEnter}
              style={{padding:'12px 32px',background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:800,cursor:'pointer'}}>
              Demo-оор нэвтрэх →
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div style={{margin:'60px 0'}}>
          <div style={{fontSize:22,fontWeight:800,marginBottom:6,textAlign:'center'}}>❓ Түгээмэл асуулт</div>
          <div style={{fontSize:14,color:'#94a3b8',marginBottom:28,textAlign:'center'}}>Хамгийн их асуудаг асуултууд</div>
          {[
            {q:'Ямар төхөөрөмжид ажилладаг вэ?', a:'Интернет холбоотой ямар ч төхөөрөмж дээр browser-ээр ажиллана. Суулгах шаардлагагүй.'},
            {q:'Нэг сард хэдэн шалгалт шалгаж болох вэ?', a:'25,000₮-ийн тарифт хязгааргүй шалгалт шалгах боломжтой.'},
            {q:'AI bubble detection хэр нарийвчлалтай вэ?', a:'Anthropic-ийн Claude AI ашиглан 90%+ нарийвчлалтайгаар таньдаг. Тодорхойгүй тохиолдолд гараар засах боломжтой.'},
            {q:'Өгөгдөл хаана хадгалагддаг вэ?', a:'Бүх өгөгдөл Neon cloud database-д найдвартай хадгалагдана. Өгөгдлийг гуравдагч этгээдэд дамжуулахгүй.'},
            {q:'Олон багш нэг платформ ашиглаж болох уу?', a:'Тийм. Багш бүр өөрийн бүртгэлтэй бөгөөд зөвхөн өөрийн шалгалт, сурагчдаа харна.'},
            {q:'Төлбөрийг хэрхэн төлөх вэ?', a:'Хаан банкны 5542136007 дансруу "Нэр, утасны дугаар" гүйлгээний утгатай шилжүүлнэ. Admin 24 цагийн дотор эрхийг нээнэ.'},
          ].map((item,i)=>(
            <FAQItem key={i} q={item.q} a={item.a} />
          ))}
        </div>

        {/* Contact */}
        <div style={{margin:'60px 0',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:800,marginBottom:6}}>📞 Холбоо барих</div>
          <div style={{fontSize:14,color:'#94a3b8',marginBottom:28}}>Асуулт байвал холбогдоорой</div>
          <div style={{display:'flex',gap:16,justifyContent:'center',flexWrap:'wrap'}}>
            <a href="tel:+97699999999" style={{textDecoration:'none'}}>
              <div style={{background:'#1e293b',borderRadius:14,padding:'20px 28px',border:'1px solid #334155',textAlign:'center',minWidth:160}}>
                <div style={{fontSize:28,marginBottom:8}}>📱</div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Утас</div>
                <div style={{fontSize:13,color:'#94a3b8'}}>bymbaamedehgui@gmail.com</div>
              </div>
            </a>
            <a href="mailto:bymbaamedehgui@gmail.com" style={{textDecoration:'none'}}>
              <div style={{background:'#1e293b',borderRadius:14,padding:'20px 28px',border:'1px solid #334155',textAlign:'center',minWidth:160}}>
                <div style={{fontSize:28,marginBottom:8}}>✉️</div>
                <div style={{fontWeight:700,fontSize:14,color:'white',marginBottom:4}}>Email</div>
                <div style={{fontSize:13,color:'#94a3b8'}}>bymbaamedehgui@gmail.com</div>
              </div>
            </a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
              <div style={{background:'#1e293b',borderRadius:14,padding:'20px 28px',border:'1px solid #334155',textAlign:'center',minWidth:160}}>
                <div style={{fontSize:28,marginBottom:8}}>📘</div>
                <div style={{fontWeight:700,fontSize:14,color:'white',marginBottom:4}}>Facebook</div>
                <div style={{fontSize:13,color:'#94a3b8'}}>EYESH Checker</div>
              </div>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{textAlign:'center',padding:'32px 0',borderTop:'1px solid #1e293b',color:'#475569',fontSize:13,marginTop:20}}>
          EYESH Checker © 2025 · eyeshcheck.com
        </div>
      </div>
    </div>
  );
}

function FAQItem({q, a}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{background:'#1e293b',borderRadius:12,marginBottom:8,border:'1px solid #334155',overflow:'hidden'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:'100%',padding:'16px 20px',background:'none',border:'none',color:'white',textAlign:'left',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14,fontWeight:600}}>
        {q}
        <span style={{flexShrink:0,marginLeft:12,fontSize:18,color:'#94a3b8'}}>{open?'−':'+'}</span>
      </button>
      {open&&(
        <div style={{padding:'0 20px 16px',fontSize:13,color:'#94a3b8',lineHeight:1.7,borderTop:'1px solid #334155',paddingTop:12}}>
          {a}
        </div>
      )}
    </div>
  );
}

// ── Login Page ────────────────────────────────────────────
function LoginPage({onLogin, onStudentLogin}) {
  const [lang, toggleLang, t] = useLang();
  const [role, setRole] = useState(null); // null | 'teacher' | 'student'
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const [registered, setRegistered] = useState(false);

  async function handleTeacherLogin() {
    if (!email||!pass) return;
    setLoading(true); setErr('');
    try {
      const d = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})}).then(async r=>{
        const d=await r.json(); if(!r.ok) throw new Error(d.error||'Алдаа'); return d;
      });
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
      const d = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,name})}).then(async r=>{
        const d=await r.json(); if(!r.ok) throw new Error(d.error||'Алдаа'); return d;
      });
      if (d.isAdmin) {
        // First user — auto active, login
        const d2 = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})}).then(r=>r.json());
        localStorage.setItem('eyesh_token', d2.token);
        localStorage.setItem('eyesh_teacher', JSON.stringify(d2.teacher));
        onLogin(d2.teacher);
      } else {
        setRegistered(true);
      }
    } catch(e) { setErr(e.message); }
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

  const inp = {width:'100%',padding:'12px 14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:15,outline:'none',marginBottom:10,boxSizing:'border-box'};

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#7f1d1d,#dc2626)',padding:20}}>
      <div style={{background:'white',borderRadius:20,padding:'36px 32px',width:'100%',maxWidth:420,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
          <button onClick={toggleLang} style={{padding:'4px 12px',background:'#f1f5f9',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',color:'#374151'}}>
            {lang==='mn'?'EN':'МН'}
          </button>
        </div>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:8}}>🎯</div>
          <div style={{fontSize:22,fontWeight:900,color:'#1e293b'}}>EYESH Checker</div>
          <div style={{fontSize:13,color:'#94a3b8',marginTop:4}}>{t.selectRole}</div>
        </div>

        {!role&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <button onClick={()=>{setRole('teacher');setErr('');setTab('login');}}
              style={{padding:'24px 16px',background:'#f8fafc',border:'2px solid #e2e8f0',borderRadius:14,cursor:'pointer',textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:8}}>👩‍🏫</div>
              <div style={{fontWeight:800,fontSize:15,color:'#1e293b'}}>Багш</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>Нэвтрэх / Бүртгүүлэх</div>
            </button>
            <button onClick={()=>{setRole('student');setErr('');}}
              style={{padding:'24px 16px',background:'#f8fafc',border:'2px solid #e2e8f0',borderRadius:14,cursor:'pointer',textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:8}}>🎓</div>
              <div style={{fontWeight:800,fontSize:15,color:'#1e293b'}}>Сурагч</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>Кодоор нэвтрэх</div>
            </button>
          </div>
        )}

        {role==='teacher'&&(
          <>
            <button onClick={()=>{setRole(null);setErr('');setRegistered(false);}} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer',fontSize:13,marginBottom:14,padding:0}}>← Буцах</button>
            {registered ? (
              <div style={{padding:'8px 0'}}>
                <div style={{textAlign:'center',marginBottom:16}}>
                  <div style={{fontSize:40,marginBottom:8}}>⏳</div>
                  <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:6}}>Хүсэлт илгээгдлээ!</div>
                  <div style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>Admin таны төлбөрийг баталгаажуулсны дараа нэвтэрч болно.</div>
                </div>
                {/* Payment info */}
                <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px',marginBottom:14}}>
                  <div style={{fontWeight:800,fontSize:13,color:'#1e293b',marginBottom:10,textAlign:'center'}}>💳 Төлбөрийн мэдээлэл</div>
                  <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'6px 12px',fontSize:12}}>
                    <span style={{color:'#64748b',fontWeight:600}}>Банк:</span>
                    <span style={{color:'#1e293b',fontWeight:700}}>Хаан банк</span>
                    <span style={{color:'#64748b',fontWeight:600}}>Данс:</span>
                    <span style={{color:'#1e293b',fontWeight:700,letterSpacing:1}}>5542136007</span>
                    <span style={{color:'#64748b',fontWeight:600}}>IBAN:</span>
                    <span style={{color:'#1e293b',fontWeight:700}}>34000500</span>
                    <span style={{color:'#64748b',fontWeight:600}}>Эзэмшигч:</span>
                    <span style={{color:'#1e293b',fontWeight:700}}>М.Бямбадорж</span>
                    <span style={{color:'#64748b',fontWeight:600}}>Дүн:</span>
                    <span style={{color:'#dc2626',fontWeight:900,fontSize:14}}>25,000 ₮ / сар</span>
                    <span style={{color:'#64748b',fontWeight:600}}>Утга:</span>
                    <span style={{color:'#1e293b',fontWeight:700}}>Бүртгүүлсэн нэр, утасны дугаар</span>
                  </div>
                </div>
                <div style={{background:'#fef9c3',border:'1px solid #fde68a',borderRadius:8,padding:'8px 12px',fontSize:11,color:'#92400e',marginBottom:12,textAlign:'center'}}>
                  Төлбөр хийсний дараа admin эрхийг нээнэ
                </div>
                <button onClick={()=>{setRegistered(false);setTab('login');}} style={{width:'100%',padding:'8px',background:'#f1f5f9',border:'none',borderRadius:8,fontWeight:700,fontSize:13,cursor:'pointer'}}>Нэвтрэх хуудас руу</button>
              </div>
            ) : (
              <>
              <div style={{display:'flex',background:'#f1f5f9',borderRadius:10,padding:3,marginBottom:18}}>
              {['login','register'].map(tb=>(
                <button key={tb} onClick={()=>{setTab(tb);setErr('');}}
                  style={{flex:1,padding:'8px',border:'none',borderRadius:8,fontWeight:700,fontSize:13,cursor:'pointer',
                    background:tab===tb?'white':'transparent',color:tab===tb?'#1e293b':'#94a3b8',
                    boxShadow:tab===tb?'0 1px 4px rgba(0,0,0,.1)':'none'}}>
                  {tb==='login'?'Нэвтрэх':'Бүртгүүлэх'}
                </button>
              ))}
            </div>
            {err && <div style={{color:'#dc2626',fontSize:13,background:'#fef2f2',padding:'8px 12px',borderRadius:8,border:'1px solid #fecaca',marginBottom:12,textAlign:'center'}}>{err}</div>}
            {tab==='register'&&(
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Таны нэр (заавал биш)"
                style={inp} />
            )}
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email хаяг" type="email"
              style={inp} />
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Нууц үг" onKeyDown={e=>e.key==='Enter'&&(tab==='login'?handleTeacherLogin():handleRegister())}
              style={{...inp,marginBottom:16}} />
            <button onClick={tab==='login'?handleTeacherLogin:handleRegister} disabled={loading}
              style={{width:'100%',padding:13,background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {loading&&<Spinner/>} {tab==='login'?'Нэвтрэх':'Хүсэлт илгээх'}
            </button>
            {tab==='register'&&(
              <div style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:10}}>
                Бүртгүүлсний дараа admin зөвшөөрнө
              </div>
            )}
            </>
            )}
          </>
        )}

        {/* Student login */}
        {role==='student'&&(
          <>
            <button onClick={()=>{setRole(null);setErr('');}} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer',fontSize:13,marginBottom:16,padding:0}}>← Буцах</button>
            {err && <div style={{color:'#dc2626',fontSize:13,background:'#fef2f2',padding:'8px 12px',borderRadius:8,border:'1px solid #fecaca',marginBottom:14,textAlign:'center'}}>{err}</div>}
            <div style={{fontSize:13,color:'#64748b',marginBottom:12,textAlign:'center'}}>Багшаас авсан кодоо оруулна уу</div>
            <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Кодоо оруулах" onKeyDown={e=>e.key==='Enter'&&handleStudentLogin()}
              style={{...inp,fontSize:20,textAlign:'center',letterSpacing:4,fontWeight:700,marginBottom:16}} />
            <button onClick={handleStudentLogin} disabled={loading}
              style={{width:'100%',padding:13,background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
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

  const bg   = d ? '#1e293b' : 'white';
  const text = d ? '#f1f5f9' : '#1e293b';
  const muted= d ? '#94a3b8' : '#64748b';
  const border= d ? '#334155' : '#e2e8f0';

  function TeacherRow({t, actions}) {
    return (
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid '+border}}>
        <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#7f1d1d,#dc2626)',color:'white',fontWeight:900,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {(t.name||t.email||'?')[0].toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:text}}>{t.name||'—'}</div>
          <div style={{fontSize:12,color:muted}}>{t.email}</div>
          <div style={{fontSize:11,color:muted}}>{new Date(t.created_at).toLocaleDateString('mn-MN')}</div>
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
      <div style={{background:'linear-gradient(135deg,#1e293b,#334155)',borderRadius:20,padding:'24px 28px',color:'white',marginBottom:20}}>
        <div style={{fontSize:11,letterSpacing:3,opacity:.7,marginBottom:4}}>EYESH CHECKER</div>
        <div style={{fontSize:26,fontWeight:900}}>Admin панель</div>
        <div style={{opacity:.8,fontSize:13,marginTop:4}}>Багш нарын хандалтыг удирдах</div>
      </div>

      {err && <div style={{background:'#fef2f2',color:'#dc2626',padding:'10px 14px',borderRadius:10,marginBottom:16,fontSize:13}}>{err}</div>}
      {loading && <div style={{textAlign:'center',padding:40,color:muted}}><Spinner/></div>}

      {/* Pending */}
      {pending.length>0 && (
        <div style={{background:bg,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
          <div style={{padding:'12px 16px',background:'#fef9c3',borderBottom:'1px solid #fde68a',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16}}>⏳</span>
            <span style={{fontWeight:800,fontSize:14,color:'#92400e'}}>Хүлээгдэж буй хүсэлтүүд — {pending.length}</span>
          </div>
          {pending.map(t=>(
            <TeacherRow key={t.id} t={t} actions={<>
              <button style={btnStyle('#16a34a','white')} onClick={()=>updateStatus(t.id,'active')}>Зөвшөөрөх</button>
              <button style={btnStyle('#fee2e2','#dc2626')} onClick={()=>removeTeacher(t.id,t.email)}>Татгалзах</button>
            </>}/>
          ))}
        </div>
      )}

      {/* Active */}
      <div style={{background:bg,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid '+border,display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:16}}>✅</span>
          <span style={{fontWeight:800,fontSize:14,color:text}}>Идэвхтэй багш нар — {active.length}</span>
        </div>
        {active.length===0
          ? <div style={{padding:'24px',textAlign:'center',color:muted,fontSize:13}}>Одоохондоо байхгүй</div>
          : active.map(t=>(
            <TeacherRow key={t.id} t={t} actions={<>
              <button style={btnStyle('#f1f5f9','#374151')} onClick={()=>updateStatus(t.id,'disabled')}>Хаах</button>
              <button style={btnStyle('#fee2e2','#dc2626')} onClick={()=>removeTeacher(t.id,t.email)}>X</button>
            </>}/>
          ))
        }
      </div>

      {/* Disabled */}
      {disabled.length>0 && (
        <div style={{background:bg,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid '+border,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16}}>🚫</span>
            <span style={{fontWeight:800,fontSize:14,color:muted}}>Хаагдсан — {disabled.length}</span>
          </div>
          {disabled.map(t=>(
            <TeacherRow key={t.id} t={t} actions={<>
              <button style={btnStyle('#dcfce7','#16a34a')} onClick={()=>updateStatus(t.id,'active')}>Нээх</button>
              <button style={btnStyle('#fee2e2','#dc2626')} onClick={()=>removeTeacher(t.id,t.email)}>X</button>
            </>}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────
function HomePage({exams, students, onSelectExam, currentExam, onDeleteExam, onNavigate, onEditExam, dark:d=false}) {
  // Stats for currently selected exam (or all if none selected)
  const examStudents = currentExam ? students.filter(s=>s.examId===currentExam.id) : students;
  const avgScaled = examStudents.length ? (examStudents.reduce((a,b)=>a+b.scaled,0)/examStudents.length).toFixed(1) : '—';
  const passCount = examStudents.filter(s=>s.scaled>=60).length;

  const bg = d?'#1e293b':'white';
  const muted = d?'#94a3b8':'#64748b';

  const stats = currentExam
    ? [
        ['Сурагч',examStudents.length,'#8b5cf6'],
        ['Дундаж ЭЕШ',avgScaled,'#22c55e'],
        ['Тэнцсэн',passCount,'#16a34a'],
        ['Тэнцэх %', examStudents.length ? (passCount/examStudents.length*100).toFixed(0)+'%' : '—', '#f97316'],
      ]
    : [
        ['Нийт шалгалт',exams.length,'#dc2626'],
        ['Нийт сурагч',students.length,'#8b5cf6'],
        ['Дундаж ЭЕШ',avgScaled,'#22c55e'],
        ['Шалгагдсан',students.length,'#f97316'],
      ];

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 20px'}}>
      <div style={{background:'linear-gradient(135deg,#7f1d1d,#dc2626)',borderRadius:20,padding:'36px 32px',color:'white',marginBottom:24}}>
        <div style={{fontSize:11,letterSpacing:3,opacity:.7,marginBottom:8}}>MONGOLIAN EYESH SYSTEM</div>
        <div style={{fontSize:32,fontWeight:900,lineHeight:1.1,marginBottom:12}}>ХАРИУЛТ ХУУДАС ШАЛГАГЧ</div>
        <div style={{opacity:.8,marginBottom:20}}>Дасгал тус бүрийн оноо тохируулах + ЭЕШ хэмжээст оноо тооцоолол + AI bubble detection.</div>
        <button onClick={()=>onNavigate('create')} style={{background:'white',color:'#dc2626',border:'none',borderRadius:12,padding:'12px 28px',fontWeight:800,fontSize:14,cursor:'pointer'}}>+ Шалгалт Үүсгэх</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:24}}>
        {currentExam && (
          <div style={{gridColumn:'1/-1',background:'linear-gradient(135deg,#7c3aed18,#a855f718)',border:'1px solid #a855f730',borderRadius:10,padding:'8px 16px',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:'#7c3aed'}}>{currentExam.title}</span>
            <span style={{fontSize:12,color:muted}}>{currentExam.subject}</span>
            <button onClick={()=>onSelectExam(null)} style={{marginLeft:'auto',background:'none',border:'none',color:muted,cursor:'pointer',fontSize:12}}>✕ Бүгдийг харах</button>
          </div>
        )}
        {stats.map(([label,val,c])=>(
          <div key={label} style={{background:bg,borderRadius:12,padding:'16px 20px',boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
            <div style={{fontSize:28,fontWeight:900,color:c}}>{val}</div>
            <div style={{fontSize:12,color:muted,marginTop:4}}>{label}</div>
          </div>
        ))}
      </div>
      {exams.length===0?(
        <div style={{background:'white',borderRadius:12,padding:'44px',textAlign:'center',color:'#94a3b8'}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Шалгалт байхгүй байна</div>
          <button onClick={()=>onNavigate('create')} style={{marginTop:12,padding:'10px 22px',background:'#dc2626',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>+ Шалгалт Үүсгэх</button>
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:12}}>
          {exams.map(exam=>{
            const es=students.filter(s=>s.examId===exam.id);
            const avgS=es.length?(es.reduce((a,b)=>a+b.scaled,0)/es.length).toFixed(1):null;
            const act=currentExam?.id===exam.id;
            const rm=exam.sec1Scores?.reduce((a,b)=>a+b,0)||0;
            return (
              <div key={exam.id} onClick={()=>onSelectExam(exam)}
                style={{background:'white',borderRadius:12,padding:18,cursor:'pointer',border:`2px solid ${act?'#dc2626':'#e2e8f0'}`,boxShadow:act?'0 0 0 4px #fecaca':'0 1px 4px rgba(0,0,0,.08)',transition:'all .2s'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:800,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{exam.title}</div>
                    <div style={{fontSize:12,color:'#64748b',marginTop:2}}>{exam.subject} · {exam.sec1Count} дасгал · Raw max: {rm}</div>
                    {exam.useSec2&&<div style={{fontSize:11,color:'#059669',marginTop:1}}>2-р хэсэг</div>}
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    {act&&<Badge>Идэвхтэй</Badge>}
                    <button onClick={e=>{e.stopPropagation();onEditExam(exam);}}
                      style={{padding:'4px 8px',background:'#dbeafe',border:'none',borderRadius:6,fontSize:11,color:'#1d4ed8',cursor:'pointer',fontWeight:700}}>Засах</button>
                    <button onClick={e=>{e.stopPropagation();const code=prompt('"'+exam.title+'" устгахын тулд УСТГАХ гэж бичнэ үү:');if(code==='УСТГАХ'){ onDeleteExam(exam.id);}}}
                      style={{padding:'4px 8px',background:'#fee2e2',border:'none',borderRadius:6,fontSize:11,color:'#dc2626',cursor:'pointer'}}>Устгах</button>
                  </div>
                </div>
                <div style={{display:'flex',gap:14,alignItems:'flex-end'}}>
                  <div><div style={{fontSize:20,fontWeight:800,color:'#dc2626'}}>{es.length}</div><div style={{fontSize:11,color:'#94a3b8'}}>Сурагч</div></div>
                  {avgS&&<div><div style={{fontSize:20,fontWeight:800,color:eyeshGrade(pf(avgS)).c}}>{avgS}</div><div style={{fontSize:11,color:'#94a3b8'}}>Дундаж ЭЕШ</div></div>}
                  <div style={{flex:1,textAlign:'right',fontSize:11,color:'#94a3b8'}}>{new Date(exam.createdAt).toLocaleDateString('mn-MN')}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  const [sec2Score,setSec2Score]=useState(prefill?.sec2Score||5);
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
      <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:16}}>1. Шалгалтын тохиргоо</div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Шалгалтын нэр</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Жишээ: Математик 2024 Дадлага 1"
            style={{width:'100%',padding:'10px 14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box'}} />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
          <div>
            <label style={{fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Хичээл</label>
            <select value={subject} onChange={e=>setSubject(e.target.value)}
              style={{width:'100%',padding:'10px 14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:14,outline:'none'}}>
              {SUBJECTS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>1-р хэсэг дасгал (1-36)</label>
            <input type="number" min={1} max={200} value={cnt} onChange={e=>handleCntChange(e.target.value)}
              style={{width:'100%',padding:'10px 14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box'}} />
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
                <label key={sub} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,fontWeight:600,padding:'6px 10px',background:sec2EnabledSubs[si]?'#dcfce7':'#f1f5f9',borderRadius:8,border:'1px solid '+(sec2EnabledSubs[si]?'#86efac':'#e2e8f0')}}>
                  <input type="checkbox" checked={!!sec2EnabledSubs[si]} onChange={e=>{const n=[...sec2EnabledSubs];n[si]=e.target.checked;setSec2EnabledSubs(n);}} style={{width:14,height:14}} />
                  {sub}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:12}}>2. Зөв хариулт, оноо, сэдэв</div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:6}}>
          {Array.from({length:cnt},(_,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
              <span style={{fontSize:11,fontWeight:700,color:'#94a3b8',minWidth:26,textAlign:'right'}}>D{i+1}</span>
              <div style={{display:'flex',gap:2}}>
                {SEC1_CHOICES.map(c=>(
                  <button key={c} onClick={()=>setKeys(k=>{const n=[...k];n[i]=c;return n;})}
                    style={{width:28,height:28,borderRadius:6,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',background:keys[i]===c?'#7c3aed':'#e2e8f0',color:keys[i]===c?'white':'#64748b'}}>{c}</button>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:2}}>
                <button onClick={()=>setScores(s=>{const n=[...s];n[i]=Math.max(1,n[i]-1);return n;})}
                  style={{width:20,height:20,border:'1px solid #e2e8f0',borderRadius:4,fontSize:12,cursor:'pointer',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#64748b'}}>−</button>
                <span style={{minWidth:20,textAlign:'center',fontSize:12,fontWeight:700,color:'#374151'}}>{scores[i]}</span>
                <button onClick={()=>setScores(s=>{const n=[...s];n[i]=Math.min(10,n[i]+1);return n;})}
                  style={{width:20,height:20,border:'1px solid #e2e8f0',borderRadius:4,fontSize:12,cursor:'pointer',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#64748b'}}>+</button>
              </div>
              <select value={topics[i]} onChange={e=>setTopics(t=>{const n=[...t];n[i]=e.target.value;return n;})}
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
        <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:12}}>3. 2-р хэсгийн зөв хариулт, оноо</div>
          {SEC2_SUBS.filter((_,i)=>sec2EnabledSubs[i]).map(sub=>(
            <div key={sub} style={{marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:14,color:'#7c3aed',marginBottom:8}}>Дэд хэсэг {sub}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:6}}>
                {SEC2_ROWS.map(row=>(
                  <div key={row} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#94a3b8',minWidth:14}}>{row}</span>
                    <input type="text" maxLength={1} value={sec2Keys[sub]?.[row]?.ans||sec2Keys[sub]?.[row]||''} 
                      onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,'');setSec2Keys(k=>({...k,[sub]:{...k[sub],[row]:{...(typeof k[sub]?.[row]==='object'?k[sub][row]:{ans:k[sub]?.[row]||''}),ans:v}}}));}}
                      placeholder="0-9" style={{width:44,padding:'5px 6px',border:'1px solid #e2e8f0',borderRadius:6,fontSize:13,outline:'none',textAlign:'center'}} />
                    <span style={{fontSize:11,color:'#94a3b8'}}>оноо:</span>
                    <div style={{display:'flex',alignItems:'center',gap:2}}>
                      <button onClick={()=>setSec2Keys(k=>{const cur=typeof k[sub]?.[row]==='object'?k[sub][row]:{ans:k[sub]?.[row]||''};const sc=Math.max(0.5,Math.round(((cur.score||1)-0.5)*10)/10);return{...k,[sub]:{...k[sub],[row]:{...cur,score:sc}}};} )}
                        style={{width:20,height:20,border:'1px solid #e2e8f0',borderRadius:4,fontSize:12,cursor:'pointer',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#64748b'}}>−</button>
                      <span style={{minWidth:28,textAlign:'center',fontSize:12,fontWeight:700}}>
                        {(typeof sec2Keys[sub]?.[row]==='object'?sec2Keys[sub][row].score:null)||1}
                      </span>
                      <button onClick={()=>setSec2Keys(k=>{const cur=typeof k[sub]?.[row]==='object'?k[sub][row]:{ans:k[sub]?.[row]||''};const sc=Math.min(20,Math.round(((cur.score||1)+0.5)*10)/10);return{...k,[sub]:{...k[sub],[row]:{...cur,score:sc}}};} )}
                        style={{width:20,height:20,border:'1px solid #e2e8f0',borderRadius:4,fontSize:12,cursor:'pointer',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#64748b'}}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={handleSave} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:800,cursor:'pointer'}}>
        {isEdit ? 'Шалгалт Хадгалах (Засвар)' : 'Шалгалт Хадгалах'}
      </button>
    </div>
  );
}

// ── Upload Page ───────────────────────────────────────────

// ── Bubble Overlay ────────────────────────────────────────
// Зураг дээр sec1 хариулт бүрийн байрлалд ногоон/улаан тойрог харуулна
// AI буцаасан detected positions ашиглана, байхгүй бол grid байрлал ашиглана
function BubbleOverlay({scored, det}) {
  const containerRef = useRef();
  const [size, setSize] = useState({w:0,h:0});

  useEffect(()=>{
    if(!containerRef.current) return;
    const img = containerRef.current.previousElementSibling;
    if(!img) return;
    function measure() {
      setSize({w:img.offsetWidth, h:img.offsetHeight});
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    return ()=>ro.disconnect();
  },[]);

  if(!size.w||!size.h) return null;

  const results = scored?.sec1Results||[];
  const total = results.length;
  if(!total) return null;

  // Grid layout: estimate bubble positions
  // Assume ~4 columns layout on the sheet
  const cols = total <= 20 ? 2 : total <= 40 ? 2 : 2;
  const rows = Math.ceil(total / cols);
  const padX = size.w * 0.08;
  const padY = size.h * 0.10;
  const cellW = (size.w - padX*2) / cols;
  const cellH = (size.h - padY*2) / rows;

  // Each question row: label + 5 bubbles (A-E)
  // Bubbles are at ~40-90% of cellW
  const choices = SEC1_CHOICES; // A B C D E

  return (
    <div ref={containerRef} style={{position:'absolute',inset:0,pointerEvents:'none'}}>
      {results.map((r,i)=>{
        const col = i % cols;
        const row = Math.floor(i / cols);
        const baseX = padX + col * cellW;
        const baseY = padY + row * cellH + cellH*0.5;

        const choiceW = cellW * 0.52 / choices.length;
        const choiceStartX = baseX + cellW * 0.32;

        return choices.map((c,ci)=>{
          const cx = choiceStartX + ci * choiceW + choiceW*0.5;
          const cy = baseY;
          const isSel = r.sel === c;
          const isKey = r.key === c;
          const r2 = Math.min(choiceW, cellH) * 0.38;

          if(!isSel && !isKey) return null;

          let bg, border, opacity;
          if(isSel && r.st==='ok') { bg='rgba(22,163,74,0.55)'; border='#15803d'; opacity=1; }
          else if(isSel && r.st==='ng') { bg='rgba(220,38,38,0.55)'; border='#b91c1c'; opacity=1; }
          else if(isSel && r.st==='blank') return null;
          else return null;

          return (
            <div key={c} style={{
              position:'absolute',
              left: cx - r2,
              top: cy - r2,
              width: r2*2,
              height: r2*2,
              borderRadius:'50%',
              background: bg,
              border: `2.5px solid ${border}`,
              opacity,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize: r2*0.9,
              fontWeight:900,
              color:'white',
            }}>
              {r.st==='ok'?'✓':'✗'}
            </div>
          );
        });
      })}
    </div>
  );
}


// ── Scan Mode Panel ───────────────────────────────────────
// Дасгал бүрийн bubble-г нэг нэгээр скан хийдэг горим
function ScanModePanel({exam, scanIdx, setScanIdx, scanAnswers, setScanAnswers,
  scanResult, setScanResult, scanAnalyzing, setScanAnalyzing, onDone, onCancel}) {

  const total = exam.sec1Count;
  const videoRef = useRef();
  const [stream, setStream] = useState(null);
  const [camErr, setCamErr] = useState('');
  const [captured, setCaptured] = useState(null); // base64 of last capture
  const [confirming, setConfirming] = useState(false); // show confirm step

  // Start camera on mount
  useEffect(()=>{
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
      .then(s=>{ setStream(s); if(videoRef.current) videoRef.current.srcObject=s; })
      .catch(()=>setCamErr('Камер нэвтрэх боломжгүй'));
    return ()=>{}; 
  },[]);

  function stopCam() { stream?.getTracks().forEach(t=>t.stop()); }

  function captureFrame() {
    if(!videoRef.current) return;
    const canvas=document.createElement('canvas');
    canvas.width=videoRef.current.videoWidth;
    canvas.height=videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current,0,0);
    canvas.toBlob(blob=>{
      const reader=new FileReader();
      reader.onload=async e=>{
        const b64=e.target.result.split(',')[1];
        setCaptured(b64);
        // Analyze single row — question number + filled bubble
        setScanAnalyzing(true);
        try {
          const resp = await fetch('/api/ai',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              model:'claude-sonnet-4-20250514',
              max_tokens:50,
              messages:[{role:'user',content:[
                {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},
                {type:'text',text:`This is a single row from a bubble answer sheet. The row has a circled number on the left (the question number is inside a circle), followed by 5 bubbles labeled A, B, C, D, E. One bubble is filled/darkened by the student.

Return ONLY a JSON object like: {"q": 3, "answer": "B"}
- "q" is the question number inside the circle on the left
- "answer" is the filled/darkened bubble letter (A/B/C/D/E), or "BLANK" if none are filled
No other text, no markdown, no explanation.`}
              ]}]
            })
          });
          const data=await resp.json();
          const txt=(data.content?.[0]?.text||'').trim();
          let q=scanIdx+1, ans='BLANK';
          try {
            const clean=txt.replace(/```json|```/g,'').trim();
            const parsed=JSON.parse(clean);
            if(parsed.q&&Number.isInteger(parsed.q)) q=parsed.q;
            const a=(parsed.answer||'').toUpperCase().replace(/[^ABCDE]/g,'');
            ans=(['A','B','C','D','E'].includes(a)?a:'BLANK');
          } catch(e){ 
            const a=txt.toUpperCase().replace(/[^ABCDE]/g,'');
            ans=(['A','B','C','D','E'].includes(a)?a:'BLANK');
          }
          setScanResult({answer:ans, q});
          setConfirming(true);
        } catch(e){ setScanResult({answer:'BLANK',q:scanIdx+1,err:e.message}); setConfirming(true); }
        setScanAnalyzing(false);
      };
      reader.readAsDataURL(blob);
    },'image/jpeg',0.92);
  }

  function confirmAnswer(ans, qNum) {
    const idx = (qNum!=null && qNum>=1 && qNum<=total) ? qNum-1 : scanIdx;
    const newAnswers=[...scanAnswers];
    newAnswers[idx]=ans;
    setScanAnswers(newAnswers);
    setCaptured(null); setConfirming(false); setScanResult(null);
    // Move to next unanswered question
    const nextEmpty = newAnswers.findIndex((a,i)=>i>idx&&!a);
    const next = nextEmpty>=0 ? nextEmpty : newAnswers.findIndex(a=>!a);
    if(next<0 || newAnswers.every(a=>a)) {
      stopCam();
      onDone(newAnswers);
    } else {
      setScanIdx(next);
      setTimeout(()=>{ if(videoRef.current&&stream) videoRef.current.srcObject=stream; },50);
    }
  }

  function goBack() {
    if(scanIdx>0) { setScanIdx(scanIdx-1); setCaptured(null); setConfirming(false); setScanResult(null); }
  }

  function cancel() { stopCam(); onCancel(); }

  const progress = Math.round((scanIdx/total)*100);
  const key = exam.sec1Key?.[scanIdx]||'?';

  return (
    <div style={{background:'white',borderRadius:16,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div>
          <span style={{fontWeight:900,fontSize:18,color:'#dc2626'}}>D{scanIdx+1}</span>
          <span style={{fontSize:13,color:'#94a3b8',marginLeft:8}}>/ {total} дасгал</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {scanIdx>0&&<button onClick={goBack} style={{padding:'6px 12px',background:'#f1f5f9',border:'none',borderRadius:8,fontWeight:700,fontSize:13,cursor:'pointer',color:'#64748b'}}>{t.back}</button>}
          <button onClick={cancel} style={{padding:'6px 12px',background:'#fee2e2',border:'none',borderRadius:8,fontWeight:700,fontSize:12,cursor:'pointer',color:'#dc2626'}}>Цуцлах</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{background:'#f1f5f9',borderRadius:99,height:8,marginBottom:16}}>
        <div style={{width:progress+'%',background:'linear-gradient(90deg,#dc2626,#f97316)',height:8,borderRadius:99,transition:'width .3s'}}/>
      </div>

      {/* Already answered summary */}
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:14}}>
        {Array.from({length:total},(_,i)=>{
          const a=scanAnswers[i];
          const isCur=i===scanIdx;
          return <div key={i} style={{
            width:28,height:28,borderRadius:6,
            background:isCur?'#dc2626':a?'#dcfce7':'#f1f5f9',
            border:isCur?'2px solid #dc2626':'2px solid transparent',
            color:isCur?'white':a?'#16a34a':'#94a3b8',
            fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',
            cursor:'pointer'
          }} onClick={()=>{if(!confirming){setScanIdx(i);setCaptured(null);setScanResult(null);}}}>
            {a||i+1}
          </div>;
        })}
      </div>

      {camErr&&<div style={{color:'#dc2626',fontSize:13,background:'#fef2f2',padding:10,borderRadius:8,marginBottom:12}}>{camErr}</div>}

      {/* Camera — always visible */}
      <div style={{position:'relative',marginBottom:12,borderRadius:12,overflow:'hidden',background:'#000',display:confirming?'none':'block'}}>
        <video ref={videoRef} autoPlay playsInline style={{width:'100%',maxHeight:300,display:'block'}}/>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
          <div style={{width:'88%',height:'11%',border:'3px solid rgba(220,38,38,.9)',borderRadius:6,boxShadow:'0 0 0 9999px rgba(0,0,0,.55)'}}/>
        </div>
        <div style={{position:'absolute',bottom:8,left:0,right:0,textAlign:'center'}}>
          <span style={{background:'rgba(0,0,0,.7)',color:'white',fontSize:12,padding:'4px 12px',borderRadius:99,fontWeight:700}}>
            1 мөр — дугаар + 5 bubble хүрээнд байрлуул
          </span>
        </div>
      </div>

      {/* Capture button */}
      {!confirming&&(
        <button onClick={captureFrame} disabled={scanAnalyzing||!!camErr}
          style={{width:'100%',padding:16,marginBottom:8,background:scanAnalyzing?'#94a3b8':'linear-gradient(135deg,#dc2626,#f97316)',
            color:'white',border:'none',borderRadius:12,fontWeight:800,fontSize:16,cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {scanAnalyzing?<><Spinner/> AI шинжилж байна...</>:<>📸 D{scanIdx+1} зураг авах</>}
        </button>
      )}

      {/* Confirm step — shown after capture */}
      {confirming&&captured&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12,alignItems:'start'}}>
            <div>
              <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,marginBottom:4}}>Авсан зураг</div>
              <img src={`data:image/jpeg;base64,${captured}`} style={{width:'100%',borderRadius:8,border:'2px solid #e2e8f0'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,paddingTop:12}}>
              <div style={{fontSize:12,color:'#64748b'}}>Таасан дугаар:</div>
              <div style={{fontSize:28,fontWeight:900,color:'#7c3aed'}}>D{scanResult?.q}</div>
              <div style={{fontSize:12,color:'#64748b',marginTop:4}}>Таасан хариулт:</div>
              <div style={{fontSize:52,fontWeight:900,color:scanResult?.answer==='BLANK'?'#94a3b8':'#dc2626',lineHeight:1}}>
                {scanResult?.answer==='BLANK'?'—':scanResult?.answer}
              </div>
            </div>
          </div>
          <div style={{fontSize:13,color:'#64748b',marginBottom:6,textAlign:'center'}}>Буруу бол засаарай:</div>
          <div style={{display:'flex',gap:6,justifyContent:'center',marginBottom:10}}>
            {[...SEC1_CHOICES,'BLANK'].map(c=>(
              <button key={c} onClick={()=>{ setScanResult(r=>({...r,answer:c})); }}
                style={{width:42,height:42,borderRadius:10,border:'none',fontWeight:800,fontSize:14,cursor:'pointer',
                  background:scanResult?.answer===c?'#dc2626':'#f1f5f9',
                  color:scanResult?.answer===c?'white':'#374151'}}>
                {c==='BLANK'?'—':c}
              </button>
            ))}
          </div>
          <button onClick={()=>confirmAnswer(scanResult?.answer==='BLANK'?'':scanResult?.answer, scanResult?.q)}
            style={{width:'100%',padding:14,background:'linear-gradient(135deg,#16a34a,#22c55e)',color:'white',border:'none',borderRadius:12,fontWeight:800,fontSize:15,cursor:'pointer'}}>
            ✓ D{scanResult?.q} = {scanResult?.answer==='BLANK'?'Хоосон':scanResult?.answer} → Бүртгэх
          </button>
        </div>
      )}
    </div>
  );
}

function UploadPage({exam, students, onAddStudent}) {
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [mode,setMode]=useState(null); // null | 'ai' | 'manual'
  const [imgData,setImgData]=useState(null);
  const [imgMime,setImgMime]=useState(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [err,setErr]=useState('');
  const [det,setDet]=useState(null);
  const [scored,setScored]=useState(null);
  const [showCamera,setShowCamera]=useState(false);
  const [showOverlay,setShowOverlay]=useState(false);
  // Scan mode: one bubble per question
  const [scanMode,setScanMode]=useState(false);
  const [scanIdx,setScanIdx]=useState(0); // current question index
  const [scanAnswers,setScanAnswers]=useState([]); // collected answers
  const [scanResult,setScanResult]=useState(null); // last scan result
  const [scanAnalyzing,setScanAnalyzing]=useState(false);
  const fileRef=useRef();

  if (!exam) return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'24px 20px',textAlign:'center',color:'#94a3b8',paddingTop:80}}>
      <div style={{fontSize:16,fontWeight:600}}>Эхлээд шалгалт сонгоно уу</div>
    </div>
  );

  function handleFile(file) {
    if (!file||!file.type.startsWith('image/')) return;
    setImgMime(file.type);
    const r=new FileReader();
    r.onload=e=>{ setImgData(e.target.result.split(',')[1]); setDet(null); setScored(null); setErr(''); };
    r.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!imgData) return;
    setAnalyzing(true); setErr('');
    try {
      const sec2en={};
      SEC2_SUBS.forEach((s)=>{ sec2en[s]=exam.sec2Config?.[s]?._enabled||false; });
      const enabledSubs = SEC2_SUBS.filter(s=>sec2en[s]);
      const d = await analyzeSheet(imgData, imgMime, {
        n: exam.sec1Count,
        useSec2: exam.useSec2 && enabledSubs.length > 0,
        enabledSubs,
      });
      setDet(d);
      const vExam = { ...exam, sec2Config: exam.sec2Config||{}, sec2Enabled: sec2en };
      setScored(calcScore(d, vExam));
    } catch(e) { setErr(e.message); }
    setAnalyzing(false);
  }

  // Build empty manual scored from exam key
  function startManual() {
    const sec2en={};
    SEC2_SUBS.forEach(s=>{ sec2en[s]=exam.sec2Config?.[s]?._enabled||false; });
    const sec1Results = (exam.sec1Key||[]).map((key,i)=>({q:i+1,sel:'BLANK',key,st:'blank',pts:0,max:exam.sec1Scores?.[i]||1}));
    const sec2Results={};
    SEC2_SUBS.forEach(sub=>{
      if(!sec2en[sub]) return;
      sec2Results[sub]={};
      SEC2_ROWS.forEach(row=>{
        const kv=exam.sec2Config?.[sub]?.[row];
        if(kv===undefined||kv===null||kv==='') return;
        sec2Results[sub][row]={sel:'BLANK',key:kv,st:'blank',pts:0,max:exam.sec2Score||5};
      });
    });
    const rawMax=(exam.sec1Scores||[]).reduce((s,v)=>s+v,0)+
      Object.values(sec2Results).flatMap(r=>Object.values(r)).reduce((s,r)=>s+r.max,0);
    setScored({correct:0,wrong:0,blank:exam.sec1Count,rawEarned:0,rawMax,scaled:0,grade:eyeshGrade(0),sec1Results,sec2Results,needsReview:false});
    setMode('manual');
  }

  async function handleSave() {
    if (!scored||!name.trim()) return alert('Нэр оруулна уу');
    const student = {
      id:uid(), examId:exam.id, name:name.trim(), code:code.trim(),
      version:det?.version||'—', ...scored,
      submittedAt:new Date().toISOString()
    };
    await onAddStudent(student);
    setName(''); setCode(''); setImgData(null); setDet(null); setScored(null); setMode(null);
  }

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'24px 20px'}}>
      {/* Student info */}
      <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:16}}>Сурагчийн мэдээлэл</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label style={{fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Нэр</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Сурагчийн нэр"
              style={{width:'100%',padding:'10px 14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box'}} />
          </div>
          <div>
            <label style={{fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Код / ID</label>
            <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Сурагчийн код"
              style={{width:'100%',padding:'10px 14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box'}} />
          </div>
        </div>
      </div>

      {/* Mode selector */}
      {!scored&&(
        <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:16}}>Хариулт оруулах арга</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <button onClick={()=>setMode('ai')}
              style={{padding:'22px 16px',background:mode==='ai'?'linear-gradient(135deg,#7c3aed,#a855f7)':'#f8fafc',
                color:mode==='ai'?'white':'#374151',border:'2px solid '+(mode==='ai'?'#7c3aed':'#e2e8f0'),
                borderRadius:14,fontWeight:700,fontSize:15,cursor:'pointer',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:6}}>🤖</div>
              AI шинжлэх
              <div style={{fontSize:12,fontWeight:400,marginTop:4,opacity:.8}}>Бүтэн хуудас нэг зураг</div>
            </button>
            <button onClick={()=>{setScanMode(true);setScanIdx(0);setScanAnswers(Array(exam.sec1Count).fill(''));setScanResult(null);setMode('scan');}}
              style={{padding:'22px 16px',background:mode==='scan'?'linear-gradient(135deg,#dc2626,#f97316)':'#f8fafc',
                color:mode==='scan'?'white':'#374151',border:'2px solid '+(mode==='scan'?'#dc2626':'#e2e8f0'),
                borderRadius:14,fontWeight:700,fontSize:15,cursor:'pointer',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:6}}>📸</div>
              Нэг нэгээр
              <div style={{fontSize:12,fontWeight:400,marginTop:4,opacity:.8}}>Дасгал бүрийг тусад нь скан</div>
            </button>
            <button onClick={startManual}
              style={{padding:'22px 16px',background:mode==='manual'?'linear-gradient(135deg,#0369a1,#0ea5e9)':'#f8fafc',
                color:mode==='manual'?'white':'#374151',border:'2px solid '+(mode==='manual'?'#0369a1':'#e2e8f0'),
                borderRadius:14,fontWeight:700,fontSize:15,cursor:'pointer',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:6}}>✏️</div>
              Гараар оруулах
              <div style={{fontSize:12,fontWeight:400,marginTop:4,opacity:.8}}>Дасгал бүрийн хариулт сонгоно</div>
            </button>
          </div>
        </div>
      )}

      {/* Scan mode — one bubble per question */}
      {mode==='scan'&&!scored&&(
        <ScanModePanel
          exam={exam}
          scanIdx={scanIdx}
          setScanIdx={setScanIdx}
          scanAnswers={scanAnswers}
          setScanAnswers={setScanAnswers}
          scanResult={scanResult}
          setScanResult={setScanResult}
          scanAnalyzing={scanAnalyzing}
          setScanAnalyzing={setScanAnalyzing}
          onDone={(answers)=>{
            // Build scored from scan answers
            const sec1Results=(exam.sec1Key||[]).map((key,i)=>{
              const sel=answers[i]||'BLANK';
              const pts=exam.sec1Scores?.[i]||1;
              if(sel==='BLANK'){return{q:i+1,sel:'BLANK',key,st:'blank',pts:0,max:pts};}
              return sel===key?{q:i+1,sel,key,st:'ok',pts,max:pts}:{q:i+1,sel,key,st:'ng',pts:0,max:pts};
            });
            const rawEarned=sec1Results.reduce((s,r)=>s+r.pts,0);
            const rawMax=sec1Results.reduce((s,r)=>s+r.max,0);
            const scaled=rawMax>0?Math.round(rawEarned/rawMax*1000)/10:0;
            const correct=sec1Results.filter(r=>r.st==='ok').length;
            const wrong=sec1Results.filter(r=>r.st!=='ok').length;
            const blank=sec1Results.filter(r=>r.st==='blank').length;
            setScored({correct,wrong,blank,rawEarned,rawMax,scaled,grade:eyeshGrade(scaled),sec1Results,sec2Results:{},needsReview:false});
          }}
          onCancel={()=>{setMode(null);setScanMode(false);setScanIdx(0);setScanAnswers([]);setScanResult(null);}}
        />
      )}

      {/* Scan mode — one bubble per question */}
      {mode==='scan'&&!scored&&(
        <ScanModePanel
          exam={exam}
          scanIdx={scanIdx}
          setScanIdx={setScanIdx}
          scanAnswers={scanAnswers}
          setScanAnswers={setScanAnswers}
          scanResult={scanResult}
          setScanResult={setScanResult}
          scanAnalyzing={scanAnalyzing}
          setScanAnalyzing={setScanAnalyzing}
          onDone={(answers)=>{
            const sec1Results=(exam.sec1Key||[]).map((key,i)=>{
              const sel=answers[i]||'BLANK';
              const pts=exam.sec1Scores?.[i]||1;
              if(sel==='BLANK') return{q:i+1,sel:'BLANK',key,st:'blank',pts:0,max:pts};
              return sel===key?{q:i+1,sel,key,st:'ok',pts,max:pts}:{q:i+1,sel,key,st:'ng',pts:0,max:pts};
            });
            const rawEarned=sec1Results.reduce((s,r)=>s+r.pts,0);
            const rawMax=sec1Results.reduce((s,r)=>s+r.max,0);
            const scaled=rawMax>0?Math.round(rawEarned/rawMax*1000)/10:0;
            const correct=sec1Results.filter(r=>r.st==='ok').length;
            const wrong=sec1Results.filter(r=>r.st!=='ok').length;
            const blank=sec1Results.filter(r=>r.st==='blank').length;
            setScored({correct,wrong,blank,rawEarned,rawMax,scaled,grade:eyeshGrade(scaled),sec1Results,sec2Results:{},needsReview:false});
          }}
          onCancel={()=>{setMode(null);setScanMode(false);setScanIdx(0);setScanAnswers([]);setScanResult(null);}}
        />
      )}

      {/* AI mode — image upload */}
      {mode==='ai'&&!scored&&(
        <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:16}}>Хариулт хуудасны зураг</div>
          {showCamera&&<CameraCapture onCapture={(data,mime)=>{setImgData(data);setImgMime(mime);setShowCamera(false);setDet(null);setScored(null);}} onClose={()=>setShowCamera(false)}/>}
          {!imgData?(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <button onClick={()=>setShowCamera(true)}
                  style={{padding:'18px',background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'white',border:'none',borderRadius:12,fontWeight:700,fontSize:14,cursor:'pointer'}}>
                  📷 Camera
                </button>
                <button onClick={()=>fileRef.current.click()}
                  style={{padding:'18px',background:'linear-gradient(135deg,#0369a1,#0ea5e9)',color:'white',border:'none',borderRadius:12,fontWeight:700,fontSize:14,cursor:'pointer'}}>
                  🖼️ Файл сонгох
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])} />
            </div>
          ):(
            <div>
              {/* Image with overlay toggle */}
              <div style={{position:'relative',marginBottom:12}}>
                <img src={`data:${imgMime};base64,${imgData}`} style={{width:'100%',maxHeight:500,objectFit:'contain',borderRadius:8,display:'block'}} />
                {scored&&showOverlay&&det&&(
                  <BubbleOverlay scored={scored} det={det} />
                )}
              </div>
              {scored&&(
                <button onClick={()=>setShowOverlay(v=>!v)}
                  style={{width:'100%',marginBottom:8,padding:'10px',background:showOverlay?'#dcfce7':'#f1f5f9',border:`2px solid ${showOverlay?'#16a34a':'#e2e8f0'}`,borderRadius:10,fontWeight:700,fontSize:13,cursor:'pointer',color:showOverlay?'#16a34a':'#64748b'}}>
                  {showOverlay?'Overlay харуулж байна — нуух':'Зураг дээр overlay харах'}
                </button>
              )}
              {!scored&&<div style={{display:'flex',gap:8}}>
                <button onClick={handleAnalyze} disabled={analyzing}
                  style={{flex:1,padding:'12px',background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'white',border:'none',borderRadius:10,fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  {analyzing&&<Spinner/>} AI-аар Шинжлэх
                </button>
                <button onClick={()=>{setImgData(null);setDet(null);setScored(null);}}
                  style={{padding:'12px 20px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer'}}>Устгах</button>
              </div>}
              {scored&&<div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setImgData(null);setDet(null);setScored(null);setShowOverlay(false);}}
                  style={{padding:'12px 20px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer'}}>Зураг устгах</button>
              </div>}
            </div>
          )}
          {err&&<div style={{color:'#dc2626',fontSize:13,background:'#fef2f2',padding:'10px 14px',borderRadius:8,border:'1px solid #fecaca',marginTop:10}}>
            <pre style={{margin:0,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{err}</pre>
          </div>}
        </div>
      )}

      {/* Results panel */}
      {scored&&(
        <ScoredPanel
          scored={scored}
          exam={exam}
          onSave={handleSave}
          onUpdateScored={setScored}
          onReset={()=>{setScored(null);setImgData(null);setDet(null);setMode(null);}}
        />
      )}
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

  const bg = d?'#1e293b':'white';
  const borderC = d?'#334155':'#e2e8f0';
  const textC = d?'#f1f5f9':'#1e293b';
  const mutedC = d?'#94a3b8':'#64748b';
  const rowBg = d?'#0f172a':'#f8fafc';

  return (
    <div style={{maxWidth:1000,margin:'0 auto',padding:'24px 20px'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)',borderRadius:20,padding:'24px 28px',color:'white',marginBottom:20}}>
        <div style={{fontSize:11,letterSpacing:3,opacity:.7,marginBottom:4}}>EYESH CHECKER</div>
        <div style={{fontSize:26,fontWeight:900}}>Рейтинг</div>
        <div style={{opacity:.8,fontSize:13,marginTop:4}}>Судлагдахуунаар, кодоор эрэмбэлсэн</div>
      </div>

      {/* Subject filter */}
      <div style={{background:bg,borderRadius:14,padding:'14px 16px',marginBottom:12,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
        <div style={{fontSize:11,fontWeight:700,color:mutedC,marginBottom:8,letterSpacing:1}}>СУДЛАГДАХУУН</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button onClick={()=>setFilterSubject('all')}
            style={{padding:'6px 14px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',
              background:filterSubject==='all'?'#7c3aed':(d?'#334155':'#f1f5f9'),
              color:filterSubject==='all'?'white':(d?'#e2e8f0':'#374151')}}>
            Бүгд
          </button>
          {allSubjects.map(s=>(
            <button key={s} onClick={()=>setFilterSubject(s)}
              style={{padding:'6px 14px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',
                background:filterSubject===s?'#7c3aed':(d?'#334155':'#f1f5f9'),
                color:filterSubject===s?'white':(d?'#e2e8f0':'#374151')}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Class accordion filter */}
      {allClasses.length>0&&(
        <div style={{background:bg,borderRadius:14,padding:'14px 16px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <div style={{fontSize:11,fontWeight:700,color:mutedC,marginBottom:8,letterSpacing:1}}>АНГИ</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={()=>{setFilterClass('all');setOpenClass(null);}}
              style={{padding:'6px 14px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',
                background:filterClass==='all'?'#dc2626':(d?'#334155':'#f1f5f9'),
                color:filterClass==='all'?'white':(d?'#e2e8f0':'#374151')}}>
              Бүгд
            </button>
            {allClasses.map(cls=>(
              <button key={cls}
                onClick={()=>{
                  setFilterClass(cls);
                  setOpenClass(o=>o===cls?null:cls);
                }}
                style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(openClass===cls?'#dc2626':borderC),fontWeight:700,fontSize:12,cursor:'pointer',
                  background:filterClass===cls?'#dc2626':(d?'#334155':'#f1f5f9'),
                  color:filterClass===cls?'white':(d?'#e2e8f0':'#374151')}}>
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
                      <div key={st.code} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,background:i%2===0?(d?'#1e293b':rowBg):(d?'#0f172a':'white')}}>
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
      <div style={{background:bg,borderRadius:14,boxShadow:'0 1px 4px rgba(0,0,0,.08)',overflow:'hidden'}}>
        {ranked.length===0
          ? <div style={{textAlign:'center',padding:60,color:mutedC}}>Өгөгдөл байхгүй</div>
          : ranked.map((st,i)=>{
              const g = eyeshGrade(st.avg);
              const isMedal = i<3;
              return (
                <div key={st.code} style={{
                  display:'flex',alignItems:'center',gap:12,padding:'11px 18px',
                  borderBottom:'1px solid '+borderC,
                  background:i===0?(d?'#2d1f00':'#fffbeb'):i===1?(d?'#1a2030':'#f8fafc'):i===2?(d?'#271a0a':'#fef3e2'):bg
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
function BoardPage({exam, students, onDeleteStudent, onExportExcel, dark:d=false}) {
  if (!exam) return <div style={{textAlign:'center',padding:80,color:'#94a3b8',fontWeight:600}}>Шалгалт сонгоно уу</div>;
  const sorted=[...students].sort((a,b)=>b.scaled-a.scaled);

  function exportStudentPDF(student) {
    import('jspdf').then(({jsPDF})=>{
      const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
      const W=210, pw=20;
      const grade = eyeshGrade(student.scaled||0);
      const gradeLabel = {'Онц':'Excellent','Сайн':'Good','Дунд сайн':'Above Avg','Хангалттай':'Satisfactory','Хангалтгүй':'Poor','Тэнцээгүй':'Fail'}[grade.l]||grade.l;

      const safeStr = s => (s||'').replace(/[^\x00-\x7F]/g, '?');
      const safeCode = safeStr(student.code);
      const safeClass = safeStr(student.class);
      const safeTitle = safeStr(exam.title);
      const safeSubject = SUBJECT_EN[exam.subject] || safeStr(exam.subject);

      // ── Scores ──
      const sec1Res = student.sec1Results||[];
      const sec1Earned = sec1Res.reduce((a,r)=>a+(r.pts||0),0);
      const sec1Max    = sec1Res.reduce((a,r)=>a+(r.max||0),0);
      const sec2Ent    = Object.entries(student.sec2Results||{});
      const sec2Earned = sec2Ent.reduce((a,[,rows])=>a+Object.values(rows).reduce((b,r)=>b+(r.pts||0),0),0);
      const sec2Max    = sec2Ent.reduce((a,[,rows])=>a+Object.values(rows).reduce((b,r)=>b+(r.max||0),0),0);
      // Calculate totalMax from exam config (not stored value which may be wrong)
      const sec1MaxCalc = (exam.sec1Scores||[]).reduce((a,b)=>a+(b||1), 0) || (exam.sec1Count||0);
      const sec2MaxCalc = sec2Ent.reduce((a,[,rows])=>a+Object.values(rows).reduce((b,r)=>b+(r.max||0),0),0);
      const totalMax   = sec1MaxCalc + sec2MaxCalc;
      const totalEarned= student.rawEarned||0;

      let y = 20;
      const line = (label, value, bold=false) => {
        doc.setFont('helvetica', bold?'bold':'normal');
        doc.setFontSize(10);
        doc.setTextColor(0,0,0);
        doc.text(label, pw, y);
        doc.text(String(value), pw+70, y);
        y += 7;
      };
      const divider = () => {
        doc.setDrawColor(180,180,180);
        doc.line(pw, y, W-pw, y);
        y += 5;
      };
      const sectionHeader = (title) => {
        y += 2;
        doc.setFont('helvetica','bold');
        doc.setFontSize(11);
        doc.setTextColor(0,0,0);
        doc.text(title, pw, y);
        y += 3;
        divider();
      };

      // ── Title ──
      doc.setFont('helvetica','bold');
      doc.setFontSize(14);
      doc.setTextColor(0,0,0);
      doc.text('EYESH Checker - Student Result Report', pw, y);
      y += 5;
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);
      doc.setTextColor(100,100,100);
      doc.text(safeTitle+' | '+safeSubject+'  |  '+new Date().toLocaleDateString('en-CA'), pw, y);
      y += 6;
      divider();

      // ── Student Info ──
      sectionHeader('Student Information');
      line('Student Code:', safeCode);
      line('Class:', safeClass||'-');
      line('Exam:', safeTitle);
      line('Subject:', safeSubject);
      y += 2;
      divider();

      // ── Score Summary ──
      sectionHeader('Score Summary');
      // Big performance display
      doc.setFont('helvetica','bold');
      doc.setFontSize(36);
      doc.setTextColor(0,0,0);
      doc.text((student.scaled||0)+'%', pw, y);
      doc.setFont('helvetica','normal');
      doc.setFontSize(12);
      doc.setTextColor(80,80,80);
      doc.text(grade.g+' - '+gradeLabel, pw+35, y);
      y += 10;
      doc.setDrawColor(200,200,200);
      doc.line(pw, y, W-pw, y);
      y += 6;
      line('Total Score (Max):', totalMax+' pts');
      line('Total Score (Earned):', totalEarned+' pts');
      if(sec1Max>0) line('Section 1 Score:', sec1Earned+' / '+sec1Max+' pts');
      if(sec2Max>0) line('Section 2 Score:', sec2Earned+' / '+sec2Max+' pts');
      line('Correct Answers:', student.correct);
      line('Wrong Answers:', student.wrong);
      line('Blank Answers:', student.blank);
      y += 2;
      divider();

      // ── Correct question numbers ──
      sectionHeader('Correct Questions');
      const correct = sec1Res.map((r,i)=>r.st==='ok'?i+1:null).filter(Boolean);
      if(correct.length===0){
        doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
        doc.text('None', pw, y); y+=7;
      } else {
        // Print in rows of 20
        const perRow=20;
        for(let i=0;i<correct.length;i+=perRow){
          doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
          doc.text(correct.slice(i,i+perRow).join('  '), pw, y);
          y+=7;
        }
      }
      y+=2; divider();

      // ── Wrong question numbers ──
      sectionHeader('Wrong Questions');
      const wrong = sec1Res.map((r,i)=>r.st==='ng'?i+1:null).filter(Boolean);
      if(wrong.length===0){
        doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
        doc.text('None', pw, y); y+=7;
      } else {
        const perRow=20;
        for(let i=0;i<wrong.length;i+=perRow){
          doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
          doc.text(wrong.slice(i,i+perRow).join('  '), pw, y);
          y+=7;
        }
      }
      y+=2; divider();

      // ── Section 2 if exists ──
      if(sec2Max>0){
        y+=2; divider();
        sectionHeader('Section 2 Details');
        sec2Ent.forEach(([sub,rows])=>{
          doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0,0,0);
          const e2=Object.values(rows).reduce((a,r)=>a+(r.pts||0),0);
          const m2=Object.values(rows).reduce((a,r)=>a+(r.max||0),0);
          doc.text(sub+':  '+e2+' / '+m2+' pts', pw, y); y+=7;
        });
      }

      // ── Footer ──
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(150,150,150);
      doc.text('EYESH Checker  |  A>=90  B>=80  C>=70  D>=60  F<60', pw, 290);

      doc.save(safeCode+'_result.pdf');
    });
  }

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:d?'#f1f5f9':'#1e293b'}}>{exam.title} — Жагсаалт</h1>
        <button onClick={()=>onExportExcel(exam,students)} style={{padding:'10px 16px',background:'linear-gradient(135deg,#16a34a,#22c55e)',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
          Excel татах
        </button>
      </div>
      {sorted.length===0?(
        <div style={{background:d?'#1e293b':'white',borderRadius:12,padding:'44px',textAlign:'center',color:'#94a3b8'}}>Одоохондоо сурагч байхгүй</div>
      ):(
        <div style={{background:d?'#1e293b':'white',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:d?'#0f172a':'#f8fafc',borderBottom:'2px solid '+(d?'#334155':'#e2e8f0')}}>
                {['#','Нэр','Код','Хув.','Зөв','Буруу','Хоосон','Гүйцэтгэл','PDF',''].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:12,fontWeight:700,color:'#64748b'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s,i)=>{
                const g=eyeshGrade(s.scaled);
                return (
                  <tr key={s.id} style={{borderBottom:'1px solid '+(d?'#1e293b':'#f1f5f9'),background:d?'#1e293b':'white'}}>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#94a3b8'}}>{i+1}</td>
                    <td style={{padding:'10px 14px',fontSize:14,fontWeight:700,color:d?'#f1f5f9':'#1e293b'}}>{s.name}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#64748b'}}>{s.code}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:d?'#94a3b8':'#64748b'}}>{s.version}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#16a34a',fontWeight:600}}>{s.correct}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#dc2626',fontWeight:600}}>{s.wrong}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:'#94a3b8'}}>{s.blank}</td>
                    <td style={{padding:'10px 14px',fontSize:16,fontWeight:800,color:g.c}}>{s.scaled}%</td>
                    <td style={{padding:'10px 14px'}}>
                      <button onClick={()=>exportStudentPDF(s)}
                        style={{padding:'3px 8px',background:'#fef3c7',border:'none',borderRadius:6,fontSize:11,color:'#92400e',cursor:'pointer',fontWeight:700}}>PDF</button>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <button onClick={()=>{const c=prompt(s.name+' устгахын тулд УСТГАХ гэж бичнэ үү:');if(c==='УСТГАХ')onDeleteStudent(s.id);}}
                        style={{padding:'3px 8px',background:'#fee2e2',border:'none',borderRadius:6,fontSize:11,color:'#dc2626',cursor:'pointer'}}>Устгах</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Analytics Page ────────────────────────────────────────
function AnalyticsPage({exam, students, onExportAnalytics, dark:d=false}) {
  const [filterClass, setFilterClass] = useState('');
  const allClasses = [...new Set(students.map(s=>s.code?.split('-')?.[0]||'').filter(Boolean))].sort();
  const filtered = filterClass ? students.filter(s=>(s.code||'').startsWith(filterClass)) : students;
  if (!exam||!students.length) return <div style={{textAlign:'center',padding:80,color:'#94a3b8',fontWeight:600}}>Дүн шинжилгээнд хангалттай өгөгдөл байхгүй</div>;
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
            <button onClick={()=>setFilterClass('')} style={{padding:'6px 12px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',background:filterClass===''?'#dc2626':'#f1f5f9',color:filterClass===''?'white':'#374151'}}>Бүгд</button>
            {allClasses.map(c=>(
              <button key={c} onClick={()=>setFilterClass(c)} style={{padding:'6px 12px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',background:filterClass===c?'#dc2626':'#f1f5f9',color:filterClass===c?'white':'#374151'}}>{c}</button>
            ))}
          </div>
          <button onClick={()=>onExportAnalytics(exam,filtered)} style={{padding:'10px 14px',background:'linear-gradient(135deg,#16a34a,#22c55e)',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
            Анализ Excel татах
          </button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:20}}>
        {[['Нийт сурагч',filtered.length,'#dc2626'],['Дундаж ЭЕШ',avg,eyeshGrade(pf(avg)).c],['Медиан',median,'#7c3aed'],['Тэнцсэн',pass+'/'+filtered.length,'#16a34a'],['Тэнцэх %',filtered.length?+(pass/filtered.length*100).toFixed(1):0,'#f97316']].map(([l,v,c])=>(
          <div key={l} style={{background:'white',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
            <div style={{fontSize:26,fontWeight:900,color:c}}>{v}</div>
            <div style={{fontSize:12,color:'#94a3b8',marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div style={{background:'white',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Зэрэглэлийн тархалт</div>
          {grades.map((g,i)=>{
            const cnt=gradeCounts[i];
            const pct=n?+(cnt/n*100).toFixed(1):0;
            return (
              <div key={g} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{fontWeight:600}}>{g} — {gradeLabels[i]}</span>
                  <span style={{color:'#64748b'}}>{cnt} ({pct}%)</span>
                </div>
                <div style={{height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',background:gradeColors[i],width:pct+'%',borderRadius:4,transition:'width .3s'}} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{background:'white',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Сэдвийн амжилт</div>
          {Object.entries(topicMap).map(([t,d])=>{
            const pct=d.total?+(d.correct/d.total*100).toFixed(1):0;
            const subjectTopics=getTopics(exam.subject);const ci=subjectTopics.indexOf(t);
            return (
              <div key={t} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{fontWeight:600}}>{t}</span>
                  <span style={{color:'#64748b'}}>{pct}%</span>
                </div>
                <div style={{height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
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

// ── Material Page ─────────────────────────────────────────
function MaterialPage({onPrefill}) {
  const [subject,setSubject]=useState(SUBJECTS[0]);
  const [cnt,setCnt]=useState(36);
  const [useSec2,setUseSec2]=useState(false);
  const [fileData,setFileData]=useState(null);
  const [fileType,setFileType]=useState(null);
  const [fileName,setFileName]=useState('');
  const [analyzing,setAnalyzing]=useState(false);
  const [err,setErr]=useState('');
  const [result,setResult]=useState(null);
  const fileRef=useRef();

  function loadFile(file) {
    if (!file) return;
    const isPdf=file.name.toLowerCase().endsWith('.pdf')||file.type==='application/pdf';
    const ft=isPdf?'application/pdf':file.type;
    setFileType(ft); setFileName(file.name);
    const r=new FileReader();
    r.onload=e=>{ setFileData(e.target.result.split(',')[1]); setErr(''); setResult(null); };
    r.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!fileData) return;
    setAnalyzing(true); setErr('');
    try {
      const res = await analyzeMaterial(fileData, fileType, {n:cnt,subject,useSec2,sec2subs:[true,true,true,true],sec2rows:SEC2_ROWS});
      setResult(res);
    } catch(e) { setErr(e.message); }
    setAnalyzing(false);
  }

  function handleUsePrefill(version) {
    if (!result) return;
    const sec1 = result.section1?.[version]||[];
    const keys = Array.from({length:cnt},(_,i)=>sec1.find(q=>q.q===i+1)?.answer||'A');
    const prefill = {
      sec1Key:keys, sec1Count:cnt, subject,
      useSec2, sec2Score:result.sec2_score_per_row||5,
      sec1Scores:Array.from({length:cnt},(_,i)=>{const s=result.scores?.find(s=>s.q===i+1);return s?.score||2;}),
      topics:Array.from({length:cnt},(_,i)=>{const s=result.scores?.find(s=>s.q===i+1);const tl=getTopics(subject);return tl.includes(s?.topic)?s.topic:tl[0];}),
    };
    onPrefill(prefill);
  }

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'24px 20px'}}>
      <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:16}}>1. Шалгалтын тохиргоо</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:12,alignItems:'end'}}>
          <div>
            <label style={{fontSize:13,fontWeight:600,display:'block',marginBottom:4}}>Хичээл</label>
            <select value={subject} onChange={e=>setSubject(e.target.value)}
              style={{width:'100%',padding:'10px 14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:14,outline:'none'}}>
              {SUBJECTS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:13,fontWeight:600,display:'block',marginBottom:4}}>1-р хэсэг дасгал</label>
            <input type="number" min={1} max={200} value={cnt} onChange={e=>setCnt(parseInt(e.target.value)||1)}
              style={{width:'100%',padding:'10px 14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box'}} />
          </div>
          <div style={{paddingBottom:2}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14,fontWeight:600}}>
              <input type="checkbox" checked={useSec2} onChange={e=>setUseSec2(e.target.checked)} style={{width:16,height:16}} />
              2-р хэсэг
            </label>
          </div>
        </div>
      </div>

      <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1e293b',marginBottom:16}}>2. Материалын файл оруулах</div>
        {fileData?(
          <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:'#15803d'}}>{fileName}</div>
              <div style={{fontSize:12,color:'#16a34a'}}>{fileType==='application/pdf'?'PDF':'Зураг'}</div>
            </div>
            <button onClick={()=>{setFileData(null);setFileType(null);setFileName('');setResult(null);}}
              style={{padding:'4px 12px',background:'#fee2e2',border:'none',borderRadius:6,fontSize:12,color:'#dc2626',cursor:'pointer'}}>Устгах</button>
          </div>
        ):(
          <div onClick={()=>fileRef.current.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();loadFile(e.dataTransfer.files[0]);}}
            style={{border:'2px dashed #e2e8f0',borderRadius:12,padding:'40px 20px',textAlign:'center',cursor:'pointer',color:'#94a3b8',marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600}}>PDF эсвэл зураг чирж тавих</div>
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{display:'none'}} onChange={e=>loadFile(e.target.files[0])} />
          </div>
        )}
        {err&&<div style={{color:'#dc2626',fontSize:13,background:'#fef2f2',padding:'10px 14px',borderRadius:8,border:'1px solid #fecaca',marginBottom:12}}>
          <pre style={{margin:0,whiteSpace:'pre-wrap',wordBreak:'break-all',fontSize:11}}>{err}</pre>
        </div>}
        <button onClick={handleAnalyze} disabled={!fileData||analyzing}
          style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:(!fileData||analyzing)?.6:1}}>
          {analyzing&&<Spinner/>} AI-аар Хариулт Бодох
        </button>
      </div>

      {result&&(
        <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>Хариулт — {result.versions_found?.join(', ')}</div>
          {result.versions_found?.map(v=>(
            <div key={v} style={{marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:14,color:'#7c3aed',marginBottom:8}}>Хувилбар {v}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                {(result.section1?.[v]||[]).map(q=>(
                  <div key={q.q} style={{background:q.confidence>=80?'#f0fdf4':q.confidence>=60?'#fef3c7':'#fef2f2',border:'1px solid #e2e8f0',borderRadius:6,padding:'3px 8px',fontSize:12}}>
                    <span style={{color:'#94a3b8'}}>D{q.q}</span> <span style={{fontWeight:700}}>{q.answer}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>handleUsePrefill(v)}
                style={{padding:'8px 20px',background:'#dc2626',color:'white',border:'none',borderRadius:8,fontWeight:700,fontSize:13,cursor:'pointer'}}>
                Хувилбар {v} ашиглан шалгалт үүсгэх
              </button>
            </div>
          ))}
        </div>
      )}
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
      <div style={{fontWeight:800,fontSize:20,color:'#1e293b',marginBottom:20}}>Сурагчийн бүртгэл</div>
      <div style={{background:'#dbeafe',border:'1px solid #93c5fd',borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#1d4ed8'}}>
        Сурагчид <strong>/student</strong> хуудсаар орж кодоороо нэвтэрч шалгалтаа өгнө.
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div style={{background:'white',borderRadius:16,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Нэг сурагч нэмэх</div>
          <input value={singleName} onChange={e=>setSingleName(e.target.value)} placeholder="Нэр (заавал биш)"
            style={{width:'100%',padding:'9px 12px',border:'2px solid #e2e8f0',borderRadius:8,fontSize:14,outline:'none',marginBottom:8,boxSizing:'border-box'}} />
          <input value={singleClass} onChange={e=>setSingleClass(e.target.value)} placeholder="Анги (заавал биш)"
            style={{width:'100%',padding:'9px 12px',border:'2px solid #e2e8f0',borderRadius:8,fontSize:14,outline:'none',marginBottom:10,boxSizing:'border-box'}} />
          <button onClick={handleSingleAdd} disabled={adding}
            style={{width:'100%',padding:'10px',background:'#dc2626',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
            Нэмэх
          </button>
        </div>

        <div style={{background:'white',borderRadius:16,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Олноор нэмэх</div>
          <div style={{fontSize:12,color:'#94a3b8',marginBottom:8}}>Нэг мөрт нэг сурагч: нэр, анги (код хоосон бол автоматаар үүснэ)</div>
          <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)}
            placeholder={"Болд, 12А\nНомун, 12Б\nДорж, 12А"}
            style={{width:'100%',height:100,padding:'9px 12px',border:'2px solid #e2e8f0',borderRadius:8,fontSize:13,outline:'none',resize:'vertical',marginBottom:10,boxSizing:'border-box'}} />
          <button onClick={handleBulkAdd} disabled={adding}
            style={{width:'100%',padding:'10px',background:'#7c3aed',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>
            {adding?'Нэмж байна...':'Бүгдийг нэмэх'}
          </button>
        </div>
      </div>

      {msg && <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:13,color:'#15803d'}}>{msg}</div>}

      <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',fontWeight:700,fontSize:14,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8,alignItems:'center'}}>
          <span>Нийт: {accounts.length} сурагч</span>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[...new Set(accounts.map(a=>a.class||'').filter(Boolean))].sort().map(cls=>(
              <button key={cls} onClick={()=>setFilterCls(f=>f===cls?'':cls)}
                style={{padding:'4px 10px',borderRadius:6,border:'none',fontWeight:700,fontSize:11,cursor:'pointer',
                  background:filterCls===cls?'#dc2626':'#f1f5f9',color:filterCls===cls?'white':'#374151'}}>{cls}</button>
            ))}
            {filterCls&&<button onClick={()=>setFilterCls('')} style={{padding:'4px 10px',borderRadius:6,border:'none',fontWeight:700,fontSize:11,cursor:'pointer',background:'#f1f5f9',color:'#64748b'}}>× Цэвэрлэх</button>}
          </div>
        </div>
        {loading ? <div style={{padding:40,textAlign:'center'}}><Spinner/></div> :
        accounts.length===0 ? <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Бүртгэлтэй сурагч байхгүй</div> : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                {['#','Код','Нэр','Анги',''].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:12,fontWeight:700,color:'#64748b'}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {accounts.filter(a=>!filterCls||a.class===filterCls).map((a,i)=>(
                <tr key={a.id} style={{borderTop:'1px solid #f1f5f9'}}>
                  <td style={{padding:'10px 14px',fontSize:13,color:'#94a3b8'}}>{i+1}</td>
                  <td style={{padding:'10px 14px',fontWeight:800,fontSize:14,color:'#dc2626'}}>{a.code}</td>
                  <td style={{padding:'10px 14px',fontSize:14}}>{a.name||'—'}</td>
                  <td style={{padding:'10px 14px',fontSize:13,color:'#64748b'}}>{a.class||'—'}</td>
                  <td style={{padding:'10px 14px'}}>
                    <button onClick={()=>handleDelete(a.id)}
                      style={{padding:'3px 10px',background:'#fee2e2',border:'none',borderRadius:6,fontSize:11,color:'#dc2626',cursor:'pointer'}}>Устгах</button>
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
function StudentPortal({student, onLogout}) {
  const [lang, toggleLang, t] = useLang();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [scored, setScored] = useState(null);
  const [loading, setLoading] = useState(true);

  // Manual answer state
  const [sec1Sel, setSec1Sel] = useState([]); // array of selected answers (no key shown)
  const [sec2Sel, setSec2Sel] = useState({}); // {sub: {row: digit}}
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  function stoken() { return typeof window!=='undefined'?localStorage.getItem('student_token'):''; }

  useEffect(()=>{
    // Fetch all exams for student to choose from (use public endpoint)
    fetch('/api/student/exams',{headers:{Authorization:'Bearer '+stoken()}})
      .then(r=>r.json()).then(d=>{ setExams(Array.isArray(d)?d:[]); }).catch(()=>{})
      .finally(()=>setLoading(false));
  },[]);

  function selectExam(exam) {
    setSelectedExam(exam);
    setSec1Sel(Array(exam.sec1Count).fill(''));
    const s2={};
    SEC2_SUBS.forEach(sub=>{
      if(!exam.sec2Config?.[sub]?._enabled) return;
      s2[sub]={};
      SEC2_ROWS.forEach(row=>{ if(exam.sec2Config[sub][row]!==''&&exam.sec2Config[sub][row]!==undefined) s2[sub][row]=''; });
    });
    setSec2Sel(s2);
    setScored(null); setSubmitted(false); setErr('');
  }

  function calcStudentScore(exam) {
    const {sec1Key,sec1Scores,sec2Config,sec2Score,useSec2} = exam;
    let correct=0,wrong=0,blank=0,rawEarned=0,rawMax=0;
    const sec1Results=[];
    sec1Key.forEach((key,i)=>{
      const sel=sec1Sel[i]||'BLANK';
      const pts=sec1Scores?.[i]||1;
      rawMax+=pts;
      if(sel==='BLANK'||sel===''){wrong++;blank++;sec1Results.push({q:i+1,sel:'BLANK',key:'?',st:'blank',pts:0,max:pts});}
      else if(sel===key){correct++;rawEarned+=pts;sec1Results.push({q:i+1,sel,key:'?',st:'ok',pts,max:pts});}
      else{wrong++;sec1Results.push({q:i+1,sel,key:'?',st:'ng',pts:0,max:pts});}
    });
    const sec2Results={};
    if(useSec2&&sec2Config){
      SEC2_SUBS.forEach(sub=>{
        if(!sec2Config?.[sub]?._enabled) return;
        sec2Results[sub]={};
        SEC2_ROWS.forEach(row=>{
          const kv=sec2Config[sub][row];
          if(kv===undefined||kv===null||kv==='') return;
          const rowCfg=typeof sec2Config[sub][row]==='object'?sec2Config[sub][row]:null;
          const pts=rowCfg?.score||sec2Score||1; rawMax+=pts;
          const dv=sec2Sel[sub]?.[row]||'BLANK';
          if(dv==='BLANK'||dv===''){wrong++;blank++;sec2Results[sub][row]={sel:'BLANK',key:'?',st:'blank',pts:0,max:pts};}
          else if(String(dv)===String(kv)){correct++;rawEarned+=pts;sec2Results[sub][row]={sel:dv,key:'?',st:'ok',pts,max:pts};}
          else{wrong++;sec2Results[sub][row]={sel:dv,key:'?',st:'ng',pts:0,max:pts};}
        });
      });
    }
    const scaled=rawMax>0?Math.round(rawEarned/rawMax*1000)/10:0;
    return{correct,wrong,blank,rawEarned,rawMax,scaled,grade:eyeshGrade(scaled),sec1Results,sec2Results,needsReview:false};
  }

  async function handleSubmit() {
    if (!selectedExam) return;
    setSubmitting(true); setErr('');
    try {
      const sc = calcStudentScore(selectedExam);
      await fetch('/api/student/submit',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+stoken()},
        body:JSON.stringify({id:uid(),examId:selectedExam.id,name:student.name||student.code,
          code:student.code,version:'—',...sc,submittedAt:new Date().toISOString()})
      }).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;});
      setScored(sc); setSubmitted(true);
    } catch(e){ setErr(e.message); }
    setSubmitting(false);
  }

  // Loading
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><Spinner/></div>;

  // Result screen
  if (submitted && scored) return (
    <div style={{minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'white',borderRadius:20,padding:'36px 28px',maxWidth:400,width:'100%',textAlign:'center',boxShadow:'0 4px 24px rgba(0,0,0,.1)'}}>
        <div style={{fontSize:56,marginBottom:12}}>✅</div>
        <div style={{fontSize:20,fontWeight:900,color:'#15803d',marginBottom:16}}>{t.submitted}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
          {[[t.performance,scored.scaled+'%',scored.grade?.c],[t.correct,scored.correct,'#16a34a'],[t.wrong,scored.wrong,'#dc2626']].map(([l,v,c])=>(
            <div key={l} style={{background:'#f8fafc',borderRadius:10,padding:'12px 8px'}}>
              <div style={{fontSize:20,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>{l}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>{setSelectedExam(null);setSubmitted(false);setScored(null);}}
          style={{width:'100%',padding:12,background:'#dc2626',color:'white',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',marginBottom:8}}>
          {t.back}
        </button>
        <button onClick={onLogout} style={{width:'100%',padding:12,background:'#f1f5f9',color:'#64748b',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer'}}>
          {t.logout}
        </button>
      </div>
    </div>
  );

  // Exam list
  if (!selectedExam) return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      <header style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontWeight:800,fontSize:16}}>{t.hello} {student.name||student.code}!</div>
          <div style={{fontSize:12,color:'#64748b'}}>{t.code}: {student.code}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}><button onClick={toggleLang} style={{padding:'6px 10px',background:'#f1f5f9',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>{lang==='mn'?'EN':'МН'}</button><button onClick={onLogout} style={{padding:'6px 14px',background:'#fee2e2',border:'none',borderRadius:8,fontSize:13,color:'#dc2626',fontWeight:700,cursor:'pointer'}}>{t.logout}</button></div>
      </header>
      <div style={{maxWidth:600,margin:'0 auto',padding:'24px 16px'}}>
        <div style={{fontWeight:800,fontSize:18,color:'#1e293b',marginBottom:16}}>{t.selectExam}</div>
        {exams.length===0
          ? <div style={{background:'white',borderRadius:12,padding:40,textAlign:'center',color:'#94a3b8'}}>{t.noExams}</div>
          : exams.map(exam=>(
            <div key={exam.id} onClick={()=>selectExam(exam)}
              style={{background:'white',borderRadius:12,padding:18,marginBottom:10,cursor:'pointer',border:'2px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
              <div style={{fontWeight:800,fontSize:16,color:'#1e293b'}}>{exam.title}</div>
              <div style={{fontSize:13,color:'#64748b',marginTop:4}}>{exam.subject} · {exam.sec1Count} дасгал{exam.useSec2?' · 2-р хэсэг':''}</div>
            </div>
          ))
        }
      </div>
    </div>
  );

  // Answer entry
  const enabledSec2Subs = SEC2_SUBS.filter(s=>selectedExam.sec2Config?.[s]?._enabled);
  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      <header style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 20px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <button onClick={()=>setSelectedExam(null)} style={{padding:'6px 12px',background:'#f1f5f9',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700}}>{t.back}</button>
        <div>
          <div style={{fontWeight:800,fontSize:15}}>{selectedExam.title}</div>
          <div style={{fontSize:12,color:'#64748b'}}>{selectedExam.subject}</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          <button onClick={toggleLang} style={{padding:'6px 10px',background:'#f1f5f9',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>{lang==='mn'?'EN':'МН'}</button>
          <button onClick={onLogout} style={{padding:'6px 14px',background:'#fee2e2',border:'none',borderRadius:8,fontSize:13,color:'#dc2626',fontWeight:700,cursor:'pointer'}}>{t.logout}</button>
        </div>
      </header>
      <div style={{maxWidth:700,margin:'0 auto',padding:'20px 16px'}}>

        {/* Section 1 */}
        <div style={{background:'white',borderRadius:16,padding:20,marginBottom:12,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>{t.section1} — {selectedExam.sec1Count} дасгал</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:6}}>
            {Array.from({length:selectedExam.sec1Count},(_,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                <span style={{fontSize:11,fontWeight:700,color:'#94a3b8',minWidth:26,textAlign:'right'}}>D{i+1}</span>
                <div style={{display:'flex',gap:3}}>
                  {SEC1_CHOICES.map(c=>(
                    <button key={c} onClick={()=>setSec1Sel(s=>{const n=[...s];n[i]=c;return n;})}
                      style={{width:30,height:30,borderRadius:6,border:'none',fontWeight:700,fontSize:13,cursor:'pointer',
                        background:sec1Sel[i]===c?'#dc2626':'#e2e8f0',
                        color:sec1Sel[i]===c?'white':'#64748b'}}>{c}</button>
                  ))}
                  {sec1Sel[i]&&<button onClick={()=>setSec1Sel(s=>{const n=[...s];n[i]='';return n;})}
                    style={{width:24,height:30,borderRadius:6,border:'none',fontSize:11,cursor:'pointer',background:'#fee2e2',color:'#dc2626',fontWeight:700}}>✕</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2 */}
        {enabledSec2Subs.length>0&&(
          <div style={{background:'white',borderRadius:16,padding:20,marginBottom:12,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>{t.section2}</div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              {enabledSec2Subs.map(sub=>{
                const rows=Object.keys(sec2Sel[sub]||{});
                return (
                  <div key={sub} style={{background:'#f8fafc',borderRadius:10,padding:'12px 16px'}}>
                    <div style={{fontWeight:700,fontSize:13,color:'#7c3aed',marginBottom:8}}>{sub}</div>
                    {rows.map(row=>(
                      <div key={row} style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                        <span style={{fontSize:11,color:'#94a3b8',minWidth:14}}>{row}</span>
                        <div style={{display:'flex',gap:2,flexWrap:'wrap'}}>
                          {['0','1','2','3','4','5','6','7','8','9'].map(d=>(
                            <button key={d} onClick={()=>setSec2Sel(s=>({...s,[sub]:{...s[sub],[row]:d}}))}
                              style={{width:26,height:26,borderRadius:5,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',
                                background:sec2Sel[sub]?.[row]===d?'#7c3aed':'#e2e8f0',
                                color:sec2Sel[sub]?.[row]===d?'white':'#64748b'}}>{d}</button>
                          ))}
                          {sec2Sel[sub]?.[row]&&<button onClick={()=>setSec2Sel(s=>({...s,[sub]:{...s[sub],[row]:''}}))} style={{width:22,height:26,borderRadius:5,border:'none',fontSize:10,cursor:'pointer',background:'#fee2e2',color:'#dc2626',fontWeight:700}}>✕</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {err&&<div style={{color:'#dc2626',fontSize:13,background:'#fef2f2',padding:'10px 14px',borderRadius:8,border:'1px solid #fecaca',marginBottom:12}}>{err}</div>}

        <button id='student-submit-btn' onClick={handleSubmit} disabled={submitting}
          style={{width:'100%',padding:16,background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'white',border:'none',borderRadius:14,fontSize:16,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {submitting&&<Spinner/>} {submitting?t.submitting:t.submit}
        </button>
      </div>
    </div>
  );
}

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
  const [prefill, setPrefill] = useState(null);
  const [editingExam, setEditingExam] = useState(null);

  useEffect(() => {
    const token = getToken();
    const stoken = typeof window!=='undefined'&&localStorage.getItem('student_token');
    const sinfo = typeof window!=='undefined'&&localStorage.getItem('student_info');
    const savedTeacher = typeof window!=='undefined'&&localStorage.getItem('eyesh_teacher');
    if (token) {
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
      const [ex, st] = await Promise.all([apiFetch('/api/exams'), apiFetch('/api/students')]);
      setExams(ex);
      setStudents(st);
      if (ex.length) setCurrentExam(cur => cur ? ex.find(e=>e.id===cur.id)||ex[0] : ex[0]);
    } catch(e) { console.error('loadData error:', e); }
    setLoading(false);
  }

  async function handleAddExam(exam) {
    const created = await apiFetch('/api/exams', {method:'POST', body:exam});
    setExams(ex=>[created,...ex]);
    setCurrentExam(created);
    setPage('home');
    setPrefill(null);
  }

  async function handleUpdateExam(exam) {
    const updated = await apiFetch('/api/exams/'+exam.id, {method:'PUT', body:exam});
    setExams(ex=>ex.map(e=>e.id===exam.id?updated:e));
    setCurrentExam(updated);
    setEditingExam(null);
    setPage('home');
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

  function handlePrefill(p) {
    setPrefill(p);
    setPage('create');
  }

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
    />
  );
  if (studentMode) return (
    <StudentPortal
      student={studentInfo}
      onLogout={()=>{localStorage.removeItem('student_token');localStorage.removeItem('student_info');setStudentMode(false);setStudentInfo(null);setStudentExam(null);}}
    />
  );

  const examStudents = students.filter(s=>s.examId===currentExam?.id);

  return (
    <>
      <Head>
        <title>EYESH Checker</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;transition:background .2s,color .2s;}
        body.dark{background:#0f172a;color:#e2e8f0;}
        body:not(.dark){background:#f1f5f9;color:#1e293b;}
        @keyframes spin{to{transform:rotate(360deg)}}
        button:hover{opacity:.9;}
        input,select{font-family:inherit;}
        table{font-family:inherit;}
        .dk-card{background:${d?'#1e293b':'white'};color:${d?'#e2e8f0':'#1e293b'};}
        .dk-bg{background:${d?'#0f172a':'#f1f5f9'};}
        .dk-border{border-color:${d?'#334155':'#e2e8f0'} !important;}
        .dk-text-muted{color:${d?'#94a3b8':'#64748b'};}
      `}</style>
      {/* Apply dark class to body */}
      {typeof document!=='undefined'&&(dark?document.body.classList.add('dark'):document.body.classList.remove('dark'))}
      <header style={{background:d?'#1e293b':'white',borderBottom:'1px solid '+(d?'#334155':'#e2e8f0'),position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 16px',display:'flex',alignItems:'center',gap:10,height:60}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#7f1d1d,#dc2626)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:15}}>E</div>
            <div style={{display:'none'}} className="desktop-logo">
              <div style={{fontSize:13,fontWeight:900,color:d?'#f1f5f9':'#1e293b',lineHeight:1}}>EYESH Checker</div>
            </div>
          </div>
          {/* Desktop nav */}
          <nav style={{display:'flex',gap:1,flex:1,overflowX:'auto',scrollbarWidth:'none'}} className="desktop-nav">
            {PAGE_IDS.filter(id => id!=='admin' || teacher?.isAdmin).map(id=>(
              <button key={id} onClick={()=>setPage(id)}
                style={{padding:'6px 10px',border:'none',borderRadius:8,fontWeight:600,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',background:page===id?'#fee2e2':'transparent',color:page===id?'#dc2626':d?'#94a3b8':'#64748b',flexShrink:0}}>
                {t.nav[id]||id}
              </button>
            ))}
          </nav>
          <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto',flexShrink:0}}>
            {currentExam&&(
              <div style={{fontSize:11,color:'#dc2626',background:'#fff1f2',padding:'4px 8px',borderRadius:8,border:'1px solid #fecaca',fontWeight:600,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} className="hide-mobile">
                {currentExam.title}
              </div>
            )}
            <button onClick={toggleDark}
              style={{padding:'5px 10px',background:d?'#334155':'#f1f5f9',border:'none',borderRadius:8,fontSize:14,color:d?'#fbbf24':'#374151',cursor:'pointer'}}>
              {d?'☀️':'🌙'}
            </button>
            <button onClick={toggleLang}
              style={{padding:'5px 10px',background:d?'#334155':'#f1f5f9',border:'none',borderRadius:8,fontSize:11,color:d?'#e2e8f0':'#374151',fontWeight:700,cursor:'pointer'}} className="hide-mobile">
              {lang==='mn'?'🇬🇧':'🇲🇳'}
            </button>
            <button onClick={()=>{localStorage.removeItem('eyesh_token');localStorage.removeItem('eyesh_teacher');setAuthed(false);setTeacher(null);}}
              style={{padding:'5px 10px',background:'#fee2e2',border:'none',borderRadius:8,fontSize:11,color:'#dc2626',fontWeight:700,cursor:'pointer'}}>
              {t.logout}
            </button>
            {/* Hamburger for mobile */}
            <button onClick={()=>{const m=document.getElementById('mobile-menu');if(m)m.style.display=m.style.display==='flex'?'none':'flex';}}
              style={{padding:'5px 8px',background:d?'#334155':'#f1f5f9',border:'none',borderRadius:8,cursor:'pointer',color:d?'#f1f5f9':'#374151',fontSize:18,lineHeight:1}} className="show-mobile">
              ☰
            </button>
          </div>
        </div>
        {/* Mobile dropdown menu */}
        <div id="mobile-menu" style={{display:'none',flexDirection:'column',background:d?'#1e293b':'white',borderTop:'1px solid '+(d?'#334155':'#e2e8f0'),padding:'8px 16px 16px',gap:4}}>
          {PAGE_IDS.filter(id => id!=='admin' || teacher?.isAdmin).map(id=>(
            <button key={id} onClick={()=>{setPage(id);document.getElementById('mobile-menu').style.display='none';}}
              style={{padding:'10px 14px',border:'none',borderRadius:8,fontWeight:600,fontSize:14,cursor:'pointer',textAlign:'left',background:page===id?'#fee2e2':'transparent',color:page===id?'#dc2626':d?'#94a3b8':'#374151'}}>
              {t.nav[id]||id}
            </button>
          ))}
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button onClick={toggleLang}
              style={{flex:1,padding:'8px',background:d?'#334155':'#f1f5f9',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',color:d?'#e2e8f0':'#374151'}}>
              {lang==='mn'?'🇬🇧 EN':'🇲🇳 МН'}
            </button>
          </div>
        </div>
      </header>
      <style>{`
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
        @media (min-width: 641px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
      <main style={{background:d?'#0f172a':'#f1f5f9',minHeight:'calc(100vh - 100px)'}}>
        {page==='home'&&<HomePage exams={exams} students={students} onSelectExam={e=>{setCurrentExam(e);}} currentExam={currentExam} onDeleteExam={handleDeleteExam} onNavigate={setPage} onEditExam={e=>{setEditingExam(e);setPage('edit');}} dark={d} />}
        {page==='create'&&<CreatePage onCreated={handleAddExam} prefill={prefill} dark={d} />}
        {page==='edit'&&<CreatePage onCreated={handleUpdateExam} prefill={editingExam} isEdit={true} dark={d} />}
        {page==='material'&&<MaterialPage onPrefill={handlePrefill} dark={d} />}
        {page==='upload'&&<UploadPage exam={currentExam} students={examStudents} onAddStudent={handleAddStudent} dark={d} />}
        {page==='board'&&<BoardPage exam={currentExam} students={examStudents} onDeleteStudent={handleDeleteStudent} onExportExcel={exportExcel} dark={d} />}
        {page==='analytics'&&<AnalyticsPage exam={currentExam} students={examStudents} onExportAnalytics={exportAnalytics} dark={d} />}
        {page==='rating'&&<RatingPage exams={exams} students={students} dark={d} />}
        {page==='students'&&<StudentAccountsPage dark={d} />}
        {page==='admin'&&teacher?.isAdmin&&<AdminPage dark={d} />}
      </main>
      <footer style={{textAlign:'center',padding:'20px',color:'#94a3b8',fontSize:12,borderTop:'1px solid '+(d?'#334155':'#e2e8f0'),background:d?'#1e293b':'white',marginTop:36}}>
        EYESH Хариулт Хуудас Шалгагч · AI Bubble Detection
      </footer>
    </>
  );
}
