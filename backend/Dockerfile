# Backend Dockerfile - Production
FROM node:20-alpine AS builder

WORKDIR /app

# Package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install postgresql-client for database seeding
RUN apk add --no-cache postgresql-client

# Create uploads directory
RUN mkdir -p /app/uploads/avatars /app/uploads/logos /app/uploads/event-images /app/uploads/invitation-images

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy seed data for database initialization
COPY --from=builder /app/seed-data.sql ./seed-data.sql

# Set permissions for uploads
RUN chown -R node:node /app/uploads

USER node

EXPOSE 4004

CMD ["node", "dist/main.js"]
