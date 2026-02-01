const {
    STREAM,
    GROUP,
    CONSUMER,
} = require("./constants");

const ProcessedEvent = require("../models/ProcessedEvent");
const EventProjection = require("../models/EventProjection");

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
 * Starts the Redis stream consumer.
 * @param {RedisClientType} redis - connected Redis client
 */
async function startConsumer(redis) {
    // 1 Create group
    await createGroupIfNotExists(redis);

    console.log("Consumer started, waiting for messages...");

    while (true) {
        try {
            const response = await redis.xReadGroup(
                GROUP,
                CONSUMER,
                [{ key: STREAM, id: ">" }],
                { COUNT: 1, BLOCK: 5000 }
            );

            if (!response) continue; // no new messages, loop again

            const messages = response[0].messages;

            for (const msg of messages) {
                const { id, message } = msg;
                const { eventType, idempotencyKey, payload } = message;

                const parsedPayload = JSON.parse(payload);

                try {
                    // 2 Idempotency check
                    const alreadyProcessed = await ProcessedEvent.findOne({ idempotencyKey });
                    if (alreadyProcessed) {
                        console.log(`Skipping already processed event: ${idempotencyKey}`);
                        await redis.xAck(STREAM, GROUP, id);
                        continue;
                    }

                    // 3 Perform side effect (projection)
                    await EventProjection.create({
                        eventType,
                        sourceEventId: id,
                        payload: parsedPayload,
                        createdAt: new Date(),
                    });

                    // 4 Mark processed
                    await ProcessedEvent.create({
                        eventId: id,
                        idempotencyKey,
                        eventType,
                        status: "PROCESSED",
                        processedAt: new Date(),
                    });

                    // 5 ACK only after success
                    await redis.xAck(STREAM, GROUP, id);
                    console.log(`Processed and ACKed event: ${idempotencyKey}`);

                } catch (err) {
                    console.error("Error processing message:", err);
                    // No ACK → Redis will retry
                }
            }
        } catch (err) {
            console.error("Consumer read error:", err);
            // wait before retrying to avoid tight loop on Redis errors
            await new Promise((res) => setTimeout(res, 1000));
        }
    }
}

module.exports = { startConsumer };
