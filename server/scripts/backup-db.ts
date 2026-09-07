/**
 * Vuelca todas las tablas a un JSON en backups/DB/.
 *
 * Pensado como red de seguridad antes de operaciones destructivas como
 * `npm run db:clean`. El archivo contiene datos reales, incluidos correos y
 * hashes de contraseñas, así que backups/ está fuera del control de versiones.
 *
 * Uso: npm run db:backup
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/** Tablas en orden de lectura; el nombre es el del modelo en Prisma. */
const MODELS = [
  'user',
  'webAuthnCredential',
  'category',
  'tag',
  'location',
  'alertRecipient',
  'device',
  'deviceImage',
  'document',
  'movement',
  'maintenance',
  'loanRecord',
  'expense',
  'budget',
  'event',
  'eventList',
  'eventItem',
  'eventScan',
  'auditLog',
] as const;

/** BigInt no es serializable en JSON y Decimal ya expone su propio toJSON. */
function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function main() {
  const client = prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>;
  const dump: Record<string, unknown[]> = {};

  for (const model of MODELS) {
    dump[model] = await client[model].findMany();
    console.log(`${String(dump[model].length).padStart(6)}  ${model}`);
  }

  const dir = path.resolve(process.cwd(), '..', 'backups', 'DB');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), data: dump }, replacer, 2));

  const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`\nCopia guardada en ${file} (${mb} MB)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
