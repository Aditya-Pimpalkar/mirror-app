"use client";
// src/components/personas/Chat.js

import { useState, useEffect, useRef, useCallback } from "react";
import { useMirrorStore } from "../../store";
import { streamChat } from "../../lib/api";
import { useGeminiLive } from "../../hooks/useGeminiLive";
import { useEmotionCamera } from "../../hooks/useEmotionCamera";
import { BeliefBar, PersonaAvatar, LoadingDots, PERSONAS } from "../ui";

export default function Chat() {
  const {
    activePersonaId, conversations, beliefs, completedPersonas,
    addMessage, setScreen, updateBelief, markPersonaComplete, profile,
  } = useMirrorStore();

  const persona = PERSONAS[activePersonaId];
  const messages = conversations[activePersonaId] || [];

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [streamingText, setStreamingText] = useState("");
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const belief = beliefs[activePersonaId] || persona?.initialBelief || 20;

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, isLoading]);

  // Initialize conversation with opening line
  useEffect(() => {
    if (!persona || messages.length > 0) return;
    const firstName = profile?.userName?.split(" ")[0] || "you";
    const opening = persona.id === "recruiter"
      ? `I've looked you over, ${firstName}. Your trajectory raises some questions. Let's start with the gaps.`
      : persona.id === "date"
      ? `So... I did some research before tonight. I have a few questions, ${firstName}. Hope that's okay.`
      : persona.id === "competitor"
      ? `${firstName}. I've been watching your trajectory. Interesting choices lately.`
      : `${firstName}, thanks for agreeing to talk. I found some things I'd like to understand better.`;

    addMessage(activePersonaId, { role: "assistant", content: opening, timestamp: new Date().toISOString() });
  }, [activePersonaId]);

  // ── Emotion camera ────────────────────────────────────────────────────────
  const { videoRef, canvasRef, isActive: cameraActive, startCamera, stopCamera } = useEmotionCamera({
    personaId: activePersonaId,
    enabled: cameraEnabled,
    onEmotionDetected: (emotion) => {
      // Gemini Live will use this automatically
    },
  });

  // ── Gemini Live voice ─────────────────────────────────────────────────────
  const { isConnected, isListening: liveListening, isSpeaking, connect, disconnect, startListening: startLive, stopListening: stopLive, sendText } = useGeminiLive({
    personaId: activePersonaId,
    onMessage: (msg) => {
      if (msg.type === "chunk") {
        setStreamingText((prev) => prev + msg.text);
      } else if (msg.type === "turn_complete") {
        if (msg.text) {
          addMessage(activePersonaId, { role: "assistant", content: msg.text, timestamp: new Date().toISOString() });
        }
        setStreamingText("");
      }
    },
    onBeliefUpdate: (update) => {
      updateBelief(activePersonaId, update.belief);
    },
    onSessionReady: () => {
      console.log("[Chat] Live session ready");
    },
    onError: (err) => {
      console.error("[Chat] Live error:", err);
      setVoiceMode(false);
    },
  });

  // ── Browser speech recognition (fallback) ────────────────────────────────
  const startBrowserListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setTranscript(t);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }, []);

  const stopBrowserListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = voiceMode ? transcript : inputText;
    if (!text.trim() || isLoading) return;

    const userMsg = { role: "user", content: text.trim(), timestamp: new Date().toISOString() };
    addMessage(activePersonaId, userMsg);
    setInputText("");
    setTranscript("");
    if (listening) stopBrowserListening();
    setIsLoading(true);
    setStreamingText("");

    try {
      // Build history for context
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      let fullResponse = "";
      for await (const event of streamChat({
        personaId: activePersonaId,
        message: text.trim(),
        conversationHistory: history,
      })) {
        if (event.type === "chunk") {
          fullResponse += event.text;
          setStreamingText(fullResponse);
        } else if (event.type === "belief_update") {
          updateBelief(activePersonaId, event.belief);
        } else if (event.type === "done") {
          if (fullResponse) {
            addMessage(activePersonaId, { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });
          }
          setStreamingText("");
        }
      }
    } catch (err) {
      console.error("[Chat] Send error:", err);
      addMessage(activePersonaId, { role: "assistant", content: "...", timestamp: new Date().toISOString() });
      setStreamingText("");
    }
    setIsLoading(false);
  };

  const endConversation = () => {
    disconnect();
    if (cameraActive) stopCamera();
    markPersonaComplete(activePersonaId);
    setScreen("home");
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Camera toggle */}
          <button
            onClick={() => { setCameraEnabled(!cameraEnabled); cameraEnabled ? stopCamera() : startCamera(); }}
            style={{ fontSize: 16, opacity: cameraEnabled ? 1 : 0.35, color: "var(--text-muted)" }}
            title={cameraEnabled ? "Disable emotion camera" : "Enable emotion camera"}
          >
            📷
          </button>
          <button onClick={endConversation} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 8, letterSpacing: "0.1em" }}>
            END
          </button>
        </div>
      </div>

      {/* Belief meter */}
      <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        <BeliefBar value={belief} color={persona.color} />
      </div>

      {/* Camera preview (small, unobtrusive) */}
      {cameraEnabled && (
        <div style={{ position: "relative", height: 80, overflow: "hidden", flexShrink: 0 }}>
          <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.4 }} muted playsInline />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ position: "absolute", bottom: 6, left: 12, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
            EMOTION DETECTION ACTIVE
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} persona={persona} />
        ))}

        {/* Streaming response */}
        {streamingText && (
          <ChatBubble msg={{ role: "assistant", content: streamingText }} persona={persona} streaming />
        )}

        {/* Loading */}
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

      {/* Input hint */}
      {messages.length <= 2 && (
        <div style={{ textAlign: "center", padding: "4px 20px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.05em" }}>
          Provide specific evidence to shift the belief meter
        </div>
      )}

      {/* Input area */}
      <div style={{ padding: "12px 16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "var(--bg)", flexShrink: 0 }}>
        {voiceMode ? (
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
      <div
        className={isUser ? "bubble-user" : "bubble-persona"}
        style={{
          maxWidth: "78%", padding: "11px 15px",
          background: isUser ? "rgba(255,255,255,0.06)" : persona.bg,
          border: `1px solid ${isUser ? "rgba(255,255,255,0.1)" : persona.border}`,
          fontSize: 14, lineHeight: 1.65,
          color: isUser ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.88)",
          marginLeft: isUser ? 0 : 8,
        }}
      >
        {msg.content}
        {streaming && <span style={{ animation: "pulse 1s infinite", display: "inline", color: persona.color }}>▋</span>}
      </div>
    </div>
  );
}

function TextInput({ value, onChange, onSend, onVoiceMode, isLoading, personaName, personaColor }) {
  const hasSR = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {hasSR && (
        <button onClick={onVoiceMode} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 16, flexShrink: 0 }}>
          🎙️
        </button>
      )}
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
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${listening ? "rgba(212,168,83,0.4)" : "var(--border)"}`,
        borderRadius: 14, padding: "12px 14px",
        minHeight: 52, marginBottom: 10, transition: "border-color 0.3s",
      }}>
        {transcript
          ? <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.65)", fontSize: 14, fontStyle: "italic" }}>{transcript}</span>
          : <span style={{ fontFamily: "var(--font-body)", color: "var(--text-dim)", fontSize: 13, fontStyle: "italic" }}>Speak your response...</span>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={listening ? onStop : onStart}
          style={{
            flex: 1, padding: "12px",
            background: listening ? "rgba(232,112,112,0.1)" : "rgba(212,168,83,0.08)",
            border: `1px solid ${listening ? "rgba(232,112,112,0.3)" : "rgba(212,168,83,0.2)"}`,
            borderRadius: 12, color: listening ? "#E87070" : "var(--gold)",
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {listening ? <><span style={{ animation: "pulse 1s infinite", display: "inline-block" }}>●</span> STOP</> : "● RECORD"}
        </button>
        {transcript && (
          <button onClick={onSend} disabled={isLoading} style={{ flex: 1, padding: "12px", background: personaColor, color: "#070707", border: "none", borderRadius: 12, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em" }}>
            SEND →
          </button>
        )}
        <button onClick={onTextMode} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 14, color: "var(--text-muted)" }}>
          ⌨️
        </button>
      </div>
    </div>
  );
}
