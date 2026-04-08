# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # compile TypeScript → dist/
npm run typecheck      # type-check without emitting
npm run dev            # run API server with hot-reload (ts-node-dev)
npm run worker         # run worker process with hot-reload
npm run start          # run compiled API server
npm run start:worker   # run compiled worker
```

Copy `.env.example` → `.env` before running anything. A local RabbitMQ instance must be reachable at `RABBITMQ_URL`.

## Architecture

This is a **two-process system** — an API server and one or more worker processes — connected via RabbitMQ.

### Data flow

```
HTTP POST /job  →  Publisher  →  task_queue (RabbitMQ)  →  Consumer  →  Playwright
                                                                 ↓ (on final failure)
                                                           task_queue.dlq
```

### Process boundaries

- `src/index.ts` — API server entry (Phase 4, stub for now)
- `src/worker/index.ts` — Worker entry; starts the consumer and passes each message to the action handler engine

### Queue layer (`src/queue/`)

- **`connection.ts`** — `RabbitMQConnection` singleton wrapping `amqplib.ChannelModel`. Handles auto-reconnect on error/close. All other modules call `rabbitMQ.createChannel()` or `rabbitMQ.createConfirmChannel()` rather than holding their own connection.
- **`setup.ts`** — Idempotent queue/exchange declaration. Must be called before first publish or consume. Wires a dead-letter exchange (DLX) so that `nack(false, false)` routes exhausted messages to `task_queue.dlq`.
- **`publisher.ts`** — Opens a confirm channel per publish call, declares queues, sends the job, then closes the channel.
- **`consumer.ts`** — Sets `prefetch` from config, runs the retry loop (exponential back-off, up to `WORKER_MAX_RETRIES`), re-queues with `_retries` incremented in the payload, then `nack`s to DLQ after all retries are exhausted.

### Types (`src/types/index.ts`)

Single source of truth for the JSON schema. Key types:
- `Action` — discriminated union over all 14 action types
- `JobPayload` — the full message body (`job_id`, `options`, `actions[]`, `_retries`)
- `JobResult` / `StepResult` — output shape (used by the action engine in Phase 2+)

### Implementation roadmap

- **Phase 1 (done):** RabbitMQ connectivity, queue setup, retry/DLQ wiring
- **Phase 2:** Action handler engine — iterate `JobPayload.actions`, execute each via Playwright `BrowserContext`
- **Phase 3:** `exists` flow control, SSRF allowlist for `goto`
- **Phase 4:** REST API endpoint that calls `publisher.publish()`

### Constraints from spec

- `evaluate` (raw JS) must **never** be implemented — XSS/injection risk
- `goto` must validate URLs against a domain allowlist (SSRF protection)
- One `Browser` instance per worker process; one `BrowserContext` per job (closed after completion)

### Git
- don't forget to Commit and push after job is done.
