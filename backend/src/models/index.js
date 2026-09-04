const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Importar todos los modelos
const Company          = require('./Company')(sequelize);
const Branch           = require('./Branch')(sequelize);
const User             = require('./User')(sequelize);
const Ticket           = require('./Ticket')(sequelize);
const TicketMessage    = require('./TicketMessage')(sequelize);
const TicketAttachment = require('./TicketAttachment')(sequelize);
const Category         = require('./Category')(sequelize);
const Tag              = require('./Tag')(sequelize);
const TicketTag        = require('./TicketTag')(sequelize);
const SLAPolicy        = require('./SLAPolicy')(sequelize);
const AutomationRule   = require('./AutomationRule')(sequelize);
const KnowledgeArticle = require('./KnowledgeArticle')(sequelize);
const CannedResponse   = require('./CannedResponse')(sequelize);
const Notification     = require('./Notification')(sequelize);
const EmailInbox       = require('./EmailInbox')(sequelize);
const ChatSession      = require('./ChatSession')(sequelize);
const ChatMessage      = require('./ChatMessage')(sequelize);
const CustomField      = require('./CustomField')(sequelize);
const UserBranch       = require('./UserBranch')(sequelize);
const Asset            = require('./Asset')(sequelize);
const TicketAsset      = require('./TicketAsset')(sequelize);
const Problem          = require('./Problem')(sequelize);
const ChangeRequest    = require('./ChangeRequest')(sequelize);
const TicketSurvey     = require('./TicketSurvey')(sequelize);
const AuditLog         = require('./AuditLog')(sequelize);
const Service          = require('./Service')(sequelize);
const MaintenancePlan  = require('./MaintenancePlan')(sequelize);
const MaintenanceLog   = require('./MaintenanceLog')(sequelize);
const NotificationChannel = require('./NotificationChannel')(sequelize);
const ScheduledReport  = require('./ScheduledReport')(sequelize);
const Vendor           = require('./Vendor')(sequelize);
const Contract         = require('./Contract')(sequelize);
const ApiToken         = require('./ApiToken')(sequelize);
const AssetType        = require('./AssetType')(sequelize);
const NotificationTemplate = require('./NotificationTemplate')(sequelize);

// ─── Asociaciones ────────────────────────────────────────────────

// Company
Company.hasMany(Branch,           { foreignKey: 'company_id', as: 'branches' });
Company.hasMany(User,             { foreignKey: 'company_id', as: 'users' });
Company.hasMany(Ticket,           { foreignKey: 'company_id', as: 'tickets' });
Company.hasMany(Category,         { foreignKey: 'company_id', as: 'categories' });
Company.hasMany(Tag,              { foreignKey: 'company_id', as: 'tags' });
Company.hasMany(SLAPolicy,        { foreignKey: 'company_id', as: 'slaPolicies' });
Company.hasMany(AutomationRule,   { foreignKey: 'company_id', as: 'automationRules' });
Company.hasMany(KnowledgeArticle, { foreignKey: 'company_id', as: 'knowledgeArticles' });
Company.hasMany(CannedResponse,   { foreignKey: 'company_id', as: 'cannedResponses' });
Company.hasMany(EmailInbox,       { foreignKey: 'company_id', as: 'emailInboxes' });

// Branch
Branch.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Branch.hasMany(User,      { foreignKey: 'branch_id',  as: 'users' });
Branch.hasMany(Ticket,    { foreignKey: 'branch_id',  as: 'tickets' });
Branch.hasMany(EmailInbox,{ foreignKey: 'branch_id',  as: 'emailInboxes' });

// User
User.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
// branch_id sigue siendo la sucursal "principal" (usada en el JWT y para
// asignar sucursal por defecto a tickets creados por este agente); un
// agente puede además pertenecer a otras sucursales vía la tabla
// intermedia user_branches (ver companyScope de sucursales en tickets).
User.belongsTo(Branch,  { foreignKey: 'branch_id',  as: 'branch' });
User.belongsToMany(Branch, { through: UserBranch, foreignKey: 'user_id', otherKey: 'branch_id', as: 'branches' });
Branch.belongsToMany(User, { through: UserBranch, foreignKey: 'branch_id', otherKey: 'user_id', as: 'agents' });
User.hasMany(Ticket,    { foreignKey: 'agent_id',   as: 'assignedTickets' });
User.hasMany(Ticket,    { foreignKey: 'requester_id', as: 'requestedTickets' });
User.hasMany(TicketMessage, { foreignKey: 'user_id', as: 'messages' });
User.hasMany(Notification,  { foreignKey: 'user_id', as: 'notifications' });

// Ticket
Ticket.belongsTo(Company,  { foreignKey: 'company_id',  as: 'company' });
Ticket.belongsTo(Branch,   { foreignKey: 'branch_id',   as: 'branch' });
Ticket.belongsTo(User,     { foreignKey: 'agent_id',    as: 'agent' });
Ticket.belongsTo(User,     { foreignKey: 'requester_id', as: 'requester' });
Ticket.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Ticket.belongsTo(SLAPolicy,{ foreignKey: 'sla_policy_id', as: 'slaPolicy' });
Ticket.hasMany(TicketMessage,    { foreignKey: 'ticket_id', as: 'messages' });
Ticket.hasMany(TicketAttachment, { foreignKey: 'ticket_id', as: 'attachments' });
Ticket.hasMany(Notification,     { foreignKey: 'ticket_id', as: 'notifications' });
Ticket.hasOne(ChatSession,       { foreignKey: 'ticket_id', as: 'chatSession' });

// Ticket <-> Tag (many-to-many)
Ticket.belongsToMany(Tag, { through: TicketTag, foreignKey: 'ticket_id', as: 'tags' });
Tag.belongsToMany(Ticket, { through: TicketTag, foreignKey: 'tag_id',    as: 'tickets' });
Tag.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// TicketMessage
TicketMessage.belongsTo(Ticket, { foreignKey: 'ticket_id', as: 'ticket' });
TicketMessage.belongsTo(User,   { foreignKey: 'user_id',   as: 'author' });
TicketMessage.hasMany(TicketAttachment, { foreignKey: 'message_id', as: 'attachments' });

// TicketAttachment
TicketAttachment.belongsTo(Ticket,        { foreignKey: 'ticket_id',  as: 'ticket' });
TicketAttachment.belongsTo(TicketMessage, { foreignKey: 'message_id', as: 'message' });

// Category
Category.belongsTo(Company,  { foreignKey: 'company_id', as: 'company' });
Category.belongsTo(Category, { foreignKey: 'parent_id',  as: 'parent' });
Category.hasMany(Category,   { foreignKey: 'parent_id',  as: 'children' });
Category.hasMany(Ticket,     { foreignKey: 'category_id', as: 'tickets' });
Category.hasMany(KnowledgeArticle, { foreignKey: 'category_id', as: 'articles' });

// SLAPolicy
SLAPolicy.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
SLAPolicy.hasMany(Ticket,    { foreignKey: 'sla_policy_id', as: 'tickets' });

// AutomationRule
AutomationRule.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// KnowledgeArticle
KnowledgeArticle.belongsTo(Company,  { foreignKey: 'company_id',  as: 'company' });
KnowledgeArticle.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
KnowledgeArticle.belongsTo(User,     { foreignKey: 'author_id',   as: 'author' });

// CannedResponse
CannedResponse.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
CannedResponse.belongsTo(User,    { foreignKey: 'agent_id',   as: 'agent' });

// Notification
Notification.belongsTo(User,   { foreignKey: 'user_id',   as: 'user' });
Notification.belongsTo(Ticket, { foreignKey: 'ticket_id', as: 'ticket' });

// EmailInbox
EmailInbox.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
EmailInbox.belongsTo(Branch,  { foreignKey: 'branch_id',  as: 'branch' });

// ChatSession
ChatSession.belongsTo(Ticket, { foreignKey: 'ticket_id', as: 'ticket' });
ChatSession.hasMany(ChatMessage, { foreignKey: 'session_id', as: 'messages' });

// ChatMessage
ChatMessage.belongsTo(ChatSession, { foreignKey: 'session_id', as: 'session' });
ChatMessage.belongsTo(User,        { foreignKey: 'agent_id',   as: 'agent' });

// CustomField
CustomField.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// ─── CMDB: Asset ────────────────────────────────────────────────
Company.hasMany(Asset, { foreignKey: 'company_id', as: 'assets' });
Branch.hasMany(Asset,  { foreignKey: 'branch_id',  as: 'assets' });
Asset.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Asset.belongsTo(Branch,  { foreignKey: 'branch_id',  as: 'branch' });
Asset.belongsTo(User,    { foreignKey: 'owner_id',   as: 'owner' });
Asset.belongsToMany(Ticket, { through: TicketAsset, foreignKey: 'asset_id',  otherKey: 'ticket_id', as: 'tickets' });
Ticket.belongsToMany(Asset, { through: TicketAsset, foreignKey: 'ticket_id', otherKey: 'asset_id',  as: 'assets' });

// ─── Problem ────────────────────────────────────────────────────
Company.hasMany(Problem, { foreignKey: 'company_id', as: 'problems' });
Problem.belongsTo(Company,  { foreignKey: 'company_id',  as: 'company' });
Problem.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Problem.belongsTo(User,     { foreignKey: 'agent_id',     as: 'agent' });
Problem.hasMany(Ticket,     { foreignKey: 'problem_id',   as: 'tickets' });
Ticket.belongsTo(Problem,   { foreignKey: 'problem_id',   as: 'problem' });

// ─── ChangeRequest (RFC) ──────────────────────────────────────────
Company.hasMany(ChangeRequest, { foreignKey: 'company_id', as: 'changeRequests' });
ChangeRequest.belongsTo(Company, { foreignKey: 'company_id',  as: 'company' });
ChangeRequest.belongsTo(User,    { foreignKey: 'requested_by', as: 'requester' });
ChangeRequest.belongsTo(User,    { foreignKey: 'approved_by',  as: 'approver' });
ChangeRequest.belongsTo(Problem, { foreignKey: 'problem_id',   as: 'problem' });

// ─── TicketSurvey (CSAT) ──────────────────────────────────────────
Ticket.hasOne(TicketSurvey,      { foreignKey: 'ticket_id', as: 'survey' });
TicketSurvey.belongsTo(Ticket,   { foreignKey: 'ticket_id', as: 'ticket' });
TicketSurvey.belongsTo(Company,  { foreignKey: 'company_id', as: 'company' });

// ─── AuditLog ───────────────────────────────────────────────────
AuditLog.belongsTo(User,    { foreignKey: 'user_id',    as: 'user' });
AuditLog.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// ─── Service (catálogo de servicios) ─────────────────────────────
Company.hasMany(Service, { foreignKey: 'company_id', as: 'services' });
Service.belongsTo(Company,   { foreignKey: 'company_id',  as: 'company' });
Service.belongsTo(User,      { foreignKey: 'owner_id',    as: 'owner' });
Service.belongsTo(SLAPolicy, { foreignKey: 'sla_policy_id', as: 'slaPolicy' });
Service.hasMany(Ticket,      { foreignKey: 'service_id',  as: 'tickets' });
Ticket.belongsTo(Service,    { foreignKey: 'service_id',  as: 'service' });

// ─── Mantenimiento preventivo ─────────────────────────────────────
Asset.hasMany(MaintenancePlan,      { foreignKey: 'asset_id', as: 'maintenancePlans' });
MaintenancePlan.belongsTo(Asset,    { foreignKey: 'asset_id', as: 'asset' });
MaintenancePlan.hasMany(MaintenanceLog, { foreignKey: 'plan_id', as: 'logs' });
MaintenanceLog.belongsTo(MaintenancePlan, { foreignKey: 'plan_id', as: 'plan' });
MaintenanceLog.belongsTo(Asset,     { foreignKey: 'asset_id', as: 'asset' });
MaintenanceLog.belongsTo(User,      { foreignKey: 'done_by',  as: 'technician' });

// ─── Notificaciones multi-canal y reportes programados ────────────
Company.hasMany(NotificationChannel, { foreignKey: 'company_id', as: 'notificationChannels' });
NotificationChannel.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Company.hasMany(ScheduledReport, { foreignKey: 'company_id', as: 'scheduledReports' });
ScheduledReport.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// ─── Contratos, licencias y proveedores ───────────────────────────
Company.hasMany(Vendor, { foreignKey: 'company_id', as: 'vendors' });
Vendor.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Vendor.hasMany(Contract, { foreignKey: 'vendor_id', as: 'contracts' });
Contract.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });
Company.hasMany(Contract, { foreignKey: 'company_id', as: 'contracts' });
Contract.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Asset.hasMany(Contract, { foreignKey: 'asset_id', as: 'contracts' });
Contract.belongsTo(Asset, { foreignKey: 'asset_id', as: 'asset' });

// ─── Tokens de API (integraciones externas) ───────────────────────
Company.hasMany(ApiToken, { foreignKey: 'company_id', as: 'apiTokens' });
ApiToken.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
ApiToken.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ─── Tipos de activo configurables ─────────────────────────────────
Company.hasMany(AssetType, { foreignKey: 'company_id', as: 'assetTypes' });
AssetType.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// ─── Plantillas de notificación ─────────────────────────────────────
Company.hasMany(NotificationTemplate, { foreignKey: 'company_id', as: 'notificationTemplates' });
NotificationTemplate.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// ─── Normalización de UUIDs y fechas vacíos ────────────────────────
// Los <select> del frontend mandan "" cuando queda en una opción tipo
// "Sin asignar"/"Todas"/"Ninguna" (columnas UUID), y los <input type="date">
// mandan "" cuando se dejan vacíos (columnas DATE/DATEONLY). En ambos casos
// Postgres rechaza el string vacío -- para fechas, Sequelize ni siquiera
// llega a mandar "" tal cual: internamente lo formatea como el string
// literal "Invalid date" antes de armar el SQL, así que el error que
// aparece es "invalid input syntax for type date: "Invalid date"" en vez
// de algo que delate la causa real. Se corrige acá, una sola vez para
// todos los modelos, en vez de acordarse de sanitizar cada endpoint que
// reciba un campo *_id o de fecha opcional.
const allModels = [
  Company, Branch, User, Ticket, TicketMessage, TicketAttachment, Category,
  Tag, TicketTag, SLAPolicy, AutomationRule, KnowledgeArticle, CannedResponse,
  Notification, EmailInbox, ChatSession, ChatMessage, CustomField, UserBranch,
  Asset, TicketAsset, Problem, ChangeRequest, TicketSurvey, AuditLog,
  Service, MaintenancePlan, MaintenanceLog, NotificationChannel, ScheduledReport,
  Vendor, Contract, ApiToken, AssetType, NotificationTemplate,
];
allModels.forEach((model) => {
  const emptyToNullAttrs = Object.entries(model.rawAttributes)
    .filter(([, attr]) => attr.type instanceof DataTypes.UUID || attr.type instanceof DataTypes.DATE || attr.type instanceof DataTypes.DATEONLY)
    .map(([name]) => name);
  if (emptyToNullAttrs.length === 0) return;

  model.addHook('beforeValidate', (instance) => {
    emptyToNullAttrs.forEach((attr) => {
      if (instance[attr] === '') instance[attr] = null;
    });
  });
});

module.exports = {
  sequelize,
  Company,
  Branch,
  User,
  Ticket,
  TicketMessage,
  TicketAttachment,
  Category,
  Tag,
  TicketTag,
  SLAPolicy,
  AutomationRule,
  KnowledgeArticle,
  CannedResponse,
  Notification,
  EmailInbox,
  ChatSession,
  ChatMessage,
  CustomField,
  UserBranch,
  Asset,
  TicketAsset,
  Problem,
  ChangeRequest,
  TicketSurvey,
  AuditLog,
  Service,
  MaintenancePlan,
  MaintenanceLog,
  NotificationChannel,
  ScheduledReport,
  Vendor,
  Contract,
  ApiToken,
  AssetType,
  NotificationTemplate,
};
