const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Session = require("./models/Session");

mongoose
  .connect("mongodb://127.0.0.1:27017/vinotes")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

const app = express();

app.use(cors());
app.use(express.json());

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const sanitizeSignals = (signals = []) =>
  signals
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .filter((value) => value >= 35 && value <= 4000);

const RECENT_SIGNAL_WINDOW = 8;
const RECENT_EVENT_WINDOW = 12;

const buildConfidenceLevel = (sampleSize) => {
  if (sampleSize >= 6) return "High";
  if (sampleSize >= 4) return "Medium";
  return "Low";
};

const calculateMetrics = (recentSignals = [], historicalSignals = []) => {
  const recentEventWindow = Array.isArray(historicalSignals)
    ? historicalSignals.slice(-RECENT_EVENT_WINDOW)
    : [];
  const recentNumericHistory = sanitizeSignals(historicalSignals).slice(
    -RECENT_SIGNAL_WINDOW
  );
  const recentNumericSignals = sanitizeSignals(recentSignals);
  const numericData =
    recentNumericSignals.length > 0 ? recentNumericSignals : recentNumericHistory;
  const pasteDetected =
    recentSignals.includes("PASTE_EVENT") ||
    recentEventWindow.includes("PASTE_EVENT");

  if (numericData.length === 0) {
    return {
      pasteDetected,
      averageTypingDelay: 0,
      typingVariance: 0,
      pauseCount: 0,
      pauseRate: 0,
      consistencyScore: 0,
      authenticityScore: pasteDetected ? 35 : 0,
      confidenceLevel: "Low",
      scoreExplanation: [
        "Not enough typing samples yet to produce a reliable behavioral score."
      ],
      sampleSize: 0
    };
  }

  const averageTypingDelay =
    numericData.reduce((sum, value) => sum + value, 0) / numericData.length;

  const typingVariance =
    numericData.reduce(
      (sum, value) => sum + (value - averageTypingDelay) ** 2,
      0
    ) / numericData.length;

  const standardDeviation = Math.sqrt(typingVariance);
  const coefficientOfVariation =
    averageTypingDelay > 0 ? standardDeviation / averageTypingDelay : 0;

  const pauseThreshold = Math.max(900, averageTypingDelay * 2.4);
  const pauseCount = numericData.filter((value) => value >= pauseThreshold).length;
  const pauseRate = pauseCount / numericData.length;

  const consistencyScore = clamp(
    Math.round(100 - coefficientOfVariation * 85),
    0,
    100
  );

  const pastePenalty = pasteDetected ? 35 : 0;
  const lowVariancePenalty =
    coefficientOfVariation < 0.18
      ? Math.round((0.18 - coefficientOfVariation) * 180)
      : 0;
  const naturalPauseBonus =
    pauseRate >= 0.04 && pauseRate <= 0.22
      ? Math.round(10 + (1 - Math.abs(pauseRate - 0.12) / 0.1) * 8)
      : pauseRate > 0.22
        ? 3
        : 0;

  const authenticityScore = clamp(
    Math.round(72 - pastePenalty - lowVariancePenalty + naturalPauseBonus),
    0,
    100
  );

  const confidenceLevel = buildConfidenceLevel(numericData.length);
  const scoreExplanation = [];

  if (pasteDetected) {
    scoreExplanation.push("Recent paste activity lowered the authenticity score.");
  } else {
    scoreExplanation.push("No recent paste event was detected, which supports a higher score.");
  }

  if (lowVariancePenalty > 0) {
    scoreExplanation.push("Very low typing variance made the rhythm look more uniform than natural writing.");
  } else {
    scoreExplanation.push("Healthy typing variance suggests a more natural rhythm.");
  }

  if (naturalPauseBonus >= 10) {
    scoreExplanation.push("Natural pauses were detected and boosted the score.");
  } else if (pauseCount === 0) {
    scoreExplanation.push("No clear natural pauses were found, so the score did not receive a pause bonus.");
  } else {
    scoreExplanation.push("Some pauses were found, but the pattern was only a weak authenticity signal.");
  }

  if (numericData.length < 4) {
    scoreExplanation.push("Confidence is limited because the score is based on only a few timing samples.");
  } else if (numericData.length < 6) {
    scoreExplanation.push("Confidence is moderate because the system has a reasonable amount of timing data.");
  } else {
    scoreExplanation.push("Confidence is high because the recent typing window has enough timing data.");
  }

  return {
    pasteDetected,
    averageTypingDelay: Number(averageTypingDelay.toFixed(2)),
    typingVariance: Number(typingVariance.toFixed(2)),
    pauseCount,
    pauseRate: Number((pauseRate * 100).toFixed(2)),
    consistencyScore,
    authenticityScore,
    confidenceLevel,
    scoreExplanation,
    sampleSize: numericData.length
  };
};

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.post("/analyze", async (req, res) => {
  try {
    const { keystrokes, signalHistory, text, userId } = req.body;
    const recentSignals = Array.isArray(keystrokes) ? keystrokes : [];
    const historicalSignals = Array.isArray(signalHistory) ? signalHistory : recentSignals;
    const metrics = calculateMetrics(recentSignals, historicalSignals);

    const newSession = new Session({
      userId: userId || "guest",
      text,
      keystrokes: historicalSignals,
      pasteDetected: metrics.pasteDetected,
      avgDelay: metrics.averageTypingDelay,
      typingVariance: metrics.typingVariance,
      pauseCount: metrics.pauseCount,
      pauseRate: metrics.pauseRate,
      consistencyScore: metrics.consistencyScore,
      authenticityScore: metrics.authenticityScore,
      confidenceLevel: metrics.confidenceLevel,
      scoreExplanation: metrics.scoreExplanation
    });

    await newSession.save();

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: "Analysis failed" });
  }
});

app.get("/sessions/:userId", async (req, res) => {
  try {
    const sessions = await Session.find({
      userId: req.params.userId
    }).sort({ createdAt: -1 });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: "Could not load sessions" });
  }
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
