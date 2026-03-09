/**
 * mirror/services/persona-service/src/routes/persona.js
 * REPLACE the existing file with this one.
 * Now includes multi-session memory injection and Confrontation Mode.
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { PERSONAS, scoreMessage } = require("../personas");
const { streamPersonaResponse } = require("../utils/gemini");
const { getFirestore } = require("../utils/firebase");
const { loadPersonaMemory, buildMemoryInjection } = require("../services/memoryManager");
const { runConfrontation, getConfrontationHistory } = require("../services/confrontationMode");

router.get("/", (req, res) => {
  const personas = Object.values(PERSONAS).map((p) => ({
    id: p.id, name: p.name, role: p.role, domain: p.domain,
    emoji: p.emoji, color: p.color, initialBelief: p.initialBelief,
  }));
  res.json({ personas });
});

router.get("/:personaId/status", requireAuth, async (req, res) => {
  const { personaId } = req.params;
  if (!PERSONAS[personaId]) return res.status(404).json({ error: `Unknown persona: ${personaId}` });
  try {
    const db = getFirestore();
    const doc = await db.collection("users").doc(req.user.uid).collection("personas").doc(personaId).get();
    if (!doc.exists) return res.json({ personaId, currentBelief: PERSONAS[personaId].initialBelief, conversationCount: 0, lastSessionAt: null, hasPriorMemory: false });
    res.json({ personaId, ...doc.data(), hasPriorMemory: (doc.data().conversationCount || 0) > 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch persona status" });
  }
});

router.get("/:personaId/history", requireAuth, async (req, res) => {
  const { personaId } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  try {
    const db = getFirestore();
    const sessions = await db.collection("users").doc(req.user.uid)
      .collection("personas").doc(personaId)
      .collection("sessions").orderBy("startedAt", "desc").limit(limit).get();
    const history = sessions.docs.map((doc) => {
      const data = doc.data();
      return { sessionId: doc.id, messageCount: data.messageCount, finalBelief: data.finalBelief, startedAt: data.startedAt, mode: data.mode || "text", preview: data.messages?.[data.messages.length - 1]?.content?.slice(0, 120) };
    });
    res.json({ personaId, history });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.get("/:personaId/memory", requireAuth, async (req, res) => {
  const { personaId } = req.params;
  try {
    const memory = await loadPersonaMemory(req.user.uid, personaId);
    res.json({ personaId, memory });
  } catch (err) {
    res.status(500).json({ error: "Failed to load memory" });
  }
});

router.post("/:personaId/chat", requireAuth, async (req, res) => {
  const { personaId } = req.params;
  const userId = req.user.uid;
  const { message, conversationHistory = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "Message is required" });
  const persona = PERSONAS[personaId];
  if (!persona) return res.status(404).json({ error: `Unknown persona: ${personaId}` });

  try {
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(userId).collection("profile").doc("dossier").get();
    const dossier = userDoc.exists ? userDoc.data().content : "No profile available.";
    const userName = userDoc.exists ? userDoc.data().userName : "User";

    // Load memory from prior sessions
    const memory = await loadPersonaMemory(userId, personaId);
    const memoryInjection = buildMemoryInjection(memory);

    const personaDoc = await db.collection("users").doc(userId).collection("personas").doc(personaId).get();
    const currentBelief = personaDoc.exists ? personaDoc.data().currentBelief : persona.initialBelief;
    const score = scoreMessage(personaId, message);
    const newBelief = Math.min(95, Math.max(5, currentBelief + score.evidenceScore));

    // Inject memory into system prompt
    const fullSystemPrompt = persona.systemPrompt(userName, dossier) + memoryInjection;
    const history = [...conversationHistory, { role: "user", content: message }];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`data: ${JSON.stringify({ type: "memory_status", hasPriorMemory: memory.hasPriorSessions, sessionCount: memory.sessionCount || 0 })}\n\n`);

    let fullResponse = "";
    await streamPersonaResponse(fullSystemPrompt, history, (chunk) => {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: "belief_update", belief: newBelief, delta: score.evidenceScore, hasEvidence: score.hasEvidence, isEmotional: score.isEmotional })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();

    persistChatTurn(db, userId, personaId, message, fullResponse, newBelief, score)
      .catch((err) => console.error("[chat] Persist error:", err.message));

  } catch (err) {
    console.error("[POST /personas/:id/chat]", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate response" });
  }
});

// Confrontation Mode — all 4 personas respond simultaneously
router.post("/confrontation", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const { statement, currentBeliefs } = req.body;
  if (!statement?.trim()) return res.status(400).json({ error: "statement is required" });
  if (statement.length > 1000) return res.status(400).json({ error: "Statement too long. Keep it under 1000 characters." });

  try {
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(userId).collection("profile").doc("dossier").get();
    const dossier = userDoc.exists ? userDoc.data().content : "No profile available.";
    const userName = userDoc.exists ? userDoc.data().userName : "User";

    const result = await runConfrontation({ userId, userName, dossier, statement, currentBeliefs: currentBeliefs || {} });
    res.json(result);
  } catch (err) {
    console.error("[POST /personas/confrontation]", err);
    res.status(500).json({ error: "Confrontation failed. Please try again." });
  }
});

router.get("/confrontation/history", requireAuth, async (req, res) => {
  try {
    const history = await getConfrontationHistory(req.user.uid, parseInt(req.query.limit) || 5);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch confrontation history" });
  }
});

router.delete("/:personaId/history", requireAuth, async (req, res) => {
  const { personaId } = req.params;
  const userId = req.user.uid;
  try {
    const db = getFirestore();
    const sessionsRef = db.collection("users").doc(userId).collection("personas").doc(personaId).collection("sessions");
    const sessions = await sessionsRef.get();
    const batch = db.batch();
    sessions.docs.forEach((doc) => batch.delete(doc.ref));
    batch.set(db.collection("users").doc(userId).collection("personas").doc(personaId), { currentBelief: PERSONAS[personaId]?.initialBelief || 20, conversationCount: 0, lastSessionAt: null });
    await batch.commit();
    res.json({ success: true, deleted: sessions.size });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete history" });
  }
});

async function persistChatTurn(db, userId, personaId, userMsg, assistantMsg, newBelief, score) {
  const todayId = new Date().toISOString().split("T")[0];
  const sessionRef = db.collection("users").doc(userId).collection("personas").doc(personaId).collection("sessions").doc(`text-${todayId}`);
  await db.runTransaction(async (t) => {
    const sessionDoc = await t.get(sessionRef);
    const existing = sessionDoc.exists ? sessionDoc.data() : { messages: [], startedAt: new Date().toISOString() };
    const messages = [...existing.messages,
      { role: "user", content: userMsg, timestamp: new Date().toISOString(), evidenceScore: score.evidenceScore, hasEvidence: score.hasEvidence },
      { role: "assistant", content: assistantMsg, timestamp: new Date().toISOString() },
    ];
    t.set(sessionRef, { sessionId: `text-${todayId}`, personaId, userId, messages, finalBelief: newBelief, messageCount: messages.length, startedAt: existing.startedAt, updatedAt: new Date().toISOString(), mode: "text" });
    t.set(db.collection("users").doc(userId).collection("personas").doc(personaId), { currentBelief: newBelief, lastSessionAt: new Date().toISOString(), conversationCount: require("firebase-admin").firestore.FieldValue.increment(1) }, { merge: true });
  });
}

module.exports = router;

// ─── GET /personas/all-status ─────────────────────────────────────────────────
// Returns all persona statuses + recent messages in one call (for page reload)
router.get("/all-status", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const personaIds = ["recruiter", "date", "competitor", "journalist"];

  try {
    const db = getFirestore();
    const results = await Promise.all(
      personaIds.map(async (personaId) => {
        // Get persona status
        const statusDoc = await db
          .collection("users").doc(userId)
          .collection("personas").doc(personaId)
          .get();

        // Get today's session messages
        const todayId = new Date().toISOString().split("T")[0];
        const sessionDoc = await db
          .collection("users").doc(userId)
          .collection("personas").doc(personaId)
          .collection("sessions").doc(`text-${todayId}`)
          .get();

        const messages = sessionDoc.exists
          ? sessionDoc.data().messages || []
          : [];

        return {
          personaId,
          currentBelief: statusDoc.exists
            ? statusDoc.data().currentBelief
            : require("../personas").PERSONAS[personaId]?.initialBelief || 20,
          conversationCount: statusDoc.exists
            ? statusDoc.data().conversationCount || 0
            : 0,
          messages: messages.slice(-20), // Last 20 messages
        };
      })
    );

    res.json({ personas: results });
  } catch (err) {
    console.error("[GET /personas/all-status]", err.message);
    res.status(500).json({ error: "Failed to fetch all statuses" });
  }
});

// ─── GET /personas/:personaId/voice-summaries ─────────────────────────────────
router.get("/:personaId/voice-summaries", requireAuth, async (req, res) => {
  const { personaId } = req.params;
  const userId = req.user.uid;
  try {
    const db = getFirestore();
    const snap = await db.collection("users").doc(userId)
      .collection("personas").doc(personaId)
      .collection("voice_summaries")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const summaries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ summaries });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch voice summaries" });
  }
});
