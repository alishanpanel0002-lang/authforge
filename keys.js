// ═══════════════════════════════════════════
//   AuthForge — Netlify Function: GET /api/keys
// ═══════════════════════════════════════════

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
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
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const authHeader = event.headers["authorization"] || event.headers["Authorization"] || "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!rawKey) {
    return {
      statusCode: 401,
      headers: CORS,
      body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Missing API key" } }),
    };
  }

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
      body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }),
    };
  }

  const userId = keysSnap.docs[0].data().userId;

  const userKeysSnap = await db
    .collection("api_keys")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  const keys = userKeysSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
    prefix: d.data().keyPrefix,
    suffix: d.data().keySuffix,
    active: d.data().active,
    usageCount: d.data().usageCount || 0,
    createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || null,
    lastUsedAt: d.data().lastUsedAt?.toDate?.()?.toISOString?.() || null,
  }));

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ keys, count: keys.length }),
  };
};
