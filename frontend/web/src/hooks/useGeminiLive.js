"use client";
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
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const micCtxRef = useRef(null);
  const gainNodeRef = useRef(null);

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const token = await getIdToken();
      const wsUrl = `${PERSONA_SERVICE_WS}/live?token=${token}&persona=${personaId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => { console.log("[Live] Connected"); setIsConnected(true); };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "session_ready") {
            onSessionReady?.(msg);
          } else if (msg.type === "audio_chunk") {
            audioQueueRef.current.push(msg.data);
            setIsSpeaking(true);
            if (!isPlayingRef.current) playNextChunk();
          } else if (msg.type === "text_chunk") {
            onMessage?.({ type: "chunk", text: msg.text });
          } else if (msg.type === "turn_complete") {
            setIsSpeaking(false);
            onMessage?.({ type: "turn_complete", text: msg.text, belief: msg.belief });
            onBeliefUpdate?.({ belief: msg.belief });
          } else if (msg.type === "user_transcript") {
            onMessage?.({ type: "user_transcript", text: msg.text, isFinal: msg.isFinal });
          } else if (msg.type === "persona_transcript") {
            onMessage?.({ type: "persona_transcript", text: msg.text, isFinal: msg.isFinal });
          } else if (msg.type === "interrupted") {
            // Stop all audio immediately
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            setIsSpeaking(false);
            if (audioContextRef.current) {
              try { audioContextRef.current.suspend(); } catch {}
              audioContextRef.current = null;
            }
            onMessage?.({ type: "interrupted" });
          } else if (msg.type === "session_closed") {
            setIsConnected(false);
          } else if (msg.type === "error") {
            onError?.(msg.message);
          }
        } catch (e) { console.error("[Live] Parse error:", e); }
      };

      ws.onclose = () => {
        console.log("[Live] Disconnected");
        setIsConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
        wsRef.current = null;
        stopMic();
      };

      ws.onerror = () => {
        onError?.("Connection error");
        setIsConnected(false);
      };
    } catch (e) {
      console.error("[Live] Connect failed:", e);
      onError?.("Failed to connect");
    }
  }, [personaId]);

  // ── Audio playback (PCM16 @ 24kHz) ───────────────────────────────────────
  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      if (gainNodeRef.current) gainNodeRef.current.gain.value = 1.0;
      return;
    }
    isPlayingRef.current = true;
    if (gainNodeRef.current) gainNodeRef.current.gain.value = 0.15;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const chunk = audioQueueRef.current.shift();
      const bytes = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;

      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => playNextChunk();
      src.start();
    } catch (e) {
      console.error("[Live] Playback error:", e);
      playNextChunk();
    }
  }, []);

  const stopAudio = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    // Suspend immediately to cut audio — faster than close
    if (audioContextRef.current) {
      try { audioContextRef.current.suspend(); } catch {}
      // Recreate context for next playback
      audioContextRef.current = null;
    }
  }, []);

  // ── Mic capture (PCM16 @ 16kHz) ──────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[Live] WS not open");
      return;
    }
    if (isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const micCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      micCtxRef.current = micCtx;

      const source = micCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        
        const pcm16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
        }
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        wsRef.current.send(JSON.stringify({
          type: "audio_input",
          mimeType: "audio/pcm;rate=16000",
          data: btoa(binary),
        }));
      };

      const gainNode = micCtx.createGain();
      gainNode.gain.value = 1.0;
      gainNodeRef.current = gainNode;
      source.connect(gainNode);
      gainNode.connect(processor);
      processor.connect(micCtx.destination);
      setIsListening(true);
      console.log("[Live] Mic started");
    } catch (e) {
      console.error("[Live] Mic error:", e);
      onError?.("Microphone access denied.");
    }
  }, [isListening, onError]);

  const stopMic = useCallback(() => {
    try { processorRef.current?.disconnect(); } catch {}
    try { gainNodeRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    gainNodeRef.current = null;
    try { micCtxRef.current?.close(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    processorRef.current = null;
    sourceRef.current = null;
    micCtxRef.current = null;
    streamRef.current = null;
    setIsListening(false);
  }, []);

  const stopListening = useCallback(() => {
    stopMic();
    console.log("[Live] Mic stopped");
  }, [stopMic]);

  const sendText = useCallback((text) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "text_input", text }));
  }, []);

  const disconnect = useCallback(() => {
    stopMic();
    stopAudio();
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "end_session" })); } catch {}
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [stopMic, stopAudio]);

  useEffect(() => () => disconnect(), []);

  return { isConnected, isListening, isSpeaking, connect, disconnect, startListening, stopListening, sendText };
}
