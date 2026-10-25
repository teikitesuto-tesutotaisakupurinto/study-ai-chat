import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* =========================================================
   Firebase設定
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6PzWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

/*
  他の古いコードから参照される場合に備える
*/
window.FIREBASE_CONFIG = firebaseConfig;

/* =========================================================
   Firebase初期化
   ========================================================= */

let app;

try {
  app = getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);
} catch (error) {
  console.error(
    "Firebase初期化エラー:",
    error
  );

  throw error;
}

/* =========================================================
   Authentication
   ========================================================= */

const auth = getAuth(app);

/*
  ログイン状態をブラウザに保持
*/
const persistenceReady =
  setPersistence(
    auth,
    browserLocalPersistence
  );

/* =========================================================
   Firestore
   ========================================================= */

const db =
  getFirestore(app);

/* =========================================================
   エクスポート
   ========================================================= */

export {
  app,
  auth,
  db,
  firebaseConfig,
  persistenceReady,

  onAuthStateChanged,
  signOut,

  signInWithEmailAndPassword,

  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,

  sendPasswordResetEmail,

  doc,
  getDoc,
  setDoc,
  updateDoc,

  collection,
  addDoc,
  getDocs,

  query,
  where,
  orderBy,
  limit,

  serverTimestamp
};
