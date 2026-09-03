const router = require('express').Router();
const { User } = require('../models');
const { authenticate, authorize, tenantMiddleware } = require('../middleware/auth');
const { Op } = require('sequelize');

router.use(authenticate, tenantMiddleware);

// Listar agentes de la empresa
router.get('/', async (req, res, next) => {
  try {
    const { search, role, branch_id, active = true } = req.query;
    const where = {
      company_id: req.companyId,
      role: { [Op.in]: ['admin', 'supervisor', 'agent'] },
    };
    if (active !== 'all') where.active = active === 'true';
    if (role)      where.role      = role;
    if (branch_id) where.branch_id = branch_id;
    if (search) {
      where[Op.or] = [
        { name:  { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const agents = await User.findAll({
      where,
      attributes: ['id','name','email','role','avatar_url','availability','branch_id','groups','active'],
      order: [['name', 'ASC']],
    });
    res.json(agents);
  } catch (err) { next(err); }
});

// Crear agente
router.post('/', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, email, password, role = 'agent', branch_id, groups = [] } = req.body;
    const existing = await User.findOne({ where: { email: email.toLowerCase(), company_id: req.companyId } });
    if (existing) return res.status(400).json({ error: 'El email ya existe en esta empresa' });

    const agent = await User.create({
      name, email: email.toLowerCase(), password, role,
      company_id: req.companyId, branch_id, groups,
    });
    res.status(201).json(agent);
  } catch (err) { next(err); }
});

// Obtener agente
router.get('/:id', async (req, res, next) => {
  try {
    const agent = await User.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json(agent);
  } catch (err) { next(err); }
});

// Actualizar agente
router.put('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const agent = await User.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' });

    const allowed = ['name','role','branch_id','groups','active','phone','notification_preferences'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.password) updates.password = req.body.password;

    await agent.update(updates);
    res.json(agent);
  } catch (err) { next(err); }
});

// Eliminar (desactivar) agente
router.delete('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const agent = await User.findOne({ where: { id: req.params.id, company_id: req.companyId } });
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' });
    await agent.update({ active: false });
    res.json({ message: 'Agente desactivado' });
  } catch (err) { next(err); }
});

// Cambiar disponibilidad (propio)
router.patch('/me/availability', async (req, res, next) => {
  try {
    const { availability } = req.body;
    await req.user.update({ availability });
    res.json({ availability });
  } catch (err) { next(err); }
});

module.exports = router;
