import { auth, db, persistenceReady } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const LOGIN_URL = "../login.html";
const STUDENT_HOME_URL = "../student/index.html";
const ADMIN_HOME_URL = "../admin/index.html";

let currentGuardPromise = null;

export async function getSystemSettings() {
  const snapshot = await getDoc(doc(db, "settings", "system"));

  if (!snapshot.exists()) {
    throw new Error("Firestore の settings/system がありません。");
  }

  return snapshot.data();
}

export async function getCurrentProfile(user) {
  const snapshot = await getDoc(doc(db, "users", user.uid));

  if (!snapshot.exists()) {
    throw new Error("ユーザープロフィールが見つかりません。");
  }

  return snapshot.data();
}

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};

    unsubscribe = onAuthStateChanged(
      auth,
      user => {
        unsubscribe();
        resolve(user);
      },
      error => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

export async function requireRole(requiredRole, options = {}) {
  if (currentGuardPromise) {
    return currentGuardPromise;
  }

  currentGuardPromise = (async () => {
    document.documentElement.classList.add("auth-pending");

    try {
      await persistenceReady;

      const user = await waitForAuth();

      if (!user) {
        location.replace(LOGIN_URL);
        return null;
      }

      const profile = await getCurrentProfile(user);

      if (profile.status !== "active") {
        await signOut(auth);
        location.replace(LOGIN_URL);
        return null;
      }

      if (profile.role !== requiredRole) {
        location.replace(
          profile.role === "admin"
            ? ADMIN_HOME_URL
            : profile.role === "student"
              ? STUDENT_HOME_URL
              : LOGIN_URL
        );
        return null;
      }

      // メンテナンス設定を確認する。
      // 管理者はメンテナンス画面を開けるようにする。
      const settings = await getSystemSettings();

      if (
        settings.maintenance === true &&
        requiredRole !== "admin" &&
        options.allowMaintenance !== true
      ) {
        location.replace(LOGIN_URL);
        return null;
      }

      document.documentElement.classList.remove("auth-pending");

      return { user, profile, settings };
    } catch (error) {
      console.error("認証チェックエラー:", error);

      document.documentElement.classList.remove("auth-pending");
      document.body.innerHTML = `
        <main class="auth-error">
          <h1>ページを開けません</h1>
          <p>認証状態、ユーザー情報、Firestore の設定を確認してください。</p>
          <pre></pre>
          <button onclick="location.reload()">再読み込み</button>
          <a href="${LOGIN_URL}">ログイン画面へ戻る</a>
        </main>
      `;

      document.querySelector(".auth-error pre").textContent =
        error?.message || String(error);

      return null;
    } finally {
      currentGuardPromise = null;
    }
  })();

  return currentGuardPromise;
}

export { auth, db };
