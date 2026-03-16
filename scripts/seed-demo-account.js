/**
 * Mirror App — Demo Account Seeder
 * Creates a fully pre-seeded demo account for hackathon demo video
 * 
 * Usage: node scripts/seed-demo-account.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("../service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "mirror-app-aditya",
});

const db = admin.firestore();

// ─── Demo User Config ────────────────────────────────────────────────────────
// Create a new anonymous user or use existing
// We'll create a custom token user for demo purposes
const DEMO_USER_ID = "MkSs72f5V7T22WRK6GVHASMwUZx1";
const DEMO_NAME = "Adi";
const DEMO_BIO = "Senior software engineer with 5 years at Google. Stanford CS grad. Currently exploring founding a startup in developer tooling. Active open source contributor, 3 published papers on distributed systems, public speaker at KubeCon.";

// ─── Personas ─────────────────────────────────────────────────────────────────
const PERSONAS = {
  recruiter: { name: "Rachel", initialBelief: 20 },
  date: { name: "Alex", initialBelief: 35 },
  competitor: { name: "Chris", initialBelief: 18 },
  journalist: { name: "Jordan", initialBelief: 28 },
};

// ─── Belief scores after conversations ───────────────────────────────────────
const FINAL_BELIEFS = {
  recruiter: 58,
  date: 72,
  competitor: 41,
  journalist: 63,
};

// ─── Session messages per persona ────────────────────────────────────────────
const SESSIONS = {
  recruiter: [
    // Session 1 — 3 days ago
    {
      docId: "text-2026-03-13-recruiter",
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "text",
      finalBelief: 42,
      messages: [
        { role: "assistant", content: "I've looked you over, Alex. Your trajectory raises some questions. Let's start with the gaps.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1000).toISOString(), mode: "text" },
        { role: "user", content: "I spent 5 years at Google on the infrastructure team, then left to explore founding a startup.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: "text" },
        { role: "assistant", content: "Five years at Google is respectable. But 'exploring founding' is what people say when nothing has launched yet. What specifically have you shipped since leaving?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: "text" },
        { role: "user", content: "I've built a prototype of a developer observability tool. It's in closed beta with 12 companies.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: "text" },
        { role: "assistant", content: "Twelve companies in closed beta is real traction. What's the retention after 30 days?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 120000).toISOString(), mode: "text" },
        { role: "user", content: "Eight of twelve are still active after 60 days. Two have asked about pricing.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 150000).toISOString(), mode: "text" },
        { role: "assistant", content: "67% retention at 60 days is actually strong for B2B tooling. That changes my read on you somewhat. The narrative gap is between your Google brand and your founder credibility — you lead with the former when you should lead with the latter.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 180000).toISOString(), mode: "text" },
      ],
    },
    // Session 2 — yesterday (voice)
    {
      docId: `voice-2026-03-15-recruiter-s2`,
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "voice",
      finalBelief: 58,
      messages: [
        { role: "user", content: "I've been thinking about what you said. You're right that I lead with Google instead of the product.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: "voice" },
        { role: "user", content: "The product has 12 beta customers, 67% retention, and two pricing conversations. That's the real story.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: "voice" },
        { role: "user", content: "I published 3 papers on distributed systems and I'm speaking at KubeCon next month. I think that builds credibility in the space.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: "voice" },
        { role: "assistant", content: "[Voice session — 3 turns]\n\nAlex came back with considerably more clarity this time. They've clearly internalized the feedback from our first session — leading with product metrics rather than the Google brand. The KubeCon speaking slot is legitimate signal, not just resume filler. My remaining concern is whether they can make the transition from engineer to founder in how they present themselves under pressure. They're not there yet, but the trajectory is right.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 120000).toISOString(), mode: "voice_summary" },
      ],
    },
  ],

  date: [
    {
      docId: "text-2026-03-13-date",
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "text",
      finalBelief: 55,
      messages: [
        { role: "assistant", content: "So... I did some research before tonight. I have a few questions, Alex. Hope that's okay.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1000).toISOString(), mode: "text" },
        { role: "user", content: "Of course. What did you find?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: "text" },
        { role: "assistant", content: "You have a very curated online presence. LinkedIn, GitHub, a few conference talks. But I notice you don't post personal things — no opinions, no vulnerability, nothing that isn't professionally polished. Is that intentional?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: "text" },
        { role: "user", content: "I've always kept my personal life private. I don't think social media is the place for that.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: "text" },
        { role: "assistant", content: "That's a reasonable boundary. But I'm curious — what do people who know you well say about you that doesn't appear anywhere online?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 120000).toISOString(), mode: "text" },
        { role: "user", content: "My close friends would say I'm surprisingly funny in person. And that I cook really well. Neither of those things show up on LinkedIn.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 150000).toISOString(), mode: "text" },
        { role: "assistant", content: "That's the most interesting thing you've said. The gap between your public persona and who you actually are — that's either very healthy boundaries or a habit of keeping people at arm's length. Probably both.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 180000).toISOString(), mode: "text" },
      ],
    },
    {
      docId: `voice-2026-03-15-date-s2`,
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "voice",
      finalBelief: 72,
      messages: [
        { role: "user", content: "You made me think about that last time. I do keep people at a distance initially.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: "voice" },
        { role: "user", content: "It's not intentional. It's just how I grew up — in a family where you didn't share things publicly.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: "voice" },
        { role: "user", content: "But I'm aware of it now. I'm trying to be more present with people I care about.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: "voice" },
        { role: "assistant", content: "[Voice session — 3 turns]\n\nAlex opened up significantly in this session. The admission that distance is habitual rather than intentional is meaningful — it takes self-awareness to see that pattern. What struck me most was the phrase 'people I care about' — there's warmth underneath the polish. My read has shifted: this isn't someone who's emotionally unavailable, just someone who moves slowly. That's not a flaw.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 120000).toISOString(), mode: "voice_summary" },
      ],
    },
  ],

  competitor: [
    {
      docId: "text-2026-03-13-competitor",
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "text",
      finalBelief: 32,
      messages: [
        { role: "assistant", content: "Alex. I've been watching your trajectory. Interesting choices lately.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1000).toISOString(), mode: "text" },
        { role: "user", content: "What do you mean by interesting?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: "text" },
        { role: "assistant", content: "You left a senior role at Google — strong position, strong brand — to build in a space that Datadog, New Relic, and Honeycomb already own. Your differentiation isn't obvious from the outside. What makes you think you can compete?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: "text" },
        { role: "user", content: "The existing tools are built for ops teams. My tool is built for developers — it integrates into the IDE and surfaces issues during development, not in production.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: "text" },
        { role: "assistant", content: "Developer-first observability is a real wedge. But Honeycomb is already moving that direction. Your window is 18 months before the big players ship a version of what you're building. Are you moving fast enough?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 120000).toISOString(), mode: "text" },
        { role: "user", content: "We're shipping weekly. 12 beta customers, two pricing conversations already.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 150000).toISOString(), mode: "text" },
        { role: "assistant", content: "Weekly shipping is right. Pricing conversations at beta stage is right. You're still early but you're not wasting time. I'll upgrade my threat assessment slightly. Slightly.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 180000).toISOString(), mode: "text" },
      ],
    },
    {
      docId: `voice-2026-03-15-competitor-s2`,
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      mode: "voice",
      finalBelief: 41,
      messages: [
        { role: "user", content: "I've been thinking about your 18-month window comment. We're accelerating hiring.", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: "voice" },
        { role: "user", content: "Two engineers joining next month. We're going to ship the VS Code integration before KubeCon.", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: "voice" },
        { role: "assistant", content: "[Voice session — 2 turns]\n\nAlex is responding to pressure correctly — accelerating rather than defending. The VS Code integration is the right move. Shipping before KubeCon creates a conference narrative. Still not sure they have the go-to-market instinct to close deals at scale, but the product sense is real. Threat level: medium and rising.", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: "voice_summary" },
      ],
    },
  ],

  journalist: [
    {
      docId: "text-2026-03-13-journalist",
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "text",
      finalBelief: 51,
      messages: [
        { role: "assistant", content: "Alex, thanks for agreeing to talk. I found some things I'd like to understand better.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1000).toISOString(), mode: "text" },
        { role: "user", content: "What did you find?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: "text" },
        { role: "assistant", content: "You have three published papers on distributed systems. One of them has 847 citations. But you barely mention it publicly — it's buried in your CV, not on your LinkedIn, not in your bio. That's unusual for someone trying to establish founder credibility. Why are you hiding your best credential?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: "text" },
        { role: "user", content: "I don't think of myself as an academic. I moved on from that work. It feels like bragging to lead with citation counts.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: "text" },
        { role: "assistant", content: "847 citations isn't bragging — it's evidence. You're building a developer tool in a space defined by technical credibility, and you're leaving your strongest proof point off the table because of some notion of modesty. That's not humility. That's self-sabotage.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 120000).toISOString(), mode: "text" },
        { role: "user", content: "I hadn't thought of it that way. You're right.", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 150000).toISOString(), mode: "text" },
        { role: "assistant", content: "The story I could write about you is: 'Researcher with 847 citations builds tool to solve the problem his papers identified.' That's a good story. The story you're currently telling is 'ex-Googler builds another dev tool.' Which one gets read?", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 180000).toISOString(), mode: "text" },
      ],
    },
    {
      docId: `voice-2026-03-15-journalist-s2`,
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      mode: "voice",
      finalBelief: 63,
      messages: [
        { role: "user", content: "I updated my LinkedIn bio to lead with the research. Added the citation count.", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: "voice" },
        { role: "user", content: "I also rewrote my pitch deck opening. Research problem first, product second, Google third.", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: "voice" },
        { role: "user", content: "It's a better story. I can feel it when I say it out loud.", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: "voice" },
        { role: "assistant", content: "[Voice session — 3 turns]\n\nAlex moved fast. The LinkedIn update and pitch reframe happened within 48 hours of our last conversation — that's the kind of execution speed that distinguishes people who can actually be coached from people who just nod along. The 'I can feel it when I say it out loud' line is telling — they've found the authentic version of the story, not just a more optimized one. This person has a real narrative now.", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 120000).toISOString(), mode: "voice_summary" },
      ],
    },
  ],
};

// ─── Perception Map Report ─────────────────────────────────────────────────────
const PERCEPTION_MAP = {
  verdicts: {
    recruiter: "Strong technical foundation and real product traction, but the narrative still defaults to credential-dropping under pressure. The pivot from Google brand to founder metrics is happening but incomplete.",
    date: "Warm, self-aware, and genuinely curious about growth. The emotional distance is habitual rather than intentional — and they know it. That awareness is attractive.",
    competitor: "Technically credible with a real product wedge. The 18-month window is real and they're accelerating appropriately. Not the most dangerous founder I've watched, but more dangerous than they look.",
    journalist: "The gap between their actual credentials (847-citation researcher) and their public narrative (ex-Googler) is their biggest vulnerability — and biggest opportunity. They're starting to close it.",
  },
  consensus: "All four perspectives agree on one thing: the public narrative is underperforming the actual person. The substance is there. The story isn't caught up yet.",
  blindSpot: "You systematically undervalue your research credentials in favor of your corporate brand — even though the research is more differentiated. This pattern appears across career, relationships, and public image simultaneously.",
  strengths: ["Executes on feedback immediately", "Technical depth is genuine not performed", "Self-awareness is above average", "Product traction is real"],
  risks: ["Story lags substance by 6-12 months", "Modesty pattern reads as lack of conviction to some audiences", "Window for competitive differentiation is narrowing"],
  openQuestion: "When you stop leading with where you worked and start leading with what you discovered — who does that make you?",
  gapScore: 52,
  archetypeId: "architect",
};

// ─── Main Seed Function ────────────────────────────────────────────────────────

async function seedDemoAccount() {
  console.log(`\n🪞 Mirror Demo Account Seeder`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`User ID: ${DEMO_USER_ID}`);
  console.log(`Name:    ${DEMO_NAME}\n`);

  // 1. Create profile/dossier
  console.log(`[1/5] Creating profile...`);
  const profileRef = db.collection("users").doc(DEMO_USER_ID)
    .collection("profile").doc("dossier");
  await profileRef.set({
    userId: DEMO_USER_ID,
    userName: DEMO_NAME,
    rawBio: DEMO_BIO,
    publicLinks: ["https://github.com/demo-alex"],
    structured: {
      summary: "Senior software engineer turned founder with deep distributed systems research background. 5 years at Google, now building developer observability tooling. Published researcher with 847 citations. Active open source contributor and public speaker.",
      career_narrative: DEMO_BIO.slice(0, 300),
      open_questions: [
        "Can they make the transition from engineer to founder identity?",
        "Will research credibility translate to market credibility?",
        "How does their privacy pattern affect team building?",
      ],
    },
    content: `Name: ${DEMO_NAME}\nBackground: ${DEMO_BIO}`,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  });
  console.log(`   ✓ Profile created`);

  // 2. Create persona belief scores
  console.log(`[2/5] Setting belief scores...`);
  for (const [personaId, belief] of Object.entries(FINAL_BELIEFS)) {
    await db.collection("users").doc(DEMO_USER_ID)
      .collection("personas").doc(personaId).set({
        personaId,
        currentBelief: belief,
        conversationCount: 2,
        lastSessionAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      }, { merge: true });
    console.log(`   ✓ ${PERSONAS[personaId].name}: ${belief}/100`);
  }

  // 3. Create sessions with messages
  console.log(`[3/5] Creating conversation sessions...`);
  for (const [personaId, sessions] of Object.entries(SESSIONS)) {
    for (const session of sessions) {
      await db.collection("users").doc(DEMO_USER_ID)
        .collection("personas").doc(personaId)
        .collection("sessions").doc(session.docId).set({
          sessionId: session.docId,
          personaId,
          userId: DEMO_USER_ID,
          messages: session.messages,
          startedAt: session.startedAt,
          endedAt: new Date(new Date(session.startedAt).getTime() + 20 * 60 * 1000).toISOString(),
          finalBelief: session.finalBelief,
          initialBelief: PERSONAS[personaId].initialBelief,
          beliefDelta: session.finalBelief - PERSONAS[personaId].initialBelief,
          messageCount: session.messages.length,
          mode: session.mode,
        });
      console.log(`   ✓ ${PERSONAS[personaId].name} — ${session.mode} session (${session.messages.length} messages)`);
    }
  }

  // 4. Create perception map report
  console.log(`[4/5] Creating perception map...`);
  await db.collection("users").doc(DEMO_USER_ID)
    .collection("reports").doc("latest-perception-map").set({
      type: "perception_map",
      userId: DEMO_USER_ID,
      generatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      ...PERCEPTION_MAP,
      beliefs: FINAL_BELIEFS,
    });
  console.log(`   ✓ Perception map created`);

  // 5. Create streaks
  console.log(`[5/5] Creating streaks...`);
  const streaks = {
    recruiter: { count: 2, lastDate: new Date().toDateString() },
    date: { count: 3, lastDate: new Date().toDateString() },
    competitor: { count: 2, lastDate: new Date().toDateString() },
    journalist: { count: 2, lastDate: new Date().toDateString() },
  };
  await db.collection("users").doc(DEMO_USER_ID)
    .collection("meta").doc("streaks").set({ streaks, updatedAt: new Date().toISOString() });
  console.log(`   ✓ Streaks created`);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Demo account seeded successfully!`);
  console.log(`\nUser ID to use: ${DEMO_USER_ID}`);
  console.log(`\nTo use this account in the app:`);
  console.log(`1. Open browser console on mirror-app-cyan.vercel.app`);
  console.log(`2. Run: localStorage.clear()`);
  console.log(`3. The app will create a new anonymous user`);
  console.log(`4. Run in console after page loads:`);
  console.log(`   Copy the UID from Firebase Auth and update DEMO_USER_ID\n`);
  
  process.exit(0);
}

seedDemoAccount().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
