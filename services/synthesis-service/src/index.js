/**
 * mirror/services/synthesis-service/src/index.js
 *
 * Mirror Synthesis Service
 * Handles: Perception Maps, Gap Score, Weekly Reports, Archetypes, Mirror Moments
 * PORT: 8082
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const app = express();
const PORT = process.env.PORT || 8082;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));
app.use(express.json());

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = await admin.auth().verifyIdToken(token); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
}

// ─── Archetype Definitions ───────────────────────────────────────────────────

const ARCHETYPES = {
  vault: {
    id: "vault", name: "The Vault", icon: "🔒",
    desc: "Respected but unknowable. People admire you from a distance — and stay there.",
    detail: "You project competence and reliability, but almost nothing personal comes through. Others trust you with work, rarely with themselves. The distance feels intentional — and it is.",
  },
  spark: {
    id: "spark", name: "The Spark", icon: "⚡",
    desc: "Electric in person, hard to pin down in absence. You leave impressions but not anchors.",
    detail: "People remember meeting you vividly and struggle to describe you accurately afterward. Your impact is felt in the moment and fades quickly. This is both your gift and your limitation.",
  },
  contractor: {
    id: "contractor", name: "The Contractor", icon: "🔧",
    desc: "Trusted for execution, rarely considered for vision. Your reliability is your ceiling.",
    detail: "You deliver. Everyone knows it. But when vision and leadership conversations happen, your name comes up later — or not at all. You've built trust in the wrong currency for where you want to go.",
  },
  ghost: {
    id: "ghost", name: "The Ghost", icon: "👻",
    desc: "Invisible publicly despite real private impact. The world doesn't know what it's missing.",
    detail: "The people who know you well know your value precisely. Everyone else doesn't know you exist. Your reputation is a private document when it should be public knowledge.",
  },
  overexposed: {
    id: "overexposed", name: "The Overexposed", icon: "📡",
    desc: "Your brand is louder than your substance. The signal is starting to outpace the work.",
    detail: "You're excellent at presence and positioning. But people close to your work notice the gap between what you claim and what you've built. The trust deficit is growing quietly.",
  },
  architect: {
    id: "architect", name: "The Architect", icon: "🏛️",
    desc: "You build things that outlast you. People reference your work more than your name.",
    detail: "Your contribution is structural and lasting. Others build on what you've created without always knowing your name. This is legacy — but it can also be invisibility if you let it be.",
  },
};

// ─── Gap Score Formula ───────────────────────────────────────────────────────

/**
 * Calculate Gap Score from belief scores.
 * Gap Score = how far the world's perception is from what you'd want.
 * Lower score = smaller gap = better alignment.
 *
 * Formula considers:
 * - Average belief across all personas (higher = smaller gap)
 * - Variance between personas (high variance = inconsistent reputation)
 * - Number of completed conversations (more data = more accurate)
 */
function calculateGapScore(beliefs, completedCount) {
  const values = Object.values(beliefs);
  if (values.length === 0) return 72; // Default starting gap

  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // Variance penalty — inconsistent reputation across personas
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const variancePenalty = Math.sqrt(variance) * 0.3;

  // Confidence factor — fewer conversations = less certain = slight penalty
  const confidenceFactor = completedCount < 4 ? (completedCount / 4) * 0.1 : 0;

  const rawGap = 100 - avg + variancePenalty + (confidenceFactor * 10);
  return Math.round(Math.min(99, Math.max(1, rawGap)));
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "mirror-synthesis-service" });
});

/**
 * POST /synthesis/perception-map
 * Generates the full Perception Map for a user.
 * Called after 2+ persona conversations.
 */
app.post("/synthesis/perception-map", requireAuth, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Fetch user profile
    const profileDoc = await db.collection("users").doc(userId).collection("profile").doc("dossier").get();
    if (!profileDoc.exists) return res.status(404).json({ error: "Profile not found" });
    const profile = profileDoc.data();

    // Fetch all persona data
    const personaIds = ["recruiter", "date", "competitor", "journalist"];
    const personaData = await Promise.all(
      personaIds.map(async (id) => {
        const doc = await db.collection("users").doc(userId).collection("personas").doc(id).get();
        if (!doc.exists) return { id, belief: 20, sessions: [] };

        // Get last 3 sessions for context
        const sessions = await db
          .collection("users").doc(userId)
          .collection("personas").doc(id)
          .collection("sessions")
          .orderBy("startedAt", "desc")
          .limit(3)
          .get();

        const recentMessages = sessions.docs.flatMap((s) =>
          (s.data().messages || []).slice(-4)
        );

        return {
          id,
          belief: doc.data().currentBelief || 20,
          conversationCount: doc.data().conversationCount || 0,
          recentMessages,
        };
      })
    );

    const beliefs = Object.fromEntries(personaData.map((p) => [p.id, p.belief]));
    const completedCount = personaData.filter((p) => p.conversationCount > 0).length;
    const gapScore = calculateGapScore(beliefs, completedCount);

    // Build conversation summaries for Gemini
    const convSummaries = personaData.map((p) => {
      const msgs = p.recentMessages.slice(-6).map((m) =>
        `${m.role === "user" ? "User" : "Persona"}: ${m.content?.slice(0, 150)}`
      ).join("\n");
      return `${p.id.toUpperCase()} (belief: ${p.belief}/100, ${p.conversationCount} conversations):\n${msgs || "No conversations yet"}`;
    }).join("\n\n---\n\n");

    // Generate with Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7, responseMimeType: "application/json" },
    });

    const prompt = `Generate a Perception Map for ${profile.userName}.

THEIR PROFILE: ${profile.structured?.summary || profile.rawBio?.slice(0, 300)}

PERSONA CONVERSATIONS:
${convSummaries}

GAP SCORE: ${gapScore}/100 (lower is better)

Return ONLY valid JSON:
{
  "headline": "brutally honest 10-12 word summary of how the world sees them right now",
  "consensus": "what all 4 personas fundamentally agree on, 2 sentences",
  "gap": "the most significant disconnect between self-perception and external reality, 2 sentences",
  "blindspot": "the single most important thing they are not seeing about themselves, 1 sentence",
  "strengths": ["genuine strength 1", "genuine strength 2", "genuine strength 3"],
  "risks": ["perception risk 1", "perception risk 2"],
  "verdicts": {
    "recruiter": "Rachel's 2-sentence final career verdict",
    "date": "Alex's 2-sentence relationship/personal verdict",
    "competitor": "Chris's 2-sentence competitive assessment",
    "journalist": "Jordan's 2-sentence public narrative verdict"
  },
  "archetype_id": "one of: vault|spark|contractor|ghost|overexposed|architect",
  "archetype_confidence": 0.0-1.0,
  "question": "the single most important and uncomfortable question for them to sit with — make it specific to their situation"
}`;

    const result = await model.generateContent(prompt);
    const mapData = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());

    // Attach full archetype details
    const archetype = ARCHETYPES[mapData.archetype_id] || ARCHETYPES.vault;

    const perceptionMap = {
      ...mapData,
      archetype,
      gapScore,
      beliefs,
      generatedAt: new Date().toISOString(),
    };

    // Persist perception map
    await db.collection("users").doc(userId)
      .collection("reports").doc(`map-${Date.now()}`)
      .set({ type: "perception_map", ...perceptionMap });

    // Update user's gap score
    await db.collection("users").doc(userId).set(
      { gapScore, lastMapAt: new Date().toISOString() },
      { merge: true }
    );

    res.json(perceptionMap);

  } catch (err) {
    console.error("[perception-map] Error:", err);
    res.status(500).json({ error: "Failed to generate perception map" });
  }
});

/**
 * GET /synthesis/gap-score
 * Returns current gap score and belief scores.
 */
app.get("/synthesis/gap-score", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const personaIds = ["recruiter", "date", "competitor", "journalist"];
    const beliefs = {};
    let completedCount = 0;

    await Promise.all(personaIds.map(async (id) => {
      const doc = await db.collection("users").doc(userId).collection("personas").doc(id).get();
      if (doc.exists) {
        beliefs[id] = doc.data().currentBelief || 20;
        if (doc.data().conversationCount > 0) completedCount++;
      } else {
        beliefs[id] = 20;
      }
    }));

    const gapScore = calculateGapScore(beliefs, completedCount);
    res.json({ gapScore, beliefs, completedCount });
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate gap score" });
  }
});

/**
 * POST /synthesis/weekly-report
 * Generates the weekly reputation report.
 * Called by Cloud Scheduler every Monday at 8am.
 * Can also be called manually for testing.
 */
app.post("/synthesis/weekly-report", async (req, res) => {
  // Verify Cloud Scheduler token or internal service call
  const authHeader = req.headers.authorization;
  const isScheduler = authHeader === `Bearer ${process.env.SCHEDULER_SECRET}`;
  const isInternal = req.headers["x-internal-service"] === process.env.INTERNAL_SERVICE_SECRET;

  if (!isScheduler && !isInternal) {
    // Allow authenticated users to generate their own report
    const token = authHeader?.split("Bearer ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try { req.user = await admin.auth().verifyIdToken(token); }
    catch { return res.status(401).json({ error: "Invalid token" }); }
  }

  const userId = req.user?.uid || req.body.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    // Get current and last week's gap scores
    const userDoc = await db.collection("users").doc(userId).get();
    const currentGapScore = userDoc.data()?.gapScore || 72;

    const lastWeekReport = await db.collection("users").doc(userId)
      .collection("reports")
      .where("type", "==", "weekly_report")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const lastWeekGap = lastWeekReport.empty ? null : lastWeekReport.docs[0].data().gapScore;
    const gapDelta = lastWeekGap ? currentGapScore - lastWeekGap : null;

    // Get all persona statuses
    const personaIds = ["recruiter", "date", "competitor", "journalist"];
    const personaStatuses = await Promise.all(personaIds.map(async (id) => {
      const doc = await db.collection("users").doc(userId).collection("personas").doc(id).get();
      return { id, ...doc.data() };
    }));

    const profileDoc = await db.collection("users").doc(userId).collection("profile").doc("dossier").get();
    const userName = profileDoc.data()?.userName || "User";

    // Generate report with Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 2000, temperature: 0.75 },
    });

    const result = await model.generateContent(`
Write a personalized weekly reputation report for ${userName}.

Current Gap Score: ${currentGapScore}/100 ${gapDelta !== null ? `(${gapDelta > 0 ? "+" : ""}${gapDelta} from last week)` : "(first report)"}

Persona belief scores:
${personaStatuses.map((p) => `- ${p.id}: ${p.currentBelief || 20}/100 (${p.conversationCount || 0} conversations)`).join("\n")}

Write a brief, honest, personal weekly report in 3 short paragraphs:
1. What shifted this week and what it means
2. Which persona relationship changed most significantly and why it matters
3. One concrete thing they can do before next Monday to improve their perception

Tone: like a trusted advisor who has been watching closely. Not a coach. Not a cheerleader. Just honest.
Keep it under 200 words total. No headers. No bullet points. Just three paragraphs.`);

    const reportText = result.response.text();

    // Save report
    await db.collection("users").doc(userId).collection("reports").add({
      type: "weekly_report",
      content: reportText,
      gapScore: currentGapScore,
      gapDelta,
      personaBeliefs: Object.fromEntries(personaStatuses.map((p) => [p.id, p.currentBelief || 20])),
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, report: reportText, gapScore: currentGapScore, gapDelta });

  } catch (err) {
    console.error("[weekly-report] Error:", err);
    res.status(500).json({ error: "Failed to generate weekly report" });
  }
});

/**
 * GET /synthesis/mirror-moment
 * Returns today's Mirror Moment — a pointed question from a persona.
 */
app.get("/synthesis/mirror-moment", requireAuth, async (req, res) => {
  const userId = req.user.uid;

  try {
    const profileDoc = await db.collection("users").doc(userId).collection("profile").doc("dossier").get();
    if (!profileDoc.exists) return res.json({ moment: null });

    const profile = profileDoc.data();
    const personas = ["recruiter", "date", "competitor", "journalist"];
    const todayPersona = personas[new Date().getDay() % personas.length];

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 100, temperature: 0.9 },
    });

    const result = await model.generateContent(`
You are ${todayPersona} from the Mirror app. Based on what you know about ${profile.userName}:
${profile.structured?.summary || profile.rawBio?.slice(0, 200)}

Write ONE Mirror Moment — a single pointed, slightly uncomfortable question that this person should sit with today.
The question should feel personal and specific, not generic.
It should be 1-2 sentences max.
Start with "${todayPersona === "recruiter" ? "Rachel" : todayPersona === "date" ? "Alex" : todayPersona === "competitor" ? "Chris" : "Jordan"} wants to know:"`);

    const moment = result.response.text().trim();

    res.json({ moment, persona: todayPersona, date: new Date().toISOString() });

  } catch (err) {
    res.status(500).json({ error: "Failed to generate mirror moment" });
  }
});

/**
 * GET /synthesis/archetype
 * Returns the user's current reputation archetype.
 */
app.get("/synthesis/archetype", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const reports = await db.collection("users").doc(userId)
      .collection("reports")
      .where("type", "==", "perception_map")
      .orderBy("generatedAt", "desc")
      .limit(1)
      .get();

    if (reports.empty) return res.json({ archetype: null });

    const latest = reports.docs[0].data();
    const archetype = ARCHETYPES[latest.archetype_id] || null;

    res.json({ archetype, confidence: latest.archetype_confidence, generatedAt: latest.generatedAt });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch archetype" });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ Mirror Synthesis Service running on :${PORT}`);
});

process.on("SIGTERM", () => { process.exit(0); });
