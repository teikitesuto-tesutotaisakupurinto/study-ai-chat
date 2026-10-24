import {
  auth,
  db
} from "./firebase.js";

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from "./firebase.js";

import {
  renderSidebar,
  setupSidebar,
  setupLogout
} from "./layout.js";

let questionPageStarted = false;

let currentConversationId = null;

let currentConversation = null;

let currentUser = null;

let currentProfile = null;

let sending = false;

function createId(prefix) {
  const random =
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  return `${prefix}_${random}`;
}

function getConversationIdFromUrl() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return (
    params.get(
      "conversationId"
    ) || null
  );
}

function setConversationUrl(
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
    url.toString()
  );
}

function clearConversationUrl() {
  const url =
    new URL(
      window.location.href
    );

  url.searchParams.delete(
    "conversationId"
  );

  window.history.replaceState(
    {},
    "",
    url.toString()
  );
}

function makeTitle(
  question
) {
  const cleaned =
    String(question || "")
      .replace(/\s+/g, " ")
      .trim();

  if (!cleaned) {
    return "新しい会話";
  }

  if (
    cleaned.length <= 30
  ) {
    return cleaned;
  }

  return (
    cleaned.slice(0, 30) +
    "…"
  );
}

function setText(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      value ?? "";
  }
}

function showChatError(
  message
) {
  const element =
    document.getElementById(
      "chatError"
    );

  if (!element) {
    return;
  }

  element.hidden =
    false;

  element.textContent =
    message;
}

function clearChatError() {
  const element =
    document.getElementById(
      "chatError"
    );

  if (!element) {
    return;
  }

  element.hidden =
    true;

  element.textContent =
    "";
}

function setSending(
  value
) {
  sending =
    value;

  const input =
    document.getElementById(
      "chatInput"
    );

  const button =
    document.getElementById(
      "sendButton"
    );

  if (input) {
    input.disabled =
      value;
  }

  if (button) {
    button.disabled =
      value;

    button.textContent =
      value
        ? "送信中..."
        : "送信";
  }
}

function scrollMessages() {
  const box =
    document.getElementById(
      "chatMessages"
    );

  if (!box) {
    return;
  }

  box.scrollTop =
    box.scrollHeight;
}

function clearEmptyState() {
  const empty =
    document.getElementById(
      "emptyChat"
    );

  if (empty) {
    empty.remove();
  }
}

function addMessage(
  role,
  content,
  responseId = null,
  createdAt = null
) {
  clearEmptyState();

  const messages =
    document.getElementById(
      "chatMessages"
    );

  if (!messages) {
    return;
  }

  const row =
    document.createElement(
      "div"
    );

  row.className =
    `message-row ${role}`;

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "message-bubble";

  bubble.textContent =
    content || "";

  const meta =
    document.createElement(
      "div"
    );

  meta.className =
    "message-meta";

  meta.textContent =
    role === "user"
      ? "あなた"
      : "学習AI";

  if (createdAt) {
    const date =
      createdAt.toDate
        ? createdAt.toDate()
        : new Date(createdAt);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      meta.textContent +=
        " ・ " +
        new Intl.DateTimeFormat(
          "ja-JP",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        ).format(date);
    }
  }

  if (
    role === "assistant" &&
    responseId
  ) {
    const id =
      document.createElement(
        "span"
      );

    id.className =
      "response-id";

    id.textContent =
      `回答ID: ${responseId}`;

    meta.append(
      id
    );
  }

  bubble.append(
    meta
  );

  row.append(
    bubble
  );

  messages.append(
    row
  );

  scrollMessages();
}

function renderConversation(
  messages
) {
  const container =
    document.getElementById(
      "chatMessages"
    );

  if (!container) {
    return;
  }

  container.replaceChildren();

  if (
    !messages ||
    messages.length === 0
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.id =
      "emptyChat";

    empty.className =
      "empty-chat";

    const inner =
      document.createElement(
        "div"
      );

    inner.className =
      "empty-chat-inner";

    const heading =
      document.createElement(
        "h2"
      );

    heading.textContent =
      "何を勉強しますか？";

    const paragraph =
      document.createElement(
        "p"
      );

    paragraph.textContent =
      "学習について質問してください。";

    inner.append(
      heading,
      paragraph
    );

    empty.append(
      inner
    );

    container.append(
      empty
    );

    return;
  }

  messages.forEach(
    message => {
      addMessage(
        message.role,
        message.content,
        message.responseId ||
          null,
        message.createdAt ||
          null
      );
    }
  );
}

async function loadConversation(
  conversationId
) {
  if (!currentUser) {
    throw new Error(
      "ログイン情報を確認できません。"
    );
  }

  const conversationRef =
    doc(
      db,
      "chatHistories",
      conversationId
    );

  const conversationSnap =
    await getDoc(
      conversationRef
    );

  if (
    !conversationSnap.exists()
  ) {
    throw new Error(
      "指定された会話が見つかりません。"
    );
  }

  const conversation =
    conversationSnap.data();

  if (
    conversation.userId !==
    currentUser.uid
  ) {
    throw new Error(
      "この会話を開く権限がありません。"
    );
  }

  const messagesQuery =
    query(
      collection(
        db,
        "chatHistories",
        conversationId,
        "messages"
      ),
      orderBy(
        "createdAt",
        "asc"
      )
    );

  const messageSnapshot =
    await getDocs(
      messagesQuery
    );

  const messages =
    messageSnapshot.docs.map(
      item => ({
        id: item.id,
        ...item.data()
      })
    );

  currentConversationId =
    conversationId;

  currentConversation =
    conversation;

  setConversationUrl(
    conversationId
  );

  setText(
    "conversationTitle",
    conversation.title ||
      "会話"
  );

  setText(
    "conversationId",
    `会話ID: ${conversationId}`
  );

  renderConversation(
    messages
  );
}

async function createConversation(
  firstQuestion = ""
) {
  if (!currentUser) {
    throw new Error(
      "ログイン情報がありません。"
    );
  }

  const conversationId =
    createId("conversation");

  const title =
    makeTitle(
      firstQuestion
    );

  const conversationRef =
    doc(
      db,
      "chatHistories",
      conversationId
    );

  const data = {
    conversationId,
    userId:
      currentUser.uid,
    title,
    lastQuestion:
      firstQuestion || "",
    messageCount: 0,
    createdAt:
      serverTimestamp(),
    updatedAt:
      serverTimestamp()
  };

  await setDoc(
    conversationRef,
    data
  );

  currentConversationId =
    conversationId;

  currentConversation =
    data;

  setConversationUrl(
    conversationId
  );

  setText(
    "conversationTitle",
    title
  );

  setText(
    "conversationId",
    `会話ID: ${conversationId}`
  );

  return conversationId;
}

async function saveMessage(
  conversationId,
  message
) {
  const messageRef =
    await addDoc(
      collection(
        db,
        "chatHistories",
        conversationId,
        "messages"
      ),
      {
        role:
          message.role,
        content:
          message.content,
        responseId:
          message.responseId ||
          null,
        userId:
          currentUser.uid,
        createdAt:
          serverTimestamp()
      }
    );

  return messageRef.id;
}

async function updateConversation(
  conversationId,
  question
) {
  await updateDoc(
    doc(
      db,
      "chatHistories",
      conversationId
    ),
    {
      lastQuestion:
        question,
      updatedAt:
        serverTimestamp()
    }
  );
}

async function sendToAI(
  conversationId,
  question
) {
  const endpoint =
    window.AI_CHAT_ENDPOINT ||
    "/api/chat";

  const response =
    await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          conversationId,
          question,
          userId:
            currentUser.uid
        })
      }
    );

  if (!response.ok) {
    let message =
      `AIサーバーエラー: HTTP ${response.status}`;

    try {
      const data =
        await response.json();

      if (data.message) {
        message =
          data.message;
      }
    } catch {
      // JSONでない場合は既定メッセージ
    }

    throw new Error(
      message
    );
  }

  const data =
    await response.json();

  if (
    !data.answer
  ) {
    throw new Error(
      "AIから回答を取得できませんでした。"
    );
  }

  return {
    answer:
      String(data.answer),
    responseId:
      data.responseId ||
      createId("response")
  };
}

async function handleQuestion(
  event
) {
  event.preventDefault();

  if (
    sending ||
    !currentUser
  ) {
    return;
  }

  const input =
    document.getElementById(
      "chatInput"
    );

  const question =
    input.value.trim();

  if (!question) {
    return;
  }

  clearChatError();

  setSending(true);

  try {

    if (
      !currentConversationId
    ) {
      await createConversation(
        question
      );
    }

    const conversationId =
      currentConversationId;

    const userMessage = {
      role: "user",
      content: question,
      responseId: null
    };

    addMessage(
      "user",
      question
    );

    input.value = "";

    await saveMessage(
      conversationId,
      userMessage
    );

    await updateConversation(
      conversationId,
      question
    );

    const result =
      await sendToAI(
        conversationId,
        question
      );

    const assistantMessage = {
      role: "assistant",
      content:
        result.answer,
      responseId:
        result.responseId
    };

    addMessage(
      "assistant",
      result.answer,
      result.responseId
    );

    await saveMessage(
      conversationId,
      assistantMessage
    );

    await updateConversation(
      conversationId,
      question
    );

  } catch (error) {

    console.error(
      "AI質問処理エラー:",
      error
    );

    showChatError(
      "回答を取得できませんでした。\n" +
      (error?.message ||
        String(error))
    );

  } finally {
    setSending(false);
    input.focus();
  }
}

async function newConversation() {
  currentConversationId =
    null;

  currentConversation =
    null;

  clearConversationUrl();

  setText(
    "conversationTitle",
    "新しい会話"
  );

  setText(
    "conversationId",
    ""
  );

  renderConversation(
    []
  );

  const input =
    document.getElementById(
      "chatInput"
    );

  if (input) {
    input.focus();
  }
}

function bindQuestionEvents() {
  const form =
    document.getElementById(
      "chatForm"
    );

  const newButton =
    document.getElementById(
      "newConversationButton"
    );

  if (form) {
    form.addEventListener(
      "submit",
      handleQuestion
    );
  }

  if (newButton) {
    newButton.addEventListener(
      "click",
      newConversation
    );
  }
}

export async function initializeQuestionPage(
  context
) {
  if (
    questionPageStarted
  ) {
    return;
  }

  questionPageStarted =
    true;

  currentUser =
    context.user;

  currentProfile =
    context.profile;

  if (!currentUser) {
    throw new Error(
      "ログイン中のユーザーが確認できません。"
    );
  }

  await renderSidebar(
    "student",
    currentUser,
    currentProfile
  );

  bindQuestionEvents();

  const conversationId =
    getConversationIdFromUrl();

  if (conversationId) {
    try {
      await loadConversation(
        conversationId
      );
    } catch (error) {

      console.error(
        "会話読み込みエラー:",
        error
      );

      clearConversationUrl();

      showChatError(
        "会話を読み込めませんでした。\n" +
        (error?.message ||
          String(error))
      );

      renderConversation(
        []
      );
    }
  } else {
    renderConversation(
      []
    );
  }
}

export function getCurrentConversationId() {
  return currentConversationId;
}

export function getCurrentUser() {
  return currentUser;
}

export {
  createConversation,
  saveMessage
};
