// assets/js/firebase-module.js
// Firebase compat SDK を ES module から安全に利用するための共通アダプター。

const FIREBASE_VERSION = "10.12.5";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6P8zWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(
      script => script.src === src
    );

    const alreadyAvailable =
      (src.includes("firebase-app-compat") && !!window.firebase) ||
      (src.includes("firebase-auth-compat") && !!window.firebase?.auth) ||
      (src.includes("firebase-firestore-compat") && !!window.firebase?.firestore);

    if (existing?.dataset.loaded === "true" || alreadyAvailable) {
      resolve();
      return;
    }

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Firebase SDKを読み込めません: ${src}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;

    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };

    script.onerror = () => {
      reject(new Error(`Firebase SDKを読み込めません: ${src}`));
    };

    document.head.append(script);
  });
}

async function ensureCompatSDK() {
  if (window.firebase?.auth && window.firebase?.firestore) {
    return;
  }

  await loadScript(
    `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`
  );

  await loadScript(
    `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth-compat.js`
  );

  await loadScript(
    `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore-compat.js`
  );

  if (!window.firebase?.auth || !window.firebase?.firestore) {
    throw new Error(
      "Firebase SDKの読み込み後もAuthまたはFirestoreが利用できません。"
    );
  }
}

await ensureCompatSDK();

if (!window.firebase.apps.length) {
  window.firebase.initializeApp(FIREBASE_CONFIG);
}

export const app = window.firebase.app();
export const auth = window.firebase.auth();
export const db = window.firebase.firestore();

export const persistenceReady =
  window.authReadyPromise ||
  auth.setPersistence(
    window.firebase.auth.Auth.Persistence.LOCAL
  ).catch(error => {
    console.error(
      "Firebase Authenticationの保存設定に失敗しました:",
      error
    );
    throw error;
  });

// 旧式ページとの互換性を維持
window.firebaseApp = app;
window.auth = auth;
window.db = db;
window.authReadyPromise = persistenceReady;

export const GoogleAuthProvider =
  window.firebase.auth.GoogleAuthProvider;

export function onAuthStateChanged(
  authInstance,
  callback,
  errorCallback
) {
  return authInstance.onAuthStateChanged(callback, errorCallback);
}

export function signInWithEmailAndPassword(
  authInstance,
  email,
  password
) {
  return authInstance.signInWithEmailAndPassword(email, password);
}

export function createUserWithEmailAndPassword(
  authInstance,
  email,
  password
) {
  return authInstance.createUserWithEmailAndPassword(email, password);
}

export function sendPasswordResetEmail(
  authInstance,
  email
) {
  return authInstance.sendPasswordResetEmail(email);
}

export function signInWithPopup(
  authInstance,
  provider
) {
  return authInstance.signInWithPopup(provider);
}

export function signOut(authInstance) {
  return authInstance.signOut();
}

export function doc(...args) {
  return window.firebase.firestore().doc(...args);
}

export function collection(...args) {
  return window.firebase.firestore().collection(...args);
}

export function getDoc(reference) {
  return reference.get();
}

export function getDocs(reference) {
  return reference.get();
}

export function setDoc(reference, data, options) {
  return reference.set(data, options);
}

export function updateDoc(reference, data) {
  return reference.update(data);
}

export function addDoc(reference, data) {
  return reference.add(data);
}

export function deleteDoc(reference) {
  return reference.delete();
}

export function query(reference, ...constraints) {
  return constraints.reduce(
    (current, constraint) => constraint(current),
    reference
  );
}

export function where(field, operator, value) {
  return reference => reference.where(field, operator, value);
}

export function orderBy(field, direction = "asc") {
  return reference => reference.orderBy(field, direction);
}

export function limit(count) {
  return reference => reference.limit(count);
}

export function serverTimestamp() {
  return window.firebase.firestore.FieldValue.serverTimestamp();
}

export function Timestamp(...args) {
  return new window.firebase.firestore.Timestamp(...args);
}

export const FieldValue =
  window.firebase.firestore.FieldValue;
