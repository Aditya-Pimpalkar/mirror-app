"use client";
// src/components/Archetype.js

import { useRef } from "react";
import { useMirrorStore } from "../store";
import { GapRing } from "./ui";

const ARCHETYPES = {
  vault:       { name: "The Vault",       icon: "🔒", desc: "Respected but unknowable. People admire you from a distance — and stay there.", detail: "You project competence and reliability, but almost nothing personal comes through. Others trust you with work, rarely with themselves." },
  spark:       { name: "The Spark",       icon: "⚡", desc: "Electric in person, hard to pin down in absence. You leave impressions but not anchors.", detail: "People remember meeting you vividly and struggle to describe you accurately afterward. Your impact is felt in the moment." },
  contractor:  { name: "The Contractor",  icon: "🔧", desc: "Trusted for execution, rarely considered for vision. Your reliability is your ceiling.", detail: "You deliver. Everyone knows it. But when vision conversations happen, your name comes up later — or not at all." },
  ghost:       { name: "The Ghost",       icon: "👻", desc: "Invisible publicly despite real private impact. The world doesn't know what it's missing.", detail: "The people who know you well know your value precisely. Everyone else doesn't know you exist." },
  overexposed: { name: "The Overexposed", icon: "📡", desc: "Your brand is louder than your substance. The signal is starting to outpace the work.", detail: "You're excellent at presence. But people close to your work notice the gap between what you claim and what you've built." },
  architect:   { name: "The Architect",   icon: "🏛️", desc: "You build things that outlast you. People reference your work more than your name.", detail: "Your contribution is structural and lasting. Others build on what you've created without always knowing your name." },
};

export default function Archetype() {
  const { archetype, gapScore, setScreen, profile } = useMirrorStore();
  const cardRef = useRef(null);

  const arch = archetype ? (ARCHETYPES[archetype.id] || archetype) : null;

  const shareCard = async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#070707", scale: 2 });
      const link = document.createElement("a");
      link.download = `mirror-archetype-${arch?.name?.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch {
      // Fallback — copy text
      navigator.clipboard?.writeText(`My Mirror Archetype: ${arch?.name} — "${arch?.desc}" | Gap Score: ${gapScore} | mirror.app`);
    }
  };

  if (!arch) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", textAlign: "center" }}>
        <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 32, alignSelf: "flex-start" }}>←</button>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔮</div>
        <div className="label" style={{ color: "var(--text-dim)", marginBottom: 12 }}>ARCHETYPE LOCKED</div>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 14, lineHeight: 1.7 }}>
          Complete all 4 conversations to unlock your Reputation Archetype.
        </p>
        <button onClick={() => setScreen("home")} style={{ marginTop: 24, padding: "12px 28px", background: "var(--gold)", color: "#070707", border: "none", borderRadius: 100, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, letterSpacing: "0.15em" }}>
          GO TALK TO THEM →
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
      <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>
      <div className="label" style={{ color: "var(--gold)", marginBottom: 8 }}>REPUTATION ARCHETYPE</div>
      <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: "0 0 28px", lineHeight: 1.6 }}>
        Based on all four personas' collective assessment of {profile?.userName?.split(" ")[0] || "you"}.
      </p>

      {/* Shareable card */}
      <div ref={cardRef} style={{
        background: "linear-gradient(135deg, #0e0e0e 0%, #141414 100%)",
        border: "1px solid rgba(212,168,83,0.25)",
        borderRadius: 20,
        padding: "36px 28px",
        marginBottom: 20,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ambient glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ fontSize: 52, marginBottom: 16 }}>{arch.icon}</div>
        <div className="label" style={{ color: "var(--text-dim)", marginBottom: 12, letterSpacing: "0.3em" }}>MIRROR</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 12, fontStyle: "italic" }}>
          {arch.name}
        </div>
        <div style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.7, fontStyle: "italic", marginBottom: 24, maxWidth: 280, margin: "0 auto 24px" }}>
          "{arch.desc}"
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 8 }}>
          <GapRing score={gapScore} size={80} />
        </div>

        <div className="label" style={{ color: "var(--text-dim)", fontSize: 9, marginTop: 16, letterSpacing: "0.3em" }}>
          MIRROR — SEE YOURSELF CLEARLY
        </div>
      </div>

      {/* Share button */}
      <button
        onClick={shareCard}
        style={{ width: "100%", padding: "14px", background: "var(--gold)", color: "#070707", border: "none", borderRadius: 100, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.15em", marginBottom: 12 }}
      >
        ↓ SAVE AS IMAGE
      </button>

      {/* Detail */}
      <div style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 12 }}>
        <div className="label" style={{ marginBottom: 10 }}>WHAT THIS MEANS</div>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7, fontStyle: "italic", margin: 0 }}>{arch.detail}</p>
      </div>

      <button
        onClick={() => setScreen("map")}
        style={{ width: "100%", padding: "13px", background: "none", border: "1px solid var(--border)", borderRadius: 14, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}
      >
        VIEW FULL PERCEPTION MAP →
      </button>
    </div>
  );
}
