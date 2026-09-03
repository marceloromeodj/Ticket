-- Inicialización del esquema PostgreSQL para HelpDesk
-- Este script es ejecutado automáticamente por Docker en el primer arranque

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Para búsqueda de texto

-- El backend con Sequelize creará las tablas mediante sync/migrations
-- Este archivo solo garantiza que las extensiones estén disponibles
