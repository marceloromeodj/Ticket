# HelpDesk — Sistema de Tickets Multi-Empresa

Sistema completo de gestión de tickets similar a Freshdesk, con soporte multi-empresa, multi-sucursales y múltiples canales de comunicación.

## ✨ Funcionalidades

- **Multi-empresa y multi-sucursales** — Múltiples organizaciones comparten la misma instalación, cada una con sus sucursales, agentes y datos completamente aislados.
- **Gestión de tickets** — Creación, asignación, prioridades, estados, categorías, etiquetas, notas internas y adjuntos.
- **Canales de entrada** — Email (IMAP/SMTP), formulario web, chat en vivo (WebSockets), WhatsApp (Meta Cloud API), API REST.
- **Portal del cliente** — Los clientes pueden crear tickets y consultar su estado sin necesidad de cuenta.
- **Automatizaciones** — Reglas configurables basadas en eventos (ticket creado, asignado, resuelto) o tiempo.
- **SLA** — Políticas de nivel de servicio con tiempos de primera respuesta y resolución por prioridad; alertas de incumplimiento y cron job de verificación.
- **Reportes y dashboard** — Estadísticas en tiempo real, gráficos de evolución, performance por agente, cumplimiento SLA.
- **Base de conocimiento** — Artículos de ayuda accesibles desde el portal del cliente.
- **Notificaciones en tiempo real** — Via Socket.io; toast de nuevos tickets y respuestas.
- **RBAC** — Roles: `super_admin`, `admin`, `supervisor`, `agent`, `customer`.

---

## 🚀 Instalación rápida con Docker

### Requisitos previos

- Docker ≥ 24
- Docker Compose ≥ 2.20

### 1. Clonar el repositorio

```bash
git clone <repo-url> helpdesk
cd helpdesk
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus valores:

```env
# Base de datos
DB_PASSWORD=cambiar_por_contraseña_segura

# JWT — genera con: openssl rand -base64 64
JWT_SECRET=secreto_muy_largo_y_aleatorio
JWT_REFRESH_SECRET=otro_secreto_muy_largo

# MinIO (almacenamiento de archivos)
MINIO_ROOT_PASSWORD=cambiar_contraseña_minio

# URL pública del sistema
APP_URL=http://localhost

# Superadmin inicial
SUPER_ADMIN_EMAIL=admin@tudominio.com
SUPER_ADMIN_PASSWORD=AdminSeguro123!
SUPER_ADMIN_NAME=Administrador
```

### 3. Levantar los servicios

```bash
docker compose up -d
```

El primer inicio descarga las imágenes y compila el frontend (~2-3 minutos).

### 4. Verificar que todo esté corriendo

```bash
docker compose ps
docker compose logs backend --tail 30
```

Deberías ver `Server running on port 3001` y `Database synced`.

### 5. Acceder al sistema

| URL | Descripción |
|-----|-------------|
| `http://localhost` | Aplicación principal (agentes) |
| `http://localhost/portal` | Portal de clientes |
| `http://localhost:9001` | Consola MinIO (archivos) |
| `http://localhost/api/health` | Health check del backend |

Credenciales de acceso:
- **Email:** valor de `SUPER_ADMIN_EMAIL`  
- **Contraseña:** valor de `SUPER_ADMIN_PASSWORD`

---

## 🔧 Configuración inicial recomendada

Después del primer login como `super_admin`:

1. **Crear empresa(s):** Ir a *Empresas* → *Nueva Empresa*. Cada empresa tiene su propio slug, límite de agentes y configuración.
2. **Crear sucursales:** Ir a *Sucursales* → *Nueva Sucursal* y asociarla a la empresa.
3. **Crear agentes:** Ir a *Agentes* → *Nuevo Agente* y asignarles rol y sucursal.
4. **Configurar SLA:** Ir a *Configuración → Políticas SLA* y definir tiempos por prioridad.
5. **Configurar bandeja de email:** Ir a *Configuración → Bandejas Email* e ingresar datos IMAP/SMTP para recibir tickets por correo.
6. **Configurar WhatsApp (opcional):** Completar en `.env` las variables `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_VERIFY_TOKEN`. El webhook se expone en `/webhook/whatsapp`.

---

## 📡 Variables de entorno completas

| Variable | Descripción | Valor ejemplo |
|----------|-------------|---------------|
| `DB_HOST` | Host de PostgreSQL | `postgres` |
| `DB_PORT` | Puerto | `5432` |
| `DB_NAME` | Nombre de la base de datos | `helpdesk` |
| `DB_USER` | Usuario | `helpdesk` |
| `DB_PASSWORD` | Contraseña | `secreto` |
| `REDIS_URL` | URL de Redis | `redis://redis:6379` |
| `JWT_SECRET` | Clave JWT (access token) | cadena aleatoria larga |
| `JWT_REFRESH_SECRET` | Clave JWT (refresh token) | cadena aleatoria larga |
| `JWT_EXPIRES_IN` | Expiración access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Expiración refresh token | `7d` |
| `MINIO_ENDPOINT` | Host de MinIO | `minio` |
| `MINIO_PORT` | Puerto | `9000` |
| `MINIO_ROOT_USER` | Usuario admin MinIO | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | Contraseña MinIO | `secreto` |
| `MINIO_BUCKET` | Bucket de archivos | `helpdesk` |
| `APP_URL` | URL pública del sistema | `http://localhost` |
| `NODE_ENV` | Entorno | `production` |
| `WHATSAPP_TOKEN` | Token de acceso Meta | — |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de WA | — |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación webhook | cadena aleatoria |
| `SUPER_ADMIN_EMAIL` | Email del admin inicial | — |
| `SUPER_ADMIN_PASSWORD` | Contraseña del admin inicial | — |
| `SUPER_ADMIN_NAME` | Nombre del admin inicial | — |

---

## 🏗️ Arquitectura

```
nginx (puerto 80)
  ├── /api/*          → backend:3001  (Express + Socket.io)
  ├── /socket.io/*    → backend:3001  (WebSockets)
  ├── /webhook/*      → backend:3001  (WhatsApp, etc.)
  ├── /files/*        → minio:9000    (archivos estáticos)
  └── /*              → frontend:80   (React SPA)

Servicios Docker:
  postgres:16    — Base de datos principal
  redis:7        — Colas Bull + cache
  minio          — Almacenamiento de archivos (S3-compatible)
  backend        — API Node.js + Socket.io
  frontend       — React compilado servido por nginx
  nginx          — Reverse proxy
```

### Stack tecnológico

**Backend:** Node.js 20, Express, Sequelize (PostgreSQL), Socket.io, Bull (colas), node-cron, nodemailer, imap, axios (WhatsApp API), MinIO SDK

**Frontend:** React 18, Vite, Tailwind CSS, Zustand, React Query, Recharts, Socket.io-client, React Router v6, Lucide React, react-hot-toast, date-fns

---

## 🔌 Integración WhatsApp (Meta Cloud API)

1. Crear una app en [developers.facebook.com](https://developers.facebook.com) con el producto **WhatsApp Business**.
2. Obtener el *Access Token permanente*, *Phone Number ID* y definir un *Verify Token* propio.
3. Configurar el webhook en Meta apuntando a `https://tudominio.com/webhook/whatsapp` con los eventos `messages` y `message_status`.
4. Completar las variables `WHATSAPP_*` en `.env` y reiniciar el backend:
   ```bash
   docker compose restart backend
   ```

---

## 📧 Integración Email (IMAP/SMTP)

Cada bandeja de email se configura desde *Configuración → Bandejas Email*. Soporta Gmail, Outlook, cualquier servidor IMAP estándar. Para Gmail usar una *contraseña de aplicación*.

El sistema:
- Revisa correos nuevos cada 5 minutos (configurable en `workers/index.js`).
- Crea un ticket nuevo si el correo no tiene `In-Reply-To` de un ticket existente.
- Agrega un mensaje al ticket correspondiente si el correo es una respuesta.
- Envía respuestas manteniendo el hilo de email (`In-Reply-To` / `References`).

---

## 🛠️ Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar un servicio
docker compose restart backend

# Acceder a la base de datos
docker compose exec postgres psql -U helpdesk -d helpdesk

# Acceder al shell del backend
docker compose exec backend sh

# Actualizar código (rebuild)
docker compose up -d --build backend
docker compose up -d --build frontend

# Detener todo
docker compose down

# Detener y borrar volúmenes (⚠️ borra datos)
docker compose down -v
```

---

## 🔐 Roles y permisos

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| `super_admin` | Admin global | Todo, incluido gestión de empresas |
| `admin` | Admin de empresa | Agentes, sucursales, config, reportes |
| `supervisor` | Supervisor | Reportes, gestión de agentes |
| `agent` | Agente de soporte | Tickets asignados y generales |
| `customer` | Cliente | Portal: crear y consultar sus tickets |

---

## 📝 Licencia

MIT — Libre para uso personal y comercial.
