import React, { useEffect, useRef, useState } from "react";
import "./App.css";
const API_BASE = process.env.REACT_APP_API_BASE;
function App() {
  const [text, setText] = useState("");
  const [keystrokes, setKeystrokes] = useState([]);
  const [signalHistory, setSignalHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [analysis, setAnalysis] = useState({
    pasteDetected: false,
    avgDelay: 0,
    typingVariance: 0,
    pauseCount: 0,
    pauseRate: 0,
    consistencyScore: 0,
    authenticityScore: 0,
    confidenceLevel: "Low",
    scoreExplanation: [],
    status: "Waiting..."
  });

  const lastTimeRef = useRef(null);
  const lastLengthRef = useRef(0);
  const textRef = useRef(text);
  const signalHistoryRef = useRef([]);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    signalHistoryRef.current = signalHistory;
  }, [signalHistory]);

  const formatStatus = (status) => {
    if (status === "Analyzed") {
      return "Synced with behavioral engine";
    }

    if (status.includes("Error")) {
      return "Connection issue";
    }

    return status;
  };

  const formatPreview = (value) => {
    if (!value) return "No text saved";

    return value.length > 140 ? `${value.slice(0, 140)}...` : value;
  };

  const scoreToneClass = (score) => {
    if (score >= 75) return "score-strong";
    if (score >= 50) return "score-medium";
    return "score-soft";
  };

  const handleKeyDown = () => {
    const currentTime = Date.now();
    if (lastTimeRef.current === null) {
      lastTimeRef.current = currentTime;
      return;
    }

    const delay = currentTime - lastTimeRef.current;

    if (delay >= 35 && delay <= 4000) {
      setKeystrokes((prev) => [...prev, delay]);
      setSignalHistory((prev) => [...prev, delay]);
    }

    lastTimeRef.current = currentTime;
  };

  const handleChange = (event) => {
    const value = event.target.value;
    const currentLength = value.length;

    if (currentLength - lastLengthRef.current > 20) {
      setKeystrokes((prev) => [...prev, "PASTE_EVENT"]);
      setSignalHistory((prev) => [...prev, "PASTE_EVENT"]);
    }

    lastLengthRef.current = currentLength;
    setText(value);

    if (currentLength === 0) {
      lastTimeRef.current = null;
      setKeystrokes([]);
      setSignalHistory([]);
      setAnalysis({
        pasteDetected: false,
        avgDelay: 0,
        typingVariance: 0,
        pauseCount: 0,
        pauseRate: 0,
        consistencyScore: 0,
        authenticityScore: 0,
        confidenceLevel: "Low",
        scoreExplanation: [],
        status: "Waiting..."
      });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (keystrokes.length === 0) return;

      fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keystrokes,
          signalHistory: signalHistoryRef.current,
          text: textRef.current,
          userId: "user123"
        })
      })
        .then((res) => res.json())
        .then((data) => {
          setAnalysis({
            pasteDetected: data.pasteDetected,
            avgDelay: data.averageTypingDelay || 0,
            typingVariance: data.typingVariance || 0,
            pauseCount: data.pauseCount || 0,
            pauseRate: data.pauseRate || 0,
            consistencyScore: data.consistencyScore || 0,
            authenticityScore: data.authenticityScore || 0,
            confidenceLevel: data.confidenceLevel || "Low",
            scoreExplanation: data.scoreExplanation || [],
            status:
              (data.sampleSize || 0) >= 2 ? "Analyzed" : "Collecting signals"
          });
        })
        .catch(() => {
          setAnalysis({
            pasteDetected: false,
            avgDelay: 0,
            typingVariance: 0,
            pauseCount: 0,
            pauseRate: 0,
            consistencyScore: 0,
            authenticityScore: 0,
            confidenceLevel: "Low",
            scoreExplanation: [],
            status: "Backend Error"
          });
        });

      setKeystrokes([]);
    }, 5000);

    return () => clearInterval(interval);
  }, [keystrokes]);

  const fetchSessions = () => {
    setSessionsLoading(true);
    setSessionsError("");

    fetch(`${API_BASE}/sessions/user123`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load sessions");
        }

        return res.json();
      })
      .then((data) => {
        setSessions(data);
      })
      .catch(() => {
        setSessions([]);
        setSessionsError("Could not load past sessions.");
      })
      .finally(() => {
        setSessionsLoading(false);
      });
  };

  return (
    <div className="container">
      <div className="card">
        <section className="editor-panel">
          <div className="hero">
            <h1 className="title">Vi-Notes Editor</h1>
          </div>

          <div className="composer">
            <div className="composer-header">
              <div className="composer-meta">
                <span>{text.length} characters</span>
                <span>{signalHistory.length} tracked signals</span>
              </div>
            </div>

            <textarea
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Start typing or paste content..."
            />
          </div>

          <div className="footer">Real-time behavioral analysis • Vi-Notes</div>
        </section>

        <aside className="insights-panel">
          <div className="output">
            <div className="panel-heading">
              <div>
                <p className="section-label">Analysis</p>
                <h3>Typing intelligence</h3>
              </div>
              <span className="status-pill">{formatStatus(analysis.status)}</span>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Current status</span>
                <strong>{analysis.status}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Avg typing delay</span>
                <strong>{analysis.avgDelay.toFixed(2)} ms</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Typing variance</span>
                <strong>{analysis.typingVariance.toFixed(2)}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Pause detection</span>
                <strong>
                  {analysis.pauseCount} pauses ({analysis.pauseRate.toFixed(2)}%)
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Consistency score</span>
                <strong>{analysis.consistencyScore}/100</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Confidence level</span>
                <strong>{analysis.confidenceLevel}</strong>
              </div>
              <div className={`stat-card score-card ${scoreToneClass(analysis.authenticityScore)}`}>
                <span className="stat-label">Authenticity score</span>
                <strong>{analysis.authenticityScore}/100</strong>
              </div>
            </div>

            {analysis.scoreExplanation.length > 0 ? (
              <div className="explanation-card">
                <span className="stat-label">Score explanation</span>
                <div className="explanation-list">
                  {analysis.scoreExplanation.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis.pasteDetected ? (
              <span className="badge warning">Paste detected</span>
            ) : (
              <span className="badge safe">Natural typing</span>
            )}

            <button onClick={fetchSessions}>View Past Sessions</button>

            {sessionsLoading ? (
              <p className="helper-text">Loading sessions...</p>
            ) : null}
            {sessionsError ? (
              <p className="helper-text error-text">{sessionsError}</p>
            ) : null}

            <div className="sessions">
              <div className="sessions-header">
                <h4>Past Sessions</h4>
                <span>{sessions.length} records</span>
              </div>

              {sessions.length > 0 ? (
                <div className="sessions-list">
                  {sessions.map((session) => (
                    <div className="session-card" key={session._id}>
                      <p className="session-time">
                        {new Date(session.createdAt).toLocaleString()}
                      </p>
                      <p>
                        <strong>Average Delay:</strong>{" "}
                        {Number(session.avgDelay || 0).toFixed(2)} ms
                      </p>
                      <p>
                        <strong>Paste Detection:</strong>{" "}
                        {session.pasteDetected ? "Yes" : "No"}
                      </p>
                      <p>
                        <strong>Authenticity Score:</strong>{" "}
                        {Number(session.authenticityScore || 0).toFixed(0)}/100
                      </p>
                      <p>
                        <strong>Typing Variance:</strong>{" "}
                        {Number(session.typingVariance || 0).toFixed(2)}
                      </p>
                      <p>
                        <strong>Pause Detection:</strong>{" "}
                        {Number(session.pauseCount || 0).toFixed(0)} pauses (
                        {Number(session.pauseRate || 0).toFixed(2)}%)
                      </p>
                      <p>
                        <strong>Consistency Score:</strong>{" "}
                        {Number(session.consistencyScore || 0).toFixed(0)}/100
                      </p>
                      <p>
                        <strong>Confidence Level:</strong>{" "}
                        {session.confidenceLevel || "Low"}
                      </p>
                      {Array.isArray(session.scoreExplanation) &&
                      session.scoreExplanation.length > 0 ? (
                        <div className="session-explanation">
                          {session.scoreExplanation.map((item) => (
                            <p key={`${session._id}-${item}`}>{item}</p>
                          ))}
                        </div>
                      ) : null}
                      <p>
                        <strong>Text Preview:</strong> {formatPreview(session.text)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="helper-text">
                  No sessions yet. Write for a few seconds, then load history.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
