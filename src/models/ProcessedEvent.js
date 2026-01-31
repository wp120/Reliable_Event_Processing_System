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

// Ensure unique indexes
processedEventSchema.index({ eventId: 1 }, { unique: true });
processedEventSchema.index({ idempotencyKey: 1 }, { unique: true });

const ProcessedEvent = mongoose.model("ProcessedEvent", processedEventSchema);

module.exports = ProcessedEvent;
