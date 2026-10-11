# Voxora frontend image: build with Node, serve with nginx.
# Build context is the repo root (see docker-compose.yml) so that
# docker/nginx.conf can be copied into the image.
#
# Note: the Vite build needs no VITE_API_URL — the default /api base is
# same-origin and nginx proxies /api/* to the backend.
FROM node:24-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
