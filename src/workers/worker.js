// A worker is a SEPARATE process from the web server. It has its own Redis
// connection (this import creates one for this process). That matters because
// BRPOP is a *blocking* command — it ties up its connection while waiting — so a
// worker wants a connection it can block on without freezing anything else.
const redis = require('../redis');
const { jobKey, deserialize, serialize, JOB_STATUS } = require('../job');
const { KEYS } = require('../queue');

// How many seconds BRPOP blocks waiting for a job before returning empty and looping.
// Configurable so tests can use a tiny value (e.g. 0.2s) instead of waiting 5s.
const BLOCK_SECONDS = Number(process.env.WORKER_BLOCK_SECONDS) || 5;

// Placeholder "processor". Real per-type handlers come in a later phase; for now we
// just prove the job travelled producer -> Redis -> worker with its data intact.
async function handle(job) {
  console.log(`[worker] processing job ${job.id} (type=${job.type})`, job.payload);
}

// Do exactly one pull-and-process cycle.
async function processOnce() {
  // BRPOP = Blocking Right POP. It waits up to `timeout` seconds for an id to appear,
  // sleeping instead of busy-polling. Returns [listKey, value], or null on timeout.
  const popped = await redis.brpop(KEYS.READY, BLOCK_SECONDS);
  if (!popped) return; // nothing arrived in the window; caller will loop again
  const [, id] = popped; // we only care about the value (the job id)

  const job = deserialize(await redis.get(jobKey(id)));
  if (!job) {
    // A pointer with no body. Our atomic enqueue makes this basically impossible,
    // but a defensive worker never trusts that blindly.
    console.warn(`[worker] no body found for job ${id}; dropping pointer`);
    return;
  }

  await handle(job);

  // Mark it done. (Phase 3 will add the in-flight/lease machinery; Phase 5 the DLQ.
  // For now, "processed" just means we flip the status.)
  job.status = JOB_STATUS.COMPLETED;
  job.updatedAt = Date.now();
  await redis.set(jobKey(job.id), serialize(job));
  console.log(`[worker] completed job ${job.id}`);
}

// The engine's heartbeat: pull, process, repeat — forever.
async function main() {
  console.log('[worker] started, waiting for jobs...');
  while (true) {
    try {
      await processOnce();
    } catch (err) {
      // One bad job must not kill the worker. Log, pause briefly so a persistent
      // failure doesn't spin the CPU at 100%, then keep going.
      console.error('[worker] loop error:', err.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// Run the forever-loop only when launched directly (`node src/workers/worker.js`).
// Tests import processOnce() and drive a single cycle instead of an endless loop.
if (require.main === module) {
  main();
}

module.exports = { processOnce, handle };
