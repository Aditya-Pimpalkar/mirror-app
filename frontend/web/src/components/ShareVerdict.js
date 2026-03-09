"use client";
import { useRef, useState } from "react";
import { useMirrorStore } from "../store";

const PERSONAS = {
  recruiter: { name: "Rachel", role: "Senior Recruiter", emoji: "💼", color: "#D4A853", gradient: "135deg, #1a1000 0%, #241600 100%" },
  date:      { name: "Alex",   role: "First Date",       emoji: "🥂", color: "#E87070", gradient: "135deg, #1e0a0a 0%, #280e0e 100%" },
  competitor:{ name: "Chris",  role: "Direct Competitor", emoji: "⚔️", color: "#6BA3D6", gradient: "135deg, #0a1628 0%, #0e1e38 100%" },
  journalist:{ name: "Jordan", role: "Journalist",        emoji: "🗞️", color: "#7DC98F", gradient: "135deg, #0a1a0e 0%, #0e2214 100%" },
};

export default function ShareVerdict({ personaId, quote, onClose }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { profile } = useMirrorStore();

  const persona = PERSONAS[personaId];
  if (!persona) return null;

  // Trim quote to good sharing length
  const displayQuote = quote?.length > 300 ? quote.slice(0, 297) + "..." : quote;

  const saveCard = async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `mirror-verdict-${persona.name.toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // Fallback — copy text
      navigator.clipboard?.writeText(`"${quote}" — ${persona.name}, ${persona.role}\n\nMIRROR — See yourself clearly`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
            files: [new File([blob], "mirror-verdict.png", { type: "image/png" })],
            title: `${persona.name} says...`,
            text: `"${displayQuote}" — via Mirror`,
          });
        } else {
          saveCard();
        }
      });
    } catch { saveCard(); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px",
      backdropFilter: "blur(8px)",
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Card */}
        <div ref={cardRef} style={{
          background: `linear-gradient(${persona.gradient})`,
          borderRadius: 20,
          padding: "36px 28px 28px",
          border: `1px solid ${persona.color}33`,
          position: "relative",
          overflow: "hidden",
          marginBottom: 16,
        }}>
          {/* Glow */}
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${persona.color}18 0%, transparent 70%)`, pointerEvents: "none" }} />

          {/* Persona header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${persona.color}18`, border: `1px solid ${persona.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              {persona.emoji}
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: persona.color, letterSpacing: "0.15em" }}>{persona.name.toUpperCase()}</div>
              <div style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{persona.role}</div>
            </div>
            <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.3em" }}>MIRROR</div>
          </div>

          {/* Quote mark */}
          <div style={{ fontSize: 48, color: `${persona.color}33`, fontFamily: "Georgia", lineHeight: 0.5, marginBottom: 12 }}>"</div>

          {/* Quote */}
          <p style={{
            fontFamily: "var(--font-body)", fontStyle: "italic",
            color: "rgba(255,255,255,0.85)", 
            fontSize: displayQuote?.length > 200 ? 13 : 15, 
            lineHeight: 1.7,
            margin: "0 0 24px",
          }}>
            {displayQuote}
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: `${persona.color}22`, marginBottom: 16 }} />

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.3)", fontSize: 11, fontStyle: "italic" }}>
              {profile?.userName || "Mirror user"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.25em" }}>
              MIRROR — SEE YOURSELF CLEARLY
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button
            onClick={saveCard}
            disabled={saving}
            style={{ flex: 1, padding: "13px", background: persona.color, color: "#070707", border: "none", borderRadius: 100, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em" }}
          >
            {saved ? "SAVED ✓" : saving ? "SAVING..." : "↓ SAVE"}
          </button>
          <button
            onClick={shareCard}
            style={{ flex: 1, padding: "13px", background: "none", border: `1px solid ${persona.color}44`, borderRadius: 100, color: persona.color, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}
          >
            ↗ SHARE
          </button>
        </div>

        <button
          onClick={onClose}
          style={{ width: "100%", padding: "12px", background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}
