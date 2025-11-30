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

# Create uploads directory
RUN mkdir -p /app/uploads/avatars /app/uploads/logos /app/uploads/event-images /app/uploads/invitation-images

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set permissions for uploads
RUN chown -R node:node /app/uploads

USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
