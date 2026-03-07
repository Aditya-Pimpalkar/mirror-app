const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { PERSONAS, scoreMessage } = require("../personas");
const { streamPersonaResponse } = require("../utils/gemini");
const { getFirestore } = require("../utils/firebase");

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
    if (!doc.exists) return res.json({ personaId, currentBelief: PERSONAS[personaId].initialBelief, conversationCount: 0, lastSessionAt: null });
    res.json({ personaId, ...doc.data() });
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
    const history = sessions.docs.map((doc) => ({
      sessionId: doc.id, ...doc.data(), messages: undefined,
      messageCount: doc.data().messageCount,
      preview: doc.data().messages?.[doc.data().messages.length - 1]?.content?.slice(0, 120),
    }));
    res.json({ personaId, history });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.post("/:personaId/chat", requireAuth, async (req, res) => {
  const { personaId } = req.params;
  const { message, conversationHistory = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "Message is required" });
  const persona = PERSONAS[personaId];
  if (!persona) return res.status(404).json({ error: `Unknown persona: ${personaId}` });

  try {
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(req.user.uid).collection("profile").doc("dossier").get();
    const dossier = userDoc.exists ? userDoc.data().content : "No detailed profile available.";
    const userName = userDoc.exists ? userDoc.data().userName : "User";

    const score = scoreMessage(personaId, message);
    const personaDoc = await db.collection("users").doc(req.user.uid).collection("personas").doc(personaId).get();
    const currentBelief = personaDoc.exists ? personaDoc.data().currentBelief : persona.initialBelief;
    const newBelief = Math.min(95, Math.max(5, currentBelief + score.evidenceScore));
    const history = [...conversationHistory, { role: "user", content: message }];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";
    await streamPersonaResponse(persona.systemPrompt(userName, dossier), history, (chunk) => {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: "belief_update", belief: newBelief, delta: score.evidenceScore, hasEvidence: score.hasEvidence })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();

    // Persist in background
    const todayId = new Date().toISOString().split("T")[0];
    const sessionRef = db.collection("users").doc(req.user.uid).collection("personas").doc(personaId).collection("sessions").doc(`text-${todayId}`);
    db.runTransaction(async (t) => {
      const sessionDoc = await t.get(sessionRef);
      const existing = sessionDoc.exists ? sessionDoc.data() : { messages: [], messageCount: 0 };
      const messages = [...existing.messages,
        { role: "user", content: message, timestamp: new Date().toISOString(), evidenceScore: score.evidenceScore },
        { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() },
      ];
      t.set(sessionRef, { sessionId: `text-${todayId}`, personaId, userId: req.user.uid, messages, finalBelief: newBelief, messageCount: messages.length, startedAt: existing.startedAt || new Date().toISOString(), updatedAt: new Date().toISOString(), mode: "text" });
      t.set(db.collection("users").doc(req.user.uid).collection("personas").doc(personaId), { currentBelief: newBelief, lastSessionAt: new Date().toISOString() }, { merge: true });
    }).catch((err) => console.error("[chat] Persist error:", err));

  } catch (err) {
    console.error("[POST /personas/:id/chat] Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate response" });
  }
});

module.exports = router;
