FROM node:22-alpine AS build
WORKDIR /web
COPY frontend/web/package*.json ./
RUN npm ci
COPY frontend/web/ ./
# Empty uses the browser origin, so the same image works behind staging HTTPS.
ENV VITE_API_URL=""
RUN npm run build

FROM nginx:1.28-alpine
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
