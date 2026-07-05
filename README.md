# Job Queue Engine

A reliable job queue with dead-letter recovery, built **from scratch** on Node.js +
Express + Redis — no BullMQ, no Bee-Queue, no queue libraries. Project 2 of a
"Backend Mastery" series. The goal is to learn distributed-systems fundamentals by
building the engine myself: durable queuing, distributed locking, fault tolerance,
retries with backoff, idempotency, and observability.

## Status

Early / in progress. Being built phase by phase.

## What it will do

- **Durable queue** — jobs live in Redis and survive a server crash.
- **Priorities + scheduling** — run important jobs first, and delay jobs to the future.
- **Retries with exponential backoff**, capped at a max attempt count.
- **Dead-letter queue (DLQ)** — poison jobs are quarantined, inspectable, and replayable.
- **Visibility timeout** — a job is never processed by two workers at once, even if a
  worker dies mid-job.
- **Observability** — inspect queue depth, in-flight jobs, and DLQ contents.
- **Idempotency** — re-running a partially completed job never double-applies effects.

## Tech

Node.js, Express, Redis (via `ioredis`), Jest + supertest.

## Getting started

```bash
npm install
cp .env.example .env      # adjust PORT / REDIS_URL if needed
npm run dev               # start the API (GET /health checks Redis)
```

Requires a running Redis (e.g. `docker run -p 6379:6379 redis`).
