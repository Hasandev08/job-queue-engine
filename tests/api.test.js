// HTTP-level tests. supertest drives the Express app in-process (no real port needed),
// which works because server.js exports `app` and only calls listen() when run directly.
const request = require('supertest');
const app = require('../src/server');
const redis = require('../src/redis');
const { KEYS } = require('../src/queue');
const { jobKey, deserialize } = require('../src/job');

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(async () => {
  await redis.quit();
});

describe('GET /health', () => {
  test('returns 200 and a real PONG from Redis', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, redis: 'PONG' });
  });
});

describe('POST /jobs', () => {
  test('rejects a job with no type (400)', async () => {
    const res = await request(app).post('/jobs').send({ payload: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/);
    // nothing was enqueued
    expect(await redis.llen(KEYS.READY)).toBe(0);
  });

  test('creates a job (201) and durably enqueues it in Redis', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({ type: 'send-email', payload: { to: 'a@b.com' } });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('ready');

    // it really landed: pointer on the list + body under its key
    expect(await redis.llen(KEYS.READY)).toBe(1);
    const body = deserialize(await redis.get(jobKey(res.body.id)));
    expect(body.type).toBe('send-email');
    expect(body.payload).toEqual({ to: 'a@b.com' });
  });

  test('honors priority and maxAttempts from the request body', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({ type: 'x', priority: 7, maxAttempts: 9 });

    const body = deserialize(await redis.get(jobKey(res.body.id)));
    expect(body.priority).toBe(7);
    expect(body.maxAttempts).toBe(9);
  });
});
