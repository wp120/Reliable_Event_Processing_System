const mongoose = require("mongoose");

const processedEventSchema = new mongoose.Schema({
  eventId: {
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

// Unique indexes are automatically created by the unique: true in schema fields above
// No need to explicitly create them again

const ProcessedEvent = mongoose.model("ProcessedEvent", processedEventSchema);

module.exports = ProcessedEvent;
