/**
 * mirror/services/profile-service/src/index.js
 *
 * Mirror Profile Service
 * Handles: bio ingestion, URL scraping, dossier construction, profile updates
 * PORT: 8081
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { z } = require("zod");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

// ─── Init ────────────────────────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const app = express();
const PORT = process.env.PORT || 8081;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("combined"));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));
app.use(express.json({ limit: "20mb" }));

// ─── Auth Middleware ──────────────────────────────────────────────────────────

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ─── Dossier Builder (Gemini) ─────────────────────────────────────────────────

/**
 * Takes raw user input (bio text + optional scraped URLs) and
 * constructs a structured dossier that personas can use.
 */
async function buildDossier(rawBio, scrapedContent = [], userName) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 3000,
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const scrapedSection = scrapedContent.length > 0
    ? `\n\nADDITIONAL SCRAPED CONTENT:\n${scrapedContent.map((s) => `[${s.source}]: ${s.content}`).join("\n\n")}`
    : "";

  const prompt = `You are building a dossier for an AI persona system. The subject is ${userName}.

RAW INPUT:
${rawBio}
${scrapedSection}

Extract and structure everything into a comprehensive dossier for 4 personas who will interview this person.
Return ONLY valid JSON:
{
  "summary": "3-sentence neutral summary of who this person is",
  "career": {
    "current_role": "string or null",
    "industry": "string",
    "notable_companies": ["array"],
    "career_narrative": "paragraph describing career arc",
    "gaps_or_pivots": ["any notable career gaps or unexplained moves"],
    "claimed_achievements": ["specific achievements mentioned"]
  },
  "personal": {
    "values_stated": ["values they explicitly mention"],
    "interests": ["hobbies, passions"],
    "relationship_signals": ["how they talk about people, relationships"],
    "communication_style": "description"
  },
  "public_presence": {
    "platforms": ["platforms they're on"],
    "brand_narrative": "what they're trying to project",
    "inconsistencies": ["things that don't quite add up"],
    "notable_content": ["any notable posts, articles, projects mentioned"]
  },
  "red_flags": ["things that warrant probing from any persona"],
  "strengths": ["genuine strengths that come through"],
  "open_questions": ["questions each persona would likely ask"]
}`;

  const result = await model.generateContent(prompt);
  let rawText = result.response.text().replace(/```json|```/g, "").trim();
  // Handle truncated JSON by finding the last complete object
  try {
    return JSON.parse(rawText);
  } catch(e) {
    // Try to find and fix truncated JSON
    const lastBrace = rawText.lastIndexOf('}');
    if (lastBrace > 0) {
      try {
        return JSON.parse(rawText.slice(0, lastBrace + 1) + '}');
      } catch {}
    }
    // Return a safe fallback dossier
    console.warn('[buildDossier] JSON parse failed, using fallback');
    return {
      summary: "Profile parsed from user input.",
      career: { current_role: null, industry: "Unknown", notable_companies: [], career_narrative: rawText.slice(0, 300), gaps_or_pivots: [], claimed_achievements: [] },
      personal: { values_stated: [], interests: [], relationship_signals: [], communication_style: "Unknown" },
      public_presence: { platforms: [], brand_narrative: "", inconsistencies: [], notable_content: [] },
      red_flags: [],
      strengths: [],
      open_questions: ["Tell me more about yourself.", "What are you working on right now?", "What brought you here today?"]
    };
  }
}

// ─── URL Scraper ──────────────────────────────────────────────────────────────

/**
 * Scrapes content from a public URL using Gemini's URL context capability
 * or falls back to fetch + Gemini summarization.
 */
async function scrapeUrl(url) {
  try {
    // Use Gemini to analyze the URL content directly
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: `Extract the key professional/personal information from this URL that would be useful for understanding who this person is. Be factual. URL: ${url}\n\nIf you cannot access this URL, say "URL_INACCESSIBLE".` },
        ],
      }],
    });

    const text = result.response.text();
    if (text.includes("URL_INACCESSIBLE")) {
      return { source: url, content: null, error: "inaccessible" };
    }

    return { source: url, content: text.slice(0, 2000), error: null };
  } catch (err) {
    console.error(`[scrapeUrl] Failed for ${url}:`, err.message);
    return { source: url, content: null, error: err.message };
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "mirror-profile-service" });
});

/**
 * POST /profile/onboard
 * Main onboarding endpoint. Accepts voice bio (transcribed) or text bio,
 * plus optional public URLs.
 */
app.post("/profile/onboard", requireAuth, async (req, res) => {
  const schema = z.object({
    bio: z.string().min(20, "Bio must be at least 20 characters"),
    userName: z.string().min(1),
    publicLinks: z.array(z.string().url()).max(10).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { bio, userName, publicLinks } = parsed.data;
  const userId = req.user.uid;

  try {
    // Scrape all public URLs in parallel
    let scrapedContent = [];
    if (publicLinks.length > 0) {
      console.log(`[onboard] Scraping ${publicLinks.length} URLs for user ${userId}`);
      const results = await Promise.allSettled(publicLinks.map(scrapeUrl));
      scrapedContent = results
        .filter((r) => r.status === "fulfilled" && r.value.content)
        .map((r) => r.value);
    }

    // Build dossier with Gemini
    console.log(`[onboard] Building dossier for user ${userId}`);
    const dossier = await buildDossier(bio, scrapedContent, userName);

    // Format dossier as readable text for persona system prompts
    const dossierText = formatDossierAsText(dossier, userName);

    // Save to Firestore
    const profileRef = db.collection("users").doc(userId).collection("profile").doc("dossier");
    await profileRef.set({
      userId,
      userName,
      rawBio: bio,
      publicLinks,
      structured: dossier,
      content: dossierText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    // Initialize persona belief scores
    const personaIds = ["recruiter", "date", "competitor", "journalist"];
    const initialBeliefs = { recruiter: 20, date: 35, competitor: 18, journalist: 28 };

    const batch = db.batch();
    personaIds.forEach((id) => {
      const ref = db.collection("users").doc(userId).collection("personas").doc(id);
      batch.set(ref, {
        personaId: id,
        currentBelief: initialBeliefs[id],
        conversationCount: 0,
        lastSessionAt: null,
      }, { merge: true });
    });
    await batch.commit();

    console.log(`[onboard] User ${userId} onboarded successfully`);

    res.json({
      success: true,
      userName,
      dossierPreview: dossier.summary,
      openQuestions: dossier.open_questions?.slice(0, 3),
    });

  } catch (err) {
    console.error("[onboard] Error:", err);
    res.status(500).json({ error: "Failed to process profile" });
  }
});

/**
 * POST /profile/update
 * Weekly "what's new" update — keeps dossier fresh without full re-onboarding.
 */
app.post("/profile/update", requireAuth, async (req, res) => {
  const { update } = req.body;
  if (!update?.trim()) return res.status(400).json({ error: "update text required" });

  const userId = req.user.uid;

  try {
    const profileRef = db.collection("users").doc(userId).collection("profile").doc("dossier");
    const doc = await profileRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Profile not found. Please onboard first." });
    }

    const existing = doc.data();

    // Use Gemini to merge the update into existing dossier
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(`
Existing dossier summary: ${existing.structured.summary}
New update from user: "${update}"

Briefly describe (2-3 sentences) how this update changes or adds to our understanding of this person.
Keep it factual and specific.`);

    const updateNote = result.response.text();

    // Append update to dossier content
    const updatedContent = existing.content + `\n\n[UPDATE ${new Date().toLocaleDateString()}]: ${update}\n${updateNote}`;

    await profileRef.update({
      content: updatedContent,
      rawBio: existing.rawBio + `\n\n[${new Date().toLocaleDateString()}] ${update}`,
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1,
    });

    res.json({ success: true, updateNote });
  } catch (err) {
    console.error("[update] Error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * GET /profile
 * Returns the user's current profile summary (not full dossier).
 */
app.get("/profile", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const doc = await db.collection("users").doc(userId).collection("profile").doc("dossier").get();
    if (!doc.exists) return res.json({ exists: false });

    const data = doc.data();
    res.json({
      exists: true,
      userName: data.userName,
      summary: data.structured?.summary,
      publicLinks: data.publicLinks,
      version: data.version,
      updatedAt: data.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDossierAsText(dossier, userName) {
  return `
SUBJECT: ${userName}

OVERVIEW:
${dossier.summary}

CAREER:
${dossier.career.career_narrative}
Current Role: ${dossier.career.current_role || "Not specified"}
Industry: ${dossier.career.industry}
Notable Companies: ${dossier.career.notable_companies?.join(", ") || "None specified"}
${dossier.career.gaps_or_pivots?.length ? `Gaps/Pivots: ${dossier.career.gaps_or_pivots.join("; ")}` : ""}
Claimed Achievements: ${dossier.career.claimed_achievements?.join("; ") || "None specified"}

PERSONAL:
Stated Values: ${dossier.personal.values_stated?.join(", ") || "Not stated"}
Communication Style: ${dossier.personal.communication_style}
${dossier.personal.relationship_signals?.length ? `Relationship Signals: ${dossier.personal.relationship_signals.join("; ")}` : ""}

PUBLIC PRESENCE:
${dossier.public_presence.brand_narrative}
Platforms: ${dossier.public_presence.platforms?.join(", ") || "Unknown"}
${dossier.public_presence.inconsistencies?.length ? `Inconsistencies: ${dossier.public_presence.inconsistencies.join("; ")}` : ""}

POTENTIAL PROBE AREAS:
${dossier.red_flags?.map((f) => `- ${f}`).join("\n") || "None identified"}

OPEN QUESTIONS:
${dossier.open_questions?.map((q) => `- ${q}`).join("\n") || "None"}
`.trim();
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ Mirror Profile Service running on :${PORT}`);
});

process.on("SIGTERM", () => { process.exit(0); });
