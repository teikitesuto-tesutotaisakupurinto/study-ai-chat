import { auth } from "./firebase-module.js";

const AI_ENDPOINT =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

const REQUEST_TIMEOUT = 60000;


/* =========================================
   エラー
========================================= */

export class AIRequestError extends Error {
  constructor(message, code = "", status = 0) {
    super(message);

    this.name = "AIRequestError";
    this.code = code;
    this.status = status;
  }
}


/* =========================================
   ログインユーザー
========================================= */

function getCurrentUser() {
  if (!auth) {
    throw new AIRequestError(
      "Firebase Authenticationを初期化できません。",
      "FIREBASE_AUTH_ERROR"
    );
  }

  const user = auth.currentUser;

  if (!user) {
    throw new AIRequestError(
      "ログインしてください。",
      "AUTH_REQUIRED"
    );
  }

  return user;
}


/* =========================================
   Firebase ID Token
========================================= */

async function getIdToken(user) {
  try {
    const token = await user.getIdToken(false);

    if (!token) {
      throw new Error("ID Tokenが取得できませんでした。");
    }

    return token;

  } catch (error) {

    console.error(
      "Firebase ID Token error:",
      error
    );

    throw new AIRequestError(
      "Firebaseの認証情報を取得できませんでした。",
      "TOKEN_ERROR"
    );
  }
}


/* =========================================
   タイムアウト
========================================= */

function createTimeout() {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  return {
    controller,
    clear() {
      clearTimeout(timer);
    }
  };
}


/* =========================================
   回答取得
========================================= */

function extractAnswer(data, rawText) {

  if (
    data &&
    typeof data.answer === "string"
  ) {
    return data.answer.trim();
  }

  if (
    data &&
    typeof data.response === "string"
  ) {
    return data.response.trim();
  }

  if (
    data &&
    typeof data.text === "string"
  ) {
    return data.text.trim();
  }

  if (
    data &&
    typeof data.message === "string"
  ) {
    return data.message.trim();
  }

  if (
    data &&
    typeof data.result === "string"
  ) {
    return data.result.trim();
  }

  if (
    data &&
    Array.isArray(data.choices)
  ) {

    const choice = data.choices[0];

    if (
      choice?.message &&
      typeof choice.message.content === "string"
    ) {
      return choice.message.content.trim();
    }

    if (
      typeof choice?.text === "string"
    ) {
      return choice.text.trim();
    }
  }

  if (
    typeof rawText === "string" &&
    rawText.trim()
  ) {
    return rawText.trim();
  }

  return "";
}


/* =========================================
   エラー処理
========================================= */

async function createResponseError(response) {

  const rawText = await response.text();

  let data = null;

  try {
    data = JSON.parse(rawText);
  } catch {
    data = null;
  }

  const serverMessage =
    data?.error ||
    data?.message ||
    data?.details ||
    "";


  if (response.status === 401) {

    return new AIRequestError(
      "AIサービスの認証に失敗しました。ログイン状態を確認してください。",
      "AI_UNAUTHORIZED",
      401
    );
  }


  if (response.status === 403) {

    return new AIRequestError(
      "AIサービスを利用する権限がありません。",
      "AI_FORBIDDEN",
      403
    );
  }


  if (response.status === 404) {

    return new AIRequestError(
      "AIサービスが見つかりません。Supabaseのstudy-chatを確認してください。",
      "AI_NOT_FOUND",
      404
    );
  }


  if (response.status >= 500) {

    return new AIRequestError(
      serverMessage ||
      "AIサーバーでエラーが発生しました。",
      "AI_SERVER_ERROR",
      response.status
    );
  }


  return new AIRequestError(
    serverMessage ||
    `AIサービスへの接続に失敗しました。（${response.status}）`,
    "AI_HTTP_ERROR",
    response.status
  );
}


/* =========================================
   AI質問
========================================= */

export async function askAI(options = {}) {

  const message =
    String(
      options.message ??
      options.question ??
      ""
    ).trim();


  if (!message) {

    throw new AIRequestError(
      "質問を入力してください。",
      "EMPTY_MESSAGE"
    );
  }


  const grade =
    String(
      options.grade ??
      "中学2年生"
    ).trim();


  const subject =
    String(
      options.subject ??
      "数学"
    ).trim();


  const history =
    Array.isArray(options.history)
      ? options.history
      : [];


  const cleanHistory =
    history
      .filter(item => item)
      .map(item => {

        if (
          typeof item.question === "string" &&
          typeof item.answer === "string"
        ) {

          return {
            question: item.question.trim(),
            answer: item.answer.trim()
          };
        }

        return item;

      })
      .slice(-12);


  const user =
    getCurrentUser();


  const token =
    await getIdToken(user);


  const requestBody = {

    message,

    question: message,

    grade,

    subject,

    history: cleanHistory

  };


  const timeout =
    createTimeout();


  try {

    const response =
      await fetch(
        AI_ENDPOINT,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json",

            "Authorization":
              `Bearer ${token}`

          },

          body:
            JSON.stringify(
              requestBody
            ),

          signal:
            timeout.controller.signal
        }
      );


    if (!response.ok) {

      throw await createResponseError(
        response
      );
    }


    const rawText =
      await response.text();


    let data = null;


    try {

      data =
        JSON.parse(
          rawText
        );

    } catch {

      data = null;

    }


    const answer =
      extractAnswer(
        data,
        rawText
      );


    if (!answer) {

      throw new AIRequestError(
        "AIから回答が返されませんでした。",
        "EMPTY_AI_RESPONSE"
      );
    }


    return {

      success: true,

      answer,

      conversationId:
        data?.conversationId ??
        null,

      questionId:
        data?.questionId ??
        null,

      answerId:
        data?.answerId ??
        null

    };


  } catch (error) {

    if (
      error instanceof
      AIRequestError
    ) {

      throw error;
    }


    if (
      error?.name ===
      "AbortError"
    ) {

      throw new AIRequestError(
        "AIの回答が時間内に返りませんでした。もう一度お試しください。",
        "AI_TIMEOUT"
      );
    }


    console.error(
      "AI request error:",
      error
    );


    throw new AIRequestError(
      "AIサービスに接続できませんでした。ネットワーク接続とSupabaseのstudy-chatを確認してください。",
      "AI_NETWORK_ERROR"
    );

  } finally {

    timeout.clear();

  }
}


/* =========================================
   グローバル
========================================= */

window.StudyAI = {
  askAI
};
