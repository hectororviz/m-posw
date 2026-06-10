/**
 * asigna-uuid-socios.ts
 *
 * Asigna UUIDs v4 a socios existentes que no tengan uno.
 * Idempotente: no sobrescribe UUIDs ya asignados.
 *
 * Ejecutar con:
 *   npx ts-node scripts/asignar-uuid-socios.ts
 *
 * Requiere DATABASE_URL en el entorno.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const prisma = new PrismaClient();

  const sinUuid = await prisma.socio.findMany({
    where: { uuid: null },
    select: { id: true },
  });

  console.log(`Socios sin UUID: ${sinUuid.length}`);

  for (const s of sinUuid) {
    await prisma.socio.update({
      where: { id: s.id },
      data: { uuid: uuidv4() },
    });
    console.log(`  Socio ${s.id}: UUID asignado`);
  }

  console.log('Hecho.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
