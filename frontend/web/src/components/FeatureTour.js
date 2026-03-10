"use client";
import { useState } from "react";
import { useMirrorStore } from "../store";

const TOUR_PAGES = [

  {
    title: "How Conversations Work",
    subtitle: "Evidence moves the needle — not charm",
    icon: "🎙️",
    features: [
      { icon: "🎙️", label: "Voice or Text", desc: "Speak naturally or type. Real-time voice powered by Gemini Live." },
      { icon: "📊", label: "Belief Meter", desc: "Each persona's conviction shifts only when you give real evidence — dates, numbers, specifics." },
      { icon: "🧠", label: "They Remember", desc: "Every session builds on the last. They reference what you told them before." },
      { icon: "⚡", label: "Interruptions", desc: "Just talk over them. Natural conversation — no buttons needed." },
    ]
  },
  {
    title: "After You Talk",
    subtitle: "The intelligence layer",
    icon: "🗺️",
    features: [
      { icon: "📐", label: "Gap Score", desc: "Measures the distance between how you see yourself and how they see you." },
      { icon: "🗺️", label: "Perception Map", desc: "Cross-persona synthesis — consensus, blind spots, risks, verdicts." },
      { icon: "🔧", label: "Archetype Reveal", desc: "After all 4 conversations, discover your reputation archetype (6 types)." },
      { icon: "✉️", label: "The Honest Letter", desc: "All 4 personas write you a letter together. Unlocks after all conversations." },
    ]
  },
  {
    title: "Power Features",
    subtitle: "Go deeper when you're ready",
    icon: "⚡",
    features: [
      { icon: "⚡", label: "Confrontation Mode", desc: "Say one thing. All 4 respond at once. No filter." },
      { icon: "🎯", label: "Scenario Prep", desc: "Roleplay a FAANG interview, investor pitch, salary negotiation. Get scored." },
      { icon: "📤", label: "Share a Verdict", desc: "Tap any message to export it as a shareable image card." },
      { icon: "🔥", label: "Conviction Streaks", desc: "Track how many days in a row you've talked to each persona." },
    ]
  },
];

export default function FeatureTour() {
  const { setScreen } = useMirrorStore();
  const [page, setPage] = useState(0);
  const current = TOUR_PAGES[page];
  const isLast = page === TOUR_PAGES.length - 1;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "40px 24px 40px" }}>
      {/* Progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 32, justifyContent: "center" }}>
        {TOUR_PAGES.map((_, i) => (
          <div key={i} onClick={() => setPage(i)} style={{ width: i === page ? 24 : 6, height: 6, borderRadius: 3, background: i === page ? "var(--gold)" : i < page ? "rgba(212,168,83,0.4)" : "rgba(255,255,255,0.08)", transition: "all 0.3s", cursor: "pointer" }} />
        ))}
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{current.icon}</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          {current.title}
        </h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: 0 }}>
          {current.subtitle}
        </p>
      </div>

      {/* Features */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {current.features.map((f, i) => (
          <div key={i} style={{
            display: "flex", gap: 14, padding: "14px 16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            animation: `fadeUp 0.3s ${i * 0.06}s both`,
          }}>
            <div style={{ fontSize: 22, flexShrink: 0, width: 32, textAlign: "center" }}>{f.icon}</div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.1em", marginBottom: 4 }}>{f.label.toUpperCase()}</div>
              <div style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5, fontStyle: "italic" }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <button
        onClick={() => isLast ? setScreen("meet") : setPage(p => p + 1)}
        style={{ width: "100%", padding: "15px", background: "var(--gold)", color: "#070707", border: "none", borderRadius: 100, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.15em", marginBottom: 10, boxShadow: "0 0 20px rgba(212,168,83,0.2)" }}
      >
        {isLast ? "MEET YOUR VOICES →" : `NEXT: ${TOUR_PAGES[page + 1].title.toUpperCase()} →`}
      </button>
      <button
        onClick={() => setScreen("meet")}
        style={{ width: "100%", padding: "10px", background: "none", border: "none", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.1em" }}
      >
        SKIP TOUR
      </button>
    </div>
  );
}
