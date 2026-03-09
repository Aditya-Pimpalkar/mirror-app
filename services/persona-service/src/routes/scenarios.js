/**
 * Scenario Prep Mode — routes
 * POST /scenarios/start — begin a scenario session
 * POST /scenarios/:sessionId/debrief — get all-4 debrief after session
 * GET  /scenarios/history — past scenario sessions
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { getFirestore } = require("../utils/firebase");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require("uuid");
const { PERSONAS } = require("../personas");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SCENARIOS = {
  faang_interview: {
    id: "faang_interview",
    title: "FAANG Technical Interview",
    description: "A senior engineer at a top tech company interviews you for a backend role.",
    persona: "recruiter",
    personaRole: "Senior Engineering Manager at a top tech company",
    icon: "💻",
    prompts: ["Walk me through your most complex system design.", "Tell me about a time you failed.", "Why are you leaving your current role?"],
  },
  investor_pitch: {
    id: "investor_pitch",
    title: "Investor Pitch",
    description: "A skeptical Series A investor hears your startup pitch.",
    persona: "journalist",
    personaRole: "Partner at a top-tier VC firm",
    icon: "💰",
    prompts: ["What's your moat?", "Why now?", "Why you?"],
  },
  salary_negotiation: {
    id: "salary_negotiation",
    title: "Salary Negotiation",
    description: "You're negotiating your offer with a hiring manager.",
    persona: "recruiter",
    personaRole: "Head of Talent at a fast-growing startup",
    icon: "💵",
    prompts: ["What are your salary expectations?", "We're at the top of our band already.", "Why should we stretch for you?"],
  },
  cofounder_conflict: {
    id: "cofounder_conflict",
    title: "Co-founder Difficult Conversation",
    description: "You need to address a serious misalignment with your co-founder.",
    persona: "date",
    personaRole: "Your co-founder of 2 years",
    icon: "🤝",
    prompts: ["I feel like we have different visions.", "I've been doing more than my share.", "We need to talk about equity."],
  },
  performance_review: {
    id: "performance_review",
    title: "Difficult Performance Review",
    description: "Your manager gives you critical feedback you disagree with.",
    persona: "recruiter",
    personaRole: "Your direct manager",
    icon: "📊",
    prompts: ["Your impact this quarter wasn't what we expected.", "You need to improve your communication.", "We're putting you on a PIP."],
  },
  media_interview: {
    id: "media_interview",
    title: "Press Interview",
    description: "A journalist asks tough questions about your company.",
    persona: "journalist",
    personaRole: "Investigative tech journalist",
    icon: "🎤",
    prompts: ["What do you say to critics who call your product predatory?", "Your growth numbers seem inflated.", "Why did three executives leave last year?"],
  },
};

// ─── GET /scenarios ───────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  res.json({ scenarios: Object.values(SCENARIOS) });
});

// ─── POST /scenarios/debrief ──────────────────────────────────────────────────
// After a scenario session, get debrief from all 4 personas
router.post("/debrief", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const { scenarioId, transcript, duration, userContext } = req.body;

  if (!scenarioId || !transcript) {
    return res.status(400).json({ error: "scenarioId and transcript required" });
  }

  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return res.status(404).json({ error: "Unknown scenario" });

  try {
    const db = getFirestore();

    // Get user profile
    const profileDoc = await db.collection("users").doc(userId)
      .collection("profile").doc("dossier").get();
    const profile = profileDoc.exists ? profileDoc.data() : {};
    const userName = profile.userName || "User";

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 600, temperature: 0.7, responseMimeType: "application/json" },
    });

    // Fan out debrief to all 4 personas in parallel
    const personaIds = ["recruiter", "date", "competitor", "journalist"];
    const debriefPromises = personaIds.map(async (personaId) => {
      const persona = PERSONAS[personaId];
      const result = await model.generateContent(`
You are ${persona.name}, a ${persona.role}, watching ${userName} do a "${scenario.title}" roleplay.

Scenario: ${scenario.description}
What they said: "${transcript.slice(0, 500)}"
Context: ${userContext || "No additional context"}
Duration: ${duration || "unknown"} seconds

From YOUR specific perspective (${persona.role}), give a debrief.

Return JSON:
{
  "score": <number 1-100>,
  "verdict": "<one sharp sentence verdict>",
  "strength": "<one specific thing they did well>",
  "weakness": "<one specific thing to improve>",
  "advice": "<one concrete actionable tip>"
}`);

      const data = JSON.parse(result.response.text());
      return { personaId, personaName: persona.name, personaEmoji: persona.emoji, personaColor: persona.color || "#D4A853", ...data };
    });

    const debriefs = await Promise.allSettled(debriefPromises);
    const results = debriefs
      .filter(d => d.status === "fulfilled")
      .map(d => d.value);

    // Overall score
    const avgScore = Math.round(results.reduce((s, d) => s + (d.score || 50), 0) / results.length);

    // Save to Firestore
    const sessionId = uuidv4();
    await db.collection("users").doc(userId)
      .collection("scenarios").add({
        sessionId,
        scenarioId,
        scenarioTitle: scenario.title,
        transcript: transcript.slice(0, 1000),
        avgScore,
        debriefs: results,
        createdAt: new Date().toISOString(),
      });

    res.json({ sessionId, scenarioId, scenarioTitle: scenario.title, avgScore, debriefs: results });

  } catch (err) {
    console.error("[scenarios/debrief]", err.message);
    res.status(500).json({ error: "Debrief failed" });
  }
});

// ─── GET /scenarios/history ───────────────────────────────────────────────────
router.get("/history", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const db = getFirestore();
    const snap = await db.collection("users").doc(userId)
      .collection("scenarios")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    const history = snap.docs.map(d => ({ id: d.id, ...d.data(), debriefs: undefined }));
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

module.exports = router;
module.exports.SCENARIOS = SCENARIOS;

// ─── POST /scenarios/chat ─────────────────────────────────────────────────────
router.post("/chat", requireAuth, async (req, res) => {
  const { scenarioId, message, history = [], userContext, userName, userProfile } = req.body;
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return res.status(404).json({ error: "Unknown scenario" });

  try {
    const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI2.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 300, temperature: 0.8 },
    });

    const persona = PERSONAS[scenario.persona];
    const systemPrompt = `You are playing the role of: ${scenario.personaRole} in a "${scenario.title}" scenario.
The person you are speaking with is: ${userName || "the user"}
${userProfile ? `Their background: ${userProfile}` : ""}
${userContext ? `Scenario context: ${userContext}` : ""}

Stay completely in character. Be realistic and challenging.
Do NOT break character. Keep responses to 2-4 sentences. Ask ONE follow-up question.`;

    const contents = [
      ...history.slice(-6),
      { role: "user", parts: [{ text: message }] },
    ];

    const result = await model.generateContent({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
    });
    res.json({ response: result.response.text().trim() });
  } catch (err) {
    console.error("[scenarios/chat]", err.message);
    res.status(500).json({ error: "Chat failed" });
  }
});
