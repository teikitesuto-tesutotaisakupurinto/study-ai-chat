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

export async function getSystemSettings() {
  const snapshot = await getDoc(
    doc(db, "settings", "system")
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Firestore の settings/system が存在しません。"
    );
  }

  return snapshot.data();
}

export async function getCurrentProfile(user) {
  if (!user || !user.uid) {
    throw new Error(
      "ログイン中の利用者を確認できません。"
    );
  }

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

function showAccessError(
  title,
  message,
  detail = ""
) {
  document.documentElement.classList.remove(
    "auth-pending"
  );

  let existing =
    document.getElementById("authErrorScreen");

  if (existing) {
    existing.remove();
  }

  const screen =
    document.createElement("div");

  screen.id = "authErrorScreen";
  screen.style.position = "fixed";
  screen.style.inset = "0";
  screen.style.zIndex = "10000";
  screen.style.display = "flex";
  screen.style.alignItems = "center";
  screen.style.justifyContent = "center";
  screen.style.padding = "20px";
  screen.style.background = "#f5f7fb";

  const box =
    document.createElement("section");

  box.style.width =
    "min(620px, 100%)";
  box.style.padding = "32px";
  box.style.background = "#fff";
  box.style.border =
    "1px solid #e2e6ee";
  box.style.borderRadius = "14px";
  box.style.boxShadow =
    "0 8px 28px rgba(0,0,0,.06)";

  const heading =
    document.createElement("h1");

  heading.textContent = title;

  const text =
    document.createElement("p");

  text.textContent = message;
  text.style.lineHeight = "1.8";

  box.append(
    heading,
    text
  );

  if (detail) {
    const pre =
      document.createElement("pre");

    pre.textContent = detail;
    pre.style.whiteSpace =
      "pre-wrap";
    pre.style.overflowWrap =
      "anywhere";
    pre.style.background =
      "#f5f7fb";
    pre.style.padding =
      "12px";
    pre.style.borderRadius =
      "8px";
    pre.style.fontSize =
      "12px";

    box.append(pre);
  }

  const retry =
    document.createElement("button");

  retry.type = "button";
  retry.textContent =
    "再読み込み";

  retry.style.width =
    "100%";
  retry.style.padding =
    "12px";
  retry.style.marginTop =
    "16px";
  retry.style.border = "0";
  retry.style.borderRadius =
    "7px";
  retry.style.background =
    "#1a73e8";
  retry.style.color =
    "#fff";
  retry.style.cursor =
    "pointer";

  retry.addEventListener(
    "click",
    () => location.reload()
  );

  box.append(retry);

  const login =
    document.createElement("a");

  login.href =
    rootPath("login.html");

  login.textContent =
    "ログイン画面へ";

  login.style.display =
    "block";
  login.style.marginTop =
    "14px";
  login.style.textAlign =
    "center";
  login.style.color =
    "#1a73e8";

  box.append(login);

  screen.append(box);

  document.body.append(screen);
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
      "requiredRole が正しく設定されていません。",
      `requiredRole: ${String(requiredRole)}`
    );

    return null;
  }

  try {
    await persistenceReady;

    const user =
      await waitForAuth();

    if (!user) {
      window.location.replace(
        rootPath("login.html")
      );

      return null;
    }

    let profile;

    try {
      profile =
        await getCurrentProfile(user);
    } catch (error) {
      showAccessError(
        "ユーザー情報エラー",
        "ユーザープロフィールを取得できませんでした。",
        errorText(error)
      );

      return null;
    }

    if (
      profile.status !== "active"
    ) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error(
          "無効アカウントのサインアウトエラー:",
          error
        );
      }

      showAccessError(
        "アカウント利用不可",
        "このアカウントは現在利用できません。管理者にお問い合わせください。"
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
      showAccessError(
        "403 Forbidden",
        "このページを開く権限がありません。",
        `必要な権限: ${requiredRole}\n現在の権限: ${profile.role}`
      );

      return null;
    }

    let settings;

    try {
      settings =
        await getSystemSettings();
    } catch (error) {
      showAccessError(
        "システム設定エラー",
        "Firestore の settings/system を取得できませんでした。",
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
      "認証・権限チェックエラー:",
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
      "権限確認に失敗したため、ページの初期化を中止しました。"
    );
  }

  return result;
}

export {
  auth,
  db
};
