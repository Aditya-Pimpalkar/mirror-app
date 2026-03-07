/**
 * mirror/services/notification-service/src/index.js
 * Mirror Notification Service — push notifications + scheduled jobs
 * PORT: 8083
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 8083;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));
app.use(express.json());

// ─── Health check ──────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "mirror-notification-service", timestamp: new Date().toISOString() });
});

// ─── Send Mirror Moment (called by Cloud Scheduler daily) ──
app.post("/notify/mirror-moment", async (req, res) => {
  const authHeader = req.headers.authorization;
  const isScheduler = authHeader === `Bearer ${process.env.SCHEDULER_SECRET}`;
  if (!isScheduler) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get all users with FCM tokens
    const users = await db.collection("users")
      .where("fcmToken", "!=", null)
      .limit(500)
      .get();

    let sent = 0;
    for (const userDoc of users.docs) {
      const { fcmToken } = userDoc.data();
      if (!fcmToken) continue;

      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "🪞 Mirror Moment",
          body: "One of your four voices has a question for you today.",
        },
        data: { type: "mirror_moment", userId: userDoc.id },
      }).catch(() => {}); // Ignore individual failures

      sent++;
    }

    res.json({ success: true, sent });
  } catch (err) {
    console.error("[mirror-moment] Error:", err);
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

// ─── Send Weekly Report notification ──────────────────────
app.post("/notify/weekly-report", async (req, res) => {
  const isScheduler = req.headers.authorization === `Bearer ${process.env.SCHEDULER_SECRET}`;
  if (!isScheduler) return res.status(401).json({ error: "Unauthorized" });

  try {
    const users = await db.collection("users")
      .where("fcmToken", "!=", null)
      .limit(500)
      .get();

    let sent = 0;
    for (const userDoc of users.docs) {
      const { fcmToken, gapScore } = userDoc.data();
      if (!fcmToken) continue;
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "📊 Your Weekly Mirror Report",
          body: gapScore ? `Your Gap Score this week: ${gapScore}. See what shifted.` : "Your weekly reputation report is ready.",
        },
        data: { type: "weekly_report", userId: userDoc.id },
      }).catch(() => {});
      sent++;
    }

    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ error: "Failed to send weekly reports" });
  }
});

// ─── Register FCM token for a user ────────────────────────
app.post("/notify/register", async (req, res) => {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: "fcmToken required" });

    await db.collection("users").doc(decoded.uid).set(
      { fcmToken, fcmUpdatedAt: new Date().toISOString() },
      { merge: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to register token" });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Mirror Notification Service running on :${PORT}`);
});

process.on("SIGTERM", () => { process.exit(0); });
