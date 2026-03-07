const { getAuth } = require("../utils/firebase");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    console.error("[Auth] Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function verifyWsToken(token) {
  if (!token) throw new Error("No token provided");
  return getAuth().verifyIdToken(token);
}

module.exports = { requireAuth, verifyWsToken };
