const crypto = require('crypto');

// The lifecycle states a job moves through. Using constants (not raw strings
// sprinkled around the code) means a typo like 'inflight' becomes a crash at
// import time, not a silent bug where a job is stuck forever.
const JOB_STATUS = {
  READY: 'ready',       // sitting in the ready queue, waiting for a worker
  DELAYED: 'delayed',   // scheduled to become ready at a future time (Phase 2)
  ACTIVE: 'active',     // claimed by a worker, currently being processed (Phase 3)
  COMPLETED: 'completed',
  DEAD: 'dead',         // exhausted all retries, moved to the DLQ (Phase 5)
};

// The Redis key where a single job's body lives. Keeping this in one function
// means the "job:<id>" naming convention exists in exactly one place.
const jobKey = (id) => `job:${id}`;

// Factory: build a brand-new job object with sane defaults. We do NOT touch Redis
// here — this is a pure function that just returns data. Saving it is a separate
// step (part of "enqueue" in Phase 1), which keeps this easy to test.
function createJob(type, payload = {}, opts = {}) {
  const now = Date.now(); // milliseconds since epoch; easy to compare/sort later

  return {
    id: crypto.randomUUID(),        // globally unique, no Redis round trip (see D3)
    type,                            // which handler processes this job
    payload,                         // arbitrary data the handler needs
    priority: opts.priority ?? 0,    // higher = more important (used in Phase 2)
    status: JOB_STATUS.READY,        // every job is born ready (delayed comes later)
    attempts: 0,                     // how many times we've TRIED to run it
    maxAttempts: opts.maxAttempts ?? 3, // give up after this many (Phase 4)
    createdAt: now,
    updatedAt: now,
    // Fields we'll add in later phases, listed here so the shape is predictable:
    // runAt         -> when a delayed job becomes ready        (Phase 2)
    // leaseExpiresAt-> when an active job's claim expires       (Phase 3)
    // lastError     -> why the most recent attempt failed       (Phase 4/5)
    // idempotencyKey-> dedupe key for exactly-once side effects (Phase 7)
  };
}

// Redis stores strings, so we convert to/from JSON at the boundary. Centralizing
// this means if we ever change the storage format, only these two lines change.
const serialize = (job) => JSON.stringify(job);
const deserialize = (str) => (str ? JSON.parse(str) : null);

module.exports = { JOB_STATUS, jobKey, createJob, serialize, deserialize };
