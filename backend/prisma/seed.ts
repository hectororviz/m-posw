import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mibps.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'Administrador';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      password: passwordHash,
      role: Role.ADMIN,
      active: true,
    },
    create: {
      email: adminEmail,
      name: adminName,
      password: passwordHash,
      role: Role.ADMIN,
      active: true,
    },
  });

  const setting = await prisma.setting.findFirst();
  if (!setting) {
    await prisma.setting.create({
      data: {
        storeName: 'MiBPS Demo',
        logoUrl: 'https://placehold.co/120x120?text=Logo',
        faviconUrl: 'https://placehold.co/64x64?text=F',
        accentColor: '#0ea5e9',
      },
    });
  }

  const category = await prisma.category.findFirst();
  if (!category) {
    const bebidas = await prisma.category.create({
      data: {
        name: 'Bebidas',
        imageUrl: 'https://placehold.co/400x240?text=Bebidas',
        active: true,
      },
    });
    const snacks = await prisma.category.create({
      data: {
        name: 'Snacks',
        imageUrl: 'https://placehold.co/400x240?text=Snacks',
        active: true,
      },
    });

    await prisma.product.createMany({
      data: [
        {
          name: 'Agua',
          price: 1.5,
          imageUrl: 'https://placehold.co/300x200?text=Agua',
          active: true,
          categoryId: bebidas.id,
        },
        {
          name: 'Gaseosa',
          price: 2.0,
          imageUrl: 'https://placehold.co/300x200?text=Gaseosa',
          active: true,
          categoryId: bebidas.id,
        },
        {
          name: 'Papas Fritas',
          price: 2.5,
          imageUrl: 'https://placehold.co/300x200?text=Papas',
          active: true,
          categoryId: snacks.id,
        },
        {
          name: 'Barra de cereal',
          price: 1.2,
          imageUrl: 'https://placehold.co/300x200?text=Cereal',
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
