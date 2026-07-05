// Integration tests for one worker cycle. We call processOnce() directly instead of
// starting the infinite loop (that's why worker.js exports it).
const redis = require('../src/redis');
const { enqueue, KEYS } = require('../src/queue');
const { processOnce } = require('../src/workers/worker');
const { createJob, jobKey, deserialize, JOB_STATUS } = require('../src/job');

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(async () => {
  await redis.quit();
});

describe('processOnce', () => {
  test('drains one job from the queue and marks it completed', async () => {
    const job = createJob('send-email', { to: 'a@b.com' });
    await enqueue(job);

    await processOnce();

    // the pointer was consumed
    expect(await redis.llen(KEYS.READY)).toBe(0);

    // the body now reflects completion
    const after = deserialize(await redis.get(jobKey(job.id)));
    expect(after.status).toBe(JOB_STATUS.COMPLETED);
    expect(after.updatedAt).toBeGreaterThanOrEqual(job.updatedAt);
  });

  test('processes only ONE job per call (FIFO), leaving the rest queued', async () => {
    const a = createJob('a');
    const b = createJob('b');
    await enqueue(a);
    await enqueue(b);

    await processOnce();

    // a (enqueued first) is done; b is still waiting
    expect(deserialize(await redis.get(jobKey(a.id))).status).toBe(JOB_STATUS.COMPLETED);
    expect(await redis.llen(KEYS.READY)).toBe(1);
    expect(await redis.lrange(KEYS.READY, 0, -1)).toEqual([b.id]);
  });

  test('returns quietly when the queue is empty (BRPOP times out)', async () => {
    // WORKER_BLOCK_SECONDS is 0.2 in tests, so this returns fast instead of waiting 5s.
    await expect(processOnce()).resolves.toBeUndefined();
  });
});
