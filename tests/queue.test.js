// Integration tests for enqueue — these really talk to Redis (DB 15, see tests/setup.js).
const redis = require('../src/redis');
const { enqueue, KEYS } = require('../src/queue');
const { createJob, jobKey, deserialize } = require('../src/job');

// Start every test from a clean database so tests never leak state into each other.
beforeEach(async () => {
  await redis.flushdb();
});

// Close the connection when done, otherwise Jest complains about an open handle.
afterAll(async () => {
  await redis.quit();
});

describe('enqueue', () => {
  test('writes the body under job:<id> AND pushes the id onto the ready list', async () => {
    const job = createJob('send-email', { to: 'a@b.com' });
    await enqueue(job);

    // the body is stored, intact
    const stored = deserialize(await redis.get(jobKey(job.id)));
    expect(stored).toEqual(job);

    // the pointer (just the id) is on the ready list
    expect(await redis.llen(KEYS.READY)).toBe(1);
    expect(await redis.lrange(KEYS.READY, 0, -1)).toEqual([job.id]);
  });

  test('is atomic: a failed enqueue leaves neither body nor pointer', async () => {
    // Force EXEC to reject by handing enqueue a job that cannot serialize (a BigInt
    // makes JSON.stringify throw). If enqueue were not careful, we might half-write.
    const bad = createJob('x');
    bad.payload = { big: 10n }; // BigInt -> JSON.stringify throws

    await expect(enqueue(bad)).rejects.toBeDefined();

    // nothing landed
    expect(await redis.exists(jobKey(bad.id))).toBe(0);
    expect(await redis.llen(KEYS.READY)).toBe(0);
  });

  test('preserves FIFO order: first enqueued is first popped', async () => {
    const a = createJob('a');
    const b = createJob('b');
    await enqueue(a);
    await enqueue(b);

    // BRPOP pops from the right; a was pushed first, so it comes out first.
    const [, first] = await redis.brpop(KEYS.READY, 1);
    const [, second] = await redis.brpop(KEYS.READY, 1);
    expect(first).toBe(a.id);
    expect(second).toBe(b.id);
  });
});
