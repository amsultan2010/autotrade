/**
 * Zero-install local Postgres for development.
 *
 * Uses `embedded-postgres` to download a portable Postgres binary and run a
 * real server on localhost:5432 with user/pass postgres/postgres and a
 * persistent data dir (./.pgdata). No admin rights, no account, no Docker.
 *
 * Run:  pnpm --filter @autotrade/backend dev:db   (keep it running)
 * Then in another terminal: prisma migrate / db:seed / dev.
 *
 * NOT for production — use a managed Postgres there.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const here = dirname(fileURLToPath(import.meta.url));
const databaseDir = join(here, '..', '.pgdata');

async function main(): Promise<void> {
  const firstRun = !existsSync(databaseDir);
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port: 5432,
    persistent: true,
  });

  if (firstRun) {
    // eslint-disable-next-line no-console
    console.log('Initialising Postgres data directory…');
    await pg.initialise();
  }

  await pg.start();
  // eslint-disable-next-line no-console
  console.log('🟢 Postgres running on localhost:5432 (user/pass: postgres/postgres)');

  try {
    await pg.createDatabase('autotrade');
    // eslint-disable-next-line no-console
    console.log("✅ Created database 'autotrade'");
  } catch {
    // eslint-disable-next-line no-console
    console.log("ℹ️  Database 'autotrade' already exists");
  }

  // eslint-disable-next-line no-console
  console.log('Leave this process running. Press Ctrl+C to stop the database.');

  const stop = async () => {
    // eslint-disable-next-line no-console
    console.log('\nStopping Postgres…');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  // Keep the process alive.
  await new Promise(() => {});
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('dev-db failed:', err);
  process.exit(1);
});
