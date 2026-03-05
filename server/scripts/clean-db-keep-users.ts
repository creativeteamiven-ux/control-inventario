/**
 * Limpia la base de datos y deja solo los usuarios.
 * Orden correcto por dependencias (foreign keys).
 * Uso: desde raíz: npm run db:clean   o desde server: npx tsx scripts/clean-db-keep-users.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Limpiando base de datos (se mantienen solo usuarios)...');

  await prisma.auditLog.deleteMany();
  await prisma.loanRecord.deleteMany();
  await prisma.maintenance.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.document.deleteMany();
  await prisma.deviceImage.deleteMany();
  await prisma.device.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();

  const users = await prisma.user.count();
  console.log(`Listo. Se conservaron ${users} usuario(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
