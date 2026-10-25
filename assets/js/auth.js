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
  return location.pathname.includes("/student/") ||
         location.pathname.includes("/admin/")
    ? `../${file}`
    : `./${file}`;
}

function errorDetails(error) {
  return `${error?.code || "error"}: ${
    error?.message || String(error)
  }`;
}

function showAccessError(
  title,
  message,
  detail = ""
) {
  document.documentElement.classList.remove(
    "auth-pending"
  );

  document.body.replaceChildren();

  const main =
    document.createElement("main");

  main.style.cssText = `
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:24px;
    background:#f4f7fb;
  `;

  const card =
    document.createElement("section");

  card.style.cssText = `
    width:100%;
    max-width:520px;
    padding:30px;
    background:#fff;
    border:1px solid #e3e8f0;
    border-radius:14px;
    box-shadow:0 8px 30px rgba(15,23,42,.06);
  `;

  const heading =
    document.createElement("h1");

  heading.textContent = title;
  heading.style.marginTop = "0";

  const description =
    document.createElement("p");

  description.textContent = message;
  description.style.lineHeight = "1.8";

  card.append(
    heading,
    description
  );

  if (detail) {
    const pre =
      document.createElement("pre");

    pre.textContent = detail;

    pre.style.cssText = `
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      padding:14px;
      border-radius:8px;
      background:#f6f8fb;
      font-size:12px;
      line-height:1.6;
    `;

    card.append(pre);
  }

  const retry =
    document.createElement("button");

  retry.type = "button";
  retry.textContent = "再読み込み";

  retry.style.cssText = `
    width:100%;
    min-height:44px;
    border:0;
    border-radius:8px;
    background:#2563eb;
    color:#fff;
    cursor:pointer;
    font-weight:600;
  `;

  retry.addEventListener(
    "click",
    () => location.reload()
  );

  card.append(retry);

  const login =
    document.createElement("a");

  login.href =
    rootPath("login.html");

  login.textContent =
    "ログイン画面へ";

  login.style.cssText = `
    display:block;
    margin-top:14px;
    text-align:center;
    color:#2563eb;
    text-decoration:none;
    font-size:14px;
  `;

  card.append(login);

  main.append(card);
  document.body.append(main);
}

export function waitForAuth() {
  return new Promise(
    (resolve, reject) => {
      let unsubscribe = null;
      let finished = false;

      const finish = callback => value => {
        if (finished) return;

        finished = true;

        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }

        callback(value);
      };

      unsubscribe =
        onAuthStateChanged(
          auth,
          finish(resolve),
          finish(reject)
        );
    }
  );
}

export async function getCurrentProfile(user) {
  if (!user?.uid) {
    throw new Error(
      "ログイン中の利用者を確認できません。"
    );
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "users",
        user.uid
      )
    );

  if (!snapshot.exists()) {
    throw new Error(
      `ユーザープロフィールがありません。users/${user.uid}`
    );
  }

  return snapshot.data();
}

export async function getSystemSettings() {
  const snapshot =
    await getDoc(
      doc(
        db,
        "settings",
        "system"
      )
    );

  if (!snapshot.exists()) {
    return {
      maintenance: false
    };
  }

  return snapshot.data();
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

    const user =
      await waitForAuth();

    if (!user) {
      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    const profile =
      await getCurrentProfile(
        user
      );

    if (
      profile.status !== "active"
    ) {
      await signOut(auth);

      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    if (
      profile.role !== requiredRole
    ) {
      showAccessError(
        "アクセスできません",
        "このページを開く権限がありません。",
        `必要な権限: ${requiredRole}\n現在の権限: ${profile.role || "未設定"}`
      );

      return null;
    }

    const settings =
      await getSystemSettings();

    if (
      settings.maintenance === true &&
      requiredRole === "student" &&
      options.allowMaintenance !== true
    ) {
      location.replace(
        rootPath(
          "maintenance.html"
        )
      );

      return null;
    }

    document.documentElement.classList.remove(
      "auth-pending"
    );

    return {
      user,
      profile,
      settings
    };

  } catch (error) {
    console.error(
      "認証エラー:",
      error
    );

    showAccessError(
      error?.code === "permission-denied"
        ? "アクセス権限を確認できません"
        : "ページを開けません",
      "認証情報または利用者情報を確認できませんでした。",
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
