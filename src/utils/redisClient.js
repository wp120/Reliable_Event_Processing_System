const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const client = createClient({
  url: redisUrl,
});

client.on("error", (err) => {
  console.error("Redis Client Error", err);
});

const connectRedis = async () => {
  try {
    if (!redisUrl) {
      throw new Error("REDIS_URL is not defined in environment variables");
    }

    await client.connect();
    console.log("Redis Connected");

    // Handle connection events
    client.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    return client;
  } catch (error) {
    console.error("Error connecting to Redis:", error.message);
    throw error;
  }
};

module.exports = {
  client,
  connectRedis,
};
