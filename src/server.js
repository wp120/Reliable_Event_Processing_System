require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");
const { connectRedis } = require("./utils/redisClient");

const PORT = process.env.PORT || 3000;

// Connect to MongoDB and Redis before starting the server
Promise.all([connectDB(), connectRedis()])
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
