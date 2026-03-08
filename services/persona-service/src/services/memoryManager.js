/**
 * mirror/services/persona-service/src/services/memoryManager.js
 *
 * Multi-session memory for Mirror personas.
 * Loads prior conversation summaries and injects them into
 * the persona's system prompt so they remember what you said last time.
 *
 * "Last week you told me you were about to have a hard conversation
 *  with your co-founder. How did that go?"
 */

const { getFirestore } = require("../utils/firebase");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Load the last N sessions for a user-persona pair
 * and return a structured memory object.
 */
async function loadPersonaMemory(userId, personaId, limit = 3) {
  try {
    const db = getFirestore();

    const sessionsSnap = await db
      .collection("users").doc(userId)
      .collection("personas").doc(personaId)
      .collection("sessions")
      .orderBy("startedAt", "desc")
      .limit(limit)
      .get();

    if (sessionsSnap.empty) {
      return { hasPriorSessions: false, summary: null, keyMoments: [], beliefArc: null };
    }

    const sessions = sessionsSnap.docs.map((doc) => doc.data()).reverse(); // oldest first

    // Extract key moments from each session
    const keyMoments = [];
    let totalMessages = 0;

    for (const session of sessions) {
      const messages = session.messages || [];
      totalMessages += messages.length;

      // Get the last user message and last persona response from each session
      const userMessages = messages.filter((m) => m.role === "user");
      const personaMessages = messages.filter((m) => m.role === "assistant");

      if (userMessages.length > 0) {
        // Most revealing user messages (longest ones tend to be most substantive)
        const mostSubstantive = [...userMessages]
          .sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))
          .slice(0, 2);

        mostSubstantive.forEach((msg) => {
          if (msg.content?.length > 30) {
            keyMoments.push({
              role: "user",
              content: msg.content.slice(0, 200),
              sessionDate: session.startedAt,
              hadEvidence: msg.evidenceScore > 0,
            });
          }
        });
      }

      if (personaMessages.length > 0) {
        // Last persona message from the session
        const last = personaMessages[personaMessages.length - 1];
        if (last.content?.length > 30) {
          keyMoments.push({
            role: "persona",
            content: last.content.slice(0, 200),
            sessionDate: session.startedAt,
          });
        }
      }
    }

    // Belief arc — how belief has changed across sessions
    const beliefValues = sessions
      .filter((s) => s.finalBelief !== undefined)
      .map((s) => s.finalBelief);

    const beliefArc = beliefValues.length > 0 ? {
      start: beliefValues[0],
      current: beliefValues[beliefValues.length - 1],
      trend: beliefValues.length > 1
        ? beliefValues[beliefValues.length - 1] > beliefValues[0] ? "improving" : "declining"
        : "stable",
      values: beliefValues,
    } : null;

    // Generate a concise memory summary using Gemini
    const summary = await generateMemorySummary(keyMoments, personaId);

    return {
      hasPriorSessions: true,
      sessionCount: sessions.length,
      totalMessages,
      summary,
      keyMoments: keyMoments.slice(0, 6), // Cap at 6 moments
      beliefArc,
      lastSessionAt: sessions[sessions.length - 1]?.startedAt,
    };

  } catch (err) {
    console.error(`[Memory] Failed to load memory for ${userId}/${personaId}:`, err.message);
    return { hasPriorSessions: false, summary: null, keyMoments: [], beliefArc: null };
  }
}

/**
 * Generate a concise memory summary from key moments.
 * This gets injected into the persona's system prompt.
 */
async function generateMemorySummary(keyMoments, personaId) {
  if (keyMoments.length === 0) return null;

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-pro",
      generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
    });

    const momentText = keyMoments
      .map((m) => `[${new Date(m.sessionDate).toLocaleDateString()}] ${m.role === "user" ? "They said" : "You said"}: "${m.content}"`)
      .join("\n");

    const result = await model.generateContent(`
You are summarizing prior conversation history for an AI persona (${personaId}).
These are key moments from previous conversations:

${momentText}

Write a brief memory summary (3-5 sentences max) that captures:
1. What this person has revealed about themselves
2. Any commitments or intentions they mentioned
3. Emotional patterns or recurring themes
4. Anything unresolved or left hanging

Write in second person as if briefing the persona: "In previous conversations, they told you..."
Be specific. Reference actual things they said. This will be injected into the persona's memory.`);

    return result.response.text().trim();
  } catch (err) {
    console.error("[Memory] Failed to generate summary:", err.message);
    // Fallback: just use raw key moments
    return keyMoments
      .filter((m) => m.role === "user")
      .slice(0, 3)
      .map((m) => `Previously said: "${m.content.slice(0, 100)}"`)
      .join(" | ");
  }
}

/**
 * Build the memory injection string for a persona system prompt.
 * This is what gets added to the system prompt before each session.
 */
function buildMemoryInjection(memory) {
  if (!memory.hasPriorSessions) {
    return `\nCONTEXT: This is your FIRST conversation with this person. You have no prior history with them.`;
  }

  let injection = `\n\n=== YOUR MEMORY OF PRIOR CONVERSATIONS ===\n`;
  injection += `You have spoken with this person ${memory.sessionCount} time(s) before (${memory.totalMessages} total messages).\n`;

  if (memory.lastSessionAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(memory.lastSessionAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    injection += `Last conversation: ${daysSince === 0 ? "today" : daysSince === 1 ? "yesterday" : `${daysSince} days ago`}.\n`;
  }

  if (memory.beliefArc) {
    injection += `Your conviction about them: started at ${memory.beliefArc.start}/100, now at ${memory.beliefArc.current}/100 (${memory.beliefArc.trend}).\n`;
  }

  if (memory.summary) {
    injection += `\nWHAT YOU REMEMBER:\n${memory.summary}\n`;
  }

  injection += `\nIMPORTANT: Reference this history naturally. Ask follow-up questions about things they mentioned before. `;
  injection += `If they made a commitment or mentioned something was about to happen, ask how it went. `;
  injection += `Don't announce that you remember — just demonstrate it. This is the difference between a tool and a relationship.\n`;
  injection += `=== END MEMORY ===\n`;

  return injection;
}

/**
 * Save a memory snapshot after a session ends.
 * Extracts the most important moments for future reference.
 */
async function saveSessionSnapshot(userId, personaId, sessionId, messages, finalBelief) {
  try {
    const db = getFirestore();

    // Find the most substantive exchange in this session
    const userMessages = messages.filter((m) => m.role === "user" && m.content?.length > 20);
    const topMoment = userMessages.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))[0];

    const snapshot = {
      sessionId,
      finalBelief,
      messageCount: messages.length,
      topUserMoment: topMoment?.content?.slice(0, 300) || null,
      startedAt: messages[0]?.timestamp || new Date().toISOString(),
      endedAt: new Date().toISOString(),
    };

    await db
      .collection("users").doc(userId)
      .collection("personas").doc(personaId)
      .collection("snapshots").doc(sessionId)
      .set(snapshot);

  } catch (err) {
    console.error("[Memory] Failed to save snapshot:", err.message);
  }
}

module.exports = { loadPersonaMemory, buildMemoryInjection, saveSessionSnapshot };
