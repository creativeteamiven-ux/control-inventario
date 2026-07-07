/**
 * Migración de datos: PostgreSQL (Neon, ORIGEN) -> MySQL/TiDB (DESTINO)
 *
 * Requisitos en server/.env:
 *   SOURCE_DATABASE_URL="postgresql://...neon..."   (base actual de Postgres)
 *   DATABASE_URL="mysql://...tidbcloud.com:4000/...?sslaccept=strict"  (TiDB destino)
 *
 * Pasos previos:
 *   1) npx prisma generate --schema=prisma/source.prisma   (cliente de origen)
 *   2) npx prisma generate                                  (cliente destino MySQL)
 *   3) npx prisma db push                                   (crea el esquema en TiDB)
 *
 * Ejecutar:
 *   npm run migrate:data
 *
 * Es idempotente: usa skipDuplicates / preserva los IDs originales, así que se puede
 * re-ejecutar sin duplicar registros.
 */
import { PrismaClient as TargetClient } from '@prisma/client';
import { PrismaClient as SourceClient } from '../prisma/generated/source';

const source = new SourceClient();
const target = new TargetClient();

async function step(name: string, fn: () => Promise<number>): Promise<void> {
  try {
    const n = await fn();
    console.log(`  ✔ ${name}: ${n} registro(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    console.warn(`  ⚠ ${name}: omitido (${msg})`);
  }
}

async function main() {
  console.log('== Migración de datos Postgres -> TiDB ==\n');

  await step('Users', async () => {
    const rows = await source.user.findMany();
    if (!rows.length) return 0;
    const r = await target.user.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  // Category tiene auto-relación (parentId). Se inserta en 2 pasadas para respetar la FK.
  await step('Categories', async () => {
    const rows = await source.category.findMany();
    if (!rows.length) return 0;
    await target.category.createMany({
      data: rows.map((c) => ({ ...c, parentId: null })) as any,
      skipDuplicates: true,
    });
    for (const c of rows.filter((x) => x.parentId)) {
      await target.category.update({ where: { id: c.id }, data: { parentId: c.parentId } });
    }
    return rows.length;
  });

  await step('Tags', async () => {
    const rows = await source.tag.findMany();
    if (!rows.length) return 0;
    const r = await target.tag.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  await step('Locations', async () => {
    const rows = await source.location.findMany();
    if (!rows.length) return 0;
    const r = await target.location.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  // Device tiene relación M2M con Tag: se crea uno por uno para conservar las etiquetas.
  await step('Devices', async () => {
    const rows = await source.device.findMany({ include: { tags: { select: { id: true } } } });
    let created = 0;
    for (const d of rows) {
      const { tags, ...scalars } = d as any;
      try {
        await target.device.create({
          data: {
            ...scalars,
            tags: tags?.length ? { connect: tags.map((t: { id: string }) => ({ id: t.id })) } : undefined,
          },
        });
        created++;
      } catch (e) {
        // Ya existe (re-ejecución): lo ignoramos.
        if (e instanceof Error && e.message.includes('Unique constraint')) continue;
        throw e;
      }
    }
    return created;
  });

  await step('DeviceImages', async () => {
    const rows = await source.deviceImage.findMany();
    if (!rows.length) return 0;
    const r = await target.deviceImage.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  await step('Documents', async () => {
    const rows = await source.document.findMany();
    if (!rows.length) return 0;
    const r = await target.document.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  await step('Movements', async () => {
    const rows = await source.movement.findMany();
    if (!rows.length) return 0;
    const r = await target.movement.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  await step('Maintenances', async () => {
    const rows = await source.maintenance.findMany();
    if (!rows.length) return 0;
    const r = await target.maintenance.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  await step('LoanRecords', async () => {
    const rows = await source.loanRecord.findMany();
    if (!rows.length) return 0;
    const r = await target.loanRecord.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  // Expense/Budget no existen en la base de origen (módulo financiero hecho en local):
  // se crean vacíos en TiDB al hacer db push y se llenarán desde la app.

  await step('AuditLogs', async () => {
    const rows = await source.auditLog.findMany();
    if (!rows.length) return 0;
    const r = await target.auditLog.createMany({ data: rows as any, skipDuplicates: true });
    return r.count;
  });

  console.log('\n== Migración finalizada ==');
}

main()
  .catch((e) => {
    console.error('\nError fatal en la migración:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
