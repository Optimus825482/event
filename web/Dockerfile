# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders only: src/env.ts validates these on import during `next build`.
# This stage is not part of the final image, so these values do not ship.
ENV DATABASE_URL=postgres://build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-secret-not-used-at-runtime \
    BETTER_AUTH_URL=http://localhost:3000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Çalışma zamanı migrator'ının bağımlılıkları: yalnızca drizzle-orm + pg (package.json'daki sürümlerle).
# Standalone izlemesi bunları eksik bırakabileceği için ayrı, tam bir kurulumdur.
FROM node:24-alpine AS migrator-deps
WORKDIR /opt/migrator
COPY package.json ./pkg.json
RUN node -e "const p=require('./pkg.json').dependencies; require('fs').writeFileSync('package.json', JSON.stringify({name:'migrator',private:true,type:'module',dependencies:{'drizzle-orm':p['drizzle-orm'],pg:p.pg}}))" \
    && rm pkg.json \
    && npm install --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    MIGRATIONS_FOLDER=/app/drizzle

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
# Tek seferlik migrate adımı: `node /opt/migrator/migrate.mjs` (bkz. docker-compose, `migrate` servisi).
COPY --from=migrator-deps --chown=nextjs:nodejs /opt/migrator/node_modules /opt/migrator/node_modules
COPY --chown=nextjs:nodejs scripts/migrate.mjs /opt/migrator/migrate.mjs

# Yükleme dizini (UPLOAD_DIR=/data/uploads): adlandırılmış volume ilk oluşturulurken bu sahipliği miras alır.
RUN mkdir -p /data/uploads && chown nextjs:nodejs /data/uploads

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
