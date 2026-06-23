import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// ── Bot scan cycle ────────────────────────────────────────────────────────────
// Runs every 5 minutes for all active users.
// The engine itself skips stock evaluations when the market is closed.
// Crypto positions are always evaluated (24/7 market).
crons.interval('bot scan cycle', { minutes: 5 }, internal.bot.runAllUsers);

// ── Weekly performance digest ─────────────────────────────────────────────────
// Every Monday at 8am UTC — sends performance summary emails via Resend.
crons.cron('weekly digest', '0 8 * * 1', internal.bot.sendWeeklyDigests);

export default crons;
