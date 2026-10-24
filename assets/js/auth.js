// assets/js/auth.js

import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase.js";

function rootPath(file) {
  const path = window.location.pathname;

  if (
    path.includes("/student/") ||
    path.includes("/admin/")
  ) {
    return `../${file}`;
  }

  return `./${file}`;
}

export async function getCurrentProfile(user) {
  if (!user || !user.uid) {
    throw new Error("ログイン中のユーザーを確認できません。");
  }

  const snapshot = await getDoc(
    doc(db, "users", user.uid)
  );

  if (!snapshot.exists()) {
    throw new Error(
      `ユーザープロフィールがありません。\nusers/${user.uid}`
    );
  }

  return snapshot.data();
}

export async function getSystemSettings() {
  const snapshot = await getDoc(
    doc(db, "settings", "system")
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Firestoreの settings/system がありません。"
    );
  }

  return snapshot.data();
}

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let finished = false;

    function finish(callback, value) {
      if (finished) return;

      finished = true;

      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      callback(value);
    }

    unsubscribe = onAuthStateChanged(
      auth,
      user => {
        finish(resolve, user);
      },
      error => {
        finish(reject, error);
      }
    );
  });
}

function errorText(error) {
  return [
    error?.code || "unknown",
    error?.message || String(error)
  ].join(": ");
}

function showAuthError(title, message, detail = "") {
  document.documentElement.classList.remove(
    "auth-pending"
  );

  document.body.replaceChildren();

  const main = document.createElement("main");
  main.className = "auth-error";

  const card = document.createElement("section");
  card.className = "auth-error-card";

  const heading = document.createElement("h1");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = message;

  card.append(
    heading,
    paragraph
  );

  if (detail) {
    const pre = document.createElement("pre");
    pre.textContent = detail;
    card.append(pre);
  }

  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "再読み込み";

  reload.addEventListener("click", () => {
    window.location.reload();
  });

  card.append(reload);

  const login = document.createElement("a");
  login.href = rootPath("login.html");
  login.textContent = "ログイン画面へ";
  login.className = "auth-login-link";

  card.append(login);

  main.append(card);
  document.body.append(main);
}

export async function requireRole(
  requiredRole,
  options = {}
) {
  document.documentElement.classList.add(
    "auth-pending"
  );

  if (
    requiredRole !== "student" &&
    requiredRole !== "admin"
  ) {
    showAuthError(
      "ページ設定エラー",
      "必要な権限が正しく設定されていません。",
      `requiredRole: ${String(requiredRole)}`
    );

    return null;
  }

  try {
    await persistenceReady;

    const user = await waitForAuth();

    if (!user) {
      window.location.replace(
        rootPath("login.html")
      );

      return null;
    }

    let profile;

    try {
      profile = await getCurrentProfile(user);
    } catch (error) {
      showAuthError(
        "ユーザー情報を取得できません",
        "ログイン情報を確認できませんでした。",
        errorText(error)
      );

      return null;
    }

    if (profile.status !== "active") {
      try {
        await signOut(auth);
      } catch (error) {
        console.error(
          "サインアウトエラー:",
          error
        );
      }

      showAuthError(
        "アカウント利用不可",
        "このアカウントは現在利用できません。"
      );

      return null;
    }

    if (
      profile.role !== "student" &&
      profile.role !== "admin"
    ) {
      showAuthError(
        "403 Forbidden",
        "アカウントの権限が設定されていません。",
        `role: ${String(profile.role)}`
      );

      return null;
    }

    if (profile.role !== requiredRole) {
      showAuthError(
        "403 Forbidden",
        "このページを開く権限がありません。",
        `必要な権限: ${requiredRole}\n現在の権限: ${profile.role}`
      );

      return null;
    }

    let settings;

    try {
      settings = await getSystemSettings();
    } catch (error) {
      showAuthError(
        "システム設定エラー",
        "システム設定を取得できませんでした。",
        errorText(error)
      );

      return null;
    }

    if (
      settings.maintenance === true &&
      requiredRole === "student" &&
      options.allowMaintenance !== true
    ) {
      window.location.replace(
        rootPath("maintenance.html")
      );

      return null;
    }

    document.documentElement.classList.remove(
      "auth-pending"
    );

    return {
      user,
      profile,
      data: profile,
      settings
    };

  } catch (error) {
    console.error(
      "認証・権限確認エラー:",
      error
    );

    showAuthError(
      "認証・権限の確認に失敗しました",
      "ページを安全に開けませんでした。",
      errorText(error)
    );

    return null;
  }
}

export async function protectPage(
  requiredRole,
  options = {}
) {
  const result = await requireRole(
    requiredRole,
    options
  );

  if (!result) {
    throw new Error(
      "権限確認に失敗しました。"
    );
  }

  return result;
}

export {
  auth,
  db
};
