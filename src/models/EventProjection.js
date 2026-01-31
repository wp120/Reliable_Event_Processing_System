const mongoose = require("mongoose");

const eventProjectionSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true
  },
  sourceEventId: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index on sourceEventId
eventProjectionSchema.index({ sourceEventId: 1 });

const EventProjection = mongoose.model("EventProjection", eventProjectionSchema);

module.exports = EventProjection;
