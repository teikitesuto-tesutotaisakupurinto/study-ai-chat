import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase.js";

const SUPABASE_FUNCTION_URL =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

/* =========================================================
   共通
   ========================================================= */

function rootPath(file) {
  const path = location.pathname;

  if (
    path.includes("/student/") ||
    path.includes("/admin/")
  ) {
    return `../${file}`;
  }

  return `./${file}`;
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

  const main = document.createElement("main");
  main.className = "auth-error";

  const heading = document.createElement("h1");
  heading.textContent = title;

  const description = document.createElement("p");
  description.textContent = message;

  main.append(
    heading,
    description
  );

  if (detail) {
    const pre = document.createElement("pre");
    pre.textContent = detail;
    main.append(pre);
  }

  const retry = document.createElement("button");

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
   Firebase設定
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
   ユーザープロフィール
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
      `ユーザープロフィールがありません。\nusers/${user.uid}`
    );
  }

  return snapshot.data();
}

/* =========================================================
   Auth待機
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
    !["student", "admin"].includes(
      requiredRole
    )
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
      Firebase Authの永続化完了を待つ
    */
    await persistenceReady;

    /*
      Firebaseログイン状態を取得
    */
    const user =
      await waitForAuth();

    /*
      未ログイン
    */
    if (!user) {
      location.replace(
        rootPath("login.html")
      );

      return null;
    }

    /*
      Firestore users/{uid}
    */
    let profile;

    try {
      profile =
        await getCurrentProfile(
          user
        );
    } catch (error) {
      console.error(
        "ユーザープロフィール取得エラー:",
        error
      );

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

    /*
      アカウント状態
    */
    if (
      profile.status !==
      "active"
    ) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error(
          "ログアウトエラー:",
          error
        );
      }

      showAccessError(
        "アカウント利用不可",
        "このアカウントは現在利用できません。管理者にお問い合わせください。"
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
      必要roleと一致するか
    */
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

    /*
      メンテナンス設定

      重要:
      ログイン後にのみ確認する。
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
      学生だけメンテナンス画面へ
    */
    if (
      requiredRole === "student" &&
      settings.maintenance === true &&
      options.allowMaintenance !== true
    ) {
      location.replace(
        rootPath(
          "maintenance.html"
        )
      );

      return null;
    }

    /*
      認証完了
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
      question ?? ""
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

  /*
    Firebase ID Token
  */
  const token =
    await user.getIdToken(
      true
    );

  if (!token) {
    throw new Error(
      "Firebase認証トークンを取得できませんでした。"
    );
  }

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

  const rawText =
    await response.text();

  let result;

  try {
    result =
      JSON.parse(rawText);
  } catch {
    throw new Error(
      `AIサーバーから正しいJSONを受信できませんでした。\nHTTP ${response.status}\n${rawText.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.error ||
      `AIサーバーエラー (${response.status})`
    );
  }

  if (
    result?.success !== true
  ) {
    throw new Error(
      result?.error ||
      "AIサーバーが回答を返しませんでした。"
    );
  }

  if (
    typeof result.answer !==
      "string" ||
    !result.answer.trim()
  ) {
    throw new Error(
      "AIサーバーから回答本文が返ってきませんでした。"
    );
  }

  return {
    conversationId:
      result.conversationId ??
      null,

    questionId:
      result.questionId ??
      null,

    answerId:
      result.answerId ??
      null,

    answer:
      result.answer,

    createdAt:
      result.createdAt ??
      null
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
      conversationId ?? ""
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

  const rawText =
    await response.text();

  let result;

  try {
    result =
      JSON.parse(rawText);
  } catch {
    throw new Error(
      `会話取得サーバーの応答を解析できませんでした。\nHTTP ${response.status}`
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
      answerId ?? ""
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

  const rawText =
    await response.text();

  let result;

  try {
    result =
      JSON.parse(rawText);
  } catch {
    throw new Error(
      `回答取得サーバーの応答を解析できませんでした。\nHTTP ${response.status}`
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

export {
  auth,
  db
};
