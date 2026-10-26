
import { auth } from "./firebase-module.js";
import { askAI } from "./ai.js";


/* =========================================================
   状態
========================================================= */

let currentConversationId = null;

let messageHistory = [];

let isSending = false;


/* =========================================================
   DOM取得
========================================================= */

function $(selector) {
  return document.querySelector(selector);
}


function $all(selector) {
  return Array.from(
    document.querySelectorAll(selector)
  );
}


/* =========================================================
   要素
========================================================= */

function getQuestionInput() {

  return (
    $("#question") ||
    $("#questionInput") ||
    $("#message") ||
    $("#messageInput") ||
    $("textarea[name='question']") ||
    $("textarea[name='message']") ||
    $("textarea")
  );

}


function getSendButton() {

  return (
    $("#sendButton") ||
    $("#sendBtn") ||
    $("#askButton") ||
    $("#submitButton") ||
    $("button[type='submit']")
  );

}


function getAnswerArea() {

  return (
    $("#answer") ||
    $("#answerArea") ||
    $("#aiAnswer") ||
    $("#response") ||
    $("#responseArea") ||
    $(".answer-area") ||
    $(".ai-answer")
  );

}


function getHistoryArea() {

  return (
    $("#history") ||
    $("#chatHistory") ||
    $("#messages") ||
    $(".chat-history") ||
    $(".messages")
  );

}


/* =========================================================
   現在の学年・教科
========================================================= */

function getGrade() {

  const element =
    $("#grade") ||
    $("#gradeSelect") ||
    document.querySelector(
      "[name='grade']"
    );


  if (
    element &&
    typeof element.value === "string" &&
    element.value.trim()
  ) {

    return element.value.trim();

  }


  return "中学2年生";

}


function getSubject() {

  const element =
    $("#subject") ||
    $("#subjectSelect") ||
    document.querySelector(
      "[name='subject']"
    );


  if (
    element &&
    typeof element.value === "string" &&
    element.value.trim()
  ) {

    return element.value.trim();

  }


  return "数学";

}


/* =========================================================
   エスケープ
========================================================= */

function escapeHTML(value) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   Markdown風表示
========================================================= */

function formatAnswer(text) {

  let value =
    escapeHTML(
      text
    );


  /*
   * 改行
   */

  value =
    value.replace(
      /\n/g,
      "<br>"
    );


  /*
   * 太字
   */

  value =
    value.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );


  return value;

}


/* =========================================================
   回答表示
========================================================= */

function showAnswer(
  answer
) {

  const area =
    getAnswerArea();


  if (!area) {

    console.warn(
      "回答表示エリアが見つかりません。"
    );

    return;

  }


  area.innerHTML = `

    <div class="ai-answer-content">

      ${formatAnswer(answer)}

    </div>

  `;


  area.style.display =
    "";


  /*
   * 最後の回答までスクロール
   * 必要な場合だけ使用。
   */

  try {

    area.scrollIntoView({

      behavior:
        "smooth",

      block:
        "nearest"

    });

  } catch {}

}


/* =========================================================
   履歴表示
========================================================= */

function renderHistory() {

  const area =
    getHistoryArea();


  if (!area) {
    return;
  }


  /*
   * 空なら何もしない
   */

  if (
    !messageHistory.length
  ) {

    return;

  }


  area.innerHTML =
    messageHistory
      .map(
        item => {

          const isUser =
            item.role ===
            "user";


          return `

            <div class="
              chat-message
              ${isUser
                ? "user-message"
                : "ai-message"}
            ">

              <div class="chat-message-content">

                ${
                  isUser
                    ? escapeHTML(
                        item.content
                      )
                    : formatAnswer(
                        item.content
                      )
                }

              </div>

            </div>

          `;

        }
      )
      .join("");


  area.scrollTop =
    area.scrollHeight;

}


/* =========================================================
   履歴追加
========================================================= */

function addUserMessage(
  message
) {

  messageHistory.push({

    role:
      "user",

    content:
      message

  });


}


function addAIMessage(
  answer
) {

  messageHistory.push({

    role:
      "assistant",

    content:
      answer

  });

}


/* =========================================================
   送信ボタン状態
========================================================= */

function setSendingState(
  sending
) {

  isSending =
    sending;


  const button =
    getSendButton();


  if (!button) {
    return;
  }


  button.disabled =
    sending;


  if (
    sending
  ) {

    /*
     * 「学習AIを準備しています。」
     * のような画面表示はしない。
     */

    button.dataset.originalText =
      button.textContent;


    button.textContent =
      "送信中";

  } else {

    button.textContent =
      button.dataset.originalText ||
      "送信";

  }

}


/* =========================================================
   エラー表示
========================================================= */

function showError(
  error
) {

  const area =
    getAnswerArea();


  if (!area) {

    console.error(
      error
    );

    return;

  }


  let message =
    "AIへの質問に失敗しました。";


  if (
    error &&
    typeof error.message ===
      "string" &&
    error.message.trim()
  ) {

    message =
      error.message.trim();

  }


  area.innerHTML = `

    <div class="ai-error">

      ${escapeHTML(message)}

    </div>

  `;


  area.style.display =
    "";

}


/* =========================================================
   質問送信
========================================================= */

async function sendQuestion() {

  if (
    isSending
  ) {

    return;

  }


  const input =
    getQuestionInput();


  if (!input) {

    console.error(
      "質問入力欄が見つかりません。"
    );

    return;

  }


  const message =
    String(
      input.value ?? ""
    ).trim();


  if (!message) {

    input.focus();

    return;

  }


  /*
   * ログイン確認
   */

  const user =
    auth?.currentUser;


  if (!user) {

    showError(
      new Error(
        "ログインしてください。"
      )
    );

    return;

  }


  setSendingState(
    true
  );


  try {

    /*
     * 送信前の履歴を保存
     */

    const history =
      messageHistory
        .slice(-12);


    /*
     * AI API
     */

    const result =
      await askAI({

        message,

        question:
          message,

        grade:
          getGrade(),

        subject:
          getSubject(),

        history,

        conversationId:
          currentConversationId

      });


    if (
      !result ||
      !result.success
    ) {

      throw new Error(
        result?.error ||
        "AIから回答を取得できませんでした。"
      );

    }


    const answer =
      String(
        result.answer ??
        ""
      ).trim();


    if (!answer) {

      throw new Error(
        "AIから回答が返されませんでした。"
      );

    }


    /*
     * 会話ID
     */

    if (
      result.conversationId
    ) {

      currentConversationId =
        result.conversationId;

    }


    /*
     * 履歴へ追加
     */

    addUserMessage(
      message
    );


    addAIMessage(
      answer
    );


    /*
     * 表示
     */

    renderHistory();

    showAnswer(
      answer
    );


    /*
     * 入力欄を空にする
     */

    input.value =
      "";


    /*
     * 高さを戻す
     */

    input.style.height =
      "";


    /*
     * 再度入力可能
     */

    input.focus();


  } catch (error) {

    console.error(
      "質問送信エラー:",
      error
    );


    showError(
      error
    );


  } finally {

    setSendingState(
      false
    );

  }

}


/* =========================================================
   Enter送信
========================================================= */

function setupInput(
  input
) {

  if (!input) {
    return;
  }


  input.addEventListener(
    "keydown",
    event => {

      /*
       * Enter
       * Shift + Enter は改行
       */

      if (
        event.key ===
          "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendQuestion();

      }

    }
  );


  /*
   * 自動高さ調整
   */

  input.addEventListener(
    "input",
    () => {

      input.style.height =
        "auto";

      input.style.height =
        `${input.scrollHeight}px`;

    }
  );

}


/* =========================================================
   送信ボタン
========================================================= */

function setupSendButton() {

  const button =
    getSendButton();


  if (!button) {

    console.warn(
      "送信ボタンが見つかりません。"
    );

    return;

  }


  /*
   * 既存イベントとの重複を避ける。
   */

  button.addEventListener(
    "click",
    event => {

      event.preventDefault();

      sendQuestion();

    }
  );

}


/* =========================================================
   フォーム
========================================================= */

function setupForm() {

  const input =
    getQuestionInput();


  if (!input) {
    return;
  }


  const form =
    input.closest(
      "form"
    );


  if (!form) {
    return;
  }


  form.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      sendQuestion();

    }
  );

}


/* =========================================================
   新しい会話
========================================================= */

function setupNewConversation() {

  const buttons =
    $all(
      "#newChat, #newConversation, .new-chat, [data-action='new-chat']"
    );


  buttons.forEach(
    button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          currentConversationId =
            null;

          messageHistory =
            [];


          const answer =
            getAnswerArea();


          if (answer) {

            answer.innerHTML =
              "";

          }


          const history =
            getHistoryArea();


          if (history) {

            history.innerHTML =
              "";

          }


          const input =
            getQuestionInput();


          if (input) {

            input.value =
              "";

            input.focus();

          }

        }
      );

    }
  );

}


/* =========================================================
   初期化
========================================================= */

function initializeQuestionPage() {

  /*
   * ここでは
   *
   * 「システムを確認しています。」
   * 「学習AIを準備しています。」
   *
   * などの待機画面は出さない。
   */


  const input =
    getQuestionInput();


  setupInput(
    input
  );


  setupSendButton();

  setupForm();

  setupNewConversation();


  /*
   * Firebaseのログイン状態は
   * Firebase側に任せる。
   */

  if (
    auth
  ) {

    auth.onAuthStateChanged(
      user => {

        if (!user) {

          console.warn(
            "現在ログインユーザーがいません。"
          );

        }

      }
    );

  }

}


/* =========================================================
   DOM Ready
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeQuestionPage
  );

} else {

  initializeQuestionPage();

}


/* =========================================================
   外部から使用
========================================================= */

window.QuestionPage = {

  sendQuestion,

  getCurrentConversationId() {

    return currentConversationId;

  },

  clearConversation() {

    currentConversationId =
      null;

    messageHistory =
      [];

  }

};
