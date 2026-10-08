# ==============================================================================
# AIIA Sovereign MediKiosk Engine - Production Frontend Dockerfile
# Base: Node 22 Build Stage -> High-Performance NGINX Alpine Runtime
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig*.json vite.config.ts postcss.config.js tailwind.config.ts ./
RUN npm ci

COPY public ./public
COPY scripts ./scripts
COPY src ./src
COPY index.html ./

RUN npm run build

# ------------------------------------------------------------------------------
# Production Web Server (NGINX with gzip, caching, and clean SPA routing)
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing, security headers and reverse proxy to the backend (see nginx.conf)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
