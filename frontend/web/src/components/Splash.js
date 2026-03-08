"use client";
// src/components/Splash.js

import { useEffect, useState } from "react";
import { useMirrorStore } from "../store";
import { PERSONAS } from "./ui";

export default function Splash() {
  const [visible, setVisible] = useState(false);
  const { setScreen } = useMirrorStore();

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 28px",
      textAlign: "center",
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : "translateY(16px)",
      transition: "all 1s cubic-bezier(0.4,0,0.2,1)",
    }}>
      {/* Mirror icon */}
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(212,168,83,0.15) 0%, rgba(212,168,83,0.05) 100%)",
        border: "1px solid rgba(212,168,83,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, marginBottom: 32,
        boxShadow: "0 0 40px rgba(212,168,83,0.08)",
      }}>
        🪞
      </div>

      {/* Wordmark */}
      <div className="label" style={{ letterSpacing: "0.5em", marginBottom: 20, color: "var(--text-dim)" }}>
        MIRROR
      </div>

      {/* Headline */}
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(28px, 8vw, 42px)",
        fontWeight: 700,
        color: "var(--text)",
        lineHeight: 1.2,
        margin: "0 0 20px",
        letterSpacing: "-0.02em",
      }}>
        Everyone has googled you.<br />
        <em style={{ color: "var(--gold)" }}>Now you can hear<br />what they found.</em>
      </h1>

      <p style={{
        fontFamily: "var(--font-body)",
        color: "var(--text-muted)",
        fontSize: 15,
        lineHeight: 1.7,
        margin: "0 0 48px",
        fontStyle: "italic",
        maxWidth: 320,
      }}>
        Four voices. Four perspectives.<br />One mirror that fights back.
      </p>

      {/* CTA */}
      <button
        onClick={() => setScreen("onboarding")}
        style={{
          background: "var(--gold)",
          color: "#070707",
          border: "none",
          borderRadius: 100,
          padding: "16px 40px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.2em",
          marginBottom: 48,
          boxShadow: "0 0 30px rgba(212,168,83,0.2)",
        }}
      >
        SEE YOURSELF →
      </button>

      {/* Persona icons */}
      <div style={{ display: "flex", justifyContent: "center", gap: 28 }}>
        {Object.values(PERSONAS).map((p) => (
          <div key={p.id} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{p.emoji}</div>
            <div className="label" style={{ color: p.color, fontSize: 9 }}>{p.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
