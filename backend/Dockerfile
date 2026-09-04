FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias del sistema. postgresql16-client trae pg_dump,
# usado por src/scripts/backup.js (versión emparejada con la imagen
# postgres:16-alpine del docker-compose).
RUN apk add --no-cache python3 make g++ curl postgresql16-client

# Copiar archivos de dependencias
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar código fuente
COPY src/ ./src/

# Crear directorio para uploads
RUN mkdir -p /app/uploads

# Usuario no-root para seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
