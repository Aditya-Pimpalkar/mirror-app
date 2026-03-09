"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useMirrorStore } from "../../store";
import { streamChat } from "../../lib/api";
import { useGeminiLive } from "../../hooks/useGeminiLive";
import { BeliefBar, PersonaAvatar, LoadingDots, PERSONAS } from "../ui";

export default function Chat() {
  const {
    activePersonaId, conversations, beliefs, completedPersonas,
    addMessage, setScreen, updateBelief, markPersonaComplete, profile, updateStreak,
  } = useMirrorStore();

  const persona = PERSONAS[activePersonaId];
  const messages = conversations[activePersonaId] || [];

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const summariesLoadedRef = useRef(false);
  const openingAddedRef = useRef(false);

  const belief = beliefs[activePersonaId] || persona?.initialBelief || 20;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, isLoading]);

  // Load voice summaries from Firestore
  useEffect(() => {
    if (!persona) return;
    if (summariesLoadedRef.current) return;
    summariesLoadedRef.current = true;
    const loadVoiceSummaries = async () => {
      try {
        const { getIdToken } = await import("../../lib/firebase.js");
        const token = await getIdToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL}/personas/${activePersonaId}/voice-summaries`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        data.summaries?.forEach(s => {
          const exists = messages.some(m => m.voiceSummaryId === s.id);
          if (!exists && s.summary) {
            addMessage(activePersonaId, {
              role: "assistant",
              content: `🎙️ Voice session (${s.turns} turns)\n\n${s.summary}`,
              timestamp: s.createdAt,
              source: "voice_summary",
              voiceSummaryId: s.id,
            });
          }
        });
      } catch {}
    };
    loadVoiceSummaries();
  }, [activePersonaId]);

  // Opening message — only once
  useEffect(() => {
    if (!persona || openingAddedRef.current) return;
    const realMessages = (conversations[activePersonaId] || []).filter(m => !m.source?.includes("voice"));
    if (realMessages.length > 0) return;
    openingAddedRef.current = true;
    const firstName = profile?.userName?.split(" ")[0] || "you";
    const opening = {
      recruiter: `I've looked you over, ${firstName}. Your trajectory raises some questions. Let's start with the gaps.`,
      date: `So... I did some research before tonight. I have a few questions, ${firstName}. Hope that's okay.`,
      competitor: `${firstName}. I've been watching your trajectory. Interesting choices lately.`,
      journalist: `${firstName}, thanks for agreeing to talk. I found some things I'd like to understand better.`,
    }[activePersonaId] || `Hello, ${firstName}.`;
    addMessage(activePersonaId, { role: "assistant", content: opening, timestamp: new Date().toISOString() });
  }, [activePersonaId]);

  // ── Gemini Live ───────────────────────────────────────────────────────────
  const { isConnected, isListening: liveListening, isSpeaking, connect, disconnect, startListening: startLive, stopListening: stopLive, sendText } = useGeminiLive({
    personaId: activePersonaId,
    onMessage: (msg) => {
      if (msg.type === "chunk") {
        setStreamingText((prev) => prev + msg.text);
      } else if (msg.type === "turn_complete") {
        if (msg.text?.trim()) {
          addMessage(activePersonaId, { role: "assistant", content: msg.text, timestamp: new Date().toISOString(), source: "voice" });
        }
        setStreamingText("");
      } else if (msg.type === "user_transcript" && msg.isFinal && msg.text?.trim()) {
        addMessage(activePersonaId, { role: "user", content: msg.text, timestamp: new Date().toISOString(), source: "voice" });
      } else if (msg.type === "persona_transcript" && msg.isFinal && msg.text?.trim()) {
        addMessage(activePersonaId, { role: "assistant", content: msg.text, timestamp: new Date().toISOString(), source: "voice" });
        setStreamingText("");
      } else if (msg.type === "session_summary") {
        if (msg.text?.trim()) {
          addMessage(activePersonaId, {
            role: "assistant",
            content: `[Voice session — ${msg.turns} turns]\n\n${msg.text}`,
            timestamp: new Date().toISOString(),
            source: "voice_summary"
          });
        }
      } else if (msg.type === "interrupted") {
        setStreamingText("");
      }
    },
    onBeliefUpdate: (update) => {
      if (update?.belief) {
        updateBelief(activePersonaId, update.belief);
        // Crisis detection — if belief drops very low, conversation may be distressing
        if (update.belief < 10 && update.belief < (beliefs[activePersonaId] || 20)) {
          console.warn("[Crisis] Belief very low — may be distressing");
        }
      }
    },
    onSessionReady: () => {
      console.log("[Chat] Live session ready");
    },
    onError: (err) => { console.error("[Chat] Live error:", err); },
  });

  // ── Browser speech recognition ────────────────────────────────────────────
  const startBrowserListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => setTranscript(Array.from(e.results).map(r => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }, []);

  const stopBrowserListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // ── Text send ─────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = voiceMode ? transcript : inputText;
    if (!text.trim() || isLoading) return;
    addMessage(activePersonaId, { role: "user", content: text.trim(), timestamp: new Date().toISOString() });
    setInputText("");
    setTranscript("");
    if (listening) stopBrowserListening();
    setIsLoading(true);
    setStreamingText("");

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      let fullResponse = "";
      for await (const event of streamChat({ personaId: activePersonaId, message: text.trim(), conversationHistory: history })) {
        if (event.type === "chunk") { fullResponse += event.text; setStreamingText(fullResponse); }
        else if (event.type === "belief_update") updateBelief(activePersonaId, event.belief);
        else if (event.type === "done") {
          if (fullResponse) addMessage(activePersonaId, { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });
          setStreamingText("");
        }
      }
    } catch (err) {
      console.error("[Chat] Send error:", err);
      setStreamingText("");
    }
    setIsLoading(false);
  };

  const endConversation = async () => {
    disconnect();
    markPersonaComplete(activePersonaId);
    // Update streak — increment if belief improved
    const currentBelief = beliefs[activePersonaId] || 20;
    const initialBelief = PERSONAS[activePersonaId]?.initialBelief || 20;
    updateStreak(activePersonaId, true); // Always increment — talked today
    setTimeout(() => setScreen("home"), 3500);
  };

  if (!persona) { setScreen("home"); return null; }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${persona.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setScreen("home")} style={{ color: "var(--text-muted)", fontSize: 20 }}>←</button>
          <PersonaAvatar persona={persona} size={38} pulse={isSpeaking} />
          <div>
            <div className="label" style={{ color: persona.color }}>{persona.name.toUpperCase()} · {persona.domain.toUpperCase()}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{persona.role}</div>
          </div>
        </div>
        <button onClick={endConversation} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 8, letterSpacing: "0.1em" }}>
          END
        </button>
      </div>

      {/* Belief meter */}
      <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        <BeliefBar value={belief} color={persona.color} />
      </div>

      {/* Live status bar */}
      {isConnected && (
        <div style={{ padding: "8px 20px", background: persona.bg, borderBottom: `1px solid ${persona.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isSpeaking ? persona.color : liveListening ? "#7DC98F" : "rgba(255,255,255,0.3)", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: persona.color, letterSpacing: "0.1em" }}>
              {isSpeaking ? `${persona.name.toUpperCase()} IS SPEAKING — INTERRUPT ANYTIME` : liveListening ? "LISTENING..." : "LIVE CONNECTED"}
            </span>
          </div>
          <button onClick={() => { disconnect(); }} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", background: "none", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: 6 }}>
            END VOICE
          </button>
        </div>
      )}

      {/* Crisis detection banner */}
      {belief < 10 && (
        <div style={{ padding: "10px 20px", background: "rgba(232,112,112,0.08)", borderBottom: "1px solid rgba(232,112,112,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-body)", color: "#E87070", fontSize: 12, fontStyle: "italic" }}>
            This conversation seems intense. Take a breath if needed.
          </div>
          <button onClick={endConversation} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#E87070", background: "none", border: "1px solid rgba(232,112,112,0.3)", padding: "4px 8px", borderRadius: 6 }}>
            PAUSE
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} persona={persona} />
        ))}
        {streamingText && <ChatBubble msg={{ role: "assistant", content: streamingText }} persona={persona} streaming />}
        {isLoading && !streamingText && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <PersonaAvatar persona={persona} size={30} />
            <div style={{ padding: "11px 16px", background: persona.bg, border: `1px solid ${persona.border}`, borderRadius: "18px 18px 18px 4px" }}>
              <LoadingDots color={persona.color} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: "12px 16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "var(--bg)", flexShrink: 0 }}>
        {isConnected ? (
          <LiveVoiceInput
            isListening={liveListening}
            isSpeaking={isSpeaking}
            onSendText={(text) => {
              sendText(text);
              addMessage(activePersonaId, { role: "user", content: text, timestamp: new Date().toISOString() });
            }}
            personaColor={persona.color}
          />
        ) : voiceMode ? (
          <VoiceInput
            transcript={transcript}
            listening={listening}
            onStart={startBrowserListening}
            onStop={stopBrowserListening}
            onSend={sendMessage}
            onTextMode={() => setVoiceMode(false)}
            isLoading={isLoading}
            personaColor={persona.color}
          />
        ) : (
          <TextInput
            value={inputText}
            onChange={setInputText}
            onSend={sendMessage}
            onVoiceMode={() => setVoiceMode(true)}
            onLiveVoice={async () => { await connect(); setTimeout(() => startLive(), 800); }}
            isLoading={isLoading}
            personaName={persona.name}
            personaColor={persona.color}
          />
        )}
      </div>
    </div>
  );
}

function ChatBubble({ msg, persona, streaming }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14, animation: "fadeUp 0.3s ease" }}>
      {!isUser && <PersonaAvatar persona={persona} size={30} style={{ marginRight: 8, marginTop: 2, flexShrink: 0 }} />}
      <div style={{
        maxWidth: "78%", padding: "11px 15px",
        background: isUser ? "rgba(255,255,255,0.06)" : persona.bg,
        border: `1px solid ${isUser ? "rgba(255,255,255,0.1)" : persona.border}`,
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        fontSize: 14, lineHeight: 1.65,
        color: isUser ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.88)",
        fontFamily: "var(--font-body)", fontStyle: isUser ? "normal" : "italic",
        marginLeft: isUser ? 0 : 8,
      }}>
        {msg.content}
        {streaming && <span style={{ animation: "pulse 1s infinite", display: "inline", color: persona.color }}>▋</span>}
        {msg.source === "voice" && (
          <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>VOICE</div>
        )}
      </div>
    </div>
  );
}

function LiveVoiceInput({ isListening, isSpeaking, onSendText, personaColor }) {
  const [text, setText] = useState("");
  return (
    <div>
      <div style={{
        padding: "14px 18px", marginBottom: 10,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${isSpeaking ? personaColor : isListening ? "#7DC98F44" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 14, display: "flex", alignItems: "center", gap: 12,
        transition: "border-color 0.3s",
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: isSpeaking ? personaColor : isListening ? "#7DC98F" : "rgba(255,255,255,0.2)",
          animation: (isSpeaking || isListening) ? "pulse 1.2s infinite" : "none",
          boxShadow: isListening ? "0 0 8px #7DC98F66" : isSpeaking ? `0 0 8px ${personaColor}66` : "none",
        }} />
        <span style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
          {isSpeaking ? "Speaking — just talk over to interrupt" : isListening ? "Listening..." : "Connecting mic..."}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onSendText(text.trim()); setText(""); }}}
          placeholder="Or type instead..."
          style={{ flex: 1, fontSize: 13 }} />
        {text.trim() && (
          <button onClick={() => { onSendText(text.trim()); setText(""); }}
            style={{ padding: "12px 16px", background: personaColor, color: "#070707", border: "none", borderRadius: 12, fontWeight: 700 }}>→</button>
        )}
      </div>
    </div>
  );
}

function TextInput({ value, onChange, onSend, onVoiceMode, onLiveVoice, isLoading, personaName, personaColor }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <button
        onClick={onLiveVoice}
        title="Start live voice conversation"
        style={{ padding: "12px 14px", background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.25)", borderRadius: 12, fontSize: 16, flexShrink: 0 }}
      >
        🎙️
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder={`Respond to ${personaName}...`}
        disabled={isLoading}
        style={{ flex: 1 }}
      />
      <button
        onClick={onSend}
        disabled={isLoading || !value.trim()}
        style={{
          padding: "12px 16px", flexShrink: 0,
          background: value.trim() ? personaColor : "rgba(255,255,255,0.04)",
          color: value.trim() ? "#070707" : "rgba(255,255,255,0.2)",
          border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16,
          transition: "all 0.2s",
        }}
      >
        →
      </button>
    </div>
  );
}

function VoiceInput({ transcript, listening, onStart, onStop, onSend, onTextMode, isLoading, personaColor }) {
  return (
    <div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${listening ? "rgba(212,168,83,0.4)" : "var(--border)"}`, borderRadius: 14, padding: "12px 14px", minHeight: 52, marginBottom: 10 }}>
        {transcript
          ? <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.65)", fontSize: 14, fontStyle: "italic" }}>{transcript}</span>
          : <span style={{ fontFamily: "var(--font-body)", color: "var(--text-dim)", fontSize: 13, fontStyle: "italic" }}>Speak your response...</span>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={listening ? onStop : onStart}
          style={{ flex: 1, padding: "12px", background: listening ? "rgba(232,112,112,0.1)" : "rgba(212,168,83,0.08)", border: `1px solid ${listening ? "rgba(232,112,112,0.3)" : "rgba(212,168,83,0.2)"}`, borderRadius: 12, color: listening ? "#E87070" : "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {listening ? <><span style={{ animation: "pulse 1s infinite", display: "inline-block" }}>●</span> STOP</> : "● RECORD"}
        </button>
        {transcript && <button onClick={onSend} disabled={isLoading} style={{ flex: 1, padding: "12px", background: personaColor, color: "#070707", border: "none", borderRadius: 12, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11 }}>SEND →</button>}
        <button onClick={onTextMode} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 14, color: "var(--text-muted)" }}>⌨️</button>
      </div>
    </div>
  );
}
