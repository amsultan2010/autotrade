/**
 * Embedded Postgres lifecycle for the packaged desktop app. Starts a real
 * Postgres from the bundled binaries with a persistent data dir, so the backend
 * is a single self-sufficient process (no separate DB to run). Dev uses the
 * standalone `dev:db` script instead.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

let pg: EmbeddedPostgres | null = null;

export async function startEmbeddedPostgres(): Promise<void> {
  // src/lib → apps/backend/.pgdata (same dir the dev:db script uses).
  const here = dirname(fileURLToPath(import.meta.url));
  const databaseDir = join(here, '..', '..', '.pgdata');
  const firstRun = !existsSync(databaseDir);

  pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port: 5432,
    persistent: true,
  });

  try {
    if (firstRun) await pg.initialise();
    await pg.start();
    try {
      await pg.createDatabase('alphabot');
    } catch {
      /* already exists */
    }
    // eslint-disable-next-line no-console
    console.log('🟢 Embedded Postgres started on localhost:5432');
  } catch (err) {
    // If a Postgres is already running on 5432 (e.g. dev:db), reuse it.
    // eslint-disable-next-line no-console
    console.warn('Embedded Postgres start skipped (a server may already be running):', (err as Error).message);
  }
}

export async function stopEmbeddedPostgres(): Promise<void> {
  if (pg) {
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    pg = null;
  }
}
