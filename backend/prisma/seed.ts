import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const existingAdminRole = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (!existingAdminRole) {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      throw new Error('FATAL: no existe ningún ADMIN y ADMIN_USERNAME / ADMIN_PASSWORD no están configurados. Sin defaults por seguridad.');
    }

    const existingAdmin = await prisma.user.findUnique({ where: { username: adminUsername } });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          username: adminUsername,
          password: passwordHash,
          role: Role.ADMIN,
          active: true,
        },
      });
      console.log(`Admin inicial "${adminUsername}" creado.`);
    } else if (existingAdmin.role !== Role.ADMIN) {
      throw new Error(`FATAL: ya existe un usuario "${adminUsername}" que no es ADMIN.`);
    }
  }

  const setting = await prisma.setting.findFirst();
  if (!setting) {
    await prisma.setting.create({
      data: {
        storeName: 'Mi Tienda',
        accentColor: '#0ea5e9',
      },
    });
  }

  await seedFinanzas();
  await seedAssetStatuses();
}

async function seedFinanzas() {
  const accounts = [
    { name: 'Efectivo', kind: 'EFECTIVO' as const, position: 0 },
    { name: 'Mercado Pago', kind: 'MERCADOPAGO' as const, position: 1 },
  ];
  for (const a of accounts) {
    await prisma.moneyAccount.upsert({
      where: { name: a.name },
      create: { name: a.name, kind: a.kind, position: a.position },
      update: {},
    });
  }

  const categories: { name: string; kind: 'INGRESO' | 'EGRESO' | 'AMBOS'; position: number }[] = [
    { name: 'Ventas mostrador', kind: 'INGRESO', position: 0 },
    { name: 'Cuotas sociales', kind: 'INGRESO', position: 1 },
    { name: 'Cobro fiado', kind: 'INGRESO', position: 2 },
    { name: 'Compras mercadería', kind: 'EGRESO', position: 3 },
    { name: 'Servicios', kind: 'EGRESO', position: 4 },
    { name: 'Otros ingresos', kind: 'INGRESO', position: 5 },
    { name: 'Otros gastos', kind: 'EGRESO', position: 6 },
  ];
  for (const c of categories) {
    await prisma.moneyCategory.upsert({
      where: { name: c.name },
      create: { name: c.name, kind: c.kind, position: c.position },
      update: {},
    });
  }

  console.log('Cuentas y categorías de caja sembradas correctamente.');
}

async function seedAssetStatuses() {
  await prisma.assetStatus.createMany({
    data: [
      { name: 'Activo', isSystem: true },
      { name: 'De Baja', isSystem: true },
    ],
    skipDuplicates: true,
  });
  console.log('AssetStatus sembrado correctamente.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
