"use client";
// src/components/Timeline.js

import { useState, useEffect } from "react";
import { useMirrorStore } from "../store";
import { getPersonaHistory } from "../lib/api";
import { BeliefBar, PersonaAvatar, PERSONAS } from "./ui";

export default function Timeline() {
  const { beliefs, completedPersonas, setScreen } = useMirrorStore();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const all = await Promise.allSettled(
        Object.keys(PERSONAS).map(async (id) => {
          const data = await getPersonaHistory(id, 5);
          return { id, history: data.history || [] };
        })
      );
      const flat = all
        .filter((r) => r.status === "fulfilled" && r.value.history.length > 0)
        .flatMap((r) => r.value.history.map((h) => ({ ...h, personaId: r.value.id })))
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      setEntries(flat);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
      <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>
      <div className="label" style={{ marginBottom: 8 }}>REPUTATION TIMELINE</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "0 0 32px", fontStyle: "italic" }}>
        Your reputation has a history.
      </h2>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontFamily: "var(--font-body)", fontStyle: "italic" }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontFamily: "var(--font-body)", fontStyle: "italic" }}>
          No conversations yet. Talk to your four voices first.
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)" }} />
          {entries.map((entry, i) => {
            const persona = PERSONAS[entry.personaId];
            if (!persona) return null;
            const date = new Date(entry.startedAt);
            return (
              <div key={i} style={{ display: "flex", gap: 20, marginBottom: 24, paddingLeft: 12 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: persona.bg, border: `1px solid ${persona.color}`, flexShrink: 0, marginTop: 4, zIndex: 1 }} />
                <div style={{ flex: 1, padding: "16px", background: persona.bg, border: `1px solid ${persona.border}`, borderRadius: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div className="label" style={{ color: persona.color }}>{persona.emoji} {persona.name.toUpperCase()}</div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div className="label" style={{ fontSize: 9 }}>{entry.messageCount} turns</div>
                      <div className="label" style={{ fontSize: 9 }}>{date.toLocaleDateString()}</div>
                    </div>
                  </div>
                  <BeliefBar value={entry.finalBelief || beliefs[entry.personaId] || 20} color={persona.color} showLabels={false} />
                  {entry.preview && (
                    <div style={{ marginTop: 10, fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.4)", fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>
                      "{entry.preview}..."
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trusted Circle teaser */}
      <div style={{ marginTop: 32, padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, textAlign: "center" }}>
        <div className="label" style={{ marginBottom: 10 }}>TRUSTED CIRCLE</div>
        <div style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", lineHeight: 1.6, marginBottom: 12 }}>
          Invite real people to answer 5 anonymous questions about you. Their answers update your personas in real time.
        </div>
        <div className="label" style={{ color: "rgba(212,168,83,0.4)" }}>COMING SOON</div>
      </div>
    </div>
  );
}
