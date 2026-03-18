"use client";
// src/components/Home.js

import { useEffect, useState } from "react";
import { useMirrorStore } from "../store";
import { getGapScore, getMirrorMoment, getArchetype, getPersonaStatus } from "../lib/api";
import { BeliefBar, GapRing, PersonaAvatar, PERSONAS } from "./ui";

const ARCHETYPES = {
  vault:       { name: "The Vault",       icon: "🔒", desc: "Respected but unknowable. People admire you from a distance." },
  spark:       { name: "The Spark",       icon: "⚡", desc: "Electric in person, hard to pin down in absence." },
  contractor:  { name: "The Contractor",  icon: "🔧", desc: "Trusted for execution, rarely considered for vision." },
  ghost:       { name: "The Ghost",       icon: "👻", desc: "Invisible publicly despite real private impact." },
  overexposed: { name: "The Overexposed", icon: "📡", desc: "Your brand is louder than your substance." },
  architect:   { name: "The Architect",   icon: "🏛️", desc: "You build things that outlast you." },
};

export default function Home() {
  const {
    profile, beliefs, completedPersonas, gapScore,
    setGapScore, setMirrorMoment, mirrorMoment,
    setArchetype, archetype, setScreen, setActivePersona, updateBelief,
    streaks,
  } = useMirrorStore();

  const [loading, setLoading] = useState(true);
  const [serviceError, setServiceError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load gap score + beliefs
        const scoreData = await getGapScore();
        setGapScore(scoreData.gapScore);
        if (scoreData.beliefs) {
          Object.entries(scoreData.beliefs).forEach(([id, val]) => updateBelief(id, val));
        }

        // Load mirror moment
        const moment = await getMirrorMoment();
        if (moment.moment) setMirrorMoment(moment);

        // Load archetype if available
        const arch = await getArchetype();
        if (arch.archetype) setArchetype(arch.archetype);

        // Load per-persona belief from backend
        await Promise.allSettled(
          Object.keys(PERSONAS).map(async (id) => {
            const status = await getPersonaStatus(id);
            if (status.currentBelief !== undefined) updateBelief(id, status.currentBelief);
          })
        );
      } catch (err) {
        console.error("[Home] Load error:", err.message);
        setServiceError(true);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const openPersona = (personaId) => {
    setActivePersona(personaId);
    setScreen("chat");
  };

  const firstName = profile?.userName?.split(" ")[0] || "you";

  return (
    <div style={{ minHeight: "100vh", padding: "52px 24px 100px" }}>
      {serviceError && (
        <div style={{ padding: "10px 16px", background: "rgba(232,112,112,0.08)", border: "1px solid rgba(232,112,112,0.2)", borderRadius: 10, marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: 10, color: "#E87070", letterSpacing: "0.05em" }}>
          ⚠ Some services offline — start them locally to continue
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 8 }}>🪞 MIRROR</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
          Hello, {firstName}.
        </h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: 0 }}>
          {completedPersonas.length === 0
            ? "Your mirror is waiting."
            : `${completedPersonas.length} of 4 perspectives heard.`}
        </p>
        </div>
        <button onClick={() => setScreen("settings")} style={{ padding: "8px", background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, marginTop: 4 }}>⚙️</button>
      </div>

      {/* Gap Score */}
      <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
        <div className="label" style={{ marginBottom: 20 }}>YOUR GAP SCORE</div>
        {loading ? (
          <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 32, height: 32, border: "2px solid rgba(212,168,83,0.3)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <GapRing score={gapScore} />
        )}
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 12, marginTop: 14, lineHeight: 1.6, fontStyle: "italic" }}>
          {gapScore < 30 ? "Close alignment. Others see mostly what you intend."
            : gapScore < 60 ? "Notable gaps. The mirror has things to show you."
            : "Significant distance. Your perception and reality need a conversation."}
        </p>
        {completedPersonas.length >= 2 && (
          <button
            onClick={() => setScreen("map")}
            style={{
              marginTop: 12, padding: "8px 20px",
              background: "none", border: "1px solid rgba(212,168,83,0.3)",
              borderRadius: 100, color: "var(--gold)",
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em",
            }}
          >
            VIEW PERCEPTION MAP →
          </button>
        )}
      </div>

      {/* Mirror Moment */}
      {mirrorMoment?.moment && (
        <div className="card-gold" style={{ marginBottom: 16 }}>
          <div className="label-gold" style={{ marginBottom: 10 }}>MIRROR MOMENT</div>
          <p style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.65)", fontStyle: "italic", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            "{mirrorMoment.moment}"
          </p>
        </div>
      )}

      {/* Archetype */}
      {completedPersonas.length >= 4 && archetype ? (
        <div
          className="card"
          onClick={() => setScreen("archetype")}
          style={{
            marginBottom: 16, cursor: "pointer",
            background: "linear-gradient(135deg, rgba(212,168,83,0.08), rgba(107,163,214,0.08))",
            border: "1px solid rgba(212,168,83,0.2)",
          }}
        >
          <div className="label" style={{ marginBottom: 8 }}>YOUR ARCHETYPE</div>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{ARCHETYPES[archetype.id]?.icon || "🔮"}</div>
          <div style={{ fontFamily: "var(--font-display)", color: "var(--gold)", fontSize: 18, marginBottom: 6 }}>
            {ARCHETYPES[archetype.id]?.name || archetype.name}
          </div>
          <div style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", lineHeight: 1.6 }}>
            {ARCHETYPES[archetype.id]?.desc || archetype.desc}
          </div>
        </div>
      ) : completedPersonas.length < 4 ? (
        <div className="card" style={{ marginBottom: 16, textAlign: "center", opacity: 0.5 }}>
          <div className="label" style={{ marginBottom: 12 }}>ARCHETYPE REVEAL</div>
          <div style={{ fontSize: 28, filter: "grayscale(1)", marginBottom: 8 }}>🔮</div>
          <div style={{ fontFamily: "var(--font-body)", color: "var(--text-dim)", fontSize: 13, fontStyle: "italic" }}>
            Complete all 4 conversations to unlock your Reputation Archetype.
          </div>
        </div>
      ) : null}

      {/* The Four Voices */}
      <div className="label" style={{ marginBottom: 16 }}>THE FOUR VOICES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {Object.values(PERSONAS).map((persona) => {
          const done = completedPersonas.includes(persona.id);
          return (
            <button
              key={persona.id}
              onClick={() => openPersona(persona.id)}
              style={{
                padding: "18px",
                background: done ? persona.bg : "rgba(255,255,255,0.02)",
                border: `1px solid ${done ? persona.border : "var(--border)"}`,
                borderRadius: 16,
                textAlign: "left",
                width: "100%",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: done ? 12 : 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <PersonaAvatar persona={persona} size={44} />
                  <div>
                    <div className="label" style={{ color: persona.color, marginBottom: 2 }}>
                      {persona.name.toUpperCase()} · {persona.domain.toUpperCase()}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontFamily: "var(--font-body)" }}>
                      {persona.role}
                    </div>
                  </div>
                </div>
                <div>
                  {done
                    ? <span className="label" style={{ color: persona.color, background: persona.bg, padding: "3px 8px", borderRadius: 4, border: `1px solid ${persona.border}` }}>DONE</span>
                    : <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>TAP →</span>}
                </div>
              </div>
              {done ? (
                <BeliefBar value={beliefs[persona.id] || 20} color={persona.color} />
              ) : (
                <div style={{ fontFamily: "var(--font-body)", color: "var(--text-dim)", fontSize: 12, fontStyle: "italic" }}>
                  {persona.id === "recruiter" ? "She spotted your red flags in 90 seconds."
                    : persona.id === "date" ? "They formed an opinion before you said a word."
                    : persona.id === "competitor" ? "They know your weaknesses better than you do."
                    : "Not a hit piece. Just the questions no one dares to ask."}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Conviction Streaks */}
      <div className="card" style={{ marginBottom: 16, opacity: Object.values(streaks).some(s => s > 0) ? 1 : 0.85 }}>
        <div className="label" style={{ marginBottom: 14 }}>CONVICTION STREAKS</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {Object.values(PERSONAS).map((p) => {
              const streak = streaks[p.id] || 0;
              return (
                <div key={p.id} style={{ textAlign: "center", opacity: streak > 0 ? 1 : 0.3 }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{p.emoji}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: p.color, letterSpacing: "0.08em", marginBottom: 4 }}>{p.name.toUpperCase()}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: streak > 0 ? p.color : "var(--text-dim)", lineHeight: 1 }}>
                    {streak}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.1em", marginTop: 2 }}>
                    {streak === 1 ? "DAY" : "DAYS"}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, minHeight: 14 }}>
                    {streak >= 7 ? "🔥🔥" : streak >= 3 ? "🔥" : ""}
                  </div>
                </div>
              );
            })}
          </div>
          {Math.max(...Object.values(streaks)) >= 3 && (
            <div style={{ marginTop: 12, textAlign: "center", fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
              {Math.max(...Object.values(streaks)) >= 7 ? "🔥 On fire. The personas are noticing." : "Keep going. Consistency shifts belief."}
            </div>
          )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => setScreen("scenario")}
          style={{
            padding: "18px 20px", textAlign: "left",
            background: "linear-gradient(135deg, rgba(107,163,214,0.12), rgba(107,163,214,0.06))",
            border: "1px solid rgba(107,163,214,0.35)",
            borderRadius: 16, width: "100%",
            display: "flex", alignItems: "center", gap: 14,
          }}
        >
          <span style={{ fontSize: 28, flexShrink: 0 }}>🎯</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6BA3D6", letterSpacing: "0.15em", marginBottom: 4 }}>SCENARIO PREP</div>
            <div style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.5)", fontSize: 12, fontStyle: "italic" }}>Rehearse high-stakes moments before they happen</div>
          </div>
          <span style={{ marginLeft: "auto", color: "rgba(107,163,214,0.5)", fontSize: 18 }}>→</span>
        </button>
        {completedPersonas.length >= 4 && (
          <button
            onClick={() => setScreen("letter")}
            style={{ padding: "14px", background: "rgba(212,168,83,0.06)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 14, color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em" }}
          >
            ✉️ THE HONEST LETTER — ALL 4 VOICES WRITE TO YOU
          </button>
        )}
        {completedPersonas.length >= 2 && (
          <button
            onClick={() => setScreen("confrontation")}
            style={{
              padding: "14px", background: "rgba(212,168,83,0.06)",
              border: "1px solid rgba(212,168,83,0.2)", borderRadius: 14,
              color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 11,
              letterSpacing: "0.15em",
            }}
          >
            ⚡ CONFRONTATION MODE — ALL 4 AT ONCE
          </button>
        )}
        {completedPersonas.length >= 2 && (
          <button
            onClick={() => setScreen("report")}
            style={{ padding: "13px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em" }}
          >
            📊 WEEKLY REPUTATION REPORT
          </button>
        )}
        {completedPersonas.length > 0 && (
          <button
            onClick={() => setScreen("timeline")}
            style={{ padding: "13px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em" }}
          >
            VIEW REPUTATION TIMELINE →
          </button>
        )}

      </div>
    </div>
  );
}
