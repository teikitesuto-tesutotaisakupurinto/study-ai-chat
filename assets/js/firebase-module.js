// assets/js/firebase-module.js
// Firebase compat SDK を ES module から利用する共通アダプター。

const FIREBASE_VERSION = "10.12.5";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6P8zWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

const SDK_BASE =
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const alreadyAvailable =
      (src.includes("firebase-app-compat") &&
        !!window.firebase?.initializeApp) ||
      (src.includes("firebase-auth-compat") &&
        !!window.firebase?.auth) ||
      (src.includes("firebase-firestore-compat") &&
        !!window.firebase?.firestore);

    if (alreadyAvailable) {
      resolve();
      return;
    }

    const existing = [...document.scripts].find(
      script => script.src === src
    );

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(
          new Error(`Firebase SDKを読み込めませんでした: ${src}`)
        ),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;

    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });

    script.addEventListener("error", () => {
      reject(
        new Error(`Firebase SDKを読み込めませんでした: ${src}`)
      );
    }, { once: true });

    document.head.appendChild(script);
  });
}

async function ensureCompatSDK() {
  if (
    window.firebase?.initializeApp &&
    window.firebase?.auth &&
    window.firebase?.firestore
  ) {
    return;
  }

  await loadScript(`${SDK_BASE}/firebase-app-compat.js`);
  await loadScript(`${SDK_BASE}/firebase-auth-compat.js`);
  await loadScript(`${SDK_BASE}/firebase-firestore-compat.js`);

  if (
    !window.firebase?.initializeApp ||
    !window.firebase?.auth ||
    !window.firebase?.firestore
  ) {
    throw new Error(
      "Firebase SDKの読み込み後もAuthまたはFirestoreが利用できません。"
    );
  }
}

// SDKを読み込んでから Firebase を初期化する。
await ensureCompatSDK();

if (!window.firebase.apps.length) {
  window.firebase.initializeApp(FIREBASE_CONFIG);
}

export const app = window.firebase.app();
export const auth = window.firebase.auth();
export const db = window.firebase.firestore();

// 認証状態の永続化設定をすべてのページで共有する。
export const persistenceReady = (() => {
  if (window.authReadyPromise) {
    return window.authReadyPromise;
  }

  const promise = auth.setPersistence(
    window.firebase.auth.Auth.Persistence.LOCAL
  );

  window.authReadyPromise = promise;

  promise.catch(error => {
    console.error(
      "Firebase Authenticationの保存設定に失敗しました:",
      error
    );
  });

  return promise;
})();

// 旧式スクリプトとの互換性を維持する。
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

export function doc(...args) {
  return db.doc(...args);
}

export function collection(...args) {
  return db.collection(...args);
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

export function serverTimestamp() {
  return window.firebase.firestore.FieldValue.serverTimestamp();
}

export function Timestamp(...args) {
  return new window.firebase.firestore.Timestamp(...args);
}

export const FieldValue =
  window.firebase.firestore.FieldValue;
