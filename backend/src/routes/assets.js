const router = require('express').Router();
const { Asset, Branch, User, Ticket } = require('../models');
const { authenticate, authorize, tenantMiddleware, companyScope, requireCompanySelected } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { Op } = require('sequelize');

router.use(authenticate, tenantMiddleware);

const includeRefs = [
  { model: Branch, as: 'branch', attributes: ['id', 'name'] },
  { model: User,   as: 'owner',  attributes: ['id', 'name', 'email'] },
];

// Listar activos
router.get('/', async (req, res, next) => {
  try {
    const { search, type, status, branch_id, owner_id } = req.query;
    const where = { ...companyScope(req) };
    if (type)      where.type = type;
    if (status)    where.status = status;
    if (branch_id) where.branch_id = branch_id;
    if (owner_id)  where.owner_id = owner_id;
    if (search) {
      where[Op.or] = [
        { name:           { [Op.iLike]: `%${search}%` } },
        { asset_tag:      { [Op.iLike]: `%${search}%` } },
        { serial_number:  { [Op.iLike]: `%${search}%` } },
        { ip_address:     { [Op.iLike]: `%${search}%` } },
      ];
    }

    const assets = await Asset.findAll({ where, include: includeRefs, order: [['name', 'ASC']] });
    res.json({ assets });
  } catch (err) { next(err); }
});

// Crear activo
router.post('/', authorize('super_admin', 'admin', 'supervisor', 'agent'), requireCompanySelected, async (req, res, next) => {
  try {
    const allowed = [
      'asset_tag', 'name', 'type', 'status', 'brand', 'model', 'serial_number',
      'ip_address', 'mac_address', 'os', 'owner_id', 'branch_id', 'location',
      'vendor', 'purchase_date', 'warranty_until', 'notes', 'custom_fields',
    ];
    const data = { company_id: req.companyId };
    allowed.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

    const existing = await Asset.findOne({ where: { asset_tag: data.asset_tag, company_id: req.companyId } });
    if (existing) return res.status(400).json({ error: 'Ya existe un activo con ese código en esta empresa' });

    const asset = await Asset.create(data);
    await logAudit(req, { action: 'create', entity_type: 'Asset', entity_id: asset.id, after: asset.toJSON() });

    const fullAsset = await Asset.findByPk(asset.id, { include: includeRefs });
    res.status(201).json(fullAsset);
  } catch (err) { next(err); }
});

// Obtener activo (con historial de tickets relacionados)
router.get('/:id', async (req, res, next) => {
  try {
    const asset = await Asset.findOne({
      where: { id: req.params.id, ...companyScope(req) },
      include: [
        ...includeRefs,
        {
          model: Ticket, as: 'tickets', through: { attributes: [] },
          attributes: ['id', 'ticket_number', 'subject', 'status', 'priority', 'created_at'],
        },
      ],
    });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json(asset);
  } catch (err) { next(err); }
});

// Actualizar activo
router.put('/:id', authorize('super_admin', 'admin', 'supervisor', 'agent'), async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const before = asset.toJSON();

    const allowed = [
      'asset_tag', 'name', 'type', 'status', 'brand', 'model', 'serial_number',
      'ip_address', 'mac_address', 'os', 'owner_id', 'branch_id', 'location',
      'vendor', 'purchase_date', 'warranty_until', 'notes', 'custom_fields',
    ];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await asset.update(updates);
    await logAudit(req, { action: 'update', entity_type: 'Asset', entity_id: asset.id, before, after: asset.toJSON() });

    const fullAsset = await Asset.findByPk(asset.id, { include: includeRefs });
    res.json(fullAsset);
  } catch (err) { next(err); }
});

// Eliminar activo
router.delete('/:id', authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const before = asset.toJSON();
    await asset.destroy();
    await logAudit(req, { action: 'delete', entity_type: 'Asset', entity_id: req.params.id, before });
    res.json({ message: 'Activo eliminado' });
  } catch (err) { next(err); }
});

// Vincular / desvincular un activo a un ticket
router.post('/:id/tickets/:ticketId', async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const ticket = await Ticket.findOne({ where: { id: req.params.ticketId, ...companyScope(req) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    await asset.addTicket(ticket);
    res.status(201).json({ message: 'Activo vinculado al ticket' });
  } catch (err) { next(err); }
});

router.delete('/:id/tickets/:ticketId', async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, ...companyScope(req) } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    await asset.removeTicket(req.params.ticketId);
    res.json({ message: 'Activo desvinculado del ticket' });
  } catch (err) { next(err); }
});

module.exports = router;
