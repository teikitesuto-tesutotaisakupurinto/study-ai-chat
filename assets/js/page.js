import {
  auth,
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "./firebase.js";

import { protectPage } from "./auth.js";
import {
  setupSidebar,
  setupLogout
} from "./layout.js";

const AI_ENDPOINT =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

const ALLOWED_SUBJECTS = [
  "国語",
  "数学",
  "英語",
  "理科",
  "社会",
  "音楽",
  "美術",
  "保健体育",
  "技術家庭"
];

const $ = (id) => document.getElementById(id);

const conversationElement = $("conversation");
const welcomeElement = $("welcomeMessage");
const formElement = $("questionForm");
const inputElement = $("questionInput");
const subjectElement = $("subjectSelect");
const sendButton = $("sendButton");
const statusElement = $("statusMessage");
const newChatButton = $("newChatButton");

let currentUser = null;
let currentProfile = null;
let conversationId = null;
let turns = [];
let sending = false;

const requestedConversationId =
  new URLSearchParams(location.search).get("conversationId");

function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function showStatus(message = "", type = "error") {
  statusElement.textContent = message;
  statusElement.dataset.type = type;
  statusElement.hidden = !message;
}

function setSending(value) {
  sending = value;
  inputElement.disabled = value;
  subjectElement.disabled = value;
  sendButton.disabled = value;
  newChatButton.disabled = value;

  sendButton.textContent = value
    ? "回答中..."
    : "質問する";
}

function setWelcomeVisible(visible) {
  welcomeElement.hidden = !visible;
}

function updateUrl() {
  const url = new URL(location.href);

  if (conversationId) {
    url.searchParams.set("conversationId", conversationId);
  } else {
    url.searchParams.delete("conversationId");
  }

  history.replaceState({}, "", url);
}

function getConversationRef(id = conversationId) {
  return doc(db, "chatHistories", id);
}

function getTurnsRef(id = conversationId) {
  return collection(db, "chatHistories", id, "turns");
}

function getTurnRef(questionId, id = conversationId) {
  return doc(db, "chatHistories", id, "turns", questionId);
}

function createMessageElement(turn, role, content) {
  const wrapper = document.createElement("article");

  wrapper.className = `message ${role}`;
  wrapper.dataset.questionId = turn.questionId;
  wrapper.dataset.messageRole = role;

  const roleLabel = document.createElement("div");
  roleLabel.className = "message-role";
  roleLabel.textContent =
    role === "user" ? "あなた" : "学習AI";

  const body = document.createElement("div");
  body.className = "message-content";
  body.textContent = content || "";

  wrapper.append(roleLabel, body);

  if (role === "assistant") {
    const meta = document.createElement("div");
    meta.className = "message-meta";

    meta.textContent = turn.answerId
      ? `質問ID：${turn.questionId} ／ 回答ID：${turn.answerId}`
      : `質問ID：${turn.questionId}`;

    wrapper.append(meta);
  }

  return wrapper;
}

function renderTurn(turn) {
  setWelcomeVisible(false);

  conversationElement.append(
    createMessageElement(turn, "user", turn.question)
  );

  const answer = turn.answer || (
    turn.status === "error"
      ? "回答を取得できませんでした。質問を再送信してください。"
      : "回答を作成しています..."
  );

  const assistantMessage =
    createMessageElement(turn, "assistant", answer);

  if (turn.status === "error") {
    assistantMessage.classList.add("error");
  }

  conversationElement.append(assistantMessage);
  assistantMessage.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

function renderAllTurns() {
  conversationElement.replaceChildren();

  conversationElement.append(welcomeElement);
  setWelcomeVisible(turns.length === 0);

  for (const turn of turns) {
    renderTurn(turn);
  }
}

function updateRenderedTurn(turn) {
  const existing = conversationElement.querySelectorAll(
    `[data-question-id="${CSS.escape(turn.questionId)}"]`
  );

  existing.forEach((element) => element.remove());

  const temporaryWelcome = welcomeElement.hidden;

  const userMessage =
    createMessageElement(turn, "user", turn.question);

  const answer = turn.answer || (
    turn.status === "error"
      ? "回答を取得できませんでした。もう一度お試しください。"
      : "回答を作成しています..."
  );

  const assistantMessage =
    createMessageElement(turn, "assistant", answer);

  if (turn.status === "error") {
    assistantMessage.classList.add("error");
  }

  conversationElement.append(userMessage, assistantMessage);
  setWelcomeVisible(false);

  assistantMessage.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

async function createConversation(firstQuestion = "") {
  const ref = doc(collection(db, "chatHistories"));

  const newId = ref.id;

  await setDoc(ref, {
    conversationId: newId,
    userId: currentUser.uid,
    title: firstQuestion.slice(0, 80) || "新しい会話",
    lastQuestion: firstQuestion,
    lastAnswer: "",
    turnCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  conversationId = newId;
  turns = [];
  updateUrl();

  return newId;
}

async function verifyConversationOwnership(id) {
  const snapshot = await getDoc(getConversationRef(id));

  if (!snapshot.exists()) {
    throw new Error("指定された会話履歴が見つかりません。");
  }

  const data = snapshot.data();

  if (data.userId !== currentUser.uid) {
    throw new Error("この会話を開く権限がありません。");
  }

  return data;
}

async function loadConversation(id) {
  const parentData = await verifyConversationOwnership(id);

  conversationId = id;

  const turnsQuery = query(
    getTurnsRef(id),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  const snapshot = await getDocs(turnsQuery);

  turns = snapshot.docs.map((item) => {
    const data = item.data();

    return {
      ...data,
      questionId: data.questionId || item.id,
      answerId: data.answerId || "",
      question: data.question || "",
      answer: data.answer || "",
      status: data.status || "completed"
    };
  });

  // 古い形式の履歴も、質問・回答配列がある場合は復元する。
  if (
    turns.length === 0 &&
    Array.isArray(parentData.messages)
  ) {
    const legacyMessages = parentData.messages;
    const converted = [];

    for (let i = 0; i < legacyMessages.length; i++) {
      const message = legacyMessages[i];

      if (
        message?.role !== "user" ||
        typeof message.content !== "string"
      ) {
        continue;
      }

      const next = legacyMessages[i + 1];

      if (
        next?.role !== "assistant" ||
        typeof next.content !== "string"
      ) {
        continue;
      }

      converted.push({
        questionId: createId(),
        answerId: createId(),
        subject: parentData.subject || "指定なし",
        question: message.content,
        answer: next.content,
        status: "completed",
        legacy: true
      });

      i++;
    }

    turns = converted;
  }

  updateUrl();
  renderAllTurns();

  if (ALLOWED_SUBJECTS.includes(parentData.subject)) {
    subjectElement.value = parentData.subject;
  }

  showStatus("", "success");
}

async function savePendingTurn(turn) {
  const parentRef = getConversationRef();
  const parentSnapshot = await getDoc(parentRef);

  if (
    !parentSnapshot.exists() ||
    parentSnapshot.data().userId !== currentUser.uid
  ) {
    throw new Error("会話の保存先を確認できません。");
  }

  await setDoc(getTurnRef(turn.questionId), {
    conversationId,
    userId: currentUser.uid,
    questionId: turn.questionId,
    answerId: turn.answerId,
    subject: turn.subject,
    question: turn.question,
    answer: "",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(parentRef, {
    title: parentSnapshot.data().title === "新しい会話"
      ? turn.question.slice(0, 80)
      : parentSnapshot.data().title,
    lastQuestion: turn.question,
    updatedAt: serverTimestamp()
  });
}

async function saveCompletedAnswer(turn) {
  await updateDoc(getTurnRef(turn.questionId), {
    answer: turn.answer,
    status: "completed",
    updatedAt: serverTimestamp()
  });

  const parentRef = getConversationRef();
  const parentSnapshot = await getDoc(parentRef);

  if (
    !parentSnapshot.exists() ||
    parentSnapshot.data().userId !== currentUser.uid
  ) {
    throw new Error("会話履歴を更新する権限がありません。");
  }

  await updateDoc(parentRef, {
    lastQuestion: turn.question,
    lastAnswer: turn.answer.slice(0, 500),
    turnCount: turns.length,
    updatedAt: serverTimestamp()
  });
}

async function saveFailedStatus(turn, message) {
  try {
    await updateDoc(getTurnRef(turn.questionId), {
      status: "error",
      errorMessage: String(message).slice(0, 500),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("失敗状態の保存エラー:", error);
  }
}

function buildAIHistory() {
  return turns
    .filter((turn) =>
      turn.status === "completed" &&
      turn.question &&
      turn.answer
    )
    .slice(-12)
    .map((turn) => ({
      question: turn.question,
      answer: turn.answer
    }));
}

async function callAI(question, subject) {
  const token = await currentUser.getIdToken();

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      subject,
      question,
      history: buildAIHistory(),
      conversationId
    })
  });

  const raw = await response.text();

  let payload;

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(
      `AIサーバーの応答を読み取れませんでした（HTTP ${response.status}）。`
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.error ||
      `AIとの通信に失敗しました（HTTP ${response.status}）。`
    );
  }

  if (
    typeof payload.answer !== "string" ||
    !payload.answer.trim()
  ) {
    throw new Error("AIから回答が返されませんでした。");
  }

  return payload.answer.trim();
}

async function submitQuestion(event) {
  event.preventDefault();

  if (sending || !currentUser) return;

  const question = inputElement.value.trim();
  const subject = subjectElement.value;

  showStatus("");

  if (!question) {
    showStatus("質問内容を入力してください。");
    inputElement.focus();
    return;
  }

  if (question.length > 4000) {
    showStatus("質問は4000文字以内で入力してください。");
    inputElement.focus();
    return;
  }

  if (!ALLOWED_SUBJECTS.includes(subject)) {
    showStatus("正しい教科を選択してください。");
    return;
  }

  setSending(true);

  const turn = {
    questionId: createId(),
    answerId: createId(),
    subject,
    question,
    answer: "",
    status: "pending"
  };

  let questionSaved = false;

  try {
    if (!conversationId) {
      await createConversation(question);
    }

    // AIを呼び出す前に質問を保存する。
    await savePendingTurn(turn);
    questionSaved = true;

    turns.push(turn);
    renderTurn(turn);

    inputElement.value = "";
    showStatus("AIが回答を作成しています...", "info");

    const answer = await callAI(question, subject);

    turn.answer = answer;
    turn.status = "completed";

    // 回答を保存できなければ、保存失敗として扱う。
    await saveCompletedAnswer(turn);

    updateRenderedTurn(turn);
    showStatus("回答と履歴を保存しました。", "success");
  } catch (error) {
    console.error("質問処理エラー:", error);

    const message =
      error?.message || "処理中にエラーが発生しました。";

    if (questionSaved) {
      turn.status = "error";
      turn.answer = "";

      updateRenderedTurn(turn);
      await saveFailedStatus(turn, message);
    }

    showStatus(
      `処理に失敗しました：${message}`,
      "error"
    );
  } finally {
    setSending(false);
    inputElement.focus();
  }
}

async function startNewConversation() {
  if (sending) return;

  conversationId = null;
  turns = [];
  updateUrl();

  conversationElement.replaceChildren();
  conversationElement.append(welcomeElement);

  setWelcomeVisible(true);
  inputElement.value = "";
  showStatus("新しい会話を開始できます。", "success");
  inputElement.focus();
}

async function initializePage() {
  try {
    const result = await protectPage("student");

    currentUser = result.user;
    currentProfile = result.profile;

    setupSidebar();
    setupLogout();

    if (requestedConversationId) {
      await loadConversation(requestedConversationId);
    } else {
      conversationId = null;
      turns = [];
      renderAllTurns();
    }

    formElement.addEventListener("submit", submitQuestion);

    newChatButton.addEventListener(
      "click",
      startNewConversation
    );

    inputElement.addEventListener("keydown", (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        formElement.requestSubmit();
      }
    });
  } catch (error) {
    console.error("AI画面初期化エラー:", error);

    showStatus(
      error?.message ||
      "AI画面を開けませんでした。ログイン状態とアクセス権限を確認してください。",
      "error"
    );
  }
}

initializePage();
