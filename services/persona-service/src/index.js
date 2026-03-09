/**
 * mirror/services/persona-service/src/index.js
 *
 * Main entry point for the Mirror Persona Service.
 * Runs both an HTTP server (REST API) and a WebSocket server (Gemini Live proxy).
 *
 * PORT: 8080 (Cloud Run default)
 */

require("dotenv").config();

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { initFirebase, getFirestore } = require("./utils/firebase");
const { verifyWsToken } = require("./middleware/auth");
const { createLiveSession, getActiveSessionCount } = require("./services/liveSessionManager");
const personaRoutes = require("./routes/persona");
const scenarioRoutes = require("./routes/scenarios");

// ─── Init ────────────────────────────────────────────────────────────────────

initFirebase();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("combined"));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" })); // 10mb for base64 image frames

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "mirror-persona-service",
    version: process.env.npm_package_version || "1.0.0",
    activeLiveSessions: getActiveSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use("/personas", personaRoutes);
app.use("/scenarios", scenarioRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("[Error]", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ─── WebSocket Server (Gemini Live Proxy) ────────────────────────────────────

const wss = new WebSocket.Server({
  server,
  path: "/live",
  // Max payload: 10MB for audio chunks
  maxPayload: 10 * 1024 * 1024,
});

wss.on("connection", async (ws, req) => {
  console.log("[WS] New connection from", req.socket.remoteAddress);

  // Extract auth token and session params from query string
  const url = new URL(req.url, `http://localhost`);
  const token = url.searchParams.get("token");
  const personaId = url.searchParams.get("persona");

  // Verify auth
  let user;
  try {
    user = await verifyWsToken(token);
    console.log(`[WS] Authenticated user: ${user.uid}`);
  } catch (err) {
    console.error("[WS] Auth failed:", err.message);
    ws.send(JSON.stringify({ type: "error", message: "Authentication failed" }));
    ws.close(4001, "Unauthorized");
    return;
  }

  // Validate persona
  if (!personaId) {
    ws.send(JSON.stringify({ type: "error", message: "persona query param required" }));
    ws.close(4002, "Missing persona");
    return;
  }

  // Get user's dossier from Firestore
  let dossier = "No profile available.";
  let userName = user.name || "User";
  try {
    const db = getFirestore();
    const doc = await db
      .collection("users").doc(user.uid)
      .collection("profile").doc("dossier")
      .get();
    if (doc.exists) {
      dossier = doc.data().content;
      userName = doc.data().userName || userName;
    }
  } catch (err) {
    console.error("[WS] Failed to fetch dossier:", err.message);
  }

  // Create live session
  try {
    const sessionId = await createLiveSession({
      clientWs: ws,
      userId: user.uid,
      personaId,
      dossier,
      userName,
    });

    if (sessionId) {
      console.log(`[WS] Live session created: ${sessionId}`);
    }
  } catch (err) {
    console.error("[WS] Failed to create live session:", err);
    ws.send(JSON.stringify({ type: "error", message: "Failed to start live session" }));
    ws.close(4003, "Session creation failed");
  }
});

wss.on("error", (err) => {
  console.error("[WS Server] Error:", err);
});

// ─── Start Server ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║        Mirror Persona Service             ║
║  HTTP:      http://localhost:${PORT}         ║
║  WebSocket: ws://localhost:${PORT}/live      ║
║  Env:       ${process.env.NODE_ENV || "development"}                  ║
╚═══════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

process.on("SIGTERM", () => {
  console.log("[SIGTERM] Shutting down gracefully...");
  server.close(() => {
    console.log("[SIGTERM] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[SIGINT] Shutting down...");
  process.exit(0);
});

module.exports = { app, server };
