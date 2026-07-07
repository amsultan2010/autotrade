import "dotenv/config";
import http from "node:http";
import pLimit from "p-limit";
import {
  liveEngine,
  env,
  getUsersDueForScan,
  runCycleForUser,
  recordScanCompleted,
} from "@autotrade/engine/public";

const TICK_MS = 250;
const CONCURRENCY = 25;
const limit = pLimit(CONCURRENCY);
const instanceId = process.env.WORKER_INSTANCE_ID ?? `worker-${process.pid}`;

async function schedulerTick(): Promise<void> {
  const due = await getUsersDueForScan();
  await Promise.all(
    due.map((clerkId) =>
      limit(async () => {
        try {
          await runCycleForUser(clerkId);
          await recordScanCompleted(clerkId, Date.now());
        } catch (err) {
          console.error(`scan failed for ${clerkId}`, err);
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
    await liveEngine.start();
    console.log("Live price stream started");
  }
  startScheduler();
  console.log(`Scheduler tick ${TICK_MS}ms, concurrency ${CONCURRENCY}`);
}

main().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
