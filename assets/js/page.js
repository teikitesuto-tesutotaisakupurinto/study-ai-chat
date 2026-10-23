import {
  auth,
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "./firebase.js";

import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { setupSidebar, setupLogout } from "./layout.js";

const AI_URL =
  "https://fjqobjcvejhkevyfsoxt.supabase.co/functions/v1/study-chat";

const $ = id => document.getElementById(id);

const SUBJECTS = [
  "国語", "数学", "英語", "理科", "社会",
  "音楽", "美術", "保健体育", "技術家庭"
];

const NON_STUDY_RESPONSE =
  "このAIは学習専用です。学習以外の質問はできません。";

let user = null;
let profile = null;
let conversationId = null;
let turns = [];
let sending = false;

const conversation = $("conversation");
const welcome = $("welcomeMessage");
const form = $("questionForm");
const input = $("questionInput");
const subjectSelect = $("subjectSelect");
const sendButton = $("sendButton");
const statusMessage = $("statusMessage");

function showStatus(message) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.hidden = !message;
}

function waitForUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      currentUser => {
        unsubscribe();
        resolve(currentUser);
      },
      error => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

function makeId() {
  return crypto.randomUUID();
}

function conversationRef(id = conversationId) {
  return doc(db, "chatHistories", id);
}

function turnsRef(id = conversationId) {
  return collection(db, "chatHistories", id, "turns");
}

function setBusy(value) {
  sending = value;
  if (sendButton) {
    sendButton.disabled = value;
    sendButton.textContent = value ? "回答中..." : "質問する";
  }
  if (input) input.disabled = value;
  if (subjectSelect) subjectSelect.disabled = value;

  const newButton = $("newChatButton");
  if (newButton) newButton.disabled = value;
}

function renderTurn(turn) {
  if (!conversation || !turn) return;

  if (welcome) welcome.hidden = true;

  const block = document.createElement("article");
  block.className = "conversation-turn";
  block.dataset.questionId = turn.questionId || "";
  block.dataset.answerId = turn.answerId || "";

  const question = document.createElement("section");
  question.className = "message user";

  const questionLabel = document.createElement("div");
  questionLabel.className = "message-role";
  questionLabel.textContent = "あなた";

  const questionBody = document.createElement("div");
  questionBody.className = "message-content";
  questionBody.textContent = turn.question || "";

  const questionIdLabel = document.createElement("small");
  questionIdLabel.className = "answer-id";
  questionIdLabel.textContent =
    `質問ID: ${turn.questionId || "未発行"}`;

  question.append(questionLabel, questionBody, questionIdLabel);

  const answer = document.createElement("section");
  answer.className = "message assistant";

  const answerLabel = document.createElement("div");
  answerLabel.className = "message-role";
  answerLabel.textContent = "学習AI";

  const answerBody = document.createElement("div");
  answerBody.className = "message-content";
  answerBody.textContent =
    turn.answer || "回答を生成できませんでした。";

  const answerIdLabel = document.createElement("small");
  answerIdLabel.className = "answer-id";
  answerIdLabel.textContent =
    `回答ID: ${turn.answerId || "未発行"}`;

  answer.append(answerLabel, answerBody, answerIdLabel);
  block.append(question, answer);
  conversation.append(block);

  block.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderTurns() {
  if (!conversation) return;

  conversation.replaceChildren();
  if (welcome) conversation.append(welcome);

  if (welcome) welcome.hidden = turns.length > 0;

  for (const turn of turns) renderTurn(turn);
}

async function loadProfile() {
  const snapshot = await getDoc(doc(db, "users", user.uid));

  if (!snapshot.exists()) {
    throw new Error("ユーザープロフィールが見つかりません。");
  }

  profile = snapshot.data();

  if (profile.status !== "active" || profile.role !== "student") {
    throw new Error("このアカウントでは利用できません。");
  }

  const settings = await getDoc(doc(db, "settings", "system"));

  if (settings.exists() && settings.data().maintenance === true) {
    location.replace("../maintenance.html");
    throw new Error("現在メンテナンス中です。");
  }
}

async function createConversation() {
  const ref = doc(collection(db, "chatHistories"));
  const subject = SUBJECTS.includes(subjectSelect?.value)
    ? subjectSelect.value
    : "数学";

  await setDoc(ref, {
    userId: user.uid,
    conversationId: ref.id,
    title: "新しい学習会話",
    subject,
    grade: profile.grade || "中学生",
    turnCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  conversationId = ref.id;
  turns = [];

  localStorage.setItem(
    `studyAIConversation:${user.uid}`,
    conversationId
  );

  if (subjectSelect) subjectSelect.value = subject;
  renderTurns();

  return conversationId;
}

async function loadConversation(id) {
  if (!id) return false;

  const ref = doc(db, "chatHistories", id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists() || snapshot.data().userId !== user.uid) {
    return false;
  }

  conversationId = id;

  const data = snapshot.data();

  if (SUBJECTS.includes(data.subject) && subjectSelect) {
    subjectSelect.value = data.subject;
  }

  const turnsQuery = query(
    turnsRef(id),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  const turnSnapshot = await getDocs(turnsQuery);

  turns = turnSnapshot.docs.map(item => ({
    ...item.data(),
    turnId: item.id
  }));

  localStorage.setItem(
    `studyAIConversation:${user.uid}`,
    conversationId
  );

  renderTurns();
  return true;
}

async function restoreConversation() {
  const params = new URLSearchParams(location.search);
  const requestedId = params.get("conversationId");
  const savedId = localStorage.getItem(
    `studyAIConversation:${user.uid}`
  );

  if (requestedId && await loadConversation(requestedId)) return;
  if (savedId && await loadConversation(savedId)) return;

  await createConversation();
}

function isClearlyNonStudy(text) {
  return /恋愛相談|占って|今日の天気|株価|投資|おすすめの店|旅行プラン|買い物|勉強と関係ない/.test(text);
}

async function askAI(question, subject) {
  const token = await user.getIdToken();

  const history = turns.slice(-12).flatMap(turn => [
    { role: "user", content: turn.question },
    { role: "assistant", content: turn.answer }
  ]).filter(item => item.content);

  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      message: question,
      grade: profile.grade || "中学生",
      subject,
      history,
      conversationId
    })
  });

  const raw = await response.text();
  let payload;

  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { answer: raw };
  }

  if (!response.ok) {
    throw new Error(
      payload.error || payload.message || `AI接続エラー (${response.status})`
    );
  }

  const answer =
    typeof payload === "string" ? payload :
    typeof payload.answer === "string" ? payload.answer :
    typeof payload.reply === "string" ? payload.reply :
    typeof payload.response === "string" ? payload.response :
    "";

  if (!answer.trim()) {
    throw new Error("AIから回答本文が返されませんでした。");
  }

  return answer.trim();
}

async function submitQuestion(event) {
  event.preventDefault();

  if (sending || !user || !conversationId) return;

  const question = input.value.trim();
  const subject = subjectSelect.value;

  if (!question) {
    showStatus("質問内容を入力してください。");
    return;
  }

  if (!SUBJECTS.includes(subject)) {
    showStatus("教科を選択してください。");
    return;
  }

  setBusy(true);
  showStatus("");

  const questionId = makeId();
  const answerId = makeId();
  const turnRef = doc(turnsRef(), questionId);

  const turn = {
    questionId,
    answerId,
    conversationId,
    userId: user.uid,
    subject,
    question,
    answer: "",
    createdAt: serverTimestamp()
  };

  try {
    // 先に質問を保存。AI側でエラーになっても質問自体を残す。
    await setDoc(turnRef, turn);

    turns.push({
      ...turn,
      answer: "回答を作成しています..."
    });

    renderTurns();
    input.value = "";

    const answer = isClearlyNonStudy(question)
      ? NON_STUDY_RESPONSE
      : await askAI(question, subject);

    await updateDoc(turnRef, {
      answer,
      answeredAt: serverTimestamp()
    });

    const index = turns.findIndex(t => t.questionId === questionId);
    if (index >= 0) turns[index].answer = answer;

    await updateDoc(conversationRef(), {
      subject,
      title: question.slice(0, 60),
      turnCount: turns.length,
      updatedAt: serverTimestamp()
    });

    renderTurns();
  } catch (error) {
    console.error("質問・回答保存エラー:", error);

    const index = turns.findIndex(t => t.questionId === questionId);
    if (index >= 0) {
      turns[index].answer =
        `処理に失敗しました。質問ID: ${questionId}\n${error.message || String(error)}`;
    }

    renderTurns();

    showStatus(
      `処理または保存に失敗しました。\n${error.code || "error"}: ${error.message || String(error)}`
    );
  } finally {
    setBusy(false);
    input.focus();
  }
}

async function startNewConversation() {
  if (sending) return;

  showStatus("");

  try {
    await createConversation();

    const url = new URL(location.href);
    url.searchParams.set("conversationId", conversationId);
    history.replaceState({}, "", url);

    input.value = "";
    input.focus();
  } catch (error) {
    console.error("新規会話作成エラー:", error);
    showStatus(
      `新しい会話を作成できませんでした。\n${error.code || "error"}: ${error.message || String(error)}`
    );
  }
}

async function initialize() {
  try {
    user = await new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = onAuthStateChanged(auth, current => {
        unsubscribe();
        resolve(current);
      }, reject);
    });

    if (!user) {
      location.replace("../login.html");
      return;
    }

    await loadProfile();
    setupSidebar();
    setupLogout();

    await restoreConversation();

    if (conversationId) {
      const url = new URL(location.href);
      url.searchParams.set("conversationId", conversationId);
      history.replaceState({}, "", url);
    }
  } catch (error) {
    console.error("AI画面初期化エラー:", error);
    showStatus(
      `画面を初期化できませんでした。\n${error.code || "error"}: ${error.message || String(error)}`
    );
  }
}

if (form) form.addEventListener("submit", submitQuestion);

if (input) {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
}

$("newChatButton")?.addEventListener("click", startNewConversation);

await initialize();
