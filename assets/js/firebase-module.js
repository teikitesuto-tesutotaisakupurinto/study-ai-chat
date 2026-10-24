// assets/js/firebase-module.js
// Firebase compat SDK を ES module から利用する共通アダプター。

const FIREBASE_VERSION = "10.12.5";

const firebaseConfig = {
  apiKey: "AIzaSyByt8kGALyS8AU8SR6PzWFEPXfgHY5iynk",
  authDomain: "studychat-1b39d.firebaseapp.com",
  projectId: "studychat-1b39d",
  storageBucket: "studychat-1b39d.firebasestorage.app",
  messagingSenderId: "982302014286",
  appId: "1:982302014286:web:abf319aadb1ed919727c1f"
};

function sdkReady(src) {
  const fb = window.firebase;

  if (src.includes("firebase-app-compat")) {
    return !!fb && typeof fb.initializeApp === "function";
  }

  if (src.includes("firebase-auth-compat")) {
    return !!fb && typeof fb.auth === "function";
  }

  if (src.includes("firebase-firestore-compat")) {
    return !!fb && typeof fb.firestore === "function";
  }

  return false;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (sdkReady(src)) {
      resolve();
      return;
    }

    let script = [...document.scripts].find(
      item => item.src === src
    );

    let createdHere = false;

    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = false;
      createdHere = true;
    }

    let finished = false;
    let pollTimer = null;
    let timeoutTimer = null;

    const cleanup = () => {
      if (pollTimer !== null) clearInterval(pollTimer);
      if (timeoutTimer !== null) clearTimeout(timeoutTimer);

      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };

    const finish = error => {
      if (finished) return;
      if (!error && !sdkReady(src)) return;

      finished = true;
      cleanup();

      if (error) reject(error);
      else resolve();
    };

    const onLoad = () => {
      if (sdkReady(src)) {
        finish();
      } else {
        finish(
          new Error(
            `Firebase SDKは読み込まれましたが、初期化できません: ${src}`
          )
        );
      }
    };

    const onError = () => {
      finish(
        new Error(`Firebase SDKを読み込めません: ${src}`)
      );
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    pollTimer = setInterval(() => {
      if (sdkReady(src)) finish();
    }, 100);

    timeoutTimer = setTimeout(() => {
      finish(
        new Error(
          `Firebase SDKの読み込みが12秒でタイムアウトしました: ${src}`
        )
      );
    }, 12000);

    if (createdHere) document.head.append(script);
  });
}

async function ensureCompatSDK() {
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
  return authInstance.onAuthStateChanged(
    callback,
    errorCallback
  );
}

export function signOut(authInstance) {
  return authInstance.signOut();
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

export function signInWithPopup(authInstance, provider) {
  return authInstance.signInWithPopup(provider);
}

export function signInWithRedirect(authInstance, provider) {
  return authInstance.signInWithRedirect(provider);
}

export function getRedirectResult(authInstance) {
  return authInstance.getRedirectResult();
}

export function sendPasswordResetEmail(
  authInstance,
  email,
  settings
) {
  return authInstance.sendPasswordResetEmail(
    email,
    settings
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

export function doc(dbOrCollection, ...segments) {
  if (
    segments.length === 0 &&
    dbOrCollection &&
    typeof dbOrCollection.doc === "function"
  ) {
    return dbOrCollection.doc();
  }

  if (
    !dbOrCollection ||
    typeof dbOrCollection.doc !== "function"
  ) {
    throw new Error(
      "doc() にFirestoreまたはコレクション参照が渡されていません。"
    );
  }

  return dbOrCollection.doc(segments.join("/"));
}

export function collection(dbInstance, ...segments) {
  if (
    !dbInstance ||
    typeof dbInstance.collection !== "function"
  ) {
    throw new Error(
      "collection() にFirestore参照が渡されていません。"
    );
  }

  return dbInstance.collection(segments.join("/"));
}

// Compat SDKの exists は boolean プロパティ。
// アプリ側の exists() 呼び出しと互換性を持たせる。
function normalizeDocumentSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.exists !== "boolean") {
    return snapshot;
  }

  return {
    id: snapshot.id,
    ref: snapshot.ref,
    metadata: snapshot.metadata,
    exists: () => snapshot.exists,
    data: () => snapshot.data(),
    get: fieldPath => snapshot.get(fieldPath)
  };
}

export async function getDoc(reference) {
  const snapshot = await reference.get();
  return normalizeDocumentSnapshot(snapshot);
}

export function getDocs(reference) {
  return reference.get();
}

export function setDoc(reference, data, options) {
  return options
    ? reference.set(data, options)
    : reference.set(data);
}

export function updateDoc(reference, data) {
  return reference.update(data);
}

export function deleteDoc(reference) {
  return reference.delete();
}

export function addDoc(collectionReference, data) {
  return collectionReference.add(data);
}

export function serverTimestamp() {
  return window.firebase.firestore.FieldValue.serverTimestamp();
}

export function where(field, operator, value) {
  return {
    kind: "where",
    field,
    operator,
    value
  };
}

export function orderBy(field, direction = "asc") {
  return {
    kind: "orderBy",
    field,
    direction
  };
}

export function limit(count) {
  return {
    kind: "limit",
    count
  };
}

export function query(reference, ...constraints) {
  return constraints.reduce((current, constraint) => {
    if (constraint.kind === "where") {
      return current.where(
        constraint.field,
        constraint.operator,
        constraint.value
      );
    }

    if (constraint.kind === "orderBy") {
      return current.orderBy(
        constraint.field,
        constraint.direction
      );
    }

    if (constraint.kind === "limit") {
      return current.limit(constraint.count);
    }

    return current;
  }, reference);
}

export function onSnapshot(
  reference,
  callback,
  errorCallback
) {
  return reference.onSnapshot(
    snapshot => callback(
      normalizeDocumentSnapshot(snapshot)
    ),
    errorCallback
  );
}
