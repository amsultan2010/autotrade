import "dotenv/config";
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
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
const HEALTH_SECRET = process.env.WORKER_HEALTH_SECRET?.trim() || "";

initWorkerSentry();

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function isHealthAuthorized(req: http.IncomingMessage): boolean {
  if (!HEALTH_SECRET) return false;
  const header = req.headers["x-health-secret"];
  const value = Array.isArray(header) ? header[0] : header;
  return !!value && safeEqual(value, HEALTH_SECRET);
}

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
  // Default 0.0.0.0 so cloud platforms can health-check; lock down with WORKER_HEALTH_SECRET.
  const bindHost = process.env.WORKER_HEALTH_BIND ?? "0.0.0.0";
  http
    .createServer((req, res) => {
      if (HEALTH_SECRET) {
        if (!isHealthAuthorized(req)) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, instanceId, tickMs: TICK_MS }));
        return;
      }
      // No secret: minimal response only (no instance recon data).
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    })
    .listen(port, bindHost, () => console.log(`Health on ${bindHost}:${port}`));
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
