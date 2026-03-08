"use client";
// src/components/map/PerceptionMap.js

import { useState, useEffect } from "react";
import { useMirrorStore } from "../../store";
import { generatePerceptionMap } from "../../lib/api";
import { BeliefBar, GapRing, PersonaAvatar, LoadingDots, PERSONAS } from "../ui";

export function PerceptionMap() {
  const { beliefs, perceptionMap, setPerceptionMap, gapScore, setScreen, profile } = useMirrorStore();
  const [loading, setLoading] = useState(!perceptionMap);

  useEffect(() => {
    if (perceptionMap) return;
    generatePerceptionMap()
      .then((map) => { setPerceptionMap(map); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "40px 28px", textAlign: "center" }}>
        <div className="label" style={{ color: "var(--gold)" }}>SYNTHESIZING</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--gold)", fontStyle: "italic" }}>
          Assembling your<br />perception map...
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {Object.values(PERSONAS).map((p, i) => (
            <div key={p.id} style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, animation: `pulse 1.5s ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  const map = perceptionMap;
  if (!map) return null;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
      <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>
      <div className="label" style={{ marginBottom: 8 }}>PERCEPTION MAP</div>
      <div className="label" style={{ color: "var(--text-dim)", marginBottom: 28 }}>{profile?.userName?.toUpperCase()}</div>

      {/* Verdict */}
      <div style={{ padding: "24px", background: "rgba(212,168,83,0.06)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 14, marginBottom: 16 }}>
        <div className="label-gold" style={{ marginBottom: 12 }}>VERDICT</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--gold)", fontStyle: "italic", lineHeight: 1.4 }}>
          "{map.headline}"
        </div>
      </div>

      {/* Persona verdicts 2x2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {Object.values(PERSONAS).map((p) => (
          <div key={p.id} style={{ padding: 16, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{p.emoji}</span>
              <span className="label" style={{ color: p.color, fontSize: 9 }}>{p.name.toUpperCase()}</span>
            </div>
            <BeliefBar value={beliefs[p.id] || 20} color={p.color} showLabels={false} />
            <div style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>
              {map.verdicts?.[p.id] || "No data."}
            </div>
          </div>
        ))}
      </div>

      {/* Synthesis cards */}
      {[
        { label: "CONSENSUS", content: map.consensus, color: "rgba(255,255,255,0.65)" },
        { label: "THE GAP", content: map.gap, color: "#E87070" },
        { label: "BLIND SPOT", content: map.blindspot, color: "#6BA3D6" },
      ].map(({ label, content, color }) => content && (
        <div key={label} style={{ padding: 18, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 8 }}>{label}</div>
          <div style={{ fontFamily: "var(--font-body)", color, fontSize: 14, lineHeight: 1.65, fontStyle: "italic" }}>{content}</div>
        </div>
      ))}

      {/* Strengths */}
      {map.strengths?.length > 0 && (
        <div style={{ padding: 18, background: "rgba(125,201,143,0.05)", border: "1px solid rgba(125,201,143,0.15)", borderRadius: 14, marginBottom: 12 }}>
          <div className="label" style={{ color: "rgba(125,201,143,0.6)", marginBottom: 12 }}>WHAT THEY ALL SEE IN YOU</div>
          {map.strengths.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ color: "#7DC98F", fontSize: 12 }}>+</span>
              <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {map.risks?.length > 0 && (
        <div style={{ padding: 18, background: "rgba(232,112,112,0.05)", border: "1px solid rgba(232,112,112,0.15)", borderRadius: 14, marginBottom: 16 }}>
          <div className="label" style={{ color: "rgba(232,112,112,0.6)", marginBottom: 12 }}>PERCEPTION RISKS</div>
          {map.risks.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ color: "#E87070", fontSize: 12 }}>△</span>
              <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Final question */}
      {map.question && (
        <div style={{ padding: 24, background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 16 }}>SIT WITH THIS</div>
          <div style={{ fontFamily: "var(--font-display)", color: "var(--text)", fontSize: 16, fontStyle: "italic", lineHeight: 1.6 }}>
            "{map.question}"
          </div>
        </div>
      )}
    </div>
  );
}

export default PerceptionMap;
