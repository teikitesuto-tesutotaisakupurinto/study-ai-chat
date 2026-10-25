
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

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
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
 * Firebase Console
 * → プロジェクトの設定
 * → マイアプリ
 * → WebアプリのSDK設定
 *
 * 以下を実際のfirebaseConfigに置き換える。
 */
const firebaseConfig = {
  const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6PzWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

/*
 * 既存コードとの互換性用。
 * 新しいコードでは firebaseConfig を使用する。
 */
window.FIREBASE_CONFIG = firebaseConfig;

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

/*
 * ブラウザを閉じてもログイン状態を保持する。
 * ログイン処理の前に persistenceReady を待つ。
 */
const persistenceReady = setPersistence(
  auth,
  browserLocalPersistence
);

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
  serverTimestamp,
  onSnapshot
};
