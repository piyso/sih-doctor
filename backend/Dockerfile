# ==============================================================================
# AIIA Sovereign MediKiosk Engine - Production Backend Dockerfile
# Base: Node.js 22 LTS Alpine with Native Bilingual Tesseract 5.5 OCR & SQLite WAL
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools for native C++ SQLite bindings and SnarkJS
RUN apk add --no-cache python3 make g++ sqlite-dev

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY tests ./tests

# Compile TypeScript and copy static data
RUN npm run build

# ------------------------------------------------------------------------------
# Production Runner Image (Minimal attack surface & air-gapped readiness)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8001
ENV DB_PATH=/app/data/hospital.db

# Install runtime dependencies: SQLite, Native Tesseract OCR & Hindi/English traineddata
RUN apk add --no-cache \
    sqlite \
    tesseract-ocr \
    tesseract-ocr-data-hin \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-osd

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/data ./src/data
COPY src/data ./dist/data

# Persist SQLite WAL database volume
VOLUME ["/app/data"]

EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8001/health || exit 1

CMD ["node", "dist/index.js"]
