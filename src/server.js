require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");
const { client: redisClient, connectRedis } = require("./utils/redisClient");
const { startConsumer } = require("./consumer/eventConsumer");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 1 Connect MongoDB
    await connectDB();

    // 2 Connect Redis
    await connectRedis();

    // 3 Start consumer AFTER MongoDB is ready
    startConsumer(redisClient); // pass the connected client

    // 4 Start Express server
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
