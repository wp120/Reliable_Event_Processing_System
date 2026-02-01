# Reliable Event Processing System

A backend event processing pipeline demonstrating idempotency, retries with exponential backoff, and dead-letter handling. Built with Node.js, Redis Streams, and MongoDB.

## Architecture

```
HTTP POST /api/events  →  Redis Streams  →  Consumer  →  EventProjection (MongoDB)
                              ↓                    ↓
                         Consumer Group      ProcessedEvent (idempotency)
                              ↓                    ↓
                         Pending (retry)     RetryEvent / DeadLetterEvent
```

**Flow**: Events are published to a Redis Stream. A consumer group reads messages, checks idempotency, performs the side effect (projection), and ACKs on success. On failure, the message remains pending; RetryEvent tracks backoff; after max retries, the message is moved to DeadLetterEvent and ACKed.

---

## Concurrency Handling

- **Redis consumer groups**: Messages are delivered to exactly one consumer in the group. No duplicate delivery across consumers.
- **Idempotency before side effect**: `ProcessedEvent.findOne({ idempotencyKey })` runs before any projection. The unique index on `idempotencyKey` ensures that even if two consumers race on the same logical event (e.g., duplicate HTTP retries), only one can insert into ProcessedEvent. The second will see the record and skip + ACK.
- **Ordering**: Redis Streams preserves order per stream. Processing order matches publication order for the same stream.

---

## Idempotency Guarantees

- **Key**: `idempotencyKey = reserve:${bookingId}` — derived from the business identifier.
- **Check-then-act**: Consumer checks `ProcessedEvent` by idempotency key before creating `EventProjection`. If found, ACK and skip.
- **Atomicity**: MongoDB unique index on `idempotencyKey` makes the "check + insert" effectively atomic under concurrent writes. Duplicate inserts fail; the consumer handles that by treating "already exists" as success and ACKing.
- **Exactly-once semantics for side effects**: A given idempotency key results in at most one EventProjection row. Duplicate deliveries (network retries, consumer restarts, redelivery) are deduplicated.

---

## Retry Logic with Exponential Backoff

- **No ACK on failure**: Failed messages stay in the consumer group’s pending entries list (PEL).
- **Dual read**: Consumer reads both new messages (`id: ">"`) and pending messages (`id: "0"`) each cycle.
- **Backoff**: `delayMs = min(2^retryCount * 1000, 30_000)` ms. Retry count: 1 → 2s, 2 → 4s, 3 → 8s, 4 → 16s, 5 → 30s (cap).
- **nextRetryAt**: Stored in RetryEvent. Messages with `nextRetryAt > now` are skipped. Prevents tight retry loops and spreads load.
- **Max retries**: 5. After the 5th failure, the message is moved to the DLQ and ACKed.

---

## Dead-Letter Queue Behavior

- **Trigger**: `retryCount >= MAX_RETRIES` (5).
- **Actions**: Insert into `DeadLetterEvent` (payload, sourceEventId, eventType), update `RetryEvent` status to `DEAD`, ACK the Redis message.
- **Effect**: Message is removed from the stream and no longer retried. Full payload is preserved for manual inspection or replay.
- **Guarantee**: No silent loss — every failed message is either retried or stored in the DLQ.

---

## Delivery Semantics

- **At-least-once delivery**: Redis Streams + consumer groups guarantee delivery. Un-ACKed messages are redelivered.
- **Exactly-once processing**: Idempotency key + ProcessedEvent ensures each logical event is applied at most once.
- **Failure handling**: Transient failures trigger retries with backoff; permanent failures land in the DLQ after max retries.

---

## Graceful Shutdown

- **Signals**: SIGINT and SIGTERM.
- **Sequence**: (1) Set shutdown flag, (2) `server.close()` to stop accepting HTTP, (3) wait for consumer to finish current message (up to 10s), (4) Redis `quit()`, (5) MongoDB `connection.close()`, (6) `process.exit(0)`.
- **Consumer**: Checks shutdown flag each loop; exits after processing the current batch. In-flight messages are not ACKed and will be redelivered after restart.

---

## Prerequisites

- Node.js 18+
- Redis 5+ (Streams support)
- MongoDB

## Setup

```bash
npm install
cp .env.example .env  # set MONGODB_URI, REDIS_URL, PORT
npm start
```

## API

| Method | Endpoint    | Body                                    |
| ------ | ----------- | --------------------------------------- |
| POST   | /api/events | `{ bookingId, eventId, userId, seats }` |
| GET    | /health     | —                                       |

---

## Testing & Validation

### concurrency.test.js

**What it does**: Sends 12+ events concurrently via `Promise.all`, including intentional duplicates (same `bookingId`).

**What it proves**:

- Idempotency under concurrent requests: duplicate `bookingId`s yield exactly one EventProjection and one ProcessedEvent.
- The unique index on `idempotencyKey` and the check-before-process logic prevent duplicate side effects under load.

**Guarantee**: No double processing for the same business key under concurrent HTTP retries or duplicates.

### deadLetter.test.js

**What it does**: Sends an event with `forcedFail: true`, causing the consumer to throw on every attempt.

**What it proves**:

- Retry count increments per failure.
- Exponential backoff is applied (observe delays between retries).
- After 5 failures, the message is moved to DeadLetterEvent and ACKed.
- Retries stop after the message reaches the DLQ.

**Guarantee**: Failed messages are retried with backoff and eventually preserved in the DLQ rather than lost.

---

## Project Structure

```
src/
├── server.js           # Bootstrap, graceful shutdown
├── app.js              # Express, routes, error middleware
├── config/database.js  # MongoDB connection
├── controllers/        # HTTP handlers
├── producer/           # Redis Streams publish
├── consumer/           # Stream consumer, retry, DLQ
├── models/             # ProcessedEvent, EventProjection, RetryEvent, DeadLetterEvent
├── middleware/         # Error handling
├── routes/
├── utils/              # Redis client
└── events/             # Event type constants
```
