FROM node:20-alpine AS builder
WORKDIR /app

# Vacío por defecto = mismo origen que la página (relativo). Recomendado
# así para que el mismo build sirva en cualquier IP/dominio/subdominio sin
# tener que reconstruir el frontend cada vez que cambia la URL pública.
ARG VITE_API_URL=
ARG VITE_WS_URL=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ─── Nginx para servir el build ─────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
