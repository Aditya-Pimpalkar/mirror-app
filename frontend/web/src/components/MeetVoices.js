"use client";
import { useState, useEffect } from "react";
import { useMirrorStore } from "../store";

const PERSONAS = [
  {
    id: "recruiter", name: "Rachel", emoji: "💼", color: "#D4A853", bg: "rgba(212,168,83,0.08)", border: "rgba(212,168,83,0.2)",
    role: "Senior Recruiter",
    intro: "I've already reviewed your background. I have questions.",
    agenda: "She's looking for gaps in your narrative, resume inconsistencies, and claims that don't hold up.",
  },
  {
    id: "date", name: "Alex", emoji: "🥂", color: "#E87070", bg: "rgba(232,112,112,0.08)", border: "rgba(232,112,112,0.2)",
    role: "First Date",
    intro: "I did some research before tonight. Hope that's okay.",
    agenda: "They're reading your social signals, emotional availability, and how you talk about others.",
  },
  {
    id: "competitor", name: "Chris", emoji: "⚔️", color: "#6BA3D6", bg: "rgba(107,163,214,0.08)", border: "rgba(107,163,214,0.2)",
    role: "Direct Competitor",
    intro: "I've been watching your trajectory. Interesting choices.",
    agenda: "They know your industry weaknesses and are measuring your threat level.",
  },
  {
    id: "journalist", name: "Jordan", emoji: "🗞️", color: "#7DC98F", bg: "rgba(125,201,143,0.08)", border: "rgba(125,201,143,0.2)",
    role: "Investigative Journalist",
    intro: "Thanks for agreeing to talk. I found some things worth discussing.",
    agenda: "They're after the story between your words — what you don't say matters as much as what you do.",
  },
];

export default function MeetVoices() {
  const { setScreen, profile } = useMirrorStore();
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, [current]);

  const persona = PERSONAS[current];
  const isLast = current === PERSONAS.length - 1;
  const firstName = profile?.userName?.split(" ")[0] || "you";

  const next = () => {
    setVisible(false);
    setTimeout(() => {
      if (isLast) {
        setScreen("home");
      } else {
        setCurrent(c => c + 1);
      }
    }, 200);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "48px 24px 48px" }}>
      {/* Progress dots */}
      <div style={{ display: "flex", gap: 6, marginBottom: 40, justifyContent: "center" }}>
        {PERSONAS.map((_, i) => (
          <div key={i} style={{ width: i === current ? 20 : 6, height: 6, borderRadius: 3, background: i === current ? persona.color : i < current ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)", transition: "all 0.3s" }} />
        ))}
      </div>

      {/* Card */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(16px)",
        transition: "all 0.3s ease",
      }}>
        <div className="label" style={{ marginBottom: 12, textAlign: "center" }}>MEET YOUR VOICES</div>

        {/* Persona avatar */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: persona.bg, border: `1px solid ${persona.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, margin: "0 auto 16px",
            boxShadow: `0 0 30px ${persona.color}22`,
          }}>
            {persona.emoji}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: persona.color, marginBottom: 4 }}>
            {persona.name}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.2em" }}>
            {persona.role.toUpperCase()}
          </div>
        </div>

        {/* Opening line */}
        <div style={{ padding: "20px 24px", background: persona.bg, border: `1px solid ${persona.border}`, borderRadius: 16, marginBottom: 20 }}>
          <div className="label" style={{ color: persona.color, marginBottom: 10, fontSize: 9 }}>THEIR OPENING LINE</div>
          <p style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.85)", fontStyle: "italic", fontSize: 15, lineHeight: 1.7, margin: 0 }}>
            "{persona.intro}"
          </p>
        </div>

        {/* Agenda */}
        <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 32 }}>
          <div className="label" style={{ marginBottom: 8, fontSize: 9 }}>WHAT THEY'RE REALLY AFTER</div>
          <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, fontStyle: "italic", margin: 0 }}>
            {persona.agenda}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div>
        <button
          onClick={next}
          style={{
            width: "100%", padding: "16px",
            background: persona.color, color: "#070707",
            border: "none", borderRadius: 100,
            fontFamily: "var(--font-mono)", fontWeight: 700,
            fontSize: 12, letterSpacing: "0.15em",
            marginBottom: 12,
            boxShadow: `0 0 20px ${persona.color}33`,
          }}
        >
          {isLast ? `LET'S BEGIN, ${firstName.toUpperCase()} →` : `NEXT: ${PERSONAS[current + 1].name.toUpperCase()} →`}
        </button>
        {!isLast && (
          <button onClick={() => setScreen("home")} style={{ width: "100%", padding: "10px", background: "none", border: "none", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
            SKIP INTRO
          </button>
        )}
      </div>
    </div>
  );
}
