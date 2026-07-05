const express = require('express');
const redis = require('./redis'); // the shared client from redis.js

const app = express();

// Parse JSON request bodies. We don't need it yet, but every /jobs endpoint later
// will, so we set it up once here.
app.use(express.json());

// Health check: proves the whole stack is alive — HTTP is up AND Redis answers.
// A health check that doesn't actually talk to its dependency is lying to you, so
// we send a real PING rather than just returning ok:true blindly.
app.get('/health', async (req, res) => {
  try {
    const pong = await redis.ping(); // returns the string "PONG" when healthy
    res.json({ ok: true, redis: pong });
  } catch (err) {
    // If Redis is down, PING throws. We report 503 (Service Unavailable) so a
    // load balancer or monitor can tell we're not ready — not a 200 pretending
    // everything is fine.
    res.status(503).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
