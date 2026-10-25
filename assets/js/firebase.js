
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Firebase Console の「プロジェクトの設定」→「全般」
// →「マイアプリ」→「SDK の設定と構成」から取得した値を設定する
const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6PzWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

// 同じページ内で Firebase App を重複初期化しない
const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// Authentication と Firestore を共通化
const auth = getAuth(app);
const db = getFirestore(app);

// ログイン状態をブラウザに保持する設定
const persistenceReady = setPersistence(
  auth,
  browserLocalPersistence
);

// Google ログイン用プロバイダー
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

// 既存コードとの互換性が必要な場合に備えて公開
if (typeof window !== "undefined") {
  window.FIREBASE_CONFIG = firebaseConfig;
  window.firebaseApp = app;
  window.firebaseAuth = auth;
  window.firebaseDb = db;
  window.googleProvider = googleProvider;
}

// 他の JavaScript ファイルから利用できるようにする
export {
  app,
  auth,
  db,
  firebaseConfig,
  googleProvider,
  persistenceReady,

  // Authentication
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,

  // Firestore
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp
};
