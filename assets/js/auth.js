
import {
  auth,
  db,
  persistenceReady
} from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

function rootPath(file) {
  const path = location.pathname;

  return path.includes("/student/") ||
    path.includes("/admin/")
    ? `../${file}`
    : `./${file}`;
}

export async function getSystemSettings() {
  const snapshot = await getDoc(
    doc(db, "settings", "system")
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Firestore に settings/system がありません。必要なデータを作成してください。"
    );
  }

  return snapshot.data();
}

export async function getCurrentProfile(user) {
  const snapshot = await getDoc(
    doc(db, "users", user.uid)
  );

  if (!snapshot.exists()) {
    throw new Error(
      `ユーザープロフィールがありません。users/${user.uid} を確認してください。`
    );
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

function showAccessError(title, message, detail = "") {
  document.documentElement.classList.remove("auth-pending");

  document.body.replaceChildren();

  const main = document.createElement("main");
  main.className = "auth-error";

  const heading = document.createElement("h1");
  heading.textContent = title;

  const description = document.createElement("p");
  description.textContent = message;

  main.append(heading, description);

  if (detail) {
    const pre = document.createElement("pre");
    pre.textContent = detail;
    main.append(pre);
  }

  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "再読み込み";
  retry.addEventListener("click", () => location.reload());
  main.append(retry);

  const loginLink = document.createElement("a");
  loginLink.href = rootPath("login.html");
  loginLink.textContent = "ログイン画面へ";
  loginLink.className = "button";
  main.append(loginLink);

  document.body.append(main);
}

export async function requireRole(requiredRole, options = {}) {
  document.documentElement.classList.add("auth-pending");

  try {
    await persistenceReady;

    const user = await waitForAuth();

    if (!user) {
      location.replace(rootPath("login.html"));
      return null;
    }

    let profile;

    try {
      profile = await getCurrentProfile(user);
    } catch (error) {
      showAccessError(
        error?.code === "permission-denied"
          ? "403 Forbidden"
          : "ユーザー情報エラー",
        "ユーザープロフィールを確認できませんでした。",
        `${error?.code || "error"}: ${error?.message || String(error)}`
      );
      return null;
    }

    if (profile.status !== "active") {
      await signOut(auth);

      showAccessError(
        "アカウント利用不可",
        "このアカウントは無効化されています。管理者にお問い合わせください。"
      );

      return null;
    }

    if (!["student", "admin"].includes(profile.role)) {
      showAccessError(
        "403 Forbidden",
        "アカウントの権限が設定されていないか、不正です。",
        `role: ${String(profile.role)}`
      );
      return null;
    }

    if (profile.role !== requiredRole) {
      showAccessError(
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
      showAccessError(
        "システム設定エラー",
        "システム設定を取得できません。Firestore の設定とセキュリティルールを確認してください。",
        `${error?.code || "error"}: ${error?.message || String(error)}`
      );
      return null;
    }

    if (
      settings.maintenance === true &&
      requiredRole === "student" &&
      options.allowMaintenance !== true
    ) {
      location.replace(rootPath("maintenance.html"));
      return null;
    }

    document.documentElement.classList.remove("auth-pending");

    return {
      user,
      profile,
      data: profile,
      settings
    };
  } catch (error) {
    console.error("認証・権限チェックエラー:", error);

    showAccessError(
      error?.code === "permission-denied"
        ? "403 Forbidden"
        : "認証・権限の確認に失敗しました",
      "安全にページを開けませんでした。次のエラー内容を確認してください。",
      `${error?.code || "error"}: ${error?.message || String(error)}`
    );

    return null;
  }
}

export async function protectPage(requiredRole, options = {}) {
  const result = await requireRole(requiredRole, options);

  if (!result) {
    throw new Error(
      "権限確認に失敗したため、ページの初期化を中止しました。"
    );
  }

  return result;
}

export {
  auth,
  db
};
