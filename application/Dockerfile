# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build
WORKDIR /app

ARG REACT_APP_API_URL=http://localhost:8081
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

COPY country-flags-app-main/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

COPY country-flags-app-main/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY application/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/build /usr/share/nginx/html

EXPOSE 8080
USER 101:101

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
