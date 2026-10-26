// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

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
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// ============================================================
// Firebase Configuration
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6P8zWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};


// ============================================================
// Firebase Initialize
// ============================================================

let app;

try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase初期化エラー:", error);
  throw error;
}


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
// Google Provider
// ============================================================

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});


// ============================================================
// Export
// ============================================================

export {
  app,
  auth,
  db,

  persistenceReady,

  googleProvider,

  onAuthStateChanged,

  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,

  GoogleAuthProvider,

  signOut,

  sendPasswordResetEmail,

  doc,
  getDoc,
  setDoc,
  updateDoc,

  collection,
  getDocs,

  query,
  where,
  orderBy,
  limit,

  addDoc,
  deleteDoc
};
