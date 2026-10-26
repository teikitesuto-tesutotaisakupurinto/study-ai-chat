// assets/js/firebase-module.js
// Firebase compat SDK 共通アダプター
// 対応: Firebase Authentication / Cloud Firestore

const FIREBASE_VERSION = "10.12.5";
const SDK_BASE =
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6PzWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

const SDK_TIMEOUT_MS = 15000;

function waitForScript(script, src) {
  return new Promise((resolve, reject) => {
    let finished = false;

    const timer = setTimeout(() => {
      finish(
        new Error(
          `Firebase SDKの読み込みがタイムアウトしました。\n` +
          `対象: ${src}\n` +
          `インターネット接続、広告ブロック、ネットワーク制限を確認してください。`
        )
      );
    }, SDK_TIMEOUT_MS);

    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);

      if (error) reject(error);
      else resolve();
    }

    function onLoad() {
      script.dataset.firebaseSdkLoaded = "true";
      finish();
    }

    function onError() {
      finish(
        new Error(
          `Firebase SDKを読み込めませんでした。\n対象: ${src}`
        )
      );
    }

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    // すでに読み込みが完了している場合も確認する。
    if (script.dataset.firebaseSdkLoaded === "true") {
      finish();
    }
  });
}

async function loadScript(src, isAvailable) {
  if (isAvailable()) return;

  let script = [...document.scripts].find(
    item => item.src === src
  );

  if (!script) {
    script = document.createElement("script");
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  if (isAvailable()) return;

  await waitForScript(script, src);

  if (!isAvailable()) {
    throw new Error(
      `SDKの読み込み完了後も必要な機能を確認できません。\n対象: ${src}`
    );
  }
}

async function ensureCompatSDK() {
  await loadScript(
    `${SDK_BASE}/firebase-app-compat.js`,
    () => typeof window.firebase?.initializeApp === "function"
  );

  await loadScript(
    `${SDK_BASE}/firebase-auth-compat.js`,
    () => typeof window.firebase?.auth === "function"
  );

  await loadScript(
    `${SDK_BASE}/firebase-firestore-compat.js`,
    () => typeof window.firebase?.firestore === "function"
  );

  if (
    typeof window.firebase?.initializeApp !== "function" ||
    typeof window.firebase?.auth !== "function" ||
    typeof window.firebase?.firestore !== "function"
  ) {
    throw new Error(
      "Firebase App・Authentication・Firestoreの初期化に失敗しました。"
    );
  }
}

// SDKの読み込みが終わってから初期化する。
// 読み込み失敗時はこのモジュールの読み込みも失敗するため、
// login.html 側のタイムアウト表示で原因を確認できる。
await ensureCompatSDK();

const firebase = window.firebase;

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

export const app = firebase.app();
export const auth = firebase.auth();
export const db = firebase.firestore();

export const persistenceReady = (() => {
  const promise = auth.setPersistence(
    firebase.auth.Auth.Persistence.LOCAL
  );

  promise.catch(error => {
    console.error(
      "Firebase Authenticationの永続化設定に失敗しました:",
      error
    );
  });

  return promise;
})();

// 旧形式スクリプトとの互換性
window.firebaseApp = app;
window.auth = auth;
window.db = db;
window.authReadyPromise = persistenceReady;
window.firebaseInitError = null;

export const GoogleAuthProvider =
  firebase.auth.GoogleAuthProvider;

// Authentication

export function onAuthStateChanged(
  authInstance,
  callback,
  errorCallback
) {
  return authInstance.onAuthStateChanged(
    callback,
    errorCallback
  );
}

export function signInWithEmailAndPassword(
  authInstance,
  email,
  password
) {
  return authInstance.signInWithEmailAndPassword(
    email,
    password
  );
}

export function createUserWithEmailAndPassword(
  authInstance,
  email,
  password
) {
  return authInstance.createUserWithEmailAndPassword(
    email,
    password
  );
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

export function signInWithRedirect(
  authInstance,
  provider
) {
  return authInstance.signInWithRedirect(provider);
}

export function getRedirectResult(authInstance) {
  return authInstance.getRedirectResult();
}

export function signOut(authInstance) {
  return authInstance.signOut();
}

// Firestore references

export function doc(...args) {
  return db.doc(...args);
}

export function collection(...args) {
  return db.collection(...args);
}

// Firestore read/write

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

export function onSnapshot(
  reference,
  callback,
  errorCallback
) {
  return reference.onSnapshot(
    callback,
    errorCallback
  );
}

// Firestore query constraints

export function query(reference, ...constraints) {
  return constraints.reduce(
    (current, constraint) => constraint(current),
    reference
  );
}

export function where(field, operator, value) {
  return reference =>
    reference.where(field, operator, value);
}

export function orderBy(field, direction = "asc") {
  return reference =>
    reference.orderBy(field, direction);
}

export function limit(count) {
  return reference =>
    reference.limit(count);
}

// Firestore field values

export function serverTimestamp() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

export function Timestamp(...args) {
  return new firebase.firestore.Timestamp(...args);
}

export const FieldValue =
  firebase.firestore.FieldValue;
