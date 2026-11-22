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

# Çalışma zamanı betiklerinin (migrate.mjs, create-admin.mjs) bağımlılıkları: yalnızca drizzle-orm + pg + bcryptjs
# ve geçişli bağımlılıkları. Betiklere yeni bir paket eklenirse aşağıdaki listeye de eklenmelidir (tests/scripts/image-deps.test.ts denetler).
# Paketler, uygulamanın `npm ci` ile kurulan ağacından (package-lock.json'daki sürümler) kopyalanır; böylece
# migrator uygulamayla aynı sürümleri kullanır ve ağdan kurulum yapılmaz. Kapanışı package-lock.json'dan çıkarır.
FROM deps AS migrator-deps
RUN node -e "const fs=require('fs');const lock=require('./package-lock.json').packages;const seen=new Set();const find=(from,name)=>{let p=from;for(;;){const c=(p?p+'/':'')+'node_modules/'+name;if(lock[c])return c;if(!p)return null;const i=p.lastIndexOf('/node_modules/');p=i<0?'':p.slice(0,i);}};const walk=(path)=>{if(!path||seen.has(path))return;seen.add(path);const e=lock[path];for(const d of Object.keys({...e.dependencies,...e.optionalDependencies}))walk(find(path,d));};for(const n of ['drizzle-orm','pg','bcryptjs'])walk(find('',n));for(const p of seen)fs.cpSync(p,'/opt/migrator/'+p,{recursive:true});console.log([...seen].join('\n'));"

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
# Tek seferlik adımlar: `node /opt/migrator/migrate.mjs` (compose `migrate` servisi) ve
# `node /opt/migrator/create-admin.mjs <kullanıcı-adı>` (compose `create-admin` servisi, bkz. DEPLOYMENT.md "İlk yönetici").
COPY --from=migrator-deps --chown=nextjs:nodejs /opt/migrator/node_modules /opt/migrator/node_modules
COPY --chown=nextjs:nodejs scripts/migrate.mjs scripts/create-admin.mjs /opt/migrator/

# Yükleme dizini (UPLOAD_DIR=/data/uploads): adlandırılmış volume ilk oluşturulurken bu sahipliği miras alır.
RUN mkdir -p /data/uploads && chown nextjs:nodejs /data/uploads

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
