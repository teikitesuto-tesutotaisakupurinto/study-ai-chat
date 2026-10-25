import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase-module.js";

/* =========================================================
   共通
   ========================================================= */

function rootPath(file) {
  const path = location.pathname;

  const nested =
    path.includes("/student/") ||
    path.includes("/admin/");

  return nested ? `../${file}` : `./${file}`;
}

function errorDetails(error) {
  return `${error?.code || "error"}: ${
    error?.message || String(error)
  }`;
}

/* =========================================================
   エラー画面
   ========================================================= */

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
  loginLink.className = "button";
  loginLink.textContent = "ログイン画面へ";

  main.append(loginLink);

  document.body.append(main);
}

/* =========================================================
   Firebase設定
   ========================================================= */

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

/* =========================================================
   ユーザープロフィール
   ========================================================= */

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

/* =========================================================
   認証状態を待つ
   ========================================================= */

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let finished = false;

    const finish = callback => {
      if (finished) return;

      finished = true;

      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      callback();
    };

    unsubscribe = onAuthStateChanged(
      auth,
      user => {
        finish(() => resolve(user));
      },
      error => {
        finish(() => reject(error));
      }
    );
  });
}

/* =========================================================
   ログイン状態を確認
   ========================================================= */

export async function getAuthenticatedUser() {
  await persistenceReady;

  const user = await waitForAuth();

  return user;
}

/* =========================================================
   権限確認
   ========================================================= */

export async function requireRole(
  requiredRole,
  options = {}
) {
  document.documentElement.classList.add(
    "auth-pending"
  );

  if (
    !["student", "admin"].includes(requiredRole)
  ) {
    showAccessError(
      "ページ設定エラー",
      "必要な権限の設定が正しくありません。",
      `requiredRole: ${String(requiredRole)}`
    );

    return null;
  }

  try {
    /*
      Firebase Authenticationの永続化が
      完了するまで待つ。
    */
    await persistenceReady;

    /*
      ここで一度だけ認証状態を取得。
      未ログインの場合だけlogin.htmlへ戻す。
    */
    const user = await waitForAuth();

    if (!user) {
      document.documentElement.classList.remove(
        "auth-pending"
      );

      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    /*
      プロフィール取得
    */
    let profile;

    try {
      profile = await getCurrentProfile(user);
    } catch (error) {
      console.error(
        "プロフィール取得エラー:",
        error
      );

      showAccessError(
        error?.code === "permission-denied"
          ? "403 Forbidden"
          : "ユーザー情報エラー",
        "ユーザープロフィールを確認できませんでした。",
        errorDetails(error)
      );

      return null;
    }

    /*
      アカウント状態
    */
    if (profile.status !== "active") {
      await signOut(auth);

      document.documentElement.classList.remove(
        "auth-pending"
      );

      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    /*
      role確認
    */
    if (
      !["student", "admin"].includes(
        profile.role
      )
    ) {
      showAccessError(
        "403 Forbidden",
        "アカウントの権限が設定されていないか、不正です。",
        `role: ${String(profile.role)}`
      );

      return null;
    }

    /*
      必要roleとの一致
    */
    if (profile.role !== requiredRole) {
      showAccessError(
        "403 Forbidden",
        "このページを開く権限がありません。",
        `必要な権限: ${requiredRole}\n現在の権限: ${profile.role}`
      );

      return null;
    }

    /*
      システム設定
    */
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
        "システム設定を取得できません。",
        errorDetails(error)
      );

      return null;
    }

    /*
      メンテナンス
    */
    if (
      settings.maintenance === true &&
      requiredRole === "student" &&
      options.allowMaintenance !== true
    ) {
      document.documentElement.classList.remove(
        "auth-pending"
      );

      location.replace(
        rootPath("maintenance.html")
      );

      return null;
    }

    /*
      ここまで来たら認証・権限確認完了
    */
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

    document.documentElement.classList.remove(
      "auth-pending"
    );

    showAccessError(
      error?.code === "permission-denied"
        ? "403 Forbidden"
        : "認証・権限の確認に失敗しました",
      "安全にページを開けませんでした。",
      errorDetails(error)
    );

    return null;
  }
}

/* =========================================================
   ページ保護
   ========================================================= */

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
      "権限確認に失敗したため、ページの初期化を中止しました。"
    );
  }

  return result;
}

/* =========================================================
   ログイン後のプロフィール取得
   ========================================================= */

export async function getProfileForLogin(user) {
  if (!user) {
    throw new Error(
      "ログイン情報を取得できませんでした。"
    );
  }

  const profile =
    await getCurrentProfile(user);

  if (profile.status !== "active") {
    throw new Error(
      "このアカウントは現在利用できません。"
    );
  }

  if (
    !["student", "admin"].includes(
      profile.role
    )
  ) {
    throw new Error(
      "アカウントの権限が正しく設定されていません。"
    );
  }

  return profile;
}

/* =========================================================
   Study AI Chat
   ========================================================= */

const SUPABASE_FUNCTION_URL =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

export async function sendStudyQuestion(
  question,
  conversationId = null
) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  const cleanQuestion =
    String(question || "").trim();

  if (!cleanQuestion) {
    throw new Error(
      "質問を入力してください。"
    );
  }

  const token =
    await user.getIdToken();

  const response =
    await fetch(
      SUPABASE_FUNCTION_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          action:
            "sendStudyQuestion",

          question:
            cleanQuestion,

          conversationId:
            conversationId || null
        })
      }
    );

  let result = null;

  try {
    result =
      await response.json();
  } catch {
    throw new Error(
      "AIサーバーから正しい応答を受信できませんでした。"
    );
  }

  if (
    !response.ok ||
    result?.success !== true
  ) {
    throw new Error(
      result?.error ||
      `AIサーバーエラー (${response.status})`
    );
  }

  return {
    conversationId:
      result.conversationId,

    questionId:
      result.questionId,

    answerId:
      result.answerId,

    answer:
      result.answer,

    createdAt:
      result.createdAt
  };
}

/* =========================================================
   会話取得
   ========================================================= */

export async function getConversation(
  conversationId
) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  const cleanId =
    String(
      conversationId || ""
    ).trim();

  if (!cleanId) {
    throw new Error(
      "会話IDがありません。"
    );
  }

  const token =
    await user.getIdToken();

  const response =
    await fetch(
      SUPABASE_FUNCTION_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          action:
            "getConversation",

          conversationId:
            cleanId
        })
      }
    );

  const result =
    await response.json();

  if (
    !response.ok ||
    result?.success !== true
  ) {
    throw new Error(
      result?.error ||
      "会話を取得できませんでした。"
    );
  }

  return result;
}

/* =========================================================
   回答IDから会話取得
   ========================================================= */

export async function getConversationByAnswerId(
  answerId
) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  const cleanId =
    String(
      answerId || ""
    ).trim();

  if (!cleanId) {
    throw new Error(
      "回答IDがありません。"
    );
  }

  const token =
    await user.getIdToken();

  const response =
    await fetch(
      SUPABASE_FUNCTION_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          action:
            "getConversationByAnswerId",

          answerId:
            cleanId
        })
      }
    );

  const result =
    await response.json();

  if (
    !response.ok ||
    result?.success !== true
  ) {
    throw new Error(
      result?.error ||
      "回答IDから会話を取得できませんでした。"
    );
  }

  return result;
}

/* =========================================================
   エクスポート
   ========================================================= */

export {
  auth,
  db
};
