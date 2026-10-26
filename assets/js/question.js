// assets/js/question.js
// 学習AIチャット画面

import {
  auth,
  db,
  persistenceReady,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "./firebase-module.js";

import { askAI } from "./ai.js";

const loading = document.getElementById("questionLoading");
const chatSection = document.getElementById("chatSection");
const messageList = document.getElementById("messageList");
const form = document.getElementById("questionForm");
const input = document.getElementById("questionInput");
const sendButton = document.getElementById("sendButton");
const status = document.getElementById("questionStatus");
const titleElement = document.getElementById("conversationTitle");

let currentUser = null;
let currentProfile = null;
let conversationId = null;
let conversationHistory = [];
let initializing = false;
let sending = false;

const params = new URLSearchParams(window.location.search);
const requestedConversationId = params.get("conversationId");
const requestedAnswerId = params.get("answerId");

function setStatus(text) {
  if (status) {
    status.textContent = text || "";
  }
}

function showChat() {
  if (loading) loading.hidden = true;
  if (chatSection) chatSection.hidden = false;
}

function showLoading(text) {
  if (loading) {
    loading.hidden = false;
    loading.textContent = text;
  }

  if (chatSection) {
    chatSection.hidden = true;
  }
}

function showError(message) {
  showLoading(message);
  setStatus("");
}

function setSending(value) {
  sending = value;

  if (sendButton) {
    sendButton.disabled = value;
    sendButton.textContent = value ? "回答を生成しています..." : "送信";
  }

  if (input) {
    input.disabled = value;
  }
}

function createMessageElement(message) {
  const wrapper = document.createElement("article");

  wrapper.className =
    `chat-message ${
      message.role === "user"
        ? "message-user"
        : "message-ai"
    }`;

  if (message.answerId) {
    wrapper.dataset.answerId = message.answerId;
  }

  const role = document.createElement("div");
  role.className = "message-role";
  role.textContent =
    message.role === "user" ? "あなた" : "学習AI";

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = message.content || "";

  wrapper.append(role, content);
  return wrapper;
}

function renderMessage(message) {
  if (!messageList) return;

  messageList.append(createMessageElement(message));
  messageList.scrollTop = messageList.scrollHeight;
}

function createAnswerId() {
  return (
    "ans_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 10)
  );
}

function getRootPath(fileName) {
  return `../${fileName}`;
}

async function waitForCurrentUser() {
  await persistenceReady;

  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let finished = false;

    const timeout = setTimeout(() => {
      finish(
        new Error(
          "ログイン状態の確認がタイムアウトしました。ページを再読み込みしてください。"
        )
      );
    }, 15000);

    function finish(error, user) {
      if (finished) return;

      finished = true;
      clearTimeout(timeout);

      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      if (error) {
        reject(error);
      } else {
        resolve(user);
      }
    }

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        user => finish(null, user),
        error => finish(error)
      );
    } catch (error) {
      finish(error);
    }
  });
}

async function createConversation(user) {
  const conversationRef = await addDoc(
    collection(db, "chatConversations"),
    {
      userId: user.uid,
      title: "新しい学習",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  conversationId = conversationRef.id;

  if (titleElement) {
    titleElement.textContent = "新しい学習";
  }

  conversationHistory = [];
  return conversationId;
}

async function loadConversation(user, id) {
  const conversationSnap = await getDoc(
    doc(db, "chatConversations", id)
  );

  if (!conversationSnap.exists()) {
    throw new Error("指定された会話が見つかりません。");
  }

  const conversation = conversationSnap.data();

  if (conversation.userId !== user.uid) {
    const error = new Error(
      "この会話を開く権限がありません。"
    );
    error.code = "permission-denied";
    throw error;
  }

  conversationId = id;

  if (titleElement) {
    titleElement.textContent =
      conversation.title || "学習AIとの会話";
  }

  const messagesQuery = query(
    collection(db, "chatMessages"),
    where("conversationId", "==", id),
    orderBy("createdAt", "asc")
  );

  const snapshot = await getDocs(messagesQuery);

  if (messageList) {
    messageList.replaceChildren();
  }

  conversationHistory = [];

  snapshot.forEach(item => {
    const data = item.data();

    const message = {
      id: item.id,
      ...data
    };

    renderMessage(message);

    if (
      (message.role === "user" ||
        message.role === "assistant") &&
      typeof message.content === "string"
    ) {
      conversationHistory.push({
        role: message.role,
        content: message.content
      });
    }
  });
}

async function initializeConversation(user) {
  if (requestedConversationId) {
    await loadConversation(user, requestedConversationId);
  } else {
    await createConversation(user);
  }
}

async function saveUserMessage(content, answerId) {
  const data = {
    conversationId,
    userId: currentUser.uid,
    role: "user",
    content,
    answerId,
    createdAt: serverTimestamp()
  };

  const reference = await addDoc(
    collection(db, "chatMessages"),
    data
  );

  conversationHistory.push({
    role: "user",
    content
  });

  return reference.id;
}

async function saveAIMessage(content, answerId) {
  const data = {
    conversationId,
    userId: currentUser.uid,
    role: "assistant",
    content,
    answerId,
    createdAt: serverTimestamp()
  };

  const reference = await addDoc(
    collection(db, "chatMessages"),
    data
  );

  conversationHistory.push({
    role: "assistant",
    content
  });

  return reference.id;
}

async function updateConversationTitle(question) {
  if (!conversationId) return;

  const title = question
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

  if (!title) return;

  await setDoc(
    doc(db, "chatConversations", conversationId),
    {
      title,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  if (titleElement) {
    titleElement.textContent = title;
  }
}

async function generateAIAnswer(question) {
  const history = conversationHistory
    .slice(-12)
    .map(item => ({
      role: item.role,
      content: item.content
    }));

  const grade =
    currentProfile?.grade ||
    currentProfile?.schoolGrade ||
    "中学生";

  // 現在の画面に教科選択欄がないため、教科は学習全般とする。
  // 教科選択欄がある場合は、ここを選択値に置き換える。
  const subject =
    document.getElementById("subjectSelect")?.value ||
    "学習全般";

  const prompt = requestedAnswerId
    ? `前の回答に関連する質問です。\n${question}`
    : question;

  return await askAI({
    message: prompt,
    grade,
    subject,
    history
  });
}

async function sendQuestion() {
  if (sending) return;

  const question = input?.value.trim();

  if (!question || !conversationId || !currentUser) {
    return;
  }

  setSending(true);
  setStatus("回答を生成しています...");

  const answerId = createAnswerId();

  try {
    await saveUserMessage(question, answerId);

    renderMessage({
      role: "user",
      content: question,
      answerId
    });

    if (input) {
      input.value = "";
    }

    await updateConversationTitle(question);

    const aiAnswer = await generateAIAnswer(question);

    await saveAIMessage(aiAnswer, answerId);

    renderMessage({
      role: "assistant",
      content: aiAnswer,
      answerId
    });

    setStatus("回答を保存しました。");
  } catch (error) {
    console.error("質問処理エラー:", error);

    const code = error?.code || "";
    const message = error?.message || String(error);

    if (
      code === "permission-denied" ||
      /Missing or insufficient permissions/i.test(message)
    ) {
      setStatus(
        "アクセス権限がありません。Firestoreのルールを確認してください。"
      );
    } else {
      setStatus(`処理に失敗しました: ${message}`);
    }

    const errorMessage = document.createElement("div");
    errorMessage.className = "question-error";
    errorMessage.textContent =
      `回答を取得できませんでした。\n${message}`;

    messageList?.append(errorMessage);
  } finally {
    setSending(false);
    input?.focus();
  }
}

async function initialize() {
  if (initializing) return;
  initializing = true;

  showLoading("学習AIチャットを準備しています。");

  try {
    const user = await waitForCurrentUser();

    if (!user) {
      window.location.replace(getRootPath("login.html"));
      return;
    }

    currentUser = user;

    const profileSnap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!profileSnap.exists()) {
      throw new Error(
        "ユーザープロフィールがありません。管理者に確認してください。"
      );
    }

    currentProfile = profileSnap.data();

    if (currentProfile.role !== "student") {
      window.location.replace(getRootPath("403.html"));
      return;
    }

    if (currentProfile.status !== "active") {
      throw new Error(
        "このアカウントは現在利用できません。"
      );
    }

    await initializeConversation(user);

    showChat();
    input?.focus();
  } catch (error) {
    console.error("質問画面初期化エラー:", error);

    if (
      error?.code === "permission-denied" ||
      /この会話を開く権限がありません/.test(error?.message || "")
    ) {
      window.location.replace(getRootPath("403.html"));
      return;
    }

    showError(
      "質問画面を初期化できませんでした。\n" +
      (error?.message || String(error))
    );
  } finally {
    initializing = false;
  }
}

if (form) {
  form.addEventListener("submit", event => {
    event.preventDefault();
    sendQuestion();
  });
} else {
  console.error(
    "質問フォーム #questionForm がHTMLに見つかりません。"
  );
}

initialize();
