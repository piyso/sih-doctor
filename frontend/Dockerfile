# ==============================================================================
# AIIA Sovereign MediKiosk Engine - Production Frontend Dockerfile
# Base: Node 22 Build Stage -> High-Performance NGINX Alpine Runtime
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig*.json vite.config.ts postcss.config.js tailwind.config.ts ./
RUN npm ci

COPY public ./public
COPY src ./src
COPY index.html ./

RUN npm run build

# ------------------------------------------------------------------------------
# Production Web Server (NGINX with gzip, caching, and clean SPA routing)
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx configuration for SPA routing & WebSocket reverse proxy
RUN echo 'server {' \
    '    listen 80;' \
    '    server_name localhost;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '    gzip on;' \
    '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml model/gltf-binary;' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html;' \
    '    }' \
    '    location /api/ {' \
    '        proxy_pass http://backend:8001/api/;' \
    '        proxy_http_version 1.1;' \
    '        proxy_set_header Upgrade $http_upgrade;' \
    '        proxy_set_header Connection "upgrade";' \
    '        proxy_set_header Host $host;' \
    '        proxy_cache_bypass $http_upgrade;' \
    '    }' \
    '    location /ws/ {' \
    '        proxy_pass http://backend:8001/ws/;' \
    '        proxy_http_version 1.1;' \
    '        proxy_set_header Upgrade $http_upgrade;' \
    '        proxy_set_header Connection "Upgrade";' \
    '        proxy_set_header Host $host;' \
    '    }' \
    '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
