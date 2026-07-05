// Load .env into process.env. We do it HERE (not only in server.js) so that any
// entry point which imports this file — the web server OR a standalone worker
// process — gets the config loaded before we build the client.
require('dotenv').config();

const Redis = require('ioredis');

// One connection string for the whole app. Falls back to localhost if unset.
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Create the ONE long-lived client. Every module that needs Redis imports this
// same instance, so the whole process shares a single connection (pool of 1).
const redis = new Redis(REDIS_URL, {
  // If a command is sent while disconnected, keep it queued and send it once
  // reconnected, instead of throwing immediately. Sensible default for a queue.
  maxRetriesPerRequest: null,
});

// These listeners make connection state visible in the logs. Without the 'error'
// listener, ioredis would throw the error as an *unhandled* event and could crash
// the process — so having it is not optional, it is a safety net.
redis.on('connect', () => console.log('[redis] connected to', REDIS_URL));
redis.on('error', (err) => console.error('[redis] error:', err.message));

module.exports = redis;
