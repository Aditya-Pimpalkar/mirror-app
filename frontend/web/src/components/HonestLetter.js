"use client";
import { useState, useEffect } from "react";
import { useMirrorStore } from "../store";
import { getIdToken } from "../lib/firebase";

export default function HonestLetter() {
  const { setScreen, profile, beliefs, gapScore, archetype } = useMirrorStore();
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);

  const ARCHETYPES = {
    vault: "The Vault", spark: "The Spark", contractor: "The Contractor",
    ghost: "The Ghost", overexposed: "The Overexposed", architect: "The Architect",
  };

  useEffect(() => { generateLetter(); }, []);

  const generateLetter = async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SYNTHESIS_SERVICE_URL}/synthesis/honest-letter`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({}) }
      );
      const data = await res.json();
      setLetter(data.letter || data.content);
    } catch (err) {
      console.error("[HonestLetter]", err);
      setLetter(generateLocalLetter());
    }
    setLoading(false);
  };

  const generateLocalLetter = () => {
    const name = profile?.userName?.split(" ")[0] || "you";
    const archName = archetype?.id ? ARCHETYPES[archetype.id] : null;
    const avgBelief = Math.round(Object.values(beliefs).reduce((a, b) => a + b, 0) / 4);
    return `Dear ${name},\n\nWe've been watching you — all four of us. Rachel from across a desk, Alex from across a table, Chris from across the industry, Jordan from across a recorder. And after everything you've shared, we wanted to write this together.\n\nYour Gap Score is ${gapScore}. That number is the distance between who you believe you are and who we've come to know through your words. It is not a judgment. It is a measurement.\n\nYou have conviction. That much is clear. But conviction without visibility is a tree falling in an empty forest. The people who matter — the ones who could change your trajectory — don't yet have the full picture you carry inside.\n\nYour average belief across all four of us is ${avgBelief} out of 100. That means we are collectively ${avgBelief}% convinced of the version of yourself you're presenting. ${avgBelief < 40 ? "That number has room to grow. The gap is not a flaw — it's an opportunity." : avgBelief < 70 ? "That's meaningful progress. We're listening more carefully than when we started." : "That's genuinely impressive. You've shown us evidence we can hold onto."}\n\n${archName ? `We've come to think of you as ${archName}. That archetype is not a box — it's a mirror. Sit with what it reveals.` : ""}\n\nThe next conversation is the one that matters most.\n\nWith full attention,\nRachel, Alex, Chris & Jordan\n\n— Mirror`;
  };

  const copyLetter = () => {
    navigator.clipboard?.writeText(letter);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "40px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>✉️</div>
        <div className="label" style={{ color: "var(--gold)" }}>WRITING YOUR LETTER</div>
        <div style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, lineHeight: 1.6 }}>
          All four voices are composing<br />something honest for you...
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", animation: `pulse 1.2s ${i*0.2}s infinite` }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
      <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>

      <div className="label" style={{ color: "var(--gold)", marginBottom: 8 }}>THE HONEST LETTER</div>
      <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: "0 0 28px", lineHeight: 1.6 }}>
        Written jointly by all four personas based on everything you've shared.
      </p>

      {/* Letter */}
      <div style={{
        padding: "28px 24px",
        background: "rgba(212,168,83,0.04)",
        border: "1px solid rgba(212,168,83,0.15)",
        borderRadius: 16,
        marginBottom: 20,
        position: "relative",
      }}>
        <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.4 }}>"</div>
        {letter?.split("\n\n").map((para, i) => (
          <p key={i} style={{
            fontFamily: "var(--font-body)",
            color: i === 0 ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.65)",
            fontSize: i === 0 ? 15 : 14,
            lineHeight: 1.8,
            fontStyle: "italic",
            margin: "0 0 16px",
          }}>
            {para}
          </p>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={copyLetter}
          style={{ padding: "14px", background: "var(--gold)", color: "#070707", border: "none", borderRadius: 100, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.15em" }}
        >
          COPY LETTER
        </button>
        <button
          onClick={generateLetter}
          style={{ padding: "13px", background: "none", border: "1px solid var(--border)", borderRadius: 100, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}
        >
          ↻ REGENERATE
        </button>
      </div>
    </div>
  );
}
