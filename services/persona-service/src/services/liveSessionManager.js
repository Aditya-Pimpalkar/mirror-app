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
const admin = require("firebase-admin");

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
  const today = new Date().toISOString().split("T")[0];
  const sessionDocId = `voice-${today}-${sessionId.slice(0, 8)}`;

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
    sessionDocId,
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
    isSpeaking: false,
  };

  activeSessions.set(sessionId, session);

  // ── Gemini WebSocket Handlers ──────────────────────────────

  geminiWs.on("open", () => {
    console.log(`[LiveSession:${sessionId}] Gemini WS connected`);

    // Send setup message — this is the Gemini Live API handshake
    // Setup format verified working — system_instruction must be at setup level
    geminiWs.send(JSON.stringify({
      setup: {
        model: "models/" + (process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-12-2025"),
        system_instruction: {
          parts: [{ text: systemPrompt + "\n\nIMPORTANT: Never output your thinking process or internal reasoning. Respond directly and conversationally only." }],
        },
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: voiceName || "Kore",
              },
            },
          },
        },

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

        return;
      }

      // ── Input transcription (what user said) ──
      if (msg.inputTranscription) {
        console.log("[Transcript] Input:", JSON.stringify(msg.inputTranscription));
      }
      if (msg.outputTranscription) {
        console.log("[Transcript] Output:", JSON.stringify(msg.outputTranscription));
      }
      if (msg.inputTranscription?.text) {
        const isFinal = msg.inputTranscription.isFinal || false;
        const text = msg.inputTranscription.text;
        safeSend(clientWs, {
          type: "user_transcript",
          text,
          isFinal,
        });
        // When Live returns a final transcription of what the user just said,
        // also log it server-side so unified threads include voice turns.
        if (isFinal && text?.trim()) {
          session.messages.push({
            role: "user",
            content: text.trim(),
            timestamp: new Date().toISOString(),
            mode: "voice",
            source: "voice",
          });
        }
      }

      // ── Output transcription (what persona said) ──
      if (msg.outputTranscription?.text) {
        const isFinal = msg.outputTranscription.isFinal || false;
        const text = msg.outputTranscription.text;
        safeSend(clientWs, {
          type: "persona_transcript",
          text,
          isFinal,
        });
        // Persist persona side of voice turns so unified thread includes it.
        if (isFinal && text?.trim()) {
          session.messages.push({
            role: "assistant",
            content: text.trim(),
            timestamp: new Date().toISOString(),
            mode: "voice",
            source: "voice",
          });
        }
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
            // Skip thinking/reasoning parts
            if (part.thought === true) continue;
            if (part.inlineData) {
              // Audio chunk — forward directly to client
              safeSend(clientWs, {
                type: "audio_chunk",
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data,
              });
              // Mark persona as currently speaking so we can interrupt on new user input.
              session.isSpeaking = true;
            }
            if (part.text && part.thought !== true) {
              // Text chunk — forward and accumulate for logging
              session._currentResponseText = (session._currentResponseText || "") + part.text;
              safeSend(clientWs, {
                type: "text_chunk",
                text: part.text,
              });
            }
          }
        }

        if (turnComplete) {
          const fullResponse = session._currentResponseText || "";
          session._currentResponseText = "";
          const belief = session.currentBelief;
          // Track turn count
          session._turnCount = (session._turnCount || 0) + 1;
          console.log(`[LiveSession:${sessionId}] Turn complete #${session._turnCount}, belief: ${belief}`);
          // Log assistant text for unified thread if we have any.
          if (fullResponse?.trim()) {
            session.messages.push({
              role: "assistant",
              content: fullResponse.trim(),
              timestamp: new Date().toISOString(),
              mode: "text",
            });
          }
          // Notify client UI.
          safeSend(clientWs, { type: "turn_complete", text: fullResponse || null, belief });
          // Persona finished speaking for this turn.
          session.isSpeaking = false;
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

  clientWs.on("close", async () => {
    console.log(`[LiveSession:${sessionId}] Client disconnected — generating summary`);

    const turnCount = session._turnCount || 0;
    if (turnCount > 0) {
      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          generationConfig: { maxOutputTokens: 400, temperature: 0.2 },
        });

        const persona = PERSONAS[session.personaId];
        const allMessages = session.messages || [];
        const userMsgs = allMessages
          .filter((m) => m.role === "user" && m.content)
          .map((m) => m.content)
          .join(" | ");
        const agentMsgs = allMessages
          .filter((m) => m.role === "assistant" && m.content)
          .map((m) => m.content)
          .join(" | ");

        const result = await model.generateContent(
          `You are ${persona?.name || session.personaId}, a ${persona?.role || "persona"} in Mirror app.
You just had a real-time voice conversation with ${session.userName || "the user"} (${turnCount} turns).

What the user said (SpeechRecognition captions):
${userMsgs ? `"${userMsgs.slice(0, 1800)}"` : "No user captions were captured."}

What you (the persona) said (may be partial):
${agentMsgs ? `"${agentMsgs.slice(0, 1800)}"` : "No persona text was captured during the live audio session."}

Write 2-3 sentences summarizing this conversation from your perspective.
Stay in character. No preamble.`
        );

        const summary = result.response.text().trim();
        if (summary) {
          session.messages.push({
            role: "assistant",
            content: `[Voice session — ${turnCount} turns]\n\n${summary}`,
            timestamp: new Date().toISOString(),
            mode: "voice_summary",
          });
        }
      } catch (err) {
        console.error("[Summary]", err.message);
      }
    }

    try {
      console.log(`[DEBUG] Persisting session with ${session.messages.length} messages`);
      await persistSession(sessionId);
    } catch (err) {
      console.error(`[LiveSession:${sessionId}] Persist on close failed:`, err);
    }
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
    // ── User caption (SpeechRecognition) ──
    case "user_caption": {
      const text = msg.text?.trim();
      if (!text) return;

      // If persona is mid-sentence, force an interrupt on the client side.
      if (session.isSpeaking) {
        safeSend(session.clientWs, { type: "interrupted" });
        session.isSpeaking = false;
      }

      // Log the caption as a voice user message.
      session.messages.push({
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        mode: "voice",
        source: "voice",
      });

      // Treat captions as semantic text input to Gemini so emotion + evidence
      // can shape the persona's next turn, just like typed messages.
      if (geminiWs.readyState !== WebSocket.OPEN || !session.isReady) return;

      const score = scoreMessage(session.personaId, text);
      const newBelief = Math.min(95, Math.max(5, session.currentBelief + score.evidenceScore));
      session.currentBelief = newBelief;

      // Inject emotion signal if we have recent camera data.
      let messageText = text;
      if (session._latestEmotionSignal) {
        const emotion = session._latestEmotionSignal;
        if (emotion.dominant_emotion !== "neutral" && emotion.intensity > 0.5) {
          messageText += `\n\n[PRIVATE CONTEXT FOR YOU, ${session.persona?.name || "the persona"}:\nThe user's facial expression shows ${emotion.dominant_emotion} (intensity ${emotion.intensity}). ${emotion.notable || ""}\nIf their words and expression seem mismatched, you may gently name the hesitation or discomfort in your next response and invite them to reflect on it.]`;
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

      safeSend(session.clientWs, {
        type: "belief_update",
        belief: newBelief,
        delta: score.evidenceScore,
        hasEvidence: score.hasEvidence,
        isEmotional: score.isEmotional,
      });
      break;
    }

    // ── Audio from user's microphone ──
    case "audio_input": {
      if (geminiWs.readyState !== WebSocket.OPEN) return;
      if (!session.isReady) return;
      // If persona is currently speaking, cut them off visually on the client.
      if (session.isSpeaking) {
        safeSend(session.clientWs, { type: "interrupted" });
        session.isSpeaking = false;
      }

      geminiWs.send(JSON.stringify({
        realtime_input: {
          media_chunks: [{
            mime_type: "audio/pcm;rate=16000",
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

      // Log user message (ONCE)
      session.messages.push({
        role: "user",
        content: msg.text.trim(),
        timestamp: new Date().toISOString(),
        mode: "text",
        evidenceScore: score.evidenceScore,
        hasEvidence: score.hasEvidence,
      });

      // Inject emotion signal if we have recent camera data
      let messageText = msg.text;
      if (session._latestEmotionSignal && score.hasEvidence === false) {
        const emotion = session._latestEmotionSignal;
        if (emotion.dominant_emotion !== "neutral" && emotion.intensity > 0.5) {
          messageText += `\n\n[PRIVATE CONTEXT FOR YOU, ${session.persona?.name || "the persona"}:\nThe user's facial expression shows ${emotion.dominant_emotion} (intensity ${emotion.intensity}). ${emotion.notable || ""}\nIf their words and expression seem mismatched, you may gently name the hesitation or discomfort in your next response and invite them to reflect on it.]`;
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
      // Store emotion signal to inject into next Gemini message
      session._latestEmotionSignal = {
        observation: msg.observation,
        dominant_emotion: msg.dominant_emotion,
        intensity: msg.intensity || 0.7,
      };
      console.log(`[LiveSession:${sessionId}] Emotion signal: ${msg.dominant_emotion} — ${msg.observation?.slice(0, 60)}`);
      break;
    }

    // ── End session (signal only; persistence happens on clientWs.close) ──
    case "end_session": {
      // No-op: we let clientWs.on("close") generate summary and persist once.
      break;
    }
  }
}

/**
 * Persist the completed session to Firestore.
 */
async function persistSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  if (session.messages.length === 0) return;

  try {
    const db = getFirestore();
    const sessionRef = db
      .collection("users").doc(session.userId)
      .collection("personas").doc(session.personaId)
      .collection("sessions").doc(session.sessionDocId || sessionId);

    await sessionRef.set({
      sessionId: session.sessionDocId || sessionId,
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
      mode: "voice",
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
