/**
 * Deja la base lista para entrar en producción: borra los datos cargados y
 * conserva los usuarios y la configuración maestra.
 *
 * SE CONSERVA: usuarios, passkeys, categorías, etiquetas, ubicaciones y
 * destinatarios de alertas.
 * SE BORRA: equipos con sus imágenes y documentos, movimientos,
 * mantenimientos, préstamos, gastos, presupuestos, eventos completos y la
 * auditoría.
 *
 * El orden respeta las claves foráneas. Importa especialmente borrar los ítems
 * de evento antes que los equipos: la relación es ON DELETE RESTRICT y, si no,
 * el borrado de equipos falla.
 *
 * Los archivos de imágenes y documentos se eliminan también del almacenamiento
 * (Cloudinary o disco local) para no dejarlos huérfanos consumiendo cuota.
 *
 * Uso:
 *   npm run db:clean                                    -> simulación
 *   npx tsx scripts/clean-db-keep-users.ts --yes        -> ejecuta el borrado
 *
 * Sin `--yes` solo enseña el recuento. Conviene invocarlo directamente con tsx
 * porque PowerShell se come el `--` de `npm run ... -- --yes` y el flag no
 * llega al script.
 */
import { PrismaClient } from '@prisma/client';
import { deleteByUrl } from '../src/lib/storage.js';

const prisma = new PrismaClient();

const KEEP = ['user', 'webAuthnCredential', 'category', 'tag', 'location', 'alertRecipient'] as const;

/** Modelos a vaciar, en orden seguro respecto a las claves foráneas. */
const WIPE = [
  'auditLog',
  'eventScan',
  'eventItem',
  'eventList',
  'event',
  'movement',
  'maintenance',
  'loanRecord',
  'expense',
  'budget',
  'document',
  'deviceImage',
  'device',
] as const;

type Countable = { count: () => Promise<number>; deleteMany: () => Promise<{ count: number }> };

async function main() {
  const confirmed = process.argv.includes('--yes');
  const client = prisma as unknown as Record<string, Countable>;

  console.log(confirmed ? 'LIMPIANDO LA BASE DE DATOS\n' : 'SIMULACION (nada se va a borrar)\n');

  console.log('Se conserva:');
  for (const model of KEEP) {
    console.log(`${String(await client[model].count()).padStart(6)}  ${model}`);
  }

  console.log('\nSe borra:');
  let total = 0;
  for (const model of WIPE) {
    const n = await client[model].count();
    total += n;
    console.log(`${String(n).padStart(6)}  ${model}`);
  }
  console.log(`${String(total).padStart(6)}  TOTAL`);

  if (!confirmed) {
    console.log('\nEsto es una simulación. Para ejecutarlo de verdad:');
    console.log('  npm run db:clean -- --yes');
    return;
  }

  // Primero los archivos: si se borran las filas antes, se pierden las URLs.
  const files = [
    ...(await prisma.deviceImage.findMany({ select: { url: true } })),
    ...(await prisma.document.findMany({ select: { url: true } })),
  ];
  let removed = 0;
  for (const { url } of files) {
    await deleteByUrl(url);
    removed++;
  }
  if (files.length) console.log(`\n${removed} archivo(s) eliminados del almacenamiento`);

  console.log('');
  for (const model of WIPE) {
    const { count } = await client[model].deleteMany();
    console.log(`${String(count).padStart(6)}  ${model} borrados`);
  }

  const users = await prisma.user.count();
  const categories = await prisma.category.count();
  const locations = await prisma.location.count();
  console.log(
    `\nListo. Se conservaron ${users} usuario(s), ${categories} categoría(s) y ${locations} ubicación(es).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
