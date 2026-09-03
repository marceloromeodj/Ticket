const { User, Company, Branch } = require('../models');

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@helpdesk.local';
  const existing = await User.findOne({ where: { email } });
  if (existing) return;

  // Crear empresa por defecto
  const [company] = await Company.findOrCreate({
    where: { slug: 'default' },
    defaults: {
      name:     'Mi Empresa',
      slug:     'default',
      timezone: 'America/Buenos_Aires',
      plan:     'enterprise',
      max_agents: 999,
    },
  });

  // Crear sucursal principal
  const [branch] = await Branch.findOrCreate({
    where: { company_id: company.id, name: 'Casa Central' },
    defaults: { company_id: company.id, name: 'Casa Central', code: 'CC', active: true },
  });

  // Crear super admin
  await User.create({
    company_id: company.id,
    branch_id:  branch.id,
    name:       process.env.SUPER_ADMIN_NAME     || 'Super Admin',
    email,
    password:   process.env.SUPER_ADMIN_PASSWORD,
    role:       'super_admin',
    active:     true,
    email_verified: true,
  });

  console.log(`[Seed] Super Admin creado: ${email}`);
  console.log(`[Seed] Empresa: ${company.name} (${company.id})`);
}

module.exports = { seedSuperAdmin };
