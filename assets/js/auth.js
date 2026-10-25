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
   Supabase Edge Function
   ========================================================= */

export const SUPABASE_FUNCTION_URL =
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
   共通エラー画面
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

  loginLink.className = "button";
  loginLink.textContent =
    "ログイン画面へ";

  main.append(loginLink);

  document.body.append(main);
}

/* =========================================================
   エラー詳細
   ========================================================= */

function errorDetails(error) {
  return (
    `${error?.code || "error"}: ` +
    `${error?.message || String(error)}`
  );
}

/* =========================================================
   システム設定
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
      "Firestore に settings/system がありません。"
    );
  }

  return snapshot.data();
}

/* =========================================================
   現在のユーザープロフィール
   ========================================================= */

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
      `ユーザープロフィールがありません。users/${user.uid} を確認してください。`
    );
  }

  return snapshot.data();
}

/* =========================================================
   Firebase認証状態を1回だけ待つ
   ========================================================= */

export function waitForAuth() {
  return new Promise(
    (resolve, reject) => {
      let unsubscribe = null;
      let finished = false;

      const finish = (
        callback,
        value
      ) => {
        if (finished) {
          return;
        }

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
          user => {
            finish(resolve, user);
          },
          error => {
            finish(reject, error);
          }
        );
    }
  );
}

/* =========================================================
   ログイン済みユーザーを取得
   ========================================================= */

export async function getAuthenticatedUser() {
  await persistenceReady;

  const user =
    await waitForAuth();

  if (!user) {
    location.replace(
      rootPath("login.html")
    );

    return null;
  }

  return user;
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

  /* -----------------------------------------
     権限名チェック
     ----------------------------------------- */

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
    /* ---------------------------------------
       Firebase Persistence待機
       --------------------------------------- */

    await persistenceReady;

    /* ---------------------------------------
       ログイン状態待機
       --------------------------------------- */

    const user =
      await waitForAuth();

    /* ---------------------------------------
       未ログイン
       --------------------------------------- */

    if (!user) {
      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    /* ---------------------------------------
       プロフィール取得
       --------------------------------------- */

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

    /* ---------------------------------------
       アカウント状態
       --------------------------------------- */

    if (
      profile.status !==
      "active"
    ) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error(
          "ログアウト処理エラー:",
          signOutError
        );
      }

      showAccessError(
        "アカウント利用不可",
        "このアカウントは無効化されています。管理者にお問い合わせください。"
      );

      return null;
    }

    /* ---------------------------------------
       ロール確認
       --------------------------------------- */

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

    /* ---------------------------------------
       必要ロール確認
       --------------------------------------- */

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

    /* ---------------------------------------
       システム設定取得
       
       重要：
       メンテナンス判定は「ログイン確認後」に
       行う。
       --------------------------------------- */

    let settings;

    try {
      settings =
        await getSystemSettings();
    } catch (error) {
      showAccessError(
        "システム設定エラー",
        "システム設定を取得できません。",
        errorDetails(error)
      );

      return null;
    }

    /* ---------------------------------------
       学生のみメンテナンス判定
       --------------------------------------- */

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

    /* ---------------------------------------
       認証完了
       --------------------------------------- */

    document.documentElement.classList.remove(
      "auth-pending"
    );

    /*
      ここでページ側に返す。

      user    = Firebaseユーザー
      profile = Firestore users/{uid}
      data    = profile互換
      settings = settings/system
    */

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
   現在のログインユーザー
   ========================================================= */

export function getCurrentUser() {
  return auth.currentUser;
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

  if (
    cleanQuestion.length > 4000
  ) {
    throw new Error(
      "質問が長すぎます。"
    );
  }

  /* -----------------------------------------
     Firebase ID Token
     ----------------------------------------- */

  const token =
    await user.getIdToken(
      true
    );

  /* -----------------------------------------
     Supabase Edge Function
     ----------------------------------------- */

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
            conversationId
              ? String(
                  conversationId
                ).trim()
              : null
        })
      }
    );

  /* -----------------------------------------
     レスポンス取得
     ----------------------------------------- */

  const text =
    await response.text();

  let result = null;

  try {
    result =
      JSON.parse(text);
  } catch {
    throw new Error(
      `AIサーバーから正しいJSONを受信できませんでした。\nHTTP ${response.status}\n${text.slice(0, 500)}`
    );
  }

  /* -----------------------------------------
     HTTPエラー
     ----------------------------------------- */

  if (!response.ok) {
    throw new Error(
      result?.error ||
      `AIサーバーエラー (${response.status})`
    );
  }

  /* -----------------------------------------
     API成功判定
     ----------------------------------------- */

  if (
    result?.success !== true
  ) {
    throw new Error(
      result?.error ||
      "AIサーバーから回答を取得できませんでした。"
    );
  }

  /* -----------------------------------------
     回答確認
     ----------------------------------------- */

  if (
    typeof result.answer !==
      "string" ||
    !result.answer.trim()
  ) {
    throw new Error(
      "AIサーバーから回答本文が返されませんでした。"
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

  const text =
    await response.text();

  let result;

  try {
    result =
      JSON.parse(text);
  } catch {
    throw new Error(
      `会話取得APIの応答を解析できませんでした。\nHTTP ${response.status}`
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

  const text =
    await response.text();

  let result;

  try {
    result =
      JSON.parse(text);
  } catch {
    throw new Error(
      `回答取得APIの応答を解析できませんでした。\nHTTP ${response.status}`
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
   Firebaseを外部から使用する場合
   ========================================================= */

export {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
};
