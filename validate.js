// ═══════════════════════════════════════════
//   AuthForge — Netlify Function: POST /api/validate
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }),
    };
  }

  const { apiKey } = body;
  if (!apiKey) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: { code: "BAD_REQUEST", message: "apiKey field required in body" } }),
    };
  }

  const keyHash = hashApiKey(apiKey);
  const keysSnap = await db
    .collection("api_keys")
    .where("keyHash", "==", keyHash)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (keysSnap.empty) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid: false }) };
  }

  const keyData = keysSnap.docs[0].data();
  const userDoc = await db.doc(`users/${keyData.userId}`).get();
  const valid = userDoc.exists && !userDoc.data()?.disabled;

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      valid,
      userId: valid ? keyData.userId : null,
      keyId: valid ? keysSnap.docs[0].id : null,
    }),
  };
};
