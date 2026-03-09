"use client";
import { useState, useRef, useCallback } from "react";
import { useMirrorStore } from "../store";
import { getIdToken } from "../lib/firebase";
import { PERSONAS, PersonaAvatar, LoadingDots } from "./ui";

const SCENARIOS = [
  { id: "faang_interview", title: "FAANG Interview", description: "Senior engineer at a top tech company interviews you for a backend role.", persona: "recruiter", icon: "💻", difficulty: "HARD" },
  { id: "investor_pitch", title: "Investor Pitch", description: "A skeptical Series A investor hears your startup pitch.", persona: "journalist", icon: "💰", difficulty: "HARD" },
  { id: "salary_negotiation", title: "Salary Negotiation", description: "Negotiate your offer with a hiring manager.", persona: "recruiter", icon: "💵", difficulty: "MEDIUM" },
  { id: "cofounder_conflict", title: "Co-founder Conflict", description: "Address serious misalignment with your co-founder.", persona: "date", icon: "🤝", difficulty: "HARD" },
  { id: "performance_review", title: "Difficult Review", description: "Your manager gives feedback you disagree with.", persona: "recruiter", icon: "📊", difficulty: "MEDIUM" },
  { id: "media_interview", title: "Press Interview", description: "A journalist asks tough questions about your company.", persona: "journalist", icon: "🎤", difficulty: "HARD" },
];

const DIFFICULTY_COLOR = { EASY: "#7DC98F", MEDIUM: "#D4A853", HARD: "#E87070" };

export default function ScenarioPrep() {
  const { setScreen, profile } = useMirrorStore();
  const [step, setStep] = useState("select"); // select | context | session | debrief
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [userContext, setUserContext] = useState("");
  const [transcript, setTranscript] = useState("");
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debrief, setDebrief] = useState(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  const persona = selectedScenario ? PERSONAS[selectedScenario.persona] : null;

  // ── Start session ──────────────────────────────────────────────────────────
  const startSession = async () => {
    if (!selectedScenario) return;
    setSessionStart(Date.now());
    setStep("session");

    // Opening line from persona
    const opening = getOpeningLine(selectedScenario.id, profile?.userName?.split(" ")[0] || "you");
    setMessages([{ role: "assistant", content: opening, timestamp: new Date().toISOString() }]);
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const userMsg = { role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setTranscript(prev => prev + " " + text);
    setInputText("");
    setIsLoading(true);

    try {
      const token = await getIdToken();
      const history = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

      const res = await fetch(`${process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL}/scenarios/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scenarioId: selectedScenario.id,
          message: text,
          history,
          userContext,
          userName: profile?.userName,
          userProfile: profile?.structured?.summary,
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response, timestamp: new Date().toISOString() }]);
    } catch (err) {
      console.error("[ScenarioPrep] Send error:", err);
    }
    setIsLoading(false);
  };

  // ── End session + get debrief ──────────────────────────────────────────────
  const endSession = async () => {
    setStep("debrief");
    setIsLoading(true);

    try {
      const token = await getIdToken();
      const duration = sessionStart ? Math.round((Date.now() - sessionStart) / 1000) : 0;
      const fullTranscript = messages.map(m => `${m.role === "user" ? "Me" : "Them"}: ${m.content}`).join("\n");

      const res = await fetch(`${process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL}/scenarios/debrief`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scenarioId: selectedScenario.id, transcript: fullTranscript, duration, userContext }),
      });

      const data = await res.json();
      setDebrief(data);
    } catch (err) {
      console.error("[ScenarioPrep] Debrief error:", err);
    }
    setIsLoading(false);
  };

  // ── Voice input ────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => setInputText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }, []);

  // ── Screens ────────────────────────────────────────────────────────────────

  if (step === "select") {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
        <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>
        <div className="label" style={{ color: "var(--gold)", marginBottom: 8 }}>SCENARIO PREP</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.3 }}>
          Rehearse what's<br /><em style={{ color: "var(--gold)" }}>actually at stake.</em>
        </h2>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: "0 0 28px", lineHeight: 1.6 }}>
          Pick a high-stakes situation. A persona plays the other side. All 4 debrief you after.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SCENARIOS.map((s) => {
            const p = PERSONAS[s.persona];
            return (
              <button
                key={s.id}
                onClick={() => { setSelectedScenario(s); setStep("context"); }}
                style={{ padding: "18px", textAlign: "left", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", transition: "all 0.2s" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", color: "var(--text)", fontSize: 15, fontWeight: 700 }}>{s.title}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: p?.color, letterSpacing: "0.1em" }}>
                        {p?.emoji} {p?.name.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: DIFFICULTY_COLOR[s.difficulty], border: `1px solid ${DIFFICULTY_COLOR[s.difficulty]}44`, padding: "3px 8px", borderRadius: 4 }}>
                    {s.difficulty}
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-body)", color: "var(--text-dim)", fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>
                  {s.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === "context") {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
        <button onClick={() => setStep("select")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 32 }}>{selectedScenario.icon}</span>
          <div>
            <div className="label" style={{ color: "var(--gold)" }}>SCENARIO PREP</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{selectedScenario.title}</div>
          </div>
        </div>

        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, margin: "0 0 24px", lineHeight: 1.6 }}>
          Add context so {PERSONAS[selectedScenario.persona]?.name} can make this specific to your situation.
        </p>

        <textarea
          value={userContext}
          onChange={e => setUserContext(e.target.value)}
          placeholder={getContextPlaceholder(selectedScenario.id)}
          style={{ minHeight: 140, marginBottom: 16, lineHeight: 1.7, fontStyle: "italic" }}
        />

        <button
          onClick={startSession}
          style={{ width: "100%", padding: "15px", background: "var(--gold)", color: "#070707", border: "none", borderRadius: 100, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.15em", marginBottom: 10 }}
        >
          START ROLEPLAY →
        </button>
        <button
          onClick={startSession}
          style={{ width: "100%", padding: "12px", background: "none", border: "none", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.1em" }}
        >
          SKIP — START WITHOUT CONTEXT
        </button>
      </div>
    );
  }

  if (step === "session" && persona) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${persona.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{selectedScenario.icon}</span>
            <div>
              <div className="label" style={{ color: persona.color }}>{selectedScenario.title.toUpperCase()}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{persona.name} is playing the other side</div>
            </div>
          </div>
          <button onClick={endSession} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#E87070", border: "1px solid rgba(232,112,112,0.3)", padding: "5px 12px", borderRadius: 8, letterSpacing: "0.1em" }}>
            END + DEBRIEF
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 14 }}>
              {msg.role === "assistant" && <PersonaAvatar persona={persona} size={30} style={{ marginRight: 8, flexShrink: 0 }} />}
              <div style={{
                maxWidth: "78%", padding: "11px 15px",
                background: msg.role === "user" ? "rgba(255,255,255,0.06)" : persona.bg,
                border: `1px solid ${msg.role === "user" ? "rgba(255,255,255,0.1)" : persona.border}`,
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                fontSize: 14, lineHeight: 1.65,
                color: msg.role === "user" ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.88)",
                fontFamily: "var(--font-body)", fontStyle: msg.role === "assistant" ? "italic" : "normal",
                marginLeft: msg.role === "user" ? 0 : 8,
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
              <PersonaAvatar persona={persona} size={30} />
              <div style={{ padding: "11px 16px", background: persona.bg, border: `1px solid ${persona.border}`, borderRadius: "18px 18px 18px 4px" }}>
                <LoadingDots color={persona.color} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "var(--bg)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition) && (
              <button onClick={startListening} style={{ padding: "12px 14px", background: listening ? "rgba(212,168,83,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${listening ? "rgba(212,168,83,0.4)" : "var(--border)"}`, borderRadius: 12, fontSize: 16, flexShrink: 0 }}>
                {listening ? "⏺" : "🎙️"}
              </button>
            )}
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Respond..."
              disabled={isLoading}
              style={{ flex: 1 }}
            />
            <button onClick={sendMessage} disabled={isLoading || !inputText.trim()} style={{ padding: "12px 16px", flexShrink: 0, background: inputText.trim() ? persona.color : "rgba(255,255,255,0.04)", color: inputText.trim() ? "#070707" : "rgba(255,255,255,0.2)", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16 }}>
              →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "debrief") {
    if (isLoading || !debrief) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "40px 28px", textAlign: "center" }}>
          <div className="label" style={{ color: "var(--gold)" }}>GENERATING DEBRIEF</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--gold)", fontStyle: "italic" }}>All 4 voices are reviewing your performance...</div>
          <div style={{ display: "flex", gap: 12 }}>
            {Object.values(PERSONAS).map((p, i) => (
              <div key={p.id} style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, animation: `pulse 1.5s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
        <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20, marginBottom: 28 }}>←</button>

        <div className="label" style={{ color: "var(--gold)", marginBottom: 8 }}>SESSION DEBRIEF</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>{selectedScenario.icon}</span>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{selectedScenario.title}</div>
        </div>

        {/* Overall score */}
        <div style={{ padding: "20px", background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.25)", borderRadius: 16, marginBottom: 20, textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 8 }}>OVERALL SCORE</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 800, color: debrief.avgScore >= 70 ? "#7DC98F" : debrief.avgScore >= 50 ? "#D4A853" : "#E87070", lineHeight: 1 }}>
            {debrief.avgScore}
          </div>
          <div className="label" style={{ marginTop: 6, color: "var(--text-dim)" }}>/100</div>
        </div>

        {/* Per-persona debrief */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          {debrief.debriefs?.map((d) => {
            const p = PERSONAS[d.personaId];
            if (!p) return null;
            return (
              <div key={d.personaId} style={{ padding: "18px", background: p.bg, border: `1px solid ${p.border}`, borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <PersonaAvatar persona={p} size={36} />
                    <div>
                      <div className="label" style={{ color: p.color }}>{p.name.toUpperCase()}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{p.role}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: d.score >= 70 ? "#7DC98F" : d.score >= 50 ? p.color : "#E87070" }}>
                    {d.score}
                  </div>
                </div>

                <p style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.82)", fontStyle: "italic", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                  "{d.verdict}"
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: "#7DC98F", fontSize: 12, flexShrink: 0 }}>+</span>
                    <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{d.strength}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: "#E87070", fontSize: 12, flexShrink: 0 }}>△</span>
                    <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{d.weakness}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: p.color, fontSize: 12, flexShrink: 0 }}>→</span>
                    <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{d.advice}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => { setStep("context"); setMessages([]); setTranscript(""); setDebrief(null); }} style={{ flex: 1, padding: "13px", background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 14, color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}>
            TRY AGAIN →
          </button>
          <button onClick={() => { setStep("select"); setSelectedScenario(null); setMessages([]); setTranscript(""); setDebrief(null); }} style={{ flex: 1, padding: "13px", background: "none", border: "1px solid var(--border)", borderRadius: 14, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}>
            NEW SCENARIO
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function getOpeningLine(scenarioId, name) {
  const lines = {
    faang_interview: `Thanks for coming in, ${name}. I've reviewed your resume. Let's start with something straightforward — walk me through your background and why you're interested in this role.`,
    investor_pitch: `${name}, I have about 20 minutes. I've seen the deck. Pitch me like I haven't.`,
    salary_negotiation: `${name}, we'd like to move forward with you. We're prepared to offer $145k base. How does that feel?`,
    cofounder_conflict: `${name}, I've been wanting to have this conversation for a while. I think we need to talk about where we're headed.`,
    performance_review: `${name}, thanks for sitting down with me. I want to be direct with you — there are some areas where I feel like you've fallen short this quarter.`,
    media_interview: `${name}, thanks for agreeing to speak with me. Let's start with the basics — what exactly does your company do, and why should anyone trust you with their data?`,
  };
  return lines[scenarioId] || `Let's begin. Tell me about yourself, ${name}.`;
}

function getContextPlaceholder(scenarioId) {
  const placeholders = {
    faang_interview: "E.g. Interviewing for Senior Backend Engineer at Google. 4 years experience with distributed systems. Nervous about system design questions.",
    investor_pitch: "E.g. Pre-seed B2B SaaS for restaurant inventory management. $8k MRR, 12 customers. Looking for $500k.",
    salary_negotiation: "E.g. Offered $145k at Series B startup. Market rate is $165k. Have a competing offer at $158k.",
    cofounder_conflict: "E.g. Co-founder has been disengaged for 3 months. Equity split is 50/50 but I've been doing 80% of the work.",
    performance_review: "E.g. Manager says I need to communicate better. I think the real issue is the team doesn't have clear processes.",
    media_interview: "E.g. Running a fintech startup. Recent news about a data breach at a competitor. Journalist may ask about our security.",
  };
  return placeholders[scenarioId] || "Add context to make this scenario specific to your situation...";
}
