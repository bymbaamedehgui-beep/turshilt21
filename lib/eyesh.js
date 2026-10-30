// ЭЕШ шалгагчийн нийтлэг тогтмол, оноо тооцоо, API туслахууд (pages/index.js ба components/* хуваалцана)

export const SEC1_CHOICES = ['A','B','C','D','E'];
export const SEC2_ROWS = ['a','b','c','d','e','f','g','h'];
export const SEC2_SUBS = ['2.1','2.2','2.3','2.4'];

export function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }
export function pf(v) { const n=parseFloat(v); return isNaN(n)?0:n; }

export function eyeshGrade(sc) {
  if(sc>=90) return {g:'A',l:'Онц',c:'#15803d'};
  if(sc>=80) return {g:'B',l:'Сайн',c:'#1d4ed8'};
  if(sc>=70) return {g:'C',l:'Дунд сайн',c:'#0369a1'};
  if(sc>=60) return {g:'D',l:'Хангалттай',c:'#d97706'};
  if(sc>=50) return {g:'E',l:'Хангалтгүй',c:'#ea580c'};
  return {g:'F',l:'Тэнцээгүй',c:'#dc2626'};
}
export function toScaled(earned,max){ return max>0?Math.round(earned/max*1000)/10:0; }
// Сургуулийн тайлангийн түвшин (I–VIII): ≤29 I, ≤39 II, … ≤89 VII, түүнээс дээш VIII
export const LEVELS = ['I','II','III','IV','V','VI','VII','VIII'];
export function levelOf(pct) {
  const p = +pct || 0;
  for (let i = 0; i < 7; i++) if (p <= 29 + i * 10) return LEVELS[i];
  return 'VIII';
}

// pages/cm-admin.js (Дасгалын төвийн админ хэсэг дэх iframe): токен зөвхөн санах ойд — localStorage-д бичихгүй
let tokenOverride = null;
export function setTokenOverride(t) { tokenOverride = t || null; }
export function getToken() { return tokenOverride || (typeof window!=='undefined'?localStorage.getItem('eyesh_token'):null); }

export async function apiFetch(path, opts={}) {
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
  if (res.status===401 && tokenOverride) { window.dispatchEvent(new Event('eyesh:auth-expired')); throw new Error('Нэвтрэлтийн хугацаа дууссан'); }
  if (res.status===401) { localStorage.removeItem('eyesh_token'); window.location.reload(); }
  if (res.status===402) { window.dispatchEvent(new Event('eyesh:paywall')); throw new Error('Эрхийн хугацаа дууссан'); }
  if (!res.ok) { const e=await res.json().catch(()=>({error:'Network error'})); throw new Error(e.error||'API error'); }
  return res.json();
}

// ── Scoring ───────────────────────────────────────────────
export function calcScore(det, exam) {
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
      const kv=typeof rowData==='object'?(rowData.ans!==undefined?String(rowData.ans):undefined):rowData;
        if(kv===undefined||kv===null||kv==='') return;
        // Default 1 (per row) — sec2Score хэрэглэхгүй (хуучин буруу 5 default-аас зайлсхийнэ)
        const pts=typeof rowData==='object'
          ?(rowData.score!=null?parseFloat(rowData.score):(typeof rowData==='string'?(parseFloat(sec2Score)||1):1))
          :(parseFloat(sec2Score)||1);
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

// Хадгалсан дүнгийн сонголтуудыг (sec1Results/sec2Results-ийн sel) шалгалтын одоогийн түлхүүр, оноогоор дахин бодно.
// Шалгалтыг засахад (зөв хариулт, оноо, 2-р хэсэг) уншуулсан бүх хуудасны дүн үүгээр шинэчлэгдэнэ.
// Хуудсыг уншуулах үед түлхүүргүй байсан мөрийн хариу хадгалагдаагүй тул хоосон гэж тооцогдоно.
export function rescoreSaved(stu, examAll) {
  const exam = examForVersion(examAll, stu.version);   // олон хувилбартай бол тухайн сурагчийн хувилбар
  const byQ = {};
  (stu.sec1Results || []).forEach(r => { if (r && r.q) byQ[r.q] = r; });
  const section1 = (exam.sec1Key || []).map((_, i) => {
    const r = byQ[i + 1], sel = r && r.sel ? String(r.sel).trim().toUpperCase() : '';
    return { selected: sel || 'BLANK', confidence: r && r.conf != null ? r.conf : 100 };
  });
  const section2 = {};
  Object.entries(stu.sec2Results || {}).forEach(([sub, rows]) => {
    section2[sub] = {};
    Object.entries(rows || {}).forEach(([row, r]) => {
      const v = r && r.sel != null ? String(r.sel).trim() : '';
      section2[sub][row] = { digit: v || 'BLANK', confidence: r && r.conf != null ? r.conf : 100 };
    });
  });
  return calcScore({ section1, section2 }, { ...exam, sec1Key: exam.sec1Key || [], sec2Config: exam.sec2Config || {} });
}

// ── Олон хувилбартай шалгалт ──────────────────────────────
// exam.variants = { B: { sec1Key, sec1Scores, topics, sec2Config }, C: {…} } — A нь үндсэн шалгалт өөрөө.
// Хувилбар бүр өөрийн зөв хариулт, оноо, сэдэвтэй; хуудасны бүтэц (асуултын тоо, 2-р хэсгийн дэд хэсгүүд) нэг.
// Сурагч хариултын хуудасны «ХУВИЛБАР» нүдийг будна → тэр хувилбараар дүгнэнэ; дүн, дундаж нэг шалгалтад нэгдэнэ.
export const VARIANTS = ['A','B','C','D','E','F'];
export function examVariants(exam) { return VARIANTS.filter((L, i) => i === 0 || exam?.variants?.[L]); }
// Хадгалсан version-оос хувилбарын үсэг: 'B', 'B онлайн' → 'B'; '—', 'онлайн', 'ZG' → ''
export function verLetter(version) { const m = String(version || '').trim().toUpperCase().match(/^([A-J])(?![A-Z])/); return m ? m[1] : ''; }
// Сурагч аль хувилбараар дүгнэгдэх вэ (examForVersion-той ижил): шалгалтад байхгүй үсэг → 'A'
export function studentVariant(exam, version) { const L = verLetter(version); return L && exam?.variants?.[L] ? L : 'A'; }
// Тухайн хувилбарын түлхүүр, оноо, сэдэв, 2-р хэсгийн хариуг суулгасан шалгалт. A, тодорхойгүй хувилбар → үндсэн шалгалт.
export function examForVersion(exam, version) {
  const v = exam?.variants?.[verLetter(version)];
  if (!v) return exam;
  let sec2Config = exam.sec2Config;
  if (v.sec2Config) {   // дэд хэсгүүдийн _enabled нь үндсэн шалгалтынх (хуудасны бүтэц)
    sec2Config = {};
    Object.keys(exam.sec2Config || {}).forEach(sub => { sec2Config[sub] = { ...(v.sec2Config[sub] || {}), _enabled: exam.sec2Config[sub]?._enabled }; });
  }
  return { ...exam, sec1Key: v.sec1Key || exam.sec1Key, sec1Scores: v.sec1Scores || exam.sec1Scores, topics: v.topics || exam.topics, sec2Config };
}
// Хадгалахын өмнө (lib/db.js): зөвхөн B–F, массивууд яг асуултын тоотой, 2-р хэсэг { ans, score } мөрүүдтэй → { B:{…} } | null
export function normVariants(exam) {
  const n = Math.max(0, parseInt(exam?.sec1Count, 10) || (exam?.sec1Key || []).length);
  const fit = (a, f) => Array.isArray(a) ? Array.from({ length: n }, (_, i) => f(a[i])) : undefined;
  const s2 = c => {
    if (!c || typeof c !== 'object') return undefined;
    const o = {};
    SEC2_SUBS.forEach(sub => {
      if (!c[sub] || typeof c[sub] !== 'object') return;
      o[sub] = {};
      SEC2_ROWS.forEach(row => {
        const d = c[sub][row];
        if (d == null) return;
        const obj = typeof d === 'object';
        o[sub][row] = { ans: String((obj ? d.ans : d) ?? '').trim().slice(0, 1), score: obj && d.score != null ? Number(d.score) || 1 : 1 };
      });
    });
    return o;
  };
  const out = {};
  VARIANTS.slice(1).forEach(L => {
    const v = exam?.variants?.[L];
    if (!v || !Array.isArray(v.sec1Key)) return;
    out[L] = {
      sec1Key: fit(v.sec1Key, x => String(x || '').trim().toUpperCase().slice(0, 1)),
      sec1Scores: fit(v.sec1Scores, x => Number(x) || 1),
      topics: fit(v.topics, x => String(x || '').slice(0, 100)),
      sec2Config: s2(v.sec2Config),
    };
  });
  return Object.keys(out).length ? out : null;
}
// Багш гараар зассан хариугаар эсвэл хувилбарыг сольсноор дахин дүгнэнэ (pages/api/students/sec2.js) — сканнертай ижил дүрэм.
// sec1: ['A','', …], sec2: { '2.1': { a:'5' } } — өгөөгүй хэсэгт хадгалсан хариу; version: шинэ хувилбар (өгөөгүй бол хуучин)
export function regradeStudent(stu, exam, { sec1, sec2, version } = {}) {
  const V = version != null && version !== '' ? String(version).trim().toUpperCase() : '';
  const ver = V ? (/онлайн/.test(stu.version || '') ? `${V} онлайн` : V) : (stu.version || '');
  const ex = examForVersion(exam, ver);
  const saved1 = {};
  (stu.sec1Results || []).forEach(r => { if (r && r.q) saved1[r.q] = r.sel; });
  // 1-р хэсэгт '*', '-' нь хоосон (ZipGrade); 2-р хэсэгт '-', '.' нь хуудсан дээрх тэмдэг тул хариу
  const clean1 = v => { const s = v == null ? '' : String(v).trim().toUpperCase(); return s && s !== 'BLANK' && s !== '*' && s !== '-' ? s : ''; };
  const clean2 = v => { const s = v == null ? '' : String(v).trim(); return s && s.toUpperCase() !== 'BLANK' ? s : ''; };
  const section1 = (ex.sec1Key || []).map((_, i) => ({ selected: clean1(Array.isArray(sec1) ? sec1[i] : saved1[i + 1]) || 'BLANK', confidence: 100 }));
  const section2 = {};
  SEC2_SUBS.forEach(sub => {
    section2[sub] = {};
    SEC2_ROWS.forEach(row => {
      const v = sec2 && typeof sec2 === 'object' ? sec2[sub]?.[row] : stu.sec2Results?.[sub]?.[row]?.sel;
      section2[sub][row] = { digit: clean2(v) || 'BLANK', confidence: 100 };
    });
  });
  return { ...calcScore({ section1, section2 }, { ...ex, sec1Key: ex.sec1Key || [], sec2Config: ex.sec2Config || {} }), version: ver };
}
