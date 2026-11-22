# EventFlow PRO

Uygulama `web/` altındadır: Next.js 16 (App Router) + React 19 + TypeScript strict + Drizzle ORM + PostgreSQL 17 + Better Auth.
Eski NestJS `backend/` ve Next.js `frontend/` dizinleri kaldırıldı; onlara dair yönerge geçerli değildir.

- Kurallar ve dizin düzeni: [`README.md`](../README.md)
- Dağıtım, geçiş ve geri alma: [`DEPLOYMENT.md`](../DEPLOYMENT.md)
- Özellik düzeni: `web/src/features/<alan>/{schemas,service,queries,actions,action-defs}.ts + components/`
- Mutasyonlar `defineAction` ile tanımlanır; hatalar `DomainError`; arayüz metinleri Türkçedir.
- Yasak: `any`, `@ts-ignore`, `eslint-disable`, `console.*`; dosyalar 400 satırın altında kalır.
- Doğrulama (web/ içinden): `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e`.
