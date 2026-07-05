// Pure unit tests for the job model. No Redis needed — createJob is a pure function.
const {
  createJob,
  serialize,
  deserialize,
  jobKey,
  JOB_STATUS,
} = require('../src/job');

describe('createJob', () => {
  test('sets sane defaults', () => {
    const before = Date.now();
    const j = createJob('send-email', { to: 'a@b.com' });

    expect(j.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/); // looks like a UUID
    expect(j.type).toBe('send-email');
    expect(j.payload).toEqual({ to: 'a@b.com' });
    expect(j.priority).toBe(0);
    expect(j.status).toBe(JOB_STATUS.READY);
    expect(j.attempts).toBe(0);
    expect(j.maxAttempts).toBe(3);
    expect(j.createdAt).toBeGreaterThanOrEqual(before);
    expect(j.updatedAt).toBe(j.createdAt); // equal at birth
  });

  test('opts override priority and maxAttempts', () => {
    const j = createJob('x', {}, { priority: 5, maxAttempts: 10 });
    expect(j.priority).toBe(5);
    expect(j.maxAttempts).toBe(10);
  });

  test('payload defaults to {} when omitted', () => {
    expect(createJob('x').payload).toEqual({});
  });

  test('generates a unique id each time', () => {
    expect(createJob('x').id).not.toBe(createJob('x').id);
  });
});

describe('serialize / deserialize', () => {
  test('round-trips a job unchanged, including nested payload', () => {
    const j = createJob('x', { a: 1, nested: { b: [1, 2, 3] } });
    expect(deserialize(serialize(j))).toEqual(j);
  });

  test('deserialize(null) returns null (missing key case)', () => {
    expect(deserialize(null)).toBeNull();
  });
});

describe('jobKey', () => {
  test('namespaces the id under job:', () => {
    expect(jobKey('abc')).toBe('job:abc');
  });
});
