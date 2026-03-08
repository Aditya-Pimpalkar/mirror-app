"use client";
// src/components/confrontation/Confrontation.js

import { useState } from "react";
import { useMirrorStore } from "../../store";
import { runConfrontation } from "../../lib/api";
import { BeliefBar, PersonaAvatar, LoadingDots, PERSONAS } from "../ui";

export default function Confrontation() {
  const { beliefs, updateBeliefs, setLastConfrontation, setScreen, profile } = useMirrorStore();
  const [statement, setStatement] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState("input"); // input | loading | results

  const submit = async () => {
    if (!statement.trim() || loading) return;
    setLoading(true);
    setStep("loading");

    try {
      const res = await runConfrontation({ statement: statement.trim(), currentBeliefs: beliefs });
      setResult(res);
      updateBeliefs(res.beliefUpdates);
      setLastConfrontation(res);
      setStep("results");
    } catch (err) {
      console.error("[Confrontation]", err);
      setStep("input");
      setLoading(false);
    }
  };

  if (step === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", textAlign: "center" }}>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 24 }}>CONFRONTATION MODE</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text)", margin: "0 0 16px", fontStyle: "italic" }}>
          All four are reacting.
        </h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 14, margin: "0 0 36px", lineHeight: 1.6 }}>
          "{statement.slice(0, 80)}{statement.length > 80 ? "..." : ""}"
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          {Object.values(PERSONAS).map((p, i) => (
            <div key={p.id} style={{ textAlign: "center", animation: `pulse 1.5s ${i * 0.2}s infinite` }}>
              <PersonaAvatar persona={p} size={48} pulse />
              <div className="label" style={{ color: p.color, marginTop: 6, fontSize: 9 }}>{p.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "results" && result) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
        <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 12 }}>CONFRONTATION MODE</div>
        <div style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 14, margin: "0 0 28px", lineHeight: 1.6, padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid var(--border)" }}>
          You said: "{statement}"
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          {result.responses?.map((r) => {
            const persona = PERSONAS[r.personaId];
            if (!persona) return null;
            return (
              <div key={r.personaId} style={{ padding: "18px", background: persona.bg, border: `1px solid ${persona.border}`, borderRadius: 16, animation: "fadeUp 0.4s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <PersonaAvatar persona={persona} size={36} />
                  <div>
                    <div className="label" style={{ color: persona.color }}>{persona.name.toUpperCase()}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-body)" }}>{persona.role}</div>
                  </div>
                  {r.beliefDelta !== 0 && (
                    <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: r.beliefDelta > 0 ? "#7DC98F" : "#E87070" }}>
                      {r.beliefDelta > 0 ? "▲" : "▼"} {Math.abs(r.beliefDelta)}
                    </div>
                  )}
                </div>
                <p style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.82)", fontStyle: "italic", fontSize: 14, lineHeight: 1.65, margin: "0 0 12px" }}>
                  "{r.response}"
                </p>
                <BeliefBar value={r.newBelief} color={persona.color} />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => { setStatement(""); setResult(null); setStep("input"); setLoading(false); }}
            style={{ flex: 1, padding: "13px", background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 14, color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}
          >
            GO AGAIN →
          </button>
          <button
            onClick={() => setScreen("home")}
            style={{ flex: 1, padding: "13px", background: "none", border: "1px solid var(--border)", borderRadius: 14, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
      <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 32 }}>←</button>

      <div className="label" style={{ color: "var(--gold)", marginBottom: 12 }}>CONFRONTATION MODE</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.3 }}>
        One statement.<br /><em style={{ color: "var(--gold)" }}>All four react.</em>
      </h2>
      <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 14, margin: "0 0 32px", lineHeight: 1.7 }}>
        Say something you believe about yourself. Something you'd want to defend. All four personas will respond simultaneously.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 28 }}>
        {Object.values(PERSONAS).map((p) => (
          <div key={p.id} style={{ textAlign: "center" }}>
            <PersonaAvatar persona={p} size={44} />
            <div className="label" style={{ color: p.color, marginTop: 6, fontSize: 9 }}>{p.name}</div>
          </div>
        ))}
      </div>

      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder={`"I've built something genuinely important in my field."\n\n"People misunderstand my intentions."\n\n"I'm more self-aware than most people give me credit for."`}
        style={{ minHeight: 140, marginBottom: 16, lineHeight: 1.7, fontStyle: "italic" }}
        autoFocus
      />

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 16, textAlign: "right", letterSpacing: "0.05em" }}>
        {statement.length}/1000
      </div>

      <button
        onClick={submit}
        disabled={!statement.trim() || loading}
        style={{
          width: "100%", padding: "15px 24px",
          background: statement.trim() ? "var(--gold)" : "rgba(255,255,255,0.06)",
          color: statement.trim() ? "#070707" : "rgba(255,255,255,0.2)",
          border: "none", borderRadius: 100,
          fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.15em",
          transition: "all 0.2s",
        }}
      >
        FACE ALL FOUR →
      </button>
    </div>
  );
}
