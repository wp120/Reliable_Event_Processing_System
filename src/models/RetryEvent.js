const mongoose = require("mongoose");

const retryEventSchema = new mongoose.Schema({
  streamMessageId: {
    type: String,
    required: true,
    unique: true
  },
  idempotencyKey: {
    type: String,
    required: true
  },
  retryCount: {
    type: Number,
    required: true,
    default: 0
  },
  lastError: {
    type: String,
    required: true
  },
  nextRetryAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ["RETRYING", "DEAD"]
  }
}, {
  timestamps: true
});

retryEventSchema.index({ streamMessageId: 1 });

const RetryEvent = mongoose.model("RetryEvent", retryEventSchema);

module.exports = RetryEvent;
