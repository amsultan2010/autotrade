import "dotenv/config";
import http from "node:http";
import pLimit from "p-limit";
import {
  liveEngine,
  env,
  getUsersDueForScan,
  runCycleForUser,
  recordScanCompleted,
  tryAcquireScanLock,
  releaseScanLock,
} from "@autotrade/engine/public";
import { captureWorkerError, initWorkerSentry } from "./sentry.js";

const TICK_MS = Number(process.env.WORKER_TICK_MS ?? 2_000);
const CONCURRENCY = 25;
const limit = pLimit(CONCURRENCY);
const instanceId = process.env.WORKER_INSTANCE_ID ?? `worker-${process.pid}`;
const inFlight = new Set<string>();

initWorkerSentry();

async function schedulerTick(): Promise<void> {
  const due = await getUsersDueForScan();
  await Promise.all(
    due
      .filter((clerkId) => !inFlight.has(clerkId))
      .map((clerkId) =>
        limit(async () => {
          if (inFlight.has(clerkId)) return;
          const acquired = await tryAcquireScanLock(clerkId, instanceId);
          if (!acquired) return;
          inFlight.add(clerkId);
          try {
            await runCycleForUser(clerkId);
            await recordScanCompleted(clerkId, Date.now());
          } catch (err) {
            console.error(`scan failed for ${clerkId}`, err);
            captureWorkerError(err, { clerkId, phase: "scan_cycle" });
          } finally {
            inFlight.delete(clerkId);
            await releaseScanLock(clerkId, instanceId).catch(() => undefined);
          }
        }),
      ),
  );
}

function startScheduler(): void {
  setInterval(() => {
    void schedulerTick();
  }, TICK_MS);
  void schedulerTick();
}

function startHealthServer(): void {
  const port = Number(process.env.PORT ?? 8080);
  http
    .createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, instanceId, tickMs: TICK_MS }));
    })
    .listen(port, () => console.log(`Health on :${port}`));
}

async function main(): Promise<void> {
  console.log(`Autotrade worker ${instanceId} starting…`);
  startHealthServer();
  if (env.ALPACA_STREAMING) {
    try {
      await liveEngine.start();
      console.log("Live price stream started");
    } catch (err) {
      console.error("LiveEngine failed to start", err);
      captureWorkerError(err, { phase: "live_engine_start" });
    }
  }
  startScheduler();
  console.log(`Scheduler tick ${TICK_MS}ms, concurrency ${CONCURRENCY}`);
}

main().catch((err) => {
  console.error("Worker failed:", err);
  captureWorkerError(err, { phase: "worker_boot" });
  process.exit(1);
});
