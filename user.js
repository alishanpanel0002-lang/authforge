// ═══════════════════════════════════════════
//   AuthForge — Netlify Function: GET /api/user
//   No credit card required · Free tier
// ═══════════════════════════════════════════

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

// Init Firebase Admin once (reused across warm invocations)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Netlify stores multiline env vars — replace literal \n
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

function hashApiKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" } }),
    };
  }

  const startTime = Date.now();

  // ── Extract Bearer token ──────────────────
  const authHeader = event.headers["authorization"] || event.headers["Authorization"] || "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!rawKey) {
    return {
      statusCode: 401,
      headers: CORS,
      body: JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "Missing Authorization header. Use: Bearer YOUR_API_KEY" },
      }),
    };
  }

  // ── Look up key by hash ───────────────────
  const keyHash = hashApiKey(rawKey);
  const keysSnap = await db
    .collection("api_keys")
    .where("keyHash", "==", keyHash)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (keysSnap.empty) {
    return {
      statusCode: 401,
      headers: CORS,
      body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid or revoked API key" } }),
    };
  }

  const keyDoc = keysSnap.docs[0];
  const keyData = keyDoc.data();

  // ── Check user account ────────────────────
  const userDoc = await db.doc(`users/${keyData.userId}`).get();
  if (!userDoc.exists || userDoc.data().disabled) {
    return {
      statusCode: 403,
      headers: CORS,
      body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Account is disabled" } }),
    };
  }

  const userData = userDoc.data();

  // ── Rate limit: 60 req/min per user ───────
  const windowStart = new Date(Date.now() - 60_000);
  const recentCalls = await db
    .collection("api_usage")
    .where("userId", "==", keyData.userId)
    .where("timestamp", ">=", windowStart)
    .get();

  const RATE_LIMIT = 60;
  const remaining = Math.max(0, RATE_LIMIT - recentCalls.size);
  const resetTs = Math.floor((Date.now() + 60_000) / 1000);

  const rateLimitHeaders = {
    ...CORS,
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetTs),
  };

  if (recentCalls.size >= RATE_LIMIT) {
    await logUsage(db, keyData.userId, keyDoc.id, "/api/user", 429, Date.now() - startTime);
    return {
      statusCode: 429,
      headers: rateLimitHeaders,
      body: JSON.stringify({
        error: { code: "RATE_LIMITED", message: "Too many requests. Slow down.", retryAfter: resetTs },
      }),
    };
  }

  // ── Build response ────────────────────────
  const responseData = {
    id: keyData.userId,
    email: userData.email,
    displayName: userData.displayName || null,
    plan: userData.plan || "free",
    created_at: userData.createdAt?.toDate?.()?.toISOString?.() || null,
    emailVerified: userData.emailVerified || false,
    apiCallCount: (userData.apiCallCount || 0) + 1,
  };

  // Log async (don't await — keeps response fast)
  logUsage(db, keyData.userId, keyDoc.id, "/api/user", 200, Date.now() - startTime);

  return {
    statusCode: 200,
    headers: rateLimitHeaders,
    body: JSON.stringify(responseData),
  };
};

async function logUsage(db, userId, keyId, endpoint, statusCode, responseTime) {
  try {
    await Promise.all([
      db.collection("api_usage").add({
        userId,
        keyId,
        endpoint,
        statusCode,
        responseTime,
        eventType: "api_request",
        timestamp: new Date(),
      }),
      db.doc(`users/${userId}`).update({
        apiCallCount: FieldValue.increment(1),
        lastApiCallAt: FieldValue.serverTimestamp(),
      }),
      db.doc(`api_keys/${keyId}`).update({
        usageCount: FieldValue.increment(1),
        lastUsedAt: FieldValue.serverTimestamp(),
      }),
    ]);
  } catch (e) {
    console.error("Log error:", e.message);
  }
}
