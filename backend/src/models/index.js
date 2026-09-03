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
User.belongsTo(Branch,  { foreignKey: 'branch_id',  as: 'branch' });
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
};
