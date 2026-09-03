FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache python3 make g++ curl

# Copiar archivos de dependencias
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

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
