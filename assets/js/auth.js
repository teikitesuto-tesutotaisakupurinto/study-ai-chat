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
  const pathname = window.location.pathname;

  if (
    pathname.includes("/student/") ||
    pathname.includes("/admin/")
  ) {
    return `../${file}`;
  }

  return `./${file}`;
}

function redirectToLogin() {
  window.location.replace(rootPath("login.html"));
}

function redirectToForbidden() {
  window.location.replace(rootPath("403.html"));
}

function redirectToMaintenance() {
  window.location.replace(rootPath("maintenance.html"));
}

export async function getSystemSettings() {
  const snapshot = await getDoc(
    doc(db, "settings", "system")
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Firestoreに settings/system がありません。"
    );
  }

  return snapshot.data();
}

export async function getCurrentProfile(user) {
  if (!user || !user.uid) {
    throw new Error(
      "ログイン中のユーザーを確認できません。"
    );
  }

  const snapshot = await getDoc(
    doc(db, "users", user.uid)
  );

  if (!snapshot.exists()) {
    throw new Error(
      `ユーザープロフィールがありません。users/${user.uid}`
    );
  }

  return snapshot.data();
}

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let finished = false;

    const cleanup = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    unsubscribe = onAuthStateChanged(
      auth,
      user => {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();
        resolve(user);
      },
      error => {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();
        reject(error);
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

function showAccessError(
  title,
  message,
  detail = ""
) {
  document.documentElement.classList.remove(
    "auth-pending"
  );

  const existing =
    document.getElementById("authErrorScreen");

  if (existing) {
    existing.remove();
  }

  const main =
    document.createElement("main");

  main.id = "authErrorScreen";
  main.className = "auth-error-screen";

  const card =
    document.createElement("section");

  card.className = "auth-error-card";

  const heading =
    document.createElement("h1");

  heading.textContent = title;

  const description =
    document.createElement("p");

  description.textContent = message;

  card.append(
    heading,
    description
  );

  if (detail) {
    const pre =
      document.createElement("pre");

    pre.textContent = detail;
    card.append(pre);
  }

  const retry =
    document.createElement("button");

  retry.type = "button";
  retry.textContent = "再読み込み";

  retry.addEventListener(
    "click",
    () => window.location.reload()
  );

  card.append(retry);

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
    showAccessError(
      "ページ設定エラー",
      "ページの権限設定が正しくありません。",
      `requiredRole: ${String(requiredRole)}`
    );

    return null;
  }

  try {
    await persistenceReady;

    const user =
      await waitForAuth();

    if (!user) {
      redirectToLogin();
      return null;
    }

    let profile;

    try {
      profile =
        await getCurrentProfile(user);
    } catch (error) {
      console.error(
        "プロフィール取得エラー:",
        error
      );

      showAccessError(
        "ユーザー情報エラー",
        "ユーザープロフィールを確認できませんでした。",
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

      showAccessError(
        "アカウント利用不可",
        "このアカウントは現在利用できません。"
      );

      return null;
    }

    if (
      profile.role !== "student" &&
      profile.role !== "admin"
    ) {
      showAccessError(
        "403 Forbidden",
        "アカウントの権限が正しく設定されていません。",
        `role: ${String(profile.role)}`
      );

      return null;
    }

    if (
      profile.role !== requiredRole
    ) {
      if (profile.role === "student") {
        window.location.replace(
          rootPath("student/index.html")
        );
      } else if (
        profile.role === "admin"
      ) {
        window.location.replace(
          rootPath("admin/index.html")
        );
      } else {
        redirectToForbidden();
      }

      return null;
    }

    let settings;

    try {
      settings =
        await getSystemSettings();
    } catch (error) {
      console.error(
        "システム設定取得エラー:",
        error
      );

      showAccessError(
        "システム設定エラー",
        "システム設定を取得できませんでした。",
        errorText(error)
      );

      return null;
    }

    /*
     * maintenance === true
     *
     * studentページではメンテナンス画面へ。
     * adminは管理作業のため通常利用可能。
     */
    if (
      settings.maintenance === true &&
      requiredRole === "student" &&
      options.allowMaintenance !== true
    ) {
      redirectToMaintenance();
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

    showAccessError(
      "認証・権限の確認に失敗しました",
      "安全にページを開けませんでした。",
      errorText(error)
    );

    return null;
  }
}

export async function protectPage(
  requiredRole,
  options = {}
) {
  const result =
    await requireRole(
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
