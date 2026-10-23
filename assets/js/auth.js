
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

document.documentElement.classList.add("auth-pending");

function getRootUrl(file) {
  const path = location.pathname;

  if (
    path.includes("/student/") ||
    path.includes("/admin/")
  ) {
    return `../${file}`;
  }

  return `./${file}`;
}

export async function getSystemSettings() {
  const snapshot = await getDoc(
    doc(db, "settings", "system")
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Firestore の settings/system がありません。"
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

function showErrorPage(
  title,
  message,
  detail = "",
  showLoginLink = false
) {
  document.documentElement.classList.remove(
    "auth-pending"
  );

  document.documentElement.classList.add(
    "auth-ready"
  );

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
  retry.className = "button";
  retry.textContent = "再読み込み";
  retry.addEventListener("click", () => {
    location.reload();
  });

  main.append(retry);

  if (showLoginLink) {
    const link = document.createElement("a");
    link.className = "button";
    link.href = getRootUrl("login.html");
    link.textContent = "ログイン画面へ";
    main.append(link);
  }

  document.body.append(main);
}

export async function requireRole(
  requiredRole,
  options = {}
) {
  document.documentElement.classList.add(
    "auth-pending"
  );

  try {
    await persistenceReady;

    const user = await waitForAuth();

    if (!user) {
      location.replace(getRootUrl("login.html"));
      return null;
    }

    let profile;

    try {
      profile = await getCurrentProfile(user);
    } catch (error) {
      if (error?.code === "permission-denied") {
        showErrorPage(
          "403 Forbidden",
          "ユーザー情報を読み取る権限がありません。",
          `${error.code}: ${error.message}`
        );
        return null;
      }

      throw error;
    }

    if (profile.status !== "active") {
      await signOut(auth);

      showErrorPage(
        "アカウント利用不可",
        "このアカウントは無効化されています。管理者にお問い合わせください。",
        "",
        true
      );

      return null;
    }

    if (
      profile.role !== "student" &&
      profile.role !== "admin"
    ) {
      showErrorPage(
        "403 Forbidden",
        "アカウントの権限が設定されていません。",
        `現在の role: ${profile.role || "未設定"}`
      );

      return null;
    }

    if (profile.role !== requiredRole) {
      showErrorPage(
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
      showErrorPage(
        "システム設定エラー",
        "システム設定を読み取れませんでした。Firestore の設定とルールを確認してください。",
        `${error?.code || "error"}: ${error?.message || String(error)}`
      );

      return null;
    }

    if (
      settings.maintenance === true &&
      requiredRole !== "admin" &&
      options.allowMaintenance !== true
    ) {
      location.replace(
        getRootUrl("maintenance.html")
      );

      return null;
    }

    document.documentElement.classList.remove(
      "auth-pending"
    );

    document.documentElement.classList.add(
      "auth-ready"
    );

    return {
      user,
      profile,
      data: profile,
      settings
    };
  } catch (error) {
    console.error(
      "認証・権限チェックエラー:",
      error
    );

    showErrorPage(
      "認証・権限の確認に失敗しました",
      "ページを安全に開けませんでした。表示されたエラーの内容を確認してください。",
      `${error?.code || "error"}: ${error?.message || String(error)}`,
      true
    );

    return null;
  }
}

// 既存 HTML の protectPage() 呼び出しとの互換性を維持する。
// 権限確認に失敗した場合は呼び出し元の初期化も中断する。
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
      "アクセス権限を確認できないため、ページの初期化を中止しました。"
    );
  }

  return result;
}

export {
  auth,
  db
};
