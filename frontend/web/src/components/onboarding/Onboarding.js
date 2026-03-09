"use client";
// src/components/onboarding/Onboarding.js

import { useState, useRef, useCallback } from "react";
import { useMirrorStore } from "../../store";
import { onboardUser } from "../../lib/api";
import { PrimaryButton } from "../ui";

const PROCESSING_STEPS = [
  "Parsing your story...",
  "Building evidence file...",
  "Briefing Rachel...",
  "Briefing Alex...",
  "Briefing Chris...",
  "Briefing Jordan...",
  "Calibrating belief meters...",
  "Mirror is ready.",
];

export default function Onboarding() {
  const [step, setStep] = useState(0); // 0=name, 1=mode, 2=input, 3=links, 4=processing
  const [mode, setMode] = useState(null); // voice | text
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [transcript, setTranscript] = useState("");
  const [links, setLinks] = useState("");
  const [listening, setListening] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const { setScreen, setProfile } = useMirrorStore();

  const hasSR = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── Voice recording ───────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setTranscript(t);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const submit = async () => {
    const content = mode === "voice" ? transcript : bio;
    if (!content.trim() || !name.trim()) return;

    if (listening) stopListening();
    setStep(4);

    // Parse public links
    const publicLinks = links.split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"));

    // Animate processing steps
    for (let i = 0; i < PROCESSING_STEPS.length - 1; i++) {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 500));
      setProcessingStep(i + 1);
    }

    try {
      const result = await onboardUser({ bio: content, userName: name.trim(), publicLinks });
      setProfile({ userName: name.trim(), summary: result.dossierPreview, publicLinks });
      setScreen("meet");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setStep(2);
    }
  };

  // ── Processing screen ─────────────────────────────────────────────────────

  if (step === 4) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 16 }}>BUILDING YOUR DOSSIER</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text)", margin: "0 0 40px", lineHeight: 1.3 }}>
          Four people are<br /><em style={{ color: "var(--gold)" }}>learning about you.</em>
        </h2>

        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="label">PROGRESS</span>
            <span className="label">{Math.round((processingStep / (PROCESSING_STEPS.length - 1)) * 100)}%</span>
          </div>
          <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1 }}>
            <div style={{
              height: "100%",
              width: `${(processingStep / (PROCESSING_STEPS.length - 1)) * 100}%`,
              background: "linear-gradient(90deg, #8B6914, #D4A853)",
              transition: "width 0.5s ease",
              boxShadow: "0 0 10px rgba(212,168,83,0.4)",
            }} />
          </div>
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
          {PROCESSING_STEPS.map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "7px 0",
              color: i < processingStep ? "rgba(255,255,255,0.2)"
                : i === processingStep ? "var(--gold)"
                : "rgba(255,255,255,0.08)",
              transition: "color 0.4s",
            }}>
              <span>{i < processingStep ? "✓" : i === processingStep ? "▶" : "○"}</span>
              {s}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 0: Name ──────────────────────────────────────────────────────────

  if (step === 0) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <button onClick={() => setScreen("splash")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 32, textAlign: "left" }}>←</button>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 16 }}>STEP 1 OF 3</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>What should we call you?</h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 14, margin: "0 0 32px", lineHeight: 1.6 }}>
          This is the name your four personas will know you by.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          style={{ fontSize: 18, marginBottom: 24 }}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(1)}
        />
        <PrimaryButton onClick={() => setStep(1)} disabled={!name.trim()}>
          CONTINUE →
        </PrimaryButton>
      </div>
    );
  }

  // ── Step 1: Mode selection ─────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <button onClick={() => setStep(0)} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 32, textAlign: "left" }}>←</button>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 16 }}>STEP 2 OF 3</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
          Tell us about yourself.
        </h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 14, margin: "0 0 32px", lineHeight: 1.6 }}>
          No profiles needed. No public data required.<br />Just your words, {name.split(" ")[0]}.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {hasSR && (
            <button
              onClick={() => { setMode("voice"); setStep(2); }}
              style={{
                padding: "20px", textAlign: "left",
                background: "rgba(212,168,83,0.07)",
                border: "1px solid rgba(212,168,83,0.2)",
                borderRadius: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 24 }}>🎙️</span>
                <span className="label" style={{ color: "var(--gold)" }}>SPEAK IT</span>
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5, paddingLeft: 36, fontFamily: "var(--font-body)", fontStyle: "italic" }}>
                Talk for 60 seconds. Your career, life, what matters.
              </div>
            </button>
          )}
          <button
            onClick={() => { setMode("text"); setStep(2); }}
            style={{
              padding: "20px", textAlign: "left",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>✍️</span>
              <span className="label">WRITE IT</span>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5, paddingLeft: 36, fontFamily: "var(--font-body)", fontStyle: "italic" }}>
              Paste a bio, LinkedIn About, or describe yourself.
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Input ──────────────────────────────────────────────────────────

  if (step === 2) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 28px", display: "flex", flexDirection: "column" }}>
        <button onClick={() => setStep(1)} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 32, textAlign: "left" }}>←</button>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 16 }}>STEP 2 OF 3</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
          {mode === "voice" ? "Tell your story." : "Describe yourself."}
        </h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: "0 0 24px", lineHeight: 1.6 }}>
          {mode === "voice"
            ? "Where you've been, what you do, what you care about. The more honest, the more accurate Mirror will be."
            : "Your bio, LinkedIn About section, or a few honest paragraphs about yourself."}
        </p>

        {error && (
          <div style={{ padding: "12px 16px", background: "rgba(232,112,112,0.1)", border: "1px solid rgba(232,112,112,0.2)", borderRadius: 10, marginBottom: 16, color: "#E87070", fontSize: 13, fontFamily: "var(--font-mono)" }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {mode === "voice" ? (
            <>
              <div style={{
                flex: 1, minHeight: 160,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${listening ? "rgba(212,168,83,0.4)" : "var(--border)"}`,
                borderRadius: 16, padding: 18,
                transition: "border-color 0.3s",
              }}>
                {transcript
                  ? <p style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>{transcript}</p>
                  : <p style={{ fontFamily: "var(--font-body)", color: "var(--text-dim)", fontSize: 14, fontStyle: "italic", margin: 0 }}>Your words will appear here...</p>}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={listening ? stopListening : startListening}
                  style={{
                    flex: 1, padding: "14px",
                    background: listening ? "rgba(232,112,112,0.1)" : "rgba(212,168,83,0.1)",
                    border: `1px solid ${listening ? "rgba(232,112,112,0.35)" : "rgba(212,168,83,0.25)"}`,
                    borderRadius: 14,
                    color: listening ? "#E87070" : "var(--gold)",
                    fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {listening ? <><span style={{ animation: "pulse 1s infinite", display: "inline-block" }}>●</span> STOP</> : "● RECORD"}
                </button>
                {transcript && (
                  <button
                    onClick={() => setStep(3)}
                    style={{
                      flex: 1, padding: "14px",
                      background: "var(--gold)", color: "#070707",
                      border: "none", borderRadius: 14,
                      fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em",
                    }}
                  >
                    CONTINUE →
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={`I'm a product designer who's spent the last 5 years building consumer apps. I recently left a startup to go independent. I care about craft, I'm probably too honest in meetings, and I've been told I'm hard to read...`}
                style={{ flex: 1, minHeight: 220, lineHeight: 1.7, fontStyle: "italic" }}
                autoFocus
              />
              <PrimaryButton onClick={() => setStep(3)} disabled={!bio.trim()}>
                CONTINUE →
              </PrimaryButton>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Step 3: Optional links ────────────────────────────────────────────────

  if (step === 3) {
    const content = mode === "voice" ? transcript : bio;
    return (
      <div style={{ minHeight: "100vh", padding: "48px 28px", display: "flex", flexDirection: "column" }}>
        <button onClick={() => setStep(2)} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 32, textAlign: "left" }}>←</button>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 16 }}>STEP 3 OF 3</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
          Add your public profiles.
        </h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: "0 0 8px", lineHeight: 1.6 }}>
          Optional. The more you give, the sharper your personas get.
        </p>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)", fontSize: 11, margin: "0 0 24px", lineHeight: 1.6 }}>
          LinkedIn · Twitter/X · Website · Medium · GitHub
        </p>

        <textarea
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          placeholder={"https://linkedin.com/in/yourname\nhttps://twitter.com/yourhandle\nhttps://yoursite.com"}
          style={{ minHeight: 130, lineHeight: 1.7, marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: 13 }}
        />

        <PrimaryButton onClick={submit} disabled={!content.trim()}>
          MEET YOUR MIRROR →
        </PrimaryButton>

        <button
          onClick={submit}
          style={{
            marginTop: 12, width: "100%", padding: "12px",
            background: "none", border: "none",
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em",
            color: "var(--text-dim)",
          }}
        >
          SKIP — CONTINUE WITHOUT LINKS
        </button>
      </div>
    );
  }

  return null;
}
