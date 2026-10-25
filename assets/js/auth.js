import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase.js";

/* =========================================================
   Supabase Edge Function
   ========================================================= */

const SUPABASE_FUNCTION_URL =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

/* =========================================================
   パス
   ========================================================= */

function rootPath(file) {
  const path = location.pathname;

  const nested =
    path.includes("/student/") ||
    path.includes("/admin/");

  return nested
    ? `../${file}`
    : `./${file}`;
}

/* =========================================================
   エラー画面
   ========================================================= */

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

  main.className =
    "auth-error";

  const heading =
    document.createElement("h1");

  heading.textContent =
    title;

  const description =
    document.createElement("p");

  description.textContent =
    message;

  main.append(
    heading,
    description
  );

  if (detail) {
    const pre =
      document.createElement("pre");

    pre.textContent =
      detail;

    main.append(pre);
  }

  const retry =
    document.createElement("button");

  retry.type =
    "button";

  retry.textContent =
    "再読み込み";

  retry.addEventListener(
    "click",
    () => {
      location.reload();
    }
  );

  main.append(retry);

  const loginLink =
    document.createElement("a");

  loginLink.href =
    rootPath("login.html");

  loginLink.className =
    "button";

  loginLink.textContent =
    "ログイン画面へ";

  main.append(loginLink);

  document.body.append(main);
}

/* =========================================================
   エラー詳細
   ========================================================= */

function errorDetails(error) {
  return `${
    error?.code || "error"
  }: ${
    error?.message ||
    String(error)
  }`;
}

/* =========================================================
   システム設定
   ※ ログイン後のみ呼び出す
   ========================================================= */

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
    throw new Error(
      "Firestoreに settings/system がありません。"
    );
  }

  return snapshot.data();
}

/* =========================================================
   現在のユーザープロフィール
   ========================================================= */

export async function getCurrentProfile(
  user
) {
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
      `ユーザープロフィールがありません。\nusers/${user.uid}`
    );
  }

  return snapshot.data();
}

/* =========================================================
   Firebase Auth待機
   ========================================================= */

export function waitForAuth() {
  return new Promise(
    (resolve, reject) => {
      let unsubscribe = null;
      let finished = false;

      function cleanup() {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      }

      unsubscribe =
        onAuthStateChanged(
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
    }
  );
}

/* =========================================================
   権限チェック
   ========================================================= */

export async function requireRole(
  requiredRole,
  options = {}
) {
  document.documentElement.classList.add(
    "auth-pending"
  );

  if (
    ![
      "student",
      "admin"
    ].includes(requiredRole)
  ) {
    showAccessError(
      "ページ設定エラー",
      "必要な権限の設定が正しくありません。",
      `requiredRole: ${String(
        requiredRole
      )}`
    );

    return null;
  }

  try {
    /* -----------------------------------------
       Firebase Persistence
       ----------------------------------------- */

    await persistenceReady;

    /* -----------------------------------------
       ① まずログイン状態だけ確認
       ----------------------------------------- */

    const user =
      await waitForAuth();

    /*
      未ログインなら、
      settings/systemを読む前にログインへ戻す。
    */

    if (!user) {
      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    /* -----------------------------------------
       ② ログイン後にユーザー情報取得
       ----------------------------------------- */

    let profile;

    try {
      profile =
        await getCurrentProfile(
          user
        );
    } catch (error) {
      showAccessError(
        error?.code ===
          "permission-denied"
          ? "403 Forbidden"
          : "ユーザー情報エラー",

        "ユーザープロフィールを確認できませんでした。",

        errorDetails(error)
      );

      return null;
    }

    /* -----------------------------------------
       ③ アカウント状態
       ----------------------------------------- */

    if (
      profile.status !==
      "active"
    ) {
      await signOut(auth);

      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    /* -----------------------------------------
       ④ role
       ----------------------------------------- */

    if (
      ![
        "student",
        "admin"
      ].includes(
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

    if (
      profile.role !==
      requiredRole
    ) {
      showAccessError(
        "403 Forbidden",

        "このページを開く権限がありません。",

        `必要な権限: ${requiredRole}\n現在の権限: ${profile.role}`
      );

      return null;
    }

    /* -----------------------------------------
       ⑤ ここで初めてシステム設定を取得
       ----------------------------------------- */

    let settings;

    try {
      settings =
        await getSystemSettings();

    } catch (error) {
      showAccessError(
        "システム設定エラー",

        "Firebaseからシステム設定を取得できませんでした。",

        errorDetails(error)
      );

      return null;
    }

    /* -----------------------------------------
       ⑥ メンテナンス判定
       ----------------------------------------- */

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

    /* -----------------------------------------
       認証処理完了
       ----------------------------------------- */

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
      error?.code ===
        "permission-denied"
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

/* =========================================================
   Study AI Chat
   ========================================================= */

export async function sendStudyQuestion(
  question,
  conversationId = null
) {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  const cleanQuestion =
    String(
      question || ""
    ).trim();

  if (!cleanQuestion) {
    throw new Error(
      "質問を入力してください。"
    );
  }

  const token =
    await user.getIdToken(
      true
    );

  const response =
    await fetch(
      SUPABASE_FUNCTION_URL,
      {
        method: "POST",

        headers: {
          "Authorization":
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

  let result;

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
  const user =
    auth.currentUser;

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
    await user.getIdToken(
      true
    );

  const response =
    await fetch(
      SUPABASE_FUNCTION_URL,
      {
        method: "POST",

        headers: {
          "Authorization":
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

  let result;

  try {
    result =
      await response.json();
  } catch {
    throw new Error(
      "会話取得サーバーから正しい応答を受信できませんでした。"
    );
  }

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
  const user =
    auth.currentUser;

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
    await user.getIdToken(
      true
    );

  const response =
    await fetch(
      SUPABASE_FUNCTION_URL,
      {
        method: "POST",

        headers: {
          "Authorization":
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

  let result;

  try {
    result =
      await response.json();
  } catch {
    throw new Error(
      "会話取得サーバーから正しい応答を受信できませんでした。"
    );
  }

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
   Firebase
   ========================================================= */

export {
  auth,
  db
};
