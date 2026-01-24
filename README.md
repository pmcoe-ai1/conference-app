# Conference Survey App

Full-stack conference survey application with real-time statistics.

## Quick Start

### Railway Deployment
1. Push this code to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add PostgreSQL database
4. Set environment variables (see backend/.env.example)
5. Run: `npx prisma db push && npm run db:seed`

### Local Development

**Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database URL
npm run db:push
npm run db:seed
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Test Credentials
- Admin: admin@pmcoe.com / admin123
- Attendee: john.smith@company.com / test1234
- Conference URL: /c/PMI-SUMMIT-2026

## Tech Stack
- Backend: Node.js, Express, Prisma, PostgreSQL, Socket.io
- Frontend: React 18, Vite, TailwindCSS, Recharts
