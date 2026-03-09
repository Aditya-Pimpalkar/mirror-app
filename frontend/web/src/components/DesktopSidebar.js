"use client";
import { useMirrorStore } from "../store";
import { PERSONAS, GapRing } from "./ui";

export default function DesktopSidebar() {
  const { profile, beliefs, gapScore, completedPersonas, setScreen, screen, archetype } = useMirrorStore();

  const ARCHETYPES = {
    vault: { name: "The Vault", icon: "🔒" },
    spark: { name: "The Spark", icon: "⚡" },
    contractor: { name: "The Contractor", icon: "🔧" },
    ghost: { name: "The Ghost", icon: "👻" },
    overexposed: { name: "The Overexposed", icon: "📡" },
    architect: { name: "The Architect", icon: "🏛️" },
  };

  if (!profile) return null;

  const arch = archetype ? ARCHETYPES[archetype.id] : null;

  return (
    <div style={{
      position: "fixed",
      left: "calc(50% - 480px - 280px)",
      top: 0, bottom: 0,
      width: 260,
      padding: "48px 28px",
      display: "flex",
      flexDirection: "column",
      gap: 24,
      borderRight: "1px solid rgba(255,255,255,0.04)",
    }}>
      {/* Wordmark */}
      <div>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🪞</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.5em", color: "var(--gold)" }}>MIRROR</div>
        <div style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 12, fontStyle: "italic", marginTop: 4 }}>
          {profile.userName}
        </div>
      </div>

      {/* Gap Score */}
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: "var(--text-dim)", marginBottom: 12 }}>GAP SCORE</div>
        <GapRing score={gapScore} size={100} />
      </div>

      {/* Persona beliefs */}
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: "var(--text-dim)", marginBottom: 12 }}>BELIEFS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.values(PERSONAS).map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>{p.emoji}</span>
              <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${beliefs[p.id] || 20}%`, background: p.color, borderRadius: 2, transition: "width 1s ease" }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", width: 20, textAlign: "right" }}>{beliefs[p.id] || 20}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Archetype */}
      {arch && (
        <button
          onClick={() => setScreen("archetype")}
          style={{ textAlign: "left", background: "rgba(212,168,83,0.06)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 12, padding: "12px 14px" }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: "var(--text-dim)", marginBottom: 6 }}>ARCHETYPE</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{arch.icon}</span>
            <span style={{ fontFamily: "var(--font-display)", color: "var(--gold)", fontSize: 13, fontStyle: "italic" }}>{arch.name}</span>
          </div>
        </button>
      )}

      {/* Nav */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { label: "HOME", screen: "home", icon: "🏠" },
          { label: "PERCEPTION MAP", screen: "map", icon: "🗺️" },
          { label: "SCENARIO PREP", screen: "scenario", icon: "🎯" },
          { label: "TIMELINE", screen: "timeline", icon: "📅" },
        ].map(item => (
          <button
            key={item.screen}
            onClick={() => setScreen(item.screen)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 8, textAlign: "left",
              background: screen === item.screen ? "rgba(212,168,83,0.08)" : "none",
              border: screen === item.screen ? "1px solid rgba(212,168,83,0.2)" : "1px solid transparent",
              color: screen === item.screen ? "var(--gold)" : "var(--text-muted)",
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em",
            }}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
