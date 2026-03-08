/**
 * mirror/services/persona-service/src/services/confrontationMode.js
 *
 * Confrontation Mode — all 4 personas respond to one statement simultaneously.
 * The most revealing session type in Mirror.
 *
 * "You make one statement. All four respond. 
 *  Chaotic, revealing, unforgettable."
 */

const { PERSONAS, scoreMessage } = require("../personas");
const { generatePersonaResponse } = require("../utils/gemini");
const { getFirestore } = require("../utils/firebase");
const { loadPersonaMemory, buildMemoryInjection } = require("./memoryManager");
const { v4: uuidv4 } = require("uuid");

/**
 * Run a Confrontation Mode session.
 * Takes one user statement and fans out to all 4 personas in parallel.
 * Returns all 4 responses + belief updates.
 */
async function runConfrontation({ userId, userName, dossier, statement, currentBeliefs }) {
  const sessionId = uuidv4();
  const personaIds = ["recruiter", "date", "competitor", "journalist"];

  console.log(`[Confrontation:${sessionId}] Starting for user ${userId}`);
  console.log(`[Confrontation:${sessionId}] Statement: "${statement.slice(0, 80)}..."`);

  // Load memory for all 4 personas in parallel
  const memories = await Promise.all(
    personaIds.map((id) => loadPersonaMemory(userId, id))
  );

  // Fan out all 4 Gemini calls in parallel
  const results = await Promise.allSettled(
    personaIds.map(async (personaId, idx) => {
      const persona = PERSONAS[personaId];
      const memory = memories[idx];
      const memoryInjection = buildMemoryInjection(memory);
      const currentBelief = currentBeliefs?.[personaId] ?? persona.initialBelief;

      // Build confrontation-specific system prompt
      const systemPrompt = buildConfrontationPrompt(
        persona, userName, dossier, memoryInjection, currentBelief
      );

      // Score the statement for this persona
      const score = scoreMessage(personaId, statement);
      const newBelief = Math.min(95, Math.max(5, currentBelief + score.evidenceScore));

      // Generate response
      const response = await generatePersonaResponse(
        systemPrompt,
        [{ role: "user", content: statement }],
        200 // Shorter responses in confrontation mode — punchy
      );

      return {
        personaId,
        personaName: persona.name,
        personaEmoji: persona.emoji,
        personaColor: persona.color,
        response,
        previousBelief: currentBelief,
        newBelief,
        beliefDelta: score.evidenceScore,
        hasEvidence: score.hasEvidence,
      };
    })
  );

  // Process results — handle any failures gracefully
  const responses = results.map((result, idx) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      console.error(`[Confrontation] ${personaIds[idx]} failed:`, result.reason?.message);
      const persona = PERSONAS[personaIds[idx]];
      return {
        personaId: personaIds[idx],
        personaName: persona.name,
        personaEmoji: persona.emoji,
        personaColor: persona.color,
        response: "...",
        previousBelief: currentBeliefs?.[personaIds[idx]] ?? persona.initialBelief,
        newBelief: currentBeliefs?.[personaIds[idx]] ?? persona.initialBelief,
        beliefDelta: 0,
        hasEvidence: false,
        error: true,
      };
    }
  });

  // Build belief updates map
  const beliefUpdates = Object.fromEntries(
    responses.map((r) => [r.personaId, r.newBelief])
  );

  // Persist confrontation session to Firestore
  persistConfrontationSession({
    sessionId, userId, statement, responses, beliefUpdates,
  }).catch((err) => console.error("[Confrontation] Persist failed:", err.message));

  console.log(`[Confrontation:${sessionId}] Complete. ${responses.filter((r) => !r.error).length}/4 succeeded`);

  return {
    sessionId,
    statement,
    responses,
    beliefUpdates,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Build confrontation-specific system prompt.
 * Shorter, more reactive — personas respond to one statement, not a conversation.
 */
function buildConfrontationPrompt(persona, userName, dossier, memoryInjection, currentBelief) {
  return `
You are ${persona.name}, a ${persona.role}.

SUBJECT: ${userName}
BACKGROUND: ${dossier}
${memoryInjection}

CURRENT CONVICTION LEVEL: ${currentBelief}/100

CONFRONTATION MODE:
${userName} has just made a single statement in front of all four personas simultaneously.
You are reacting to it in real time — raw, unfiltered, from your specific perspective.

YOUR VOICE: ${persona.voice?.style || "direct and honest"}

RULES FOR CONFRONTATION MODE:
1. Maximum 2-3 sentences. This is a reaction, not a speech.
2. Be DIRECT. No preamble. No "I think" or "It seems to me."
3. React from YOUR specific lens — not generically. Rachel reacts as a recruiter. Alex as a date. Chris as a competitor. Jordan as a journalist.
4. If the statement reveals something interesting — name it specifically.
5. If the statement is evasive or performed — call it out immediately.
6. You can disagree with the other personas' likely reactions — be yourself.
7. End with either a pointed observation OR a single sharp question. Not both.
8. Never break character.
`.trim();
}

/**
 * Persist confrontation session to Firestore.
 */
async function persistConfrontationSession({ sessionId, userId, statement, responses, beliefUpdates }) {
  try {
    const db = getFirestore();

    // Save confrontation session
    await db
      .collection("users").doc(userId)
      .collection("confrontations").doc(sessionId)
      .set({
        sessionId,
        statement,
        responses: responses.map((r) => ({
          personaId: r.personaId,
          response: r.response,
          beliefDelta: r.beliefDelta,
          newBelief: r.newBelief,
        })),
        beliefUpdates,
        createdAt: new Date().toISOString(),
      });

    // Update each persona's belief score
    const batch = db.batch();
    for (const [personaId, newBelief] of Object.entries(beliefUpdates)) {
      const ref = db
        .collection("users").doc(userId)
        .collection("personas").doc(personaId);
      batch.set(ref, {
        currentBelief: newBelief,
        lastSessionAt: new Date().toISOString(),
        conversationCount: require("firebase-admin").firestore.FieldValue.increment(0),
      }, { merge: true });
    }
    await batch.commit();

  } catch (err) {
    console.error("[Confrontation] Persist error:", err.message);
  }
}

/**
 * Get confrontation history for a user.
 */
async function getConfrontationHistory(userId, limit = 5) {
  try {
    const db = getFirestore();
    const snap = await db
      .collection("users").doc(userId)
      .collection("confrontations")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((doc) => ({
      sessionId: doc.id,
      statement: doc.data().statement,
      createdAt: doc.data().createdAt,
      beliefUpdates: doc.data().beliefUpdates,
      preview: doc.data().responses?.[0]?.response?.slice(0, 100),
    }));
  } catch (err) {
    console.error("[Confrontation] History fetch error:", err.message);
    return [];
  }
}

module.exports = { runConfrontation, getConfrontationHistory };
