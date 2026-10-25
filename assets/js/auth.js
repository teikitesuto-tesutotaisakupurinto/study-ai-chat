import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase-module.js";

const SUPABASE_FUNCTION_URL =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

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

  retry.addEventListener("click", () => {
    location.reload();
  });

  main.append(retry);

  const loginLink = document.createElement("a");
  loginLink.href = rootPath("login.html");
  loginLink.className = "button";
  loginLink.textContent = "ログイン画面へ";

  main.append(loginLink);

  document.body.append(main);
}

export async function getSystemSettings() {
  const snapshot = await getDoc(
    doc(db, "settings", "system")
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Firestoreにsettings/systemがありません。"
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
    await persistenceReady;

    const user = await waitForAuth();

    if (!user) {
      location.replace(
        rootPath("login.html")
      );
      return null;
    }

    const profile =
      await getCurrentProfile(user);

    if (profile.status !== "active") {
      await signOut(auth);

      showAccessError(
        "アカウント利用不可",
        "このアカウントは現在利用できません。",
      );

      return null;
    }

    if (
      !["student", "admin"].includes(
        profile.role
      )
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
        "システム設定を取得できません。",
        errorDetails(error)
      );

      return null;
    }

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
      "権限確認に失敗したため、ページの初期化を中止しました。"
    );
  }

  return result;
}

/* =========================================================
   Study AI Chat
   ========================================================= */

async function getFirebaseToken() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  return user.getIdToken(true);
}

async function callStudyFunction(body) {
  const token =
    await getFirebaseToken();

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

        body: JSON.stringify(body)
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
      `AIサーバーから正しい応答を受信できませんでした。\nHTTP ${response.status}\n${text}`
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.error ||
      `AIサーバーエラー (${response.status})`
    );
  }

  if (result?.success !== true) {
    throw new Error(
      result?.error ||
      "AIサーバーで処理に失敗しました。"
    );
  }

  return result;
}

export async function sendStudyQuestion(
  question,
  conversationId = null
) {
  const cleanQuestion =
    String(question || "").trim();

  if (!cleanQuestion) {
    throw new Error(
      "質問を入力してください。"
    );
  }

  if (cleanQuestion.length > 4000) {
    throw new Error(
      "質問が長すぎます。"
    );
  }

  return callStudyFunction({
    action: "sendStudyQuestion",

    question: cleanQuestion,

    conversationId:
      conversationId || null
  });
}

export async function getConversation(
  conversationId
) {
  const cleanId =
    String(
      conversationId || ""
    ).trim();

  if (!cleanId) {
    throw new Error(
      "会話IDがありません。"
    );
  }

  return callStudyFunction({
    action: "getConversation",

    conversationId: cleanId
  });
}

export async function getConversationByAnswerId(
  answerId
) {
  const cleanId =
    String(
      answerId || ""
    ).trim();

  if (!cleanId) {
    throw new Error(
      "回答IDがありません。"
    );
  }

  return callStudyFunction({
    action:
      "getConversationByAnswerId",

    answerId: cleanId
  });
}

/* =========================================================
   最近の会話
   ========================================================= */

export async function getRecentConversations(
  count = 10
) {
  return callStudyFunction({
    action: "listConversations",
    limit: Math.min(
      Math.max(Number(count) || 10, 1),
      30
    )
  });
}

export {
  auth,
  db
};
