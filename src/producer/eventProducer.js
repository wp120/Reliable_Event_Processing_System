const { v4: uuidv4 } = require("uuid");
const { client: redis } = require("../utils/redisClient");
const EVENTS = require("../events/eventTypes");

const STREAM_NAME = "reps:events";

/**
 * Publishes a logical event to Redis Streams
 */
async function publishEvent({ eventType, payload, idempotencyKey }) {
    try {
        const event = {
            eventId: uuidv4(),
            eventType,
            idempotencyKey,
            payload: JSON.stringify(payload),
            occurredAt: new Date().toISOString(),
        };

        await redis.xAdd(
            STREAM_NAME,
            "*",
            event
        );

        return event.eventId;
    } catch (error) {
        console.error("Error publishing event to Redis:", error);
        throw new Error(`Failed to publish event: ${error.message}`);
    }
}

module.exports = {
    publishEvent,
};
