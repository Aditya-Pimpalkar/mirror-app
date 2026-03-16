"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useMirrorStore } from "../../store";
import { streamChat } from "../../lib/api";
import { useGeminiLive } from "../../hooks/useGeminiLive";
import { useEmotionCamera } from "../../hooks/useEmotionCamera";
import { BeliefBar, PersonaAvatar, LoadingDots, PERSONAS } from "../ui";
import ShareVerdict from "../ShareVerdict";

export default function Chat() {
  const {
    activePersonaId, conversations, beliefs, completedPersonas,
    addMessage, setConversation, setScreen, updateBelief, markPersonaComplete, profile, updateStreak,
  } = useMirrorStore();

  const persona = PERSONAS[activePersonaId];
  const messages = conversations[activePersonaId] || [];

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [shareVerdict, setShareVerdict] = useState(null);
  const [emotionEnabled, setEmotionEnabled] = useState(false);
  const [videoPos, setVideoPos] = useState({ x: 16, y: 120 }); // offset from bottom-right
  const dragStateRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 16, origY: 120 });
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const loadedPersonasRef = useRef(new Set());
  const openingAddedRef = useRef(new Set());

  const belief = beliefs[activePersonaId] || persona?.initialBelief || 20;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, isLoading]);

  // Load unified thread (voice + text) from backend
  useEffect(() => {
    if (!persona) return;
    if (loadedPersonasRef.current.has(activePersonaId)) return;
    loadedPersonasRef.current.add(activePersonaId);

    const loadThread = async () => {
      try {
        const { getIdToken } = await import("../../lib/firebase.js");
        const token = await getIdToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL}/personas/${activePersonaId}/thread`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages?.length > 0) {
          setConversation(activePersonaId, data.messages);
        }
      } catch {}
    };
    loadThread();
  }, [activePersonaId]);

  // Opening message — only once
  useEffect(() => {
    if (!persona || openingAddedRef.current.has(activePersonaId)) return;
    const realMessages = (conversations[activePersonaId] || []).filter(m => m.mode !== "voice_summary");
    if (realMessages.length > 0) return;
    openingAddedRef.current.add(activePersonaId);
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
  const { isConnected, isListening: liveListening, isSpeaking, connect, disconnect, startListening: startLive, stopListening: stopLive, sendText, sendCaption, sendEmotion } = useGeminiLive({
    personaId: activePersonaId,
    onMessage: (msg) => {
      if (msg.type === "chunk") {
        setStreamingText((prev) => prev + msg.text);
      } else if (msg.type === "turn_complete") {
        setStreamingText("");
        if (msg.belief) updateBelief(activePersonaId, msg.belief);
        // For audio-only Live sessions, msg.text is typically empty; only add if present.
        if (msg.text?.trim()) {
          addMessage(activePersonaId, { role: "assistant", content: msg.text.trim(), timestamp: new Date().toISOString(), mode: "voice" });
        }
      } else if (msg.type === "user_transcript" && msg.isFinal && msg.text?.trim()) {
        addMessage(activePersonaId, { role: "user", content: msg.text, timestamp: new Date().toISOString(), mode: "voice" });
      } else if (msg.type === "persona_transcript" && msg.isFinal && msg.text?.trim()) {
        addMessage(activePersonaId, { role: "assistant", content: msg.text, timestamp: new Date().toISOString(), mode: "voice" });
        setStreamingText("");
      } else if (msg.type === "session_summary") {
        if (msg.text?.trim()) {
          addMessage(activePersonaId, {
            role: "assistant",
            content: `[Voice session — ${msg.turns} turns]\n\n${msg.text}`,
            timestamp: new Date().toISOString(),
            mode: "voice_summary"
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

  // Browser SpeechRecognition captions during Live voice:
  // Show in chat immediately and persist to backend via WS (user_caption).
  useEffect(() => {
    if (!isConnected) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      if (!result?.isFinal) return;
      const text = result[0]?.transcript?.trim();
      if (!text) return;
      addMessage(activePersonaId, {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        mode: "voice",
      });
      sendCaption?.(text);
    };

    rec.onend = () => {
      // Auto-restart so it keeps listening throughout the session
      if (isConnected) {
        try { rec.start(); } catch {}
      }
    };

    rec.onerror = (e) => {
      if (e.error !== "aborted" && isConnected) {
        try { rec.start(); } catch {}
      }
    };

    try { rec.start(); } catch {}

    return () => {
      try { rec.abort(); } catch {}
    };
  }, [isConnected, activePersonaId]);

  // After Live voice ends, mark thread as stale so it reloads on next entry.
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = isConnected;
    if (wasConnected && !isConnected) {
      // Mark this persona's thread as stale so it reloads next time chat opens
      loadedPersonasRef.current.delete(activePersonaId);
    }
  }, [isConnected, activePersonaId]);

  const handleEmotion = useCallback((obs) => {
    console.log("[Emotion]", obs);
    if (isConnected) sendEmotion?.(obs);
  }, [isConnected, sendEmotion]);

  const { latestEmotion, startCamera, stopCamera, videoRef, canvasRef, isActive, permission } = useEmotionCamera({
    personaId: activePersonaId,
    enabled: emotionEnabled,
    onEmotionDetected: handleEmotion,
  });

  // If Live voice disconnects, automatically stop camera + face reading.
  useEffect(() => {
    if (!isConnected && emotionEnabled) {
      stopCamera();
      setEmotionEnabled(false);
    }
  }, [isConnected, emotionEnabled, stopCamera]);

  const beginDragVideo = useCallback((e) => {
    if (!emotionEnabled || !isActive) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStateRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      origX: videoPos.x,
      origY: videoPos.y,
    };
  }, [emotionEnabled, isActive, videoPos.x, videoPos.y]);

  useEffect(() => {
    function onMove(e) {
      if (!dragStateRef.current.dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragStateRef.current.startX;
      const dy = clientY - dragStateRef.current.startY;
      const nextX = Math.max(8, dragStateRef.current.origX - dx);
      const nextY = Math.max(8, dragStateRef.current.origY - dy);
      setVideoPos({ x: nextX, y: nextY });
    }
    function endDrag() {
      if (dragStateRef.current.dragging) {
        dragStateRef.current.dragging = false;
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", endDrag);
    };
  }, []);

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
    // Always mark streak for talking today
    updateStreak(activePersonaId, true);
    // Clear loaded flag so thread reloads next time chat opens
    loadedPersonasRef.current.delete(activePersonaId);
    // Navigate home after delay
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
          <ChatBubble key={i} msg={msg} persona={persona} onShare={(q) => setShareVerdict(q)} />
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

      {/* Emotion indicator */}
      {latestEmotion && emotionEnabled && (
        <div style={{
          margin: "0 16px 8px",
          padding: "8px 14px",
          background: "rgba(107,163,214,0.06)",
          border: "1px solid rgba(107,163,214,0.2)",
          borderRadius: 10,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>👁</span>
          <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.55)", fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>
            {latestEmotion}
          </span>
        </div>
      )}

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
        {isConnected && (
          <button
            onClick={() => {
              if (emotionEnabled) { 
                stopCamera(); 
                setEmotionEnabled(false); 
              } else { 
                setEmotionEnabled(true);
                startCamera(); 
              }
            }}
            style={{
              marginTop: 8, padding: "8px 14px", width: "100%",
              background: emotionEnabled ? "rgba(107,163,214,0.1)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${emotionEnabled ? "rgba(107,163,214,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10,
              color: emotionEnabled ? "#6BA3D6" : "rgba(255,255,255,0.3)",
              letterSpacing: "0.1em",
            }}
          >
            {emotionEnabled && isActive ? "📷 READING FACE — TAP TO STOP" : 
               emotionEnabled && permission === "denied" ? "📷 CAMERA DENIED — CHECK PERMISSIONS" :
               "📷 ENABLE FACE READING"}
          </button>
        )}
      </div>
      {/* Camera elements — preview (draggable). Always mount when enabled so stream can attach. */}
      {emotionEnabled && (
        <div
          onMouseDown={beginDragVideo}
          onTouchStart={beginDragVideo}
          style={{
            position: "fixed",
            bottom: videoPos.y,
            right: videoPos.x,
            width: 220,
            height: 165,
            borderRadius: 12,
            border: "1px solid rgba(107,163,214,0.5)",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            zIndex: 50,
            background: "black",
            cursor: "grab",
            touchAction: "none",
            opacity: isActive ? 1 : 0.6,
          }}
        >
          <video
            ref={videoRef}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
            playsInline
          />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Share Verdict modal */}
      {shareVerdict && (
        <ShareVerdict
          personaId={activePersonaId}
          quote={shareVerdict}
          onClose={() => setShareVerdict(null)}
        />
      )}
    </div>
  );
}

function ChatBubble({ msg, persona, streaming, onShare }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14, animation: "fadeUp 0.3s ease" }}>
      {!isUser && <PersonaAvatar persona={persona} size={30} style={{ marginRight: 8, marginTop: 2, flexShrink: 0 }} />}
      <div style={{ maxWidth: "78%", marginLeft: isUser ? 0 : 8 }}>
        <div style={{
          padding: "11px 15px",
          background: isUser ? "rgba(255,255,255,0.06)" : persona.bg,
          border: `1px solid ${isUser ? "rgba(255,255,255,0.1)" : persona.border}`,
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          fontSize: 14, lineHeight: 1.65,
          color: isUser ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.88)",
          fontFamily: "var(--font-body)", fontStyle: isUser ? "normal" : "italic",
        }}>
          {msg.content}
          {streaming && <span style={{ animation: "pulse 1s infinite", display: "inline", color: persona.color }}>▋</span>}
          {msg.source === "voice" && (
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>VOICE</div>
          )}
        </div>
        {!isUser && !streaming && onShare && msg.content?.length > 30 && (
          <button
            onClick={() => onShare(msg.content)}
            style={{ marginTop: 4, padding: "3px 10px", background: "none", border: "none", fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", cursor: "pointer" }}
          >
            ↗ SHARE VERDICT
          </button>
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
