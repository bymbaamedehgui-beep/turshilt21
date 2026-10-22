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

export function getToken() { return typeof window!=='undefined'?localStorage.getItem('eyesh_token'):null; }

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
  if (res.status===401) { localStorage.removeItem('eyesh_token'); window.location.reload(); }
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
