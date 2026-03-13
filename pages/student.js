import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const SEC1_CHOICES = ['A','B','C','D','E'];
const SEC2_ROWS = ['a','b','c','d','e','f','g','h'];
const SEC2_SUBS = ['2.1','2.2','2.3','2.4'];

function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }

function getToken() { return typeof window!=='undefined'?localStorage.getItem('student_token'):null; }

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
  const d = await res.json();
  if (!res.ok) throw new Error(d.error||'Алдаа гарлаа');
  return d;
}

async function callAI(payload) {
  const token = getToken();
  const r = await fetch('/api/ai', {
    method:'POST',
    headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    body: JSON.stringify(payload),
  });
  const rawBody = await r.text();
  if (!r.ok) throw new Error('AI алдаа: '+rawBody.slice(0,200));
  const d = JSON.parse(rawBody);
  if (d.error) throw new Error(d.error.message);
  const txt = (d.content||[]).find(b=>b.type==='text')?.text||'';
  if (!txt) throw new Error('AI хоосон хариулт');
  return txt;
}

async function analyzeSheet(b64, mime, cfg) {
  const {n, useSec2, enabledSubs} = cfg;
  const prompt = `You are an expert OMR system for Mongolian EYESH exam answer sheets.
SHEET LAYOUT:
- Top right: ХУВИЛБАР column — one bubble A–J = exam version
- 1-Р ХЭСЭГ (left): questions 1–${n}, each row has bubbles A B C D E
- 2-Р ХЭСЭГ (right): sub-sections ${useSec2?enabledSubs.join(','):'none'}, rows a-h, bubbles 0-9
DETECT:
1. VERSION: which bubble is filled in ХУВИЛБАР column
2. SECTION 1: for each question 1–${n}, which bubble A/B/C/D/E is filled (or BLANK)
3. SECTION 2: for each enabled sub ${useSec2?enabledSubs.join(','):'none'}, rows a-h, which digit 0-9 (or BLANK)
Return ONLY valid JSON:
{"version":"A","section1":[{"q":1,"selected":"A","confidence":92}],"section2":{"2.1":{"a":{"digit":"3","confidence":90}}},"sheetDetected":true}`;
  const txt = await callAI({model:'claude-sonnet-4-20250514',max_tokens:4000,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:mime,data:b64}},{type:'text',text:prompt}]}]});
  try { return JSON.parse(txt.replace(/```json|```/g,'').trim()); }
  catch { throw new Error('Parse алдаа'); }
}

function eyeshGrade(sc) {
  if(sc>=90) return {g:'A',l:'Онц',c:'#15803d'};
  if(sc>=80) return {g:'B',l:'Сайн',c:'#1d4ed8'};
  if(sc>=70) return {g:'C',l:'Дунд сайн',c:'#0369a1'};
  if(sc>=60) return {g:'D',l:'Хангалттай',c:'#d97706'};
  if(sc>=50) return {g:'E',l:'Хангалтгүй',c:'#ea580c'};
  return {g:'F',l:'Тэнцээгүй',c:'#dc2626'};
}

function calcScore(det, exam) {
  const {sec1Key,sec1Scores,useSec2,sec2Config,sec2Score} = exam;
  let correct=0,wrong=0,blank=0,rawEarned=0,rawMax=0;
  const sec1Results=[];
  sec1Key.forEach((key,i)=>{
    const a=det.section1?.[i];
    const sel=a?.selected||'BLANK';
    const pts=sec1Scores?.[i]||1;
    rawMax+=pts;
    if(sel==='BLANK'){blank++;sec1Results.push({q:i+1,sel,key,st:'blank',pts:0,max:pts});}
    else if(sel===key){correct++;rawEarned+=pts;sec1Results.push({q:i+1,sel,key,st:'ok',pts,max:pts});}
    else{wrong++;sec1Results.push({q:i+1,sel,key,st:'ng',pts:0,max:pts});}
  });
  const sec2Results={};
  if(useSec2&&sec2Config){
    SEC2_SUBS.forEach(sub=>{
      const subCfg=sec2Config?.[sub];
      if(!subCfg?._enabled) return;
      sec2Results[sub]={};
      SEC2_ROWS.forEach(row=>{
        const kv=subCfg?.[row];
        if(kv===undefined||kv===null||kv==='') return;
        const pts=sec2Score||5;
        rawMax+=pts;
        const dv=det.section2?.[sub]?.[row]?.digit||'BLANK';
        if(dv==='BLANK'){blank++;sec2Results[sub][row]={sel:dv,key:kv,st:'blank',pts:0,max:pts};}
        else if(String(dv)===String(kv)){correct++;rawEarned+=pts;sec2Results[sub][row]={sel:dv,key:kv,st:'ok',pts,max:pts};}
        else{wrong++;sec2Results[sub][row]={sel:dv,key:kv,st:'ng',pts:0,max:pts};}
      });
    });
  }
  const scaled=rawMax>0?Math.round(rawEarned/rawMax*1000)/10:0;
  const grade=eyeshGrade(scaled);
  return{correct,wrong,blank,rawEarned,rawMax,scaled,grade,sec1Results,sec2Results,needsReview:false};
}

function Spinner() {
  return <div style={{width:20,height:20,border:'3px solid #e2e8f0',borderTopColor:'#dc2626',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block'}} />;
}

// ── Camera Component ──────────────────────────────────────
function CameraCapture({onCapture, onClose}) {
  const videoRef = useRef();
  const [stream, setStream] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
      .then(s=>{setStream(s);if(videoRef.current)videoRef.current.srcObject=s;})
      .catch(()=>setErr('Camera нэвтрэх боломжгүй'));
    return ()=>{ stream?.getTracks().forEach(t=>t.stop()); };
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
      stream?.getTracks().forEach(t=>t.stop());
    },'image/jpeg',0.95);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.95)',zIndex:1000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      {err ? (
        <div style={{color:'white',textAlign:'center',padding:20}}>
          <div style={{fontSize:16,marginBottom:12}}>{err}</div>
          <button onClick={onClose} style={{padding:'10px 24px',background:'#dc2626',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Буцах</button>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline style={{width:'100%',maxWidth:500,borderRadius:12,marginBottom:16}} />
          <div style={{display:'flex',gap:12}}>
            <button onClick={capture} style={{padding:'14px 32px',background:'#dc2626',color:'white',border:'none',borderRadius:12,fontWeight:800,fontSize:16,cursor:'pointer'}}>Зураг авах</button>
            <button onClick={()=>{stream?.getTracks().forEach(t=>t.stop());onClose();}} style={{padding:'14px 24px',background:'#374151',color:'white',border:'none',borderRadius:12,fontWeight:700,cursor:'pointer'}}>Болих</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Student Login ─────────────────────────────────────────
function StudentLogin({onLogin}) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!code.trim()) return;
    setLoading(true); setErr('');
    try {
      const {token, student} = await apiFetch('/api/student/login', {method:'POST', body:{code:code.trim()}});
      localStorage.setItem('student_token', token);
      localStorage.setItem('student_info', JSON.stringify(student));
      onLogin(student);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#7f1d1d,#dc2626)',padding:20}}>
      <div style={{background:'white',borderRadius:20,padding:'36px 32px',width:'100%',maxWidth:360,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:10}}>📝</div>
          <div style={{fontSize:22,fontWeight:900,color:'#1e293b'}}>EYESH Шалгалт</div>
          <div style={{fontSize:13,color:'#94a3b8',marginTop:4}}>Кодоо оруулж нэвтрэнэ үү</div>
        </div>
        {err && <div style={{color:'#dc2626',fontSize:13,background:'#fef2f2',padding:'8px 12px',borderRadius:8,border:'1px solid #fecaca',marginBottom:14,textAlign:'center'}}>{err}</div>}
        <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Таны код" onKeyDown={e=>e.key==='Enter'&&handleLogin()}
          style={{width:'100%',padding:'14px',border:'2px solid #e2e8f0',borderRadius:10,fontSize:18,outline:'none',marginBottom:14,boxSizing:'border-box',textAlign:'center',letterSpacing:4,fontWeight:700}} />
        <button onClick={handleLogin} disabled={loading}
          style={{width:'100%',padding:14,background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {loading&&<Spinner/>} Нэвтрэх
        </button>
      </div>
    </div>
  );
}

// ── Exam List ─────────────────────────────────────────────
function ExamList({student, onSelect, onLogout}) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    apiFetch('/api/exams').then(setExams).catch(console.error).finally(()=>setLoading(false));
  },[]);

  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      <header style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:'#1e293b'}}>Сайн байна уу!</div>
          <div style={{fontSize:13,color:'#64748b'}}>Код: {student.code} {student.name&&'· '+student.name}</div>
        </div>
        <button onClick={onLogout} style={{padding:'6px 14px',background:'#fee2e2',border:'none',borderRadius:8,fontSize:13,color:'#dc2626',fontWeight:700,cursor:'pointer'}}>Гарах</button>
      </header>
      <div style={{maxWidth:600,margin:'0 auto',padding:'24px 16px'}}>
        <div style={{fontWeight:800,fontSize:18,color:'#1e293b',marginBottom:16}}>Шалгалт сонгох</div>
        {loading ? <div style={{textAlign:'center',padding:40}}><Spinner/></div> : exams.length===0 ? (
          <div style={{background:'white',borderRadius:12,padding:40,textAlign:'center',color:'#94a3b8'}}>Одоогоор шалгалт байхгүй байна</div>
        ) : exams.map(exam=>(
          <div key={exam.id} onClick={()=>onSelect(exam)}
            style={{background:'white',borderRadius:12,padding:18,marginBottom:10,cursor:'pointer',border:'2px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{fontWeight:800,fontSize:16,color:'#1e293b'}}>{exam.title}</div>
            <div style={{fontSize:13,color:'#64748b',marginTop:4}}>{exam.subject} · {exam.sec1Count} дасгал{exam.useSec2?' · 2-р хэсэг':''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Upload & Submit ───────────────────────────────────────
function StudentUpload({student, exam, onDone, onBack}) {
  const [imgData, setImgData] = useState(null);
  const [imgMime, setImgMime] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState('');
  const [det, setDet] = useState(null);
  const [scored, setScored] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  const enabledSubs = SEC2_SUBS.filter(s=>exam.sec2Config?.[s]?._enabled);

  function handleFile(file) {
    if (!file||!file.type.startsWith('image/')) return;
    setImgMime(file.type);
    const r=new FileReader();
    r.onload=e=>{setImgData(e.target.result.split(',')[1]);setDet(null);setScored(null);setErr('');};
    r.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!imgData) return;
    setAnalyzing(true); setErr('');
    try {
      const d = await analyzeSheet(imgData, imgMime, {n:exam.sec1Count, useSec2:exam.useSec2, enabledSubs});
      setDet(d);
      setScored(calcScore(d, exam));
    } catch(e) { setErr(e.message); }
    setAnalyzing(false);
  }

  async function handleSubmit() {
    if (!scored) return;
    setSubmitting(true); setErr('');
    try {
      await apiFetch('/api/student/submit', {method:'POST', body:{
        id:uid(), examId:exam.id, name:student.name||student.code,
        code:student.code, version:det?.version||'—', ...scored,
        submittedAt:new Date().toISOString()
      }});
      setSubmitted(true);
    } catch(e) { setErr(e.message); }
    setSubmitting(false);
  }

  if (submitted) return (
    <div style={{minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'white',borderRadius:20,padding:'40px 32px',textAlign:'center',maxWidth:360,width:'100%'}}>
        <div style={{fontSize:60,marginBottom:12}}>✅</div>
        <div style={{fontSize:22,fontWeight:900,color:'#15803d',marginBottom:8}}>Амжилттай илгээгдлээ!</div>
        <div style={{fontSize:14,color:'#64748b',marginBottom:8}}>ЭЕШ оноо: <span style={{fontSize:28,fontWeight:900,color:scored.grade?.c}}>{scored.scaled}</span></div>
        <div style={{fontSize:14,color:'#64748b',marginBottom:20}}>{scored.grade?.g} — {scored.grade?.l}</div>
        <button onClick={onDone} style={{width:'100%',padding:13,background:'#dc2626',color:'white',border:'none',borderRadius:10,fontWeight:700,fontSize:15,cursor:'pointer'}}>Буцах</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      {showCamera && <CameraCapture onCapture={(data,mime)=>{setImgData(data);setImgMime(mime);setShowCamera(false);setDet(null);setScored(null);}} onClose={()=>setShowCamera(false)} />}
      <header style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 20px',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={onBack} style={{padding:'6px 12px',background:'#f1f5f9',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700}}>← Буцах</button>
        <div>
          <div style={{fontWeight:800,fontSize:15}}>{exam.title}</div>
          <div style={{fontSize:12,color:'#64748b'}}>{exam.subject}</div>
        </div>
      </header>
      <div style={{maxWidth:600,margin:'0 auto',padding:'20px 16px'}}>
        {!imgData ? (
          <div style={{background:'white',borderRadius:16,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>Хариулт хуудасны зураг</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <button onClick={()=>setShowCamera(true)}
                style={{padding:'20px 16px',background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'white',border:'none',borderRadius:12,fontWeight:700,fontSize:15,cursor:'pointer'}}>
                📷 Camera
              </button>
              <button onClick={()=>fileRef.current.click()}
                style={{padding:'20px 16px',background:'linear-gradient(135deg,#0369a1,#0ea5e9)',color:'white',border:'none',borderRadius:12,fontWeight:700,fontSize:15,cursor:'pointer'}}>
                🖼️ Файл сонгох
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])} />
          </div>
        ) : (
          <div style={{background:'white',borderRadius:16,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.08)',marginBottom:12}}>
            <img src={`data:${imgMime};base64,${imgData}`} style={{width:'100%',maxHeight:350,objectFit:'contain',borderRadius:8,marginBottom:12}} />
            <div style={{display:'flex',gap:8}}>
              <button onClick={handleAnalyze} disabled={analyzing}
                style={{flex:1,padding:13,background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'white',border:'none',borderRadius:10,fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {analyzing&&<Spinner/>} AI Шинжлэх
              </button>
              <button onClick={()=>{setImgData(null);setDet(null);setScored(null);}}
                style={{padding:'13px 18px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer'}}>Дахин</button>
            </div>
          </div>
        )}
        {err && <div style={{color:'#dc2626',fontSize:13,background:'#fef2f2',padding:'10px 14px',borderRadius:8,border:'1px solid #fecaca',marginBottom:12}}>{err}</div>}
        {scored && (
          <div style={{background:'white',borderRadius:16,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>Таны дүн</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[['ЭЕШ оноо',scored.scaled,scored.grade?.c],['Зөв',scored.correct,'#16a34a'],['Буруу',scored.wrong,'#dc2626']].map(([l,v,c])=>(
                <div key={l} style={{background:'#f8fafc',borderRadius:10,padding:'12px',textAlign:'center'}}>
                  <div style={{fontSize:24,fontWeight:900,color:c}}>{v}</div>
                  <div style={{fontSize:11,color:'#94a3b8'}}>{l}</div>
                </div>
              ))}
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              style={{width:'100%',padding:14,background:'linear-gradient(135deg,#16a34a,#22c55e)',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {submitting&&<Spinner/>} Илгээх
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Student App ──────────────────────────────────────
export default function StudentApp() {
  const [student, setStudent] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const info = localStorage.getItem('student_info');
    const token = localStorage.getItem('student_token');
    if (info && token) setStudent(JSON.parse(info));
    setLoading(false);
  },[]);

  function handleLogout() {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_info');
    setStudent(null); setExam(null);
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><Spinner/></div>;

  return (
    <>
      <Head><title>EYESH Шалгалт</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {!student && <StudentLogin onLogin={s=>{setStudent(s);}} />}
      {student && !exam && <ExamList student={student} onSelect={setExam} onLogout={handleLogout} />}
      {student && exam && <StudentUpload student={student} exam={exam} onDone={()=>setExam(null)} onBack={()=>setExam(null)} />}
    </>
  );
}
