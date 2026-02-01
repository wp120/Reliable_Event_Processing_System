const mongoose = require("mongoose");

const processedEventSchema = new mongoose.Schema({
  streamMessageId: {
    type: String,
    required: true,
    unique: true
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true
  },
  eventType: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ["PROCESSED", "FAILED"]
  },
  processedAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

// streamMessageId = Redis stream message ID (e.g. "1234-0"); distinct from payload eventId

const ProcessedEvent = mongoose.model("ProcessedEvent", processedEventSchema);

module.exports = ProcessedEvent;
