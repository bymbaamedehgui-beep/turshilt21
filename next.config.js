/** @type {import('next').NextConfig} */
// /cm-admin-г зөвхөн Дасгалын төвийн (cyber-math.com) админ хэсэг iframe-ээр нээнэ (pages/cm-admin.js)
const CM_ORIGINS = (process.env.CM_ORIGINS || 'https://cyber-math.com,https://www.cyber-math.com').split(',').map(s => s.trim()).filter(Boolean);
const nextConfig = {
  reactStrictMode: false,
  async headers() {
    return [{ source: '/cm-admin', headers: [{ key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${CM_ORIGINS.join(' ')}` }] }];
  },
  // Шалгалтын QR-ын богино холбоос (pages/api/q.js): сурагч уншуулаад бодлогоо харна
  async rewrites() {
    return [{ source: '/q/:t', destination: '/api/q?t=:t' }];
  },
}
module.exports = nextConfig
