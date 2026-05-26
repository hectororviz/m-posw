const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcrypt');

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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
