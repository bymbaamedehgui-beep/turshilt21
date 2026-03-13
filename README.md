# EYESH Checker — Vercel Deploy заавар

## Технологи
- **Frontend:** Next.js 14 + React 18
- **Backend:** Next.js API Routes
- **Database:** Neon Postgres (Vercel Marketplace)
- **Auth:** JWT (30 хоног хүчинтэй)
- **AI:** Anthropic API (backend proxy-оор)

---

## Vercel-д deploy хийх алхмууд

### 1. GitHub-д оруулах
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/eyesh-checker.git
git push -u origin main
```

### 2. Vercel-д холбох
1. https://vercel.com → New Project
2. GitHub repo import хийх
3. Framework: Next.js (автоматаар танигдана)
4. Deploy дарах

### 3. Neon Postgres нэмэх
1. Vercel dashboard → project → Storage tab
2. Add → Neon → Create New Database → Continue
3. DATABASE_URL автоматаар нэмэгдэнэ

### 4. Environment Variables тохируулах
Vercel dashboard → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `APP_USERNAME` | admin |
| `APP_PASSWORD` | өөрийн нууц үг |
| `JWT_SECRET` | урт санамсаргүй тэмдэгт |
| `ANTHROPIC_API_KEY` | sk-ant-... (Anthropic Console-оос авна) |

> Anthropic API key авах: https://console.anthropic.com → API Keys → Create Key

### 5. Redeploy
Settings → Environment Variables нэмсний дараа:
Deployments → хамгийн сүүлийн deploy → "..." → Redeploy

---

## Local хөгжүүлэлт
```bash
npm install
```
`.env.local` файл үүсгэх:
```
DATABASE_URL=postgresql://...
APP_USERNAME=admin
APP_PASSWORD=eyesh2025
JWT_SECRET=local-secret
ANTHROPIC_API_KEY=sk-ant-...
```
```bash
npm run dev
```

---

## Нэвтрэх (default)
- **Нэвтрэх нэр:** admin
- **Нууц үг:** eyesh2025 (APP_PASSWORD-оор тохируулна)
