# EventFlow PRO - Teknoloji ve Geliştirme Kurulumu

## Teknoloji Stack

### Backend

**Framework ve Dil:**
- NestJS 11.x
- TypeScript 5.9

**Veritabanı:**
- PostgreSQL
- TypeORM (ORM)

**API:**
- RESTful API
- Swagger (OpenAPI dokümantasyonu)

**Authentication:**
- JWT (JSON Web Token)
- Passport (Authentication stratejisi)

**WebSocket:**
- Socket.IO

**Güvenlik:**
- Helmet (HTTP başlıkları)
- CORS (Cross-Origin Resource Sharing)
- Rate Limiting (@nestjs/throttler)

**Diğer Kütüphaneler:**
- bcrypt (Password hashing)
- nodemailer (Email gönderme)
- qrcode (QR kod oluşturma)
- sharp (İşlem resim)
- uuid (Benzersiz ID'ler)
- class-validator (Validasyon)
- class-transformer (DTO dönüşümleri)

### Frontend

**Framework ve Dil:**
- Next.js 16 (App Router)
- React 19
- TypeScript 5

**UI Kütüphanesi:**
- Radix UI (shadcn UI benzeri)

**State Yönetimi:**
- Zustand

**Veri Çekme:**
- TanStack Query
- Axios (HTTP client)

**Styling:**
- Tailwind CSS 4

**Canvas:**
- Konva
- react-konva (React wrapper)

**QR Kod:**
- html5-qrcode

**Fonts:**
- Geist Sans
- Geist Mono

**Diğer Kütüphaneler:**
- xlsx (Excel dosya okuma)
- idb (IndexedDB - Indexed Database)

### DevOps

**Containerization:**
- Docker
- Docker Compose

**Platform:**
- Coolify desteği

**Deployment:**
- Multi-stage Docker builds

## Geliştirme Kurulumu

### Gerekli Araçlar

**Backend:**
- Node.js 18+
- TypeScript 5.9+
- npm veya yarn (package manager)

**Frontend:**
- Node.js 18+
- TypeScript 5+
- npm veya yarn (package manager)

**Database:**
- PostgreSQL 14+
- pgAdmin (opsiyonel yönetimi için)

### Ortam Değişkenleri (.env)

**Backend:**
- `NODE_ENV` - development/production
- `PORT` - Backend port (default: 4000)
- `DB_HOST` - Veritabanı host (default: localhost)
- `DB_PORT` - Veritabanı port (default: 5432)
- `DB_USERNAME` - Veritabanı kullanıcı adı (default: postgres)
- `DB_PASSWORD` - Veritabanı şifresi (default: postgres)
- `DB_NAME` - Veritabanı adı (default: eventflow)
- `JWT_SECRET` - JWT secret key
- `CORS_ORIGINS` - CORS kaynakları (virgülle ayrılmış)
- `THROTTLE_TTL` - Rate limiting TTL (ms)
- `THROTTLE_LIMIT` - Rate limiting limit (default: 200)
- `SLOW_QUERY_THRESHOLD` - Yavaş sorgu eşiği (ms, default: 500)
- `DB_POOL_MAX` - Max connection pool (default: 50)
- `DB_POOL_MIN` - Min connection pool (default: 10)

**Frontend:**
- `NEXT_PUBLIC_API_URL` - Backend API URL

### Teknik Kısıtlamalar

**Backend:**
- PostgreSQL connection pool: max 50, min 10
- Slow query logging: 500ms üzeri sorgular loglanıyor
- Rate limiting: 100 istek / 60 saniye (genel), 10 istek / 60 saniye (auth)
- Response compression: gzip/deflate, level 6, threshold 1KB

**Frontend:**
- API caching: In-memory cache, 60 saniye TTL
- Bundle size: < 200KB (gzipped)
- Code splitting: React.lazy, dynamic imports
- Image optimization: WebP, lazy loading

### Araç Kullanım Kalıpları

**Backend:**
- Swagger API dokümantasyonu
- NestJS CLI (CLI araçları)
- TypeORM CLI (Migration yönetimi)

**Frontend:**
- Next.js CLI (Development server)
- TanStack DevTools (Query debugging)
- React DevTools (Component debugging)

### Database Optimizasyon Stratejileri

- Index stratejisi: WHERE, JOIN, ORDER BY sütunları için index'ler
- Query optimizasyonu: N+1 query önleme, EXPLAIN ANALYZE kullanımı
- Connection pooling: PostgreSQL connection pool optimize etme
- Slow query monitoring: pg_stat_statements kullanımı

## Önemli Komutlar

**Backend:**
```bash
# Geliştirme
npm run start:dev

# Migration'lar
npm run typeorm migration:run -- -n

# Database seed (test verileri)
npm run seed:database

# Build
npm run build

# Test
npm run test
npm run test:e2e
npm run test:cov
```

**Frontend:**
```bash
# Geliştirme
npm run dev

# Build
npm run build

# Linting
npm run lint

# Test
npm run test
```

**Database:**
```bash
# PostgreSQL bağlantısı
psql postgresql://localhost:5432/eventflow

# Migration çalıştırma
npx typeorm migration:run -- -n

# Slow query logları görüntüleme
SELECT query, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

## Performans Hedefleri

- Backend response time: < 100ms (p95)
- Frontend bundle size: < 200KB (gzipped)
- Database query time: < 100ms (p95)
- Cache hit rate: > 90%
- WebSocket latency: < 50ms (P99)
