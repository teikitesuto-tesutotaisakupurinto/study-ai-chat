import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/*
 * Firebase設定はこのファイルだけで管理する。
 * login.htmlなどに同じ設定を書かない。
 */
const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6PzWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

export const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const googleProvider =
  new GoogleAuthProvider();

/*
 * ログイン状態をブラウザに保持する。
 */
export const persistenceReady =
  setPersistence(
    auth,
    browserLocalPersistence
  );

/*
 * 必要なFirebase機能をexport
 */
export {
  getApps,
  getApp,

  GoogleAuthProvider,

  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,

  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
};
