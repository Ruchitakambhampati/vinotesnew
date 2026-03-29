const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
    userId: String,
    text: String,
    keystrokes: [mongoose.Schema.Types.Mixed],
    pasteDetected: Boolean,
    avgDelay: Number,
    typingVariance: Number,
    pauseCount: Number,
    pauseRate: Number,
    consistencyScore: Number,
    authenticityScore: Number,
    confidenceLevel: String,
    scoreExplanation: [String],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Session", sessionSchema);
