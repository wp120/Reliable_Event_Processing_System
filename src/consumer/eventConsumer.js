const {
    STREAM,
    GROUP,
    CONSUMER,
    MAX_RETRIES,
} = require("./constants");

const ProcessedEvent = require("../models/ProcessedEvent");
const EventProjection = require("../models/EventProjection");
const RetryEvent = require("../models/RetryEvent");
const DeadLetterEvent = require("../models/DeadLetterEvent");

/**
 * Creates the consumer group if it doesn't exist.
 * @param {RedisClientType} redis - connected Redis client
 */
async function createGroupIfNotExists(redis) {
    try {
        await redis.xGroupCreate(STREAM, GROUP, "0", { MKSTREAM: true });
        console.log(`Consumer group ${GROUP} created`);
    } catch (err) {
        if (err.message.includes("BUSYGROUP")) {
            console.log(`Consumer group ${GROUP} already exists`);
        } else {
            throw err;
        }
    }
}

/**
 * Exponential backoff delay in ms. Cap at 30s.
 */
function getBackoffMs(retryCount) {
    return Math.min(2 ** retryCount * 1000, 30_000);
}

/**
 * Starts the Redis stream consumer.
 * @param {RedisClientType} redis - connected Redis client
 * @param {{ requested: boolean }} shutdownState - shared flag; when .requested is true, consumer exits after current message
 */
async function startConsumer(redis, shutdownState = { requested: false }) {
    await createGroupIfNotExists(redis);

    console.log("Consumer started, waiting for messages...");

    while (!shutdownState.requested) {
        try {
            // 1 Read new messages (blocking) and pending messages (non-blocking)
            const [newResponse, pendingResponse] = await Promise.all([
                redis.xReadGroup(GROUP, CONSUMER, [{ key: STREAM, id: ">" }], { COUNT: 10, BLOCK: 5000 }),
                redis.xReadGroup(GROUP, CONSUMER, [{ key: STREAM, id: "0" }], { COUNT: 10 }),
            ]);

            const allMessages = [];
            if (newResponse && newResponse[0]) allMessages.push(...newResponse[0].messages);
            if (pendingResponse && pendingResponse[0]) allMessages.push(...pendingResponse[0].messages);

            if (allMessages.length === 0) continue;

            const now = new Date();

            for (const msg of allMessages) {
                if (shutdownState.requested) break;

                const { id, message } = msg;
                const { eventType, idempotencyKey, payload } = message;

                // 2 Respect nextRetryAt - skip if not ready to retry
                const retryDoc = await RetryEvent.findOne({ streamMessageId: id });
                if (retryDoc && retryDoc.nextRetryAt > now) {
                    continue; // don't process yet, don't ACK
                }

                const parsedPayload = JSON.parse(payload);
                const { forcedFail } = parsedPayload;

                try {
                    // 3 Idempotency check
                    const alreadyProcessed = await ProcessedEvent.findOne({ idempotencyKey });
                    if (alreadyProcessed) {
                        console.log(`Skipping already processed event: ${idempotencyKey}`);
                        await redis.xAck(STREAM, GROUP, id);
                        await RetryEvent.deleteOne({ streamMessageId: id });
                        continue;
                    }

                    if (forcedFail === true) {
                        throw new Error("Forced failure for retry testing");
                    }
                    //Only for testing purposes.

                    // 4 Perform side effect (projection)
                    await EventProjection.create({
                        eventType,
                        sourceEventId: id,
                        payload: parsedPayload,
                        createdAt: new Date(),
                    });

                    // 5 Mark processed
                    await ProcessedEvent.create({
                        streamMessageId: id,
                        idempotencyKey,
                        eventType,
                        status: "PROCESSED",
                        processedAt: new Date(),
                    });

                    await redis.xAck(STREAM, GROUP, id);
                    await RetryEvent.deleteOne({ streamMessageId: id });
                    console.log(`Processed and ACKed event: ${idempotencyKey}`);

                } catch (err) {
                    console.error("Error processing message:", err);

                    const existingRetry = await RetryEvent.findOne({ streamMessageId: id });
                    const retryCount = existingRetry ? existingRetry.retryCount + 1 : 1;

                    if (retryCount >= MAX_RETRIES) {
                        // Move to DLQ and ACK (stop retrying)
                        await DeadLetterEvent.create({
                            eventType,
                            sourceEventId: id,
                            payload: parsedPayload,
                            createdAt: now,
                        });
                        await RetryEvent.findOneAndUpdate(
                            { streamMessageId: id },
                            {
                                streamMessageId: id,
                                idempotencyKey,
                                retryCount,
                                lastError: err.message,
                                nextRetryAt: now,
                                status: "DEAD",
                            },
                            { upsert: true }
                        );
                        await redis.xAck(STREAM, GROUP, id);
                        console.log(`Moved to DLQ after ${retryCount} failures: ${idempotencyKey}`);
                    } else {
                        // Schedule retry with exponential backoff
                        const delayMs = getBackoffMs(retryCount);
                        const nextRetryAt = new Date(now.getTime() + delayMs);

                        await RetryEvent.findOneAndUpdate(
                            { streamMessageId: id },
                            {
                                streamMessageId: id,
                                idempotencyKey,
                                retryCount,
                                lastError: err.message,
                                nextRetryAt,
                                status: "RETRYING",
                            },
                            { upsert: true }
                        );
                        // No ACK → message stays pending for retry
                        console.log(`Retry ${retryCount}/${MAX_RETRIES} scheduled for ${nextRetryAt.toISOString}: ${idempotencyKey}`);
                    }
                }
            }
        } catch (err) {
            console.error("Consumer read error:", err);
            if (shutdownState.requested) break;
            await new Promise((res) => setTimeout(res, 1000));
        }
    }
    console.log("Consumer stopped");
}

module.exports = { startConsumer };
