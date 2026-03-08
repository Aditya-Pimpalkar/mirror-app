// src/lib/api.js
// Central API client for all Mirror backend services

import { getIdToken } from "./firebase";

const PERSONA_URL = process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL;
const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_SERVICE_URL;
const SYNTHESIS_URL = process.env.NEXT_PUBLIC_SYNTHESIS_SERVICE_URL;

async function authHeaders() {
  const token = await getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ─── Profile Service ──────────────────────────────────────────────────────────

export async function onboardUser({ bio, userName, publicLinks = [] }) {
  const headers = await authHeaders();
  const res = await fetch(`${PROFILE_URL}/profile/onboard`, {
    method: "POST",
    headers,
    body: JSON.stringify({ bio, userName, publicLinks }),
  });
  if (!res.ok) throw new Error(`Onboard failed: ${res.status}`);
  return res.json();
}

export async function getProfile() {
  const headers = await authHeaders();
  const res = await fetch(`${PROFILE_URL}/profile`, { headers });
  if (!res.ok) throw new Error(`Get profile failed: ${res.status}`);
  return res.json();
}

export async function updateProfile(update) {
  const headers = await authHeaders();
  const res = await fetch(`${PROFILE_URL}/profile/update`, {
    method: "POST",
    headers,
    body: JSON.stringify({ update }),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

// ─── Persona Service ──────────────────────────────────────────────────────────

export async function getPersonas() {
  const res = await fetch(`${PERSONA_URL}/personas`);
  if (!res.ok) throw new Error(`Get personas failed: ${res.status}`);
  return res.json();
}

export async function getPersonaStatus(personaId) {
  const headers = await authHeaders();
  const res = await fetch(`${PERSONA_URL}/personas/${personaId}/status`, { headers });
  if (!res.ok) throw new Error(`Get status failed: ${res.status}`);
  return res.json();
}

export async function getPersonaMemory(personaId) {
  const headers = await authHeaders();
  const res = await fetch(`${PERSONA_URL}/personas/${personaId}/memory`, { headers });
  if (!res.ok) throw new Error(`Get memory failed: ${res.status}`);
  return res.json();
}

export async function getPersonaHistory(personaId, limit = 10) {
  const headers = await authHeaders();
  const res = await fetch(`${PERSONA_URL}/personas/${personaId}/history?limit=${limit}`, { headers });
  if (!res.ok) throw new Error(`Get history failed: ${res.status}`);
  return res.json();
}

export async function deletePersonaHistory(personaId) {
  const headers = await authHeaders();
  const res = await fetch(`${PERSONA_URL}/personas/${personaId}/history`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
}

/**
 * Stream a text chat message from a persona.
 * Returns an async generator yielding events.
 */
export async function* streamChat({ personaId, message, conversationHistory = [] }) {
  const headers = await authHeaders();
  const res = await fetch(`${PERSONA_URL}/personas/${personaId}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, conversationHistory }),
  });

  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          yield data;
        } catch {}
      }
    }
  }
}

/**
 * Confrontation Mode — all 4 personas respond to one statement.
 */
export async function runConfrontation({ statement, currentBeliefs }) {
  const headers = await authHeaders();
  const res = await fetch(`${PERSONA_URL}/personas/confrontation`, {
    method: "POST",
    headers,
    body: JSON.stringify({ statement, currentBeliefs }),
  });
  if (!res.ok) throw new Error(`Confrontation failed: ${res.status}`);
  return res.json();
}

export async function getConfrontationHistory(limit = 5) {
  const headers = await authHeaders();
  const res = await fetch(`${PERSONA_URL}/personas/confrontation/history?limit=${limit}`, { headers });
  if (!res.ok) throw new Error(`Get confrontation history failed: ${res.status}`);
  return res.json();
}

// ─── Synthesis Service ────────────────────────────────────────────────────────

export async function getGapScore() {
  const headers = await authHeaders();
  const res = await fetch(`${SYNTHESIS_URL}/synthesis/gap-score`, { headers });
  if (!res.ok) throw new Error(`Get gap score failed: ${res.status}`);
  return res.json();
}

export async function generatePerceptionMap() {
  const headers = await authHeaders();
  const res = await fetch(`${SYNTHESIS_URL}/synthesis/perception-map`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Generate map failed: ${res.status}`);
  return res.json();
}

export async function getMirrorMoment() {
  const headers = await authHeaders();
  const res = await fetch(`${SYNTHESIS_URL}/synthesis/mirror-moment`, { headers });
  if (!res.ok) throw new Error(`Get mirror moment failed: ${res.status}`);
  return res.json();
}

export async function getArchetype() {
  const headers = await authHeaders();
  const res = await fetch(`${SYNTHESIS_URL}/synthesis/archetype`, { headers });
  if (!res.ok) throw new Error(`Get archetype failed: ${res.status}`);
  return res.json();
}

export async function generateWeeklyReport() {
  const headers = await authHeaders();
  const res = await fetch(`${SYNTHESIS_URL}/synthesis/weekly-report`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Generate report failed: ${res.status}`);
  return res.json();
}
