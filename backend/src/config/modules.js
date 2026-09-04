// Módulos de funciones que el super_admin puede habilitar/deshabilitar
// por empresa (Company.modules). Todos arrancan en true para no romper
// instalaciones existentes -- deshabilitar es una decisión explícita.
const MODULE_DEFS = [
  { key: 'assets',            label: 'Activos (CMDB) + mantenimiento' },
  { key: 'problems',          label: 'Gestión de Problemas' },
  { key: 'changes',           label: 'Gestión de Cambios (RFC)' },
  { key: 'services',          label: 'Catálogo de servicios' },
  { key: 'contracts',         label: 'Contratos, licencias y proveedores' },
  { key: 'knowledge',         label: 'Base de conocimiento' },
  { key: 'automation',        label: 'Automatizaciones (motor de reglas)' },
  { key: 'audit',             label: 'Auditoría' },
  { key: 'api',               label: 'API externa e integraciones' },
  { key: 'channels',          label: 'Notificaciones Slack/Telegram' },
  { key: 'scheduled_reports', label: 'Reportes programados por email' },
];

const DEFAULT_MODULES = Object.fromEntries(MODULE_DEFS.map(m => [m.key, true]));

module.exports = { MODULE_DEFS, DEFAULT_MODULES };
