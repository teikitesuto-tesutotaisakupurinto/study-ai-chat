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

/*
 * 現在のページからlogin.htmlへの相対パスを作る。
 */
function rootPath(file) {
  const path = location.pathname;

  const nested =
    path.includes("/student/") ||
    path.includes("/admin/");

  return nested
    ? `../${file}`
    : `./${file}`;
}

/*
 * システム設定取得
 */
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

/*
 * 現在のユーザープロフィール取得
 */
export async function getCurrentProfile(user) {
  if (!user) {
    throw new Error(
      "Firebase Authentication のユーザーがありません。"
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

/*
 * Firebase Auth状態を1回だけ取得する。
 *
 * ここでは認証後のリダイレクトは行わない。
 * リダイレクト処理はlogin.htmlだけが担当する。
 */
export function waitForAuth() {
  return new Promise((resolve, reject) => {
    let finished = false;

    const unsubscribe =
      onAuthStateChanged(
        auth,

        user => {
          if (finished) return;

          finished = true;
          unsubscribe();

          resolve(user);
        },

        error => {
          if (finished) return;

          finished = true;
          unsubscribe();

          reject(error);
        }
      );
  });
}

/*
 * 権限エラー表示
 */
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

  main.className = "auth-error";

  const heading =
    document.createElement("h1");

  heading.textContent = title;

  const description =
    document.createElement("p");

  description.textContent = message;

  main.append(
    heading,
    description
  );

  if (detail) {
    const pre =
      document.createElement("pre");

    pre.textContent = detail;

    main.append(pre);
  }

  const retry =
    document.createElement("button");

  retry.type = "button";
  retry.textContent = "再読み込み";

  retry.addEventListener(
    "click",
    () => location.reload()
  );

  main.append(retry);

  const loginLink =
    document.createElement("a");

  loginLink.href =
    rootPath("login.html");

  loginLink.textContent =
    "ログイン画面へ";

  loginLink.className = "button";

  main.append(loginLink);

  document.body.append(main);
}

/*
 * 権限チェック
 */
export async function requireRole(
  requiredRole,
  options = {}
) {
  document.documentElement.classList.add(
    "auth-pending"
  );

  try {
    /*
     * Firebaseの永続化設定が完了するまで待つ。
     */
    await persistenceReady;

    /*
     * Auth状態を1回取得。
     */
    const user =
      await waitForAuth();

    /*
     * 未ログインならログイン画面へ。
     */
    if (!user) {
      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    /*
     * プロフィール取得
     */
    let profile;

    try {
      profile =
        await getCurrentProfile(user);

    } catch (error) {

      showAccessError(
        error?.code === "permission-denied"
          ? "403 Forbidden"
          : "ユーザー情報エラー",

        "ユーザープロフィールを確認できませんでした。",

        `${error?.code || "error"}: ${
          error?.message ||
          String(error)
        }`
      );

      return null;
    }

    /*
     * アカウント停止確認
     */
    if (
      profile.status !== "active"
    ) {

      await signOut(auth);

      showAccessError(
        "アカウント利用不可",

        "このアカウントは無効化されています。管理者にお問い合わせください。"
      );

      return null;
    }

    /*
     * role確認
     */
    if (
      !["student", "admin"].includes(
        profile.role
      )
    ) {

      showAccessError(
        "403 Forbidden",

        "アカウントの権限が設定されていないか、不正です。",

        `role: ${String(
          profile.role
        )}`
      );

      return null;
    }

    /*
     * 必要権限との比較
     */
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

    /*
     * システム設定
     */
    let settings;

    try {

      settings =
        await getSystemSettings();

    } catch (error) {

      showAccessError(
        "システム設定エラー",

        "システム設定を取得できません。Firestore の設定とセキュリティルールを確認してください。",

        `${error?.code || "error"}: ${
          error?.message ||
          String(error)
        }`
      );

      return null;
    }

    /*
     * 生徒だけメンテナンスを確認。
     */
    if (
      settings.maintenance === true &&
      requiredRole === "student" &&
      options.allowMaintenance !== true
    ) {

      location.replace(
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
      error?.code === "permission-denied"
        ? "403 Forbidden"
        : "認証・権限の確認に失敗しました",

      "安全にページを開けませんでした。",

      `${error?.code || "error"}: ${
        error?.message ||
        String(error)
      }`
    );

    return null;
  }
}

/*
 * ページ保護
 */
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
