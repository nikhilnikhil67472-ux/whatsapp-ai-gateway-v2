# Stage 1: Build & Compile
FROM node:20-alpine AS builder

WORKDIR /app

# Install native compilation toolchain for SQLite
RUN apk add --no-cache python3 make g++ gcc

COPY package*.json tsconfig.json ./
RUN npm ci

# Compile TypeScript
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Prune devDependencies to keep image lean
RUN npm prune --production

# =========================================================================
# Stage 2: Production Runtime (Hugging Face Spaces UID 1000 Compatible)
# =========================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install ffmpeg for voice note audio conversion and curl for healthchecks
RUN apk add --no-cache ffmpeg curl

# node:20-alpine already includes the 'node' user with UID/GID 1000
RUN mkdir -p /app/data /app/data/media /app/data/sessions && \
    chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=7860
ENV HOST=0.0.0.0
ENV UNIFIED_MODE=true
ENV SQLITE_DB_PATH=/app/data/gateway.db

# Copy compiled dist and production dependencies
COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node templates ./templates

USER node

EXPOSE 7860 10000 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c "curl -f http://localhost:\${PORT:-7860}/health || exit 1"

CMD ["node", "dist/index.js"]
