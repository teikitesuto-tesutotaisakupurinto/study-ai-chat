
/*
 * assets/js/ai.js
 *
 * Study AI Chat
 *
 * ブラウザ
 *   ↓
 * Firebase Authentication
 *   ↓ Firebase ID Token
 * Supabase Edge Function
 *   ↓
 * Groq / AI
 *
 * 重要:
 * - Groq APIキーはここに書かない
 * - Supabase Secretもここに書かない
 * - Firebase APIキーもここには書かない
 *
 * question.js から:
 *
 * await askAI({
 *   message,
 *   grade,
 *   subject,
 *   history
 * });
 */


/* =========================================
   Firebase
========================================= */

import {
  auth
} from "./firebase-module.js";


/* =========================================
   設定
========================================= */

const AI_ENDPOINT =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";


const REQUEST_TIMEOUT =
  60000;


/* =========================================
   共通エラー
========================================= */

class AIRequestError extends Error {

  constructor(
    message,
    options = {}
  ) {

    super(
      message
    );


    this.name =
      "AIRequestError";


    this.status =
      options.status ||
      0;


    this.code =
      options.code ||
      "";


    this.details =
      options.details ||
      null;

  }

}


/* =========================================
   Firebaseユーザー取得
========================================= */

function getCurrentUser() {

  if (
    !auth
  ) {

    throw new AIRequestError(
      "Firebase Authenticationを初期化できません。"
    );

  }


  const user =
    auth.currentUser;


  if (
    !user
  ) {

    throw new AIRequestError(
      "ログイン状態を確認できません。ログインしてからもう一度お試しください。",
      {
        code:
          "AUTH_REQUIRED"
      }
    );

  }


  return user;

}


/* =========================================
   Firebase ID Token
========================================= */

async function getFirebaseIdToken(
  user
) {

  if (
    !user
  ) {

    throw new AIRequestError(
      "Firebaseユーザーが確認できません。",
      {
        code:
          "AUTH_REQUIRED"
      }
    );

  }


  try {

    /*
     * false:
     * 毎回強制更新せず、
     * Firebaseが必要に応じて更新する。
     */

    const token =
      await user.getIdToken(
        false
      );


    if (
      !token
    ) {

      throw new AIRequestError(
        "Firebase IDトークンを取得できませんでした。",
        {
          code:
            "TOKEN_EMPTY"
        }
      );

    }


    return token;

  } catch (
    error
  ) {

    if (
      error instanceof
      AIRequestError
    ) {

      throw error;

    }


    throw new AIRequestError(
      "Firebase認証情報を取得できませんでした。",
      {
        code:
          "TOKEN_ERROR",

        details:
          error
      }
    );

  }

}


/* =========================================
   JSON安全解析
========================================= */

async function readResponseBody(
  response
) {

  const text =
    await response.text();


  if (
    !text
  ) {

    return {
      raw: "",
      data: null
    };

  }


  try {

    return {

      raw:
        text,

      data:
        JSON.parse(
          text
        )

    };

  } catch {

    return {

      raw:
        text,

      data:
        null

    };

  }

}


/* =========================================
   AI回答抽出
========================================= */

function extractAnswer(
  data,
  raw
) {

  /*
   * 代表的なレスポンス形式を
   * 幅広く受け取る。
   */

  if (
    typeof data ===
    "string"
  ) {

    return data.trim();

  }


  if (
    data &&
    typeof data.answer ===
    "string"
  ) {

    return data.answer.trim();

  }


  if (
    data &&
    typeof data.response ===
    "string"
  ) {

    return data.response.trim();

  }


  if (
    data &&
    typeof data.message ===
    "string"
  ) {

    return data.message.trim();

  }


  if (
    data &&
    typeof data.text ===
    "string"
  ) {

    return data.text.trim();

  }


  /*
   * OpenAI / Groq系の形式にも対応。
   */

  if (
    data &&
    Array.isArray(
      data.choices
    )
  ) {

    const choice =
      data.choices[0];


    if (
      choice &&
      typeof choice.text ===
      "string"
    ) {

      return choice.text.trim();

    }


    const content =
      choice?.message?.content;


    if (
      typeof content ===
      "string"
    ) {

      return content.trim();

    }

  }


  /*
   * data.result
   */

  if (
    data &&
    typeof data.result ===
    "string"
  ) {

    return data.result.trim();

  }


  /*
   * 最後にJSONでなく
   * プレーンテキストだった場合。
   */

  if (
    typeof raw ===
    "string" &&
    raw.trim()
  ) {

    return raw.trim();

  }


  return "";

}


/* =========================================
   HTTPエラー
========================================= */

function createHTTPError(
  response,
  body
) {

  const status =
    response.status;


  const data =
    body?.data;


  const raw =
    body?.raw ||
    "";


  const serverMessage =
    data?.error ||
    data?.message ||
    data?.details ||
    "";


  if (
    status === 401
  ) {

    return new AIRequestError(
      "AIサービスの認証に失敗しました。ログイン状態またはEdge Functionの認証設定を確認してください。",
      {
        status,

        code:
          "AI_UNAUTHORIZED",

        details:
          serverMessage ||
          raw
      }
    );

  }


  if (
    status === 403
  ) {

    return new AIRequestError(
      "AIサービスへのアクセス権限がありません。",
      {
        status,

        code:
          "AI_FORBIDDEN",

        details:
          serverMessage ||
          raw
      }
    );

  }


  if (
    status === 404
  ) {

    return new AIRequestError(
      "AIサービスが見つかりません。study-chat Edge FunctionのURLまたは公開状態を確認してください。",
      {
        status,

        code:
          "AI_NOT_FOUND",

        details:
          serverMessage ||
          raw
      }
    );

  }


  if (
    status === 408 ||
    status === 504
  ) {

    return new AIRequestError(
      "AIサービスからの応答が時間内に返りませんでした。もう一度お試しください。",
      {
        status,

        code:
          "AI_TIMEOUT",

        details:
          serverMessage ||
          raw
      }
    );

  }


  if (
    status >= 500
  ) {

    return new AIRequestError(
      "AIサービス側でエラーが発生しました。しばらくしてからもう一度お試しください。",
      {
        status,

        code:
          "AI_SERVER_ERROR",

        details:
          serverMessage ||
          raw
      }
    );

  }


  return new AIRequestError(
    serverMessage ||
    `AIサービスへの接続に失敗しました。（HTTP ${status}）`,
    {
      status,

      code:
        "AI_HTTP_ERROR",

      details:
        raw
    }
  );

}


/* =========================================
   リクエストボディ
========================================= */

function createRequestBody(
  options
) {

  const message =
    String(
      options?.message ||
      ""
    ).trim();


  const grade =
    String(
      options?.grade ||
      "中学生"
    ).trim();


  const subject =
    String(
      options?.subject ||
      "数学"
    ).trim();


  const history =
    Array.isArray(
      options?.history
    )
      ? options.history
      : [];


  /*
   * 会話履歴は壊れたデータを
   * Edge Functionへ送らない。
   */

  const cleanHistory =
    history
      .filter(
        item =>
          item &&
          typeof item ===
            "object"
      )
      .map(
        item => ({

          question:
            String(
              item.question ||
              ""
            ).trim(),

          answer:
            String(
              item.answer ||
              ""
            ).trim()

        })
      )
      .filter(
        item =>
          item.question &&
          item.answer
      )
      .slice(
        -12
      );


  return {

    message,

    question:
      message,

    grade,

    subject,

    history:
      cleanHistory

  };

}


/* =========================================
   AbortController
========================================= */

function createTimeoutController(
  milliseconds
) {

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => {

        controller.abort();

      },
      milliseconds
    );


  return {

    controller,

    clear() {

      clearTimeout(
        timer
      );

    }

  };

}


/* =========================================
   AI問い合わせ
========================================= */

export async function askAI(
  options = {}
) {

  const requestBody =
    createRequestBody(
      options
    );


  if (
    !requestBody.message
  ) {

    throw new AIRequestError(
      "質問内容が入力されていません。",
      {
        code:
          "EMPTY_MESSAGE"
      }
    );

  }


  /*
   * Firebase Authentication
   */

  const user =
    getCurrentUser();


  /*
   * Firebase ID Token
   */

  const token =
    await getFirebaseIdToken(
      user
    );


  /*
   * タイムアウト
   */

  const timeout =
    createTimeoutController(
      REQUEST_TIMEOUT
    );


  try {

    const response =
      await fetch(
        AI_ENDPOINT,
        {

          method:
            "POST",

          mode:
            "cors",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json",

            /*
             * Supabase Edge Function
             * の認証用。
             */

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


    const body =
      await readResponseBody(
        response
      );


    /*
     * HTTPエラー
     */

    if (
      !response.ok
    ) {

      throw createHTTPError(
        response,
        body
      );

    }


    /*
     * 回答抽出
     */

    const answer =
      extractAnswer(
        body.data,
        body.raw
      );


    if (
      !answer
    ) {

      throw new AIRequestError(
        "AIサービスから回答が返されませんでした。",
        {
          status:
            response.status,

          code:
            "EMPTY_AI_RESPONSE",

          details:
            body.data ||
            body.raw
        }
      );

    }


    return answer;

  } catch (
    error
  ) {

    /*
     * 自前のエラーはそのまま。
     */

    if (
      error instanceof
      AIRequestError
    ) {

      throw error;

    }


    /*
     * AbortController
     */

    if (
      error?.name ===
      "AbortError"
    ) {

      throw new AIRequestError(
        "AIサービスへの接続がタイムアウトしました。もう一度お試しください。",
        {
          code:
            "AI_TIMEOUT"
        }
      );

    }


    /*
     * fetchのネットワークエラー
     */

    const message =
      String(
        error?.message ||
        ""
      );


    if (
      /Failed to fetch/i.test(
        message
      ) ||
      /NetworkError/i.test(
        message
      ) ||
      /network/i.test(
        message
      )
    ) {

      throw new AIRequestError(
        "AIサービスへ接続できませんでした。ネットワーク接続またはstudy-chat Edge Functionの公開状態を確認してください。",
        {
          code:
            "AI_NETWORK_ERROR",

          details:
            error
        }
      );

    }


    throw new AIRequestError(
      message ||
      "AIサービスへの接続中にエラーが発生しました。",
      {
        code:
          "AI_UNKNOWN_ERROR",

        details:
          error
      }
    );

  } finally {

    timeout.clear();

  }

}


/* =========================================
   テスト用
========================================= */

export async function testAIConnection() {

  return askAI({

    message:
      "数学の一次方程式について簡単に説明してください。",

    grade:
      "中学2年生",

    subject:
      "数学",

    history:
      []

  });

}


/* =========================================
   グローバルAPI
========================================= */

window.StudyAI = {

  askAI

};
