"use client";
import { useRef, useState } from "react";
import { useMirrorStore } from "../store";
import { GapRing } from "./ui";

const ARCHETYPES = {
  vault:       { name: "The Vault",       icon: "🔒", desc: "Respected but unknowable. People admire you from a distance.", detail: "You project competence and reliability, but almost nothing personal comes through. Others trust you with work, rarely with themselves.", color: "#6BA3D6", gradient: "135deg, #0a1628 0%, #0e1e38 100%" },
  spark:       { name: "The Spark",       icon: "⚡", desc: "Electric in person, hard to pin down in absence.", detail: "People remember meeting you vividly and struggle to describe you accurately afterward. Your impact is felt in the moment.", color: "#F5C842", gradient: "135deg, #1a1500 0%, #252000 100%" },
  contractor:  { name: "The Contractor",  icon: "🔧", desc: "Trusted for execution, rarely considered for vision.", detail: "You deliver. Everyone knows it. But when vision conversations happen, your name comes up later — or not at all.", color: "#7DC98F", gradient: "135deg, #0a1a0e 0%, #0e2214 100%" },
  ghost:       { name: "The Ghost",       icon: "👻", desc: "Invisible publicly despite real private impact.", detail: "The people who know you well know your value precisely. Everyone else doesn't know you exist.", color: "#A89FD8", gradient: "135deg, #100e1e 0%, #161428 100%" },
  overexposed: { name: "The Overexposed", icon: "📡", desc: "Your brand is louder than your substance.", detail: "You're excellent at presence. But people close to your work notice the gap between what you claim and what you've built.", color: "#E87070", gradient: "135deg, #1e0a0a 0%, #280e0e 100%" },
  architect:   { name: "The Architect",   icon: "🏛️", desc: "You build things that outlast you.", detail: "Your contribution is structural and lasting. Others build on what you've created without always knowing your name.", color: "#D4A853", gradient: "135deg, #1a1000 0%, #241600 100%" },
};

export default function Archetype() {
  const { archetype, gapScore, setScreen, profile, beliefs } = useMirrorStore();
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const arch = archetype ? (ARCHETYPES[archetype.id] || archetype) : null;
  const archetypeData = arch ? { ...ARCHETYPES[arch.id || archetype?.id], ...arch } : null;
  const color = archetypeData?.color || "#D4A853";

  const saveCard = async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3, // High resolution for sharing
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `mirror-${archetypeData?.name?.replace(/\s+/g, "-").toLowerCase() || "archetype"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Save failed:", err);
      // Fallback — copy text
      const text = `My Mirror Archetype: ${archetypeData?.name}\n"${archetypeData?.desc}"\nGap Score: ${gapScore}\nmirror.app`;
      navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setSaving(false);
  };

  const shareCard = async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 3, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (navigator.share && blob) {
          await navigator.share({
            files: [new File([blob], "mirror-archetype.png", { type: "image/png" })],
            title: `My Mirror Archetype: ${archetypeData?.name}`,
            text: `"${archetypeData?.desc}" — Gap Score: ${gapScore}`,
          });
        } else {
          saveCard();
        }
      });
    } catch {
      saveCard();
    }
  };

  if (!archetypeData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", textAlign: "center" }}>
        <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 32, alignSelf: "flex-start" }}>←</button>
        <div style={{ fontSize: 48, marginBottom: 16, filter: "grayscale(1)" }}>🔮</div>
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

  // Average belief across all personas
  const avgBelief = Math.round(Object.values(beliefs).reduce((a, b) => a + b, 0) / Object.values(beliefs).length);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
      <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>
      
      <div className="label" style={{ color: "var(--gold)", marginBottom: 8 }}>REPUTATION ARCHETYPE</div>
      <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: "0 0 28px", lineHeight: 1.6 }}>
        Based on all four personas' collective assessment.
      </p>

      {/* THE SHAREABLE CARD */}
      <div ref={cardRef} style={{
        background: `linear-gradient(${archetypeData.gradient || "135deg, #0e0e0e, #141414"})`,
        borderRadius: 24,
        padding: "40px 32px 32px",
        marginBottom: 16,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${color}33`,
      }}>
        {/* Background decoration */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.4,
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${color}22 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -40, right: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Mirror wordmark */}
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.4em",
          color: `${color}88`, marginBottom: 24, textTransform: "uppercase",
        }}>
          🪞 MIRROR
        </div>

        {/* Icon */}
        <div style={{
          fontSize: 56, marginBottom: 20,
          filter: `drop-shadow(0 0 20px ${color}66)`,
        }}>
          {archetypeData.icon}
        </div>

        {/* Archetype name */}
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700,
          color, marginBottom: 12, fontStyle: "italic",
          textShadow: `0 0 40px ${color}44`,
        }}>
          {archetypeData.name}
        </div>

        {/* Divider */}
        <div style={{ width: 40, height: 1, background: `${color}44`, margin: "0 auto 16px" }} />

        {/* Description */}
        <div style={{
          fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.6)",
          fontSize: 14, lineHeight: 1.7, fontStyle: "italic",
          marginBottom: 28, maxWidth: 280, margin: "0 auto 28px",
        }}>
          "{archetypeData.desc}"
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 32, marginBottom: 28,
          padding: "16px 24px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>
              {gapScore}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginTop: 4 }}>
              GAP SCORE
            </div>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "rgba(255,255,255,0.6)", lineHeight: 1 }}>
              {avgBelief}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginTop: 4 }}>
              AVG BELIEF
            </div>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "rgba(255,255,255,0.6)", lineHeight: 1 }}>
              4
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginTop: 4 }}>
              VOICES
            </div>
          </div>
        </div>

        {/* User name */}
        {profile?.userName && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.2em", marginBottom: 8 }}>
            {profile.userName.toUpperCase()}
          </div>
        )}

        {/* Footer */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.25em" }}>
          MIRROR — SEE YOURSELF CLEARLY
        </div>
      </div>

      {/* Action buttons */}
      <button
        onClick={saveCard}
        disabled={saving}
        style={{
          width: "100%", padding: "15px",
          background: color, color: "#070707",
          border: "none", borderRadius: 100,
          fontFamily: "var(--font-mono)", fontWeight: 700,
          fontSize: 12, letterSpacing: "0.15em",
          marginBottom: 10, opacity: saving ? 0.6 : 1,
          boxShadow: `0 0 20px ${color}33`,
        }}
      >
        {saving ? "SAVING..." : copied ? "COPIED TO CLIPBOARD ✓" : "↓ SAVE AS IMAGE"}
      </button>

      <button
        onClick={shareCard}
        style={{
          width: "100%", padding: "13px",
          background: "none",
          border: `1px solid ${color}44`,
          borderRadius: 100,
          color, fontFamily: "var(--font-mono)",
          fontSize: 12, letterSpacing: "0.15em",
          marginBottom: 20,
        }}
      >
        ↗ SHARE
      </button>

      {/* Detail card */}
      <div style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 12 }}>
        <div className="label" style={{ marginBottom: 10 }}>WHAT THIS MEANS</div>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7, fontStyle: "italic", margin: 0 }}>
          {archetypeData.detail}
        </p>
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
