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
// Хэмжээст оноо (200–800) — ЭШ-ийн аргаар: анхны оноо x-ээс доош (x-тэй тэнцүүгийн хагас) оноотой улсын шалгуулагчдын
// эзлэх хувь p → хэвийн тархалтын z = Φ⁻¹(p) → 500 + 100z, 200–800. Шугаман (x − дундаж)/σ БИШ: 2026 оны тархалтаар ингэж бодоход
// 800 авах хүн 189 (албан ёсоор 194), шугаманаар 1463 гардаг; математикт 60 → 695.
// v — 2026 оны ЭШ-ийн улсын анхны онооны тархалтаас (ikon.mn, 2026.06.29) анхны оноо 0–100 бүрийн хэмжээст оноо; n — шалгуулагч.
// Шалгалтын хувийг (scaled) ЭШ-ийн анхны оноо гэж үзнэ — ойролцоо утга. g — тайлбарт (харьяалахын тийн ялгал).
export const SCALE_YEAR = 2026;
const SCALE_TAB = {
  'Математик': { g: 'математикийн', n: 33114, v: '200,200,200,202,220,242,263,283,303,322,342,361,379,395,411,427,442,456,470,484,496,508,519,529,539,547,556,563,571,577,583,589,595,600,605,609,614,619,623,627,631,635,639,643,647,650,653,656,660,663,666,670,673,676,679,682,685,688,690,692,695,698,701,704,707,710,713,716,718,721,725,727,730,733,735,738,741,743,745,748,751,754,757,760,765,770,775,780,785,792,798,800,800,800,800,800,800,800,800,800,800' },
  'Физик': { g: 'физикийн', n: 11666, v: '200,200,200,200,200,200,200,212,225,246,266,283,301,318,334,349,363,376,389,402,414,425,436,446,457,467,476,485,494,503,511,519,527,534,541,548,554,560,566,571,577,582,586,591,595,599,603,608,612,616,620,623,627,630,633,637,640,644,648,651,654,656,659,663,666,670,673,676,679,682,686,689,692,697,700,703,706,709,712,717,721,725,730,735,740,746,752,757,762,769,780,797,800,800,800,800,800,800,800,800,800' },
  'Хими': { g: 'химийн', n: 6927, v: '200,200,200,200,200,206,217,231,248,266,285,303,320,335,349,363,377,392,407,421,434,446,457,468,477,487,496,505,514,522,530,538,546,554,560,567,573,580,586,592,597,602,608,613,619,623,627,632,637,641,645,649,652,656,659,663,666,670,672,676,681,684,688,690,693,698,702,706,712,717,722,725,729,733,737,743,748,752,757,761,764,770,776,780,782,789,796,800,800,800,800,800,800,800,800,800,800,800,800,800,800' },
  'Биологи': { g: 'биологийн', n: 6813, v: '200,200,200,200,200,200,219,242,261,280,299,317,335,352,369,385,401,416,430,443,455,468,480,492,502,512,522,531,540,549,558,566,574,582,589,597,605,612,618,625,631,638,644,650,656,661,667,672,677,682,687,692,697,704,709,714,720,724,730,737,742,746,751,755,758,763,767,772,780,788,793,796,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800' },
  'Монгол хэл': { g: 'монгол хэлний', n: 15948, v: '200,200,200,200,200,200,200,200,200,200,200,200,200,203,213,224,237,250,262,271,281,291,301,312,323,335,345,355,367,379,389,399,410,420,430,440,450,459,468,478,487,496,504,513,522,530,538,546,554,562,570,577,584,591,598,605,612,619,626,634,641,648,655,661,668,675,682,689,696,702,709,717,725,734,742,751,759,768,781,792,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800,800' },
  'Түүх': { g: 'түүхийн', n: 1319, v: '200,200,200,200,200,200,200,210,221,226,229,239,247,253,268,289,306,319,333,348,363,377,389,401,415,429,442,452,462,471,479,487,496,505,511,518,525,532,537,542,549,555,560,564,569,573,578,582,586,590,595,600,605,609,611,615,619,623,628,631,633,638,642,644,647,652,656,662,668,672,676,680,682,685,689,690,692,693,697,700,708,718,725,736,747,753,758,767,774,779,784,790,796,800,800,800,800,800,800,800,800' },
  'Газарзүй': { g: 'газарзүйн', n: 1248, v: '200,200,200,200,200,200,200,200,200,200,212,218,235,255,269,279,287,292,302,314,324,333,342,353,364,373,382,390,399,407,414,421,428,434,441,447,453,458,464,469,474,482,488,493,498,504,509,513,517,521,526,530,535,540,544,548,551,556,562,566,569,573,577,581,583,586,591,595,600,606,612,620,626,629,634,638,642,647,653,660,666,671,676,681,685,690,698,703,709,717,730,743,759,782,795,795,800,800,800,800,800' },
  'Англи хэл': { g: 'англи хэлний', n: 31623, v: '200,200,200,200,200,200,200,209,227,245,263,281,298,316,331,346,360,374,387,400,412,424,434,444,453,462,471,478,485,491,497,503,507,512,516,520,523,527,530,533,536,539,541,544,547,549,551,554,556,558,560,562,564,566,569,571,573,575,577,579,581,583,585,587,590,592,595,598,600,603,606,608,612,615,618,622,625,629,634,638,643,648,653,659,664,670,677,685,693,702,711,722,735,748,762,776,793,800,800,800,800' },
  'Нийгмийн ухаан': { g: 'нийгмийн ухааны', n: 30084, v: '200,200,200,200,200,200,200,200,200,200,204,219,234,249,264,278,292,306,320,333,346,359,370,382,393,404,414,424,434,444,453,461,470,478,485,493,500,507,514,520,527,533,539,544,549,555,560,565,571,576,581,585,590,594,598,602,606,611,615,619,623,627,631,635,639,643,647,651,655,659,664,668,672,676,681,685,690,695,700,705,710,717,722,727,733,740,746,752,758,766,774,782,790,800,800,800,800,800,800,800,800' },
  'Орос хэл': { g: 'орос хэлний', n: 479, v: '200,200,200,200,200,200,200,200,200,200,200,214,214,214,214,244,269,287,300,311,321,328,338,346,352,358,363,368,375,380,386,392,398,403,406,407,411,416,419,422,425,427,429,431,434,436,439,440,442,444,446,447,449,451,453,456,458,460,463,466,468,471,473,474,475,477,479,481,484,486,488,490,492,494,496,499,501,503,506,509,513,517,522,526,531,537,543,549,555,563,571,577,585,597,612,629,650,670,689,715,756' },
};
const SCALE_V = {};
export function scaleTable(subject) {
  const k = String(subject || '').trim(), T = SCALE_TAB[k];
  if (!T) return null;
  return SCALE_V[k] || (SCALE_V[k] = { ...T, v: T.v.split(',').map(Number) });
}
// Хувь (0–100, бутархай байж болно) → хэмжээст оноо; хүснэгтгүй хичээл эсвэл утгагүй хувь → null
export function scaleScore(pct, subject) {
  const T = scaleTable(subject), x = Number(pct);
  if (!T || pct == null || pct === '' || !Number.isFinite(x)) return null;
  const c = Math.max(0, Math.min(100, x)), i = Math.min(99, Math.floor(c));
  return Math.round(T.v[i] + (T.v[i + 1] - T.v[i]) * (c - i));
}
// «2026 оны ЭШ-ийн математикийн улсын дүнгээр (33,114 шалгуулагч)»; хүснэгтгүй хичээлд ''
export function scaleNote(subject) {
  const T = scaleTable(subject);
  return T ? `${SCALE_YEAR} оны ЭШ-ийн ${T.g} улсын дүнгээр (${String(T.n).replace(/\B(?=(\d{3})+$)/g, ',')} шалгуулагч)` : '';
}
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
  if (res.status===402) {
    // SUBJECT_REQUIRED — тухайн хичээлийн эрх алга: төлбөрийн дэлгэцийг тэр хичээлээр нээнэ (pages/index.js)
    const e = await res.json().catch(() => ({}));
    window.dispatchEvent(new CustomEvent('eyesh:paywall', { detail: { subject: e.code === 'SUBJECT_REQUIRED' ? e.subject : null } }));
    throw new Error(e.code === 'SUBJECT_REQUIRED' && e.error ? e.error : 'Эрхийн хугацаа дууссан');
  }
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
