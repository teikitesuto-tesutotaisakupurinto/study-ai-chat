/* =========================================================
   学習AIチャット 認証・権限管理
   ========================================================= */

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
   Supabase AI
   ========================================================= */

const SUPABASE_FUNCTION_URL =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

/* =========================================================
   パス
   ========================================================= */

function rootPath(file) {
  const path =
    location.pathname;

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

  /*
    既存ページを完全に破壊しない。
    特にサイドバーが既に存在する場合は残す。
  */

  const existingMain =
    document.getElementById(
      "appMain"
    );

  if (existingMain) {
    let box =
      document.getElementById(
        "authAccessError"
      );

    if (!box) {
      box =
        document.createElement(
          "section"
        );

      box.id =
        "authAccessError";

      box.style.cssText = `
        margin: 24px;
        padding: 24px;
        background: #fff;
        border: 1px solid #fecaca;
        border-radius: 14px;
        color: #172033;
      `;

      existingMain.prepend(
        box
      );
    }

    box.innerHTML = "";

    const heading =
      document.createElement(
        "h1"
      );

    heading.textContent =
      title;

    heading.style.cssText = `
      margin: 0 0 10px;
      font-size: 22px;
      color: #991b1b;
    `;

    const description =
      document.createElement(
        "p"
      );

    description.textContent =
      message;

    description.style.lineHeight =
      "1.8";

    box.append(
      heading,
      description
    );

    if (detail) {
      const pre =
        document.createElement(
          "pre"
        );

      pre.textContent =
        detail;

      pre.style.cssText = `
        margin-top: 14px;
        padding: 12px;
        overflow: auto;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: #f8fafc;
        border-radius: 8px;
        font-size: 12px;
      `;

      box.append(pre);
    }

    return;
  }

  /*
    ログイン画面など appMain がない場合のみ
    専用エラー表示を作る。
  */

  document.body.replaceChildren();

  const main =
    document.createElement(
      "main"
    );

  main.className =
    "auth-error";

  main.style.cssText = `
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #f4f7fb;
  `;

  const card =
    document.createElement(
      "section"
    );

  card.style.cssText = `
    width: min(100%, 520px);
    padding: 28px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 12px 30px rgb(15 23 42 / 8%);
  `;

  const heading =
    document.createElement(
      "h1"
    );

  heading.textContent =
    title;

  const description =
    document.createElement(
      "p"
    );

  description.textContent =
    message;

  description.style.lineHeight =
    "1.8";

  card.append(
    heading,
    description
  );

  if (detail) {
    const pre =
      document.createElement(
        "pre"
      );

    pre.textContent =
      detail;

    pre.style.cssText = `
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
    `;

    card.append(pre);
  }

  const retry =
    document.createElement(
      "button"
    );

  retry.type =
    "button";

  retry.textContent =
    "再読み込み";

  retry.style.cssText = `
    width: 100%;
    min-height: 46px;
    margin-top: 18px;
    border: 0;
    border-radius: 9px;
    background: #2563eb;
    color: #fff;
    font-weight: 700;
    cursor: pointer;
  `;

  retry.addEventListener(
    "click",
    () => location.reload()
  );

  card.append(retry);

  const loginLink =
    document.createElement(
      "a"
    );

  loginLink.href =
    rootPath(
      "login.html"
    );

  loginLink.textContent =
    "ログイン画面へ";

  loginLink.style.cssText = `
    display: block;
    margin-top: 14px;
    text-align: center;
    color: #2563eb;
  `;

  card.append(
    loginLink
  );

  main.append(card);

  document.body.append(main);
}

/* =========================================================
   エラー詳細
   ========================================================= */

function errorDetails(
  error
) {
  return `${
    error?.code ||
    "error"
  }: ${
    error?.message ||
    String(error)
  }`;
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
   現在ユーザー
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
      `ユーザープロフィールがありません。users/${user.uid} を確認してください。`
    );
  }

  return snapshot.data();
}

/* =========================================================
   Firebase Auth待機
   ========================================================= */

export function waitForAuth() {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let unsubscribe =
        null;

      let finished =
        false;

      function cleanup() {
        if (
          unsubscribe
        ) {
          unsubscribe();

          unsubscribe =
            null;
        }
      }

      unsubscribe =
        onAuthStateChanged(
          auth,
          user => {
            if (
              finished
            ) {
              return;
            }

            finished =
              true;

            cleanup();

            resolve(user);
          },
          error => {
            if (
              finished
            ) {
              return;
            }

            finished =
              true;

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
    ![
      "student",
      "admin"
    ].includes(
      requiredRole
    )
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
    /*
      Firebase Authの初期化を待つ。
    */

    await persistenceReady;

    const user =
      await waitForAuth();

    /*
      未ログインならログイン画面へ。
    */

    if (!user) {
      location.replace(
        rootPath(
          "login.html"
        )
      );

      return null;
    }

    /*
      プロフィール取得。
    */

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
          ? "アクセス権限エラー"
          : "ユーザー情報エラー",
        "ユーザープロフィールを確認できませんでした。",
        errorDetails(error)
      );

      return null;
    }

    /*
      アカウント状態。
    */

    if (
      profile.status !==
      "active"
    ) {
      await signOut(
        auth
      );

      location.replace(
        rootPath(
          "login.html"
        )
      );

      return null;
    }

    /*
      role確認。
    */

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

    /*
      必要role確認。
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
      メンテナンス設定。
      
      allowMaintenance=trueなら
      学生でも通過できる。
    */

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

    if (
      settings.maintenance ===
        true &&
      requiredRole ===
        "student" &&
      options.allowMaintenance !==
        true
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
      data:
        profile,
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
        ? "アクセス権限エラー"
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

  if (
    cleanQuestion.length >
    4000
  ) {
    throw new Error(
      "質問が長すぎます。"
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
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            question:
              cleanQuestion,

            conversationId:
              conversationId ||
              null
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
    result?.success !==
      true
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
      conversationId ||
        ""
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
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
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
      "会話サーバーから正しい応答を受信できませんでした。"
    );
  }

  if (
    !response.ok ||
    result?.success !==
      true
  ) {
    throw new Error(
      result?.error ||
      `会話取得エラー (${response.status})`
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
      answerId ||
        ""
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
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
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
      "会話サーバーから正しい応答を受信できませんでした。"
    );
  }

  if (
    !response.ok ||
    result?.success !==
      true
  ) {
    throw new Error(
      result?.error ||
      `回答取得エラー (${response.status})`
    );
  }

  return result;
}

/* =========================================================
   Export
   ========================================================= */

export {
  auth,
  db
};
