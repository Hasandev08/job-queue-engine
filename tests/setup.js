// This runs BEFORE any application module is required in a test file. That timing is
// the whole trick: we set the env vars here first, and `dotenv` (called inside
// src/redis.js) does not overwrite vars that already exist — so these values win.

// Point every test at Redis DB 15, an isolated scratch database. Tests flush it
// between runs; your real dev data (DB 0) is never touched.
process.env.REDIS_URL = 'redis://127.0.0.1:6379/15';

// Make the worker's blocking pop return almost immediately when the queue is empty,
// so an "idle worker" test doesn't sit and wait the full production 5 seconds.
process.env.WORKER_BLOCK_SECONDS = '0.2';
