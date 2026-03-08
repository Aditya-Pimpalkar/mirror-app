// src/hooks/useEmotionCamera.js
// Captures camera frames and analyzes facial emotions via Gemini Vision

import { useState, useRef, useCallback, useEffect } from "react";
import { getIdToken } from "../lib/firebase";

const PERSONA_URL = process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL;
const CAPTURE_INTERVAL_MS = 3000; // Capture every 3 seconds

export function useEmotionCamera({ personaId, onEmotionDetected, enabled = true }) {
  const [isActive, setIsActive] = useState(false);
  const [permission, setPermission] = useState("unknown"); // unknown | granted | denied
  const [latestEmotion, setLatestEmotion] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // ── Start camera ──────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    if (!enabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setPermission("granted");
      setIsActive(true);

      // Start capturing frames
      intervalRef.current = setInterval(() => captureAndAnalyze(), CAPTURE_INTERVAL_MS);

    } catch (err) {
      console.error("[EmotionCamera] Camera error:", err);
      setPermission("denied");
    }
  }, [enabled, personaId]);

  // ── Capture a frame and send for analysis ─────────────────────────────────

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      canvas.width = 320;
      canvas.height = 240;
      ctx.drawImage(video, 0, 0, 320, 240);

      // Convert to base64 JPEG
      const base64Frame = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];

      // Send to Gemini Vision via backend
      const token = await getIdToken();
      const res = await fetch(`${PERSONA_URL}/personas/${personaId}/analyze-emotion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ frame: base64Frame }),
      });

      if (!res.ok) return;
      const { emotion } = await res.json();

      if (emotion) {
        setLatestEmotion(emotion);
        onEmotionDetected?.(emotion);
      }

    } catch (err) {
      // Silent fail — emotion capture is enhancement, not critical
      console.debug("[EmotionCamera] Capture error:", err.message);
    }
  }, [personaId, onEmotionDetected]);

  // ── Stop camera ───────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    setLatestEmotion(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  return {
    isActive,
    permission,
    latestEmotion,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
  };
}
