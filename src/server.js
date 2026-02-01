require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");
const { client: redisClient, connectRedis } = require("./utils/redisClient");
const { startConsumer } = require("./consumer/eventConsumer");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 3000;
const shutdownState = { requested: false };
const CONSUMER_SHUTDOWN_WAIT_MS = 10000;

async function shutdown() {
  if (shutdownState.requested) return;
  shutdownState.requested = true;
  console.log("Shutdown requested, closing connections...");

  // 1 Stop accepting new HTTP requests
  if (server) server.close(() => console.log("HTTP server closed"));

  // 2 Wait for consumer to finish current message (BLOCK is 5s, allow up to 10s)
  await Promise.race([
    consumerStoppedPromise || Promise.resolve(),
    new Promise((r) => setTimeout(r, CONSUMER_SHUTDOWN_WAIT_MS)),
  ]);

  // 3 Close Redis
  try {
    await redisClient.quit();
    console.log("Redis connection closed");
  } catch (e) {
    /* ignore if not connected */
  }

  // 4 Close MongoDB
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  } catch (e) {
    /* ignore if not connected */
  }

  process.exit(0);
}

let server;
let consumerStoppedPromise;

async function startServer() {
  try {
    await connectDB();
    await connectRedis();

    consumerStoppedPromise = startConsumer(redisClient, shutdownState);

    server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
