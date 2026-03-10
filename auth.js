// ═══════════════════════════════════════════
//   AuthForge — Authentication Module
// ═══════════════════════════════════════════

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { app } from '../firebase/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── AUTH STATE OBSERVER ──────────────────
// Call on protected pages to redirect if not logged in
function requireAuth(redirectTo = '/login.html') {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

// Redirect if already logged in (for login/signup pages)
function redirectIfLoggedIn(redirectTo = '/dashboard.html') {
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = redirectTo;
  });
}

// ── CREATE USER PROFILE IN FIRESTORE ─────
async function createUserProfile(user, extra = {}) {
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);
  if (!existing.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || extra.displayName || '',
      photoURL: user.photoURL || '',
      role: 'user',
      plan: 'free',
      disabled: false,
      emailVerified: user.emailVerified,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      apiCallCount: 0,
      ...extra
    });
  } else {
    // Update last login
    await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
  }
}

// ── SIGN UP ───────────────────────────────
async function signUp(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Update display name
  await updateProfile(user, { displayName });

  // Send email verification
  await sendEmailVerification(user);

  // Create Firestore profile
  await createUserProfile(user, { displayName });

  return user;
}

// ── SIGN IN ───────────────────────────────
async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await createUserProfile(credential.user); // update last login
  return credential.user;
}

// ── GOOGLE SIGN IN ────────────────────────
async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await createUserProfile(result.user);
  return result.user;
}

// ── SIGN OUT ──────────────────────────────
async function logOut() {
  await signOut(auth);
  window.location.href = '/index.html';
}

// ── PASSWORD RESET ────────────────────────
async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── GET CURRENT USER ──────────────────────
function getCurrentUser() {
  return auth.currentUser;
}

// ── FIREBASE ERROR MESSAGES ───────────────
function getAuthErrorMessage(code) {
  const messages = {
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/invalid-credential': 'Invalid email or password.',
  };
  return messages[code] || 'An unexpected error occurred. Please try again.';
}

export {
  auth,
  db,
  onAuthStateChanged,
  requireAuth,
  redirectIfLoggedIn,
  signUp,
  signIn,
  signInWithGoogle,
  logOut,
  resetPassword,
  getCurrentUser,
  createUserProfile,
  getAuthErrorMessage
};
