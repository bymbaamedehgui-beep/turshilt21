// ЭЕШ шалгагч — интернэтгүй үед ч апп нээгдэнэ. Дүнг утсанд хадгалж дараа илгээх нь lib/offline.js-д.
// Хуудас ('/', '/student'): эхлээд сүлжээ, болохгүй бол кэш. /_next/static (нэр нь hash-тай): эхлээд кэш.
// Бусад статик файл (дүрс, manifest, фонт): кэшээс шууд, ард нь шинэчилнэ. /api/* хэзээ ч кэшлэхгүй.
const PAGES = 'eyesh-pages-v3';
const STATIC = 'eyesh-static-v3';
const SHELL = ['/', '/student'];
const MAX_STATIC = 300;
const ASSET_RE = /\/_next\/static\/[^"'\s()<>\\]+/g;

function keep(e, p) { try { e.waitUntil(p.catch(() => {})); } catch (err) {} }

// Хуудсыг болон түүний HTML-д дурдсан JS, CSS-ийг кэшлэнэ
async function cachePage(path, res) {
  const html = await res.clone().text();
  await (await caches.open(PAGES)).put(path, res);
  const st = await caches.open(STATIC);
  const assets = [...new Set(html.match(ASSET_RE) || [])];
  await Promise.all(assets.map(async a => { if (!(await st.match(a))) await st.add(a).catch(() => {}); }));
}

// Шинэ хувилбар гарах бүрт хуучин файл хуримтлагдана — кэшлэсэн хуудсуудын ашигладгийг үлдээж, илүүг нь хуучнаас нь устгана
async function trimStatic() {
  const st = await caches.open(STATIC), keys = await st.keys();
  if (keys.length <= MAX_STATIC) return;
  const used = new Set(), pages = await caches.open(PAGES);
  for (const r of await pages.keys()) {
    const res = await pages.match(r);
    if (res) ((await res.text()).match(ASSET_RE) || []).forEach(a => used.add(new URL(a, self.location.origin).href));
  }
  let extra = keys.length - MAX_STATIC;
  for (const r of keys) {
    if (extra <= 0) break;
    if (!used.has(r.url)) { await st.delete(r); extra--; }
  }
}

self.addEventListener('install', e => {
  e.waitUntil(Promise.all(SHELL.map(p =>
    fetch(p, { cache: 'no-cache' }).then(res => (res.ok ? cachePage(p, res) : null)).catch(() => {}))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== PAGES && k !== STATIC).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    // интернэтгүй үед зөвхөн апп-ын хоёр хуудсыг кэшээс өгнө (/cm-admin г.м. бусад хуудас интернэт шаарддаг)
    const shell = url.pathname === '/' ? '/' : url.pathname.startsWith('/student') ? '/student' : null;
    e.respondWith(fetch(req).then(res => {
      if (res.ok && SHELL.includes(url.pathname)) keep(e, cachePage(url.pathname, res.clone()).then(trimStatic));
      return res;
    }).catch(async () => (shell && (await caches.match(shell, { cacheName: PAGES }))) || Response.error()));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.open(STATIC).then(async st => {
      const hit = await st.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) keep(e, st.put(req, res.clone()));
      return res;
    }));
    return;
  }

  if (/\.(?:svg|png|jpe?g|webp|ico|json|ttf|woff2?|txt)$/.test(url.pathname)) {
    e.respondWith(caches.open(STATIC).then(async st => {
      const hit = await st.match(req);
      const net = fetch(req).then(res => { if (res.ok) keep(e, st.put(req, res.clone())); return res; }).catch(() => null);
      if (hit) { keep(e, net); return hit; }
      return (await net) || Response.error();
    }));
  }
});
