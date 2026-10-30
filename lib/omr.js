// ── CyberMath ЭЕШ хариултын хуудас: layout + уншигч (OMR) ─────────────────
// AI ашиглахгүй. Хуудасны 6 хар тэмдгээр байрлалыг тогтоож (homography),
// дугуй бүрийн доторх харанхуй пикселийн хувиар будсан эсэхийг шийднэ.
// Эргэлзээтэй (олон будсан, бүдэг, арилгасан) мөрийг `flag`-аар тэмдэглэж
// багшаар баталгаажуулна — итгэлтэй гэж буруу уншихаас илүү асууж баталгаажуулна.
//
// Бүх координат мм-ээр (A4 = 210×297). Хэвлэх (components/AnswerSheet) ба
// унших хоёр ЭНЭ layout-ыг хуваалцдаг тул байрлал хэзээ ч зөрөхгүй.

export const PAGE_W = 210, PAGE_H = 297;
export const MARK = 8;                       // булангийн тэмдгийн хэмжээ
export const MARKERS = {                     // тэмдгүүдийн төв
  TL:[12,12], TR:[198,12], BR:[198,285], BL:[12,285], ML:[12,148.5], MR:[198,148.5],
};
export const ORIENT = { x:24, y:9.5, s:5 };  // зөвхөн зүүн дээд талд — хуудасны чиглэл
export const TAG = { x0:44, y:283, step:10, n:12, s:4 };  // шалгалтын 12 битийн код (доод зурваст)
export const S1_MAX = 60, S1_ROWS = 30;
export const S1_CHOICES = ['A','B','C','D','E'];
export const S2_SUBS = ['2.1','2.2','2.3','2.4'];
export const S2_ROWS = ['a','b','c','d','e','f','g','h'];
export const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];
export const S2_OPTS = [...DIGITS, '-', '.'];
export const VERSIONS = ['A','B','C','D','E','F','G','H','I','J'];
export const ID_LEN = 10;

// ЭЕШ-ийн хуудасны загвар (улаан/ягаан «dropout» өнгө) — байрлал, мм
export const S1_POS = { x0:20, colW:40, y0:98, pitch:5.4, pairGap:0.6, dx:5.6, r:1.9 };
export const S2_POS = { x:104, w:86, y0:94, blockH:46, rowY:8, pitch:4.8, ox:114, dx:6.0, r:1.7 };
export const ID_POS = { x:144.8, y:37, dx:4.6, dy:4.6, r:1.6 };
export const VER_POS = { x:134, y:37, dy:4.6, r:1.7 };
export const s1RowY = row => S1_POS.y0 + row*S1_POS.pitch + Math.floor(row/2)*S1_POS.pairGap;

const ORIENT_C = [ORIENT.x + ORIENT.s/2, ORIENT.y + ORIENT.s/2];

// Шалгалтын id → 12 бит (0 биш). Хуудас өөр шалгалтынх эсэхийг илрүүлнэ.
export function examTag(examId) {
  let h = 2166136261;
  for (const ch of String(examId||'')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 4095) + 1;
}
// Хуудсан дээрх шалгалтын код. Дасгалын төвийн бүлгийн шалгалт (cm_ref 'ws:…') — хариултын хуудсыг cyber-math.com
// өөрөө хэвлэдэг (шалгалт үүсэхээс өмнө ч) тул кодыг ref-ээс авна: тэнд examTag(ref)-ийг ижил аргаар бодож хэвлэнэ.
// Хувилбар бүр өөр ref → өөр хувилбарын хуудсыг илрүүлнэ.
export function sheetTag(exam) {
  const ref = String(exam?.cmRef || '');
  return examTag(/^ws:/.test(ref) ? ref : exam?.id);
}

// Хуудасны бүх дугуйн бүлэг. Бүлэг = нэг сонголт хийх мөр (асуулт, кодын багана г.м.)
// full: ЭЕШ-ийн хуудас шиг 1–60, 2.1–2.4 (a–h) бүгдийг хэвлэхэд. Уншигч full-гүй (зөвхөн
// шалгалтын мөрүүд) дуудна — байрлал нь дугаараар тогтмол тул хоёр нь яг давхцана.
export function sheetLayout(exam, { full = false } = {}) {
  const groups = [];
  const n = full ? S1_MAX : Math.min(exam?.sec1Count || 0, S1_MAX);
  for (let i = 0; i < n; i++) {
    const col = Math.floor(i / S1_ROWS), row = i % S1_ROWS;
    const x0 = S1_POS.x0 + col * S1_POS.colW, y = s1RowY(row);
    groups.push({ id:'s1:'+(i+1), kind:'s1', q:i+1, r:S1_POS.r, labelX:x0+7, y, row,
      options:S1_CHOICES.map((v,j)=>({ v, x:x0+10+j*S1_POS.dx, y })) });
  }
  const s2 = [];
  if (exam?.useSec2 || full) {
    S2_SUBS.forEach((sub, si) => {
      const cfg = exam?.sec2Config?.[sub];
      if (!full && !cfg?._enabled) return;
      const y0 = S2_POS.y0 + si * S2_POS.blockH;
      const rows = [];
      // Олон хувилбартай шалгалтад аль нэг хувилбарт хариутай мөр бүр хуудсанд гарна (хуудас бүх хувилбарт нэг)
      const hasKey = (c, row) => { const rd = c?.[sub]?.[row]; const kv = rd && typeof rd === 'object' ? rd.ans : rd; return !(kv === undefined || kv === null || kv === ''); };
      S2_ROWS.forEach((row, ri) => {
        if (!full && !hasKey(exam?.sec2Config, row) && !Object.values(exam?.variants || {}).some(v => hasKey(v?.sec2Config, row))) return;
        const y = y0 + S2_POS.rowY + ri * S2_POS.pitch;
        rows.push(row);
        groups.push({ id:'s2:'+sub+':'+row, kind:'s2', sub, row, r:S2_POS.r, labelX:S2_POS.x+4, y,
          options:S2_OPTS.map((v,k)=>({ v, x:S2_POS.ox+k*S2_POS.dx, y })) });
      });
      if (rows.length) s2.push({ sub, y0, rows });
    });
  }
  for (let k = 0; k < ID_LEN; k++) {
    groups.push({ id:'id:'+k, kind:'id', col:k, r:ID_POS.r,
      options:DIGITS.map((v,d)=>({ v, x:ID_POS.x+k*ID_POS.dx, y:ID_POS.y+d*ID_POS.dy })) });
  }
  groups.push({ id:'ver', kind:'ver', r:VER_POS.r, options:VERSIONS.map((v,i)=>({ v, x:VER_POS.x, y:VER_POS.y+i*VER_POS.dy })) });
  return { groups, s1Count:n, s2, tag:sheetTag(exam), tooMany:(exam?.sec1Count||0) > S1_MAX };
}

// ── Геометр ────────────────────────────────────────────────────────────────
// 4 цэгийн хос → 3×3 homography (src → dst)
export function solveH(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v*x, -v*y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c+1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1];
}
export function applyH(H, x, y) {
  const w = H[6]*x + H[7]*y + H[8];
  return [(H[0]*x + H[1]*y + H[2]) / w, (H[3]*x + H[4]*y + H[5]) / w];
}

// ── Зураг ──────────────────────────────────────────────────────────────────
// Улаан сувгийг авна: хуудасны улаан/ягаан шугам, үсэг, сүүдэр бараг цагаан болж («dropout»),
// харандаа/хар/хөх бэх л харанхуй үлдэнэ. Хар-цагаан хэвлэсэн хуудсанд энгийн саарал шиг.
export function toGray(rgba, n) {
  const g = new Uint8ClampedArray(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = rgba[j];
  return g;
}

// Хар дөрвөлжин тэмдгүүдийг хайна (хагас нягтаршилд, adaptive threshold + холбогдсон хэсэг)
export function findBlobs(gray, W, H) {
  const w = W >> 1, h = H >> 1, n = w * h;
  const g = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y*2)*W + x*2;
    g[y*w+x] = (gray[i] + gray[i+1] + gray[i+W] + gray[i+W+1]) >> 2;
  }
  const integ = new Float64Array((w+1)*(h+1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += g[y*w+x]; integ[(y+1)*(w+1)+x+1] = integ[y*(w+1)+x+1] + row; }
  }
  const half = Math.max(8, Math.round(Math.min(w, h) / 14));
  const bin = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y-half), y1 = Math.min(h, y+half+1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x-half), x1 = Math.min(w, x+half+1);
      const s = integ[y1*(w+1)+x1] - integ[y0*(w+1)+x1] - integ[y1*(w+1)+x0] + integ[y0*(w+1)+x0];
      const mean = s / ((x1-x0)*(y1-y0));
      const v = g[y*w+x];
      if (v < mean*0.72 && v < 170) bin[y*w+x] = 1;
    }
  }
  const unit = Math.min(w, h) / PAGE_W;            // хуудас богино талаараа бүтэн багтвал px/мм
  const sMin = 0.28*MARK*unit, sMax = 1.3*MARK*unit;
  const aMin = Math.max(6, sMin*sMin*0.55), aMax = sMax*sMax*1.25;
  const label = new Int32Array(n), stack = new Int32Array(n);
  const blobs = [];
  let cur = 0;
  for (let p = 0; p < n; p++) {
    if (!bin[p] || label[p]) continue;
    cur++;
    let sp = 0; stack[sp++] = p; label[p] = cur;
    let area = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, mnx = w, mxx = 0, mny = h, mxy = 0;
    while (sp) {
      const q = stack[--sp], x = q % w, y = (q - x) / w;
      area++; sx += x; sy += y; sxx += x*x; syy += y*y; sxy += x*y;
      if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
      if (x > 0 && bin[q-1] && !label[q-1]) { label[q-1] = cur; stack[sp++] = q-1; }
      if (x < w-1 && bin[q+1] && !label[q+1]) { label[q+1] = cur; stack[sp++] = q+1; }
      if (y > 0 && bin[q-w] && !label[q-w]) { label[q-w] = cur; stack[sp++] = q-w; }
      if (y < h-1 && bin[q+w] && !label[q+w]) { label[q+w] = cur; stack[sp++] = q+w; }
    }
    if (area < aMin || area > aMax) continue;
    const bw = mxx-mnx+1, bh = mxy-mny+1;
    if (area / (bw*bh) < 0.5) continue;
    const cx = sx/area, cy = sy/area;
    const vxx = sxx/area - cx*cx, vyy = syy/area - cy*cy, vxy = sxy/area - cx*cy;
    const tr = vxx + vyy, det = vxx*vyy - vxy*vxy;
    const disc = Math.sqrt(Math.max(0, tr*tr/4 - det));
    const l1 = tr/2 + disc, l2 = tr/2 - disc;
    if (l2 <= 0 || l1 / l2 > 2.2) continue;
    if (area / (Math.sqrt(det) * 12) < 0.72) continue;   // дүүрэн биш (цагираг, үсэг) бол хасна
    blobs.push({ x:(cx+0.5)*2, y:(cy+0.5)*2, area:area*4, side:Math.sqrt(area)*2 });
  }
  return blobs;
}

function quadArea(q) {
  let a = 0;
  for (let i = 0; i < 4; i++) { const [x1,y1] = q[i], [x2,y2] = q[(i+1)%4]; a += x1*y2 - x2*y1; }
  return a / 2;
}

// Дискийн доторх ба цагирагийн пикселүүд
function ringP75(gray, W, H, cx, cy, r1, r2) {
  const vals = [];
  const x0 = Math.max(0, Math.floor(cx-r2)), x1 = Math.min(W-1, Math.ceil(cx+r2));
  const y0 = Math.max(0, Math.floor(cy-r2)), y1 = Math.min(H-1, Math.ceil(cy+r2));
  const a = r1*r1, b = r2*r2;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = (x-cx)*(x-cx) + (y-cy)*(y-cy);
    if (d >= a && d <= b) vals.push(gray[y*W+x]);
  }
  if (!vals.length) return 255;
  vals.sort((p, q) => p - q);
  return vals[Math.floor(vals.length * 0.75)];
}
function diskStats(gray, W, H, cx, cy, r, darkBelow) {
  let n = 0, sum = 0, dark = 0;
  const x0 = Math.max(0, Math.floor(cx-r)), x1 = Math.min(W-1, Math.ceil(cx+r));
  const y0 = Math.max(0, Math.floor(cy-r)), y1 = Math.min(H-1, Math.ceil(cy+r));
  const rr = r*r;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if ((x-cx)*(x-cx) + (y-cy)*(y-cy) > rr) continue;
    const v = gray[y*W+x]; n++; sum += v; if (v < darkBelow) dark++;
  }
  return n ? { mean:sum/n, frac:dark/n, n } : { mean:255, frac:0, n:0 };
}

// мм → зургийн пиксел (дээд/доод хагаст тус тусын homography — линзний муруйлтыг багасгана)
function makeMapper(Htop, Hbot, Hall) {
  if (Htop && Hbot) return (x, y) => applyH(y <= MARKERS.ML[1] ? Htop : Hbot, x, y);
  return (x, y) => applyH(Hall, x, y);
}
function scaleAt(map, x, y) {
  const [ax, ay] = map(x, y), [bx, by] = map(x+1, y), [cx, cy] = map(x, y+1);
  return (Math.hypot(bx-ax, by-ay) + Math.hypot(cx-ax, cy-ay)) / 2;   // px/мм
}
function solidDark(gray, W, H, map, x, y, rMM) {
  const s = scaleAt(map, x, y), [px, py] = map(x, y);
  const white = ringP75(gray, W, H, px, py, (rMM+2.2)*s, (rMM+3.2)*s);
  const st = diskStats(gray, W, H, px, py, rMM*s, white*0.6);
  return st.frac;
}

// Сонголт бүрийн будалт → шийдвэр
export const TH = { darkPix:0.62, filled:0.45, weak:0.16, weakMean:0.22 };
function decideGroup(fs, ds) {
  const marked = [], weak = [];
  fs.forEach((f, i) => {
    if (f >= TH.filled) marked.push(i);
    else if (f > TH.weak || ds[i] >= TH.weakMean) weak.push(i);
  });
  const darkest = fs.indexOf(Math.max(...fs));
  if (marked.length === 1 && !weak.length) return { i:marked[0], flag:null };
  if (!marked.length && !weak.length) return { i:-1, flag:null };
  if (marked.length >= 2) return { i:-1, flag:'multi', cand:marked };
  if (marked.length === 1) return { i:marked[0], flag:'mixed', cand:[marked[0], ...weak] };
  return { i:fs[darkest] >= 0.3 ? darkest : -1, flag:'weak', cand:weak };
}

// Нэг зураг уншина. Амжилтгүй бол { ok:false, reason }.
export function readSheet(gray, W, H, layout) {
  const blobs = findBlobs(gray, W, H);
  if (blobs.length < 4) return { ok:false, reason:'markers' };
  let TLb = blobs[0], TRb = blobs[0], BRb = blobs[0], BLb = blobs[0];
  for (const b of blobs) {
    if (b.x + b.y < TLb.x + TLb.y) TLb = b;
    if (b.x + b.y > BRb.x + BRb.y) BRb = b;
    if (b.x - b.y > TRb.x - TRb.y) TRb = b;
    if (b.x - b.y < BLb.x - BLb.y) BLb = b;
  }
  const quad = [TLb, TRb, BRb, BLb];
  if (new Set(quad).size < 4) return { ok:false, reason:'markers' };
  const areas = quad.map(b => b.area);
  if (Math.max(...areas) / Math.min(...areas) > 3.5) return { ok:false, reason:'markers' };
  const qpts = quad.map(b => [b.x, b.y]);
  const qa = quadArea(qpts);
  if (qa < 0.12 * W * H) return { ok:false, reason:'far' };
  const sides = qpts.map((p, i) => Math.hypot(qpts[(i+1)%4][0]-p[0], qpts[(i+1)%4][1]-p[1]));
  const longS = Math.max(sides[0]+sides[2], sides[1]+sides[3]), shortS = Math.min(sides[0]+sides[2], sides[1]+sides[3]);
  if (longS / shortS < 1.08 || longS / shortS > 2.3) return { ok:false, reason:'markers' };

  // Чиглэл: 4 эргэлтээс зөвхөн нэгд нь чиглэлийн тэмдэг хар байна
  const C = [MARKERS.TL, MARKERS.TR, MARKERS.BR, MARKERS.BL];
  let best = null;
  const scores = [];
  for (let k = 0; k < 4; k++) {
    const img = [0,1,2,3].map(j => qpts[(j+k)%4]);
    const Hk = solveH(C, img);
    if (!Hk) { scores.push(0); continue; }
    const map = (x, y) => applyH(Hk, x, y);
    const d = solidDark(gray, W, H, map, ORIENT_C[0], ORIENT_C[1], 1.6);
    scores.push(d);
    if (!best || d > best.d) best = { k, H:Hk, img, d };
  }
  const others = scores.filter((_, k) => k !== best.k);
  if (best.d < 0.5 || Math.max(...others) > 0.3) return { ok:false, reason:'orient' };

  // Дунд тэмдгүүд (олдвол хоёр хагаст тусдаа homography)
  const mapAll = (x, y) => applyH(best.H, x, y);
  const tol = 5 * scaleAt(mapAll, 105, 148.5);
  const near = (mm) => {
    const [px, py] = mapAll(mm[0], mm[1]);
    let hit = null, hd = tol;
    for (const b of blobs) { const d = Math.hypot(b.x-px, b.y-py); if (d < hd) { hd = d; hit = b; } }
    return hit;
  };
  const ml = near(MARKERS.ML), mr = near(MARKERS.MR);
  let Htop = null, Hbot = null;
  const [iTL, iTR, iBR, iBL] = best.img;
  if (ml && mr) {
    Htop = solveH([MARKERS.TL, MARKERS.TR, MARKERS.MR, MARKERS.ML], [iTL, iTR, [mr.x,mr.y], [ml.x,ml.y]]);
    Hbot = solveH([MARKERS.ML, MARKERS.MR, MARKERS.BR, MARKERS.BL], [[ml.x,ml.y], [mr.x,mr.y], iBR, iBL]);
  }
  const map = makeMapper(Htop, Hbot, best.H);

  // Шалгалтын код
  let tag = 0;
  for (let i = 0; i < TAG.n; i++) {
    const cx = TAG.x0 + i*TAG.step + TAG.s/2, cy = TAG.y + TAG.s/2;
    if (solidDark(gray, W, H, map, cx, cy, 1.3) > 0.5) tag |= (1 << i);
  }

  // Дугуйнууд
  const res = {};
  let flagged = 0;
  for (const g of layout.groups) {
    const cx = g.options.reduce((s, o) => s + o.x, 0) / g.options.length;
    const s = scaleAt(map, cx, g.options[0].y);
    const pts = g.options.map(o => map(o.x, o.y));
    const whites = pts.map(([px, py]) => ringP75(gray, W, H, px, py, g.r*1.2*s, g.r*1.42*s)).sort((a, b) => a - b);
    const white = Math.max(40, whites[Math.floor(whites.length/2)]);
    const fs = [], ds = [];
    pts.forEach(([px, py]) => {
      const st = diskStats(gray, W, H, px, py, g.r*0.62*s, white*TH.darkPix);
      fs.push(st.frac); ds.push(Math.max(0, (white - st.mean) / white));
    });
    const dec = decideGroup(fs, ds);
    if (dec.flag) flagged++;
    res[g.id] = { sel: dec.i >= 0 ? g.options[dec.i].v : '', flag: dec.flag,
      cand: (dec.cand || []).map(i => g.options[i].v), fs };
  }

  // Код: зүүнээс баруун тийш будсан цифрүүд
  let code = '', codeFlag = false;
  for (let k = 0; k < ID_LEN; k++) {
    const r = res['id:'+k];
    if (r.flag) codeFlag = true;
    if (r.sel) code += r.sel;
    else if (!r.flag) break;
  }
  const s1Flags = layout.groups.filter(g => g.kind !== 'id' && res[g.id].flag).length;
  return {
    ok:true, groups:res, code, codeFlag, version:res.ver?.sel || '', verFlag:!!res.ver?.flag,
    tag, tagOk:tag === layout.tag, flagged:s1Flags, halves:!!(Htop && Hbot),
    corners:[iTL, iTR, iBR, iBL], map,
  };
}

// Дараалсан кадрууд ижил уншигдсан эсэхийг харьцуулах түлхүүр
export function readKey(r) {
  return Object.keys(r.groups).sort().map(k => k+'='+r.groups[k].sel+(r.groups[k].flag ? '?' : '')).join('|') + '#' + r.tag;
}

// Уншилт → calcScore-ийн `det` формат
export function toDet(r, layout) {
  const det = { version: r.version || '—', section1: [], section2: {} };
  for (const g of layout.groups) {
    const v = r.groups[g.id];
    if (g.kind === 's1') det.section1[g.q-1] = { q:g.q, selected: v.sel || 'BLANK', confidence: v.flag ? 50 : 99 };
    if (g.kind === 's2') {
      det.section2[g.sub] = det.section2[g.sub] || {};
      det.section2[g.sub][g.row] = { digit: v.sel || 'BLANK', confidence: v.flag ? 50 : 99 };
    }
  }
  return det;
}
