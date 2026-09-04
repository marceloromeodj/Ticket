const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('KnowledgeArticle', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id:  { type: DataTypes.UUID, allowNull: false },
  category_id: DataTypes.UUID,
  author_id:   DataTypes.UUID,
  title:       { type: DataTypes.STRING(500), allowNull: false },
  slug:        DataTypes.STRING(500),
  summary:     DataTypes.TEXT,
  content:     { type: DataTypes.TEXT, allowNull: false },
  content_html: DataTypes.TEXT,
  status:      { type: DataTypes.ENUM('draft', 'published', 'archived'), defaultValue: 'draft' },
  visibility:  { type: DataTypes.ENUM('public', 'agents_only'), defaultValue: 'public' },
  is_faq:      { type: DataTypes.BOOLEAN, defaultValue: false },
  views:       { type: DataTypes.INTEGER, defaultValue: 0 },
  helpful:     { type: DataTypes.INTEGER, defaultValue: 0 },
  not_helpful: { type: DataTypes.INTEGER, defaultValue: 0 },
  tags:        { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  meta_title:  DataTypes.STRING(200),
  meta_desc:   DataTypes.STRING(500),
  published_at: DataTypes.DATE,
}, {
  tableName: 'knowledge_articles',
  indexes: [
    { fields: ['company_id'] },
    { fields: ['category_id'] },
    { fields: ['status'] },
    { fields: ['slug', 'company_id'], unique: true },
  ],
});
