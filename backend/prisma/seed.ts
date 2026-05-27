import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'admin';

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL es requerido para el usuario admin.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminData = {
    name: adminName,
    password: passwordHash,
    role: Role.ADMIN,
    active: true,
    email: adminEmail,
  };

  await prisma.user.upsert({
    where: { name: adminName },
    update: adminData,
    create: adminData,
  });

  const setting = await prisma.setting.findFirst();
  if (!setting) {
    await prisma.setting.create({
      data: {
        storeName: 'Mi Tienda',
        accentColor: '#0ea5e9',
      },
    });
  }
}

  await seedLedgerAccounts();
}

async function seedLedgerAccounts() {
  const accounts = [
    { code: '1',      name: 'Activo',                    type: 'ASSET' as const,     acceptsEntries: false },
    { code: '1.1',    name: 'Disponibilidades',          type: 'ASSET' as const,     acceptsEntries: false },
    { code: '1.1.01', name: 'Caja - Efectivo',           type: 'ASSET' as const,     acceptsEntries: true },
    { code: '1.1.02', name: 'Mercado Pago',              type: 'ASSET' as const,     acceptsEntries: true },
    { code: '1.1.03', name: 'Banco - Cuenta principal',  type: 'ASSET' as const,     acceptsEntries: true },
    { code: '1.2',    name: 'Créditos',                  type: 'ASSET' as const,     acceptsEntries: false },
    { code: '1.2.01', name: 'Créditos a cobrar',         type: 'ASSET' as const,     acceptsEntries: true },
    { code: '1.2.02', name: 'Anticipos entregados',      type: 'ASSET' as const,     acceptsEntries: true },
    { code: '2',      name: 'Pasivo',                    type: 'LIABILITY' as const, acceptsEntries: false },
    { code: '2.1',    name: 'Deudas',                    type: 'LIABILITY' as const, acceptsEntries: false },
    { code: '2.1.01', name: 'Proveedores a pagar',       type: 'LIABILITY' as const, acceptsEntries: true },
    { code: '2.1.02', name: 'Gastos pendientes de pago', type: 'LIABILITY' as const, acceptsEntries: true },
    { code: '3',      name: 'Patrimonio Neto',           type: 'EQUITY' as const,    acceptsEntries: false },
    { code: '3.1',    name: 'Patrimonio',                type: 'EQUITY' as const,    acceptsEntries: false },
    { code: '3.1.01', name: 'Patrimonio / Saldo inicial', type: 'EQUITY' as const,   acceptsEntries: true },
    { code: '3.1.02', name: 'Resultados acumulados',      type: 'EQUITY' as const,   acceptsEntries: true },
    { code: '4',      name: 'Ingresos',                  type: 'REVENUE' as const,   acceptsEntries: false },
    { code: '4.1',    name: 'Ingresos operativos',       type: 'REVENUE' as const,   acceptsEntries: false },
    { code: '4.1.01', name: 'Ventas en jornada',         type: 'REVENUE' as const,   acceptsEntries: true },
    { code: '4.1.02', name: 'Ventas de entradas',        type: 'REVENUE' as const,   acceptsEntries: true },
    { code: '4.1.03', name: 'Cuotas',                    type: 'REVENUE' as const,   acceptsEntries: true },
    { code: '4.1.04', name: 'Donaciones',                type: 'REVENUE' as const,   acceptsEntries: true },
    { code: '4.1.99', name: 'Otros ingresos',            type: 'REVENUE' as const,   acceptsEntries: true },
    { code: '5',      name: 'Gastos',                    type: 'EXPENSE' as const,   acceptsEntries: false },
    { code: '5.1',    name: 'Compras y gastos operativos', type: 'EXPENSE' as const, acceptsEntries: false },
    { code: '5.1.01', name: 'Compra de mercadería',      type: 'EXPENSE' as const,   acceptsEntries: true },
    { code: '5.1.02', name: 'Compra de bienes',          type: 'EXPENSE' as const,   acceptsEntries: true },
    { code: '5.1.03', name: 'Compra de insumos',         type: 'EXPENSE' as const,   acceptsEntries: true },
    { code: '5.1.04', name: 'Limpieza',                  type: 'EXPENSE' as const,   acceptsEntries: true },
    { code: '5.1.05', name: 'Mantenimiento',             type: 'EXPENSE' as const,   acceptsEntries: true },
    { code: '5.1.06', name: 'Servicios',                 type: 'EXPENSE' as const,   acceptsEntries: true },
    { code: '5.1.07', name: 'Transporte',                type: 'EXPENSE' as const,   acceptsEntries: true },
    { code: '5.1.99', name: 'Otros gastos',              type: 'EXPENSE' as const,   acceptsEntries: true },
  ];

  // Build parent references
  const parentMap: Record<string, string | null> = {};
  for (const a of accounts) {
    const parts = a.code.split('.');
    if (parts.length > 1) {
      const parentCode = parts.slice(0, -1).join('.');
      parentMap[a.code] = parentCode;
    } else {
      parentMap[a.code] = null;
    }
  }

  // Insert accounts with parent references
  const codeToId: Record<string, string> = {};

  for (const a of accounts) {
    const existing = await prisma.ledgerAccount.findUnique({ where: { code: a.code } });
    const parentCode = parentMap[a.code];
    const parentId = parentCode ? codeToId[parentCode] || null : null;

    if (existing) {
      await prisma.ledgerAccount.update({
        where: { code: a.code },
        data: {
          name: a.name,
          type: a.type,
          acceptsEntries: a.acceptsEntries,
          parentId: parentId || existing.parentId,
        },
      });
      codeToId[a.code] = existing.id;
    } else {
      const created = await prisma.ledgerAccount.create({
        data: { code: a.code, name: a.name, type: a.type, acceptsEntries: a.acceptsEntries, parentId },
      });
      codeToId[a.code] = created.id;
    }
  }

  console.log('Plan de cuentas contable sembrado correctamente.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
