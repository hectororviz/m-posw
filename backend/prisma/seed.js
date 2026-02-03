const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPin = process.env.ADMIN_PIN;
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'admin';

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL es requerido para el usuario admin.');
  }

  const adminSecret = adminPin || adminPassword;
  console.info(`Seed admin: usando ${adminPin ? 'ADMIN_PIN' : 'ADMIN_PASSWORD'}.`);
  const passwordHash = await bcrypt.hash(adminSecret, 10);
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
        storeName: 'MiBPS Demo',
        accentColor: '#0ea5e9',
      },
    });
  }

  const category = await prisma.category.findFirst();
  if (!category) {
    const bebidas = await prisma.category.create({
      data: {
        name: 'Bebidas',
        iconName: 'local_drink',
        colorHex: '#38BDF8',
        active: true,
      },
    });
    const snacks = await prisma.category.create({
      data: {
        name: 'Snacks',
        iconName: 'lunch_dining',
        colorHex: '#F97316',
        active: true,
      },
    });

    await prisma.product.createMany({
      data: [
        {
          name: 'Agua',
          price: 1.5,
          iconName: 'water_drop',
          colorHex: '#0EA5E9',
          active: true,
          categoryId: bebidas.id,
        },
        {
          name: 'Gaseosa',
          price: 2.0,
          iconName: 'sports_bar',
          colorHex: '#38BDF8',
          active: true,
          categoryId: bebidas.id,
        },
        {
          name: 'Papas Fritas',
          price: 2.5,
          iconName: 'fastfood',
          colorHex: '#F59E0B',
          active: true,
          categoryId: snacks.id,
        },
        {
          name: 'Barra de cereal',
          price: 1.2,
          iconName: 'energy_savings_leaf',
          colorHex: '#22C55E',
          active: true,
          categoryId: snacks.id,
        },
      ],
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
