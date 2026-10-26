

/* =========================================================
   設定
========================================================= */

const STUDY_CHAT_ENDPOINT =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";


/* =========================================================
   Firebase
========================================================= */

async function getFirebaseAuth() {

  try {

    const module =
      await import("./firebase-module.js");

    if (!module.auth) {
      throw new Error(
        "Firebase Authenticationを初期化できませんでした。"
      );
    }

    return module.auth;

  } catch (error) {

    console.error(
      "Firebase読み込みエラー:",
      error
    );

    throw new Error(
      "Firebase Authenticationを初期化できませんでした。"
    );

  }

}


/* =========================================================
   Firebaseユーザー取得
========================================================= */

async function getCurrentUser() {

  const auth =
    await getFirebaseAuth();


  if (auth.currentUser) {
    return auth.currentUser;
  }


  /*
   * currentUserがまだ復元されていない場合に備える
   */

  return await new Promise(
    (resolve, reject) => {

      let finished = false;


      const timeout =
        setTimeout(() => {

          if (finished) return;

          finished = true;

          reject(
            new Error(
              "ログイン状態を確認できませんでした。"
            )
          );

        }, 10000);


      let unsubscribe = null;


      try {

        unsubscribe =
          auth.onAuthStateChanged(
            (user) => {

              if (finished) return;

              finished = true;

              clearTimeout(
                timeout
              );

              if (unsubscribe) {
                unsubscribe();
              }

              if (!user) {

                reject(
                  new Error(
                    "ログインしてください。"
                  )
                );

                return;
              }

              resolve(user);

            }
          );

      } catch (error) {

        if (finished) return;

        finished = true;

        clearTimeout(
          timeout
        );

        if (unsubscribe) {
          unsubscribe();
        }

        reject(error);

      }

    }
  );

}


/* =========================================================
   JSONからAI本文を抽出
========================================================= */

/**
 * AIから返ってきた値を、
 * 最終的に画面表示する普通の文章へ変換する。
 *
 * 対応例:
 *
 * "こんにちは"
 *
 * {
 *   "answer": "こんにちは"
 * }
 *
 * {
 *   "content": "こんにちは"
 * }
 *
 * ```json
 * {
 *   "answer": "こんにちは"
 * }
 * ```
 */

function extractPlainAnswer(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  if (
    typeof value !==
    "string"
  ) {

    return extractAnswerFromObject(
      value
    );

  }


  let text =
    value.trim();


  if (!text) {
    return "";
  }


  /*
   * まず普通のJSONとして解析
   */

  try {

    const parsed =
      JSON.parse(text);


    const result =
      extractAnswerFromObject(
        parsed
      );


    if (result) {
      return result;
    }

  } catch {
    // JSONではない通常の文章
  }


  /*
   * ```json ... ```
   * のコードブロック
   */

  const jsonBlock =
    text.match(
      /^```(?:json)?\s*([\s\S]*?)\s*```$/i
    );


  if (jsonBlock) {

    try {

      const parsed =
        JSON.parse(
          jsonBlock[1]
        );


      const result =
        extractAnswerFromObject(
          parsed
        );


      if (result) {
        return result;
      }

    } catch {
      // 通常文章として扱う
    }

  }


  /*
   * JSONの前後に余計な文字が付いている場合
   *
   * 例:
   *
   * 回答はこちらです。
   * {"answer":"二次関数です。"}
   */

  const firstBrace =
    text.indexOf("{");


  const lastBrace =
    text.lastIndexOf("}");


  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {

    const possibleJson =
      text.slice(
        firstBrace,
        lastBrace + 1
      );


    try {

      const parsed =
        JSON.parse(
          possibleJson
        );


      const result =
        extractAnswerFromObject(
          parsed
        );


      if (result) {

        /*
         * JSONの外側にある文章ではなく、
         * JSON内のanswerを優先する
         */

        return result;

      }

    } catch {
      // JSONではない
    }

  }


  /*
   * JSONでなければそのまま文章として返す
   */

  return text;

}


/* =========================================================
   オブジェクトから回答本文を取得
========================================================= */

function extractAnswerFromObject(
  data
) {

  if (
    data === null ||
    data === undefined
  ) {

    return "";

  }


  if (
    typeof data ===
    "string"
  ) {

    return data.trim();

  }


  if (
    typeof data ===
    "number" ||
    typeof data ===
    "boolean"
  ) {

    return String(data);

  }


  if (
    Array.isArray(data)
  ) {

    const parts = [];


    for (
      const item of data
    ) {

      const result =
        extractAnswerFromObject(
          item
        );


      if (result) {
        parts.push(result);
      }

    }


    return parts
      .join("\n\n")
      .trim();

  }


  if (
    typeof data !==
    "object"
  ) {

    return String(data);

  }


  /*
   * AI回答として使用する可能性が高いキー
   */

  const answerKeys = [

    "answer",

    "content",

    "response",

    "message",

    "text",

    "output",

    "result"

  ];


  for (
    const key of answerKeys
  ) {

    if (
      Object.prototype.hasOwnProperty.call(
        data,
        key
      )
    ) {

      const result =
        extractAnswerFromObject(
          data[key]
        );


      if (result) {
        return result;
      }

    }

  }


  /*
   * OpenAI / Groq形式
   *
   * {
   *   choices: [
   *     {
   *       message: {
   *         content: "..."
   *       }
   *     }
   *   ]
   * }
   */

  if (
    Array.isArray(
      data.choices
    )
  ) {

    for (
      const choice of data.choices
    ) {

      const result =
        extractAnswerFromObject(
          choice
        );


      if (result) {
        return result;
      }

    }

  }


  /*
   * choicesが見つからない場合、
   * オブジェクトの値を調べる
   */

  const parts = [];


  for (
    const value of Object.values(
      data
    )
  ) {

    if (
      typeof value !==
      "object" &&
      typeof value !==
      "string"
    ) {

      continue;

    }


    const result =
      extractAnswerFromObject(
        value
      );


    if (result) {

      parts.push(
        result
      );

    }

  }


  return parts
    .join("\n\n")
    .trim();

}


/* =========================================================
   サーバーエラーを文章化
========================================================= */

function getServerErrorMessage(
  response,
  data
) {

  const status =
    response?.status;


  const message =
    data?.error ??
    data?.message ??
    data?.details ??
    "";


  if (
    typeof message ===
    "string" &&
    message.trim()
  ) {

    return message.trim();

  }


  if (
    status === 400
  ) {

    return "送信された質問を処理できませんでした。";

  }


  if (
    status === 401
  ) {

    return "ログイン認証に失敗しました。もう一度ログインしてください。";

  }


  if (
    status === 403
  ) {

    return "AIへのアクセスが拒否されました。";

  }


  if (
    status === 404
  ) {

    return "AIサーバーが見つかりません。Edge Functionの公開URLを確認してください。";

  }


  if (
    status === 429
  ) {

    return "AIの利用制限に達しました。少し待ってから再試行してください。";

  }


  if (
    status >= 500
  ) {

    return "AIサーバーでエラーが発生しました。時間をおいて再試行してください。";

  }


  return (
    `AIへの質問に失敗しました${
      status
        ? `（HTTP ${status}）`
        : ""
    }。`
  );

}


/* =========================================================
   質問送信
========================================================= */

export async function askAI({

  message,

  grade = "中学2年生",

  subject = "",

  history = [],

  conversationId = null

} = {}) {

  /*
   * 質問チェック
   */

  const question =
    String(
      message ?? ""
    ).trim();


  if (!question) {

    throw new Error(
      "質問を入力してください。"
    );

  }


  if (
    question.length >
    10000
  ) {

    throw new Error(
      "質問が長すぎます。10,000文字以内で入力してください。"
    );

  }


  /*
   * Firebaseユーザー
   */

  const user =
    await getCurrentUser();


  if (!user) {

    throw new Error(
      "ログインしてください。"
    );

  }


  /*
   * Firebase ID Token
   */

  let idToken;


  try {

    /*
     * trueを指定して期限切れトークンを更新
     */

    idToken =
      await user.getIdToken(
        true
      );

  } catch (error) {

    console.error(
      "Firebase ID Token取得エラー:",
      error
    );


    throw new Error(
      "ログイン認証情報を取得できませんでした。もう一度ログインしてください。"
    );

  }


  if (!idToken) {

    throw new Error(
      "ログイン認証情報を取得できませんでした。"
    );

  }


  /*
   * 会話履歴を安全に整理
   */

  const safeHistory =
    Array.isArray(history)

      ? history
          .filter(
            item =>
              item &&
              (
                item.role ===
                  "user" ||
                item.role ===
                  "assistant"
              ) &&
              typeof item.content ===
                "string"
          )
          .slice(-12)
          .map(
            item => ({

              role:
                item.role,

              content:
                String(
                  item.content
                )
                .trim()
                .slice(
                  0,
                  6000
                )

            })
          )

      : [];


  /*
   * 送信データ
   */

  const requestBody = {

    message:
      question,

    grade:
      String(
        grade || ""
      ).trim(),

    subject:
      String(
        subject || ""
      ).trim(),

    history:
      safeHistory,

    conversationId:
      conversationId || null

  };


  console.log(
    "Study AIへ質問を送信"
  );


  /*
   * Supabase Edge Function
   */

  let response;


  try {

    response =
      await fetch(
        STUDY_CHAT_ENDPOINT,
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${idToken}`,

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify(
              requestBody
            )

        }
      );

  } catch (error) {

    console.error(
      "Study AI通信エラー:",
      error
    );


    throw new Error(
      "AIサーバーに接続できませんでした。ネットワーク接続を確認してください。"
    );

  }


  /*
   * サーバーからJSONを取得
   */

  let data = null;


  const rawText =
    await response.text();


  if (
    rawText.trim()
  ) {

    try {

      data =
        JSON.parse(
          rawText
        );

    } catch {

      /*
       * JSONではなく普通の文章が
       * 直接返された場合にも対応
       */

      data = {

        answer:
          rawText

      };

    }

  }


  /*
   * HTTPエラー
   */

  if (
    !response.ok
  ) {

    console.error(
      "Study AIサーバーエラー:",
      {
        status:
          response.status,

        data

      }
    );


    throw new Error(
      getServerErrorMessage(
        response,
        data
      )
    );

  }


  /*
   * success:false
   */

  if (
    data &&
    data.success === false
  ) {

    const errorMessage =
      data.error ||
      data.message ||
      "AIから回答を取得できませんでした。";


    throw new Error(
      String(
        errorMessage
      )
    );

  }


  /*
   * AI回答を抽出
   *
   * ここが今回の重要部分
   */

  const rawAnswer =

    data?.answer ??

    data?.content ??

    data?.response ??

    data?.message ??

    data?.output ??

    data?.result ??

    data;


  const answer =
    extractPlainAnswer(
      rawAnswer
    );


  /*
   * 回答が空ならエラー
   */

  if (
    !answer ||
    !answer.trim()
  ) {

    console.error(
      "AI回答が空です:",
      data
    );


    throw new Error(
      "AIから回答が返されませんでした。もう一度質問してください。"
    );

  }


  /*
   * 会話ID
   */

  const returnedConversationId =

    data?.conversationId ??

    data?.conversation_id ??

    conversationId ??

    null;


  /*
   * questionId
   */

  const questionId =

    data?.questionId ??

    data?.question_id ??

    null;


  /*
   * answerId
   */

  const answerId =

    data?.answerId ??

    data?.answer_id ??

    null;


  /*
   * question.jsへ返す
   */

  return {

    success:
      true,

    answer:
      answer.trim(),

    conversationId:
      returnedConversationId,

    questionId:
      questionId,

    answerId:
      answerId

  };

}


/* =========================================================
   外部からJSON変換機能を利用する場合
========================================================= */

export {

  extractPlainAnswer,

  extractAnswerFromObject

};


/* =========================================================
   デバッグ用
========================================================= */

if (
  typeof window !==
  "undefined"
) {

  window.StudyAI = {

    askAI,

    extractPlainAnswer,

    extractAnswerFromObject

  };

}
