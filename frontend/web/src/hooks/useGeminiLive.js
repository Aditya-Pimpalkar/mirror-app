// src/hooks/useGeminiLive.js
// Manages the Gemini Live WebSocket connection for voice conversations

import { useState, useRef, useCallback, useEffect } from "react";
import { getIdToken } from "../lib/firebase";

const PERSONA_SERVICE_WS = process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL
  ?.replace("http://", "ws://")
  ?.replace("https://", "wss://");

export function useGeminiLive({ personaId, onMessage, onBeliefUpdate, onSessionReady, onError }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);

  // ── Connect to Gemini Live WebSocket ──────────────────────────────────────

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const token = await getIdToken();
      const wsUrl = `${PERSONA_SERVICE_WS}/live?token=${token}&persona=${personaId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[GeminiLive] Connected");
        setIsConnected(true);
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          await handleServerMessage(msg);
        } catch (err) {
          console.error("[GeminiLive] Message parse error:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("[GeminiLive] Disconnected:", event.code, event.reason);
        setIsConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
      };

      ws.onerror = (err) => {
        console.error("[GeminiLive] Error:", err);
        onError?.("Connection error. Please try again.");
        setIsConnected(false);
      };

    } catch (err) {
      console.error("[GeminiLive] Connect failed:", err);
      onError?.("Failed to connect. Please try again.");
    }
  }, [personaId]);

  // ── Handle messages from server ───────────────────────────────────────────

  const handleServerMessage = useCallback(async (msg) => {
    switch (msg.type) {
      case "session_ready":
        onSessionReady?.(msg);
        break;

      case "audio_chunk":
        // Queue audio chunk for playback
        audioQueueRef.current.push(msg.data);
        setIsSpeaking(true);
        if (!isPlayingRef.current) playNextAudioChunk();
        break;

      case "text_chunk":
        onMessage?.({ type: "chunk", text: msg.text });
        break;

      case "turn_complete":
        setIsSpeaking(false);
        onMessage?.({ type: "turn_complete", text: msg.text, belief: msg.belief });
        break;

      case "belief_update":
        onBeliefUpdate?.(msg);
        break;

      case "interrupted":
        setIsSpeaking(false);
        stopAudio();
        onMessage?.({ type: "interrupted" });
        break;

      case "error":
        onError?.(msg.message);
        break;

      case "session_closed":
        setIsConnected(false);
        break;
    }
  }, [onMessage, onBeliefUpdate, onSessionReady, onError]);

  // ── Audio playback ────────────────────────────────────────────────────────

  const playNextAudioChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const chunk = audioQueueRef.current.shift();
      const audioData = Uint8Array.from(atob(chunk), (c) => c.charCodeAt(0));
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => playNextAudioChunk();
      source.start();

    } catch (err) {
      console.error("[GeminiLive] Audio playback error:", err);
      playNextAudioChunk(); // Skip bad chunk
    }
  }, []);

  const stopAudio = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
      } catch {}
    }
  }, []);

  // ── Microphone input ──────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(",")[1];
            wsRef.current.send(JSON.stringify({
              type: "audio_input",
              mimeType: "audio/webm;codecs=opus",
              data: base64,
            }));
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.start(100); // Send chunks every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsListening(true);

    } catch (err) {
      console.error("[GeminiLive] Mic error:", err);
      onError?.("Microphone access denied. Please enable mic permissions.");
    }
  }, [onError]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ── Send text message (fallback) ──────────────────────────────────────────

  const sendText = useCallback((text) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "text_input", text }));
  }, []);

  // ── Send emotion frame ────────────────────────────────────────────────────

  const sendEmotionFrame = useCallback((emotion) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "emotion_frame", emotion }));
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    stopListening();
    stopAudio();
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "end_session" }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [stopListening, stopAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    isListening,
    isSpeaking,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendText,
    sendEmotionFrame,
  };
}
