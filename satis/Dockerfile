# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=1536
# Yalnızca derleme için yer tutucular: ortam modülü `next build` sırasında bunları doğrular.
# Bu aşama son imajın parçası değildir; değerler imaja girmez. Gerçek değerler çalışma zamanında verilir.
ENV CORE_API_URL=http://core.invalid \
    SALES_API_SECRET=build-time-placeholder-secret-not-used-at-runtime \
    SITE_URL=https://satis.invalid \
    TRUSTED_IP_HEADER=x-real-ip
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `public` klasörü olmayabilir; son aşamadaki COPY başarısız olmasın.
RUN mkdir -p public && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
