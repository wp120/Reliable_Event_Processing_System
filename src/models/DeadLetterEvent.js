const mongoose = require("mongoose");

const deadLetterEventSchema = new mongoose.Schema({
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
deadLetterEventSchema.index({ sourceEventId: 1 });

const DeadLetterEvent = mongoose.model("DeadLetterEvent", deadLetterEventSchema);

module.exports = DeadLetterEvent;
