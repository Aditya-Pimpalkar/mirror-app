/**
 * mirror/services/persona-service/src/utils/gemini.js
 *
 * Gemini client wrapper for:
 * 1. Standard text generation (Gemini 1.5 Pro)
 * 2. Gemini Live API (real-time streaming voice)
 *
 * Uses @google/generative-ai SDK as required by hackathon.
 */

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// ─── Client Setup ────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// ─── Standard Generation (Gemini 1.5 Pro) ───────────────────────────────────

/**
 * Generate a persona response for a given conversation turn.
 * Used for text-based fallback when Live API is unavailable.
 */
async function generatePersonaResponse(systemPrompt, conversationHistory, maxOutputTokens = 800) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.85,      // Some creativity but consistent character
      topP: 0.9,
      topK: 40,
    },
  });

  // Convert our message format to Gemini's format
  const contents = conversationHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const result = await model.generateContent({ contents });
  const response = result.response;

  if (!response) throw new Error("Empty response from Gemini");

  // Check for safety blocks
  if (response.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked response: ${response.promptFeedback.blockReason}`);
  }

  return response.text();
}

/**
 * Stream a persona response — used for real-time text streaming.
 */
async function streamPersonaResponse(systemPrompt, conversationHistory, onChunk) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.85,
    },
  });

  const contents = conversationHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const result = await model.generateContentStream({ contents });

  let fullText = "";
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullText += chunkText;
    if (onChunk) onChunk(chunkText);
  }

  return fullText;
}

// ─── Gemini Live API (Real-time Voice) ──────────────────────────────────────

/**
 * Creates a Gemini Live API session configuration.
 * The actual WebSocket connection is managed by LiveSessionManager.
 *
 * Gemini Live API endpoint:
 * wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
 */
function getLiveApiConfig(systemPrompt, personaVoice) {
  return {
    model: process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-12-2025",
    setup: {
      model: "models/" + (process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-12-2025"),
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      generation_config: {
        response_modalities: ["AUDIO"],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: personaVoice || "Kore",
            },
          },
        },
      },
    },
  };
}

// Map persona IDs to Gemini voice names
// Different voices give distinct character feel
const PERSONA_VOICES = {
  recruiter: "Kore",     // Professional, measured female
  date:      "Aoede",    // Warm, natural female
  competitor: "Charon",  // Flat, analytical male
  journalist: "Fenrir",  // Deliberate, thoughtful male
};

// ─── Vision / Emotion Analysis ───────────────────────────────────────────────

/**
 * Analyze a face frame for emotional state.
 * Takes a base64-encoded JPEG frame from the user's camera.
 * Returns structured emotion data.
 */
async function analyzeFaceEmotion(base64ImageFrame) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 800,
      temperature: 0.2, // Low temperature for factual observation
      responseMimeType: "application/json",
    },
  });

  const prompt = `Analyze this person's facial expression and body language.
Return ONLY a JSON object with this exact structure, no markdown:
{
  "dominant_emotion": "one of: neutral, engaged, uncomfortable, uncertain, defensive, confident, surprised, withdrawn",
  "intensity": 0.0-1.0,
  "engagement": "high|medium|low",
  "congruence_signal": "what this expression might mean in context of a difficult conversation",
  "notable": "one specific observable thing (e.g. 'looked away', 'jaw tension', 'leaning back') or null"
}`;

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64ImageFrame,
          },
        },
        { text: prompt },
      ],
    }],
  });

  const text = result.response.text();
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

/**
 * Generate a perception map synthesis using Gemini.
 * Takes all conversation data and produces structured insights.
 */
async function generatePerceptionMap(userName, userBio, conversationSummaries, beliefScores) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });

  const prompt = `You are synthesizing a Perception Map for ${userName}.

USER BIO: ${userBio}

CONVERSATION SUMMARIES AND BELIEF SCORES:
${conversationSummaries}

BELIEF SCORES (0-100, higher = more convinced):
Rachel (Recruiter): ${beliefScores.recruiter}/100
Alex (First Date): ${beliefScores.date}/100
Chris (Competitor): ${beliefScores.competitor}/100
Jordan (Journalist): ${beliefScores.journalist}/100

Generate a brutally honest, empathetic perception map. Return ONLY valid JSON:
{
  "headline": "one honest 10-12 word summary of how the world perceives them",
  "consensus": "what all four personas agree on, 2 sentences",
  "gap": "the most significant gap between self-perception and external reality, 2 sentences",
  "blindspot": "the single most important thing they are not seeing about themselves, 1 sentence",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "risks": ["perception risk 1", "perception risk 2"],
  "verdicts": {
    "recruiter": "Rachel's 2-sentence final assessment",
    "date": "Alex's 2-sentence final assessment",
    "competitor": "Chris's 2-sentence final assessment",
    "journalist": "Jordan's 2-sentence final assessment"
  },
  "archetype": {
    "id": "one of: vault|spark|contractor|ghost|overexposed|architect",
    "confidence": 0.0-1.0,
    "reasoning": "1 sentence explaining why"
  },
  "question": "the single most important question for them to sit with — make it uncomfortable and specific"
}`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
}

module.exports = {
  genAI,
  generatePersonaResponse,
  streamPersonaResponse,
  getLiveApiConfig,
  PERSONA_VOICES,
  analyzeFaceEmotion,
  generatePerceptionMap,
};
