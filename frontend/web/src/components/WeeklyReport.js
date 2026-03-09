"use client";
import { useState, useEffect } from "react";
import { useMirrorStore } from "../store";
import { generateWeeklyReport } from "../lib/api";
import { GapRing, BeliefBar, PERSONAS } from "./ui";

export default function WeeklyReport() {
  const { setScreen, beliefs, gapScore, completedPersonas, profile } = useMirrorStore();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { doGenerate(); }, []);

  const doGenerate = async () => {
    setLoading(true);
    setGenerating(true);
    try {
      const data = await generateWeeklyReport();
      setReport(data);
    } catch (err) {
      console.error("[WeeklyReport]", err.message);
    }
    setLoading(false);
    setGenerating(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "40px 28px", textAlign: "center" }}>
      <div style={{ fontSize: 36 }}>📊</div>
      <div className="label" style={{ color: "var(--gold)" }}>GENERATING YOUR REPORT</div>
      <div style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13 }}>Synthesizing this week's conversations...</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", animation: `pulse 1.2s ${i*0.2}s infinite` }} />)}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
      <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>
      <div className="label" style={{ color: "var(--gold)", marginBottom: 8 }}>WEEKLY REPORT</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
        {profile?.userName?.split(" ")[0]}'s Reputation This Week
      </h2>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 28 }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </div>

      <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
        <div className="label" style={{ marginBottom: 16 }}>CURRENT GAP SCORE</div>
        <GapRing score={gapScore} size={120} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 16 }}>PERSONA BELIEFS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.values(PERSONAS).map(p => (
            <div key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: p.color }}>{p.emoji} {p.name.toUpperCase()}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>{beliefs[p.id] || 20}/100</span>
              </div>
              <BeliefBar value={beliefs[p.id] || 20} color={p.color} showLabels={false} />
            </div>
          ))}
        </div>
      </div>

      {report?.content && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label" style={{ marginBottom: 12 }}>THIS WEEK'S ANALYSIS</div>
          <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7, fontStyle: "italic", margin: 0 }}>
            {typeof report.content === "string" ? report.content : report.content?.summary || "No analysis available yet."}
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 12 }}>THIS WEEK</div>
        <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, color: "var(--gold)" }}>{completedPersonas.length}</div>
            <div className="label" style={{ fontSize: 9 }}>PERSONAS</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, color: "var(--gold)" }}>{gapScore}</div>
            <div className="label" style={{ fontSize: 9 }}>GAP SCORE</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, color: "var(--gold)" }}>
              {Math.round(Object.values(beliefs).reduce((a,b) => a+b, 0) / 4)}
            </div>
            <div className="label" style={{ fontSize: 9 }}>AVG BELIEF</div>
          </div>
        </div>
      </div>

      <button onClick={doGenerate} disabled={generating} style={{ width: "100%", padding: "13px", background: "none", border: "1px solid var(--border)", borderRadius: 14, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}>
        {generating ? "REGENERATING..." : "↻ REGENERATE"}
      </button>
    </div>
  );
}
