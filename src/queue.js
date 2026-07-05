const redis = require('./redis');
const { jobKey, serialize } = require('./job');

// All Redis key names live here so the naming scheme is in one place.
const KEYS = {
  READY: 'queue:ready', // a Redis LIST of job ids waiting to be processed
};

// Put a job into the queue durably.
//
// This is TWO writes: the body, then the pointer. We run them inside a MULTI/EXEC
// transaction so Redis applies them as ONE atomic unit — both land, or (if we die
// before EXEC) neither does. There is never a half-written state.
//
// We also order them body-first: even without the transaction, that ordering means
// the worst case is a harmless "orphan" (a saved job nothing points to), never the
// dangerous case (a pointer to a body that isn't there).
async function enqueue(job) {
  await redis
    .multi()
    .set(jobKey(job.id), serialize(job)) // 1) the body at job:<id>
    .lpush(KEYS.READY, job.id) //           2) the pointer onto the ready list
    .exec();
  return job.id;
}

module.exports = { KEYS, enqueue };
