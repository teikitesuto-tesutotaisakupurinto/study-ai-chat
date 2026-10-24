// assets/js/page.js
"use strict";

/*
 * 学習AIチャット 共通ページ処理
 *
 * AI処理:
 *   Supabase Edge Function
 *   /functions/v1/study-chat
 *
 * Supabase Project:
 *   https://fjqobjcvejhkevyfsoxt.supabase.co
 *
 * 重要:
 *   GROQ_API_KEY は絶対にこのファイルへ書かない。
 *   Groq API は Supabase Edge Function からのみ呼び出す。
 */

import {
  requireRole,
  auth
} from "./auth.js";

import {
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const SUPABASE_URL =
  "https://fjqobjcvejhkevyfsoxt.supabase.co";

const STUDY_CHAT_FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/study-chat`;


/* =========================================================
   基本ユーティリティ
========================================================= */

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function createElement(
  tag,
  className = "",
  text = ""
) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== "") {
    element.textContent = text;
  }

  return element;
}

function escapeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function getQueryParam(name) {
  const params = new URLSearchParams(
    window.location.search
  );

  return params.get(name);
}

function createId(prefix = "id") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return (
    `${prefix}_` +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2)
  );
}

function getConversationId() {
  return getQueryParam("conversationId");
}

function goToConversation(conversationId) {
  if (!conversationId) {
    return;
  }

  const url = new URL(
    "question.html",
    window.location.href
  );

  url.searchParams.set(
    "conversationId",
    conversationId
  );

  window.location.href = url.href;
}


/* =========================================================
   Supabase通信
========================================================= */

async function getFirebaseIdToken() {
  if (!auth?.currentUser) {
    return null;
  }

  try {
    return await auth.currentUser.getIdToken();
  } catch (error) {
    console.error(
      "Firebase ID token取得エラー:",
      error
    );

    return null;
  }
}


/*
 * Edge FunctionへPOST
 *
 * Firebaseログイン状態をAuthorizationに載せる。
 *
 * Edge Function側では必要に応じてこのJWTを検証する。
 */
async function callStudyChat(payload) {
  const firebaseToken =
    await getFirebaseIdToken();

  const headers = {
    "Content-Type": "application/json"
  };

  /*
   * Firebaseトークンが取得できた場合のみ送る。
   *
   * Supabase側を公開Endpointとして構成する場合は
   * tokenがなくてもFunction側で処理できる。
   */
  if (firebaseToken) {
    headers.Authorization =
      `Bearer ${firebaseToken}`;
  }

  const response = await fetch(
    STUDY_CHAT_FUNCTION_URL,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`;

    const error = new Error(message);

    error.code =
      data?.code ||
      `http-${response.status}`;

    error.status =
      response.status;

    throw error;
  }

  return data || {};
}


/* =========================================================
   DOM取得
========================================================= */

const questionForm =
  document.getElementById("questionForm");

const questionInput =
  document.getElementById("question");

const sendButton =
  document.getElementById("sendButton");

const chatMessages =
  document.getElementById("chatMessages");

const errorBox =
  document.getElementById("errorBox");

const conversationTitle =
  document.getElementById("conversationTitle");

const newConversationButton =
  document.getElementById("newConversationButton");

const answerIdElement =
  document.getElementById("answerId");


/* =========================================================
   状態
========================================================= */

let currentConversationId =
  getConversationId();

let currentAnswerId = null;

let sending = false;


/* =========================================================
   エラー表示
========================================================= */

function showError(message) {
  if (!errorBox) {
    console.error(message);
    return;
  }

  errorBox.hidden = false;
  errorBox.textContent =
    escapeText(message);
}

function clearError() {
  if (!errorBox) {
    return;
  }

  errorBox.hidden = true;
  errorBox.textContent = "";
}


/* =========================================================
   送信ボタン状態
========================================================= */

function setSending(value) {
  sending = value;

  if (sendButton) {
    sendButton.disabled = value;

    sendButton.textContent =
      value
        ? "回答を生成しています..."
        : "質問する";
  }

  if (questionInput) {
    questionInput.disabled = value;
  }
}


/* =========================================================
   回答ID
========================================================= */

function setAnswerId(answerId) {
  currentAnswerId =
    answerId || null;

  if (answerIdElement) {
    answerIdElement.textContent =
      currentAnswerId
        ? `回答ID: ${currentAnswerId}`
        : "";
  }
}


/* =========================================================
   会話ID
========================================================= */

function ensureConversationId() {
  if (currentConversationId) {
    return currentConversationId;
  }

  currentConversationId =
    createId("conversation");

  return currentConversationId;
}


/* =========================================================
   チャット表示
========================================================= */

function clearMessages() {
  if (!chatMessages) {
    return;
  }

  chatMessages.replaceChildren();
}


function appendMessage(
  role,
  text,
  options = {}
) {
  if (!chatMessages) {
    return null;
  }

  const wrapper =
    createElement(
      "article",
      `chat-message ${role}`
    );

  if (options.answerId) {
    wrapper.dataset.answerId =
      options.answerId;
  }

  if (options.questionId) {
    wrapper.dataset.questionId =
      options.questionId;
  }

  const header =
    createElement(
      "div",
      "chat-message-role"
    );

  if (role === "user") {
    header.textContent =
      "あなた";
  } else {
    header.textContent =
      "学習AI";
  }

  const body =
    createElement(
      "div",
      "chat-message-content"
    );

  body.textContent =
    escapeText(text);

  wrapper.append(
    header,
    body
  );

  chatMessages.append(wrapper);

  chatMessages.scrollTop =
    chatMessages.scrollHeight;

  return wrapper;
}


/* =========================================================
   回答表示
========================================================= */

function appendAnswer(data) {
  const answer =
    data.answer ||
    data.content ||
    data.message ||
    "";

  const answerId =
    data.answerId ||
    data.id ||
    createId("answer");

  setAnswerId(answerId);

  appendMessage(
    "assistant",
    answer,
    {
      answerId
    }
  );

  return answerId;
}


/* =========================================================
   会話タイトル
========================================================= */

function setConversationTitle(title) {
  if (!conversationTitle) {
    return;
  }

  conversationTitle.textContent =
    title ||
    "新しい会話";
}


/* =========================================================
   初期表示
========================================================= */

function showInitialState() {
  if (!chatMessages) {
    return;
  }

  if (
    chatMessages.children.length === 0
  ) {
    appendMessage(
      "assistant",
      "学習AIチャットへようこそ。質問を入力してください。"
    );
  }
}


/* =========================================================
   会話読み込み
========================================================= */

async function loadConversation() {
  /*
   * conversationId がない場合は
   * 新規会話として開始する。
   */
  if (!currentConversationId) {
    setConversationTitle(
      "新しい会話"
    );

    showInitialState();

    return;
  }

  /*
   * Edge Functionに会話取得を依頼する。
   *
   * page.jsからFirestoreやSupabase RESTへ
   * 直接会話データを書き込まない。
   */
  try {
    const result =
      await callStudyChat({
        action: "getConversation",
        conversationId:
          currentConversationId
      });

    clearMessages();

    const conversation =
      result.conversation ||
      result.data ||
      null;

    if (!conversation) {
      setConversationTitle(
        "新しい会話"
      );

      showInitialState();

      return;
    }

    setConversationTitle(
      conversation.title ||
      "会話"
    );

    const messages =
      Array.isArray(
        conversation.messages
      )
        ? conversation.messages
        : [];

    if (messages.length === 0) {
      showInitialState();
      return;
    }

    for (const message of messages) {
      if (!message) {
        continue;
      }

      const role =
        message.role === "user"
          ? "user"
          : "assistant";

      appendMessage(
        role,
        message.content ||
          message.text ||
          "",
        {
          answerId:
            message.answerId ||
            null,
          questionId:
            message.questionId ||
            null
        }
      );

      if (
        message.answerId
      ) {
        setAnswerId(
          message.answerId
        );
      }
    }

  } catch (error) {
    console.error(
      "会話読み込みエラー:",
      error
    );

    clearMessages();

    appendMessage(
      "assistant",
      "会話履歴を読み込めませんでした。新しい質問はできます。"
    );

    showError(
      `会話履歴の読み込みに失敗しました。\n${error.message || error}`
    );
  }
}


/* =========================================================
   質問送信
========================================================= */

async function submitQuestion(
  question
) {
  const text =
    String(question || "").trim();

  if (!text) {
    showError(
      "質問を入力してください。"
    );

    return;
  }

  if (sending) {
    return;
  }

  clearError();

  const conversationId =
    ensureConversationId();

  /*
   * URLも会話IDに合わせる。
   */
  if (
    getConversationId() !==
    conversationId
  ) {
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "conversationId",
      conversationId
    );

    window.history.replaceState(
      {},
      "",
      url
    );
  }

  const questionId =
    createId("question");

  setSending(true);

  appendMessage(
    "user",
    text,
    {
      questionId
    }
  );

  if (questionInput) {
    questionInput.value = "";
  }

  try {
    const result =
      await callStudyChat({
        action: "chat",

        conversationId,

        questionId,

        previousAnswerId:
          currentAnswerId,

        question: text
      });

    /*
     * Edge Functionから返された
     * 回答IDを保存。
     *
     * 次の質問ではこのIDを
     * previousAnswerIdとして送る。
     */
    const answerId =
      result.answerId ||
      result.id ||
      createId("answer");

    const answer =
      result.answer ||
      result.content ||
      result.message;

    if (!answer) {
      throw new Error(
        "AIから回答が返されませんでした。"
      );
    }

    appendMessage(
      "assistant",
      answer,
      {
        answerId,
        questionId
      }
    );

    setAnswerId(
      answerId
    );

    if (
      result.title
    ) {
      setConversationTitle(
        result.title
      );
    }

    /*
     * 回答を受信した時点で
     * conversationIdをURLに固定。
     */
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "conversationId",
      conversationId
    );

    window.history.replaceState(
      {},
      "",
      url
    );

  } catch (error) {
    console.error(
      "AIチャットエラー:",
      error
    );

    appendMessage(
      "assistant",
      "回答の取得に失敗しました。時間をおいてもう一度お試しください。"
    );

    showError(
      `AIへの質問に失敗しました。\n${error.message || error}`
    );

  } finally {
    setSending(false);

    if (
      questionInput &&
      !questionInput.disabled
    ) {
      questionInput.focus();
    }
  }
}


/* =========================================================
   フォーム
========================================================= */

function setupQuestionForm() {
  if (!questionForm) {
    return;
  }

  if (
    questionForm.dataset.pageBound ===
    "true"
  ) {
    return;
  }

  questionForm.dataset.pageBound =
    "true";

  questionForm.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if (!questionInput) {
        return;
      }

      await submitQuestion(
        questionInput.value
      );
    }
  );
}


/* =========================================================
   Ctrl + Enter / Enter
========================================================= */

function setupQuestionInput() {
  if (!questionInput) {
    return;
  }

  questionInput.addEventListener(
    "keydown",
    event => {
      /*
       * Ctrl + Enter
       */
      if (
        event.key === "Enter" &&
        event.ctrlKey
      ) {
        event.preventDefault();

        if (
          questionForm?.requestSubmit
        ) {
          questionForm.requestSubmit();
        }

        return;
      }

      /*
       * textareaの場合、
       * Enter単体では改行。
       */
    }
  );
}


/* =========================================================
   新規会話
========================================================= */

function startNewConversation() {
  currentConversationId =
    createId("conversation");

  currentAnswerId = null;

  const url =
    new URL(
      window.location.href
    );

  url.searchParams.set(
    "conversationId",
    currentConversationId
  );

  window.location.href =
    url.href;
}


function setupNewConversationButton() {
  if (!newConversationButton) {
    return;
  }

  if (
    newConversationButton.dataset.bound ===
    "true"
  ) {
    return;
  }

  newConversationButton.dataset.bound =
    "true";

  newConversationButton.addEventListener(
    "click",
    () => {
      startNewConversation();
    }
  );
}


/* =========================================================
   サイドバー
========================================================= */

function setupSidebarToggle() {
  const toggles =
    $all(
      ".sidebar-toggle, [data-sidebar-toggle]"
    );

  for (const button of toggles) {
    if (
      button.dataset.pageSidebarBound ===
      "true"
    ) {
      continue;
    }

    button.dataset.pageSidebarBound =
      "true";

    button.addEventListener(
      "click",
      () => {
        const mobile =
          window.matchMedia(
            "(max-width: 700px)"
          ).matches;

        if (mobile) {
          document.body.classList.toggle(
            "sidebar-expanded"
          );
        } else {
          document.body.classList.toggle(
            "sidebar-collapsed"
          );
        }
      }
    );
  }
}


/* =========================================================
   サイドバーの現在位置
========================================================= */

function setupActiveSidebar() {
  const current =
    location.pathname
      .split("/")
      .pop() ||
    "index.html";

  const links =
    $all(
      ".sidebar a, .sidebar-link"
    );

  for (const link of links) {
    const href =
      link.getAttribute("href") ||
      "";

    const file =
      href
        .split("?")[0]
        .split("#")[0]
        .split("/")
        .pop();

    if (
      file &&
      file === current
    ) {
      link.classList.add(
        "active"
      );

      link.setAttribute(
        "aria-current",
        "page"
      );
    }
  }
}


/* =========================================================
   ログアウト
========================================================= */

async function logout() {
  try {
    await signOut(auth);

    const nested =
      location.pathname.includes(
        "/student/"
      ) ||
      location.pathname.includes(
        "/admin/"
      );

    location.replace(
      nested
        ? "../login.html"
        : "./login.html"
    );

  } catch (error) {
    console.error(
      "ログアウトエラー:",
      error
    );

    showError(
      `ログアウトに失敗しました。\n${error.message || error}`
    );
  }
}


function setupLogout() {
  const buttons =
    $all(
      "[data-logout], .logout-button"
    );

  for (const button of buttons) {
    if (
      button.dataset.pageLogoutBound ===
      "true"
    ) {
      continue;
    }

    button.dataset.pageLogoutBound =
      "true";

    button.addEventListener(
      "click",
      async () => {
        button.disabled = true;

        try {
          await logout();
        } finally {
          button.disabled = false;
        }
      }
    );
  }
}


/* =========================================================
   認証
========================================================= */

async function initializeAuth() {
  /*
   * question.htmlは学生ページなので、
   * ここでFirebase認証を確認する。
   *
   * auth.js側のrequireRoleに統一。
   */
  const result =
    await requireRole(
      "student",
      {
        allowMaintenance: false
      }
    );

  if (!result) {
    return null;
  }

  return result;
}


/* =========================================================
   初期化
========================================================= */

async function initializePage() {
  try {
    /*
     * まず認証。
     */
    const authResult =
      await initializeAuth();

    if (!authResult) {
      return;
    }

    /*
     * サイドバー。
     */
    setupSidebarToggle();

    setupActiveSidebar();

    setupLogout();

    /*
     * 質問フォーム。
     */
    setupQuestionForm();

    setupQuestionInput();

    setupNewConversationButton();

    /*
     * 会話IDが存在する場合、
     * その会話を読み込む。
     *
     * 存在しない場合は新規会話。
     */
    await loadConversation();

    /*
     * 入力欄へフォーカス。
     */
    if (
      questionInput &&
      !questionInput.disabled
    ) {
      questionInput.focus();
    }

  } catch (error) {
    console.error(
      "question.html 初期化エラー:",
      error
    );

    showError(
      `画面の初期化に失敗しました。\n${error.message || error}`
    );
  }
}


/* =========================================================
   DOM ready
========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializePage,
    {
      once: true
    }
  );
} else {
  initializePage();
}


/* =========================================================
   外部から利用可能にする
========================================================= */

window.StudyAIChat = {
  submitQuestion,
  startNewConversation,
  getConversationId() {
    return currentConversationId;
  },
  getAnswerId() {
    return currentAnswerId;
  }
};
