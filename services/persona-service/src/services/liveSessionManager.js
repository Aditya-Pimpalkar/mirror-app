/**
 * mirror/services/persona-service/src/services/liveSessionManager.js
 *
 * Manages Gemini Live API WebSocket sessions.
 * Each user-persona pair gets its own live session.
 *
 * Flow:
 *   Client (browser/app) <──WS──> Our Server <──WS──> Gemini Live API
 *
 * This proxy approach lets us:
 * - Inject persona system prompts
 * - Log all messages to Firestore
 * - Calculate belief scores in real time
 * - Detect face emotion signals and inject them into the conversation
 */

const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const { getLiveApiConfig, PERSONA_VOICES } = require("../utils/gemini");
const { PERSONAS, scoreMessage } = require("../personas");
const { getFirestore } = require("../utils/firebase");

// Active sessions: sessionId -> { geminiWs, clientWs, metadata }
const activeSessions = new Map();

const GEMINI_LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/**
 * Initialize a new Gemini Live session for a user-persona pair.
 * Called when a user taps a persona card to start a voice conversation.
 */
async function createLiveSession({ clientWs, userId, personaId, dossier, userName }) {
  const sessionId = uuidv4();
  const persona = PERSONAS[personaId];

  if (!persona) {
    clientWs.send(JSON.stringify({ type: "error", message: `Unknown persona: ${personaId}` }));
    return null;
  }

  console.log(`[LiveSession] Creating session ${sessionId} for user ${userId}, persona ${personaId}`);

  // Build the system prompt with user's dossier
  const systemPrompt = persona.systemPrompt(userName, dossier);
  const voiceName = PERSONA_VOICES[personaId];
  const liveConfig = getLiveApiConfig(systemPrompt, voiceName);

  // Connect to Gemini Live API
  const geminiWsUrl = `${GEMINI_LIVE_URL}?key=${process.env.GEMINI_API_KEY}`;
  const geminiWs = new WebSocket(geminiWsUrl);

  const session = {
    sessionId,
    userId,
    personaId,
    persona,
    userName,
    clientWs,
    geminiWs,
    startedAt: new Date().toISOString(),
    messages: [],
    currentBelief: persona.initialBelief,
    emotionSignals: [],
    isReady: false,
  };

  activeSessions.set(sessionId, session);

  // ── Gemini WebSocket Handlers ──────────────────────────────

  geminiWs.on("open", () => {
    console.log(`[LiveSession:${sessionId}] Gemini WS connected`);

    // Send setup message — this is the Gemini Live API handshake
    geminiWs.send(JSON.stringify({
      setup: {
        model: liveConfig.model,
        generation_config: liveConfig.config,
      },
    }));
  });

  geminiWs.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // ── Setup complete ──
      if (msg.setupComplete) {
        session.isReady = true;
        console.log(`[LiveSession:${sessionId}] Setup complete`);

        // Tell the client the session is live
        safeSend(clientWs, {
          type: "session_ready",
          sessionId,
          personaId,
          personaName: persona.name,
          openingLine: persona.opening(userName.split(" ")[0]),
          initialBelief: session.currentBelief,
        });

        // Send the opening line as text to be spoken
        geminiWs.send(JSON.stringify({
          client_content: {
            turns: [{
              role: "user",
              parts: [{ text: `[Start the conversation with your opening line for ${userName}. Stay completely in character.]` }],
            }],
            turn_complete: true,
          },
        }));
        return;
      }

      // ── Server content (audio/text chunks from Gemini) ──
      if (msg.serverContent) {
        const { modelTurn, turnComplete, interrupted } = msg.serverContent;

        if (interrupted) {
          // User interrupted the persona mid-sentence
          safeSend(clientWs, { type: "interrupted" });
          console.log(`[LiveSession:${sessionId}] Interrupted by user`);
          return;
        }

        if (modelTurn?.parts) {
          for (const part of modelTurn.parts) {
            if (part.inlineData) {
              // Audio chunk — forward directly to client
              safeSend(clientWs, {
                type: "audio_chunk",
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data,
              });
            }
            if (part.text) {
              // Text chunk — forward and accumulate for logging
              session._currentResponseText = (session._currentResponseText || "") + part.text;
              safeSend(clientWs, {
                type: "text_chunk",
                text: part.text,
              });
            }
          }
        }

        if (turnComplete && session._currentResponseText) {
          // Persona finished speaking — log the full turn
          const fullResponse = session._currentResponseText;
          session._currentResponseText = "";

          session.messages.push({ role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });

          safeSend(clientWs, {
            type: "turn_complete",
            text: fullResponse,
            belief: session.currentBelief,
          });

          console.log(`[LiveSession:${sessionId}] Turn complete, belief: ${session.currentBelief}`);
        }
      }

      // ── Tool calls (if we add function calling later) ──
      if (msg.toolCall) {
        console.log(`[LiveSession:${sessionId}] Tool call:`, msg.toolCall);
      }

    } catch (err) {
      console.error(`[LiveSession:${sessionId}] Error processing Gemini message:`, err);
    }
  });

  geminiWs.on("close", (code, reason) => {
    console.log(`[LiveSession:${sessionId}] Gemini WS closed: ${code} ${reason}`);
    safeSend(clientWs, { type: "session_closed", reason: "gemini_disconnected" });
    cleanupSession(sessionId);
  });

  geminiWs.on("error", (err) => {
    console.error(`[LiveSession:${sessionId}] Gemini WS error:`, err);
    safeSend(clientWs, { type: "error", message: "Live session error. Please retry." });
    cleanupSession(sessionId);
  });

  // ── Client WebSocket Handlers ──────────────────────────────

  clientWs.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      await handleClientMessage(sessionId, msg);
    } catch (err) {
      console.error(`[LiveSession:${sessionId}] Error handling client message:`, err);
    }
  });

  clientWs.on("close", () => {
    console.log(`[LiveSession:${sessionId}] Client disconnected`);
    persistSession(sessionId);
    cleanupSession(sessionId);
  });

  return sessionId;
}

/**
 * Handle messages from the client (browser/app).
 */
async function handleClientMessage(sessionId, msg) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { geminiWs } = session;

  switch (msg.type) {
    // ── Audio from user's microphone ──
    case "audio_input": {
      if (geminiWs.readyState !== WebSocket.OPEN) return;
      geminiWs.send(JSON.stringify({
        realtime_input: {
          media_chunks: [{
            mime_type: msg.mimeType || "audio/pcm;rate=16000",
            data: msg.data,
          }],
        },
      }));
      break;
    }

    // ── Text message (fallback for non-voice) ──
    case "text_input": {
      if (!msg.text?.trim()) return;
      if (geminiWs.readyState !== WebSocket.OPEN) return;

      // Score the message for evidence/pushback
      const score = scoreMessage(session.personaId, msg.text);

      // Update belief
      const newBelief = Math.min(95, Math.max(5, session.currentBelief + score.evidenceScore));
      session.currentBelief = newBelief;

      // Log user message
      session.messages.push({
        role: "user",
        content: msg.text,
        timestamp: new Date().toISOString(),
        evidenceScore: score.evidenceScore,
        hasEvidence: score.hasEvidence,
      });

      // Inject emotion signal if we have recent camera data
      let messageText = msg.text;
      if (session._latestEmotionSignal && score.hasEvidence === false) {
        const emotion = session._latestEmotionSignal;
        if (emotion.dominant_emotion !== "neutral" && emotion.intensity > 0.5) {
          messageText += `\n\n[PRIVATE CONTEXT — DO NOT MENTION DIRECTLY unless it's natural: The person's facial expression shows ${emotion.dominant_emotion} (intensity: ${emotion.intensity}). ${emotion.notable || ""}. Their body language may be incongruent with their words.]`;
        }
      }

      geminiWs.send(JSON.stringify({
        client_content: {
          turns: [{
            role: "user",
            parts: [{ text: messageText }],
          }],
          turn_complete: true,
        },
      }));

      // Send belief update to client
      safeSend(session.clientWs, {
        type: "belief_update",
        belief: newBelief,
        delta: score.evidenceScore,
        hasEvidence: score.hasEvidence,
        isEmotional: score.isEmotional,
      });
      break;
    }

    // ── Camera emotion frame ──
    case "emotion_frame": {
      // Store latest emotion signal to inject into next Gemini message
      session._latestEmotionSignal = msg.emotion;
      session.emotionSignals.push({
        ...msg.emotion,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    // ── End session ──
    case "end_session": {
      await persistSession(sessionId);
      cleanupSession(sessionId);
      break;
    }
  }
}

/**
 * Persist the completed session to Firestore.
 */
async function persistSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || session.messages.length === 0) return;

  try {
    const db = getFirestore();
    const sessionRef = db
      .collection("users").doc(session.userId)
      .collection("personas").doc(session.personaId)
      .collection("sessions").doc(sessionId);

    await sessionRef.set({
      sessionId,
      personaId: session.personaId,
      userId: session.userId,
      messages: session.messages,
      finalBelief: session.currentBelief,
      initialBelief: session.persona.initialBelief,
      beliefDelta: session.currentBelief - session.persona.initialBelief,
      emotionSignals: session.emotionSignals,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      messageCount: session.messages.length,
    });

    // Update persona summary doc
    const personaRef = db
      .collection("users").doc(session.userId)
      .collection("personas").doc(session.personaId);

    await personaRef.set({
      personaId: session.personaId,
      currentBelief: session.currentBelief,
      lastSessionAt: new Date().toISOString(),
      conversationCount: admin.firestore.FieldValue.increment(1),
    }, { merge: true });

    console.log(`[LiveSession:${sessionId}] Persisted to Firestore`);
  } catch (err) {
    console.error(`[LiveSession:${sessionId}] Failed to persist session:`, err);
  }
}

function cleanupSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try { session.geminiWs?.close(); } catch {}
  activeSessions.delete(sessionId);
  console.log(`[LiveSession:${sessionId}] Cleaned up. Active sessions: ${activeSessions.size}`);
}

function safeSend(ws, data) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function getActiveSessionCount() {
  return activeSessions.size;
}

module.exports = { createLiveSession, getActiveSessionCount };
