
import { auth } from "./firebase-module.js";
import { askAI } from "./ai.js";

/* =========================================================
   質問ページ
========================================================= */

let sending = false;
let conversationHistory = [];
let currentConversationId = null;

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  Array.from(document.querySelectorAll(selector));


/* =========================================================
   要素取得
========================================================= */

function getInput() {
  return (
    $("#questionInput") ||
    $("#question") ||
    $("#messageInput") ||
    $("#message") ||
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
    $("[data-action='send-question']")
  );
}

function getChatArea() {
  return (
    $("#chatMessages") ||
    $("#chatHistory") ||
    $("#messages") ||
    $("#conversation") ||
    $("#chatContainer") ||
    $(".chat-messages")
  );
}

function getAnswerArea() {
  return (
    $("#answerArea") ||
    $("#aiAnswer") ||
    $("#responseArea") ||
    $("#answer")
  );
}

function getGrade() {
  const element =
    $("#grade") ||
    $("#gradeSelect") ||
    $("[name='grade']");

  return element?.value?.trim() || "中学2年生";
}

function getSubject() {
  const element =
    $("#subject") ||
    $("#subjectSelect") ||
    $("[name='subject']");

  return element?.value?.trim() || "数学";
}


/* =========================================================
   安全なテキスト表示
========================================================= */

function createMessageElement(role, content) {
  const wrapper = document.createElement("div");

  wrapper.className =
    role === "user"
      ? "chat-message user-message"
      : "chat-message ai-message";

  wrapper.dataset.role = role;

  const body = document.createElement("div");
  body.className = "chat-message-content";

  // HTMLとして解釈させず、テキストとして表示する
  body.textContent = String(content ?? "");

  wrapper.appendChild(body);

  return wrapper;
}


/* =========================================================
   会話表示
========================================================= */

function renderHistory() {
  const area = getChatArea();

  if (!area) {
    console.error(
      "質問履歴の表示先が見つかりません。HTML側の要素IDを確認してください。"
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of conversationHistory) {
    fragment.appendChild(
      createMessageElement(item.role, item.content)
    );
  }

  area.replaceChildren(fragment);
  area.scrollTop = area.scrollHeight;
}

function addMessage(role, content) {
  conversationHistory.push({
    role,
    content: String(content ?? "")
  });

  renderHistory();
}


/* =========================================================
   エラー表示
========================================================= */

function showError(message) {
  const text =
    String(message || "質問の送信に失敗しました。");

  const area = getChatArea();

  if (area) {
    area.appendChild(
      createMessageElement("assistant", `エラー：${text}`)
    );

    area.scrollTop = area.scrollHeight;
    return;
  }

  const answerArea = getAnswerArea();

  if (answerArea) {
    answerArea.textContent = `エラー：${text}`;
    return;
  }

  console.error(text);
}


/* =========================================================
   送信状態
========================================================= */

function setSending(value) {
  sending = value;

  const button = getSendButton();

  if (button) {
    button.disabled = value;
    button.setAttribute(
      "aria-busy",
      value ? "true" : "false"
    );
  }

  const input = getInput();

  if (input) {
    input.setAttribute(
      "aria-busy",
      value ? "true" : "false"
    );
  }
}


/* =========================================================
   質問送信
========================================================= */

async function sendQuestion() {
  if (sending) return;

  const input = getInput();

  if (!input) {
    console.error(
      "質問入力欄が見つかりません。question.htmlの入力欄IDを確認してください。"
    );
    return;
  }

  const message = String(input.value || "").trim();

  if (!message) {
    input.focus();
    return;
  }

  if (!auth?.currentUser) {
    showError("ログインしてください。");
    return;
  }

  setSending(true);

  // 送信前の履歴をコピーする
  const historyForRequest =
    conversationHistory.slice(-12).map((item) => ({
      role: item.role,
      content: item.content
    }));

  // ユーザーの質問を先に表示する
  addMessage("user", message);

  // 送信後、入力欄を空にする
  input.value = "";
  input.style.height = "";

  try {
    /*
     * ai.js の askAI() と統一した引数。
     * Firebase ID Tokenはai.js側で取得・付与する。
     */
    const result = await askAI({
      message,
      grade: getGrade(),
      subject: getSubject(),
      history: historyForRequest,
      conversationId: currentConversationId
    });

    if (!result || result.success === false) {
      throw new Error(
        result?.error || "AIから回答を取得できませんでした。"
      );
    }

    const answer = String(result.answer || "").trim();

    if (!answer) {
      throw new Error("AIから空の回答が返されました。");
    }

    if (result.conversationId) {
      currentConversationId = result.conversationId;
    }

    addMessage("assistant", answer);

  } catch (error) {
    console.error("質問送信エラー:", error);

    showError(
      error instanceof Error
        ? error.message
        : "通信中にエラーが発生しました。"
    );

  } finally {
    setSending(false);

    // 送信後も再び質問できるようにする
    const currentInput = getInput();

    if (currentInput) {
      currentInput.focus();
    }
  }
}


/* =========================================================
   入力欄
========================================================= */

function setupInput() {
  const input = getInput();

  if (!input) {
    console.error(
      "入力欄が見つかりません。question.htmlを確認してください。"
    );
    return;
  }

  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      sendQuestion();
    }
  });
}


/* =========================================================
   送信ボタン
========================================================= */

function setupSendButton() {
  const button = getSendButton();

  if (!button) {
    console.error(
      "送信ボタンが見つかりません。question.htmlを確認してください。"
    );
    return;
  }

  button.addEventListener("click", (event) => {
    event.preventDefault();
    sendQuestion();
  });
}


/* =========================================================
   フォーム送信
========================================================= */

function setupForm() {
  const input = getInput();
  const form = input?.closest("form");

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendQuestion();
  });
}


/* =========================================================
   新しい会話
========================================================= */

function setupNewConversation() {
  const buttons = $$(
    "#newChat, #newConversation, .new-chat, [data-action='new-chat']"
  );

  for (const button of buttons) {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      currentConversationId = null;
      conversationHistory = [];

      const area = getChatArea();

      if (area) {
        area.replaceChildren();
      }

      const answerArea = getAnswerArea();

      if (answerArea) {
        answerArea.textContent = "";
      }

      const input = getInput();

      if (input) {
        input.value = "";
        input.focus();
      }
    });
  }
}


/* =========================================================
   初期化
========================================================= */

function initializeQuestionPage() {
  setupInput();
  setupSendButton();
  setupForm();
  setupNewConversation();

  // 初期化中の待機メッセージは表示しない。
  // Firebaseのログイン状態は既存の認証処理に任せる。
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeQuestionPage,
    { once: true }
  );
} else {
  initializeQuestionPage();
}


/* =========================================================
   他のスクリプトから呼び出すためのAPI
========================================================= */

window.QuestionPage = {
  sendQuestion,

  clearConversation() {
    currentConversationId = null;
    conversationHistory = [];

    const area = getChatArea();

    if (area) {
      area.replaceChildren();
    }
  },

  getConversationId() {
    return currentConversationId;
  }
};
