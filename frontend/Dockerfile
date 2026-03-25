# Frontend Dockerfile - Production
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for API URLs
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

# Package files
COPY package*.json ./

# Install ALL dependencies (with retry for flaky networks)
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 60000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --include=dev

# Copy source
COPY . .

# Remove .env.local if exists (use environment variables instead)
RUN rm -f .env.local

# Build
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3003

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3003

# Node.js heap limit - Docker memory limitinin %75'i (1G container -> 768MB heap)
CMD ["node", "--max-old-space-size=768", "server.js"]
