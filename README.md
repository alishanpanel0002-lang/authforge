# ⬡ AuthForge — Developer Authentication Platform
### 100% Free · No Credit Card · Ever

Built on **Firebase** (Auth + Firestore) + **Netlify** (hosting + serverless functions).

---

## 💳 Why No Credit Card?

| Service | What it does | Free tier | Card needed? |
|---|---|---|---|
| Firebase Auth | User login, OAuth, email verify | Unlimited | ❌ No |
| Firestore | Database | 50K reads/day, 20K writes/day | ❌ No |
| Netlify Hosting | Serves your HTML/CSS/JS | 100GB bandwidth/month | ❌ No |
| Netlify Functions | Your API backend | 125K invocations/month | ❌ No |

---

## 📁 Project Structure

```
/authforge
├── index.html              # Landing page
├── login.html              # Sign in
├── signup.html             # Create account
├── dashboard.html          # User dashboard
├── admin.html              # Admin panel
├── docs.html               # API documentation
├── playground.html         # Interactive API tester
├── reset-password.html     # Password reset
│
├── netlify.toml            # Netlify config + API URL redirects
├── package.json            # firebase-admin dependency
├── firebase.json           # Firestore rules/indexes deployment
├── firestore.rules         # Database security rules
├── firestore.indexes.json  # Composite query indexes
│
├── css/styles.css          # Complete stylesheet (dark/light theme)
├── js/utils.js             # Toast, clipboard, theme helpers
├── js/auth.js              # Firebase Auth module
├── js/dashboard.js         # Dashboard + API key logic
├── firebase/firebase-config.js
│
└── netlify/functions/
    ├── user.js             # GET  /api/user
    ├── validate.js         # POST /api/validate
    └── keys.js             # GET  /api/keys
```

---

## 🚀 Setup Guide (No Card Required)

### PART 1 — Firebase (5 min)

1. Go to https://console.firebase.google.com → Add project → name it "authforge"
2. **Authentication** → Get started → Enable Email/Password + Google
3. **Firestore Database** → Create database → Production mode → us-central1
4. **Project Settings** (gear icon) → General → scroll to "Your apps" → Web icon (</>)
5. Register app "authforge-web" → copy the firebaseConfig object
6. Paste it into `firebase/firebase-config.js`

**Get Admin SDK credentials (for Netlify Functions):**
1. Project Settings → **Service accounts** tab
2. Click **Generate new private key** → download the JSON file
3. You'll use 3 values from it as Netlify env vars (see Part 3)

---

### PART 2 — Deploy to Netlify (5 min)

1. Create account at https://netlify.com (no card needed)
2. Push project to GitHub OR use drag-and-drop deploy
3. Netlify → Add new site → Import from Git → select repo
4. Build settings: build command = empty, publish dir = `.`
5. Deploy site

---

### PART 3 — Set Environment Variables

In Netlify: Site configuration → Environment variables → Add a variable

| Variable Name | Value (from your service account JSON) |
|---|---|
| `FIREBASE_PROJECT_ID` | The `project_id` field |
| `FIREBASE_CLIENT_EMAIL` | The `client_email` field |
| `FIREBASE_PRIVATE_KEY` | The entire `private_key` field (with \n characters) |

After adding all 3 → Trigger a redeploy.

---

### PART 4 — Deploy Firestore Rules

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # select your project
firebase deploy --only firestore
```

---

### PART 5 — Update Your Site URL

Replace `YOUR-SITE.netlify.app` with your real Netlify URL in:
- `playground.html`
- `docs.html`
- `dashboard.html`

---

### PART 6 — Grant Yourself Admin Access

1. Firebase Console → Firestore → users collection
2. Find your user document
3. Edit: change `role` from `"user"` to `"admin"`
4. Access /admin.html

---

## 🌐 API Reference

Base URL: `https://YOUR-SITE.netlify.app/api`

### GET /api/user
```bash
curl https://YOUR-SITE.netlify.app/api/user \
  -H "Authorization: Bearer af_live_YOUR_KEY"
```
Returns: `{ id, email, displayName, plan, created_at, emailVerified, apiCallCount }`

### POST /api/validate
```bash
curl -X POST https://YOUR-SITE.netlify.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"af_live_YOUR_KEY"}'
```
Returns: `{ valid, userId, keyId }`

### GET /api/keys
```bash
curl https://YOUR-SITE.netlify.app/api/keys \
  -H "Authorization: Bearer af_live_YOUR_KEY"
```
Returns: `{ keys: [...], count }`

---

## Error Codes

| Status | Code | Meaning |
|---|---|---|
| 401 | UNAUTHORIZED | Missing or invalid API key |
| 403 | FORBIDDEN | Account disabled |
| 429 | RATE_LIMITED | 60 req/min exceeded |
| 500 | INTERNAL_ERROR | Server error |

---

## 🔒 Security

- Keys hashed with SHA-256 before storage
- Raw key shown only once at creation
- Firestore Security Rules on all collections
- Rate limiting: 60 req/min per user
- HTTPS enforced by Netlify
- Admin role required for /admin.html

