# EventFlow PRO

Etkinlik ve mekan yönetim sistemi.

## Teknolojiler

- **Frontend:** Next.js 15, React, TailwindCSS, Zustand
- **Backend:** NestJS, TypeORM, PostgreSQL
- **Deployment:** Docker, Coolify

## Coolify ile Kurulum

1. Coolify'da yeni bir proje oluşturun
2. GitHub reposunu bağlayın: `https://github.com/Optimus825482/event.git`
3. "Docker Compose" deployment tipini seçin
4. Environment variables ekleyin:

```env
DB_USERNAME=postgres
DB_PASSWORD=güvenli-şifre
DB_NAME=eventflow
JWT_SECRET=güvenli-jwt-secret
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

5. Deploy edin

## Lokal Geliştirme

```bash
# Backend
cd backend
npm install
npm run start:dev

# Frontend (ayrı terminal)
cd frontend
npm install
npm run dev
```

## Portlar

- Frontend: 3000
- Backend: 4000
- PostgreSQL: 5432
