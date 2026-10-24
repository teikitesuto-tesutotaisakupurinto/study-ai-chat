import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase-module.js";

function rootPath(file) {
  const path = location.pathname;

  const nested =
    path.includes("/student/") ||
    path.includes("/admin/");

  return nested ? `../${file}` : `./${file}`;
}

function withTimeout(promise, milliseconds, message) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, milliseconds);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

export async function getSystemSettings() {
  const snapshot = await getDoc(
    doc(db, "settings", "system")
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Firestore に settings/system がありません。"
    );
  }

  return snapshot.data();
}

export async function getCurrentProfile(user) {
  if (!user?.uid) {
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

    const timer = setTimeout(() => {
      finish(
        new Error(
          "ログイン状態の確認が15秒以内に完了しませんでした。"
        )
      );
    }, 15000);

    function finish(error, user) {
      if (finished) return;

      finished = true;
      clearTimeout(timer);

      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      if (error) {
        reject(error);
      } else {
        resolve(user);
      }
    }

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        user => finish(null, user),
        error => finish(error)
      );
    } catch (error) {
      finish(error);
    }
  });
}

function showAccessError(title, message, detail = "") {
  document.documentElement.classList.remove("auth-pending");

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
  document.body.replaceChildren(main);
}

function errorDetails(error) {
  return `${error?.code || "error"}: ${
    error?.message || String(error)
  }`;
}

const roleCheckPromises = new Map();

async function runRoleCheck(requiredRole, options = {}) {
  document.documentElement.classList.add("auth-pending");

  if (!["student", "admin"].includes(requiredRole)) {
    showAccessError(
      "ページ設定エラー",
      "必要な権限の設定が正しくありません。",
      `requiredRole: ${String(requiredRole)}`
    );

    return null;
  }

  try {
    await withTimeout(
      persistenceReady,
      15000,
      "Firebase Authentication の初期化が15秒以内に完了しませんでした。"
    );

    const user = await waitForAuth();

    if (!user) {
      location.replace(rootPath("login.html"));
      return null;
    }

    let profile;

    try {
      profile = await withTimeout(
        getCurrentProfile(user),
        15000,
        "ユーザープロフィールの取得がタイムアウトしました。"
      );
    } catch (error) {
      showAccessError(
        error?.code === "permission-denied"
          ? "403 Forbidden"
          : "ユーザー情報エラー",
        "ユーザープロフィールを取得できませんでした。Firestoreのユーザー情報とセキュリティルールを確認してください。",
        errorDetails(error)
      );

      return null;
    }

    if (profile.status !== "active") {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("サインアウトエラー:", error);
      }

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
      settings = await withTimeout(
        getSystemSettings(),
        15000,
        "システム設定の取得がタイムアウトしました。"
      );
    } catch (error) {
      showAccessError(
        "システム設定エラー",
        "システム設定を取得できません。Firestoreの settings/system とセキュリティルールを確認してください。",
        errorDetails(error)
      );

      return null;
    }

    const maintenanceEnabled =
      settings?.maintenance === true;

    // メンテナンス中は生徒ページをブロックする。
    // 管理者ページは引き続き利用できる。
    if (
      maintenanceEnabled &&
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
      "安全にページを開けませんでした。以下のエラー内容を確認してください。",
      errorDetails(error)
    );

    return null;
  }
}

export function requireRole(requiredRole, options = {}) {
  const allowMaintenance =
    requiredRole === "admin" ||
    options.allowMaintenance === true;

  const key = `${requiredRole}:${allowMaintenance}`;

  if (!roleCheckPromises.has(key)) {
    roleCheckPromises.set(
      key,
      runRoleCheck(requiredRole, { allowMaintenance })
    );
  }

  return roleCheckPromises.get(key);
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

export { auth, db };
