// ============================================================
// Firebase Module
// 学習AIチャット
// ============================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// ============================================================
// Firebase Configuration
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6PzWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};


// ============================================================
// Initialize Firebase
// ============================================================

const app = initializeApp(firebaseConfig);


// ============================================================
// Firebase Services
// ============================================================

const auth = getAuth(app);

const db = getFirestore(app);


// ============================================================
// Authentication Persistence
// ============================================================

const persistenceReady = setPersistence(
  auth,
  browserLocalPersistence
);


// ============================================================
// Exports
// ============================================================

export {
  app,

  auth,

  db,

  persistenceReady,

  onAuthStateChanged,

  signInWithEmailAndPassword,

  signInWithPopup,

  signInWithRedirect,

  getRedirectResult,

  GoogleAuthProvider,

  signOut,

  sendPasswordResetEmail,

  doc,

  getDoc
};
