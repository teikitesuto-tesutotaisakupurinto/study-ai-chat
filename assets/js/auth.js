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

  const nested =
    path.includes("/student/") ||
    path.includes("/admin/");

  return nested ? `../${file}` : `./${file}`;
}

function redirectLogin() {
  window.location.replace(rootPath("login.html"));
}

function redirectForbidden() {
  window.location.replace(rootPath("403.html"));
}

export async function getSystemSettings() {
  const snapshot = await getDoc(
    doc(db, "settings", "system")
  );

  if (!snapshot.exists()) {
    return {
      maintenance: false,
      maintenanceTitle: "システムメンテナンス中",
      maintenanceMessage:
        "現在、メンテナンスを実施しています。"
    };
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
        if (finished) return;

        finished = true;
        cleanup();

        resolve(user);
      },
      error => {
        if (finished) return;

        finished = true;
        cleanup();

        reject(error);
      }
    );
  });
}

function clearAuthPending() {
  document.documentElement.classList.remove(
    "auth-pending"
  );

  document.body.classList.remove(
    "auth-pending"
  );
}

function showAccessError(
  title,
  message,
  detail = ""
) {
  clearAuthPending();

  let container =
    document.getElementById("authErrorContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "authErrorContainer";

    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.zIndex = "99999";
    container.style.background = "#f5f7fb";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.padding = "24px";

    document.body.appendChild(container);
  }

  container.replaceChildren();

  const card = document.createElement("section");

  card.style.width = "100%";
  card.style.maxWidth = "620px";
  card.style.padding = "32px";
  card.style.background = "#fff";
  card.style.border =
    "1px solid #dfe3eb";
  card.style.borderRadius = "14px";
  card.style.boxShadow =
    "0 8px 30px rgba(0,0,0,.08)";

  const heading =
    document.createElement("h1");

  heading.textContent = title;

  heading.style.marginTop = "0";

  const text =
    document.createElement("p");

  text.textContent = message;

  text.style.lineHeight = "1.8";

  card.append(
    heading,
    text
  );

  if (detail) {
    const pre =
      document.createElement("pre");

    pre.textContent = detail;

    pre.style.whiteSpace = "pre-wrap";
    pre.style.overflowWrap = "anywhere";
    pre.style.background = "#f5f7fb";
    pre.style.padding = "14px";
    pre.style.borderRadius = "8px";

    card.append(pre);
  }

  const reload =
    document.createElement("button");

  reload.type = "button";
  reload.textContent = "再読み込み";

  reload.style.width = "100%";
  reload.style.padding = "12px";
  reload.style.marginTop = "18px";
  reload.style.border = "0";
  reload.style.borderRadius = "7px";
  reload.style.background = "#1a73e8";
  reload.style.color = "#fff";
  reload.style.cursor = "pointer";

  reload.addEventListener(
    "click",
    () => window.location.reload()
  );

  card.append(reload);

  const login =
    document.createElement("a");

  login.href = rootPath("login.html");
  login.textContent = "ログイン画面へ";

  login.style.display = "block";
  login.style.textAlign = "center";
  login.style.marginTop = "16px";
  login.style.color = "#1a73e8";

  card.append(login);

  container.append(card);
}

function errorDetails(error) {
  return [
    error?.code || "unknown",
    error?.message || String(error)
  ].join(": ");
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
      "必要な権限が正しく設定されていません。",
      `requiredRole: ${String(requiredRole)}`
    );

    return null;
  }

  try {
    await persistenceReady;

    const user = await waitForAuth();

    if (!user) {
      redirectLogin();
      return null;
    }

    let profile;

    try {
      profile =
        await getCurrentProfile(user);
    } catch (error) {
      showAccessError(
        "ユーザー情報エラー",
        "ユーザープロフィールを確認できませんでした。",
        errorDetails(error)
      );

      return null;
    }

    if (
      profile.status &&
      profile.status !== "active"
    ) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error(
          "サインアウトエラー:",
          signOutError
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
        "アカウントの権限が設定されていません。",
        `role: ${String(profile.role)}`
      );

      return null;
    }

    if (
      profile.role !== requiredRole
    ) {
      redirectForbidden();
      return null;
    }

    let settings;

    try {
      settings =
        await getSystemSettings();
    } catch (error) {
      showAccessError(
        "システム設定エラー",
        "システム設定を確認できませんでした。",
        errorDetails(error)
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

    clearAuthPending();

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
      "ページを安全に開けませんでした。",
      errorDetails(error)
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
